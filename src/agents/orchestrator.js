import cron from 'node-cron';
import { db } from '../core/db.js';
import { log } from '../core/logger.js';
import { getRetailers, crawlRetailer } from '../services/retailerCrawler.js';
import { clusterOffers } from '../services/semantic.js';
import { createDailyMenu } from '../services/menuPlanner.js';
import { generateRecipesForMenu } from '../services/recipeService.js';
import { sendApprovalMail } from '../services/approvalService.js';

const tz = 'Europe/Zurich';
const EXPECTED_RECIPE_COUNT = 10;

function dayStamp() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: tz });
}

async function agent1to4(retailerId) {
  const now = new Date().toISOString();
  const items = await crawlRetailer(retailerId);
  const insert = db.prepare('INSERT INTO offers (retailer, item, price, crawled_at) VALUES (?, ?, ?, ?)');
  for (const item of items.slice(0, 10)) insert.run(retailerId, item.item, item.price || 'n/a', now);
  log.info('offers_crawled', { retailerId, count: Math.min(items.length, 10) });
}

function agent5_clusterAndStructure() {
  const day = dayStamp();
  const rows = db.prepare('SELECT * FROM offers WHERE substr(crawled_at, 1, 10) = ?').all(day);
  const clustered = clusterOffers(rows);
  db.prepare('DELETE FROM clustered_offers WHERE day = ?').run(day);
  const insert = db.prepare('INSERT INTO clustered_offers (day, category, vegan, item, source_retailer) VALUES (?, ?, ?, ?, ?)');
  for (const r of clustered) insert.run(day, r.category, r.vegan, r.item, r.retailer);
  log.info('offers_clustered', { day, count: clustered.length });
}

function agent6_buildMenuAndRecipesAtomic() {
  const day = dayStamp();

  const tx = db.transaction(() => {
    const menu = createDailyMenu(day);
    const recipes = generateRecipesForMenu(menu);

    if (recipes.length !== EXPECTED_RECIPE_COUNT) {
      throw new Error(`Recipe integrity check failed: expected ${EXPECTED_RECIPE_COUNT}, got ${recipes.length}`);
    }

    return { menu, recipes };
  });

  const out = tx();
  log.info('menu_and_recipes_generated_atomic', { day, menuId: out.menu.id, recipes: out.recipes.length, co2: out.menu.co2_score });
  return out.menu;
}

function agent7_buildRecipes(menu) {
  const recipes = generateRecipesForMenu(menu);
  log.info('recipes_generated', { menuId: menu.id, count: recipes.length });
}

async function agent8_sendReview(menu) {
  const result = await sendApprovalMail(menu);
  log.info('review_sent', { menuId: menu.id, ...result });
}

function agent9_publishIfApproved() {
  const day = dayStamp();
  const row = db.prepare("SELECT * FROM menus WHERE day=? AND status='published'").get(day);
  if (!row) {
    log.info('publish_waiting_for_approval', { day });
    return;
  }
  log.info('menu_published', { day, menuId: row.id });
}

export function runFullPipelineOnce() {
  return (async () => {
    const retailers = getRetailers();
    for (const r of retailers) await agent1to4(r.id);
    agent5_clusterAndStructure();
    const menu = agent6_buildMenuAndRecipesAtomic();
    await agent8_sendReview(menu);
    agent9_publishIfApproved();
  })();
}

export function scheduleAgents() {
  // 06:01-06:04 retailer crawls
  cron.schedule('1 6 * * *', () => agent1to4('migros'), { timezone: tz });
  cron.schedule('2 6 * * *', () => agent1to4('coop'), { timezone: tz });
  cron.schedule('3 6 * * *', () => agent1to4('aldi'), { timezone: tz });
  cron.schedule('4 6 * * *', () => agent1to4('lidl'), { timezone: tz });

  // 06:30 aggregate
  cron.schedule('30 6 * * *', () => agent5_clusterAndStructure(), { timezone: tz });

  // 06:35 atomic draft creation incl. recipes
  cron.schedule('35 6 * * *', () => agent6_buildMenuAndRecipesAtomic(), { timezone: tz });

  // 06:40 fallback repair if recipes are missing unexpectedly
  cron.schedule('40 6 * * *', () => {
    const day = dayStamp();
    const menu = db.prepare('SELECT * FROM menus WHERE day=?').get(day);
    if (!menu) return;

    const count = db.prepare('SELECT COUNT(*) as n FROM recipes WHERE menu_id=?').get(menu.id)?.n || 0;
    if (count < EXPECTED_RECIPE_COUNT) {
      log.warn('recipe_repair_triggered', { day, menuId: menu.id, count, expected: EXPECTED_RECIPE_COUNT });
      agent7_buildRecipes(menu);
    }
  }, { timezone: tz });

  // 06:45 send review mail
  cron.schedule('45 6 * * *', async () => {
    const day = dayStamp();
    const menu = db.prepare('SELECT * FROM menus WHERE day=?').get(day);
    if (menu) await agent8_sendReview(menu);
  }, { timezone: tz });

  // every 5 min publication check
  cron.schedule('*/5 * * * *', () => agent9_publishIfApproved(), { timezone: tz });

  log.info('agent_schedule_ready', { timezone: tz });
}
