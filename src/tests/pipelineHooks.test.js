import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, db } from '../core/db.js';
import { createMenuAndRecipesAtomic } from '../hooks/pipelineHooks.js';

migrate();

test('createMenuAndRecipesAtomic creates complete menu + recipe coverage', () => {
  const day = '2026-03-14';

  db.prepare('DELETE FROM recipes WHERE menu_id IN (SELECT id FROM menus WHERE day=?)').run(day);
  db.prepare('DELETE FROM menus WHERE day=?').run(day);

  const out = createMenuAndRecipesAtomic(day);

  assert.ok(out.menu?.id);
  assert.equal(out.coverage.expected, 10);
  assert.equal(out.coverage.actual, 10);
  assert.equal(out.recipes.length, 10);

  const count = db.prepare('SELECT COUNT(*) as c FROM recipes WHERE menu_id=?').get(out.menu.id).c;
  assert.equal(count, 10);
});
