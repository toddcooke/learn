# AWS SAA-C03 — services at a glance

74 services grouped by category.

## Security, Identity, and Compliance

| Service | What it's for |
| --- | --- |
| AWS IAM | Account-wide users, roles, and permission policies; every request is denied by default unless a policy explicitly allows it. |
| AWS IAM Identity Center | Workforce single sign-on into many AWS accounts and business apps, with users synced from a corporate directory or managed natively. |
| AWS STS | Mints short-lived temporary credentials; the machinery underneath every IAM role assumption. |
| AWS Organizations | Groups many accounts under one umbrella for consolidated billing and central governance; SCPs cap what member-account identities can ever be allowed to do. |
| AWS Control Tower | Automated multi-account landing zone on top of Organizations, with guardrails and account vending built in. |
| AWS KMS | Managed encryption keys: create, rotate, and control access to the keys that encrypt data across almost every AWS service. |
| AWS Secrets Manager | Stores database credentials and API keys behind an API, with built-in automatic rotation. |
| AWS Certificate Manager | Free public TLS certificates that auto-renew and attach to CloudFront, load balancers, and API Gateway. |
| Amazon Cognito | Sign-up and sign-in for your own app's users: user pools handle authentication, identity pools trade tokens for temporary AWS credentials. |
| Amazon GuardDuty | Continuous threat detection that analyzes CloudTrail, VPC Flow Logs, and DNS logs for signs of compromise. |
| Amazon Macie | Machine-learning scans of S3 that find, classify, and alert on sensitive data such as PII. |
| AWS CloudTrail | Records every API call in the account — who did what, when, and from where — for auditing and forensics. |
| AWS Config | Tracks resource configuration history and continuously evaluates it against compliance rules, with optional auto-remediation. |
| AWS WAF | Web application firewall filtering HTTP(S) requests by rule — SQL injection, XSS, rate limits, IP or geo match — at CloudFront, ALB, or API Gateway. |
| AWS Shield | Managed DDoS protection: Standard is free and always on, Advanced adds large-attack response, cost protection, and a response team. |
| Amazon VPC Security Groups | Stateful instance-level firewalls with allow rules only; return traffic is automatically permitted. |
| Amazon VPC Network ACLs | Stateless subnet-level allow and deny rules evaluated in number order; both directions must be opened explicitly. |
| AWS Backup | Central, policy-driven backup plans and vaults spanning EBS, RDS, DynamoDB, EFS, Storage Gateway, and more. |

## Networking and Content Delivery

| Service | What it's for |
| --- | --- |
| Amazon VPC | Your private software-defined network in AWS: a CIDR range carved into subnets, wired up with route tables and gateways. |
| NAT Gateway | Managed egress for private subnets — instances can reach out to the internet while staying unreachable from it. |
| VPC Peering | Private one-to-one link between two VPCs; not transitive, so full connectivity between many VPCs needs a peering per pair. |
| AWS Transit Gateway | Regional hub-and-spoke router connecting many VPCs and on-premises links transitively — the cure for peering meshes. |
| VPC Gateway Endpoints | Free route-table entries that keep S3 and DynamoDB traffic on the AWS network, with no NAT or internet path required. |
| AWS PrivateLink | Interface endpoints that expose a service into consumer VPCs over private IPs — no internet gateway, NAT, or peering involved. |
| VPC Flow Logs | Captures accepted and rejected IP traffic metadata at the VPC, subnet, or ENI level for troubleshooting and security analysis. |
| AWS Site-to-Site VPN | Encrypted IPsec tunnels from on-premises equipment to AWS over the public internet — quick to set up, internet-variable performance. |
| AWS Direct Connect | A dedicated private circuit from your data center into AWS for consistent bandwidth and latency; provisioning takes weeks. |
| Amazon Route 53 | Highly available DNS with health checks and routing policies — weighted, latency, failover, geolocation — plus domain registration. |
| Amazon CloudFront | Global CDN that caches content at edge locations, with HTTPS, signed URLs and cookies, and origin failover. |
| AWS Global Accelerator | Two static anycast IPs that put user traffic onto the AWS backbone at the nearest edge — for non-HTTP workloads or instant regional failover. |
| Elastic Load Balancing | The managed load balancer family: spreads traffic across healthy targets in multiple AZs behind one endpoint. |
| Application Load Balancer | Layer-7 HTTP(S) load balancer routing by path, host, or header to target groups, including Lambda targets. |
| Network Load Balancer | Layer-4 TCP/UDP load balancer built for millions of requests per second, ultra-low latency, and a static IP per AZ. |
| Gateway Load Balancer | Transparently slots fleets of third-party network appliances — firewalls, IDS/IPS — into the traffic path. |
| Amazon API Gateway | Managed front door for REST, HTTP, and WebSocket APIs: authentication, throttling, caching, and direct Lambda integration. |

## Compute, Containers, and Serverless

