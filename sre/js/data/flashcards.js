// js/data/flashcards.js
// Flashcard deck covering core SRE vocabulary and concepts spanning all six
// exam domains (see js/data/examInfo.js and js/data/studyContent.js).
// Grounded in Google's Site Reliability Engineering book and the SRE
// Workbook, cached under .cache/aws-docs/ during authoring; written in
// original prose, not copied verbatim. The field is still named `service`
// for schema/validator compatibility with the copied validate-content.mjs,
// even though these are SRE concepts rather than AWS services.
// Canonical domain buckets for this deck. Every card's `domain` must be one
// of these (enforced by scripts/validate-content.mjs); the Anki export
// derives its hierarchical tags from them.
export const FLASHCARD_DOMAINS = [
  'SLIs, SLOs & Error Budgets',
  'Monitoring, Observability & Alerting',
  'Incident Response, On-Call & Postmortems',
  'Capacity Planning & Managing Load',
  'Release Engineering & Change Management',
  'Reliability Patterns & Toil Reduction',
];

export const FLASHCARDS = [
  // ---------------------------------------------------------------------
  // SLIs, SLOs & Error Budgets
  // ---------------------------------------------------------------------
  {
    id: 'sli',
    service: 'SLI (Service Level Indicator)',
    domain: 'SLIs, SLOs & Error Budgets',
    front: 'What is an SLI, and why is it usually expressed as a ratio?',
    back: 'A precise, quantitative measurement of one aspect of a service, such as request latency or the fraction of requests that succeeded, rather than a vague sense of health. Expressing it as good events over total events keeps every SLI on the same 0-to-100 scale, which makes targets and tooling comparable across very different services.',
  },
  {
    id: 'slo',
    service: 'SLO (Service Level Objective)',
    domain: 'SLIs, SLOs & Error Budgets',
    front: 'What is an SLO, and how does it relate to an SLI?',
    back: "An SLO attaches a target to an SLI over a time window, such as '99.9% of requests succeed over a rolling 28 days.' It turns a raw measurement into a concrete promise that both the team and its users can plan around, and it is the number an error budget is derived from.",
  },
  {
    id: 'sla',
    service: 'SLA (Service Level Agreement)',
    domain: 'SLIs, SLOs & Error Budgets',
    front: 'How does an SLA differ from an ordinary SLO?',
    back: "An SLA is an SLO wrapped in a contract: missing the target triggers a formal, usually financial, consequence for the provider, whereas an internal SLO miss only triggers an internal response. Teams typically set the SLO target tighter than the SLA target, so an SLO miss gives an early warning before the SLA is actually breached.",
  },
  {
    id: 'sli-spec-vs-implementation',
    service: 'SLI specification vs. implementation',
    domain: 'SLIs, SLOs & Error Budgets',
    front: "What is the difference between an SLI's specification and its implementation?",
    back: "The specification is what you want to measure, such as 'the fraction of home-page loads that felt fast.' The implementation is how you actually measure it, such as reading load-balancer logs versus timing the page in a browser. The same specification can have several competing implementations, and measuring closer to the user usually produces a more faithful implementation.",
  },
  {
    id: 'error-budget',
    service: 'Error budget',
    domain: 'SLIs, SLOs & Error Budgets',
    front: 'What is an error budget?',
    back: "The allowed amount of unreliability over an SLO window. It reframes reliability as a spendable resource shared between the team shipping features and the team keeping things stable, rather than a separate goal to chase in isolation.",
  },
  {
    id: 'error-budget-formula',
    service: 'Error budget',
    domain: 'SLIs, SLOs & Error Budgets',
    front: "How is an error budget's size calculated from its SLO?",
    back: "It's calculated as 100% minus the SLO target — for example, an SLO of 99.9% over 28 days leaves an error budget of the remaining 0.1% of requests allowed to fail.",
  },
  {
    id: 'error-budget-policy',
    service: 'Error budget policy',
    domain: 'SLIs, SLOs & Error Budgets',
    front: 'What does an error budget policy do once the budget runs out?',
    back: "A pre-agreed, written document that spells out what happens when a service exhausts its error budget for the window — commonly freezing all further feature launches and non-critical releases until reliability recovers back above the target line, with narrow exceptions carved out for urgent fixes and security patches. Having it agreed in advance keeps the response from becoming a political argument in the middle of a bad month.",
  },
  {
    id: 'burn-rate',
    service: 'Burn rate',
    domain: 'SLIs, SLOs & Error Budgets',
    front: 'What does a burn rate of 1 mean, versus a burn rate of 10?',
    back: "How fast a service is consuming its error budget relative to a steady, sustainable pace. A burn rate of 1 means the service will land at exactly zero budget right at the end of the SLO window if the current error rate holds; a burn rate of 10 means the same budget would be exhausted in one-tenth of the window, which is the kind of fast, dangerous spend that alerting wants to catch quickly.",
  },
  {
    id: 'burn-rate-alerting',
    service: 'Error budget burn-rate alerting',
    domain: 'SLIs, SLOs & Error Budgets',
    front: 'Why do production burn-rate alerts typically check more than one time window?',
    back: "A single fixed window forces a trade-off between catching fast burns quickly and not missing slower ones: a short window pages fast but misses slow leaks, and a long window catches slow leaks but is slow to page on a sharp spike. Multiwindow, multi-burn-rate alerting layers a short and a long window together (a common combination pages on a 14.4x burn sustained over both the last hour and the last five minutes) so both failure shapes are covered without either flooding on-call or missing real trouble.",
  },
  {
    id: 'availability-aggregate',
    service: 'Aggregate (request-based) availability',
    domain: 'SLIs, SLOs & Error Budgets',
    front: 'How does request-based availability differ from simple uptime?',
    back: 'Time-based uptime asks whether the service was up or down at a given moment, treating every minute equally regardless of traffic. Aggregate, request-based availability instead divides successful requests by total requests over a window, so an outage during a high-traffic hour counts for more than the same outage during a quiet one — a better match for what users actually experienced.',
  },
  {
    id: 'nines',
    service: 'Nines (availability)',
    domain: 'SLIs, SLOs & Error Budgets',
    front: "What does it mean for a service to have '4 nines' of availability?",
    back: "Industry shorthand for how many nines appear in the availability percentage: 99% is '2 nines,' 99.99% is '4 nines,' and so on. Each additional nine represents a shrinking, and increasingly expensive, sliver of allowed downtime, since 100% availability is never actually achievable.",
  },
  {
    id: 'cost-of-the-next-nine',
    service: 'Choosing a reliability target',
    domain: 'SLIs, SLOs & Error Budgets',
    front: 'Why is chasing an extra nine of reliability usually a bad default goal?',
    back: 'Each additional nine costs disproportionately more than the last one, both in engineering effort and in redundant infrastructure, while for most consumer-facing products users cannot even perceive the difference between, say, 99.99% and 99.999% availability. The SRE approach is to pick a target that matches what users actually need and can perceive, not the highest number achievable.',
  },
  {
    id: 'slo-floor-and-ceiling',
    service: 'SLO target as a floor and a ceiling',
    domain: 'SLIs, SLOs & Error Budgets',
    front: 'Why should a team avoid running a service well above its SLO target for long stretches?',
    back: "An SLO is meant to be treated as both a floor (don't drop below it) and a ceiling (don't consistently blow far past it either), because users and dependent systems quietly start relying on the better-than-promised reliability they actually observe. That informal expectation can make a later, deliberate return to the published target feel like an outage even though the SLO itself was never breached.",
  },
  {
    id: 'durability',
    service: 'Durability',
    domain: 'SLIs, SLOs & Error Budgets',
    front: 'How is durability different from availability for a storage system?',
    back: "Durability is the likelihood that data written today can still be read back correctly much later, as distinct from availability, which is about whether the system can serve a request right now. A storage system can have excellent aggregate durability numbers while still losing the one slice of data a particular user actually cares about, so durability SLIs need to be scoped carefully to what users will notice.",
  },
  {
    id: 'rolling-vs-calendar-window',
    service: 'Rolling window vs. calendar-aligned window',
    domain: 'SLIs, SLOs & Error Budgets',
    front: 'What is the practical difference between a rolling SLO window and a calendar-aligned one?',
    back: "A rolling window (for example, a trailing 28 days) tracks closer to how users actually experience a service, since a bad outage doesn't simply vanish the moment a new calendar month begins. A calendar-aligned window (a fixed month or quarter) instead lines up with business planning cycles like headcount and roadmap reviews, at the cost of a sudden reset that can hide recent pain.",
  },

  // ---------------------------------------------------------------------
  // Monitoring, Observability & Alerting
  // ---------------------------------------------------------------------
  {
    id: 'four-golden-signals',
    service: 'The four golden signals',
    domain: 'Monitoring, Observability & Alerting',
    front: 'What are the four golden signals of monitoring?',
    back: 'Latency, traffic, errors, and saturation. If a team can only instrument four things about a user-facing system, these four give the broadest possible coverage of what is likely to be going wrong, and are the natural anchor for a top-level dashboard.',
  },
  {
    id: 'saturation-signal',
    service: 'Saturation',
    domain: 'Monitoring, Observability & Alerting',
    front: 'Why is saturation not just "CPU percentage"?',
    back: "Saturation is how full a service is relative to the resource that will constrain it first, which is often memory, an open-connection limit, or a queue depth rather than raw CPU. A service can look fine on CPU while a different resource is quietly approaching its ceiling, so a good saturation signal has to be picked per system rather than assumed to be one generic metric.",
  },
  {
    id: 'black-box-monitoring',
    service: 'Black-box monitoring',
    domain: 'Monitoring, Observability & Alerting',
    front: 'What does black-box monitoring test, and what is it best used for?',
    back: "Black-box monitoring probes a system from the outside the same way a user would, without any knowledge of its internals, so it tells you whether something is actively broken right now. It is well suited to paging a human, because by design it only fires on real, currently-occurring symptoms rather than on internal conditions that may or may not turn into a user-visible problem.",
  },
  {
    id: 'white-box-monitoring',
    service: 'White-box monitoring',
    domain: 'Monitoring, Observability & Alerting',
    front: 'What does white-box monitoring add that black-box monitoring cannot see?',
    back: "White-box monitoring inspects a system's internals — logs, exported metrics, instrumented code paths — which lets it detect imminent problems, failures that are being silently masked by retries, and give the detailed context needed for debugging. Whether a given white-box signal is a symptom or a cause depends on which layer of a multilayered system is looking at it.",
  },
  {
    id: 'metrics-vs-logs',
    service: 'Metrics vs. logs',
    domain: 'Monitoring, Observability & Alerting',
    front: 'What are metrics and logs each best suited for?',
    back: "Metrics are compact numeric time series that are cheap to store and query, making them ideal for dashboards, alerting, and spotting trends. Logs carry rich, per-event detail that metrics discard, which makes them the right tool for the deep-dive investigation that follows once an alert or a dashboard has already pointed at roughly where to look.",
  },
  {
    id: 'playbook',
    service: 'Playbook',
    domain: 'Monitoring, Observability & Alerting',
    front: 'What is a playbook, and why does SRE practice pair one with every alert?',
    back: "A playbook is a written, linked-from-the-alert guide that explains an alert's severity and likely impact and lays out debugging steps and mitigations. Because a stressed, half-awake on-call engineer working from memory is slower and more error-prone than one following a checklist, pairing every alert with a playbook measurably cuts down both response time and the risk of a mistake made under pressure.",
  },
  {
    id: 'symptom-vs-cause-paging',
    service: 'Paging on symptoms, not causes',
    domain: 'Monitoring, Observability & Alerting',
    front: 'Why does good alerting philosophy favor paging on symptoms over paging on causes?',
    back: "A page should mean a human needs to act now on something users are actually feeling; causes are numerous, often self-correcting, and paging on every one of them trains on-call engineers to ignore pages. Reserving pages for confirmed, user-visible symptoms and routing everything else to lower-urgency channels like a ticket keeps the signal-to-noise ratio high enough that a page is still taken seriously when it fires.",
  },
  {
    id: 'dashboards',
    service: 'Dashboards',
    domain: 'Monitoring, Observability & Alerting',
    front: 'Why should a dashboard be treated as an interface rather than a data store?',
    back: 'A dashboard is a view onto data that lives elsewhere in a monitoring system, not the authoritative record itself, so it should stay focused on answering a specific question at a glance rather than accumulating every metric someone once found interesting. A cluttered dashboard that tries to be everything ends up being useless during an actual incident, when speed of comprehension matters most.',
  },
  {
    id: 'mttr',
    service: 'MTTR',
    domain: 'Monitoring, Observability & Alerting',
    front: 'What is MTTR, and what is one of the most effective levers for shortening it?',
    back: "MTTR is the mean time to repair (sometimes 'recovery'): the average time from when a problem starts affecting users to when it is fully resolved. Well-maintained, alert-specific playbooks are one of the more reliable levers for shortening it, since they replace improvised debugging with a known-good sequence of steps.",
  },
  {
    id: 'mtbf',
    service: 'MTBF',
    domain: 'Monitoring, Observability & Alerting',
    front: 'What does MTBF measure, and how is that different from what MTTR measures?',
    back: "MTBF is the average stretch of working time between one failure and the next — a measure of how rarely a system breaks in the first place. MTTR measures something else: once a failure has happened, how long it takes to detect, diagnose, and fully resolve it. A system can have a great MTBF but a terrible MTTR, or the reverse, because the two describe different halves of an incident's timeline — how often it happens, and how fast it's handled once it does.",
  },
  {
    id: 'low-traffic-burn-rate-alerting',
    service: 'Burn-rate alerting on low-traffic services',
    domain: 'Monitoring, Observability & Alerting',
    front: 'Why does burn-rate alerting break down for low-traffic services?',
    back: "With very few requests per hour, a single failed request can represent a huge instantaneous error rate and trigger a page-worthy burn rate on its own, even though it may just be an isolated, uninteresting failure. Low-traffic and very-high-reliability services generally need a different alerting approach, such as longer windows or absolute failure counts, rather than the standard multiwindow burn-rate formula.",
  },
  {
    id: 'time-series-to-page',
    service: 'From a time series to a page',
    domain: 'Monitoring, Observability & Alerting',
    front: 'What has to be true before a monitoring rule should be allowed to page a human?',
    back: "A good alerting rule should only fire when the condition is genuinely urgent, actionable, and something only a human can currently fix — otherwise it belongs in a lower-urgency channel like a ticket, or should be automated away entirely. Running every proposed new alert through that checklist before turning it on is what keeps a paging system trustworthy over time.",
  },
  {
    id: 'observability-time-horizons',
    service: 'Two clocks of observability',
    domain: 'Monitoring, Observability & Alerting',
    front: 'Why does an observability strategy need both a fast clock and a slow one?',
    back: 'Near-real-time monitoring and alerting operate on the timescale of minutes, catching things that need action right now, while longer-term trend analysis over weeks or months surfaces slow capacity creep or gradual regressions that no single alert would ever fire on. A system that only watches the fast clock will still get blindsided by problems that build up gradually.',
  },

  // ---------------------------------------------------------------------
  // Incident Response, On-Call & Postmortems
  // ---------------------------------------------------------------------
  {
    id: 'on-call',
    service: 'On-call',
    domain: 'Incident Response, On-Call & Postmortems',
    front: 'What determines a reasonable on-call response time target?',
    back: "The response time an on-call rotation commits to should be derived from the service's SLO and error budget, not from habit or gut feel — a service with a tight budget and a short window to react needs a faster guaranteed response than one with a generous budget. Setting the target this way keeps the on-call commitment tied to something the business actually agreed to.",
  },
  {
    id: 'escalation',
    service: 'Escalation',
    domain: 'Incident Response, On-Call & Postmortems',
    front: 'Why does a healthy on-call setup need a clear escalation path?',
    back: 'A single on-call engineer can be unavailable, overloaded, or simply out of their depth on a given problem, so a defined path to pull in a secondary, a manager, or a partner development team keeps an incident from stalling on one person. Escalating is a normal, expected part of incident response, not a sign that the primary on-call engineer failed.',
  },
  {
    id: 'incident-commander',
    service: 'Incident commander',
    domain: 'Incident Response, On-Call & Postmortems',
    front: "What is the incident commander's role during a live incident?",
    back: "The incident commander is the one person who keeps the overall picture of the incident in their head, structures the response by assigning the other roles, and by default personally covers any role they have not explicitly delegated to someone else. They do not necessarily do the hands-on technical work themselves; their job is coordination, prioritization, and removing roadblocks for the people who are.",
  },
  {
    id: 'operations-lead',
    service: 'Operations lead',
    domain: 'Incident Response, On-Call & Postmortems',
    front: 'What does the operations lead do during an incident, and who else can touch the system?',
    back: "The operations lead works with the incident commander to apply the actual operational fixes to the system under the direction of the incident response. During a well-run incident, the operations team is meant to be the only group actively modifying the system, so changes stay coordinated instead of colliding with each other.",
  },
  {
    id: 'communications-lead',
    service: 'Communications lead',
    domain: 'Incident Response, On-Call & Postmortems',
    front: 'What is the communications lead responsible for during an incident?',
    back: 'The communications lead is the one voice speaking externally for the whole response effort, issuing periodic status updates to stakeholders and the wider response team and keeping the living incident document accurate and current. Centralizing communication in one role frees the people actually fixing the problem from having to field a stream of individual status requests.',
  },
  {
    id: 'planning-lead',
    service: 'Planning lead',
    domain: 'Incident Response, On-Call & Postmortems',
    front: 'What does the planning lead handle that the other incident roles do not?',
    back: 'The planning lead supports operations by handling the longer-term logistics of a drawn-out incident: filing follow-up bugs, arranging handoffs and food for a long-running response, and tracking exactly how the system has diverged from normal so those changes can be cleanly reverted once the incident ends.',
  },
  {
    id: 'incident-document',
    service: 'Incident document',
    domain: 'Incident Response, On-Call & Postmortems',
    front: "What is a living incident document, and why doesn't it need to be tidy?",
    back: "A shared, concurrently editable document that the incident commander (via the communications lead) keeps updated in real time with the current summary, status, command hierarchy, and a chronological log of what has been tried. It is expected to be messy in the moment — the priority is that it stays functional and current, not polished, since it also becomes the raw material for the postmortem afterward.",
  },
  {
    id: 'incident-command-system',
    service: 'Incident Command System (ICS)',
    domain: 'Incident Response, On-Call & Postmortems',
    front: "What is the Incident Command System, and why did Google's incident management borrow from it?",
    back: "ICS is a standardized emergency-response framework originally developed for firefighting and other large-scale civil emergencies, prized for how clearly it defines roles and how well it scales from a small incident to a huge one. Google's incident management process is explicitly modeled on it, reusing the same idea of a single commander delegating clearly named roles rather than inventing a bespoke scheme from scratch.",
  },
  {
    id: 'war-room',
    service: 'War room / command post',
    domain: 'Incident Response, On-Call & Postmortems',
    front: 'What purpose does a designated command post serve during an incident?',
    back: "A single, well-known place — physical or virtual, such as a chat channel — where anyone involved in or curious about the incident knows they can reach the incident commander and the rest of the response team. Without one, interested parties waste time guessing where coordination is actually happening, and the response team wastes time fielding the same questions in scattered channels.",
  },
  {
    id: 'mitigate-first',
    service: 'Mitigate first, understand second',
    domain: 'Incident Response, On-Call & Postmortems',
    front: 'Why does incident response prioritize mitigating impact over fully understanding root cause?',
    back: 'Restoring service for users is the most urgent goal during an active incident, and a fix that stops the bleeding — such as a rollback or failover — can often be applied well before the team fully understands why the system broke in the first place. Chasing complete root-cause understanding before acting can leave users in a broken state far longer than necessary.',
  },
  {
    id: 'blameless-postmortem',
    service: 'Blameless postmortem',
    domain: 'Incident Response, On-Call & Postmortems',
    front: 'What makes a postmortem blameless, and why does that matter?',
    back: "A blameless postmortem focuses on the systemic and contributing causes of an incident without singling out any individual or team for blame, on the assumption that everyone involved acted reasonably given the information they had at the time. A culture that punishes people for incidents teaches them to hide problems instead of surfacing them, which quietly makes the organization less reliable over time.",
  },
  {
    id: 'postmortem-action-item',
    service: 'Postmortem action item',
    domain: 'Incident Response, On-Call & Postmortems',
    front: 'What is a postmortem action item, and what happens to it after the postmortem is written?',
    back: "A concrete, trackable follow-up task — usually filed as its own bug with an owner and a priority — meant to address a contributing cause or a gap the incident exposed, such as a missing alert or a manual step that should be automated. A postmortem is not considered done once the narrative is written; it is done once its action items are tracked to completion.",
  },
  {
    id: 'postmortem-trigger',
    service: 'When a postmortem is required',
    domain: 'Incident Response, On-Call & Postmortems',
    front: 'What kinds of events typically require a postmortem, beyond a full outage?',
    back: "Common triggers include a user-visible outage above some severity threshold, an SLO-impacting event that burns a significant slice of the error budget, a data loss incident, or even a near-miss that was caught only by luck. Writing postmortems for near-misses, not just full outages, is what lets an organization learn from close calls before they become real ones.",
  },

  // ---------------------------------------------------------------------
  // Capacity Planning & Managing Load
  // ---------------------------------------------------------------------
  {
    id: 'load-balancer-l4-l7',
    service: 'Load balancer (L4 vs. L7)',
    domain: 'Capacity Planning & Managing Load',
    front: 'What is the practical difference between an L4 and an L7 load balancer?',
    back: "An L4 (transport-layer) load balancer distributes connections based on IP address and port alone, without looking at the data being sent, which makes it fast and protocol-agnostic. An L7 (application-layer) load balancer parses the actual request — HTTP headers, path, cookies — and can route on that content, enabling smarter decisions at the cost of doing more work per request.",
  },
  {
    id: 'dns-load-balancing',
    service: 'DNS load balancing',
    domain: 'Capacity Planning & Managing Load',
    front: 'What is DNS load balancing?',
    back: 'The simplest layer of load balancing: returning multiple IP addresses for a name and letting the client pick one, which spreads load before a connection is even opened.',
  },
  {
    id: 'dns-load-balancing-reply-limit',
    service: 'DNS load balancing',
    domain: 'Capacity Planning & Managing Load',
    front: 'What size limit caps how many backend addresses a single DNS reply can advertise?',
    back: "As the SRE book's frontend load-balancing chapter points out, a classic DNS reply is bound by RFC 1035's 512-byte limit, which caps how many addresses can be squeezed into a single reply — almost always far fewer than the real number of backend servers — so DNS alone is never sufficient on its own.",
  },
  {
    id: 'demand-forecasting',
    service: 'Demand forecasting',
    domain: 'Capacity Planning & Managing Load',
    front: 'Why does capacity planning treat a demand forecast as something to validate, not just trust?',
    back: "A forecast built from historical growth trends can be quietly wrong — organic growth can be outpaced by a viral spike, a new feature launch, or a one-off event — so capacity plans built on an untested forecast can leave a service dangerously under-provisioned. Regularly checking forecasted numbers against actual load, and load-testing against the forecast, is what turns a guess into something safe to plan around.",
  },
  {
    id: 'n-plus-2-redundancy',
    service: 'N+2 redundancy',
    domain: 'Capacity Planning & Managing Load',
    front: 'What does N+2 provisioning protect against that N+1 does not?',
    back: "N+2 means provisioning enough spare capacity to absorb the loss of two units of capacity at once — for example, one datacenter down for planned maintenance while a second suffers an unplanned outage — and still serve peak load. N+1 only covers a single simultaneous failure, which is not enough headroom for the realistic case of a planned event colliding with an unplanned one.",
  },
  {
    id: 'criticality-levels',
    service: 'Criticality levels',
    domain: 'Capacity Planning & Managing Load',
    front: 'What are the four criticality tiers used to decide whose requests survive an overload?',
    back: 'From most to least protected: CRITICAL_PLUS for requests whose failure causes serious user-visible impact, CRITICAL as the default for production traffic, SHEDDABLE_PLUS for traffic that can tolerate partial unavailability (typically batch jobs), and SHEDDABLE for traffic where even full unavailability is acceptable. When a backend is overloaded, it sheds the lowest tiers first, preserving capacity for the traffic that matters most.',
  },
  {
    id: 'adaptive-throttling',
    service: 'Adaptive throttling',
    domain: 'Capacity Planning & Managing Load',
    front: 'How does client-side adaptive throttling decide when to back off, without any server coordination?',
    back: "Each client tracks its own recent history of requests sent versus requests accepted, and once a backend starts rejecting a meaningful share of its traffic, the client begins proactively rejecting some requests locally before they are even sent. Because the decision is made purely from local information, it needs no extra coordination or added latency, and in aggregate it settles into a stable rate of roughly one rejected request for every one actually processed under heavy overload.",
  },
  {
    id: 'retry-budget',
    service: 'Retry budget',
    domain: 'Capacity Planning & Managing Load',
    front: 'What problem does a retry budget solve?',
    back: 'Naive retries on failure can compound an overload into something much worse, since each failing request triggers more requests instead of fewer. Capping retries with a server-wide budget — for example, at most 60 retries per minute — contains that amplification, turning what could become a global cascading failure into a bounded number of dropped requests instead.',
  },
  {
    id: 'graceful-degradation-vs-load-shedding',
    service: 'Graceful degradation vs. load shedding',
    domain: 'Capacity Planning & Managing Load',
    front: 'How does graceful degradation differ from load shedding?',
    back: "Graceful degradation means doing less work per request under load — returning a cached or lower-fidelity result instead of the full computation — so the service keeps answering, just with reduced quality. Load shedding means refusing to do the work at all for some requests, rejecting them outright to protect capacity for the ones that are served. Both trade something away, but degradation preserves a response while shedding does not.",
  },
  {
    id: 'deadline-propagation',
    service: 'Deadline propagation',
    domain: 'Capacity Planning & Managing Load',
    front: 'What problem does deadline propagation solve in a multi-hop RPC chain?',
    back: "Without it, each server in a call chain might invent its own timeout for downstream calls, so a request can keep consuming resources deep in the stack long after the original caller has already given up on it. With deadline propagation, one absolute deadline is set at the top of the stack and passed down, shrinking at each hop, so every server in the chain knows exactly how much time is actually left and can abandon doomed work immediately.",
  },
  {
    id: 'cascading-failure',
    service: 'Cascading failure',
    domain: 'Capacity Planning & Managing Load',
    front: 'What is a cascading failure, and what usually triggers the first domino?',
    back: 'A failure that grows over time through positive feedback: part of a system fails, which increases load on the remaining healthy parts, which makes more of them fail in turn, and so on. Overload is by far the most common trigger — a service that was healthy at one traffic level starts crashing at a higher one, and simply dropping load back to the original level is often not enough to recover, since the surviving capacity has already shrunk.',
  },
  {
    id: 'nalsd',
    service: 'Non-Abstract Large System Design (NALSD)',
    domain: 'Capacity Planning & Managing Load',
    front: 'What is NALSD, and why does the process insist on concrete numbers rather than staying abstract?',
    back: "NALSD is an iterative system-design skill: start from a problem statement, gather requirements, and repeatedly refine a design — sizing it in real machines, real QPS, real storage — until it holds up under both normal load and realistic failure scenarios. Working in concrete numbers instead of hand-waving forces early, often-wrong assumptions out into the open, where they can be checked and corrected rather than silently baked into a design that only looks sound.",
  },

  // ---------------------------------------------------------------------
  // Release Engineering & Change Management
  // ---------------------------------------------------------------------
  {
    id: 'hermetic-build',
    service: 'Hermetic build',
    domain: 'Release Engineering & Change Management',
    front: 'What does it mean for a build to be hermetic?',
    back: "A hermetic build is insensitive to whatever happens to be installed on the machine that runs it, because it depends only on pinned, known versions of its own tools and libraries rather than reaching out to the ambient environment. Building the same revision on two different machines is guaranteed to produce identical output, which is what makes releases reproducible and auditable after the fact.",
  },
  {
    id: 'config-as-code',
    service: 'Config-as-code',
    domain: 'Release Engineering & Change Management',
    front: 'Why treat configuration the same way as application code, with review and version control?',
    back: 'A misconfigured flag or limit is just as capable of causing an outage as a bad code change, so config-as-code applies the same discipline — checked into version control, code-reviewed, tested, and rolled out gradually — to configuration that used to be edited by hand in production. That symmetry closes off one of the most common ways teams historically shipped risk without going through any of their usual safety checks.',
  },
  {
    id: 'canary-release',
    service: 'Canary release',
    domain: 'Release Engineering & Change Management',
    front: 'Why is a canary release best thought of as an A/B test rather than just a safety net?',
    back: "A canary sends a new release to a small slice of production traffic first and compares its key metrics directly against the still-running old version, which is a genuine controlled comparison, not just a smaller blast radius in case something goes wrong. That framing is what makes it possible to say with real confidence whether the new version is actually behaving differently, not just to hope it isn't.",
  },
  {
    id: 'progressive-rollout',
    service: 'Release rollout',
    domain: 'Release Engineering & Change Management',
    front: 'What happens after a canary stage passes?',
    back: 'A progressive rollout continues expanding a release in a sequence of increasingly larger stages beyond the initial canary — for example, one datacenter, then one region, then everywhere — checking health at each step before proceeding further. It keeps the blast radius of any newly discovered problem bounded all the way through the rollout, not just at the very first, smallest stage.',
  },
  {
    id: 'rollback',
    service: 'Rollback',
    domain: 'Release Engineering & Change Management',
    front: 'Why does incident response generally favor rolling back first and diagnosing afterward?',
    back: "Reverting to the last known-good version is usually the fastest way to restore service, and it does not require first understanding exactly what went wrong — it only requires knowing that the new version is implicated. Diagnosing root cause can then happen calmly afterward, using the preserved bad version and its logs, without users continuing to suffer while the investigation is underway.",
  },
  {
    id: 'rollout-detection-rollback',
    service: 'Automating rollout, detection, and rollback',
    domain: 'Release Engineering & Change Management',
    front: 'Why automate the rollout-detection-rollback loop instead of relying on a human watching a dashboard?',
    back: 'A human watching metrics during a rollout is slower and less consistent than an automated system that compares canary metrics against a threshold and reverts the moment they cross it. Automating the whole loop — push a stage, watch for a regression, roll back automatically on one — shrinks the window between a bad release going out and it being undone, without depending on someone being alert at the right moment.',
  },
  {
    id: 'self-service-releases',
    service: 'Self-service releases',
    domain: 'Release Engineering & Change Management',
    front: 'What is the case for making releases self-service rather than routed through a dedicated release team?',
    back: "When product teams can build, test, and push their own releases through a standardized, guardrailed pipeline, they ship faster and the release process scales with the number of teams rather than being bottlenecked on a small central team's calendar. The guardrails — review, canarying, automated rollback — are what make removing that human gatekeeper safe rather than reckless.",
  },
  {
    id: 'config-design-fewer-knobs',
    service: 'Configuration design: fewer knobs, smarter defaults',
    domain: 'Release Engineering & Change Management',
    front: "Why does good configuration-system design favor fewer knobs and smarter defaults over exposing every option?",
    back: 'Every exposed configuration knob is a place where an operator can make a mistake, and the number of possible mistakes grows with the number of knobs. Picking sensible defaults and only exposing the settings that genuinely need to vary between deployments shrinks that surface area, at the cost of some flexibility for the rare case that truly needs it.',
  },
  {
    id: 'release-engineering-discipline',
    service: 'Release engineering as a discipline',
    domain: 'Release Engineering & Change Management',
    front: 'Why does release engineering warrant being its own discipline, separate from software engineering?',
    back: 'Building and shipping software reliably at scale — consistent builds, config management, deployment tooling, rollback paths — requires a distinct, deep set of expertise from writing the software itself, and treating it as a first-class specialty rather than an afterthought is what keeps releases from being the single riskiest thing a team does.',
  },
  {
    id: 'guardrails',
    service: 'Release guardrails',
    domain: 'Release Engineering & Change Management',
    front: 'What kinds of guardrails typically wrap a release pipeline?',
    back: 'Mandatory code review before a change can ship, access controls on who can trigger a production push, and an automatically generated change report showing exactly what is different between the current and proposed release. Together they make a release auditable and give a reviewer a real chance to catch a problem before it reaches users, without requiring every release to be manually walked through step by step.',
  },

  // ---------------------------------------------------------------------
  // Reliability Patterns & Toil Reduction
  // ---------------------------------------------------------------------
  {
    id: 'toil',
    service: 'Toil',
    domain: 'Reliability Patterns & Toil Reduction',
    front: 'What makes work "toil" rather than just work someone dislikes doing?',
    back: "Toil describes hands-on production work with six telltale traits: it's manual, it repeats, a machine could in principle do it just as well, it's reactive rather than planned, it leaves nothing of lasting value behind, and its total volume grows in step with the size of the service. Disliking a task does not make it toil, and a task done for the first time is not toil either — toil specifically describes recurring work that could, in principle, be engineered away.",
  },
  {
    id: 'automation-hierarchy',
    service: 'Hierarchy of automation',
    domain: 'Reliability Patterns & Toil Reduction',
    front: 'What is the highest rung on the hierarchy of automation, above having a good automation script?',
    back: "The hierarchy runs from no automation, to an ad hoc script one person maintains, to a generic externally maintained tool, to automation shipped inside the system itself, and finally to a system engineered so well that it needs no automation at all because it handles the failure mode natively. The best outcome is not a great external script — it's redesigning the system so the operational problem the script solved simply stops existing.",
  },
  {
    id: 'accidental-vs-essential-complexity',
    service: 'Accidental vs. essential complexity',
    domain: 'Reliability Patterns & Toil Reduction',
    front: 'What is the difference between essential and accidental complexity, and why does it matter for SREs?',
    back: 'Essential complexity is inherent to the problem itself and cannot be removed no matter how good the engineering is; accidental complexity is extra difficulty introduced by a particular implementation choice and can be engineered away. Because accidental complexity is the kind a team actually controls, pushing back on it wherever it creeps into a system is a direct, ongoing lever for keeping that system reliable and operable.',
  },
  {
    id: 'quorum',
    service: 'Quorum',
    domain: 'Reliability Patterns & Toil Reduction',
    front: 'What is a quorum in a consensus-based system, and what does the 2f+1 rule mean?',
    back: 'A quorum is the minimum number of replicas that must agree before a consensus system accepts a value as durable. The 2f+1 rule means a group of 2f+1 replicas can tolerate up to f simultaneous failures and keep operating — for example, three replicas tolerate one failure — which is why odd, small replica counts are the common building block for critical state.',
  },
  {
    id: 'circuit-breaker',
    service: 'Circuit breaker (pattern)',
    domain: 'Reliability Patterns & Toil Reduction',
    front: "What does the circuit breaker pattern do, and how does Google's own SRE literature relate to it?",
    back: "A circuit breaker stops a client from repeatedly calling a dependency that is already failing, by 'tripping' after enough failures and briefly refusing calls outright so the failing dependency gets a chance to recover instead of being pounded by retries. Google's SRE books do not actually use the term 'circuit breaker' — the same protective idea shows up there under names like retry budgets and load shedding, which serve a closely related purpose without a single unified name.",
  },
  {
    id: 'positive-feedback-cascading',
    service: 'Positive feedback (cascading failures)',
    domain: 'Reliability Patterns & Toil Reduction',
    front: "Once a cascading failure's positive-feedback loop has started, what does it take to break it?",
    back: "Waiting for the system to recover on its own rarely works, because every new failure keeps adding load to the survivors and feeding the loop. Breaking it takes active intervention: shedding load so overloaded tasks stop accepting work they are doomed to fail, propagating deadlines so abandoned requests stop consuming resources deep in the stack, and adding jittered exponential backoff so retries spread out instead of piling back on in synchronized waves.",
  },
  {
    id: 'redundancy-replica-pools',
    service: 'Redundancy through replica pools',
    domain: 'Reliability Patterns & Toil Reduction',
    front: 'How does spreading a service across a pool of replicas behind a load balancer improve reliability?',
    back: 'A pool of interchangeable replicas means the loss of any single one just shifts its share of traffic onto the survivors instead of taking down the service, and the load balancer is what makes that shift automatic and fast. This is the basic redundancy pattern underneath most of the more specific techniques — N+2 provisioning, quorum-based state, and graceful degradation all build on the assumption that no single replica is a single point of failure.',
  },
];
