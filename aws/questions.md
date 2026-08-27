# AWS SAA-C03 — question bank

119 questions. Answers are collapsed; expand to check yourself.

## Design Secure Architectures

36 questions

### secure-001

When a new AWS account is created, what access level does the initial root user have?

- **A.** Unrestricted access to every AWS service and resource in the account
- **B.** Only the ability to view billing information
- **C.** Read-only access to all resources until IAM policies are attached
- **D.** No access until multi-factor authentication (MFA) is configured

<details><summary>Answer</summary>

**A.** — The root user is the very first identity on a brand-new account and starts out with full administrative control over everything in it, with no permissions to configure separately. That sweeping scope is exactly why AWS advises reserving the root user for a short list of account-level tasks and doing everyday work through separately created IAM identities instead.

</details>

### secure-002

According to AWS IAM documentation, what determines whether an authenticated principal's request to access an AWS resource is granted?

- **A.** Whether the principal's AWS account has enabled billing alerts
- **B.** Whether the principal is on the list of authorized users and whether the policies enforced grant the requested permission
- **C.** Whether the request originates from the same AWS Region as the resource
- **D.** Whether the principal has previously logged in from the same IP address

<details><summary>Answer</summary>

**B.** — IAM's authorization check has two parts: confirming the caller's identity is recognized, and then checking whatever policies apply to see if any of them grant the specific permission being requested. Prior login locations, billing configuration, and matching Regions play no part in that decision.

</details>

### secure-003

A company wants to grant a principal in a different AWS account access to a specific Amazon S3 bucket without creating an IAM role for that principal. Which type of policy should be attached directly to the S3 bucket?

- **A.** A permissions boundary
- **B.** An identity-based policy
- **C.** A resource-based policy
- **D.** A service control policy

<details><summary>Answer</summary>

**C.** — A resource-based policy attaches straight to the resource itself — an S3 bucket in this case — and spells out which principals, including ones from other accounts, are allowed to reach it, so no separate role has to be created. Identity-based policies live on IAM principals rather than resources, an SCP can only restrict what an account is allowed to do rather than grant access, and a permissions boundary merely caps what a policy can grant.

</details>

### secure-004

Per AWS IAM's cross-account policy evaluation logic, what is required for a request from an IAM user in Account A to succeed against a resource in Account B that has a resource-based policy?

- **A.** Only a resource-based policy in Account B that allows the request
- **B.** Only an identity-based policy in Account A that allows the request
- **C.** Nothing extra is needed once the accounts are joined in AWS Organizations
- **D.** An identity-based policy in Account A AND a resource-based policy in Account B must both allow the request

<details><summary>Answer</summary>

**D.** — Cross-account access needs sign-off on both ends: the caller's own account must have an identity-based policy permitting the action, and separately the account that owns the resource must have a resource-based policy naming that caller as allowed. If either side stays silent or denies it, the call fails — a policy on only one side is never enough once two accounts are involved.

</details>

### secure-005

Which statement about AWS STS temporary security credentials is correct?

- **A.** They cannot be reused after they expire, and do not need to be explicitly revoked when no longer needed
- **B.** They are stored permanently with the IAM user who requested them
- **C.** They never expire once issued
- **D.** They must be manually revoked by an administrator before they stop working

<details><summary>Answer</summary>

**A.** — Temporary credentials are generated on the fly rather than being tied permanently to a user, so there's nothing for an administrator to manually revoke — they simply stop functioning once their short lifetime runs out, and any attempt to reuse them after that point is always rejected.

</details>

### secure-006

A company wants users in Account A to access resources in Account B without creating a duplicate IAM user for each person in Account B. What does AWS documentation recommend for this scenario?

- **A.** Have AWS STS issue a single permanent credential shared by every user in Account A
- **B.** Create an IAM role in Account B that Account A's users can assume for temporary credentials (the delegation approach)
- **C.** Share Account B's root user password with users in Account A
- **D.** Create identical IAM users with matching long-term access keys in both accounts

<details><summary>Answer</summary>

**B.** — This is the classic cross-account role pattern: Account B creates a role that trusts Account A, and A's users assume that role to obtain short-lived credentials scoped to B, with no duplicate identities or shared passwords required. IAM documentation labels this the delegation model for temporary access, which is distinct from the single sign-on model used to federate an external identity provider.

</details>

### secure-007

What is the primary function of a service control policy (SCP) in AWS Organizations?

- **A.** It grants IAM users and roles in member accounts additional permissions beyond what their identity-based policies allow
- **B.** It replaces the need for IAM identity-based policies entirely
- **C.** It sets the maximum available permissions for IAM users and roles in an organization, without itself granting any permissions
- **D.** It applies only to the organization's management account

<details><summary>Answer</summary>

**C.** — An SCP acts as a ceiling, never a floor — it can only narrow which actions the accounts underneath it are allowed to attempt, and it cannot hand out new permissions on its own. Actual permissions still have to come from identity-based or resource-based policies inside the account; the SCP just limits how far those policies are allowed to reach.

</details>

### secure-008

In an AWS Organizations structure, which accounts are affected by an attached service control policy (SCP)?

- **A.** Both the management account and all member accounts equally
- **B.** No accounts, until AWS Control Tower is enabled
- **C.** Only the management account
- **D.** Only member accounts; the management account is not affected

<details><summary>Answer</summary>

**D.** — SCP enforcement is scoped to member accounts only — the management account sits outside that boundary entirely, so anyone working from it is never limited by SCPs attached elsewhere in the hierarchy. Control Tower has nothing to do with this behavior; it's simply how AWS Organizations defines SCP scope by default.

</details>

### secure-009

What does AWS Control Tower provide for organizations managing multiple AWS accounts?

- **A.** A guided way to quickly configure and govern a multi-account landing zone
- **B.** A billing-only tool with no effect on account governance or guardrails
- **C.** A replacement for AWS KMS that centrally manages encryption keys across accounts
- **D.** A content delivery network for distributing static assets across accounts

<details><summary>Answer</summary>

**A.** — Control Tower packages together the account-governance capabilities of several underlying services — Organizations for account structure, Service Catalog for provisioning, and IAM Identity Center for access — into one guided setup that produces a working landing zone quickly, rather than replacing any single one of those services.

</details>

### secure-010

A mobile application wants to let users sign in with their existing Google account rather than creating new AWS credentials. Which AWS STS federation type is designed for this scenario?

- **A.** SAML 2.0 federation
- **B.** OpenID Connect (OIDC) federation
- **C.** Service control policy federation
- **D.** AWS Direct Connect federation

<details><summary>Answer</summary>

**B.** — For consumer-style sign-in through a well-known outside provider such as Google, AWS STS offers OIDC federation, which lets an app trade a token from that provider for temporary AWS credentials without building custom sign-in logic. SAML federation targets a different scenario — bringing an organization's own workforce, already authenticated against its corporate directory, into AWS through single sign-on.

</details>

### secure-011

Which of the following statements about AWS Organizations are correct? (Select TWO.) *(choose two)*

- **A.** AWS Organizations lets you simplify billing across all your accounts by using a single payment method
- **B.** AWS CloudTrail can be configured to create an organization-wide log of activity that member accounts cannot turn off or modify
- **C.** Service control policies (SCPs) can grant permissions that a member account's IAM policies do not already allow
- **D.** Every AWS Organizations account must use IAM Identity Center; there is no alternative for federated access
- **E.** Service control policies are available in every AWS Organizations setup, including ones using only consolidated billing

<details><summary>Answer</summary>

**A.** **B.** — Consolidated billing is a core Organizations feature — a single payment method covers every linked account — and an organization-wide CloudTrail trail can be locked so that member accounts have no way to disable or edit it. The other two statements don't hold: SCPs can only restrict what a policy already allows, never add to it, and SCPs require all features to be enabled, so they are unavailable in a setup that only has consolidated billing turned on. IAM Identity Center is likewise just one option for federated access, not a mandatory one.

</details>

### secure-012

Which of the following are AWS-recommended IAM security best practices? (Select TWO.) *(choose two)*

- **A.** Require workloads running on EC2 or Lambda to use temporary credentials delivered via an IAM role instead of distributing long-term IAM user access keys
- **B.** Attach the AdministratorAccess managed policy to every new IAM user so they are never blocked by missing permissions
- **C.** Enable multi-factor authentication (MFA), preferably phishing-resistant MFA such as passkeys or security keys, for privileged access
- **D.** Use a permissions boundary to grant a role additional permissions beyond what its identity-based policy allows
- **E.** Store long-term IAM access keys directly in application source code so they are always available at runtime

<details><summary>Answer</summary>

**A.** **C.** — AWS guidance calls for compute workloads to obtain temporary, automatically-refreshed credentials through an IAM role rather than embedding long-lived access keys, and for privileged human access to require MFA — ideally a phishing-resistant method such as a passkey or hardware security key. The other options contradict documented guidance: granting blanket admin rights to every new user defeats least privilege, a permissions boundary only limits what a role's own policy can grant rather than adding to it, and hard-coding access keys in source code is precisely the practice that Secrets Manager and IAM guidance warn against.

</details>

### secure-013

A security group attached to an EC2 instance allows inbound traffic on port 443. What happens to the corresponding outbound response traffic?

- **A.** It is only allowed if the destination is within the same subnet
- **B.** It is dropped because security groups only evaluate inbound traffic
- **C.** It automatically leaves the instance without needing a matching outbound rule
- **D.** It is blocked unless a matching outbound rule explicitly allows port 443

<details><summary>Answer</summary>

**C.** — Security groups track connection state, so once inbound traffic on port 443 is permitted, the reply traffic for that same connection is let out automatically — there's no need for a matching outbound allow rule. This statefulness is what separates security groups from network ACLs, which evaluate inbound and outbound traffic independently of each other.

</details>

### secure-014

A network ACL associated with a subnet has an inbound rule allowing HTTP traffic from the internet, but no outbound rule permitting the ephemeral return ports. What happens to the response traffic?

- **A.** It is allowed because network ACL rules apply only to outbound traffic
- **B.** It is automatically allowed because network ACLs are stateful like security groups
- **C.** It is allowed only if the associated security group is also stateless
- **D.** It is blocked, because network ACLs are stateless and responses must be explicitly allowed by an outbound rule

<details><summary>Answer</summary>

**D.** — Network ACLs don't remember connection state the way security groups do, so permitting inbound traffic through one rule doesn't clear a path for the reply — the return traffic on the ephemeral ports needs its own outbound rule, or it gets dropped at the subnet boundary.

</details>

### secure-015

Network ACL rules are numbered. How does AWS decide which rule applies to a given piece of traffic?

- **A.** It evaluates rules in order starting from the lowest number, and applies the first rule that matches
- **B.** It evaluates rules in order starting from the highest number, and applies the first rule that matches
- **C.** It applies every matching rule and combines the most restrictive result
- **D.** It applies rules in the order they were created, regardless of rule number

<details><summary>Answer</summary>

**A.** — Rule numbers set the evaluation order: AWS steps through the rules from the smallest number upward and stops at the first one that matches the traffic, ignoring everything numbered higher after that. That's why administrators typically space rule numbers out (in gaps of 10 or 100), leaving room to slot new rules in later without renumbering the whole list.

</details>

### secure-016

An architect places instances in a private subnet and wants them to initiate outbound connections to the internet for software updates, but never receive unsolicited inbound connections. Which component, created in a public subnet with an associated Elastic IP address, achieves this?

- **A.** A private NAT gateway
- **B.** A public NAT gateway
- **C.** An internet gateway attached directly to the private subnet's route table
- **D.** A network ACL

<details><summary>Answer</summary>

**B.** — A public NAT gateway lives in a public subnet with its own Elastic IP, and it lets private-subnet instances reach the internet for things like updates while blocking any outside host from being the one to open a connection toward them. A private NAT gateway serves a similar one-way purpose but only for reaching other VPCs or on-premises networks, and it can't hold an Elastic IP since it never talks to the public internet directly.

</details>

### secure-017

Which statement about NAT gateway connections is correct, per AWS documentation?

- **A.** A NAT gateway can only be used with IPv4 traffic, never IPv6
- **B.** A private NAT gateway can be assigned an Elastic IP address just like a public NAT gateway
- **C.** Traffic cannot be routed to a NAT gateway over a VPC peering connection, a Site-to-Site VPN connection, or Direct Connect
- **D.** External services outside the VPC can freely initiate new connections to instances behind a NAT gateway

<details><summary>Answer</summary>

**C.** — AWS documentation lists exactly which paths a NAT gateway can't serve: traffic arriving over a VPC peering connection, a Site-to-Site VPN, or Direct Connect can't be routed to it — a transit gateway is the supported way to share one VPC's NAT gateway with others in the centralized-egress pattern. External hosts still can't initiate new connections toward the instances behind it; only return traffic for connections those instances opened gets back in. Elastic IPs only attach to a public NAT gateway, since a private NAT gateway never talks to the public internet, and a NAT gateway handles both IPv4 and IPv6, not just IPv4.

