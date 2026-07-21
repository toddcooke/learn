import test from 'node:test';
import assert from 'node:assert/strict';
import { emit } from './cfnEmit.js';
import { compile } from './cfnCompile.js';
import {
  createArch, getSubnet, effectiveRouteTable, getSecurityGroup, addSubnet, addSecurityGroup, addWorkload, addRouteTable, associateSubnet,
} from './archModel.js';
import { validateStructure } from './archValidate.js';
import { evaluateGoals } from './archGoals.js';
import { ARCH_CHALLENGES } from '../data/archChallenges.js';

// Normalized, id-free projection of a model so emit→compile equivalence can
// be asserted across differing generated ids.
function fingerprint(arch) {
  const subnetName = (id) => getSubnet(arch, id)?.name || '?';
  const sgName = (id) => getSecurityGroup(arch, id)?.name || '?';
  const natSubnet = (natId) => {
    const nat = arch.natGateways.find((n) => n.id === natId);
    return nat ? subnetName(nat.subnetId) : '?';
  };
  const routeKey = (r) => (r.target === 'igw' ? `${r.destCidr}→igw` : `${r.destCidr}→nat@${natSubnet(r.target.slice(4))}`);
  const sourceKey = (s) => (s.startsWith('sg:') ? `sg:${sgName(s.slice(3))}` : s);
  return {
    vpc: { cidr: arch.vpc.cidr, igwAttached: arch.vpc.igwAttached },
    subnets: arch.subnets.map((s) => ({ name: s.name, az: s.az, cidr: s.cidr }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    nats: arch.natGateways.map((n) => subnetName(n.subnetId)).sort(),
    routing: arch.subnets.map((s) => ({
      subnet: s.name,
      routes: (effectiveRouteTable(arch, s.id)?.routes || []).map(routeKey).sort(),
    })).sort((a, b) => a.subnet.localeCompare(b.subnet)),
    sgs: arch.securityGroups.map((g) => ({
      name: g.name,
      rules: g.inbound.map((r) => `${r.proto}:${r.portFrom}-${r.portTo}<${sourceKey(r.source)}`).sort(),
    })).sort((a, b) => a.name.localeCompare(b.name)),
    workloads: arch.workloads.map((w) => ({
      type: w.type,
      name: w.name,
      role: w.role,
      port: w.port,
      publicIp: w.publicIp,
      multiAz: !!w.multiAz,
      subnets: w.subnetIds.map(subnetName).sort(),
      sgs: w.sgIds.map(sgName).sort(),
    })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

test('emit(createArch()) is a valid skeleton template', () => {
  const text = emit(createArch());
  const r = compile(text);
  assert.deepEqual(r.diagnostics.filter((d) => d.severity === 'error'), []);
  assert.equal(r.arch.vpc.cidr, '10.0.0.0/16');
  assert.equal(r.arch.vpc.igwAttached, false);
});

test('emit is deterministic', () => {
  const arch = ARCH_CHALLENGES[0].refSolution();
  assert.equal(emit(arch), emit(arch));
});

for (const ch of ARCH_CHALLENGES) {
  test(`round-trip: ${ch.id} start state and reference solution survive emit→compile`, () => {
    for (const build of [ch.startState, ch.refSolution].filter(Boolean)) {
      const model = build();
      const r = compile(emit(model));
      assert.deepEqual(r.diagnostics.filter((d) => d.severity === 'error'), [],
        `${ch.id}: ${emit(model)}`);
      assert.deepEqual(fingerprint(r.arch), fingerprint(model));
    }
  });
  if (ch.refSolution && ch.goals.length > 0) {
    test(`compiled reference solution passes its own goals: ${ch.id}`, () => {
      const compiled = compile(emit(ch.refSolution())).arch;
      assert.ok(compiled);
      assert.deepEqual(validateStructure(compiled).errors, []);
      const rows = evaluateGoals(compiled, ch);
      for (const row of rows) assert.ok(row.ok, `${ch.id}: ${row.label} — ${row.detail}`);
    });
  }
}

test('routes on the implicit main table materialize as an explicit table', () => {
  const model = ARCH_CHALLENGES.find((c) => c.id === 'private-egress').refSolution();
  const text = emit(model);
  assert.match(text, /MainRouteTable:/);
  const compiled = compile(text).arch;
  const main = compiled.routeTables.find((t) => t.isMain);
  assert.deepEqual(main.routes, [], 'the compiled implicit main stays local-only');
  const priv = compiled.subnets.find((s) => s.name === 'private-a');
  const rt = effectiveRouteTable(compiled, priv.id);
  assert.equal(rt.isMain, false);
  assert.equal(rt.routes.length, 1);
  assert.match(rt.routes[0].target, /^nat:/);
});

test('non-default ports emit as a Port tag and compile back', () => {
  const model = ARCH_CHALLENGES.find((c) => c.id === 'ha-web').refSolution();
  const text = emit(model);
  assert.match(text, /Key: Port/);
  const compiled = compile(text).arch;
  const alb = compiled.workloads.find((w) => w.type === 'alb');
  assert.equal(alb.port, 443);
});

test('free-text names with YAML-significant characters survive the round trip', () => {
  const arch = createArch();
  arch.vpc.igwAttached = false;
  const s = addSubnet(arch, { name: 'a: b', az: 'a', cidr: '10.0.1.0/24' });
  const sg = addSecurityGroup(arch, "web: sg 'quoted'");
  addWorkload(arch, { type: 'ec2', name: 'web #1', subnetIds: [s.id], sgIds: [sg.id] });
  const rt = addRouteTable(arch, 'web: a-rt');
  associateSubnet(arch, rt.id, s.id);
  const r = compile(emit(arch));
  assert.deepEqual(r.diagnostics.filter((d) => d.severity === 'error'), [], emit(arch));
  assert.equal(r.arch.subnets[0].name, 'a: b');
  assert.equal(r.arch.securityGroups[0].name, "web: sg 'quoted'");
  assert.equal(r.arch.workloads[0].name, 'web #1');
  assert.equal(r.arch.routeTables.find((t) => !t.isMain).name, 'web: a-rt');
});
