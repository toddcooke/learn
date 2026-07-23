// aws/js/lib/svcGoals.js
//
// Turns a challenge's declarative goal list into evaluated results. Each
// row: { goal, label, ok, detail, traces } — the same shape the task
// panel rendered for the VPC-era game, so trace <details> blocks work
// unchanged. Selector semantics: edge/linked/path/fanout goals are
// EXISTENTIAL (some matching pair suffices); noEdge is UNIVERSAL (no
// matching pair may connect). A goal whose selector matches nothing fails
// with an "add it / assign the role" detail — except noEdge, where an
// empty selector trivially exposes nothing.

import { serviceLabel } from './svcCatalog.js';
import { selectNodes, hasEdge, outgoing } from './svcModel.js';
import { findFlow } from './svcFlow.js';

export const GOAL_TYPES = ['exists', 'edge', 'linked', 'noEdge', 'path', 'fanout'];

function roleLabel(challenge, roleId) {
  const role = challenge.roles.find((r) => r.id === roleId);
  return role ? role.label : roleId;
}

// "the CloudFront distribution" / "the resizer function" — selector as prose.
function selText(challenge, sel) {
  if (sel && typeof sel.service === 'string') return serviceLabel(sel.service);
  if (sel && typeof sel.role === 'string') return `the ${roleLabel(challenge, sel.role)}`;
  return 'an unknown selector';
}

function emptySelDetail(challenge, sel) {
  if (sel && typeof sel.role === 'string') {
    return `No service is assigned the role "${roleLabel(challenge, sel.role)}" — add it and set its Role.`;
  }
  return `Add ${selText(challenge, sel)} to the diagram.`;
}

function nodeNames(nodes) {
  return nodes.map((n) => n.name).join(', ');
}

export function evaluateGoals(graph, challenge) {
  return challenge.goals.map((goal) => evaluateGoal(graph, challenge, goal));
}

