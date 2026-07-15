import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDomainStats, weakestDomainId } from './weakAreas.js';

const DOMAINS = [
  { id: 'alpha', name: 'Alpha' },
  { id: 'beta', name: 'Beta' },
];

test('aggregates attempts into per-domain accuracy', () => {
  const stats = computeDomainStats(DOMAINS, [
    { domain: 'alpha', score: 8, total: 10 },
    { domain: 'alpha', score: 4, total: 10 },
    { domain: 'beta', score: 9, total: 10 },
  ]);
  const alpha = stats.find((d) => d.id === 'alpha');
  assert.equal(alpha.attemptCount, 2);
  assert.equal(alpha.accuracy, 0.6);
  assert.equal(alpha.accuracyPct, 60);
  assert.equal(alpha.name, 'Alpha');
});

test('unattempted domains report null accuracy, not zero', () => {
  const stats = computeDomainStats(DOMAINS, [
    { domain: 'alpha', score: 5, total: 10 },
  ]);
  const beta = stats.find((d) => d.id === 'beta');
  assert.equal(beta.attemptCount, 0);
  assert.equal(beta.accuracy, null);
  assert.equal(beta.accuracyPct, null);
});

test('zero-total attempts are excluded from the aggregation', () => {
  const stats = computeDomainStats(DOMAINS, [
    { domain: 'alpha', score: 0, total: 0 },
  ]);
  const alpha = stats.find((d) => d.id === 'alpha');
  assert.equal(alpha.attemptCount, 0);
  assert.equal(alpha.accuracy, null);
});

// Two domains can round to the same displayed percent while genuinely
// differing — the weakest pick must use the unrounded fraction, never the
// rounded display value.
test('rounding-tie: weakest is decided by unrounded accuracy', () => {
  const stats = computeDomainStats(DOMAINS, [
    { domain: 'alpha', score: 4, total: 5 }, // 0.800 -> displays 80%
    { domain: 'beta', score: 803, total: 1000 }, // 0.803 -> also displays 80%
  ]);
  assert.equal(stats.find((d) => d.id === 'alpha').accuracyPct, 80);
  assert.equal(stats.find((d) => d.id === 'beta').accuracyPct, 80);
  assert.equal(weakestDomainId(stats), 'alpha');
});

test('all attempted domains at 100% suppresses the weakest flag', () => {
  const stats = computeDomainStats(DOMAINS, [
    { domain: 'alpha', score: 10, total: 10 },
    { domain: 'beta', score: 5, total: 5 },
  ]);
  assert.equal(weakestDomainId(stats), null);
});

test('a single attempted domain below 100% is flagged', () => {
  const stats = computeDomainStats(DOMAINS, [
    { domain: 'alpha', score: 5, total: 10 },
  ]);
  assert.equal(weakestDomainId(stats), 'alpha');
});

test('a single attempted domain at 100% is not flagged', () => {
  const stats = computeDomainStats(DOMAINS, [
    { domain: 'alpha', score: 10, total: 10 },
  ]);
  assert.equal(weakestDomainId(stats), null);
});

test('no attempts at all yields no weakest domain', () => {
  assert.equal(weakestDomainId(computeDomainStats(DOMAINS, [])), null);
});