</details>

### secure-018

Which statement correctly distinguishes AWS Shield Standard from AWS Shield Advanced?

- **A.** Shield Standard is a paid add-on, while Shield Advanced is included automatically for free
- **B.** Shield Standard only protects Amazon S3 buckets, while Shield Advanced only protects EC2 instances
- **C.** Shield Advanced replaces the need for AWS WAF entirely
- **D.** Shield Standard is included automatically at no cost, while Shield Advanced is a paid tier with broader DDoS protections

<details><summary>Answer</summary>

**D.** — The two tiers differ mainly in scope and price. Shield Standard ships with every AWS account, costs nothing extra, and blunts the most common large-scale DDoS techniques. Shield Advanced is an opt-in, separately billed upgrade that widens coverage to more resource types (EC2, load balancers, CloudFront, Route 53, Global Accelerator) and throws in extras like dedicated incident-response support — it complements AWS WAF rather than standing in for it.

</details>

### secure-019

What does AWS WAF let you do, according to AWS documentation?

- **A.** Allow, block, or count web requests to protected resources based on conditions you specify
- **B.** Automatically rotate database credentials on a schedule
- **C.** Encrypt data at rest using customer-managed KMS keys
- **D.** Physically isolate AWS Regions from each other to prevent DDoS attacks

<details><summary>Answer</summary>

**A.** — AWS WAF inspects each web request heading toward a protected resource — CloudFront, an Application Load Balancer, API Gateway, and similar — against rules you define, then either lets the request through, blocks it, or just tallies it depending on which condition it matches. It operates at the web-request layer and has no role in DDoS mitigation, credential rotation, or encrypting stored data; those jobs belong to other dedicated services (Shield, Secrets Manager, and KMS, respectively).

</details>

### secure-020

What is the key difference between an Amazon Cognito user pool and an Amazon Cognito identity pool?

- **A.** A user pool requires an identity pool to function and cannot issue tokens on its own
- **B.** A user pool is a user directory used to authenticate and authorize users, issuing JWTs directly; an identity pool exchanges a proven identity for temporary AWS credentials via AWS STS
- **C.** A user pool issues temporary AWS credentials, while an identity pool is a user directory used only for authentication
- **D.** User pools and identity pools are two names for the same underlying Cognito resource

<details><summary>Answer</summary>

**B.** — A user pool covers the directory-and-authentication side of Cognito: it verifies who someone is and can hand back tokens on its own, with no identity pool required. An identity pool covers the authorization side — given proof of a verified identity, whether from a user pool, a SAML provider, or even an unauthenticated guest, it calls AWS STS to mint temporary AWS credentials scoped to an IAM role. The two work well together but are independent building blocks.

</details>

### secure-021

When you enable Amazon GuardDuty in an AWS account with no additional configuration, which data sources does it automatically begin ingesting for foundational threat detection?

- **A.** Amazon S3 object contents and EBS snapshot contents only
- **B.** Only AWS Config's configuration history
- **C.** AWS CloudTrail management events, VPC flow logs, and DNS logs
- **D.** Customer-submitted incident tickets

<details><summary>Answer</summary>

**C.** — Turning GuardDuty on kicks off automatic ingestion of three specific data sources at the account level — CloudTrail management events, VPC flow logs, and DNS logs — with no extra setup needed. Deeper capabilities such as scanning S3 object contents or EBS volumes for malware are separate, opt-in protection plans layered on top of that automatic baseline, not part of it.

</details>

### secure-022

What is Amazon Macie primarily used for?

- **A.** Rotating IAM user access keys automatically on a schedule
- **B.** Issuing and renewing public SSL/TLS certificates
- **C.** Detecting network-layer DDoS attacks against EC2 instances
- **D.** Discovering sensitive data such as PII stored in Amazon S3 buckets

<details><summary>Answer</summary>

**D.** — Macie's job is finding sensitive information such as personal data inside S3 objects using a combination of machine learning and pattern-based detection, while separately keeping watch on bucket configuration so it can flag problems like a bucket becoming publicly readable. It has no role in network-layer DDoS detection, key rotation, or certificate management — those are handled by other dedicated services.

</details>

### secure-023

Which of the following statements are correct, according to AWS documentation? (Select TWO.) *(choose two)*

- **A.** AWS Secrets Manager lets applications retrieve credentials at runtime via an API call instead of hard-coding them in source code
- **B.** Amazon GuardDuty requires you to manually configure which VPC flow logs and CloudTrail events it ingests before it can generate any findings
- **C.** Secrets Manager cannot rotate secrets on a schedule; rotation must always be performed manually
- **D.** Amazon Macie can generate a finding when it detects that an S3 bucket has become publicly accessible
- **E.** GuardDuty and Macie are the same service marketed under two different names

<details><summary>Answer</summary>

**A.** **D.** — Secrets Manager's whole value proposition is letting an application pull credentials through an API call at runtime instead of baking them into source code, and Macie does flag an S3 bucket when it detects that the bucket has turned publicly reachable. The other statements are backwards: GuardDuty's baseline detection turns on automatically with no manual setup, Secrets Manager explicitly supports scheduling rotation rather than requiring a manual process every time, and GuardDuty and Macie are distinct services solving different problems — threat detection versus sensitive-data discovery.

</details>

### secure-024

Which of the following statements about AWS Site-to-Site VPN and AWS Direct Connect are correct? (Select TWO.) *(choose two)*

- **A.** AWS Site-to-Site VPN connections use IPsec, and each connection includes two VPN tunnels that can be used simultaneously for high availability
- **B.** AWS Direct Connect routes all traffic over the public internet through an encrypted tunnel
- **C.** Site-to-Site VPN connections provide routing only and cannot encrypt traffic
- **D.** Direct Connect requires no physical network connection; it operates entirely over software-defined tunnels like a VPN
- **E.** A Direct Connect private virtual interface is used to access resources in a VPC using private IP addresses

<details><summary>Answer</summary>

**A.** **E.** — Site-to-Site VPN connections rely on IPsec encryption and come with a pair of tunnels per connection, giving a second path to fail over to for high availability. On the Direct Connect side, a private virtual interface is the piece that gives an account private-IP reachability into a VPC. Direct Connect itself is fundamentally different from a VPN: it's a dedicated fiber-optic link into an AWS facility that bypasses the public internet, not a tunnel that rides on top of it.

</details>

### secure-025

Why does AWS KMS protect a hierarchy of keys, where a top-level root key protects the keys that in turn protect your data, instead of using a single key to encrypt data directly?

- **A.** Because you ultimately need to safeguard the single top-level key (the root key) that anchors the whole hierarchy, and KMS is purpose-built to guard that root key inside validated hardware security modules
- **B.** Because KMS keys automatically leave the service in plaintext form for backup purposes
- **C.** Because AWS KMS keys are never capable of encrypting data directly under any circumstances
- **D.** Because customer-managed keys are billed at a lower rate than data keys

<details><summary>Answer</summary>

**A.** — Encryption keys need protecting too, and that chain of protection can't go on forever — eventually there has to be one top-level key that nothing else wraps, and that's the root key. KMS exists specifically to guard that root key, keeping it inside validated hardware security modules and never exposing it outside the service, so everything beneath it in the hierarchy inherits the same level of protection.

</details>

### secure-026

How many key policies can be attached to a single AWS KMS key?

- **A.** As many as needed, similar to how multiple IAM policies can be attached to a user
- **B.** Exactly one; it is a resource-based policy scoped to that specific key
- **C.** Zero; KMS keys are governed solely by IAM policies
- **D.** Exactly one key policy per AWS Region, shared across every key in that Region

<details><summary>Answer</summary>

**B.** — Access to a KMS key is governed by a single resource-scoped policy attached to that key — you can't attach a second one, and it can't be skipped in favor of relying purely on IAM. That policy is also Regional in reach: it only controls the specific key it's attached to in that Region, not every key across the account.

</details>

### secure-027

By default, who has permission to use a newly created AWS KMS key?

- **A.** Any IAM user in the account whose identity-based policy mentions kms:*, regardless of the key policy
- **B.** Only AWS Support engineers, for security auditing purposes
- **C.** No one, including the account root user or the key's creator, unless a key policy, IAM policy, or grant explicitly allows it
- **D.** The account root user automatically, with no additional configuration required

<details><summary>Answer</summary>

**C.** — KMS defaults to deny for everyone — the root user, the person who created the key, anyone — until a key policy, an IAM policy backed by that key policy, or a grant spells out an explicit allow. IAM policies alone can never reach a KMS key unless the key's own policy opens the door for them first.

</details>

### secure-028

A team wants to manage day-to-day KMS key access using IAM policies attached to roles, rather than editing the key policy for every permission change. What must be true for this to work?

- **A.** The KMS key must first be shared across every AWS Region
- **B.** Nothing extra is needed; IAM policies can always grant KMS key access regardless of the key policy
- **C.** The AWS account root user must first be removed from the key policy entirely
- **D.** The key policy must include a statement that explicitly enables IAM policies to grant access to the key

<details><summary>Answer</summary>

**D.** — By default, an IAM policy has zero effect on a KMS key — the key policy first has to hand off that control explicitly before role-based IAM permissions can do anything. Fortunately, the standard default key policy already includes that hand-off statement, which is why teams can usually manage day-to-day access purely through IAM once a key is created with default settings.

</details>

### secure-029

If automatic key rotation is turned on for a customer-managed KMS key and no custom rotation period is set, how often does AWS KMS generate new key material by default?

- **A.** Every 365 days (once a year)
- **B.** Every 30 days
- **C.** Every 90 days
- **D.** Only once, at key creation; automatic rotation cannot recur

<details><summary>Answer</summary>

**A.** — Absent a custom setting, AWS KMS refreshes a key's cryptographic material on a one-year cadence — the underlying rotation-period value defaults to 365 days whenever it's left unspecified. So neither "every 30 days" nor "every 90 days" applies, and automatic rotation is designed to keep recurring, not fire just the one time.

</details>

### secure-030

Which type of KMS key has no in-place rotation mechanism at all, so 'rotating' it means creating an entirely new key and manually switching applications over to it?

- **A.** A symmetric encryption KMS key with imported (EXTERNAL) key material
- **B.** An asymmetric KMS key
- **C.** An AWS managed key
- **D.** A symmetric encryption KMS key with AWS_KMS origin

<details><summary>Answer</summary>

**B.** — Asymmetric keys (along with HMAC keys and keys living in a custom key store) have no rotation mechanism whatsoever — AWS KMS can't generate replacement material for them, so the only way to 'rotate' one is to create a brand-new key and cut applications over to it, retiring the old key once nothing depends on it anymore. Every other option rotates in place, keeping the same key ID: keys with AWS-generated symmetric material support both automatic and on-demand rotation, imported (EXTERNAL) symmetric keys support on-demand rotation of their material without changing the key ID, and AWS managed keys are rotated automatically by AWS roughly every year with no customer control over that schedule.

</details>

### secure-031

After a customer-managed KMS key's cryptographic material rotates automatically, what happens to data that was encrypted with the previous key material?

- **A.** The application must specify which key material version to use for every decrypt call
- **B.** The data becomes permanently undecryptable and must be re-encrypted manually before rotation
- **C.** AWS KMS automatically decrypts it correctly by tracking which key material was used, with no application code changes needed
- **D.** AWS KMS immediately re-encrypts all previously encrypted data with the new key material

<details><summary>Answer</summary>

**C.** — AWS KMS keeps an internal record of exactly which version of the key material encrypted each piece of ciphertext, so a decrypt call automatically reaches for the matching version — applications never need to name a version or change any code because rotation happened. Rotation only swaps in fresh material for future encrypt operations; it doesn't touch, re-encrypt, or invalidate anything that was already protected.

</details>

### secure-032

A company wants to use an ACM certificate with an Amazon CloudFront distribution. In which AWS Region must the certificate be requested or imported?

- **A.** Whichever Region the CloudFront distribution's origin server is located in
- **B.** Any Region; CloudFront certificates work globally regardless of the request Region
- **C.** The Region physically closest to the majority of end users
- **D.** US East (N. Virginia)

<details><summary>Answer</summary>

**D.** — CloudFront is a global service, but ACM's integration with it is pinned to one specific Region — N. Virginia — no matter where the origin server sits or where most viewers are located. Once issued there, the certificate propagates out to every edge location the distribution uses; ACM certificates are otherwise tied to whichever Region they were requested in and cannot be moved between Regions.

</details>

### secure-033

For AWS resource types that support incremental backups in AWS Backup, what does the first backup contain compared to successive backups?

- **A.** The first backup is a full copy of the data; each successive backup captures only the changes since the previous backup
- **B.** AWS Backup never supports incremental backups for any resource type
- **C.** The first backup is always empty and is used only to initialize the backup vault
- **D.** Every backup, including the first, only ever captures changes since the account was created

