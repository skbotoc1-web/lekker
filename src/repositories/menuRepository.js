import { db } from '../core/db.js';
import { EXPECTED_RECIPE_COUNT } from './recipeRepository.js';

const TZ = 'Europe/Zurich';

export function getTodayDayString() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
}

function getMenusUpToDay(day) {
  return db.prepare(`
    SELECT m.*, (
      SELECT COUNT(*) FROM recipes r WHERE r.menu_id = m.id
    ) AS recipe_count
    FROM menus m
    WHERE m.day <= ?
    ORDER BY m.day DESC
  `).all(day);
}

export function getDisplayMenu({ today = getTodayDayString() } = {}) {
  const rows = getMenusUpToDay(today);
  if (!rows.length) return null;

  const todayRow = rows.find(r => r.day === today);
  const todayComplete = todayRow && todayRow.recipe_count >= EXPECTED_RECIPE_COUNT;
  if (todayComplete) return { menu: todayRow, mode: 'today-complete' };

  const latestComplete = rows.find(r => r.recipe_count >= EXPECTED_RECIPE_COUNT);
  if (latestComplete) return { menu: latestComplete, mode: 'latest-complete' };

  if (todayRow) return { menu: todayRow, mode: 'today-incomplete' };
  return { menu: rows[0], mode: 'latest-incomplete' };
}

export function getTodayMenuState({ today = getTodayDayString() } = {}) {
  const row = db.prepare(`
    SELECT m.*, (
      SELECT COUNT(*) FROM recipes r WHERE r.menu_id = m.id
    ) AS recipe_count
    FROM menus m
    WHERE m.day = ?
    LIMIT 1
  `).get(today);

  if (!row) {
    return { state: 'missing', day: today, menu: null };
  }

  if (row.recipe_count < EXPECTED_RECIPE_COUNT) {
    return { state: 'preparing', day: today, menu: row };
  }

  return { state: 'ready', day: today, menu: row };
}
