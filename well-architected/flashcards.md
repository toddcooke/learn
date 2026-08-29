# AWS Well-Architected Framework — flashcards

112 cards. Exported to Anki by scripts/export-anki.mjs.
<!-- domains: Framework Foundations | Operational Excellence | Security | Reliability | Performance Efficiency | Cost Optimization | Sustainability -->

## Framework Foundations

### `waf-what-it-is` · AWS Well-Architected Framework

**What is the AWS Well-Architected Framework, and what is it explicitly not?**

<details><summary>Answer</summary>

A set of foundational questions and best practices, distilled from AWS reviewing thousands of customer architectures, that lets you measure a design against cloud best practices and see where it falls short. AWS is emphatic about the flip side: a review is a constructive conversation about architectural decisions, not an audit, not a certification, and not a pass/fail gate. What comes out of it is a prioritized list of risks and improvements, not a score.

</details>

### `waf-six-pillars` · The six pillars

**Name the six pillars of the Well-Architected Framework.**

<details><summary>Answer</summary>

- Operational excellence
- Security
- Reliability
- Performance efficiency
- Cost optimization
- Sustainability

The framework's own analogy is a building: neglect any one of the six and structural problems undermine everything built on top, which is why they are treated as a checklist rather than a menu to pick from.

</details>

### `waf-component` · Component

**In Well-Architected terminology, what is a component?**

<details><summary>Answer</summary>

The code, configuration, and AWS resources that together satisfy one requirement. A component is usually the unit of technical ownership and is deliberately decoupled from the others — it is the smallest thing the framework talks about owning.

</details>

### `waf-workload` · Workload

**What is a workload, and why is it the unit a Well-Architected review operates on?**

<details><summary>Answer</summary>

A set of components that together deliver business value. It is the level of detail business and technology leaders naturally talk about, which is exactly what makes it the right granularity for a review: small enough to reason about concretely, large enough that the answers matter to someone outside the engineering team.

</details>

### `waf-architecture-milestones` · Architecture and milestones

**What do 'architecture' and 'milestones' mean in the framework's vocabulary?**

<details><summary>Answer</summary>

Architecture is how the components of a workload work together — the communication and interaction that architecture diagrams usually focus on. Milestones mark key changes to that architecture as it moves through the product lifecycle: design, implementation, testing, go-live, and production. Milestones are what you anchor repeat reviews to.

</details>

### `waf-technology-portfolio` · Technology portfolio

**What is a technology portfolio, and why would a CTO review one rather than a single workload?**

<details><summary>Answer</summary>

It is the whole collection of workloads an organization needs in order to operate. Reviewing across the portfolio instead of one workload at a time is what surfaces themes — several teams with clusters of issues in the same pillar — which can then be fixed once, through a mechanism, training, or an engineering talk, instead of team by team.

</details>

### `waf-level-of-effort` · Level of effort

**What do the high, medium, and low levels of effort mean, and why does the framework bother defining them?**

<details><summary>Answer</summary>

They categorize how much time and complexity an improvement takes, calibrated to your own team's size, expertise, and workload:

- High — multiple weeks to months, usually split across several releases and tasks
- Medium — multiple days to weeks, across a few releases and tasks
- Low — multiple hours to days, a handful of tasks

They exist so a review's findings can be prioritized against real capacity rather than just listed.

</details>

### `waf-general-design-principles` · General design principles

**Name the six general design principles that sit above all the pillars.**

<details><summary>Answer</summary>

- Stop guessing your capacity needs
- Test systems at production scale
- Automate with architectural experimentation in mind
- Consider evolutionary architectures
- Drive architectures using data
- Improve through game days

They are not pillar-specific — they describe how the cloud changes what good design even looks like.

</details>

### `waf-stop-guessing-capacity` · Stop guessing your capacity needs

**What habit does 'stop guessing your capacity needs' replace, and why is it specific to the cloud?**

<details><summary>Answer</summary>

It replaces buying for a forecast peak, which leaves you either paying for idle hardware or throttled by a bad guess. In the cloud you take as much or as little capacity as you currently need and scale in and out automatically, so capacity stops being a one-time bet placed before you have any real data.

</details>

### `waf-test-at-production-scale` · Test systems at production scale

**Why does the cloud make production-scale testing practical when on-premises did not?**

<details><summary>Answer</summary>

You can stand up a full-size test environment on demand, run the test, and decommission it, paying only for the hours it existed. On-premises, matching production scale meant buying a second production estate, so teams tested against scaled-down environments and found their scale problems in production instead.

</details>

### `waf-automate-experimentation` · Automate with architectural experimentation in mind

**What does this principle ask for beyond just 'automate things'?**

<details><summary>Answer</summary>

Automate so that creating and replicating a workload is cheap enough to experiment with, and treat the automation itself as a tracked artifact — changes recorded, impact audited, previous parameters restorable. Automation you cannot review or revert makes experimenting riskier, not safer, which defeats the point.

</details>

### `waf-evolutionary-architectures` · Consider evolutionary architectures

**What is an evolutionary architecture, and what does it replace?**

<details><summary>Answer</summary>

An architecture expected to keep changing, rather than one settled in a few big up-front decisions with a handful of major versions over its lifetime. Those early decisions age badly as the business moves. Because automated on-demand testing makes design changes low-risk in the cloud, a system can keep absorbing innovations as standard practice instead of ossifying around its original assumptions.

</details>

