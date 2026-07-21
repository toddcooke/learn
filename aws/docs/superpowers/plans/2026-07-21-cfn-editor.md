# CloudFormation Editor Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Architecture Challenge's drag-and-drop editing with a CloudFormation-first workbench: a rich CodeMirror YAML editor on the left, a read-only live-rendered diagram plus the existing Task/Check panel on the right.

**Architecture:** Template text is the single source of truth. `lib/cfnCompile.js` (pure, node-tested) turns YAML into the existing arch model plus positioned diagnostics; `lib/cfnEmit.js` serializes any arch model back to canonical strict-CFN YAML (start states, reference solutions, legacy-draft migration). `cfn-editor.js` mounts vendored CodeMirror 6 with lint squiggles, hover docs, and schema-driven autocomplete; `arch-canvas.js` shrinks to a pure renderer. Validation/goals/best-practices (`archValidate`, `archGoals`) are unchanged and keep running on the compiled model.

**Tech Stack:** Vanilla ES modules (no build step at runtime), vendored CodeMirror 6 + eemeli/yaml v2 ESM bundles, `node --test` for all pure logic.

**Spec:** `aws/docs/superpowers/specs/2026-07-21-cfn-editor-design.md` (approved). Read it before starting any task.

## Global Constraints

- Static site, zero runtime build: everything loads as native ES modules. Vendored bundles are prebuilt files checked into `aws/js/vendor/`.
- All pure logic lives in `aws/js/lib/` with `node --test` coverage; DOM modules (`cfn-editor.js`, `arch-canvas.js`, `arch-challenge.js`) contain no model logic.
- `aws/js/lib/storage.js` and `aws/js/lib/storage.test.mjs` are drift-shared: any edit must be propagated to all 5 modules (`aws`, `networking`, `postgres`, `kubernetes`, `sre`) — `storage.js` byte-identical except its `NAMESPACE` line 1, the test byte-identical — and `node scripts/check-drift.mjs` must pass.
- Every interpolated string in generated HTML goes through `escapeHtml` (from `js/lib/html.js`).
- Exact diagnostic message for the marquee case (matches the design screenshot): `Unknown CloudFormation resource type: <Type>`.
- Run `node --test aws/js/lib/*.test.mjs aws/js/data/*.test.mjs` before every commit; all tests must pass.
- Commit messages: imperative first line, body optional, ending with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Comment style: explain constraints the code can't show (see existing files); no narration comments.

---

### Task 1: Vendor CodeMirror 6 and yaml bundles

**Files:**
- Create: `aws/js/vendor/codemirror.js` (prebuilt ESM bundle)
- Create: `aws/js/vendor/yaml.js` (prebuilt ESM bundle)
- Create: `aws/js/vendor/README.md`

**Interfaces:**
- Consumes: nothing in-repo.
- Produces: `aws/js/vendor/codemirror.js` re-exporting `EditorState, StateEffect, EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, hoverTooltip, defaultKeymap, history, historyKeymap, indentWithTab, indentOnInput, bracketMatching, syntaxHighlighting, HighlightStyle, indentUnit, linter, lintGutter, forceLinting, autocompletion, closeBrackets, completionKeymap, closeBracketsKeymap, searchKeymap, highlightSelectionMatches, yaml, tags`. `aws/js/vendor/yaml.js` re-exporting `parseDocument, visit, isMap, isSeq, isScalar, isPair, LineCounter`.

- [ ] **Step 1: Build the bundles in a scratch directory (one-time, offline artifact)**

Work in a temp dir OUTSIDE the repo (use the session scratchpad dir). Do not commit `node_modules` or `package.json` — only the two output files and the README enter the repo.

```bash
mkdir -p "$SCRATCH/vendor-build" && cd "$SCRATCH/vendor-build"
npm init -y
npm install esbuild @codemirror/state @codemirror/view @codemirror/commands \
  @codemirror/language @codemirror/lint @codemirror/autocomplete \
  @codemirror/search @codemirror/lang-yaml @lezer/highlight yaml
```

Create `cm-entry.js`:

```js
export { EditorState, StateEffect } from '@codemirror/state';
export {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, hoverTooltip,
} from '@codemirror/view';
export { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
export {
  indentOnInput, bracketMatching, syntaxHighlighting, HighlightStyle, indentUnit,
} from '@codemirror/language';
export { linter, lintGutter, forceLinting } from '@codemirror/lint';
export {
  autocompletion, closeBrackets, completionKeymap, closeBracketsKeymap,
} from '@codemirror/autocomplete';
export { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
export { yaml } from '@codemirror/lang-yaml';
export { tags } from '@lezer/highlight';
```

Create `yaml-entry.js`:

```js
export { parseDocument, visit, isMap, isSeq, isScalar, isPair, LineCounter } from 'yaml';
```

Build (minified keeps the checked-in blobs manageable):

```bash
npx esbuild cm-entry.js  --bundle --format=esm --minify --outfile=codemirror.js
npx esbuild yaml-entry.js --bundle --format=esm --minify --outfile=yaml.js
mkdir -p <repo>/aws/js/vendor
cp codemirror.js yaml.js <repo>/aws/js/vendor/
```

- [ ] **Step 2: Write `aws/js/vendor/README.md`**

Record the EXACT versions npm resolved (`npm ls --depth=0` in the build dir) — the versions below are placeholders to replace with real output:

```markdown
# Vendored bundles

Prebuilt ESM bundles; the site stays buildless at runtime. Rebuilt only by
re-running the command below and replacing these files wholesale.

## codemirror.js

- Entry re-exports (see repo history for `cm-entry.js`): state, view,
  commands, language, lint, autocomplete, search, lang-yaml, lezer/highlight.
- Versions: <paste `npm ls --depth=0` output>
- License: MIT (https://github.com/codemirror/dev)

## yaml.js

- Package: yaml (eemeli/yaml) <version>
- License: ISC (https://github.com/eemeli/yaml)

## Rebuild

    npm install esbuild @codemirror/state @codemirror/view @codemirror/commands \
      @codemirror/language @codemirror/lint @codemirror/autocomplete \
      @codemirror/search @codemirror/lang-yaml @lezer/highlight yaml
    npx esbuild cm-entry.js  --bundle --format=esm --minify --outfile=codemirror.js
    npx esbuild yaml-entry.js --bundle --format=esm --minify --outfile=yaml.js
```

- [ ] **Step 3: Smoke-test both bundles under node**

```bash
cd <repo>
node --input-type=module -e "
import { parseDocument } from './aws/js/vendor/yaml.js';
const d = parseDocument('a: 1');
console.log(d.toJS().a === 1 ? 'yaml OK' : 'yaml FAIL');
"
node --input-type=module -e "
import * as cm from './aws/js/vendor/codemirror.js';
console.log(typeof cm.EditorView === 'function' && typeof cm.linter === 'function' ? 'cm OK' : 'cm FAIL');
"
```

Expected: `yaml OK` and `cm OK`. If the CodeMirror import throws on a missing DOM global, note it, verify the file is non-empty valid ESM (`node --input-type=module -e "import('./aws/js/vendor/codemirror.js').catch(e => console.log('parse-level OK, DOM-only failure:', e.message))"`), and rely on Task 9's browser verification for functional proof.

- [ ] **Step 4: Commit**

```bash
git add aws/js/vendor/
git commit -m "Vendor CodeMirror 6 and yaml ESM bundles"
```

---

### Task 2: `cfnSchema.js` — resource catalog with docs

**Files:**
- Create: `aws/js/lib/cfnSchema.js`
- Create: `aws/js/lib/cfnSchema.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `RESOURCE_TYPES` (object keyed by CFN type name; each entry `{ kind, workloadType?, max?, doc, props }`; each prop spec `{ required?, check?, ref?, refList?, getAtt?, enum?, ignored?, doc? }` where `check ∈ 'cidr'|'az'|'bool'|'port'|'string'|'tags'|'ingress'`), `KNOWN_UNSUPPORTED` (string array), `ENGINE_DEFAULT_PORTS`, `KIND_LABELS`, `typeDoc(typeName)`, `propDoc(typeName, prop)`.

- [ ] **Step 1: Write the failing test** — `aws/js/lib/cfnSchema.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESOURCE_TYPES, KNOWN_UNSUPPORTED, ENGINE_DEFAULT_PORTS, KIND_LABELS,
  typeDoc, propDoc,
} from './cfnSchema.js';

test('every supported type has a kind, a doc, and prop specs', () => {
  for (const [name, spec] of Object.entries(RESOURCE_TYPES)) {
    assert.ok(spec.kind, `${name} kind`);
    assert.ok(typeof spec.doc === 'string' && spec.doc.length > 20, `${name} doc`);
    assert.ok(spec.props && typeof spec.props === 'object', `${name} props`);
    assert.ok(KIND_LABELS[spec.kind], `${name} kind label`);
  }
});

test('the 14 spec-mandated types are present', () => {
  const expected = [
    'AWS::EC2::VPC', 'AWS::EC2::Subnet', 'AWS::EC2::InternetGateway',
    'AWS::EC2::VPCGatewayAttachment', 'AWS::EC2::EIP', 'AWS::EC2::NatGateway',
    'AWS::EC2::RouteTable', 'AWS::EC2::Route', 'AWS::EC2::SubnetRouteTableAssociation',
    'AWS::EC2::SecurityGroup', 'AWS::EC2::Instance',
    'AWS::ElasticLoadBalancingV2::LoadBalancer',
    'AWS::RDS::DBSubnetGroup', 'AWS::RDS::DBInstance',
  ];
  for (const t of expected) assert.ok(RESOURCE_TYPES[t], t);
});

test('required properties match the strict-CFN spec decisions', () => {
  const req = (t) => Object.entries(RESOURCE_TYPES[t].props)
    .filter(([, p]) => p.required).map(([n]) => n).sort();
  assert.deepEqual(req('AWS::EC2::Subnet'), ['AvailabilityZone', 'CidrBlock', 'VpcId']);
  assert.deepEqual(req('AWS::EC2::NatGateway'), ['AllocationId', 'SubnetId']);
  assert.deepEqual(req('AWS::EC2::SecurityGroup'), ['GroupDescription', 'VpcId']);
  assert.deepEqual(req('AWS::EC2::Instance'), ['ImageId', 'SubnetId']);
  assert.deepEqual(req('AWS::RDS::DBInstance'), ['DBSubnetGroupName', 'Engine']);
});

test('ref-shaped props declare the kind they must point at', () => {
  assert.equal(RESOURCE_TYPES['AWS::EC2::Subnet'].props.VpcId.ref, 'vpc');
  assert.equal(RESOURCE_TYPES['AWS::EC2::Route'].props.NatGatewayId.ref, 'nat');
  assert.equal(RESOURCE_TYPES['AWS::EC2::Instance'].props.SecurityGroupIds.refList, 'sg');
  assert.deepEqual(RESOURCE_TYPES['AWS::EC2::NatGateway'].props.AllocationId.getAtt,
    { kind: 'eip', attr: 'AllocationId' });
});

