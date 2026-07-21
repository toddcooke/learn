// aws/js/lib/cfnCompile.js
//
// CloudFormation-YAML → arch-model compiler for the Architecture
// Challenge. compile() is TOTAL: any input text yields { arch, diagnostics,
// sourceMap, idMap, kinds } and never throws — the editor calls it on every
// keystroke. Diagnostics carry exact text offsets from the yaml AST so the
// editor can squiggle them. arch is produced only when no error-severity
// diagnostic exists (warnings/infos don't block); structural review beyond
// compilation (overlaps, subnet spreads, …) stays in archValidate at Check
// time, exactly as before.

import { parseDocument, visit, isMap, isSeq, isScalar } from '../vendor/yaml.js';
import { parseCidrStrict } from './vpcMath.js';
import {
  createArch, addSubnet, addNat, addRouteTable, addRoute, associateSubnet,
  addSecurityGroup, addSgRule, addWorkload,
} from './archModel.js';
import {
  RESOURCE_TYPES, RESOURCE_ATTRIBUTES, KNOWN_UNSUPPORTED, ENGINE_DEFAULT_PORTS, KIND_LABELS,
} from './cfnSchema.js';

// !Ref / !GetAtt short forms parse as tagged nodes; registering them stops
// the yaml lib from warning "unresolved tag" while keeping node.tag
// readable. Every OTHER tag is rejected by the visit() sweep below.
const CFN_TAGS = [
  { tag: '!Ref', resolve: (s) => s },
  { tag: '!GetAtt', resolve: (s) => s },
  { tag: '!GetAtt', collection: 'seq', resolve: (s) => s },
];

const IGNORED_SECTIONS = ['Parameters', 'Mappings', 'Conditions', 'Outputs', 'Metadata', 'Rules', 'Transform'];
const AZ_RE = /^[a-z]{2}(-[a-z]+)+-\d[a-z]$/;