### `waf-data-driven-architecture` · Drive architectures using data

**What makes a data-driven approach to architecture possible in the cloud specifically?**

<details><summary>Answer</summary>

Your infrastructure is code, and you can collect data on how each architectural choice actually affects the workload's behavior. That turns architecture arguments into measurements — you improve based on how choices performed, not on whose opinion carried the room.

</details>

### `waf-game-days` · Improve through game days

**What is a game day, and what is it really testing?**

<details><summary>Answer</summary>

A regularly scheduled simulation of a real event in production. It tests two things at once: whether the architecture behaves as designed under that event, and whether the team's processes and responses hold up. The organizational experience it builds in dealing with events is as much the point as any technical finding.

</details>

### `waf-tradeoffs` · Trade-offs between pillars

**How does the framework expect you to trade the pillars against each other, and which two are the exception?**

<details><summary>Answer</summary>

Trade-offs follow business context. You might optimize a development environment for sustainability and cost at the expense of reliability, or optimize a mission-critical system for reliability and accept the higher cost and impact. Security and operational excellence are the stated exception — they are generally not traded off against the other pillars.

</details>

### `waf-review-nature` · The review process

**What kind of process is a Well-Architected review supposed to be?**

<details><summary>Answer</summary>

Consistent, blame-free, and lightweight — hours rather than days, a conversation rather than an audit, with enough psychological safety to dive deep. The purpose is to surface critical issues and improvement areas, and the output is a set of actions that improve the experience of the workload's customers.

</details>

### `waf-review-timing` · When to review

**When in a product's life should Well-Architected reviews happen?**

<details><summary>Answer</summary>

At key milestones: early in design, to catch decisions before they harden, and again before go-live. The architecture keeps evolving after production, so significant changes should trigger another pass. AWS's actual recommendation is stronger than periodic reviews — have the team that built the architecture review it continuously as it evolves, updating answers rather than convening a formal meeting.

</details>

### `waf-one-way-doors` · One-way and two-way doors

**What is the difference between a one-way door and a two-way door, and how should each be handled?**

<details><summary>Answer</summary>

A two-way door is a reversible decision, so it deserves a lightweight process and a quick call. A one-way door is hard or impossible to reverse and warrants more inspection before you walk through it. Reviewing early in the design phase is specifically about catching one-way doors while they are still open.

</details>

### `waf-review-objections` · Objections to a review

**What are the standard objections to running a review, and the standard answers?**

<details><summary>Answer</summary>

- 'We are too busy' — usually said before a big launch, which is exactly when you want to know what you missed.
- 'We have no time to act on the results' — even with an immovable date, you can at least build playbooks for the risks you found.
- 'We do not want to reveal our implementation' — point the team at the questions themselves; none of them expose proprietary commercial or technical detail.

</details>

### `waf-mechanisms` · Mechanisms over good intentions

**Why does AWS distribute architecture capability into teams rather than using a central architecture team, and how is the risk managed?**

<details><summary>Answer</summary>

Every team is expected to be able to architect well, instead of a central group checking their work. Two things mitigate the risk: practices — norms, process, and standards, with experts who raise the bar — and mechanisms, automated checks that verify the standards are actually being met. The Bezos line behind it is that good intentions never work, you need good mechanisms. The framework is the customer-facing version of AWS's own internal review process.

</details>

### `waf-tool-lenses` · Well-Architected Tool and Lenses

**What are the AWS Well-Architected Tool and Well-Architected Lenses?**

<details><summary>Answer</summary>

The Tool is a free service in the console that walks a workload through the framework's questions, flags high-risk issues, and records milestones so improvement over time is visible. Lenses extend the framework into specific domains — machine learning, data analytics, serverless, HPC, IoT, SAP, streaming media, games, hybrid networking, financial services — and are meant to be applied together with the six pillars, never instead of them.

</details>

### `waf-labs-partners` · Labs and the Partner Program

**What hands-on and human help does AWS offer around the framework?**

<details><summary>Answer</summary>

Well-Architected Labs is a public repository of code and documentation for practicing the best practices directly. The Well-Architected Partner Program is a network of AWS Partners with deep framework knowledge who can review and improve workloads with you. AWS also reviews workloads itself at no charge, and the Tool costs nothing.

</details>

## Operational Excellence

### `ops-pillar` · Operational excellence pillar

**What does the operational excellence pillar cover, and what are its four best practice areas?**

<details><summary>Answer</summary>

A commitment to build software correctly while consistently delivering a good customer experience: organizing the team, designing the workload to be operable, running it at scale, and improving it over time. The four best practice areas are:

- Organization
- Prepare
- Operate
- Evolve

Every question in the pillar carries the OPS prefix.

</details>

### `ops-design-principles` · OPS design principles

**Name the eight design principles for operational excellence.**

<details><summary>Answer</summary>

- Organize teams around business outcomes
- Implement observability for actionable insights
- Safely automate where possible
- Make frequent, small, reversible changes
- Refine operations procedures frequently
- Anticipate failure
- Learn from all operational events and metrics
- Use managed services

</details>

### `ops-organize-around-outcomes` · Organize teams around business outcomes

**Why is 'organize teams around business outcomes' listed first, ahead of every technical principle?**

<details><summary>Answer</summary>

Because it is the one that sustains all the others. Achieving business outcomes comes from leadership vision, effective operations, and an operating model aligned to the business — one that uses people, process, and technology to scale and to differentiate through agility. The organization's long-term vision has to be translated into goals communicated to stakeholders, with goals and operational KPIs aligned at every level. Without that, the technical principles below it decay.

