import test from 'node:test';
import assert from 'node:assert/strict';
import { createGraph, addNode, addEdge, updateNode } from './svcModel.js';
import { validateStructure, evaluateBestPractices, BEST_PRACTICE_RULE_IDS } from './svcValidate.js';

function ruleRow(graph, id) {
  return evaluateBestPractices(graph, [id])[0];
}

test('a clean diagram validates clean', () => {
  const g = createGraph();
  const u = addNode(g, 'users');
  const cf = addNode(g, 'cloudfront');
  addEdge(g, u.id, cf.id);
  assert.deepEqual(validateStructure(g).errors, []);
});

test('duplicate display names are a structural error', () => {
  const g = createGraph();
  addNode(g, 'lambda');
  const b = addNode(g, 'lambda');
  updateNode(g, b.id, { name: 'AWS Lambda' }); // collide with the default
  const errors = validateStructure(g).errors;
  assert.ok(errors.some((e) => e.ruleId === 'node-name-duplicate'));
});

test('hand-edited drafts degrade to errors: unknown type, empty name, dangling edge, self-loop, duplicate edge', () => {
  const g = createGraph();
  const a = addNode(g, 's3');
  g.nodes.push({ id: 'x-1', type: 'mainframe', name: 'Old Iron', role: null });
  updateNode(g, a.id, { name: '  ' });
  g.edges.push({ from: a.id, to: 'ghost' });
  g.edges.push({ from: a.id, to: a.id });
  g.edges.push({ from: 'x-1', to: a.id });
  g.edges.push({ from: 'x-1', to: a.id });
  const ids = validateStructure(g).errors.map((e) => e.ruleId);
  for (const want of ['node-type-unknown', 'node-name-empty', 'edge-endpoint-missing', 'edge-self-loop', 'edge-duplicate']) {
    assert.ok(ids.includes(want), `${want} in ${ids}`);
  }
});

test('cdn-in-front: applicable only when users and S3 coexist; fails on a direct fetch', () => {
  const g = createGraph();
  assert.equal(ruleRow(g, 'cdn-in-front').applicable, false);
  const u = addNode(g, 'users');
  assert.equal(ruleRow(g, 'cdn-in-front').applicable, false);
  const s3 = addNode(g, 's3');
  assert.equal(ruleRow(g, 'cdn-in-front').applicable, true);
  assert.equal(ruleRow(g, 'cdn-in-front').ok, true);
  addEdge(g, u.id, s3.id);
  const row = ruleRow(g, 'cdn-in-front');
  assert.equal(row.ok, false);
  assert.match(row.message, /CloudFront/);
});

test('auth-on-public-api: only client-facing APIs need Cognito', () => {
  const g = createGraph();
  const api = addNode(g, 'apigateway');
  assert.equal(ruleRow(g, 'auth-on-public-api').applicable, false, 'internal API — no client edge');
  const u = addNode(g, 'users');
  addEdge(g, u.id, api.id);
  const bare = ruleRow(g, 'auth-on-public-api');
  assert.equal(bare.applicable, true);
  assert.equal(bare.ok, false);
  const cg = addNode(g, 'cognito');
  addEdge(g, api.id, cg.id);
  assert.equal(ruleRow(g, 'auth-on-public-api').ok, true);
});

test('auth-on-public-api: accepts the Cognito link in either direction and covers AppSync', () => {
  const g = createGraph();
  const u = addNode(g, 'users');
  const api = addNode(g, 'appsync');
  addEdge(g, u.id, api.id);
  const cg = addNode(g, 'cognito');
  addEdge(g, cg.id, api.id);
  assert.equal(ruleRow(g, 'auth-on-public-api').ok, true);
});

test('db-behind-compute: flags any client → database arrow, devices included', () => {
  const g = createGraph();
  const d = addNode(g, 'devices');
  const ts = addNode(g, 'timestream');
  assert.equal(ruleRow(g, 'db-behind-compute').ok, true);
  addEdge(g, d.id, ts.id);
  const row = ruleRow(g, 'db-behind-compute');
  assert.equal(row.applicable, true);
  assert.equal(row.ok, false);
});

test('no-lambda-chaining: needs two lambdas to apply; flags direct invocation', () => {
  const g = createGraph();
  const a = addNode(g, 'lambda');
  assert.equal(ruleRow(g, 'no-lambda-chaining').applicable, false);
  const b = addNode(g, 'lambda');
  assert.equal(ruleRow(g, 'no-lambda-chaining').ok, true);
  addEdge(g, a.id, b.id);
  assert.equal(ruleRow(g, 'no-lambda-chaining').ok, false);
});

test('no-orphan-nodes: lists unwired services by name', () => {
  const g = createGraph();
  assert.equal(ruleRow(g, 'no-orphan-nodes').applicable, false);
  const u = addNode(g, 'users');
  const cf = addNode(g, 'cloudfront');
  addNode(g, 'ec2');
  addEdge(g, u.id, cf.id);
  const row = ruleRow(g, 'no-orphan-nodes');
  assert.equal(row.ok, false);
  assert.match(row.message, /Amazon EC2/);
});

test('rule selection: unknown ids are ignored, "all" runs everything', () => {
  const g = createGraph();
  assert.equal(evaluateBestPractices(g, ['nope']).length, 0);
  assert.equal(evaluateBestPractices(g, 'all').length, BEST_PRACTICE_RULE_IDS.length);
  assert.ok(BEST_PRACTICE_RULE_IDS.length >= 5);
});

test('auth-on-public-api: a CloudFront-fronted API is still client-facing', () => {
  const g = createGraph();
  const u = addNode(g, 'users');
  const cf = addNode(g, 'cloudfront');
  const api = addNode(g, 'apigateway');
  addEdge(g, u.id, cf.id);
  addEdge(g, cf.id, api.id); // no direct users→api edge
  const bare = ruleRow(g, 'auth-on-public-api');
  assert.equal(bare.applicable, true, 'reachability, not direct edges, decides client-facing');
  assert.equal(bare.ok, false);
  const cg = addNode(g, 'cognito');
  addEdge(g, api.id, cg.id);
  assert.equal(ruleRow(g, 'auth-on-public-api').ok, true);
});

test('duplicate node ids are a structural error', () => {
  const g = createGraph();
  const a = addNode(g, 'lambda');
  g.nodes.push({ id: a.id, type: 'lambda', name: 'Impostor', role: null });
  const ids = validateStructure(g).errors.map((e) => e.ruleId);
  assert.ok(ids.includes('node-id-duplicate'), ids.join(','));
});

test('duplicate-name detection ignores case and surrounding whitespace', () => {
  const g = createGraph();
  const a = addNode(g, 'rds');
  const b = addNode(g, 'dynamodb');
  updateNode(g, a.id, { name: 'Orders DB' });
  updateNode(g, b.id, { name: '  orders db ' });
  const ids = validateStructure(g).errors.map((e) => e.ruleId);
  assert.ok(ids.includes('node-name-duplicate'), ids.join(','));
});
