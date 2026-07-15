# Services Reference Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Services" view to the AWS SAA-C03 exam-prep SPA listing every covered AWS service with a one-sentence description, grouped by domain.

**Architecture:** A new authored data file (`js/data/services.js`) feeds a new static view (`js/views/services.js`), wired into the existing hash router and nav. A new `validateServices()` in `scripts/validate-content.mjs` enforces data shape and a drift guard: every service named in the flashcard deck must be covered by the services page. A small tested lib helper sorts services ignoring the "AWS "/"Amazon " vendor prefix.

**Tech Stack:** Vanilla ES modules (no build step, no dependencies), `node:test` for unit tests, `python3 -m http.server` to serve locally.

**Spec:** `aws/docs/superpowers/specs/2026-07-15-services-reference-page-design.md`

## Global Constraints

- All work happens under `aws/` in the repo; all commands below run from `/Users/toddcooke/IdeaProjects/learn/aws` unless stated otherwise.
- Vanilla JS ES modules only; no new dependencies, no build step.
- All data rendered into HTML goes through `escapeHtml` from `js/lib/html.js`.
- Blurbs are one sentence, 20–220 characters (validator-enforced).
- Service `domain` values must be one of the 7 real `FLASHCARD_DOMAINS` (never `'Best-Fit Scenarios'`).
- Commit messages: imperative mood, no conventional-commit prefix (match `git log`), ending with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- `node --test` and `node scripts/validate-content.mjs` must pass at every commit.

---

### Task 1: Vendor-prefix-aware sort helper (`js/lib/serviceSort.js`)

**Files:**
- Create: `js/lib/serviceSort.js`
- Test: `js/lib/serviceSort.test.mjs`

**Interfaces:**
- Consumes: nothing (pure functions).
- Produces: `bareName(name: string): string` — strips one leading `"AWS "` or `"Amazon "` prefix. `sortByBareName(services: Array<{name: string}>): Array` — returns a new array sorted by `bareName(name)` using `localeCompare`; does not mutate input. Task 3's view imports `sortByBareName`; `bareName` is exported for direct testing.

- [ ] **Step 1: Write the failing test**

Create `js/lib/serviceSort.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { bareName, sortByBareName } from './serviceSort.js';

test('bareName strips a leading vendor prefix', () => {
  assert.equal(bareName('Amazon EC2'), 'EC2');
  assert.equal(bareName('AWS Lambda'), 'Lambda');
});

test('bareName leaves unprefixed names alone', () => {
  assert.equal(bareName('NAT Gateway'), 'NAT Gateway');
  assert.equal(bareName('Application Load Balancer'), 'Application Load Balancer');
});

test('bareName only strips the prefix as a whole word', () => {
  assert.equal(bareName('Amazonian Service'), 'Amazonian Service');
});

test('sortByBareName orders by bare name and does not mutate its input', () => {
  const input = [
    { name: 'AWS Lambda' },
    { name: 'Amazon EC2' },
    { name: 'NAT Gateway' },
    { name: 'Amazon Aurora' },
  ];
  const snapshot = [...input];
  const sorted = sortByBareName(input);
  assert.deepEqual(
    sorted.map((s) => s.name),
    ['Amazon Aurora', 'Amazon EC2', 'AWS Lambda', 'NAT Gateway'],
  );
  assert.deepEqual(input, snapshot);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/lib/serviceSort.test.mjs`
Expected: FAIL — `Cannot find module '.../js/lib/serviceSort.js'`

- [ ] **Step 3: Write the implementation**

Create `js/lib/serviceSort.js`:

```js
// js/lib/serviceSort.js
// Display ordering for the services reference page: services alphabetize by
// their bare name, ignoring the "AWS " / "Amazon " vendor prefix, so Amazon
// EC2 sorts under E and AWS Lambda under L.
export function bareName(name) {
  return name.replace(/^(?:AWS|Amazon)\s+/, '');
}

export function sortByBareName(services) {
  return [...services].sort((a, b) => bareName(a.name).localeCompare(bareName(b.name)));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/lib/serviceSort.test.mjs`