</details>

### `ops-observability` · Implement observability for actionable insights

**What does this principle ask you to get out of observability, beyond dashboards?**

<details><summary>Answer</summary>

A comprehensive understanding of the workload's behavior, performance, reliability, cost, and health, tied to established KPIs. The test is whether the telemetry lets you act promptly when a business outcome is at risk, and whether you use it proactively to improve performance, reliability, and cost — not merely whether the data is being collected.

</details>

### `ops-safe-automation` · Safely automate where possible

**What makes automation 'safe' under this principle?**

<details><summary>Answer</summary>

Guardrails around it: rate control, error thresholds, and approvals. The principle is to define the whole workload and its operations — applications, infrastructure, configuration, and procedures — as code and trigger them from events, applying the same engineering discipline you use on application code. The guardrails are what keep automation from converting one bad input into a fast, consistent, large-scale mistake.

</details>

### `ops-small-reversible-changes` · Make frequent, small, reversible changes

**What does this principle require of the architecture itself, and what does it buy?**

<details><summary>Answer</summary>

It requires workloads that are scalable and loosely coupled, so components can be updated independently and regularly. Smaller, automated, incremental changes shrink the blast radius when something breaks and make reversal faster, which raises the team's confidence to keep shipping and to adapt quickly when conditions change.

</details>

### `ops-refine-procedures` · Refine operations procedures frequently

**What does keeping operations procedures current actually involve?**

<details><summary>Answer</summary>

Evolving the procedures as the workload evolves: using them, looking for improvements while you do, and holding regular reviews to confirm they still work and that teams are actually familiar with them. Gaps found get fixed, and updates get communicated to every stakeholder and team. Gamifying operations is the suggested way to share practice and train people.

</details>

### `ops-anticipate-failure` · Anticipate failure

**How does operational excellence want you to anticipate failure?**

<details><summary>Answer</summary>

By deliberately driving failure scenarios to understand the workload's risk profile and what those risks would cost the business, and by testing your procedures and your team's response against those simulations. The output is an informed decision about which open risks to accept — anticipating failure is a risk-management activity, not just a testing one.

</details>

### `ops-learn-from-events` · Learn from all operational events and metrics

**What is the scope of 'learn from all operational events', and where should the learning go?**

<details><summary>Answer</summary>

All of them, not just the failures. Lessons get shared across teams and through the whole organization, and the good ones carry both data and the story — how operations actually contributed to a business outcome. Learning that stays inside the team that had the incident is the failure mode this principle exists to prevent.

</details>

### `ops-managed-services` · Use managed services

**Why does 'use managed services' appear as an operational excellence principle rather than a cost one?**

<details><summary>Answer</summary>

Because the thing it reduces is operational burden. Handing the undifferentiated operation of a component to AWS removes work your team would otherwise carry forever, and the principle explicitly asks you to build your operational procedures around interacting with those services rather than around running the component yourself.

</details>

### `ops-organization-area` · Organization (OPS best practice area)

**What does the Organization best practice area ask of you?**

<details><summary>Answer</summary>

That leadership defines business objectives and the organization understands its requirements and priorities well enough to organize and conduct work that supports them. It is where the framework checks that engineering effort is pointed at business outcomes at all, before asking any question about how the work is done.

</details>

### `ops-prepare-area` · Prepare (OPS best practice area)

**What does the Prepare best practice area cover?**

<details><summary>Answer</summary>

Getting a workload ready to be operated: designing it to emit the information needed to support it, and putting integration, deployment, and delivery in place so repetitive processes are automated and beneficial changes flow into production more freely. It also covers understanding the risks in operating the workload and making an informed decision to enter production.

</details>

### `ops-operate-area` · Operate (OPS best practice area)

**What does the Operate best practice area cover?**

<details><summary>Answer</summary>

Running the workload day to day: the teams being able to support it, and business and operational metrics derived from the desired business outcomes being used to understand the health of the workload and of operations activities, and to respond to incidents. Metrics that are not traceable to an outcome are the anti-pattern here.

</details>

### `ops-evolve-area` · Evolve (OPS best practice area)

**What does the Evolve best practice area cover?**

<details><summary>Answer</summary>

Treating changing priorities as a feedback loop rather than a disruption. Business needs and the business environment shift, and Evolve is about using that shift, along with what operations has learned, to continually drive improvement in both the organization and the operation of the workload.

</details>

### `ops-emit-to-support` · Designing a workload to be supportable

**What does 'your workload must emit the information necessary to support it' mean in practice?**

<details><summary>Answer</summary>

That observability is an architectural requirement decided at design time, not instrumentation bolted on after the first incident. If the workload does not emit what operators need — the signals that map to business and operational metrics — no amount of monitoring tooling downstream can reconstruct it, and the team ends up debugging production by inference.

</details>
## Security

### `sec-pillar` · Security pillar

**What does the security pillar cover, and what are its seven best practice areas?**

<details><summary>Answer</summary>

Using cloud technologies to protect data, systems, and assets and improve your security posture. The seven best practice areas are:

- Security foundations
- Identity and access management
- Detection
- Infrastructure protection
- Data protection
- Incident response
- Application security

The through-line is controlling who can do what, spotting incidents, protecting systems, keeping data confidential and intact, and having a rehearsed response.

