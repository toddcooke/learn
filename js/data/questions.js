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
];
