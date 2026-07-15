import test from 'node:test';
import assert from 'node:assert/strict';
import { bareName, sortByBareName } from './serviceSort.js';

test('bareName strips a leading vendor prefix', () => {
  assert.equal(bareName('Amazon EC2'), 'EC2');
  assert.equal(bareName('AWS Lambda'), 'Lambda');
});

test('bareName leaves unprefixed names alone', () => {
  assert.equal(bareName('NAT Gateway'), 'NAT Gateway');
  assert.equal(bareName('Application Load Balancer'), 'Application Load Balancer');
});

test('bareName only strips the prefix as a whole word', () => {
  assert.equal(bareName('Amazonian Service'), 'Amazonian Service');
});

test('sortByBareName orders by bare name and does not mutate its input', () => {
  const input = [
    { name: 'AWS Lambda' },
    { name: 'Amazon EC2' },
    { name: 'NAT Gateway' },
    { name: 'Amazon Aurora' },
  ];
  const snapshot = [...input];
  const sorted = sortByBareName(input);
  assert.deepEqual(
    sorted.map((s) => s.name),
    ['Amazon Aurora', 'Amazon EC2', 'AWS Lambda', 'NAT Gateway'],
  );
  assert.deepEqual(input, snapshot);
});