</details>

### `sec-design-principles` · SEC design principles

**Name the seven design principles for security in the cloud.**

<details><summary>Answer</summary>

- Implement a strong identity foundation
- Maintain traceability
- Apply security at all layers
- Automate security best practices
- Protect data in transit and at rest
- Keep people away from data
- Prepare for security events

</details>

### `sec-strong-identity` · Implement a strong identity foundation

**What are the three parts of a strong identity foundation?**

<details><summary>Answer</summary>

Three things to put in place:

- Least privilege for every interaction with your AWS resources
- Separation of duties, enforced through appropriate authorization
- Centralized identity management

The fourth thing it asks for is a removal: eliminate reliance on long-term static credentials, which is what turns a single leaked secret into indefinite access.

</details>

### `sec-traceability` · Maintain traceability

**What does 'maintain traceability' require beyond turning on logging?**

<details><summary>Answer</summary>

Monitoring, alerting, and auditing actions and changes to your environment in real time, and then integrating that log and metric collection with systems that can automatically investigate and act. Logs nobody reads, and logs that arrive too late to act on, both fail this principle.

</details>

### `sec-all-layers` · Apply security at all layers

**What does defense in depth mean concretely under this principle?**

<details><summary>Answer</summary>

Multiple security controls applied at every layer rather than one hard perimeter: the network edge, the VPC, the load balancer, every instance and compute service, the operating system, the application, and the code itself. The assumption is that any single control will eventually be bypassed.

</details>

### `sec-automate` · Automate security best practices

**Why does automating security controls matter more as you scale?**

<details><summary>Answer</summary>

Software-based security mechanisms scale rapidly and cost-effectively in a way manual review cannot. The specific ask is to define and manage controls as code in version-controlled templates, so secure architectures get built by default and every environment inherits the same controls instead of each one being secured by hand.

</details>

### `sec-protect-data` · Protect data in transit and at rest

**What is the first step this principle asks for, before any encryption decision?**

<details><summary>Answer</summary>

Classifying your data into sensitivity levels. Only then do you apply the mechanisms — encryption, tokenization, access control — as appropriate to each level. Without the classification you either under-protect the sensitive data or pay to over-protect everything uniformly.

</details>

### `sec-people-away-from-data` · Keep people away from data

**What risk is 'keep people away from data' aimed at?**

<details><summary>Answer</summary>

Human error and mishandling. The principle asks you to use tools and mechanisms that reduce or eliminate the need for direct access or manual processing of data at all — so sensitive data is acted on by reviewed, repeatable code paths rather than by a person with a console session and good intentions.

</details>

### `sec-prepare-for-events` · Prepare for security events

**What does preparing for a security event involve?**

<details><summary>Answer</summary>

Having incident management and investigation policy and processes that match your organization's requirements, rehearsing them through incident response simulations, and using tooling with automation to speed up detection, investigation, and recovery. The preparation is what converts an incident from an improvisation into a procedure.

</details>

### `sec-shared-responsibility` · Shared responsibility model

**How does the shared responsibility model change what a customer has to secure?**

<details><summary>Answer</summary>

AWS physically secures the infrastructure its cloud services run on, so the customer's attention moves to using those services correctly to meet their own security and compliance goals. The cloud also gives you more access to security data and an automated way to respond to security events than a self-run data center typically does.

</details>

### `sec-foundations-area` · Security foundations

**What does the security foundations best practice area cover?**

<details><summary>Answer</summary>

The practices you put in place before architecting any workload — the organizational and account-level groundwork that influences every later security decision. It is the area that asks whether security has an owner, a structure, and a set of requirements at all, rather than being assembled per workload.

</details>

### `sec-iam-area` · Identity and access management

**What question does the identity and access management area exist to answer?**

<details><summary>Answer</summary>

Who can do what. It covers both human and machine identities and the permissions attached to them, and it is where least privilege, separation of duties, centralized identity, and the removal of long-lived credentials are actually checked against a workload.

</details>

### `sec-detection-area` · Detection

**What does the detection best practice area cover?**

<details><summary>Answer</summary>

Being able to identify a security incident — the logging, monitoring, and alerting that turn activity in the environment into a signal someone or something can act on. Detection is what makes the difference between an incident you respond to and one you learn about from a third party.

</details>

### `sec-infrastructure-protection-area` · Infrastructure protection

**What does the infrastructure protection best practice area cover?**

<details><summary>Answer</summary>

Protecting the systems and services in the workload — network and compute layer controls, hardening, and boundary enforcement. It is the defense-in-depth principle applied to everything between the network edge and the operating system.

</details>

### `sec-data-protection-area` · Data protection

**What does the data protection best practice area cover?**

<details><summary>Answer</summary>

Maintaining the confidentiality and integrity of data, in transit and at rest, according to its classification. This is where encryption, key management, tokenization, and access control to the data itself are examined — and where the objectives are usually regulatory obligations and preventing financial loss.

</details>

### `sec-incident-response-area` · Incident response

**What does the incident response best practice area check for?**

<details><summary>Answer</summary>

A well-defined and practiced process for responding to security incidents. Both words matter: a documented process that has never been exercised, and an experienced team without a defined process, each fail this area for the same reason — the response has to be predictable under pressure.

</details>

### `sec-appsec-area` · Application security

**What does the application security best practice area cover?**

<details><summary>Answer</summary>

