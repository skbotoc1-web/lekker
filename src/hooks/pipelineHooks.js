import { db } from '../core/db.js';
import { getRetailers, crawlRetailer } from '../services/retailerCrawler.js';
import { clusterOffers } from '../services/semantic.js';
import { createDailyMenu } from '../services/menuPlanner.js';
import { generateRecipesForMenu } from '../services/recipeService.js';
import { appendRows } from '../services/googleSheets.js';

const TZ = 'Europe/Zurich';
const EXPECTED_RECIPE_COUNT = 10;
const dayStamp = () => new Date().toLocaleDateString('sv-SE', { timeZone: TZ });

function persistRun({ day, stage, ok, durationMs, details }) {
  db.prepare('INSERT INTO pipeline_runs (day, stage, ok, duration_ms, details, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(day, stage, ok ? 1 : 0, durationMs, JSON.stringify(details || {}), new Date().toISOString());
}

async function withRunLog(stage, day, fn) {
  const startedAt = Date.now();
  try {
    const result = await fn();
    persistRun({ day, stage, ok: true, durationMs: Date.now() - startedAt, details: result });
    return result;
  } catch (error) {
    persistRun({ day, stage, ok: false, durationMs: Date.now() - startedAt, details: { error: error.message } });
    throw error;
  }
}

export async function runHook(stage) {
  const day = dayStamp();
  if (stage === 'ingestion') return withRunLog('ingestion', day, () => runIngestion(day));
  if (stage === 'clustering') return withRunLog('clustering', day, () => runClustering(day));
  if (stage === 'menu') return withRunLog('menu', day, () => runMenu(day));
  if (stage === 'recipes') return withRunLog('recipes', day, () => runRecipes(day));
  if (stage === 'full') {
    return withRunLog('full', day, async () => {
      await runIngestion(day);
      await runClustering(day);
      const fullOut = await runMenuAndRecipesAtomic(day);
      return { ok: true, stage: 'full', day, ...fullOut };
    });
  }
  throw new Error(`Unknown stage: ${stage}`);
}

async function runIngestion(day) {
  const now = new Date().toISOString();
  const insert = db.prepare('INSERT INTO offers (retailer, item, price, crawled_at) VALUES (?, ?, ?, ?)');
  const rows = [];

  for (const r of getRetailers()) {
    const items = await crawlRetailer(r.id);
    for (const item of items.slice(0, 10)) {
      insert.run(r.id, item.item, item.price || 'n/a', now);
      rows.push([day, r.id, item.item, item.price || 'n/a', now]);
    }
  }

  const sink = await appendRows('offers_raw', rows);
  return { ok: true, stage: 'ingestion', day, count: rows.length, sink };
}

async function runClustering(day) {
  const rows = db.prepare('SELECT * FROM offers WHERE substr(crawled_at, 1, 10)=?').all(day);
  const clustered = clusterOffers(rows);
  db.prepare('DELETE FROM clustered_offers WHERE day=?').run(day);
  const insert = db.prepare('INSERT INTO clustered_offers (day, category, vegan, item, source_retailer) VALUES (?, ?, ?, ?, ?)');

  for (const r of clustered) insert.run(day, r.category, r.vegan, r.item, r.retailer);
  const sink = await appendRows('offers_clustered', clustered.map(r => [day, r.category, r.vegan, r.item, r.retailer]));
  return { ok: true, stage: 'clustering', day, count: clustered.length, sink };
}

async function runMenu(day) {
  const menu = createDailyMenu(day);
  const sink = await appendRows('menus', [[
    day,
    menu.vegan_breakfast,
    menu.vegan_lunch,
    menu.vegan_dinner,
    menu.vegan_snack,
    menu.vegan_drink,
    menu.omni_breakfast,
    menu.omni_lunch,
    menu.omni_dinner,
    menu.omni_snack,
    menu.omni_drink,
    menu.co2_score,
    menu.status
  ]]);
  return { ok: true, stage: 'menu', day, menuId: menu.id, sink };
}

async function runRecipes(day) {
  const menu = db.prepare('SELECT * FROM menus WHERE day=?').get(day);
  if (!menu) throw new Error('No menu found for day');
  const recipes = generateRecipesForMenu(menu);
  const sink = await appendRows('recipes', recipes.map(r => [day, r.option_type, r.meal_slot, r.title, r.ingredients, r.steps, r.meta]));
  return { ok: true, stage: 'recipes', day, count: recipes.length, sink };
}

export function createMenuAndRecipesAtomic(day) {
  const tx = db.transaction(() => {
    const menu = createDailyMenu(day);
    const recipes = generateRecipesForMenu(menu);
    if (recipes.length !== EXPECTED_RECIPE_COUNT) {
      throw new Error(`Recipe integrity check failed: expected ${EXPECTED_RECIPE_COUNT}, got ${recipes.length}`);
    }
    return {
      menu,
      recipes,
      coverage: {
        expected: EXPECTED_RECIPE_COUNT,
        actual: recipes.length
      }
    };
  });

  return tx();
}

async function runMenuAndRecipesAtomic(day) {
  const { menu, recipes } = createMenuAndRecipesAtomic(day);

  const [menuSink, recipeSink] = await Promise.all([
    appendRows('menus', [[
      day,
      menu.vegan_breakfast,
      menu.vegan_lunch,
      menu.vegan_dinner,
      menu.vegan_snack,
      menu.vegan_drink,
      menu.omni_breakfast,
      menu.omni_lunch,
      menu.omni_dinner,
      menu.omni_snack,
      menu.omni_drink,
      menu.co2_score,
      menu.status
    ]]),
    appendRows('recipes', recipes.map(r => [day, r.option_type, r.meal_slot, r.title, r.ingredients, r.steps, r.meta]))
  ]);

  return {
    menuId: menu.id,
    recipes: recipes.length,
    sink: { menus: menuSink, recipes: recipeSink }
  };
}