test('engine default ports and doc lookups', () => {
  assert.equal(ENGINE_DEFAULT_PORTS.postgres, 5432);
  assert.equal(ENGINE_DEFAULT_PORTS.mysql, 3306);
  assert.ok(typeDoc('AWS::EC2::VPC').length > 20);
  assert.equal(typeDoc('AWS::EC2::Instanc'), null);
  assert.ok(propDoc('AWS::EC2::Subnet', 'MapPublicIpOnLaunch').length > 20);
  assert.equal(propDoc('AWS::EC2::Subnet', 'Nope'), null);
  assert.ok(KNOWN_UNSUPPORTED.includes('AWS::S3::Bucket'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test aws/js/lib/cfnSchema.test.mjs`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `aws/js/lib/cfnSchema.js`**

```js
// aws/js/lib/cfnSchema.js
//
// Data catalog for the CloudFormation subset the Architecture Challenge
// simulates: supported resource types, their properties (required flags,
// value checks, which resource kind a ref-shaped property must point at)
// and short SAA-C03-study hover docs. cfnCompile.js consumes the shapes;
// cfn-editor.js consumes the docs and completion lists. Pure data + tiny
// lookups — no YAML, no DOM.

export const KIND_LABELS = {
  vpc: 'a VPC',
  subnet: 'a subnet',
  igw: 'an internet gateway',
  igwAttachment: 'a gateway attachment',
  eip: 'an Elastic IP',
  nat: 'a NAT gateway',
  rtb: 'a route table',
  route: 'a route',
  assoc: 'a route table association',
  sg: 'a security group',
  dbsubnetgroup: 'a DB subnet group',
  workload: 'a workload',
};

export const ENGINE_DEFAULT_PORTS = { postgres: 5432, mysql: 3306, mariadb: 3306 };

// Real AWS resource types this simulator deliberately does not model.
// Compile treats them as a warning (resource ignored), never the
// unknown-type error — misspellings must stay loud.
export const KNOWN_UNSUPPORTED = [
  'AWS::S3::Bucket', 'AWS::Lambda::Function', 'AWS::DynamoDB::Table',
  'AWS::IAM::Role', 'AWS::IAM::InstanceProfile', 'AWS::SNS::Topic',
  'AWS::SQS::Queue', 'AWS::CloudWatch::Alarm',
  'AWS::AutoScaling::AutoScalingGroup', 'AWS::EC2::LaunchTemplate',
  'AWS::EC2::VPCEndpoint', 'AWS::EC2::NetworkAcl', 'AWS::EC2::NetworkAclEntry',
  'AWS::EC2::SubnetNetworkAclAssociation', 'AWS::EC2::SecurityGroupIngress',
  'AWS::EC2::SecurityGroupEgress', 'AWS::EC2::EIPAssociation',
  'AWS::EC2::FlowLog', 'AWS::ElasticLoadBalancingV2::Listener',
  'AWS::ElasticLoadBalancingV2::TargetGroup', 'AWS::RDS::DBParameterGroup',
  'AWS::CloudFront::Distribution', 'AWS::Route53::RecordSet',
  'AWS::CertificateManager::Certificate',
];

// Prop spec fields: required (bool), check ('cidr'|'az'|'bool'|'port'|
// 'string'|'tags'|'ingress'), ref/refList (kind the !Ref must target),
// getAtt ({kind, attr}), enum (allowed scalars), ignored (accepted, not
// simulated — compile skips validation beyond presence), doc.
export const RESOURCE_TYPES = {
  'AWS::EC2::VPC': {
    kind: 'vpc',
    max: 1,
    doc: 'A virtual network: an isolated IPv4 address space (/16–/28) that all '
      + 'other resources live inside. This simulator models exactly one VPC.',
    props: {
      CidrBlock: {
        required: true, check: 'cidr',
        doc: 'The VPC’s IPv4 range in CIDR notation, /16 (65,536 addresses) '
          + 'through /28 (16 addresses). Subnets must fit inside it.',
      },
      EnableDnsSupport: { ignored: true, doc: 'Accepted; DNS is not simulated.' },
      EnableDnsHostnames: { ignored: true, doc: 'Accepted; DNS is not simulated.' },
      InstanceTenancy: { ignored: true, doc: 'Accepted; tenancy is not simulated.' },
      Tags: { check: 'tags', doc: 'Key/Value metadata. A Name tag labels the VPC.' },
    },
  },
  'AWS::EC2::Subnet': {
    kind: 'subnet',
    doc: 'A slice of the VPC’s address range pinned to one Availability Zone. '
      + '"Public" is not a property — a subnet is public when its route table '
      + 'sends 0.0.0.0/0 to an internet gateway.',
    props: {
      VpcId: { required: true, ref: 'vpc', doc: '!Ref to the VPC this subnet belongs to.' },
      CidrBlock: {
        required: true, check: 'cidr',
        doc: 'The subnet’s IPv4 range; must sit inside the VPC CIDR and not '
          + 'overlap other subnets. AWS reserves 5 addresses in every subnet.',
      },
      AvailabilityZone: {
        required: true, check: 'az',
        doc: 'Full AZ name, e.g. us-east-1a. This simulator models three AZs: '
          + 'the trailing letter must be a, b, or c.',
      },
      MapPublicIpOnLaunch: {
        check: 'bool',
        doc: 'When true, EC2 instances launched in this subnet get a public IP. '
          + 'This is the real-CFN way to give an instance a public address.',
      },
      Tags: { check: 'tags', doc: 'A Name tag names the subnet on the diagram.' },
    },
  },
  'AWS::EC2::InternetGateway': {
    kind: 'igw',
    max: 1,
    doc: 'The VPC’s door to the internet. Declaring it does nothing until an '
      + 'AWS::EC2::VPCGatewayAttachment attaches it to the VPC.',
    props: {
      Tags: { check: 'tags', doc: 'Key/Value metadata.' },
    },
  },
  'AWS::EC2::VPCGatewayAttachment': {
    kind: 'igwAttachment',
    max: 1,
    doc: 'Attaches an internet gateway to a VPC. Without this resource the IGW '
      + 'exists but passes no traffic — a classic exam gotcha.',
    props: {
      VpcId: { required: true, ref: 'vpc', doc: '!Ref to the VPC.' },
      InternetGatewayId: { required: true, ref: 'igw', doc: '!Ref to the internet gateway.' },
    },
  },
  'AWS::EC2::EIP': {
    kind: 'eip',
    doc: 'A static public IPv4 address. NAT gateways require one, wired via '
      + '!GetAtt <EIP>.AllocationId.',
    props: {
      Domain: { enum: ['vpc'], doc: 'Always vpc for VPC use.' },
      Tags: { check: 'tags', doc: 'Key/Value metadata.' },
    },
  },
  'AWS::EC2::NatGateway': {
    kind: 'nat',
    doc: 'Outbound-only internet access for private subnets. Must itself sit in '
      + 'a PUBLIC subnet and needs an Elastic IP allocation.',
    props: {
      SubnetId: {
        required: true, ref: 'subnet',
        doc: '!Ref to the subnet hosting the NAT gateway — a public subnet, or '
          + 'the NAT cannot reach the internet either.',
      },
      AllocationId: {
        required: true, getAtt: { kind: 'eip', attr: 'AllocationId' },
        doc: '!GetAtt <EIP logical id>.AllocationId — the Elastic IP this NAT '
          + 'gateway presents to the internet.',
      },
      ConnectivityType: { ignored: true, doc: 'Accepted; only public NAT gateways are simulated.' },
      Tags: { check: 'tags', doc: 'Key/Value metadata.' },
    },
  },
  'AWS::EC2::RouteTable': {
    kind: 'rtb',
    doc: 'A set of routes. Subnets bind to it via '
      + 'AWS::EC2::SubnetRouteTableAssociation; unassociated subnets use the '
      + 'VPC’s implicit main table (local-only here).',
    props: {
      VpcId: { required: true, ref: 'vpc', doc: '!Ref to the VPC.' },
      Tags: { check: 'tags', doc: 'A Name tag names the table on subnet cards.' },
    },
  },
  'AWS::EC2::Route': {
    kind: 'route',
    doc: 'One route in a route table: a destination CIDR plus exactly one '
      + 'target (GatewayId for an IGW, NatGatewayId for a NAT). The local '
      + 'route inside the VPC is implicit.',
    props: {
      RouteTableId: { required: true, ref: 'rtb', doc: '!Ref to the owning route table.' },
      DestinationCidrBlock: {
        required: true, check: 'cidr',
        doc: 'Traffic matching this CIDR uses this route; 0.0.0.0/0 means '
          + '"everything not matched by a more specific route".',
      },
      GatewayId: { ref: 'igw', doc: '!Ref to the internet gateway (public-subnet routes).' },
      NatGatewayId: { ref: 'nat', doc: '!Ref to a NAT gateway (private-subnet egress).' },
    },
  },
  'AWS::EC2::SubnetRouteTableAssociation': {
    kind: 'assoc',
    doc: 'Binds one subnet to one route table. A subnet can have at most one '
      + 'association; without one it falls back to the implicit main table.',
    props: {
      SubnetId: { required: true, ref: 'subnet', doc: '!Ref to the subnet.' },
      RouteTableId: { required: true, ref: 'rtb', doc: '!Ref to the route table.' },
    },
  },
  'AWS::EC2::SecurityGroup': {
    kind: 'sg',
    doc: 'A stateful instance-level firewall. This simulator models inbound '
      + 'rules only; outbound is treated as allow-all.',
    props: {
      GroupDescription: {
        required: true, check: 'string',
        doc: 'Required by real CloudFormation — a human description of the group.',
      },
      VpcId: { required: true, ref: 'vpc', doc: '!Ref to the VPC.' },
      GroupName: { check: 'string', doc: 'Optional display name; defaults to the logical id.' },
      SecurityGroupIngress: {
        check: 'ingress',
        doc: 'Inbound rules: each needs IpProtocol (tcp/udp/icmp/-1), '
          + 'FromPort/ToPort for tcp/udp, and exactly one source — CidrIp or '
          + 'SourceSecurityGroupId (!Ref to another SG; the least-privilege choice).',
      },
      SecurityGroupEgress: { ignored: true, doc: 'Accepted; outbound is not simulated (allow-all).' },
      Tags: { check: 'tags', doc: 'Key/Value metadata.' },
    },
  },
  'AWS::EC2::Instance': {
    kind: 'workload',
    workloadType: 'ec2',
    doc: 'An EC2 instance. Give it a role via Tags (Key: Role) to bind it to '
      + 'the challenge’s roles; its listening port defaults to 80 '
      + '(override with a Port tag).',
    props: {
      ImageId: {
        required: true, check: 'string',
        doc: 'Required by real CloudFormation. Any AMI id string is accepted here.',
      },
      SubnetId: { required: true, ref: 'subnet', doc: '!Ref to the instance’s subnet.' },
      InstanceType: { ignored: true, doc: 'Accepted; instance size is not simulated.' },
      SecurityGroupIds: { refList: 'sg', doc: 'List of !Ref security groups.' },
      Tags: {
        check: 'tags',
        doc: 'Name names the instance; Role assigns a challenge role; Port '
          + 'overrides the listening port (default 80).',
      },
    },
  },
  'AWS::ElasticLoadBalancingV2::LoadBalancer': {
    kind: 'workload',
    workloadType: 'alb',
    doc: 'An Application Load Balancer. Needs subnets in at least two AZs; '
      + 'Scheme internet-facing (the default) exposes it to the internet. '
      + 'Listening port defaults to 80 (override with a Port tag).',
    props: {
      Subnets: {
        required: true, refList: 'subnet',
        doc: 'List of !Ref subnets — at least two, in different AZs, all public '
          + 'for an internet-facing ALB.',
      },
      SecurityGroups: { refList: 'sg', doc: 'List of !Ref security groups.' },
      Scheme: {
        enum: ['internet-facing', 'internal'],
        doc: 'internet-facing (default) serves the internet; internal serves '
          + 'only the VPC.',
      },
      Type: { enum: ['application'], doc: 'Only Application Load Balancers are simulated.' },
      Tags: { check: 'tags', doc: 'Name/Role/Port, as on AWS::EC2::Instance.' },
    },
  },
  'AWS::RDS::DBSubnetGroup': {
    kind: 'dbsubnetgroup',
    doc: 'The set of subnets a DB instance may occupy — at least two, across '
      + 'two AZs, and (best practice) all private.',
    props: {
      DBSubnetGroupDescription: { required: true, check: 'string', doc: 'Required human description.' },
      SubnetIds: { required: true, refList: 'subnet', doc: 'List of !Ref subnets.' },
      Tags: { check: 'tags', doc: 'Key/Value metadata.' },
    },
  },
  'AWS::RDS::DBInstance': {
    kind: 'workload',
    workloadType: 'rds',
    doc: 'A managed relational database. Lives in a DB subnet group; MultiAZ '
      + 'true keeps a standby in a second AZ. Port defaults from Engine '
      + '(postgres 5432, mysql/mariadb 3306).',
    props: {
      Engine: {
        required: true, enum: ['postgres', 'mysql', 'mariadb'],
        doc: 'Database engine; sets the default port (postgres 5432, mysql/mariadb 3306).',
      },
      DBSubnetGroupName: { required: true, ref: 'dbsubnetgroup', doc: '!Ref to the DB subnet group.' },
      VPCSecurityGroups: { refList: 'sg', doc: 'List of !Ref security groups.' },
      MultiAZ: { check: 'bool', doc: 'true keeps a synchronous standby in another AZ.' },
      Port: { check: 'port', doc: 'Listening port; defaults from Engine.' },
      DBInstanceClass: { ignored: true, doc: 'Accepted; instance size is not simulated.' },
      AllocatedStorage: { ignored: true, doc: 'Accepted; storage is not simulated.' },
      MasterUsername: { ignored: true, doc: 'Accepted; credentials are not simulated.' },
      MasterUserPassword: { ignored: true, doc: 'Accepted; credentials are not simulated.' },
      Tags: { check: 'tags', doc: 'Name names the database; Role assigns a challenge role.' },
    },
  },
};

export function typeDoc(typeName) {
  return RESOURCE_TYPES[typeName] ? RESOURCE_TYPES[typeName].doc : null;
}

export function propDoc(typeName, prop) {
  const spec = RESOURCE_TYPES[typeName];
  return spec && spec.props[prop] && spec.props[prop].doc ? spec.props[prop].doc : null;
}
```

- [ ] **Step 4: Run tests**

Run: `node --test aws/js/lib/cfnSchema.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add aws/js/lib/cfnSchema.js aws/js/lib/cfnSchema.test.mjs
git commit -m "Add the CloudFormation resource-type catalog with study docs"
```

---

### Task 3: `cfnCompile.js` — template → arch model + diagnostics

**Files:**
- Create: `aws/js/lib/cfnCompile.js`
- Create: `aws/js/lib/cfnCompile.test.mjs`

**Interfaces:**
- Consumes: `../vendor/yaml.js` (`parseDocument, visit, isMap, isSeq, isScalar`), `./cfnSchema.js`, `./archModel.js` mutators, `./vpcMath.js` (`parseCidrStrict`).
- Produces: `compile(text)` → `{ arch, diagnostics, sourceMap, idMap, kinds }`:
  - `arch`: arch model, or `null` when any error-severity diagnostic exists. Never throws.
  - `diagnostics`: `[{ from, to, severity: 'error'|'warning'|'info', message }]` — text offsets.
  - `sourceMap`: `{ [logicalId]: { key: [from,to], type: [from,to]|null, props: { [prop]: [from,to] } } }` (built even when `arch` is null, for whatever parsed).
  - `idMap`: `{ modelToLogical: {modelId: logicalId}, logicalToModel: {logicalId: modelId} }`, or `null` when `arch` is null. The VPC maps under model id `'vpc'`.
  - `kinds`: `{ [logicalId]: 'vpc'|'subnet'|'igw'|'igwAttachment'|'eip'|'nat'|'rtb'|'route'|'assoc'|'sg'|'dbsubnetgroup'|'ec2'|'alb'|'rds' }` (workloads use their workload type).

- [ ] **Step 1: Write the failing tests** — `aws/js/lib/cfnCompile.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from './cfnCompile.js';

const errs = (r) => r.diagnostics.filter((d) => d.severity === 'error');
const warns = (r) => r.diagnostics.filter((d) => d.severity === 'warning');
const infos = (r) => r.diagnostics.filter((d) => d.severity === 'info');
const messages = (list) => list.map((d) => d.message);

// A minimal valid template most tests extend.
const VPC_ONLY = `AWSTemplateFormatVersion: "2010-09-09"
Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
`;

test('vpc-only template compiles to a bare arch', () => {
  const r = compile(VPC_ONLY);
  assert.deepEqual(errs(r), []);
  assert.ok(r.arch);
  assert.equal(r.arch.vpc.cidr, '10.0.0.0/16');
  assert.equal(r.arch.vpc.igwAttached, false);
  assert.equal(r.idMap.logicalToModel.Vpc, 'vpc');
  assert.equal(r.kinds.Vpc, 'vpc');
});

test('unknown resource type: exact message and squiggle range (the screenshot case)', () => {
  const text = `AWSTemplateFormatVersion: "2010-09-09"
Description:
Resources:
  DummyServer:
    Type: AWS::EC2::Instanc
    Properties:
`;
  const r = compile(text);
  const d = r.diagnostics.find((x) => x.message === 'Unknown CloudFormation resource type: AWS::EC2::Instanc');
  assert.ok(d, 'diagnostic present');
  assert.equal(d.severity, 'error');
  assert.equal(text.slice(d.from, d.to), 'AWS::EC2::Instanc');
  assert.equal(r.arch, null, 'errors block the arch');
});

test('real-but-unsupported type is a warning and the resource is ignored', () => {
  const r = compile(`${VPC_ONLY}  Bucket:
    Type: AWS::S3::Bucket
`);
  assert.deepEqual(errs(r), []);
  assert.match(messages(warns(r))[0], /AWS::S3::Bucket is real CloudFormation/);
  assert.ok(r.arch);
});

test('YAML syntax errors surface with positions and null arch', () => {
  const r = compile('Resources:\n  Vpc:\n   bad indent: [unclosed\n');
  assert.ok(errs(r).length > 0);
  assert.equal(r.arch, null);
});

test('empty or missing Resources is an error', () => {
  assert.ok(messages(errs(compile('Description: hi\n'))).some((m) => /Resources/.test(m)));
  assert.ok(messages(errs(compile('Resources: {}\n'))).some((m) => /Resources/.test(m)));
});

test('exactly one VPC required; a second is an error', () => {
  const r = compile(`${VPC_ONLY}  Vpc2:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.1.0.0/16
`);
  assert.ok(messages(errs(r)).some((m) => /Only 1 AWS::EC2::VPC/.test(m)));
  const none = compile('Resources:\n  Igw:\n    Type: AWS::EC2::InternetGateway\n');
  assert.ok(messages(errs(none)).some((m) => /exactly one AWS::EC2::VPC/.test(m)));
});

test('ignored sections are info, unknown top-level sections are warnings', () => {
  const r = compile(`Outputs:
  X:
    Value: y
Banana: true
${VPC_ONLY}`);
  assert.ok(messages(infos(r)).includes('Outputs is ignored by this simulator.'));
  assert.ok(messages(warns(r)).some((m) => /Unknown top-level section "Banana"/.test(m)));
  assert.ok(r.arch, 'info/warning do not block the arch');
});

test('missing required property and unknown property', () => {
  const r = compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      Sprocket: 7
  SubnetA:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      CidrBlock: 10.0.1.0/24
`);
  assert.ok(messages(errs(r)).some((m) => m === 'Missing required property "AvailabilityZone" for AWS::EC2::Subnet.'));
  assert.ok(messages(warns(r)).some((m) => m === 'Unknown property "Sprocket" for AWS::EC2::VPC.'));
});

test('!Ref to a missing id and to a wrong-kind resource', () => {
  const r = compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  SubnetA:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Ghost
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: us-east-1a
  SubnetB:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref SubnetA
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: us-east-1b
`);
  assert.ok(messages(errs(r)).some((m) => m === '"Ghost" does not refer to a resource in this template.'));
  assert.ok(messages(errs(r)).some((m) => m === 'Expected a reference to a VPC, but "SubnetA" is a subnet.'));
});

test('a plain string where a !Ref is required is an error', () => {
  const r = compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  SubnetA:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: Vpc
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: us-east-1a
`);
  assert.ok(messages(errs(r)).some((m) => m === 'Expected a !Ref to a VPC.'));
});

test('unsupported intrinsics are errors', () => {
  const r = compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: !Sub "10.0.0.0/16"
`);
  assert.ok(messages(errs(r)).some((m) => m === 'The !Sub intrinsic is not supported by this simulator.'));
});

test('AZ validation: format and a/b/c letter', () => {
  const bad = (az) => compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  S:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: ${az}
`);
  assert.ok(messages(errs(bad('banana'))).some((m) => /not an availability zone name/.test(m)));
  assert.ok(messages(errs(bad('us-east-1f'))).some((m) => /must end in a, b, or c/.test(m)));
  assert.deepEqual(errs(bad('eu-west-2b')), []);
});

test('route target: exactly one of GatewayId/NatGatewayId', () => {
  const base = `Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  Igw:
    Type: AWS::EC2::InternetGateway
  Rt:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref Vpc
  R:
    Type: AWS::EC2::Route
    Properties:
      RouteTableId: !Ref Rt
      DestinationCidrBlock: 0.0.0.0/0
`;
  assert.ok(messages(errs(compile(base))).some((m) => /exactly one target/.test(m)));
  const both = compile(`${base}      GatewayId: !Ref Igw
      NatGatewayId: !Ref Igw
`);
  assert.ok(messages(errs(both)).some((m) => /exactly one target/.test(m)));
});

test('NAT AllocationId must be !GetAtt <eip>.AllocationId', () => {
  const make = (alloc) => compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  S:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: us-east-1a
  Eip:
    Type: AWS::EC2::EIP
  Nat:
    Type: AWS::EC2::NatGateway
    Properties:
      SubnetId: !Ref S
      AllocationId: ${alloc}
`);
  assert.deepEqual(errs(make('!GetAtt Eip.AllocationId')), []);
  assert.ok(messages(errs(make('!Ref Eip'))).some((m) => /AllocationId must be !GetAtt/.test(m)));
  assert.ok(messages(errs(make('!GetAtt Eip.PublicIp'))).some((m) => /AllocationId must be !GetAtt/.test(m)));
});

test('second association for the same subnet is an error', () => {
  const r = compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  S:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: us-east-1a
  RtA:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref Vpc
  RtB:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref Vpc
  A1:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref S
      RouteTableId: !Ref RtA
  A2:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref S
      RouteTableId: !Ref RtB
`);
  assert.ok(messages(errs(r)).some((m) => /already has a route table association/.test(m)));
});

test('ingress rules: protocol, ports, exactly one source', () => {
  const make = (rule) => compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  Sg:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: web
      VpcId: !Ref Vpc
      SecurityGroupIngress:
${rule}
`);
  const ok = make('        - IpProtocol: tcp\n          FromPort: 80\n          ToPort: 80\n          CidrIp: 0.0.0.0/0');
  assert.deepEqual(errs(ok), []);
  assert.deepEqual(ok.arch.securityGroups[0].inbound,
    [{ proto: 'tcp', portFrom: 80, portTo: 80, source: '0.0.0.0/0' }]);
  const noSrc = make('        - IpProtocol: tcp\n          FromPort: 80\n          ToPort: 80');
  assert.ok(messages(errs(noSrc)).some((m) => /exactly one source/.test(m)));
  const noPorts = make('        - IpProtocol: tcp\n          CidrIp: 0.0.0.0/0');
  assert.ok(messages(errs(noPorts)).some((m) => /FromPort and ToPort/.test(m)));
  const allProto = make('        - IpProtocol: "-1"\n          CidrIp: 0.0.0.0/0');
  assert.deepEqual(errs(allProto), []);
  assert.deepEqual(allProto.arch.securityGroups[0].inbound,
    [{ proto: 'all', portFrom: 0, portTo: 65535, source: '0.0.0.0/0' }]);
});

