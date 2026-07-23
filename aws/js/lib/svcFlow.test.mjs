import test from 'node:test';
import assert from 'node:assert/strict';
import { createGraph, addNode, addEdge } from './svcModel.js';
import { shortestPath, findFlow } from './svcFlow.js';

function chain(...types) {
  const g = createGraph();
  const nodes = types.map((t) => addNode(g, t));
  for (let i = 0; i < nodes.length - 1; i++) addEdge(g, nodes[i].id, nodes[i + 1].id);
  return { g, nodes };
}

test('shortestPath follows edge direction only', () => {
  const { g, nodes } = chain('users', 'cloudfront', 's3');
  assert.deepEqual(shortestPath(g, nodes[0].id, nodes[2].id), nodes.map((n) => n.id));
  assert.equal(shortestPath(g, nodes[2].id, nodes[0].id), null);
});

test('shortestPath: self path, missing nodes', () => {
  const { g, nodes } = chain('users', 's3');
  assert.deepEqual(shortestPath(g, nodes[0].id, nodes[0].id), [nodes[0].id]);
  assert.equal(shortestPath(g, nodes[0].id, 'ghost'), null);
});

test('shortestPath prefers fewer hops', () => {
  const g = createGraph();
  const a = addNode(g, 'users');
  const b = addNode(g, 'apigateway');
  const c = addNode(g, 'lambda');
  addEdge(g, a.id, b.id);
  addEdge(g, b.id, c.id);
  addEdge(g, a.id, c.id); // direct shortcut
  assert.deepEqual(shortestPath(g, a.id, c.id), [a.id, c.id]);
});

test('findFlow connects selector stages in order', () => {
  const { g, nodes } = chain('users', 'apigateway', 'lambda', 'dynamodb');
  const res = findFlow(g, { service: 'users' }, { service: 'dynamodb' },
    [{ service: 'apigateway' }, { service: 'lambda' }]);
  assert.equal(res.ok, true);
  assert.deepEqual(res.hops, nodes.map((n) => n.id));
});

test('findFlow rejects paths that skip a via stage', () => {
  const g = createGraph();
  const u = addNode(g, 'users');
  const db = addNode(g, 'dynamodb');
  addEdge(g, u.id, db.id); // direct, skipping the API
  const res = findFlow(g, { service: 'users' }, { service: 'dynamodb' }, [{ service: 'apigateway' }]);
  assert.equal(res.ok, false);
  assert.equal(res.missingStage, 1, 'the via stage has no nodes at all');
});

test('findFlow reports the stuck segment when nodes exist but arrows are missing', () => {
  const g = createGraph();
  const u = addNode(g, 'users');
  const cf = addNode(g, 'cloudfront');
  const s3 = addNode(g, 's3');
  addEdge(g, u.id, cf.id); // cloudfront → s3 arrow missing
  const res = findFlow(g, { service: 'users' }, { service: 's3' }, [{ service: 'cloudfront' }]);
  assert.equal(res.ok, false);
  assert.deepEqual(res.stuck, { fromId: cf.id, toId: s3.id });
});

test('findFlow tries every candidate when a role is ambiguous', () => {
  const g = createGraph();
  const sns = addNode(g, 'sns');
  const q1 = addNode(g, 'sqs');
  const q2 = addNode(g, 'sqs');
  const consumer = addNode(g, 'lambda', { role: 'email' });
  addEdge(g, sns.id, q1.id);
  addEdge(g, sns.id, q2.id);
  addEdge(g, q2.id, consumer.id); // only queue 2 reaches the consumer
  const res = findFlow(g, { service: 'sns' }, { role: 'email' }, [{ service: 'sqs' }]);
  assert.equal(res.ok, true);
  assert.deepEqual(res.hops, [sns.id, q2.id, consumer.id]);
});

test('findFlow with no via is plain reachability', () => {
  const { g, nodes } = chain('devices', 'sitewise');
  const res = findFlow(g, { service: 'devices' }, { service: 'sitewise' });
  assert.equal(res.ok, true);
  assert.deepEqual(res.hops, [nodes[0].id, nodes[1].id]);
});

test('findFlow flags the empty stage index for missing endpoints', () => {
  const g = createGraph();
  addNode(g, 'users');
  const res = findFlow(g, { service: 'users' }, { service: 's3' }, [{ service: 'cloudfront' }]);
  assert.equal(res.ok, false);
  // stage 0 = from, 1 = first via, 2 = to; cloudfront missing first.
  assert.equal(res.missingStage, 1);
});

test('findFlow keeps intermediate hops of multi-edge segments in the trace', () => {
  const { g, nodes } = chain('users', 'apigateway', 'lambda', 'dynamodb');
  const res = findFlow(g, { service: 'users' }, { service: 'dynamodb' }, [{ service: 'lambda' }]);
  assert.equal(res.ok, true);
  // The apigateway hop is not a waypoint but must still appear in the path.
  assert.deepEqual(res.hops, nodes.map((n) => n.id));
});

test('findFlow requires simple paths: a request/response back-arrow cannot satisfy a via stage', () => {
  // users→api→fn, fn→api (response arrow), api→db — the data never flows
  // fn→db, so "users to db via [api, fn]" must FAIL, not sneak back
  // through the api.
  const g = createGraph();
  const u = addNode(g, 'users');
  const api = addNode(g, 'apigateway');
  const fn = addNode(g, 'lambda');
  const db = addNode(g, 'dynamodb');
  addEdge(g, u.id, api.id);
  addEdge(g, api.id, fn.id);
  addEdge(g, fn.id, api.id);
  addEdge(g, api.id, db.id);
  const res = findFlow(g, { service: 'users' }, { service: 'dynamodb' },
    [{ service: 'apigateway' }, { service: 'lambda' }]);
  assert.equal(res.ok, false);
  assert.deepEqual(res.stuck, { fromId: fn.id, toId: db.id });
});

test('findFlow: a via stage is never satisfied by the node the walk is standing on', () => {
  const g = createGraph();
  const twin = addNode(g, 'twinmaker', { role: 'connector' }); // misassigned role
  const ts = addNode(g, 'timestream');
  addEdge(g, twin.id, ts.id);
  const res = findFlow(g, { service: 'twinmaker' }, { service: 'timestream' }, [{ role: 'connector' }]);
  assert.equal(res.ok, false);
});

test('findFlow stuck reporting names the deepest-reaching attempt', () => {
  const g = createGraph();
  const u = addNode(g, 'users');
  const cfA = addNode(g, 'cloudfront'); // unreachable from users
  const cfB = addNode(g, 'cloudfront'); // reachable, but dead-ends
  const s3 = addNode(g, 's3');
  addEdge(g, u.id, cfB.id);
  const res = findFlow(g, { service: 'users' }, { service: 's3' }, [{ service: 'cloudfront' }]);
  assert.equal(res.ok, false);
  // The cfA attempt fails at the via stage; the cfB attempt reaches the
  // via and fails later — the trace must blame cfB → s3, not users → cfA.
  assert.deepEqual(res.stuck, { fromId: cfB.id, toId: s3.id });
});

test('shortestPath honors the blocked set', () => {
  const { g, nodes } = chain('users', 'cloudfront', 's3');
  assert.equal(shortestPath(g, nodes[0].id, nodes[2].id, new Set([nodes[1].id])), null);
  assert.equal(shortestPath(g, nodes[0].id, nodes[2].id, new Set([nodes[2].id])), null);
  assert.deepEqual(shortestPath(g, nodes[0].id, nodes[2].id, new Set()), nodes.map((n) => n.id));
});