<details><summary>Answer</summary>

**A.** — Incremental backup support means the very first backup job has to capture everything, since there's no earlier backup to compare against — but every job after that stores only what's different from the last one, which is what keeps ongoing storage costs down.

</details>

### secure-034

Per AWS Certificate Manager documentation, which of the following certificates ARE eligible for ACM managed (automatic) renewal? (Select TWO.) *(choose two)*

- **A.** A certificate imported into ACM from a third-party certificate authority
- **B.** A public certificate issued by ACM and associated with an Elastic Load Balancer
- **C.** A private certificate that ACM issued through a RequestCertificate API call and that was later exported
- **D.** A private certificate issued directly through the AWS Private CA IssueCertificate API
- **E.** A certificate that has already expired

<details><summary>Answer</summary>

**B.** **C.** — ACM's managed renewal only covers certificates it can still act on automatically: ones tied to another AWS service such as a load balancer, and private certificates that were originally requested through the RequestCertificate API and then exported (or likewise associated with a service). It excludes anything ACM didn't originate or can no longer touch after issuance — imported third-party certificates, certificates issued straight through AWS Private CA's own issuance API, and certificates that have already lapsed.

</details>

### secure-035

Which of the following statements about AWS KMS key rotation are correct, according to AWS documentation? (Select TWO.) *(choose two)*

- **A.** AWS KMS charges a monthly fee that keeps increasing indefinitely for every subsequent rotation of a key's material
- **B.** On-demand key rotation can be performed regardless of whether automatic key rotation is enabled
- **C.** Rotating a KMS key's material also re-encrypts all data that was previously encrypted with that key
- **D.** AWS managed keys are automatically rotated by AWS approximately every year, and customers cannot enable or disable this rotation
- **E.** Disabling and then re-enabling automatic key rotation has no effect on the key's future rotation date

<details><summary>Answer</summary>

**B.** **D.** — On-demand rotation doesn't depend on the automatic setting at all — you can trigger it whether or not automatic rotation happens to be turned on. AWS managed keys get rotated by AWS on a roughly annual cycle, and that schedule isn't something a customer can toggle. The other two claims are inaccurate: the rotation fee stops climbing after the second rotation instead of increasing forever, rotating key material never touches data that was already encrypted under the earlier material, and toggling automatic rotation off and back on resets the future rotation date rather than leaving it untouched.

</details>

### secure-036

Which of the following statements about AWS Backup are correct? (Select TWO.) *(choose two)*

- **A.** AWS Backup governs and tracks all backups taken in an AWS environment, even ones created outside of AWS Backup
- **B.** AWS Backup Vault Lock can stop anyone, including the account owner, from erasing backups or changing how long they're retained
- **C.** AWS Backup requires a separate manual encryption setup for every resource type before any backup can be created
- **D.** AWS Backup only supports Amazon EC2 as a backup target; no other AWS services are supported
- **E.** AWS Backup lets you replicate backups into different AWS Regions either manually whenever you choose or automatically through a backup plan schedule

<details><summary>Answer</summary>

**B.** **E.** — Backup Vault Lock is AWS Backup's write-once-read-many safeguard — once applied, it blocks every principal, including the account owner, from deleting a backup or shortening how long it's retained. Separately, Backup can send copies of backups to additional Regions, either as a one-off action or built into a recurring backup plan. The remaining statements don't hold up: AWS Backup has no visibility into backups created outside of it, plenty of resource types beyond EC2 are supported (S3, DynamoDB, RDS, EFS, and more), and resources under full Backup management get encrypted automatically with the vault's own KMS key rather than needing a manual per-resource setup.

</details>

## Design Resilient Architectures

38 questions

### resilient-001

An order-intake service currently calls a fulfillment service directly and synchronously, so any slowdown in fulfillment immediately slows down order intake too. Which AWS service lets the order-intake component hand off work and move on immediately, absorbing bursts so a backlog in fulfillment doesn't overwhelm it?

- **A.** Amazon SQS
- **B.** AWS Direct Connect
- **C.** Amazon Route 53
- **D.** AWS CloudFormation

<details><summary>Answer</summary>

**A.** — SQS gives producers a place to drop a message and move on, while one or more consumers pull messages whenever they're ready; a spike in incoming work piles up safely in the queue instead of crashing whatever processes it, and the queue keeps multiple redundant copies of every message for safety. Direct Connect is a private network link, Route 53 is DNS, and CloudFormation provisions infrastructure — none of them buffer or decouple application traffic the way a queue does.

</details>

### resilient-002

A SaaS application needs one user-signup event to reach several independent systems at the same time — an SQS queue for account provisioning, a Lambda function that syncs the CRM, and a welcome email — without the publisher needing to track who's listening. Which pattern fits, and which AWS service implements it?

- **A.** A dedicated, always-open TCP socket between the publisher and each listener
- **B.** Publish/subscribe fanout through an Amazon SNS topic
- **C.** Manual HTTP calls from the publisher to every listener in turn
- **D.** Point-to-point delivery through a single Amazon SQS queue

<details><summary>Answer</summary>

**B.** — SNS topics broadcast one published message out to every subscribed endpoint at once — queues, functions, email, and more — so the publisher never has to know how many listeners exist or reach out to each one individually. SQS, by contrast, is typically consumed by a single subscriber pulling from one queue, which doesn't fit a broadcast-to-many scenario, and neither a hand-rolled persistent socket nor looping through manual API calls gives you managed, decoupled fanout.

</details>

### resilient-003

A publisher sends events to an SNS topic that fans out to several subscribers. One subscriber, an HTTPS endpoint, is occasionally taken down for maintenance. What should sit in front of that subscriber so events aren't lost while it's offline?

- **A.** Removing the subscriber from the topic until it comes back online
- **B.** Setting the topic's message retention window down to zero seconds
- **C.** An SQS queue subscribed to the topic instead of calling the endpoint directly
- **D.** A rule that pauses the entire topic whenever one subscriber goes down

<details><summary>Answer</summary>

**C.** — Pairing the topic with a queue for that subscriber means the notification lands durably in the queue even while the downstream endpoint is down, and it can be picked up as soon as the subscriber returns — this SNS-to-SQS combination is exactly how AWS recommends guarding against message loss for a subscriber that isn't always reachable. Zeroing out retention would only make messages disappear faster, pausing the whole topic would block every other subscriber too, and simply detaching the subscriber stops it from ever getting caught up.

</details>

### resilient-004

Which AWS service functions as the managed entry point for client requests — handling authentication, throttling, and request routing — before traffic ever reaches backend compute such as a Lambda function?

- **A.** AWS Key Management Service
- **B.** Amazon CloudWatch
- **C.** AWS Secrets Manager
- **D.** Amazon API Gateway

<details><summary>Answer</summary>

**D.** — API Gateway is described as the "front door" that applications go through to reach backend logic, taking on traffic management, access control, and monitoring so that job doesn't have to be built into the backend itself. KMS manages encryption keys, CloudWatch collects metrics and logs, and Secrets Manager stores credentials — useful services, but none of them sit in front of an API accepting and routing client calls.

</details>

### resilient-005

A live-pricing application needs a persistent, two-way connection so the server can push updates to a connected client without the client repeatedly asking for new data. Which API Gateway API type is built for this?

- **A.** A WebSocket API
- **B.** An HTTP API
- **C.** A private API
- **D.** A REST API

<details><summary>Answer</summary>

**A.** — API Gateway documentation specifically calls out WebSocket APIs as the stateful, full-duplex option, letting the server push data to a connected client at any time, while REST and HTTP APIs are documented as stateless request/response models better suited to typical CRUD-style calls. A private API refers to how an API is reached from inside a VPC, not to whether the connection is persistent or two-way, so it doesn't address the requirement here.

</details>

### resilient-006

A team already has Kubernetes manifests, operators, and staff experience, and wants to keep that tooling on AWS with minimal relearning. Which container orchestrator should they pick?

- **A.** Amazon CloudFront, placed in front of a container registry
- **B.** Amazon EKS, running a managed Kubernetes control plane
- **C.** Amazon ECS, using AWS's own task and service model
- **D.** AWS Lambda, triggered whenever a new container image is pushed

<details><summary>Answer</summary>

**B.** — EKS runs an upstream-compatible Kubernetes control plane that AWS operates for you, so existing Kubernetes manifests, operators, and skills carry over directly. ECS uses its own task, service, and cluster constructs rather than Kubernetes, which would mean learning a new model instead of reusing what the team already knows, and neither Lambda nor CloudFront is a container orchestrator at all.

</details>

### resilient-007

Which AWS compute option runs containers once you declare the CPU and memory each one needs, with AWS taking care of every bit of the underlying server provisioning, patching, and capacity planning?

- **A.** Amazon EC2 Reserved Instances
- **B.** AWS Direct Connect
- **C.** AWS Fargate
- **D.** Amazon Elastic Block Store

<details><summary>Answer</summary>

**C.** — Fargate is AWS's pay-per-use option for launching containers with nothing to provision, patch, or size on the server side — you just describe the CPU and memory each container needs. Reserved Instances are just a discounted EC2 pricing model that still requires you to manage the instances yourself, Direct Connect is a dedicated network link, and EBS is block storage — none of them run containers on your behalf the way Fargate does.

</details>

### resilient-008

How does an AWS Lambda function typically handle a sudden jump in the number of incoming events, per AWS documentation?

- **A.** New events are rejected outright until an administrator manually raises a concurrency setting
- **B.** The function is automatically migrated onto a larger, more powerful compute instance to absorb the load
- **C.** A single long-lived process queues events and works through them one at a time
- **D.** Lambda automatically launches more execution environments to run events in parallel

<details><summary>Answer</summary>

**D.** — Lambda documentation describes each invocation as running on its own, with the service creating and tearing down execution environments to track demand, so a burst of events is met with more parallel environments rather than a single worker falling behind. There's no instance to resize the way the claim about automatically migrating the function onto a larger compute instance implies — Lambda has no server for you to see or scale vertically — and nothing about a burst of traffic requires manual concurrency changes or forces events to queue behind one worker by default.

</details>

### resilient-009

Which TWO statements about AWS Step Functions workflow types are correct, according to AWS documentation? (Select TWO.) *(choose two)*

- **A.** An Express workflow also guarantees each step fires only once and can run for up to a year
- **B.** A Standard workflow offers no way to view execution history or debug it visually
- **C.** A Standard workflow guarantees every step fires only once, with executions allowed to run as long as a full year
- **D.** Express workflows are built for very high event rates and guarantee only that each step fires at least once, sometimes more
- **E.** Standard and Express workflows both support the full set of service integration patterns, including waiting on a job or a callback token

<details><summary>Answer</summary>

**C.** **D.** — Standard workflows are the exactly-once, long-running option — good for auditable processes that might take up to a year to finish — while Express workflows trade that exactly-once guarantee for very high throughput, tolerating a step running more than once and capping executions at five minutes rather than a year. The other statements don't hold: Express is at-least-once, not exactly-once with a year-long ceiling; Standard workflows do provide execution history and visual debugging; and Express workflows are limited to the request/response integration pattern rather than also supporting job-waiting or callback-token patterns.

</details>

### resilient-010

A reporting dashboard runs heavy analytical queries against the same RDS database that handles live transactions, and it's starting to slow down normal application traffic. What's the standard way to offload that reporting load without resizing the primary database?

- **A.** Point the dashboard at one or more RDS read replicas kept in sync
- **B.** Convert the primary database itself into a read-only instance
- **C.** Turn off the Multi-AZ standby configured on the primary instance
- **D.** Move the reporting dashboard into a different AWS Region

<details><summary>Answer</summary>

**A.** — Read replicas exist precisely to take reporting and other read-heavy work off the primary instance, since RDS asynchronously streams changes to them and applications can send report queries there instead of competing with production traffic. Disabling Multi-AZ removes a standby used for failover rather than for offloading reads, moving the dashboard to another Region does nothing about where the queries land, and turning the primary read-only would break the live transactions it's supposed to serve.

</details>

### resilient-011

A team running an RDS for MySQL DB instance wants Amazon RDS to automatically add or remove its read replicas as read traffic rises and falls, the same way an Auto Scaling group adds EC2 instances. Does RDS support this today?

- **A.** Yes, once autoscaling is turned on for the source DB instance
- **B.** No — replicas must be created by hand; RDS won't add or remove them on its own
- **C.** Yes, but only for a Multi-AZ standby replica, which exists purely for failover
- **D.** No — a replica can only be created when the source database is first launched, and never afterward

<details><summary>Answer</summary>

**B.** — For the standard RDS engines such as MySQL, AWS documentation is explicit that read replicas must be created manually and that RDS has no autoscaling feature that adds or removes them as read demand shifts — Aurora is the one exception, since its Aurora Auto Scaling feature can adjust a cluster's Aurora Replica count automatically, but that capability doesn't extend to RDS for MySQL. A Multi-AZ standby is a different kind of replica used for failover rather than automatic read scaling, and replicas can be created from an existing source instance at any point, not only during initial setup.