test('happy path: a full public-web template compiles to the expected model', () => {
  const r = compile(`AWSTemplateFormatVersion: "2010-09-09"
Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  PublicSubnet:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: us-east-1a
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: public-a
  InternetGateway:
    Type: AWS::EC2::InternetGateway
  Attach:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref Vpc
      InternetGatewayId: !Ref InternetGateway
  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref Vpc
      Tags:
        - Key: Name
          Value: public
  DefaultRoute:
    Type: AWS::EC2::Route
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway
  Assoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet
      RouteTableId: !Ref PublicRouteTable
  WebSg:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: allow http
      VpcId: !Ref Vpc
      GroupName: web-sg
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
  Web1:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: ami-123
      SubnetId: !Ref PublicSubnet
      SecurityGroupIds:
        - !Ref WebSg
      Tags:
        - Key: Name
          Value: web-1
        - Key: Role
          Value: web
`);
  assert.deepEqual(errs(r), []);
  const a = r.arch;
  assert.equal(a.vpc.igwAttached, true);
  assert.equal(a.subnets.length, 1);
  assert.equal(a.subnets[0].name, 'public-a');
  assert.equal(a.subnets[0].az, 'a');
  const rt = a.routeTables.find((t) => !t.isMain);
  assert.deepEqual(rt.routes, [{ destCidr: '0.0.0.0/0', target: 'igw' }]);
  assert.deepEqual(rt.subnetIds, [a.subnets[0].id]);
  const wl = a.workloads[0];
  assert.equal(wl.type, 'ec2');
  assert.equal(wl.role, 'web');
  assert.equal(wl.publicIp, true, 'MapPublicIpOnLaunch drives publicIp');
  assert.equal(wl.port, 80);
  assert.deepEqual(wl.sgIds, [a.securityGroups[0].id]);
  assert.equal(r.idMap.modelToLogical[wl.id], 'Web1');
  assert.equal(r.kinds.Web1, 'ec2');
  assert.ok(r.sourceMap.Web1.key[0] < r.sourceMap.Web1.key[1]);
  assert.ok(r.sourceMap.Web1.props.SubnetId);
});

test('ALB and RDS map scheme, engine port, multi-az, and Port tag', () => {
  const r = compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  SubA:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: us-east-1a
  SubB:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: us-east-1b
  Alb:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Subnets:
        - !Ref SubA
        - !Ref SubB
      Scheme: internet-facing
      Tags:
        - Key: Port
          Value: "443"
        - Key: Role
          Value: lb
  DbGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupDescription: db subnets
      SubnetIds:
        - !Ref SubA
        - !Ref SubB
  Db:
    Type: AWS::RDS::DBInstance
    Properties:
      Engine: mysql
      DBSubnetGroupName: !Ref DbGroup
      MultiAZ: true
`);
  assert.deepEqual(errs(r), []);
  const alb = r.arch.workloads.find((w) => w.type === 'alb');
  assert.equal(alb.publicIp, true);
  assert.equal(alb.port, 443);
  assert.equal(alb.role, 'lb');
  assert.equal(alb.subnetIds.length, 2);
  const db = r.arch.workloads.find((w) => w.type === 'rds');
  assert.equal(db.port, 3306, 'engine default port');
  assert.equal(db.multiAz, true);
  assert.equal(db.subnetIds.length, 2, 'subnets come from the DB subnet group');
});

test('duplicate logical ids are errors (yaml unique-key rule)', () => {
  const r = compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.1.0.0/16
`);
  assert.ok(errs(r).length > 0);
});

