// js/data/questions.js
// Quiz questions for the SLIs, SLOs & Error Budgets domain (20% exam weight).
// Grounded in Google's Site Reliability Engineering book and the SRE
// Workbook (docs cached under .cache/aws-docs/ during authoring); every
// answer key re-verified against the cached source passage before being
// added, and written in original prose, not copied.
export const QUESTIONS = [
  // --- Sub-theme: SLI / SLO / SLA definitions ---
  {
    id: 'slos-001',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: 'In the vocabulary the SRE book uses to define reliability, what is a service level indicator (SLI)?',
    options: [
      'A target value or range of values the service commits to hit for a given metric, over some window of time',
      'A contract with users that specifies penalties whenever a promised service level is missed',
      'A carefully defined, quantitative measurement of one aspect of how well a service is behaving',
      'The share of a measurement window during which a team may fall short of its stated objective',
    ],
    correctIndexes: [2],
    explanation: "An SLI is the raw, quantitative measurement itself — things like a success-rate or latency figure. The option describing a target attached to a metric is actually an SLO, the option describing a contract with penalties is an SLA, and the option describing a permitted shortfall window describes an error budget, not an SLI.",
  },
  {
    id: 'slos-002',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: 'According to the SRE book, what is the typical structure of a service level objective (SLO)?',
    options: [
      'A numeric threshold, or bounded range, that a service commits to hitting on an existing SLI',
      'A quantitative measurement collected directly from live production traffic each day',
      'A binding agreement between a provider and its customers that includes financial remedies',
      'The count of degraded pipeline responses a team is allowed before a postmortem becomes mandatory',
    ],
    correctIndexes: [0],
    explanation: "An SLO takes an SLI and attaches a target or bound to it. The option describing a raw production measurement is really the SLI itself, the option describing a contract with remedies is an SLA, and the degraded-response-count option describes nothing the book defines this way.",
  },
  {
    id: 'slos-003',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: "Per the SRE book, what distinguishes a service level agreement (SLA) from an SLO?",
    options: [
      'An SLA is measured with far more precision than an SLO, using client-side rather than server-side instrumentation',
      'An SLA adds an explicit consequence, typically financial, that kicks in once the underlying objective is missed',
      'An SLA is set exclusively by the SRE team, while an SLO instead requires sign-off from product management leadership',
      'An SLA applies only to services used purely internally, while an SLO applies only to externally offered ones',
    ],
    correctIndexes: [1],
    explanation: "The book's own test for telling the two apart is asking what happens when the target is missed: no defined consequence means SLO, an explicit (usually financial) consequence means SLA. The measurement-precision claim confuses this with the separate SLI specification/implementation distinction. The team-ownership claim actually runs backward — the book says SRE typically stays out of constructing SLAs since they're a business and legal matter. And the internal/external claim is contradicted by the book's own example of Google Search, an external service with no SLA at all.",
  },
  {
    id: 'slos-004',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: "A team measures its search latency using load-balancer logs, but users report the page feels slow because of client-side JavaScript delays the logs never capture. What does the workbook's distinction between SLI specification and SLI implementation suggest is happening here?",
    options: [
      "The SLO's numeric target was clearly set too low, so the fix is simply to raise that threshold further",
      "The service has now crossed into SLA territory, which automatically triggers a contractual penalty for the team",
      "The error-budget formula of 1 minus the SLO must have been computed incorrectly somewhere for this particular service",
      'The chosen SLI implementation is a proxy that fails to fully capture what the specification set out to measure',
    ],
    correctIndexes: [3],
    explanation: "The specification is what you actually want to know (how fast the page feels to a user); the implementation is how you happen to measure it. A server-side, load-balancer-based implementation is a proxy, and problems in client-side code can hurt real users without ever showing up in that proxy — which is exactly why moving measurement closer to the user tends to help. Nothing here implies the target itself is wrong, that an SLA has been triggered, or that the error-budget arithmetic is broken.",
  },
  {
    id: 'slos-005',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: "Why does the workbook recommend a rolling window, such as a trailing four weeks, as a general-purpose default for measuring SLOs rather than a calendar-aligned window like a fixed month?",
    options: [
      'Calendar-aligned windows are mathematically incapable of ever expressing any percentage-based error budget at all',
      'Rolling windows require substantially less monitoring infrastructure to implement than calendar-aligned windows do',
      "A rolling window tracks closer to real user experience, since a late outage doesn't just vanish next period",
      'A calendar-aligned window would legally require every team in the company to adopt an identical SLO target',
    ],
    correctIndexes: [2],
    explanation: "The workbook's stated reason is about user perception: a bad outage on the last day of a period doesn't reset for users just because a new period starts, so a rolling window mirrors lived experience better than a calendar boundary does. Calendar windows are perfectly capable of expressing a percentage budget (the workbook even discusses using them), they aren't described as cheaper to instrument, and neither window type is described as forcing a shared SLO across teams.",
  },
  {
    id: 'slos-006',
    domain: 'slos',
    questionType: 'multiple-response',
    question: 'Which of the following statements about SLIs, SLOs, and SLAs are accurate, per the SRE book? (Select all that apply.)',
    options: [
      'An SLI is a quantitative measurement of service behavior, while an SLO attaches a target value to that measurement',
      'If missing a threshold carries no explicit, defined consequence, that threshold is almost certainly an SLO rather than an SLA',
      'A single SLI, such as latency, can have several SLOs layered on it — for example, a looser bound at a lower percentile and a stricter one at a higher percentile',
      "SRE teams typically negotiate the financial penalties written into a company's SLAs with its customers",
      'Every Google service that publishes an SLO also has a matching SLA with its users',
    ],
    correctIndexes: [0, 1, 2],
    explanation: "The book defines an SLI as the raw measurement and an SLO as a target attached to it, offers the no-consequence-means-SLO test explicitly, and describes layering multiple SLO thresholds on one SLI to capture both typical and tail behavior. It's the opposite of true that SRE teams typically negotiate SLA penalties — the book says that work is closely tied to business and legal decisions SRE generally stays out of. And the book's own Google Search example shows a widely used service can carry an SLO with no SLA at all, so the claim that every SLO'd service has a matching SLA doesn't hold.",
  },
  {
    id: 'slos-007',
    domain: 'slos',
    questionType: 'multiple-response',
    question: 'Which pieces of practical advice does the workbook give for getting a first SLO in place? (Select all that apply.)',
    options: [
      'A team should wait until it has built a fully accurate, dedicated measurement pipeline before publishing any SLO',
      "Choose five or fewer SLI types to represent a service's most critical functionality",
      'Base a first SLO on whatever data is already cheap to collect, such as existing logs, rather than waiting for perfect measurement',
      'Use a four-week rolling window as a good general-purpose default, complemented with weekly and quarterly summaries',
      'Once stakeholders agree to an SLO, never revisit or refine it again',
    ],
    correctIndexes: [1, 2, 3],
    explanation: "The workbook explicitly recommends a small handful (five or fewer) of SLI types, says a first attempt doesn't have to be correct as long as something gets measured and refined, and names a four-week rolling window paired with weekly and quarterly summaries as its general-purpose default. It does not tell teams to wait for a perfect pipeline before publishing anything — quite the opposite — and it explicitly expects SLOs to be revisited and refined over time rather than frozen after initial agreement.",
  },

  // --- Sub-theme: Choosing SLIs by system type ---
  {
    id: 'slos-008',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: 'Per the SRE book, which three SLI categories does it identify as the natural starting point for a user-facing serving system, such as a search frontend or a public API?',
    options: [
      'Availability, latency, and durability',
      'Availability, latency, and throughput',
      'Throughput, freshness, and coverage',
      'Correctness, durability, and freshness',
    ],
    correctIndexes: [1],
    explanation: "The book frames user-facing serving systems around whether a request could be answered, how long that took, and how many requests could be handled — availability, latency, and throughput. Durability is the extra concern the book assigns to storage systems, and freshness/coverage are the extra concerns it assigns to pipeline systems, not the starting set for request-driven serving systems.",
  },
  {
    id: 'slos-009',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: 'According to the SRE book, storage systems typically add which concern on top of the latency and availability questions they share with serving systems?',
    options: [
      'Durability: whether data written today can still be retrieved correctly at some point in the future',
      'Throughput: how many read and write requests the storage system can successfully process each second',
      'Freshness: whether the data returned to a caller reflects a sufficiently recent, up-to-date write',
      'Coverage: whether every single record in a given batch run was fully and successfully processed',
    ],
    correctIndexes: [0],
    explanation: "The book pairs storage systems with latency, availability, and durability — whether data survives to be read back later. Freshness and coverage are the pipeline-specific SLI flavors the workbook adds for batch and streaming systems, not the concern the book highlights for storage.",
  },
  {
    id: 'slos-010',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: 'The SRE book characterizes data-processing pipelines — batch jobs and streaming systems — primarily by which two SLI categories, since there is often no single discrete request to measure?',
    options: [
      'Availability and long-term durability',
      'Data quality and processing coverage',
      'Request latency and result correctness',
      'Throughput and end-to-end latency',
    ],
    correctIndexes: [3],
    explanation: "The book describes big data systems as caring about throughput and end-to-end latency — how much data moves through the pipeline and how long it takes to get from ingestion to completion. Availability/durability is the storage pairing, and quality/coverage-style additions come from the workbook's more detailed pipeline table, not this headline pair from the book itself.",
  },
  {
    id: 'slos-011',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: "Why does the SRE book note that correctness, while important to every system type, is often not something an SRE team is directly on the hook for?",
    options: [
      'Because correctness is often a property of the data itself, not of the serving infrastructure',
      'Because correctness is fundamentally impossible to measure in any quantitative, numeric way at all',
      'Because correctness SLOs, according to the book, are always set well below the 99.9% availability line',
      'Because correctness, according to the book, only ever matters for storage systems, never serving or pipelines',
    ],
    correctIndexes: [0],
    explanation: "The book's reasoning is about ownership, not measurability: correctness often reflects the quality of the data passing through a system rather than a defect in the infrastructure serving it, so it can fall outside what the infrastructure-focused SRE team is accountable for. The book explicitly says correctness matters to all system types, not just storage, and it never claims correctness resists quantitative measurement or that its targets sit below availability's.",
  },
  {
    id: 'slos-012',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: "In the workbook's worked example SLO document for a mobile game, the API and web frontend components are measured with availability and latency SLIs. Which three SLI categories does that same document use for the score-generating pipeline component instead?",
    options: [
      'Availability, throughput, and durability',
      'Freshness, correctness, and completeness',
      'Latency, correctness, and coverage',
      'Availability, latency, and durability',
    ],
    correctIndexes: [1],
    explanation: "The example document tracks the score pipeline with freshness (how recently the underlying data was updated), correctness (verified with a synthetic-data prober), and completeness (whether a given run processed every record). Availability and latency are the categories used for the request-driven API and web components instead, and durability doesn't appear in this particular document at all.",
  },
  {
    id: 'slos-013',
    domain: 'slos',
    questionType: 'multiple-response',
    question: 'Which SLI-to-system-type pairings match how the SRE book and workbook categorize typical SLIs? (Select all that apply.)',
    options: [
      'Storage systems are typically measured with freshness and completeness rather than durability',
      'Correctness is relevant only to request-driven serving systems, not to storage or pipeline systems',
      'Data-processing pipelines are typically measured with throughput and end-to-end latency',
      'Storage systems are typically measured with latency, availability, and durability',
      'User-facing serving systems are typically measured with availability, latency, and throughput',
    ],
    correctIndexes: [2, 3, 4],
    explanation: "The book's three category pairings hold: serving systems get availability/latency/throughput, storage systems get latency/availability/durability, and pipelines get throughput/end-to-end latency. Freshness and completeness are pipeline-specific additions from the workbook's worked example, not a substitute for storage's durability concern, and the book states correctness matters to every system type, not serving systems alone.",
  },

  // --- Sub-theme: Error budgets and error-budget policy ---
  {
    id: 'slos-014',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: 'A service has a 99.9% availability SLO. Per the SRE book\'s framing, what is its error budget for a given measurement window?',
    options: [
      '0.01% of requests may fail within the window',
      '1% of requests may fail within the window',
      '0.1% of requests may fail within the window',
      '99.9% of requests may fail within the window',
    ],
    correctIndexes: [2],
    explanation: "An error budget is simply 100% minus the SLO, so a 99.9% target leaves a 0.1% budget. The 0.01% and 1% options are each off by a factor of ten in one direction or the other, and the 99.9% option mistakenly reuses the SLO value itself as if it were the allowed failure share.",
  },
  {
    id: 'slos-015',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: "Per the workbook's example error-budget policy, how is a service's error budget itself defined?",
    options: [
      'A fixed count of incidents the on-call rotation is officially permitted to declare each quarter',
      'The total number of postmortems that were completed during the previous four-week measurement window',
      'A rolling average of the previous full year\'s uptime, calculated independent of the current SLO',
      "1 minus the service's SLO — derived directly from whatever target was already chosen",
    ],
    correctIndexes: [3],
    explanation: "The example policy states the budget plainly as 1 minus the SLO — it's a number derived from the SLO you already picked, not a separately tracked incident count, postmortem tally, or independent historical average.",
  },
  {
    id: 'slos-016',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: "A service has a quarterly SLO of 99.999%, giving it a 0.001% quarterly error budget. A single incident causes 0.0002% of that quarter's queries to fail. Per the SRE book's worked calculation, what fraction of the quarterly error budget does the incident consume?",
    options: [
      '20%',
      '2%',
      '50%',
      '100%, exhausting the entire budget',
    ],
    correctIndexes: [0],
    explanation: "0.0002% is one-fifth of the 0.001% budget, so the incident consumes 20% of it — the exact ratio the book's own worked example walks through. The other fractions misapply the ratio between the incident's failure share and the total budget available.",
  },
  {
    id: 'slos-017',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: "Once a service has exhausted its budget for the four-week window, what does Google's example error-budget policy in the workbook call for?",
    options: [
      "Permanently and irreversibly lowering the service's SLO target so the exhausted budget simply resets to zero",
      'Requiring every single team company-wide to adopt that exact same four-week measurement window universally',
      'Freezing non-critical releases, except top-priority fixes and security patches, until the service recovers',
      'Automatically escalating the matter straight to the CTO, regardless of whether anyone disputes the budget calculation',
    ],
    correctIndexes: [2],
    explanation: "The example policy's SLO Miss Policy section calls for halting non-critical changes and releases once the budget for the window is gone, carving out only top-priority fixes and security patches, until performance recovers. It says nothing about permanently changing the SLO target or forcing a shared window on other teams, and its CTO escalation step is reserved specifically for disagreements about how the budget was calculated, not triggered automatically by exhaustion.",
  },
  {
    id: 'slos-018',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: "The four-week measurement window and the 20%-of-budget thresholds for triggering a postmortem or a quarterly planning commitment — where do these specific numbers come from, per the workbook?",
    options: [
      'They are strict mandated minimums that the workbook says every single SRE team must adopt without any modification',
      'They are the parameters of one illustrative example policy, meant to be adapted rather than copied universally',
      "They are legal requirements that are derived directly from the sample service's SLA with its own users",
      "They are values Google's monitoring system calculates automatically for any service that defines an SLO",
    ],
    correctIndexes: [1],
    explanation: "The workbook presents this policy as a worked example for one illustrative service, not as a mandate every team must adopt unchanged. Nothing ties the numbers to a legal SLA requirement, and they aren't values a monitoring system derives automatically — they're choices a specific example policy's authors made.",
  },
  {
    id: 'slos-019',
    domain: 'slos',
    questionType: 'multiple-response',
    question: "Which of the following are part of Google's example error-budget policy for its illustrative game service, per the workbook's appendix? (Select all that apply.)",
    options: [
      'A single incident consuming more than 20% of the four-week budget requires a postmortem with at least one top-priority follow-up action',
      'The policy states its explicit purpose is to punish teams whenever they miss their SLO',
      "Releases are halted the moment the service dips even briefly below its SLO, before the whole window's budget is used up",
      "A recurring class of outage consuming more than 20% of a quarter's budget requires a planning commitment for the following quarter",
      'Budget consumed by out-of-scope traffic, such as load tests, does not by itself require freezing releases',
    ],
    correctIndexes: [0, 3, 4],
    explanation: "The policy's Outage Policy section sets both the single-incident and per-quarter 20% thresholds described here, and its SLO Miss Policy section carves out an exception for budget consumed by traffic outside the SLO's scope, like load tests. The policy's own Non-Goals section explicitly disclaims punishment as its purpose, and it only calls for freezing releases once the entire window's budget is gone — not the moment performance briefly dips below the SLO while releases are otherwise proceeding normally.",
  },

  // --- Sub-theme: Embracing risk and the cost of extreme reliability ---
  {
    id: 'slos-020',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: "The SRE book's Embracing Risk chapter spends most of its opening argument explaining why 100% reliability is the wrong target for a service. What does that argument center on?",
    options: [
      'A claim that government regulators impose a strict legal reliability ceiling on any consumer-facing internet service',
      'An observation that highly reliable services empirically suffer more security incidents than less reliable ones',
      'A requirement that every service must match the reliability level of its least reliable market competitor',
      'Reliability costs rise non-linearly, with each added nine costing far more while user-perceived benefit flattens out',
    ],
    correctIndexes: [3],
    explanation: "The chapter's developed argument is a cost/benefit one: incremental reliability gets dramatically more expensive while the user-visible benefit flattens out, since a user's experience is dominated by less-reliable links elsewhere in the chain anyway. No regulatory ceiling, security-incident correlation, or competitor-matching requirement appears anywhere in the chapter's reasoning.",
  },
  {
    id: 'slos-021',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: "Per the SRE book, the cost of incrementally improving a service's reliability has two distinct components. What are they?",
    options: [
      "The cost of redundant infrastructure/equipment, and the opportunity cost of engineers' time diverted from new features",
      'The cost of hiring a substantially larger dedicated on-call staff, and the cost of expanding the customer-support team further',
      "The cost of an SLA's contractual financial penalties, and the cost of the legal review needed to draft one properly",
      'The cost of running a thorough postmortem process, and the cost of maintaining a library of on-call playbooks',
    ],
    correctIndexes: [0],
    explanation: "The book names two cost dimensions specifically: the hard cost of redundant machines and equipment, and the opportunity cost of diverting engineers toward risk-reduction work instead of user-facing features. Staffing costs, SLA legal costs, and postmortem/playbook overhead are not the two dimensions the chapter identifies.",
  },
  {
    id: 'slos-022',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: "Using the SRE book's shorthand for availability targets, how is a 99.99% target typically described?",
    options: [
      'Three and a half nines',
      'Four nines',
      'Five nines',
      'Two nines',
    ],
    correctIndexes: [1],
    explanation: "Each leading nine in the percentage gives the shorthand name, so 99.99% is four nines. Three and a half nines is a real figure from the same chapter, but it names Google Compute Engine's separately cited 99.95% target, not 99.99%; five nines would be 99.999%, and two nines would be 99%.",
  },
  {
    id: 'slos-023',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: "The SRE book explains that for a large, globally distributed service, availability is usually defined differently than the classic wall-clock uptime metric. How does it define availability instead?",
    options: [
      'As the fraction of a calendar year during which every replica of the service was simultaneously reachable',
      "As the number of consecutive minutes since the service's last full outage",
      'As the proportion of requests that succeeded out of all requests received over a given window',
      'As the ratio of scheduled maintenance windows to unscheduled outages in a quarter',
    ],
    correctIndexes: [2],
    explanation: "Because a globally distributed service is essentially always serving somewhere, the book moves away from a simultaneous-uptime clock and instead defines availability as the aggregate request success rate: successful requests divided by total requests over a window. The other options describe a time-based, incident-count, or maintenance-ratio metric, none of which match this request-based framing.",
  },
  {
    id: 'slos-024',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: "The SRE book describes Google intentionally taking its highly reliable Chubby lock service offline periodically, even without a real failure forcing it. What was the stated purpose?",
    options: [
      "To comply with a scheduled maintenance clause explicitly written into Chubby's service contract with its customers",
      'To free up spare compute capacity for other unrelated services during that scheduled outage window',
      'To test and verify whether the on-call rotation could detect a real outage quickly enough',
      'To force teams that had silently begun assuming Chubby could never fail to confront that dependency',
    ],
    correctIndexes: [3],
    explanation: "The book's Chubby example is about breaking a false sense of security: because Chubby rarely failed, other teams started building on the unstated assumption that it never would, so a deliberate, controlled outage flushes out and forces a reckoning with those dependencies. No contractual maintenance clause, capacity-freeing motive, or on-call detection test is given as the reason.",
  },
  {
    id: 'slos-025',
    domain: 'slos',
    questionType: 'multiple-response',
    question: "Which of the following statements about reliability and risk, per the SRE book's Embracing Risk chapter, are accurate? (Select all that apply.)",
    options: [
      'Google treats an availability target as both a floor and a ceiling — exceeding it by a wide margin is usually a sign that reliability effort went where nobody needed it',
      "A user on an already-unreliable phone or network connection typically can't tell 99.99% service reliability apart from 99.999%",
      'The chapter states plainly that 100% reliability is fully achievable for any service, just prohibitively expensive',
      "The book states that YouTube was given a higher availability target than Google's enterprise apps because consumer products need more reliability",
      "The chapter frames risk as a continuum, aiming to align a service's reliability with the level of risk its business is actually willing to bear",
    ],
    correctIndexes: [0, 1, 4],
    explanation: "The chapter explicitly treats a target as a minimum and a maximum, states that a user behind an already-unreliable link can't tell 99.99% from 99.999% apart, and frames risk management as a continuum aligned to what a business is willing to bear. It never claims 100% is fully achievable — if anything the chapter leans the opposite way — and the book's actual YouTube example runs the other direction: YouTube got a lower target than the enterprise products because rapid feature development mattered more for it at the time.",
  },
  // --- Sub-theme: Monitoring Fundamentals (Four Golden Signals, Black-Box vs. White-Box) ---
  {
    id: 'monitoring-001',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: 'The SRE book proposes a minimum viable set of metrics for any user-facing system: if you can only measure four things, focus on these. What are the four golden signals?',
    options: [
      'Latency, throughput, uptime, and mean time to repair',
      'Availability, durability, consistency, and cost',
      'CPU utilization, memory usage, disk I/O, and network bandwidth',
      'Latency, traffic, errors, and saturation',
    ],
    correctIndexes: [3],
    explanation: "The book names exactly these four as the golden signals. The throughput/uptime/MTTR grouping mixes in terms the chapter doesn't bundle this way; availability/durability/consistency/cost reads like a cloud-storage product page rather than this chapter's framing; and the four raw resource metrics are explicitly treated by the book as indirect proxies services fall back on for saturation, not a separate signal category of their own.",
  },
  {
    id: 'monitoring-002',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: "Per the SRE book's definition, what does the 'saturation' golden signal actually measure?",
    options: [
      "The service's current CPU utilization percentage, since CPU is described as the resource that most commonly limits capacity for the overwhelming majority of typical production web services",
      'How full the service is, keyed to whichever resource is currently most constrained, including forward-looking predictions of approaching limits',
      'The percentage of allocated disk space actively in use at the instant the metric happens to be sampled, without regard to any trend',
      'The ratio of successful to failed requests observed over the most recent measurement window',
    ],
    correctIndexes: [1],
    explanation: "The book defines saturation as how 'full' a service is, emphasizing whichever resource is tightest-constrained, and explicitly forward-looking (its own example is predicting a database will fill its disk in a few hours). A flat CPU-percentage reading is exactly the kind of easy-to-grab but incomplete proxy the book says most services fall back on only because true headroom is hard to observe directly, not the definition itself. A disk-usage snapshot misses that forward-looking angle, and a success/failure ratio actually describes the 'errors' signal, not saturation.",
  },
  {
    id: 'monitoring-003',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: 'The SRE book warns against simply folding failed requests into an overall latency average. Why?',
    options: [
      'Failed requests are typically logged in an incompatible timestamp format that breaks most latency-aggregation tooling',
      "Regulatory reporting rules require failed-request latency to be tracked in a completely separate monitoring system from the rest of a service's ordinary metrics and dashboards",
      'A request that fails fast (an HTTP 500 in a few milliseconds) can pull the blended average down, hiding how much worse a slow failure is than a quick one',
      'Averaging failed requests into the total always makes the reported latency look artificially worse than what users actually experience',
    ],
    correctIndexes: [2],
    explanation: "The book's own point is that a fast failure quietly drags a blended average down, which is dangerous because a slow failure is worse for a user than a fast one — so hiding that distinction inside one averaged number is misleading. There's no claim in the chapter about timestamp-format incompatibilities, a regulatory separation requirement, or failures always skewing the average worse than reality; the actual risk described runs the opposite direction, toward an artificially better-looking number.",
  },
  {
    id: 'monitoring-004',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: "Per the book's definition of the 'errors' golden signal, which of these would count as a failed request even though a load balancer simply watching for non-200 status codes might never catch it?",
    options: [
      'A response that returns HTTP 200 but with the wrong content, or one that technically completes yet blows past a promised response-time bound',
      'Any request a load balancer happens to route to a backend in a different datacenter than the one physically nearest to the requesting user at that moment',
      'A request that used somewhat more internal compute than a typical request of the same type, without otherwise misbehaving',
      'A request that ultimately succeeded on a retry after an initial attempt hit a transient network error',
    ],
    correctIndexes: [0],
    explanation: "The book is explicit that a success status code isn't proof of success: an HTTP 200 with the wrong payload, or a technically-completed request that violates a promised response-time policy, both count as errors that raw protocol codes alone won't surface. Cross-datacenter routing, mildly elevated internal compute cost, and a request that eventually succeeded via retry are not the kind of implicit or policy-based failure the chapter is describing here.",
  },
  {
    id: 'monitoring-005',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: 'What does the SRE book identify as the simplest way to distinguish black-box monitoring from white-box monitoring?',
    options: [
      'Black-box monitoring covers checks against infrastructure layers like load balancers and networking gear, while white-box monitoring covers checks against the application layer and its own business logic instead',
      "Black-box monitoring is any check run from outside a company's own network perimeter, while white-box monitoring is any check run from inside that perimeter",
      'Black-box monitoring relies on third-party commercial tooling, while white-box monitoring relies exclusively on tooling built in-house',
      "Black-box monitoring tests externally visible behavior the way a user would see it and is symptom-oriented; white-box monitoring inspects the system's own internal instrumentation, such as logs or exposed HTTP endpoints",
    ],
    correctIndexes: [3],
    explanation: "The book's own framing ties the split to orientation, not location: black-box means testing what a user would see, so it's symptom-oriented; white-box means inspecting a system's own internals via instrumentation, which is what lets it catch imminent problems before they surface. Splitting it by infrastructure-versus-application layer, by which side of a network perimeter a check runs from, or by who built the tooling are all plausible-sounding but different dichotomies the book doesn't actually draw.",
  },
  {
    id: 'monitoring-006',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: "The SRE book uses a database's slow reads as an example within a multilayered system. How does it use that example to complicate the black-box/white-box split?",
    options: [
      'It shows that black-box monitoring should always be preferred over white-box monitoring whenever more than one engineering team happens to own a different piece of the same overall multilayered system',
      "It shows that a database's internal read latency should never be exposed to any team outside of the database's own owning team",
      "The same slow reads are a symptom to the database team, but a cause to a frontend team whose website is slow as a result — white-box telemetry can be symptom- or cause-oriented depending on who's looking",
      'It shows that only the team physically closest to the underlying hardware can accurately classify a given signal as either a symptom or a cause',
    ],
    correctIndexes: [2],
    explanation: "The book's point is specifically about perspective: what looks like the symptom under investigation to the database team is exactly the cause of a separate problem for the frontend team relying on that database, so a single white-box signal can be symptom-oriented for one audience and cause-oriented for another. It doesn't argue for preferring black-box monitoring in multi-team systems, for hiding internal latency from other teams, or for restricting symptom/cause classification to whichever team sits physically closest to the hardware.",
  },
  {
    id: 'monitoring-007',
    domain: 'monitoring',
    questionType: 'multiple-response',
    question: 'Which of the following are accurate, per the SRE book and its companion workbook material on monitoring fundamentals? (Select all that apply.)',
    options: [
      'White-box monitoring can catch trouble before it becomes externally visible, including failures that automatic retries are temporarily hiding from users',
      'Google still relies on black-box probing (via a tool like Prober) alongside heavy white-box instrumentation, because a purely internal view misses queries that never even reach the target, such as ones lost to a DNS error',
      'For a very simple service with no parameter that changes request complexity, a single static value pulled from a load test can be an adequate stand-in for an ongoing saturation measurement',
      'Black-box monitoring is generally considered more valuable than white-box monitoring for debugging, since it captures a wider range of internal system state',
      'Traffic should always be measured in HTTP requests per second, regardless of what kind of system is being monitored',
    ],
    correctIndexes: [0, 1, 2],
    explanation: "White-box telemetry can indeed surface imminent problems and retry-masked failures before users notice; Google keeps black-box probing precisely because a white-box-only view can't see requests that never made it to the target at all, such as ones dropped by a DNS failure; and a static load-test figure is explicitly called out as workable for the narrow case of a service with no complexity-varying parameters. White-box monitoring, not black-box, is described as essential for debugging since it exposes internal state a black-box check can't; and the book explicitly ties traffic's unit to the workload — concurrent sessions or I/O rate for streaming, transactions per second for a key-value store — not a fixed requests-per-second convention.",
  },
  // --- Sub-theme: Alerting Philosophy (Symptoms vs. Causes, Playbooks) ---
  {
    id: 'monitoring-008',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: "The SRE book frames good alerting around asking 'what's broken' versus 'why.' What does it recommend doing with that split when deciding what pages a human?",
    options: [
      'Bias alerting rules toward symptoms — active, currently user-visible failures — and mostly reserve cause-oriented signals for debugging once a human is already looking into a fired alert',
      "Alert on causes first, since fixing a root cause before it produces a visible symptom means users never notice there was a problem at all",
      'Give symptom-based and cause-based alerts exactly equal weight in every rule you write, since the book treats both as equally reliable predictors of genuine user harm across any kind of production system',
      'Alert exclusively on causes, and use symptom-based signals only for building dashboards, never for paging',
    ],
    correctIndexes: [0],
    explanation: "The book treats this what-versus-why split as central to keeping an alerting rule set high-signal, and its guidance is to bias paging toward symptoms precisely because a symptom answers 'is a user hurting right now' directly, while cause-chasing invites false positives and an ever-growing rule set. Treating causes as the primary trigger, weighting both equally, or banning causes from paging entirely all overstate or invert what the book actually recommends.",
  },
  {
    id: 'monitoring-009',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: "In the SRE book's own worked table of symptoms and causes, what's identified as the cause behind users in Antarctica not receiving the animated GIFs they requested?",
    options: [
      'A misconfigured DNS record was silently routing Antarctic traffic to an unrelated backend',
      'A content distribution network had blacklisted some of the client IP addresses making the requests',
      'The underlying database servers were refusing to accept new connections',
      'A recent software push had caused access-control rules to be dropped, making other private content world-readable',
    ],
    correctIndexes: [1],
    explanation: "The book's table pairs that specific symptom with a CDN having blacklisted client IPs as the cause. A database refusing connections is a real cause from the same table, but it's paired with a different symptom (serving HTTP 500s/404s), and dropped access-control rules exposing private content is likewise a real cause from the table paired with yet another symptom (private content becoming world-readable) — a DNS misrouting explanation doesn't appear in the table at all.",
  },
  {
    id: 'monitoring-010',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: "When a time-series alerting rule's condition first evaluates true, what happens before the alert is actually considered to be 'firing'?",
    options: [
      'The alert immediately pages the on-call rotation, since the pending state described in this chapter only ever applies to tickets and dashboard-only alerts, never to pages',
      'The alert is automatically downgraded to informational-only status until a human manually confirms it represents a genuine incident',
      'The alert waits for a central Alertmanager to poll every other monitoring instance in the hierarchy for a corroborating signal before it is allowed to fire',
      'The alert enters a pending state until the condition holds for a minimum duration — typically two evaluation cycles — so a brief crossing does not page anyone',
    ],
    correctIndexes: [3],
    explanation: "Alerts can briefly 'flap,' so the rule stays merely pending until the condition has held true for a minimum duration — commonly at least two evaluation cycles — before it's treated as genuinely firing; that delay exists specifically to stop a momentary blip from triggering a page. Nothing in the mechanics makes pages skip this pending step, forces a human confirmation before firing, or requires cross-instance polling as a precondition to fire.",
  },
  {
    id: 'monitoring-011',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: 'Once an alert is actually firing, what determines whether it becomes a page, a ticket, or just informational dashboard status?',
    options: [
      'A severity label on the alert: urgent conditions route to on-call as a page, important-but-not-urgent conditions route to a ticket queue, and the rest stay as dashboard status',
      'The number of distinct services affected by the underlying condition, with single-service issues always becoming tickets and multi-service issues always automatically becoming pages regardless of severity',
      'Whichever destination the on-call engineer who most recently closed a similar-looking incident happened to configure last',
      'The raw numeric value of the metric that tripped the alert, with larger values always mapping to a more urgent destination regardless of any label',
    ],
    correctIndexes: [0],
    explanation: "Alerts carry a severity label (the chapter's own example alert rule sets 'severity=page') that routes urgent conditions to on-call as pages, subcritical-but-real issues to a ticket queue, and everything else to dashboard status. How many services are affected, what a previous engineer once configured, or the bare size of the triggering number are not what determines routing in this scheme.",
  },
  {
    id: 'monitoring-012',
    domain: 'monitoring',
    questionType: 'multiple-response',
    question: 'A central alert-routing layer sits downstream of raw alert evaluation. Which of the following capabilities does the practical-alerting material attribute to that layer? (Select all that apply.)',
    options: [
      "Automatically rewriting an alert's underlying threshold whenever a team's paging volume exceeds some preset quota",
      'Deduplicating alerts fired by redundant monitoring instances that are all reporting the same underlying condition',
      'Suppressing (inhibiting) one alert while a related alert is already active',
      'Fanning alerts in or out based on labels shared across the alerts involved',
      "Automatically generating a playbook entry for any alert that doesn't already have one attached",
    ],
    correctIndexes: [1, 2, 3],
    explanation: "The routing layer described is credited with deduplicating alerts from multiple redundant sources, suppressing (inhibiting) one alert while a related one already fired, and fanning alerts in or out by shared labels — all explicitly named capabilities. Nothing in the material describes it auto-adjusting thresholds based on paging-volume quotas or auto-authoring playbook entries; both of those remain manual, human-driven work elsewhere in the SRE workflow.",
  },
  {
    id: 'monitoring-013',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: "The claim that a prepared 'playbook' produces roughly a threefold improvement in mean time to repair (MTTR), compared with an on-call engineer improvising from scratch, comes from which part of the SRE book?",
    options: [
      "The 'Being On-Call' chapter, which is where the book's most detailed playbook guidance actually lives",
      "The 'Practical Alerting' chapter, in its discussion of how a central Alertmanager routes fired alerts",
      "The introductory chapter's Emergency Response section, not a dedicated playbooks chapter",
      "The 'Managing Incidents' chapter's discussion of incident command roles",
    ],
    correctIndexes: [2],
    explanation: "That specific 3x figure appears in the book's introductory chapter, under its Emergency Response section, well before any of the later, more specialized chapters. Despite its title, the 'Being On-Call' chapter doesn't substantively develop playbook content; 'Practical Alerting' covers alert routing mechanics rather than MTTR statistics, and 'Managing Incidents' is about incident command structure, not this specific claim.",
  },
  {
    id: 'monitoring-014',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: "The workbook's on-call chapter describes a real disagreement among practitioners about how detailed a playbook entry should be. What's the disagreement, and what does the workbook suggest doing about it?",
    options: [
      'The disagreement is between storing playbooks in a wiki versus storing them in a formal, access-controlled version-control repository, and the workbook recommends version control exclusively',
      'Broad, durable entries versus precise step-by-step ones; the workbook suggests agreeing on a minimal required structure for every entry',
      'The disagreement is between writing playbooks in English prose versus as runnable automated scripts, and the workbook recommends banning prose playbooks in favor of scripts entirely',
      "The disagreement is between letting individual SREs author their own playbooks versus requiring product management to write and formally approve every one, and the workbook recommends the latter",
    ],
    correctIndexes: [1],
    explanation: "The real tension the workbook describes is over level of detail — broad-and-durable versus precise-and-step-by-step — and its practical suggestion is to agree on some minimal structure every entry must contain and watch for entries accumulating detail beyond that minimum as a signal to automate instead. Storage medium, prose-versus-script format, and who is allowed to author playbooks are not the disagreement the chapter actually describes.",
  },
  {
    id: 'monitoring-015',
    domain: 'monitoring',
    questionType: 'multiple-response',
    question: 'Beyond the symptom/cause split, the SRE book lists a short set of expectations for what a page itself should look like. Which of the following are among them? (Select all that apply.)',
    options: [
      'A page should always ship with a pre-approved remediation script that runs automatically the moment the page fires',
      'An engineer should be able to sustain full urgency for as many pages as arrive in a day, with no real risk of fatigue',
      'Every page should be actionable',
      'A page response should require real judgment, not a rote, scripted reaction',
      'A page should represent a novel problem, not a repeat of something already diagnosed',
    ],
    correctIndexes: [2, 3, 4],
    explanation: "The book's own expectations are that every page be actionable, that responding to it require genuine judgment rather than a rote response, and that it represent something novel rather than a repeat of an already-diagnosed issue. It says the opposite of the fatigue claim — a person can only react with real urgency a handful of times a day before fatigue sets in — and nothing in the chapter requires an auto-running remediation script to accompany every page.",
  },
  // --- Sub-theme: SLO-Based (Burn-Rate) Alerting ---
  {
    id: 'monitoring-016',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: "What does 'burn rate' actually measure in SLO-based alerting?",
    options: [
      "How fast a service is consuming its error budget relative to a sustainable pace defined by the SLO's own compliance window — never a standalone, fixed error-rate number",
      'A fixed error-rate percentage that is universal across all services and teams, independent of whatever particular SLO or measurement window happens to be in use at the time',
      'The total count of failed requests recorded since the start of the current calendar month',
      "The percentage difference between this month's error rate and last month's error rate for the same service",
    ],
    correctIndexes: [0],
    explanation: "Burn rate is explicitly defined relative to the SLO's own window: a burn rate of 1 means the current error rate would exhaust the whole budget exactly at the end of that window, and the same instantaneous error rate implies a different burn rate depending on what the SLO and window actually are. It's not a fixed universal percentage, a raw failed-request count, or a month-over-month comparison.",
  },
  {
    id: 'monitoring-017',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: 'For a service with a 99.9% SLO measured over a 30-day window, what constant error rate corresponds to a burn rate of exactly 1?',
    options: [
      '1%',
      '0.01%',
      '10%',
      '0.1%',
    ],
    correctIndexes: [3],
    explanation: "A burn rate of 1 means the error rate, held steady, would exhaust the entire budget precisely at the end of the window — and for a 99.9% SLO over 30 days that works out to a constant 0.1% error rate. 1% corresponds to a much higher burn rate (roughly 10x, exhausting the budget in about 3 days), 0.01% is ten times too small, and 10% is wildly higher than a sustainable burn-rate-1 pace for this target.",
  },
  {
    id: 'monitoring-018',
    domain: 'monitoring',
    questionType: 'multiple-response',
    question: "The workbook walks through two early (non-recommended) SLO-alerting attempts before arriving at burn-rate-based alerting: paging whenever a short window's error rate crosses the SLO threshold, and widening that window to demand a bigger budget spend first. Which of the following accurately describe a tradeoff of these two attempts? (Select all that apply.)",
    options: [
      'The short-window (e.g., ten-minute) version gives excellent detection time but poor precision, since a brief blip crosses the very same threshold a real outage would',
      'Google adopted the short-window, direct-threshold-crossing approach as its final recommended SLO-alerting configuration for a 99.9% SLO',
      "Unlike the short-window version, the widened-window version computes an explicit burn-rate multiplier rather than comparing directly against the SLO's raw error-rate threshold",
      'Widening the window to demand a larger, more meaningful budget spend before alerting improves precision but creates poor reset time, since the alert keeps firing as long as the wide window still contains the bad data',
      'A 0.1% error rate sustained for just ten minutes is enough to trigger the short-window version, even though it only consumes a small sliver of a 30-day error budget',
    ],
    correctIndexes: [0, 3, 4],
    explanation: "The short-window version really does trade strong detection speed for weak precision — a service could rack up over a hundred such alerts a day while still comfortably meeting its SLO, and a brief 0.1% blip is enough to trigger it. Widening the window really does trade that precision problem for a reset-time problem, since a resolved outage can leave the alert stuck firing for as long as the wider window still contains bad data. Neither of these two early attempts was the workbook's final recommendation — that distinction goes to the later multiwindow, multi-burn-rate technique — and the widened-window version still compares directly against the raw SLO threshold rather than introducing a burn-rate multiplier, which only appears in a later iteration.",
  },
  {
    id: 'monitoring-019',
    domain: 'monitoring',
    questionType: 'multiple-response',
    question: "A third early attempt adds a fixed minimum-duration requirement to an alert rule (e.g., 'must stay above threshold for one hour before paging') to try filtering out short-lived noise. Which of the following problems does the workbook identify with this approach? (Select all that apply.)",
    options: [
      'Detection time no longer scales with severity — a complete outage and a barely-over-threshold blip both wait out the same fixed duration before paging',
      'If the metric dips back under the threshold even momentarily, many implementations reset the duration timer, so a genuinely damaging but fluctuating error rate can end up never paging at all',
      'It makes precision worse than the original short-window approach, since requiring a sustained duration increases the number of false pages',
      'It removes the need to ever define an SLO in the first place, since duration alone is treated as a sufficient basis for alerting',
      "A complete outage that takes an hour to page under this scheme can already have consumed well over 100% of that service's 30-day error budget by the time anyone is notified",
    ],
    correctIndexes: [0, 1, 4],
    explanation: "This approach really does decouple detection time from severity (a total outage and a marginal blip both wait the same hour), really can reset its timer and never fire if the metric dips back under the line even briefly, and a full outage waiting that hour really can burn well past 100% of a 30-day budget before anyone is paged. It doesn't make precision worse than the short-window version — precision is actually its one genuine improvement — and it still relies on an underlying SLO threshold to compare against, so it doesn't remove the need for an SLO.",
  },
  {
    id: 'monitoring-020',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: 'In the multiwindow, multi-burn-rate technique, roughly what size is the recommended short confirmation window relative to its paired long window?',
    options: [
      'About half the length of the long window',
      'About one-twelfth the length of the long window',
      'About twice the length of the long window',
      'A fixed 5 minutes, regardless of how long the paired long window is',
    ],
    correctIndexes: [1],
    explanation: "The recommended guideline is to size the short confirmation window at roughly one-twelfth the paired long window — which is why a 1-hour long window pairs with a 5-minute short window, a 6-hour window pairs with 30 minutes, and a 3-day window pairs with 6 hours, all the same ratio. A half, double, or fixed-5-minutes rule would break that consistent scaling across window sizes.",
  },
  {
    id: 'monitoring-021',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: "Per the workbook's recommended starting parameters for a 99.9% SLO, which burn-rate/window combination routes to a ticket rather than a page?",
    options: [
      'A burn rate above 14.4 sustained across both a one-hour window and a five-minute confirmation window, representing about 2% of the monthly budget',
      'A burn rate above 6 sustained across both a six-hour window and a thirty-minute confirmation window, representing about 5% of the monthly budget',
      'A burn rate above 1 sustained across both a three-day window and a six-hour confirmation window, representing about 10% of the monthly budget',
      'A burn rate above 36 sustained across a single one-hour window with no confirmation window at all',
    ],
    correctIndexes: [2],
    explanation: "The workbook's reference table routes the 3-day/6-hour, burn-rate-1 combination (10% of budget) to a ticket, since it's real but not urgent enough to wake anyone up. Both the 14.4x/1-hour-plus-5-minute pairing and the 6x/6-hour-plus-30-minute pairing route to a page instead, and the bare 36x/1-hour figure without any confirmation window belongs to an earlier, single-window iteration the workbook does not end up recommending.",
  },
  {
    id: 'monitoring-022',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: 'A service receiving only about 10 requests per hour has a 99.9% SLO. What happens if a single one of those requests fails?',
    options: [
      'Nothing happens, because burn-rate alerting is specifically defined to ignore any evaluation window that contains fewer than 100 total requests',
      'It automatically becomes a ticket rather than a page, since low-traffic services of this kind are exempted from ever paging anyone by definition',
      "The service's SLO is automatically and permanently recalculated down to 99% availability until its traffic volume eventually recovers on its own",
      'That single failure alone produces roughly a 1,000x burn-rate spike, enough to trigger a page right away, since it works out to a 10% hourly error rate against a 0.1% budget',
    ],
    correctIndexes: [3],
    explanation: "A single failure out of ten requests in an hour is a 10% hourly error rate, which against a 99.9% SLO's 0.1% budget works out to roughly a 1,000x burn rate — enough to page immediately even though it might just be one client hitting a transient, uninteresting failure. There's no built-in request-count floor that suppresses burn-rate alerting, no automatic exemption routing low-traffic pages to tickets, and no automatic SLO recalculation described anywhere in this material.",
  },
  {
    id: 'monitoring-023',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: "For a service with a 99.999% monthly availability target, a complete outage exhausts the entire error budget in about 26 seconds — faster than most monitoring pipelines can detect, notify, and get a human to act. What does the workbook conclude follows from this?",
    options: [
      'Burn-rate alerting alone cannot defend that level of reliability; the system needs to be designed so a total outage is inherently unlikely in the first place',
      'The page threshold should simply be tightened from 14.4x sustained over one hour down to 14.4x sustained over a 26-second window instead, to compensate for the shorter time to exhaustion',
      'A 99.999% target is mathematically impossible to alert on in any way and should therefore never be set as an SLO for any service at all',
      'The fix is to abandon burn-rate alerting entirely for extremely reliable services and switch back to the naive, already-rejected short-window error-rate approach instead',
    ],
    correctIndexes: [0],
    explanation: "The workbook's actual conclusion is that alerting speed alone can't save a service at this reliability level, so the real defense is architectural — designing the system so a total outage is inherently unlikely in the first place, such as by rolling out changes to a small percentage of traffic at a time. It never proposes shrinking the alert window to 26 seconds, never claims the target itself is impossible to set, and never recommends reverting to the earlier, already-rejected naive threshold approach.",
  },
  // --- Sub-theme: Observability Over Time (Dashboards and Time Horizons) ---
  {
    id: 'monitoring-024',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: 'Per the workbook, roughly how stale can alerting data be before it starts to meaningfully slow down how quickly a system pages someone?',
    options: [
      'More than about thirty seconds',
      'More than about four to five minutes',
      'More than about two hours',
      'More than about twenty-four hours',
    ],
    correctIndexes: [1],
    explanation: "The workbook puts the practical threshold at around four to five minutes of staleness before it starts to significantly impact response speed. Thirty seconds is far stricter than what the workbook actually states, while two hours and twenty-four hours are both far too lax for data meant to drive near-real-time alerting.",
  },
  {
    id: 'monitoring-025',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: "For long-term trend analysis — say, tracking how fast a database is growing — what does the workbook say about the resolution of data a monitoring system needs to retain?",
    options: [
      'Every individual raw data point must be retained at full original resolution for at least a full calendar year, or the resulting long-term trend analysis becomes statistically invalid',
      'Only the single most recent data point from each day needs to be kept, since trend analysis only cares about day-over-day deltas',
      "It should retain data over a multimonth timeframe, but coarser, aggregated summary data is generally sufficient — every individual data point doesn't need to survive at full resolution",
      'Long-term trend data should be discarded entirely after 30 days to control storage cost, since burn-rate alerting already needs that same window',
    ],
    correctIndexes: [2],
    explanation: "The workbook recommends a multimonth retention window while explicitly noting that coarser summary data — not full per-point detail — is enough to support growth planning. It never demands a full year of untouched raw resolution, never suggests collapsing history down to one point per day, and treating 30-day burn-rate windows as a reason to discard longer-term trend data conflates two genuinely separate monitoring needs.",
  },
  {
    id: 'monitoring-026',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: "The workbook recommends against building a separate log-based alerting path just to catch a single rare event that needs to page someone. What does it recommend doing instead?",
    options: [
      'Add a counter metric that increments whenever that event happens and alert on the metric instead, keeping every alert defined inside one consistent, metrics-based system',
      'Build a dedicated, parallel log-based alerting pipeline specifically for rare events, since metrics pipelines are described as fundamentally too slow and coarse to ever reliably catch them',
      'Route the rare event straight to a ticket queue rather than a page, since a rare event can never by definition be significant enough to justify paging someone',
      'Configure the logging system to email the on-call engineer directly, bypassing the alerting and dashboard system entirely',
    ],
    correctIndexes: [0],
    explanation: "The workbook's actual advice is to increment a purpose-built counter metric on the rare event and alert on that metric, so every alert stays managed inside one system rather than splitting alert logic across metrics and logs. It never claims metrics pipelines are too slow for this use case, never argues rarity alone disqualifies something from paging, and never suggests routing around the alerting and dashboard system with a direct email.",
  },
  {
    id: 'monitoring-027',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: "The workbook recommends displaying the same types of data consistently across a team's dashboards. What benefit does it specifically tie to that kind of consistency across different teams?",
    options: [
      'Most dashboarding tools are technically incapable of rendering more than one chart type across an organization, so consistency is a technical necessity rather than a choice',
      "Inconsistent formatting between different teams' dashboards is described as the leading trigger of false-positive alerts across Google",
      'A single, consistent layout is described as a compliance requirement that most external audit frameworks impose on production monitoring systems',
      "Being able to read a colleague team's dashboard on sight speeds up debugging on both sides — your own incidents and theirs alike",
    ],
    correctIndexes: [3],
    explanation: "The workbook ties cross-team consistency directly to speed: understanding another team's dashboard format lets you debug both your own problems and theirs faster. It doesn't attribute the practice to a tooling limitation, to false-positive alert rates, or to any external audit or compliance mandate.",
  },
  {
    id: 'monitoring-028',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: "The workbook notes that an SLO dashboard alone typically can't explain why a violation is happening. What does it recommend pairing that dashboard with?",
    options: [
      "A live video feed of the on-call engineer's terminal so other team members can watch the debugging process unfold in real time",
      'A second, entirely independent copy of the same SLO dashboard, configured with a shorter refresh interval',
      "Secondary panels covering the service's own recent binary and configuration changes, plus the golden-signal health of its direct dependencies",
      'A complete historical archive of every postmortem the service has ever had, linked directly from the dashboard\'s landing page',
    ],
    correctIndexes: [2],
    explanation: "The workbook's recommendation is to pair the SLO summary with panels tracking the service's own intended changes (binary version, flags, dynamic configuration) and with dependency panels covering request/response size, latency, and response codes for each direct dependency — the same golden-signal framing applied one layer down. A terminal video feed, a duplicated dashboard with a faster refresh, and a postmortem archive are not among the panels it recommends.",
  },
  {
    id: 'monitoring-029',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: "Bigtable's SRE team once based its SLO on mean request latency, and a heavy tail dragged that mean around enough to trigger constant email and paging alerts. What was the actual fix described in the case study?",
    options: [
      'Adding an even more sophisticated layer of additional alerting rules on top of the existing mean-latency alert, specifically to catch the heavy tail more precisely going forward',
      'Temporarily loosening the target to use 75th-percentile latency instead of the mean, and disabling the noisy email alerts entirely — buying breathing room to fix the underlying storage-stack problems',
      "Switching the SLO's target metric from latency to raw requests-per-second throughput instead",
      'Immediately expanding the on-call rotation so more engineers could triage the growing volume of alerts in parallel',
    ],
    correctIndexes: [1],
    explanation: "The case study's actual fix ran the opposite direction from adding more alerting: the team temporarily dialed back the SLO target to the 75th percentile and turned off the noisy email alerts, which bought the breathing room needed to fix Bigtable's underlying storage-stack problems instead of firefighting them indefinitely. Layering on more alerting sophistication, swapping the target metric to throughput, and simply adding more on-call staff are not what the case study describes happening.",
  },
  {
    id: 'monitoring-030',
    domain: 'monitoring',
    questionType: 'multiple-choice',
    question: "Early Gmail's monitoring paged whenever individual backend tasks were 'descheduled' — unmanageable across many thousands of tasks. What tension did the book say the resulting debate over automating a fix actually reflected?",
    options: [
      'A disagreement over which programming language the automation script ought to be written in',
      'A disagreement over whether Workqueue or a wholly different scheduler should replace the existing one going forward',
      "A dispute over whether ownership of the fix should stay with the Gmail team or be transferred entirely over to Google's central SRE monitoring organization instead",
      'An underlying question of whether the team trusted its own self-discipline to eventually build a durable, real fix rather than let a patched-over workaround quietly become permanent technical debt',
    ],
    correctIndexes: [3],
    explanation: "The book frames the debate as really being about trust: whether the team believed it would follow through on a proper long-term fix once the immediate pain of paging subsided, versus the workaround becoming permanent, unmaintainable technical debt. It wasn't framed as a language choice for the automation script, a scheduler-replacement decision, or an ownership dispute between teams.",
  },
  {
    id: 'monitoring-031',
    domain: 'monitoring',
    questionType: 'multiple-response',
    question: 'Which of the following accurately describe the distinction the workbook draws between metrics meant for alerting and metrics meant for debugging? (Select all that apply.)',
    options: [
      'A good alerting metric should barely move at all except when the system is genuinely in a problem state',
      'Debugging metrics must always be derived from logs, while alerting metrics must always be derived from raw counters',
      "A debugging metric is expected to fluctuate constantly under normal conditions, and its purpose is to point toward whatever is causing that fluctuation",
      'When writing a postmortem, thinking about which additional metrics would have let you diagnose the issue faster is one of the concrete practices the workbook recommends',
      'A metric that fluctuates constantly under normal operation is, by definition, poorly designed and should be redesigned to stay flat',
    ],
    correctIndexes: [0, 2, 3],
    explanation: "The workbook draws exactly this line: an alerting metric is meant to stay quiet except when something is genuinely wrong, a debugging metric is expected to move around and its job is to point at what's fluctuating, and it explicitly suggests using postmortems to ask which extra metrics would have sped up diagnosis. It never mandates that debugging metrics come only from logs or alerting metrics only from counters, and a metric that fluctuates under normal conditions isn't automatically labeled poorly designed — that's simply what a debugging metric is supposed to do.",
  },
  // --- Sub-theme: On-Call Health, Escalation & Readiness ---
  {
    id: 'incidents-001',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: "Per the SRE book's Being On-Call chapter, what are the standard target response times for a page?",
    options: [
      'Fifteen minutes for every paging alert, regardless of how time-critical the affected service is',
      'One hour for any service whose availability target is below 99.9%',
      'Thirty minutes for user-facing services and five minutes for internal, non-customer-facing systems, on the theory that internal tooling failures always deserve the faster reaction',
      "A five-minute reaction window when the affected service is user-facing or otherwise urgent, loosening to roughly half an hour when it isn't",
    ],
    correctIndexes: [3],
    explanation: "The chapter's own figures are 5 minutes for anything user-facing or highly time-critical, and 30 minutes for calmer systems, tied to the observation that a 4-nines quarterly downtime budget is only about 13 minutes. The 30-and-5 option simply reverses which figure applies to which kind of service, and neither the flat 15-minute nor the 1-hour-by-availability-tier option appears in the chapter.",
  },
  {
    id: 'incidents-002',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: "The SRE book notes that handling one on-call incident end to end, including follow-up, averages about six hours, which works out to roughly two incidents per 12-hour shift. What is this figure best understood as?",
    options: [
      'A hard ceiling: on-call engineers are instructed to stop acknowledging new pages once they have handled two incidents in a shift',
      'A fixed quota used to determine how many additional engineers must be hired to a rotation every quarter',
      'The number of incidents after which writing a postmortem stops being required, since further ones are assumed to share the same cause',
      "A capacity-planning heuristic for judging whether a rotation's workload has become unsustainable, not a rule to refuse further pages",
    ],
    correctIndexes: [3],
    explanation: "The book frames exceeding this figure as a signal that \"corrective measures should be put in place,\" not as a refusal threshold — and the workbook's own overload scenario shows a team whose budget of two per shift was regularly exceeded (up to five), with the response being an escalation for a dedicated fix-it project, not a refusal to handle pages. Nothing in either book ties this number to an automatic postmortem cutoff or a hiring formula.",
  },
  {
    id: 'incidents-003',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: "Working from the SRE book's 25%-of-time on-call cap, a primary-plus-secondary rotation, and week-long shifts, what minimum team size does the book derive for a single-site team to sustain 24/7 on-call?",
    options: [
      'Four engineers',
      'Six engineers',
      'Eight engineers',
      'Twelve engineers',
    ],
    correctIndexes: [2],
    explanation: "The book works through this exact calculation and arrives at eight engineers for a single-site team. Six is the figure it derives for a dual-site team instead, since splitting coverage across two sites reduces the load on each; four is too small to sustain even one rotation slot under the 25% cap, and twelve overshoots what the stated constraints require.",
  },
  {
    id: 'incidents-004',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: 'What does the workbook recommend as a maximum on-call shift length, and why?',
    options: [
      'Twenty-four hours, since a single daily handoff minimizes context-switching between engineers and keeps the rotation calendar easiest to administer',
      'One week, matching the rotation length itself, with no shorter shift boundary inside it',
      'Forty-eight hours, provided the engineer is permitted to sleep through any non-paging alerts',
      'Twelve hours, because longer shifts risk exhaustion-driven mistakes — even an overnight 12-hour shift beats a 24-hour one',
    ],
    correctIndexes: [3],
    explanation: 'The workbook recommends limiting shifts to 12 hours because team members risk exhaustion on longer shifts and tired people make mistakes, explicitly stating that continuous on-call duty without reprieve is not a sustainable setup. It never endorses a 24-hour, 48-hour, or week-long unbroken shift as the maximum.',
  },
  {
    id: 'incidents-005',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: 'The SRE book warns about "operational underload" alongside overload. What does it recommend to counter this risk?',
    options: [
      'Sizing teams so each engineer takes on-call rotations only rarely, roughly once a year, in order to maximize uninterrupted, distraction-free project time for the whole team',
      'Sizing teams so every engineer takes on-call duty every single week, ensuring constant familiarity with production',
      'Sizing teams so each engineer gets some on-call exposure a couple of times per quarter at minimum, plus exercises like Wheel of Misfortune and DiRT',
      "Rotating engineers permanently off on-call after their first full year of service, to prevent long-term burnout",
    ],
    correctIndexes: [2],
    explanation: "The chapter's \"Treacherous Enemy\" section on underload warns that being out of touch with production for too long causes confidence and knowledge gaps, and recommends sizing teams so every engineer gets at least occasional on-call exposure each quarter, supplemented with Wheel of Misfortune role-play and company-wide disaster-recovery testing. Once-a-year exposure is too infrequent for what it recommends, weekly rotation for everyone isn't the prescription given, and there's no mention of a permanent one-year opt-out.",
  },
  {
    id: 'incidents-006',
    domain: 'incidents',
    questionType: 'multiple-response',
    question: 'Per the SRE book, which of the following does it list as resources engineers can lean on to make on-call feel more manageable? (Select all that apply.)',
    options: [
      'Clear escalation paths',
      'A guaranteed maximum of two incidents per shift, technically enforced by the paging system itself',
      'Well-defined incident-management procedures',
      "Standing authority to override changes made by any other team's on-call engineer without consultation",
      'A blameless postmortem culture',
    ],
    correctIndexes: [0, 2, 4],
    explanation: "The book names exactly these three as the most important on-call resources, alongside noting that partner developer teams are always available to escalate to. There is no paging-system-enforced incident cap — the roughly-two-per-shift figure is a staffing heuristic, not a technical cutoff — and on-call engineers are never described as holding unilateral override authority over other teams' systems.",
  },
  // --- Sub-theme: Incident Command: Roles & Coordination ---
  {
    id: 'incidents-007',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: "Per the SRE book's Managing Incidents chapter, which four roles does a well-managed incident delegate among responders?",
    options: [
      'Incident Command, Operational Work, Communication, and Planning',
      'Incident Commander, Scribe, Liaison, and Technical Lead',
      'Incident Commander, Communications Lead, and Operations Lead — the chapter names only three roles',
      'Triage Lead, Mitigation Lead, Root-Cause Lead, and Reporting Lead',
    ],
    correctIndexes: [0],
    explanation: "The chapter's \"Elements of Incident Management Process\" section names exactly Incident Command, Operational Work, Communication, and Planning as the roles to delegate, with the commander holding any role not yet assigned. The three-role framing belongs to the separate Workbook chapter, not this one, and neither the Scribe/Liaison/Technical-Lead nor the Triage/Mitigation/Root-Cause/Reporting groupings appear in this chapter at all.",
  },
  {
    id: 'incidents-008',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: "Per the SRE Workbook's Incident Response chapter, how many main, named incident-response roles does it describe, and what are they organized around?",
    options: [
      'Four roles — Incident Commander, Operations Lead, Communications Lead, and Planning Lead — each formally reporting up through the Incident Commander',
      'Two roles — an Incident Commander and a single, generic Responder — with no further subdivision',
      'Five roles, one assigned to each stage of the incident lifecycle it defines',
      'Three roles — Incident Commander, Operations Lead, and Communications Lead — organized around coordinating, communicating, and maintaining control',
    ],
    correctIndexes: [3],
    explanation: "The Workbook explicitly names the Incident Commander, Operations (or Ops) Lead, and Communications Lead as its \"Main Roles in Incident Response,\" organized around the \"three Cs\" of coordinating the response, communicating, and maintaining control. This is a genuine difference from the original SRE book's own Managing Incidents chapter, which separately names four roles including Planning — both counts are correct for their respective source, not a contradiction to be silently resolved.",
  },
  {
    id: 'incidents-009',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: "Per the SRE book, what happens to any incident-response role that the Incident Commander has not explicitly delegated to someone else?",
    options: [
      'It goes unfilled until a responder happens to volunteer for it',
      'It is automatically assigned to whichever responder joined the incident channel most recently',
      'The Incident Commander holds that role by default',
      "The role is escalated straight to senior management until someone accepts it",
    ],
    correctIndexes: [2],
    explanation: "The book states the commander holds, de facto, all positions they have not delegated. Leaving a role unfilled, auto-assigning it to the newest arrival, and escalating it to management are none of them how the chapter describes undelegated roles being handled.",
  },
  {
    id: 'incidents-010',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: 'The SRE book\'s account of an unmanaged incident highlights "freelancing" — an engineer making an uncoordinated production change — as a hazard. Which practice does its incident-management framework use to guard against it?',
    options: [
      'Confining all live changes to the system, for the duration of the incident, to a single designated operations function',
      "Requiring every production change to be approved in writing by the Incident Commander's manager first",
      'Disabling all engineers\' production access for the entire duration of any declared incident',
      "Assigning a second, redundant Ops Lead whose sole job is double-checking the first Ops Lead's changes",
    ],
    correctIndexes: [0],
    explanation: "The book's own stated guard is limiting who may touch the live system during an incident to a single operations function, rather than letting anyone with an idea push a change — exactly the kind of uncoordinated move (Malcolm's unreviewed CPU-affinity tweak) that made the unmanaged scenario worse. Written manager sign-off, a blanket access lockout, and a duplicate Ops Lead aren't part of the framework the chapter describes.",
  },
  {
    id: 'incidents-011',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: 'What does the SRE book say should happen when an Incident Commander hands off their role to someone else?',
    options: [
      'The handoff can be inferred from the on-call roster and shift schedule, so no explicit statement between the two people is ever required',
      'The handoff only becomes valid once the Communications Lead has separately approved it',
      'The outgoing commander makes an explicit statement of handoff and waits for firm acknowledgment before leaving the call',
      "The incident is automatically paused for a fixed period to give the new commander time to read the incident document",
    ],
    correctIndexes: [2],
    explanation: 'The book insists on an explicit statement of handoff, with the outgoing commander not leaving the call until receiving firm acknowledgment — the opposite of an inferred, roster-based handoff. Comms Lead approval and an automatic incident pause are not part of the handoff procedure it describes.',
  },
  {
    id: 'incidents-012',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: "In the workbook's GKE CreateCluster case study, what is a \"generic mitigation\"?",
    options: [
      'A permanent architectural fix that a team applies only once its root cause has been fully understood, reviewed, and formally signed off on by every affected team involved',
      "A checklist item confirming that a postmortem's action items have all been closed out",
      "An action, like a rollback or a regional traffic drain, that relieves user pain before the root cause is known, even though it's blunt",
      'The default role assignment an Incident Commander falls back to using whenever nobody else is available to staff Ops or Comms',
    ],
    correctIndexes: [2],
    explanation: 'The case study defines generic mitigations as broadly applicable, blunt-instrument actions — like rollback or draining a region — that first responders can reach for once they know roughly where the problem lives, well before the precise cause is understood. It is explicitly not a fix applied only after the cause is confirmed, a postmortem checklist item, or a fallback role assignment.',
  },
  {
    id: 'incidents-013',
    domain: 'incidents',
    questionType: 'multiple-response',
    question: 'Per the workbook, once an incident has been declared and responders are actively working it, which of these correctly describe the recommended order of activities? (Select all that apply.)',
    options: [
      'Root-cause analysis is always completed in full before any mitigation step may be attempted',
      "Assessing the incident's impact comes before mitigating it",
      "Mitigation can be skipped entirely if responders are confident the root cause will be found quickly",
      'Mitigating the impact comes before performing root-cause analysis',
      'Writing and publishing the postmortem happens only after the incident is over and the underlying cause has been fixed',
    ],
    correctIndexes: [1, 3, 4],
    explanation: 'The chapter\'s own ordered list runs assess impact, mitigate impact, perform root-cause analysis, then — once the incident is over — fix the underlying cause and write the postmortem, with explicit emphasis that responders "must prioritize mitigation above all else." That directly rules out finishing root-cause analysis before any mitigation, and rules out treating mitigation as skippable: customers care that the errors stop, not whether the cause is already understood.',
  },
  {
    id: 'incidents-014',
    domain: 'incidents',
    questionType: 'multiple-response',
    question: 'Which of the following appear among the SRE book\'s "Best Practices for Incident Management"? (Select all that apply.)',
    options: [
      'Trust: give full autonomy within an assigned role to all incident participants',
      'Escalate immediately: any responder who is not completely certain of the next step should hand command to a more senior engineer at once',
      'Specialize: always assign the same person to the same role in every incident so their expertise deepens over time',
      'Introspect: pay attention to your own emotional state, and ask for more support if you start to feel overwhelmed',
      'Change it around: take on a different incident-response role than you held last time, so the whole team gets familiar with every role',
    ],
    correctIndexes: [0, 3, 4],
    explanation: 'The book\'s list includes Prioritize, Prepare, Trust, Introspect, Consider Alternatives, Practice, and "Change it around" — the last of which explicitly recommends rotating who plays which role between incidents, the opposite of always specializing one person into one role. Immediately escalating command over any moment of uncertainty isn\'t on the list either; the book instead emphasizes trusting responders with autonomy inside their assigned role.',
  },
  // --- Sub-theme: Incident Communication & Declaration ---
  {
    id: 'incidents-015',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: "Per the SRE book's Managing Incidents chapter, which of the following is NOT one of its three broad guidelines for deciding whether an event counts as an incident?",
    options: [
      'Whether a second team needs to be involved in fixing the problem',
      'Whether the outage is visible to customers',
      "Whether the issue remains unsolved even after an hour's concentrated analysis by the on-call engineer and anyone else pulled in to help",
      'Whether the affected component has already been classified at a SEV-2 severity level or higher',
    ],
    correctIndexes: [3],
    explanation: "The book's own three guidelines are exactly the second-team, customer-visibility, and unsolved-after-an-hour questions. Neither this chapter nor the Workbook's Incident Response chapter ever defines a numbered SEV-scale for making this call — a SEV-2-or-higher trigger is simply not part of either book's incident-declaration vocabulary.",
  },
  {
    id: 'incidents-016',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: 'In the workbook\'s "Lights Are On but No One\'s Home" Google Home case study, what was the central lesson drawn from the team\'s failure to declare an incident early?',
    options: [
      'That declaring early would have avoided the client/server miscommunication, rather than relying on off-hours volunteers',
      'That the underlying bug was ultimately unfixable, so no incident-response process could have changed the outcome',
      "That the incident should have been declared immediately, but only because Google's SLA with Google Home customers legally required it",
      "That the support team's bug-priority rating was correct throughout, and the real failure was purely in one on-call engineer's debugging skill",
    ],
    correctIndexes: [0],
    explanation: "The review explicitly ties the delayed declaration to avoidable miscommunication between client and server developers, slower root-cause identification, and the awkward reliance on developers pitching in unpaid over a weekend rather than a properly staffed rotation — not to the bug being unfixable, a contractual SLA obligation, or one engineer's debugging competence.",
  },
  {
    id: 'incidents-017',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: "What does the SRE book identify as the Incident Commander's single most important responsibility during an incident?",
    options: [
      'Personally writing every line of the eventual postmortem before the incident is even closed',
      'Keeping a living incident document that is later retained for postmortem analysis',
      'Approving every individual command any responder runs against production before it executes',
      "Selecting which external vendor's status page will be used to notify customers",
    ],
    correctIndexes: [1],
    explanation: "The chapter states plainly that keeping this living document is the commander's most important responsibility — ideally editable by several people concurrently, and retained afterward for postmortem (and if needed, meta) analysis. Pre-writing the postmortem, approving each individual command, and picking a vendor status page are not described as IC duties.",
  },
  {
    id: 'incidents-018',
    domain: 'incidents',
    questionType: 'multiple-response',
    question: 'In the workbook\'s Belgium power-outage case study, which audiences did the Communications Lead need to keep informed, each with different information needs? (Select all that apply.)',
    options: [
      'Company leadership, who needed assurance the problem was being addressed',
      'Teams with storage concerns, who needed an estimate for when their storage capacity would return to normal',
      "External customers, who needed proactive notice about the disk problem affecting their cloud region",
      'Customers who had already filed support tickets, who needed specific workaround and timeline information',
      'The hardware vendor that manufactured the failed UPS batteries, who needed a formal defect report before the incident could be closed',
    ],
    correctIndexes: [0, 1, 2, 3],
    explanation: "The case study lists exactly these four audiences — leadership, internal teams with storage concerns, external customers broadly, and customers with open support tickets — each needing distinct information from the Communications Lead. A formal vendor defect report isn't described as part of the Comms Lead's in-incident communication duties.",
  },
  {
    id: 'incidents-019',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: 'The workbook recommends preparing several things about incident response before any incident occurs. Which of these is explicitly among that advance preparation?',
    options: [
      'A predetermined communication channel, a prepared list of contacts, and established criteria for what counts as an incident',
      'A permanent, standing war room booked indefinitely on every team\'s calendar',
      'A rule that every incident must be handled exclusively by whichever engineer has the most years of seniority available at the time',
      'A single, universal severity number applied identically across every team and product at the company',
    ],
    correctIndexes: [0],
    explanation: '"Prepare Beforehand" explicitly recommends deciding on a communication channel, preparing a contact list, and establishing incident criteria ahead of time, each illustrated with a concrete example drawn from the chapter\'s own case studies. A permanently booked war room, mandatory-seniority staffing, and one universal severity number appear nowhere in its recommendations.',
  },
  {
    id: 'incidents-020',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: 'Per the SRE book, why has Google found a real-time channel like IRC valuable for incident response?',
    options: [
      'It provides a reliable log of communications useful for postmortem analysis, and lets geographically distributed teams coordinate',
      'It is the only tool capable of paging the developer on-call, since email and phone paging are both considered too unreliable to depend on',
      "It automatically generates a postmortem's action items without requiring any human review",
      'It replaces the need for a separate living incident document entirely, since the chat log itself becomes the record',
    ],
    correctIndexes: [0],
    explanation: 'The book credits IRC specifically with being a reliable, log-able channel useful for postmortem analysis and for coordinating distributed teams — while still recommending a separate living incident document rather than treating the chat transcript as a substitute for one. It never claims IRC is the sole paging mechanism or that it auto-generates action items.',
  },
  // --- Sub-theme: Blameless Postmortems & Organizational Learning ---
  {
    id: 'incidents-021',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: "Ben Treynor Sloss is quoted in the workbook making the point that a postmortem which produces no follow-up is, to users, no different from never having written one, and that every user-affecting postmortem needs at least one tracking bug behind it. What does this best illustrate about \"blameless\" postmortems?",
    options: [
      'That being blameless means no specific person\'s actions are ever documented anywhere in a postmortem, even factually',
      'That blameless culture removes the need for any follow-up action at all, since simply documenting the incident is considered sufficient on its own',
      "That blamelessness means not punishing the people who took the actions, not skipping accountability — action items still need real, tracked owners",
      'That writing a postmortem is optional unless a customer specifically files a complaint about the incident',
    ],
    correctIndexes: [2],
    explanation: "Removing blame from people is separate from removing accountability for fixing things: the whole point of the quote is that a postmortem is worthless without at least one owned, tracked bug driving real change, and action items in the good example all carry named owners. Postmortems still record what happened factually (timelines name who did what) — blamelessness governs whether that record is used to punish someone, which rules out the claim that individual actions are never documented at all. Follow-up isn't optional, which rules out the claim that documentation alone is sufficient, and postmortems are triggered by defined criteria or a stakeholder's request rather than only by a customer complaint.",
  },
  {
    id: 'incidents-022',
    domain: 'incidents',
    questionType: 'multiple-response',
    question: 'Per the SRE book, which of the following are listed as common postmortem triggers? (Select all that apply.)',
    options: [
      "Downtime or degraded service that's visible to users and crosses some agreed-upon threshold",
      'Data loss of any kind',
      'On-call engineer intervention, such as a release rollback or rerouting of traffic',
      'Any incident where the on-call engineer personally feels they made a mistake, regardless of user impact',
      'A monitoring failure, since that usually implies the incident was discovered manually',
    ],
    correctIndexes: [0, 1, 2, 4],
    explanation: "The book's list of common triggers covers user-visible downtime or degradation past a threshold, data loss, on-call intervention like a rollback or reroute, a resolution time above some threshold, and a monitoring failure implying manual discovery. A postmortem is triggered by these objective criteria (or by any stakeholder's request) — not by an engineer's private, unshared sense that they personally erred.",
  },
  {
    id: 'incidents-023',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: 'The workbook\'s "bad" postmortem example includes the action item "Train humans not to run unsafe commands." Why does the workbook flag this as a weak action item?',
    options: [
      'Because it lacks a tracking bug number, which is presented as the only thing wrong with it',
      "Because a person's behavior is generally harder to change reliably through training than an automated system or process is to fix",
      'Because action items about training sessions are against company policy and can never legally appear anywhere in any postmortem document at all',
      'Because the item was assigned to a team with no involvement in the original incident at all',
    ],
    correctIndexes: [1],
    explanation: "The workbook singles out this item as the example's one \"preventative\" action item and criticizes it specifically for trying to change human behavior rather than fixing the underlying system or process — a separate flaw from the vague \"Improve\"/\"Make better\" phrasing it criticizes elsewhere in the same example, and from the missing-tracking-bug problem several other items share too. Training-related items aren't banned outright, and the critique has nothing to do with which team the item was assigned to.",
  },
  {
    id: 'incidents-024',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: 'Per the SRE book, which of these is one of the review criteria senior engineers apply when assessing a draft postmortem?',
    options: [
      'Whether the root cause was sufficiently deep, and whether the resulting bug fixes are at an appropriate priority',
      "Whether the postmortem's author has personally closed every single action item before the draft is even allowed to be reviewed",
      'Whether the postmortem was published within 24 hours of the incident closing, with no exceptions permitted',
      'Whether the postmortem includes a severity rating consistent with a companywide numbered SEV scale',
    ],
    correctIndexes: [0],
    explanation: "The book's listed review criteria are whether key incident data was captured, whether impact assessments are complete, whether the root cause was sufficiently deep, whether the action plan and its priorities are appropriate, and whether the outcome was shared with stakeholders. Requiring every action item closed before review even begins, a strict 24-hour deadline, and a numbered SEV rating appear in none of these criteria.",
  },
  {
    id: 'incidents-025',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: 'Which of the following is one of the concrete activities the SRE book describes Google using to reinforce a postmortem culture?',
    options: [
      'Deducting a bonus from any team that produces more postmortems than a set annual limit',
      "\"Wheel of Misfortune\" exercises, where engineers reenact a past incident with the original incident commander in attendance",
      'A mandatory pop quiz on system architecture immediately following any high-severity incident',
      'Automatically publicizing the name of whichever engineer gets named most often across a quarter of postmortem root-cause sections',
    ],
    correctIndexes: [1],
    explanation: "The book describes several such activities — a \"postmortem of the month\" newsletter feature, a discussion group, postmortem reading clubs, and Wheel of Misfortune reenactments with the original incident commander present. It explicitly warns against stigmatizing frequent postmortem producers, which rules out the bonus-deduction option, and neither a mandatory quiz nor public naming of an individual appears anywhere in the chapter.",
  },
  {
    id: 'incidents-026',
    domain: 'incidents',
    questionType: 'multiple-choice',
    question: 'What does the SRE book mean by its best practice "No Postmortem Left Unreviewed"?',
    options: [
      'That every postmortem draft must pass a formal legal and compliance review before any internal sharing of it is ever permitted',
      'That postmortems may be reviewed exclusively by the incident commander who led the response, with no other reviewers permitted',
      'That an unreviewed postmortem draft might as well not exist, so regular review sessions should close out discussion and finalize it',
      'That review is optional but strongly encouraged, and only for postmortems tied to revenue-impacting incidents',
    ],
    correctIndexes: [2],
    explanation: "The book's own framing is that a draft nobody reviews is functionally worthless, and it recommends regular review sessions to close out discussion, capture ideas, and finalize the document's state before it's shared more broadly. A formal legal-review gate, IC-exclusive reviewership, and revenue-based optionality are not part of this practice.",
  },
  // --- Sub-theme: Load Balancing Layers ---
  {
    id: 'capacity-001',
    domain: 'capacity',
    questionType: 'multiple-choice',
    question:
      "The SRE book's chapter on frontend load balancing points out a hard technical ceiling on plain DNS-based load balancing, independent of how clever the resolver logic gets. What is it?",
    options: [
      'A single DNS reply is capped at 512 bytes by RFC 1035, which bounds how many addresses it can list',
      'Authoritative nameservers are contractually barred by the DNS specification from ever returning more than one single IP address per client query',
      'Recursive resolvers are required by the DNS specification to completely disregard any TTL value an authoritative nameserver sets below 300 seconds',
      'Client operating systems are hardcoded to reject any DNS reply that originates from a nameserver using an anycast address',
    ],
    correctIndexes: [0],
    explanation:
      "The chapter notes that DNS replies must fit within the 512-byte limit set by RFC 1035, which caps the number of addresses a single reply can carry — almost certainly fewer than a service's actual server count, which is why DNS alone can't fully solve frontend load balancing. Returning multiple A/AAAA records in one reply is exactly the simple technique the chapter describes, so replies aren't limited to a single address; there's no such TTL-ignoring rule, and anycast nameservers are actually one of the techniques used to help DNS load balancing, not something clients reject.",
  },
  {
    id: 'capacity-002',
    domain: 'capacity',
    questionType: 'multiple-choice',
    question:
      "In the SRE book's discussion of load balancing at the virtual IP (VIP), a naive scheme picks a backend for a new connection using `id(packet) mod N`. What breaks this scheme as soon as a single backend is removed from the pool?",
    options: [
      'The load balancer must fully renegotiate and reassign a brand-new virtual IP address to every single remaining backend before any further traffic can be routed at all',
      'The 512-byte DNS reply limit prevents the load balancer from advertising the reduced backend count to resolvers',
      'N drops to N-1, so the modulo operation remaps nearly every packet to a different backend, forcing almost all existing connections to reset',
      'Backends automatically switch from TCP to UDP whenever the pool size changes, which most stateful client protocols cannot parse',
    ],
    correctIndexes: [2],
    explanation:
      "Losing one backend turns the divisor N into N-1, so id(packet) mod N now points almost every packet at a different backend than before — resetting nearly all existing connections even though only one machine actually failed. This is exactly the problem consistent hashing was later adopted to avoid. Nothing in the scheme involves renegotiating VIP addresses, the unrelated 512-byte figure is a DNS-reply limit from a different section of the chapter, and there's no automatic TCP-to-UDP switch tied to pool size changes.",
  },
  {
    id: 'capacity-003',
    domain: 'capacity',
    questionType: 'multiple-response',
    question:
      'Which of the following are real reasons the SRE book gives for why Simple (unweighted) Round Robin load balancing in the datacenter can leave a roughly 2x spread between the least- and most-loaded backend tasks? Select all that apply.',
    options: [
      "Clients using small subsets don't all issue requests at the same rate, so backends assigned to the busiest clients end up more loaded",
      'Every forwarded packet carries a mandatory GRE encryption header that some backends must spend extra CPU decrypting',
      'The cost of individual queries can vary enormously — in some services the priciest requests cost roughly a thousand times more CPU than the cheapest',
      "Machines in the same datacenter aren't necessarily identical, so the same request can represent very different amounts of work depending on which machine handles it",
      'Backends are contractually guaranteed to receive an identical lifetime total of requests, which Round Robin cannot satisfy',
      "Unpredictable factors, like noisy neighbor processes competing for shared resources or newly restarted tasks running less efficiently, can't be accounted for statically",
    ],
    correctIndexes: [0, 2, 3, 5],
    explanation:
      "The chapter lists four real causes of Round Robin's imbalance: small subsetting (clients don't all send at the same rate), wide variance in per-query cost, machine diversity (heterogeneous hardware in one datacenter), and unpredictable performance factors such as antagonistic neighbors and task restarts. GRE encapsulation is a real Google technique, but it's about how VIP load balancers forward packets, not about Round Robin's imbalance, and there's no contractual guarantee anywhere in the chapter that every backend receives an identical total request count.",
  },
  {
    id: 'capacity-004',
    domain: 'capacity',
    questionType: 'multiple-choice',
    question:
      'The SRE book explains that Google abandoned random subsetting as a way to pick which backend tasks a client connects to. What made random subsetting impractical?',
    options: [
      'It required every single client to open and tear down a brand-new TCP connection for each individual request instead of reusing any long-lived connections at all',
      'Spreading load evenly with it would have required subset sizes around 75% of all backends — impractically large',
      'It could only be used for stateless protocols like DNS over UDP, never for stateful HTTP traffic',
      'It conflicted with the lame duck shutdown sequence, causing tasks to be killed before they finished draining',
    ],
    correctIndexes: [1],
    explanation:
      "The chapter's own simulation showed that spreading load evenly with random subsetting would need subset sizes around three-quarters of the backend pool — an impractical amount of per-client fan-out — which is why deterministic subsetting (grouping clients into rounds, each with an independently shuffled backend list) was adopted instead. Random subsetting doesn't force a fresh connection per request, isn't restricted to stateless protocols, and has nothing to do with the lame duck shutdown sequence.",
  },
  {
    id: 'capacity-005',
    domain: 'capacity',
    questionType: 'multiple-choice',
    question:
      'The SRE book defines three states a backend task can be in from a client\'s perspective: healthy, refusing connections, and lame duck. What distinguishes the lame duck state from the other two?',
    options: [
      "The task has already crashed outright, and the cluster's job scheduler is now restarting it on an entirely different physical machine",
      'The task is outright refusing any new TCP connection attempts while it finishes either starting up or shutting down cleanly',
      'The task has simply been reassigned to a lower request-criticality tier by the separate adaptive overload-protection system',
      'The task can still handle requests, but it has told its clients to route new traffic elsewhere while it drains',
    ],
    correctIndexes: [3],
    explanation:
      "Lame duck is the quasi-operational state where a task can still serve but has told clients to send new requests elsewhere — this lets it drain in-flight work cleanly during shutdown or maintenance. Refusing connections (unresponsive while starting up, shutting down, or in an abnormal state) is a separate, distinct state described right alongside it, and there's no crash-and-restart state or criticality-tier concept in this particular three-state model.",
  },
  {
    id: 'capacity-006',
    domain: 'capacity',
    questionType: 'multiple-choice',
    question:
      "The SRE Workbook explains that Maglev machines can each pick up any incoming packet for a shared address, since ECMP (Equal-Cost Multi-Path) forwarding spreads that traffic uniformly over the whole pool. Compared to a traditional active/passive hardware load balancer's 1 + 1 redundancy, how does the workbook describe Maglev's resulting redundancy?",
    options: [
      "As N + 1, since ECMP lets any machine in the pool absorb another machine's load rather than relying on one dedicated standby",
      'As N + 2, deliberately matching the same outage-coverage target that this same material uses elsewhere for whole-service capacity planning against outages',
      'As N + 3, to compensate for the extra latency ECMP forwarding introduces',
      'As plain N, since ECMP is described as removing the need for any redundancy margin at all',
    ],
    correctIndexes: [0],
    explanation:
      "The workbook specifically credits ECMP's even packet-spreading with letting Maglev's redundancy be modeled as N + 1, an improvement over a traditional active/passive pair's 1 + 1 redundancy. This is a distinct, narrower claim from the N + 2 target used elsewhere for whole-service capacity planning against a simultaneous planned-plus-unplanned outage — the two figures describe different layers of the stack, not a contradiction. Neither N + 3 nor plain N (no margin at all) appears in this passage.",
  },
  // --- Sub-theme: Demand Forecasting & Capacity Planning ---
  {
    id: 'capacity-007',
    domain: 'capacity',
    questionType: 'multiple-choice',
    question:
      "The SRE book's collection of best practices for production services recommends provisioning capacity in an 'N + 2' configuration. What does that configuration guarantee?",
    options: [
      'N instances alone must be sized generously enough to absorb all of peak traffic even if any single one of those instances unexpectedly goes fully dark, covering only one outage happening at a time',
      'N instances alone are sized to absorb peak traffic even with the three largest instances knocked out simultaneously',
      'Even with its two largest instances down at once, N instances (maybe in a degraded mode) still cover peak traffic — one planned outage and one unplanned outage, simultaneously',
      'Exactly the number of instances already running in production at any given moment must be sufficient entirely on its own, with absolutely no spare capacity held back in reserve for anything',
    ],
    correctIndexes: [2],
    explanation:
      "The best-practices list defines N + 2 specifically as surviving the largest two instances being down at the same time — one planned (e.g., maintenance) and one unplanned (e.g., a failure) — while still serving peak traffic, possibly in a degraded mode. The N+1 option (surviving only a single simultaneous outage) and N+3 option (surviving three) are both real capacity-planning notions in general, just not the one this list names, and the plain-N option describes having no reserve margin at all.",
  },
  {
    id: 'capacity-008',
    domain: 'capacity',
    questionType: 'multiple-choice',
    question:
      "The SRE book's capacity-planning best practices say a team should keep checking its demand forecasts. What is the recommended practice, and why?",
    options: [
      'Continuously compare past forecasts against what actually happened, because a growing gap signals unstable forecasting and a risk of running short on capacity',
      'Discard any forecast older than one fiscal quarter, since only the newest forecast has planning value',
      "Keep reusing whichever forecast was used for the previous year's provisioning, since demand patterns rarely shift",
      "Hand all forecast validation work off entirely to the product development organization, since SRE's stated role here is strictly limited to procuring and racking physical hardware",
    ],
    correctIndexes: [0],
    explanation:
      "This is meant to be an ongoing habit, not a one-time forecast to lock in: keep checking earlier demand predictions against what traffic actually did, since a persistent gap between the two points to a forecasting process that isn't yet trustworthy, wasteful provisioning, and a real chance of coming up short on capacity when it counts. Reusing an old forecast unchanged, discarding forecasts purely by age, and treating validation as entirely someone else's job all run counter to that guidance.",
  },
  {
    id: 'capacity-009',
    domain: 'capacity',
    questionType: 'multiple-response',
    question:
      "Which of the following are capacity-planning practices the SRE book's best-practices list actually recommends? Select all that apply.",
    options: [
      "Always provision for the average of the last four quarters' peak traffic, regardless of any planned launch",
      'Keep checking demand forecasts against what actually happens, and treat any persistent mismatch as a warning sign',
      "Use load testing, rather than relying on past performance, to establish a cluster's current resource-to-capacity ratio",
      'Cap total error-budget spend at a flat 1% per month no matter what SLO a service has committed to',
      "Don't mistake the elevated traffic of a product's launch day for its long-term, steady-state load",
      "Provision so a planned outage and an unplanned outage overlapping at the same time still leave the fleet able to serve peak traffic (an 'N + 2' configuration)",
    ],
    correctIndexes: [1, 2, 4, 5],
    explanation:
      "The best-practices list names four concrete capacity-planning habits: keep validating forecasts against reality, use load testing rather than tradition to size the resource-to-capacity ratio, don't confuse day-one launch traffic with steady state, and provision for N + 2 to survive a simultaneous planned and unplanned outage. Locking in a flat four-quarter average regardless of launches, and a flat 1%-per-month error-budget cap regardless of a service's actual SLO, are both fabricated rules that appear nowhere in the list.",
  },
  {
    id: 'capacity-010',
    domain: 'capacity',
    questionType: 'multiple-choice',
    question:
      "The SRE Workbook's guidance on configuring autoscalers describes them as being deliberately asymmetric. What is that asymmetry?",
    options: [
      "They're deliberately configured to react quickly to any traffic drop in order to save on cost, but to wait considerably longer before adding capacity for a traffic jump",
      'They treat traffic increases and decreases with exactly the same speed, to avoid oscillating between sizes',
      'They ignore short-lived traffic spikes entirely and only respond to trends sustained over multiple days',
      'They react quickly and aggressively to add capacity for a traffic jump, but wait longer and act more cautiously before removing capacity as traffic drops',
    ],
    correctIndexes: [3],
    explanation:
      'The workbook describes autoscalers as carrying a deliberate bias: they respond eagerly to a rise in traffic so they can head off overload, but hold back and act more slowly once traffic starts to fall, to avoid prematurely shrinking capacity. That is the reverse of reacting fast to drops and slow to jumps, and it is neither a symmetric design nor one that ignores short spikes entirely.',
  },
  // --- Sub-theme: Overload Protection & Cascading Failures ---
  {
    id: 'capacity-011',
    domain: 'capacity',
    questionType: 'multiple-choice',
    question:
      "The SRE book gives cascading failure a precise, technical definition: a failure that worsens over time because of positive feedback. Which scenario below actually matches that definition?",
    options: [
      'A single bad configuration push takes the entire service down at once, and no other component is affected afterward',
      'One overloaded replica fails and its traffic is redirected onto the surviving replicas, pushing them past their own limits so they fail too, in a widening loop',
      "A scheduled maintenance window removes one datacenter's capacity for a known, fixed period before it's restored on schedule",
      'A load test intentionally sends traffic at ten times the provisioned rate to one isolated backend, which cleanly rejects the excess without affecting anything else',
    ],
    correctIndexes: [1],
    explanation:
      "A cascading failure specifically requires the growing, self-reinforcing loop where a failure increases the probability of further failures — exactly what happens as redirected load pushes surviving replicas over their own limits. A single root-cause outage with no such feedback loop, a planned and bounded maintenance drain, and an isolated load test that's absorbed cleanly are all outages or non-events of a different kind, without the defining positive-feedback loop.",
  },
  {
    id: 'capacity-012',
    domain: 'capacity',
    questionType: 'multiple-choice',
    question:
      'In a deep stack where a frontend calls a backend which calls another backend in turn, the SRE book warns that letting every layer independently retry a rejected request can multiply into a combinatorial explosion of load. What does it recommend instead?',
    options: [
      'Every single layer in the stack should retry independently up to ten separate times each, since retries are assumed to be cheaper than surfacing one failure to the end user',
      'Only the deepest, bottom-most layer nearest the database should ever be allowed to retry, since it has the fullest picture of load',
      "Only the layer directly above whichever layer rejected the request should retry; deeper layers instead return an 'overloaded; don't retry' signal so it doesn't fan out",
      'Each layer should double the RPC deadline it passes downward, guaranteeing every layer has enough time to complete its own retries',
    ],
    correctIndexes: [2],
    explanation:
      "Retrying only at the layer immediately above the rejecting layer, and passing an 'overloaded; don't retry' signal (or a usable degraded result) further up, keeps one rejected request from multiplying across every layer of the stack. Letting every layer retry independently is exactly the pattern the book warns can produce that combinatorial explosion, retries aren't restricted to only the deepest layer, and deadlines are meant to be propagated and typically trimmed going downward, not doubled at each hop.",
  },
  {
    id: 'capacity-013',
    domain: 'capacity',
    questionType: 'multiple-response',
    question:
      'The SRE book frames overload protection as involving the client, not just the server or load balancer. Which of these statements about that client-side machinery are accurate? Select all that apply.',
    options: [
      'Adaptive throttling has each client track its own recent request and accept counts, and the client starts locally rejecting some of its own outgoing requests once rejections become significant',
      'Overload protection lives exclusively inside the load balancer; individual client processes have no say in whether a request is sent',
      'A client is only counted by the adaptive throttling system while it holds an active TCP connection; clients with no active connections are excluded entirely',
      'Criticality is a value (such as CRITICAL or SHEDDABLE) carried on each request that determines which traffic gets shed first, and it propagates automatically to any RPCs that request triggers further down the stack',
      'Google found that four criticality levels were enough to usefully model the overload behavior of nearly every service',
      'Client-side throttling is turned off by default and has to be manually switched on for each individual RPC call by the engineer writing it',
    ],
    correctIndexes: [0, 3, 4],
    explanation:
      "Adaptive throttling is explicitly a client-side mechanism — each client tracks its own request/accept ratio and self-regulates by locally dropping some of its own traffic — and criticality is likewise a client-cooperative, request-level concept that both determines shedding order and propagates automatically down the call tree, with four criticality levels found sufficient for nearly every service. It is not exclusively a load-balancer mechanism, inactive clients still participate via periodic health checks rather than being excluded outright, and it's a default, standing part of the RPC system rather than something switched on per call.",
  },
  {
    id: 'capacity-014',
    domain: 'capacity',
    questionType: 'multiple-choice',
    question:
      "The SRE book describes a 'GC death spiral' as a way memory exhaustion can help trigger a cascading failure in a garbage-collected runtime like Java. What is that spiral?",
    options: [
      'A server exhausts its file descriptors, which stops it from writing new log files, which fills its local disk and crashes its health-check thread',
      'A client stops sending its periodic health checks, so the load balancer instantly marks every backend as unhealthy and drains all traffic at once',
      'A cold cache after a restart is claimed to have no effect on latency or capacity at all, since the book says Google\'s task scheduler automatically pre-warms every cache before a newly started task can receive any traffic',
      'Reduced CPU slows requests down, which raises how many are in flight and how much RAM they use, which triggers more GC, which eats still more CPU',
    ],
    correctIndexes: [3],
    explanation:
      "The spiral runs: less available CPU makes requests take longer, more in-flight requests consume more RAM, more RAM pressure triggers more garbage collection, and that GC work eats even more CPU — a vicious cycle. The file-descriptor chain and the health-check-drain scenario are both fabricated sequences, and the automatic-pre-warming claim is also fabricated: the book instead recommends deliberate strategies like overprovisioning and gradually ramping up load precisely because a cold cache can meaningfully hurt a service, especially one that depends on the cache for serving capacity rather than just latency.",
  },
  {
    id: 'capacity-015',
    domain: 'capacity',
    questionType: 'multiple-choice',
    question:
      "For a service with fairly steady, non-bursty traffic, what queue size does the SRE book recommend relative to the thread pool, and what's the reasoning?",
    options: [
      'A queue sized to at least ten times the total thread pool capacity, so that even brief, sudden bursts of traffic never cause a single incoming request to be rejected outright',
      "A small queue, roughly half the thread pool size or less, so the server turns away requests early instead of making callers wait behind a long backlog",
      'No queue whatsoever, under any circumstances, because the book treats queuing as never useful for a production service',
      'A queue sized dynamically to match the total CPU core count of the entire datacenter, not just the local machine',
    ],
    correctIndexes: [1],
    explanation:
      "For steady traffic, the book favors small queues relative to thread-pool size so a server sheds excess load quickly rather than letting requests pile up and wait; it even walks through an example where a full 10x-sized queue turns a 100ms request into a 1.1-second one, mostly spent waiting. It doesn't claim queuing is never useful — some services use queueless designs and others, with bursty traffic, may reasonably want a larger queue — and there's no datacenter-wide CPU-count sizing rule described.",
  },
  {
    id: 'capacity-016',
    domain: 'capacity',
    questionType: 'multiple-choice',
    question:
      "The SRE book walks through a service that was healthy at 10,000 QPS but tipped into a cascading failure once load reached 11,000 QPS. It warns that simply reducing load back down to 9,000 QPS will 'almost certainly not stop the crashes.' Why not?",
    options: [
      "The cascade already reduced the pool's healthy capacity, so 9,000 QPS now overwhelms far fewer healthy machines than before — a much bigger drop may be needed to stabilize",
      "Because 9,000 QPS still technically exceeds the service's originally rated capacity of exactly 10,000 QPS, so any amount of nonzero load supposedly keeps the cascade going indefinitely no matter how far it drops",
      'Because the load balancer caches its overload decision for a fixed 24-hour window regardless of how load subsequently changes',
      "Because stopping the cascade requires a full binary redeploy, which can't be performed while an incident is still active",
    ],
    correctIndexes: [0],
    explanation:
      "Once servers have already started crashing, the surviving healthy fraction of the fleet is much smaller than it was before the cascade began, so the same 9,000 QPS now overwhelms a shrunken pool of healthy servers — the book's example estimates load may need to drop to roughly a tenth of the original rate to let the system stabilize and recover. 9,000 QPS is comfortably below the originally rated 10,000 QPS, there's no 24-hour caching behavior described for overload decisions, and a mid-incident redeploy isn't presented as a hard requirement for reducing load.",
  },
  {
    id: 'capacity-017',
    domain: 'capacity',
    questionType: 'multiple-choice',
    question:
      "How does the SRE book distinguish 'graceful degradation' from plain load shedding as responses to overload?",
    options: [
      'Load shedding only applies to background batch traffic, while graceful degradation only applies to interactive user-facing traffic',
      'Load shedding drops a share of traffic outright near overload, while graceful degradation keeps serving nearly all requests but reduces the work each one costs, like returning lower-quality results',
      'Graceful degradation can only run on the client, while load shedding can only run on the server',
      "Graceful degradation is said to mean that a service's total provisioned capacity gets permanently and irreversibly cut back after any incident occurs, rather than ever being restored to its prior level once the incident is resolved",
    ],
    correctIndexes: [1],
    explanation:
      "The book frames graceful degradation as taking load shedding a step further: rather than dropping some fraction of requests outright, the service keeps answering nearly everything but does less work per request — like searching a smaller slice of an index — to stay within capacity. It isn't segmented by traffic type (batch versus interactive), isn't restricted to one side of the client/server boundary, and has nothing to do with permanently shrinking provisioned capacity after the fact.",
  },
  // --- Sub-theme: Non-Abstract Large System Design (NALSD) ---
  {
    id: 'capacity-018',
    domain: 'capacity',
    questionType: 'multiple-choice',
    question:
      "The SRE Workbook's Non-Abstract Large System Design (NALSD) process has a 'basic design' phase before it considers scaling the design up. What two questions does that basic-design phase ask?",
    options: [
      "'Is it feasible?' and 'Is it resilient?'",
      "'What is the SLO?' and 'What is the error budget?'",
      "'Is it possible?' and 'Can we do better?'",
      "'How many machines does it need?' and 'What will it cost?'",
    ],
    correctIndexes: [2],
    explanation:
      "The basic-design phase asks whether a design that ignores real-world resource constraints is even possible in principle, and then whether that design can be made faster, smaller, or more efficient. 'Is it feasible?' and 'Is it resilient?' are real NALSD questions too, but they belong to the later scale-up phase, not the basic-design phase; SLO/error-budget framing and a direct cost-and-machine-count question aren't how the chapter phrases either phase's questions.",
  },
  {
    id: 'capacity-019',
    domain: 'capacity',
    questionType: 'multiple-response',
    question:
      'In the SRE Workbook\'s NALSD walkthrough of designing a click-through-rate (CTR) dashboard, which of the following are accurate about how the design evolved? Select all that apply.',
    options: [
      'The main point of the exercise is to land on one precise, final machine count that the team then locks in and never revisits',
      'The single-machine design was rejected partly because it was a single point of failure, not solely because of its disk IOPS limits',
      'A MapReduce-based batch design was rejected because splitting logs into small, fixed batches could permanently prevent a query and its matching click from ever being joined if they landed in different batches',
      'The multidatacenter design relies on a Paxos-style consensus algorithm running across several replicas so the system can tolerate a datacenter-sized failure',
      'QueryMap ends up sharded by ad_id rather than by query_id, because ad_id is already known at read time and gives a consistent lookup',
      'NALSD explicitly forbids revisiting or iterating on a design more than twice, to keep the exercise time-boxed',
    ],
    correctIndexes: [1, 2, 3, 4],
    explanation:
      "The walkthrough rejects the single-machine design for being both IO-bound and a single point of failure, rejects the naive MapReduce design because its arbitrary batch boundaries can strand a query and its click in different batches forever, adopts a Paxos-style consensus algorithm across replicas once it goes multidatacenter, and shards QueryMap by ad_id specifically because that key is already known at read time. The chapter's own framing is that the value is in the reasoning across many imperfect iterations, not in freezing one final number, and it never caps the number of design iterations at two.",
  },
  {
    id: 'capacity-020',
    domain: 'capacity',
    questionType: 'multiple-choice',
    question:
      'How does the SRE Workbook describe the underlying skill that practicing Non-Abstract Large System Design (NALSD) is meant to build?',
    options: [
      "The ability to memorize the exact machine counts provisioned for every single one of Google's production services well enough to recite them all correctly during a live incident",
      "The ability to produce a formally verified proof that a distributed system's code is free of race conditions",
      'The ability to negotiate exceptions to an error-budget policy between an SRE team and a product development team',
      'NALSD is meant to build the skill of turning a vague requirement into a grounded resource estimate, combining capacity planning, isolation, and graceful degradation',
    ],
    correctIndexes: [3],
    explanation:
      "The chapter closes by describing NALSD as the learned skill of turning an abstract requirement into a concrete approximation of needed resources, blending capacity planning, component isolation, and graceful degradation into one design discipline. Memorizing service-by-service machine counts, producing formal concurrency proofs, and negotiating error-budget policy exceptions are all real SRE-adjacent activities described elsewhere in this material, just not what this chapter says NALSD itself builds.",
  },
  // --- Sub-theme: Release Engineering Foundations ---
  {
    id: 'release-001',
    domain: 'release',
    questionType: 'multiple-choice',
    question:
      "According to the SRE book's Release Engineering chapter, what does the 'Self-Service Model' principle credit for Google's ability to sustain high release velocity across thousands of engineers and products?",
    options: [
      'A companywide committee that reviews and pre-approves every release slot months in advance',
      'A single central release-engineering team that personally executes every product team\'s deployment',
      'Individual product teams controlling and running their own release process, largely automated so it needs minimal engineer involvement',
      'Every single team across the whole company being required to release strictly on the same fixed weekly calendar, so that all of their releases can be batched and shipped together at once',
    ],
    correctIndexes: [2],
    explanation:
      "The chapter's Self-Service Model principle credits high release velocity to product teams being self-sufficient: they control their own release process, and automation reduces the need for engineer involvement to only when problems arise. A centralized team executing every deployment, a companywide approval committee, and a mandatory shared release calendar are the opposite of self-service — each would concentrate control rather than distribute it.",
  },
  {
    id: 'release-002',
    domain: 'release',
    questionType: 'multiple-choice',
    question:
      "The Release Engineering chapter describes Google's builds as 'hermetic.' What does that term mean in this context?",
    options: [
      'A hermetic build depends only on pinned, known versions of its own tools and dependencies, so the result stays the same no matter what else is installed locally',
      'Each build runs inside an isolated runtime container or sandbox environment that permanently prevents the resulting deployed binary from ever reaching the host machine\'s network',
      'Builds are encrypted end to end so that only authorized release engineers can inspect the compiled artifact',
      "Builds automatically discard any code that hasn't passed a security audit before compilation begins",
    ],
    correctIndexes: [0],
    explanation:
      "Hermetic, in this chapter's usage, is about build-time reproducibility: two people building the same revision on different machines should get identical output, because the build depends only on known, versioned tools and libraries rather than whatever the local machine happens to have installed. Wrapping the running binary in a sandbox describes runtime isolation, not this build-time property; encrypting artifacts and gating on a security audit aren't part of the chapter's definition either.",
  },
  {
    id: 'release-003',
    domain: 'release',
    questionType: 'multiple-choice',
    question:
      "Per the Release Engineering chapter, why does Google cut a dedicated branch off the main source tree at a chosen revision for major releases, rather than releasing straight off that main tree?",
    options: [
      'The mainline is treated as strictly read-only for everyone except the dedicated release-engineering team, so that ordinary product developers are never, under any circumstances, permitted to modify it directly themselves',
      "Google's build tool, Blaze, is physically incapable of compiling code taken directly from the mainline branch",
      'Branching removes the need for code review on any change destined for a release',
      'Cherry-picking specific bug fixes onto the release branch, instead of releasing straight off the mainline, keeps unrelated work committed afterward from silently sneaking into the release',
    ],
    correctIndexes: [3],
    explanation:
      "The book explains that building from a branch and only cherry-picking bug fixes into it — rather than releasing straight from the mainline — lets a team know the exact contents of a release without unrelated work that lands on the mainline afterward getting swept in. Blaze has no such restriction on the mainline, the mainline isn't read-only, and code review is described as required for nearly all changes regardless of branching.",
  },
  {
    id: 'release-004',
    domain: 'release',
    questionType: 'multiple-choice',
    question:
      "The Release Engineering chapter describes using the mainline itself to hold configuration as the earliest method used to configure Borg services. What downside does it attribute to that approach?",
    options: [
      'It requires every single configuration change, no matter how small or routine, to pass through a full binary rebuild and complete redeploy cycle before any of it can take effect at all',
      "It commonly leaves the checked-in configuration out of sync with what's actually deployed, because each running job needs a separate update before it picks up the change",
      'It prevents SREs from reviewing a configuration change before it is applied',
      'It makes it impossible to ever roll back a configuration once it has been committed',
    ],
    correctIndexes: [1],
    explanation:
      "Because this scheme decouples binary releases from configuration changes, the book notes it often leads to skew between what's checked in and what's actually running, since jobs have to be individually updated to pick up the change. It doesn't require a binary rebuild, doesn't block code review (review is still required), and doesn't make rollback impossible.",
  },
  {
    id: 'release-005',
    domain: 'release',
    questionType: 'multiple-response',
    question:
      "Which of the following are among the philosophy principles that the SRE book's Release Engineering chapter names for Google's release process? Select all that apply.",
    options: [
      'Self-Service Model',
      'Reproducible builds',
      'Enforcement of Policies and Procedures',
      'High Velocity',
      'Small deployments',
      'Hermetic Builds',
    ],
    correctIndexes: [0, 2, 3, 5],
    explanation:
      "The SRE book's own Philosophy section for release engineering names exactly four principles: Self-Service Model, High Velocity, Hermetic Builds, and Enforcement of Policies and Procedures. Reproducible builds and small deployments are real ideas too, but they belong to a different, five-item list of release engineering principles laid out in the Workbook's separate Canarying Releases chapter, not to this chapter's four.",
  },
  // --- Sub-theme: Configuration as a Risk Surface ---
  {
    id: 'release-006',
    domain: 'release',
    questionType: 'multiple-choice',
    question:
      "Per the Workbook's 'Configuration Design and Best Practices' chapter, how does the impact of a single configuration change typically differ from that of a typical code change?",
    options: [
      'A single configuration change can produce dramatic shifts in system behavior immediately, while code changes are typically small, incremental, and pass through review and testing',
      'Configuration changes are described as always requiring the exact same lengthy, multi-stage build-and-review pipeline that code changes go through, which is said to make the two kinds of change equally risky in every case',
      'Configuration changes can never affect a running system until the next full binary redeploy',
      'Code changes are inherently riskier because a second engineer is never allowed to review them before submission',
    ],
    correctIndexes: [0],
    explanation:
      "The chapter contrasts a typically slow, incremental code-change process (small changes, review, testing) with configuration, where changing a single option can dramatically shift functionality — its own example is one bad firewall rule locking an operator out of their own system. It never claims configuration follows the same pipeline as code, that config changes require a redeploy to take effect, or that code changes skip review.",
  },
  {
    id: 'release-007',
    domain: 'release',
    questionType: 'multiple-choice',
    question:
      "The Workbook states that for a configuration change to be considered 'safe' to apply, it must have three main properties. Which set below matches those three properties?",
    options: [
      'Mandatory peer review, a documented rollback plan, and a scheduled maintenance window',
      'Semantic validation of the config, syntax highlighting inside the editor, and an automatic code formatter that standardizes style across the whole team',
      'Gradual rollout instead of an all-or-nothing push, the ability to reverse a harmful change, and an automatic halt if operator control is lost',
      'A staging environment, a load test, and a canary population of at least 5%',
    ],
    correctIndexes: [2],
    explanation:
      "The Workbook lists three properties a safe configuration change must have: gradual deployment instead of an all-or-nothing push, the ability to reverse the change if it proves harmful, and an automatic halt or rollback if it causes a loss of operator control. Peer review and maintenance windows, tooling like linters and formatters, and a specific canary percentage are all discussed elsewhere in the material but aren't this three-property list.",
  },
  {
    id: 'release-008',
    domain: 'release',
    questionType: 'multiple-choice',
    question:
      "Why does the Workbook say configuration must be hermetic in order to be reliably rolled forward and back?",
    options: [
      'Non-hermetic configuration cannot be checked into a version control system at all',
      'Configuration is only safely reversible if evaluating it always gives the same result; that breaks if it leans on an outside resource able to drift on its own',
      'Hermetic configuration is required strictly so that the configuration language itself can later be compiled directly into the final production binary before every release',
      'Hermeticity guarantees that a configuration change will never need to be reviewed before being applied',
    ],
    correctIndexes: [1],
    explanation:
      "The Workbook's note warns that configuration referencing something able to change outside its own hermetic environment — its example is config in version control that points at data on a network filesystem — can become very hard to roll forward or back reliably. It says nothing about barring non-hermetic config from version control, compiling the config language into a binary, or skipping review.",
  },
  {
    id: 'release-009',
    domain: 'release',
    questionType: 'multiple-choice',
    question:
      "The Workbook distinguishes 'replication toil' from 'complexity toil' when discussing configuration. How does it define replication toil?",
    options: [
      'The exasperating experience of taming unpredictable, unwanted side effects that emerge once configuration automation has grown large and intricate',
      'The work of migrating a legacy configuration language over to a brand-new domain-specific language',
      'The effort of writing unit tests for a configuration template library',
      'The day-to-day chore of keeping the same configuration value in sync across many duplicate locations, like several separate files',
    ],
    correctIndexes: [3],
    explanation:
      "Replication toil is the Workbook's term for the mundane burden of managing configuration that's duplicated across a system, such as a setting spread across many files. The option about taming unpredictable side effects in large automation actually describes the chapter's other named category, complexity toil, which tends to show up after teams build automation to solve replication toil; migrating languages and writing template-library tests are real activities mentioned elsewhere but aren't either toil definition.",
  },
  {
    id: 'release-010',
    domain: 'release',
    questionType: 'multiple-response',
    question:
      "Per the Workbook's configuration chapters, which of the following are accurate recommendations or observations about managing configuration risk? Select all that apply.",
    options: [
      'Because configuration is just data, teams get little practical benefit from applying software-engineering discipline like code review, versioning, and testing to it',
      'Configuration changes should be pushed out gradually rather than all at once, so problems can be detected and the push aborted before it reaches the entire system',
      "Each configuration snippet should have a clear, single owner, which makes it easier to track who made a given change",
      'Validating that a configuration is merely syntactically well-formed (e.g., parsable JSON) is usually enough on its own to catch most real configuration bugs',
      'Reverting to the last-known-good configuration usually resolves an outage faster than attempting a live patch, which carries much less certainty that it will actually help',
      "Because configuration is easy to change, it doesn't need to be checked into a version control system the way source code does",
    ],
    correctIndexes: [1, 2, 4],
    explanation:
      "Three of these are drawn straight from the configuration chapters: push changes out gradually rather than all at once, give each configuration snippet a clear owner, and prefer reverting to a known-good state over patching forward because that carries more confidence. The other three are contradicted directly: the chapters recommend applying the same software-engineering discipline (review, versioning, testing) to configuration as to code, they say syntactic validation alone won't find many bugs, and they recommend checking configuration into source control just like code, not skipping it.",
  },
  // --- Sub-theme: Canarying and Progressive Rollout ---
  {
    id: 'release-011',
    domain: 'release',
    questionType: 'multiple-choice',
    question:
      "How does the Workbook's Canarying Releases chapter characterize the relationship between canarying and A/B testing?",
    options: [
      'It argues canarying is fundamentally different from A/B testing because canarying only measures operational safety, never product-facing metrics',
      'It says A/B testing is a marketing-only technique that has no valid application to release safety',
      'It treats canarying as purely a pre-production testing-environment activity that happens before any real user traffic is involved',
      "It states directly that canarying amounts to a form of A/B testing, pitting a small 'canary' segment against a 'control' segment",
    ],
    correctIndexes: [3],
    explanation:
      "The chapter flatly equates the two, calling a canary rollout a variety of A/B test in its own words. Framing canarying as fundamentally different from A/B testing, dismissing A/B testing as marketing-only, or restricting canarying to a pre-production testing environment all contradict that direct statement — canarying, by the chapter's own definition, involves splitting real production traffic between a canary and a control.",
  },
  {
    id: 'release-012',
    domain: 'release',
    questionType: 'multiple-choice',
    question:
      "In the Workbook's terminology for a canary deployment, what are 'the canary' and 'the control'?",
    options: [
      "'The canary' is the monitoring dashboard used to visualize the rollout, and 'the control' is the on-call engineer supervising it",
      "'The canary' names whichever slice of the service is running the new change — usually a small fraction of production; 'the control' names the rest of the service, still on the prior version",
      "'The canary' is a synthetic load-testing harness, and 'the control' is the production environment it sends traffic into",
      "'The canary' refers to the dedicated staging environment used exclusively for pre-release testing, and 'the control' refers to the separate production environment it eventually gets promoted into once all testing has fully concluded",
    ],
    correctIndexes: [1],
    explanation:
      "By the chapter's own definition, the canary is whatever part of the service receives the change — usually a small slice of production — while the control is the rest of the service still running the prior version. A monitoring dashboard paired with an on-call engineer, a synthetic load harness, and a staging environment are all different things the chapter discusses elsewhere, not what it means by canary or control.",
  },
  {
    id: 'release-013',
    domain: 'release',
    questionType: 'multiple-choice',
    question:
      "In the Workbook's worked canary example, a release candidate that fails 20% of requests is deployed to a 5% canary population. What overall error rate does this produce, illustrating how canarying conserves the error budget?",
    options: [
      "About 1% overall, since only the canary's 5% slice of traffic experiences the 20% failure rate",
      "About 20% overall, because the size of the canary population doesn't change the blast radius of a defect",
      'About 5% overall, matching the canary population size directly',
      'About 25% overall, because the canary and control failure rates add together',
    ],
    correctIndexes: [0],
    explanation:
      "Because only the 5% canary slice serves the broken release candidate, 20% of that 5% fails — about 1% of overall traffic — which is exactly the worked example's point about conserving the error budget. Treating the blast radius as unaffected by population size, equating the overall rate directly with the canary size, or adding the two rates together all misstate how the two percentages combine.",
  },
  {
    id: 'release-014',
    domain: 'release',
    questionType: 'multiple-choice',
    question:
      "Why does the Workbook caution against a 'before/after' canary evaluation, where the entire system is replaced and compared against its own prior behavior over time?",
    options: [
      "Before/after evaluation is disallowed by definition because it doesn't use a control group at all",
      'Before/after evaluation is described as always taking measurably longer to complete from start to finish than any population-based canary process, no matter how much traffic the service actually receives at the time',
      "A system's behavior naturally shifts with time regardless of any release, so it's hard to tell whether a change is really caused by the deployment or by an unrelated shift, like weekday-versus-weekend traffic",
      'Before/after evaluation cannot be combined with blue/green deployment under any circumstances',
    ],
    correctIndexes: [2],
    explanation:
      "The chapter's concern with before/after evaluation is attribution: because a system's behavior naturally drifts over time for reasons that have nothing to do with the release, a degradation seen afterward might really be caused by something else that changed over that same window, like the difference between weekday and weekend traffic. It does treat a before/after comparison as a valid (if riskier) way to segment a canary, doesn't claim it's always slower, and explicitly discusses using blue/green in a before/after style.",
  },
  {
    id: 'release-015',
    domain: 'release',
    questionType: 'multiple-choice',
    question:
      "In the Workbook's example service, why does the chapter recommend evaluating a canary using HTTP return codes and response latency rather than raw CPU usage?",
    options: [
      'CPU usage cannot be measured separately for the canary and control populations',
      'HTTP return codes are the only metric type App Engine is capable of exporting',
      'Response latency is claimed to be the one and only metric that this particular canary-evaluation chapter ever mentions anywhere in its entire discussion of the topic, from start to finish',
      "Degradation in return codes and latency tracks real user problems, while a rise in CPU usage doesn't necessarily hurt the service and can make the signal noisy",
    ],
    correctIndexes: [3],
    explanation:
      "The chapter favors HTTP return codes and latency because their degradation closely tracks real user-facing problems, whereas a rise in CPU usage doesn't necessarily hurt the service and risks producing a flaky, easily distrusted signal. It never claims CPU can't be measured per population, that App Engine only exports one metric type, or that latency is the chapter's only mentioned metric — it lists several others too, like queue depth and memory footprint.",
  },
  {
    id: 'release-016',
    domain: 'release',
    questionType: 'multiple-response',
    question:
      "The Workbook's Canarying Releases chapter discusses several concepts related to (but distinct from) canarying. Which of the following statements about them are accurate? Select all that apply.",
    options: [
      'Blue/green deployment keeps two full environments running — one live, one on standby — so cutting over needs no downtime, and undoing the change just means flipping traffic back through the router',
      'Artificial load generation is described as providing good state coverage in mutable systems, such as those with caches or cookies',
      'The chapter recommends running many canary deployments simultaneously so that unrelated changes can be validated in parallel',
      "Traffic teeing copies live traffic to a test system whose responses are typically discarded, but it doesn't work well for identifying risk in stateful systems",
      'Generating artificial load against a billing system is described as entirely safe, since test transactions are automatically distinguished from real ones',
      'Because it keeps a full second environment on standby, blue/green deployment roughly doubles the infrastructure footprint compared to a single-environment rollout',
    ],
    correctIndexes: [0, 3, 5],
    explanation:
      "Blue/green deployment really does avoid downtime on cutover and roughly doubles infrastructure footprint by keeping two full environments, and traffic teeing — copying live traffic to a test system while discarding its responses — really is called out as working poorly for stateful systems. The other three invert the chapter's actual warnings: it says artificial load does a poor job of state coverage in mutable systems, it strongly urges keeping canary rollouts to a single one in flight at any given moment, and it specifically flags artificial load against a billing system as potentially dangerous, since it might trigger real charges to customers.",
  },
  // --- Sub-theme: Change Risk and Rollback ---
  {
    id: 'release-017',
    domain: 'release',
    questionType: 'multiple-choice',
    question:
      "Which cached source attributes roughly 70% of outages to changes made to a live production system, and in which section does that appear?",
    options: [
      "The Workbook's 'Canarying Releases' chapter, in its section on release engineering principles",
      "The SRE book's Introduction chapter, in its 'Change Management' section",
      "The SRE book's 'Embracing Risk' chapter, in its section on error budgets",
      "The Workbook's 'Configuration Specifics' chapter, in its section on configuration-induced toil",
    ],
    correctIndexes: [1],
    explanation:
      "That figure appears in the SRE book's Introduction chapter, specifically its Change Management section. It's tempting to assume it belongs to Embracing Risk, since that chapter also discusses risk and error budgets at length, but the statistic isn't there; it's likewise absent from the Workbook's canarying and configuration-toil discussions, which make related but different points about release and configuration risk.",
  },
  {
    id: 'release-018',
    domain: 'release',
    questionType: 'multiple-choice',
    question:
      "The SRE book's Introduction chapter follows its statistic on change-driven outages with a trio of automated best practices for limiting their impact. Which set below matches that trio?",
    options: [
      'Rolling out changes progressively, catching problems quickly and precisely, and reversing a bad change safely once problems appear',
      'Freezing every single release during normal business hours, requiring dual sign-off on each and every commit, and running a nightly full-system canary check',
      'Maintaining a hermetic build system, versioning every configuration package, and auditing access-control lists quarterly',
      'Writing a postmortem for every release, tracking release velocity metrics, and holding a weekly production meeting',
    ],
    correctIndexes: [0],
    explanation:
      "The Introduction's Change Management section names exactly this trio as the automated best practices that minimize how many users and operations get exposed to a bad change: roll changes out progressively, detect problems fast and accurately, and roll back safely once something goes wrong. Business-hour freezes and mandatory dual sign-off, hermetic builds paired with config versioning, and postmortems paired with production meetings are all real SRE practices covered elsewhere in the material, but they aren't this section's named trio.",
  },
  {
    id: 'release-019',
    domain: 'release',
    questionType: 'multiple-choice',
    question:
      "How does the Workbook's Canarying Releases chapter frame the relationship between shipping software quickly and maintaining reliability?",
    options: [
      'It argues that reliability targets should always be sacrificed in favor of maximizing release velocity',
      'It argues that release velocity is completely irrelevant to a service’s error budget, and that the two should always and forever be tracked in total isolation from one another no matter what happens',
      "Velocity and reliability are treated as being in tension, but the chapter argues it's possible to ship fast while still meeting a product's own reliability targets, not 100%",
      "It recommends freezing releases entirely whenever a service is meeting its SLO, since further releases can only introduce risk",
    ],
    correctIndexes: [2],
    explanation:
      "The chapter frames velocity and reliability as commonly treated like opposing goals, then argues the real objective is shipping as fast as possible while still meeting a product's actual reliability targets — not the unachievable ideal of 100% reliability. It doesn't argue for sacrificing reliability outright, for treating velocity and error budget as unrelated, or for freezing releases the moment a service happens to be within its SLO.",
  },
  {
    id: 'release-020',
    domain: 'release',
    questionType: 'multiple-response',
    question:
      "Which of the following statements about reducing the risk of production changes are accurate, according to the cached SRE sources? Select all that apply.",
    options: [
      'Bundling changes into small, self-contained release units makes it less costly to reverse any single one of them if it turns out to be buggy',
      'Provisioning additional capacity is called riskier than simple load shifting, because it typically means altering live infrastructure — config files, load balancers, network setup — rather than just redistributing existing traffic',
      'Rapid, Google’s release automation system, cannot create more than one release branch per project at a time',
      "Google's SREs are contractually prohibited from ever performing a manual rollback outside of the automated Sisyphus rollout framework",
      "A canary process proves its worth exactly when it can flag a broken release candidate with strong confidence, without also crying wolf on releases that are actually fine",
      'A canary process is considered successful only if it detects zero defects across every single deployment it ever evaluates',
    ],
    correctIndexes: [0, 1, 4],
    explanation:
      "All three confirmed claims trace directly to the cached sources: smaller, self-contained release artifacts are explicitly called cheaper and easier to walk back; provisioning is explicitly called riskier than routine load shifting because it touches configuration, load balancers, and networking; and a canary process is said to demonstrate its value exactly when it flags a bad candidate confidently without also false-flagging good ones. The other three are fabricated — no branch-count limit on Rapid, no contractual ban on manual rollback, and no requirement that a canary process detect zero defects ever, appear anywhere in the material.",
  },

  // --- Sub-theme: Toil definition / elimination ---
  {
    id: 'reliability-001',
    domain: 'reliability',
    questionType: 'multiple-choice',
    question:
      "Toil's 'devoid of enduring value' attribute is the one most often misunderstood. Which statement about it matches the SRE book's actual guidance?",
    options: [
      "A task is probably toil if the service ends up unchanged; a one-off manual cleanup that leaves a lasting improvement usually isn't toil",
      "Any task counts as toil the moment a human spends hands-on time on it, regardless of what lasting effect that time has on the service, or whether it was novel",
      "A task performed only a single time can never be classified as toil, no matter whether the service is any better off for it afterward, since novelty alone is decisive",
      "Enduring value is judged by counting how many fiscal quarters a task drags on for, rather than by whether the service's actual state or capability changes",
    ],
    correctIndexes: [0],
    explanation:
      "The book's own test is whether the service ends up in a durably different, better state once the task is done — a task that leaves things unchanged is probably toil, while a manual, grungy, even one-time task that leaves a lasting improvement isn't toil at all. The option treating hands-on time alone as sufficient ignores that human involvement is only one of several toil traits, not toil's defining feature; the option claiming a single occurrence automatically escapes toil ignores that one-off work with zero lasting effect on the service (like the workbook's backup-tooling migration that changes only what database sits underneath, not what capability is delivered) can still be toil; and the fiscal-quarters framing isn't how the book measures enduring value at all.",
  },
  {
    id: 'reliability-002',
    domain: 'reliability',
    questionType: 'multiple-choice',
    question:
      "The SRE book carves 'overhead' out as a category distinct from toil. How does it define overhead?",
    options: [
      "Work that a machine could perform just as well as a human, or whose underlying need could be designed away entirely",
      "Administrative work with no direct tie to running a production service, such as team meetings, hiring, and HR paperwork",
      "Interrupt-driven work that arrives unpredictably during an on-call rotation and has to be handled reactively rather than on a schedule",
      "Work whose required effort grows in step with a service's traffic, user count, or overall size as it scales up",
    ],
    correctIndexes: [1],
    explanation:
      "Overhead is the book's label for administrative tasks that were never meant to reduce operational load in the first place — meetings, hiring, goal-grading, HR paperwork — which is exactly why it isn't toil even though nobody would call it fun. The option describing work a machine could equally perform is actually toil's 'automatable' attribute, the interrupt-driven option describes toil's 'tactical' attribute, and the option about effort scaling with service size describes toil's O(n)-with-growth attribute — all three describe facets of toil itself, not the separate overhead category.",
  },
  {
    id: 'reliability-003',
    domain: 'reliability',
    questionType: 'multiple-choice',
    question:
      "The SRE book cites two different figures about SRE time spent toiling: a policy ceiling and a measured survey result. Which pairing matches each figure to what it actually represents?",
    options: [
      "33% is the ceiling the organization sets so at least a third of an SRE's time goes to engineering work, while roughly 50% is what quarterly surveys found SREs actually average",
      "50% is the ceiling the organization sets so at least half of an SRE's time goes to engineering work, while roughly 33% is what quarterly surveys found SREs actually average",
      "Both the 50% and 33% figures come from the very same quarterly survey of how SREs actually spend their time",
      "50% is described as the minimum share of time an SRE must spend toiling, to keep the team operationally sharp",
    ],
    correctIndexes: [1],
    explanation:
      "These are two distinct numbers answering two distinct questions: the 50% figure is an advertised policy goal capping toil so at least half of an SRE's time goes to engineering work, while the roughly 33% figure is a separate, empirical result from quarterly surveys of actual toil load — comfortably under the policy ceiling, but not the same measurement. The option swapping which number is the target versus the survey result inverts that relationship, the option claiming a shared source ignores that they come from different kinds of evidence (an organizational goal versus a survey), and the option calling 50% a toil minimum inverts what the figure actually caps.",
  },
  {
    id: 'reliability-004',
    domain: 'reliability',
    questionType: 'multiple-response',
    question:
      "Which of the following statements about identifying and measuring toil are accurate, according to the cached SRE sources? Select all that apply.",
    options: [
      "Toil should be tracked using a consistent, objective unit of effort — such as hours spent or completed tickets — rather than relying on individual gut feeling about how much of it exists",
      "In a six-person on-call rotation, primary and secondary on-call duty alone create a toil floor of roughly a third of an SRE's time, since each person carries that duty two weeks out of every six",
      "Before committing engineering effort to eliminate a piece of toil, it's worth checking that the time a fix will save is at least proportional to the time spent building and maintaining it",
      "A team's toil-reduction project that fails a strict hours-saved-versus-hours-invested comparison should always be scrapped, since morale and onboarding benefits don't factor into that decision",
      "Widening an on-call rotation from six engineers to eight raises the on-call-driven toil floor, since spreading a rotation across more people means more total interrupt handling for the team",
      "Whether a task counts as toil depends mainly on whether the person doing it finds it enjoyable — if an SRE genuinely likes the work, it isn't toil",
    ],
    correctIndexes: [0, 1, 2],
    explanation:
      "Three claims hold up: an objective, consistently tracked unit of effort is exactly what the workbook recommends over trusting intuition; a six-person on-call rotation does put a floor of roughly 33% (2 of 6 weeks) on an SRE's toil regardless of how well the service itself is engineered; and the workbook explicitly recommends a rough cost-benefit check before investing in a fix. The claim that an 'unprofitable' toil project should always be scrapped is wrong — the workbook explicitly says such projects can still be worth doing for softer benefits like morale, fewer human-error outages, and faster onboarding. The rotation-size claim has the direction backward — widening a rotation from six to eight people actually lowers the on-call-driven floor, from about a third down to a quarter. And the book is explicit that toil isn't defined by whether the work is unpleasant or enjoyable — some people genuinely enjoy toil-heavy work, and it's still toil.",
  },

  // --- Sub-theme: Automation as an engineering discipline ---
  {
    id: 'reliability-005',
    domain: 'reliability',
    questionType: 'multiple-choice',
    question:
      "The SRE book breaks the payoff from automation into several distinct value drivers rather than treating 'saves time' as the whole story. Which pairing of a driver to its rationale is accurate?",
    options: [
      "A platform's main advantage is that it always removes the need for any future human judgment about when to run it, for any task",
      "Time savings is called the automation benefit Google can calculate most precisely and cheaply, and it's always tallied up in full before a project even begins",
      "Consistency is often automation's primary value for well-scoped procedures, since manual repetition is never quite as uniform as a machine's",
      "Faster action means a single bug fix in the automation benefits every future user of the tool, instead of just whoever first wrote it",
    ],
    correctIndexes: [2],
    explanation:
      "The book calls out consistency as often the primary value of automating a well-understood procedure, precisely because human repetition is never as uniform as a machine's, and that inconsistency is itself a source of mistakes. The 'benefits every future user' description actually belongs to the platform driver's mistake-centralizing property, not to faster action; the platform option's claim about removing the need for judgment mischaracterizes what a platform actually provides; and time savings is explicitly called the hardest of the five drivers to calculate, not the easiest or most precisely tallied.",
  },
  {
    id: 'reliability-006',
    domain: 'reliability',
    questionType: 'multiple-choice',
    question:
      "The SRE book illustrates its five-stage automation hierarchy with a single running example: a database master failing over between locations. Which stage-to-example pairing is correct?",
    options: [
      "Externally maintained generic automation — the database ships with failover logic built directly into its own codebase",
      "Internally maintained, system-specific automation — one engineer keeps a personal failover script sitting in their home directory",
      "The fully autonomous end state — the failover script grows into a shared tool that other teams plug their own systems into",
      "No automation at all — an engineer manually fails the database master over between locations",
    ],
    correctIndexes: [3],
    explanation:
      "The book's own first stage in the progression is exactly this: no automation, with an engineer manually failing the master over. Each distractor swaps in an example that actually belongs to a different stage — a database shipping with its own built-in failover logic is the internally maintained, system-specific stage, not externally maintained generic; a personal home-directory script is the externally maintained, system-specific stage, not internally maintained; and a shared 'generic failover' tool other teams plug into is the externally maintained generic automation stage, not the fully autonomous stage where the system needs no external automation at all.",
  },
  {
    id: 'reliability-007',
    domain: 'reliability',
    questionType: 'multiple-choice',
    question:
      "What specifically went wrong in the incident the SRE book describes under the name 'Diskerase'?",
    options: [
      "A restarted workflow found zero machines still needing erasure, but that empty result was misread as a sentinel meaning 'erase everything,' wiping disks across nearly all colocation facilities",
      "A misconfigured scheduled job kept re-running the erase step on the same rack long after decommissioning had already finished, slowly and quietly wiping unrelated racks over the following several weeks",
      "An engineer accidentally pointed the decommissioning tool at the primary datacenters instead of the intended CDN edge colocation facilities, wiping genuinely critical core production data outright",
      "The erase automation shipped with no timeout configured at all, so a single erase operation ran indefinitely and eventually reached every disk it could find anywhere on the network",
    ],
    correctIndexes: [0],
    explanation:
      "The book's account is specific: the decommission workflow was restarted to debug an earlier failure, correctly determined that zero machines still needed erasing, but that empty set was interpreted by the tooling as a sentinel meaning 'everything,' so it wiped disks across nearly all of Google's colocation facilities before the mistake was caught. The recurring-scheduled-job explanation, the wrong-datacenter-target explanation, and the missing-timeout explanation are all plausible-sounding automation failure modes, but none of them is what the book actually describes as the root cause here.",
  },
  {
    id: 'reliability-008',
    domain: 'reliability',
    questionType: 'multiple-response',
    question:
      "Which of the following statements about the Ads Database 'Decider' automation case study are accurate, according to the cached SRE sources? Select all that apply.",
    options: [
      "Manual MySQL failovers before Decider typically completed in well under 30 seconds, comfortably inside the team's error-budget requirement",
      "Decider's failover success rate within its 30-second target was measured at a perfect 100%, with no failed attempts ever recorded",
      "Decider needed to exist because migrating onto Google's cluster scheduler meant tasks could be rescheduled onto different machines roughly once or twice a week, and manual failover couldn't reliably finish inside the team's error budget",
      "Once failover was automated, the team went on to automate schema changes too, and the database's total ongoing operational-maintenance burden eventually dropped by close to 95%",
      "Consolidating multiple MySQL instances onto shared machines after the migration freed up roughly 60% of the team's hardware footprint",
      "The Ads team abandoned its migration onto the cluster scheduler once building failover automation proved difficult, reverting to dedicated machines instead",
    ],
    correctIndexes: [2, 3, 4],
    explanation:
      "Three claims match the case study directly: the migration to the cluster scheduler introduced weekly-or-twice-weekly task rescheduling that manual failover (30-90 minutes each) couldn't keep up with inside the error budget, which is exactly why the automated failover daemon was built; automating failover led the team to automate schema changes as well, eventually cutting total operational-maintenance burden by nearly 95%; and consolidating MySQL instances onto shared machines freed up about 60% of the team's hardware. The claim about pre-Decider manual failovers finishing in under 30 seconds is backward — that speed was the whole problem automation had to solve; the claim of a flawless 100% success rate overstates the real figure, which was around 95%; and the team never abandoned the migration — automation is what made it viable.",
  },

  // --- Sub-theme: Simplicity as a reliability property ---
  {
    id: 'reliability-009',
    domain: 'reliability',
    questionType: 'multiple-choice',
    question:
      "Borrowing Fred Brooks's classic distinction, how does the SRE book differentiate essential complexity from accidental complexity?",
    options: [
      "Essential complexity comes from choosing the wrong programming language for a project, while accidental complexity is baked permanently into a system's business requirements",
      "Essential complexity applies only to distributed, multi-service systems, while accidental complexity applies only to standalone, single-binary applications",
      "Essential complexity is inherent to the problem and can't be removed, while accidental complexity comes from an implementation choice and can genuinely be engineered away",
      "Essential complexity is whatever complexity gets introduced by automation tooling, while accidental complexity is whatever gets introduced by a human operator's manual changes",
    ],
    correctIndexes: [2],
    explanation:
      "The book's example is serving web pages quickly, which is essential complexity no web server can avoid, versus the garbage-collection tuning that shows up specifically because a team chose a language with automatic memory management, which is accidental complexity introduced by that choice and can be engineered away. The language-choice option and the automation-versus-manual option both invert or fabricate what makes complexity 'essential' versus 'accidental,' and the book never restricts either category to a particular system architecture like distributed versus single-binary.",
  },
  {
    id: 'reliability-010',
    domain: 'reliability',
    questionType: 'multiple-choice',
    question:
      "What does the SRE book mean when it says that in an always-on production service, every new line of code is 'a liability'?",
    options: [
      "Code becomes a liability only once it's been running in production for more than a full calendar year, per Hyrum's Law",
      "Every function call consumes CPU cycles roughly proportional to its own line count, so shorter functions are always considered computationally cheaper to run in production",
      "The book recommends commenting unused code out rather than deleting it, so the logic can be quickly restored the moment it's needed again",
      "More code means more surface area for defects, so scrutinizing features, deleting dead code, and testing for bloat all count as real reliability work",
    ],
    correctIndexes: [3],
    explanation:
      "The book's point is that every line written is a standing source of potential defects, so removing dead code, questioning whether a feature is worth adding, and building bloat detection into testing all count as real reliability work rather than mere tidiness. The commented-out-code option describes exactly the kind of suggestion the book calls 'terrible,' preferring deletion (with source control available to restore it if truly needed) over permanently commented or flag-gated dead code; the Hyrum's-Law option confuses code age with the liability argument, which is about defect surface area, not a one-year cutoff; and the CPU-cycles claim isn't the reasoning the book gives at all.",
  },
  {
    id: 'reliability-011',
    domain: 'reliability',
    questionType: 'multiple-choice',
    question:
      "The Workbook notes that cyclomatic complexity works well for a single function but admits there's no single rigorous metric for an entire system's complexity. Which of these is one of the practical proxies it offers instead?",
    options: [
      "The total number of git commits ever merged into the system's repository over its lifetime",
      "How long a newly onboarded engineer takes to be ready for on-call on the system",
      "The total dollar cost of the cloud infrastructure the system currently runs on each month",
      "The number of distinct programming languages used anywhere across the system's codebase",
    ],
    correctIndexes: [1],
    explanation:
      "Training time — how long it takes a new engineer to be ready for on-call — is one of the workbook's named proxies for whole-system complexity, alongside things like explanation time and administrative diversity. Commit counts, monthly infrastructure spend, and the number of programming languages in use are all plausible-sounding metrics an engineer might guess at, but none of them appears in the workbook's actual list of complexity proxies.",
  },

  // --- Sub-theme: Distributed reliability patterns ---
  {
    id: 'reliability-012',
    domain: 'reliability',
    questionType: 'multiple-choice',
    question:
      "Neither Google SRE book actually uses the term 'circuit breaker.' Which term does the SRE book use for its client-side mechanism, in which each client tracks its own recent ratio of attempted-to-accepted requests and starts rejecting new requests locally once that ratio crosses a tunable threshold?",
    options: [
      "Adaptive throttling",
      "Circuit breaking",
      "Criticality-based load shedding",
      "Graceful degradation",
    ],
    correctIndexes: [0],
    explanation:
      "Adaptive throttling is the book's actual name for this client-side self-regulation mechanism, where a client compares its own recent request and accept counts and begins rejecting new requests locally once the ratio crosses a configurable multiplier. 'Circuit breaking' is the trap here — the book never uses that term for this or any related mechanism. Criticality-based shedding is a real, related mechanism, but it's a server-side priority scheme rather than the client-side self-regulation being described, and graceful degradation is a different lever entirely, serving cheaper responses rather than rejecting requests.",
  },
  {
    id: 'reliability-013',
    domain: 'reliability',
    questionType: 'multiple-choice',
    question:
      "Under Google's criticality-based load shedding, which requests get rejected first as a backend task approaches overload?",
    options: [
      "CRITICAL_PLUS requests, since shedding the highest-priority traffic first frees the most capacity in a single step",
      "Whichever requests happen to arrive first, processed strictly in FIFO order regardless of criticality",
      "SHEDDABLE requests, since a backend only starts rejecting a given criticality once it is already rejecting all lower criticalities beneath it",
      "An equal percentage of traffic from every criticality tier at once, so the relative mix of traffic served stays unchanged",
    ],
    correctIndexes: [2],
    explanation:
      "A backend task only rejects requests of a given criticality once it is already rejecting all requests of every lower criticality — so SHEDDABLE, the lowest of the four tiers, gets cut first as utilization climbs, well before CRITICAL_PLUS (the default for production-serving traffic, the last tier to be shed). There's no FIFO-by-arrival-time rule and no proportional across-the-board shedding; rejection cascades strictly from least to most critical, which is also why CRITICAL_PLUS being shed first is backwards from how the mechanism actually works.",
  },
  {
    id: 'reliability-014',
    domain: 'reliability',
    questionType: 'multiple-choice',
    question:
      "According to the SRE book's discussion of majority-quorum consensus systems, what happens to a system's tolerable-loss fraction when it grows from five replicas to six?",
    options: [
      "The quorum requirement stays fixed at three votes either way, so the tolerable-loss fraction is unchanged at roughly 40%",
      "Adding a sixth replica has no effect on the quorum requirement at all, since quorum size depends only on how many failures need tolerating, not on the replica count",
      "The quorum requirement rises from three votes to four, and the tolerable-loss fraction actually drops, from about 40% down to about 33%",
      "The quorum requirement falls from four votes to three, so the tolerable-loss fraction rises from about 33% up to about 40%",
    ],
    correctIndexes: [2],
    explanation:
      "With five replicas, a majority quorum needs three votes, so the system can still make progress with two replicas (about 40%) unavailable; growing to six replicas raises the quorum to four votes, which actually lowers the tolerable-loss fraction to about 33% even though there's one more replica in the pool. That's the book's own point that adding replicas isn't automatically better for availability. The option claiming no change, the option claiming no effect from the extra replica, and the option that reverses the direction of the shift (from three votes to four, framed backward) all misstate that same underlying math.",
  },
  {
    id: 'reliability-015',
    domain: 'reliability',
    questionType: 'multiple-response',
    question:
      "Which of the following are strategies the SRE book identifies for defending against cascading failures? Select all that apply.",
    options: [
      "Switching an overloaded server's request queue from first-in-first-out to last-in-first-out, so remaining capacity goes toward requests still likely to be wanted rather than ones the caller has probably already given up on",
      "Retrying a failed request independently at every layer of the stack, since retrying more times at more layers only raises the odds that any given request eventually succeeds",
      "Giving each layer of the stack its own long, independent deadline, so a single slow dependency never causes an upstream timeout",
      "Dropping load testing and capacity planning once a service has redundant replicas, since redundancy alone is what prevents cascading failures",
      "Propagating a single deadline down through a chain of RPC calls, so a server several layers deep can abandon stale work as soon as the original caller has already given up",
      "Capping the total number of retries a process will issue per minute, so a spike of failures doesn't snowball into an even larger spike of retries competing for the same scarce capacity",
    ],
    correctIndexes: [0, 4, 5],
    explanation:
      "Three real defenses appear here: switching a struggling server's queue discipline to last-in-first-out so it spends effort on requests still worth answering; propagating one deadline down an entire RPC call chain so deep servers can bail out the moment the original caller has given up; and capping a process's total retries per minute so a failure spike doesn't compound into a larger retry spike. Retrying independently at every layer is exactly backward — the book shows how that multiplies into a much larger number of attempts hitting an already-overloaded backend; giving every layer its own long independent deadline undermines the deadline-propagation strategy rather than supporting it; and capacity planning is itself part of the book's cascading-failure toolkit, not something redundancy makes unnecessary.",
  },
];
