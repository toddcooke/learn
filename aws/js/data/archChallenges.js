// aws/js/data/archChallenges.js
//
// Challenge definitions for the Architecture Challenge page. startState and
// refSolution are FUNCTIONS returning fresh architecture state built with
// the same archModel mutators the UI uses — never shared objects (the UI
// mutates what it loads) and never serialized. Every challenge's
// refSolution is proven by js/data/archChallenges.test.mjs to validate
// clean, pass all its goals, and pass its selected best practices.

import {
  createArch, addSubnet, addNat, addRouteTable, addRoute, associateSubnet,
  addSecurityGroup, addSgRule, addWorkload,
} from '../lib/archModel.js';

// Shared fixture: /16 VPC with an attached IGW and a "public" route table
// (0.0.0.0/0 → igw). Returns { arch, publicRt }.
function vpcWithIgw() {
  const arch = createArch();
  arch.vpc.igwAttached = true;
  const publicRt = addRouteTable(arch, 'public');
  addRoute(arch, publicRt.id, { destCidr: '0.0.0.0/0', target: 'igw' });
  return { arch, publicRt };
}

function publicWebSolution() {
  const { arch, publicRt } = vpcWithIgw();
  const s = addSubnet(arch, { name: 'public-a', az: 'a', cidr: '10.0.1.0/24' });
  associateSubnet(arch, publicRt.id, s.id);
  const sg = addSecurityGroup(arch, 'web-sg');
  addSgRule(arch, sg.id, { portFrom: 80, source: '0.0.0.0/0' });
  addWorkload(arch, {
    type: 'ec2', name: 'web-1', role: 'web',
    subnetIds: [s.id], sgIds: [sg.id], publicIp: true, port: 80,
  });
  return arch;
}

function privateEgressSolution() {
  const { arch, publicRt } = vpcWithIgw();
  const pub = addSubnet(arch, { name: 'public-a', az: 'a', cidr: '10.0.1.0/24' });
  associateSubnet(arch, publicRt.id, pub.id);
  const priv = addSubnet(arch, { name: 'private-a', az: 'a', cidr: '10.0.2.0/24' });
  const nat = addNat(arch, pub.id);
  addRoute(arch, 'rtb-main', { destCidr: '0.0.0.0/0', target: `nat:${nat.id}` });
  const sg = addSecurityGroup(arch, 'worker-sg'); // no inbound: nothing needs in
  addWorkload(arch, {
    type: 'ec2', name: 'worker-1', role: 'worker',
    subnetIds: [priv.id], sgIds: [sg.id], publicIp: false,
  });
  return arch;
}

function twoTierSolution() {
  const { arch, publicRt } = vpcWithIgw();
  const pub = addSubnet(arch, { name: 'public-a', az: 'a', cidr: '10.0.1.0/24' });
  associateSubnet(arch, publicRt.id, pub.id);
  const dbA = addSubnet(arch, { name: 'db-a', az: 'a', cidr: '10.0.2.0/24' });
  const dbB = addSubnet(arch, { name: 'db-b', az: 'b', cidr: '10.0.3.0/24' });
  const webSg = addSecurityGroup(arch, 'web-sg');
  addSgRule(arch, webSg.id, { portFrom: 443, source: '0.0.0.0/0' });
  const dbSg = addSecurityGroup(arch, 'db-sg');
  addSgRule(arch, dbSg.id, { portFrom: 5432, source: `sg:${webSg.id}` });
  addWorkload(arch, {
    type: 'ec2', name: 'web-1', role: 'web',
    subnetIds: [pub.id], sgIds: [webSg.id], publicIp: true, port: 443,
  });
  addWorkload(arch, {
    type: 'rds', name: 'app-db', role: 'db',
    subnetIds: [dbA.id, dbB.id], sgIds: [dbSg.id],
  });
  return arch;
}

function haWebSolution() {
  const { arch, publicRt } = vpcWithIgw();
  const pubA = addSubnet(arch, { name: 'public-a', az: 'a', cidr: '10.0.1.0/24' });
  const pubB = addSubnet(arch, { name: 'public-b', az: 'b', cidr: '10.0.2.0/24' });
  associateSubnet(arch, publicRt.id, pubA.id);
  associateSubnet(arch, publicRt.id, pubB.id);
  const privA = addSubnet(arch, { name: 'web-a', az: 'a', cidr: '10.0.11.0/24' });
  const privB = addSubnet(arch, { name: 'web-b', az: 'b', cidr: '10.0.12.0/24' });
  const albSg = addSecurityGroup(arch, 'alb-sg');
  addSgRule(arch, albSg.id, { portFrom: 443, source: '0.0.0.0/0' });
  const webSg = addSecurityGroup(arch, 'web-sg');
  addSgRule(arch, webSg.id, { portFrom: 80, source: `sg:${albSg.id}` });
  addWorkload(arch, {
    type: 'alb', name: 'web-alb', role: 'lb',
    subnetIds: [pubA.id, pubB.id], sgIds: [albSg.id], port: 443,
  });
  addWorkload(arch, {
    type: 'ec2', name: 'web-1', role: 'web',
    subnetIds: [privA.id], sgIds: [webSg.id], port: 80,
  });
  addWorkload(arch, {
    type: 'ec2', name: 'web-2', role: 'web',
    subnetIds: [privB.id], sgIds: [webSg.id], port: 80,
  });
  return arch;
}