test('compile never throws on garbage', () => {
  for (const text of ['', ':', '\t', 'Resources: 3', 'Resources:\n  X: 4', '[1,2', 'a: *anchor']) {
    assert.doesNotThrow(() => compile(text), text);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test aws/js/lib/cfnCompile.test.mjs`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `aws/js/lib/cfnCompile.js`**

```js
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
  RESOURCE_TYPES, KNOWN_UNSUPPORTED, ENGINE_DEFAULT_PORTS, KIND_LABELS,
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
const RESOURCE_ATTRS = ['Type', 'Properties', 'DependsOn', 'Condition', 'Metadata', 'DeletionPolicy', 'UpdateReplacePolicy'];
const AZ_RE = /^[a-z]{2}(-[a-z]+)+-\d[a-z]$/;

export function compile(text) {
  const diagnostics = [];
  const diag = (severity, node, message) => {
    const range = node && node.range ? [node.range[0], node.range[1]] : [0, Math.min(1, text.length)];
    diagnostics.push({ from: range[0], to: range[1], severity, message });
  };
  const fail = (sourceMap, kinds) => ({ arch: null, diagnostics, sourceMap, idMap: null, kinds });

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
      if (!RESOURCE_ATTRS.includes(k)) diag('warning', p.key, `Unknown resource attribute "${k}".`);
    }
    const typePair = body.items.find((p) => isScalar(p.key) && p.key.value === 'Type');
    if (!typePair || !isScalar(typePair.value)) { diag('error', keyNode, `Resource "${id}" has no Type.`); continue; }
    const typeName = String(typePair.value.value);
    const spec = RESOURCE_TYPES[typeName];
    if (!spec) {
      if (KNOWN_UNSUPPORTED.includes(typeName)) {
        diag('warning', typePair.value, `${typeName} is real CloudFormation, but this simulator does not support it; the resource is ignored.`);
      } else {
        diag('error', typePair.value, `Unknown CloudFormation resource type: ${typeName}`);
      }
      continue;
    }
    const propsPair = body.items.find((p) => isScalar(p.key) && p.key.value === 'Properties');
    let propsNode = null;
    if (propsPair && propsPair.value != null) {
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
    diagnostics,
    sourceMap,
    idMap: hasErrors ? null : { modelToLogical, logicalToModel },
    kinds,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `node --test aws/js/lib/cfnCompile.test.mjs`
Expected: PASS (all tests). Likely trip points: (a) the yaml lib's duplicate-key error message differs — the test only asserts SOME error, fine; (b) `visit` callback signature — it's `visit(doc, visitor)` where a function visitor receives `(key, node, path)`; (c) `!GetAtt` scalar resolve receives the string value. Debug with small `node --input-type=module -e` probes against `aws/js/vendor/yaml.js` rather than guessing.

- [ ] **Step 5: Run the whole suite to catch regressions**

Run: `node --test aws/js/lib/*.test.mjs aws/js/data/*.test.mjs`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add aws/js/lib/cfnCompile.js aws/js/lib/cfnCompile.test.mjs
git commit -m "Compile CloudFormation YAML into the arch model with positioned diagnostics"
```

---

### Task 4: `cfnEmit.js` — arch model → canonical YAML, plus round-trip regression

**Files:**
- Create: `aws/js/lib/cfnEmit.js`
- Create: `aws/js/lib/cfnEmit.test.mjs`
- Modify: `aws/js/data/archChallenges.js` (two one-line additions: `publicIp: true` on both ALB `addWorkload` calls — `haWebSolution` line ~87 and `threeTierSolution` line ~128)

**Interfaces:**
- Consumes: `./archModel.js` (`effectiveRouteTable`), challenge builders from `../data/archChallenges.js` (test only), `compile` from `./cfnCompile.js` (test only).
- Produces: `emit(arch)` → canonical strict-CFN YAML string (trailing newline). Deterministic for a given model.

**Why the data tweak:** the model's ALBs were created with the default `publicIp: false`, but both reference ALBs are internet-facing (their goals include `internetReaches`; the simulator ignores `publicIp` for ALBs so nothing changes functionally). `emit` maps ALB `publicIp` → `Scheme`, and a revealed reference solution must read `Scheme: internet-facing`, not `internal`.

- [ ] **Step 1: Add `publicIp: true` to both reference ALBs**

In `aws/js/data/archChallenges.js`, `haWebSolution`:

```js
  addWorkload(arch, {
    type: 'alb', name: 'web-alb', role: 'lb',
    subnetIds: [pubA.id, pubB.id], sgIds: [albSg.id], port: 443, publicIp: true,
  });
```

and `threeTierSolution`:

```js
  addWorkload(arch, {
    type: 'alb', name: 'app-alb', role: 'lb',
    subnetIds: [pubA.id, pubB.id], sgIds: [albSg.id], port: 443, publicIp: true,
  });
```

Run: `node --test aws/js/data/archChallenges.test.mjs` — Expected: PASS (goals/BP don't read ALB publicIp).

- [ ] **Step 2: Write the failing tests** — `aws/js/lib/cfnEmit.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { emit } from './cfnEmit.js';
import { compile } from './cfnCompile.js';
import { createArch, getSubnet, effectiveRouteTable, getSecurityGroup } from './archModel.js';
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
```

- [ ] **Step 3: Run to verify it fails**

Run: `node --test aws/js/lib/cfnEmit.test.mjs`
Expected: FAIL (module not found).

- [ ] **Step 4: Write `aws/js/lib/cfnEmit.js`**

```js
// aws/js/lib/cfnEmit.js
//
// Serializes an arch model to canonical strict-CFN YAML. This is how the
// existing model-builder startState()/refSolution() functions (and legacy
// visual-builder drafts) enter the CFN-editor world without a data rewrite:
// the page emits them to text on demand. Emission is deterministic; the
// cfnEmit tests prove compile(emit(model)) is equivalent for every
// challenge fixture. Two normalizations are deliberate:
//  - Routes on the implicit main table become an explicit "MainRouteTable"
//    associated with every subnet that effectively used main — CFN cannot
//    address the real main table.
//  - EC2 publicIp becomes MapPublicIpOnLaunch on the hosting subnet (the
//    real-CFN mechanism); ALB publicIp becomes Scheme.

import { effectiveRouteTable } from './archModel.js';

const REGION = 'us-east-1';
const DEFAULT_WORKLOAD_PORTS = { ec2: 80, alb: 80, rds: 5432 };

function pascal(name) {
  const cleaned = String(name || '').replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  const p = cleaned.split(' ').filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  if (!p) return 'Resource';
  return /^[A-Za-z]/.test(p) ? p : `R${p}`;
}

function allocator() {
  const used = new Set();
  return (base) => {
    let id = base;
    let n = 2;
    while (used.has(id)) { id = `${base}${n}`; n += 1; }
    used.add(id);
    return id;
  };
}

export function emit(arch) {
  const lines = [];
  const out = (s) => lines.push(s);
  const nextId = allocator();

  out('AWSTemplateFormatVersion: "2010-09-09"');
  out('Description: Architecture Challenge design');
  out('Resources:');

  const vpcId = nextId('Vpc');
  out(`  ${vpcId}:`);
  out('    Type: AWS::EC2::VPC');
  out('    Properties:');
  out(`      CidrBlock: ${arch.vpc.cidr}`);

  // Real-CFN public IPs: mark the subnets that host a public EC2 instance.
  const publicIpSubnets = new Set();
  for (const wl of arch.workloads) {
    if (wl.type === 'ec2' && wl.publicIp) for (const sid of wl.subnetIds) publicIpSubnets.add(sid);
  }

  const subnetIds = {};
  for (const s of arch.subnets) {
    const lid = nextId(`${pascal(s.name)}Subnet`);
    subnetIds[s.id] = lid;
    out(`  ${lid}:`);
    out('    Type: AWS::EC2::Subnet');
    out('    Properties:');
    out(`      VpcId: !Ref ${vpcId}`);
    out(`      CidrBlock: ${s.cidr}`);
    out(`      AvailabilityZone: ${REGION}${s.az}`);
    if (publicIpSubnets.has(s.id)) out('      MapPublicIpOnLaunch: true');
    out('      Tags:');
    out('        - Key: Name');
    out(`          Value: ${s.name}`);
  }

  // The model can hold igw routes without an attached IGW (broken starts):
  // emit the gateway whenever anything needs to reference it, but the
  // attachment only when the model says attached.
  const needIgw = arch.vpc.igwAttached
    || arch.routeTables.some((rt) => rt.routes.some((r) => r.target === 'igw'));
  let igwId = null;
  if (needIgw) {
    igwId = nextId('InternetGateway');
    out(`  ${igwId}:`);
    out('    Type: AWS::EC2::InternetGateway');
    if (arch.vpc.igwAttached) {
      const attachId = nextId('VpcGatewayAttachment');
      out(`  ${attachId}:`);
      out('    Type: AWS::EC2::VPCGatewayAttachment');
      out('    Properties:');
      out(`      VpcId: !Ref ${vpcId}`);
      out(`      InternetGatewayId: !Ref ${igwId}`);
    }
  }

  const natIds = {};
  arch.natGateways.forEach((nat, i) => {
    if (!subnetIds[nat.subnetId]) return; // dangling NAT: nothing to anchor it to
    const eipId = nextId(`NatEip${i + 1}`);
    const natId = nextId(`NatGateway${i + 1}`);
    natIds[nat.id] = natId;
    out(`  ${eipId}:`);
    out('    Type: AWS::EC2::EIP');
    out('    Properties:');
    out('      Domain: vpc');
    out(`  ${natId}:`);
    out('    Type: AWS::EC2::NatGateway');
    out('    Properties:');
    out(`      SubnetId: !Ref ${subnetIds[nat.subnetId]}`);
    out(`      AllocationId: !GetAtt ${eipId}.AllocationId`);
  });

  const routeTargetLine = (target) => (target === 'igw'
    ? `      GatewayId: !Ref ${igwId}`
    : `      NatGatewayId: !Ref ${natIds[target.slice(4)]}`);
  const emitTable = (lid, name, routes, subnetModelIds) => {
    out(`  ${lid}:`);
    out('    Type: AWS::EC2::RouteTable');
    out('    Properties:');
    out(`      VpcId: !Ref ${vpcId}`);
    out('      Tags:');
    out('        - Key: Name');
    out(`          Value: ${name}`);
    routes.forEach((route, i) => {
      if (route.target !== 'igw' && !natIds[route.target.slice(4)]) return; // dangling NAT route
      const rid = nextId(`${lid}Route${i + 1}`);
      out(`  ${rid}:`);
      out('    Type: AWS::EC2::Route');
      out('    Properties:');
      out(`      RouteTableId: !Ref ${lid}`);
      out(`      DestinationCidrBlock: ${route.destCidr}`);
      out(routeTargetLine(route.target));
    });
    for (const sid of subnetModelIds) {
      if (!subnetIds[sid]) continue;
      const aid = nextId(`${subnetIds[sid]}Association`);
      out(`  ${aid}:`);
      out('    Type: AWS::EC2::SubnetRouteTableAssociation');
      out('    Properties:');
      out(`      SubnetId: !Ref ${subnetIds[sid]}`);
      out(`      RouteTableId: !Ref ${lid}`);
    }
  };

  for (const rt of arch.routeTables.filter((t) => !t.isMain)) {
    emitTable(nextId(`${pascal(rt.name)}RouteTable`), rt.name, rt.routes, rt.subnetIds);
  }
  const main = arch.routeTables.find((t) => t.isMain);
  if (main && main.routes.length > 0) {
    const users = arch.subnets.filter((s) => effectiveRouteTable(arch, s.id) === main).map((s) => s.id);
    emitTable(nextId('MainRouteTable'), 'main', main.routes, users);
  }

  // SG logical ids are allocated before bodies so rules can reference any
  // group (forward refs are legal in CFN).
  const sgIds = {};
  for (const sg of arch.securityGroups) sgIds[sg.id] = nextId(pascal(sg.name));
  for (const sg of arch.securityGroups) {
    out(`  ${sgIds[sg.id]}:`);
    out('    Type: AWS::EC2::SecurityGroup');
    out('    Properties:');
    out(`      GroupDescription: ${sg.name}`);
    out(`      VpcId: !Ref ${vpcId}`);
    out(`      GroupName: ${sg.name}`);
    if (sg.inbound.length > 0) {
      out('      SecurityGroupIngress:');
      for (const r of sg.inbound) {
        const proto = r.proto === 'all' ? '"-1"' : (r.proto || 'tcp');
        out(`        - IpProtocol: ${proto}`);
        if (r.proto !== 'all' && r.proto !== 'icmp') {
          out(`          FromPort: ${r.portFrom}`);
          out(`          ToPort: ${r.portTo}`);
        }
        if (typeof r.source === 'string' && r.source.startsWith('sg:')) {
          out(`          SourceSecurityGroupId: !Ref ${sgIds[r.source.slice(3)]}`);
        } else {
          out(`          CidrIp: ${r.source}`);
        }
      }
    }
  }

  const emitTags = (wl, portAsTag) => {
    out('      Tags:');
    out('        - Key: Name');
    out(`          Value: ${wl.name}`);
    if (wl.role) {
      out('        - Key: Role');
      out(`          Value: ${wl.role}`);
    }
    if (portAsTag && wl.port !== undefined && wl.port !== DEFAULT_WORKLOAD_PORTS[wl.type]) {
      out('        - Key: Port');
      out(`          Value: "${wl.port}"`);
    }
  };
  const emitRefList = (label, ids, table) => {
    if (ids.length === 0) return;
    out(`      ${label}:`);
    for (const id of ids) if (table[id]) out(`        - !Ref ${table[id]}`);
  };

  for (const wl of arch.workloads) {
    const lid = nextId(pascal(wl.name));
    if (wl.type === 'ec2') {
      out(`  ${lid}:`);
      out('    Type: AWS::EC2::Instance');
      out('    Properties:');
      out('      ImageId: ami-0c02fb55956c7d316');
      if (wl.subnetIds[0] && subnetIds[wl.subnetIds[0]]) out(`      SubnetId: !Ref ${subnetIds[wl.subnetIds[0]]}`);
      emitRefList('SecurityGroupIds', wl.sgIds, sgIds);
      emitTags(wl, true);
    } else if (wl.type === 'alb') {
      out(`  ${lid}:`);
      out('    Type: AWS::ElasticLoadBalancingV2::LoadBalancer');
      out('    Properties:');
      out('      Type: application');
      out(`      Scheme: ${wl.publicIp ? 'internet-facing' : 'internal'}`);
      emitRefList('Subnets', wl.subnetIds, subnetIds);
      emitRefList('SecurityGroups', wl.sgIds, sgIds);
      emitTags(wl, true);
    } else { // rds
      const groupId = nextId(`${lid}SubnetGroup`);
      out(`  ${groupId}:`);
      out('    Type: AWS::RDS::DBSubnetGroup');
      out('    Properties:');
      out(`      DBSubnetGroupDescription: Subnets for ${wl.name}`);
      emitRefList('SubnetIds', wl.subnetIds, subnetIds);
      out(`  ${lid}:`);
      out('    Type: AWS::RDS::DBInstance');
      out('    Properties:');
      out('      Engine: postgres');
      out(`      DBSubnetGroupName: !Ref ${groupId}`);
      emitRefList('VPCSecurityGroups', wl.sgIds, sgIds);
      if (wl.multiAz) out('      MultiAZ: true');
      if (wl.port !== undefined && wl.port !== 5432) out(`      Port: ${wl.port}`);
      emitTags(wl, false);
    }
  }

  return `${lines.join('\n')}\n`;
}
```

- [ ] **Step 5: Run the tests**

Run: `node --test aws/js/lib/cfnEmit.test.mjs`
Expected: PASS. Debugging aid: on a fingerprint mismatch the assertion message includes the emitted YAML — read it, don't guess. A likely subtlety: `RDS::DBSubnetGroup` with fewer than 2 subnets, or the ALB `Subnets` required-prop when a start state has an ALB with no subnets — no current fixture does either; if one appears, the emit of an empty `Subnets`/`SubnetIds` list omits the property entirely and compile reports the missing required prop, which would show up here.

- [ ] **Step 6: Run the whole suite**

Run: `node --test aws/js/lib/*.test.mjs aws/js/data/*.test.mjs`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add aws/js/lib/cfnEmit.js aws/js/lib/cfnEmit.test.mjs aws/js/data/archChallenges.js
git commit -m "Emit arch models as canonical CloudFormation with round-trip proofs"
```

---

### Task 5: Shared storage — YAML draft methods, propagated to all 5 modules

**Files:**
- Modify: `aws/js/lib/storage.js` (insert after the `clearArchDraft` method, `aws/js/lib/storage.js:176`)
- Modify: `aws/js/lib/storage.test.mjs` (append tests)
- Modify: `networking/js/lib/storage.js`, `postgres/js/lib/storage.js`, `kubernetes/js/lib/storage.js`, `sre/js/lib/storage.js` (regenerate: their line 1 + aws tail)
- Modify: `networking/js/lib/storage.test.mjs`, `postgres/js/lib/storage.test.mjs`, `kubernetes/js/lib/storage.test.mjs`, `sre/js/lib/storage.test.mjs` (byte-identical copies)

**Interfaces:**
- Consumes: existing `load`/`save` helpers inside `storage.js`.
- Produces: `store.getArchCfnText(challengeId)` → string|null, `store.setArchCfnText(challengeId, text)`, `store.clearArchCfnText(challengeId)`.

- [ ] **Step 1: Write the failing tests** — append to `aws/js/lib/storage.test.mjs`:

```js
test('arch CFN text: set/get/clear round-trip per challenge id', () => {
  const store = createStore(fakeBackend());
  assert.equal(store.getArchCfnText('two-tier'), null);
  store.setArchCfnText('two-tier', 'Resources: {}\n');
  assert.equal(store.getArchCfnText('two-tier'), 'Resources: {}\n');
  assert.equal(store.getArchCfnText('sandbox'), null, 'ids are independent');
  store.clearArchCfnText('two-tier');
  assert.equal(store.getArchCfnText('two-tier'), null);
});

test('arch CFN text getter survives a non-string stored value', () => {
  assert.equal(storeWithRaw('{"foo":1}').getArchCfnText('x'), null);
  assert.equal(storeWithRaw('42').getArchCfnText('x'), null);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test aws/js/lib/storage.test.mjs`
Expected: FAIL (`store.getArchCfnText is not a function`).

- [ ] **Step 3: Add the methods** — in `aws/js/lib/storage.js`, directly after the `clearArchDraft` method (keep the object-literal comma discipline):

```js
    getArchCfnText(challengeId) {
      const value = load(b, `arch-cfn:${challengeId}`, null);
      return typeof value === 'string' ? value : null;
    },
    setArchCfnText(challengeId, text) {
      save(b, `arch-cfn:${challengeId}`, text);
    },
    clearArchCfnText(challengeId) {
      try {
        b.removeItem(`${NAMESPACE}:arch-cfn:${challengeId}`);
      } catch {
        /* ignore */
      }
    },
```

- [ ] **Step 4: Run the aws tests**

Run: `node --test aws/js/lib/storage.test.mjs`
Expected: PASS.

- [ ] **Step 5: Propagate to the other 4 modules (NAMESPACE line preserved)**

```bash
cd <repo>
for m in networking postgres kubernetes sre; do
  { head -1 "$m/js/lib/storage.js"; tail -n +2 aws/js/lib/storage.js; } > "$m/js/lib/storage.js.tmp"
  mv "$m/js/lib/storage.js.tmp" "$m/js/lib/storage.js"
  cp aws/js/lib/storage.test.mjs "$m/js/lib/storage.test.mjs"
done
node scripts/check-drift.mjs
for m in aws networking postgres kubernetes sre; do node --test "$m/js/lib/storage.test.mjs"; done
```

Expected: `No drift across 5 modules …` and 5 passing test runs.

- [ ] **Step 6: Commit**

```bash
git add aws/js/lib/storage.js aws/js/lib/storage.test.mjs \
  networking/js/lib/storage.js networking/js/lib/storage.test.mjs \
  postgres/js/lib/storage.js postgres/js/lib/storage.test.mjs \
  kubernetes/js/lib/storage.js kubernetes/js/lib/storage.test.mjs \
  sre/js/lib/storage.js sre/js/lib/storage.test.mjs
git commit -m "Store architecture CFN template drafts as text (propagated to all modules)"
```

---

### Task 6: `cfn-editor.js` — CodeMirror glue

**Files:**
- Create: `aws/js/cfn-editor.js`

**Interfaces:**
- Consumes: `./vendor/codemirror.js` (Task 1 exports), `./lib/cfnSchema.js` (`RESOURCE_TYPES, typeDoc, propDoc`).
- Produces: `createCfnEditor(mount, callbacks)` → `{ view, setText(text), getText(), revealResource(logicalId), relint(), destroy() }`. Callbacks: `getDiagnostics(text)` → diagnostics array (orchestrator's cached compile + Check-time extras), `getCompile()` → last compile result (`{ diagnostics, sourceMap, idMap, kinds }`), `getRoles()` → string[], `onDocChange(text)` (debounced 250ms, typing only — `setText` never triggers it), `onCursorResource(logicalId|null)`.

No node tests (DOM module); Task 9 verifies in the browser. There is intentionally no model logic here.

- [ ] **Step 1: Write `aws/js/cfn-editor.js`**

```js
// aws/js/cfn-editor.js
//
// CodeMirror glue for the CloudFormation editor: YAML highlighting themed
// from the site's CSS variables, lint squiggles pulled from the page's
// cached compile (getDiagnostics — the editor never compiles anything
// itself), IntelliJ-style hover docs from cfnSchema, and schema-driven
// autocompletion. setText() is a programmatic swap (challenge open/Reveal/
// Reset): it clears the pending onDocChange debounce because its caller
// recompiles synchronously — only real typing reaches onDocChange.

import {
  EditorState, EditorView, keymap, lineNumbers, highlightActiveLine,
  highlightActiveLineGutter, drawSelection, hoverTooltip, defaultKeymap,
  history, historyKeymap, indentWithTab, indentOnInput, bracketMatching,
  syntaxHighlighting, HighlightStyle, indentUnit, linter, lintGutter,
  forceLinting, autocompletion, closeBrackets, completionKeymap,
  closeBracketsKeymap, searchKeymap, highlightSelectionMatches, yaml, tags,
} from './vendor/codemirror.js';
import { RESOURCE_TYPES, typeDoc, propDoc } from './lib/cfnSchema.js';

// CodeMirror injects these as literal CSS values, so var() references keep
// working across the site's light/dark palettes with no per-theme styles.
const siteTheme = EditorView.theme({
  '&': {
    fontSize: '13px',
    height: '100%',
    backgroundColor: 'var(--arch-surface)',
    color: 'var(--color-text)',
  },
  '.cm-content': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    caretColor: 'var(--color-text)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--arch-surface-muted)',
    color: 'var(--color-muted)',
    border: 'none',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--arch-surface)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
  },
  '&.cm-focused': { outline: 'none' },
});