| Service | What it's for |
| --- | --- |
| Amazon EC2 | Resizable virtual machines with a menu of instance families and purchase options: On-Demand, Reserved, Savings Plans, and Spot. |
| Amazon EC2 Auto Scaling | Keeps an instance fleet at the right size — scaling on metrics or schedules and replacing instances that fail health checks. |
| AWS Lambda | Run functions without servers: event-triggered code billed per millisecond, scaling automatically, capped at 15 minutes per invocation. |
| Amazon ECS | AWS-native container orchestration that runs Docker tasks and services on EC2 instances or Fargate. |
| Amazon EKS | Managed Kubernetes control plane for teams standardized on Kubernetes APIs and tooling. |
| AWS Fargate | Serverless capacity for ECS and EKS containers — no instances to provision or patch, billed by the task's CPU and memory. |
| Amazon SQS | Managed message queue that decouples producers from consumers, with dead-letter queues and a FIFO variant. |
| Amazon SNS | Pub/sub fan-out: one published message pushed to many subscribers — SQS queues, Lambda functions, HTTPS endpoints, email, SMS. |
| AWS Step Functions | Serverless state machines that orchestrate multi-step workflows with branching, retries, and error handling. |
| AWS X-Ray | Distributed tracing that follows a request across services to pinpoint latency bottlenecks and errors. |
| AWS Batch | Runs large-scale batch computing jobs on managed queues, provisioning the right amount of EC2 or Fargate capacity automatically. |
| AWS Outposts | AWS-managed racks in your own data center, running native AWS services on premises for low-latency or data-residency needs. |

## Storage

| Service | What it's for |
| --- | --- |
| Amazon S3 | Eleven-nines-durable object storage with storage classes, lifecycle rules, versioning, and rich policy and encryption controls. |
| Amazon S3 Glacier | S3's archival storage classes — the cheapest per GB, with retrievals ranging from milliseconds to hours by tier. |
| Amazon EBS | Network-attached block volumes for a single EC2 instance within one AZ; snapshots back them up incrementally to S3. |
| Amazon EFS | Elastic NFS file system that many Linux instances can mount across AZs, growing and shrinking automatically. |
| Amazon FSx | Managed third-party file systems: Windows File Server for SMB and Active Directory, Lustre for HPC scratch speed, and more. |
| AWS Storage Gateway | Hybrid bridge that presents cloud-backed file shares, volumes, and virtual tapes to on-premises applications. |
| AWS DataSync | Accelerated online transfer for moving file and object datasets between on-premises storage and AWS. |
| AWS Transfer Family | Managed SFTP, FTPS, and FTP endpoints that land uploaded files directly in S3 or EFS. |

## Database

| Service | What it's for |
| --- | --- |
| Amazon RDS | Managed relational engines (MySQL, PostgreSQL, and more) with Multi-AZ standbys for failover and read replicas for read scaling. |
| Amazon RDS Proxy | Managed connection pooling in front of RDS and Aurora so bursty or serverless callers don't exhaust database connections. |
| Amazon Aurora | AWS-built MySQL- and PostgreSQL-compatible engine: six-way storage replication across three AZs, up to 15 read replicas, and a Serverless option. |
| Amazon DynamoDB | Serverless key-value and document database with single-digit-millisecond reads at any scale, plus DAX caching, global tables, and streams. |
| Amazon ElastiCache | Managed in-memory Redis or Memcached for microsecond-latency caching and session storage. |
| Amazon Redshift | Petabyte-scale columnar data warehouse for OLAP — complex SQL analytics across huge datasets. |
| AWS DMS | Migrates databases into AWS with minimal downtime — like-for-like moves or, with the Schema Conversion Tool, cross-engine migrations. |
| Amazon Timestream | Purpose-built serverless time-series database for high-volume metrics and IoT telemetry. |

## Analytics

| Service | What it's for |
| --- | --- |
| Amazon Athena | Serverless SQL directly against files in S3 — pay per data scanned, nothing to provision. |
| AWS Glue | Serverless ETL jobs plus the Data Catalog whose crawlers make S3 data queryable by Athena, EMR, and Redshift. |
| Amazon Kinesis Data Streams | Real-time streaming ingestion with shard-based scaling and replayable records for multiple consumers. |
| Amazon EMR | Managed big-data clusters — Spark, Hadoop, Hive — for heavy distributed processing jobs. |
| AWS Lake Formation | Builds and secures S3 data lakes, layering fine-grained, centrally managed table and column permissions over Glue. |

## Management, Governance, and Cost

| Service | What it's for |
| --- | --- |
| Amazon CloudWatch | Metrics, logs, alarms, and dashboards for AWS resources and applications — and the trigger behind most auto scaling. |
| AWS Cost Explorer | Visualizes historical spend with filtering and grouping, and forecasts where costs are heading. |
| AWS Budgets | Set cost or usage thresholds and get alerts — or trigger actions — when actuals or forecasts cross them. |
| AWS Savings Plans | Commit to a $/hour of compute for one or three years in exchange for deep discounts across EC2, Fargate, and Lambda. |
| AWS Trusted Advisor | Automated account checks against AWS best practices: cost, performance, security, fault tolerance, and service limits. |
| AWS Service Quotas | One console for viewing per-service limits, requesting increases, and alarming as usage approaches a quota. |
