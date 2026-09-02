# AWS Well-Architected Framework — diagrams

Ten diagrams covering the framework's structure: what it is, the vocabulary it
depends on, how a review runs, where the pillars pull against each other, and
one map per pillar.

These are for building the mental model. The recall drilling lives in
[`flashcards.md`](flashcards.md), and the one-page print reference is
[`cheatsheet.html`](cheatsheet.html) — all three are drawn from the same source
and don't disagree.

Diagrams are Mermaid, which Obsidian renders natively (as do GitHub and VS Code
with a Mermaid preview extension). Grounded in the AWS Well-Architected
Framework docs, publication date November 6, 2024. Unofficial; not affiliated
with or endorsed by AWS.

---

## 1. The framework at a glance

The mistake this fixes: the six pillars are **six simultaneous lenses on one
workload**, not six phases you move through. You don't finish Security and
advance to Reliability. Every pillar is asked about the same workload at the
same time, and the general design principles sit above all six.

Note where the arrow ends. A review's output is a prioritized list of risks and
improvements — never a score, never a pass/fail, never a certification.

```mermaid
flowchart LR
    GDP["<b>General design principles</b><br/>Stop guessing capacity<br/>Test at production scale<br/>Automate to experiment<br/>Evolutionary architectures<br/>Drive with data<br/>Improve through game days"]
    W["<b>Your workload</b><br/>components that together<br/>deliver business value"]

    subgraph P["The six pillars — applied at once, not in sequence"]
        direction TB
        OPS["<b>Operational Excellence</b> · OPS"]
        SEC["<b>Security</b> · SEC"]
        REL["<b>Reliability</b> · REL"]
        PERF["<b>Performance Efficiency</b> · PERF"]
        COST["<b>Cost Optimization</b> · COST"]
        SUS["<b>Sustainability</b> · SUS"]
        OPS ~~~ SEC ~~~ REL ~~~ PERF ~~~ COST ~~~ SUS
    end

    OUT["<b>Prioritized list of risks<br/>and improvements</b><br/>not a score<br/>not an audit<br/>not a pass/fail gate"]
    AGAIN["and then again —<br/>re-reviewed at the<br/>next milestone"]

    GDP -->|"how the cloud changes<br/>what good design even is"| W
    W -->|"reviewed through<br/>all six at once"| P
    P -->|"foundational<br/>questions"| OUT
    OUT -.-> AGAIN

    classDef ops fill:#d7e3fc,stroke:#3b6bc4,stroke-width:2px,color:#10233f
    classDef sec fill:#fadcdc,stroke:#c04a4a,stroke-width:2px,color:#3f1010
    classDef rel fill:#d6ecd9,stroke:#4a9457,stroke-width:2px,color:#12300f
    classDef perf fill:#e4dcf5,stroke:#7a5bbf,stroke-width:2px,color:#24123f
    classDef cost fill:#fbeacd,stroke:#c9902f,stroke-width:2px,color:#3f2c0f
    classDef sus fill:#d3ecea,stroke:#3f9691,stroke-width:2px,color:#0f302f
    classDef neutral fill:#e8e8e8,stroke:#7a7a7a,stroke-width:2px,color:#1a1a1a
    classDef sub fill:#f7f7f9,stroke:#b0b6c0,stroke-width:1px,color:#1a1a1a
    class OPS ops
    class SEC sec
    class REL rel
    class PERF perf
    class COST cost
    class SUS sus
    class GDP,W,OUT,AGAIN neutral
    class P sub
```

---

## 2. The vocabulary, and how it nests

These words get used loosely in conversation and precisely in the framework. The
nesting is the whole point: a **component** is the smallest thing the framework
talks about owning, a **workload** is what a review operates on, and a
**technology portfolio** is what you review when you want themes rather than
findings.

Why the workload is the review unit: it is the level of detail business and
technology leaders naturally talk about — small enough to reason about
concretely, large enough that the answers matter outside the engineering team.