Security in the software your team writes and ships — the practices, testing, and controls that keep vulnerabilities out of the application layer and out of the pipeline that delivers it. It is the newest of the seven areas and the one closest to the developer's daily work.

</details>

## Reliability

### `rel-pillar` · Reliability pillar

**What does the reliability pillar cover, and what are its four best practice areas?**

<details><summary>Answer</summary>

The ability of a workload to perform its intended function correctly and consistently when it is expected to — including being able to operate and test it across its whole lifecycle. The four best practice areas are:

- Foundations
- Workload architecture
- Change management
- Failure management

</details>

### `rel-design-principles` · REL design principles

**Name the five design principles for reliability in the cloud.**

<details><summary>Answer</summary>

- Automatically recover from failure
- Test recovery procedures
- Scale horizontally to increase aggregate workload availability
- Stop guessing capacity
- Manage change through automation

</details>

### `rel-auto-recover` · Automatically recover from failure

**What does automatic recovery require you to monitor, and what does sophisticated automation add?**

<details><summary>Answer</summary>

Monitor KPIs and start automation when a threshold is breached, so failures are notified, tracked, and either worked around or repaired without a human in the loop. With more sophisticated automation you can go further and remediate some failures before they actually occur.

</details>

### `rel-kpi-business-value` · Reliability KPIs

**Why does the framework insist reliability KPIs measure business value rather than technical operation?**

<details><summary>Answer</summary>

Because a technical metric can look healthy while the thing customers care about is broken, and a technical metric breaching says nothing about whether the breach matters. Tying the trigger for automated recovery to a measure of business value keeps the automation firing when it should and quiet when it should not.

</details>

### `rel-test-recovery` · Test recovery procedures

**What does the cloud let you test that on-premises testing usually did not?**

<details><summary>Answer</summary>

How the workload fails, not just that it works in a given scenario. You can use automation to simulate different failures or recreate the exact conditions of a past one, and validate the recovery strategy itself. This exposes failure pathways while there is time to fix them, instead of discovering them during a real event.

</details>

### `rel-scale-horizontally` · Scale horizontally to increase aggregate workload availability

**Why does replacing one large resource with several small ones improve availability?**

<details><summary>Answer</summary>

Because it shrinks what any single failure takes down. Requests are distributed across multiple smaller resources, and the design requirement is to verify those resources do not share a common point of failure — otherwise you have multiplied the instance count without changing the blast radius at all.

</details>

### `rel-stop-guessing-capacity` · Stop guessing capacity (reliability)

**How does capacity guessing show up as a reliability failure rather than a cost one?**

<details><summary>Answer</summary>

As resource saturation: demand exceeds what the workload can serve, which is exactly the effect a denial-of-service attack is trying to produce. The cloud answer is to monitor demand and utilization and automate adding and removing resources, so you neither over- nor under-provision. Limits still exist — some quotas you control, others you manage.

</details>

### `rel-change-automation` · Manage change through automation

**What is easy to miss about 'manage change through automation'?**

<details><summary>Answer</summary>

That the automation is itself part of the changing surface. Infrastructure changes should be made through automation, and changes to that automation must also be tracked and reviewed — otherwise the mechanism you trusted to make change safe becomes the one part of the system nobody is reviewing.

</details>

### `rel-foundations-area` · Foundations (REL best practice area)

**What does the Foundations best practice area cover, and why is it first?**

<details><summary>Answer</summary>

Service quotas and network topology that actually accommodate the workload. It comes first because these are prerequisites that sit below the workload — get them wrong and no amount of good architecture above them produces a reliable system, and they are usually painful to change later.

</details>

### `rel-workload-architecture-area` · Workload architecture (REL best practice area)

**What does the workload architecture best practice area cover?**

<details><summary>Answer</summary>

Designing the distributed system so that failures are prevented where possible and mitigated where not. This is where the choices about service boundaries, interaction patterns, retries, and isolation are examined — the structural decisions that determine how a failure propagates.

</details>

### `rel-change-management-area` · Change management (REL best practice area)

**What does the change management best practice area cover?**

<details><summary>Answer</summary>

The workload's ability to handle changes — in demand, in requirements, and in the workload itself — without losing reliability. It covers how change is deployed and monitored, and how the system adapts to shifting load rather than being sized once and left.

</details>

### `rel-failure-management-area` · Failure management (REL best practice area)

**What does the failure management best practice area cover?**

<details><summary>Answer</summary>

Designing the workload to detect failure and heal itself automatically, and having tested procedures for the failures it cannot absorb. It is the area that assumes failure will happen and asks what the system does next, rather than how likely the failure is.

</details>

### `rel-definition-lifecycle` · Reliability across the lifecycle

**Why does the reliability definition explicitly include operating and testing the workload, not just running it?**

<details><summary>Answer</summary>

Because a workload that only behaves correctly when nothing is being changed or exercised is not reliable in any useful sense. Including the total lifecycle puts deployment, testing, and day-to-day operation inside the reliability question, rather than treating reliability as a property of the running steady state alone.

</details>

### `rel-common-point-of-failure` · Common points of failure

**What is the trap when scaling horizontally for availability?**

<details><summary>Answer</summary>

Adding more instances that all depend on the same thing — one Availability Zone, one database, one control plane, one shared dependency. Horizontal scale only buys availability if the smaller resources genuinely do not share a common point of failure, which is a property you have to verify rather than assume.

</details>

### `rel-anticipate-vs-react` · Anticipating failure before it occurs

