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
  {
    id: 'batch',
    name: 'AWS Batch',
    domain: 'Compute, Containers, and Serverless',
    blurb: "Runs large-scale batch computing jobs on managed queues, provisioning the right amount of EC2 or Fargate capacity automatically.",
  },
  {
    id: 'outposts',
    name: 'AWS Outposts',
    domain: 'Compute, Containers, and Serverless',
    blurb: "AWS-managed racks in your own data center, running native AWS services on premises for low-latency or data-residency needs.",
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
  {
    id: 'dms',
    name: 'AWS DMS',
    domain: 'Database',
    blurb: "Migrates databases into AWS with minimal downtime — like-for-like moves or, with the Schema Conversion Tool, cross-engine migrations.",
  },
  {
    id: 'timestream',
    name: 'Amazon Timestream',
    domain: 'Database',
    blurb: "Purpose-built serverless time-series database for high-volume metrics and IoT telemetry.",
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