Expected: PASS — 4 tests pass.

Then run the whole suite: `node --test`
Expected: PASS — no existing test broken.

- [ ] **Step 5: Commit**

```bash
git add js/lib/serviceSort.js js/lib/serviceSort.test.mjs
git commit -m "Add vendor-prefix-aware sort helper for the services page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Services data file and validator drift guard

**Files:**
- Modify: `scripts/validate-content.mjs` (add `validateServices()` after `validateFlashcards()`, ~line 121, and call it in `main()`)
- Create: `js/data/services.js`

**Interfaces:**
- Consumes: `FLASHCARDS`, `FLASHCARD_DOMAINS` from `js/data/flashcards.js` (validator only — the data file imports nothing).
- Produces: `SERVICES: Array<{id, name, domain, blurb, covers?}>` from `js/data/services.js`. Task 3's view imports `SERVICES` and filters by `domain`.

- [ ] **Step 1: Add `validateServices()` to the validator (the "failing test" for the data)**

In `scripts/validate-content.mjs`, insert after the `validateFlashcards()` function (after line 121):

```js
async function validateServices() {
  if (!existsSync(new URL('../js/data/services.js', import.meta.url))) {
    console.log('services.js not present yet, skipping');
    return;
  }
  const { SERVICES } = await import('../js/data/services.js');
  const { FLASHCARDS, FLASHCARD_DOMAINS } = await import('../js/data/flashcards.js');
  check(Array.isArray(SERVICES) && SERVICES.length > 0, 'SERVICES must be a non-empty array');
  const seenIds = new Set();
  const seenNames = new Set();
  const covered = new Set();
  for (const s of SERVICES) {
    check(typeof s.id === 'string' && s.id.length > 0,
      `service missing id: ${JSON.stringify(s).slice(0, 80)}`);
    check(!seenIds.has(s.id), `duplicate service id: ${s.id}`);
    seenIds.add(s.id);
    check(typeof s.name === 'string' && s.name.length > 0, `service ${s.id} missing name`);
    check(!seenNames.has(s.name), `duplicate service name: ${s.name}`);
    seenNames.add(s.name);
    check(FLASHCARD_DOMAINS.includes(s.domain) && s.domain !== 'Best-Fit Scenarios',
      `service ${s.id} has invalid domain: ${s.domain}`);
    check(typeof s.blurb === 'string' && s.blurb.length >= 20 && s.blurb.length <= 220,
      `service ${s.id} blurb must be 20-220 chars, got ${typeof s.blurb === 'string' ? s.blurb.length : 'none'}`);
    covered.add(s.name);
    if (s.covers !== undefined) {
      check(Array.isArray(s.covers) && s.covers.length > 0
        && s.covers.every((c) => typeof c === 'string' && c.length > 0),
        `service ${s.id} covers must be a non-empty array of non-empty strings`);
      for (const c of Array.isArray(s.covers) ? s.covers : []) covered.add(c);
    }
  }
  // Drift guard: every service the flashcard deck names must appear on the
  // services page, either as an entry's name or in its covers list.
  const deckServices = new Set(
    FLASHCARDS.map((c) => c.service).filter((svc) => svc !== 'Best-Fit Scenario'));
  for (const svc of deckServices) {
    check(covered.has(svc), `flashcard service not covered by services.js: ${svc}`);
  }
}
```

And in `main()`, add the call after `await validateFlashcards();`:

```js
  await validateFlashcards();
  await validateServices();
