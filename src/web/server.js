import express from 'express';
import { db } from '../core/db.js';
import { handleReview } from '../services/approvalService.js';

const TZ = 'Europe/Zurich';

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
    <a class="brand" href="/">lekker</a>
    <nav>
      <a href="/menue">Menü-Archiv</a>
      <a href="/api/menu/today">API</a>
    </nav>
  </header>
  <main class="container">${body}</main>
</body>
</html>`;
}

function menuCards(menu) {
  return `
  <section class="status-row">
    <span class="badge ${menu.status === 'published' ? 'ok' : 'warn'}">${menu.status}</span>
    <span>Datum: <strong>${menu.day}</strong></span>
    <span>CO₂ Ø: <strong>${menu.co2_score}</strong></span>
  </section>
  <section class="grid">
    <article class="card">
      <h2>🌱 Vegan</h2>
      <ul>
        <li><strong>Frühstück:</strong> ${menu.vegan_breakfast} <a href="/rezept/vegan/${menu.day}/fruehstueck">Rezept</a></li>
        <li><strong>Mittag:</strong> ${menu.vegan_lunch} <a href="/rezept/vegan/${menu.day}/mittagessen">Rezept</a></li>
        <li><strong>Abend:</strong> ${menu.vegan_dinner} <a href="/rezept/vegan/${menu.day}/abendessen">Rezept</a></li>
        <li><strong>Snack:</strong> ${menu.vegan_snack}</li>
        <li><strong>Getränk:</strong> ${menu.vegan_drink}</li>
      </ul>
    </article>
    <article class="card">
      <h2>🍽️ Nicht-vegan</h2>
      <ul>
        <li><strong>Frühstück:</strong> ${menu.omni_breakfast} <a href="/rezept/omni/${menu.day}/fruehstueck">Rezept</a></li>
        <li><strong>Mittag:</strong> ${menu.omni_lunch} <a href="/rezept/omni/${menu.day}/mittagessen">Rezept</a></li>
        <li><strong>Abend:</strong> ${menu.omni_dinner} <a href="/rezept/omni/${menu.day}/abendessen">Rezept</a></li>
        <li><strong>Snack:</strong> ${menu.omni_snack}</li>
        <li><strong>Getränk:</strong> ${menu.omni_drink}</li>
      </ul>
    </article>
  </section>`;
}

function getDayToday() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
}

export function createServer() {
  const app = express();
  app.use(express.static('public'));

  app.get('/health', (_, res) => res.json({ ok: true }));

  app.get('/robots.txt', (_, res) => {
    res.type('text/plain').send('User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n');
  });

  app.get('/sitemap.xml', (_, res) => {
    const rows = db.prepare('SELECT day FROM menus ORDER BY day DESC LIMIT 200').all();
    const urls = rows.map(r => `<url><loc>/menue/${r.day}</loc></url>`).join('');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>/</loc></url><url><loc>/menue</loc></url>${urls}</urlset>`);
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
      .map(r => ({ ...r, ingredients: JSON.parse(r.ingredients), steps: JSON.parse(r.steps) }));
    return res.json({ menu, recipes });
  });

  app.get('/menue', (_, res) => {
    const menus = db.prepare('SELECT day,status,co2_score FROM menus ORDER BY day DESC LIMIT 60').all();
    const list = menus.map(m => `<li><a href="/menue/${m.day}">${m.day}</a> · ${m.status} · CO₂ ${m.co2_score}</li>`).join('');

    res.send(htmlLayout({
      title: 'Menü-Archiv | lekker',
      description: 'Alle bisherigen Tagesmenüs für die Schweiz',
      canonical: '/menue',
      body: `<h1>Menü-Archiv</h1><ul class='archive'>${list || '<li>Noch keine Einträge</li>'}</ul>`
    }));
  });

  app.get('/menue/:day', (req, res) => {
    const menu = db.prepare('SELECT * FROM menus WHERE day=?').get(req.params.day);
    if (!menu) return res.status(404).send('Menü nicht gefunden.');

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
      body: `<h1>Menü vom ${menu.day}</h1>${menuCards(menu)}<p><a href='/menue'>← Zurück zum Archiv</a></p>`,
      jsonLd
    }));
  });

  app.get('/rezept/:option/:day/:slot', (req, res) => {
    const { option, day, slot } = req.params;
    const menu = db.prepare('SELECT * FROM menus WHERE day=?').get(day);
    if (!menu) return res.status(404).send('Menü nicht gefunden.');

    const recipe = db.prepare('SELECT * FROM recipes WHERE menu_id=? AND option_type=? AND meal_slot=?').get(menu.id, option, slot);
    if (!recipe) return res.status(404).send('Rezept nicht gefunden.');

    const ingredients = JSON.parse(recipe.ingredients).map(i => `<li>${i}</li>`).join('');
    const steps = JSON.parse(recipe.steps).map((s, i) => `<li><strong>Schritt ${i + 1}:</strong> ${s}</li>`).join('');

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: recipe.title,
      recipeCuisine: 'Schweiz',
      recipeIngredient: JSON.parse(recipe.ingredients),
      recipeInstructions: JSON.parse(recipe.steps)
    };

    res.send(htmlLayout({
      title: `${recipe.title} Rezept | lekker`,
      description: `Schritt-für-Schritt Kochanleitung für ${recipe.title}.`,
      canonical: `/rezept/${option}/${day}/${slot}`,
      body: `<h1>${recipe.title}</h1><p>Option: ${option === 'vegan' ? 'Vegan' : 'Nicht-vegan'} · Slot: ${slot}</p><h2>Zutaten</h2><ul>${ingredients}</ul><h2>Zubereitung</h2><ol>${steps}</ol><p><a href='/menue/${day}'>← Zurück zum Menü</a></p>`,
      jsonLd
    }));
  });

  app.get('/', (_, res) => {
    const latest = db.prepare('SELECT * FROM menus ORDER BY day DESC LIMIT 1').get();
    if (!latest) {
      return res.send(htmlLayout({
        title: 'lekker – Tagesmenü Schweiz',
        description: 'Tägliche Menüvorschläge mit veganen und nicht-veganen Optionen.',
        canonical: '/',
        body: '<h1>lekker</h1><p>Noch keine Menüdaten vorhanden. Trigger: <code>RUN_PIPELINE_ON_BOOT=true</code> oder manueller Pipeline-Start.</p><p><a href="/menue">Archiv öffnen</a></p>'
      }));
    }

    res.send(htmlLayout({
      title: `lekker – Menü ${latest.day}`,
      description: 'Protein-fokussierte Tagesmenüs für den Schweizer Markt mit Rezepten.',
      canonical: '/',
      body: `<h1>Tagesmenü Schweiz</h1>${menuCards(latest)}<p><a href='/menue'>Vergangene Menüs ansehen →</a></p>`
    }));
  });

  return app;
}
