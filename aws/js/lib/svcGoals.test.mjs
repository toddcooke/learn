import test from 'node:test';
import assert from 'node:assert/strict';
import { createGraph, addNode, addEdge } from './svcModel.js';
import { GOAL_TYPES, evaluateGoals } from './svcGoals.js';

const CH = {
  roles: [
    { id: 'resizer', label: 'resizer function', service: 'lambda' },
    { id: 'email', label: 'email consumer', service: 'lambda' },
  ],
};

function run(graph, goal) {
  return evaluateGoals(graph, { ...CH, goals: [goal] })[0];
}

test('GOAL_TYPES is the closed set the validator checks against', () => {
  assert.deepEqual(GOAL_TYPES, ['exists', 'edge', 'linked', 'noEdge', 'path', 'fanout']);
});

test('exists: service selector, min counts, empty detail', () => {
  const g = createGraph();
  const empty = run(g, { type: 'exists', sel: { service: 'sqs' } });
  assert.equal(empty.ok, false);
  assert.match(empty.detail, /Add Amazon SQS/);
  addNode(g, 'sqs');
  assert.equal(run(g, { type: 'exists', sel: { service: 'sqs' } }).ok, true);
  const two = run(g, { type: 'exists', sel: { service: 'sqs' }, min: 2 });
  assert.equal(two.ok, false);
  assert.match(two.detail, /Only 1 of 2/);
  addNode(g, 'sqs');
  assert.equal(run(g, { type: 'exists', sel: { service: 'sqs' }, min: 2 }).ok, true);
});

test('exists: role selector enforces the expected service type', () => {
  const g = createGraph();
  const missing = run(g, { type: 'exists', sel: { role: 'resizer' }, service: 'lambda' });
  assert.equal(missing.ok, false);
  assert.match(missing.detail, /assigned the role "resizer function"/);
  const wrong = addNode(g, 'ec2', { role: 'resizer' });
  const mismatch = run(g, { type: 'exists', sel: { role: 'resizer' }, service: 'lambda' });
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.detail, new RegExp(wrong.name));
  wrong.role = null;
  addNode(g, 'lambda', { role: 'resizer' });
  assert.equal(run(g, { type: 'exists', sel: { role: 'resizer' }, service: 'lambda' }).ok, true);
});

test('edge: existential over selector members', () => {
  const g = createGraph();
  const s3a = addNode(g, 's3');
  addNode(g, 's3');
  const fn = addNode(g, 'lambda', { role: 'resizer' });
  const before = run(g, { type: 'edge', from: { service: 's3' }, to: { role: 'resizer' } });
  assert.equal(before.ok, false);
  assert.match(before.detail, /Draw an arrow/);
  addEdge(g, s3a.id, fn.id);
  assert.equal(run(g, { type: 'edge', from: { service: 's3' }, to: { role: 'resizer' } }).ok, true);
});

test('linked: either direction satisfies', () => {
  const g = createGraph();
  const tm = addNode(g, 'twinmaker');
  const gf = addNode(g, 'grafana');
  assert.equal(run(g, { type: 'linked', a: { service: 'twinmaker' }, b: { service: 'grafana' } }).ok, false);
  addEdge(g, gf.id, tm.id); // reverse direction only
  assert.equal(run(g, { type: 'linked', a: { service: 'twinmaker' }, b: { service: 'grafana' } }).ok, true);
});

test('noEdge: universal, trivially ok when nothing matches, names offenders', () => {
  const g = createGraph();
  assert.equal(run(g, { type: 'noEdge', from: { service: 'users' }, to: { service: 'dynamodb' } }).ok, true);
  const u = addNode(g, 'users');
  const db = addNode(g, 'dynamodb');
  assert.equal(run(g, { type: 'noEdge', from: { service: 'users' }, to: { service: 'dynamodb' } }).ok, true);
  addEdge(g, u.id, db.id);
  const row = run(g, { type: 'noEdge', from: { service: 'users' }, to: { service: 'dynamodb' } });
  assert.equal(row.ok, false);
  assert.match(row.detail, /Users → Amazon DynamoDB/);
});