**What does 'anticipate and remediate failures before they occur' look like in practice?**

<details><summary>Answer</summary>

Monitoring leading indicators rather than only the breach itself, and letting automation act on the trend — replacing a host whose error rate is climbing, adding capacity as a queue grows, failing away from a degrading dependency. It is the most sophisticated end of automatic recovery, and it depends on having KPIs that move before customers notice.

</details>
## Performance Efficiency

### `perf-pillar` · Performance efficiency pillar

**What does the performance efficiency pillar cover, and what are its five best practice areas?**

<details><summary>Answer</summary>

Using cloud resources efficiently to meet performance requirements, and holding that efficiency as demand changes and technologies evolve. The five best practice areas are:

- Architecture selection
- Compute and hardware
- Data management
- Networking and content delivery
- Process and culture

The second half of the definition is the harder half: efficiency achieved once and never revisited decays.

</details>

### `perf-design-principles` · PERF design principles

**Name the five design principles for performance efficiency.**

<details><summary>Answer</summary>

- Democratize advanced technologies
- Go global in minutes
- Use serverless architectures
- Experiment more often
- Consider mechanical sympathy

</details>

### `perf-democratize` · Democratize advanced technologies

**What does 'democratize advanced technologies' actually ask you to do?**

<details><summary>Answer</summary>

Delegate the complex parts to your cloud vendor by consuming a technology as a service instead of asking your team to learn to host and run it. NoSQL databases, media transcoding, and machine learning are the given examples — all things that would otherwise demand specialized expertise before delivering any product value.

</details>

### `perf-go-global` · Go global in minutes

**What does this principle claim, and what makes it cheap?**

<details><summary>Answer</summary>

That deploying a workload into multiple AWS Regions gives customers lower latency and a better experience at minimal cost. The cost argument holds because you are provisioning in a new Region rather than building a presence there — the thing that used to make going global a capital project is exactly what the cloud removed.

</details>

### `perf-serverless` · Use serverless architectures

**What two benefits does the serverless principle claim?**

<details><summary>Answer</summary>

Removing the operational burden of running and maintaining physical servers for traditional compute — serverless storage can serve a static site with no web server, and event services can host code — and potentially lower transactional costs, because the managed services underneath operate at cloud scale.

</details>

### `perf-experiment` · Experiment more often

**Why does the cloud make performance experimentation cheap?**

<details><summary>Answer</summary>

Because the resources are virtual and automatable, so comparative testing across different instance types, storage options, and configurations is a matter of provisioning and tearing down rather than procurement. That changes performance tuning from an argument about which option is better into a test you can just run.

</details>

### `perf-mechanical-sympathy` · Consider mechanical sympathy

**What is mechanical sympathy in the Well-Architected sense?**

<details><summary>Answer</summary>

Understanding how a cloud service is actually consumed and choosing the technology approach that matches your workload's goals rather than the one that is most familiar. The canonical example is letting your data access patterns drive the database or storage choice, instead of picking the store first and forcing the access pattern to fit it.

</details>

### `perf-architecture-selection-area` · Architecture selection

**What does the architecture selection best practice area cover?**

<details><summary>Answer</summary>

Choosing the right combination of solutions and resources for the workload in the first place. It is where the framework checks that the high-level design was chosen against workload requirements and data, rather than inherited from a previous system or from what the team already knew.

</details>

### `perf-compute-area` · Compute and hardware

**What does the compute and hardware best practice area cover?**

<details><summary>Answer</summary>

Selecting and configuring the compute option that fits the workload — instance families and sizes, processor options, containers, or functions — and revisiting that choice as both the workload and the available hardware change.

</details>

### `perf-data-management-area` · Data management (PERF)

**What does the data management best practice area cover in the performance pillar?**

<details><summary>Answer</summary>

Choosing and configuring data stores against the workload's access patterns and performance requirements, including how data is stored, partitioned, cached, and moved. This is where mechanical sympathy is applied most directly.

</details>

### `perf-networking-area` · Networking and content delivery

**What does the networking and content delivery best practice area cover?**

<details><summary>Answer</summary>

The network path between users and the workload and between its components — topology, protocol and product selection, and edge caching and delivery. It covers both the latency users experience and the throughput components need from each other.

</details>

### `perf-process-culture-area` · Process and culture (PERF)

**What does the process and culture best practice area cover in the performance pillar?**

<details><summary>Answer</summary>

The habits that keep performance from decaying: reviewing choices regularly so the workload takes advantage of a continually evolving cloud, monitoring so any deviance from expected performance is noticed, and treating experimentation as routine rather than exceptional.

</details>

### `perf-data-driven` · A data-driven approach to performance

**What data does the performance pillar expect you to gather?**

<details><summary>Answer</summary>

Data on every level of the architecture, from the high-level design down to the selection and configuration of individual resource types. The point is that performance decisions at every altitude are evidence-based, and that monitoring keeps telling you whether the architecture still performs the way it did when you chose it.

</details>

### `perf-tradeoffs` · Performance trade-offs

**What trade-offs does the performance pillar explicitly endorse?**

<details><summary>Answer</summary>

Using compression, using caching, and relaxing consistency requirements — each of which gives up something real in exchange for performance. Naming them as trade-offs is the point: they are legitimate architectural moves, made deliberately against a requirement, not free wins.

</details>

## Cost Optimization

### `cost-pillar` · Cost optimization pillar

