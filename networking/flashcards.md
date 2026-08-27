# CompTIA Network+ — flashcards

155 cards. Exported to Anki by scripts/export-anki.mjs.
<!-- domains: Networking Concepts | Network Implementation | Network Operations | Network Security | Network Troubleshooting -->

## Networking Concepts

### `osi-model` · OSI Model

**List the seven OSI layers in order, 1 through 7.**

<details><summary>Answer</summary>

1) Physical. 2) Data Link. 3) Network. 4) Transport. 5) Session. 6) Presentation. 7) Application. Bottom-up mnemonic: 'Please Do Not Throw Sausage Pizza Away.'

</details>

### `osi-layer3-network` · OSI Model

**Which OSI layer is responsible for choosing a path across networks based on IP addresses rather than MAC addresses?**

<details><summary>Answer</summary>

Layer 3, the Network layer, where a router directs each packet using its destination IP address.

</details>

### `osi-layer5-session` · OSI Model

**Which OSI layer is responsible for opening, maintaining, and tearing down the dialogue between two communicating hosts?**

<details><summary>Answer</summary>

Layer 5, the Session layer, it manages that ongoing conversation, distinct from Transport below it (moving the data) and Presentation above it (formatting it).

</details>

### `osi-layer6-presentation` · OSI Model

**Which OSI layer translates and formats data, such as encryption or compression?**

<details><summary>Answer</summary>

Layer 6, the Presentation layer, it converts data into a common format so the Application layer above can actually use it.

</details>

### `osi-layer1-physical` · OSI Model

**Which OSI layer covers the cabling, connectors, and raw bit signaling itself?**

<details><summary>Answer</summary>

Layer 1, the Physical layer — the actual medium and its electrical, optical, or radio signaling. Faults here show up as dead links, attenuation, and CRC errors rather than anything software-shaped.

</details>

### `osi-layer2-datalink` · OSI Model

**Which OSI layer moves frames between directly connected devices using MAC addresses?**

<details><summary>Answer</summary>

Layer 2, the Data Link layer, where switches forward frames by MAC address within a single network segment — one hop at a time, in contrast to Layer 3's end-to-end routing by IP address.

</details>

### `osi-layer4-transport` · OSI Model

**Which OSI layer delivers data end-to-end using port numbers, choosing between reliable and best-effort delivery?**

<details><summary>Answer</summary>

Layer 4, the Transport layer, home of TCP and UDP — it segments the data and addresses it to a port, deciding whether the conversation gets TCP's delivery guarantees or UDP's speed.

</details>

### `osi-layer7-application` · OSI Model

**Which OSI layer do protocols like HTTP, DNS, and SMTP operate at?**

<details><summary>Answer</summary>

Layer 7, the Application layer — not the application itself, but the network-facing protocols software speaks, sitting on top of everything the six layers below already handled.

</details>

### `tcp-udp` · TCP vs. UDP

**What tradeoff separates TCP from UDP?**

<details><summary>Answer</summary>

TCP (RFC 9293) tracks every segment with sequence numbers and acknowledgments so nothing is lost, duplicated, or delivered out of order, but that bookkeeping adds overhead. UDP (RFC 768) skips all of it and just fires datagrams with no delivery guarantee, trading reliability for speed — a fit for DNS lookups or live media where a resend would arrive too late to matter.

</details>

### `icmp` · ICMP

**Why doesn't ICMP carry application data, and what is it used for instead?**

<details><summary>Answer</summary>

ICMP (RFC 792) never carries application payloads. IP uses it purely to report back problems (an unreachable host, an expired TTL) and diagnostic conditions to the sender, which is the entire foundation ping and traceroute are built on top of.

</details>

### `ftp-port` · FTP

**What TCP ports does FTP use for its control and data connections?**

<details><summary>Answer</summary>

FTP uses two TCP ports: 21 for the control connection that carries commands, and 20 for the separate connection that transfers the file data itself.

</details>

### `ssh-port` · SSH

**What single TCP port carries all of SSH's functionality, shell, SFTP, and SCP alike?**

<details><summary>Answer</summary>

SSH runs its encrypted shell session, plus SFTP or SCP file transfer, over a single TCP port: 22.

</details>

### `rdp-port` · RDP

**What TCP port does RDP use to carry a full remote desktop session?**

<details><summary>Answer</summary>

RDP uses TCP port 3389 to stream a full graphical Windows desktop to the client, rather than a bare command-line shell like SSH.

</details>

### `dns-port` · DNS

**What port does DNS use for an everyday lookup?**

<details><summary>Answer</summary>

DNS answers routine lookups on UDP port 53.

</details>

### `dns-tcp-fallback` · DNS

**What are the two cases where DNS uses TCP port 53 instead of UDP?**

<details><summary>Answer</summary>

Zone transfers between authoritative servers always run over TCP — AXFR is defined only for TCP (RFC 5936), since a full zone copy needs reliable delivery. An ordinary lookup switches only when it must: a response too large for UDP comes back truncated with the TC bit set (RFC 1035), telling the resolver to retry that query over TCP.

</details>

### `dhcp-ports` · DHCP

**What UDP ports does DHCP use, and which side of the exchange listens on which port?**

<details><summary>Answer</summary>

A DHCP server listens for requests on UDP port 67, while the client receives its offer on the adjacent UDP port 68.

</details>

### `web-ports` · HTTP vs. HTTPS

**How do HTTP and HTTPS differ beyond just the port number?**

<details><summary>Answer</summary>

HTTP is a plaintext, stateless request/response exchange on TCP port 80 — the server remembers nothing between requests, which is why cookies exist. HTTPS is that same exchange wrapped in a TLS session on TCP port 443, adding server authentication and encrypting everything sent afterward.

</details>

### `snmp-ports` · SNMP

**What UDP ports does SNMP use, and how do the two directions of traffic differ?**

<details><summary>Answer</summary>

A manager polls devices for status on UDP port 161; devices separately push unsolicited trap alerts to that same manager over UDP port 162.

</details>

### `ldap-port` · LDAP Port

**What TCP port does LDAP use for directory queries and updates?**

<details><summary>Answer</summary>

LDAP reads and writes a centralized directory of user and group records over TCP port 389.

</details>

### `sip-ports` · SIP

**What ports does SIP use to signal a call, and what changes when that signaling needs to be encrypted?**

<details><summary>Answer</summary>

SIP signals calls in the clear on port 5060, switching to a TLS-encrypted signaling channel on port 5061 when that protection is required.

</details>

### `telnet-port` · Telnet vs. SSH

**Telnet and SSH both deliver a remote command-line session. What port does each use, and why is Telnet now a legacy protocol?**

<details><summary>Answer</summary>

Telnet (RFC 854) carries its remote shell over TCP port 23 with no encryption at all — every keystroke, including the login password, crosses the network in plaintext. SSH provides the same capability inside an encrypted channel on TCP port 22, which is why Telnet survives only on old gear that supports nothing better.

</details>

### `smtp-ports` · SMTP vs. SMTPS

**An email client submitting an outgoing message and two mail servers relaying between themselves use different ports. Which port handles each job, and why are they separate?**

<details><summary>Answer</summary>

Server-to-server relay — one mail server handing a message to the next — runs plain SMTP on TCP port 25 (RFC 5321). SMTPS on TCP port 587 is the submission side (RFC 6409): the port where an end user's client hands over outgoing mail and the server demands authentication first (and, in modern practice, TLS — the 'Secure' in SMTPS), keeping credentialed customer traffic separate from the untrusted relay world of port 25.

</details>

### `tftp-port` · TFTP vs. FTP

**What port does TFTP use, and what makes it 'trivial' compared to FTP?**

<details><summary>Answer</summary>

TFTP (RFC 1350) runs over UDP port 69 — immediately next to DHCP's 67/68, a classic transposition trap. The 'trivial' is literal: no authentication, no directory browsing, and connectionless UDP instead of FTP's two TCP connections (21 for control, 20 for data), leaving it fit mainly for simple jobs like pushing firmware or config files to network devices on a trusted LAN.

</details>

### `smb-port` · SMB

**What TCP port does a Windows machine use to reach a shared folder or network printer?**

<details><summary>Answer</summary>

TCP port 445, SMB's port. SMB is Microsoft-proprietary — no RFC defines it, unlike most of the port list — and it handles file and printer sharing across Windows networks, which is why port 445 traffic ordinarily stays inside the LAN rather than ever crossing the open internet.

</details>

### `syslog-port` · Syslog

**What port does a device send its Syslog messages to on a central log collector?**

<details><summary>Answer</summary>

UDP port 514 (RFC 5426). Syslog is the standard way devices forward logs to one centralized collection point in near-real time, and UDP keeps that cheap for the sender — but with no delivery guarantee, a dropped log datagram is simply gone, fire-and-forget rather than reliable transfer.

</details>

### `ldaps-port` · LDAPS vs. LDAP

**What changes when a directory client connects to TCP port 636 instead of 389?**

<details><summary>Answer</summary>

Port 636 is LDAPS — the same LDAP directory protocol wrapped in TLS from the moment the connection opens, so the bind credentials and query results that plain LDAP on TCP 389 sends in cleartext are encrypted in transit. The directory content is identical; only the protection of the session changes.

</details>

### `sql-server-port` · SQL Server

**A firewall rule must let an application server reach a Microsoft SQL Server database. What port does that rule open?**

<details><summary>Answer</summary>

TCP port 1433, SQL Server's default listening port. Because a database typically holds an organization's most sensitive data, 1433 should be reachable only from the internal systems that genuinely query it — finding it open to the internet is a security finding, not a convenience.

</details>

### `http-https-ports` · HTTP & HTTPS Ports

**What TCP port does each of HTTP and HTTPS listen on by default?**

<details><summary>Answer</summary>

