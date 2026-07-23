import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES, SERVICE_TYPES, SERVICE_IDS, serviceLabel, serviceCategory, serviceDoc,
} from './svcCatalog.js';

test('every service has a label, a known category, and a study doc', () => {
  const categoryIds = new Set(CATEGORIES.map((c) => c.id));
  for (const [id, spec] of Object.entries(SERVICE_TYPES)) {
    assert.ok(spec.label && typeof spec.label === 'string', `${id} label`);
    assert.ok(categoryIds.has(spec.category), `${id} category "${spec.category}" is declared`);
    assert.ok(typeof spec.doc === 'string' && spec.doc.length >= 40, `${id} doc is substantial`);
  }
});

test('every category is used by at least one service', () => {
  const used = new Set(Object.values(SERVICE_TYPES).map((s) => s.category));
  for (const cat of CATEGORIES) {
    assert.ok(used.has(cat.id), `category ${cat.id} has services`);
  }
});

test('lookups degrade cleanly on unknown types', () => {
  assert.equal(serviceLabel('users'), 'Users');
  assert.equal(serviceLabel('nope'), 'nope');
  assert.equal(serviceCategory('s3'), 'storage');
  assert.equal(serviceCategory('nope'), null);
  assert.equal(serviceDoc('nope'), null);
});

test('SERVICE_IDS matches the catalog keys', () => {
  assert.deepEqual(SERVICE_IDS, Object.keys(SERVICE_TYPES));
  assert.ok(SERVICE_IDS.length >= 20);
});