**What does the cost optimization pillar cover, and what are its five best practice areas?**

<details><summary>Answer</summary>

Running systems that deliver business value at the lowest price point. The five best practice areas are:

- Practice Cloud Financial Management
- Expenditure and usage awareness
- Cost-effective resources
- Manage demand and supply resources
- Optimize over time

</details>

### `cost-design-principles` · COST design principles

**Name the five design principles for cost optimization.**

<details><summary>Answer</summary>

- Implement Cloud Financial Management
- Adopt a consumption model
- Measure overall efficiency
- Stop spending money on undifferentiated heavy lifting
- Analyze and attribute expenditure

</details>

### `cost-cfm-principle` · Implement Cloud Financial Management

**Why is Cloud Financial Management framed as a capability to build rather than a task to do?**

<details><summary>Answer</summary>

Because it is treated exactly like security or operational excellence: a domain your organization has to build capability in through knowledge, programs, resources, and processes, with dedicated time and people. Cost efficiency is presented as an organizational competence, not a cleanup someone does at the end of the quarter.

</details>

### `cost-consumption-model` · Adopt a consumption model

**What does adopting a consumption model replace, and what is the standard example?**

<details><summary>Answer</summary>

It replaces elaborate forecasting with paying only for the resources you actually require and adjusting usage to business need. The canonical example is development and test environments, which are typically used eight hours a day on weekdays — stopping them the rest of the time is roughly a 75% saving, 40 hours against 168.

</details>

### `cost-measure-efficiency` · Measure overall efficiency

**What ratio does 'measure overall efficiency' ask you to track?**

<details><summary>Answer</summary>

The business output of the workload against the cost of delivering it. Tracking the ratio rather than the raw bill is what lets you tell the difference between spending more because you are serving more, and spending more because the workload got less efficient — and it is the only way to see the gain from increasing output as well as from cutting cost.

</details>

### `cost-undifferentiated-heavy-lifting` · Stop spending money on undifferentiated heavy lifting

**What counts as undifferentiated heavy lifting?**

<details><summary>Answer</summary>

Work that has to happen but does not distinguish your business: racking, stacking, and powering servers, which AWS absorbs, and the operational burden of managing operating systems and applications, which managed services absorb. Every hour spent there is an hour not spent on customers or business projects.

</details>

### `cost-attribute-expenditure` · Analyze and attribute expenditure

**What does attributing expenditure make possible?**

<details><summary>Answer</summary>

Identifying usage and cost per system accurately enough to attribute IT costs transparently to individual workload owners. That does two things: it makes return on investment measurable, and it gives the owners both the visibility and the incentive to optimize their own resources.

</details>

### `cost-cfm-area` · Practice Cloud Financial Management

**What does the Cloud Financial Management best practice area cover?**

<details><summary>Answer</summary>

Building and running the organizational capability itself — the people, programs, processes, and knowledge that make cost a managed dimension of engineering rather than a monthly surprise. It is the area that asks whether anyone owns cost at all.

</details>

### `cost-awareness-area` · Expenditure and usage awareness

**What does the expenditure and usage awareness best practice area cover?**

<details><summary>Answer</summary>

Knowing what is running, who is using it, and what it costs — the governance, tagging, monitoring, and reporting that make spend attributable. Without this area the other three optimization areas have nothing reliable to act on.

</details>

### `cost-effective-resources-area` · Cost-effective resources

**What does the cost-effective resources best practice area cover?**

<details><summary>Answer</summary>

Choosing the right services, resource types, and sizes, and the right pricing model, for what the workload actually needs. It is where over-provisioning and paying on-demand rates for steady-state usage get caught.

</details>

### `cost-demand-supply-area` · Manage demand and supply resources

**What does the manage demand and supply resources best practice area cover?**

<details><summary>Answer</summary>

Matching supplied capacity to actual demand rather than to a forecast peak — through scaling, buffering, and throttling. It is the architectural counterpart to the consumption-model principle: the workload has to be able to shrink, not merely be allowed to.

</details>

### `cost-optimize-over-time-area` · Optimize over time

**What does the optimize over time best practice area cover?**

<details><summary>Answer</summary>

Revisiting decisions as AWS releases new services, instance types, and pricing models, and as the workload's own usage changes. A choice that was cost-optimal at launch quietly stops being so, and this area is what makes re-evaluation a habit rather than an event.

</details>

### `cost-speed-vs-cost` · Speed-to-market versus cost

**When is it right to optimize for speed rather than cost?**

<details><summary>Answer</summary>

When going to market quickly, shipping a feature, or hitting a deadline is worth more than the spend — the framework is explicit that this is a legitimate trade-off, not a failure. The judgment is about which one the business needs at that moment, and about deciding it deliberately rather than by default.

</details>

### `cost-lift-and-shift` · Lift and shift, then optimize

**Is migrating first and optimizing afterwards a Well-Architected choice?**

<details><summary>Answer</summary>

Yes — the framework calls it a reasonable choice when you have to move resources from on-premises into the cloud. The caveat is that it deliberately defers optimization, so the deployment starts over-provisioned and under-optimized and someone has to actually come back to it.

</details>

### `cost-just-in-case` · Over-provisioning 'just in case'

**What causes 'just in case' over-provisioning, and what does it cost?**

<details><summary>Answer</summary>

