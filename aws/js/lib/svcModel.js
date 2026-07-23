// aws/js/lib/svcModel.js
//
// State factory, mutators, and queries for the service-diagram
// Architecture Challenge. The graph is a plain JSON-serializable object
// ({ nodes, edges }) so drafts round-trip through localStorage. Mutators
// work in place; add* helpers return what they created (or null when the
// edit is rejected). Referential integrity lives here: removing a node
// also removes every edge touching it. pos on a node is presentation
// metadata only — evaluators ignore it.

import { SERVICE_TYPES, serviceLabel, serviceCategory } from './svcCatalog.js';

export function createGraph() {
  return { nodes: [], edges: [], counters: {} };
}

export function getNode(graph, id) {
  return graph.nodes.find((n) => n.id === id) || null;
}

// Counters never decrement, so ids (and default names) stay unique for
// the lifetime of a draft even across removals.
function nextCount(graph, type) {
  if (!graph.counters || typeof graph.counters !== 'object') graph.counters = {};
  graph.counters[type] = (graph.counters[type] || 0) + 1;
  return graph.counters[type];
}

export function addNode(graph, type, { name, role, pos } = {}) {
  if (!SERVICE_TYPES[type]) return null;
  // A draft saved before `counters` existed (or hand-edited) can hold ids
  // ahead of the counter; advance past them instead of colliding.
  let n = nextCount(graph, type);
  while (graph.nodes.some((x) => x.id === `${type}-${n}`)) n = nextCount(graph, type);
  const node = {
    id: `${type}-${n}`,
    type,
    name: name || (n === 1 ? serviceLabel(type) : `${serviceLabel(type)} ${n}`),
    role: role || null,
    ...(pos ? { pos } : {}),
  };
  graph.nodes.push(node);
  return node;
}

export function updateNode(graph, id, patch) {
  const node = getNode(graph, id);
  if (node) Object.assign(node, patch);
  return node;
}

export function removeNode(graph, id) {
  graph.nodes = graph.nodes.filter((n) => n.id !== id);
  graph.edges = graph.edges.filter((e) => e.from !== id && e.to !== id);
}

export function hasEdge(graph, from, to) {
  return graph.edges.some((e) => e.from === from && e.to === to);
}

// Rejected edges (self-loop, duplicate, missing endpoint) return null so
// the canvas can silently ignore a bad drop instead of corrupting state.
export function addEdge(graph, from, to) {
  if (from === to) return null;
  if (!getNode(graph, from) || !getNode(graph, to)) return null;
  if (hasEdge(graph, from, to)) return null;
  const edge = { from, to };
  graph.edges.push(edge);
  return edge;
}

export function removeEdge(graph, from, to) {
  graph.edges = graph.edges.filter((e) => !(e.from === from && e.to === to));
}

export function nodesOfType(graph, type) {
  return graph.nodes.filter((n) => n.type === type);
}

export function nodesByRole(graph, role) {
  return graph.nodes.filter((n) => n.role === role);
}

// Selector: { service: <typeId> } or { role: <roleId> }. Used by goals
// and best-practice rules; unknown shapes select nothing.
export function selectNodes(graph, sel) {
  if (sel && typeof sel.service === 'string') return nodesOfType(graph, sel.service);
  if (sel && typeof sel.role === 'string') return nodesByRole(graph, sel.role);
  return [];
}

export function outgoing(graph, id) {
  return graph.edges.filter((e) => e.from === id);
}

export function incoming(graph, id) {
  return graph.edges.filter((e) => e.to === id);
}

export function nodesInCategory(graph, categoryId) {
  return graph.nodes.filter((n) => serviceCategory(n.type) === categoryId);
}