HTTP listens on TCP port 80 and HTTPS on TCP port 443 — the pair every URL implies on its own, which is why an address beginning https:// sends the browser to 443 without a port ever being typed.

</details>

### `gre-vs-ipsec` · GRE vs. IPSec

**GRE and IPSec both tunnel one IP packet inside another. What does IPSec provide that GRE never does, and which three components deliver it?**

<details><summary>Answer</summary>

GRE (RFC 2784) only encapsulates — the inner packet rides through the tunnel with no protection whatsoever. IPSec secures the same tunneling idea with three pieces: AH (RFC 4302) provides integrity and authentication so the packet can't be altered or forged, ESP (RFC 4303) adds encryption for confidentiality, and IKE (RFC 7296) is the negotiation that establishes the keys the other two depend on.

</details>

### `traffic-types` · Unicast, Broadcast, Multicast & Anycast

**Contrast unicast, broadcast, multicast, and anycast delivery.**

<details><summary>Answer</summary>

Unicast: one sender, one receiver. Broadcast (RFC 919): one sender, every host on the local segment. Multicast (RFC 1112): one sender, only the hosts that joined that group. Anycast (RFC 4291): a single address shared by several interfaces, but each packet lands on just whichever one is topologically nearest.

</details>

### `rfc1918-apipa` · RFC 1918 Private Addressing vs. APIPA

**How is an RFC 1918 address fundamentally different in origin from an APIPA address?**

<details><summary>Answer</summary>

RFC 1918's three private blocks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) are chosen deliberately by whoever designs the network. APIPA (RFC 3927), from the separate 169.254.0.0/16 block, is never chosen — a host grabs one only after it gave up trying to reach a DHCP server, so finding one on an interface is itself the symptom of a broken DHCP path.

</details>

### `subnetting-cidr-vlsm` · Subnetting, VLSM & CIDR

**How do subnetting, VLSM, and CIDR build on each other?**

<details><summary>Answer</summary>

Subnetting reassigns some host bits to the network portion to carve a big network into smaller ones. VLSM takes that further by allowing each resulting subnet its own mask length, so a tiny 2-address link and a 200-host segment aren't forced into equal-sized blocks. CIDR (RFC 4632) is what made that classless, slash-notation approach official, retiring the rigid Class A/B/C system.

</details>

### `spine-leaf` · Spine-Leaf Architecture

**What does spine-leaf guarantee that older three-tier designs did not, and why does it matter now?**

<details><summary>Answer</summary>

Every leaf switch connects to every spine switch, so a packet crossing from any leaf to any other leaf always takes the same number of hops — no unpredictable long way around. That matters because modern workloads like microservices generate heavy east-west (server-to-server) traffic, which spine-leaf handles far more evenly than designs built around north-south (in-and-out of the data center) traffic.

</details>

### `sdn` · SDN (Software-Defined Networking)

**What does SDN pull apart, and what does centralizing it enable?**

<details><summary>Answer</summary>

SDN pulls the control plane — the decision-making about how traffic should flow — away from the data plane, the actual switches and routers forwarding packets. Concentrating that decision-making in one software controller means the whole network can be reconfigured from a single point instead of touching every device by hand.

</details>

### `zero-trust` · Zero Trust Architecture

**What assumption does zero trust architecture (NIST SP 800-207) reject?**

<details><summary>Answer</summary>

It rejects the idea that being 'inside' the network perimeter earns any automatic trust at all. Instead, every single access request is authenticated and authorized in the moment it's made, and whatever gets approved is scoped down to the minimum access actually needed for that request.

</details>

### `vxlan` · VXLAN

**What limitation of plain 802.1Q VLANs does VXLAN's addressing fix?**

<details><summary>Answer</summary>

802.1Q's VLAN ID is only 12 bits, capping a network at roughly 4,000 usable VLANs — too few for a large multi-tenant data center. VXLAN (RFC 7348) tunnels Layer 2 traffic over an existing IP network and tags each segment with a 24-bit VXLAN Network Identifier instead, opening up more than 16 million possible segments.

</details>

### `ipv6-128-bit` · IPv6 Addressing

**What problem drove IPv6's move to a much larger address field, and what long-standing IPv4 workaround does that abundance turn into a choice?**

<details><summary>Answer</summary>

IPv4's 32-bit field tops out around 4.3 billion (2^32) addresses — nowhere near enough for every modern device, and that exhaustion is exactly what made sharing one public address through NAT a survival mechanism. IPv6 (RFC 8200) widens the field to 128 bits, a 2^128 address space so vast that every host can carry its own globally unique address, turning NAT from a necessity into an option.

</details>

### `dual-stack-vs-tunneling` · Dual-Stack vs. Tunneling

**During the IPv4-to-IPv6 transition, when does a network need tunneling instead of simply running dual-stack?**

<details><summary>Answer</summary>

Dual-stack runs IPv4 and IPv6 side by side on the same device or network, natively reaching destinations on either version — but that only works where both protocols are supported along the way. Tunneling exists for when they aren't: it encapsulates IPv6 packets inside IPv4 (or the reverse) so they can ride across a stretch of network that speaks only one version, with the wrapper stripped off at the far end.

</details>

### `nat64` · IPv6 Transition Technologies

**An IPv6-only client needs to reach a server that never adopted IPv6 at all. Which transition technology makes that work, and how?**

<details><summary>Answer</summary>

Neither dual-stack nor tunneling helps here, because both still assume the destination itself can speak IPv6. NAT64 (RFC 6146) instead translates: a gateway rewrites each packet between IPv6 and IPv4, so an IPv6-only client can hold a conversation with an IPv4-only server even though the two sides share no common protocol.

</details>

### `iaas-paas-saas` · IaaS vs. PaaS vs. SaaS

**Moving up from IaaS to PaaS to SaaS, what does the consumer hand over to the provider at each step?**

<details><summary>Answer</summary>

Under NIST SP 800-145, an IaaS consumer never manages the underlying infrastructure but still controls operating systems, storage, and deployed applications — even choosing which OS to run. PaaS hands the OS and storage over too, leaving the consumer control of only the deployed applications and some settings of the environment hosting them. SaaS surrenders even that: the consumer simply uses the provider's finished application, keeping at most limited user-specific configuration settings.

</details>

### `cloud-deployment-models` · Public vs. Private vs. Hybrid Cloud

**A third party hosts and operates a cloud entirely off premises — can that still count as a private cloud?**

<details><summary>Answer</summary>

Yes — NIST SP 800-145 defines the deployment models by who may use the infrastructure, not who runs it or where: a private cloud is provisioned for the exclusive use of a single organization, even when a third party owns and operates it off premises. A public cloud is instead provisioned for open use by the general public and sits on the provider's own premises. A hybrid cloud composes two or more distinct clouds (private, community, or public) that remain unique entities but are bound by technology enabling data and application portability, such as bursting load from one into another.

</details>

### `elasticity-scalability-multitenancy` · Elasticity vs. Scalability vs. Multitenancy

**A cloud platform that can grow to meet rising demand is scalable. What more must it do to count as elastic, and what does multitenancy describe instead?**

<details><summary>Answer</summary>

Elasticity adds automatic movement in both directions: NIST SP 800-145's rapid elasticity provisions and releases capacity to scale outward and inward with demand, in some cases automatically — so where a scalable system can grow, an elastic one also shrinks back on its own instead of holding idle capacity. Multitenancy is a different dimension entirely: NIST's resource-pooling characteristic has one shared pool of physical and virtual resources serving multiple consumers, dynamically reassigned as demand shifts, with virtualization keeping each tenant's slice logically separate.

</details>

### `vpc-security-groups` · VPC & Security Groups

**Inside a cloud provider's shared infrastructure, what gives one customer an isolated network of their own — and what then filters traffic to the individual resources inside it?**

<details><summary>Answer</summary>

A Virtual Private Cloud (VPC): a logically separated slice of the provider's network that the customer controls, with its own address ranges and routing, so tenants on the same physical hardware stay walled off from one another. Security groups — network security groups on some platforms — are the stateful virtual firewall rules attached to individual resources inside that VPC, deciding what traffic may reach or leave each one. Both are cloud-provider constructs rather than IETF standards — AWS, Azure, and GCP each implement their own version (AWS security groups, Azure network security groups, GCP firewall rules).

</details>

### `cloud-gateways-connectivity` · Cloud Gateways & Connectivity Options

**Why route a VPC's private subnet through a NAT gateway instead of the internet gateway, and what does Direct Connect offer over a VPN for reaching that VPC from on-premises?**

<details><summary>Answer</summary>

A NAT gateway is deliberately one-way: instances behind it can initiate outbound connections, but nothing on the internet can initiate a connection back in — while an internet gateway carries traffic in both directions for any resource holding a public IP. From on-premises, a VPN reaches the cloud through an encrypted tunnel across the public internet, cheap and quick to stand up; Direct Connect instead runs a dedicated physical circuit that bypasses the internet for more consistent bandwidth and latency, though unlike the VPN it is not encrypted by default.

</details>

### `single-mode-vs-multimode-fiber` · Single-Mode vs. Multimode Fiber

**A campus link has to cover several kilometers on one unbroken fiber run. Which fiber type does that require, and what physically lets it go that far?**

<details><summary>Answer</summary>

Single-mode fiber — its tiny core (about 9 µm) forces laser light down one single path, eliminating the modal dispersion that would otherwise smear the signal, which is what lets it run for tens of kilometers. Multimode's much wider core (50 or 62.5 µm) lets light travel many paths at once: cheaper LED or VCSEL sources can drive it, but those paths arrive slightly out of step, capping runs at a few hundred meters — roughly 300 m at 10Gbps on OM3.

</details>

### `fiber-connector-types` · Fiber Connectors: LC, SC, ST & MPO

