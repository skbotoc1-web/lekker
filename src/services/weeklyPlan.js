import { db } from '../core/db.js';

const MEAL_FIELDS = [
  'vegan_breakfast', 'vegan_lunch', 'vegan_dinner', 'vegan_snack', 'vegan_drink',
  'omni_breakfast', 'omni_lunch', 'omni_dinner', 'omni_snack', 'omni_drink'
];

export function computeRepetitionStats(menus = []) {
  const counts = new Map();
  for (const menu of menus) {
    for (const field of MEAL_FIELDS) {
      const dish = String(menu[field] || '').trim();
      if (!dish) continue;
      counts.set(dish, (counts.get(dish) || 0) + 1);
    }
  }

  const repeated = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([dish, count]) => ({ dish, count }));

  return {
    uniqueDishCount: counts.size,
    repeatedDishCount: repeated.length,
    topRepeats: repeated.slice(0, 8)
  };
}

export function getWeeklyPlan(limit = 7) {
  const menus = db.prepare('SELECT * FROM menus ORDER BY day DESC LIMIT ?').all(limit);
  return {
    rangeDays: limit,
    generatedAt: new Date().toISOString(),
    menus,
    repetition: computeRepetitionStats(menus)
  };
}