</details>

### resilient-012

A media company wants to give outside partners SFTP access that drops files straight into an S3 bucket, without standing up or patching its own file-transfer servers. Which AWS service is built for exactly this?

- **A.** Amazon FSx, a managed file system service
- **B.** AWS Snowball, a physical data transport device
- **C.** AWS Transfer Family, a managed SFTP endpoint
- **D.** AWS Direct Connect, a dedicated network link

<details><summary>Answer</summary>

**C.** — Transfer Family stands up a fully managed SFTP, FTPS, FTP, or AS2 endpoint in front of S3 or EFS, so partners keep using the same file-transfer clients they already have while AWS runs the server side. Direct Connect is a dedicated network link rather than a file-transfer protocol endpoint, FSx provisions managed file systems rather than SFTP servers, and Snowball is a physical device for bulk offline data transport — none of them match this SFTP-into-S3 use case.

</details>

### resilient-013

An Application Load Balancer has targets registered across three Availability Zones, and one target starts failing its configured health check. What happens next?

- **A.** The ALB pauses all traffic until an administrator manually intervenes
- **B.** The ALB shuts down the entire target group until the failed target comes back
- **C.** The ALB automatically relocates the failed target into a different Availability Zone
- **D.** The ALB stops routing new requests to that target but keeps serving the healthy ones

<details><summary>Answer</summary>

**D.** — An ALB continuously checks the health of everything registered to it and only forwards requests to targets currently passing that check, so one bad target quietly drops out of rotation while the rest keep serving traffic. Shutting down the whole group, physically moving a target between zones, or halting all traffic are not documented ALB behaviors — the load balancer is designed to keep serving through a single target's failure, not to stop entirely because of it.

</details>

### resilient-014

Which TWO of these correctly describe an AWS storage service, per AWS documentation? (Select TWO.) *(choose two)*

- **A.** Amazon EFS is a block-level volume that can be attached to only one EC2 instance at a time
- **B.** An EBS volume can be attached to an EC2 instance running in a different Availability Zone
- **C.** Amazon EBS offers block-level volumes that attach to an EC2 instance much like a physical hard drive would
- **D.** Setting up Amazon EFS requires you to provision a fixed storage capacity in advance, the same as with an EBS volume
- **E.** Amazon S3 is described as an object storage service rather than a block or file storage service

<details><summary>Answer</summary>

**C.** **E.** — EBS documentation compares its volumes to a physical hard drive you attach to an instance, and S3 is consistently described as an object storage service, distinct from block or file storage. The other statements mix things up: it's EBS, not EFS, that behaves like a single-instance block volume, since EFS is shared file storage usable from many compute resources at once; an EBS volume and the instance it's attached to must sit in the same Availability Zone, not different ones; and EFS is explicitly elastic, growing and shrinking as files are added or removed rather than requiring capacity to be sized upfront.

</details>

### resilient-015

In a monolithic application, a spike in demand for one feature forces the whole application to be scaled together. How does breaking that application into microservices change this?

- **A.** Each independent service can be scaled on its own to match its demand
- **B.** The whole application must still be scaled as one unit, just faster
- **C.** Microservices remove any need for load balancing between components
- **D.** Microservices require every service to share one common database

<details><summary>Answer</summary>

**A.** — Microservices are built as independent components, each of which can be deployed and scaled on its own to meet demand for the specific feature it handles, instead of forcing a scale-up of the entire application for one busy piece. The claim that the whole application must still be scaled as one unit, just faster, defeats the purpose of breaking it apart; load balancing between independent services is still very much needed, not eliminated; and microservices are typically built with their own separate data stores rather than one shared database.

</details>

### resilient-016

Which AWS service keeps cached copies of static and dynamic content at edge locations around the world, so that most user requests never have to travel back to the origin server?

- **A.** Amazon Route 53
- **B.** Amazon CloudFront
- **C.** AWS Storage Gateway
- **D.** AWS Direct Connect

<details><summary>Answer</summary>

**B.** — CloudFront routes each viewer to a nearby edge location and serves content straight from there whenever it's already cached, only reaching back to the origin — such as an S3 bucket or a web server — when it needs a fresh copy. Direct Connect is a private network link, Route 53 resolves domain names rather than caching content, and Storage Gateway bridges on-premises storage to AWS; none of these push content out to a global edge network the way CloudFront does.

</details>

### resilient-017

Which TWO statements about caching are correct, based on AWS guidance? (Select TWO.) *(choose two)*

- **A.** Once a cache is in place, its contents are guaranteed to always match the database in real time
- **B.** A cache should be kept on the very same host as the application server so scaling never introduces network overhead
- **C.** Caching only speeds up the client side and has no effect on how much load the backend database sees
- **D.** Serving repeated requests from an in-memory cache instead of the database can significantly cut the load placed on that database
- **E.** Reading from an in-memory cache such as Redis or Memcached is typically far faster than reading from a disk-based database

<details><summary>Answer</summary>

**D.** **E.** — AWS guidance on caching highlights both of these as core benefits: a hit against an in-memory cache avoids a trip to the database entirely, which can replace a meaningful amount of database capacity, and memory-based reads are dramatically faster than pulling the same data off disk. The remaining statements are inaccurate — cached data is explicitly allowed to go stale for a configured time-to-live rather than always tracking the database instantly, co-locating a cache with a single application host actually threatens the cache's integrity as that host scales in and out, and cutting database load is one of caching's headline benefits rather than something it has no effect on.

</details>

### resilient-018

A three-tier web application currently runs entirely inside one Availability Zone. What resilience gap does this create, and what is the standard fix?

- **A.** A single-AZ design cannot use encryption at rest, so multiple Regions are required
- **B.** The application would be unable to scale past a fixed number of users; a CDN fixes this
- **C.** That AZ's own outage would take the whole application down; spreading compute across AZs fixes this
- **D.** IAM policies would stop being enforced once resources cross AZ boundaries entirely

<details><summary>Answer</summary>

**C.** — An Application Load Balancer is documented as spreading traffic across targets in multiple Availability Zones specifically to increase the availability of an application, which only matters because a single AZ can and does go down on its own — leaving everything in one AZ makes that outage total. The other options describe things that simply aren't true: AZ boundaries don't affect IAM enforcement, scaling limits aren't tied to AZ count, and encryption at rest has nothing to do with how many AZs a workload spans.

</details>

### resilient-019

Amazon Route 53 is running health checks against a web application's endpoints. What happens once one endpoint starts failing its check?

- **A.** Route 53 automatically launches a replacement EC2 instance for the failed endpoint
- **B.** Route 53 cancels the domain's registration and releases the name for others to buy
- **C.** Route 53 blocks the domain name from ever resolving again, even for healthy endpoints
- **D.** Route 53 can stop sending traffic to it and notify you of the change

<details><summary>Answer</summary>

**D.** — Route 53's health-checking feature is built to confirm a resource is reachable and functioning, and when it isn't, Route 53 can redirect traffic away from it and alert you. Route 53 doesn't provision compute resources, so it can't launch a replacement instance, and neither cancelling a domain registration nor permanently blocking resolution is something a failed health check triggers.

</details>

### resilient-020

Which AWS service improves multi-Region availability by assigning an application static anycast IP addresses and steering traffic to the nearest healthy endpoint over the AWS backbone network?

- **A.** AWS Global Accelerator
- **B.** AWS Direct Connect
- **C.** Amazon CloudFront
- **D.** Amazon Route 53

<details><summary>Answer</summary>

**A.** — Global Accelerator hands out fixed anycast addresses that map to endpoints across one or more Regions and pushes traffic onto the AWS network backbone as quickly as possible, checking endpoint health along the way. Route 53 solves a related problem through DNS lookups rather than anycast IPs, Direct Connect is a dedicated private link rather than a multi-Region routing service, and CloudFront handles failover per individual content request rather than by reassigning a static IP to a healthy Region.

</details>

### resilient-021

A CloudFront distribution has origin failover configured, and one request to the primary origin fails. What happens, according to AWS guidance?

- **A.** CloudFront permanently purges all cached content that was tied to the primary origin
- **B.** CloudFront retries that request against the secondary, but tries the primary again next time
- **C.** CloudFront switches every future request to the secondary origin from that point forward
- **D.** CloudFront takes the entire distribution completely offline until the primary origin recovers

<details><summary>Answer</summary>

**B.** — CloudFront's origin failover works request by request: a failed call to the primary origin gets retried against the secondary right then, but the primary is still tried first the next time around, rather than the distribution permanently cutting over. Taking the whole distribution down or purging cached content isn't part of this behavior, and a permanent switch to the secondary origin is the opposite of the documented per-request retry behavior.

</details>

### resilient-022

Which TWO statements about using Amazon Route 53 for Regional failover are correct, per AWS guidance? (Select TWO.) *(choose two)*

- **A.** A Route 53 health check can trigger automatic DNS failover to a recovery endpoint, and this is considered a highly reliable data-plane action
- **B.** Shifting a weighted routing policy's weights so all traffic moves to the recovery Region is a control-plane change, making it less resilient than a health-check-driven failover
- **C.** Route 53 can only direct traffic to endpoints located in the same Region as its hosted zone
- **D.** Once traffic has been sent to a recovery Region, Route 53 offers no way to send it back to the primary Region later
- **E.** Amazon Application Recovery Controller health checks always perform a real connectivity test before permitting a manual failover

<details><summary>Answer</summary>

**A.** **B.** — AWS guidance treats automated, health-check-driven DNS failover as a data-plane operation, which is inherently more dependable than editing routing weights by hand — the latter is a control-plane change and carries more risk during an actual incident. The remaining statements are wrong: Route 53 can associate endpoints across multiple Regions under one domain name, nothing prevents shifting traffic back to the primary Region afterward, and Application Recovery Controller health checks are explicitly built as manual on/off switches rather than checks that test real connectivity.

</details>

### resilient-023

A Lambda-based application opens a fresh database connection on nearly every invocation, and traffic spikes are overwhelming the backend RDS instance with connections. Which AWS service pools and reuses a fixed set of database connections on the application's behalf?

- **A.** AWS WAF
- **B.** Amazon Route 53
- **C.** Amazon RDS Proxy
- **D.** AWS Certificate Manager

<details><summary>Answer</summary>

**C.** — RDS Proxy sits between the application and the database, maintaining its own pool of database connections and reusing them so a burst of application-side connection requests doesn't translate into a burst of new database connections. WAF filters web requests for malicious patterns, Route 53 is a DNS service, and Certificate Manager issues TLS certificates — none of them touch database connection pooling.

</details>

### resilient-024

Which TWO of the following are accurate limitations of Amazon RDS Proxy, according to AWS documentation? (Select TWO.) *(choose two)*

- **A.** In a replication setup, a proxy can only be associated with the writer DB instance, never a read replica
- **B.** In a replication setup, a proxy can be associated with a read replica instead of the writer instance
- **C.** An RDS Proxy has to live in the same VPC as the database it connects to
- **D.** An RDS Proxy can be made publicly accessible even when its underlying database is not
- **E.** There is no cap on how many proxies a single AWS account can create

<details><summary>Answer</summary>

**A.** **C.** — Documentation is specific that a proxy in a replication configuration can only be attached to the writer instance, not a read replica, and that the proxy must sit in the same VPC as the database behind it. That directly rules out the claim that a proxy can be associated with a read replica instead of the writer instance; it also rules out making the proxy publicly reachable, since the documentation says a proxy can never be public even if its database is, and rules out an unlimited proxy count, since each account is capped at a fixed number of proxies.

</details>

### resilient-025

Instances in an IPv6-enabled private subnet need to reach package repositories on the internet over IPv6, but nothing external should be able to open a connection to them. Which VPC component gives exactly this one-way outbound path for IPv6 traffic?

- **A.** A VPC peering connection
- **B.** An egress-only internet gateway
- **C.** An internet gateway routed directly into the private subnet
- **D.** A public NAT gateway with an associated Elastic IP address

<details><summary>Answer</summary>

**B.** — An egress-only internet gateway is the IPv6 counterpart of a NAT gateway: instances behind it can initiate outbound IPv6 connections while nothing on the internet can start a connection back in — a protection worth calling out because IPv6 addresses are globally unique and would otherwise be reachable through a regular internet gateway. Routing the subnet's traffic straight to an internet gateway makes it publicly reachable in both directions, a public NAT gateway with an Elastic IP is the equivalent tool for IPv4 traffic rather than IPv6, and a VPC peering connection links two VPCs privately without providing any path to the public internet at all.

</details>

### resilient-026

A VPC has private subnets spread across three Availability Zones, but every one of them routes outbound traffic through a single NAT gateway sitting in just one public subnet. What resilience problem does this create?