**Sorting loose fiber patch cables: one plug is a small latching clip that fits an SFP, one is a larger square push-pull, one twists onto a bayonet mount, and one rectangular plug holds a whole row of fibers. Identify all four connectors.**

<details><summary>Answer</summary>

The small latching one is LC, built on a 1.25 mm ferrule — that compactness is why it became the standard on SFP/SFP+ transceiver cages. The square push-pull is SC and the bayonet twist-lock is the older ST, both built around a 2.5 mm ferrule twice LC's size. The rectangular multi-fiber plug is MPO, which packs 12 or 24 fibers into one ferrule so parallel-optic links like 40G/100G QSFP can carry several lanes through a single connection.

</details>

### `copper-connector-types` · Copper Connectors: RJ11, RJ45, F-type & BNC

**Match four copper connectors to their services: an 8-pin modular plug, a narrower 6-position modular plug, a threaded screw-on coax connector, and a twist-lock coax connector.**

<details><summary>Answer</summary>

RJ45 is the 8-pin (8P8C) modular plug that terminates twisted-pair Ethernet; RJ11 is the narrower 6-position plug for analog telephone and DSL lines — small enough to seat, uselessly and sometimes damagingly, inside an RJ45 jack. On coax, F-type is the threaded connector that screws onto cable-TV and cable-modem drops, while BNC is the bayonet twist-lock surviving from 10BASE-2 Ethernet, now seen mostly on CCTV and test equipment.

</details>

### `plenum-vs-non-plenum` · Plenum vs. Non-Plenum Cable

**Fire code allows ordinary PVC-jacketed cable inside a wall but forbids it in the space above a drop ceiling that returns HVAC air. What is different about that ceiling space?**

<details><summary>Answer</summary>

That void is a plenum — part of the building's air-circulation path — so a burning cable there would feed flame and toxic smoke directly into the air being pushed through occupied spaces. The US National Electrical Code therefore requires plenum-rated (CMP) cable in any air-handling space: its fluoropolymer or treated low-smoke jacket resists spreading flame and emits far less smoke than ordinary PVC. The substitution runs one way only — plenum cable may be used anywhere, but riser (CMR) or general-purpose cable can never go into a plenum.

</details>

### `load-balancer-vs-proxy` · Load Balancer vs. Proxy

**A load balancer and a proxy both stand between clients and servers. What is each one actually doing with the traffic that passes through it?**

<details><summary>Answer</summary>

A load balancer works for the servers: it spreads incoming client requests across a pool of backend servers so no single one is overwhelmed, improving both performance and availability. A proxy works for the clients: it sits between internal clients and the outside network and makes requests on their behalf, able to inspect, cache, or filter what passes through — so external systems only ever talk to the proxy, never directly to an internal host.

</details>

### `cdn-edge-caching` · CDN (Content Delivery Network)

**Why does a CDN scatter cached copies of content across servers near end users instead of serving every request from the one origin server?**

<details><summary>Answer</summary>

Because distance costs latency: a request answered from a nearby edge location makes a far shorter round trip than one that must reach a single distant origin. Spreading the caches out also spares that origin from absorbing every user's request itself — it gets involved only when an edge server doesn't already hold what was asked for.

</details>

### `nas-vs-san` · NAS vs. SAN

**NAS and SAN both put storage on a network. What kind of access does each present, and over what kind of network does each operate?**

<details><summary>Answer</summary>

NAS is a dedicated storage device sitting on the ordinary shared network, reached at the file level over standard file-sharing protocols — clients see folders and files. A SAN is a separate, dedicated high-speed network that presents storage to servers as raw block-level devices, so a server treats it like a locally attached disk — the answer when NAS's shared, file-level approach isn't fast or granular enough.

</details>

### `firewall-generations` · Firewall Types

**Stepping up from a packet-filtering firewall to stateful inspection to an NGFW, what new capability arrives at each step?**

<details><summary>Answer</summary>

A packet-filtering firewall judges each packet in isolation, checking only IP addresses, ports, and protocol type. Stateful inspection adds memory: it tracks each connection across its whole lifetime, so context from earlier packets in a session informs the verdict on later ones. A next-generation firewall (NGFW) stacks deep packet inspection, application-level awareness, and built-in intrusion prevention on top of that — already inline by design, it is a natural place for IPS functionality to live.

</details>

### `ttl-hop-count` · TTL (Time to Live)

**The 'time' in TTL suggests a clock. What actually makes an IP packet's TTL value drop, and what happens to a packet whose TTL reaches zero?**

<details><summary>Answer</summary>

Passing through a router: RFC 791 requires every module that processes a datagram to decrease TTL by at least one, even when it handled the packet in under a second — so in practice TTL is a hop-count ceiling, not a timer. A datagram whose TTL reaches zero must be destroyed, the hard guarantee that an undeliverable packet caught in a routing loop dies after a bounded number of hops instead of circling forever.

</details>

### `three-tier-vs-collapsed-core` · Three-Tier vs. Collapsed Core

**A smaller campus network wants the three-tier design's structure without three tiers of hardware. Which two layers merge in a collapsed-core design, and why is the third layer never the one absorbed?**

<details><summary>Answer</summary>

The distribution layer — which aggregates access-layer traffic and enforces policy at the boundary — merges with the core, the high-speed backbone, into one layer doing both jobs, trading some scalability for lower cost and complexity. The access layer can't be collapsed away because it's where end devices physically connect: whatever else merges, endpoints still need ports to plug into. Spine-leaf is a different two-layer answer entirely — the data center design that largely replaced three-tier there — while collapsed core is the campus-scale economization.

</details>

### `ids-vs-ips` · IDS vs. IPS

**Why can an IDS only alert on an attack while an IPS can actually stop it?**

<details><summary>Answer</summary>

An IDS typically only sees a mirrored copy of traffic (off a SPAN port, for instance) — it never sits in the actual forwarding path, so the most it can do is analyze and raise an alert. An IPS sits directly inline, which is exactly what lets it drop or block a malicious packet in real time instead of just reporting it after the fact.

</details>

## Network Implementation

### `static-vs-dynamic-routing` · Static vs. Dynamic Routing

**What do you give up by hand-entering static routes instead of running a dynamic protocol?**

<details><summary>Answer</summary>

A static route costs nothing in overhead and behaves exactly as configured, but it has no awareness of the network around it — if the path it points to goes down, it just keeps pointing there until a person fixes it. A dynamic protocol trades that simplicity for routers that talk to each other and recalculate paths automatically the moment the topology changes.

</details>

### `ospf` · OSPF

**How does OSPF arrive at its routing decisions?**

<details><summary>Answer</summary>

OSPF (RFC 2328) is a link-state protocol confined to a single autonomous system: every router floods details of its local links out to the rest of the area, so all of them converge on an identical topology map and each independently runs its own shortest-path-first calculation against it.

</details>

### `eigrp` · EIGRP

**Why does EIGRP recover from a failure faster than RIP does?**

<details><summary>Answer</summary>

EIGRP (RFC 7868) is Cisco's own distance-vector protocol, but it runs the Diffusing Update Algorithm (DUAL), which works out backup paths ahead of time, before anything actually breaks. RIP has no such head start — it only starts recalculating after a failure is detected, which is slower by comparison.

</details>

### `bgp` · BGP

**What makes BGP a 'path-vector' protocol, and where does it operate?**

<details><summary>Answer</summary>

BGP (RFC 4271) is the exterior protocol that glues independently run autonomous systems together across the public internet, rather than routing inside any one of them. Its path-vector label comes from how it picks a route: mainly by inspecting the AS path attribute, the literal chain of autonomous systems an announcement already passed through, not by tallying link costs.

</details>

### `administrative-distance` · Administrative Distance

**Administrative distance settles a tie between which two things — protocols, or routes within one protocol?**

<details><summary>Answer</summary>

Between protocols, not routes within a protocol. When OSPF and EIGRP both hand the router a path toward one identical network, only the entry with the lower AD value gets installed — EIGRP's 90 beats OSPF's 110 by default — with zero comparison of which route is quicker or more efficient. Ranking multiple paths inside one already-selected protocol is metric's job, a separate calculation that happens afterward.

</details>

### `nat-pat` · NAT vs. PAT

**What extra piece of the packet does PAT rewrite that Basic NAT leaves alone?**

<details><summary>Answer</summary>

Basic NAT (RFC 3022) swaps only the IP address, so it needs one public address per internal host that's active simultaneously. PAT also rewrites the source port number, which is what lets an entire private network share just one public IP address at once — the setup almost every home router actually runs.

</details>

### `fhrp` · FHRP (First Hop Redundancy Protocol)

**From an end host's point of view, what changes when an FHRP fails over to a backup router?**

<details><summary>Answer</summary>

Nothing that the host can see. An FHRP has a group of routers share one virtual IP address configured as the default gateway, and if whichever router is actively forwarding traffic goes down, another member of the group silently assumes that same virtual IP along with its virtual MAC address — so even the ARP mapping hosts have already cached stays valid, and the gateway never changes on the host's end.

</details>

### `hsrp-vs-vrrp` · HSRP vs. VRRP

**Between HSRP and VRRP, which one is the vendor-neutral standard?**

<details><summary>Answer</summary>

VRRP is the open one — an IETF Standards Track protocol (RFC 9568, which obsoleted the earlier RFC 5798). HSRP is Cisco's own creation, and RFC 2281 only carries Informational status, confirming it as a vendor protocol rather than an IETF standard. Because they use different multicast addresses, packet formats, and virtual MAC ranges, a router running one can't join a group running the other.

</details>

### `vlan` · VLAN

**Why can't two hosts on the same physical switch but different VLANs talk directly at Layer 2?**

<details><summary>Answer</summary>

Each VLAN is its own broadcast domain, so hosts in separate VLANs are cut off from each other at Layer 2 no matter how they're physically cabled — reaching across requires routing, exactly as if they lived on two separate physical networks.