function threeTierSolution() {
  const { arch, publicRt } = vpcWithIgw();
  const pubA = addSubnet(arch, { name: 'public-a', az: 'a', cidr: '10.0.1.0/24' });
  const pubB = addSubnet(arch, { name: 'public-b', az: 'b', cidr: '10.0.2.0/24' });
  associateSubnet(arch, publicRt.id, pubA.id);
  associateSubnet(arch, publicRt.id, pubB.id);
  const appA = addSubnet(arch, { name: 'app-a', az: 'a', cidr: '10.0.11.0/24' });
  const appB = addSubnet(arch, { name: 'app-b', az: 'b', cidr: '10.0.12.0/24' });
  const dbA = addSubnet(arch, { name: 'db-a', az: 'a', cidr: '10.0.21.0/24' });
  const dbB = addSubnet(arch, { name: 'db-b', az: 'b', cidr: '10.0.22.0/24' });
  const natA = addNat(arch, pubA.id);
  const natB = addNat(arch, pubB.id);
  const rtA = addRouteTable(arch, 'private-a');
  addRoute(arch, rtA.id, { destCidr: '0.0.0.0/0', target: `nat:${natA.id}` });
  associateSubnet(arch, rtA.id, appA.id);
  associateSubnet(arch, rtA.id, dbA.id);
  const rtB = addRouteTable(arch, 'private-b');
  addRoute(arch, rtB.id, { destCidr: '0.0.0.0/0', target: `nat:${natB.id}` });
  associateSubnet(arch, rtB.id, appB.id);
  associateSubnet(arch, rtB.id, dbB.id);
  const albSg = addSecurityGroup(arch, 'alb-sg');
  addSgRule(arch, albSg.id, { portFrom: 443, source: '0.0.0.0/0' });
  const appSg = addSecurityGroup(arch, 'app-sg');
  addSgRule(arch, appSg.id, { portFrom: 8080, source: `sg:${albSg.id}` });
  const dbSg = addSecurityGroup(arch, 'db-sg');
  addSgRule(arch, dbSg.id, { portFrom: 5432, source: `sg:${appSg.id}` });
  addWorkload(arch, {
    type: 'alb', name: 'app-alb', role: 'lb',
    subnetIds: [pubA.id, pubB.id], sgIds: [albSg.id], port: 443,
  });
  addWorkload(arch, {
    type: 'ec2', name: 'app-1', role: 'app',
    subnetIds: [appA.id], sgIds: [appSg.id], port: 8080,
  });
  addWorkload(arch, {
    type: 'ec2', name: 'app-2', role: 'app',
    subnetIds: [appB.id], sgIds: [appSg.id], port: 8080,
  });
  addWorkload(arch, {
    type: 'rds', name: 'app-db', role: 'db',
    subnetIds: [dbA.id, dbB.id], sgIds: [dbSg.id], multiAz: true,
  });
  return arch;
}

