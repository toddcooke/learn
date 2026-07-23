// aws/js/lib/svcValidate.js
//
// Structural validation ("is this even a coherent diagram") and advisory
// best-practice rules for the service-diagram Architecture Challenge.
// Structure stays light on purpose — the model prevents most bad states —
// but a hand-edited draft must degrade to errors, never a crash. Every
// error carries a stable ruleId and names nodes by their display name.

import { SERVICE_TYPES, serviceLabel } from './svcCatalog.js';
import { getNode, nodesOfType, hasEdge } from './svcModel.js';
import { shortestPath } from './svcFlow.js';

const DB_TYPES = ['dynamodb', 'rds', 'timestream'];
const CLIENT_TYPES = ['users', 'devices'];
const API_TYPES = ['apigateway', 'appsync'];

export function validateStructure(graph) {
  const errors = [];
  const err = (ruleId, message, nodeIds = []) => errors.push({ ruleId, message, nodeIds });

  const byId = new Set();
  for (const node of graph.nodes) {
    if (!SERVICE_TYPES[node.type]) {
      err('node-type-unknown', `"${node.name || node.id}" has unknown service type "${node.type}".`, [node.id]);
    }
    if (typeof node.name !== 'string' || node.name.trim() === '') {
      err('node-name-empty', `A ${serviceLabel(node.type)} card has no name — give it one so results can refer to it.`, [node.id]);
    }
    if (byId.has(node.id)) {
      err('node-id-duplicate', `Two cards share the internal id "${node.id}" — the draft is corrupted; Reset the challenge.`, [node.id]);
    }
    byId.add(node.id);
  }

  const byName = new Map();
  for (const node of graph.nodes) {
    const key = String(node.name || '').trim().toLowerCase();
    if (!key) continue;
    if (byName.has(key)) {
      err('node-name-duplicate', `Two cards are both named "${node.name}" — rename one so goal results are unambiguous.`, [byName.get(key), node.id]);
    } else {
      byName.set(key, node.id);
    }
  }

  const seenPairs = new Set();
  for (const edge of graph.edges) {
    const from = getNode(graph, edge.from);
    const to = getNode(graph, edge.to);
    if (!from || !to) {
      err('edge-endpoint-missing', 'An arrow points at a card that no longer exists.', []);
      continue;
    }
    if (edge.from === edge.to) {
      err('edge-self-loop', `${from.name} has an arrow to itself.`, [edge.from]);
    }
    const key = `${edge.from}→${edge.to}`;
    if (seenPairs.has(key)) {
      err('edge-duplicate', `Duplicate arrow ${from.name} → ${to.name}.`, [edge.from, edge.to]);
    }
    seenPairs.add(key);
  }

  return { errors };
}

// ---------------------------------------------------------------------------
// Best-practice rules (advisory). Each evaluator returns
// { applicable, ok, message } — `why` comes from the rule table. Callers
// score passed ÷ applicable; inapplicable rules are skipped entirely.
// ---------------------------------------------------------------------------

function typeNodes(graph, types) {
  return graph.nodes.filter((n) => types.includes(n.type));
}

