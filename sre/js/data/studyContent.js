// js/data/studyContent.js
// Study notes for the SLIs, SLOs & Error Budgets domain (20% exam weight).
// Grounded in Google's Site Reliability Engineering book and the SRE
// Workbook (docs cached under .cache/aws-docs/ during authoring); written
// in original prose, not copied.
export const STUDY_CONTENT = [
  {
    domain: 'slos',
    taskStatement: 'Defining Reliability: SLI, SLO, and SLA',
    topics: [
      {
        title: 'What an SLI Actually Measures',
        body: "A service level indicator, or SLI, is a carefully specified, quantitative measurement of one aspect of how well a service is behaving — not a vague sense of 'is it healthy,' but a precise number you can graph and alert on. The most common SLIs are request latency, an error or success rate (often called availability), and throughput, and most of these are naturally expressed as a ratio of good events to the total number of events observed over some window, which keeps every SLI on the same 0-to-100 scale and makes tooling reusable across services. Because raw measurements are almost always skewed — some requests are inherently fast and others slow — teams typically report SLIs as percentiles (the 50th, 95th, or 99th) rather than a simple mean, since an average can hide a painfully slow tail even while looking perfectly stable on a dashboard.",
      },
      {
        title: 'From SLI to SLO: Setting a Target',
        body: "An SLO takes an SLI and attaches a target, typically written as a threshold like 'at least 99% of requests succeed' or a bound like 'the 95th-percentile latency stays under 300 milliseconds.' Because a single number can hide how a distribution actually behaves, it's common to layer several SLOs on the same underlying SLI — for example, a looser bound on the 90th percentile and a stricter one on the 99th — so that both the typical experience and the painful tail are covered. Publishing an SLO also does double duty as an expectation-setting device: once users and other teams know what a service promises, complaints about vague slowness tend to give way to concrete conversations anchored to the published number. A related but distinct idea is the SLA, or service level agreement: essentially an SLO wrapped in a contract, so that missing the target triggers a formal, usually financial or contractual, consequence, whereas an ordinary SLO miss only triggers an internal response.",
      },
      {
        title: 'SLI Specification vs. Implementation, and Measuring Close to the User',
        body: "It helps to separate what you want to measure (the SLI specification, such as the fraction of home-page loads that felt fast) from how you actually measure it (the SLI implementation, such as reading load-balancer logs versus timing the page in the browser). The same specification can have several competing implementations that trade off measurement quality, how much of real user traffic they cover, and how expensive they are to build, and a server-side metric is often a proxy rather than the real thing users experience, since problems in a browser's JavaScript or a mobile client can hurt users without ever showing up in backend logs. Whenever practical, moving the measurement point nearer to the user — from the application server to the load balancer, or from the load balancer to client-side instrumentation — tends to produce an SLI that better reflects what people are actually feeling.",
      },
      {
        title: 'Starting Simple, Then Iterating on Rolling and Calendar Windows',
        body: "The advice from both books is to get a rough first SLO in place using whatever data is already cheap to collect — existing web server logs or a load balancer dashboard, say — rather than delaying until a perfect measurement pipeline exists; you can always refine the SLI and tighten the target once you have a feedback loop running. A separate decision is what time window an SLO covers: a rolling window (for example, trailing four weeks) tracks closer to how users actually experience a service, since a bad outage on the last day of a month doesn't just vanish for users on day one of the next month, while a calendar-aligned window (a fixed month or quarter) lines up more naturally with business planning cycles like headcount and roadmap decisions. The workbook settles on a four-week rolling window as a reasonable general-purpose default, paired with weekly summaries for short-term prioritization and quarterly rollups for larger planning conversations.",
      },
    ],
  },
  {
    domain: 'slos',
    taskStatement: 'Choosing the Right SLIs by System Type',
    topics: [
      {
        title: 'User-Facing Serving Systems: Availability, Latency, Throughput',
        body: "For a system that directly answers requests from people — a search frontend, an API, a mobile backend — the SRE book points to three SLI categories as the natural starting point: availability (could the request be answered at all), latency (how long did answering take), and throughput (how many requests could be handled). These three map cleanly onto the questions users and operators actually care about, and because they're each expressible as good-events-over-total-events, they compose easily into a small, defensible starter set of SLOs without needing to track every metric a monitoring system happens to expose.",
      },
      {
        title: 'Storage Systems: Latency, Availability, Durability',
        body: "Systems whose job is to hold data and hand it back later care about the same latency and availability questions as serving systems, but add durability — the likelihood that data written today can still be read back correctly much later — as a third pillar, since losing or corrupting stored data is a categorically different failure than a slow read. Durability SLIs need particular care about what's actually being measured: if a system holds a decade of records but a user only wants today's, near-perfect overall durability numbers can still coexist with real user pain if the specific slice they need is the part that went missing.",
      },
      {
        title: 'Pipelines and Batch Systems: Throughput, Freshness, and Coverage',
        body: "Data-processing pipelines — batch jobs, streaming systems, anything that ingests records, transforms them, and writes them somewhere else — are usually better characterized by throughput and end-to-end latency than by simple request availability, since there's often no single request to measure in the first place. The workbook adds two more pipeline-specific flavors worth tracking: freshness, the fraction of read data that was updated within some acceptable time window, and coverage, the fraction of records or jobs that were fully processed rather than partially skipped, both of which surface a different kind of unreliability than a serving system's error rate would.",
      },
      {
        title: 'Correctness: The SLI Every System Type Shares',
        body: "Regardless of a system's category, correctness — did the system actually return the right answer or the right data — matters everywhere, though it's frequently a property of the data flowing through a system rather than of the infrastructure serving it, which is part of why it can fall outside what an SRE team is directly on the hook for. Measuring correctness typically means injecting synthetic records with a known-good expected output and tracking what fraction of them come back correct, since comparing arbitrary real production data against a ground truth is usually impractical.",
      },
      {
        title: 'A Worked SLO Document: Mixing Component Types in One Service',
        body: "The workbook's example SLO document for a hypothetical mobile game shows how these categories combine in practice: the API and web frontend each get availability and two-tier latency SLOs (a looser bound at the 90th percentile, a tighter one at the 99th), while the pipeline that recomputes leaderboard tables separately tracks freshness (how recently the data backing a read was updated), correctness (verified against seeded test records), and completeness (whether a given run processed the full input set). Laying the SLOs out this way, one row per SLI with its own target, is what makes the resulting error budget calculation for each objective straightforward rather than a single blended number that hides which component is actually struggling.",
      },
      {
        title: "Real-World Categorization: The Home Depot's VALET Framework",
        body: "The Home Depot's case study shows an independently developed but structurally similar approach: after auditing what its microservices already tracked, the team distilled everything down to five categories nicknamed VALET — Volume (traffic), Availability, Latency, Errors, and Tickets (how often a request needed a human to intervene) — and asked every service to publish SLOs against that shared vocabulary. Because dependent microservices could then look up a peer's published VALET targets instead of guessing at its reliability, the framework served the same coordinating purpose as the request-driven, pipeline, and storage categories above, just phrased for a large, non-Google enterprise rolling out SLOs from scratch.",
      },
    ],
  },
  {
    domain: 'slos',
    taskStatement: 'Error Budgets: Definition and Policy',
    topics: [
      {
        title: 'Error Budget: A Derived Number, Not a Separate Measurement',
        body: "An error budget is simply 100% minus the SLO — it isn't measured independently, it falls directly out of whatever target you already picked. A service with a 99.9% availability SLO has a 0.1% error budget, so if that service handles a million requests over some window, it can absorb roughly a thousand failed requests before it has technically missed its objective; a service with a 99.99% target gets a proportionally smaller budget of about a hundred failures over the same volume. Framing unreliability as a budget rather than as a binary pass/fail turns 'are we within SLO' into a quantitative, ongoing question of how much budget remains, rather than a single alarm that fires only at the moment of breach.",
      },
      {
        title: 'What the Budget Is For: Balancing Velocity Against Stability',
        body: "The real value of an error budget is as a shared, objective currency between product-development teams (who are usually judged on how fast they ship) and reliability-focused teams (who are usually judged on how rarely things break) — instead of negotiating release pace through politics or gut feel, both sides can point at the remaining budget. While budget remains, teams can push new releases and take on reasonable risk; once it's exhausted, the natural consequence is to redirect effort toward reliability work — fixing bugs, hardening dependencies, slowing the release cadence — until performance is back within the target. This also means a budget-draining event isn't only caused by a team's own bugs: a shared network outage or a failing dependency owned by someone else eats into the same budget, which is why error-budget policies typically have to spell out how to handle failures the team didn't directly cause.",
      },
      {
        title: "An Example Error-Budget Policy (Google's Illustrative Version)",
        body: "The SRE workbook publishes one concrete error-budget policy as a worked example, not as a universal standard every team must copy — it is explicitly one company's illustrative document. In that example, the service is evaluated over a four-week rolling window: while performance sits at or above the SLO, releases proceed normally, but once the service has burned through its entire budget for that four-week window, the policy calls for freezing non-critical changes and releases (carving out exceptions for top-priority fixes and security patches) until the service is back within its objective. The same example policy also sets a 20% threshold for triggering deeper review: any single incident that consumes more than 20% of the four-week budget requires a postmortem with at least one concrete follow-up action, and any recurring class of outage that eats more than 20% of a quarter's budget has to get a planning commitment for the following quarter — again, specific numbers from one company's example, worth adapting rather than adopting wholesale.",
      },
      {
        title: 'Burn Rate: How Fast the Budget Is Being Spent',
        body: "Burn rate describes how quickly a service is consuming its error budget relative to what a sustainable pace would look like: a burn rate of exactly 1 means the current error rate would use up the entire budget right at the end of the SLO window, neither early nor with room to spare, while a burn rate of, say, 10 means the budget would be exhausted roughly ten times faster than that, well before the window closes. Because burn rate ties an instantaneous error rate back to the same budget the whole SLO program is built around, it becomes the basis for a smarter kind of alerting than simply noticing a dip in the SLI — worth grounding here even though the deeper alerting mechanics belong to a later domain, since burn-rate alerts are really just error-budget math applied to a shorter observation window.",
      },
      {
        title: 'Real-World Adoption: Evernote and The Home Depot',
        body: "Evernote's rollout started deliberately narrow — a single uptime SLO for syncing content across devices, measured by an independent third-party prober rather than internal metrics the team might be tempted to trust too readily — and grew from there, with Evernote and Google's own reliability engineers sharing the same dashboards and reviewing performance together monthly, and revising the SLO roughly every six months as they learned more. The Home Depot took a more top-down cultural-change approach: after finding no consistent reliability metrics at all across its services, it standardized on the VALET categories, built automated collection tooling, and scaled from around 50 services voluntarily tracking SLOs to roughly 800 services doing so within about a year, with an explicit next step of adopting a release-freezing error-budget policy modeled on Google's, once the organization had enough SLO maturity to support it.",
      },
    ],
  },
  {
    domain: 'slos',
    taskStatement: 'Embracing Risk and the Cost of Extreme Reliability',
    topics: [
      {
        title: 'Why 100% Reliability Is the Wrong Target',
        body: "A perfectly reliable service is the wrong goal for reasons that are economic and experiential, not because perfect reliability is technically unattainable in some deeper sense. Even with redundant components and automated failover, there's always some nonzero chance that enough pieces fail at once to cause an outage, and a user's actual experience is shaped by the entire chain between them and your servers — their phone, their carrier, their wifi — so a service that is itself flawless can still feel unreliable to a user sitting behind a shaky connection, and conversely, users typically can't tell the difference between, say, 99.99% and 99.999% reliability because everything else in the chain is noisier than that gap. On top of that, chasing 100% forecloses the ability to ship any change at all, since new code, new hardware, and new configuration are the leading causes of outages — a service frozen in place to protect a perfect record eventually stagnates while everything around it keeps evolving.",
      },
      {
        title: 'The Nonlinear Cost of the Next Nine',
        body: "Reliability doesn't get more expensive in a straight line as you push it higher — each additional nine of availability tends to cost dramatically more than the one before it, driven by two distinct kinds of spending: the hard cost of extra redundant infrastructure (spare capacity, backup equipment, parity data for durability guarantees) and the opportunity cost of diverting engineers who could otherwise be building features that users actually notice toward defensive work that mostly protects against rare failures. Because that curve bends so sharply upward while the benefit to users flattens out, the right amount of reliability investment is a cost-benefit question tied to a specific service's business context, not a constant that every system should chase toward its theoretical ceiling.",
      },
      {
        title: "The 'Nines' Framework for Talking About Availability",
        body: "SRE teams commonly summarize an availability target by counting its leading nines: 99% is described as 'two nines,' 99.99% as 'four nines,' and so on, with each additional nine representing roughly a tenfold cut in the allowed downtime. Concretely, a 99.99% target permits only around 52 minutes of downtime across an entire year if measured against wall-clock uptime, which is one reason the shorthand is useful — it's much easier to reason about and compare four nines versus three and a half nines than to compare raw percentages with several trailing decimal digits. Google has historically published an availability target for Compute Engine of three and a half nines, or 99.95%, illustrating that even a company known for reliability doesn't default every service to the highest nine count available.",
      },
      {
        title: 'Request-Based (Aggregate) Availability vs. Time-Based Uptime',
        body: "The classic definition of availability is time-based: the fraction of a period, such as a year, during which the whole service was up and reachable. That framing works cleanly for a single machine or a single region, but it breaks down for a large, geographically distributed system that is essentially never fully down everywhere at once — at any given moment some fraction of traffic somewhere is probably failing even while the overall service looks healthy by a simple uptime clock. For that reason, large distributed services tend to define availability instead as an aggregate, request-based measure: the proportion of requests that succeeded out of all requests received over some window, which captures partial degradation (a slice of users having a bad time) in a way a binary up-or-down uptime clock cannot.",
      },
      {
        title: 'Treating the Target as Both a Floor and a Ceiling',
        body: "Because closing the gap between a target and perfect reliability gets progressively more expensive for progressively less benefit, a healthy SRE posture treats an availability target as something to just barely clear rather than something to blow past — exceeding an SLO by a wide margin isn't free virtue, it's usually a sign that engineering time which could have gone toward new features, technical-debt cleanup, or lowering operating cost was instead spent buying reliability nobody asked for. This is also why deliberately taking a very over-reliable system offline occasionally, or throttling it, can be a legitimate move: if a dependency is so reliable that other teams start silently assuming it can never fail, that unexamined assumption becomes its own latent risk, and forcing it into the open beats discovering it during a real outage.",
      },
    ],
  },
];