export const ARCH_CHALLENGES = [
  {
    id: 'public-web',
    title: 'Public web server',
    brief: 'Your team is launching a simple marketing site on a single EC2 instance. '
      + 'Visitors on the internet must be able to reach it over HTTP (port 80). '
      + 'Build the smallest VPC setup that makes the instance publicly reachable.',
    roles: [{ id: 'web', label: 'web server', expectedType: 'ec2' }],
    startState: null,
    goals: [
      { type: 'exists', role: 'web', workloadType: 'ec2' },
      { type: 'internetReaches', role: 'web', port: 80 },
    ],
    bestPractices: ['no-open-ssh', 'least-privilege-sg', 'unused-resources'],
    hints: [
      'Internet traffic can only enter a VPC through an internet gateway — attach one first.',
      'A subnet is "public" when its route table sends 0.0.0.0/0 to the internet gateway.',
      'The instance needs a public IP, and its security group must allow TCP 80 from 0.0.0.0/0.',
    ],
    refSolution: publicWebSolution,
  },
  {
    id: 'private-egress',
    title: 'Private worker with NAT egress',
    brief: 'A batch worker needs to call external APIs and pull OS updates, but it must '
      + 'not be reachable from the internet — no public IP, no inbound exposure. '
      + 'Give it outbound-only internet access.',
    roles: [{ id: 'worker', label: 'worker instance', expectedType: 'ec2' }],
    startState: null,
    goals: [
      { type: 'exists', role: 'worker', workloadType: 'ec2' },
      { type: 'hasEgress', role: 'worker' },
      { type: 'noInternetReach', role: 'worker' },
    ],
    bestPractices: ['least-privilege-sg', 'unused-resources'],
    hints: [
      'You need two subnets: a public one (for the NAT gateway) and a private one (for the worker).',
      'The NAT gateway itself must sit in the PUBLIC subnet — it needs the IGW to pass traffic out.',
      "Route the private subnet's 0.0.0.0/0 to the NAT gateway, and leave the worker without a public IP.",
    ],
    refSolution: privateEgressSolution,
  },
  {
    id: 'two-tier',
    title: 'Two-tier web + database',
    brief: 'A web app takes HTTPS traffic from the internet and stores data in PostgreSQL. '
      + 'The web server must be publicly reachable on 443; the database must accept '
      + 'connections only from the web server and never from the internet.',
    roles: [
      { id: 'web', label: 'web server', expectedType: 'ec2' },
      { id: 'db', label: 'database', expectedType: 'rds' },
    ],
    startState: null,
    goals: [
      { type: 'exists', role: 'web', workloadType: 'ec2' },
      { type: 'exists', role: 'db', workloadType: 'rds' },
      { type: 'internetReaches', role: 'web', port: 443 },
      { type: 'reaches', fromRole: 'web', toRole: 'db', port: 5432 },
      { type: 'noInternetReach', role: 'db' },
    ],
    bestPractices: ['db-in-private-subnet', 'no-open-db-port', 'no-open-ssh', 'least-privilege-sg', 'unused-resources'],
    hints: [
      'An RDS DB subnet group needs at least two subnets in two different AZs — keep both private.',
      "Chain security groups: allow 5432 on the DB's SG from the web server's SG, not from a CIDR.",
      'Only the web subnet gets the internet-gateway route; the DB subnets stay on a table without one.',
    ],
    refSolution: twoTierSolution,
  },
  {
    id: 'ha-web',
    title: 'HA web tier behind a load balancer',
    brief: 'Traffic is growing and one instance in one AZ is no longer acceptable. Put an '
      + 'Application Load Balancer in front of a web tier that survives an AZ outage. '
      + 'Only the load balancer may face the internet.',
    roles: [
      { id: 'lb', label: 'load balancer', expectedType: 'alb' },
      { id: 'web', label: 'web tier', expectedType: 'ec2' },
    ],
    startState: null,
    goals: [
      { type: 'exists', role: 'lb', workloadType: 'alb' },
      { type: 'exists', role: 'web', workloadType: 'ec2' },
      { type: 'internetReaches', role: 'lb', port: 443 },
      { type: 'reaches', fromRole: 'lb', toRole: 'web', port: 80 },
      { type: 'noInternetReach', role: 'web' },
      { type: 'spansAzs', role: 'web', min: 2 },
    ],
    bestPractices: ['single-az', 'no-open-ssh', 'least-privilege-sg', 'unused-resources'],
    hints: [
      'An internet-facing ALB needs subnets in at least two AZs — and every one of them must be public.',
      'Web instances go in PRIVATE subnets with no public IPs; the ALB forwards to them over the VPC network.',
      "Allow web port 80 from the ALB's security group; allow 443 on the ALB from 0.0.0.0/0.",
    ],
    refSolution: haWebSolution,
  },
  {
    id: 'three-tier',
    title: 'Three-tier HA application',
    brief: 'The full production build-out: an internet-facing ALB, an application tier '
      + 'across two AZs that can reach the internet for updates, and a Multi-AZ '
      + 'PostgreSQL database. Only the ALB may be exposed to the internet.',
    roles: [
      { id: 'lb', label: 'load balancer', expectedType: 'alb' },
      { id: 'app', label: 'application tier', expectedType: 'ec2' },
      { id: 'db', label: 'database', expectedType: 'rds' },
    ],
    startState: null,
    goals: [
      { type: 'exists', role: 'lb', workloadType: 'alb' },
      { type: 'exists', role: 'app', workloadType: 'ec2' },
      { type: 'exists', role: 'db', workloadType: 'rds' },
      { type: 'internetReaches', role: 'lb', port: 443 },
      { type: 'reaches', fromRole: 'lb', toRole: 'app', port: 8080 },
      { type: 'reaches', fromRole: 'app', toRole: 'db', port: 5432 },
      { type: 'noInternetReach', role: 'app' },
      { type: 'noInternetReach', role: 'db' },
      { type: 'spansAzs', role: 'app', min: 2 },
      { type: 'hasEgress', role: 'app' },
      { type: 'multiAz', role: 'db' },
    ],
    bestPractices: 'all',
    hints: [
      'Six subnets is the classic layout: public, app-private, and db-private — one of each per AZ.',
      'The app tier egresses through NAT gateways — one per AZ, each in that AZ\'s public subnet.',
      'Per-AZ private route tables keep AZ-a subnets on the AZ-a NAT (and likewise for b).',
      'Chain the SGs: internet → alb-sg:443 → app-sg:8080 → db-sg:5432.',
    ],
    refSolution: threeTierSolution,
  },
];
