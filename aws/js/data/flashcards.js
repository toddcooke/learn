// js/data/flashcards.js
// Flashcard deck covering the major in-scope AWS services referenced across
// the Secure, Resilient, High-Performing, and Cost-Optimized study content
// (see js/data/studyContent.js). Grounded in AWS documentation cached under
// .cache/aws-docs/ (see scripts/fetch-doc.mjs). Written in the author's own
// words, not copied verbatim from AWS's docs.

// Canonical domain buckets for this deck. Every card's `domain` must be one
// of these (enforced by scripts/validate-content.mjs); the Anki export
// derives its hierarchical tags from them.
export const FLASHCARD_DOMAINS = [
  'Security, Identity, and Compliance',
  'Networking and Content Delivery',
  'Compute, Containers, and Serverless',
  'Storage',
  'Database',
  'Analytics',
  'Management, Governance, and Cost',
  'Best-Fit Scenarios',
];

export const FLASHCARDS = [
  // ---------------------------------------------------------------------
  // Security, Identity, and Compliance
  // ---------------------------------------------------------------------
  {
    id: 'iam',
    service: 'AWS IAM',
    domain: 'Security, Identity, and Compliance',
    front: 'What does IAM control within an AWS account?',
    back: "IAM is the account-wide gatekeeper for who can sign in and what they're allowed to touch once inside. Every request is checked against attached policies and denied by default unless something explicitly allows it, which is why the standard design pattern is to start a role with almost no access and add only what its job actually requires.",
  },
  {
    id: 'iam-policies',
    service: 'AWS IAM',
    domain: 'Security, Identity, and Compliance',
    front: 'Identity-based vs. resource-based policies: what is the exam-relevant difference?',
    back: "An identity-based policy lives on a user, group, or role and lists what that principal can do. A resource-based policy is attached straight to the resource being protected instead (think a bucket policy on S3, or a policy on a KMS key), and it lets you name a principal in a completely different AWS account right in the policy — a second way to grant cross-account access alongside the more familiar pattern of having that account assume a role of yours.",
  },
  {
    id: 'iam-identity-center',
    service: 'AWS IAM Identity Center',
    domain: 'Security, Identity, and Compliance',
    front: 'How does IAM Identity Center manage access for an entire workforce across many AWS accounts?',
    back: "It gives an entire workforce single sign-on into many AWS accounts and business applications from one console, instead of creating a separate IAM user for every person in every account. It can sync in users from an existing corporate directory or manage them natively, and it assigns access to accounts based on job function across the whole organization at once.",
  },
  {
    id: 'sts',
    service: 'AWS STS',
    domain: 'Security, Identity, and Compliance',
    front: 'Why use temporary credentials instead of long-term access keys?',
    back: "STS mints credentials that self-destruct after minutes to hours, handed out on the spot rather than kept in storage anywhere. Every flavor of IAM role runs on top of this — a compute instance's attached profile, a serverless function's execution role, or someone switching into another account with AssumeRole — so a leaked credential naturally stops working instead of staying valid until someone notices and revokes it.",
  },
  {
    id: 'organizations',
    service: 'AWS Organizations',
    domain: 'Security, Identity, and Compliance',
    front: 'What does it manage, and how do SCPs fit in?',
    back: 'Organizations groups many AWS accounts under one umbrella for consolidated billing and central policy management. Service control policies (SCPs), applied at the organization or OU level, cap the maximum permissions any identity in a member account can ever have — they never grant anything themselves, they only narrow what the identity and resource policies inside that account are allowed to permit.',
  },
  {
    id: 'control-tower',
    service: 'AWS Control Tower',
    domain: 'Security, Identity, and Compliance',
    front: 'What does Control Tower automate when standing up a governed multi-account AWS environment, and what does it keep checking for afterward?',
    back: "Control Tower automates the setup of a governed multi-account environment on top of Organizations, wiring up baseline guardrails, centralized logging, and account provisioning that you would otherwise have to script by hand. It also monitors accounts for drifting away from those established guardrails over time.",
  },
  {
    id: 'kms',
    service: 'AWS KMS',
    domain: 'Security, Identity, and Compliance',
    front: 'What does KMS create and manage?',
    back: 'KMS creates and controls the encryption keys used to protect data across AWS services, keeping key material inside hardware security modules so it never leaves in plaintext. Each key is governed by a single required policy document that decides who can use it.',
  },
  {
    id: 'kms-key-rotation',
    service: 'AWS KMS',
    domain: 'Security, Identity, and Compliance',
    front: 'How often can a KMS key rotate its cryptographic material automatically?',
    back: 'A key can optionally rotate its cryptographic material automatically — yearly by default, or on a custom schedule anywhere from 90 to 2,560 days — and can also be rotated on demand, all with no application changes required.',
  },
  {
    id: 'acm',
    service: 'AWS Certificate Manager',
    domain: 'Security, Identity, and Compliance',
    front: 'Which kinds of AWS resources consume ACM certificates, and what expiration-related chore does it take off your plate?',
    back: "ACM issues, stores, and manages public and private TLS certificates for services like a load balancer or a CloudFront distribution, saving you from tracking expiration dates yourself.",
  },
  {
    id: 'acm-auto-renewal',
    service: 'AWS Certificate Manager',
    domain: 'Security, Identity, and Compliance',
    front: 'Under what conditions does ACM automatically renew a certificate?',
    back: "It automatically renews a certificate that used DNS validation and is still attached to an integrated AWS service or has been exported since issuance; otherwise it just emails you as the expiration date approaches.",
  },
  {
    id: 'secrets-manager',
    service: 'AWS Secrets Manager',
    domain: 'Security, Identity, and Compliance',
    front: 'What does Secrets Manager store for an application, and what can it do automatically?',
    back: 'Secrets Manager stores database credentials, API keys, and tokens so an application looks them up at runtime with a simple call, rather than embedding them directly in source code. It can rotate many secret types on an automatic schedule, so even a leaked credential only stays valid for a short window and no application redeploy is needed when the value changes.',
  },
  {
    id: 'cognito',
    service: 'Amazon Cognito',
    domain: 'Security, Identity, and Compliance',
    front: 'What does Cognito provide for consumer-facing web and mobile apps?',
    back: 'Cognito is a ready-made identity layer for consumer-facing web and mobile apps: a user directory, sign-up and sign-in flow, and token issuance for OAuth 2.0 and AWS credentials all in one service. It can authenticate users from its own built-in pool or federate in through an external provider such as Google or a corporate SAML/OIDC identity provider.',
  },
  {
    id: 'guardduty',
    service: 'Amazon GuardDuty',
    domain: 'Security, Identity, and Compliance',
    front: 'What kind of activity does GuardDuty detect in an AWS account?',
    back: "GuardDuty continuously watches the data sources and logs already flowing through your account, running threat-intelligence feeds and machine-learning models against them to surface likely malicious activity — compromised credentials, cryptomining, or unusual database login patterns are typical examples of what it flags.",
  },
  {
    id: 'macie',
    service: 'Amazon Macie',
    domain: 'Security, Identity, and Compliance',
    front: 'What does Macie scan S3 buckets for?',
    back: "Macie uses machine learning and pattern matching to scan S3 buckets, discovering sensitive data such as PII or financial records and flagging any bucket that's misconfigured to allow public access. It's built to answer a data-exposure question — what sensitive information do we have and can the internet see it — which is a different job from an intrusion-hunting tool like GuardDuty.",
  },
  {
    id: 'shield',
    service: 'AWS Shield',
    domain: 'Security, Identity, and Compliance',
    front: 'What does AWS Shield protect against?',
    back: 'Shield defends internet-facing applications against DDoS traffic floods aimed at knocking them offline.',
  },
  {
    id: 'shield-tiers',
    service: 'AWS Shield',
    domain: 'Security, Identity, and Compliance',
    front: "What are AWS Shield's two protection tiers, and how do they differ?",
    back: 'Standard protection is switched on for free on every account automatically; the paid Advanced tier layers on sharper detection, active mitigation, and hands-on incident support for attacks that reach up through the transport layer into the application layer itself.',
  },
  {
    id: 'waf',
    service: 'AWS WAF',
    domain: 'Security, Identity, and Compliance',
    front: 'What does WAF let you do with incoming HTTP and HTTPS requests?',
    back: "WAF is a web application firewall: it inspects the HTTP and HTTPS requests reaching your application and lets you write rules that allow, block, or rate-limit traffic based on IP address, header values, or payload patterns, catching things like SQL injection attempts before they reach your code. It's commonly attached in front of CloudFront, an ALB, or API Gateway.",
  },
  {
    id: 'cloudtrail',
    service: 'AWS CloudTrail',
    domain: 'Security, Identity, and Compliance',
    front: 'What does CloudTrail log about activity in an AWS account?',
    back: 'CloudTrail logs every API call made against your account — who made it, from where, and what it did — regardless of whether the call came from the console, the CLI, an SDK, or another AWS service acting on your behalf. That log is the raw material governance and incident investigation both depend on, and it also happens to be a primary input GuardDuty analyzes automatically.',
  },
  {
    id: 'config',
    service: 'AWS Config',
    domain: 'Security, Identity, and Compliance',
    front: 'What is it for, and how does it differ from CloudTrail?',
    back: "Config continuously records the configuration state of your resources and how they relate to one another, so you can see exactly what a resource's settings looked like at any past point in time. CloudTrail answers 'who did what and when'; Config answers 'what did this resource's configuration look like,' and it can also evaluate resources against rules to flag drift from a desired baseline.",
  },
  {
    id: 'security-groups',
    service: 'Amazon VPC Security Groups',
    domain: 'Security, Identity, and Compliance',
    front: 'How do they control traffic?',
    back: "A security group works like a stateful firewall wrapped around one specific resource, such as a single EC2 instance, rather than an entire subnet. It only ever holds allow rules, with no way to write an explicit deny, and because it tracks connection state, the reply to traffic it let out comes back in automatically without needing a matching inbound rule.",
  },
  {
    id: 'network-acls',
    service: 'Amazon VPC Network ACLs',
    domain: 'Security, Identity, and Compliance',
    front: 'How are they different from security groups?',
    back: "A network ACL filters traffic at the subnet boundary rather than per-resource, and it's stateless, so you must write explicit allow and deny rules for both inbound and outbound directions — a permitted request doesn't automatically get its reply traffic allowed back through the way it would with a security group. Rules are evaluated in numeric order and the first match wins.",
  },
  {
    id: 'backup',
    service: 'AWS Backup',
    domain: 'Security, Identity, and Compliance',
    front: 'Which AWS services can AWS Backup manage from one console, and which backups does it NOT track?',
    back: "AWS Backup centralizes backup policies and schedules across many AWS services — EBS, RDS, DynamoDB, EFS, and more — plus supported on-premises resources, all from one console, replacing the older pattern of scripting a separate backup process for every service. It only tracks backups taken through AWS Backup itself, not snapshots created some other way outside it.",
  },

  // ---------------------------------------------------------------------
  // Networking and Content Delivery
  // ---------------------------------------------------------------------
  {
    id: 'vpc',
    service: 'Amazon VPC',
    domain: 'Networking and Content Delivery',
    front: "What does a VPC let you build inside AWS's network?",
    back: "A VPC is a logically isolated slice of network that you carve into subnets, route tables, and gateways, closely mirroring how you'd lay out a traditional data-center network, except it runs on AWS's shared, scalable infrastructure instead of hardware you own and rack yourself.",
  },
  {
    id: 'vpc-flow-logs',
    service: 'VPC Flow Logs',
    domain: 'Networking and Content Delivery',
    front: 'What information does VPC Flow Logs capture about network traffic?',
    back: 'Flow Logs capture metadata about the IP traffic crossing the network interfaces in your VPC — source, destination, port, and whether it was accepted or rejected — without capturing the packet contents themselves. It answers connectivity and security questions like "why is this instance unreachable" or "what is this instance talking to," which is a different job from CloudTrail, which logs API calls rather than network traffic.',
  },
  {
    id: 'vpc-peering',
    service: 'VPC Peering',
    domain: 'Networking and Content Delivery',
    front: "What is it for, and what's the catch?",
    back: "A peering connection privately routes traffic between two VPCs — your own or across accounts, even across Regions — over private IP addresses, so instances on either side can talk as if they shared one network. The catch is that peering is non-transitive: if VPC A peers with B, and B peers with C, A still cannot reach C without its own direct peering connection to C.",
  },
  {
    id: 'privatelink',
    service: 'AWS PrivateLink',
    domain: 'Networking and Content Delivery',
    front: 'How does PrivateLink connect resources across separate VPCs or AWS accounts?',
    back: 'PrivateLink lets a consumer in one VPC reach a service or resource hosted in a completely different VPC or account over private IP addresses, without that traffic ever touching the public internet. A provider publishes an endpoint service behind a load balancer, and a consumer connects to it by creating an interface endpoint inside their own subnet.',
  },
  {
    id: 'gateway-endpoints',
    service: 'VPC Gateway Endpoints',
    domain: 'Networking and Content Delivery',
    front: 'How are gateway endpoints different from PrivateLink interface endpoints?',
    back: "Gateway endpoints exist only for S3 and DynamoDB, work by adding an entry to a route table rather than an elastic network interface, and don't rely on PrivateLink at all. They cost nothing extra to use, whereas interface endpoints bill hourly and per gigabyte, which is why the gateway option is usually the better fit for reaching just those two services.",
  },
  {
    id: 'transit-gateway',
    service: 'AWS Transit Gateway',
    domain: 'Networking and Content Delivery',
    front: 'What problem does Transit Gateway solve for connecting many VPCs together?',
    back: "Transit Gateway is a central hub that connects many VPCs and on-premises networks through a single attachment point each, replacing the mesh of individual point-to-point peering connections you'd otherwise need to wire between every pair of VPCs. Transit gateways in different Regions can also be connected to each other over AWS's global backbone.",
  },
  {
    id: 'nat-gateway',
    service: 'NAT Gateway',
    domain: 'Networking and Content Delivery',
    front: 'What does it do, and why not just use an internet gateway?',
    back: "It gives resources with no public IP a way to reach out to the internet — pulling patches, calling a third-party API — while refusing any connection someone outside tries to initiate toward them. An internet gateway can't do this job because it requires the resource to hold a public IP and be directly reachable, which is precisely what a private subnet is designed to avoid.",
  },
  {
    id: 'direct-connect',
    service: 'AWS Direct Connect',
    domain: 'Networking and Content Delivery',
    front: 'What kind of connection does Direct Connect provide between your premises and AWS?',
    back: "Direct Connect is a dedicated physical fiber link from your data center or office into an AWS-associated facility, keeping traffic to your VPC or other AWS services off the public internet entirely. It's the choice when a workload needs steadier bandwidth and lower latency than an internet-based VPN connection can promise.",
  },
  {
    id: 'site-to-site-vpn',
    service: 'AWS Site-to-Site VPN',
    domain: 'Networking and Content Delivery',
    front: 'How does it compare to Direct Connect?',
    back: "Site-to-Site VPN builds an encrypted IPsec tunnel that rides over the public internet to link your on-premises gear to a VPC, and it can usually be turned up within minutes since no physical wiring is involved. Direct Connect instead needs a real cross-connect and a provisioning lead time measured in days or weeks, but in exchange delivers steadier bandwidth and lower latency.",
  },
  {
    id: 'route53',
    service: 'Amazon Route 53',
    domain: 'Networking and Content Delivery',
    front: 'What DNS-related functions does Route 53 provide?',
    back: "Route 53 is AWS's DNS service, covering domain registration, resolving names to IP addresses or AWS resources, and health-checking endpoints so it can steer traffic away from anything unhealthy. Its routing policies — weighted, latency-based, geolocation, failover — are what let an architect send users to whichever of several regional deployments is closest or healthiest.",
  },
  {
    id: 'cloudfront',
    service: 'Amazon CloudFront',
    domain: 'Networking and Content Delivery',
    front: 'How does CloudFront reduce latency for content delivered to end users?',
    back: "CloudFront is AWS's content delivery network: it caches your content at edge locations spread across the globe, so a user's request is served from whichever edge location gives the lowest latency instead of hitting your origin — an S3 bucket or a web server — on every single request.",
  },
  {
    id: 'global-accelerator',
    service: 'AWS Global Accelerator',
    domain: 'Networking and Content Delivery',
    front: 'What class of network traffic is Global Accelerator built to route and fail over?',
    back: "Global Accelerator improves application performance and availability by routing traffic over AWS's private backbone network to the nearest healthy regional endpoint, using a fixed set of static anycast IP addresses. It works for general TCP/UDP applications and failover, not caching — CloudFront is specifically the caching layer for HTTP(S) content.",
  },
  {
    id: 'alb',
    service: 'Application Load Balancer',
    domain: 'Networking and Content Delivery',
    front: 'What can an Application Load Balancer route traffic based on?',
    back: "An ALB works at the application layer and can send one incoming request to a different target group depending on its URL path, hostname, or headers. Reach for it whenever the routing decision has to look at the content of the request itself — for example, fronting several microservices behind one balancer and splitting traffic between them by path.",
  },
  {
    id: 'nlb',
    service: 'Network Load Balancer',
    domain: 'Networking and Content Delivery',
    front: 'What performance characteristics make a Network Load Balancer the right pick?',
    back: 'An NLB works at the transport layer and is built for extremely high throughput with very low, consistent latency, plus it can hand out a static IP address per Availability Zone. It fits non-HTTP protocols or workloads where shaving off microseconds matters more than routing based on request content.',
  },
  {
    id: 'alb-vs-nlb',
    service: 'Elastic Load Balancing',
    domain: 'Networking and Content Delivery',
    front: 'Between an ALB and an NLB, which OSI layer does each operate at, and what kind of traffic is each built to handle?',
    back: 'An ALB operates at the application layer (Layer 7) and is built for HTTP(S) traffic, since routing by URL path, hostname, or headers means it has to actually read the request. An NLB operates at the transport layer (Layer 4) and handles any TCP or UDP traffic without inspecting request content, which is exactly what lets it hit the extreme throughput and ultra-low latency an ALB cannot match.',
  },
  {
    id: 'gwlb',
    service: 'Gateway Load Balancer',
    domain: 'Networking and Content Delivery',
    front: 'What problem does a Gateway Load Balancer solve for inserting security appliances into a traffic path?',
    back: 'A GWLB sits at layer 3 and quietly slots a fleet of third-party security appliances — firewalls, intrusion detection or prevention systems — into the middle of a traffic path, spreading requests across whichever appliances are healthy. Nothing else in the architecture needs to be aware that inspection is even happening.',
  },
  {
    id: 'api-gateway',
    service: 'Amazon API Gateway',
    domain: 'Networking and Content Delivery',
    front: 'What does API Gateway handle before a request reaches your backend?',
    back: "API Gateway is the managed front door for building and publishing APIs — REST, HTTP, or WebSocket — at scale, handling throttling, authorization, and request or response shaping before a call ever reaches your backend, often a Lambda function. It removes the need to build and scale that front-door layer yourself.",
  },

  // ---------------------------------------------------------------------
  // Compute, Containers, and Serverless
  // ---------------------------------------------------------------------
  {
    id: 'ec2',
    service: 'Amazon EC2',
    domain: 'Compute, Containers, and Serverless',
    front: 'What does EC2 let you provision on demand?',
    back: "EC2 provides virtual servers you launch on demand, picking an instance type that balances compute, memory, network, and storage for the job at hand. You can add capacity for a traffic spike or a heavy batch run and remove it again afterward, instead of buying and racking fixed physical hardware.",
  },
  {
    id: 'ec2-purchasing-options',
    service: 'Amazon EC2',
    domain: 'Compute, Containers, and Serverless',
    front: 'On-Demand vs. Reserved Instances vs. Spot vs. Savings Plans: how do you choose?',
    back: 'On-Demand bills by the second with zero commitment, the default for unpredictable workloads. Reserved Instances and Savings Plans both trade a 1- or 3-year usage commitment for a lower rate — Reserved Instances lock in a specific instance configuration, while Savings Plans commit to a dollar-per-hour spend that flexes across instance families and even Fargate or Lambda usage. Spot Instances request spare capacity at steep discounts but can be reclaimed on short notice, so they suit interruption-tolerant work.',
  },
  {
    id: 'ec2-auto-scaling',
    service: 'Amazon EC2 Auto Scaling',
    domain: 'Compute, Containers, and Serverless',
    front: 'What three capacity settings does EC2 Auto Scaling use to size a group automatically?',
    back: 'It keeps a group of EC2 instances at the right size automatically. You set a minimum, a maximum, and a desired capacity, and scaling policies add or remove instances as demand rises and falls so the group never drops below its floor or climbs above its ceiling.',
  },
  {
    id: 'lambda',
    service: 'AWS Lambda',
    domain: 'Compute, Containers, and Serverless',
    front: 'What does Lambda let you avoid managing when running code in response to an event?',
    back: "Lambda runs your code in response to an event or an API call without you provisioning or patching any server — AWS manages the underlying infrastructure and scales each invocation independently to match demand. It plugs into triggers from API Gateway, S3, SQS, EventBridge, and hundreds of other AWS services.",
  },
  {
    id: 'fargate',
    service: 'AWS Fargate',
    domain: 'Compute, Containers, and Serverless',
    front: 'What problem does Fargate solve for running containers on ECS or EKS?',
    back: "Fargate is a serverless compute engine for containers: you define a task or pod and Fargate runs it without you provisioning, patching, or capacity-planning any underlying EC2 instances. It's a launch type available to both ECS and EKS, and you pay for the vCPU and memory the container actually uses.",
  },
  {
    id: 'ecs',
    service: 'Amazon ECS',
    domain: 'Compute, Containers, and Serverless',
    front: 'What does ECS manage for you when running Docker containers?',
    back: "ECS takes care of deploying, scaling, and running Docker containers for you as a managed orchestration platform, integrated with tooling like Amazon ECR for images. You can run its tasks on Fargate — no servers to manage — or on the EC2 launch type, where you control the underlying instances yourself.",
  },
  {
    id: 'eks',
    service: 'Amazon EKS',
    domain: 'Compute, Containers, and Serverless',
    front: 'What part of running Kubernetes does EKS manage for you?',
    back: "EKS runs standard, upstream Kubernetes as a managed service, taking over the Kubernetes control plane's operation, availability, and upgrades so teams already invested in Kubernetes manifests and tooling can bring that investment to AWS instead of standing up and operating their own control plane.",
  },
  {
    id: 'step-functions',
    service: 'AWS Step Functions',
    domain: 'Compute, Containers, and Serverless',
    front: 'What does Step Functions orchestrate, and how does it handle retries and ordering?',
    back: 'Step Functions orchestrates a sequence of AWS service calls — often Lambda invocations — into a visual state machine, handling step ordering, retries, and error handling declaratively instead of you wiring that coordination logic into application code by hand. It is the standard tool for multi-step workflows and pipelines.',
  },
  {
    id: 'sqs',
    service: 'Amazon SQS',
    domain: 'Compute, Containers, and Serverless',
    front: 'What role does SQS play between a producer and a consumer?',
    back: "SQS is a managed message queue that decouples producers from consumers: a producer drops a message onto the queue and a consumer pulls it off independently, so neither side needs to be online or fast at the same moment. Standard queues favor throughput with at-least-once delivery, while FIFO queues guarantee strict ordering and exactly-once processing.",
  },
  {
    id: 'sns',
    service: 'Amazon SNS',
    domain: 'Compute, Containers, and Serverless',
    front: 'How does SNS deliver a single published message to multiple subscribers at once?',
    back: 'SNS is publish/subscribe: a publisher sends one message to a topic and SNS fans it out to every subscriber at once — which can be SQS queues, Lambda functions, email, SMS, or HTTP endpoints. SQS instead holds messages in a single queue for one or more consumers to pull, so SNS handles broadcast delivery where SQS handles point-to-point buffering.',
  },
  {
    id: 'x-ray',
    service: 'AWS X-Ray',
    domain: 'Compute, Containers, and Serverless',
    front: 'What does X-Ray trace as a request moves through a distributed application?',
    back: 'X-Ray traces a request as it travels through a distributed application, capturing timing and metadata for each downstream call — to another microservice, a database, or an external API — so you can pinpoint which hop in the chain is slow or failing instead of guessing across an entire fleet of services.',
  },

  // ---------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------
  {
    id: 's3',
    service: 'Amazon S3',
    domain: 'Storage',
    front: 'What kind of storage does S3 provide, and what is it commonly used for?',
    back: 'S3 is object storage built for effectively unlimited scale and very high durability, used for everything from static website hosting and data lake storage to backups and application assets. Objects live inside buckets, and access is controlled through bucket policies, ACLs, and IAM policies working together.',
  },
  {
    id: 's3-glacier',
    service: 'Amazon S3 Glacier',
    domain: 'Storage',
    front: 'When would you use Amazon S3 Glacier over S3 Standard?',
    back: "Glacier's storage classes are built for data you rarely expect to touch again — archives and long-term compliance retention — trading storage price down in exchange for restrictions on how quickly (or cheaply) you get an object back.",
  },
  {
    id: 's3-glacier-retrieval-times',
    service: 'Amazon S3 Glacier',
    domain: 'Storage',
    front: "How do retrieval times differ across S3 Glacier's storage tiers?",
    back: "The tradeoff isn't uniform: Glacier Instant Retrieval still returns objects in milliseconds like S3 Standard, while Glacier Flexible Retrieval takes minutes to hours and Glacier Deep Archive, the cheapest tier, takes hours — so picking the right Glacier tier means matching how rarely the data is read to how tolerant the workload is of that wait.",
  },
  {
    id: 'ebs',
    service: 'Amazon EBS',
    domain: 'Storage',
    front: 'What kind of storage does EBS attach to an EC2 instance?',
    back: "EBS gives an EC2 instance a block-storage volume it can format and mount just like a local hard drive, the standard pick for boot volumes, databases, and anything needing persistent, low-latency storage. Snapshots freeze a volume's contents at a point in time and can later spin up brand-new volumes that go on living even after the original volume is gone.",
  },
  {
    id: 'efs',
    service: 'Amazon EFS',
    domain: 'Storage',
    front: 'How many compute instances can mount the same EFS file system at the same time?',
    back: 'EFS is a managed NFS file system built to be mounted by a whole fleet of instances or containers at once, resizing itself up or down as data is written or deleted, with no storage size to pre-plan. EBS, by contrast, attaches to only one instance at a time in the general case — reach for EFS the moment several compute resources need shared, simultaneous access to the same files.',
  },
  {
    id: 'fsx',
    service: 'Amazon FSx',
    domain: 'Storage',
    front: 'What type of file systems can FSx provide as a managed service?',
    back: "FSx provides fully managed third-party file systems, including a native Windows file server built on SMB for lifting and shifting Windows workloads, so applications get the exact file-system behavior and compatibility they already expect without you operating the underlying servers.",
  },
  {
    id: 'storage-gateway',
    service: 'AWS Storage Gateway',
    domain: 'Storage',
    front: 'What problem does Storage Gateway solve for on-premises applications that need cloud storage?',
    back: "Storage Gateway is a hybrid-storage bridge: a software appliance you run in your own facility that connects your existing on-premises environment to AWS-backed storage. Local applications keep using familiar file, volume, or tape interfaces while the underlying data actually lives durably in the cloud.",
  },
  {
    id: 'datasync',
    service: 'AWS DataSync',
    domain: 'Storage',
    front: 'Between which kinds of storage endpoints can DataSync move data, and what manual approach does it replace?',
    back: 'DataSync automates and speeds up one-time or scheduled bulk transfers of files and objects between on-premises storage systems and AWS storage services, or between two AWS storage services, without you having to write and babysit custom transfer scripts.',
  },
  {
    id: 'transfer-family',
    service: 'AWS Transfer Family',
    domain: 'Storage',
    front: 'What does Transfer Family let partners continue using when sending files into AWS?',
    back: "Transfer Family stands up a managed endpoint speaking older file-transfer protocols — SFTP, FTPS, plain FTP, or AS2 — and backs it with S3 or EFS, so partners and internal systems that already rely on those protocols keep working exactly as they are while the files land straight in AWS storage.",
  },

  // ---------------------------------------------------------------------
  // Database
  // ---------------------------------------------------------------------
  {
    id: 'rds',
    service: 'Amazon RDS',
    domain: 'Database',
    front: 'What operational work does RDS take off your plate for a relational database?',
    back: 'RDS takes over the operational load of running a relational database — provisioning, patching, backups, and scaling — for engines like MySQL, PostgreSQL, and SQL Server, so you get a standard relational database without managing the underlying server yourself.',
  },
  {
    id: 'rds-proxy',
    service: 'Amazon RDS Proxy',
    domain: 'Database',
    front: 'What problem does RDS Proxy solve for applications like Lambda functions connecting to a database?',
    back: 'RDS Proxy sits between your application and the database, pooling and reusing connections instead of letting each application instance open its own — a big deal for Lambda functions, which can otherwise flood a database with connections. It also keeps established connections alive through a failover to a standby, shielding the application from the interruption.',
  },
  {
    id: 'read-replicas',
    service: 'Amazon RDS / Aurora Read Replicas',
    domain: 'Database',
    front: "How does an Aurora read replica's storage architecture differ from a standard RDS read replica's, and what does that mean for replication lag?",
    back: "A read replica mirrors a database in a read-only, continuously updated copy, letting you offload query traffic and scale reads beyond what a single instance could handle for read-heavy workloads. An Aurora replica shares the same underlying storage volume as its primary, so its replication lag is typically much shorter than a standard RDS replica's.",
  },
  {
    id: 'rds-multi-az',
    service: 'Amazon RDS Multi-AZ',
    domain: 'Database',
    front: 'How is Multi-AZ different from a read replica?',
    back: "Multi-AZ is about availability, not read scaling: RDS provisions a standby copy of your database in a different Availability Zone and keeps it synchronously up to date, then fails over to it automatically if the primary has a problem. A single-instance Multi-AZ standby doesn't serve read traffic at all (only the newer Multi-AZ DB cluster option does), which is the opposite tradeoff from a read replica, whose whole purpose is serving reads.",
  },
  {
    id: 'aurora',
    service: 'Amazon Aurora',
    domain: 'Database',
    front: 'What makes it different from standard RDS engines?',
    back: "Aurora speaks the MySQL and PostgreSQL wire protocols but runs on a distributed storage layer AWS built from scratch for the cloud, which is why AWS advertises multiples of the throughput you'd see running either engine unmodified on similar hardware. Its storage expands on its own as data grows, and it's sold under the RDS umbrella alongside a serverless option that flexes compute capacity to match load.",
  },
  {
    id: 'dynamodb',
    service: 'Amazon DynamoDB',
    domain: 'Database',
    front: 'What kind of database is DynamoDB, and what response times does it target?',
    back: 'DynamoDB is a fully managed, serverless NoSQL database built for single-digit-millisecond response times at any scale, from a handful of requests to a massive workload, without you managing servers or planning capacity ahead of time. It is the default answer for key-value or document access patterns that need predictable low latency.',
  },
  {
    id: 'elasticache',
    service: 'Amazon ElastiCache',
    domain: 'Database',
    front: 'Which three engines is ElastiCache compatible with, and roughly how much faster is a cache hit than a database round-trip?',
    back: "It's a managed cache layer, compatible with Valkey, Redis OSS, or Memcached, that you place in front of a slower backing database so frequently requested data can be served from memory in microseconds instead of the milliseconds a database round-trip would take. You can run it as a serverless cache or as node-based clusters, depending on how much manual capacity control you want.",
  },
  {
    id: 'redshift',
    service: 'Amazon Redshift',
    domain: 'Database',
    front: 'What kind of workload is Redshift built to handle that a transactional database like RDS is not?',
    back: "Redshift is a managed data warehouse built to run complex analytical SQL queries across huge datasets at petabyte scale, a job a transactional database like RDS isn't optimized for. A serverless option automatically provisions and scales capacity so you pay only while a query is actually running.",
  },

  // ---------------------------------------------------------------------
  // Analytics
  // ---------------------------------------------------------------------
  {
    id: 'kinesis',
    service: 'Amazon Kinesis Data Streams',
    domain: 'Analytics',
    front: 'What does Kinesis Data Streams do with streaming data records as they arrive?',
    back: "Kinesis Data Streams ingests and holds large volumes of streaming data records in real time so downstream applications can read and process them continuously, feeding dashboards, alerts, or other AWS services as data arrives. It's the building block for real-time pipelines, as opposed to batch jobs that run against data already at rest.",
  },
  {
    id: 'glue',
    service: 'AWS Glue',
    domain: 'Analytics',
    front: 'What does Glue provide for building a data lake from many data sources?',
    back: 'Glue is a serverless data-integration service for discovering, cataloging, and running ETL jobs that move and reshape data from many sources into a data lake, with no infrastructure of your own to provision. Its central data catalog is exactly what services like Athena and Redshift Spectrum query against.',
  },
  {
    id: 'athena',
    service: 'Amazon Athena',
    domain: 'Analytics',
    front: 'How does Athena let you query data sitting in S3?',
    back: 'Athena runs standard SQL queries directly against data sitting in S3 without loading it into a database first, charging per query rather than requiring an always-on cluster. It suits ad-hoc analysis of data-lake content, often working off table definitions that Glue\'s data catalog already provides.',
  },
  {
    id: 'lake-formation',
    service: 'AWS Lake Formation',
    domain: 'Analytics',
    front: 'What problem does Lake Formation solve for controlling access to a data lake?',
    back: 'Lake Formation adds a fine-grained permissions layer — down to specific columns, rows, and cells — on top of a data lake built on S3 and cataloged in Glue, enforced consistently across the analytics services that query it (Athena, Redshift, EMR), instead of managing access rules separately in each service.',
  },
  {
    id: 'emr',
    service: 'Amazon EMR',
    domain: 'Analytics',
    front: 'What kind of workload is EMR designed to run that Athena is not?',
    back: "EMR runs big-data processing frameworks like Apache Spark and Hadoop on a managed cluster, handling provisioning and cluster management so you can focus on the processing logic itself. It suits large-scale batch transformation and analytics work that Athena's serverless, per-query model isn't built for.",
  },

  // ---------------------------------------------------------------------
  // Management, Governance, and Cost
  // ---------------------------------------------------------------------
  {
    id: 'cloudwatch',
    service: 'Amazon CloudWatch',
    domain: 'Management, Governance, and Cost',
    front: 'What does CloudWatch collect from AWS resources, and what can an alarm trigger?',
    back: "CloudWatch collects metrics, logs, and events from your AWS resources and applications, letting you build dashboards, set alarms that fire on a threshold, and react automatically — an alarm can, for instance, drive an Auto Scaling policy. It's the central observability service for answering 'is this healthy right now.'",
  },
  {
    id: 'cost-explorer',
    service: 'AWS Cost Explorer',
    domain: 'Management, Governance, and Cost',
    front: 'What does Cost Explorer help you analyze about past AWS spending?',
    back: "Cost Explorer visualizes and breaks down your historical spending and usage, forecasts likely future costs, and can recommend Reserved Instance purchases based on what you've actually been running. It's the tool for answering 'where is our money going and why,' not for setting a hard spending limit.",
  },
  {
    id: 'budgets',
    service: 'AWS Budgets',
    domain: 'Management, Governance, and Cost',
    front: 'What can AWS Budgets do once actual or forecasted spend crosses a threshold you define?',
    back: 'Budgets lets you set a target cost or usage threshold and get alerted — or even trigger an automated action — when actual or forecasted spend crosses it. Where Cost Explorer is retrospective analysis, Budgets is the proactive guardrail watching spend against a number you defined ahead of time.',
  },
  {
    id: 'savings-plans',
    service: 'AWS Savings Plans',
    domain: 'Management, Governance, and Cost',
    front: 'What do you commit to with an AWS Savings Plan?',
    back: 'Savings Plans trade a 1- or 3-year commitment to a steady hourly spend, measured in dollars rather than a specific instance type. Compute Savings Plans apply flexibly across EC2 instance family, size, OS, and Region, and even cover Fargate and Lambda usage — more flexible than committing to one fixed Reserved Instance configuration.',
  },
  {
    id: 'savings-plans-discount',
    service: 'AWS Savings Plans',
    domain: 'Management, Governance, and Cost',
    front: 'What discount off On-Demand rates does an AWS Savings Plan unlock?',
    back: 'A discount of up to roughly 72% off On-Demand rates, in exchange for that 1- or 3-year commitment to a steady hourly spend.',
  },
  {
    id: 'trusted-advisor',
    service: 'AWS Trusted Advisor',
    domain: 'Management, Governance, and Cost',
    front: 'What areas does Trusted Advisor check your account against best practices for?',
    back: 'Trusted Advisor inspects your account against AWS best practices and surfaces opportunities across cost optimization, performance, security, fault tolerance, and service limits. Every account gets the service-limit checks at no cost, while the fuller set of checks, including most security and cost checks, requires a Business, Enterprise, or equivalent support plan.',
  },
  {
    id: 'service-quotas',
    service: 'AWS Service Quotas',
    domain: 'Management, Governance, and Cost',
    front: 'What can you do through Service Quotas when a workload needs more resources than an AWS default limit allows?',
    back: "Service Quotas gives you one place to see the default limits AWS applies to resources in your account — such as the number of VPCs per Region or EC2 instances of a given type — and to request an increase when a workload's real needs exceed the default, rather than hunting through each service's own documentation for its limits.",
  },

  // ---------------------------------------------------------------------
  // Best-Fit Scenarios
  // ---------------------------------------------------------------------
  {
    id: 'scenario-shared-posix-fs',
    service: 'Best-Fit Scenario',
    domain: 'Best-Fit Scenarios',
    front: 'A fleet of EC2 instances needs a shared POSIX file system that many of them can mount and write to at the same time — which storage service fits?',
    back: 'Amazon EFS: a managed, elastic NFS file system built to be mounted by many instances or containers at once, resizing itself automatically as data is written or deleted. EBS attaches to only one instance at a time in the general case, and FSx for Windows File Server speaks SMB rather than POSIX, so EFS is the one built for concurrent, POSIX-style access across a fleet.',
  },
  {
    id: 'scenario-microsecond-cache',
    service: 'Best-Fit Scenario',
    domain: 'Best-Fit Scenarios',
    front: "An application needs to shave its hottest, most frequently requested lookups down from a database's millisecond round-trip to microseconds — which service sits in front of the database to do that?",
    back: "Amazon ElastiCache: a managed in-memory cache that serves frequently requested data straight from memory in microseconds instead of paying a database round-trip measured in milliseconds. It's the caching layer teams place ahead of a database, not a substitute system of record for it.",
  },
  {
    id: 'scenario-decouple-queue',
    service: 'Best-Fit Scenario',
    domain: 'Best-Fit Scenarios',
    front: 'A checkout service needs to hand work off to an inventory processor so that neither one goes down if the other is slow or briefly offline — which service decouples them?',
    back: "Amazon SQS: a producer drops a message on the queue and moves on, and a consumer pulls it off whenever it's ready, so a traffic spike on one side simply queues up rather than overwhelming or stalling the other side.",
  },
  {
    id: 'scenario-fanout-notification',
    service: 'Best-Fit Scenario',
    domain: 'Best-Fit Scenarios',
    front: 'One order-placed event needs to reach a fulfillment queue, an analytics function, and an email notification all at once, without the publisher tracking who is listening — which service fits?',
    back: 'Amazon SNS: a publisher sends one message to a topic and SNS fans it out to every subscriber at once — SQS queues, Lambda functions, email, or HTTP endpoints — without the publisher tracking or individually contacting each downstream listener.',
  },
  {
    id: 'scenario-dedicated-onprem-link',
    service: 'Best-Fit Scenario',
    domain: 'Best-Fit Scenarios',
    front: 'A company wants the steadiest possible bandwidth and lowest latency between its datacenter and AWS, entirely off the public internet, and can tolerate a multi-week provisioning lead time to get it — which connectivity option fits?',
    back: 'AWS Direct Connect: a dedicated physical link straight into an AWS-associated facility that bypasses the public internet, trading a longer provisioning lead time for steadier bandwidth and lower latency than an internet-based path like Site-to-Site VPN can promise.',
  },
  {
    id: 'scenario-udp-game-routing',
    service: 'Best-Fit Scenario',
    domain: 'Best-Fit Scenarios',
    front: 'A multiplayer game server talks over a custom UDP protocol and needs every connection routed to whichever healthy regional deployment is currently closest, through IP addresses that never change — which service fits?',
    back: "AWS Global Accelerator: it assigns a fixed pair of anycast IP addresses and routes TCP/UDP connections over AWS's private backbone to whichever healthy regional endpoint is currently nearest, failing over within seconds if a health check trips. CloudFront instead solves a different problem — caching HTTP content — so it isn't built to route arbitrary UDP traffic at all.",
  },
  {
    id: 'scenario-cold-archive-lowest-cost',
    service: 'Best-Fit Scenario',
    domain: 'Best-Fit Scenarios',
    front: 'A compliance team needs to retain audit logs it expects to access less than once a year at the lowest possible storage cost, and can tolerate a many-hour wait on the rare occasion one needs restoring — which storage tier fits?',
    back: 'S3 Glacier Deep Archive: the cheapest S3 storage tier, purpose-built for archives accessed less than once a year, with a retrieval time measured in hours. Glacier Instant Retrieval and Flexible Retrieval cost more precisely because they promise faster access than this workload actually needs.',
  },
  {
    id: 'scenario-lift-shift-smb',
    service: 'Best-Fit Scenario',
    domain: 'Best-Fit Scenarios',
    front: 'A legacy Windows application expects to talk to a native SMB file server and is being lifted and shifted into AWS unmodified — which managed file system gives it that exact behavior?',
    back: 'Amazon FSx for Windows File Server: a fully managed, native Windows file server built on SMB, so the application gets the exact file-system behavior and compatibility it already expects without anyone operating the underlying servers. EFS solves the equivalent problem for POSIX/NFS workloads, not SMB.',
  },
  {
    id: 'scenario-transparent-appliance-insertion',
    service: 'Best-Fit Scenario',
    domain: 'Best-Fit Scenarios',
    front: 'Security wants to insert a fleet of third-party intrusion-detection appliances into a traffic path so transparently that no other part of the architecture has to know inspection is even happening — which load balancer type fits?',
    back: 'A Gateway Load Balancer: it works at the network layer to transparently slot third-party security appliances into a traffic path, spreading requests across whichever ones are healthy, while an ALB or NLB has no equivalent transparent-insertion role.',
  },
  {
    id: 'scenario-serverless-nosql-latency',
    service: 'Best-Fit Scenario',
    domain: 'Best-Fit Scenarios',
    front: 'A mobile app needs its own durable session-store table to hit single-digit-millisecond reads at any scale, without anyone managing servers or planning capacity ahead of time — which database fits?',
    back: 'Amazon DynamoDB: a fully managed, serverless NoSQL database built for single-digit-millisecond response times at any scale. Unlike ElastiCache, which only caches in front of a system of record, DynamoDB is itself the durable, persistent store.',
  },
];