const BEST_PRACTICE_RULES = [
  {
    id: 'cdn-in-front',
    why: 'CloudFront caches static content at the edge, terminates TLS, and (with '
      + 'Origin Access Control) keeps the bucket private. Presigned URLs are the '
      + 'sanctioned exception for direct uploads and temporary object sharing.',
    evaluate(graph) {
      const clients = nodesOfType(graph, 'users');
      const buckets = nodesOfType(graph, 's3');
      if (clients.length === 0 || buckets.length === 0) return { applicable: false };
      const direct = [];
      for (const c of clients) {
        for (const b of buckets) {
          if (hasEdge(graph, c.id, b.id)) direct.push(`${c.name} → ${b.name}`);
        }
      }
      return direct.length === 0
        ? { applicable: true, ok: true, message: 'No client fetches straight from S3.' }
        : { applicable: true, ok: false, message: `Clients hit S3 directly: ${direct.join('; ')} — put CloudFront in front.` };
    },
  },
  {
    id: 'auth-on-public-api',
    why: 'A public API without an identity provider is open to anyone; Cognito '
      + '(or another authorizer) validates callers before requests reach your backend.',
    evaluate(graph) {
      const clients = typeNodes(graph, CLIENT_TYPES);
      // Client-facing means REACHABLE from a client, not just one hop away —
      // fronting the API with CloudFront must not silence the rule.
      const apis = typeNodes(graph, API_TYPES).filter((api) =>
        clients.some((c) => shortestPath(graph, c.id, api.id) !== null));
      if (apis.length === 0) return { applicable: false };
      const cognitos = nodesOfType(graph, 'cognito');
      const unprotected = apis.filter((api) =>
        !cognitos.some((cg) => hasEdge(graph, api.id, cg.id) || hasEdge(graph, cg.id, api.id)));
      return unprotected.length === 0
        ? { applicable: true, ok: true, message: 'Every client-facing API is linked to Cognito.' }
        : { applicable: true, ok: false, message: `${unprotected.map((a) => a.name).join(', ')}: no Cognito linked — anyone can call it.` };
    },
  },
  {
    id: 'db-behind-compute',
    why: 'Databases hold your crown jewels; clients should reach them only through '
      + 'an API or compute tier that enforces auth and validation.',
    evaluate(graph) {
      const clients = typeNodes(graph, CLIENT_TYPES);
      const dbs = typeNodes(graph, DB_TYPES);
      if (clients.length === 0 || dbs.length === 0) return { applicable: false };
      const direct = [];
      for (const c of clients) {
        for (const db of dbs) {
          if (hasEdge(graph, c.id, db.id)) direct.push(`${c.name} → ${db.name}`);
        }
      }
      return direct.length === 0
        ? { applicable: true, ok: true, message: 'No client talks to a database directly.' }
        : { applicable: true, ok: false, message: `Direct client-to-database arrows: ${direct.join('; ')}.` };
    },
  },
  {
    id: 'no-lambda-chaining',
    why: 'A Lambda synchronously invoking another Lambda couples their scaling and '
      + 'failure modes and double-bills the wait; buffer with SQS or orchestrate with Step Functions.',
    evaluate(graph) {
      const lambdas = nodesOfType(graph, 'lambda');
      if (lambdas.length < 2) return { applicable: false };
      const chains = [];
      for (const a of lambdas) {
        for (const b of lambdas) {
          if (a.id !== b.id && hasEdge(graph, a.id, b.id)) chains.push(`${a.name} → ${b.name}`);
        }
      }
      return chains.length === 0
        ? { applicable: true, ok: true, message: 'No Lambda invokes another Lambda directly.' }
        : { applicable: true, ok: false, message: `Lambda-to-Lambda arrows: ${chains.join('; ')}.` };
    },
  },
  {
    id: 'no-orphan-nodes',
    why: 'A service with no arrows does nothing but cost money and confuse the '
      + 'next reader — wire it into a flow or remove it.',
    evaluate(graph) {
      if (graph.nodes.length === 0) return { applicable: false };
      const touched = new Set();
      for (const e of graph.edges) { touched.add(e.from); touched.add(e.to); }
      const orphans = graph.nodes.filter((n) => !touched.has(n.id));
      return orphans.length === 0
        ? { applicable: true, ok: true, message: 'Every service participates in a flow.' }
        : { applicable: true, ok: false, message: `Unconnected: ${orphans.map((n) => n.name).join(', ')}.` };
    },
  },
];

export const BEST_PRACTICE_RULE_IDS = BEST_PRACTICE_RULES.map((r) => r.id);

export function evaluateBestPractices(graph, ruleIds = 'all') {
  const selected = ruleIds === 'all'
    ? BEST_PRACTICE_RULES
    : BEST_PRACTICE_RULES.filter((r) => ruleIds.includes(r.id));
  return selected.map((rule) => {
    const result = rule.evaluate(graph);
    return {
      ruleId: rule.id,
      applicable: result.applicable,
      ok: result.applicable ? result.ok : true,
      message: result.applicable ? result.message : 'Not applicable to this design.',
      why: rule.why,
    };
  });
}
