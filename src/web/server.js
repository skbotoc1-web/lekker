import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../core/db.js';
import { handleReview } from '../services/approvalService.js';
import { runHook } from '../hooks/pipelineHooks.js';
import { getWeeklyPlan } from '../services/weeklyPlan.js';

const TZ = 'Europe/Zurich';
const FEEDS_DIR = path.resolve('data/feeds');
const RECIPE_SLOTS = ['fruehstueck', 'mittagessen', 'abendessen', 'snack', 'drink'];
const EXPECTED_RECIPE_COUNT = RECIPE_SLOTS.length * 2;

function htmlLayout({ title, description, canonical, body, jsonLd }) {
  return `<!doctype html>
<html lang="de-CH">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <link rel="stylesheet" href="/styles.css" />
  ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body>
  <header class="topbar">
    <a class="brand" href="/" aria-label="lekker Startseite">lekker</a>
    <nav>
      <a href="/menue">Menü-Archiv</a>
      <a href="/wochenplan">Wochenplan</a>
      <a href="/status">Status</a>
      <a href="/api/menu/today">API</a>
    </nav>
  </header>
  <main class="container">${body}</main>
</body>
</html>`;
}

function recipeKey(option, slot) {
  return `${option}:${slot}`;
}

function getRecipeLookup(menuId) {
  const rows = db.prepare('SELECT option_type, meal_slot FROM recipes WHERE menu_id=?').all(menuId);
  return new Set(rows.map(r => recipeKey(r.option_type, r.meal_slot)));
}

function recipeCta(day, lookup, option, slot) {
  if (!lookup.has(recipeKey(option, slot))) {
    return `<span class="recipe-pending" aria-label="Rezept folgt">Rezept folgt</span>`;
  }
  return `<a class="recipe-link" href="/rezept/${option}/${day}/${slot}">Rezept</a>`;
}

function menuCards(menu, recipeLookup = new Set()) {
  const recipeCount = recipeLookup.size;
  const isComplete = recipeCount >= EXPECTED_RECIPE_COUNT;

  return `
  <section class="status-row">
    <span class="badge ${menu.status === 'published' ? 'ok' : 'warn'}">${menu.status}</span>
    <span class="badge ${isComplete ? 'ok' : 'warn'}">${isComplete ? 'Rezepte komplett' : 'Rezepte in Vorbereitung'}</span>
    <span>Datum: <strong>${menu.day}</strong></span>
    <span>CO₂ Ø: <strong>${menu.co2_score}</strong></span>
    <span>Rezepte: <strong>${recipeCount}/${EXPECTED_RECIPE_COUNT}</strong></span>
  </section>
  ${menu.status !== 'published' ? '<p class="draft-hint">Dieses Menü ist ein Entwurf. Einzelne Rezepte können noch fehlen.</p>' : ''}
  <section class="grid" aria-label="Menüoptionen">
    <article class="card">
      <h2>🌱 Vegan</h2>
      <ul class='meal-list'>
        <li><span><strong>Frühstück</strong><small>${menu.vegan_breakfast}</small></span>${recipeCta(menu.day, recipeLookup, 'vegan', 'fruehstueck')}</li>
        <li><span><strong>Mittag</strong><small>${menu.vegan_lunch}</small></span>${recipeCta(menu.day, recipeLookup, 'vegan', 'mittagessen')}</li>
        <li><span><strong>Abend</strong><small>${menu.vegan_dinner}</small></span>${recipeCta(menu.day, recipeLookup, 'vegan', 'abendessen')}</li>
        <li><span><strong>Snack</strong><small>${menu.vegan_snack}</small></span>${recipeCta(menu.day, recipeLookup, 'vegan', 'snack')}</li>
        <li><span><strong>Getränk</strong><small>${menu.vegan_drink}</small></span>${recipeCta(menu.day, recipeLookup, 'vegan', 'drink')}</li>
      </ul>
    </article>
    <article class="card">
      <h2>🍽️ Nicht-vegan</h2>
      <ul class='meal-list'>
        <li><span><strong>Frühstück</strong><small>${menu.omni_breakfast}</small></span>${recipeCta(menu.day, recipeLookup, 'omni', 'fruehstueck')}</li>
        <li><span><strong>Mittag</strong><small>${menu.omni_lunch}</small></span>${recipeCta(menu.day, recipeLookup, 'omni', 'mittagessen')}</li>
        <li><span><strong>Abend</strong><small>${menu.omni_dinner}</small></span>${recipeCta(menu.day, recipeLookup, 'omni', 'abendessen')}</li>
        <li><span><strong>Snack</strong><small>${menu.omni_snack}</small></span>${recipeCta(menu.day, recipeLookup, 'omni', 'snack')}</li>
        <li><span><strong>Getränk</strong><small>${menu.omni_drink}</small></span>${recipeCta(menu.day, recipeLookup, 'omni', 'drink')}</li>
      </ul>
    </article>
  </section>`;
}