export function compile(text) {
  const diagnostics = [];
  const diag = (severity, node, message) => {
    const range = node && node.range ? [node.range[0], node.range[1]] : [0, Math.min(1, text.length)];
    diagnostics.push({ from: range[0], to: range[1], severity, message });
  };
  const dedupe = (list) => {
    // Dedupe diagnostics by (from, to, severity, message); preserve first-occurrence order.
    // Enum validation (e.g. ALB Scheme, RDS Engine) runs both generically and explicitly,
    // producing byte-identical errors twice.
    const seen = new Set();
    return list.filter((d) => {
      const key = `${d.from}:${d.to}:${d.severity}:${d.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const fail = (sourceMap, kinds) => ({ arch: null, diagnostics: dedupe(diagnostics), sourceMap, idMap: null, kinds });

  const doc = parseDocument(text, { customTags: CFN_TAGS, prettyErrors: false });
  for (const e of doc.errors) {
    const from = e.pos && Number.isInteger(e.pos[0]) ? e.pos[0] : 0;
    const to = e.pos && Number.isInteger(e.pos[1]) && e.pos[1] > from ? e.pos[1] : Math.min(text.length, from + 1);
    diagnostics.push({ from, to, severity: 'error', message: e.message.split('\n')[0] });
  }
  // Reject every intrinsic beyond !Ref/!GetAtt wherever it appears.
  visit(doc, (key, node) => {
    if (node && node.tag && node.tag !== '!Ref' && node.tag !== '!GetAtt') {
      diag('error', node, `The ${node.tag} intrinsic is not supported by this simulator.`);
    }
  });

  const root = doc.contents;
  if (!isMap(root)) {
    diag('error', root, 'The template must be a YAML mapping with a Resources section.');
    return fail({}, {});
  }

  let resourcesNode = null;
  for (const pair of root.items) {
    const keyName = isScalar(pair.key) ? String(pair.key.value) : '';
    if (keyName === 'Resources') resourcesNode = pair.value;
    else if (IGNORED_SECTIONS.includes(keyName)) diag('info', pair.key, `${keyName} is ignored by this simulator.`);
    else if (keyName !== 'AWSTemplateFormatVersion' && keyName !== 'Description') {
      diag('warning', pair.key, `Unknown top-level section "${keyName}".`);
    }
  }
  if (!isMap(resourcesNode) || resourcesNode.items.length === 0) {
    diag('error', resourcesNode || root, 'The template needs a Resources section with at least one resource.');
    return fail({}, {});
  }

  // ---- Pass 1: collect resources, kinds, and the source map ----
  const rangeOf = (node) => (node && node.range ? [node.range[0], node.range[1]] : [0, Math.min(1, text.length)]);
  const resources = []; // { id, typeName, spec, keyNode, propsNode }
  const kinds = {};      // logicalId -> display kind (workloads: ec2|alb|rds)
  const schemaKinds = {}; // logicalId -> schema kind (workloads: 'workload')
  const sourceMap = {};
  for (const pair of resourcesNode.items) {
    const keyNode = pair.key;
    const id = isScalar(keyNode) ? String(keyNode.value) : null;
    if (!id) { diag('error', keyNode || resourcesNode, 'Resource logical ids must be plain strings.'); continue; }
    const body = pair.value;
    if (!isMap(body)) { diag('error', keyNode, `Resource "${id}" must be a mapping with a Type.`); continue; }
    for (const p of body.items) {
      const k = isScalar(p.key) ? String(p.key.value) : '';
      if (!RESOURCE_ATTRIBUTES.includes(k)) diag('warning', p.key, `Unknown resource attribute "${k}".`);
    }
    const typePair = body.items.find((p) => isScalar(p.key) && p.key.value === 'Type');
    if (!typePair || !isScalar(typePair.value)) { diag('error', keyNode, `Resource "${id}" has no Type.`); continue; }
    const typeName = String(typePair.value.value);
    const spec = RESOURCE_TYPES[typeName];
    if (!spec) {
      if (KNOWN_UNSUPPORTED.includes(typeName)) {
        diag('warning', typePair.value, `${typeName} is real CloudFormation, but this simulator does not support it; the resource is ignored. Supported types: ${Object.keys(RESOURCE_TYPES).join(', ')}.`);
      } else {
        diag('error', typePair.value, `Unknown CloudFormation resource type: ${typeName}`);
      }
      continue;
    }
    const propsPair = body.items.find((p) => isScalar(p.key) && p.key.value === 'Properties');
    let propsNode = null;
    // `Properties:` with nothing after it parses to a Scalar node wrapping
    // JS null, not JS null itself — so it's excluded here the same as an
    // absent Properties key (no value supplied yet is not a mapping error,
    // just no properties to check).
    const propsIsEmptyScalar = propsPair && isScalar(propsPair.value) && propsPair.value.value == null;
    if (propsPair && propsPair.value != null && !propsIsEmptyScalar) {
      if (isMap(propsPair.value)) propsNode = propsPair.value;
      else diag('error', propsPair.key, `Properties of "${id}" must be a mapping.`);
    }
    resources.push({ id, typeName, spec, keyNode, propsNode });
    kinds[id] = spec.workloadType || spec.kind;
    schemaKinds[id] = spec.kind;
    sourceMap[id] = { key: rangeOf(keyNode), type: rangeOf(typePair.value), props: {} };
    if (propsNode) {
      for (const p of propsNode.items) {
        if (isScalar(p.key)) sourceMap[id].props[String(p.key.value)] = rangeOf(p.value || p.key);
      }
    }
  }

  // Per-type maximums (one VPC, one IGW, one attachment), plus the
  // must-have-a-VPC rule.
  for (const [typeName, spec] of Object.entries(RESOURCE_TYPES)) {
    if (!spec.max) continue;
    for (const extra of resources.filter((r) => r.typeName === typeName).slice(spec.max)) {
      diag('error', extra.keyNode, `Only ${spec.max} ${typeName} is supported per template.`);
    }
  }
  const byKind = (k) => resources.filter((r) => r.spec.kind === k);
  if (byKind('vpc').length === 0) {
    diag('error', resourcesNode, 'The template must contain exactly one AWS::EC2::VPC resource.');
  }

  // ---- Pass 2: property presence + shared value helpers ----
  const props = new Map(); // resource -> Map(propName -> value node)
  for (const r of resources) {
    const map = new Map();
    if (r.propsNode) {
      for (const p of r.propsNode.items) {
        if (!isScalar(p.key)) continue;
        const name = String(p.key.value);
        if (!r.spec.props[name]) diag('warning', p.key, `Unknown property "${name}" for ${r.typeName}.`);
        else map.set(name, p.value);
      }
    }
    for (const [name, ps] of Object.entries(r.spec.props)) {
      if (ps.required && !map.has(name)) diag('error', r.keyNode, `Missing required property "${name}" for ${r.typeName}.`);
    }
    props.set(r, map);
  }
  const get = (r, name) => props.get(r).get(name);

  const scalarValue = (node) => (isScalar(node) ? node.value : undefined);
  const refTarget = (node) => {
    if (isScalar(node) && node.tag === '!Ref') return String(node.value);
    if (isMap(node) && node.items.length === 1) {
      const p = node.items[0];
      if (isScalar(p.key) && p.key.value === 'Ref' && isScalar(p.value)) return String(p.value.value);
    }
    return null;
  };
  const getAttTarget = (node) => {
    if (isScalar(node) && node.tag === '!GetAtt') {
      const parts = String(node.value).split('.');
      return parts.length >= 2 ? { id: parts[0], attr: parts.slice(1).join('.') } : null;
    }
    if (isSeq(node) && node.tag === '!GetAtt' && node.items.length === 2) {
      return { id: String(scalarValue(node.items[0])), attr: String(scalarValue(node.items[1])) };
    }
    if (isMap(node) && node.items.length === 1) {
      const p = node.items[0];
      if (isScalar(p.key) && p.key.value === 'Fn::GetAtt' && isSeq(p.value) && p.value.items.length === 2) {
        return { id: String(scalarValue(p.value.items[0])), attr: String(scalarValue(p.value.items[1])) };
      }
    }
    return null;
  };
  // The expected-kind label keeps its article ("a VPC", "a subnet"), so the
  // wrong-kind message reads: Expected a reference to a VPC, but "X" is a
  // subnet. — the compile tests assert this exact shape.
  const checkRef = (node, expectedKind) => {
    const name = refTarget(node);
    if (name === null) { diag('error', node, `Expected a !Ref to ${KIND_LABELS[expectedKind]}.`); return null; }
    if (!(name in schemaKinds)) { diag('error', node, `"${name}" does not refer to a resource in this template.`); return null; }
    if (schemaKinds[name] !== expectedKind) {
      diag('error', node, `Expected a reference to ${KIND_LABELS[expectedKind]}, but "${name}" is ${KIND_LABELS[schemaKinds[name]]}.`);
      return null;
    }
    return name;
  };
  const cidrOf = (node) => {
    const v = scalarValue(node);
    if (typeof v !== 'string' || !parseCidrStrict(v)) { diag('error', node, `"${v}" is not a valid IPv4 CIDR block.`); return null; }
    return v;
  };
  const azLetter = (node) => {
    const v = scalarValue(node);
    if (typeof v !== 'string' || !AZ_RE.test(v)) {
      diag('error', node, `"${v}" is not an availability zone name (e.g. us-east-1a).`);
      return null;
    }
    const letter = v.slice(-1);
    if (!['a', 'b', 'c'].includes(letter)) {
      diag('error', node, 'AvailabilityZone must end in a, b, or c — this simulator models three AZs.');
      return null;
    }
    return letter;
  };
  const boolOf = (node) => {
    const v = scalarValue(node);
    if (v === true || v === 'true') return true;
    if (v === false || v === 'false' || v === undefined) return false;
    diag('error', node, `Expected true or false, got "${v}".`);
    return false;
  };
  const portOf = (node) => {
    const v = Number(scalarValue(node));
    if (!Number.isInteger(v) || v < 0 || v > 65535) { diag('error', node, `"${scalarValue(node)}" is not a valid port (0–65535).`); return null; }
    return v;
  };
  const enumOf = (node, values) => {
    const v = scalarValue(node);
    if (v === undefined) return null;
    const s = String(v);
    if (!values.includes(s)) { diag('error', node, `Expected one of: ${values.join(', ')}.`); return null; }
    return s;
  };
  const tagsOf = (node) => {
    const out = {};
    if (!node) return out;
    if (!isSeq(node)) { diag('error', node, 'Tags must be a list of { Key, Value } entries.'); return out; }
    for (const item of node.items) {
      if (!isMap(item)) { diag('error', item, 'Each tag must be a { Key, Value } mapping.'); continue; }
      let key; let value;
      for (const p of item.items) {
        const k = isScalar(p.key) ? p.key.value : '';
        if (k === 'Key') key = scalarValue(p.value);
        else if (k === 'Value') value = scalarValue(p.value);
      }
      if (typeof key !== 'string' || value === undefined) { diag('error', item, 'Each tag needs both Key and Value.'); continue; }
      out[key] = String(value);
    }
    return out;
  };
  // Generic enum validation for props not consumed via enumOf below.
  for (const r of resources) {
    for (const [name, node] of props.get(r)) {
      const ps = r.spec.props[name];
      if (!ps.ignored && ps.enum) enumOf(node, ps.enum);
    }
  }

  // ---- Pass 3: build the model. checkRef records errors and returns null,
  // so broken pieces are simply skipped — the trailing hasErrors gate nulls
  // the arch anyway. ----
  const arch = createArch();
  const modelToLogical = {};
  const logicalToModel = {};
  const link = (logicalId, modelId) => { modelToLogical[modelId] = logicalId; logicalToModel[logicalId] = modelId; };

  const vpcRes = byKind('vpc')[0];
  if (vpcRes) {
    const cidrNode = get(vpcRes, 'CidrBlock');
    const cidr = cidrNode ? cidrOf(cidrNode) : null;
    if (cidr) arch.vpc.cidr = cidr;
    link(vpcRes.id, 'vpc');
  }

  const subnetPublicIp = new Map(); // model subnet id -> MapPublicIpOnLaunch
  for (const r of byKind('subnet')) {
    if (get(r, 'VpcId')) checkRef(get(r, 'VpcId'), 'vpc');
    const az = get(r, 'AvailabilityZone') ? azLetter(get(r, 'AvailabilityZone')) : null;
    const cidr = get(r, 'CidrBlock') ? cidrOf(get(r, 'CidrBlock')) : null;
    const tags = tagsOf(get(r, 'Tags'));
    const subnet = addSubnet(arch, { name: tags.Name || r.id, az: az || 'a', cidr: cidr || '' });
    subnetPublicIp.set(subnet.id, get(r, 'MapPublicIpOnLaunch') ? boolOf(get(r, 'MapPublicIpOnLaunch')) : false);
    link(r.id, subnet.id);
  }

  const igwRes = byKind('igw')[0];
  if (igwRes) link(igwRes.id, 'igw');
  for (const r of byKind('igwAttachment')) {
    const vpcOk = get(r, 'VpcId') ? checkRef(get(r, 'VpcId'), 'vpc') : null;
    const igwOk = get(r, 'InternetGatewayId') ? checkRef(get(r, 'InternetGatewayId'), 'igw') : null;
    if (vpcOk && igwOk) arch.vpc.igwAttached = true;
  }

  for (const r of byKind('nat')) {
    const subnetLogical = get(r, 'SubnetId') ? checkRef(get(r, 'SubnetId'), 'subnet') : null;
    const alloc = get(r, 'AllocationId');
    if (alloc) {
      const target = getAttTarget(alloc);
      if (!target) diag('error', alloc, 'AllocationId must be !GetAtt <EIP logical id>.AllocationId.');
      else if (!(target.id in schemaKinds)) diag('error', alloc, `"${target.id}" does not refer to a resource in this template.`);
      else if (schemaKinds[target.id] !== 'eip' || target.attr !== 'AllocationId') {
        diag('error', alloc, 'AllocationId must be !GetAtt <EIP logical id>.AllocationId.');
      }
    }
    const nat = addNat(arch, subnetLogical ? logicalToModel[subnetLogical] : null);
    link(r.id, nat.id);
  }

  for (const r of byKind('rtb')) {
    if (get(r, 'VpcId')) checkRef(get(r, 'VpcId'), 'vpc');
    const tags = tagsOf(get(r, 'Tags'));
    const rt = addRouteTable(arch, tags.Name || r.id);
    link(r.id, rt.id);
  }

  for (const r of byKind('route')) {
    const rtbLogical = get(r, 'RouteTableId') ? checkRef(get(r, 'RouteTableId'), 'rtb') : null;
    const dest = get(r, 'DestinationCidrBlock') ? cidrOf(get(r, 'DestinationCidrBlock')) : null;
    const gw = get(r, 'GatewayId');
    const natRef = get(r, 'NatGatewayId');
    if ((gw ? 1 : 0) + (natRef ? 1 : 0) !== 1) {
      diag('error', r.keyNode, 'A route needs exactly one target: GatewayId or NatGatewayId.');
      continue;
    }
    let target = null;
    if (gw) { if (checkRef(gw, 'igw')) target = 'igw'; }
    else { const t = checkRef(natRef, 'nat'); if (t) target = `nat:${logicalToModel[t]}`; }
    if (rtbLogical && dest && target) addRoute(arch, logicalToModel[rtbLogical], { destCidr: dest, target });
  }

  const associated = new Set();
  for (const r of byKind('assoc')) {
    const subnetLogical = get(r, 'SubnetId') ? checkRef(get(r, 'SubnetId'), 'subnet') : null;
    const rtbLogical = get(r, 'RouteTableId') ? checkRef(get(r, 'RouteTableId'), 'rtb') : null;
    if (!subnetLogical || !rtbLogical) continue;
    if (associated.has(subnetLogical)) {
      diag('error', r.keyNode, `Subnet "${subnetLogical}" already has a route table association; AWS allows exactly one.`);
      continue;
    }
    associated.add(subnetLogical);
    associateSubnet(arch, logicalToModel[rtbLogical], logicalToModel[subnetLogical]);
  }

  for (const r of byKind('sg')) {
    if (get(r, 'VpcId')) checkRef(get(r, 'VpcId'), 'vpc');
    const nameNode = get(r, 'GroupName');
    const sg = addSecurityGroup(arch, nameNode !== undefined ? String(scalarValue(nameNode)) : r.id);
    link(r.id, sg.id);
  }
  // Rules resolve AFTER every SG exists — a rule may reference any of them.
  for (const r of byKind('sg')) {
    const ingress = get(r, 'SecurityGroupIngress');
    if (ingress === undefined) continue;
    if (!isSeq(ingress)) { diag('error', ingress, 'SecurityGroupIngress must be a list of rule mappings.'); continue; }
    for (const ruleNode of ingress.items) {
      if (!isMap(ruleNode)) { diag('error', ruleNode, 'Each ingress rule must be a mapping.'); continue; }
      const ruleProp = (n) => {
        const p = ruleNode.items.find((q) => isScalar(q.key) && q.key.value === n);
        return p ? p.value : undefined;
      };
      for (const q of ruleNode.items) {
        const k = isScalar(q.key) ? String(q.key.value) : '';
        if (!['IpProtocol', 'FromPort', 'ToPort', 'CidrIp', 'SourceSecurityGroupId', 'Description'].includes(k)) {
          diag('warning', q.key, `Unknown ingress rule property "${k}".`);
        }
      }
      const protoNode = ruleProp('IpProtocol');
      if (protoNode === undefined) { diag('error', ruleNode, 'Ingress rules need an IpProtocol (tcp, udp, icmp, or -1).'); continue; }
      const proto = enumOf(protoNode, ['tcp', 'udp', 'icmp', '-1']);
      if (proto === null) continue;
      const cidrNode = ruleProp('CidrIp');
      const sgRefNode = ruleProp('SourceSecurityGroupId');
      if ((cidrNode !== undefined ? 1 : 0) + (sgRefNode !== undefined ? 1 : 0) !== 1) {
        diag('error', ruleNode, 'Each ingress rule needs exactly one source: CidrIp or SourceSecurityGroupId.');
        continue;
      }
      let source = null;
      if (cidrNode !== undefined) { const c = cidrOf(cidrNode); if (c) source = c; }
      else { const t = checkRef(sgRefNode, 'sg'); if (t) source = `sg:${logicalToModel[t]}`; }
      let modelProto = proto;
      let portFrom = 0;
      let portTo = 65535;
      if (proto === '-1') modelProto = 'all';
      else if (proto === 'tcp' || proto === 'udp') {
        const fromNode = ruleProp('FromPort');
        const toNode = ruleProp('ToPort');
        if (fromNode === undefined || toNode === undefined) { diag('error', ruleNode, 'tcp/udp rules need FromPort and ToPort.'); continue; }
        const f = portOf(fromNode);
        const t2 = portOf(toNode);
        if (f === null || t2 === null) continue;
        portFrom = f;
        portTo = t2;
      }
      if (source) addSgRule(arch, logicalToModel[r.id], { proto: modelProto, portFrom, portTo, source });
    }
  }

  const dbGroupSubnets = {}; // logicalId -> [model subnet ids]
  for (const r of byKind('dbsubnetgroup')) {
    const listNode = get(r, 'SubnetIds');
    const ids = [];
    if (listNode !== undefined) {
      if (!isSeq(listNode)) diag('error', listNode, 'SubnetIds must be a list of subnet references.');
      else for (const item of listNode.items) { const t = checkRef(item, 'subnet'); if (t) ids.push(logicalToModel[t]); }
    }
    dbGroupSubnets[r.id] = ids;
  }

  const refListOf = (r, name, kind) => {
    const listNode = get(r, name);
    if (listNode === undefined) return [];
    if (!isSeq(listNode)) { diag('error', listNode, `${name} must be a list of references.`); return []; }
    const out = [];
    for (const item of listNode.items) { const t = checkRef(item, kind); if (t) out.push(logicalToModel[t]); }
    return out;
  };
  const nameRolePort = (r) => {
    const tags = tagsOf(get(r, 'Tags'));
    let port;
    if (tags.Port !== undefined) {
      port = Number(tags.Port);
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        diag('error', get(r, 'Tags'), `Port tag "${tags.Port}" is not a valid port.`);
        port = undefined;
      }
    }
    return { name: tags.Name || r.id, role: tags.Role || null, port };
  };

  for (const r of resources.filter((x) => x.spec.kind === 'workload')) {
    const { name, role, port } = nameRolePort(r);
    if (r.spec.workloadType === 'ec2') {
      const subnetLogical = get(r, 'SubnetId') ? checkRef(get(r, 'SubnetId'), 'subnet') : null;
      const modelSubnet = subnetLogical ? logicalToModel[subnetLogical] : null;
      const wl = addWorkload(arch, {
        type: 'ec2', name, role,
        subnetIds: modelSubnet ? [modelSubnet] : [],
        sgIds: refListOf(r, 'SecurityGroupIds', 'sg'),
        publicIp: modelSubnet ? subnetPublicIp.get(modelSubnet) === true : false,
        port,
      });
      link(r.id, wl.id);
    } else if (r.spec.workloadType === 'alb') {
      const scheme = get(r, 'Scheme') !== undefined ? enumOf(get(r, 'Scheme'), ['internet-facing', 'internal']) : 'internet-facing';
      const wl = addWorkload(arch, {
        type: 'alb', name, role,
        subnetIds: refListOf(r, 'Subnets', 'subnet'),
        sgIds: refListOf(r, 'SecurityGroups', 'sg'),
        publicIp: scheme !== 'internal',
        port,
      });
      link(r.id, wl.id);
    } else { // rds
      const engineNode = get(r, 'Engine');
      const engine = engineNode !== undefined ? enumOf(engineNode, Object.keys(ENGINE_DEFAULT_PORTS)) : null;
      const groupLogical = get(r, 'DBSubnetGroupName') ? checkRef(get(r, 'DBSubnetGroupName'), 'dbsubnetgroup') : null;
      const explicitPort = get(r, 'Port') !== undefined ? portOf(get(r, 'Port')) : null;
      const wl = addWorkload(arch, {
        type: 'rds', name, role,
        subnetIds: groupLogical ? dbGroupSubnets[groupLogical] : [],
        sgIds: refListOf(r, 'VPCSecurityGroups', 'sg'),
        publicIp: false,
        multiAz: get(r, 'MultiAZ') !== undefined ? boolOf(get(r, 'MultiAZ')) : false,
        port: explicitPort ?? port ?? (engine ? ENGINE_DEFAULT_PORTS[engine] : undefined),
      });
      link(r.id, wl.id);
    }
  }

  const hasErrors = diagnostics.some((d) => d.severity === 'error');
  return {
    arch: hasErrors ? null : arch,
    diagnostics: dedupe(diagnostics),
    sourceMap,
    idMap: hasErrors ? null : { modelToLogical, logicalToModel },
    kinds,
  };
}
