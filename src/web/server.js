import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../core/db.js';
import { handleReview } from '../services/approvalService.js';
import { runHook } from '../hooks/pipelineHooks.js';
import { getWeeklyPlan } from '../services/weeklyPlan.js';
import { getDisplayMenu, getTodayMenuState, getTodayDayString } from '../repositories/menuRepository.js';
import { EXPECTED_RECIPE_COUNT, getRecipeLookup } from '../repositories/recipeRepository.js';

const FEEDS_DIR = path.resolve('data/feeds');

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
  ${jsonLd ? (Array.isArray(jsonLd) ? jsonLd.map(ld => `<script type="application/ld+json">${JSON.stringify(ld)}</script>`).join('') : `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`) : ''}
</head>
<body>
  <a class="skip-link" href="#main-content">Zum Inhalt springen</a>
  <header class="topbar">
    <a class="brand" href="/" aria-label="lekker Startseite">lekker</a>
    <nav aria-label="Hauptnavigation">
      <a href="/menue">Menü-Archiv</a>
      <a href="/wochenplan">Wochenplan</a>
      <a href="/status">Status</a>
      <a href="/api/menu/today">API</a>
    </nav>
  </header>
  <main id="main-content" class="container" tabindex="-1">${body}</main>
</body>
</html>`;
}

function recipeCta(day, lookup, option, slot) {
  if (!lookup.has(`${option}:${slot}`)) {
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
  ${!isComplete ? `<div class="prep-actions"><a class="ghost-btn" href="/menue">Archiv ansehen</a><a class="ghost-btn" href="/menue/${menu.day}">Später erneut laden</a></div>` : ''}
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

function renderInfoState({ title, message, backLinks = [] }) {
  const links = backLinks.length
    ? `<nav class='inline-links'>${backLinks.map(l => `<a href='${l.href}'>${l.label}</a>`).join('')}</nav>`
    : '';

  return `<article class='card'><h1>${title}</h1><p class='lead'>${message}</p>${links}</article>`;
}

function dayRotationIndex(seed, max) {
  if (!max) return 0;
  const base = Number(String(seed || '').replace(/-/g, '')) || 1;
  return base % max;
}

function getTodayRecommendations(day) {
  const rows = db.prepare('SELECT r.title, r.meta, r.option_type, r.meal_slot, m.day FROM recipes r JOIN menus m ON m.id = r.menu_id ORDER BY r.id DESC LIMIT 24').all();
  if (!rows.length) return [];
  const start = dayRotationIndex(day, rows.length);
  const rotated = [...rows.slice(start), ...rows.slice(0, start)];
  return rotated.slice(0, 3).map(r => {
    const meta = JSON.parse(r.meta || '{}');
    return {
      title: meta.titleMarketing || r.title,
      option: r.option_type,
      slot: r.meal_slot,
      day: r.day,
      kcal: meta.kcal || '-',
      proteinHint: meta.proteinHint || 'n/a',
      co2Label: meta.co2Label || '-',
      timeMin: meta.timeMin || '-'
    };
  });
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
      const today = getTodayDayString();
      const state = getTodayMenuState({ today });
      const fallback = getDisplayMenu({ today });

      if (state.state === 'missing') {
        return res.status(404).json({
          error: 'Noch kein Menü für heute verfügbar.',
          day: today,
          state: 'missing',
          fallback: fallback ? { mode: fallback.mode, menu: fallback.menu } : null
        });
      }

      if (state.state === 'preparing') {
        return res.status(409).json({
          error: 'Heute wird noch vorbereitet.',
          day: today,
          state: 'preparing',
          recipeCoverage: { expected: EXPECTED_RECIPE_COUNT, actual: state.menu.recipe_count },
          fallback: fallback ? { mode: fallback.mode, menu: fallback.menu } : null
        });
      }

      const recipes = db.prepare('SELECT * FROM recipes WHERE menu_id=? ORDER BY option_type, meal_slot').all(state.menu.id)
        .map(normalizeRecipeRow);
      return res.json({
        menu: state.menu,
        recipes,
        state: state.state,
        recipeCoverage: { expected: EXPECTED_RECIPE_COUNT, actual: state.menu.recipe_count }
      });
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
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>/</loc></url><url><loc>/was-koche-ich-heute-schweiz</loc></url><url><loc>/rezepte</loc></url><url><loc>/menue</loc></url><url><loc>/wochenplan</loc></url><url><loc>/status</loc></url><url><loc>/kategorie/schnell</loc></url><url><loc>/kategorie/low-carb</loc></url><url><loc>/kategorie/vegetarisch</loc></url><url><loc>/kategorie/vegan</loc></url>${urls}</urlset>`);
  });

  app.get('/review/:token', (req, res) => {
    const { token } = req.params;
    const action = req.query.action;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).send(htmlLayout({
        title: 'Ungültige Review-Aktion | lekker',
        description: 'Bitte approve oder reject verwenden.',
        canonical: '/review',
        body: renderInfoState({
          title: 'Ungültige Aktion',
          message: 'Die Aktion fehlt oder ist ungültig. Verwende den Review-Link mit action=approve oder action=reject.',
          backLinks: [{ href: '/', label: 'Zur Startseite' }, { href: '/status', label: 'Status prüfen' }]
        })
      }));
    }

    const result = handleReview(token, action);

    if (result.ok && action === 'reject') {
      const today = getTodayDayString();
      db.prepare("UPDATE menus SET status='draft' WHERE day=?").run(today);
    }

    const statusCode = result.ok ? 200 : (result.code === 'INCOMPLETE_MENU' ? 409 : 404);
    return res.status(statusCode).send(htmlLayout({
      title: 'Review Ergebnis | lekker',
      description: 'Freigabestatus für Tagesmenü',
      canonical: '/review',
      body: renderInfoState({
        title: result.ok ? 'Review verarbeitet' : 'Token ungültig oder abgelaufen',
        message: result.message,
        backLinks: [{ href: '/', label: 'Zur App' }, { href: '/status', label: 'Status' }]
      })
    }));
  });

  app.get('/api/menu/today', (_, res) => {
    const today = getTodayDayString();
    const state = getTodayMenuState({ today });
    const fallback = getDisplayMenu({ today });

    if (state.state === 'missing') {
      return res.status(404).json({
        error: 'Für heute ist noch kein Menü vorhanden.',
        day: today,
        state: 'missing',
        fallback: fallback ? { mode: fallback.mode, menu: fallback.menu } : null
      });
    }

    if (state.state === 'preparing') {
      return res.status(409).json({
        error: 'Heute wird noch vorbereitet.',
        day: today,
        state: 'preparing',
        recipeCoverage: { expected: EXPECTED_RECIPE_COUNT, actual: state.menu.recipe_count },
        fallback: fallback ? { mode: fallback.mode, menu: fallback.menu } : null
      });
    }

    const recipes = db.prepare('SELECT * FROM recipes WHERE menu_id=? ORDER BY option_type, meal_slot').all(state.menu.id)
      .map(normalizeRecipeRow);

    return res.json({
      menu: state.menu,
      recipes,
      state: state.state,
      recipeCoverage: { expected: EXPECTED_RECIPE_COUNT, actual: state.menu.recipe_count }
    });
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
      body: `<h1>Systemstatus</h1><section class='card'><div class='table-wrap'><table><thead><tr><th>Zeit</th><th>Stage</th><th>Status</th><th>Dauer</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Keine Runs vorhanden</td></tr>'}</tbody></table></div></section>
      <p><a href='/api/status'>JSON Status API</a></p>`
    }));
  });

  app.get('/was-koche-ich-heute-schweiz', (_, res) => {
    const faq = [
      ['Was koche ich heute?', 'Starte mit unserem Tagesmenü inklusive veganer und nicht-veganer Option.'],
      ['Was, wenn es schnell gehen muss?', 'Nutze die Cluster "schnell" und Rezepte unter 30 Minuten.'],
      ['Gibt es proteinreiche Optionen?', 'Ja, Rezeptseiten zeigen kcal, Protein-Hinweis und CO₂-Label.']
    ];
    const clusters = ['schnell', 'low-carb', 'vegetarisch', 'vegan', 'mit-fleisch', 'mit-fisch', 'familienfreundlich'];
    const ld = [
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Was koche ich heute Schweiz Cluster',
        itemListElement: clusters.map((slug, i) => ({ '@type': 'ListItem', position: i + 1, url: `/kategorie/${slug}` }))
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Start', item: '/' },
          { '@type': 'ListItem', position: 2, name: 'Was koche ich heute Schweiz', item: '/was-koche-ich-heute-schweiz' }
        ]
      }
    ];
    res.send(htmlLayout({
      title: 'Was koche ich heute Schweiz? | lekker',
      description: 'Schnelle Kochideen unter 30 Minuten für die Schweiz mit klaren Clustern.',
      canonical: '/was-koche-ich-heute-schweiz',
      body: `<h1>Was koche ich heute in der Schweiz?</h1><p class='lead'>Schnelle Ideen unter 30 Minuten plus klare Cluster.</p><section class='card'><h2>Intent-Cluster</h2><div class='inline-links'><a href='/kategorie/schnell'>schnell</a><a href='/kategorie/low-carb'>low carb</a><a href='/kategorie/vegetarisch'>vegetarisch/vegan</a><a href='/kategorie/mit-fleisch'>mit Fleisch</a><a href='/kategorie/mit-fisch'>mit Fisch</a><a href='/kategorie/familienfreundlich'>familienfreundlich</a></div></section><section class='card'><h2>FAQ</h2>${faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</section><nav class='inline-links'><a href='/'>Tagesmenü</a><a href='/rezepte'>Rezept-Index</a><a href='/menue'>Archiv</a><a href='/wochenplan'>Wochenplan</a></nav>`,
      jsonLd: ld
    }));
  });

  app.get('/rezepte', (_, res) => {
    const rows = db.prepare('SELECT r.option_type,r.meal_slot,r.title,r.meta,m.day FROM recipes r JOIN menus m ON m.id=r.menu_id ORDER BY m.day DESC LIMIT 30').all();
    const cards = rows.map(r => {
      const meta = JSON.parse(r.meta || '{}');
      return `<article class='card recipe-index-card'><p class='eyebrow'>${r.option_type} · ${slotLabel(r.meal_slot)} · ${r.day}</p><h3>${meta.titleMarketing || r.title}</h3><p class='meta-inline'>${meta.timeMin || '-'} Min · ${difficultyLabel(meta.difficulty || 1)} · ${meta.kcal || '-'} kcal · ${meta.proteinHint || 'Protein: n/a'} · CO₂ ${meta.co2Label || '-'}</p><a class='recipe-link' href='/rezept/${r.option_type}/${r.day}/${r.meal_slot}'>Zum Rezept</a></article>`;
    }).join('');
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'lekker Rezeptindex',
      itemListElement: rows.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: `/rezept/${r.option_type}/${r.day}/${r.meal_slot}` }))
    };
    res.send(htmlLayout({ title: 'Rezept-Index | lekker', description: 'Rezeptkarten mit Zeit, Schwierigkeit, kcal, Protein und CO₂.', canonical: '/rezepte', body: `<h1>Rezept-Index</h1><nav class='inline-links'><a href='/'>Tag</a><a href='/menue'>Archiv</a><a href='/was-koche-ich-heute-schweiz'>Intent-Seite</a></nav><section class='recipe-index-grid'>${cards || '<p>Keine Rezepte verfügbar</p>'}</section>`, jsonLd }));
  });

  app.get('/kategorie/:slug', (req, res) => {
    const { slug } = req.params;
    const rows = db.prepare('SELECT r.option_type,r.meal_slot,r.title,r.meta,m.day FROM recipes r JOIN menus m ON m.id=r.menu_id ORDER BY m.day DESC LIMIT 60').all();
    const filters = {
      schnell: r => (JSON.parse(r.meta || '{}').timeMin || 999) <= 30,
      'low-carb': r => /salat|bowl|gemüse|fisch|poulet/i.test(JSON.parse(r.meta || '{}').titleMarketing || r.title),
      vegetarisch: r => r.option_type === 'vegan' || /käse|ei|vegetar/i.test(r.title),
      vegan: r => r.option_type === 'vegan',
      'mit-fleisch': r => /poulet|rind|fleisch/i.test(r.title),
      'mit-fisch': r => /lachs|fisch|forelle|thunfisch/i.test(r.title),
      familienfreundlich: r => /pasta|kartoffel|bowl|pfanne/i.test(r.title)
    };
    const filter = filters[slug] || (() => true);
    const selected = rows.filter(filter).slice(0, 24);
    const cards = selected.map(r => {
      const meta = JSON.parse(r.meta || '{}');
      return `<article class='card recipe-index-card'><p class='eyebrow'>${r.option_type} · ${slotLabel(r.meal_slot)} · ${r.day}</p><h3>${meta.titleMarketing || r.title}</h3><p class='meta-inline'>${meta.timeMin || '-'} Min · ${difficultyLabel(meta.difficulty || 1)} · ${meta.kcal || '-'} kcal · ${meta.proteinHint || 'Protein: n/a'} · CO₂ ${meta.co2Label || '-'}</p><a class='recipe-link' href='/rezept/${r.option_type}/${r.day}/${r.meal_slot}'>Zum Rezept</a></article>`;
    }).join('');

    res.send(htmlLayout({
      title: `Kategorie ${slug} | lekker`,
      description: `Rezeptauswahl für ${slug} auf lekker`,
      canonical: `/kategorie/${slug}`,
      body: `<h1>Kategorie: ${slug}</h1><nav class='inline-links'><a href='/was-koche-ich-heute-schweiz'>Intent-Hub</a><a href='/rezepte'>Rezeptindex</a><a href='/menue'>Archiv</a></nav><section class='recipe-index-grid'>${cards || '<p>Keine passenden Rezepte.</p>'}</section>`
    }));
  });

  app.get('/wochenplan/print', (_, res) => {
    const weekly = getWeeklyPlan(7);
    const lines = weekly.menus.map(m => `${m.day}: ${m.vegan_lunch} / ${m.omni_lunch}`).join('\n');
    const shopping = db.prepare('SELECT item, COUNT(*) as c FROM clustered_offers GROUP BY item ORDER BY c DESC LIMIT 20').all().map(x => `- ${x.item}`).join('\n');
    res.type('text/plain').send(`Lekker Wochenplan\n${lines}\n\nEinkaufsliste\n${shopping}`);
  });

  app.get('/wochenplan/export.csv', (_, res) => {
    const weekly = getWeeklyPlan(7);
    const shopping = db.prepare('SELECT item, COUNT(*) as c FROM clustered_offers GROUP BY item ORDER BY c DESC LIMIT 40').all();
    const menuRows = weekly.menus.map(m => `${m.day};${m.vegan_lunch};${m.omni_lunch}`);
    const shoppingRows = shopping.map(s => `item;${s.item};${s.c}`);
    res.type('text/csv').send(['section;key;value', ...menuRows, ...shoppingRows].join('\n'));
  });

  app.get('/menue/:day', (req, res) => {
    const menu = db.prepare('SELECT * FROM menus WHERE day=?').get(req.params.day);
    if (!menu) {
      return res.status(404).send(htmlLayout({
        title: 'Menü nicht gefunden | lekker',
        description: 'Das angefragte Menü existiert nicht.',
        canonical: '/menue',
        body: renderInfoState({
          title: 'Dieses Menü ist nicht verfügbar',
          message: 'Möglicherweise ist das Datum falsch oder das Menü wurde noch nicht erzeugt.',
          backLinks: [{ href: '/menue', label: 'Zum Menü-Archiv' }, { href: '/', label: 'Zur Startseite' }]
        })
      }));
    }

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
    if (!menu) {
      return res.status(404).send(htmlLayout({
        title: 'Menü nicht gefunden | lekker',
        description: 'Das angefragte Menü existiert nicht oder ist nicht mehr verfügbar.',
        canonical: `/rezept/${option}/${day}/${slot}`,
        body: `<section class='card state-card'>
          <h1>Dieses Menü ist nicht verfügbar</h1>
          <p>Der angefragte Tag konnte nicht gefunden werden.</p>
          <nav class='inline-links'>
            <a href='/'>Zur Startseite</a>
            <a href='/menue'>Zum Menü-Archiv</a>
          </nav>
        </section>`
      }));
    }

    const recipeRaw = db.prepare('SELECT * FROM recipes WHERE menu_id=? AND option_type=? AND meal_slot=?').get(menu.id, option, slot);
    if (!recipeRaw) {
      return res.status(404).send(htmlLayout({
        title: 'Rezept noch nicht verfügbar | lekker',
        description: 'Dieses Rezept wird gerade vorbereitet.',
        canonical: `/rezept/${option}/${day}/${slot}`,
        body: `<section class='card state-card'>
          <h1>Dieses Rezept ist noch nicht verfügbar</h1>
          <p>Das Menü ist bereits sichtbar, aber dieses Rezept wird noch erstellt. Schau bitte in Kürze wieder vorbei.</p>
          <nav class='inline-links'>
            <a href='/menue/${day}'>Zurück zum Menü</a>
            <a href='/menue'>Zum Archiv</a>
          </nav>
        </section>`
      }));
    }

    const recipe = normalizeRecipeRow(recipeRaw);
    const ingredients = recipe.ingredients.map(i => `<li>${i}</li>`).join('');
    const steps = recipe.steps.map((s, i) => `<li><strong>${i + 1}.</strong> ${s}</li>`).join('');
    const shoppingTips = (recipe.meta.tipsShopping || []).map(t => `<li>${t}</li>`).join('');
    const cookingTips = (recipe.meta.tipsCooking || []).map(t => `<li>${t}</li>`).join('');

    const jsonLd = [{
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: recipe.meta.titleMarketing || recipe.title,
      recipeCuisine: 'Schweiz',
      recipeIngredient: recipe.ingredients,
      recipeInstructions: recipe.steps,
      description: recipe.meta.subtitle || recipe.title
    }, {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Start', item: '/' },
        { '@type': 'ListItem', position: 2, name: 'Menü', item: `/menue/${day}` },
        { '@type': 'ListItem', position: 3, name: recipe.meta.titleMarketing || recipe.title, item: `/rezept/${option}/${day}/${slot}` }
      ]
    }];

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
          <div><strong>Protein</strong><span>${recipe.meta.proteinHint || 'n/a'}</span></div>
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
    const selected = getDisplayMenu();

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
    const isDraft = menu.status !== 'published';

    const heading =
      isDraft
        ? 'Neuster Entwurf'
        : mode === 'today-complete'
          ? 'Tagesmenü Schweiz'
          : 'Neuester fertiger Menüvorschlag';

    const intro =
      isDraft
        ? `<p class="lead">Entwurf vom <strong>${menu.day}</strong>. Einzelne Rezepte können noch fehlen.</p>`
        : mode === 'today-complete'
          ? '<p class="lead">Heute frisch kuratiert mit vollständigen Rezepten.</p>'
          : `<p class="lead">Für heute ist noch kein vollständiges Menü da. Hier der letzte komplette Stand vom <strong>${menu.day}</strong>.</p>`;

    const recommended = getTodayRecommendations(menu.day);
    const recCards = recommended.map(r => `<article class='card recipe-index-card'><p class='eyebrow'>heute empfohlen · ${slotLabel(r.slot)}</p><h3>${r.title}</h3><p class='meta-inline'>${r.timeMin} Min · ${r.kcal} kcal · ${r.proteinHint} · CO₂ ${r.co2Label}</p><a class='recipe-link' href='/rezept/${r.option}/${r.day}/${r.slot}'>Zum Rezept</a></article>`).join('');
    const faq = [
      ['Was koche ich heute?', 'Nutze das Tagesmenü mit vollständigen Rezepten und direkter Einkaufsliste.'],
      ['Was, wenn es schnell gehen muss?', 'Filtere in den Kategorien nach schnell und fokussiere auf Rezepte unter 30 Minuten.']
    ];
    const jsonLd = [
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
      { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Heute empfohlen', itemListElement: recommended.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: `/rezept/${r.option}/${r.day}/${r.slot}` })) },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Start', item: '/' }] }
    ];

    res.send(htmlLayout({
      title: isDraft ? `lekker – Entwurf ${menu.day}` : (mode === 'today-complete' ? `lekker – Tagesmenü ${menu.day}` : `lekker – Menü ${menu.day}`),
      description: 'Protein-fokussierte Menüvorschläge für den Schweizer Markt mit klaren Rezeptstatus.',
      canonical: '/',
      body: `<h1>${heading}</h1>${intro}<p class='meta-inline'>Zuletzt aktualisiert: ${new Date().toISOString().slice(0, 10)}</p>${menuCards(menu, recipeLookup)}<section class='card'><h2>Heute empfohlen</h2><div class='recipe-index-grid'>${recCards || '<p>Empfehlungen werden aufgebaut.</p>'}</div></section><p><a href='/wochenplan/print'>Wochenplan + Einkaufsliste drucken</a> · <a href='/was-koche-ich-heute-schweiz'>Intent-Hub</a> · <a href='/menue'>Vergangene Menüs ansehen →</a></p>`,
      jsonLd
    }));
  });

  return app;
}