```

- [ ] **Step 2: Run the validator to verify the skip path**

Run: `node scripts/validate-content.mjs`
Expected: prints `services.js not present yet, skipping` and ends with `All content validated successfully.`

- [ ] **Step 3: Create the data file**

Create `js/data/services.js` with exactly this content (70 entries; pre-verified against the deck — all 72 non-Best-Fit flashcard services covered, all blurbs 20–220 chars):

```js
// js/data/services.js
// "Services at a glance" reference data: every AWS service the site covers,
// one sentence each. Grouped by the same domain buckets as the flashcard
// deck (js/data/flashcards.js); scripts/validate-content.mjs enforces that
// every service named by a flashcard is covered here, either as an entry's
// `name` or via its `covers` alias list. Written in the author's own words.

export const SERVICES = [
  // ---------------------------------------------------------------------
  // Security, Identity, and Compliance
  // ---------------------------------------------------------------------
  {
    id: 'iam',
    name: 'AWS IAM',
    domain: 'Security, Identity, and Compliance',
    blurb: "Account-wide users, roles, and permission policies; every request is denied by default unless a policy explicitly allows it.",
  },
  {
    id: 'iam-identity-center',
    name: 'AWS IAM Identity Center',
    domain: 'Security, Identity, and Compliance',
    blurb: "Workforce single sign-on into many AWS accounts and business apps, with users synced from a corporate directory or managed natively.",
  },
  {
    id: 'sts',
    name: 'AWS STS',
    domain: 'Security, Identity, and Compliance',
    blurb: "Mints short-lived temporary credentials; the machinery underneath every IAM role assumption.",
  },
  {
    id: 'organizations',
    name: 'AWS Organizations',
    domain: 'Security, Identity, and Compliance',
    blurb: "Groups many accounts under one umbrella for consolidated billing and central governance; SCPs cap what member-account identities can ever be allowed to do.",
  },
  {
    id: 'control-tower',
    name: 'AWS Control Tower',
    domain: 'Security, Identity, and Compliance',
    blurb: "Automated multi-account landing zone on top of Organizations, with guardrails and account vending built in.",
  },
  {
    id: 'kms',
    name: 'AWS KMS',
    domain: 'Security, Identity, and Compliance',
    blurb: "Managed encryption keys: create, rotate, and control access to the keys that encrypt data across almost every AWS service.",
  },
  {
    id: 'secrets-manager',
    name: 'AWS Secrets Manager',
    domain: 'Security, Identity, and Compliance',
    blurb: "Stores database credentials and API keys behind an API, with built-in automatic rotation.",
  },
  {
    id: 'acm',
    name: 'AWS Certificate Manager',
    domain: 'Security, Identity, and Compliance',
    blurb: "Free public TLS certificates that auto-renew and attach to CloudFront, load balancers, and API Gateway.",
  },
  {
    id: 'cognito',
    name: 'Amazon Cognito',
    domain: 'Security, Identity, and Compliance',
    blurb: "Sign-up and sign-in for your own app's users: user pools handle authentication, identity pools trade tokens for temporary AWS credentials.",
  },
  {
    id: 'guardduty',
    name: 'Amazon GuardDuty',
    domain: 'Security, Identity, and Compliance',
    blurb: "Continuous threat detection that analyzes CloudTrail, VPC Flow Logs, and DNS logs for signs of compromise.",
  },
  {
    id: 'macie',
    name: 'Amazon Macie',
    domain: 'Security, Identity, and Compliance',
    blurb: "Machine-learning scans of S3 that find, classify, and alert on sensitive data such as PII.",
  },
  {
    id: 'cloudtrail',
    name: 'AWS CloudTrail',
    domain: 'Security, Identity, and Compliance',
    blurb: "Records every API call in the account — who did what, when, and from where — for auditing and forensics.",
  },
  {
    id: 'config',
    name: 'AWS Config',
    domain: 'Security, Identity, and Compliance',
    blurb: "Tracks resource configuration history and continuously evaluates it against compliance rules, with optional auto-remediation.",
  },
  {
    id: 'waf',
    name: 'AWS WAF',
    domain: 'Security, Identity, and Compliance',
    blurb: "Web application firewall filtering HTTP(S) requests by rule — SQL injection, XSS, rate limits, IP or geo match — at CloudFront, ALB, or API Gateway.",
  },
  {
    id: 'shield',
    name: 'AWS Shield',
    domain: 'Security, Identity, and Compliance',
    blurb: "Managed DDoS protection: Standard is free and always on, Advanced adds large-attack response, cost protection, and a response team.",
  },
  {
    id: 'security-groups',
    name: 'Amazon VPC Security Groups',
    domain: 'Security, Identity, and Compliance',
    blurb: "Stateful instance-level firewalls with allow rules only; return traffic is automatically permitted.",
  },
  {
    id: 'nacls',
    name: 'Amazon VPC Network ACLs',
    domain: 'Security, Identity, and Compliance',
    blurb: "Stateless subnet-level allow and deny rules evaluated in number order; both directions must be opened explicitly.",
  },
  {
    id: 'backup',
    name: 'AWS Backup',
    domain: 'Security, Identity, and Compliance',
    blurb: "Central, policy-driven backup plans and vaults spanning EBS, RDS, DynamoDB, EFS, Storage Gateway, and more.",
  },

  // ---------------------------------------------------------------------
  // Networking and Content Delivery
  // ---------------------------------------------------------------------
  {
    id: 'vpc',
    name: 'Amazon VPC',
    domain: 'Networking and Content Delivery',
    blurb: "Your private software-defined network in AWS: a CIDR range carved into subnets, wired up with route tables and gateways.",
  },
  {
    id: 'nat-gateway',
    name: 'NAT Gateway',
    domain: 'Networking and Content Delivery',
    blurb: "Managed egress for private subnets — instances can reach out to the internet while staying unreachable from it.",
  },
  {
    id: 'vpc-peering',
    name: 'VPC Peering',
    domain: 'Networking and Content Delivery',
    blurb: "Private one-to-one link between two VPCs; not transitive, so full connectivity between many VPCs needs a peering per pair.",
  },
  {
    id: 'transit-gateway',
    name: 'AWS Transit Gateway',
    domain: 'Networking and Content Delivery',
    blurb: "Regional hub-and-spoke router connecting many VPCs and on-premises links transitively — the cure for peering meshes.",
  },
  {
    id: 'gateway-endpoints',
    name: 'VPC Gateway Endpoints',
    domain: 'Networking and Content Delivery',
    blurb: "Free route-table entries that keep S3 and DynamoDB traffic on the AWS network, with no NAT or internet path required.",
  },
  {
    id: 'privatelink',
    name: 'AWS PrivateLink',
    domain: 'Networking and Content Delivery',
    blurb: "Interface endpoints that expose a service into consumer VPCs over private IPs — no internet gateway, NAT, or peering involved.",
  },
  {
    id: 'flow-logs',
    name: 'VPC Flow Logs',
    domain: 'Networking and Content Delivery',
    blurb: "Captures accepted and rejected IP traffic metadata at the VPC, subnet, or ENI level for troubleshooting and security analysis.",
  },
  {
    id: 'site-to-site-vpn',
    name: 'AWS Site-to-Site VPN',
    domain: 'Networking and Content Delivery',
    blurb: "Encrypted IPsec tunnels from on-premises equipment to AWS over the public internet — quick to set up, internet-variable performance.",
  },
  {
    id: 'direct-connect',
    name: 'AWS Direct Connect',
    domain: 'Networking and Content Delivery',
    blurb: "A dedicated private circuit from your data center into AWS for consistent bandwidth and latency; provisioning takes weeks.",
  },
  {
    id: 'route-53',
    name: 'Amazon Route 53',
    domain: 'Networking and Content Delivery',
    blurb: "Highly available DNS with health checks and routing policies — weighted, latency, failover, geolocation — plus domain registration.",
  },
  {
    id: 'cloudfront',
    name: 'Amazon CloudFront',
    domain: 'Networking and Content Delivery',
    blurb: "Global CDN that caches content at edge locations, with HTTPS, signed URLs and cookies, and origin failover.",
  },
  {
    id: 'global-accelerator',
    name: 'AWS Global Accelerator',
    domain: 'Networking and Content Delivery',
    blurb: "Two static anycast IPs that put user traffic onto the AWS backbone at the nearest edge — for non-HTTP workloads or instant regional failover.",
  },
  {
    id: 'elb',
    name: 'Elastic Load Balancing',
    domain: 'Networking and Content Delivery',
    blurb: "The managed load balancer family: spreads traffic across healthy targets in multiple AZs behind one endpoint.",
  },
  {
    id: 'alb',
    name: 'Application Load Balancer',
    domain: 'Networking and Content Delivery',
    blurb: "Layer-7 HTTP(S) load balancer routing by path, host, or header to target groups, including Lambda targets.",
  },
  {
    id: 'nlb',
    name: 'Network Load Balancer',
    domain: 'Networking and Content Delivery',
    blurb: "Layer-4 TCP/UDP load balancer built for millions of requests per second, ultra-low latency, and a static IP per AZ.",
  },
  {
    id: 'gwlb',
    name: 'Gateway Load Balancer',
    domain: 'Networking and Content Delivery',
    blurb: "Transparently slots fleets of third-party network appliances — firewalls, IDS/IPS — into the traffic path.",
  },
  {
    id: 'api-gateway',
    name: 'Amazon API Gateway',
    domain: 'Networking and Content Delivery',
    blurb: "Managed front door for REST, HTTP, and WebSocket APIs: authentication, throttling, caching, and direct Lambda integration.",
  },

  // ---------------------------------------------------------------------
  // Compute, Containers, and Serverless
  // ---------------------------------------------------------------------
  {
    id: 'ec2',
    name: 'Amazon EC2',
    domain: 'Compute, Containers, and Serverless',
    blurb: "Resizable virtual machines with a menu of instance families and purchase options: On-Demand, Reserved, Savings Plans, and Spot.",
  },
  {
    id: 'ec2-auto-scaling',
    name: 'Amazon EC2 Auto Scaling',
    domain: 'Compute, Containers, and Serverless',
    blurb: "Keeps an instance fleet at the right size — scaling on metrics or schedules and replacing instances that fail health checks.",
  },
  {
    id: 'lambda',
    name: 'AWS Lambda',
    domain: 'Compute, Containers, and Serverless',
    blurb: "Run functions without servers: event-triggered code billed per millisecond, scaling automatically, capped at 15 minutes per invocation.",
  },
  {
    id: 'ecs',
    name: 'Amazon ECS',
    domain: 'Compute, Containers, and Serverless',
    blurb: "AWS-native container orchestration that runs Docker tasks and services on EC2 instances or Fargate.",
  },
  {
    id: 'eks',
    name: 'Amazon EKS',
    domain: 'Compute, Containers, and Serverless',
    blurb: "Managed Kubernetes control plane for teams standardized on Kubernetes APIs and tooling.",
  },
  {
    id: 'fargate',
    name: 'AWS Fargate',
    domain: 'Compute, Containers, and Serverless',
    blurb: "Serverless capacity for ECS and EKS containers — no instances to provision or patch, billed by the task's CPU and memory.",
  },
  {
    id: 'sqs',
    name: 'Amazon SQS',
    domain: 'Compute, Containers, and Serverless',
    blurb: "Managed message queue that decouples producers from consumers, with dead-letter queues and a FIFO variant.",
  },
  {
    id: 'sns',
    name: 'Amazon SNS',
    domain: 'Compute, Containers, and Serverless',
    blurb: "Pub/sub fan-out: one published message pushed to many subscribers — SQS queues, Lambda functions, HTTPS endpoints, email, SMS.",
  },
  {
    id: 'step-functions',
    name: 'AWS Step Functions',
    domain: 'Compute, Containers, and Serverless',
    blurb: "Serverless state machines that orchestrate multi-step workflows with branching, retries, and error handling.",
  },
  {
    id: 'x-ray',
    name: 'AWS X-Ray',
    domain: 'Compute, Containers, and Serverless',
    blurb: "Distributed tracing that follows a request across services to pinpoint latency bottlenecks and errors.",
  },

  // ---------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------
  {
    id: 's3',
    name: 'Amazon S3',
    domain: 'Storage',
    blurb: "Eleven-nines-durable object storage with storage classes, lifecycle rules, versioning, and rich policy and encryption controls.",
  },
  {
    id: 's3-glacier',
    name: 'Amazon S3 Glacier',
    domain: 'Storage',
    blurb: "S3's archival storage classes — the cheapest per GB, with retrievals ranging from milliseconds to hours by tier.",
  },
  {
    id: 'ebs',
    name: 'Amazon EBS',
    domain: 'Storage',
    blurb: "Network-attached block volumes for a single EC2 instance within one AZ; snapshots back them up incrementally to S3.",
  },
  {
    id: 'efs',
    name: 'Amazon EFS',
    domain: 'Storage',
    blurb: "Elastic NFS file system that many Linux instances can mount across AZs, growing and shrinking automatically.",
  },
  {
    id: 'fsx',
    name: 'Amazon FSx',
    domain: 'Storage',
    blurb: "Managed third-party file systems: Windows File Server for SMB and Active Directory, Lustre for HPC scratch speed, and more.",
  },
  {
    id: 'storage-gateway',
    name: 'AWS Storage Gateway',
    domain: 'Storage',
    blurb: "Hybrid bridge that presents cloud-backed file shares, volumes, and virtual tapes to on-premises applications.",
  },
  {
    id: 'datasync',
    name: 'AWS DataSync',
    domain: 'Storage',
    blurb: "Accelerated online transfer for moving file and object datasets between on-premises storage and AWS.",
  },
  {
    id: 'transfer-family',
    name: 'AWS Transfer Family',
    domain: 'Storage',
    blurb: "Managed SFTP, FTPS, and FTP endpoints that land uploaded files directly in S3 or EFS.",
  },

  // ---------------------------------------------------------------------
  // Database
  // ---------------------------------------------------------------------
  {
    id: 'rds',
    name: 'Amazon RDS',
    domain: 'Database',
    blurb: "Managed relational engines (MySQL, PostgreSQL, and more) with Multi-AZ standbys for failover and read replicas for read scaling.",
    covers: ['Amazon RDS Multi-AZ', 'Amazon RDS / Aurora Read Replicas'],
  },
  {
    id: 'rds-proxy',
    name: 'Amazon RDS Proxy',
    domain: 'Database',
    blurb: "Managed connection pooling in front of RDS and Aurora so bursty or serverless callers don't exhaust database connections.",
  },
  {
    id: 'aurora',
    name: 'Amazon Aurora',
    domain: 'Database',
    blurb: "AWS-built MySQL- and PostgreSQL-compatible engine: six-way storage replication across three AZs, up to 15 read replicas, and a Serverless option.",
  },
  {
    id: 'dynamodb',
    name: 'Amazon DynamoDB',
    domain: 'Database',
    blurb: "Serverless key-value and document database with single-digit-millisecond reads at any scale, plus DAX caching, global tables, and streams.",
  },
  {
    id: 'elasticache',
    name: 'Amazon ElastiCache',
    domain: 'Database',
    blurb: "Managed in-memory Redis or Memcached for microsecond-latency caching and session storage.",
  },
  {
    id: 'redshift',
    name: 'Amazon Redshift',
    domain: 'Database',
    blurb: "Petabyte-scale columnar data warehouse for OLAP — complex SQL analytics across huge datasets.",
  },

  // ---------------------------------------------------------------------
  // Analytics
  // ---------------------------------------------------------------------
  {
    id: 'athena',
    name: 'Amazon Athena',
    domain: 'Analytics',
    blurb: "Serverless SQL directly against files in S3 — pay per data scanned, nothing to provision.",
  },
  {
    id: 'glue',
    name: 'AWS Glue',
    domain: 'Analytics',
    blurb: "Serverless ETL jobs plus the Data Catalog whose crawlers make S3 data queryable by Athena, EMR, and Redshift.",
  },
  {
    id: 'kinesis-data-streams',
    name: 'Amazon Kinesis Data Streams',
    domain: 'Analytics',
    blurb: "Real-time streaming ingestion with shard-based scaling and replayable records for multiple consumers.",
  },
  {
    id: 'emr',
    name: 'Amazon EMR',
    domain: 'Analytics',
    blurb: "Managed big-data clusters — Spark, Hadoop, Hive — for heavy distributed processing jobs.",
  },
  {
    id: 'lake-formation',
    name: 'AWS Lake Formation',
    domain: 'Analytics',
    blurb: "Builds and secures S3 data lakes, layering fine-grained, centrally managed table and column permissions over Glue.",
  },

  // ---------------------------------------------------------------------
  // Management, Governance, and Cost
  // ---------------------------------------------------------------------
  {
    id: 'cloudwatch',
    name: 'Amazon CloudWatch',
    domain: 'Management, Governance, and Cost',
    blurb: "Metrics, logs, alarms, and dashboards for AWS resources and applications — and the trigger behind most auto scaling.",
  },
  {
    id: 'cost-explorer',
    name: 'AWS Cost Explorer',
    domain: 'Management, Governance, and Cost',
    blurb: "Visualizes historical spend with filtering and grouping, and forecasts where costs are heading.",
  },
  {
    id: 'budgets',
    name: 'AWS Budgets',
    domain: 'Management, Governance, and Cost',
    blurb: "Set cost or usage thresholds and get alerts — or trigger actions — when actuals or forecasts cross them.",
  },
  {
    id: 'savings-plans',
    name: 'AWS Savings Plans',
    domain: 'Management, Governance, and Cost',
    blurb: "Commit to a $/hour of compute for one or three years in exchange for deep discounts across EC2, Fargate, and Lambda.",
  },
  {
    id: 'trusted-advisor',
    name: 'AWS Trusted Advisor',
    domain: 'Management, Governance, and Cost',
    blurb: "Automated account checks against AWS best practices: cost, performance, security, fault tolerance, and service limits.",
  },
  {
    id: 'service-quotas',
    name: 'AWS Service Quotas',
    domain: 'Management, Governance, and Cost',
    blurb: "One console for viewing per-service limits, requesting increases, and alarming as usage approaches a quota.",
  },
];
```

- [ ] **Step 4: Run the validator to verify it passes**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.` (no "skipping" line for services.js).

