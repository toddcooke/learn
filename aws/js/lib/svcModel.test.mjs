import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGraph, getNode, addNode, updateNode, removeNode,
  addEdge, removeEdge, hasEdge, nodesOfType, nodesByRole, selectNodes,
  outgoing, incoming,
} from './svcModel.js';

test('addNode assigns unique ids and human default names', () => {
  const g = createGraph();
  const a = addNode(g, 'lambda');
  const b = addNode(g, 'lambda');
  assert.equal(a.id, 'lambda-1');
  assert.equal(b.id, 'lambda-2');
  assert.equal(a.name, 'AWS Lambda');
  assert.equal(b.name, 'AWS Lambda 2');
});

test('addNode rejects unknown types', () => {
  const g = createGraph();
  assert.equal(addNode(g, 'mainframe'), null);
  assert.equal(g.nodes.length, 0);
});

test('ids are never reused after a removal', () => {
  const g = createGraph();
  const a = addNode(g, 's3');
  removeNode(g, a.id);
  const b = addNode(g, 's3');
  assert.notEqual(b.id, a.id);
});

test('addEdge rejects self-loops, duplicates, and dangling endpoints', () => {
  const g = createGraph();
  const a = addNode(g, 'users');
  const b = addNode(g, 's3');
  assert.equal(addEdge(g, a.id, a.id), null);
  assert.ok(addEdge(g, a.id, b.id));
  assert.equal(addEdge(g, a.id, b.id), null, 'duplicate rejected');
  assert.equal(addEdge(g, a.id, 'ghost-1'), null);
  assert.equal(g.edges.length, 1);
});

test('reverse edges are distinct from forward edges', () => {
  const g = createGraph();
  const a = addNode(g, 'twinmaker');
  const b = addNode(g, 'grafana');
  assert.ok(addEdge(g, a.id, b.id));
  assert.ok(addEdge(g, b.id, a.id));
  assert.ok(hasEdge(g, a.id, b.id));
  assert.ok(hasEdge(g, b.id, a.id));
});

test('removeNode cascades to every touching edge', () => {
  const g = createGraph();
  const a = addNode(g, 'users');
  const b = addNode(g, 'apigateway');
  const c = addNode(g, 'lambda');
  addEdge(g, a.id, b.id);
  addEdge(g, b.id, c.id);
  removeNode(g, b.id);
  assert.equal(getNode(g, b.id), null);
  assert.deepEqual(g.edges, []);
});

test('removeEdge removes exactly the named direction', () => {
  const g = createGraph();
  const a = addNode(g, 'sitewise');
  const b = addNode(g, 'iotcore');
  addEdge(g, a.id, b.id);
  addEdge(g, b.id, a.id);
  removeEdge(g, a.id, b.id);
  assert.ok(!hasEdge(g, a.id, b.id));
  assert.ok(hasEdge(g, b.id, a.id));
});

test('selectNodes handles service, role, and junk selectors', () => {
  const g = createGraph();
  const a = addNode(g, 'lambda', { role: 'resizer' });
  addNode(g, 'lambda');
  assert.deepEqual(selectNodes(g, { service: 'lambda' }).length, 2);
  assert.deepEqual(selectNodes(g, { role: 'resizer' }), [a]);
  assert.deepEqual(selectNodes(g, { role: 'ghost' }), []);
  assert.deepEqual(selectNodes(g, null), []);
  assert.deepEqual(selectNodes(g, {}), []);
});

test('updateNode patches in place; outgoing/incoming filter by endpoint', () => {
  const g = createGraph();
  const a = addNode(g, 'sns');
  const b = addNode(g, 'sqs');
  const c = addNode(g, 'sqs');
  addEdge(g, a.id, b.id);
  addEdge(g, a.id, c.id);
  updateNode(g, b.id, { name: 'email queue', role: 'email' });
  assert.equal(getNode(g, b.id).name, 'email queue');
  assert.equal(nodesByRole(g, 'email').length, 1);
  assert.equal(outgoing(g, a.id).length, 2);
  assert.equal(incoming(g, c.id).length, 1);
  assert.equal(nodesOfType(g, 'sqs').length, 2);
});

test('graphs restored without counters still mint fresh ids', () => {
  const g = { nodes: [{ id: 'lambda-1', type: 'lambda', name: 'AWS Lambda', role: null }], edges: [] };
  const b = addNode(g, 'lambda');
  assert.ok(b.id.startsWith('lambda-'));
  // A draft saved before `counters` existed collides only if we blindly
  // trust the counter; the model just needs SOME unique id here.
  assert.equal(new Set(g.nodes.map((n) => n.id)).size, g.nodes.length);
});

test('restored drafts get collision-free default NAMES, not just ids', () => {
  const g = {
    nodes: [{ id: 'lambda-1', type: 'lambda', name: 'AWS Lambda', role: null }],
    edges: [],
  };
  const b = addNode(g, 'lambda');
  assert.notEqual(b.id, 'lambda-1');
  assert.notEqual(b.name, 'AWS Lambda', 'default name must come from the post-collision count');
});

test('stale counters (behind existing ids) still mint fresh ids and names', () => {
  const g = {
    nodes: [
      { id: 'lambda-1', type: 'lambda', name: 'AWS Lambda', role: null },
      { id: 'lambda-2', type: 'lambda', name: 'AWS Lambda 2', role: null },
    ],
    edges: [],
    counters: { lambda: 1 },
  };
  const c = addNode(g, 'lambda');
  assert.equal(new Set(g.nodes.map((n) => n.id)).size, 3);
  assert.equal(new Set(g.nodes.map((n) => n.name)).size, 3);
  assert.equal(c.id, 'lambda-3');
});
