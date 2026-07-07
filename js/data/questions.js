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
      'Complete access to all AWS services and resources in the account',
      'Read-only access to all resources until IAM policies are attached',
      'No access until multi-factor authentication (MFA) is configured',
    ],
    correctIndexes: [1],
    explanation:
      'AWS IAM documentation states that the root user "has complete access to all AWS services and resources" from the moment the account is created, which is exactly why AWS recommends not using it for everyday tasks.',
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
      "IAM's introduction explains that when a request is made, AWS checks \"if your identity is on the list of authorized users, what policies are being enforced to control the level of access granted, and any other policies that might be in effect.\" IP history, billing alerts, and Region matching are not part of this evaluation.",
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
      'IAM documentation on identity-based vs. resource-based policies states that resource-based policies "are attached to a resource" (such as an S3 bucket) and let you "specify who has access to the resource," which is the mechanism for granting access without creating a role. Identity-based policies attach to users/groups/roles, SCPs never grant permissions, and permissions boundaries only limit what a policy can grant.',
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
      'IAM documentation states: "the requester in Account A must have an identity-based policy that allows them to make a request to the resource in Account B. Also, the resource-based policy in Account B must allow the requester in Account A to access the resource. There must be policies in both accounts that allow the operation, otherwise the request fails."',
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
      'IAM documentation on temporary security credentials states they "have a limited lifetime, so you do not have to update them or explicitly revoke them when they\'re no longer needed. After temporary security credentials expire, they cannot be reused." It also notes they "are not stored with the user but are generated dynamically."',
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
      'The IAM guide on "Roles for cross-account access" explains: "Using roles and cross-account access, you can define user identities in one account, and use those identities to access AWS resources in other accounts... This is known as the delegation approach to temporary access."',
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
      'AWS Organizations documentation is explicit: "SCPs do not grant permissions... An SCP defines a permission guardrail, or sets limits, on the actions that the IAM users and IAM roles in your organization can perform," and elsewhere: SCPs "specify the maximum available permissions for the IAM users and IAM roles in your organization."',
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
      'AWS Organizations documentation states plainly: "SCPs don\'t affect users or roles in the management account. They affect only the member accounts in your organization."',
  },
  {
    id: 'secure-009',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'What does AWS Control Tower provide for organizations managing multiple AWS accounts?',
    options: [
      'A straightforward way to set up and govern a multi-account environment by orchestrating services like AWS Organizations, AWS Service Catalog, and IAM Identity Center to build a landing zone',
      'A replacement for AWS KMS that centrally manages encryption keys across accounts',
      'A content delivery network for distributing static assets across accounts',
      'A billing-only tool with no effect on account governance or guardrails',
    ],
    correctIndexes: [0],
    explanation:
      'AWS Control Tower documentation states it "offers a straightforward way to set up and govern an AWS multi-account environment... AWS Control Tower orchestrates the capabilities of several other AWS services, including AWS Organizations, AWS Service Catalog, and AWS IAM Identity Center, to build a landing zone in less than an hour."',
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
      'IAM documentation on temporary credentials states: "OpenID Connect (OIDC) federation – You can let users sign in using a well-known third-party identity provider such as Login with Amazon, Facebook, Google, or any OIDC-compatible provider." SAML federation is described for authenticating an organization\'s own network users, not consumer social logins.',
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
      'AWS Organizations documentation confirms it lets you "simplify billing by using a single payment method for all of your accounts" and that CloudTrail "creates a log of all activity... that cannot be turned off or modified by member accounts." SCPs never grant permissions (they only restrict), and the SCP documentation states SCPs "aren\'t available if your organization has enabled only the consolidated billing features."',
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
      'IAM security best practices documentation recommends that compute workloads use IAM role temporary credentials ("there is no need to distribute long lived credentials") and that privileged access require MFA, "phishing-resistant MFA such as passkeys and security keys wherever possible." It also states least privilege (not blanket admin access), that "a permissions boundary does not grant permissions on its own," and Secrets Manager documentation warns against hard-coded credentials in source code.',
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
      'It is automatically allowed to leave the instance, regardless of the outbound rules, because security groups are stateful',
      'It is blocked unless a matching outbound rule explicitly allows port 443',
      'It is only allowed if the destination is within the same subnet',
      'It is dropped because security groups only evaluate inbound traffic',
    ],
    correctIndexes: [0],
    explanation:
      'AWS VPC documentation states: "Security groups are stateful... if a security group allows inbound traffic to an EC2 instance, responses are automatically allowed regardless of outbound security group rules."',
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
      'AWS VPC documentation on network ACLs states: "NACLs are stateless, which means that information about previously sent or received traffic is not saved. If, for example, you create a NACL rule to allow specific inbound traffic to a subnet, responses to that traffic are not automatically allowed."',
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
      'AWS VPC documentation states: "We evaluate the rules in order, starting with the lowest numbered rule, when deciding whether allow or deny traffic. If the traffic matches a rule, the rule is applied and we do not evaluate any additional rules."',
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
      'AWS VPC documentation on NAT gateways states: "Instances in private subnets can connect to the internet through a public NAT gateway, but the instances can\'t receive unsolicited inbound connections from the internet. You create a public NAT gateway in a public subnet and must associate an Elastic IP address with the NAT gateway." A private NAT gateway, by contrast, cannot have an Elastic IP and connects only to other VPCs or on-premises networks, not the internet.',
  },
  {
    id: 'secure-017',
    domain: 'secure',
    questionType: 'multiple-choice',
    question: 'Which statement about NAT gateway connections is correct, per AWS documentation?',
    options: [
      'Connections through a NAT gateway must always be initiated from within the VPC containing the NAT gateway',
      'A private NAT gateway can be assigned an Elastic IP address just like a public NAT gateway',
      'External services outside the VPC can freely initiate new connections to instances behind a NAT gateway',
      'A NAT gateway can only be used with IPv4 traffic, never IPv6',
    ],
    correctIndexes: [0],
    explanation:
      'AWS VPC documentation lists as a NAT gateway consideration: "Connections must always be initiated from within the VPC containing the NAT gateway." It also states "You can\'t associate an Elastic IP address with a private NAT gateway," that external services "can\'t initiate a connection with those instances," and that "a NAT gateway is for use with IPv4 or IPv6 traffic."',
  },
  {
    id: 'secure-018',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'Which statement correctly distinguishes AWS Shield Standard from AWS Shield Advanced?',
    options: [
      'Shield Standard is automatically included at no extra cost and protects against common volumetric DDoS attacks; Shield Advanced adds expanded protection and incurs additional charges',
      'Shield Standard is a paid add-on, while Shield Advanced is included automatically for free',
      'Shield Standard only protects Amazon S3 buckets, while Shield Advanced only protects EC2 instances',
      'Shield Advanced replaces the need for AWS WAF entirely',
    ],
    correctIndexes: [0],
    explanation:
      'AWS documentation states: "AWS Shield Standard is automatically included at no extra cost beyond what you already pay for AWS WAF and your other AWS services... Shield Advanced provides expanded DDoS attack protection... Shield Advanced incurs additional charges."',
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
      'AWS WAF documentation states: "AWS WAF is a web application firewall that lets you monitor the HTTP and HTTPS requests that are forwarded to your protected web application resources... your protected resource responds to requests either with the requested content, with an HTTP 403 status code (Forbidden), or with a custom response," with rules that "allow, block, or count" matching requests.',
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
      'Amazon Cognito documentation states: "Create a user pool when you want to authenticate and authorize users to your app or API... From a user pool, you can issue authenticated JSON web tokens (JWTs) directly," while "Set up an Amazon Cognito identity pool when you want to authorize authenticated or anonymous users to access your AWS resources. An identity pool issues AWS credentials." It also notes "User pools don\'t require integration with an identity pool."',
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
      'Amazon GuardDuty documentation states: "When you enable GuardDuty in an AWS account, GuardDuty automatically starts ingesting the foundational data sources associated with that account. These data sources include AWS CloudTrail management events, VPC flow logs (from Amazon EC2 instances), and DNS logs. You don\'t need to enable anything else."',
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
      'Amazon Macie documentation states: "Amazon Macie is a data security service that discovers sensitive data by using machine learning and pattern matching, provides visibility into data security risks, and enables automated protection against those risks," and it generates a finding when, for example, "a bucket... becomes publicly accessible."',
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
      'Secrets Manager documentation states you "replace hard-coded credentials with a runtime call to the Secrets Manager service." Macie documentation confirms it flags "a bucket that becomes publicly accessible." GuardDuty ingests its foundational data sources automatically with no extra setup, and Secrets Manager explicitly supports configuring "an automatic rotation schedule." GuardDuty and Macie are distinct services (threat detection vs. sensitive-data discovery).',
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
      'AWS Site-to-Site VPN documentation confirms it "supports Internet Protocol security (IPsec) VPN connections" and "each VPN connection includes two VPN tunnels which you can simultaneously use for high availability." Direct Connect documentation describes a "private virtual interface" as being "used to access an Amazon Virtual Private Cloud (VPC) using private IP addresses," and states Direct Connect links your network to AWS "over a standard Ethernet fiber-optic cable," bypassing internet service providers rather than routing over the public internet.',
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
      'Because eventually you must protect the highest-level encryption key (the root key) in the hierarchy, and KMS is designed specifically to protect that root key using validated hardware security modules',
      'Because AWS KMS keys are never capable of encrypting data directly under any circumstances',
      'Because customer-managed keys are billed at a lower rate than data keys',
      "Because KMS keys automatically leave the service in plaintext form for backup purposes",
    ],
    correctIndexes: [0],
    explanation:
      'AWS KMS documentation explains: "When you encrypt data, you need to protect your encryption key... Eventually, you must protect the highest level encryption key (known as a root key) in the hierarchy that protects your data. That\'s where AWS KMS comes in... AWS KMS protects your root keys." It also states KMS keys "never leave AWS KMS unencrypted."',
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
      'AWS KMS documentation states: "A key policy is a resource policy for an AWS KMS key... Every KMS key must have exactly one key policy." The policy is scoped to that individual key, not shared across a whole Region.',
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
      'AWS KMS documentation states: "No AWS principal, including the account root user or key creator, has any permissions to a KMS key unless they are explicitly allowed, and never denied, in a key policy, IAM policy, or grant." It further clarifies that "unless the key policy explicitly allows it, you cannot use IAM policies to allow access to a KMS key."',
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
      'AWS KMS documentation states: "Unless the key policy explicitly allows it, you cannot use IAM policies to allow access to a KMS key. Without permission from the key policy, IAM policies that allow permissions have no effect. The default key policy enables IAM policies."',
  },
  {
    id: 'secure-029',
    domain: 'secure',
    questionType: 'multiple-choice',
    question:
      'When you enable automatic key rotation for a customer-managed KMS key without specifying a custom rotation period, how often does AWS KMS generate new cryptographic material by default?',
    options: [
      'Every 365 days (once a year)',
      'Every 30 days',
      'Every 90 days',
      'Only once, at key creation; automatic rotation cannot recur',
    ],
    correctIndexes: [0],
    explanation:
      'AWS KMS documentation states: "By default, when you enable automatic key rotation for a KMS key, AWS KMS generates new cryptographic material for the KMS key every year," and "If you do not specify a value for RotationPeriodInDays when you enable automatic key rotation, the default value is 365 days."',
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
      'AWS KMS documentation states: "Neither automatic nor on-demand key rotation is supported for the following types of KMS keys, but you can rotate these KMS keys manually: Asymmetric KMS keys, HMAC KMS keys, KMS keys in custom key stores." Keys with AWS_KMS origin support both automatic and on-demand rotation; EXTERNAL-origin symmetric keys support on-demand rotation; AWS managed keys are rotated automatically by AWS every year.',
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
      'AWS KMS documentation states: "When you use the rotated KMS key to decrypt ciphertext, AWS KMS uses the same version of the key material that was used to encrypt it. You cannot select a particular version... AWS KMS automatically chooses the correct version," and "you can safely use a rotated KMS key in applications and AWS services without code changes." It also confirms rotation does "not... re-encrypt any data protected by the KMS key."',
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
      'AWS Certificate Manager documentation states: "To use an ACM certificate with Amazon CloudFront, you must request or import the certificate in the US East (N. Virginia) region." ACM certificates are otherwise Regional resources that cannot be copied between Regions.',
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
      'AWS Backup documentation states: "The first backup of an AWS resource backs up a full copy of your data. For each successive incremental backup, only the changes to your AWS resources are backed up."',
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
      'A private certificate issued by calling the ACM RequestCertificate API and then exported',
      'A private certificate issued directly through the AWS Private CA IssueCertificate API',
      'A certificate that has already expired',
    ],
    correctIndexes: [0, 2],
    explanation:
      'ACM managed-renewal documentation lists as ELIGIBLE: "if associated with another AWS service, such as Elastic Load Balancing or CloudFront" and "if it is a private certificate issued by calling the ACM RequestCertificate API and then exported or associated with another AWS service." It lists as NOT ELIGIBLE: imported certificates, certificates issued directly through the AWS Private CA IssueCertificate API, and certificates that have already expired.',
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
      'AWS KMS documentation states you "can perform on-demand rotation, regardless of whether or not automatic key rotation is enabled," and "AWS KMS automatically rotates AWS managed keys every year (approximately 365 days). You cannot enable or disable key rotation for AWS managed keys." It also states the rotation fee increase "is capped at the second rotation," rotation does not re-encrypt existing data, and re-enabling rotation after disabling it changes the rotation date ("AWS KMS rotates the key material based on the new rotation-enable date").',
  },
  {
    id: 'secure-036',
    domain: 'secure',
    questionType: 'multiple-response',
    question: 'Which of the following statements about AWS Backup are correct? (Select TWO.)',
    options: [
      'AWS Backup Vault Lock can prevent anyone, including the account owner, from deleting backups or altering their retention period',
      'AWS Backup can copy backups to other AWS Regions on demand or automatically as part of a scheduled backup plan',
      'AWS Backup governs and tracks all backups taken in an AWS environment, even ones created outside of AWS Backup',
      'AWS Backup requires a separate manual encryption setup for every resource type before any backup can be created',
      'AWS Backup only supports Amazon EC2 as a backup target; no other AWS services are supported',
    ],
    correctIndexes: [0, 1],
    explanation:
      'AWS Backup documentation states: "You can use AWS Backup Vault Lock to prevent anyone (including you) from deleting backups or altering their retention period," and "you can copy backups to multiple different AWS Regions on demand or automatically as part of a scheduled backup plan." It also explicitly states "AWS Backup does not govern backups you take in your AWS environment outside of AWS Backup," supports many resource types beyond EC2 (S3, DynamoDB, RDS, EFS, and more), and resources under full AWS Backup management are automatically encrypted with the backup vault\'s KMS key rather than requiring manual per-resource setup.',
  },
];
