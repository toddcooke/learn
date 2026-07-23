// aws/js/lib/svcCatalog.js
//
// Data catalog for the service-diagram Architecture Challenge: the AWS
// services (and external actors) a diagram may contain, grouped the way
// AWS reference architectures group them. Each type carries a short
// SAA-C03 study doc surfaced as a hover on cards and add-chips. Pure data
// + tiny lookups — no DOM.

// Category order drives both the add-chip rows and the auto-layout
// column, so reference solutions read left-to-right like an AWS diagram:
// clients on the left, edge/auth next, compute in the middle, data on the
// right.
export const CATEGORIES = [
  { id: 'client', label: 'Clients' },
  { id: 'edge', label: 'Edge & APIs' },
  { id: 'security', label: 'Security' },
  { id: 'compute', label: 'Compute' },
  { id: 'iot', label: 'IoT' },
  { id: 'integration', label: 'App integration' },
  { id: 'containers', label: 'Containers' },
  { id: 'storage', label: 'Storage' },
  { id: 'database', label: 'Database' },
  { id: 'observability', label: 'Observability' },
];

export const SERVICE_TYPES = {
  users: {
    label: 'Users', category: 'client',
    doc: 'People with browsers or mobile apps — the external actor most '
      + 'architectures serve. Arrows FROM Users show what clients call directly.',
  },
  devices: {
    label: 'IoT devices', category: 'client',
    doc: 'Sensors, vehicles, or other things emitting telemetry from outside '
      + 'AWS — the data source of IoT architectures.',
  },
  cloudfront: {
    label: 'Amazon CloudFront', category: 'edge',
    doc: 'Global CDN: caches content at edge locations, terminates TLS, and '
      + 'fronts S3 or custom origins. With Origin Access Control it becomes '
      + 'the only way into a private S3 bucket.',
  },
  apigateway: {
    label: 'Amazon API Gateway', category: 'edge',
    doc: 'Managed front door for REST/HTTP/WebSocket APIs: routing, '
      + 'throttling, caching, and auth (Cognito authorizers or Lambda '
      + 'authorizers) before requests hit your backend.',
  },
  appsync: {
    label: 'AWS AppSync', category: 'edge',
    doc: 'Managed GraphQL API: resolvers fan out to DynamoDB, Lambda, and '
      + 'other data sources; supports real-time subscriptions and Cognito '
      + 'authorization.',
  },
  cognito: {
    label: 'Amazon Cognito', category: 'security',
    doc: 'User sign-up/sign-in and identity: user pools issue JWTs that API '
      + 'Gateway and AppSync validate; identity pools exchange them for '
      + 'temporary AWS credentials. Supports OIDC/SAML federation.',
  },
  lambda: {
    label: 'AWS Lambda', category: 'compute',
    doc: 'Serverless functions: run code on demand, triggered by APIs, S3 '
      + 'events, queues, streams, or schedules. Scales to zero; 15-minute '
      + 'max runtime.',
  },
  fargate: {
    label: 'AWS Fargate', category: 'compute',
    doc: 'Serverless containers for ECS/EKS: run long-lived or heavyweight '
      + 'tasks without managing EC2 hosts. Pulls its container image from a '
      + 'registry such as ECR.',
  },
  ec2: {
    label: 'Amazon EC2', category: 'compute',
    doc: 'Virtual machines — maximum control over OS and runtime. In '
      + 'service diagrams EC2 appears when a workload needs an always-on '
      + 'server that containers or functions cannot cover.',
  },
  ecr: {
    label: 'Amazon ECR', category: 'containers',
    doc: 'Private Docker/OCI image registry. ECS/Fargate and EKS pull task '
      + 'images from it — the arrow points from ECR into the compute that '
      + 'runs the image.',
  },
  s3: {
    label: 'Amazon S3', category: 'storage',
    doc: 'Object storage: static site assets, uploads, data lakes, scene '
      + 'files. Emits event notifications (to Lambda, SQS, SNS) when '
      + 'objects land. 11 nines durability.',
  },
  dynamodb: {
    label: 'Amazon DynamoDB', category: 'database',
    doc: 'Serverless key-value/document database with single-digit-ms reads '
      + 'at any scale. The default state store for serverless APIs; '
      + 'clients should reach it through an API tier, never directly.',
  },
  rds: {
    label: 'Amazon RDS', category: 'database',
    doc: 'Managed relational databases (PostgreSQL, MySQL, …): SQL, joins, '
      + 'transactions. Connection-oriented, so bursty serverless callers '
      + 'usually sit behind a queue or RDS Proxy.',
  },
  timestream: {
    label: 'Amazon Timestream', category: 'database',
    doc: 'Serverless time-series database for telemetry and metrics: fast '
      + 'recent-data queries, automatic tiering of historical data — a '
      + 'natural sink for IoT measurements. (New AWS builds use Timestream '
      + 'for InfluxDB; the original LiveAnalytics engine is closed to new '
      + 'customers.)',
  },
  sqs: {
    label: 'Amazon SQS', category: 'integration',
    doc: 'Managed message queue: buffers work between producers and '
      + 'consumers so each side scales and fails independently. Standard '
      + 'queues are at-least-once; FIFO adds ordering.',
  },
  sns: {
    label: 'Amazon SNS', category: 'integration',
    doc: 'Pub/sub fan-out: one published message is pushed to every '
      + 'subscription — SQS queues, Lambda, email, HTTPS. SNS→SQS per '
      + 'consumer is the durable fan-out pattern.',
  },
  stepfunctions: {
    label: 'AWS Step Functions', category: 'integration',
    doc: 'Serverless workflow orchestration: state machines sequence '
      + 'Lambda, Fargate, and other services with retries, branching, and '
      + 'human-visible execution history.',
  },
  eventbridge: {
    label: 'Amazon EventBridge', category: 'integration',
    doc: 'Serverless event bus and scheduler: routes events between AWS '
      + 'services and SaaS apps by rule, and fires targets on cron '
      + 'schedules.',
  },
  iotcore: {
    label: 'AWS IoT Core', category: 'iot',
    doc: 'MQTT broker + device gateway: secure device connectivity, device '
      + 'shadows, and a rules engine that routes messages to Lambda, '
      + 'Timestream, S3, and more.',
  },
  sitewise: {
    label: 'AWS IoT SiteWise', category: 'iot',
    doc: 'Industrial asset data service: models equipment as assets with '
      + 'measured properties, ingests telemetry, computes metrics, and '
      + 'publishes property notifications over IoT Core.',
  },
  twinmaker: {
    label: 'AWS IoT TwinMaker', category: 'iot',
    doc: 'Digital twins: composes a knowledge graph over data connectors '
      + '(IoT SiteWise built in, Lambda for custom sources like '
      + 'Timestream), 3D scenes stored in S3, and a Grafana dashboard '
      + 'plugin.',
  },
  grafana: {
    label: 'Amazon Managed Grafana', category: 'observability',
    doc: 'Managed Grafana dashboards: visualizes Timestream, CloudWatch, '
      + 'and IoT TwinMaker scenes without running your own Grafana '
      + 'servers.',
  },
};

export const SERVICE_IDS = Object.keys(SERVICE_TYPES);

export function serviceLabel(type) {
  return SERVICE_TYPES[type] ? SERVICE_TYPES[type].label : type;
}

export function serviceCategory(type) {
  return SERVICE_TYPES[type] ? SERVICE_TYPES[type].category : null;
}

export function serviceDoc(type) {
  return SERVICE_TYPES[type] ? SERVICE_TYPES[type].doc : null;
}