</details>

### `trunk-8021q` · Trunk Ports & 802.1Q

**What's the one VLAN 802.1Q lets cross a trunk without a tag, and why is that risky?**

<details><summary>Answer</summary>

The native VLAN is exempt from tagging by convention, kept for compatibility with older gear. The risk shows up if the two switches on either end of a trunk disagree about which VLAN is native — frames from each side's native VLAN then land in whatever VLAN the far end treats as native, quietly bridging traffic across a boundary that should have held.

</details>

### `link-aggregation-lacp` · Link Aggregation & LACP

**What can LACP catch that a plain static EtherChannel bundle cannot?**

<details><summary>Answer</summary>

LACP (IEEE 802.1AX) actively negotiates membership and keeps checking that both ends still agree on the bundle's configuration, so it notices a misconfigured or dead link and automatically drops it out of rotation. A static bundle has no such negotiation — a port whose link physically dies still drops out on its own, but a link that stays up while the far end isn't actually bundling (misconfigured, or cabled to the wrong port) keeps receiving hashed traffic it silently black-holes.

</details>

### `spanning-tree` · Spanning Tree Protocol (STP)

**In STP, what does a blocking port do that a designated port does not?**

<details><summary>Answer</summary>

Every non-root switch first picks its root port, the best path toward the elected root bridge (the root bridge itself has none — all of its ports are designated), and a designated port to forward for each segment. Any remaining port that would otherwise complete a loop is put into blocking — it stays physically up and keeps listening, but discards frames, ready to be promoted to forwarding if the active path ever fails — though classic 802.1D still walks it through listening and learning first rather than flipping it over instantly.

</details>

### `ssid-bssid` · SSID vs. BSSID vs. ESSID

**A client roams between two access points broadcasting the same network name without ever reassociating from scratch. What made that possible?**

<details><summary>Answer</summary>

Both radios share one SSID (the name the client sees) but each has its own unique BSSID (its individual MAC address). The ESSID is the label for that whole set of access points cooperating under one SSID, which is exactly what lets a client hop between BSSIDs while the network name it's connected to never appears to change.

</details>

### `wpa2` · WPA2

**Once an attacker has captured a WPA2 four-way handshake, what attack does that enable?**

<details><summary>Answer</summary>

WPA2 secures data with AES-CCMP and derives its session key during a four-way handshake — the exchange in which the client proves it knows the pre-shared key. Because that handshake alone is enough to attempt cracking, a captured copy lets an attacker try dictionary or brute-force guesses entirely offline, at whatever speed their own hardware allows.

</details>

### `wpa3` · WPA3

**What happens to pre-shared keys under personal WPA3, and how does SAE change the cracking math?**

<details><summary>Answer</summary>

Personal WPA3 still relies on a PSK. What changes is SAE (the Dragonfly handshake): rather than a handshake an attacker can capture once and crack offline forever, SAE forces a fresh live exchange with the actual access point for every single guess, which makes brute-forcing dramatically slower and easy to notice happening.

</details>

### `wifi-24ghz-channel-overlap` · 2.4GHz Channel Planning

**The 2.4GHz band numbers its channels all the way up to 14, yet a US channel plan assigns access points only 1, 6, and 11. What about the band's channel layout makes every other choice interfere?**

<details><summary>Answer</summary>

Channel centers sit only 5MHz apart while a single transmission spreads across roughly 22MHz of spectrum, so each channel heavily overlaps its neighbors — two APs on adjacent-numbered channels corrupt each other's signals rather than coexisting. Only channels spaced five apart stay clear of one another, and within the 1-11 range legal in the US, that yields exactly one three-channel plan: 1, 6, and 11.

</details>

### `wifi-band-tradeoffs` · Wi-Fi Frequency Bands & Band Steering

**Moving from 2.4GHz up through 5GHz to 6GHz Wi-Fi, what gets traded away and what gets gained — and which clients does band steering push where?**

<details><summary>Answer</summary>

Lower frequency carries farther and penetrates walls better, so 2.4GHz has the longest reach — but only three non-overlapping channels and shared tenants like microwave ovens and cordless phones leave it congested. Each step up trades range and penetration for cleaner, wider spectrum: 5GHz offers many more non-overlapping channels, and 6GHz (opened to Wi-Fi with Wi-Fi 6E) adds even more while staying the least congested of all, since only the newest clients can use it. Band steering has the AP nudge dual-band-capable clients up to 5/6GHz, reserving the crowded 2.4GHz band for the devices that support nothing else.

</details>

### `dfs-5ghz-radar` · 5GHz Spectrum Sharing

**Mid-morning, a healthy 5GHz access point on a UNII-2 channel abruptly abandons it and moves every client to a different channel — and no neighboring Wi-Fi network triggered it. What did the AP detect, and why must it move?**

<details><summary>Answer</summary>

Radar. The UNII-2 and UNII-2 Extended sub-bands are shared with weather and military radar systems, which are the licensed incumbents there — so Dynamic Frequency Selection (DFS, added to 802.11 by the 802.11h amendment) requires an AP using those channels to keep listening for radar signatures and vacate within seconds of spotting one, automatically shifting its connected clients elsewhere.

</details>

### `psk-vs-enterprise-wireless-auth` · PSK vs. Enterprise Wireless Authentication

**Why does revoking one user's Wi-Fi access force a passphrase change for everyone under PSK, and what lets Enterprise mode revoke just that one user?**

<details><summary>Answer</summary>

A PSK proves only membership — every client authenticates with the same shared passphrase, so the network never learns which specific user or device connected, and cutting one person off means rotating the secret for everybody. Enterprise mode instead authenticates each user or device individually through 802.1X against a back-end AAA server — RADIUS (RFC 2865) carries the exchange, with EAP (RFC 3748) framing whichever credential type is actually in use — so one compromised account can be disabled without touching anyone else's.

</details>

### `omni-vs-directional-antennas` · Omnidirectional vs. Directional Antennas

**What coverage shape does an omnidirectional antenna cast versus a directional one, and which physical deployment calls for each?**

<details><summary>Answer</summary>

An omnidirectional antenna radiates roughly equally in every horizontal direction, casting a circular coverage area with no aiming required — the right shape for blanketing a room or floor, and the default built into consumer access points. A directional antenna (commonly a Yagi, or a parabolic dish for the longest links) concentrates the signal into one narrow aimed beam, buying far more range and signal strength in that single direction at the cost of coverage everywhere else — the shape a fixed point-to-point link between two buildings needs.

</details>

### `autonomous-vs-lightweight-ap` · Autonomous vs. Lightweight APs

**A wireless deployment grows from three access points to three hundred. Why does the autonomous AP model stop scaling there, and what does a lightweight AP hand off instead?**

<details><summary>Answer</summary>

An autonomous AP carries its full configuration onboard and must be managed individually — workable for a handful, but hundreds of separately configured radios inevitably drift out of sync on settings and security policy. A lightweight AP offloads that management to a central wireless LAN controller, which pushes consistent configuration and policy to every AP from one place while the APs themselves keep doing the actual radio work.

</details>

### `mdf-vs-idf` · MDF vs. IDF

**In structured cabling's hub-and-spoke design, which distribution frame houses the internet handoff and core switches, and which fans cabling out to the wall jacks on a single floor?**

<details><summary>Answer</summary>

The MDF (Main Distribution Frame) is the building's one central point where outside cabling, the internet handoff, core switches, and primary patch panels come together. Each IDF (Intermediate Distribution Frame) is a secondary closet — usually one per floor or wing — that connects back to the MDF and distributes cabling to the end-user devices in its own area, so no single run has to stretch farther across the building than necessary. A building gets exactly one central MDF feeding multiple IDFs, not several MDFs scattered across floors.

</details>

### `rack-units` · Rack Units

**A 4U appliance is going into a standard 19-inch rack. How much vertical space will it occupy, and what does the rack's 19-inch figure actually measure?**

<details><summary>Answer</summary>

7 inches — one rack unit (1U) equals 1.75 inches of vertical space, so a 4U device is exactly 4 × 1.75. The 19 inches is a separate measurement entirely: the standardized width of the equipment's front panel — faceplate plus the mounting flanges that bolt to the rails, measured across their outer edges (the opening between the rails is slightly narrower, about 17.75 inches) — set, along with the rack unit itself, by EIA-310, which is why equipment from any vendor fits any standard rack. A full-height rack commonly offers 42U or 48U of total capacity, so planning a closet means checking vertical U space, not just floor space.

</details>

### `ups-vs-pdu` · UPS vs. PDU

**Between a UPS and a PDU, which one carries a rack of equipment through a brief utility power failure, and what is the other one actually for?**

<details><summary>Answer</summary>

The UPS holds a charged battery that takes over the instant utility power fails, riding out a short outage or buying equipment time to shut down cleanly instead of losing power abruptly. The PDU provides no backup at all — it is a rack-mounted device, conceptually a heavy-duty power strip, that distributes power from an upstream feed to the many devices in the rack, with higher-end models adding remote monitoring and per-outlet power cycling. In a well-designed installation the UPS or generator sits upstream feeding the PDU, which handles purely local distribution.

</details>

### `environmental-controls` · Environmental Controls

**In a wiring closet, what distinct risk does air that's too dry pose, as opposed to air that's too damp — and why can't the room's fire suppression just use water sprinklers?**

<details><summary>Answer</summary>

Too dry raises the odds of electrostatic discharge (ESD) damaging sensitive components, while too damp invites condensation and corrosion — so facilities hold humidity in a controlled middle band rather than simply keeping things cool and dry. The same protect-the-hardware logic rules out office-style water sprinklers, since water wrecks electronics about as badly as fire; data centers use clean-agent gas systems instead, which displace oxygen or interrupt the combustion reaction without leaving a damaging residue. Sustained high temperature is likewise one of the most common causes of premature hardware failure, which is why these rooms get dedicated climate control rather than relying on the building's general HVAC.