Haste: design decisions made without data because benchmarking for the most cost-optimal deployment takes time nobody has. The result is over-provisioned and under-optimized deployments. Investing the right amount of effort in a cost strategy up front is what lets you realize the cloud's economics consistently rather than paying an ongoing tax for the shortcut.

</details>

## Sustainability

### `sus-pillar` · Sustainability pillar

**What does the sustainability pillar cover, and what are its six best practice areas?**

<details><summary>Answer</summary>

Continually reducing the environmental impact of running cloud workloads — primarily energy consumption and efficiency — by getting maximum benefit from what you provision and minimizing what you need at all. The six best practice areas are:

- Region selection
- Alignment to demand
- Software and architecture
- Data management
- Hardware and services
- Process and culture

</details>

### `sus-design-principles` · SUS design principles

**Name the six design principles for sustainability in the cloud.**

<details><summary>Answer</summary>

- Understand your impact
- Establish sustainability goals
- Maximize utilization
- Anticipate and adopt new, more efficient hardware and software offerings
- Use managed services
- Reduce the downstream impact of your cloud workloads

</details>

### `sus-understand-impact` · Understand your impact

**What has to be included when you measure a workload's impact?**

<details><summary>Answer</summary>

All sources of it — not just the running workload, but the impact of customers using your product and the impact of eventually decommissioning and retiring it. You compare productive output against total impact by looking at resources and emissions per unit of work, and use that to set KPIs and estimate what a proposed change would actually do.

</details>

### `sus-goals` · Establish sustainability goals

**What makes a good sustainability goal under this principle?**

<details><summary>Answer</summary>

A long-term, per-workload target expressed as intensity rather than a total — compute and storage required per transaction, or impact per user — so that growth results in reduced impact intensity instead of a number that rises with success. Goals also make regressions visible and give owners something to prioritize against.

</details>

### `sus-maximize-utilization` · Maximize utilization

**Why are two hosts at 30% utilization worse than one host at 60%?**

<details><summary>Answer</summary>

Because each host draws baseline power regardless of how much work it is doing, so spreading the same load across more machines pays that baseline twice. Right-sizing and efficient design push utilization up, and reducing idle resources, processing, and storage cuts the total energy the workload needs.

</details>

### `sus-new-offerings` · Anticipate and adopt new, more efficient offerings

**What does this principle require architecturally, not just operationally?**

<details><summary>Answer</summary>

Designing for flexibility, so new and more efficient hardware and software can be adopted rapidly when it appears. Continually monitoring and evaluating the offerings is the easy half; being able to move onto them without a rebuild is the part that has to be designed in.

</details>

### `sus-managed-services` · Use managed services (sustainability)

**Why do managed services reduce environmental impact rather than just operational effort?**

<details><summary>Answer</summary>

Because sharing services across a broad customer base drives utilization up, so less total infrastructure is needed to support the same workloads, and common data center components like power and networking are shared. The examples given are Fargate for serverless containers, S3 Lifecycle configurations moving cold data automatically, and EC2 Auto Scaling matching capacity to demand.

</details>

### `sus-downstream-impact` · Reduce the downstream impact of your cloud workloads

**What is downstream impact, and how do you find out what yours is?**

<details><summary>Answer</summary>

The energy and resources your customers spend to use your service, including whether using it pushes them to upgrade their devices. You estimate it by testing against device farms, and you learn the real figure by testing with actual customers — it is the one part of a workload's impact that does not appear anywhere on your own bill.

</details>

### `sus-region-selection-area` · Region selection

**What does the region selection best practice area cover?**

<details><summary>Answer</summary>

Where you place a workload, judged partly on the sustainability characteristics of the Region alongside the usual latency, cost, and data residency constraints. It is listed first because it is a placement decision that sets a floor on everything else you can achieve.

</details>

### `sus-alignment-to-demand-area` · Alignment to demand

**What does the alignment to demand best practice area cover?**

<details><summary>Answer</summary>

Provisioning only what current demand requires and shrinking when it falls — scaling, scheduling, and eliminating idle capacity. It is the same mechanism cost optimization uses, pointed at energy consumed rather than money spent.

</details>

### `sus-software-architecture-area` · Software and architecture

**What does the software and architecture best practice area cover?**

<details><summary>Answer</summary>

The efficiency of what you build: the programming language chosen, the algorithms used, and the architectural patterns that determine how much computation a unit of work actually costs. Efficiency here compounds, because it reduces the resources every other area then has to provision.

</details>

### `sus-data-area` · Data management (SUS)

**What does the data management best practice area cover in the sustainability pillar?**

<details><summary>Answer</summary>

Storing data efficiently and no longer than it is useful — storage class and lifecycle policy, deduplication and compression, retention, and deleting what nothing reads. Data is the part of a workload that accumulates silently, so this is where impact grows without anyone deciding to grow it.

</details>

### `sus-hardware-services-area` · Hardware and services

**What does the hardware and services best practice area cover?**

<details><summary>Answer</summary>

Choosing the most efficient hardware and services for the work, and adopting more efficient options as they appear — using instance types matched to the workload, and preferring managed services whose shared utilization is higher than anything you would run yourself.

</details>

### `sus-process-culture-area` · Process and culture (SUS)

**What does the process and culture best practice area cover in the sustainability pillar?**

<details><summary>Answer</summary>

The team habits that keep improvement continuous: measuring impact as a matter of course, testing and adopting more efficient approaches, and treating sustainability as a design consideration during development and deployment rather than a report produced afterwards.

</details>