const cfnHighlight = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--color-primary)' },
  { tag: tags.string, color: 'var(--color-success)' },
  { tag: tags.number, color: 'var(--color-danger)' },
  { tag: tags.bool, color: 'var(--color-danger)' },
  { tag: tags.comment, color: 'var(--color-muted)', fontStyle: 'italic' },
  { tag: tags.keyword, color: 'var(--color-primary-dark)' },
  { tag: tags.meta, color: 'var(--color-muted)' },
]);

// The resource block (logical id + Type) enclosing a line, found by
// scanning upward for the nearest 2-space-indented "  Name:" line. Text
// heuristics, not AST — good enough for completion/hover context and
// resilient to half-typed templates the parser can't finish.
function enclosingResource(state, lineNo) {
  for (let n = lineNo; n >= 1; n -= 1) {
    const lineText = state.doc.line(n).text;
    if (/^[A-Za-z]/.test(lineText)) return { logicalId: null, typeName: null };
    const m = /^ {2}([A-Za-z0-9]+):\s*$/.exec(lineText);
    if (m) {
      for (let k = n + 1; k <= state.doc.lines; k += 1) {
        const t = state.doc.line(k).text;
        if (k > n + 1 && /^ {0,2}\S/.test(t)) break;
        const tm = /^\s*Type:\s*([A-Za-z0-9:]+)\s*$/.exec(t);
        if (tm) return { logicalId: m[1], typeName: tm[1] };
      }
      return { logicalId: m[1], typeName: null };
    }
  }
  return { logicalId: null, typeName: null };
}

function cfnCompletions(getCompile, getRoles) {
  return (context) => {
    const { state, pos } = context;
    const line = state.doc.lineAt(pos);
    const before = line.text.slice(0, pos - line.from);

    // Resource type names after "Type:".
    let m = /Type:\s*([A-Za-z0-9:]*)$/.exec(before);
    if (m) {
      return {
        from: pos - m[1].length,
        options: Object.keys(RESOURCE_TYPES).map((t) => ({
          label: t, type: 'class', info: typeDoc(t) || undefined,
        })),
        validFor: /^[A-Za-z0-9:]*$/,
      };
    }

    // Logical ids after !Ref (or !GetAtt), filtered to the kind the
    // enclosing property expects when it is knowable from this line.
    m = /!(Ref|GetAtt)\s+([A-Za-z0-9.]*)$/.exec(before);
    if (m) {
      const compiled = getCompile();
      const propM = /^\s*-?\s*([A-Za-z0-9]+):/.exec(line.text);
      const { typeName } = enclosingResource(state, line.number);
      const spec = typeName ? RESOURCE_TYPES[typeName] : null;
      const propSpec = spec && propM ? spec.props[propM[1]] : null;
      const wanted = propSpec
        ? propSpec.ref || propSpec.refList || (propSpec.getAtt && propSpec.getAtt.kind) || null
        : null;
      const options = Object.entries(compiled.kinds || {})
        .filter(([, kind]) => !wanted || kind === wanted)
        .map(([id]) => ({ label: id, type: 'variable' }));
      return { from: pos - m[2].length, options, validFor: /^[A-Za-z0-9]*$/ };
    }

    // Property names inside a known resource.
    m = /^(\s+)([A-Za-z0-9]+)$/.exec(before);
    if (m) {
      const { typeName } = enclosingResource(state, line.number);
      const spec = typeName ? RESOURCE_TYPES[typeName] : null;
      if (spec) {
        return {
          from: pos - m[2].length,
          options: Object.entries(spec.props).map(([name, ps]) => ({
            label: name, type: 'property', info: ps.doc || undefined,
          })),
          validFor: /^[A-Za-z0-9]*$/,
        };
      }
    }

    // Role tag values: the previous line carries "Key: Role".
    m = /Value:\s*([A-Za-z0-9-]*)$/.exec(before);
    if (m && line.number > 1 && /Key:\s*Role\s*$/.test(state.doc.line(line.number - 1).text)) {
      return {
        from: pos - m[1].length,
        options: getRoles().map((r) => ({ label: r, type: 'constant' })),
        validFor: /^[A-Za-z0-9-]*$/,
      };
    }
    return null;
  };
}

function cfnHover(getCompile) {
  return hoverTooltip((view, pos) => {
    const line = view.state.doc.lineAt(pos);
    const col = pos - line.from;
    const tokenRe = /[A-Za-z0-9:!.-]+/g;
    let match = null;
    let m;
    while ((m = tokenRe.exec(line.text))) {
      if (m.index <= col && col <= m.index + m[0].length) { match = m; break; }
    }
    if (!match) return null;
    const word = match[0];
    let body = null;
    if (/^AWS::/.test(word)) {
      body = typeDoc(word) || 'No documentation found.';
    } else if (/^[A-Za-z0-9]+$/.test(word) && new RegExp(`^\\s*-?\\s*${word}:`).test(line.text)) {
      const { typeName } = enclosingResource(view.state, line.number);
      if (typeName && RESOURCE_TYPES[typeName] && RESOURCE_TYPES[typeName].props[word]) {
        body = propDoc(typeName, word) || 'No documentation found.';
      }
    }
    const under = (getCompile().diagnostics || []).filter((d) => d.from <= pos && pos <= d.to);
    if (!body && under.length === 0) return null;
    return {
      pos: line.from + match.index,
      end: line.from + match.index + word.length,
      above: true,
      create() {
        const dom = document.createElement('div');
        dom.className = 'cfn-hover';
        for (const d of under) {
          const p = document.createElement('div');
          p.className = `cfn-hover-diag cfn-${d.severity}`;
          p.textContent = d.message;
          dom.appendChild(p);
        }
        if (body) {
          const p = document.createElement('div');
          p.className = 'cfn-hover-doc';
          p.textContent = body;
          dom.appendChild(p);
        }
        return { dom };
      },
    };
  });
}

function resourceEnd(ranges) {
  let end = ranges.key[1];
  if (ranges.type) end = Math.max(end, ranges.type[1]);
  for (const r of Object.values(ranges.props || {})) end = Math.max(end, r[1]);
  return end;
}