</details>

### `hot-cold-aisle-airflow` · Hot/Cold Aisle Airflow

**One switch in a row of racks was mounted facing the opposite way from every other device. Why will that switch run hot even though the room's cooling is working fine?**

<details><summary>Answer</summary>

Hot/cold aisle design lines every device up to draw cool air from a shared cold aisle and blow exhaust into a shared hot aisle, so air moves through the whole row in one consistent direction. A device facing the wrong way pulls its intake from the hot aisle — everyone else's exhaust — so it breathes pre-heated air no matter how well the room itself is cooled. That is why switches come in port-side intake and port-side exhaust variants: the choice lets the ports face whichever aisle the cabling needs while the airflow direction still matches the rest of the row.

</details>

## Network Operations

### `snmp-versions` · SNMP Versions

**Which SNMP version actually introduced real encryption, and what's the common wrong answer?**

<details><summary>Answer</summary>

SNMPv3, through its User-based Security Model, is the version that finally added genuine authentication and encryption. A frequent mistake is crediting SNMPv2c for that — v2c's real contribution was the faster GetBulkRequest query, not security; v1 and v2c both still authenticate with nothing stronger than a cleartext community string.

</details>

### `mttr-mtbf` · MTBF vs. MTTR

**A device has a high MTBF and a low MTTR. What does each number tell you separately?**

<details><summary>Answer</summary>

High MTBF (Mean Time Between Failures) says failures are infrequent to begin with. Low MTTR (Mean Time To Repair) says that when a failure does happen, detecting, diagnosing, and restoring it goes quickly. One measures how often things break; the other measures how fast they get fixed.

</details>

### `rto-vs-rpo` · RTO vs. RPO

**A system meets its RTO after an outage but still fails its RPO. How is that possible?**

<details><summary>Answer</summary>

RTO only caps how long the system is allowed to stay down, and it recovered inside that window. RPO is a completely separate promise about how current the restored data has to be — if the backup restored from was hours stale, the downtime target can be hit perfectly while data loss still blows past what was acceptable.

</details>

### `mtd` · MTD vs. RTO

**Why does RTO have to be a smaller number than MTD?**

<details><summary>Answer</summary>

RTO has to come in smaller than MTD. MTD (NIST SP 800-34) is the absolute ceiling on how long a whole business process can tolerate being down, counting every downstream consequence; RTO is the narrower, resource-specific recovery target that's supposed to land safely inside that larger ceiling, not exceed it.

</details>

### `hot-warm-cold-site` · Hot, Warm & Cold Sites

**What does a cold DR site actually contain before a disaster, and what do warm and hot sites add on top of it?**

<details><summary>Answer</summary>

A cold site has essentially none — just space, power, and connectivity, with equipment acquired only after disaster strikes, making it cheap but slow. A warm site has some systems already installed. A hot site is fully built out and staffed, ready to take over almost immediately, at the highest ongoing cost.

</details>

### `siem` · SIEM

**A SIEM does more than just store centralized logs. What is that extra layer?**

<details><summary>Answer</summary>

Plain log aggregation just funnels logs from many devices into one place. A SIEM sits on top of that stream and actively correlates events across different sources, applying rules to surface patterns that look suspicious, so an analyst investigates from one console instead of piecing together clues device by device.

</details>

### `doh-vs-dot` · DoH vs. DoT

**Which encrypted DNS protocol is easier for a network administrator to selectively block, and why?**

<details><summary>Answer</summary>

DoT (RFC 7858) is easier to block, because it always runs over its own dedicated port, 853 — an administrator can filter on that port number alone. DoH (RFC 8484) deliberately hides inside ordinary HTTPS traffic on port 443, so blocking it risks breaking unrelated web traffic sharing that same port.

</details>

### `dnssec` · DNSSEC

**DNSSEC stops a forged DNS answer from being trusted — why doesn't it also hide the query from an eavesdropper?**

<details><summary>Answer</summary>

DNSSEC (RFC 4033) signs zone data so a resolver can verify a response actually came from the real authoritative source and wasn't altered — authentication and integrity, not secrecy. The query and response still travel in the clear; encrypting that content is left entirely to DoH or DoT.

</details>

### `dns-a-aaaa-cname` · A vs. AAAA vs. CNAME Records

**A lookup for a hostname returns a CNAME record. Why doesn't that record alone give the client what it needs to connect?**

<details><summary>Answer</summary>

Because a CNAME holds no address at all — only another hostname, the canonical name it aliases — so resolution has to continue against that name's own records. Those are an A record mapping a hostname to a 32-bit IPv4 address, or a AAAA record (RFC 3596) doing the identical job for a 128-bit IPv6 address — four times the bits behind the quadrupled letter.

</details>

### `dns-mx-ns-txt` · MX vs. NS vs. TXT Records

**Contrast what MX, NS, and TXT records each name within a DNS zone.**

<details><summary>Answer</summary>

An MX record names the server that handles a domain's incoming mail — a delivery destination, not a website. An NS record names the servers that are authoritative for the zone itself, which is how the rest of DNS knows where to direct questions about the domain. A TXT record holds free-form descriptive text, put to work today mostly for proving domain ownership and publishing the email-security policies that let receivers reject spoofed mail.

</details>

### `dns-ptr-reverse-zone` · IP-to-Hostname DNS

**A mail server wants to confirm that a connecting IP address maps back to a legitimate hostname. Which DNS record type answers that, and which kind of zone holds it?**

<details><summary>Answer</summary>

A PTR record — the exact inverse of an A record, mapping an IP address back to a hostname — and it lives in a reverse zone, which is built from PTR records to answer address-to-name questions. A forward zone covers the opposite, name-to-address direction users actually type, which is why a fully documented DNS deployment maintains both instead of only the forward lookups.

</details>

### `dns-authoritative-vs-recursive` · Authoritative vs. Recursive DNS

**What earns a DNS answer the 'authoritative' label, and how do primary and secondary servers divide that role?**

<details><summary>Answer</summary>

An authoritative answer comes from a server that actually holds the zone's data, unlike a recursive resolver, which chases an answer through the hierarchy on a client's behalf and then serves later clients from its cache. On the authoritative side, the primary server holds the zone's master file (RFC 1035) where changes are made, while secondaries periodically pull copies of it through zone transfers — staying in sync so they can hand out the same authoritative answers as backups.

</details>

### `dhcp-scope-reservation-exclusion` · DHCP Scope, Reservation & Exclusion

**A printer must always receive the same address from DHCP, while a statically configured server's address must never be offered to anyone. Which DHCP feature handles each case?**

<details><summary>Answer</summary>

The printer gets a reservation: the server recognizes its MAC address and always leases it the same address out of the scope, the pool of addresses managed for that subnet. The static server's address gets an exclusion, carving it out of the scope's range so it is never offered — the right tool for a host that never asks DHCP at all. Every dynamic assignment is also bounded by lease time: it expires unless renewed, with the client starting renewal attempts at T1, half the lease by default.

</details>

### `dhcp-relay-ip-helper` · DHCP Relay / IP Helper

**A client's DHCPDISCOVER is only a local broadcast, and routers don't forward broadcasts. How does that request ever reach a DHCP server on another subnet?**

<details><summary>Answer</summary>

A BOOTP/DHCP relay agent — typically the client's own router, configured with an 'ip helper'-style command — picks up the broadcast and forwards it on as a unicast aimed directly at the remote server. As it relays, it stamps in its own address, which is exactly what tells the server which subnet the request came from and therefore which scope to allocate an address out of.

</details>

### `dhcp-dora` · DHCP DORA

**Walk through the four DORA messages and who sends each one.**

<details><summary>Answer</summary>

DORA runs in four steps. First, the client sends out a broadcast DHCPDISCOVER since it doesn't know of any server yet. Every listening server can answer back with its own DHCPOFFER, dangling a candidate address. Out of whichever offers come in, the client settles on just one and broadcasts a DHCPREQUEST calling it out by name, which doubles as the signal telling the losing servers they weren't picked. The winning server finishes things off with a DHCPACK.

</details>

### `ntp-ptp` · NTP vs. PTP

**What kind of environment actually needs PTP's precision instead of NTP's?**

<details><summary>Answer</summary>

NTP (RFC 5905, UDP port 123) already holds clocks within a few hundred microseconds on a fast LAN, which comfortably covers log correlation and authentication timing. PTP (IEEE 1588) exists for the narrower set of cases — industrial control, financial trading, telecom — that need sub-microsecond accuracy, and it demands PTP-aware switches along the entire path to get there.

</details>

### `change-vs-config-management` · Change Management vs. Configuration Management

**What does change management require before a change is implemented, and what does configuration management record afterward?**

<details><summary>Answer</summary>

Change management is the gate beforehand — a submitted request, a risk assessment, CAB sign-off, a maintenance window, a rollback plan. Configuration management (NIST SP 800-128) is what happens after: tracking and verifying the resulting device state against a known-good baseline so drift gets caught.

</details>

### `slaac` · SLAAC

**How does an IPv6 host end up with a working global address on a network that has no DHCP server at all?**

<details><summary>Answer</summary>

Through SLAAC (RFC 4862): the host takes the network prefix a router advertises, builds the rest of the address itself, and runs Duplicate Address Detection to confirm nothing else on the link already uses it — no server involved, and no server tracking the result. That statelessness is also SLAAC's gap: settings like DNS servers aren't part of what it hands out, which is where DHCPv6 still complements it.

</details>

### `site-to-site-vs-client-to-site-vpn` · Site-to-Site vs. Client-to-Site VPN

**Two branch offices need their private networks permanently linked across the internet, with no VPN software installed on any employee machine. Which VPN type fits, and how does it differ from what a traveling employee uses?**