```mermaid
flowchart TB
    subgraph TP["<b>Technology portfolio</b> — every workload the organization needs to operate"]
        direction TB
        subgraph WL["<b>Workload</b> — the unit a review operates on"]
            direction LR
            C1["<b>Component</b><br/>code + configuration<br/>+ AWS resources<br/>satisfying one requirement"]
            C2["<b>Component</b><br/>usually the unit of<br/>technical ownership"]
            C3["<b>Component</b><br/>deliberately decoupled<br/>from the others"]
            C1 <-->|"architecture"| C2
            C2 <-->|"architecture"| C3
        end
        W2["Another workload"]
        W3["Another workload"]
        W2 ~~~ W3
    end

    ARCH["<b>Architecture</b><br/>how the components work together —<br/>the communication and interaction<br/>an architecture diagram usually shows"]
    MS["<b>Milestones</b><br/>key changes to the architecture across the lifecycle:<br/>design → implementation → testing → go-live → production"]
    THEME["Reviewing across the <b>portfolio</b> surfaces <b>themes</b> —<br/>several teams clustering issues in the same pillar —<br/>fixable once via a mechanism, training, or a talk,<br/>instead of team by team"]

    WL -.-> ARCH
    ARCH -->|"repeat reviews anchor to"| MS
    TP -.-> THEME

    classDef comp fill:#d7e3fc,stroke:#3b6bc4,stroke-width:2px,color:#10233f
    classDef other fill:#eceff4,stroke:#9aa4b2,stroke-width:1px,color:#1a1a1a
    classDef note fill:#fbeacd,stroke:#c9902f,stroke-width:2px,color:#3f2c0f
    classDef neutral fill:#e8e8e8,stroke:#7a7a7a,stroke-width:2px,color:#1a1a1a
    classDef sub fill:#f7f7f9,stroke:#b0b6c0,stroke-width:1px,color:#1a1a1a
    class C1,C2,C3 comp
    class W2,W3 other
    class THEME note
    class ARCH,MS neutral
    class TP,WL sub
```

---

## 3. The review process

Three things to hold onto: **when** reviews happen, **what kind of process** a
review is, and the fact that AWS's real recommendation is stronger than
periodic reviews — the team that built the architecture reviews it continuously
as it evolves, updating answers rather than convening a meeting.

The design-phase review has a specific job: catching **one-way doors** while
they are still open.

```mermaid
flowchart TB
    subgraph WHEN["<b>When</b> — anchored to milestones"]
        direction LR
        A["<b>Early in design</b><br/>catch one-way doors<br/>before decisions harden"]
        B["<b>Before go-live</b>"]
        C["<b>In production</b><br/>the architecture<br/>keeps evolving"]
        D["<b>On any significant change</b>"]
        A --> B --> C --> D
    end

    subgraph DOORS["<b>The decision test, applied in the design review</b>"]
        direction LR
        TW["<b>Two-way door</b><br/>reversible → lightweight<br/>process, quick call"]
        OW["<b>One-way door</b><br/>hard to reverse → more inspection<br/>before you walk through it"]
        TW ~~~ OW
    end

    subgraph HOW["<b>How</b> — the character of the review"]
        direction LR
        H1["Consistent"]
        H2["Blame-free"]
        H3["Lightweight —<br/>hours, not days"]
        H4["A conversation,<br/>not an audit"]
        H5["Safe enough<br/>to dive deep"]
        H1 --- H2 --- H3 --- H4 --- H5
    end

    OUT["<b>Output:</b> a set of actions that improve the experience of the workload's customers"]
    CONT["AWS's stronger recommendation: <b>the building team reviews continuously</b>,<br/>updating answers as the architecture evolves rather than convening a formal meeting"]

    WHEN -.->|"the design review specifically<br/>hunts for these"| DOORS
    WHEN --> HOW
    HOW --> OUT
    OUT -.-> CONT

    classDef when fill:#d7e3fc,stroke:#3b6bc4,stroke-width:2px,color:#10233f
    classDef how fill:#d6ecd9,stroke:#4a9457,stroke-width:2px,color:#12300f
    classDef door fill:#fadcdc,stroke:#c04a4a,stroke-width:2px,color:#3f1010
    classDef neutral fill:#e8e8e8,stroke:#7a7a7a,stroke-width:2px,color:#1a1a1a
    classDef sub fill:#f7f7f9,stroke:#b0b6c0,stroke-width:1px,color:#1a1a1a
    class A,B,C,D when
    class H1,H2,H3,H4,H5 how
    class TW,OW door
    class OUT,CONT neutral
    class WHEN,HOW,DOORS sub
```