export function createCfnEditor(mount, {
  initialText = '', getDiagnostics, getCompile, getRoles = () => [],
  onDocChange, onCursorResource = () => {},
}) {
  let docTimer = null;
  let lastCursorResource;

  const lintSource = (view) => {
    const docLen = view.state.doc.length;
    return getDiagnostics(view.state.doc.toString()).map((d) => ({
      from: Math.min(d.from, docLen),
      to: Math.min(Math.max(d.to, Math.min(d.from + 1, docLen)), docLen),
      severity: d.severity,
      message: d.message,
    }));
  };

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      clearTimeout(docTimer);
      docTimer = setTimeout(() => onDocChange(update.state.doc.toString()), 250);
    }
    if (update.selectionSet || update.docChanged) {
      const pos = update.state.selection.main.head;
      const { sourceMap } = getCompile();
      let found = null;
      for (const [id, ranges] of Object.entries(sourceMap || {})) {
        if (pos >= ranges.key[0] && pos <= resourceEnd(ranges)) { found = id; break; }
      }
      if (found !== lastCursorResource) {
        lastCursorResource = found;
        onCursorResource(found);
      }
    }
  });

  const view = new EditorView({
    parent: mount,
    state: EditorState.create({
      doc: initialText,
      extensions: [
        lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(),
        drawSelection(), history(), indentOnInput(), bracketMatching(), closeBrackets(),
        autocompletion({ override: [cfnCompletions(getCompile, getRoles)] }),
        highlightSelectionMatches(),
        keymap.of([
          ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap,
          ...historyKeymap, ...completionKeymap, indentWithTab,
        ]),
        yaml(),
        indentUnit.of('  '),
        syntaxHighlighting(cfnHighlight),
        siteTheme,
        linter(lintSource, { delay: 300 }),
        lintGutter(),
        cfnHover(getCompile),
        updateListener,
        EditorView.lineWrapping,
      ],
    }),
  });

  return {
    view,
    setText(text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
      clearTimeout(docTimer);
      forceLinting(view);
    },
    getText() {
      return view.state.doc.toString();
    },
    revealResource(logicalId) {
      const { sourceMap } = getCompile();
      const ranges = sourceMap && sourceMap[logicalId];
      if (!ranges) return;
      const pos = Math.min(ranges.key[0], view.state.doc.length);
      view.dispatch({
        selection: { anchor: pos },
        effects: EditorView.scrollIntoView(pos, { y: 'center' }),
      });
      view.focus();
    },
    relint() {
      forceLinting(view);
    },
    destroy() {
      clearTimeout(docTimer);
      view.destroy();
    },
  };
}
```

- [ ] **Step 2: Syntax-check the module graph resolves (no DOM execution)**

```bash
node --input-type=module -e "
import('./aws/js/cfn-editor.js')
  .then(() => console.log('imports OK'))
  .catch((e) => console.log(/document|window|navigator/.test(String(e)) ? 'imports OK (DOM-only failure)' : 'FAIL: ' + e));
"
```

Expected: `imports OK` (or the DOM-only variant). Anything else is a real import/syntax error — fix it.

- [ ] **Step 3: Commit**

```bash
git add aws/js/cfn-editor.js
git commit -m "Add the CodeMirror CFN editor glue (lint, hover docs, completion)"
```

---

### Task 7: Slim `arch-canvas.js` to a read-only renderer

**Files:**
- Rewrite: `aws/js/arch-canvas.js` (833 lines → ~230)
- Modify: `aws/js/lib/archCanvasRules.js` (keep only `derivedEdges` + its imports)
- Modify: `aws/js/lib/archCanvasRules.test.mjs` (drop tests for removed exports)

**Interfaces:**
- Consumes: `./lib/html.js` (`escapeHtml`), `./lib/archModel.js` (`AZS, isPublicSubnet, effectiveRouteTable`), `./lib/archCanvasRules.js` (`derivedEdges`).
- Produces: `renderCanvas(mount, { arch, highlightId, stale, onNodeClick })` — `highlightId` is a MODEL id (subnet/nat/workload/sg) or null; `stale` is `{ errors: n }` or null; `onNodeClick(modelId)`. `unmountCanvas()` clears module refs. Editing exports (`clickToAdd`) are gone; `archCanvasRules` no longer exports `canDrop`, `addSubnetRoute`, `ensureWorkloadSg`.

- [ ] **Step 1: Confirm nothing else imports the exports being deleted**

```bash
grep -rn "canDrop\|addSubnetRoute\|ensureWorkloadSg\|clickToAdd\|unmountCanvas" aws/js --include='*.js' --include='*.mjs' | grep -v archCanvasRules
```

Expected: hits only in `arch-canvas.js`, `arch-challenge.js` (rewritten next task), and the rules test file. If anything else shows up, stop and reassess.

- [ ] **Step 2: Trim `aws/js/lib/archCanvasRules.js`**

Keep the file header (reworded), the `derivedEdges` function and only the imports it uses. The full new file:

```js
// aws/js/lib/archCanvasRules.js
//
// Pure decision logic behind the read-only architecture diagram: which
// arrows to draw, derived from the model (routes and security-group
// rules), never stored. The canvas DOM defers every judgment call here so
// it stays testable under node --test.

import { getSecurityGroup, effectiveRouteTable } from './archModel.js';
import { parseCidrStrict } from './vpcMath.js';

// Arrows are always derived from the model, never stored. Route edges come
// from each subnet's EFFECTIVE table (a shared table fans out one edge per
// associated subnet — each subnet genuinely has that route); SG-rule edges
// come from rules on each workload's attached SGs, with external CIDR
// sources rendered from the Internet node.
export function derivedEdges(arch) {
  const edges = [];
  for (const subnet of arch.subnets) {
    const rt = effectiveRouteTable(arch, subnet.id);
    if (!rt) continue;
    rt.routes.forEach((route, index) => {
      if (route.target === 'igw') {
        edges.push({
          from: { type: 'subnet', id: subnet.id }, to: { type: 'igw' },
          kind: 'route', label: route.destCidr,
          fact: { kind: 'route', rtbId: rt.id, index },
        });
      } else if (typeof route.target === 'string' && route.target.startsWith('nat:')) {
        edges.push({
          from: { type: 'subnet', id: subnet.id }, to: { type: 'nat', id: route.target.slice(4) },
          kind: 'route', label: route.destCidr,
          fact: { kind: 'route', rtbId: rt.id, index },
        });
      }
    });
  }
  for (const wl of arch.workloads) {
    for (const sgId of wl.sgIds) {
      const sg = getSecurityGroup(arch, sgId);
      if (!sg) continue;
      sg.inbound.forEach((rule, index) => {
        const portLabel = rule.portFrom === rule.portTo ? `TCP ${rule.portFrom}` : `TCP ${rule.portFrom}–${rule.portTo}`;
        const fact = { kind: 'sg-rule', sgId, index };
        if (rule.source.startsWith('sg:')) {
          const srcSgId = rule.source.slice(3);
          for (const src of arch.workloads) {
            if (src.sgIds.includes(srcSgId)) {
              edges.push({ from: { type: 'workload', id: src.id }, to: { type: 'workload', id: wl.id }, kind: 'sg-rule', label: portLabel, fact });
            }
          }
        } else if (rule.source === '0.0.0.0/0') {
          edges.push({ from: { type: 'internet' }, to: { type: 'workload', id: wl.id }, kind: 'sg-rule', label: portLabel, fact });
        } else if (parseCidrStrict(rule.source)) {
          edges.push({ from: { type: 'internet' }, to: { type: 'workload', id: wl.id }, kind: 'sg-rule', label: `${rule.source} → ${portLabel}`, fact });
        }
      });
    }
  }
  return edges;
}
```

In `aws/js/lib/archCanvasRules.test.mjs`, delete every `test(...)` block that exercises `canDrop`, `addSubnetRoute`, or `ensureWorkloadSg`, and remove them from the import list; keep all `derivedEdges` tests unchanged.

- [ ] **Step 3: Rewrite `aws/js/arch-canvas.js`**

```js
// aws/js/arch-canvas.js
//
// Read-only renderer for the Architecture Challenge diagram. The CFN
// template (cfn-editor.js) is the only input surface; this module renders
// the compiled model — layout, chips, derived arrows — and reports node
// clicks so the page can jump the editor to a resource's definition.
// Rendering is stateless per call except for the module-level refs the
// once-attached resize handler needs to redraw arrows.

import { escapeHtml } from './lib/html.js';
import { AZS, isPublicSubnet, effectiveRouteTable } from './lib/archModel.js';
import { derivedEdges } from './lib/archCanvasRules.js';

// Live refs for the once-per-page resize handler: window resizes (e.g. the
// workbench grid collapsing at its breakpoint) move every node, so arrows
// must be redrawn from fresh getBoundingClientRect calls.
let lastMount = null;
let lastArgs = null;
let resizeWired = false;
let resizeTimer = null;

export function renderCanvas(mount, args) {
  lastMount = mount;
  lastArgs = args;
  const { arch, highlightId, stale } = args;
  const hl = (id) => (highlightId === id ? 'cv-hl' : '');
  const chip = (id, label) =>
    `<span class="cv-chip ${hl(id)}" data-id="${escapeHtml(id)}">${escapeHtml(label)}</span>`;

  const azsInUse = AZS.filter((az) => arch.subnets.some((s) => s.az === az));
  const azCols = azsInUse.map((az) => {
    const cards = arch.subnets.filter((s) => s.az === az).map((s) => {
      const nodes = [
        ...arch.natGateways.filter((n) => n.subnetId === s.id).map((n) => chip(n.id, `NAT ${n.id}`)),
        ...arch.workloads.filter((w) => w.subnetIds.includes(s.id)).map((w) =>
          chip(w.id, `${w.type.toUpperCase()} ${w.name}${w.publicIp ? ' ⬆' : ''}`)),
      ].join('');
      const pub = isPublicSubnet(arch, s.id);
      const rt = effectiveRouteTable(arch, s.id);
      return `
        <div class="cv-subnet ${pub ? 'is-public' : 'is-private'} ${hl(s.id)}" data-id="${escapeHtml(s.id)}">
          <strong>${escapeHtml(s.name)}</strong> <span class="cidr">${escapeHtml(s.cidr)}</span>
          <span class="arch-mini">${pub ? 'public' : 'private'} · ${escapeHtml(rt ? rt.name : '?')}</span>
          <div>${nodes}</div>
        </div>`;
    }).join('');
    return `<div class="cv-az"><h4>AZ ${escapeHtml(az)}</h4>${cards}</div>`;
  }).join('');

  const unplaced = arch.workloads.filter((w) => w.subnetIds.length === 0).map((w) =>
    chip(w.id, `${w.type.toUpperCase()} ${w.name} (unplaced)`)).join('');
  const tray = arch.securityGroups.map((g) =>
    chip(g.id, `SG ${g.name} (${g.inbound.length})`)).join('');

  mount.innerHTML = `
    <h2>Architecture</h2>
    <p class="arch-mini">Rendered live from your template. Click a node to jump to its definition.</p>
    <div class="cv-surface ${stale ? 'cv-stale' : ''}">
      ${stale ? `<span class="cv-stale-badge">template has ${Number(stale.errors)} error${Number(stale.errors) === 1 ? '' : 's'} — showing last valid design</span>` : ''}
      <div class="cv-internet">🌐 Internet</div>
      <div class="cv-vpc">
        <span class="cv-igw-chip ${arch.vpc.igwAttached ? 'attached' : ''}" data-igw>
          IGW ${arch.vpc.igwAttached ? 'attached' : 'not attached'}</span>
        <span class="cidr">VPC ${escapeHtml(arch.vpc.cidr)}</span>
        ${azsInUse.length
          ? `<div class="cv-az-grid">${azCols}</div>`
          : '<p class="arch-mini">No subnets yet — declare AWS::EC2::Subnet resources in the template.</p>'}
      </div>
      ${unplaced ? `<p class="arch-mini">Unplaced: ${unplaced}</p>` : ''}
      <div class="cv-tray"><span class="arch-mini">Security groups:</span> ${tray || '<span class="arch-mini">none yet</span>'}</div>
      <svg id="arch-edges" aria-hidden="true"></svg>
    </div>
    <p class="cv-legend arch-mini">
      <svg class="cv-legend-line" viewBox="0 0 20 8" aria-hidden="true"><line x1="1" y1="4" x2="19" y2="4" class="route"></line></svg>
      route (where a subnet's traffic goes)
      <span aria-hidden="true">·</span>
      <svg class="cv-legend-line" viewBox="0 0 20 8" aria-hidden="true"><line x1="1" y1="4" x2="19" y2="4" class="sg-rule"></line></svg>
      security-group rule (allowed inbound traffic)
    </p>
    <p class="arch-mini">Simplification: security groups are inbound-only here; outbound is allow-all.</p>`;

  drawEdges(mount, arch);
  wireClicks(mount);
}

// Called by the host page when navigating back to the landing list, so the
// resize handler sees "no canvas mounted" and no-ops.
export function unmountCanvas() {
  lastMount = null;
  lastArgs = null;
}

// Clamps a ray from a rectangle's center toward another point to that
// rectangle's own border (a simple line/box intersection: scale the
// direction vector so it lands on whichever half-extent it reaches first),
// so edge lines start/stop at box borders instead of crossing interiors.
// The parameter t along the segment MUST be clamped to [0, 1]: an
// unclamped t can exceed 1 whenever the two elements are close together or
// overlapping relative to their own size, which would shoot the point past
// the segment; clamping pins degenerate/overlapping boxes (including a
// true zero-length segment, where both scales are Infinity) to the plain
// center-to-center line rather than a NaN or an overshoot.
function clampToBorder(cx, cy, dx, dy, halfW, halfH) {
  const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const t = Math.min(scaleX, scaleY, 1);
  return { x: cx + dx * t, y: cy + dy * t };
}