<details><summary>Answer</summary>

A site-to-site VPN — a permanent, always-on encrypted tunnel between the two networks, terminated by a gateway at each end, so devices on either side reach the other transparently without running a client of their own. A traveling employee instead uses a client-to-site (remote-access) VPN, which connects one individual device into the network on demand and authenticates that user each time a connection is established.

</details>

### `split-vs-full-tunnel` · Split Tunnel vs. Full Tunnel

**In a split-tunnel VPN configuration, which of the client's traffic actually enters the encrypted tunnel, and what does the organization give up compared to full tunnel?**

<details><summary>Answer</summary>

Only traffic destined for the private network enters the tunnel; everything else, like ordinary web browsing, exits directly over the user's own internet connection. That trims tunnel overhead, but the organization can see only the traffic that actually entered the tunnel — a full-tunnel configuration routes everything through the VPN, buying visibility over all of the client's traffic at the cost of that extra overhead.

</details>

### `jump-box` · Jump Box

**Why do organizations force administrators through a jump box instead of letting them connect to sensitive internal systems straight from their own workstations?**

<details><summary>Answer</summary>

A jump box (jump server) is a single, hardened, tightly monitored gateway that every administrative session must pass through — direct administrative access from an ordinary workstation is never allowed. Funneling all access through one choke point means every session can be logged and watched in one place, and a compromised everyday workstation gains no direct path to critical infrastructure.

</details>

### `in-band-vs-oob-management` · In-Band vs. Out-of-Band Management

**The production network is down, yet an administrator can still reach the failed device to repair it. What style of management access makes that possible, and over what kind of path does it run?**

<details><summary>Answer</summary>

Out-of-band management, which reaches the device over a path kept separate from the production network — a dedicated management VLAN, or a console port wired to a separate console server. In-band management rides the same production network the device normally forwards traffic on, so the very outage being diagnosed can also sever the only way to reach the device and fix it.

</details>

### `physical-vs-logical-diagram` · Physical vs. Logical Network Diagrams

**A technician needs to trace which patch-panel jack a dead switch port is wired to; a network engineer needs to see which VLANs and subnets traffic crosses between two hosts. Which network diagram type serves each task?**

<details><summary>Answer</summary>

Cable tracing is the physical network diagram's job: it documents the actual hardware and cabling — which switch port lands on which patch-panel jack, which uplink ties an IDF back to the MDF — exactly as someone standing in the wiring closet would trace it. The traffic question belongs to the logical network diagram, which abstracts that wiring away to show IP addressing, VLAN boundaries, and the Layer 3 relationships between devices, regardless of which literal cable carries the traffic.

</details>

### `sla-five-nines` · SLA Availability Tiers

**An ISP's SLA commits to 'five nines' — 99.999% uptime. About how much downtime per year does that commitment still allow?**

<details><summary>Answer</summary>

Only about five minutes — 99.999% leaves 0.001% of the year for outages, and 525,600 minutes × 0.00001 works out to roughly 5.26 minutes. Compare 'three nines' (99.9%), which permits about 8.76 hours: each added nine shrinks the allowance tenfold and costs the provider significantly more to actually guarantee, which is why SLA remedies like service credits attach to these targets.

</details>

### `eol-vs-eos` · IT Asset Life Cycle

**A vendor stops selling a switch model this year and stops providing support and security patches for it three years later. Which milestone is which in N10-009 terms, and which one forces replacement planning?**

<details><summary>Answer</summary>

Stopping sales is end-of-life (EOL) — sometimes called end-of-sale — and it only closes off new purchases; units already deployed may still receive limited support and patches. The later end-of-support (EOS) date is the one that forces replacement: once it arrives, newly discovered vulnerabilities will never be patched, so hardware that still works fine quietly becomes a growing security liability no matter how healthy the device seems.

</details>

### `golden-vs-backup-config` · Golden vs. Backup Configuration

**When rebuilding a failed switch, why is starting from the golden configuration more trustworthy than simply restoring the most recent backup configuration?**

<details><summary>Answer</summary>

A backup is a point-in-time copy of the production configuration — whatever was actually running on the device, faithfully preserving any misconfiguration or unauthorized drift present when it was captured. The golden configuration is the approved, validated known-good baseline that the production config is supposed to match — the same standard drift gets measured against — so a rebuild from it starts from a state known to be correct rather than one that is merely recent.

</details>

### `ipam-wireless-heat-map` · Network Documentation Tools

**Two questions the network's documentation should answer: 'which IP addresses in this subnet are actually in use, and by what?' and 'where in the building is wireless coverage weak?' Which documentation tool answers each?**

<details><summary>Answer</summary>

The address question is IPAM's (IP Address Management's) job: it tracks which address is assigned to which device in which subnet — and whether that assignment came from a DHCP lease or a static configuration — heading off duplicate addresses and pool exhaustion nobody saw coming. The coverage question is answered by a wireless heat map: a floor plan overlaid with signal-strength measurements from a site survey, exposing dead zones and guiding access-point placement.

</details>

## Network Security

### `cia-triad` · CIA Triad

**Malware corrupts a stored configuration file so it no longer matches what was written, without ever reading or exfiltrating a thing. Which leg of the CIA triad does that violate?**

<details><summary>Answer</summary>

Integrity, not confidentiality — FIPS 199 defines a loss of confidentiality as unauthorized viewing or disclosure, and nothing here was ever disclosed, only altered. Integrity is the leg that covers improper modification or destruction of data. Availability is the third leg, broken whenever legitimate users get cut off from timely access, most visibly during a denial-of-service attack.

</details>

### `mfa` · Multifactor Authentication (MFA)

**Why does a password plus a memorized security-question answer fail to qualify as MFA?**

<details><summary>Answer</summary>

MFA needs factors from at least two different categories: something you know, something you have, something you are. A password and a security-question answer are both memorized secrets, so together they're still single-category, single-factor authentication no matter how many are stacked. NIST SP 800-63B's highest tier, AAL3, pushes even further, mandating a physical hardware cryptographic authenticator — a requirement no amount of extra memorized secrets can fulfill.

</details>

### `pki` · PKI (Public Key Infrastructure)

**Without a CA, what problem would two strangers using asymmetric encryption still have to solve?**

<details><summary>Answer</summary>

Proving that a given public key genuinely belongs to the party who claims it. PKI solves that by having a trusted certification authority issue a signed X.509 certificate (RFC 5280) that vouches for exactly that binding, so a relying party can trust the key without ever having to verify the owner directly.

</details>

### `radius-vs-tacacs` · RADIUS vs. TACACS+

**Which protocol protects an entire authentication packet, and which one leaves the username exposed?**

<details><summary>Answer</summary>

RADIUS (UDP port 1812, RFC 2865) only ever encrypts the password inside an Access-Request; the username travels in plain text right alongside it. TACACS+ (TCP port 49, RFC 8907) scrambles the entire packet body instead, and it splits authentication, authorization, and accounting into three fully separate conversations — where RADIUS folds authentication and authorization into a single Access-Request/Access-Accept exchange, with accounting running as its own exchange on UDP port 1813 (RFC 2866).

</details>

### `saml` · SAML

**In an SSO exchange, why doesn't the application (service provider) ever see the user's real password?**

<details><summary>Answer</summary>

Because it never handles authentication at all. Only the identity provider ever validates a real credential; it then vouches for the user by handing the application a signed SAML assertion. The application checks that assertion's signature and trusts it — so if that application is later breached or decommissioned, no actual password was ever sitting there to steal.

</details>

### `ldap` · LDAP

**Why can one stale LDAP entry cause problems across several unrelated systems?**

<details><summary>Answer</summary>

Because LDAP is usually the shared back end: SSO identity providers check credentials and group membership against it before issuing assertions, and RADIUS or TACACS+ deployments often point at the very same directory instead of keeping their own separate user database. A single directory feeding that many systems means one bad entry ripples outward.

</details>

### `vlan-hopping` · VLAN Hopping

**Why can switch spoofing send traffic both ways while double tagging only sends it one way?**

<details><summary>Answer</summary>

Switch spoofing tricks a real switch into forming an actual trunk over DTP, and once that trunk exists it behaves like a normal trunk in both directions. Double tagging never negotiates a trunk at all — it just exploits how one native-VLAN tag gets stripped in transit — so there's no matching mechanism for a reply to retrace the same path back.

</details>

### `arp-poisoning` · ARP Poisoning

**Why does ARP have no way to reject a forged reply?**

<details><summary>Answer</summary>

ARP (RFC 826) simply accepts and caches whatever IP-to-MAC mapping shows up in a packet it receives, with no built-in check that the claim is genuine. An attacker exploits exactly that gap by sending replies that falsely claim the default gateway's IP address for the attacker's own MAC, quietly rerouting a victim's traffic through the attacker first.

</details>

### `evil-twin-on-path` · Evil Twin & On-Path Attack

**What makes an "evil twin" a specific way of becoming an on-path attacker rather than a separate attack category?**

<details><summary>Answer</summary>

An evil twin — a rogue access point broadcasting a legitimate network's own SSID to lure clients — is one specific way to become an on-path attacker. On-path attack (the modern replacement for 'man-in-the-middle') just names the resulting position: sitting between two parties and able to see or alter their traffic, whether reached through an evil twin, ARP poisoning, or DNS poisoning.

</details>

### `dos-ddos` · DoS vs. DDoS

**Why is a DDoS attack harder to stop by filtering than a plain DoS attack?**

<details><summary>Answer</summary>

A DoS attack floods or crashes a target from one identifiable source, which a filter can simply block. A DDoS attack (RFC 4732) launches the same flood from many compromised hosts at once, so there's no single address to block, and the combined bandwidth of all those sources dwarfs what any one attacker could generate alone.

</details>

