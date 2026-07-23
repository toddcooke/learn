// aws/js/lib/svcFlow.js
//
// Directed-path search for the service-diagram goals engine. Graphs are
// tiny (a couple dozen nodes), so plain BFS per segment is plenty. Every
// find returns node-id hops so callers can render human traces from node
// names. findFlow requires SIMPLE paths: a flow never revisits a node,
// so a request/response back-arrow (api ↔ lambda) cannot smuggle a via
// stage into a path that skips the stage's real work, and a via stage is
// never satisfied by the node the walk is already standing on.

import { getNode, selectNodes } from './svcModel.js';

// Shortest directed path from `fromId` to `toId` as an inclusive id list,
// or null. A node reaches itself with the single-hop path [id]. `blocked`
// ids (never including fromId) are treated as absent from the graph.
export function shortestPath(graph, fromId, toId, blocked = null) {
  if (!getNode(graph, fromId) || !getNode(graph, toId)) return null;
  if (fromId === toId) return [fromId];
  if (blocked && blocked.has(toId)) return null;
  const prev = new Map([[fromId, null]]);
  const queue = [fromId];
  while (queue.length > 0) {
    const id = queue.shift();
    for (const edge of graph.edges) {
      if (edge.from !== id || prev.has(edge.to)) continue;
      if (blocked && blocked.has(edge.to)) continue;
      prev.set(edge.to, id);
      if (edge.to === toId) {
        const path = [toId];
        let at = id;
        while (at !== null) { path.unshift(at); at = prev.get(at); }
        return path;
      }
      queue.push(edge.to);
    }
  }
  return null;
}

// A directed SIMPLE path from some `from`-selected node to some
// `to`-selected node that passes through one node of every `via` selector
// IN ORDER, never revisiting a node. Tries every combination of
// candidates (graphs are small); returns { ok: true, hops } with the full
// id path, or { ok: false, stuck } where `stuck` names the waypoint pair
// the deepest-reaching attempt could not connect.
export function findFlow(graph, fromSel, toSel, viaSels = []) {
  const stages = [selectNodes(graph, fromSel), ...viaSels.map((sel) => selectNodes(graph, sel)), selectNodes(graph, toSel)];
  if (stages.some((nodes) => nodes.length === 0)) {
    const emptyIndex = stages.findIndex((nodes) => nodes.length === 0);
    return { ok: false, missingStage: emptyIndex };
  }
  let best = null; // { reached, stuck: { fromId, toId } }
  const stuckAt = (stageIndex, fromId, toId) => {
    if (!best || stageIndex > best.reached) best = { reached: stageIndex, stuck: { fromId, toId } };
  };
  const walk = (stageIndex, atId, hops, visited) => {
    if (stageIndex === stages.length) return { ok: true, hops };
    for (const candidate of stages[stageIndex]) {
      // A stage must be a NEW box — the flow "passes through" it.
      if (visited.has(candidate.id)) {
        stuckAt(stageIndex, atId, candidate.id);
        continue;
      }
      const blocked = new Set(visited);
      blocked.delete(atId); // the segment starts here
      const segment = shortestPath(graph, atId, candidate.id, blocked);
      if (segment === null) {
        stuckAt(stageIndex, atId, candidate.id);
        continue;
      }
      const found = walk(
        stageIndex + 1,
        candidate.id,
        [...hops, ...segment.slice(1)],
        new Set([...visited, ...segment]),
      );
      if (found) return found;
    }
    return null;
  };
  for (const start of stages[0]) {
    const found = walk(1, start.id, [start.id], new Set([start.id]));
    if (found) return found;
  }
  return { ok: false, stuck: best ? best.stuck : null };
}
