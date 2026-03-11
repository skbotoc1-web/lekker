import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIngredient, harmonizeIngredients } from '../services/ingredientNormalizer.js';

test('normalizeIngredient maps common aliases to canonical forms', () => {
  const a = normalizeIngredient('Bio Kicher-Erbsen 500g');
  const b = normalizeIngredient('Pouletbrustfilet Aktion');
  const c = normalizeIngredient('Hafer Flocken');

  assert.equal(a?.canonical, 'Kichererbsen');
  assert.equal(b?.canonical, 'Pouletbrust');
  assert.equal(c?.canonical, 'Haferflocken');
});

test('normalizeIngredient filters navigation noise', () => {
  const a = normalizeIngredient('Jetzt anmelden');
  const b = normalizeIngredient('Datenschutz');
  assert.equal(a, null);
  assert.equal(b, null);
});

test('harmonizeIngredients deduplicates by canonical key', () => {
  const rows = ['Kicher-Erbsen', 'Kichererbsen', 'Bio Kichererbsen 1kg', 'Tomaten'];
  const out = harmonizeIngredients(rows);
  const chickpeas = out.find(x => x.canonical === 'Kichererbsen');

  assert.ok(chickpeas);
  assert.ok(chickpeas.mentions >= 3);
});