- [ ] **Step 5: Prove the drift guard actually fires (red check)**

Temporarily comment out the entire `macie` entry in `js/data/services.js` (the object from `{ id: 'macie',` through its closing `},`).

Run: `node scripts/validate-content.mjs`
Expected: FAIL, exit non-zero, with the message `flashcard service not covered by services.js: Amazon Macie`.

Restore the `macie` entry (uncomment it exactly as it was).

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 6: Commit**

```bash
git add js/data/services.js scripts/validate-content.mjs
git commit -m "Add services reference data with flashcard-coverage drift guard

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Services view, routing, nav, CSS, and README

**Files:**
- Create: `js/views/services.js`
- Modify: `js/app.js` (imports block at top, `VIEWS` map at ~line 8)
- Modify: `index.html` (nav block, lines 13–20)
- Modify: `css/style.css` (append before the `@media (max-width: 640px)` block at line 227)
- Modify: `README.md` ("What's here" list, lines 19–25)

**Interfaces:**
- Consumes: `SERVICES` from `js/data/services.js` (Task 2), `sortByBareName` from `js/lib/serviceSort.js` (Task 1), `FLASHCARD_DOMAINS` from `js/data/flashcards.js`, `escapeHtml` from `js/lib/html.js`.
- Produces: `render(mount: HTMLElement): void` exported from `js/views/services.js`, registered under the `services` key in `app.js`'s `VIEWS` map (route `#/services`).