- **A.** If that NAT gateway's Availability Zone has an outage, all three private subnets lose outbound access
- **B.** This setup disables Auto Scaling for any instance running in the private subnets
- **C.** NAT gateways cannot be created inside a public subnet, so this setup would fail to deploy
- **D.** A single NAT gateway causes every private subnet to lose its own IP address ranges

<details><summary>Answer</summary>

**A.** — A subnet — and anything created inside it, including a NAT gateway — belongs to exactly one Availability Zone, so routing three AZs' worth of private subnets through a single NAT gateway means one AZ's failure cuts off outbound internet access for all three; the standard fix is a NAT gateway per AZ paired with matching route tables. NAT gateways are meant to be created in a public subnet, not barred from it, and this misconfiguration has no bearing on subnet IP ranges or on whether Auto Scaling can operate.

</details>

### resilient-027

AWS groups disaster recovery strategies into four tiers of increasing cost and readiness. Which order, from least to most expensive, matches how AWS documentation presents them?

- **A.** Warm standby, backup and restore, multi-site active/active, pilot light
- **B.** Backup and restore, pilot light, warm standby, multi-site active/active
- **C.** Multi-site active/active, warm standby, pilot light, backup and restore
- **D.** Pilot light, backup and restore, warm standby, multi-site active/active

<details><summary>Answer</summary>

**B.** — AWS presents these four approaches on a rising scale from the cheapest, simplest option — periodic backups with nothing running until a disaster hits — up through pilot light, then warm standby, and finally multi-site active/active, which keeps full capacity live in more than one Region at once. Any other ordering misplaces at least one tier relative to how much it costs to run and how ready it keeps the recovery environment.

</details>

### resilient-028

A business says it can tolerate losing at most 15 minutes of transaction data, and it needs the application back online within 4 hours of a disaster. Which two recovery metrics do those two numbers represent, respectively?

- **A.** A 15-minute Mean Time Between Failures and a 4-hour Mean Time to Recover
- **B.** A 15-minute service quota and a 4-hour service level agreement
- **C.** A 15-minute Recovery Point Objective and a 4-hour Recovery Time Objective
- **D.** A 15-minute Recovery Time Objective and a 4-hour Recovery Point Objective

<details><summary>Answer</summary>

**C.** — The tolerance for lost data maps to the Recovery Point Objective, and the tolerance for downtime maps to the Recovery Time Objective — AWS defines RPO around avoiding data loss and RTO around limiting how long a workload stays unavailable. Swapping the two, as the option that reverses RPO and RTO does, gets the definitions backwards; Mean Time Between Failures and Mean Time to Recover are availability metrics measured over time rather than one-time disaster targets, and service quotas and SLAs are unrelated concepts entirely.

</details>

### resilient-029

Comparing AWS's pilot light and warm standby disaster recovery strategies, what's the key operational difference the moment a failover happens?

- **A.** The two terms describe the same architecture, just under different names
- **B.** Pilot light keeps a full-capacity copy of everything running around the clock, while warm standby keeps nothing running at all
- **C.** Warm standby only protects data, while pilot light protects both data and compute at full scale
- **D.** Pilot light needs its idle servers switched on first; warm standby can already serve traffic

<details><summary>Answer</summary>

**D.** — AWS documentation draws the line at what happens right at failover: pilot light needs application servers turned on and scaled out before it can take traffic, while warm standby is already running, just at a smaller size, so it can absorb traffic immediately. The claim that pilot light keeps a full-capacity copy running around the clock while warm standby keeps nothing running has it backwards — pilot light is the one that keeps only its data tier always on, not a full-capacity copy — and the two strategies are explicitly distinguished from each other rather than being the same thing.

</details>

### resilient-030

Backup and restore is both the cheapest and slowest of the four DR tiers. Why does AWS guidance stress deploying infrastructure as code specifically for this strategy?

- **A.** Nothing runs in the recovery Region beforehand, so a fast, accurate rebuild keeps recovery on target
- **B.** Because backup and restore has no way to replicate or copy any data whatsoever, at any tier
- **C.** Because infrastructure as code is a prerequisite for turning on backup encryption for any resource
- **D.** Because AWS Backup won't operate at all unless its surrounding infrastructure is fully defined as code

<details><summary>Answer</summary>

**A.** — Since nothing is deployed in the recovery Region ahead of time under this strategy, standing the environment back up depends entirely on repeatable, automated infrastructure definitions — without that, rebuilding tends to be slow and error-prone, pushing recovery time past the target. The strategy does include ways to replicate and copy data, so the claim that backup and restore has no way to replicate or copy data at any tier is false, and encryption settings and AWS Backup's operation aren't gated on infrastructure-as-code the way the encryption-prerequisite and backup-won't-operate claims suggest.

</details>

### resilient-031

What distinguishes a multi-site active/active disaster recovery strategy from a hot standby active/passive strategy?

- **A.** Active/active is the cheaper and operationally simpler of the two approaches to run
- **B.** Active/active serves traffic from every Region it runs in; hot standby serves from just one
- **C.** Hot standby depends on promoting a database replica, while active/active never uses replicas at all
- **D.** Hot standby serves traffic from every Region at once, while active/active reserves one Region purely for recovery

<details><summary>Answer</summary>

**B.** — Multi-site active/active takes live traffic in every Region where it's deployed, whereas hot standby keeps user traffic pointed at a single Region and holds the other Region in reserve purely for recovery. The claim that hot standby serves traffic from every Region while active/active reserves one purely for recovery swaps those roles, the claim that active/active is the cheaper, simpler option is backwards since active/active is described as the more complex and costly of the two, and the claim that hot standby depends on promoting a database replica isn't how the two strategies are actually distinguished from each other.

</details>

### resilient-032

Which TWO statements about AWS Backup are correct, according to AWS documentation? (Select TWO.) *(choose two)*

- **A.** AWS Backup can automatically move a backup from warm storage into a lower-cost cold storage tier once a lifecycle schedule you configure is reached
- **B.** AWS Backup automatically discovers and takes over management of backups created by tools other than itself
- **C.** Every resource that AWS Backup protects must sit in the exact same Region as its backup vault
- **D.** Inside an AWS Organizations structure, AWS Backup can gather backups from many accounts into one repository account
- **E.** A single AWS Backup plan is limited to covering just one AWS resource at any given time

<details><summary>Answer</summary>

**A.** **D.** — AWS Backup documentation confirms it supports lifecycle policies that automatically transition a backup from warm storage into a low-cost cold storage tier on a schedule you define, and that within an organization it supports gathering backups from multiple accounts into a single repository account. It explicitly does not govern or track backups made outside of it, so the third statement is false; AWS Backup also supports copying a resource's backups into a vault in a different Region, which contradicts the same-Region requirement in the fourth statement; and a backup plan is meant to apply across many resources at once, not just a single one, ruling out the fifth.

</details>

### resilient-033

A company wants to use an AWS Region as a disaster recovery target for servers currently running on premises, using continuous block-level replication instead of periodic snapshots. Which AWS service is purpose-built for this?

- **A.** Amazon RDS Proxy, for database connection pooling
- **B.** Amazon S3 Cross-Region Replication
- **C.** AWS Elastic Disaster Recovery
- **D.** AWS Backup, using its scheduled backup plans

<details><summary>Answer</summary>

**C.** — AWS Elastic Disaster Recovery continuously replicates on-premises (or other-cloud) servers and their databases into AWS at the block level, keeping a staged, switched-off copy ready to launch at failover. S3 Cross-Region Replication only copies S3 objects, not whole servers; AWS Backup takes scheduled, point-in-time backups rather than continuous block-level replication; and RDS Proxy pools database connections and has nothing to do with replicating on-premises servers.

</details>

### resilient-034

A request in a distributed application hops through a front-end service and several backend microservices, and one backend call is intermittently slow, though it's unclear which one. Which AWS service traces the request across every hop and builds a map to help pinpoint the slow link?

- **A.** Amazon CloudWatch Logs Insights
- **B.** Amazon Route 53
- **C.** AWS Trusted Advisor
- **D.** AWS X-Ray

<details><summary>Answer</summary>

**D.** — X-Ray follows a request through every service it touches and assembles that into a trace map showing the front-end and every downstream call, which is exactly the tool for spotting which link in the chain is slow or erroring. CloudWatch Logs Insights searches log data rather than building a cross-service trace map, Route 53 is a DNS service, and Trusted Advisor flags general account best-practice issues — none of them trace an individual request end to end.

</details>

### resilient-035

A workload's projected peak traffic is expected to exceed a default account-level service limit next quarter. What does AWS recommend doing about this kind of limit?

- **A.** Check whether Service Quotas marks it as adjustable and request an increase
- **B.** Open a brand-new AWS account whenever an existing one runs into a quota
- **C.** Assume the limit is storage-only, since compute services carry no quotas at all
- **D.** Accept it — service quotas are permanently fixed values that AWS never changes

<details><summary>Answer</summary>

**A.** — Service Quotas lets you check whether a given quota can be raised and submit a request to increase it, and planning that request ahead of an expected traffic increase avoids discovering the limit mid-incident. Quotas are described as adjustable values rather than permanently fixed ones, so the claim that they are permanently fixed and never change is wrong; spinning up a new account isn't how quota increases are handled; and quotas apply broadly across AWS services, including compute services, not just storage.

</details>

### resilient-036

A company is weighing whether to build and scale its own natural-language-processing servers on EC2 to score customer reviews for sentiment. Which AWS service gives them that capability as a managed API instead, handling everything from small real-time calls to large asynchronous batch jobs?

- **A.** AWS Certificate Manager
- **B.** Amazon Comprehend
- **C.** AWS Direct Connect
- **D.** Amazon Route 53

<details><summary>Answer</summary>

**B.** — Comprehend applies natural language processing to text and exposes that as an API you call for quick, real-time analysis or as asynchronous jobs for larger document sets, so the company never has to run or scale that capability itself. Direct Connect, Route 53, and Certificate Manager solve entirely different problems — private connectivity, DNS, and TLS certificates — and none of them perform any language analysis.

</details>

### resilient-037

A company needs one managed AWS service to turn written articles into narrated audio, and a separate one to detect the dominant sentiment in support tickets. Which pairing is correct?

- **A.** Amazon Comprehend for narrated audio, Amazon Polly for sentiment detection
- **B.** Amazon Polly for both narrated audio and sentiment detection
- **C.** Amazon Polly for narrated audio, Amazon Comprehend for sentiment detection
- **D.** Amazon Comprehend for both narrated audio and sentiment detection

<details><summary>Answer</summary>

**C.** — Polly is a text-to-speech service that turns written text into lifelike audio, while Comprehend analyzes text and reports on things like its dominant sentiment — two distinct capabilities that map to the two needs described. Swapping them, as the option that assigns Comprehend to narration and Polly to sentiment detection does, assigns each service to the job it doesn't do, and neither service is documented as handling both speech synthesis and sentiment analysis on its own, ruling out the two options that assign a single service to both jobs.

</details>

### resilient-038

Which TWO statements about how storage placement affects availability are correct, based on AWS documentation? (Select TWO.) *(choose two)*

- **A.** A Regional Amazon EFS file system stores data redundantly across multiple Availability Zones, keeping it available even if one AZ goes down
- **B.** Every Amazon EBS volume is automatically copied across all Availability Zones in its Region
- **C.** A One Zone Amazon EFS file system offers the exact same availability guarantees as a Regional one
- **D.** Keeping data in only one Availability Zone has no bearing on its availability during an AZ-level outage
- **E.** A One Zone Amazon EFS file system keeps data in only a single Availability Zone, so data could be lost if that AZ is damaged or destroyed

<details><summary>Answer</summary>

**A.** **E.** — EFS documentation draws a clear line between its two file system types: Regional file systems spread data across multiple AZs specifically so it survives the loss of any one of them, while One Zone file systems keep data in a single AZ and accept the risk that damage to that AZ could mean data loss. An EBS volume lives in one Availability Zone rather than being copied across all of them, which rules out the third statement, and the fourth and fifth statements both contradict the documented gap between Regional and One Zone availability.

</details>

## Design High-Performing Architectures

25 questions

### performant-001

A latency-sensitive application needs the fastest possible object storage access and can accept keeping its data in a single Availability Zone alongside its compute resources. Which S3 storage class is purpose-built for this scenario?

- **A.** S3 Express One Zone
- **B.** S3 Standard
- **C.** S3 Intelligent-Tiering
- **D.** S3 Glacier Instant Retrieval

<details><summary>Answer</summary>

**A.** — S3 Express One Zone is built specifically for single-digit-millisecond access by keeping data in one Availability Zone next to compute, trading the multi-AZ redundancy of the other classes for that speed. S3 Standard spreads data across multiple AZs for general-purpose use, Intelligent-Tiering optimizes cost by shifting objects between tiers as access patterns change, and Glacier Instant Retrieval targets rarely accessed archival data rather than latency-sensitive workloads.