// Route edges store just the destination CIDR as `label`; build the fuller
// pill text from the edge's resolved `to` ref. SG-rule edges already carry
// their full text in `label`.
function edgeLabelText(edge) {
  if (edge.kind !== 'route') return edge.label;
  const dest = edge.to.type === 'igw' ? 'IGW' : `NAT ${edge.to.id}`;
  return `${edge.label} → ${dest}`;
}

// Arrows between element edges (not centers), in cv-surface coords, each
// carrying a midpoint label pill so its meaning reads without a hover. The
// invisible fat .hit companion path exists only to give the <title>
// tooltip a hoverable stroke.
function drawEdges(mount, arch) {
  const svg = mount.querySelector('#arch-edges');
  const surface = mount.querySelector('.cv-surface');
  const surfaceBox = surface.getBoundingClientRect();
  const anchor = (r) => {
    let el = null;
    if (r.type === 'igw') el = surface.querySelector('[data-igw]');
    else if (r.type === 'internet') el = surface.querySelector('.cv-internet');
    else el = surface.querySelector(`[data-id="${CSS.escape(r.id)}"]`);
    return el ? el.getBoundingClientRect() : null;
  };
  const paths = [];
  const labels = [];
  derivedEdges(arch).forEach((edge) => {
    const a = anchor(edge.from);
    const b = anchor(edge.to);
    if (!a || !b) return;
    const ax = a.left + a.width / 2 - surfaceBox.left;
    const ay = a.top + a.height / 2 - surfaceBox.top;
    const bx = b.left + b.width / 2 - surfaceBox.left;
    const by = b.top + b.height / 2 - surfaceBox.top;
    const start = clampToBorder(ax, ay, bx - ax, by - ay, a.width / 2, a.height / 2);
    const end = clampToBorder(bx, by, ax - bx, ay - by, b.width / 2, b.height / 2);
    const d = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    // Offset the label perpendicular to the line so its pill sits beside
    // the line rather than centered on top of it.
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy) || 1;
    const offset = 9;
    const mx = (start.x + end.x) / 2 + (-dy / len) * offset;
    const my = (start.y + end.y) / 2 + (dx / len) * offset;
    paths.push(`<path class="${edge.kind}" d="${d}" marker-end="url(#cv-arrow)"></path>`);
    paths.push(`<path class="hit" d="${d}"><title>${escapeHtml(edge.label)}</title></path>`);
    labels.push({ kind: edge.kind, x: mx, y: my, text: edgeLabelText(edge) });
  });
  svg.innerHTML = `
    <defs><marker id="cv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"></path></marker></defs>
    ${paths.join('')}
    ${labels.map((l) => `<text class="cv-edge-label ${l.kind}" data-kind="${l.kind}" x="${l.x}" y="${l.y}"
      text-anchor="middle" dominant-baseline="middle" pointer-events="none">${escapeHtml(l.text)}</text>`).join('')}`;
  // Second pass: an opaque background rect sized to each label's measured
  // text (only known once the <text> is laid out), inserted right before
  // it so the pill reads clearly over lines/cards.
  svg.querySelectorAll('text.cv-edge-label').forEach((textEl) => {
    const box = textEl.getBBox();
    const padX = 4;
    const padY = 3;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', `cv-edge-label-bg ${textEl.dataset.kind}`);
    rect.setAttribute('x', box.x - padX);
    rect.setAttribute('y', box.y - padY);
    rect.setAttribute('width', box.width + padX * 2);
    rect.setAttribute('height', box.height + padY * 2);
    rect.setAttribute('rx', 3);
    rect.setAttribute('pointer-events', 'none');
    textEl.before(rect);
  });
}