- [ ] **Step 1: Create the view**

Create `js/views/services.js`:

```js
// js/views/services.js
// "Services at a glance": every service the site covers, one sentence each,
// grouped by the flashcard deck's domain buckets.
import { SERVICES } from '../data/services.js';
import { FLASHCARD_DOMAINS } from '../data/flashcards.js';
import { escapeHtml } from '../lib/html.js';
import { sortByBareName } from '../lib/serviceSort.js';

// Best-Fit Scenarios is a study bucket, not a service category.
const DOMAINS_IN_ORDER = FLASHCARD_DOMAINS.filter((d) => d !== 'Best-Fit Scenarios');

export function render(mount) {
  mount.innerHTML = `
    <section class="services">
      <h2>Services at a Glance</h2>
      <p>Every AWS service this site covers, one sentence each. For depth, see the
        <a href="#/study">Study Guide</a> or drill with <a href="#/flashcards">Flashcards</a>.</p>
      ${DOMAINS_IN_ORDER.map(renderDomainSection).join('')}
    </section>
  `;
}

function renderDomainSection(domain) {
  const services = sortByBareName(SERVICES.filter((s) => s.domain === domain));
  if (services.length === 0) return '';
  return `
    <h3>${escapeHtml(domain)}</h3>
    <dl class="services-list">
      ${services.map((s) => `
        <div class="services-entry">
          <dt>${escapeHtml(s.name)}</dt>
          <dd>${escapeHtml(s.blurb)}</dd>
        </div>
      `).join('')}
    </dl>
  `;
}
```