---

## 4. Where the pillars pull against each other

Trade-offs are the part a flat list of six pillars hides. Each row below is one
real tension, resolved against business context rather than by rule. The last
row is the pair that mostly **aligns** instead of competing.

Two pillars sit outside the rows on purpose. **Security** is the one the
framework doesn't ask you to trade away, even when you're trading reliability
down for cost in a dev environment. **Operational Excellence** is up-front
effort that pays back across all five of the others rather than competing with
any of them.

```mermaid
flowchart TB
    subgraph T1["Tension"]
        direction LR
        c1["<b>Cost Optimization</b>"] <-->|"redundancy across AZs and Regions costs money —<br/>a dev/test workload may trade reliability down for cost"| r1["<b>Reliability</b>"]
    end
    subgraph T2["Tension"]
        direction LR
        c2["<b>Cost Optimization</b>"] <-->|"bigger instances, caching layers, and a global<br/>footprint all buy latency with spend"| p2["<b>Performance Efficiency</b>"]
    end
    subgraph T3["Tension"]
        direction LR
        r3["<b>Reliability</b>"] <-->|"consistency and durability get traded<br/>against time and latency"| p3["<b>Performance Efficiency</b>"]
    end
    subgraph T4["Tension"]
        direction LR
        p4["<b>Performance Efficiency</b>"] <-->|"headroom you provision and never use<br/>is energy you spend and waste"| s4["<b>Sustainability</b>"]
    end
    subgraph T5["Aligned, not opposed"]
        direction LR
        c5["<b>Cost Optimization</b>"] <-->|"right-sizing and eliminating idle<br/>capacity serve both at once"| s5["<b>Sustainability</b>"]
    end

    SEC["<b>Security</b> — no tension row.<br/>The pillar the framework does not ask you to trade away."]
    OPS["<b>Operational Excellence</b> — no tension row.<br/>Up-front effort that pays back across all five of the others."]

    T1 ~~~ T2 ~~~ T3 ~~~ T4 ~~~ T5 ~~~ SEC ~~~ OPS

    classDef ops fill:#d7e3fc,stroke:#3b6bc4,stroke-width:2px,color:#10233f
    classDef sec fill:#fadcdc,stroke:#c04a4a,stroke-width:2px,color:#3f1010
    classDef rel fill:#d6ecd9,stroke:#4a9457,stroke-width:2px,color:#12300f
    classDef perf fill:#e4dcf5,stroke:#7a5bbf,stroke-width:2px,color:#24123f
    classDef cost fill:#fbeacd,stroke:#c9902f,stroke-width:2px,color:#3f2c0f
    classDef sus fill:#d3ecea,stroke:#3f9691,stroke-width:2px,color:#0f302f
    classDef sub fill:#f7f7f9,stroke:#b0b6c0,stroke-width:1px,color:#1a1a1a
    class c1,c2,c5 cost
    class r1,r3 rel
    class p2,p3,p4 perf
    class s4,s5 sus
    class SEC sec
    class OPS ops
    class T1,T2,T3,T4,T5 sub
```

---

## 5. Operational Excellence — OPS

**Covers:** a commitment to build software correctly while consistently
delivering a good customer experience — organizing the team, designing the
workload to be operable, running it at scale, and improving it over time.

The four best practice areas form a loop, and **Organization** is deliberately
first: it's the one that sustains the others. The same ordering shows up in the
design principles, where organizing teams around business outcomes is listed
ahead of every technical principle.