</details>

### performant-002

An Amazon EFS file system experiences I/O activity that varies significantly over the course of a day. Which EFS throughput mode is designed to automatically scale bandwidth up or down to match that changing activity?

- **A.** Bursting Throughput mode
- **B.** Elastic throughput mode
- **C.** General Purpose performance mode
- **D.** Provisioned Throughput mode

<details><summary>Answer</summary>

**B.** — EFS documentation describes Elastic throughput mode as automatically scaling performance up or down to meet a workload's actual activity, with no manual sizing required. Provisioned Throughput instead has you set a fixed value ahead of time, Bursting Throughput ties available bandwidth to how large the file system already is rather than to current activity, and General Purpose is a performance mode aimed at latency, not a throughput-scaling mechanism.

</details>

### performant-003

A team needs storage that attaches to a single EC2 instance, behaves like a local hard drive, and can have its size or performance tier changed on a live volume with no downtime. Which AWS storage service fits this need?

- **A.** AWS Storage Gateway
- **B.** Amazon EFS
- **C.** Amazon EBS
- **D.** Amazon S3

<details><summary>Answer</summary>

**C.** — EBS volumes attach to one EC2 instance and can be used exactly like a local disk, and Elastic Volumes let a team resize capacity or switch performance tier on a live volume without any downtime. EFS is a shared, multi-instance file system rather than a private attached disk, S3 is object storage reached over an API instead of mounted as a drive, and Storage Gateway connects on-premises applications to AWS storage rather than attaching a volume directly to an EC2 instance.

</details>

### performant-004

Several EC2 instances in a rendering farm need to concurrently read from and write to the exact same directory structure over the network. Which AWS storage service is designed for this kind of shared, concurrent file access?

- **A.** Amazon S3
- **B.** Amazon EBS
- **C.** EC2 instance store
- **D.** Amazon EFS

<details><summary>Answer</summary>

**D.** — EFS is a network file system that many compute resources can mount and use over NFS at the same time, which is exactly the shared-directory access pattern the rendering farm needs. S3 is reached through an object API rather than mounted as a shared directory, an EBS volume attaches to only one instance at a time in the general case, and instance store is ephemeral storage local to a single instance that disappears when it stops.

</details>

### performant-005

Which THREE statements about AWS DataSync are correct, based on AWS documentation? (Select THREE.) *(choose three)*

- **A.** It can only move data into Amazon S3 and no other AWS storage service
- **B.** It uses a parallel, multithreaded transfer design that moves data faster than generic copy tools
- **C.** It requires an existing AWS Direct Connect connection before any transfer can run
- **D.** It automatically validates data integrity during a transfer
- **E.** It can transfer data through a VPC endpoint instead of over the public internet

<details><summary>Answer</summary>

**B.** **D.** **E.** — DataSync documentation describes a purpose-built, parallel, multithreaded transfer engine, automatic integrity validation, and the option to route transfers through a VPC endpoint so they never have to cross the public internet — all three genuine, documented capabilities. It isn't limited to S3 alone; it also supports EFS and several FSx file systems as destinations, and nothing in its documentation requires a Direct Connect connection to already be in place before a transfer can run.

</details>

### performant-006

According to AWS guidance, what is the recommended approach for choosing the right EC2 instance type for a new workload?

- **A.** Launch a candidate instance type, benchmark it against the real application, and switch later if needed
- **B.** Judge the right type purely by its family name, without running the actual workload
- **C.** Pick an instance type at launch and keep it fixed for the workload's entire lifetime
- **D.** Always choose the single largest instance size in the family, regardless of the workload

<details><summary>Answer</summary>

**A.** — AWS recommends launching a candidate type and testing it against your own application, since billing by the second makes it cheap to try a few options before committing, and switching later is straightforward if the choice turns out wrong. Defaulting to the largest size wastes budget on capacity that may never be used, judging a type by name alone skips the benchmarking step AWS recommends, and treating the initial choice as permanent ignores that instance types can be changed after launch.

</details>

### performant-007

An EC2 Auto Scaling group spans multiple Availability Zones. How does Amazon EC2 Auto Scaling distribute instances across those zones as the group scales?

- **A.** It stops performing health checks once the group first reaches its desired capacity
- **B.** It balances instances evenly across every configured Availability Zone as the group scales
- **C.** It concentrates instances in a single Availability Zone until that zone is full, then moves to the next
- **D.** It requires an administrator to manually assign each new instance to a specific Availability Zone

<details><summary>Answer</summary>

**B.** — AWS documentation states that Amazon EC2 Auto Scaling balances instances evenly across whichever Availability Zones a group is configured to use, so no single zone carries a disproportionate share of capacity. It doesn't fill one zone before moving to the next, doesn't need a human to place each instance manually, and keeps monitoring instance health continuously rather than stopping once desired capacity is reached.

</details>

### performant-008

A team wants to run containerized workloads on Amazon ECS without provisioning EC2 instances, patching hosts, or planning server capacity themselves. Which compute option should they choose?

- **A.** Amazon EC2 Reserved Instances
- **B.** AWS Batch running on self-managed EC2 capacity
- **C.** AWS Fargate
- **D.** Amazon EMR

<details><summary>Answer</summary>

**C.** — Fargate bills per task rather than per host and takes over the job of running and isolating container workloads, so nobody on the team has to size, patch, or babysit the machines underneath. Reserved Instances still require managing the underlying EC2 fleet, AWS Batch on self-managed EC2 capacity leaves that same team responsible for the capacity, and EMR is a managed big-data cluster platform rather than a general container runtime for ECS.

</details>

### performant-009

A fleet of IoT sensors publishes each telemetry reading once, and every reading must reach several independent consumers at the same time — an archival queue, an anomaly-detection function, and a live operations dashboard. Which AWS service is purpose-built for this fanout pattern?

- **A.** AWS Direct Connect
- **B.** Amazon Route 53
- **C.** Amazon SQS
- **D.** Amazon SNS

<details><summary>Answer</summary>

**D.** — SNS publishes a message to a topic and replicates it out to every subscribed endpoint at once, which is exactly the fanout pattern described. SQS is documented as typically serving a single subscriber for ordered, loss-sensitive processing rather than broadcasting to many independent listeners, while Direct Connect and Route 53 solve private network connectivity and DNS routing, neither of which is a publish-subscribe messaging pattern.

</details>

### performant-010

Which TWO of the following are documented features of Amazon EC2 Auto Scaling groups? (Select TWO.) *(choose two)*

- **A.** Requiring every instance in the group to use the same purchase option, either all On-Demand or all Spot
- **B.** Automatically replacing instances that fail their health checks
- **C.** Automatically registering and deregistering instances with an attached load balancer as the group scales
- **D.** Removing the need to ever define a minimum or maximum group size
- **E.** Automatically converting standard On-Demand instances into Spot Instances after 24 hours to cut cost

<details><summary>Answer</summary>

**B.** **C.** — Auto Scaling groups automatically monitor instance health and replace any that fail a check, and they automatically register newly launched instances with an attached load balancer while deregistering ones that terminate. A single group can actually mix multiple instance types and purchase options rather than being locked to one, minimum and maximum size are core settings you must define rather than something the service removes the need for, and there's no documented feature that auto-converts On-Demand capacity into Spot after a fixed time.

</details>

### performant-011

Why can Amazon DynamoDB maintain consistent single-digit-millisecond response times even as a table grows to hundreds of terabytes?

- **A.** It's a purpose-built NoSQL database that omits scale-limiting operations such as joins
- **B.** It keeps a permanent copy of every item cached in an attached ElastiCache cluster
- **C.** It relies on a fixed relational schema with heavily indexed joins across many tables
- **D.** It automatically migrates any table past a size threshold into Amazon Redshift

<details><summary>Answer</summary>

**A.** — DynamoDB documentation attributes its performance at scale to being purpose-built as a NoSQL database that leaves out operations like joins, which don't scale efficiently against very large tables. It explicitly doesn't support a JOIN operator at all, which rules out the relational-schema option, and there's no documented behavior where DynamoDB migrates data into Redshift or depends on a permanently cached ElastiCache copy to hit its latency numbers.

</details>

### performant-012

How does Amazon Aurora's throughput on comparable hardware compare to stock MySQL or PostgreSQL, per AWS documentation?

- **A.** About the same, since Aurora reuses the identical storage engine as the open-source versions
- **B.** Up to six times the throughput of stock MySQL or PostgreSQL
- **C.** Roughly half the throughput, accepted as a tradeoff for lower cost
- **D.** Aurora only reaches stock-level throughput when run as a single instance with no cluster

<details><summary>Answer</summary>

**B.** — AWS documentation puts Aurora's throughput ceiling at six times what stock PostgreSQL or MySQL reaches on similar hardware, a gain it earns from a separated, fast distributed storage layer built specifically for it. Aurora doesn't reuse the same storage engine as open-source MySQL or PostgreSQL, its throughput advantage isn't a tradeoff that lowers performance for cost, and the higher throughput isn't limited to single-instance, non-clustered deployments.

</details>

### performant-013

A Multi-AZ RDS deployment already has a synchronous standby replica for failover. The team also wants to offload reporting queries from the primary instance. What should they add?

- **A.** A second standby replica configured specifically to serve read-only queries
- **B.** An RDS Proxy configured to replace the standby replica
- **C.** One or more separate read replicas that receive asynchronously replicated data
- **D.** Nothing — the existing standby replica already serves read traffic

<details><summary>Answer</summary>

**C.** — RDS documentation is explicit that, unlike a read replica, a standby only exists to take over on failover and never answers query traffic, so offloading reporting work requires one or more separate read replicas, which do accept read-only connections and can even coexist alongside a Multi-AZ standby. The claim that the existing standby replica already serves read traffic is directly contradicted by that same documentation, a second standby wouldn't serve reads either since standby replicas by definition don't accept read connections, and RDS Proxy manages and pools connections rather than substituting for read capacity or failover standby duties.

</details>

### performant-014

How does Amazon RDS Proxy help an application stay connected during a database failover?

- **A.** It pauses all application traffic until DNS changes finish propagating
- **B.** It automatically upgrades the database to a larger instance class during the failover
- **C.** It converts every connection to read-only until the failover finishes
- **D.** It keeps application-side connections intact while switching its own connection to the new primary

<details><summary>Answer</summary>

**D.** — RDS Proxy documentation describes it as automatically connecting to the standby instance during a failover while preserving the application's existing connections, so a client never has to reconnect. It doesn't resize the database instance, doesn't force connections into read-only mode, and doesn't need to pause application traffic while waiting on DNS, since it keeps its own connection to the database current on the app's behalf.

</details>

### performant-015

Which TWO statements about Amazon ElastiCache are correct, based on AWS documentation? (Select TWO.) *(choose two)*

- **A.** ElastiCache only supports the Memcached engine and no others
- **B.** ElastiCache Serverless removes the need to provision or size cache nodes ahead of time
- **C.** ElastiCache is meant to replace a primary database rather than sit in front of one
- **D.** A node-based cluster supports cluster mode for horizontal scaling, or none for vertical scaling
- **E.** Every ElastiCache node-based cluster automatically spans multiple AWS Regions on its own

<details><summary>Answer</summary>

**B.** **D.** — ElastiCache Serverless is documented as skipping node and cluster setup entirely, letting a cache spin up without any capacity planning, and a node-based cluster can be run with cluster mode enabled for horizontal scaling or without it for simpler vertical scaling. It supports the Valkey and Redis OSS engines in addition to Memcached, it's designed as a cache layer that sits in front of a primary data store rather than replacing one, and node placement is chosen across Availability Zones within a Region, not automatically spread across multiple Regions.

</details>

### performant-016

How does Amazon CloudFront reduce the latency a viewer experiences when requesting content that is already cached?

- **A.** By serving the content from a nearby edge location instead of contacting the origin server
- **B.** By routing the request back to the origin server no matter where the viewer is located
- **C.** By requiring the origin server to sit in the same city as every viewer
- **D.** By removing the origin server from the architecture entirely once caching begins

<details><summary>Answer</summary>

**A.** — CloudFront documentation explains that when requested content is already sitting at the edge location with the lowest latency to the viewer, CloudFront delivers it immediately from there instead of reaching back to the origin. It doesn't route every request to the origin regardless of location, doesn't require origin and viewer to share a city, and still needs an origin defined to fetch content that isn't cached yet.

</details>

### performant-017

A VoIP provider runs a UDP-based calling backend across several AWS Regions and wants static IP addresses plus fast rerouting to the nearest healthy Region if one becomes impaired. Which service best fits this need?

- **A.** Amazon Route 53 latency-based routing alone
- **B.** AWS Global Accelerator
- **C.** AWS Direct Connect
- **D.** Amazon CloudFront

<details><summary>Answer</summary>