function evaluateGoal(graph, challenge, goal) {
  const st = (sel) => selText(challenge, sel);
  switch (goal.type) {
    case 'exists': {
      const min = goal.min ?? 1;
      const wantType = goal.service;
      const label = goal.sel.role !== undefined
        ? `The diagram includes ${st(goal.sel)}${wantType ? ` (${serviceLabel(wantType)})` : ''}`
        : `The diagram includes ${min > 1 ? `at least ${min} × ` : ''}${st(goal.sel)}`;
      const members = selectNodes(graph, goal.sel);
      if (members.length === 0) {
        return { goal, label, ok: false, detail: emptySelDetail(challenge, goal.sel), traces: [] };
      }
      if (members.length < min) {
        return { goal, label, ok: false, detail: `Only ${members.length} of ${min} exist (${nodeNames(members)}).`, traces: [] };
      }
      const wrong = wantType ? members.filter((n) => n.type !== wantType) : [];
      return wrong.length === 0
        ? { goal, label, ok: true, detail: `${nodeNames(members)} fills it.`, traces: [] }
        : { goal, label, ok: false, detail: `${nodeNames(wrong)} is not ${serviceLabel(wantType)}.`, traces: [] };
    }
    case 'edge': {
      const label = `${st(goal.from)} connects directly to ${st(goal.to)}${goal.note ? ` (${goal.note})` : ''}`;
      const from = selectNodes(graph, goal.from);
      const to = selectNodes(graph, goal.to);
      if (from.length === 0) return { goal, label, ok: false, detail: emptySelDetail(challenge, goal.from), traces: [] };
      if (to.length === 0) return { goal, label, ok: false, detail: emptySelDetail(challenge, goal.to), traces: [] };
      const hit = from.find((f) => to.some((t) => hasEdge(graph, f.id, t.id)));
      return hit
        ? { goal, label, ok: true, detail: 'Connected.', traces: [] }
        : { goal, label, ok: false, detail: `Draw an arrow from ${nodeNames(from)} to ${nodeNames(to)}.`, traces: [] };
    }
    case 'linked': {
      const label = `${st(goal.a)} and ${st(goal.b)} are linked${goal.note ? ` (${goal.note})` : ''}`;
      const a = selectNodes(graph, goal.a);
      const b = selectNodes(graph, goal.b);
      if (a.length === 0) return { goal, label, ok: false, detail: emptySelDetail(challenge, goal.a), traces: [] };
      if (b.length === 0) return { goal, label, ok: false, detail: emptySelDetail(challenge, goal.b), traces: [] };
      const hit = a.find((x) => b.some((y) => hasEdge(graph, x.id, y.id) || hasEdge(graph, y.id, x.id)));
      return hit
        ? { goal, label, ok: true, detail: 'Linked.', traces: [] }
        : { goal, label, ok: false, detail: `Draw an arrow between ${nodeNames(a)} and ${nodeNames(b)} (either direction).`, traces: [] };
    }
    case 'noEdge': {
      const label = `${st(goal.from)} must NOT connect directly to ${st(goal.to)}${goal.note ? ` (${goal.note})` : ''}`;
      const from = selectNodes(graph, goal.from);
      const to = selectNodes(graph, goal.to);
      const offenders = [];
      for (const f of from) {
        for (const t of to) {
          if (f.id !== t.id && hasEdge(graph, f.id, t.id)) offenders.push(`${f.name} → ${t.name}`);
        }
      }
      return offenders.length === 0
        ? { goal, label, ok: true, detail: 'No direct arrow — the flow goes through the right tier.', traces: [] }
        : { goal, label, ok: false, detail: `Remove the direct arrow: ${offenders.join('; ')}.`, traces: [] };
    }
    case 'path': {
      const via = goal.via ?? [];
      const viaText = via.length ? ` via ${via.map(st).join(', then ')}` : '';
      const label = `Data flows from ${st(goal.from)} to ${st(goal.to)}${viaText}${goal.note ? ` (${goal.note})` : ''}`;
      const res = findFlow(graph, goal.from, goal.to, via);
      if (res.ok) {
        const byId = new Map(graph.nodes.map((n) => [n.id, n]));
        const trace = res.hops.slice(1).map((id, i) => ({
          label: `${byId.get(res.hops[i]).name} → ${byId.get(id).name}`,
          ok: true,
        }));
        return {
          goal, label, ok: true, detail: 'The flow connects end to end.',
          traces: [{ title: `${st(goal.from)} → ${st(goal.to)}`, ok: true, trace }],
        };
      }
      if (res.missingStage !== undefined) {
        const stageSels = [goal.from, ...via, goal.to];
        return {
          goal, label, ok: false,
          detail: emptySelDetail(challenge, stageSels[res.missingStage]),
          traces: [],
        };
      }
      const byId = new Map(graph.nodes.map((n) => [n.id, n]));
      const stuckFrom = res.stuck ? byId.get(res.stuck.fromId) : null;
      const stuckTo = res.stuck ? byId.get(res.stuck.toId) : null;
      return {
        goal, label, ok: false,
        detail: stuckFrom
          ? `The flow dead-ends: no arrow path from ${stuckFrom.name} to ${stuckTo.name}.`
          : 'No arrow path connects the flow — draw the missing arrows.',
        traces: [],
      };
    }
    case 'fanout': {
      const label = `${st(goal.from)} fans out to at least ${goal.min} subscribers`;
      const members = selectNodes(graph, goal.from);
      if (members.length === 0) return { goal, label, ok: false, detail: emptySelDetail(challenge, goal.from), traces: [] };
      // A subscriber is a downstream target; an arrow back to a node that
      // publishes INTO this one is a request/response loop, not a
      // subscription, and must not count.
      const subscriberCount = (n) => outgoing(graph, n.id)
        .filter((e) => !hasEdge(graph, e.to, n.id)).length;
      const best = members.reduce(
        (top, n) => {
          const count = subscriberCount(n);
          return count > top.count ? { node: n, count } : top;
        },
        { node: members[0], count: subscriberCount(members[0]) },
      );
      return best.count >= goal.min
        ? { goal, label, ok: true, detail: `${best.node.name} pushes to ${best.count} subscribers.`, traces: [] }
        : { goal, label, ok: false, detail: `${best.node.name} has ${best.count} subscriber${best.count === 1 ? '' : 's'}; needs ${goal.min}. Arrows looping back to a publisher don't count.`, traces: [] };
    }
    default:
      return { goal, label: `Unknown goal type "${goal.type}"`, ok: false, detail: 'Unknown goal type.', traces: [] };
  }
}