```mermaid
flowchart LR
    OPS["<b>Operational Excellence</b><br/>every question carries<br/>the <b>OPS</b> prefix"]

    subgraph BPA["Best practice areas — 4"]
        direction TB
        A1["<b>Organization</b><br/>the one that sustains the other three"]
        A2["<b>Prepare</b><br/>design the workload to be operable"]
        A3["<b>Operate</b><br/>run it at scale"]
        A4["<b>Evolve</b><br/>improve it over time"]
        A1 --> A2 --> A3 --> A4
        A4 -.->|"feeds back"| A1
    end

    subgraph DP["Design principles — 8"]
        direction TB
        P1["Organize teams around business outcomes"]
        P2["Implement observability for actionable insights"]
        P3["Safely automate where possible"]
        P4["Make frequent, small, reversible changes"]
        P5["Refine operations procedures frequently"]
        P6["Anticipate failure"]
        P7["Learn from all operational events and metrics"]
        P8["Use managed services"]
        P1 ~~~ P2 ~~~ P3 ~~~ P4 ~~~ P5 ~~~ P6 ~~~ P7 ~~~ P8
    end

    OPS --> BPA
    OPS --> DP

    classDef ops fill:#d7e3fc,stroke:#3b6bc4,stroke-width:2px,color:#10233f
    classDef opslight fill:#eef3fd,stroke:#3b6bc4,stroke-width:1px,color:#10233f
    classDef sub fill:#f7f7f9,stroke:#b0b6c0,stroke-width:1px,color:#1a1a1a
    class OPS,A1,A2,A3,A4 ops
    class P1,P2,P3,P4,P5,P6,P7,P8 opslight
    class BPA,DP sub
```

---

## 6. Security — SEC

**Covers:** using cloud technologies to protect data, systems, and assets, and
to improve your security posture.

Seven best practice areas is the most of any pillar, and they're easier to hold
as the through-line the framework gives them: control **who can do what**, spot
incidents, protect systems, keep data confidential and intact, and have a
**rehearsed** response.

```mermaid
flowchart LR
    SEC["<b>Security</b><br/><b>SEC</b> prefix"]

    subgraph BPA["Best practice areas — 7, in the order of the through-line"]
        direction TB
        subgraph G1["Control who can do what"]
            direction TB
            A1["Security foundations"]
            A2["Identity and access management"]
            A1 ~~~ A2
        end
        subgraph G2["Spot incidents"]
            A3["Detection"]
        end
        subgraph G3["Protect systems and data"]
            direction TB
            A4["Infrastructure protection"]
            A5["Data protection"]
            A7["Application security"]
            A4 ~~~ A5 ~~~ A7
        end
        subgraph G4["Rehearse the response"]
            A6["Incident response"]
        end
        G1 --> G2 --> G3 --> G4
    end

    subgraph DP["Design principles — 7"]
        direction TB
        P1["Implement a strong identity foundation"]
        P2["Maintain traceability"]
        P3["Apply security at all layers"]
        P4["Automate security best practices"]
        P5["Protect data in transit and at rest"]
        P6["Keep people away from data"]
        P7["Prepare for security events"]
        P1 ~~~ P2 ~~~ P3 ~~~ P4 ~~~ P5 ~~~ P6 ~~~ P7
    end

    SEC --> BPA
    SEC --> DP

    classDef sec fill:#fadcdc,stroke:#c04a4a,stroke-width:2px,color:#3f1010
    classDef seclight fill:#fdf0f0,stroke:#c04a4a,stroke-width:1px,color:#3f1010
    classDef sub fill:#f7f7f9,stroke:#b0b6c0,stroke-width:1px,color:#1a1a1a
    classDef grp fill:#fbeaea,stroke:#d99a9a,stroke-width:1px,color:#3f1010
    class SEC,A1,A2,A3,A4,A5,A6,A7 sec
    class P1,P2,P3,P4,P5,P6,P7 seclight
    class BPA,DP sub
    class G1,G2,G3,G4 grp
```

---

## 7. Reliability — REL

**Covers:** the ability of a workload to perform its intended function correctly
and consistently when it is expected to — including being able to operate and
test it across its whole lifecycle.

The four areas stack: you can't manage change safely without a sound workload
architecture, and you can't manage failure without both. **Stop guessing
capacity** appears here as well as in the general design principles — one of the
few genuine repeats in the framework.