function getDayToday() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
}

function normalizeRecipeRow(row) {
  return {
    ...row,
    ingredients: JSON.parse(row.ingredients || '[]'),
    steps: JSON.parse(row.steps || '[]'),
    meta: JSON.parse(row.meta || '{}')
  };
}

function slotLabel(slot) {
  const map = {
    fruehstueck: 'Frühstück',
    mittagessen: 'Mittag',
    abendessen: 'Abend',
    snack: 'Snack / Zvieri',
    drink: 'Drink des Tages'
  };
  return map[slot] || slot;
}

function difficultyLabel(value) {
  if (value <= 1) return 'sehr einfach';
  if (value <= 2) return 'einfach';
  if (value <= 3) return 'mittel';
  if (value <= 4) return 'anspruchsvoll';
  return 'fortgeschritten';
}

function pickHomepageMenu() {
  const today = getDayToday();
  const rows = db.prepare(`
    SELECT m.*, (
      SELECT COUNT(*) FROM recipes r WHERE r.menu_id = m.id
    ) AS recipe_count
    FROM menus m
    WHERE m.day <= ?
    ORDER BY m.day DESC
  `).all(today);

  if (!rows.length) return null;
  const todayComplete = rows.find(r => r.day === today && r.recipe_count >= EXPECTED_RECIPE_COUNT);
  if (todayComplete) return { menu: todayComplete, mode: 'today-complete' };

  const latestComplete = rows.find(r => r.recipe_count >= EXPECTED_RECIPE_COUNT);
  if (latestComplete) return { menu: latestComplete, mode: 'latest-complete' };

  return { menu: rows[0], mode: 'latest-incomplete' };
}

