// aws/js/data/svcChallenges.js
//
// Challenge definitions for the service-diagram Architecture Challenge.
// startState and refSolution are FUNCTIONS returning fresh graphs built
// with the svcModel mutators the UI uses — never shared objects (the UI
// mutates what it loads) and never serialized. Every challenge's
// refSolution is proven by js/data/svcChallenges.test.mjs to validate
// clean, pass all its goals, and pass its selected best practices. The
// webapp-hub and iot-twin challenges mirror two published AWS reference
// architectures (Data Transfer Hub; EV digital twin with IoT TwinMaker).

import { createGraph, addNode, addEdge } from '../lib/svcModel.js';

function usersOnly() {
  const graph = createGraph();
  addNode(graph, 'users');
  return graph;
}

function staticSiteSolution() {
  const graph = usersOnly();
  const cf = addNode(graph, 'cloudfront');
  const s3 = addNode(graph, 's3', { name: 'Site bucket' });
  addEdge(graph, 'users-1', cf.id);
  addEdge(graph, cf.id, s3.id);
  return graph;
}

function serverlessApiSolution() {
  const graph = usersOnly();
  const api = addNode(graph, 'apigateway');
  const fn = addNode(graph, 'lambda', { name: 'API handler' });
  const db = addNode(graph, 'dynamodb', { name: 'Notes table' });
  const auth = addNode(graph, 'cognito');
  addEdge(graph, 'users-1', api.id);
  addEdge(graph, api.id, auth.id);
  addEdge(graph, api.id, fn.id);
  addEdge(graph, fn.id, db.id);
  return graph;
}

function uploadPipelineStart() {
  const graph = usersOnly();
  const uploads = addNode(graph, 's3', { name: 'Uploads bucket', role: 'uploads' });
  addEdge(graph, 'users-1', uploads.id); // presigned PUTs land here
  return graph;
}

function uploadPipelineSolution() {
  const graph = uploadPipelineStart();
  const resizer = addNode(graph, 'lambda', { name: 'Resizer', role: 'resizer' });
  const thumbs = addNode(graph, 's3', { name: 'Thumbnails bucket', role: 'thumbs' });
  const catalog = addNode(graph, 'dynamodb', { name: 'Metadata table', role: 'catalog' });
  addEdge(graph, 's3-1', resizer.id);
  addEdge(graph, resizer.id, thumbs.id);
  addEdge(graph, resizer.id, catalog.id);
  return graph;
}

function queueWorkerSolution() {
  const graph = usersOnly();
  const api = addNode(graph, 'apigateway');
  const intake = addNode(graph, 'lambda', { name: 'Order intake', role: 'intake' });
  const queue = addNode(graph, 'sqs', { name: 'Orders queue' });
  const worker = addNode(graph, 'fargate', { name: 'Order processor', role: 'worker' });
  const db = addNode(graph, 'rds', { name: 'Orders database', role: 'orders' });
  addEdge(graph, 'users-1', api.id);
  addEdge(graph, api.id, intake.id);
  addEdge(graph, intake.id, queue.id);
  addEdge(graph, queue.id, worker.id);
  addEdge(graph, worker.id, db.id);
  return graph;
}

function fanoutSolution() {
  const graph = usersOnly();
  const api = addNode(graph, 'apigateway');
  const publisher = addNode(graph, 'lambda', { name: 'Order publisher', role: 'publisher' });
  const topic = addNode(graph, 'sns', { name: 'Order events' });
  const emailQ = addNode(graph, 'sqs', { name: 'Email queue' });
  const analyticsQ = addNode(graph, 'sqs', { name: 'Analytics queue' });
  const email = addNode(graph, 'lambda', { name: 'Email sender', role: 'email' });
  const analytics = addNode(graph, 'lambda', { name: 'Analytics writer', role: 'analytics' });
  addEdge(graph, 'users-1', api.id);
  addEdge(graph, api.id, publisher.id);
  addEdge(graph, publisher.id, topic.id);
  addEdge(graph, topic.id, emailQ.id);
  addEdge(graph, topic.id, analyticsQ.id);
  addEdge(graph, emailQ.id, email.id);
  addEdge(graph, analyticsQ.id, analytics.id);
  return graph;
}