```mermaid
flowchart LR
    REL["<b>Reliability</b><br/><b>REL</b> prefix"]

    subgraph BPA["Best practice areas — 4, each resting on the one before"]
        direction TB
        A1["<b>Foundations</b><br/>requirements that must be in place<br/>before anything else"]
        A2["<b>Workload architecture</b><br/>distributed system design that<br/>survives component failure"]
        A3["<b>Change management</b><br/>change is a source of outage, so make it<br/>planned and reversible"]
        A4["<b>Failure management</b><br/>failures happen; detect, recover,<br/>and learn from them"]
        A1 --> A2 --> A3 --> A4
    end

    subgraph DP["Design principles — 5"]
        direction TB
        P1["Automatically recover from failure"]
        P2["Test recovery procedures"]
        P3["Scale horizontally to increase<br/>aggregate workload availability"]
        P4["Stop guessing capacity<br/><i>also a general design principle</i>"]
        P5["Manage change through automation"]
        P1 ~~~ P2 ~~~ P3 ~~~ P4 ~~~ P5
    end

    REL --> BPA
    REL --> DP

    classDef rel fill:#d6ecd9,stroke:#4a9457,stroke-width:2px,color:#12300f
    classDef rellight fill:#eef7ef,stroke:#4a9457,stroke-width:1px,color:#12300f
    classDef sub fill:#f7f7f9,stroke:#b0b6c0,stroke-width:1px,color:#1a1a1a
    class REL,A1,A2,A3,A4 rel
    class P1,P2,P3,P4,P5 rellight
    class BPA,DP sub
```

---

## 8. Performance Efficiency — PERF

**Covers:** using cloud resources efficiently to meet performance requirements,
*and* holding that efficiency as demand changes and technologies evolve.

The second half of that definition is the harder half, and it's why **Process
and culture** is drawn as the loop back to the start rather than as a fifth item
in a list: efficiency achieved once and never revisited decays.

```mermaid
flowchart LR
    PERF["<b>Performance Efficiency</b><br/><b>PERF</b> prefix"]

    subgraph BPA["Best practice areas — 5"]
        direction TB
        A1["<b>Architecture selection</b>"]
        A2["<b>Compute and hardware</b>"]
        A3["<b>Data management</b>"]
        A4["<b>Networking and content delivery</b>"]
        A5["<b>Process and culture</b><br/>review choices regularly · monitor for deviance<br/>· make experimentation routine"]
        A1 --> A2 --> A3 --> A4 --> A5
        A5 -.->|"or the other four decay"| A1
    end

    subgraph DP["Design principles — 5"]
        direction TB
        P1["Democratize advanced technologies"]
        P2["Go global in minutes"]
        P3["Use serverless architectures"]
        P4["Experiment more often"]
        P5["Consider mechanical sympathy"]
        P1 ~~~ P2 ~~~ P3 ~~~ P4 ~~~ P5
    end

    PERF --> BPA
    PERF --> DP

    classDef perf fill:#e4dcf5,stroke:#7a5bbf,stroke-width:2px,color:#24123f
    classDef perflight fill:#f3effa,stroke:#7a5bbf,stroke-width:1px,color:#24123f
    classDef sub fill:#f7f7f9,stroke:#b0b6c0,stroke-width:1px,color:#1a1a1a
    class PERF,A1,A2,A3,A4,A5 perf
    class P1,P2,P3,P4,P5 perflight
    class BPA,DP sub
```

---

## 9. Cost Optimization — COST

**Covers:** running systems that deliver business value at the lowest price
point.

The shape here is a capability underneath and a loop on top. **Practice Cloud
Financial Management** is framed as an organizational capability you build, not
a task you complete — which is why it sits under the other areas rather than
beside them — and **Optimize over time** feeds back into the cycle, because new
services and better pricing options keep arriving.

