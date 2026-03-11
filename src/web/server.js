import express from 'express';
import { db } from '../core/db.js';
import { handleReview } from '../services/approvalService.js';

export function createServer() {
  const app = express();

  app.get('/health', (_, res) => res.json({ ok: true }));

  app.get('/review/:token', (req, res) => {
    const { token } = req.params;
    const action = req.query.action;
    const result = handleReview(token, action);

    if (result.ok && action === 'reject') {
      // minimal alternative generation trigger: mark today's menu draft for regeneration
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
      db.prepare("UPDATE menus SET status='draft' WHERE day=?").run(today);
    }

    return res.send(`<h2>${result.message}</h2><p><a href='/'>Zur App</a></p>`);
  });

  app.get('/api/menu/today', (_, res) => {
    const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
    const menu = db.prepare('SELECT * FROM menus WHERE day=?').get(day);
    if (!menu) return res.status(404).json({ error: 'Noch kein Menü für heute verfügbar.' });
    const recipes = db.prepare('SELECT * FROM recipes WHERE menu_id=? ORDER BY option_type, meal_slot').all(menu.id)
      .map(r => ({ ...r, ingredients: JSON.parse(r.ingredients), steps: JSON.parse(r.steps) }));
    return res.json({ menu, recipes });
  });

  app.get('/', (_, res) => {
    const latest = db.prepare("SELECT * FROM menus ORDER BY day DESC LIMIT 1").get();
    if (!latest) {
      return res.send('<h1>lekker</h1><p>Noch keine Menüdaten vorhanden. Pipeline läuft täglich ab 06:01 CET.</p>');
    }

    const published = latest.status === 'published';
    return res.send(`
      <html><head><meta charset='utf-8'><title>lekker</title>
      <style>body{font-family:Inter,Arial,sans-serif;max-width:920px;margin:2rem auto;padding:0 1rem;} .grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;} .card{padding:1rem;border:1px solid #ddd;border-radius:10px;background:#fafafa;} .badge{display:inline-block;padding:.25rem .6rem;border-radius:999px;background:${published ? '#d7ffd7' : '#ffeec2'};}</style>
      </head><body>
      <h1>lekker – Tagesmenü Schweiz</h1>
      <p><span class='badge'>Status: ${latest.status}</span> · Datum: ${latest.day} · CO₂ Ø: ${latest.co2_score}</p>
      <div class='grid'>
        <div class='card'><h2>Vegan</h2><ul><li>Frühstück: ${latest.vegan_breakfast}</li><li>Mittag: ${latest.vegan_lunch}</li><li>Abend: ${latest.vegan_dinner}</li><li>Snack: ${latest.vegan_snack}</li><li>Getränk: ${latest.vegan_drink}</li></ul></div>
        <div class='card'><h2>Nicht vegan</h2><ul><li>Frühstück: ${latest.omni_breakfast}</li><li>Mittag: ${latest.omni_lunch}</li><li>Abend: ${latest.omni_dinner}</li><li>Snack: ${latest.omni_snack}</li><li>Getränk: ${latest.omni_drink}</li></ul></div>
      </div>
      <p><a href='/api/menu/today'>API JSON</a></p>
      </body></html>
    `);
  });

  return app;
}