function webappHubSolution() {
  const graph = usersOnly();
  const cf = addNode(graph, 'cloudfront');
  const ui = addNode(graph, 's3', { name: 'Hub UI bucket' });
  const api = addNode(graph, 'appsync');
  const auth = addNode(graph, 'cognito');
  const tasks = addNode(graph, 'dynamodb', { name: 'Task table' });
  const fn = addNode(graph, 'lambda', { name: 'API resolver' });
  const wf = addNode(graph, 'stepfunctions', { name: 'Provisioning workflow' });
  const task = addNode(graph, 'fargate', { name: 'Replication task' });
  const registry = addNode(graph, 'ecr', { name: 'Task images' });
  addEdge(graph, 'users-1', cf.id);
  addEdge(graph, cf.id, ui.id);
  addEdge(graph, 'users-1', api.id);
  addEdge(graph, api.id, auth.id);
  addEdge(graph, api.id, tasks.id);
  addEdge(graph, api.id, fn.id);
  addEdge(graph, fn.id, wf.id);
  addEdge(graph, wf.id, task.id);
  addEdge(graph, registry.id, task.id);
  return graph;
}

function iotTwinStart() {
  const graph = createGraph();
  addNode(graph, 'devices', { name: 'Electric cars' });
  return graph;
}

function iotTwinSolution() {
  const graph = iotTwinStart();
  const sw = addNode(graph, 'sitewise');
  const core = addNode(graph, 'iotcore');
  const maint = addNode(graph, 'lambda', { name: 'Maintenance writer', role: 'maintenance' });
  const ts = addNode(graph, 'timestream', { name: 'Maintenance history' });
  const twin = addNode(graph, 'twinmaker');
  const conn = addNode(graph, 'lambda', { name: 'Timestream connector', role: 'connector' });
  const scenes = addNode(graph, 's3', { name: 'Scene assets' });
  const dash = addNode(graph, 'grafana');
  addEdge(graph, 'devices-1', sw.id);
  addEdge(graph, sw.id, core.id);
  addEdge(graph, core.id, maint.id);
  addEdge(graph, maint.id, ts.id);
  addEdge(graph, twin.id, sw.id);
  addEdge(graph, twin.id, conn.id);
  addEdge(graph, conn.id, ts.id);
  addEdge(graph, twin.id, scenes.id);
  addEdge(graph, twin.id, dash.id);
  return graph;
}

// Challenge 8 start/solution share one builder; `fixed` toggles the three
// planted flaws: (a) clients fetch the UI straight from S3 — no
// CloudFront, (b) the API function synchronously invokes the background
// worker Lambda — no queue, (c) the mobile app reads DynamoDB directly.
// Missing Cognito is the advisory-only fourth finding: it never fails a
// goal, only the best-practice score — like the old SG finding.
function fixBrokenBuild(fixed) {
  const graph = usersOnly();
  const ui = addNode(graph, 's3', { name: 'Site bucket' });
  const api = addNode(graph, 'apigateway');
  const apiFn = addNode(graph, 'lambda', { name: 'API function', role: 'api' });
  const worker = addNode(graph, 'lambda', { name: 'Background worker', role: 'worker' });
  const db = addNode(graph, 'dynamodb', { name: 'App table' });
  const topic = addNode(graph, 'sns', { name: 'Notifications' });
  if (fixed) {
    const cf = addNode(graph, 'cloudfront');
    addEdge(graph, 'users-1', cf.id);
    addEdge(graph, cf.id, ui.id);
  } else {
    addEdge(graph, 'users-1', ui.id); // flaw (a)
  }
  addEdge(graph, 'users-1', api.id);
  addEdge(graph, api.id, apiFn.id);
  if (fixed) {
    const queue = addNode(graph, 'sqs', { name: 'Work queue' });
    addEdge(graph, apiFn.id, queue.id);
    addEdge(graph, queue.id, worker.id);
  } else {
    addEdge(graph, apiFn.id, worker.id); // flaw (b)
  }
  addEdge(graph, apiFn.id, db.id);
  if (!fixed) addEdge(graph, 'users-1', db.id); // flaw (c)
  addEdge(graph, worker.id, topic.id);
  if (fixed) {
    const auth = addNode(graph, 'cognito');
    addEdge(graph, api.id, auth.id); // the advisory-only finding
  }
  return graph;
}

