import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, db } from '../core/db.js';
import { handleReview } from '../services/approvalService.js';

migrate();

function seedMenu(day) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO menus (
      day, vegan_breakfast, vegan_lunch, vegan_dinner, vegan_snack, vegan_drink,
      omni_breakfast, omni_lunch, omni_dinner, omni_snack, omni_drink, co2_score, status, created_at
    ) VALUES (?, 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 1.2, 'draft', ?)
  `).run(day, now);
  return db.prepare('SELECT * FROM menus WHERE day=?').get(day);
}

test('approve is blocked for incomplete menus', () => {
  const day = '2099-11-11';
  db.prepare('DELETE FROM approvals').run();
  db.prepare('DELETE FROM recipes').run();
  db.prepare('DELETE FROM menus').run();

  const menu = seedMenu(day);
  const token = `t-${Date.now()}`;
  db.prepare('INSERT INTO approvals (menu_id, token) VALUES (?, ?)').run(menu.id, token);

  const out = handleReview(token, 'approve');
  assert.equal(out.ok, false);
  assert.equal(out.code, 'INCOMPLETE_MENU');

  const refreshed = db.prepare('SELECT status FROM menus WHERE id=?').get(menu.id);
  assert.equal(refreshed.status, 'draft');
});