- [ ] **Step 2: Register the route in `js/app.js`**

Add to the imports at the top (after the `studyGuide.js` import):

```js
import { render as renderServices } from './views/services.js';
```

Add to the `VIEWS` map (after the `study` entry):

```js
  services: renderServices,
```

- [ ] **Step 3: Add the nav link in `index.html`**

In the `<nav id="nav">` block, insert between the Study Guide and Quizzes links:

```html
      <a href="#/services" data-view="services">Services</a>
```

- [ ] **Step 4: Add CSS**

In `css/style.css`, insert immediately before the `@media (max-width: 640px)` block:

```css
/* Services at a glance: definition lists grouped under domain headings. */
.services-list { margin: 0 0 1.5rem; }

.services-entry {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-border);
  break-inside: avoid;
  page-break-inside: avoid;
}

.services-entry dt { font-weight: 600; }

.services-entry dd { margin: 0.15rem 0 0; }
```

- [ ] **Step 5: Add the README bullet**

In `README.md`'s "What's here" list, insert after the "Study guide" bullet:

```markdown
- **Services at a glance** — every covered service with a one-sentence description, grouped by domain.
```

- [ ] **Step 6: Verify — validator, tests, and browser**

Run: `node scripts/validate-content.mjs` — expected: `All content validated successfully.`
Run: `node --test` — expected: all tests pass.

Serve the site (`python3 -m http.server 8000` from `aws/`, or the browser-preview equivalent) and open `http://localhost:8000/#/services`. Verify:
- "Services" appears in the nav between Study Guide and Quizzes and highlights as active on the page.
- Seven domain sections render, in `FLASHCARD_DOMAINS` order, no "Best-Fit Scenarios" section.
- Entries alphabetize ignoring the AWS/Amazon prefix (e.g. Aurora before EC2 before Lambda within their sections).
- No console errors; the other views still render.

- [ ] **Step 7: Commit**

```bash
git add js/views/services.js js/app.js index.html css/style.css README.md
git commit -m "Add services-at-a-glance reference view

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