export const SVC_CHALLENGES = [
  {
    id: 'static-site',
    title: 'Global static website',
    brief: 'Your marketing site is a folder of HTML, CSS, and images. Serve it to a '
      + 'worldwide audience with low latency and TLS, and keep the bucket private — '
      + 'nobody should fetch objects from S3 directly.',
    roles: [],
    startState: usersOnly,
    goals: [
      { type: 'exists', sel: { service: 'cloudfront' } },
      { type: 'exists', sel: { service: 's3' } },
      { type: 'path', from: { service: 'users' }, to: { service: 's3' }, via: [{ service: 'cloudfront' }] },
      { type: 'noEdge', from: { service: 'users' }, to: { service: 's3' }, note: 'Origin Access Control keeps the bucket private' },
    ],
    bestPractices: ['cdn-in-front', 'no-orphan-nodes'],
    hints: [
      'Two services are enough: an S3 bucket holding the files and CloudFront in front of it.',
      'Draw the flow the way a request travels: Users → CloudFront → S3.',
      'If Users still have an arrow straight to S3, delete it — with Origin Access Control only CloudFront may read the bucket.',
    ],
    refSolution: staticSiteSolution,
  },
  {
    id: 'serverless-api',
    title: 'Serverless REST API',
    brief: 'Build the classic serverless backend for a notes app: clients call a REST '
      + 'API, business logic runs on demand, and state lives in a serverless NoSQL '
      + 'table. Clients must never skip a tier — no direct calls to the function or '
      + 'the table.',
    roles: [],
    startState: usersOnly,
    goals: [
      { type: 'path', from: { service: 'users' }, to: { service: 'dynamodb' }, via: [{ service: 'apigateway' }, { service: 'lambda' }] },
      { type: 'noEdge', from: { service: 'users' }, to: { service: 'lambda' }, note: 'clients call the API, not the function' },
      { type: 'noEdge', from: { service: 'users' }, to: { service: 'dynamodb' } },
    ],
    bestPractices: ['auth-on-public-api', 'db-behind-compute', 'no-orphan-nodes'],
    hints: [
      'The spine is API Gateway → Lambda → DynamoDB, with Users calling only API Gateway.',
      'Each tier owns one job: the API fronts and throttles, the function computes, the table stores.',
      'The best-practice score wants sign-in: link Cognito to API Gateway (either direction).',
    ],
    refSolution: serverlessApiSolution,
  },
  {
    id: 'upload-pipeline',
    title: 'Image processing pipeline',
    brief: 'Users already upload photos straight to an uploads bucket with presigned '
      + 'URLs (that part is wired for you). Every new object must be resized into a '
      + 'thumbnails bucket, and its metadata recorded in a table — all event-driven, '
      + 'no polling.',
    roles: [
      { id: 'uploads', label: 'uploads bucket', service: 's3' },
      { id: 'thumbs', label: 'thumbnails bucket', service: 's3' },
      { id: 'resizer', label: 'resizer function', service: 'lambda' },
      { id: 'catalog', label: 'metadata table', service: 'dynamodb' },
    ],
    startState: uploadPipelineStart,
    goals: [
      { type: 'exists', sel: { role: 'uploads' }, service: 's3' },
      { type: 'exists', sel: { role: 'thumbs' }, service: 's3' },
      { type: 'exists', sel: { role: 'resizer' }, service: 'lambda' },
      { type: 'exists', sel: { role: 'catalog' }, service: 'dynamodb' },
      { type: 'edge', from: { role: 'uploads' }, to: { role: 'resizer' }, note: 'S3 event notification triggers it' },
      { type: 'edge', from: { role: 'resizer' }, to: { role: 'thumbs' } },
      { type: 'edge', from: { role: 'resizer' }, to: { role: 'catalog' } },
    ],
    bestPractices: ['no-lambda-chaining', 'db-behind-compute', 'no-orphan-nodes'],
    hints: [
      'S3 can invoke a Lambda function directly when an object lands — that arrow IS the event notification.',
      'Two buckets, one function, one table. Use the Role dropdown on each card so goals know which is which.',
      'The resizer fans out: one arrow to the thumbnails bucket, one to the metadata table.',
    ],
    refSolution: uploadPipelineSolution,
  },
  {
    id: 'queue-worker',
    title: 'Decoupled order processing',
    brief: 'Flash sales hammer your order API, and order fulfillment talks to a '
      + 'relational database that hates connection spikes. Take orders at the front '
      + 'door fast, buffer them durably, and let a container worker drain the backlog '
      + 'at its own pace.',
    roles: [
      { id: 'intake', label: 'intake function', service: 'lambda' },
      { id: 'worker', label: 'fulfillment worker', service: 'fargate' },
      { id: 'orders', label: 'orders database', service: 'rds' },
    ],
    startState: usersOnly,
    goals: [
      { type: 'exists', sel: { role: 'intake' }, service: 'lambda' },
      { type: 'exists', sel: { role: 'worker' }, service: 'fargate' },
      { type: 'exists', sel: { role: 'orders' }, service: 'rds' },
      { type: 'path', from: { service: 'users' }, to: { role: 'orders' }, via: [{ service: 'apigateway' }, { role: 'intake' }, { service: 'sqs' }, { role: 'worker' }] },
      { type: 'noEdge', from: { role: 'intake' }, to: { role: 'orders' }, note: 'the queue absorbs the spike, not the database' },
    ],
    bestPractices: ['db-behind-compute', 'no-lambda-chaining', 'no-orphan-nodes'],
    hints: [
      'The order of the flow: API Gateway → intake Lambda → SQS → Fargate worker → RDS.',
      'The intake function only validates and enqueues — it must not touch the database.',
      'SQS is what lets the worker fail or slow down without dropping orders.',
    ],
    refSolution: queueWorkerSolution,
  },
  {
    id: 'fanout-events',
    title: 'Order event fan-out',
    brief: 'When an order is placed, two independent systems react: one emails a '
      + 'receipt, one records analytics. Publish each order event once and let every '
      + 'consumer process it durably — a slow consumer must never lose events or slow '
      + 'down the other.',
    roles: [
      { id: 'publisher', label: 'order publisher', service: 'lambda' },
      { id: 'email', label: 'email consumer', service: 'lambda' },
      { id: 'analytics', label: 'analytics consumer', service: 'lambda' },
    ],
    startState: usersOnly,
    goals: [
      { type: 'exists', sel: { role: 'publisher' }, service: 'lambda' },
      { type: 'exists', sel: { role: 'email' }, service: 'lambda' },
      { type: 'exists', sel: { role: 'analytics' }, service: 'lambda' },
      { type: 'exists', sel: { service: 'sqs' }, min: 2 },
      { type: 'path', from: { service: 'users' }, to: { role: 'publisher' }, via: [{ service: 'apigateway' }] },
      { type: 'fanout', from: { service: 'sns' }, min: 2 },
      { type: 'path', from: { role: 'publisher' }, to: { role: 'email' }, via: [{ service: 'sns' }, { service: 'sqs' }] },
      { type: 'path', from: { role: 'publisher' }, to: { role: 'analytics' }, via: [{ service: 'sns' }, { service: 'sqs' }] },
    ],
    bestPractices: ['no-lambda-chaining', 'no-orphan-nodes'],
    hints: [
      'SNS is the fan-out point: the publisher sends one message to the topic, the topic pushes copies onward.',
      'Durability comes from SNS → SQS → consumer, with a SEPARATE queue per consumer.',
      'If the email sender is down for an hour, its queue holds the backlog — analytics never notices.',
    ],
    refSolution: fanoutSolution,
  },
  {
    id: 'webapp-hub',
    title: 'Self-service transfer hub',
    brief: 'Build the console for a data-transfer product, straight from an AWS '
      + 'reference architecture: a static single-page UI, a GraphQL API with '
      + 'sign-in, task state in a serverless table, and a "create transfer task" '
      + 'action that launches an orchestrated workflow which runs a long-lived '
      + 'container task from a private image registry.',
    roles: [],
    startState: usersOnly,
    goals: [
      { type: 'path', from: { service: 'users' }, to: { service: 's3' }, via: [{ service: 'cloudfront' }], note: 'the hub UI' },
      { type: 'noEdge', from: { service: 'users' }, to: { service: 's3' } },
      { type: 'edge', from: { service: 'users' }, to: { service: 'appsync' }, note: 'GraphQL API calls' },
      { type: 'linked', a: { service: 'appsync' }, b: { service: 'cognito' }, note: 'sign-in' },
      { type: 'edge', from: { service: 'appsync' }, to: { service: 'dynamodb' }, note: 'task state' },
      { type: 'path', from: { service: 'appsync' }, to: { service: 'stepfunctions' }, via: [{ service: 'lambda' }], note: 'create-task resolver starts the workflow' },
      { type: 'edge', from: { service: 'stepfunctions' }, to: { service: 'fargate' }, note: 'the workflow runs the replication task' },
      { type: 'edge', from: { service: 'ecr' }, to: { service: 'fargate' }, note: 'the task pulls its container image' },
    ],
    bestPractices: 'all',
    hints: [
      'Two entry paths from Users: CloudFront → S3 for the static UI, and AppSync for the API.',
      'AppSync resolvers hit DynamoDB directly for task state, and a Lambda resolver starts Step Functions for provisioning.',
      'Fargate sits at the end: Step Functions launches it, and ECR supplies its image.',
      'Cognito links to AppSync — every GraphQL call carries a signed-in identity.',
    ],
    refSolution: webappHubSolution,
  },
  {
    id: 'iot-twin',
    title: 'EV digital twin',
    brief: 'A fleet of electric cars streams telemetry, and engineering wants a '
      + 'digital twin: live asset data, maintenance history in a time-series store, '
      + 'a 3D scene, and dashboards — the AWS IoT TwinMaker reference architecture '
      + 'in miniature.',
    roles: [
      { id: 'maintenance', label: 'maintenance writer', service: 'lambda' },
      { id: 'connector', label: 'Timestream connector', service: 'lambda' },
    ],
    startState: iotTwinStart,
    goals: [
      { type: 'edge', from: { service: 'devices' }, to: { service: 'sitewise' }, note: 'telemetry ingest into asset models' },
      { type: 'linked', a: { service: 'sitewise' }, b: { service: 'iotcore' }, note: 'property notifications ride MQTT' },
      { type: 'exists', sel: { role: 'maintenance' }, service: 'lambda' },
      { type: 'path', from: { service: 'iotcore' }, to: { service: 'timestream' }, via: [{ role: 'maintenance' }], note: 'rule → function → time-series table' },
      { type: 'linked', a: { service: 'twinmaker' }, b: { service: 'sitewise' }, note: 'built-in SiteWise connector' },
      { type: 'exists', sel: { role: 'connector' }, service: 'lambda' },
      { type: 'path', from: { service: 'twinmaker' }, to: { service: 'timestream' }, via: [{ role: 'connector' }], note: 'custom data connectors are Lambda functions' },
      { type: 'linked', a: { service: 'twinmaker' }, b: { service: 's3' }, note: '3D scene assets live in a bucket' },
      { type: 'linked', a: { service: 'twinmaker' }, b: { service: 'grafana' }, note: 'the TwinMaker Grafana plugin renders the twin' },
    ],
    bestPractices: ['no-lambda-chaining', 'db-behind-compute', 'no-orphan-nodes'],
    hints: [
      'Telemetry path: cars → IoT SiteWise, with SiteWise linked to IoT Core for property notifications.',
      'Maintenance events flow IoT Core → a writer Lambda → Timestream. (IoT Core rules CAN write '
        + 'Timestream directly — the Lambda is here to reshape SiteWise property notifications into '
        + 'maintenance records first.)',
      'TwinMaker is the hub of the twin: link it to SiteWise, S3 (scenes), and Grafana (dashboards).',
      'TwinMaker cannot query Timestream natively — it calls a Lambda connector, which queries the table.',
    ],
    refSolution: iotTwinSolution,
  },
  {
    id: 'fix-diagram',
    title: 'Fix the broken diagram',
    brief: 'You inherited this "finished" serverless app from a contractor. Users '
      + 'complain the site is slow overseas, ops found the API function calling the '
      + 'background worker function directly, and security is furious that the '
      + 'mobile app reads the database without going through the API. Rearrange the '
      + "arrows — security's sign-in complaint won't fail a goal, but watch the "
      + 'best-practice score.',
    roles: [
      { id: 'api', label: 'API function', service: 'lambda' },
      { id: 'worker', label: 'background worker', service: 'lambda' },
    ],
    startState: () => fixBrokenBuild(false),
    goals: [
      { type: 'path', from: { service: 'users' }, to: { service: 's3' }, via: [{ service: 'cloudfront' }], note: 'serve the site from the edge' },
      { type: 'noEdge', from: { service: 'users' }, to: { service: 's3' } },
      { type: 'exists', sel: { role: 'api' }, service: 'lambda' },
      { type: 'exists', sel: { role: 'worker' }, service: 'lambda' },
      { type: 'path', from: { role: 'api' }, to: { role: 'worker' }, via: [{ service: 'sqs' }], note: 'buffer the background work' },
      { type: 'noEdge', from: { role: 'api' }, to: { role: 'worker' } },
      { type: 'noEdge', from: { service: 'users' }, to: { service: 'dynamodb' }, note: 'reads go through the API' },
      { type: 'path', from: { service: 'users' }, to: { service: 'dynamodb' }, via: [{ service: 'apigateway' }, { role: 'api' }] },
    ],
    bestPractices: 'all',
    hints: [
      'Run Check and read each failing goal — every one names the arrow to add or remove.',
      '"Slow overseas" means no edge caching: put CloudFront between Users and the site bucket.',
      'Function-to-function arrows couple failure modes — put a queue between the API function and the worker.',
      'Delete the Users → DynamoDB arrow; the mobile app must call the API like everyone else. Then check what the best-practice score still wants.',
    ],
    refSolution: () => fixBrokenBuild(true),
  },
];