// mount.innerHTML is replaced every render but the mount element persists,
// so the delegated click listener attaches once and reads lastArgs for the
// live callback.
function wireClicks(mount) {
  if (mount.dataset.cvWired) return;
  mount.dataset.cvWired = '1';
  mount.addEventListener('click', (event) => {
    const nodeEl = event.target.closest('[data-id]');
    if (nodeEl && lastArgs && lastArgs.onNodeClick) lastArgs.onNodeClick(nodeEl.dataset.id);
  });
  if (!resizeWired) {
    resizeWired = true;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!lastArgs || !lastMount || !lastMount.isConnected) return;
        drawEdges(lastMount, lastArgs.arch);
      }, 100);
    });
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test aws/js/lib/*.test.mjs aws/js/data/*.test.mjs`
Expected: all pass (the trimmed `archCanvasRules.test.mjs` included). The page is broken at this moment (`arch-challenge.js` still imports the old canvas API) — that is expected mid-plan; Task 8 fixes it before anything is verified in a browser.

- [ ] **Step 5: Commit**

```bash
git add aws/js/arch-canvas.js aws/js/lib/archCanvasRules.js aws/js/lib/archCanvasRules.test.mjs
git commit -m "Slim the canvas to a read-only renderer of the compiled model"
```

---

### Task 8: Orchestrator + page layout

**Files:**
- Rewrite: `aws/js/arch-challenge.js`
- Modify: `aws/architecture-challenge.html` (workbench markup + styles)

**Interfaces:**
- Consumes: everything above — `compile` (Task 3), `emit` (Task 4), `getArchCfnText/setArchCfnText/clearArchCfnText` (Task 5), `createCfnEditor` (Task 6), `renderCanvas/unmountCanvas` (Task 7), plus unchanged `validateStructure`, `evaluateBestPractices`, `evaluateGoals`, `ARCH_CHALLENGES`, `createStore`, `createArch`, `escapeHtml`.
- Produces: the working page.

- [ ] **Step 1: Rewrite `aws/js/arch-challenge.js`**

```js
// aws/js/arch-challenge.js
//
// Standalone page logic for architecture-challenge.html. Not part of the
// hash-router SPA and not in scripts/check-drift.mjs's SHARED list. The
// CloudFormation template text is the single source of truth: every edit
// compiles (js/lib/cfnCompile.js) into the arch model that the read-only
// canvas renders and Check validates; startState/refSolution model
// builders enter this world through js/lib/cfnEmit.js. All model logic
// lives in js/lib/ (pure, node --test covered); this file only wires the
// editor, the diagram, and the task panel together.

import { escapeHtml } from './lib/html.js';
import { createStore } from './lib/storage.js';
import { ARCH_CHALLENGES } from './data/archChallenges.js';
import { createArch } from './lib/archModel.js';
import { validateStructure, evaluateBestPractices } from './lib/archValidate.js';
import { evaluateGoals } from './lib/archGoals.js';
import { compile } from './lib/cfnCompile.js';
import { emit } from './lib/cfnEmit.js';
import { renderCanvas, unmountCanvas } from './arch-canvas.js';
import { createCfnEditor } from './cfn-editor.js';

const store = createStore();

const SANDBOX = {
  id: 'sandbox',
  title: 'Sandbox',
  brief: 'Free build: no goals, no grading. Structural checks and every best-practice '
    + 'rule run against whatever you design. Security groups model inbound rules only '
    + '(outbound is treated as allow-all).',
  roles: [],
  goals: [],
  bestPractices: 'all',
  hints: [],
  startState: null,
  refSolution: null,
};

let challenge = null;   // null = landing
let compiled = { arch: null, diagnostics: [], sourceMap: {}, idMap: null, kinds: {} };
let lastGoodArch = createArch(); // diagram fallback while the template has errors
let lastGoodIdMap = null;
let checkDiagnostics = [];      // Check-time structural errors mapped onto the text
let results = null;             // { errors, goalRows, bpRows } from the last Check
let hintsShown = 0;
let failedChecks = 0;
let highlightId = null;         // model id of the resource under the editor cursor
let editor = null;

function findChallenge(id) {
  if (id === 'sandbox') return SANDBOX;
  return ARCH_CHALLENGES.find((c) => c.id === id) || null;
}

function startText() {
  return emit(challenge.startState ? challenge.startState() : createArch());
}

// The draft is YAML text. Legacy visual-builder drafts (JSON models) are
// migrated by serializing them once, then cleared so this runs only once.
function draftText() {
  const text = store.getArchCfnText(challenge.id);
  if (text !== null) return text;
  const legacy = store.getArchDraft(challenge.id);
  if (legacy) {
    const migrated = emit(legacy);
    store.setArchCfnText(challenge.id, migrated);
    store.clearArchDraft(challenge.id);
    return migrated;
  }
  return startText();
}

function errorCount() {
  return compiled.diagnostics.filter((d) => d.severity === 'error').length;
}

function recompile(text) {
  compiled = compile(text);
  checkDiagnostics = []; // stale the moment the text changes
  if (compiled.arch) {
    lastGoodArch = compiled.arch;
    lastGoodIdMap = compiled.idMap;
  }
}

function ensureEditor() {
  if (editor) return;
  editor = createCfnEditor(document.getElementById('arch-editor-host'), {
    initialText: '',
    getDiagnostics: () => [...compiled.diagnostics, ...checkDiagnostics],
    getCompile: () => compiled,
    getRoles: () => (challenge ? challenge.roles.map((r) => r.id) : []),
    onDocChange: (text) => {
      if (!challenge) return; // debounce survivor after navigating to landing
      recompile(text);
      store.setArchCfnText(challenge.id, text); // text autosaves even while invalid
      results = null;
      renderDiagram();
      renderTask(document.getElementById('arch-task'));
    },
    onCursorResource: (logicalId) => {
      const idMap = compiled.idMap || lastGoodIdMap;
      highlightId = idMap && logicalId ? idMap.logicalToModel[logicalId] || null : null;
      if (challenge) renderDiagram();
    },
  });
}

// Programmatic text swaps (open/reveal/reset) recompile synchronously —
// setText never fires onDocChange.
function swapText(text) {
  recompile(text);
  store.setArchCfnText(challenge.id, text);
  ensureEditor();
  editor.setText(text);
  results = null;
  highlightId = null;
}

function openFromHash() {
  const id = window.location.hash.replace(/^#\/?/, '');
  challenge = findChallenge(id);
  results = null;
  hintsShown = 0;
  failedChecks = 0;
  highlightId = null;
  checkDiagnostics = [];
  if (challenge) {
    lastGoodArch = createArch();
    lastGoodIdMap = null;
    swapText(draftText());
  }
  renderAll();
}

function renderAll() {
  const landing = document.getElementById('arch-landing');
  const workbench = document.getElementById('arch-workbench');
  landing.hidden = !!challenge;
  workbench.hidden = !challenge;
  if (!challenge) {
    unmountCanvas();
    renderLanding(landing);
    return;
  }
  renderHead(document.getElementById('arch-head'));
  renderDiagram();
  renderTask(document.getElementById('arch-task'));
}

function renderDiagram() {
  renderCanvas(document.getElementById('arch-canvas'), {
    arch: compiled.arch || lastGoodArch,
    highlightId,
    stale: compiled.arch ? null : { errors: errorCount() },
    onNodeClick: (modelId) => {
      const idMap = compiled.idMap || lastGoodIdMap;
      const logicalId = idMap ? idMap.modelToLogical[modelId] : null;
      if (logicalId) editor.revealResource(logicalId);
    },
  });
}

function renderLanding(mount) {
  const done = store.getArchResults();
  const cards = ARCH_CHALLENGES.map((ch, i) => {
    const result = done[ch.id];
    const badge = result
      ? `<p class="badge-done">✓ Completed — best practices ${Number(result.bpPassed)}/${Number(result.bpApplicable) || '–'}</p>`
      : '<p class="arch-mini">Not completed yet</p>';
    const truncated = ch.brief.length > 110 ? `${ch.brief.slice(0, 110)}…` : ch.brief;
    return `
      <a class="arch-card" href="#${ch.id}">
        <h3>${i + 1}. ${escapeHtml(ch.title)}</h3>
        <p class="arch-mini">${escapeHtml(truncated)}</p>
        ${badge}
      </a>`;
  }).join('');
  mount.innerHTML = `
    <p>Each challenge gives you a scenario; write the CloudFormation template that
       satisfies it in a live editor with error checking, docs on hover, and
       autocompletion. The diagram renders your template as you type. Designs are
       checked three ways: <strong>structural</strong> (would AWS accept it),
       <strong>functional</strong> (a connectivity simulation of the scenario's goals), and
       <strong>best practices</strong> (advisory score). Drafts autosave locally.</p>
    <div class="arch-cards">
      ${cards}
      <a class="arch-card" href="#sandbox"><h3>Sandbox</h3>
        <p class="arch-mini">Free build with live structural + best-practice checks. No goals.</p></a>
    </div>`;
}

function renderHead(mount) {
  mount.innerHTML = `
    <p><a href="#">← All challenges</a></p>
    <h2>${escapeHtml(challenge.title)}</h2>
    <p>${escapeHtml(challenge.brief)}</p>`;
}

function runCheck() {
  if (!compiled.arch) return;
  const arch = compiled.arch;
  const { errors } = validateStructure(arch);
  const goalRows = errors.length === 0 ? evaluateGoals(arch, challenge) : null;
  const bpRows = evaluateBestPractices(arch, challenge.bestPractices);
  results = { errors, goalRows, bpRows };
  // Mirror structural errors into the editor where a resource maps back to
  // a template range (best-effort; the panel remains the full list).
  checkDiagnostics = [];
  for (const e of errors) {
    for (const rid of e.resourceIds || []) {
      const logicalId = compiled.idMap.modelToLogical[rid];
      const ranges = logicalId ? compiled.sourceMap[logicalId] : null;
      if (ranges) checkDiagnostics.push({ from: ranges.key[0], to: ranges.key[1], severity: 'error', message: e.message });
    }
  }
  editor.relint();
  const complete = errors.length === 0 && challenge.goals.length > 0
    && goalRows.every((r) => r.ok);
  if (complete && challenge.id !== 'sandbox') {
    const applicable = bpRows.filter((r) => r.applicable);
    store.recordArchResult(challenge.id, {
      completedAt: Date.now(),
      bpPassed: applicable.filter((r) => r.ok).length,
      bpApplicable: applicable.length,
    });
  } else if (!complete) {
    failedChecks += 1;
  }
  renderAll();
}

function renderTask(mount) {
  const arch = compiled.arch || lastGoodArch;
  const rolesHtml = challenge.roles.map((role) => {
    const assigned = arch.workloads.filter((w) => w.role === role.id);
    return `<li>${escapeHtml(role.label)}: ${assigned.length
      ? escapeHtml(assigned.map((w) => w.name).join(', '))
      : '<em>unassigned — add a Role tag</em>'}</li>`;
  }).join('');

  let resultsHtml = '';
  if (results) {
    if (results.errors.length > 0) {
      resultsHtml += `<h3>Structural problems (fix these first)</h3>
        ${results.errors.map((e) => `<div class="arch-goal fail">${escapeHtml(e.message)}</div>`).join('')}`;
    } else if (results.goalRows && results.goalRows.length > 0) {
      const allOk = results.goalRows.every((r) => r.ok);
      resultsHtml += `<h3>Goals ${allOk ? '— all satisfied 🎉' : ''}</h3>`;
      resultsHtml += results.goalRows.map((row) => {
        const traces = row.traces.map((t) => `
          <details ${t.ok ? '' : 'open'}><summary class="arch-mini">${escapeHtml(t.title)}</summary>
            <ul class="arch-trace">${t.trace.map((s) => `<li class="${s.ok ? 'ok' : 'fail'}">${escapeHtml(s.label)}</li>`).join('')}</ul>
          </details>`).join('');
        return `<div class="arch-goal ${row.ok ? 'ok' : 'fail'}">
          ${escapeHtml(row.label)}
          <p class="arch-mini">${escapeHtml(row.detail)}</p>${traces}</div>`;
      }).join('');
    }
    const applicable = results.bpRows.filter((r) => r.applicable);
    if (applicable.length > 0) {
      const passed = applicable.filter((r) => r.ok).length;
      resultsHtml += `<h3>Best practices</h3>
        <p class="arch-score">${passed}/${applicable.length}</p>
        ${applicable.map((r) => `<div class="arch-goal ${r.ok ? 'ok' : 'fail'}">
          ${escapeHtml(r.message)}${r.ok ? '' : `<p class="arch-mini">Why: ${escapeHtml(r.why)}</p>`}</div>`).join('')}`;
    }
  }

  const hintsHtml = challenge.hints.length === 0 ? '' : `
    ${challenge.hints.slice(0, hintsShown).map((h) => `<p class="arch-mini">💡 ${escapeHtml(h)}</p>`).join('')}
    ${hintsShown < challenge.hints.length
      ? `<button type="button" data-action="hint">Hint ${hintsShown + 1}/${challenge.hints.length}</button>` : ''}`;

  const reveal = challenge.refSolution && failedChecks >= 1
    ? '<button type="button" data-action="reveal">Show reference solution</button>' : '';
  const blocked = errorCount() > 0;

  mount.innerHTML = `
    <h2>${challenge.id === 'sandbox' ? 'Checks' : 'Task'}</h2>
    ${challenge.roles.length ? `<ul>${rolesHtml}</ul>` : ''}
    <div class="arch-row">
      <button type="button" data-action="check" ${blocked ? 'disabled' : ''}>Check architecture</button>
      <button type="button" data-action="reset">Reset</button>
      ${reveal}
    </div>
    ${blocked ? '<p class="arch-mini">Fix the template errors (red underlines) to enable Check.</p>' : ''}
    ${results ? resultsHtml : '<p class="arch-mini">Edit the template, then hit Check. Results explain every pass and fail.</p>'}`;
}

window.addEventListener('hashchange', openFromHash);

document.getElementById('arch-task').addEventListener('click', (event) => {
  const el = event.target.closest('button[data-action]');
  if (!el) return;
  if (el.dataset.action === 'check') runCheck();
  if (el.dataset.action === 'hint') { hintsShown += 1; renderAll(); }
  if (el.dataset.action === 'reveal'
      && window.confirm('Replace your current template with the reference solution?')) {
    swapText(emit(challenge.refSolution()));
    renderAll();
  }
  if (el.dataset.action === 'reset'
      && window.confirm('Discard your template and start this challenge over?')) {
    store.clearArchCfnText(challenge.id);
    store.clearArchDraft(challenge.id);
    swapText(startText());
    renderAll();
  }
});

openFromHash();
```

- [ ] **Step 2: Update `aws/architecture-challenge.html`**

Replace the workbench markup (currently the `.arch-workbench` div containing `#arch-canvas` and `#arch-task`) with:

```html
    <section id="arch-workbench" hidden>
      <div id="arch-head"></div>
      <div class="arch-workbench">
        <div class="arch-panel" id="arch-editor-panel" aria-label="CloudFormation template">
          <h2>Template</h2>
          <div id="arch-editor-host"></div>
        </div>
        <div class="arch-col">
          <div class="arch-panel" id="arch-canvas" aria-label="Architecture diagram"></div>
          <div class="arch-panel" id="arch-task" aria-label="Task and results"></div>
        </div>
      </div>
    </section>
```

In the `<style>` block:

1. Change the grid line to:

```css
    .arch-workbench { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 1rem; align-items: start; }
```

2. Add after it:

```css
    .arch-col { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
    #arch-editor-host { height: 72vh; }
    #arch-editor-host .cm-editor { height: 100%; border: 1px solid var(--color-border); border-radius: 6px; }
    #arch-editor-host .cm-scroller { overflow: auto; }
    .cfn-hover { max-width: 380px; font-size: 0.8rem; padding: 0.4rem 0.5rem; }
    .cfn-hover-diag.cfn-error { color: var(--color-danger); }
    .cfn-hover-diag.cfn-warning { color: #b45309; }
    .cfn-hover-doc { color: var(--color-muted); margin-top: 0.25rem; }
    @media (prefers-color-scheme: dark) { .cfn-hover-diag.cfn-warning { color: #fbbf24; } }
```

3. Delete these now-unused rules: `.cv-palette`, `.cv-palette button`, `.cv-ghost`, `.cv-popover`, `.cv-popover .arch-row`, `.cv-drop-ok`, `#arch-inspector`, `button.arch-add`.

4. Adjust: remove `cursor: grab; touch-action: none;` from `.cv-chip`; change `.cv-igw-chip` from `cursor: pointer;` to no cursor rule (it's a `span` now, not a button).

5. Add the highlight/stale styles next to the other `.cv-*` rules:

```css
    .cv-hl { outline: 2px solid var(--color-primary); outline-offset: 1px; }
    .cv-stale { opacity: 0.55; }
    .cv-stale-badge { position: absolute; top: 0.3rem; right: 0.4rem; z-index: 5;
                      background: var(--arch-fail-bg); color: var(--color-danger);
                      border: 1px solid var(--color-danger); border-radius: 6px;
                      padding: 0.15rem 0.5rem; font-size: 0.75rem; }
```

(Note `.cv-stale-badge` is positioned inside `.cv-surface`, which is already `position: relative`.)

- [ ] **Step 3: Run the full suite + drift check**

Run: `node --test aws/js/lib/*.test.mjs aws/js/data/*.test.mjs && node scripts/check-drift.mjs`
Expected: all pass, no drift.

- [ ] **Step 4: Commit**

```bash
git add aws/js/arch-challenge.js aws/architecture-challenge.html
git commit -m "Wire the CFN editor workbench: template left, live diagram and checks right"
```

---

### Task 9: Browser verification, docs, and copy

**Files:**
- Modify: `aws/README.md` (line 26, the Architecture Challenge bullet)
- No other planned source changes — this task verifies and fixes.

- [ ] **Step 1: Update `aws/README.md`**

Replace the Architecture Challenge bullet (line 26) with:

```markdown
- **[Architecture Challenge](architecture-challenge.html)** — a standalone CloudFormation-authoring game (linked from Home): each challenge hands you a scenario (public web server, 3-tier HA app, broken-architecture fix-it…), you write the CloudFormation template in a rich editor (live error squiggles, docs on hover, autocompletion), a diagram renders your template as you type, and your VPC design is validated three ways — structural correctness, a connectivity simulation of the scenario's goals, and a best-practice score with explanations.
```

- [ ] **Step 2: Start the preview and hard-load the page**

Use the browser-pane tooling with the existing `aws-site` launch config. The preview browser heuristically caches modules served by `python3 -m http.server`; ALWAYS load with a cache-busting query and take a screenshot first (the embedded pane's viewport can collapse to 0x0 until a screenshot forces layout):

- `preview_start {name: "aws-site"}` → navigate to `http://localhost:8000/architecture-challenge.html?fresh=<timestamp>`.
- Screenshot, then check `read_console_messages` for errors. Fix any before proceeding.

- [ ] **Step 3: Verify the IntelliJ behaviors (the screenshot scenario)**

1. Open `#public-web` from the landing. Expect: editor on the left with the emitted VPC-only skeleton; diagram right; Check enabled.
2. Select-all in the editor and type the screenshot's template (`DummyServer` with `Type: AWS::EC2::Instanc`). Expect within ~1s: red squiggle under `AWS::EC2::Instanc`, a gutter marker, diagram dimmed with the "template has N errors" badge, Check disabled.
3. Hover the bad type: tooltip shows `Unknown CloudFormation resource type: AWS::EC2::Instanc` and `No documentation found.` Screenshot this — it is the acceptance image.
4. Fix to `AWS::EC2::Instance`: the unknown-type error is replaced by missing-required-property errors (`ImageId`, `SubnetId`) — proves live re-lint.
5. Type `Type: AWS::EC2::S` somewhere: the autocomplete dropdown lists `AWS::EC2::Subnet`, `AWS::EC2::SecurityGroup`, `AWS::EC2::SubnetRouteTableAssociation`. Screenshot.
6. Hover `AWS::EC2::VPC` on the skeleton: doc tooltip appears (study text, not "No documentation found").

- [ ] **Step 4: Verify the play loop end-to-end**

1. Still in `#public-web`: press Check (on the skeleton) → goals fail; "Show reference solution" appears after the failed check.
2. Reveal the reference solution → editor fills with emitted YAML; diagram shows subnet/IGW/SG/instance with arrows and label pills; cursor inside the `Web1` resource highlights its chip (`cv-hl`).
3. Click the subnet card in the diagram → editor scrolls to and selects the subnet's logical id line.
4. Press Check → all goals green 🎉, best-practices score renders, landing card shows Completed on return.
5. Reload the page (cache-busted) → the revealed template text persists (text draft autosave).
6. Reset → confirm dialog → skeleton text returns.
7. `#sandbox` → VPC-only skeleton, Checks panel (no goals). `#fix-broken` → its start state emits with the planted flaws visible in YAML.

- [ ] **Step 5: Verify legacy-draft migration**

In the browser console (via `javascript_tool`):

```js
localStorage.removeItem('saa-prep:arch-cfn:two-tier');
localStorage.setItem('saa-prep:arch-draft:two-tier', JSON.stringify({
  vpc: { cidr: '10.0.0.0/16', igwAttached: true },
  subnets: [{ id: 'subnet-1', name: 'legacy-a', az: 'a', cidr: '10.0.1.0/24' }],
  natGateways: [], routeTables: [{ id: 'rtb-main', name: 'main', isMain: true, routes: [], subnetIds: [] }],
  securityGroups: [], workloads: [], counters: { subnet: 1, nat: 0, rtb: 0, sg: 0, wl: 0 },
}));
```

Navigate to `#two-tier`. Expect: the editor shows YAML containing `legacy-a`, `localStorage.getItem('saa-prep:arch-cfn:two-tier')` is non-null, and `saa-prep:arch-draft:two-tier` is gone.

- [ ] **Step 6: Responsive + dark mode spot-check**

`resize_window` to ~900px wide: editor stacks above diagram above task (add `@media (max-width: 1100px) { .arch-workbench { grid-template-columns: 1fr; } }` — it already exists; confirm it still applies). Switch `colorScheme: "dark"`: editor background/gutters/tooltips follow the dark palette.

- [ ] **Step 7: Fix anything found, re-run suite, commit**

Diagnose via source, fix source, re-verify (steps 3–6 as affected). Then:

```bash
node --test aws/js/lib/*.test.mjs aws/js/data/*.test.mjs && node scripts/check-drift.mjs
git add -A
git commit -m "Verify the CFN workbench in-browser; update the module README"
```

---

## Self-review checklist (run after writing, before execution)

- Spec coverage: layout ✓ (T8), vendoring ✓ (T1), schema+docs ✓ (T2), compiler+diagnostics catalog ✓ (T3), emitter+normalizations ✓ (T4), storage+drift ✓ (T5), editor richness ✓ (T6), canvas slimming ✓ (T7), orchestrator/draft/migration/check/reveal/reset ✓ (T8), landing+README copy ✓ (T8/T9), round-trip + goals regression ✓ (T4), browser verification ✓ (T9).
- Type consistency: `compile` result keys (`arch, diagnostics, sourceMap, idMap, kinds`) match their consumers in Tasks 6 and 8; storage method names match between Tasks 5 and 8; `renderCanvas` args match between Tasks 7 and 8.