**B.** — Global Accelerator hands out static anycast IP addresses and routes traffic over the AWS global network to the nearest healthy Regional endpoint, reacting within seconds to health changes — a fit for non-HTTP protocols like UDP that CloudFront isn't built to accelerate. Route 53 latency routing alone doesn't provide static IP addresses or Global Accelerator's rapid health-based failover, and Direct Connect is a dedicated private link unrelated to routing traffic between distributed Regional endpoints.

</details>

### performant-018

A steadily growing volume of outbound traffic from private subnets is routed through a single NAT gateway. How does the NAT gateway itself handle that increasing bandwidth demand?

- **A.** It must be stopped and relaunched on a larger instance size by an administrator
- **B.** It automatically scales its bandwidth, up to a documented per-gateway maximum
- **C.** It caps every connection at a fixed rate that never changes as demand grows
- **D.** It transparently spreads the extra traffic across NAT gateways in other Availability Zones

<details><summary>Answer</summary>

**B.** — A NAT gateway is a managed component that scales its own bandwidth automatically, starting at 5 Gbps and scaling as high as 100 Gbps per gateway, so growing outbound demand requires no resizing work from the team — one of its documented advantages over running a self-managed NAT instance on EC2, where picking and changing the instance size is your job. It imposes no fixed unchanging rate cap on connections, and each NAT gateway serves traffic routed to it in its own Availability Zone rather than offloading demand onto gateways in other zones; past the per-gateway maximum, AWS's guidance is to split resources across multiple subnets with additional NAT gateways.

</details>

### performant-019

Which type of AWS Direct Connect virtual interface should a company configure to reach resources inside one specific Amazon VPC using private IP addresses?

- **A.** Public virtual interface
- **B.** Transit virtual interface
- **C.** Site-to-Site VPN interface
- **D.** Private virtual interface

<details><summary>Answer</summary>

**D.** — Direct Connect documentation describes the private virtual interface as the type used to reach a VPC with private IP addresses, connecting directly to a single VPC per interface. A public virtual interface instead reaches public AWS services and endpoints, a transit virtual interface is meant for reaching multiple VPCs through a transit gateway rather than one specific VPC, and a Site-to-Site VPN interface isn't a Direct Connect virtual interface type at all — it belongs to a separate AWS service.

</details>

### performant-020

Which TWO capabilities does an Application Load Balancer provide, according to AWS documentation? (Select TWO.) *(choose two)*

- **A.** Operating at the transport layer for the lowest possible latency on non-HTTP protocols
- **B.** Sending a request to whichever target group matches its URL path or host header
- **C.** Guaranteeing every registered target an identical, fixed share of traffic no matter which routing algorithm is configured
- **D.** Requiring every target to sit inside the same VPC as the load balancer, with no exceptions
- **E.** Performing health checks on registered targets and routing only to the healthy ones

<details><summary>Answer</summary>

**B.** **E.** — An Application Load Balancer reads its configured listener rules and hands each incoming request to whichever target group its path or host field matches, while continuously health-checking registered targets so traffic only reaches the ones passing that check. Operating at the transport layer for non-HTTP protocols describes a Network Load Balancer rather than an ALB, the routing algorithm can be round robin or least-outstanding-requests rather than a guaranteed identical split, and ALBs explicitly support registering targets by IP address outside the load balancer's own VPC.

</details>

### performant-021

A company needs data records to become available to a consuming application in well under a second after being written, with more than one independent application able to read the same data at once. Which AWS service fits this requirement?

- **A.** Amazon Kinesis Data Streams
- **B.** AWS DataSync
- **C.** Amazon Athena
- **D.** AWS Glue

<details><summary>Answer</summary>

**A.** — Kinesis Data Streams documentation describes a typical put-to-get delay of under a second, with multiple independent consumer applications able to read the same stream concurrently for separate purposes. Glue is built for cataloging and transforming data rather than continuous low-latency intake, DataSync is a bulk file-transfer service rather than a continuous streaming service, and Athena queries data already sitting in S3 rather than ingesting a live stream.

</details>

### performant-022

What does an AWS Glue crawler do to help make data stored in Amazon S3 queryable by a service like Athena?

- **A.** It physically relocates the data out of S3 into a Glue-managed database
- **B.** It scans the data source and registers the inferred schema in the Glue Data Catalog
- **C.** It encrypts every object in the bucket before any query can run
- **D.** It converts every file in the bucket into one fixed CSV format

<details><summary>Answer</summary>

**B.** — Glue documentation describes crawlers as scanning data sources, automatically inferring schema and table structure, and registering that structure in the Glue Data Catalog so tools like Athena can query it directly. A crawler doesn't perform encryption, doesn't force every file into one fixed format, and leaves the underlying data in place in S3 rather than moving it anywhere.

</details>

### performant-023

What differentiates Amazon Athena from a traditional data warehouse when querying data already stored in Amazon S3?

- **A.** Athena requires provisioning and managing a cluster before it can run any query
- **B.** Athena requires all queried data to be loaded first into an Athena-managed storage format
- **C.** Athena runs standard SQL directly against S3 data with no infrastructure to manage
- **D.** Athena is limited to NoSQL-style key lookups and doesn't support SQL at all

<details><summary>Answer</summary>

**C.** — Athena documentation describes it as running standard SQL directly against data sitting in S3 with no infrastructure to set up, billing only for the data a query actually scans. It doesn't require a provisioned cluster, doesn't require data to be pre-loaded into a proprietary storage format first, and it queries with standard SQL rather than being limited to NoSQL-style lookups.

</details>

### performant-024

A team wants to run extract-transform-load jobs on a managed Apache Spark engine without provisioning or sizing a Spark cluster themselves. Which AWS service directly addresses this need?

- **A.** Amazon Redshift
- **B.** AWS Direct Connect
- **C.** Amazon EMR with manually managed core nodes
- **D.** AWS Glue

<details><summary>Answer</summary>

**D.** — Glue is documented as a serverless data integration service with no infrastructure to manage, running ETL jobs on a Spark-based engine it operates on the team's behalf. EMR with manually managed core nodes still leaves cluster sizing to the team, which is exactly what's being avoided, Redshift is a data warehouse rather than an ETL engine, and Direct Connect is a private network link unrelated to running transformation jobs.

</details>

### performant-025

Which TWO of the following correctly pair an AWS service with a capability documented for it? (Select TWO.) *(choose two)*

- **A.** Amazon Athena — requires manually provisioning a compute cluster sized to the dataset before querying
- **B.** AWS DataSync — is a NoSQL database service for storing key-value data
- **C.** Amazon Kinesis Data Streams — supports multiple independent consumer applications reading the same stream at once
- **D.** AWS Glue — provides a visual job canvas that automatically generates code for common transformations
- **E.** AWS Glue Data Catalog — stores the dataset itself rather than metadata describing its structure

<details><summary>Answer</summary>

**C.** **D.** — Kinesis Data Streams documentation confirms multiple consumer applications can read the same stream independently and concurrently, and Glue documentation describes a visual job canvas that generates ETL code for common transformations automatically. Athena is serverless and needs no provisioned cluster, DataSync is a data-transfer service rather than a database of any kind, and the Glue Data Catalog stores metadata about a dataset's schema and location rather than the dataset's actual contents.

</details>

## Design Cost-Optimized Architectures

20 questions

### cost-001

A team keeps a second copy of some objects purely to support Cross-Region Replication testing, and that copy can be regenerated easily from the primary object if it is ever lost. Which S3 storage class minimizes the storage cost for this replica data?

- **A.** S3 One Zone-IA
- **B.** S3 Standard
- **C.** S3 Standard-IA
- **D.** S3 Intelligent-Tiering

<details><summary>Answer</summary>

**A.** — S3 storage class documentation recommends S3 One Zone-IA specifically for data that can be re-created if its Availability Zone is lost, including replica copies used for Cross-Region Replication, because keeping the object in only one AZ makes it cheaper than Standard-IA. S3 Standard is priced for frequently accessed data rather than this rarely touched copy, Standard-IA costs more than One Zone-IA because it keeps a multi-AZ copy this scenario doesn't need, and Intelligent-Tiering adds a monitoring fee that isn't useful for a replica whose access pattern is already known to be rare.

</details>

### cost-002

A company must retain compliance recordings for seven years, expects to open them less than once a year, and wants the lowest possible per-gigabyte storage price even if restoring a file takes several hours. Which S3 storage class fits best?

- **A.** S3 Glacier Instant Retrieval
- **B.** S3 Glacier Deep Archive
- **C.** S3 Standard-IA
- **D.** S3 Glacier Flexible Retrieval

<details><summary>Answer</summary>

**B.** — Storage class documentation designs S3 Glacier Deep Archive around archives accessed less than once a year, its rarest access tier, with a retrieval time measured in hours; the classes built for rarer, slower access are the ones priced lowest. Glacier Instant Retrieval targets quarterly access with millisecond retrieval, a faster tier that costs more to support that speed, Standard-IA is meant for millisecond access to monthly-accessed data and sits well above any Glacier tier on price, and Glacier Flexible Retrieval is built around roughly annual access with minutes-to-hours retrieval, one step above Deep Archive.

</details>

### cost-003

An analytics team stores large sequential log files on an EBS volume that's read only a handful of times a month for batch analysis. Throughput matters far more than IOPS, and the team wants the lowest per-GB EBS price available. Which volume type fits?

- **A.** gp3 General Purpose SSD
- **B.** io2 Provisioned IOPS SSD
- **C.** sc1 Cold HDD
- **D.** st1 Throughput Optimized HDD

<details><summary>Answer</summary>

**C.** — Amazon EBS volume type documentation describes Cold HDD (sc1) as throughput-oriented storage for infrequently accessed data, called out specifically for scenarios where the lowest storage cost matters most. Throughput Optimized HDD (st1) is also throughput-oriented but is aimed at more frequently touched data such as active big-data or log-processing jobs, which puts it a tier above sc1's price. Both SSD types, gp3 and io2, are built around transactional IOPS-heavy workloads and cost more than either HDD option.

</details>

### cost-004

A team is choosing shared storage for a fleet of Linux instances whose total data volume swings unpredictably, and they don't want to provision or pay for capacity ahead of actual usage. Which storage service grows and shrinks automatically without any upfront sizing?

- **A.** Amazon EBS
- **B.** Amazon FSx for Windows File Server
- **C.** S3 Glacier Flexible Retrieval
- **D.** Amazon EFS

<details><summary>Answer</summary>

**D.** — Amazon EFS documentation describes it as serverless, fully elastic file storage that lets you share file data without provisioning or managing capacity, growing and shrinking automatically as files are added and removed. An EBS volume, by contrast, is a fixed size you provision and resize yourself, FSx for Windows File Server has you specify a storage capacity, SSD IOPS, and throughput amount at creation time, and S3 Glacier Flexible Retrieval is an archival tier rather than a live shared file system for a fleet of instances.

</details>

### cost-005

Which TWO of the following statements about AWS storage cost mechanics are correct? (Select TWO.) *(choose two)*

- **A.** Transitioning an S3 object to a new storage class through a Lifecycle rule always incurs a per-gigabyte data retrieval fee
- **B.** A Requester Pays S3 bucket shifts data transfer and request costs onto the requester while the bucket owner still pays for storage
- **C.** An EC2 Auto Scaling group cannot mix On-Demand Instances with Reserved Instance or Savings Plans discounts
- **D.** By default, AWS Cost Explorer displays historical cost and usage data covering the most recent 13 months
- **E.** AWS Budgets refreshes its cost and usage figures continuously, in real time, as each charge is incurred

<details><summary>Answer</summary>

**B.** **D.** — S3 Requester Pays documentation confirms the bucket owner always covers storage while the requester covers the request and data transfer cost, and Cost Explorer documentation confirms its default view covers the most recent 13 months of historical data, with an opt-in that extends the window to multiple years. Lifecycle documentation is explicit that transitions carry a per-request transition charge rather than a data retrieval fee, Auto Scaling documentation explains that a group can combine Reserved Instance and Savings Plans discounts with On-Demand Instances rather than being blocked from it, and Budgets documentation states figures are updated up to three times a day rather than continuously.

</details>

### cost-006

A company wants to commit to a steady hourly compute spend for one year to earn a discount, but its teams frequently change EC2 instance families, sizes, operating systems, and even shift workloads between Regions. Which purchasing option keeps the discount through all of that change?

- **A.** Compute Savings Plans
- **B.** Standard Reserved Instances
- **C.** Dedicated Hosts
- **D.** Capacity Reservations

<details><summary>Answer</summary>

**A.** — Savings Plans documentation states that Compute Savings Plans apply regardless of instance family, instance size, operating system, tenancy, or Region, which matches a team that keeps changing those attributes. Reserved Instances instead lock in a discount tied to a specific instance configuration and Region, Dedicated Hosts are priced around a physical host for licensing and compliance needs rather than flexible usage commitments, and Capacity Reservations simply hold capacity in one Availability Zone without offering this kind of broad usage discount.