export function createServer() {
  const app = express();
  app.use(express.static('public'));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_, res) => res.json({ ok: true }));

  app.post('/hooks/run/:stage', async (req, res) => {
    const expected = process.env.HOOK_TOKEN;
    const provided = req.headers['x-hook-token'];
    if (expected && provided !== expected) return res.status(401).json({ error: 'unauthorized' });

    try {
      const out = await runHook(req.params.stage);
      return res.json(out);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/feeds/:tab.:ext', (req, res) => {
    const { tab, ext } = req.params;

    if (tab === 'menu-today' && ext === 'json') {
      const day = getDayToday();
      const menu = db.prepare('SELECT * FROM menus WHERE day=?').get(day);
      if (!menu) return res.status(404).json({ error: 'Noch kein Menü für heute verfügbar.' });
      const recipes = db.prepare('SELECT * FROM recipes WHERE menu_id=? ORDER BY option_type, meal_slot').all(menu.id)
        .map(normalizeRecipeRow);
      return res.json({ menu, recipes });
    }

    const allowedExt = ['csv', 'jsonl'];
    if (!allowedExt.includes(ext)) return res.status(400).send('Unsupported feed extension.');

    const filePath = path.join(FEEDS_DIR, `${tab}.${ext}`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Feed not found.' });

    res.type(ext === 'csv' ? 'text/csv' : 'application/x-ndjson');
    return res.send(fs.readFileSync(filePath, 'utf8'));
  });

  app.get('/robots.txt', (_, res) => {
    res.type('text/plain').send('User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n');
  });

  app.get('/sitemap.xml', (_, res) => {
    const rows = db.prepare('SELECT day FROM menus ORDER BY day DESC LIMIT 200').all();
    const urls = rows.map(r => `<url><loc>/menue/${r.day}</loc></url>`).join('');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>/</loc></url><url><loc>/menue</loc></url><url><loc>/wochenplan</loc></url><url><loc>/status</loc></url>${urls}</urlset>`);
  });

  app.get('/review/:token', (req, res) => {
    const { token } = req.params;
    const action = req.query.action;
    const result = handleReview(token, action);

    if (result.ok && action === 'reject') {
      const today = getDayToday();
      db.prepare("UPDATE menus SET status='draft' WHERE day=?").run(today);
    }

    return res.send(htmlLayout({
      title: 'Review Ergebnis | lekker',
      description: 'Freigabestatus für Tagesmenü',
      canonical: '/review',
      body: `<h1>${result.message}</h1><p><a href='/'>Zur App</a></p>`
    }));
  });

  app.get('/api/menu/today', (_, res) => {
    const menu = db.prepare('SELECT * FROM menus WHERE day=?').get(getDayToday());
    if (!menu) return res.status(404).json({ error: 'Noch kein Menü für heute verfügbar.' });
    const recipes = db.prepare('SELECT * FROM recipes WHERE menu_id=? ORDER BY option_type, meal_slot').all(menu.id)
      .map(normalizeRecipeRow);
    return res.json({ menu, recipes });
  });

  app.get('/api/weekly-plan', (req, res) => {
    const days = Math.max(3, Math.min(14, Number(req.query.days || 7)));
    return res.json(getWeeklyPlan(days));
  });

  app.get('/api/status', (_, res) => {
    const latestRuns = db.prepare('SELECT stage, ok, duration_ms, details, created_at FROM pipeline_runs ORDER BY id DESC LIMIT 20').all();
    const latestMenu = db.prepare('SELECT day,status,co2_score,created_at FROM menus ORDER BY day DESC LIMIT 1').get();
    const okRatio = latestRuns.length ? latestRuns.filter(r => r.ok === 1).length / latestRuns.length : 1;
    return res.json({
      ok: okRatio >= 0.8,
      generatedAt: new Date().toISOString(),
      latestMenu,
      runHealth: {
        sampleSize: latestRuns.length,
        successRatio: Number(okRatio.toFixed(2))
      },
      latestRuns: latestRuns.map(r => ({ ...r, details: JSON.parse(r.details || '{}') }))
    });
  });

  app.get('/menue', (_, res) => {
    const menus = db.prepare(`
      SELECT m.day, m.status, m.co2_score,
      (SELECT COUNT(*) FROM recipes r WHERE r.menu_id = m.id) as recipe_count
      FROM menus m ORDER BY day DESC LIMIT 60
    `).all();

    const list = menus
      .map(m => `<li><a href="/menue/${m.day}">${m.day}</a> · ${m.status} · CO₂ ${m.co2_score} · Rezepte ${m.recipe_count}/${EXPECTED_RECIPE_COUNT}</li>`)
      .join('');

    res.send(htmlLayout({
      title: 'Menü-Archiv | lekker',
      description: 'Alle bisherigen Tagesmenüs für die Schweiz',
      canonical: '/menue',
      body: `<h1>Menü-Archiv</h1><p class='lead'>Alle Vorschläge mit Rezept-Vollständigkeit.</p><ul class='archive'>${list || '<li>Noch keine Einträge</li>'}</ul>`
    }));
  });

  app.get('/wochenplan', (_, res) => {
    const weekly = getWeeklyPlan(7);
    const menuList = weekly.menus.map(m => `<li><a href="/menue/${m.day}">${m.day}</a> · ${m.status} · CO₂ ${m.co2_score}</li>`).join('');
    const repeats = weekly.repetition.topRepeats.length
      ? `<ul>${weekly.repetition.topRepeats.map(r => `<li>${r.dish} <strong>(${r.count}x)</strong></li>`).join('')}</ul>`
      : '<p>Keine Wiederholungen in den letzten Tagen 🎉</p>';

    res.send(htmlLayout({
      title: 'Wochenplan | lekker',
      description: '7-Tage-Überblick inklusive Sichtbarkeit zu Wiederholungen.',
      canonical: '/wochenplan',
      body: `<h1>Wochenplan (7 Tage)</h1>
      <section class='card'><h2>Übersicht</h2><ul class='archive'>${menuList || '<li>Noch keine Einträge</li>'}</ul></section>
      <section class='card'><h2>Anti-Repetition Radar</h2><p>Einzigartige Gerichte: <strong>${weekly.repetition.uniqueDishCount}</strong></p>${repeats}</section>`
    }));
  });

  app.get('/status', (_, res) => {
    const latestRuns = db.prepare('SELECT stage, ok, duration_ms, created_at FROM pipeline_runs ORDER BY id DESC LIMIT 15').all();
    const rows = latestRuns.map(r => `<tr><td>${r.created_at}</td><td>${r.stage}</td><td>${r.ok ? 'ok' : 'fail'}</td><td>${r.duration_ms} ms</td></tr>`).join('');
    res.send(htmlLayout({
      title: 'Systemstatus | lekker',
      description: 'Laufstatus der Pipeline und letzte Ausführungen.',
      canonical: '/status',
      body: `<h1>Systemstatus</h1><section class='card'><table><thead><tr><th>Zeit</th><th>Stage</th><th>Status</th><th>Dauer</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Keine Runs vorhanden</td></tr>'}</tbody></table></section>
      <p><a href='/api/status'>JSON Status API</a></p>`
    }));
  });

  app.get('/menue/:day', (req, res) => {
    const menu = db.prepare('SELECT * FROM menus WHERE day=?').get(req.params.day);
    if (!menu) return res.status(404).send('Menü nicht gefunden.');

    const recipeLookup = getRecipeLookup(menu.id);

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Menu',
      name: `Lekker Tagesmenü ${menu.day}`,
      hasMenuSection: [
        { '@type': 'MenuSection', name: 'Vegan' },
        { '@type': 'MenuSection', name: 'Nicht-vegan' }
      ]
    };

    res.send(htmlLayout({
      title: `Menü ${menu.day} | lekker`,
      description: `Tagesmenü mit veganen und nicht-veganen Rezeptideen für ${menu.day}.`,
      canonical: `/menue/${menu.day}`,
      body: `<h1>Menü vom ${menu.day}</h1>${menuCards(menu, recipeLookup)}<p><a href='/menue'>← Zurück zum Archiv</a></p>`,
      jsonLd
    }));
  });

  app.get('/rezept/:option/:day/:slot', (req, res) => {
    const { option, day, slot } = req.params;
    const menu = db.prepare('SELECT * FROM menus WHERE day=?').get(day);
    if (!menu) return res.status(404).send('Menü nicht gefunden.');

    const recipeRaw = db.prepare('SELECT * FROM recipes WHERE menu_id=? AND option_type=? AND meal_slot=?').get(menu.id, option, slot);
    if (!recipeRaw) return res.status(404).send('Rezept nicht gefunden.');

    const recipe = normalizeRecipeRow(recipeRaw);
    const ingredients = recipe.ingredients.map(i => `<li>${i}</li>`).join('');
    const steps = recipe.steps.map((s, i) => `<li><strong>${i + 1}.</strong> ${s}</li>`).join('');
    const shoppingTips = (recipe.meta.tipsShopping || []).map(t => `<li>${t}</li>`).join('');
    const cookingTips = (recipe.meta.tipsCooking || []).map(t => `<li>${t}</li>`).join('');

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: recipe.meta.titleMarketing || recipe.title,
      recipeCuisine: 'Schweiz',
      recipeIngredient: recipe.ingredients,
      recipeInstructions: recipe.steps,
      description: recipe.meta.subtitle || recipe.title
    };

    const body = `
      <article class='card recipe'>
        <p class='eyebrow'>${option === 'vegan' ? 'Vegan' : 'Nicht-vegan'} · ${slotLabel(slot)}</p>
        <h1>${recipe.meta.titleMarketing || recipe.title}</h1>
        <p class='subtitle'>${recipe.meta.subtitle || recipe.title}</p>

        <section class='meta-grid'>
          <div><strong>Portionen</strong><span>${recipe.meta.servings || 1}</span></div>
          <div><strong>Zeit</strong><span>${recipe.meta.timeMin || '-'} Min</span></div>
          <div><strong>Schwierigkeit</strong><span>${difficultyLabel(recipe.meta.difficulty || 1)}</span></div>
          <div><strong>Kalorien</strong><span>ca. ${recipe.meta.kcal || '-'} kcal</span></div>
          <div><strong>CO₂-Ampel</strong><span>${recipe.meta.co2Label || '-'}</span></div>
        </section>

        <h2>Zutaten</h2>
        <ul>${ingredients}</ul>

        <h2>Zubereitung</h2>
        <ol>${steps}</ol>

        <h2>Einkaufs- und Kochhinweise</h2>
        <ul>${shoppingTips}${cookingTips}</ul>

        <nav class='inline-links'>
          <a href='/menue/${day}'>← Zurück zum Menü</a>
          <a href='/wochenplan'>Wochenplan ansehen</a>
          <a href='/menue'>Archiv</a>
        </nav>
      </article>
    `;

    res.send(htmlLayout({
      title: `${recipe.meta.titleMarketing || recipe.title} Rezept | lekker`,
      description: `Schritt-für-Schritt Kochanleitung für ${recipe.meta.titleMarketing || recipe.title}.`,
      canonical: `/rezept/${option}/${day}/${slot}`,
      body,
      jsonLd
    }));
  });

  app.get('/', (_, res) => {
    const selected = pickHomepageMenu();

    if (!selected?.menu) {
      return res.send(htmlLayout({
        title: 'lekker – Tagesmenü Schweiz',
        description: 'Tägliche Menüvorschläge mit veganen und nicht-veganen Optionen.',
        canonical: '/',
        body: '<h1>lekker</h1><p>Noch keine Menüdaten vorhanden. Trigger: <code>RUN_PIPELINE_ON_BOOT=true</code> oder manueller Pipeline-Start.</p><p><a href="/menue">Archiv öffnen</a></p>'
      }));
    }

    const { menu, mode } = selected;
    const recipeLookup = getRecipeLookup(menu.id);

    const heading =
      mode === 'today-complete'
        ? 'Tagesmenü Schweiz'
        : mode === 'latest-complete'
          ? 'Neuester fertiger Menüvorschlag'
          : 'Menü in Vorbereitung';

    const intro =
      mode === 'today-complete'
        ? '<p class="lead">Heute frisch kuratiert mit vollständigen Rezepten.</p>'
        : mode === 'latest-complete'
          ? `<p class="lead">Für heute ist noch kein vollständiges Menü da. Hier der letzte komplette Stand vom <strong>${menu.day}</strong>.</p>`
          : '<p class="lead">Das neueste Menü wird gerade finalisiert. Rezeptlinks werden automatisch sichtbar, sobald alles bereit ist.</p>';

    res.send(htmlLayout({
      title: mode === 'today-complete' ? `lekker – Tagesmenü ${menu.day}` : `lekker – Menü ${menu.day}`,
      description: 'Protein-fokussierte Menüvorschläge für den Schweizer Markt mit klaren Rezeptstatus.',
      canonical: '/',
      body: `<h1>${heading}</h1>${intro}${menuCards(menu, recipeLookup)}<p><a href='/menue'>Vergangene Menüs ansehen →</a></p>`
    }));
  });

  return app;
}