### `mac-flooding` · MAC Flooding

**An attacker blasts a switch with frames carrying thousands of fabricated, randomized source MAC addresses. What switch behavior is the attacker counting on once the CAM table overflows, and what does it gain them?**

<details><summary>Answer</summary>

The switch fails open: with its CAM table full, it can no longer look up which port an unrecognized destination MAC lives on, so it floods every subsequent frame out all of its ports at once like a plain hub — and the attacker's own port passively catches copies of traffic meant for every other device. Port security, which caps how many MAC addresses a single port may learn, is the standard defense because it stops the fabricated flood from ever filling the table in the first place.

</details>

### `arp-vs-dns-poisoning` · ARP Poisoning vs. DNS Poisoning

**ARP poisoning and DNS poisoning both plant a forged mapping in a victim's cache. What does each one forge, and why can DNS poisoning reach victims far beyond the attacker's own network segment?**

<details><summary>Answer</summary>

ARP poisoning forges an IP-to-MAC mapping, and since ARP never leaves the local segment, only hosts sharing that segment with the attacker can be fed the lie. DNS poisoning forges a name-to-IP mapping by racing a forged response to a resolver ahead of the legitimate authoritative answer — and once cached, that single forged entry misdirects every client using that resolver, wherever they are, until the poisoned entry's TTL runs out.

</details>

### `rogue-dhcp-server` · Rogue DHCP Server

**A rogue DHCP server can put an attacker on-path without touching ARP or DNS at all. Which leased parameter does the work, and what happens to a victim's traffic afterward?**

<details><summary>Answer</summary>

The default gateway: by answering lease requests with the attacker's own machine listed as the gateway, the rogue server makes every accepting client hand its off-subnet traffic to the attacker first. The attacker can then observe or alter that traffic before quietly relaying it toward the real gateway — the same on-path position that ARP poisoning or an evil twin reaches by a different route.

</details>

### `rogue-ap-vs-evil-twin` · Rogue AP vs. Evil Twin

**An employee plugs a personal Wi-Fi access point into a wall jack purely for convenience, with no bad intent. Why does it still count as a rogue device — and what more would it take to make it an evil twin?**

<details><summary>Answer</summary>

A rogue device is any hardware connected to the network without authorization, regardless of intent — the network's owner never approved it and doesn't control it, which is why unmanaged rogues keep surfacing in discovery and asset-inventory audits. An evil twin is the deliberately malicious case: a rogue access point broadcasting the legitimate network's own SSID so nearby clients associate with the attacker's radio instead of the real one.

</details>

### `social-engineering-techniques` · Social Engineering

**The N10-009 attacks objective lists four social-engineering techniques. Name them, and name the trait that sets them apart from every other attack in that objective.**

<details><summary>Answer</summary>

Phishing (fraudulent messages that talk a user into clicking or revealing credentials), dumpster diving (recovering sensitive information from discarded documents and media), shoulder surfing (watching someone enter or view credentials), and tailgating (following an authorized person through a secured door). What separates them is the target: they exploit people rather than protocols or software, so firewalls and encryption don't close the gap — the countermeasure is ongoing security awareness training, not a technical control.

</details>

### `honeypot` · Honeypot

**Why does a honeypot generate almost no false positives compared to monitoring on a real production server?**

<details><summary>Answer</summary>

A honeypot has no legitimate purpose, so no genuine user has any reason to ever touch it — meaning any interaction with it at all is inherently suspicious by definition, unlike a production server where plenty of normal traffic has to be filtered out from the noise first.

</details>

### `acl` · Access Control Lists (ACLs)

**Applying a brand-new one-rule ACL — a single permit statement — suddenly cuts off all other traffic on that interface. What happened?**

<details><summary>Answer</summary>

The implicit deny every ACL carries at its very end kicked in — a packet that falls through every listed rule without a match gets dropped, whether or not anyone actually typed that deny in, so applying any ACL flips an interface from allowing everything to allowing only what's listed. And because rules are checked in order and stop at the first match, a too-broad rule placed early can quietly override a narrower one further down.

</details>

### `dmz` · DMZ (Screened Subnet)

**If a web server in the DMZ gets compromised, what stops the attacker from reaching the internal network next?**

<details><summary>Answer</summary>

A second, separately enforced firewall boundary between the DMZ and the trusted internal zone. The whole point of putting internet-facing systems in a DMZ instead of directly on the internal network is that compromising one still leaves an attacker outside the zone holding the organization's actual sensitive resources. N10-009 calls this zone a screened subnet — DMZ is the older name for the same design.

</details>

### `nac-8021x` · NAC & 802.1X

**What traffic is allowed through an 802.1X port before authentication succeeds?**

<details><summary>Answer</summary>

Essentially nothing but the EAPOL handshake. Three parties are involved: the supplicant, meaning the connecting endpoint's own 802.1X client software; the authenticator — the switch port, which holds regular traffic back until a verdict comes down; and the authentication server — typically RADIUS — which is the party that actually renders the accept-or-reject verdict.

</details>

### `dot1q-vs-dot1x` · 802.1Q vs. 802.1X

**Between 802.1Q and 802.1X, which one tags frames for VLAN membership, and which one gates a port until a device authenticates?**

<details><summary>Answer</summary>

802.1Q inserts a tag into a frame crossing a trunk link so switches on either end can tell which VLAN that frame belongs to as multiple VLANs share the same physical link. 802.1X does something unrelated to tagging: it's port-based authentication, where a switch port blocks nearly all traffic from whatever's plugged in until an authentication server approves it, only then opening the port to ordinary traffic. The numbers look similar but the jobs don't overlap at all — one is a frame format, the other is an access-control handshake.

</details>

## Network Troubleshooting

### `troubleshooting-methodology` · CompTIA's Seven-Step Troubleshooting Process

**List CompTIA's seven troubleshooting stages in order.**

<details><summary>Answer</summary>

1) Identify the problem. 2) Establish a theory of probable cause. 3) Test the theory. 4) Establish a plan of action. 5) Implement the solution. 6) Verify full system functionality. 7) Document findings.

</details>

### `troubleshooting-theory-confirmed-next` · Troubleshooting: After Confirming a Theory

**In CompTIA's troubleshooting methodology, what stage comes right after a theory of probable cause is confirmed by testing?**

<details><summary>Answer</summary>

Establish a plan of action for resolving the problem, CompTIA's fourth stage, turning the confirmed theory into a concrete, deliberate fix before anything is touched.

</details>

### `troubleshooting-theory-disproven-next` · Troubleshooting: When a Theory Fails

**If testing disproves a theory of probable cause, what should a technician do instead of adjusting the fix already in progress?**

<details><summary>Answer</summary>

Rule out that theory instead of tweaking the same fix further, then test the next most likely theory — only a confirmed theory feeds the plan-implement-verify stages; escalating once every testable theory is exhausted counts as a legitimate outcome, not a failure of the process.

</details>

### `troubleshooting-after-verify-next` · Troubleshooting: The Final Stage

**After verifying full system functionality, what's the seventh and final stage of CompTIA's process, and why does it matter?**

<details><summary>Answer</summary>

Document findings, a written record explaining what broke and how it was fixed, giving whoever handles the next similar ticket a head start instead of starting from zero.

</details>

### `top-down-bottom-up` · Top-Down, Bottom-Up & Divide-and-Conquer

**A user reports one specific web app is broken while everything else works fine. Which troubleshooting approach fits best, and why?**

<details><summary>Answer</summary>

Top-down fits here — begin at the application layer, exactly where the symptom is pointing, and only drop to lower layers if that comes up empty. Bottom-up flips that order, beginning at the physical layer, which is the right call for cabling faults or a dead link light. Divide-and-conquer skips both endpoints and checks the middle first — typically Layer 3 — when nothing yet suggests which end is more likely to be broken.

</details>

### `cat6-vs-cat6a` · Cat6 vs. Cat6a Distance Limit

**A 75-meter run needs a guaranteed 10Gbps. Why does that rule out Cat6?**

<details><summary>Answer</summary>

Cat6 can hit 10GBASE-T, but only over a shortened distance — roughly 37 to 55 meters depending on alien crosstalk — not the standard 100-meter horizontal run. Cat6a is built to a tighter alien-crosstalk spec — thicker cable geometry and greater pair separation, with shielding optional — which is what lets it guarantee 10Gbps across the full 100 meters instead.

</details>

### `attenuation-crosstalk` · Attenuation & Crosstalk

**Attenuation and crosstalk are both signal-quality problems. What's the actual source of each?**

<details><summary>Answer</summary>

Attenuation comes from the cable itself — the signal simply loses strength the farther it travels, which is why every category has a maximum rated distance. Crosstalk comes from nearby wiring instead: NEXT leaks between pairs bundled inside the same cable, while alien crosstalk leaks in from a completely different cable running alongside it.

</details>

### `crc-errors` · CRC Errors

**A switch port shows climbing CRC errors but zero collisions. What layer does that point to?**

<details><summary>Answer</summary>

The physical layer. A CRC mismatch tells you the frame arrived different from how it was sent — the checksum no longer matches the data — which points to transmission damage from something like a worn cable, a bad connector, or a flaky transceiver. That kind of corruption doesn't come from two devices fighting over the same medium, so a zero collision count rules out a contention-based explanation.

</details>

### `duplex-mismatch` · Late Collisions

**Late collisions are the textbook symptom of what physical-layer misconfiguration?**

<details><summary>Answer</summary>

Duplex mismatch — one side of the link is set to full duplex and just transmits without checking whether the wire is busy, colliding with the other side's still-outgoing half-duplex frame partway through, so the collision is only noticed after a meaningful chunk of data has already gone out rather than immediately.

</details>

### `stp-loop-cause` · STP Loop Root Cause

**What usually causes an active STP loop, given that STP logic itself is rarely at fault?**