</details>

### cost-007

A rendering job can pause and resume freely, tolerates its instances being reclaimed on short notice, and needs to run at the lowest possible EC2 cost. Which purchasing option is built for this?

- **A.** On-Demand Instances
- **B.** Spot Instances
- **C.** Dedicated Instances
- **D.** Reserved Instances

<details><summary>Answer</summary>

**B.** — EC2 purchasing documentation describes Spot Instances as unused capacity that can cut EC2 costs significantly, recommended when workloads are flexible about timing and can tolerate interruption. On-Demand simply bills by the second with no such discount, Dedicated Instances bill hourly for single-tenant hardware aimed at compliance needs rather than cost minimization, and Reserved Instances trade a term commitment for savings but don't offer Spot's deeper discount for interruptible work.

</details>

### cost-008

A team running containers on Amazon ECS is weighing the Fargate launch type against the EC2 launch type purely on cost. How do the billing models of the two launch types differ?

- **A.** Fargate bills per task for the vCPU and memory it requests, while the EC2 launch type bills for the underlying instances
- **B.** Fargate bills for whole EC2 instances, while the EC2 launch type bills per individual task
- **C.** Both launch types bill per task, so their costs are always identical for the same workload
- **D.** Fargate adds a fixed monthly per-cluster fee on top of the same per-instance charges the EC2 launch type has

<details><summary>Answer</summary>

**A.** — Fargate bills per task for the vCPU and memory that task requests, and only while it runs, while the EC2 launch type bills for the underlying instances continuously whether tasks pack them efficiently or leave them half idle. That makes Fargate attractive when per-service resource needs don't divide cleanly into fixed instance sizes, while a densely packed, steadily utilized EC2 fleet — especially one discounted with Reserved Instances or Savings Plans — can come out cheaper for constant high-volume work. There's no fixed per-cluster Fargate fee, the two models genuinely differ rather than costing the same, and neither launch type bills in the other's unit.

</details>

### cost-009

A backend must sustain several million raw TCP connections per second with minimal per-connection processing overhead, and it doesn't need any host- or path-based routing rules. Which load balancer type fits?

- **A.** Application Load Balancer
- **B.** Gateway Load Balancer
- **C.** Classic Load Balancer
- **D.** Network Load Balancer

<details><summary>Answer</summary>

**D.** — Network Load Balancer documentation describes it as operating at the fourth OSI layer and able to handle millions of requests per second with static IP addresses, which matches a connection-level workload with no routing-rule needs. An Application Load Balancer works at the application layer and evaluates listener rules for content-based routing this workload doesn't require, a Gateway Load Balancer is built to route traffic to a fleet of third-party virtual appliances rather than serve as a general application backend, and Classic Load Balancer is the older option that Elastic Load Balancing still lists but wasn't designed for this scale.

</details>

### cost-010

Which TWO of the following statements about EC2 scaling and purchasing are correct? (Select TWO.) *(choose two)*

- **A.** A single Amazon EC2 Auto Scaling group can launch a mix of Spot and On-Demand Instances across multiple instance types
- **B.** Spot Instances are guaranteed to run uninterrupted for the full duration originally requested
- **C.** AWS Fargate requires the team to patch and maintain the operating system on the instances hosting its containers
- **D.** Reserved Instances tie their discount to one fixed instance type and one Region, chosen for a 1- or 3-year commitment term
- **E.** Amazon EC2 Auto Scaling charges an additional per-instance management fee on top of the underlying EC2 and EBS costs

<details><summary>Answer</summary>

**A.** **D.** — Auto Scaling documentation confirms a single group can launch multiple instance types across both Spot and On-Demand purchase options, and EC2 purchasing documentation confirms Reserved Instance pricing is locked to one instance type and Region rather than floating across either. Spot Instances are explicitly reclaimable rather than guaranteed to finish their run, Fargate is serverless so the team never touches the underlying operating system, and Auto Scaling documentation states there are no additional fees beyond the resources actually used.

</details>

### cost-011

A new application has highly unpredictable traffic that's often zero, and the team wants to avoid paying for throughput capacity while it's idle. Which DynamoDB capacity mode should they choose?

- **A.** On-demand capacity mode
- **B.** Provisioned capacity mode with auto scaling enabled
- **C.** Provisioned capacity mode with a fixed high throughput ceiling
- **D.** Fixed-rate capacity mode

<details><summary>Answer</summary>

**A.** — DynamoDB documentation describes on-demand capacity mode as pay-as-you-go pricing that scales down to zero, so there's no charge for throughput during idle periods. Both provisioned options, whether or not auto scaling is layered on, still involve a provisioned throughput baseline that gets billed, and "fixed-rate capacity mode" isn't one of DynamoDB's two documented capacity modes at all.

</details>

### cost-012

An application frequently opens many short-lived database connections, forcing the team to run an oversized DB instance mainly to absorb the CPU and memory overhead of constantly establishing new connections. What addresses this without resizing the instance?

- **A.** Adding a read replica
- **B.** Amazon RDS Proxy
- **C.** Enabling a Multi-AZ standby
- **D.** Increasing the provisioned IOPS on the DB storage

<details><summary>Answer</summary>

**B.** — RDS Proxy documentation explains that it pools and reuses database connections, sidestepping the processing cost that comes with repeatedly setting up a fresh connection. A read replica scales read throughput rather than connection handling, a Multi-AZ standby exists for failover rather than pooling connections, and provisioned IOPS improves storage performance, not the overhead of connection churn.

</details>

### cost-013

What's true about the cost of running an Amazon RDS read replica in the same AWS Region as its source DB instance?

- **A.** Both the replica's DB instance cost and its replication data transfer are entirely free of charge, with no billing at all
- **B.** The replica is billed at half the standard rate for its DB instance class because it only serves reads
- **C.** The replica is billed at the standard DB instance rate, with no separate charge for keeping it in sync with the source
- **D.** There's no cost for the replica instance, but the replication data transfer is billed at standard cross-Region rates

<details><summary>Answer</summary>

**C.** — Read replica documentation states a replica's instance cost matches the ordinary price for whatever DB instance class it runs, while the data transfer that keeps a same-Region replica in sync carries no separate charge. That rules out the option claiming the replica instance itself is free, and there's no documented half-price discount for read-only replicas; the free part is specifically the same-Region replication traffic, not a cross-Region rate.

</details>

### cost-014

A team wants to add a managed in-memory cache in front of their database without choosing a node type, sizing a cluster, or planning capacity ahead of time. Which ElastiCache deployment model fits?

- **A.** A node-based cluster with cluster mode enabled
- **B.** A node-based cluster with cluster mode disabled
- **C.** Amazon RDS Performance Insights
- **D.** ElastiCache Serverless

<details><summary>Answer</summary>

**D.** — ElastiCache documentation describes Serverless as letting you stand up a cache in under a minute without ever having to size a node, configure a cluster, or plan capacity yourself. Both node-based cluster options explicitly require choosing a node type, node count, and placement across Availability Zones, and RDS Performance Insights is a database monitoring feature rather than a caching layer at all.

</details>

### cost-015

Which TWO of the following statements about database backup, replication, and capacity behavior are correct? (Select TWO.) *(choose two)*

- **A.** Amazon RDS automatically creates or removes an RDS for MySQL DB instance's read replicas as read traffic rises and falls
- **B.** An Amazon RDS Proxy can be attached to a read replica in place of the writer DB instance to pool its connections
- **C.** DynamoDB continuous backups support restoring a table to any second within the preceding 35 days
- **D.** DynamoDB on-demand capacity mode requires read and write capacity units to be provisioned in advance
- **E.** Amazon RDS does not bill for the data transfer used to keep a same-Region read replica synced with its source

<details><summary>Answer</summary>

**C.** **E.** — DynamoDB documentation confirms point-in-time recovery can restore a table to any second within the preceding 35 days, and read replica documentation confirms same-Region replication data transfer isn't charged. RDS documentation is explicit that the standard engines such as RDS for MySQL don't support autoscaling of read replicas — only Aurora's Aurora Auto Scaling feature adjusts replica count automatically — RDS Proxy documentation states a proxy can only be associated with the writer instance rather than a read replica, and on-demand capacity mode is defined by not needing capacity units provisioned in advance, which is what the provisioned mode requires instead.

</details>

### cost-016

Instances in a private subnet send a large volume of traffic to Amazon S3, currently routed through a NAT gateway that bills hourly plus per gigabyte processed. What change removes that data-processing cost for the S3 traffic specifically?

- **A.** Create a gateway endpoint for S3 and route that traffic to it
- **B.** Replace the managed NAT gateway with a self-managed NAT instance running on EC2
- **C.** Add a second NAT gateway in the same Availability Zone as the first
- **D.** Attach an internet gateway to the VPC without changing the private subnet's route table

<details><summary>Answer</summary>

**A.** — Gateway endpoint documentation states this endpoint type carries no extra fee of its own, and NAT gateway pricing guidance specifically recommends creating a gateway or interface endpoint when most NAT traffic is headed to a service that supports one. A self-managed NAT instance still bills for the underlying EC2 usage and data flowing through it, a second NAT gateway in the same zone only adds another hourly charge, and a private subnet doesn't get a usable route to an internet gateway just by attaching one.

</details>

### cost-017

For a VPC peering connection between two VPCs owned by different AWS accounts, which category of traffic crosses at no data transfer charge?

- **A.** Traffic is billed per connection-hour rather than by data volume
- **B.** Traffic that stays within a single Availability Zone
- **C.** Traffic that crosses AWS Regions
- **D.** All traffic over the peering connection, regardless of Availability Zone or Region

<details><summary>Answer</summary>

**B.** — VPC peering pricing documentation states that data transfer staying within a single Availability Zone is free even across different accounts, while traffic that crosses Availability Zones or Regions is charged. There's no documented per-connection-hour fee for peering at all, and the free treatment doesn't extend to every byte on the connection regardless of where it travels.

</details>

### cost-018

A company is connecting 15 VPCs so every VPC can reach every other one, and wants to avoid managing a separate peering connection for each pair. Cost-wise, what does adopting AWS Transit Gateway introduce instead?

- **A.** No new charges, since Transit Gateway is included at no cost with any VPC
- **B.** A one-time setup fee with no ongoing hourly or data charges afterward
- **C.** An hourly charge for each attachment plus a charge for the data it processes
- **D.** A charge only if more than one AWS Region is involved

<details><summary>Answer</summary>

**C.** — Transit Gateway pricing documentation states that you're charged hourly for each attachment plus a charge for the traffic it processes, which replaces the operational burden of a full mesh of peering connections with these two ongoing charges. There's no free tier for Transit Gateway, no one-time-only fee structure, and the hourly and data-processing charges apply whether one Region or several are involved.

</details>

### cost-019

A VPC has private subnets spread across three Availability Zones, all routing outbound traffic through a single NAT gateway placed in just one of those zones. What cost does this shared-NAT design create that placing a NAT gateway in each zone would avoid?

- **A.** An hourly charge for the NAT gateway itself, which per-AZ NAT gateways would eliminate entirely
- **B.** A charge for every Elastic IP address, which per-AZ NAT gateways would avoid needing
- **C.** A per-request charge for every S3 request that happens to pass through the NAT gateway
- **D.** Cross-AZ data transfer charges for resources in the other zones reaching that single gateway

<details><summary>Answer</summary>

**D.** — NAT gateway pricing guidance recommends adding one gateway per zone wherever that zone hosts resources, precisely so traffic doesn't have to hop between zones to reach a shared gateway. Every NAT gateway, shared or per-AZ, still carries its own hourly charge and still needs an Elastic IP, so per-AZ placement doesn't remove those costs, and a per-request S3 charge is a detail of S3 pricing rather than something tied to the NAT gateway's design.

</details>

### cost-020

Which TWO of the following statements about network costs are correct? (Select TWO.) *(choose two)*

- **A.** Data transfer over a VPC peering connection is billed per connection-hour rather than by data volume
- **B.** AWS Global Accelerator adds a fixed hourly accelerator charge plus a data-transfer premium on top of standard rates
- **C.** A gateway VPC endpoint for DynamoDB bills its own hourly fee on top of what standard data transfer already costs
- **D.** NAT gateways bill only for the hours they are provisioned, with no charge based on the volume of data processed
- **E.** AWS Direct Connect bills separately for port-hours and for outbound data transfer

<details><summary>Answer</summary>

**B.** **E.** — Global Accelerator pricing documentation confirms a fixed hourly fee per accelerator plus an incremental fee layered onto ordinary data transfer pricing, and Direct Connect pricing documentation confirms its two billing elements are port hours and outbound data transfer. VPC peering has no per-connection-hour fee, gateway endpoints carry no additional charge at all, and NAT gateway pricing explicitly bills both for the hours provisioned and for every gigabyte processed.

</details>