```mermaid
flowchart LR
    COST["<b>Cost Optimization</b><br/><b>COST</b> prefix"]

    subgraph BPA["Best practice areas — 5"]
        direction TB
        A2["<b>Expenditure and usage awareness</b><br/>know what is being spent, and by whom"]
        A3["<b>Cost-effective resources</b><br/>the right service, type, and pricing model"]
        A4["<b>Manage demand and supply resources</b><br/>match supply to actual demand"]
        A5["<b>Optimize over time</b><br/>new services and better options keep arriving"]
        A1["<b>Practice Cloud Financial Management</b><br/>a capability the organization builds,<br/>not a task it completes"]
        A2 --> A3 --> A4 --> A5
        A5 -.->|"feeds back"| A2
        A1 -->|"underpins all four"| A2
    end

    subgraph DP["Design principles — 5"]
        direction TB
        P1["Implement Cloud Financial Management"]
        P2["Adopt a consumption model"]
        P3["Measure overall efficiency"]
        P4["Stop spending money on<br/>undifferentiated heavy lifting"]
        P5["Analyze and attribute expenditure"]
        P1 ~~~ P2 ~~~ P3 ~~~ P4 ~~~ P5
    end

    COST --> BPA
    COST --> DP

    classDef cost fill:#fbeacd,stroke:#c9902f,stroke-width:2px,color:#3f2c0f
    classDef costlight fill:#fdf6e9,stroke:#c9902f,stroke-width:1px,color:#3f2c0f
    classDef sub fill:#f7f7f9,stroke:#b0b6c0,stroke-width:1px,color:#1a1a1a
    class COST,A1,A2,A3,A4,A5 cost
    class P1,P2,P3,P4,P5 costlight
    class BPA,DP sub
```

---

## 10. Sustainability — SUS

**Covers:** continually reducing the environmental impact of running cloud
workloads — primarily energy consumption and efficiency — by getting maximum
benefit from what you provision and minimizing what you need at all.

Two things worth noticing. **Region selection** comes first because it's the
highest-leverage decision and the hardest to revisit. And the impact you're
asked to measure is broader than the running workload: it includes customers
using your product, and eventually decommissioning it.

```mermaid
flowchart LR
    SUS["<b>Sustainability</b><br/><b>SUS</b> prefix"]

    subgraph BPA["Best practice areas — 6"]
        direction TB
        A1["<b>Region selection</b><br/>highest leverage, hardest to revisit"]
        A2["<b>Alignment to demand</b><br/>provision only what is actually used"]
        A3["<b>Software and architecture</b>"]
        A4["<b>Data management</b>"]
        A5["<b>Hardware and services</b>"]
        A6["<b>Process and culture</b>"]
        A1 --> A2 --> A3 --> A4 --> A5 --> A6
        A6 -.->|"feeds back"| A2
    end

    subgraph DP["Design principles — 6"]
        direction TB
        P1["Understand your impact"]
        P2["Establish sustainability goals"]
        P3["Maximize utilization"]
        P4["Anticipate and adopt new, more efficient<br/>hardware and software offerings"]
        P5["Use managed services"]
        P6["Reduce the downstream impact<br/>of your cloud workloads"]
        P1 ~~~ P2 ~~~ P3 ~~~ P4 ~~~ P5 ~~~ P6
    end

    SCOPE["<b>Impact means all sources of it</b><br/>the running workload · customers using your product<br/>· eventually decommissioning and retiring it"]

    SUS --> BPA
    SUS --> DP
    DP -.->|"what <b>Understand your impact</b><br/>actually asks you to measure"| SCOPE

    classDef sus fill:#d3ecea,stroke:#3f9691,stroke-width:2px,color:#0f302f
    classDef suslight fill:#edf7f6,stroke:#3f9691,stroke-width:1px,color:#0f302f
    classDef neutral fill:#e8e8e8,stroke:#7a7a7a,stroke-width:2px,color:#1a1a1a
    classDef sub fill:#f7f7f9,stroke:#b0b6c0,stroke-width:1px,color:#1a1a1a
    class SUS,A1,A2,A3,A4,A5,A6 sus
    class P1,P2,P3,P4,P5,P6 suslight
    class SCOPE neutral
    class BPA,DP sub
```

---

## Where to go next

- [`flashcards.md`](flashcards.md) — 112 cards across the same seven domains, for recall drilling
- [`cheatsheet.html`](cheatsheet.html) — the one-page printable version of all of the above
- [`../aws/`](../aws) — SAA-C03, covering the services these answers get built from