<details><summary>Answer</summary>

The usual trigger is a previously blocked port that starts forwarding again simply because BPDUs stopped arriving to tell it to stay blocked — the link itself stays up while a duplex mismatch (or similar fault) silently corrupts the control traffic riding across it. STP's own logic is almost never actually at fault.

</details>

### `dhcp-decline-nak` · DHCPDECLINE vs. DHCPNAK

**A laptop moves to a new subnet and asks to renew the lease it got on the old one. Which DHCP message refuses that request, and which side sends it?**

<details><summary>Answer</summary>

DHCPNAK, and it always comes from the server — it refuses a renewal outright when the client asks to keep an address that no longer fits the subnet it's actually connected to. Its client-side counterpart is DHCPDECLINE, which fires when the client's own ARP check finds a newly offered address already in use.

</details>

### `jitter` · Jitter

**How does RFC 3550's interarrival jitter differ from a simple average of delay variation?**

<details><summary>Answer</summary>

Interarrival jitter is a running, smoothed estimate of how much the gap between consecutive packets' transit times varies — recalculated after every packet using exponential smoothing, weighting the newest measurement against the prior estimate, rather than a flat average taken across an entire session.

</details>

### `latency-vs-packet-loss` · Latency vs. Packet Loss

**Why can a link have low latency but still suffer heavy packet loss?**

<details><summary>Answer</summary>

They measure different things. Latency is how long a packet takes to arrive, adding up propagation, queuing, and processing delay. Packet loss is simply whether it arrived at all, which can happen fast (a full queue dropping it instantly) or slow, independent of how quick the surviving packets are.

</details>

### `traceroute` · traceroute

**How does manipulating TTL let traceroute map every hop along a path?**

<details><summary>Answer</summary>

It sends a burst of probes with TTL starting at 1 and increasing by one each round, so each probe expires exactly one hop farther than the last. Whichever router happens to be sitting at that hop returns an ICMP expiry message, and stringing those replies together reconstructs the path hop by hop.

</details>

### `nslookup` · DNS Troubleshooting

**A host is reachable by ping, but a specific hostname won't resolve. Which tool isolates that, and why not just use ping?**

<details><summary>Answer</summary>

nslookup (or dig), because it queries DNS directly instead of testing reachability. ping and traceroute only confirm whether a path or a host responds — they say nothing about whether a name maps to the right address, which is exactly the gap nslookup is built to check.

</details>

### `nmap` · nmap

**Beyond confirming a host is alive, what three things can an nmap scan reveal about it?**

<details><summary>Answer</summary>

Which ports are actually open, what application and version is listening behind each open port, and — by fingerprinting subtle quirks in how the host's TCP/IP stack responds — a likely guess at its operating system.

</details>

### `tcpdump-troubleshoot` · Troubleshooting Tools

**A connectivity test says a path is up, but something is still wrong with one specific conversation. What's the next command-line tool?**

<details><summary>Answer</summary>

tcpdump. Basic reachability tools like ping only confirm a path exists; tcpdump captures the actual packet contents of a conversation, which is what's needed to spot a malformed request, a handshake that never finishes, or a retransmission pattern that ping alone would never reveal.

</details>

### `poe-standards` · PoE Standards (802.3af/at/bt)

**A device needs a guaranteed 25W of power. Which PoE tier actually clears that, and what number should be checked to find out?**

<details><summary>Answer</summary>

The device-side guaranteed figure, not the port's rated maximum. 802.3af (Type 1) only guarantees 12.95W actually reaches the device after cable loss. 802.3at/PoE+ (Type 2) guarantees 25.5W at the device, which is the first tier that clears a 25W requirement. 802.3bt Type 3 and Type 4 push that guarantee to roughly 51W and 71.3W.

</details>

### `toner-probe-cable-tester-vfl` · Toner Probe vs. Cable Tester vs. Visual Fault Locator

**Toner probe, cable tester, visual fault locator — which physical-layer question does each handheld tool answer?**

<details><summary>Answer</summary>

A toner probe answers 'which cable is this?' — a tone generator injects a signal at one end and the probe picks it up along the run, tracing an unlabeled cable through a bundle or wall to where it terminates. A cable tester answers 'is this cable wired correctly?' — verifying wire-map continuity and length on a suspect copper run, which is how opens, shorts, and miswired pins get caught. A visual fault locator answers the fiber version: it shines visible red light down the strand, so a break or a too-sharp bend glows at the exact spot where the light escapes.

</details>

### `wifi-analyzer` · Wi-Fi Analyzer

**A wireless complaint survives every test run from the endpoints — ping, packet capture, port checks all look fine. What does a Wi-Fi analyzer see that those tools cannot?**

<details><summary>Answer</summary>

It surveys the wireless environment itself in real time: channel utilization, overlapping channels from neighboring networks, and received signal strength (RSSI). Tools sitting at either end of a link only report whether their own traffic got through — they can't see that the shared air in between is contended or weak, which is exactly the evidence needed to pin down co-channel interference or a coverage gap.

</details>

### `lldp-cdp-discovery` · Identifying Link Neighbors

**Without physically tracing a cable, how can a technician confirm exactly which switch and port sit at the far end of a device's link when the wiring diagram might be stale?**

<details><summary>Answer</summary>

Read the link's own neighbor advertisements: LLDP (IEEE 802.1AB), or CDP as Cisco's proprietary equivalent, has each directly connected device announce its identity, port, and capabilities straight to whatever sits at the other end. That makes the link itself the source of truth instead of a possibly outdated diagram — and it works over whichever medium the link uses, fiber as well as copper.

</details>

### `netstat-arp-ipconfig` · netstat vs. arp vs. ipconfig/ip

**netstat, arp, and ipconfig/ip each dump a different slice of a host's own local state. Which question does each one answer?**

<details><summary>Answer</summary>

netstat lists active connections and listening ports — which Layer 4 conversations and services are actually up on this host. arp shows the cached IP-to-MAC mappings the host has resolved for neighbors on its local subnet. ipconfig (Windows) or ip (Linux) reports the interface configuration itself — address, subnet mask, default gateway — which is where a wrong mask, a missing gateway, or a telltale 169.254.x.x APIPA address surfaces first.

</details>

### `mac-table-vs-arp-table` · show mac-address-table vs. show arp

**To physically locate a host starting from only its IP address, a technician runs show arp and then show mac-address-table. What distinct mapping does each command contribute?**

<details><summary>Answer</summary>

show arp is the Layer 3 half: IP address to MAC address, the resolution a router or Layer 3 switch performs before it can frame a packet for local delivery. show mac-address-table is the Layer 2 half: MAC address to the switch port it was learned on, built by watching the source addresses of incoming frames. Chaining them — IP to MAC, then MAC to port — walks an address all the way down to the physical jack a device is plugged into.

</details>

### `show-interface-errors-vs-drops` · show interface: Errors vs. Drops

**One interface shows climbing input CRC errors; another shows climbing output drops with zero errors. Why do those counters point to entirely different root causes?**

<details><summary>Answer</summary>

CRC errors count frames that arrived corrupted — damaged in transit, which is a physical-layer verdict: bad cable, failing connector, or marginal transceiver. Output drops count perfectly intact frames the interface had to discard because its queue filled, meaning the link is oversubscribed — a congestion problem that no amount of cable replacement will touch. Which counter is climbing is what separates 'replace the media' from 'relieve the bottleneck.'

</details>

### `wireless-symptom-isolation` · Wireless Symptom Isolation

**Three wireless complaints: weak signal in one corner of the building, poor throughput despite a strong signal while a Wi-Fi analyzer shows neighboring networks on the same channel, and a laptop that stays slow even while walking toward a closer access point. What does each symptom point to?**

<details><summary>Answer</summary>

Signal that weakens in one physical area is a coverage problem — strength falls with distance and every wall, so a dead zone means AP placement leaves that spot outside every radio's effective range. Strong signal but poor throughput points to co-channel interference: neighboring networks or APs on the same channel force everyone to share airtime (overlapping-but-different channels are worse still — they corrupt each other's transmissions instead of taking turns), so the medium is contended even though the client hears its AP clearly. Staying slow while a stronger AP sits nearby is the sticky-client roaming problem — the client clings to the weakening radio it first associated with instead of switching.

</details>

### `dhcp-scope-exhaustion` · DHCP Troubleshooting

**Devices already on the network keep working normally — they even renew their DHCP leases successfully — but every newly connecting client self-assigns a 169.254.x.x address. What happened, and what fixes it?**

<details><summary>Answer</summary>

The DHCP scope is exhausted: every address in the pool is already leased out, so a new client's DHCPDISCOVER goes unanswered and it eventually falls back to APIPA (169.254.0.0/16, RFC 3927) — while existing clients sail on and even renew, because the server is alive and still honors their existing bindings. Renewals succeeding alongside failing new joins is what rules out a dead DHCP server and points at an empty pool. The fix is returning addresses to the pool: enlarge the scope, or shorten lease times so abandoned leases expire and free up sooner.

</details>

### `sfp-vs-qsfp-mismatch` · SFP vs. QSFP & Transceiver Mismatch

**A fiber link through a 10Gbps-capable port comes up cleanly but only ever negotiates 1Gbps. How does the installed transceiver explain that — and why would a single-mode/multimode transceiver mix look different?**

<details><summary>Answer</summary>

A link negotiates at the speed of whichever transceiver is actually installed, not the port's ceiling — an SFP tops out at 1Gbps, so one plugged into a 10Gbps-capable port silently caps the link there, while SFP+ reaches 10Gbps in the same form factor and QSFP bundles four channels for 40Gbps and beyond. Pairing a single-mode transceiver with a multimode one on the far end fails differently: the two are built around fundamentally incompatible optics, so that link typically stays down entirely rather than merely running slow.

</details>