test('path: produces a hop trace when found', () => {
  const g = createGraph();
  const u = addNode(g, 'users');
  const cf = addNode(g, 'cloudfront');
  const s3 = addNode(g, 's3');
  addEdge(g, u.id, cf.id);
  addEdge(g, cf.id, s3.id);
  const row = run(g, { type: 'path', from: { service: 'users' }, to: { service: 's3' }, via: [{ service: 'cloudfront' }] });
  assert.equal(row.ok, true);
  assert.equal(row.traces.length, 1);
  assert.deepEqual(row.traces[0].trace.map((s) => s.label), [
    'Users → Amazon CloudFront',
    'Amazon CloudFront → Amazon S3',
  ]);
});

test('path: missing stage vs dead-end produce different details', () => {
  const g = createGraph();
  const u = addNode(g, 'users');
  addEdge(g, u.id, addNode(g, 'cloudfront').id);
  const missing = run(g, { type: 'path', from: { service: 'users' }, to: { service: 's3' }, via: [{ service: 'cloudfront' }] });
  assert.equal(missing.ok, false);
  assert.match(missing.detail, /Add Amazon S3/);
  addNode(g, 's3');
  const stuck = run(g, { type: 'path', from: { service: 'users' }, to: { service: 's3' }, via: [{ service: 'cloudfront' }] });
  assert.equal(stuck.ok, false);
  assert.match(stuck.detail, /dead-ends.*Amazon CloudFront to Amazon S3/);
});

test('path: a direct shortcut does not satisfy a via requirement', () => {
  const g = createGraph();
  const u = addNode(g, 'users');
  const db = addNode(g, 'dynamodb');
  addNode(g, 'apigateway');
  addEdge(g, u.id, db.id);
  const row = run(g, { type: 'path', from: { service: 'users' }, to: { service: 'dynamodb' }, via: [{ service: 'apigateway' }] });
  assert.equal(row.ok, false);
});

test('fanout: counts distinct outgoing arrows on the best member', () => {
  const g = createGraph();
  const sns = addNode(g, 'sns');
  const q1 = addNode(g, 'sqs');
  const q2 = addNode(g, 'sqs');
  const one = run(g, { type: 'fanout', from: { service: 'sns' }, min: 2 });
  assert.equal(one.ok, false);
  addEdge(g, sns.id, q1.id);
  addEdge(g, sns.id, q2.id);
  assert.equal(run(g, { type: 'fanout', from: { service: 'sns' }, min: 2 }).ok, true);
});

test('unknown goal type fails loudly', () => {
  const g = createGraph();
  const row = run(g, { type: 'teleport' });
  assert.equal(row.ok, false);
  assert.match(row.label, /Unknown goal type/);
});

test('fanout: arrows looping back to a publisher do not count as subscribers', () => {
  const g = createGraph();
  const pub = addNode(g, 'lambda', { role: 'resizer' });
  const sns = addNode(g, 'sns');
  const q1 = addNode(g, 'sqs');
  addEdge(g, pub.id, sns.id);
  addEdge(g, sns.id, q1.id);
  addEdge(g, sns.id, pub.id); // back-arrow to the publisher
  const row = run(g, { type: 'fanout', from: { service: 'sns' }, min: 2 });
  assert.equal(row.ok, false);
  assert.match(row.detail, /1 subscriber/);
});

test('fanout: evaluates the best member when several nodes match the selector', () => {
  const g = createGraph();
  addNode(g, 'sns'); // dead topic created first
  const live = addNode(g, 'sns');
  const q1 = addNode(g, 'sqs');
  const q2 = addNode(g, 'sqs');
  addEdge(g, live.id, q1.id);
  addEdge(g, live.id, q2.id);
  const row = run(g, { type: 'fanout', from: { service: 'sns' }, min: 2 });
  assert.equal(row.ok, true);
  assert.match(row.detail, /2 subscribers/);
});

test('path: goals require simple flows — api↔lambda round-trip cannot fake lambda→db', () => {
  const g = createGraph();
  const u = addNode(g, 'users');
  const api = addNode(g, 'apigateway');
  const fn = addNode(g, 'lambda');
  const db = addNode(g, 'dynamodb');
  addEdge(g, u.id, api.id);
  addEdge(g, api.id, fn.id);
  addEdge(g, fn.id, api.id);
  addEdge(g, api.id, db.id);
  const row = run(g, {
    type: 'path', from: { service: 'users' }, to: { service: 'dynamodb' },
    via: [{ service: 'apigateway' }, { service: 'lambda' }],
  });
  assert.equal(row.ok, false);
  assert.match(row.detail, /dead-ends/);
});
