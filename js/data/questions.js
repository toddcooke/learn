// js/data/questions.js
// Quiz questions for Domain 1: Design Secure Architectures (30% exam weight).
// Every question is grounded in AWS documentation cached under .cache/aws-docs/
// (see scripts/fetch-doc.mjs). Distributed across the domain's 3 task
// statements: 1.1 Design secure access to AWS resources (secure-001..012),
// 1.2 Design secure workloads and applications (secure-013..024),
// 1.3 Determine appropriate data security controls (secure-025..036).

export const QUESTIONS = [
  // ---------------------------------------------------------------------
  // Task 1.1: Design secure access to AWS resources
  // ---------------------------------------------------------------------
  {
    id: 'secure-001',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'When a new AWS account is created, what access level does the initial root user have?',
    options: [
      'Only the ability to view billing information',
      'Unrestricted access to every AWS service and resource in the account',
      'Read-only access to all resources until IAM policies are attached',
      'No access until multi-factor authentication (MFA) is configured',
    ],
    correctIndexes: [1],
    explanation:
      'The root user is the very first identity on a brand-new account and starts out with full administrative control over everything in it, with no permissions to configure separately. That sweeping scope is exactly why AWS advises reserving the root user for a short list of account-level tasks and doing everyday work through separately created IAM identities instead.',
  },
  {
    id: 'secure-002',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      "According to AWS IAM documentation, what determines whether an authenticated principal's request to access an AWS resource is granted?",
    options: [
      'Whether the principal is on the list of authorized users and whether the policies enforced grant the requested permission',
      "Whether the principal has previously logged in from the same IP address",
      "Whether the principal's AWS account has enabled billing alerts",
      'Whether the request originates from the same AWS Region as the resource',
    ],
    correctIndexes: [0],
    explanation:
      "IAM's authorization check has two parts: confirming the caller's identity is recognized, and then checking whatever policies apply to see if any of them grant the specific permission being requested. Prior login locations, billing configuration, and matching Regions play no part in that decision.",
  },
  {
    id: 'secure-003',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'A company wants to grant a principal in a different AWS account access to a specific Amazon S3 bucket without creating an IAM role for that principal. Which type of policy should be attached directly to the S3 bucket?',
    options: [
      'An identity-based policy',
      'A resource-based policy',
      'A service control policy',
      'A permissions boundary',
    ],
    correctIndexes: [1],
    explanation:
      'A resource-based policy attaches straight to the resource itself — an S3 bucket in this case — and spells out which principals, including ones from other accounts, are allowed to reach it, so no separate role has to be created. Identity-based policies live on IAM principals rather than resources, an SCP can only restrict what an account is allowed to do rather than grant access, and a permissions boundary merely caps what a policy can grant.',
  },
  {
    id: 'secure-004',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      "Per AWS IAM's cross-account policy evaluation logic, what is required for a request from an IAM user in Account A to succeed against a resource in Account B that has a resource-based policy?",
    options: [
      'Only a resource-based policy in Account B that allows the request',
      'Only an identity-based policy in Account A that allows the request',
      'An identity-based policy in Account A AND a resource-based policy in Account B must both allow the request',
      "Nothing extra is needed once the accounts are joined in AWS Organizations",
    ],
    correctIndexes: [2],
    explanation:
      "Cross-account access needs sign-off on both ends: the caller's own account must have an identity-based policy permitting the action, and separately the account that owns the resource must have a resource-based policy naming that caller as allowed. If either side stays silent or denies it, the call fails — a policy on only one side is never enough once two accounts are involved.",
  },
  {
    id: 'secure-005',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'Which statement about AWS STS temporary security credentials is correct?',
    options: [
      'They must be manually revoked by an administrator before they stop working',
      'They cannot be reused after they expire, and do not need to be explicitly revoked when no longer needed',
      'They are stored permanently with the IAM user who requested them',
      'They never expire once issued',
    ],
    correctIndexes: [1],
    explanation:
      "Temporary credentials are generated on the fly rather than being tied permanently to a user, so there's nothing for an administrator to manually revoke — they simply stop functioning once their short lifetime runs out, and any attempt to reuse them after that point is always rejected.",
  },
  {
    id: 'secure-006',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      "A company wants users in Account A to access resources in Account B without creating a duplicate IAM user for each person in Account B. What does AWS documentation recommend for this scenario?",
    options: [
      "Create an IAM role in Account B that Account A's users can assume for temporary credentials (the delegation approach)",
      "Share Account B's root user password with users in Account A",
      'Create identical IAM users with matching long-term access keys in both accounts',
      'Have AWS STS issue a single permanent credential shared by every user in Account A',
    ],
    correctIndexes: [0],
    explanation:
      "This is the classic cross-account role pattern: Account B creates a role that trusts Account A, and A's users assume that role to obtain short-lived credentials scoped to B, with no duplicate identities or shared passwords required. IAM documentation labels this the delegation model for temporary access, which is distinct from the single sign-on model used to federate an external identity provider.",
  },
  {
    id: 'secure-007',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'What is the primary function of a service control policy (SCP) in AWS Organizations?',
    options: [
      "It grants IAM users and roles in member accounts additional permissions beyond what their identity-based policies allow",
      'It sets the maximum available permissions for IAM users and roles in an organization, without itself granting any permissions',
      'It replaces the need for IAM identity-based policies entirely',
      "It applies only to the organization's management account",
    ],
    correctIndexes: [1],
    explanation:
      "An SCP acts as a ceiling, never a floor — it can only narrow which actions the accounts underneath it are allowed to attempt, and it cannot hand out new permissions on its own. Actual permissions still have to come from identity-based or resource-based policies inside the account; the SCP just limits how far those policies are allowed to reach.",
  },
  {
    id: 'secure-008',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'In an AWS Organizations structure, which accounts are affected by an attached service control policy (SCP)?',
    options: [
      'Only the management account',
      'Both the management account and all member accounts equally',
      'Only member accounts; the management account is not affected',
      'No accounts, until AWS Control Tower is enabled',
    ],
    correctIndexes: [2],
    explanation:
      "SCP enforcement is scoped to member accounts only — the management account sits outside that boundary entirely, so anyone working from it is never limited by SCPs attached elsewhere in the hierarchy. Control Tower has nothing to do with this behavior; it's simply how AWS Organizations defines SCP scope by default.",
  },
  {
    id: 'secure-009',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'What does AWS Control Tower provide for organizations managing multiple AWS accounts?',
    options: [
      'A quick way to configure and govern a multi-account setup, orchestrating AWS Organizations together with Service Catalog and IAM Identity Center to assemble a landing zone in under an hour',
      'A replacement for AWS KMS that centrally manages encryption keys across accounts',
      'A content delivery network for distributing static assets across accounts',
      'A billing-only tool with no effect on account governance or guardrails',
    ],
    correctIndexes: [0],
    explanation:
      "Control Tower packages together the account-governance capabilities of several underlying services — Organizations for account structure, Service Catalog for provisioning, and IAM Identity Center for access — into one guided setup that produces a working landing zone quickly, rather than replacing any single one of those services.",
  },
  {
    id: 'secure-010',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'A mobile application wants to let users sign in with their existing Google account rather than creating new AWS credentials. Which AWS STS federation type is designed for this scenario?',
    options: [
      'SAML 2.0 federation',
      'OpenID Connect (OIDC) federation',
      'Service control policy federation',
      'AWS Direct Connect federation',
    ],
    correctIndexes: [1],
    explanation:
      "For consumer-style sign-in through a well-known outside provider such as Google, AWS STS offers OIDC federation, which lets an app trade a token from that provider for temporary AWS credentials without building custom sign-in logic. SAML federation targets a different scenario — bringing an organization's own workforce, already authenticated against its corporate directory, into AWS through single sign-on.",
  },
  {
    id: 'secure-011',
    domain: 'secure',
    questionType: 'multiple-response',
    question: 'Which of the following statements about AWS Organizations are correct? (Select TWO.)',
    options: [
      'AWS Organizations lets you simplify billing across all your accounts by using a single payment method',
      "Service control policies (SCPs) can grant permissions that a member account's IAM policies do not already allow",
      'AWS CloudTrail can be configured to create an organization-wide log of activity that member accounts cannot turn off or modify',
      'Every AWS Organizations account must use IAM Identity Center; there is no alternative for federated access',
      'Service control policies are available in every AWS Organizations setup, including ones using only consolidated billing',
    ],
    correctIndexes: [0, 2],
    explanation:
      "Consolidated billing is a core Organizations feature — a single payment method covers every linked account — and an organization-wide CloudTrail trail can be locked so that member accounts have no way to disable or edit it. The other two statements don't hold: SCPs can only restrict what a policy already allows, never add to it, and SCPs require all features to be enabled, so they are unavailable in a setup that only has consolidated billing turned on. IAM Identity Center is likewise just one option for federated access, not a mandatory one.",
  },
  {
    id: 'secure-012',
    domain: 'secure',
    questionType: 'multiple-response',
    question:
      'Which of the following are AWS-recommended IAM security best practices? (Select TWO.)',
    options: [
      'Require workloads running on EC2 or Lambda to use temporary credentials delivered via an IAM role instead of distributing long-term IAM user access keys',
      'Attach the AdministratorAccess managed policy to every new IAM user so they are never blocked by missing permissions',
      'Enable multi-factor authentication (MFA), preferably phishing-resistant MFA such as passkeys or security keys, for privileged access',
      "Use a permissions boundary to grant a role additional permissions beyond what its identity-based policy allows",
      'Store long-term IAM access keys directly in application source code so they are always available at runtime',
    ],
    correctIndexes: [0, 2],
    explanation:
      "AWS guidance calls for compute workloads to obtain temporary, automatically-refreshed credentials through an IAM role rather than embedding long-lived access keys, and for privileged human access to require MFA — ideally a phishing-resistant method such as a passkey or hardware security key. The other options contradict documented guidance: granting blanket admin rights to every new user defeats least privilege, a permissions boundary only limits what a role's own policy can grant rather than adding to it, and hard-coding access keys in source code is precisely the practice that Secrets Manager and IAM guidance warn against.",
  },

  // ---------------------------------------------------------------------
  // Task 1.2: Design secure workloads and applications
  // ---------------------------------------------------------------------
  {
    id: 'secure-013',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'A security group attached to an EC2 instance allows inbound traffic on port 443. What happens to the corresponding outbound response traffic?',
    options: [
      'It automatically leaves the instance without needing a matching outbound rule, because security groups are stateful and track the state of allowed connections',
      'It is blocked unless a matching outbound rule explicitly allows port 443',
      'It is only allowed if the destination is within the same subnet',
      'It is dropped because security groups only evaluate inbound traffic',
    ],
    correctIndexes: [0],
    explanation:
      "Security groups track connection state, so once inbound traffic on port 443 is permitted, the reply traffic for that same connection is let out automatically — there's no need for a matching outbound allow rule. This statefulness is what separates security groups from network ACLs, which evaluate inbound and outbound traffic independently of each other.",
  },
  {
    id: 'secure-014',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'A network ACL associated with a subnet has an inbound rule allowing HTTP traffic from the internet, but no outbound rule permitting the ephemeral return ports. What happens to the response traffic?',
    options: [
      'It is automatically allowed because network ACLs are stateful like security groups',
      'It is blocked, because network ACLs are stateless and responses must be explicitly allowed by an outbound rule',
      'It is allowed only if the associated security group is also stateless',
      'It is allowed because network ACL rules apply only to outbound traffic',
    ],
    correctIndexes: [1],
    explanation:
      "Network ACLs don't remember connection state the way security groups do, so permitting inbound traffic through one rule doesn't clear a path for the reply — the return traffic on the ephemeral ports needs its own outbound rule, or it gets dropped at the subnet boundary.",
  },
  {
    id: 'secure-015',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'Network ACL rules are numbered. How does AWS decide which rule applies to a given piece of traffic?',
    options: [
      'It evaluates rules in order starting from the lowest number, and applies the first rule that matches',
      'It evaluates rules in order starting from the highest number, and applies the first rule that matches',
      'It applies every matching rule and combines the most restrictive result',
      'It applies rules in the order they were created, regardless of rule number',
    ],
    correctIndexes: [0],
    explanation:
      "Rule numbers set the evaluation order: AWS steps through the rules from the smallest number upward and stops at the first one that matches the traffic, ignoring everything numbered higher after that. That's why administrators typically space rule numbers out (in gaps of 10 or 100), leaving room to slot new rules in later without renumbering the whole list.",
  },
  {
    id: 'secure-016',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'An architect places instances in a private subnet and wants them to initiate outbound connections to the internet for software updates, but never receive unsolicited inbound connections. Which component, created in a public subnet with an associated Elastic IP address, achieves this?',
    options: [
      'A public NAT gateway',
      'A network ACL',
      'A private NAT gateway',
      "An internet gateway attached directly to the private subnet's route table",
    ],
    correctIndexes: [0],
    explanation:
      "A public NAT gateway lives in a public subnet with its own Elastic IP, and it lets private-subnet instances reach the internet for things like updates while blocking any outside host from being the one to open a connection toward them. A private NAT gateway serves a similar one-way purpose but only for reaching other VPCs or on-premises networks, and it can't hold an Elastic IP since it never talks to the public internet directly.",
  },
  {
    id: 'secure-017',
    domain: 'secure',
    questionType: 'multiple-choice',
    question: 'Which statement about NAT gateway connections is correct, per AWS documentation?',
    options: [
      'Every connection routed through a NAT gateway has to originate from inside the VPC that hosts it, not from outside',
      'A private NAT gateway can be assigned an Elastic IP address just like a public NAT gateway',
      'External services outside the VPC can freely initiate new connections to instances behind a NAT gateway',
      'A NAT gateway can only be used with IPv4 traffic, never IPv6',
    ],
    correctIndexes: [0],
    explanation:
      "NAT gateway traffic is one-directional by design: the connection always has to be opened from a resource inside the VPC that owns the gateway, never from the internet or another network. Elastic IPs only attach to a public NAT gateway; a private NAT gateway forwards traffic to other VPCs or on-premises networks and has no use for one. And a NAT gateway handles both IPv4 and IPv6, not just IPv4.",
  },
  {
    id: 'secure-018',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'Which statement correctly distinguishes AWS Shield Standard from AWS Shield Advanced?',
    options: [
      'Shield Standard is included automatically with no added cost and defends against common large-scale volumetric DDoS attacks; Shield Advanced is a separately priced tier that adds broader DDoS protection',
      'Shield Standard is a paid add-on, while Shield Advanced is included automatically for free',
      'Shield Standard only protects Amazon S3 buckets, while Shield Advanced only protects EC2 instances',
      'Shield Advanced replaces the need for AWS WAF entirely',
    ],
    correctIndexes: [0],
    explanation:
      "The two tiers differ mainly in scope and price. Shield Standard ships with every AWS account, costs nothing extra, and blunts the most common large-scale DDoS techniques. Shield Advanced is an opt-in, separately billed upgrade that widens coverage to more resource types (EC2, load balancers, CloudFront, Route 53, Global Accelerator) and throws in extras like dedicated incident-response support — it complements AWS WAF rather than standing in for it.",
  },
  {
    id: 'secure-019',
    domain: 'secure',
    questionType: 'multiple-choice',
    question: 'What does AWS WAF let you do, according to AWS documentation?',
    options: [
      'Monitor HTTP and HTTPS requests forwarded to protected resources like a CloudFront distribution or Application Load Balancer, and allow, block, or count them based on conditions you specify',
      'Physically isolate AWS Regions from each other to prevent DDoS attacks',
      'Automatically rotate database credentials on a schedule',
      'Encrypt data at rest using customer-managed KMS keys',
    ],
    correctIndexes: [0],
    explanation:
      "AWS WAF inspects each web request heading toward a protected resource — CloudFront, an Application Load Balancer, API Gateway, and similar — against rules you define, then either lets the request through, blocks it, or just tallies it depending on which condition it matches. It operates at the web-request layer and has no role in DDoS mitigation, credential rotation, or encrypting stored data; those jobs belong to other dedicated services (Shield, Secrets Manager, and KMS, respectively).",
  },
  {
    id: 'secure-020',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'What is the key difference between an Amazon Cognito user pool and an Amazon Cognito identity pool?',
    options: [
      'A user pool is a user directory used to authenticate and authorize users, issuing JWTs directly; an identity pool exchanges a proven identity for temporary AWS credentials via AWS STS',
      'A user pool issues temporary AWS credentials, while an identity pool is a user directory used only for authentication',
      'User pools and identity pools are two names for the same underlying Cognito resource',
      'A user pool requires an identity pool to function and cannot issue tokens on its own',
    ],
    correctIndexes: [0],
    explanation:
      "A user pool covers the directory-and-authentication side of Cognito: it verifies who someone is and can hand back tokens on its own, with no identity pool required. An identity pool covers the authorization side — given proof of a verified identity, whether from a user pool, a SAML provider, or even an unauthenticated guest, it calls AWS STS to mint temporary AWS credentials scoped to an IAM role. The two work well together but are independent building blocks.",
  },
  {
    id: 'secure-021',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'When you enable Amazon GuardDuty in an AWS account with no additional configuration, which data sources does it automatically begin ingesting for foundational threat detection?',
    options: [
      'AWS CloudTrail management events, VPC flow logs, and DNS logs',
      'Amazon S3 object contents and EBS snapshot contents only',
      "Only AWS Config's configuration history",
      'Customer-submitted incident tickets',
    ],
    correctIndexes: [0],
    explanation:
      "Turning GuardDuty on kicks off automatic ingestion of three specific data sources at the account level — CloudTrail management events, VPC flow logs, and DNS logs — with no extra setup needed. Deeper capabilities such as scanning S3 object contents or EBS volumes for malware are separate, opt-in protection plans layered on top of that automatic baseline, not part of it.",
  },
  {
    id: 'secure-022',
    domain: 'secure',
    questionType: 'multiple-choice',
    question: 'What is Amazon Macie primarily used for?',
    options: [
      'Discovering sensitive data (such as PII) in Amazon S3 using machine learning and pattern matching, and flagging S3 buckets with security or privacy issues',
      'Detecting network-layer DDoS attacks against EC2 instances',
      'Rotating IAM user access keys automatically on a schedule',
      'Issuing and renewing public SSL/TLS certificates',
    ],
    correctIndexes: [0],
    explanation:
      "Macie's job is finding sensitive information such as personal data inside S3 objects using a combination of machine learning and pattern-based detection, while separately keeping watch on bucket configuration so it can flag problems like a bucket becoming publicly readable. It has no role in network-layer DDoS detection, key rotation, or certificate management — those are handled by other dedicated services.",
  },
  {
    id: 'secure-023',
    domain: 'secure',
    questionType: 'multiple-response',
    question: 'Which of the following statements are correct, according to AWS documentation? (Select TWO.)',
    options: [
      'AWS Secrets Manager lets applications retrieve credentials at runtime via an API call instead of hard-coding them in source code',
      'Amazon GuardDuty requires you to manually configure which VPC flow logs and CloudTrail events it ingests before it can generate any findings',
      'Amazon Macie can generate a finding when it detects that an S3 bucket has become publicly accessible',
      'Secrets Manager cannot rotate secrets on a schedule; rotation must always be performed manually',
      'GuardDuty and Macie are the same service marketed under two different names',
    ],
    correctIndexes: [0, 2],
    explanation:
      "Secrets Manager's whole value proposition is letting an application pull credentials through an API call at runtime instead of baking them into source code, and Macie does flag an S3 bucket when it detects that the bucket has turned publicly reachable. The other statements are backwards: GuardDuty's baseline detection turns on automatically with no manual setup, Secrets Manager explicitly supports scheduling rotation rather than requiring a manual process every time, and GuardDuty and Macie are distinct services solving different problems — threat detection versus sensitive-data discovery.",
  },
  {
    id: 'secure-024',
    domain: 'secure',
    questionType: 'multiple-response',
    question:
      'Which of the following statements about AWS Site-to-Site VPN and AWS Direct Connect are correct? (Select TWO.)',
    options: [
      'AWS Site-to-Site VPN connections use IPsec, and each connection includes two VPN tunnels that can be used simultaneously for high availability',
      'AWS Direct Connect routes all traffic over the public internet through an encrypted tunnel',
      'A Direct Connect private virtual interface is used to access resources in a VPC using private IP addresses',
      'Site-to-Site VPN connections provide routing only and cannot encrypt traffic',
      'Direct Connect requires no physical network connection; it operates entirely over software-defined tunnels like a VPN',
    ],
    correctIndexes: [0, 2],
    explanation:
      "Site-to-Site VPN connections rely on IPsec encryption and come with a pair of tunnels per connection, giving a second path to fail over to for high availability. On the Direct Connect side, a private virtual interface is the piece that gives an account private-IP reachability into a VPC. Direct Connect itself is fundamentally different from a VPN: it's a dedicated fiber-optic link into an AWS facility that bypasses the public internet, not a tunnel that rides on top of it.",
  },

  // ---------------------------------------------------------------------
  // Task 1.3: Determine appropriate data security controls
  // ---------------------------------------------------------------------
  {
    id: 'secure-025',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'Why does AWS KMS protect a hierarchy of keys, where a top-level root key protects the keys that in turn protect your data, instead of using a single key to encrypt data directly?',
    options: [
      'Because you ultimately need to safeguard the single top-level key (the root key) that anchors the whole hierarchy, and KMS is purpose-built to guard that root key inside validated hardware security modules',
      'Because AWS KMS keys are never capable of encrypting data directly under any circumstances',
      'Because customer-managed keys are billed at a lower rate than data keys',
      "Because KMS keys automatically leave the service in plaintext form for backup purposes",
    ],
    correctIndexes: [0],
    explanation:
      "Encryption keys need protecting too, and that chain of protection can't go on forever — eventually there has to be one top-level key that nothing else wraps, and that's the root key. KMS exists specifically to guard that root key, keeping it inside validated hardware security modules and never exposing it outside the service, so everything beneath it in the hierarchy inherits the same level of protection.",
  },
  {
    id: 'secure-026',
    domain: 'secure',
    questionType: 'multiple-choice',
    question: 'How many key policies can be attached to a single AWS KMS key?',
    options: [
      'Exactly one; it is a resource-based policy scoped to that specific key',
      'As many as needed, similar to how multiple IAM policies can be attached to a user',
      'Zero; KMS keys are governed solely by IAM policies',
      'Exactly one key policy per AWS Region, shared across every key in that Region',
    ],
    correctIndexes: [0],
    explanation:
      "Access to a KMS key is governed by a single resource-scoped policy attached to that key — you can't attach a second one, and it can't be skipped in favor of relying purely on IAM. That policy is also Regional in reach: it only controls the specific key it's attached to in that Region, not every key across the account.",
  },
  {
    id: 'secure-027',
    domain: 'secure',
    questionType: 'multiple-choice',
    question: 'By default, who has permission to use a newly created AWS KMS key?',
    options: [
      "No one, including the account root user or the key's creator, unless a key policy, IAM policy, or grant explicitly allows it",
      'The account root user automatically, with no additional configuration required',
      'Any IAM user in the account whose identity-based policy mentions kms:*, regardless of the key policy',
      'Only AWS Support engineers, for security auditing purposes',
    ],
    correctIndexes: [0],
    explanation:
      "KMS defaults to deny for everyone — the root user, the person who created the key, anyone — until a key policy, an IAM policy backed by that key policy, or a grant spells out an explicit allow. IAM policies alone can never reach a KMS key unless the key's own policy opens the door for them first.",
  },
  {
    id: 'secure-028',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'A team wants to manage day-to-day KMS key access using IAM policies attached to roles, rather than editing the key policy for every permission change. What must be true for this to work?',
    options: [
      'The key policy must include a statement that explicitly enables IAM policies to grant access to the key',
      'Nothing extra is needed; IAM policies can always grant KMS key access regardless of the key policy',
      'The AWS account root user must first be removed from the key policy entirely',
      'The KMS key must first be shared across every AWS Region',
    ],
    correctIndexes: [0],
    explanation:
      "By default, an IAM policy has zero effect on a KMS key — the key policy first has to hand off that control explicitly before role-based IAM permissions can do anything. Fortunately, the standard default key policy already includes that hand-off statement, which is why teams can usually manage day-to-day access purely through IAM once a key is created with default settings.",
  },
  {
    id: 'secure-029',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'If automatic key rotation is turned on for a customer-managed KMS key and no custom rotation period is set, how often does AWS KMS generate new key material by default?',
    options: [
      'Every 365 days (once a year)',
      'Every 30 days',
      'Every 90 days',
      'Only once, at key creation; automatic rotation cannot recur',
    ],
    correctIndexes: [0],
    explanation:
      'Absent a custom setting, AWS KMS refreshes a key\'s cryptographic material on a one-year cadence — the underlying rotation-period value defaults to 365 days whenever it\'s left unspecified. So neither "every 30 days" nor "every 90 days" applies, and automatic rotation is designed to keep recurring, not fire just the one time.',
  },
  {
    id: 'secure-030',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'Which type of KMS key requires manual rotation because it is not eligible for either automatic or on-demand rotation?',
    options: [
      'An asymmetric KMS key',
      'A symmetric encryption KMS key with AWS_KMS origin',
      'A symmetric encryption KMS key with imported (EXTERNAL) key material',
      'An AWS managed key',
    ],
    correctIndexes: [0],
    explanation:
      "Automatic and on-demand rotation both depend on AWS KMS being able to generate the replacement material itself, which rules out asymmetric keys (along with HMAC keys and keys living in a custom key store) — those can only be rotated manually, by creating a new key and switching applications over to it. Keys with AWS-generated symmetric material support both automatic and on-demand rotation, imported (EXTERNAL) symmetric keys support on-demand rotation, and AWS managed keys are rotated automatically by AWS roughly every year with no customer control over that schedule.",
  },
  {
    id: 'secure-031',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      "After a customer-managed KMS key's cryptographic material rotates automatically, what happens to data that was encrypted with the previous key material?",
    options: [
      'AWS KMS automatically decrypts it correctly by tracking which key material was used, with no application code changes needed',
      'The data becomes permanently undecryptable and must be re-encrypted manually before rotation',
      'AWS KMS immediately re-encrypts all previously encrypted data with the new key material',
      'The application must specify which key material version to use for every decrypt call',
    ],
    correctIndexes: [0],
    explanation:
      "AWS KMS keeps an internal record of exactly which version of the key material encrypted each piece of ciphertext, so a decrypt call automatically reaches for the matching version — applications never need to name a version or change any code because rotation happened. Rotation only swaps in fresh material for future encrypt operations; it doesn't touch, re-encrypt, or invalidate anything that was already protected.",
  },
  {
    id: 'secure-032',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'A company wants to use an ACM certificate with an Amazon CloudFront distribution. In which AWS Region must the certificate be requested or imported?',
    options: [
      'US East (N. Virginia)',
      "Whichever Region the CloudFront distribution's origin server is located in",
      'Any Region; CloudFront certificates work globally regardless of the request Region',
      'The Region physically closest to the majority of end users',
    ],
    correctIndexes: [0],
    explanation:
      "CloudFront is a global service, but ACM's integration with it is pinned to one specific Region — N. Virginia — no matter where the origin server sits or where most viewers are located. Once issued there, the certificate propagates out to every edge location the distribution uses; ACM certificates are otherwise tied to whichever Region they were requested in and cannot be moved between Regions.",
  },
  {
    id: 'secure-033',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'For AWS resource types that support incremental backups in AWS Backup, what does the first backup contain compared to successive backups?',
    options: [
      'The first backup is a full copy of the data; each successive backup captures only the changes since the previous backup',
      'Every backup, including the first, only ever captures changes since the account was created',
      'AWS Backup never supports incremental backups for any resource type',
      'The first backup is always empty and is used only to initialize the backup vault',
    ],
    correctIndexes: [0],
    explanation:
      "Incremental backup support means the very first backup job has to capture everything, since there's no earlier backup to compare against — but every job after that stores only what's different from the last one, which is what keeps ongoing storage costs down.",
  },
  {
    id: 'secure-034',
    domain: 'secure',
    questionType: 'multiple-response',
    question:
      'Per AWS Certificate Manager documentation, which of the following certificates ARE eligible for ACM managed (automatic) renewal? (Select TWO.)',
    options: [
      'A public certificate issued by ACM and associated with an Elastic Load Balancer',
      'A certificate imported into ACM from a third-party certificate authority',
      'A private certificate that ACM issued through a RequestCertificate API call and that was later exported',
      'A private certificate issued directly through the AWS Private CA IssueCertificate API',
      'A certificate that has already expired',
    ],
    correctIndexes: [0, 2],
    explanation:
      "ACM's managed renewal only covers certificates it can still act on automatically: ones tied to another AWS service such as a load balancer, and private certificates that were originally requested through the RequestCertificate API and then exported (or likewise associated with a service). It excludes anything ACM didn't originate or can no longer touch after issuance — imported third-party certificates, certificates issued straight through AWS Private CA's own issuance API, and certificates that have already lapsed.",
  },
  {
    id: 'secure-035',
    domain: 'secure',
    questionType: 'multiple-response',
    question:
      'Which of the following statements about AWS KMS key rotation are correct, according to AWS documentation? (Select TWO.)',
    options: [
      'On-demand key rotation can be performed regardless of whether automatic key rotation is enabled',
      "AWS KMS charges a monthly fee that keeps increasing indefinitely for every subsequent rotation of a key's material",
      'AWS managed keys are automatically rotated by AWS approximately every year, and customers cannot enable or disable this rotation',
      'Rotating a KMS key\'s material also re-encrypts all data that was previously encrypted with that key',
      'Disabling and then re-enabling automatic key rotation has no effect on the key\'s future rotation date',
    ],
    correctIndexes: [0, 2],
    explanation:
      "On-demand rotation doesn't depend on the automatic setting at all — you can trigger it whether or not automatic rotation happens to be turned on. AWS managed keys get rotated by AWS on a roughly annual cycle, and that schedule isn't something a customer can toggle. The other two claims are inaccurate: the rotation fee stops climbing after the second rotation instead of increasing forever, rotating key material never touches data that was already encrypted under the earlier material, and toggling automatic rotation off and back on resets the future rotation date rather than leaving it untouched.",
  },
  {
    id: 'secure-036',
    domain: 'secure',
    questionType: 'multiple-response',
    question: 'Which of the following statements about AWS Backup are correct? (Select TWO.)',
    options: [
      "AWS Backup Vault Lock can stop anyone, including the account owner, from erasing backups or changing how long they're retained",
      'AWS Backup lets you replicate backups into different AWS Regions either manually whenever you choose or automatically through a backup plan schedule',
      'AWS Backup governs and tracks all backups taken in an AWS environment, even ones created outside of AWS Backup',
      'AWS Backup requires a separate manual encryption setup for every resource type before any backup can be created',
      'AWS Backup only supports Amazon EC2 as a backup target; no other AWS services are supported',
    ],
    correctIndexes: [0, 1],
    explanation:
      "Backup Vault Lock is AWS Backup's write-once-read-many safeguard — once applied, it blocks every principal, including the account owner, from deleting a backup or shortening how long it's retained. Separately, Backup can send copies of backups to additional Regions, either as a one-off action or built into a recurring backup plan. The remaining statements don't hold up: AWS Backup has no visibility into backups created outside of it, plenty of resource types beyond EC2 are supported (S3, DynamoDB, RDS, EFS, and more), and resources under full Backup management get encrypted automatically with the vault's own KMS key rather than needing a manual per-resource setup.",
  },

  // =======================================================================
  // Domain 2: Design Resilient Architectures (26% exam weight)
  // Distributed across the domain's 2 task statements: 2.1 Design scalable
  // and loosely coupled architectures (resilient-001..017), 2.2 Design
  // highly available and/or fault-tolerant architectures (resilient-018..038).
  // =======================================================================

  // ---------------------------------------------------------------------
  // Task 2.1: Design scalable and loosely coupled architectures
  // ---------------------------------------------------------------------
  {
    id: 'resilient-001',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      "An order-intake service currently calls a fulfillment service directly and synchronously, so any slowdown in fulfillment immediately slows down order intake too. Which AWS service lets the order-intake component hand off work and move on immediately, absorbing bursts so a backlog in fulfillment doesn't overwhelm it?",
    options: [
      'Amazon SQS',
      'AWS Direct Connect',
      'Amazon Route 53',
      'AWS CloudFormation',
    ],
    correctIndexes: [0],
    explanation:
      "SQS gives producers a place to drop a message and move on, while one or more consumers pull messages whenever they're ready; a spike in incoming work piles up safely in the queue instead of crashing whatever processes it, and the queue keeps multiple redundant copies of every message for safety. Direct Connect is a private network link, Route 53 is DNS, and CloudFormation provisions infrastructure — none of them buffer or decouple application traffic the way a queue does.",
  },
  {
    id: 'resilient-002',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      "A retail application needs one order-placed event to reach several independent systems at the same time — an SQS queue for fulfillment, a Lambda function for analytics, and an email notification — without the publisher needing to track who's listening. Which pattern fits, and which AWS service implements it?",
    options: [
      'Point-to-point delivery through a single Amazon SQS queue',
      'Publish/subscribe fanout through an Amazon SNS topic',
      'A dedicated, always-open TCP socket between the publisher and each listener',
      'Manual HTTP calls from the publisher to every listener in turn',
    ],
    correctIndexes: [1],
    explanation:
      "SNS topics broadcast one published message out to every subscribed endpoint at once — queues, functions, email, and more — so the publisher never has to know how many listeners exist or reach out to each one individually. SQS, by contrast, is typically consumed by a single subscriber pulling from one queue, which doesn't fit a broadcast-to-many scenario, and neither a hand-rolled persistent socket nor looping through manual API calls gives you managed, decoupled fanout.",
  },
  {
    id: 'resilient-003',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      'A publisher sends events to an SNS topic that fans out to several subscribers. One subscriber, an HTTPS endpoint, is occasionally taken down for maintenance. What should sit in front of that subscriber so events aren\'t lost while it\'s offline?',
    options: [
      'An SQS queue subscribed to the topic in place of calling the endpoint directly',
      "Setting the topic's message retention window to zero",
      'A rule that pauses the entire topic whenever any subscriber is unavailable',
      'Removing the subscriber from the topic until it comes back online',
    ],
    correctIndexes: [0],
    explanation:
      "Pairing the topic with a queue for that subscriber means the notification lands durably in the queue even while the downstream endpoint is down, and it can be picked up as soon as the subscriber returns — this SNS-to-SQS combination is exactly how AWS recommends guarding against message loss for a subscriber that isn't always reachable. Zeroing out retention would only make messages disappear faster, pausing the whole topic would block every other subscriber too, and simply detaching the subscriber stops it from ever getting caught up.",
  },
  {
    id: 'resilient-004',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      "Which AWS service functions as the managed entry point for client requests — handling authentication, throttling, and request routing — before traffic ever reaches backend compute such as a Lambda function?",
    options: [
      'Amazon API Gateway',
      'AWS Key Management Service',
      'Amazon CloudWatch',
      'AWS Secrets Manager',
    ],
    correctIndexes: [0],
    explanation:
      'API Gateway is described as the "front door" that applications go through to reach backend logic, taking on traffic management, access control, and monitoring so that job doesn\'t have to be built into the backend itself. KMS manages encryption keys, CloudWatch collects metrics and logs, and Secrets Manager stores credentials — useful services, but none of them sit in front of an API accepting and routing client calls.',
  },
  {
    id: 'resilient-005',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      'A live-pricing application needs a persistent, two-way connection so the server can push updates to a connected client without the client repeatedly asking for new data. Which API Gateway API type is built for this?',
    options: [
      'A REST API',
      'An HTTP API',
      'A WebSocket API',
      'A private API',
    ],
    correctIndexes: [2],
    explanation:
      'API Gateway documentation specifically calls out WebSocket APIs as the stateful, full-duplex option, letting the server push data to a connected client at any time, while REST and HTTP APIs are documented as stateless request/response models better suited to typical CRUD-style calls. A private API refers to how an API is reached from inside a VPC, not to whether the connection is persistent or two-way, so it doesn\'t address the requirement here.',
  },
  {
    id: 'resilient-006',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      "A team already has Kubernetes manifests, operators, and staff experience, and wants to keep that tooling on AWS with minimal relearning. Which container orchestrator should they pick?",
    options: [
      "Amazon ECS, using AWS's own task and service model",
      'Amazon EKS, running a managed Kubernetes control plane',
      'AWS Lambda, triggered whenever a new container image is pushed',
      'Amazon CloudFront, placed in front of a container registry',
    ],
    correctIndexes: [1],
    explanation:
      "EKS runs an upstream-compatible Kubernetes control plane that AWS operates for you, so existing Kubernetes manifests, operators, and skills carry over directly. ECS uses its own task, service, and cluster constructs rather than Kubernetes, which would mean learning a new model instead of reusing what the team already knows, and neither Lambda nor CloudFront is a container orchestrator at all.",
  },
  {
    id: 'resilient-007',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      'Which AWS compute option runs containers once you declare the CPU and memory each one needs, with AWS taking care of every bit of the underlying server provisioning, patching, and capacity planning?',
    options: [
      'AWS Fargate',
      'Amazon EC2 Reserved Instances',
      'AWS Direct Connect',
      'Amazon Elastic Block Store',
    ],
    correctIndexes: [0],
    explanation:
      "Fargate is AWS's pay-per-use option for launching containers with nothing to provision, patch, or size on the server side — you just describe the CPU and memory each container needs. Reserved Instances are just a discounted EC2 pricing model that still requires you to manage the instances yourself, Direct Connect is a dedicated network link, and EBS is block storage — none of them run containers on your behalf the way Fargate does.",
  },
  {
    id: 'resilient-008',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      'How does an AWS Lambda function typically handle a sudden jump in the number of incoming events, per AWS documentation?',
    options: [
      'A single long-lived process queues every event and works through them one at a time',
      'Lambda launches more independent execution environments in parallel, scaling out without any capacity you provisioned in advance',
      'New events are rejected outright until an administrator manually raises a concurrency setting',
      'The function is automatically migrated onto a larger, more powerful compute instance to absorb the load',
    ],
    correctIndexes: [1],
    explanation:
      "Lambda documentation describes each invocation as running on its own, with the service creating and tearing down execution environments to track demand, so a burst of events is met with more parallel environments rather than a single worker falling behind. There's no instance to resize the way option D implies — Lambda has no server for you to see or scale vertically — and nothing about a burst of traffic requires manual concurrency changes or forces events to queue behind one worker by default.",
  },
  {
    id: 'resilient-009',
    domain: 'resilient',
    questionType: 'multiple-response',
    question:
      'Which TWO statements about AWS Step Functions workflow types are correct, according to AWS documentation? (Select TWO.)',
    options: [
      "A Standard workflow guarantees every step fires only once, with executions allowed to run as long as a full year",
      'An Express workflow also guarantees each step fires only once and can run for up to a year',
      'Express workflows are built for very high event rates and guarantee only that each step fires at least once, sometimes more',
      'A Standard workflow offers no way to view execution history or debug it visually',
      'Standard and Express workflows both support the full set of service integration patterns, including waiting on a job or a callback token',
    ],
    correctIndexes: [0, 2],
    explanation:
      "Standard workflows are the exactly-once, long-running option — good for auditable processes that might take up to a year to finish — while Express workflows trade that exactly-once guarantee for very high throughput, tolerating a step running more than once and capping executions at five minutes rather than a year. The other statements don't hold: Express is at-least-once, not exactly-once with a year-long ceiling; Standard workflows do provide execution history and visual debugging; and Express workflows are limited to the request/response integration pattern rather than also supporting job-waiting or callback-token patterns.",
  },
  {
    id: 'resilient-010',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      "A reporting dashboard runs heavy analytical queries against the same RDS database that handles live transactions, and it's starting to slow down normal application traffic. What's the standard way to offload that reporting load without resizing the primary database?",
    options: [
      'Point the dashboard at one or more RDS read replicas kept in sync from the primary',
      'Turn off the Multi-AZ standby configured on the primary instance',
      'Move the reporting dashboard into a different AWS Region than the database',
      'Convert the primary database itself into a read-only instance',
    ],
    correctIndexes: [0],
    explanation:
      "Read replicas exist precisely to take reporting and other read-heavy work off the primary instance, since RDS asynchronously streams changes to them and applications can send report queries there instead of competing with production traffic. Disabling Multi-AZ removes a standby used for failover rather than for offloading reads, moving the dashboard to another Region does nothing about where the queries land, and turning the primary read-only would break the live transactions it's supposed to serve.",
  },
  {
    id: 'resilient-011',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      'A team wants Amazon RDS to automatically add or remove read replicas as read traffic rises and falls, the same way an Auto Scaling group adds EC2 instances. Does RDS support this today?',
    options: [
      'Yes, once autoscaling is turned on for the source DB instance',
      "No — replicas must be created by hand, and RDS won't add or remove them on its own",
      'Yes, but only for a Multi-AZ standby replica',
      'No — a replica can only be created when the source database is first launched',
    ],
    correctIndexes: [1],
    explanation:
      "AWS documentation is explicit that read replicas must be created manually and that RDS has no autoscaling feature that adds or removes them as read demand shifts. There's no toggle that makes replica count adaptive, a Multi-AZ standby is a different kind of replica used for failover rather than automatic read scaling, and replicas can be created from an existing source instance at any point, not only during initial setup.",
  },
  {
    id: 'resilient-012',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      "A media company wants to give outside partners SFTP access that drops files straight into an S3 bucket, without standing up or patching its own file-transfer servers. Which AWS service is built for exactly this?",
    options: [
      'AWS Transfer Family',
      'AWS Direct Connect',
      'Amazon FSx',
      'AWS Snowball',
    ],
    correctIndexes: [0],
    explanation:
      'Transfer Family stands up a fully managed SFTP, FTPS, FTP, or AS2 endpoint in front of S3 or EFS, so partners keep using the same file-transfer clients they already have while AWS runs the server side. Direct Connect is a dedicated network link rather than a file-transfer protocol endpoint, FSx provisions managed file systems rather than SFTP servers, and Snowball is a physical device for bulk offline data transport — none of them match this SFTP-into-S3 use case.',
  },
  {
    id: 'resilient-013',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      'An Application Load Balancer has targets registered across three Availability Zones, and one target starts failing its configured health check. What happens next?',
    options: [
      'The ALB stops routing new requests to that target but keeps serving the healthy ones',
      'The ALB shuts down the entire target group until the failed target comes back',
      'The ALB automatically relocates the failed target into a different Availability Zone',
      'The ALB pauses all traffic until an administrator manually intervenes',
    ],
    correctIndexes: [0],
    explanation:
      "An ALB continuously checks the health of everything registered to it and only forwards requests to targets currently passing that check, so one bad target quietly drops out of rotation while the rest keep serving traffic. Shutting down the whole group, physically moving a target between zones, or halting all traffic are not documented ALB behaviors — the load balancer is designed to keep serving through a single target's failure, not to stop entirely because of it.",
  },
  {
    id: 'resilient-014',
    domain: 'resilient',
    questionType: 'multiple-response',
    question:
      'Which TWO of these correctly describe an AWS storage service, per AWS documentation? (Select TWO.)',
    options: [
      'Amazon EBS offers block-level volumes that attach to an EC2 instance much like a physical hard drive would',
      'Amazon EFS is a block-level volume that can be attached to only one EC2 instance at a time',
      'Amazon S3 is described as an object storage service rather than a block or file storage service',
      'An EBS volume can be attached to an EC2 instance running in a different Availability Zone',
      'Setting up Amazon EFS requires you to provision a fixed storage capacity in advance, the same as with an EBS volume',
    ],
    correctIndexes: [0, 2],
    explanation:
      "EBS documentation compares its volumes to a physical hard drive you attach to an instance, and S3 is consistently described as an object storage service, distinct from block or file storage. The other statements mix things up: it's EBS, not EFS, that behaves like a single-instance block volume, since EFS is shared file storage usable from many compute resources at once; an EBS volume and the instance it's attached to must sit in the same Availability Zone, not different ones; and EFS is explicitly elastic, growing and shrinking as files are added or removed rather than requiring capacity to be sized upfront.",
  },
  {
    id: 'resilient-015',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      "In a monolithic application, a spike in demand for one feature forces the whole application to be scaled together. How does breaking that application into microservices change this?",
    options: [
      'Each independent service can be scaled on its own to match demand for just the feature it supports',
      'The whole application must still be scaled as one unit, but deployments happen faster',
      'Microservices remove any need for load balancing between components',
      'Microservices require every service to share one common database to stay in sync',
    ],
    correctIndexes: [0],
    explanation:
      "Microservices are built as independent components, each of which can be deployed and scaled on its own to meet demand for the specific feature it handles, instead of forcing a scale-up of the entire application for one busy piece. The application still needs to be scaled as a whole under option B, which defeats the purpose; load balancing between independent services is still very much needed, not eliminated; and microservices are typically built with their own separate data stores rather than one shared database.",
  },
  {
    id: 'resilient-016',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      'Which AWS service keeps cached copies of static and dynamic content at edge locations around the world, so that most user requests never have to travel back to the origin server?',
    options: [
      'Amazon CloudFront',
      'AWS Direct Connect',
      'Amazon Route 53',
      'AWS Storage Gateway',
    ],
    correctIndexes: [0],
    explanation:
      'CloudFront routes each viewer to a nearby edge location and serves content straight from there whenever it\'s already cached, only reaching back to the origin — such as an S3 bucket or a web server — when it needs a fresh copy. Direct Connect is a private network link, Route 53 resolves domain names rather than caching content, and Storage Gateway bridges on-premises storage to AWS; none of these push content out to a global edge network the way CloudFront does.',
  },
  {
    id: 'resilient-017',
    domain: 'resilient',
    questionType: 'multiple-response',
    question:
      'Which TWO statements about caching are correct, based on AWS guidance? (Select TWO.)',
    options: [
      'Serving repeated requests from an in-memory cache instead of the database can significantly cut the load placed on that database',
      'Reading from an in-memory cache such as Redis or Memcached is typically far faster than reading from a disk-based database',
      'Once a cache is in place, its contents are guaranteed to always match the database in real time',
      'A cache should be kept on the very same host as the application server so scaling never introduces network overhead',
      'Caching only speeds up the client side and has no effect on how much load the backend database sees',
    ],
    correctIndexes: [0, 1],
    explanation:
      "AWS guidance on caching highlights both of these as core benefits: a hit against an in-memory cache avoids a trip to the database entirely, which can replace a meaningful amount of database capacity, and memory-based reads are dramatically faster than pulling the same data off disk. The remaining statements are inaccurate — cached data is explicitly allowed to go stale for a configured time-to-live rather than always tracking the database instantly, co-locating a cache with a single application host actually threatens the cache's integrity as that host scales in and out, and cutting database load is one of caching's headline benefits rather than something it has no effect on.",
  },
  // ---------------------------------------------------------------------
  // Task 2.2: Design highly available and/or fault-tolerant architectures
  // ---------------------------------------------------------------------
  {
    id: 'resilient-018',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      'A three-tier web application currently runs entirely inside one Availability Zone. What resilience gap does this create, and what is the standard fix?',
    options: [
      "That AZ's own outage would take the whole application down with it; spreading compute across at least two AZs behind a load balancer addresses this",
      'The application would be unable to scale past a fixed number of users; adding a content delivery network fixes this',
      'IAM policies would stop being enforced once resources cross AZ boundaries, so staying in one AZ is actually preferred',
      'A single-AZ design cannot use encryption at rest, and moving to multiple Regions is required to enable it',
    ],
    correctIndexes: [0],
    explanation:
      "An Application Load Balancer is documented as spreading traffic across targets in multiple Availability Zones specifically to increase the availability of an application, which only matters because a single AZ can and does go down on its own — leaving everything in one AZ makes that outage total. The other options describe things that simply aren't true: AZ boundaries don't affect IAM enforcement, scaling limits aren't tied to AZ count, and encryption at rest has nothing to do with how many AZs a workload spans.",
  },
  {
    id: 'resilient-019',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      "Amazon Route 53 is running health checks against a web application's endpoints. What happens once one endpoint starts failing its check?",
    options: [
      'Route 53 can stop sending traffic to that unhealthy endpoint and notify you of the change',
      'Route 53 automatically launches a replacement EC2 instance for the failed endpoint',
      "Route 53 cancels the domain's registration",
      'Route 53 blocks the domain name from ever resolving again',
    ],
    correctIndexes: [0],
    explanation:
      "Route 53's health-checking feature is built to confirm a resource is reachable and functioning, and when it isn't, Route 53 can redirect traffic away from it and alert you. Route 53 doesn't provision compute resources, so it can't launch a replacement instance, and neither cancelling a domain registration nor permanently blocking resolution is something a failed health check triggers.",
  },
  {
    id: 'resilient-020',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      'Which AWS service improves multi-Region availability by assigning an application static anycast IP addresses and steering traffic to the nearest healthy endpoint over the AWS backbone network?',
    options: [
      'AWS Global Accelerator',
      'Amazon Route 53',
      'AWS Direct Connect',
      'Amazon CloudFront',
    ],
    correctIndexes: [0],
    explanation:
      'Global Accelerator hands out fixed anycast addresses that map to endpoints across one or more Regions and pushes traffic onto the AWS network backbone as quickly as possible, checking endpoint health along the way. Route 53 solves a related problem through DNS lookups rather than anycast IPs, Direct Connect is a dedicated private link rather than a multi-Region routing service, and CloudFront handles failover per individual content request rather than by reassigning a static IP to a healthy Region.',
  },
  {
    id: 'resilient-021',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      'A CloudFront distribution has origin failover configured, and one request to the primary origin fails. What happens, according to AWS guidance?',
    options: [
      'CloudFront retries that one request against the secondary origin, but the next request still tries the primary first',
      'CloudFront switches every future request over to the secondary origin from that point forward',
      'CloudFront takes the entire distribution offline until the primary origin recovers',
      'CloudFront permanently purges the cached content tied to the primary origin',
    ],
    correctIndexes: [0],
    explanation:
      "CloudFront's origin failover works request by request: a failed call to the primary origin gets retried against the secondary right then, but the primary is still tried first the next time around, rather than the distribution permanently cutting over. Taking the whole distribution down or purging cached content isn't part of this behavior, and a permanent switch to the secondary origin is the opposite of the documented per-request retry behavior.",
  },
  {
    id: 'resilient-022',
    domain: 'resilient',
    questionType: 'multiple-response',
    question:
      'Which TWO statements about using Amazon Route 53 for Regional failover are correct, per AWS guidance? (Select TWO.)',
    options: [
      'A Route 53 health check can trigger automatic DNS failover to a recovery endpoint, and this is considered a highly reliable data-plane action',
      "Shifting a weighted routing policy's weights so all traffic moves to the recovery Region is a control-plane change, making it less resilient than a health-check-driven failover",
      'Route 53 can only direct traffic to endpoints located in the same Region as its hosted zone',
      'Once traffic has been sent to a recovery Region, Route 53 offers no way to send it back to the primary Region later',
      'Amazon Application Recovery Controller health checks always perform a real connectivity test before permitting a manual failover',
    ],
    correctIndexes: [0, 1],
    explanation:
      "AWS guidance treats automated, health-check-driven DNS failover as a data-plane operation, which is inherently more dependable than editing routing weights by hand — the latter is a control-plane change and carries more risk during an actual incident. The remaining statements are wrong: Route 53 can associate endpoints across multiple Regions under one domain name, nothing prevents shifting traffic back to the primary Region afterward, and Application Recovery Controller health checks are explicitly built as manual on/off switches rather than checks that test real connectivity.",
  },
  {
    id: 'resilient-023',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      "A Lambda-based application opens a fresh database connection on nearly every invocation, and traffic spikes are overwhelming the backend RDS instance with connections. Which AWS service pools and reuses a fixed set of database connections on the application's behalf?",
    options: [
      'Amazon RDS Proxy',
      'AWS WAF',
      'Amazon Route 53',
      'AWS Certificate Manager',
    ],
    correctIndexes: [0],
    explanation:
      "RDS Proxy sits between the application and the database, maintaining its own pool of database connections and reusing them so a burst of application-side connection requests doesn't translate into a burst of new database connections. WAF filters web requests for malicious patterns, Route 53 is a DNS service, and Certificate Manager issues TLS certificates — none of them touch database connection pooling.",
  },
  {
    id: 'resilient-024',
    domain: 'resilient',
    questionType: 'multiple-response',
    question:
      'Which TWO of the following are accurate limitations of Amazon RDS Proxy, according to AWS documentation? (Select TWO.)',
    options: [
      'In a replication setup, a proxy can be associated with a read replica instead of the writer instance',
      'In a replication setup, a proxy can only be associated with the writer DB instance, never a read replica',
      'An RDS Proxy has to live in the same VPC as the database it connects to',
      'An RDS Proxy can be made publicly accessible even when its underlying database is not',
      'There is no cap on how many proxies a single AWS account can create',
    ],
    correctIndexes: [1, 2],
    explanation:
      "Documentation is specific that a proxy in a replication configuration can only be attached to the writer instance, not a read replica, and that the proxy must sit in the same VPC as the database behind it. That directly rules out the first option, which claims the opposite; it also rules out making the proxy publicly reachable, since the documentation says a proxy can never be public even if its database is, and rules out an unlimited proxy count, since each account is capped at a fixed number of proxies.",
  },
  {
    id: 'resilient-025',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      "Instances in a private subnet need to reach package repositories on the internet, but nothing external should be able to open a connection to them. Which resource gives exactly this one-way outbound path?",
    options: [
      'A public NAT gateway',
      'An internet gateway routed directly into the private subnet',
      'A VPC peering connection',
      'An AWS Direct Connect gateway',
    ],
    correctIndexes: [0],
    explanation:
      "A public NAT gateway lets instances behind it start outbound connections to the internet while blocking anything external from initiating a connection back in — exactly the one-directional behavior described. Routing a subnet's traffic straight to an internet gateway instead makes it a public subnet with two-way reachability, which is the opposite of what's needed, and neither VPC peering nor a Direct Connect gateway provides any path to the public internet at all.",
  },
  {
    id: 'resilient-026',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      'A VPC has private subnets spread across three Availability Zones, but every one of them routes outbound traffic through a single NAT gateway sitting in just one public subnet. What resilience problem does this create?',
    options: [
      "If that NAT gateway's Availability Zone has an outage, every private subnet relying on it loses its outbound connectivity",
      'NAT gateways are not allowed to be created inside a public subnet, so this setup would fail to deploy at all',
      'A single NAT gateway causes every private subnet to lose its private IP address ranges',
      'This setup disables Auto Scaling for any instance running in the private subnets',
    ],
    correctIndexes: [0],
    explanation:
      "A subnet — and anything created inside it, including a NAT gateway — belongs to exactly one Availability Zone, so routing three AZs' worth of private subnets through a single NAT gateway means one AZ's failure cuts off outbound internet access for all three; the standard fix is a NAT gateway per AZ paired with matching route tables. NAT gateways are meant to be created in a public subnet, not barred from it, and this misconfiguration has no bearing on subnet IP ranges or on whether Auto Scaling can operate.",
  },
  {
    id: 'resilient-027',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      'AWS groups disaster recovery strategies into four tiers of increasing cost and readiness. Which order, from least to most expensive, matches how AWS documentation presents them?',
    options: [
      'Backup and restore, pilot light, warm standby, multi-site active/active',
      'Warm standby, backup and restore, multi-site active/active, pilot light',
      'Multi-site active/active, warm standby, pilot light, backup and restore',
      'Pilot light, backup and restore, warm standby, multi-site active/active',
    ],
    correctIndexes: [0],
    explanation:
      "AWS presents these four approaches on a rising scale from the cheapest, simplest option — periodic backups with nothing running until a disaster hits — up through pilot light, then warm standby, and finally multi-site active/active, which keeps full capacity live in more than one Region at once. Any other ordering misplaces at least one tier relative to how much it costs to run and how ready it keeps the recovery environment.",
  },
  {
    id: 'resilient-028',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      'A business says it can tolerate losing at most 15 minutes of transaction data, and it needs the application back online within 4 hours of a disaster. Which two recovery metrics do those two numbers represent, respectively?',
    options: [
      'A 15-minute Recovery Point Objective and a 4-hour Recovery Time Objective',
      'A 15-minute Recovery Time Objective and a 4-hour Recovery Point Objective',
      'A 15-minute Mean Time Between Failures and a 4-hour Mean Time to Recover',
      'A 15-minute service quota and a 4-hour service level agreement',
    ],
    correctIndexes: [0],
    explanation:
      "The tolerance for lost data maps to the Recovery Point Objective, and the tolerance for downtime maps to the Recovery Time Objective — AWS defines RPO around avoiding data loss and RTO around limiting how long a workload stays unavailable. Swapping the two, as option B does, gets the definitions backwards; Mean Time Between Failures and Mean Time to Recover are availability metrics measured over time rather than one-time disaster targets, and service quotas and SLAs are unrelated concepts entirely.",
  },
  {
    id: 'resilient-029',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      "Comparing AWS's pilot light and warm standby disaster recovery strategies, what's the key operational difference the moment a failover happens?",
    options: [
      'Pilot light needs its idle servers switched on and scaled up first, while warm standby can already serve traffic at reduced capacity right away',
      'Pilot light keeps a full-capacity copy of everything running around the clock, while warm standby keeps nothing running at all',
      'Warm standby only protects data, while pilot light protects both data and compute at full scale',
      'The two terms describe the same architecture, just under different names',
    ],
    correctIndexes: [0],
    explanation:
      "AWS documentation draws the line at what happens right at failover: pilot light needs application servers turned on and scaled out before it can take traffic, while warm standby is already running, just at a smaller size, so it can absorb traffic immediately. Option B has it backwards — pilot light is the one that keeps only its data tier always on, not a full-capacity copy — and the two strategies are explicitly distinguished from each other rather than being the same thing.",
  },
  {
    id: 'resilient-030',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      'Backup and restore is both the cheapest and slowest of the four DR tiers. Why does AWS guidance stress deploying infrastructure as code specifically for this strategy?',
    options: [
      'Because nothing runs in the recovery Region beforehand, so a fast, accurate rebuild is what keeps recovery on target',
      'Because backup and restore has no way to replicate or copy any data whatsoever',
      'Because infrastructure as code is a prerequisite for turning on backup encryption',
      "Because AWS Backup won't operate unless its surrounding infrastructure is defined as code",
    ],
    correctIndexes: [0],
    explanation:
      "Since nothing is deployed in the recovery Region ahead of time under this strategy, standing the environment back up depends entirely on repeatable, automated infrastructure definitions — without that, rebuilding tends to be slow and error-prone, pushing recovery time past the target. The strategy does include ways to replicate and copy data, so option B is false, and encryption settings and AWS Backup's operation aren't gated on infrastructure-as-code the way C and D claim.",
  },
  {
    id: 'resilient-031',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      'What distinguishes a multi-site active/active disaster recovery strategy from a hot standby active/passive strategy?',
    options: [
      'Active/active serves live traffic from every Region it runs in, while hot standby serves traffic from just one Region at a time',
      'Hot standby serves traffic from every Region at once, while active/active reserves one Region purely for recovery',
      'Active/active is the cheaper and operationally simpler of the two approaches',
      'Hot standby depends on promoting a database replica, while active/active never uses replicas at all',
    ],
    correctIndexes: [0],
    explanation:
      "Multi-site active/active takes live traffic in every Region where it's deployed, whereas hot standby keeps user traffic pointed at a single Region and holds the other Region in reserve purely for recovery. Option B swaps those roles, option C is backwards since active/active is described as the more complex and costly of the two, and option D's claim about replica promotion isn't how the two strategies are actually distinguished from each other.",
  },
  {
    id: 'resilient-032',
    domain: 'resilient',
    questionType: 'multiple-response',
    question:
      'Which TWO statements about AWS Backup are correct, according to AWS documentation? (Select TWO.)',
    options: [
      'AWS Backup can push a copy of a backup to another AWS Region, either manually or on a recurring schedule',
      'Inside an AWS Organizations structure, AWS Backup can gather backups from many accounts into one repository account',
      'AWS Backup automatically discovers and takes over management of backups created by tools other than itself',
      'Every resource that AWS Backup protects must sit in the exact same Region as its backup vault',
      'A single AWS Backup plan is limited to covering just one AWS resource at any given time',
    ],
    correctIndexes: [0, 1],
    explanation:
      "AWS Backup documentation confirms it can send backup copies to other Regions on a schedule or on demand, and that within an organization it supports gathering backups from multiple accounts into a single repository account. It explicitly does not govern or track backups made outside of it, so the third statement is false; cross-Region copying directly contradicts the same-Region requirement in the fourth statement; and a backup plan is meant to apply across many resources at once, not just a single one, ruling out the fifth.",
  },
  {
    id: 'resilient-033',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      'A company wants to use an AWS Region as a disaster recovery target for servers currently running on premises, using continuous block-level replication instead of periodic snapshots. Which AWS service is purpose-built for this?',
    options: [
      'AWS Elastic Disaster Recovery',
      'Amazon S3 Cross-Region Replication',
      'AWS Backup',
      'Amazon RDS Proxy',
    ],
    correctIndexes: [0],
    explanation:
      "AWS Elastic Disaster Recovery continuously replicates on-premises (or other-cloud) servers and their databases into AWS at the block level, keeping a staged, switched-off copy ready to launch at failover. S3 Cross-Region Replication only copies S3 objects, not whole servers; AWS Backup takes scheduled, point-in-time backups rather than continuous block-level replication; and RDS Proxy pools database connections and has nothing to do with replicating on-premises servers.",
  },
  {
    id: 'resilient-034',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      "A request in a distributed application hops through a front-end service and several backend microservices, and one backend call is intermittently slow, though it's unclear which one. Which AWS service traces the request across every hop and builds a map to help pinpoint the slow link?",
    options: [
      'AWS X-Ray',
      'Amazon CloudWatch Logs Insights',
      'Amazon Route 53',
      'AWS Trusted Advisor',
    ],
    correctIndexes: [0],
    explanation:
      "X-Ray follows a request through every service it touches and assembles that into a trace map showing the front-end and every downstream call, which is exactly the tool for spotting which link in the chain is slow or erroring. CloudWatch Logs Insights searches log data rather than building a cross-service trace map, Route 53 is a DNS service, and Trusted Advisor flags general account best-practice issues — none of them trace an individual request end to end.",
  },
  {
    id: 'resilient-035',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      "A workload's projected peak traffic is expected to exceed a default account-level service limit next quarter. What does AWS recommend doing about this kind of limit?",
    options: [
      'Check whether Service Quotas marks the limit as adjustable and request an increase well ahead of time',
      'Accept it — service quotas are permanently fixed values that AWS never changes',
      'Open a brand-new AWS account whenever an existing one runs into a quota',
      'Assume the limit is storage-only, since compute services carry no quotas at all',
    ],
    correctIndexes: [0],
    explanation:
      "Service Quotas lets you check whether a given quota can be raised and submit a request to increase it, and planning that request ahead of an expected traffic increase avoids discovering the limit mid-incident. Quotas are described as adjustable values rather than permanently fixed ones, so option B is wrong; spinning up a new account isn't how quota increases are handled; and quotas apply broadly across AWS services, including compute services, not just storage.",
  },
  {
    id: 'resilient-036',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      'A company is weighing whether to build and scale its own natural-language-processing servers on EC2 to score customer reviews for sentiment. Which AWS service gives them that capability as a managed API instead, handling everything from small real-time calls to large asynchronous batch jobs?',
    options: [
      'Amazon Comprehend',
      'AWS Direct Connect',
      'Amazon Route 53',
      'AWS Certificate Manager',
    ],
    correctIndexes: [0],
    explanation:
      "Comprehend applies natural language processing to text and exposes that as an API you call for quick, real-time analysis or as asynchronous jobs for larger document sets, so the company never has to run or scale that capability itself. Direct Connect, Route 53, and Certificate Manager solve entirely different problems — private connectivity, DNS, and TLS certificates — and none of them perform any language analysis.",
  },
  {
    id: 'resilient-037',
    domain: 'resilient',
    questionType: 'multiple-choice',
    question:
      'A company needs one managed AWS service to turn written articles into narrated audio, and a separate one to detect the dominant sentiment in support tickets. Which pairing is correct?',
    options: [
      'Amazon Polly for narrated audio, Amazon Comprehend for sentiment detection',
      'Amazon Comprehend for narrated audio, Amazon Polly for sentiment detection',
      'Amazon Polly for both narrated audio and sentiment detection',
      'Amazon Comprehend for both narrated audio and sentiment detection',
    ],
    correctIndexes: [0],
    explanation:
      "Polly is a text-to-speech service that turns written text into lifelike audio, while Comprehend analyzes text and reports on things like its dominant sentiment — two distinct capabilities that map to the two needs described. Swapping them, as option B does, assigns each service to the job it doesn't do, and neither service is documented as handling both speech synthesis and sentiment analysis on its own, ruling out C and D.",
  },
  {
    id: 'resilient-038',
    domain: 'resilient',
    questionType: 'multiple-response',
    question:
      'Which TWO statements about how storage placement affects availability are correct, based on AWS documentation? (Select TWO.)',
    options: [
      'A Regional Amazon EFS file system stores data redundantly across multiple Availability Zones, keeping it available even if one AZ goes down',
      'A One Zone Amazon EFS file system keeps data in only a single Availability Zone, so data could be lost if that AZ is damaged or destroyed',
      'Every Amazon EBS volume is automatically copied across all Availability Zones in its Region',
      'A One Zone Amazon EFS file system offers the exact same availability guarantees as a Regional one',
      'Keeping data in only one Availability Zone has no bearing on its availability during an AZ-level outage',
    ],
    correctIndexes: [0, 1],
    explanation:
      "EFS documentation draws a clear line between its two file system types: Regional file systems spread data across multiple AZs specifically so it survives the loss of any one of them, while One Zone file systems keep data in a single AZ and accept the risk that damage to that AZ could mean data loss. An EBS volume lives in one Availability Zone rather than being copied across all of them, which rules out the third statement, and the fourth and fifth statements both contradict the documented gap between Regional and One Zone availability.",
  },
];
