// js/data/flashcards.js
// Flashcard deck covering core CompTIA Network+ (N10-009) vocabulary and
// concepts spanning all five exam domains (see js/data/examInfo.js and
// js/data/studyContent.js). Grounded in the RFCs, NIST publications, and
// vendor documentation cached under .cache/aws-docs/ during authoring, and
// consistent with this module's own already-reviewed studyContent.js and
// questions.js; written in original prose, not copied verbatim from either
// source. The field is still named `service` for schema/validator
// compatibility with the copied validate-content.mjs, even though these
// are networking concepts rather than AWS services.
export const FLASHCARDS = [
  // ---------------------------------------------------------------------
  // Networking Concepts
  // ---------------------------------------------------------------------
  {
    id: 'osi-model',
    service: 'OSI Model',
    front: 'List the seven OSI layers in order, 1 through 7.',
    back: '1) Physical. 2) Data Link. 3) Network. 4) Transport. 5) Session. 6) Presentation. 7) Application.',
  },
  {
    id: 'osi-layer3-network',
    service: 'OSI Layer 3 (Network)',
    front: 'Which OSI layer is responsible for choosing a path across networks based on IP addresses rather than MAC addresses?',
    back: 'Layer 3, the Network layer, where a router directs each packet using its destination IP address.',
  },
  {
    id: 'osi-layer5-session',
    service: 'OSI Layer 5 (Session)',
    front: 'Which OSI layer is responsible for opening, maintaining, and tearing down the dialogue between two communicating hosts?',
    back: 'Layer 5, the Session layer, it manages that ongoing conversation, distinct from Transport below it (moving the data) and Presentation above it (formatting it).',
  },
  {
    id: 'osi-layer6-presentation',
    service: 'OSI Layer 6 (Presentation)',
    front: 'Which OSI layer translates and formats data, such as encryption or compression, between the Session layer and the Application layer?',
    back: 'Layer 6, the Presentation layer, it converts data into a common format so the Application layer above can actually use it.',
  },
  {
    id: 'tcp-udp',
    service: 'TCP vs. UDP',
    front: 'What tradeoff separates TCP from UDP?',
    back: "TCP (RFC 9293) tracks every segment with sequence numbers and acknowledgments so nothing is lost, duplicated, or delivered out of order, but that bookkeeping adds overhead. UDP (RFC 768) skips all of it and just fires datagrams with no delivery guarantee, trading reliability for speed — a fit for DNS lookups or live media where a resend would arrive too late to matter.",
  },
  {
    id: 'icmp',
    service: 'ICMP',
    front: "Why doesn't ICMP carry application data, and what is it used for instead?",
    back: "ICMP (RFC 792) never carries application payloads. IP uses it purely to report back problems (an unreachable host, an expired TTL) and diagnostic conditions to the sender, which is the entire foundation ping and traceroute are built on top of.",
  },
  {
    id: 'ftp-port',
    service: 'FTP',
    front: 'What TCP ports does FTP use for its control and data connections?',
    back: 'FTP uses two TCP ports: 21 for the control connection that carries commands, and 20 for the separate connection that transfers the file data itself.',
  },
  {
    id: 'ssh-port',
    service: 'SSH',
    front: "What single TCP port carries all of SSH's functionality, shell, SFTP, and SCP alike?",
    back: 'SSH runs its encrypted shell session, plus SFTP or SCP file transfer, over a single TCP port: 22.',
  },
  {
    id: 'rdp-port',
    service: 'RDP',
    front: 'What TCP port does RDP use to carry a full remote desktop session?',
    back: 'RDP uses TCP port 3389 to stream a full graphical Windows desktop to the client, rather than a bare command-line shell like SSH.',
  },
  {
    id: 'dns-port',
    service: 'DNS',
    front: 'What port does DNS use for an everyday lookup?',
    back: 'DNS answers routine lookups on UDP port 53.',
  },
  {
    id: 'dns-tcp-fallback',
    service: 'DNS',
    front: 'When does DNS switch from UDP to TCP port 53?',
    back: 'DNS moves from UDP to TCP port 53 only for oversized responses, such as zone transfers between authoritative servers.',
  },
  {
    id: 'dhcp-ports',
    service: 'DHCP',
    front: 'What UDP ports does DHCP use, and which side of the exchange listens on which port?',
    back: 'A DHCP server listens for requests on UDP port 67, while the client receives its offer on the adjacent UDP port 68.',
  },
  {
    id: 'web-ports',
    service: 'HTTP & HTTPS Ports',
    front: 'How do HTTP and HTTPS differ beyond just the port number?',
    back: 'HTTP is a plaintext, stateless request/response exchange on TCP port 80 — the server remembers nothing between requests, which is why cookies exist. HTTPS is that same exchange wrapped in a TLS session on TCP port 443, adding server authentication and encrypting everything sent afterward.',
  },
  {
    id: 'snmp-ports',
    service: 'SNMP',
    front: 'What UDP ports does SNMP use, and how do the two directions of traffic differ?',
    back: 'A manager polls devices for status on UDP port 161; devices separately push unsolicited trap alerts to that same manager over UDP port 162.',
  },
  {
    id: 'ldap-port',
    service: 'LDAP Port',
    front: 'What TCP port does LDAP use for directory queries and updates?',
    back: 'LDAP reads and writes a centralized directory of user and group records over TCP port 389.',
  },
  {
    id: 'sip-ports',
    service: 'SIP',
    front: 'What ports does SIP use to signal a call, and what changes when that signaling needs to be encrypted?',
    back: 'SIP signals calls in the clear on port 5060, switching to a TLS-encrypted signaling channel on port 5061 when that protection is required.',
  },
  {
    id: 'traffic-types',
    service: 'Unicast, Broadcast, Multicast & Anycast',
    front: 'Contrast unicast, broadcast, multicast, and anycast delivery.',
    back: "Unicast: one sender, one receiver. Broadcast (RFC 919): one sender, every host on the local segment. Multicast (RFC 1112): one sender, only the hosts that joined that group. Anycast (RFC 4291): a single address shared by several interfaces, but each packet lands on just whichever one is topologically nearest.",
  },
  {
    id: 'rfc1918-apipa',
    service: 'RFC 1918 Private Addressing vs. APIPA',
    front: 'How is an RFC 1918 address fundamentally different in origin from an APIPA address?',
    back: "RFC 1918's three private blocks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) are chosen deliberately by whoever designs the network. APIPA (RFC 3927), from the separate 169.254.0.0/16 block, is never chosen — a host grabs one only after it gave up trying to reach a DHCP server, so finding one on an interface is itself the symptom of a broken DHCP path.",
  },
  {
    id: 'subnetting-cidr-vlsm',
    service: 'Subnetting, VLSM & CIDR',
    front: 'How do subnetting, VLSM, and CIDR build on each other?',
    back: "Subnetting reassigns some host bits to the network portion to carve a big network into smaller ones. VLSM takes that further by allowing each resulting subnet its own mask length, so a tiny 2-address link and a 200-host segment aren't forced into equal-sized blocks. CIDR (RFC 4632) is what made that classless, slash-notation approach official, retiring the rigid Class A/B/C system.",
  },
  {
    id: 'spine-leaf',
    service: 'Spine-Leaf Architecture',
    front: 'What does spine-leaf guarantee that older three-tier designs did not, and why does it matter now?',
    back: 'Every leaf switch connects to every spine switch, so a packet crossing from any leaf to any other leaf always takes the same number of hops — no unpredictable long way around. That matters because modern workloads like microservices generate heavy east-west (server-to-server) traffic, which spine-leaf handles far more evenly than designs built around north-south (in-and-out of the data center) traffic.',
  },
  {
    id: 'sdn',
    service: 'SDN (Software-Defined Networking)',
    front: 'What does SDN pull apart, and what does centralizing it enable?',
    back: 'SDN pulls the control plane — the decision-making about how traffic should flow — away from the data plane, the actual switches and routers forwarding packets. Concentrating that decision-making in one software controller means the whole network can be reconfigured from a single point instead of touching every device by hand.',
  },
  {
    id: 'zero-trust',
    service: 'Zero Trust Architecture',
    front: 'What assumption does zero trust architecture (NIST SP 800-207) reject?',
    back: "It rejects the idea that being 'inside' the network perimeter earns any automatic trust at all. Instead, every single access request is authenticated and authorized in the moment it's made, and whatever gets approved is scoped down to the minimum access actually needed for that request.",
  },
  {
    id: 'vxlan',
    service: 'VXLAN',
    front: "What limitation of plain 802.1Q VLANs does VXLAN's addressing fix?",
    back: "802.1Q's VLAN ID is only 12 bits, capping a network at roughly 4,000 usable VLANs — too few for a large multi-tenant data center. VXLAN (RFC 7348) tunnels Layer 2 traffic over an existing IP network and tags each segment with a 24-bit VXLAN Network Identifier instead, opening up more than 16 million possible segments.",
  },

  // ---------------------------------------------------------------------
  // Network Implementation
  // ---------------------------------------------------------------------
  {
    id: 'static-vs-dynamic-routing',
    service: 'Static vs. Dynamic Routing',
    front: 'What do you give up by hand-entering static routes instead of running a dynamic protocol?',
    back: "A static route costs nothing in overhead and behaves exactly as configured, but it has no awareness of the network around it — if the path it points to goes down, it just keeps pointing there until a person fixes it. A dynamic protocol trades that simplicity for routers that talk to each other and recalculate paths automatically the moment the topology changes.",
  },
  {
    id: 'ospf',
    service: 'OSPF',
    front: 'How does OSPF arrive at its routing decisions?',
    back: "OSPF (RFC 2328) is a link-state protocol confined to a single autonomous system: every router floods details of its local links out to the rest of the area, so all of them converge on an identical topology map and each independently runs its own shortest-path-first calculation against it.",
  },
  {
    id: 'eigrp',
    service: 'EIGRP',
    front: 'Why does EIGRP recover from a failure faster than RIP does?',
    back: "EIGRP (RFC 7868) is Cisco's own distance-vector protocol, but it runs the Diffusing Update Algorithm (DUAL), which works out backup paths ahead of time, before anything actually breaks. RIP has no such head start — it only starts recalculating after a failure is detected, which is slower by comparison.",
  },
  {
    id: 'bgp',
    service: 'BGP',
    front: "What makes BGP a 'path-vector' protocol, and where does it operate?",
    back: "BGP (RFC 4271) is the exterior protocol that glues independently run autonomous systems together across the public internet, rather than routing inside any one of them. Its path-vector label comes from how it picks a route: mainly by inspecting the AS path attribute, the literal chain of autonomous systems an announcement already passed through, not by tallying link costs.",
  },
  {
    id: 'administrative-distance',
    service: 'Administrative Distance',
    front: 'Administrative distance settles a tie between which two things — protocols, or routes within one protocol?',
    back: "Between protocols, not routes within a protocol. When OSPF and EIGRP both hand the router a path toward one identical network, only the entry with the lower AD value gets installed — EIGRP's 90 beats OSPF's 110 by default — with zero comparison of which route is quicker or more efficient. Ranking multiple paths inside one already-selected protocol is metric's job, a separate calculation that happens afterward.",
  },
  {
    id: 'nat-pat',
    service: 'NAT vs. PAT',
    front: 'What extra piece of the packet does PAT rewrite that Basic NAT leaves alone?',
    back: "Basic NAT (RFC 3022) swaps only the IP address, so it needs one public address per internal host that's active simultaneously. PAT also rewrites the source port number, which is what lets an entire private network share just one public IP address at once — the setup almost every home router actually runs.",
  },
  {
    id: 'fhrp',
    service: 'FHRP (First Hop Redundancy Protocol)',
    front: 'From an end host\'s point of view, what changes when an FHRP fails over to a backup router?',
    back: "Nothing that the host can see. An FHRP has a group of routers share one virtual IP address configured as the default gateway, and if whichever router is actively forwarding traffic goes down, another member of the group silently assumes that same virtual IP — the gateway address never changes on the host's end.",
  },
  {
    id: 'hsrp-vs-vrrp',
    service: 'HSRP vs. VRRP',
    front: 'Between HSRP and VRRP, which one is the vendor-neutral standard?',
    back: "VRRP is the open one — RFC 5798 carries Standards Track status. HSRP is Cisco's own creation, and RFC 2281 only carries Informational status, confirming it as a vendor protocol rather than an IETF standard. Because they use different multicast addresses, packet formats, and virtual MAC ranges, a router running one can't join a group running the other.",
  },
  {
    id: 'vlan',
    service: 'VLAN',
    front: "Why can't two hosts on the same physical switch but different VLANs talk directly at Layer 2?",
    back: "Each VLAN is its own broadcast domain, so hosts in separate VLANs are cut off from each other at Layer 2 no matter how they're physically cabled — reaching across requires routing, exactly as if they lived on two separate physical networks.",
  },
  {
    id: 'trunk-8021q',
    service: 'Trunk Ports & 802.1Q',
    front: "What's the one VLAN 802.1Q lets cross a trunk without a tag, and why is that risky?",
    back: "The native VLAN is exempt from tagging by convention, kept for compatibility with older gear. The risk shows up if the two switches on either end of a trunk disagree about which VLAN is native — frames from each side's native VLAN then land in whatever VLAN the far end treats as native, quietly bridging traffic across a boundary that should have held.",
  },
  {
    id: 'link-aggregation-lacp',
    service: 'Link Aggregation & LACP',
    front: 'What can LACP catch that a plain static EtherChannel bundle cannot?',
    back: "LACP (IEEE 802.1AX) actively negotiates membership and keeps checking that both ends still agree on the bundle's configuration, so it notices a misconfigured or dead link and automatically drops it out of rotation. A static bundle has no such negotiation — it just keeps forwarding on every configured port whether or not that link is actually healthy.",
  },
  {
    id: 'spanning-tree',
    service: 'Spanning Tree Protocol (STP)',
    front: 'In STP, what does a blocking port do that a designated port does not?',
    back: "Every switch first picks its root port, the best path toward the elected root bridge, and a designated port to forward for each segment. Any remaining port that would otherwise complete a loop is put into blocking — it stays physically up and keeps listening, but discards frames, ready to switch to forwarding instantly if the active path ever fails.",
  },
  {
    id: 'ssid-bssid',
    service: 'SSID vs. BSSID vs. ESSID',
    front: 'A client roams between two access points broadcasting the same network name without ever reassociating from scratch. What made that possible?',
    back: "Both radios share one SSID (the name the client sees) but each has its own unique BSSID (its individual MAC address). The ESSID is the label for that whole set of access points cooperating under one SSID, which is exactly what lets a client hop between BSSIDs while the network name it's connected to never appears to change.",
  },
  {
    id: 'wpa2',
    service: 'WPA2',
    front: 'Once an attacker has captured a WPA2 four-way handshake, what can they do without touching the live network again?',
    back: 'WPA2 secures data with AES-CCMP and derives its session key during a four-way handshake performed after a client proves it knows the pre-shared key. Because that handshake alone is enough to attempt cracking, a captured copy lets an attacker try dictionary or brute-force guesses entirely offline, at whatever speed their own hardware allows.',
  },
  {
    id: 'wpa3',
    service: 'WPA3',
    front: "What happens to pre-shared keys under personal WPA3, and how does SAE change the cracking math?",
    back: "Personal WPA3 still relies on a PSK. What changes is SAE (the Dragonfly handshake): rather than a handshake an attacker can capture once and crack offline forever, SAE forces a fresh live exchange with the actual access point for every single guess, which makes brute-forcing dramatically slower and easy to notice happening.",
  },

  // ---------------------------------------------------------------------
  // Network Operations
  // ---------------------------------------------------------------------
  {
    id: 'snmp-versions',
    service: 'SNMP Versions',
    front: "Which SNMP version actually introduced real encryption, and what's the common wrong answer?",
    back: "SNMPv3, through its User-based Security Model, is the version that finally added genuine authentication and encryption. A frequent mistake is crediting SNMPv2c for that — v2c's real contribution was the faster GetBulkRequest query, not security; v1 and v2c both still authenticate with nothing stronger than a cleartext community string.",
  },
  {
    id: 'mttr-mtbf',
    service: 'MTBF vs. MTTR',
    front: 'A device has a high MTBF and a low MTTR. What does each number tell you separately?',
    back: 'High MTBF (Mean Time Between Failures) says failures are infrequent to begin with. Low MTTR (Mean Time To Repair) says that when a failure does happen, detecting, diagnosing, and restoring it goes quickly. One measures how often things break; the other measures how fast they get fixed.',
  },
  {
    id: 'rto-vs-rpo',
    service: 'RTO vs. RPO',
    front: 'A system meets its RTO after an outage but still fails its RPO. How is that possible?',
    back: "RTO only caps how long the system is allowed to stay down, and it recovered inside that window. RPO is a completely separate promise about how current the restored data has to be — if the backup restored from was hours stale, the downtime target can be hit perfectly while data loss still blows past what was acceptable.",
  },
  {
    id: 'mtd',
    service: 'Maximum Tolerable Downtime (MTD)',
    front: 'Why does RTO have to be a smaller number than MTD?',
    back: "RTO has to come in smaller than MTD. MTD (NIST SP 800-34) is the absolute ceiling on how long a whole business process can tolerate being down, counting every downstream consequence; RTO is the narrower, resource-specific recovery target that's supposed to land safely inside that larger ceiling, not exceed it.",
  },
  {
    id: 'hot-warm-cold-site',
    service: 'Hot, Warm & Cold Sites',
    front: 'Rank cold, warm, and hot DR sites by how much hardware is already sitting there waiting.',
    back: "A cold site has essentially none — just space, power, and connectivity, with equipment acquired only after disaster strikes, making it cheap but slow. A warm site has some systems already installed. A hot site is fully built out and staffed, ready to take over almost immediately, at the highest ongoing cost.",
  },
  {
    id: 'siem',
    service: 'SIEM',
    front: 'A SIEM does more than just store centralized logs. What is that extra layer?',
    back: "Plain log aggregation just funnels logs from many devices into one place. A SIEM sits on top of that stream and actively correlates events across different sources, applying rules to surface patterns that look suspicious, so an analyst investigates from one console instead of piecing together clues device by device.",
  },
  {
    id: 'doh-vs-dot',
    service: 'DoH vs. DoT',
    front: 'Which encrypted DNS protocol is easier for a network administrator to selectively block, and why?',
    back: "DoT (RFC 7858) is easier to block, because it always runs over its own dedicated port, 853 — an administrator can filter on that port number alone. DoH (RFC 8484) deliberately hides inside ordinary HTTPS traffic on port 443, so blocking it risks breaking unrelated web traffic sharing that same port.",
  },
  {
    id: 'dnssec',
    service: 'DNSSEC',
    front: "DNSSEC stops a forged DNS answer from being trusted — why doesn't it also hide the query from an eavesdropper?",
    back: "DNSSEC (RFC 4033) signs zone data so a resolver can verify a response actually came from the real authoritative source and wasn't altered — authentication and integrity, not secrecy. The query and response still travel in the clear; encrypting that content is left entirely to DoH or DoT.",
  },
  {
    id: 'dhcp-dora',
    service: 'DHCP DORA',
    front: 'Walk through the four DORA messages and who sends each one.',
    back: "DORA runs in four steps. First, the client sends out a broadcast DHCPDISCOVER since it doesn't know of any server yet. Every listening server can answer back with its own DHCPOFFER, dangling a candidate address. Out of whichever offers come in, the client settles on just one and broadcasts a DHCPREQUEST calling it out by name, which doubles as the signal telling the losing servers they weren't picked. The winning server finishes things off with a DHCPACK.",
  },
  {
    id: 'ntp-ptp',
    service: 'NTP vs. PTP',
    front: 'What kind of environment actually needs PTP\'s precision instead of NTP\'s?',
    back: "NTP (RFC 5905) already holds clocks within tens of microseconds on a fast LAN, which comfortably covers log correlation and authentication timing. PTP (IEEE 1588) exists for the narrower set of cases — industrial control, financial trading, telecom — that need sub-microsecond accuracy, and it demands PTP-aware switches along the entire path to get there.",
  },
  {
    id: 'change-vs-config-management',
    service: 'Change Management vs. Configuration Management',
    front: 'Which discipline decides whether a change is allowed to happen, and which one records what actually happened afterward?',
    back: "Change management is the gate beforehand — a submitted request, a risk assessment, CAB sign-off, a maintenance window, a rollback plan. Configuration management (NIST SP 800-128) is what happens after: tracking and verifying the resulting device state against a known-good baseline so drift gets caught.",
  },

  // ---------------------------------------------------------------------
  // Network Security
  // ---------------------------------------------------------------------
  {
    id: 'cia-triad',
    service: 'CIA Triad',
    front: 'An attacker silently edits a database value without ever viewing or copying anything else. Which leg of the CIA triad did they violate?',
    back: "Integrity, not confidentiality — FIPS 199 defines confidentiality as unauthorized viewing or disclosure, and nothing here was ever disclosed, only altered. Integrity is the leg that covers improper modification or destruction of data. Availability is the third leg, broken whenever legitimate users get cut off from timely access, most visibly during a denial-of-service attack.",
  },
  {
    id: 'mfa',
    service: 'Multifactor Authentication (MFA)',
    front: 'Why does a password plus a 4-digit PIN fail to qualify as MFA?',
    back: "MFA needs factors from at least two different categories: something you know, something you have, something you are. A password and a PIN are both memorized secrets, so together they're still single-category, single-factor authentication no matter how many are stacked. NIST SP 800-63B's highest tier, AAL3, pushes even further, mandating a physical hardware cryptographic authenticator — a requirement no amount of extra passwords or PINs can fulfill.",
  },
  {
    id: 'pki',
    service: 'PKI (Public Key Infrastructure)',
    front: 'Without a CA, what problem would two strangers using asymmetric encryption still have to solve?',
    back: "Proving that a given public key genuinely belongs to the party who claims it. PKI solves that by having a trusted certification authority issue a signed X.509 certificate (RFC 5280) that vouches for exactly that binding, so a relying party can trust the key without ever having to verify the owner directly.",
  },
  {
    id: 'radius-vs-tacacs',
    service: 'RADIUS vs. TACACS+',
    front: 'Which protocol protects an entire authentication packet, and which one leaves the username exposed?',
    back: "RADIUS (UDP port 1812, RFC 2865) only ever encrypts the password inside an Access-Request; the username travels in plain text right alongside it. TACACS+ (TCP port 49, RFC 8907) scrambles the entire packet body instead, and it splits authentication, authorization, and accounting into three separate conversations rather than RADIUS's single combined reply.",
  },
  {
    id: 'saml',
    service: 'SAML',
    front: "In an SSO exchange, why doesn't the application (service provider) ever see the user's real password?",
    back: "Because it never handles authentication at all. Only the identity provider ever validates a real credential; it then vouches for the user by handing the application a signed SAML assertion. The application checks that assertion's signature and trusts it — so if that application is later breached or decommissioned, no actual password was ever sitting there to steal.",
  },
  {
    id: 'ldap',
    service: 'LDAP',
    front: 'Why can one stale LDAP entry cause problems across several unrelated systems?',
    back: "Because LDAP is usually the shared back end: SSO identity providers check credentials and group membership against it before issuing assertions, and RADIUS or TACACS+ deployments often point at the very same directory instead of keeping their own separate user database. A single directory feeding that many systems means one bad entry ripples outward.",
  },
  {
    id: 'vlan-hopping',
    service: 'VLAN Hopping',
    front: 'Why can switch spoofing send traffic both ways while double tagging only sends it one way?',
    back: "Switch spoofing tricks a real switch into forming an actual trunk over DTP, and once that trunk exists it behaves like a normal trunk in both directions. Double tagging never negotiates a trunk at all — it just exploits how one native-VLAN tag gets stripped in transit — so there's no matching mechanism for a reply to retrace the same path back.",
  },
  {
    id: 'arp-poisoning',
    service: 'ARP Poisoning',
    front: 'Why does ARP have no way to reject a forged reply?',
    back: 'ARP (RFC 826) simply accepts and caches whatever IP-to-MAC mapping shows up in a packet it receives, with no built-in check that the claim is genuine. An attacker exploits exactly that gap by sending replies that falsely claim the default gateway\'s IP address for the attacker\'s own MAC, quietly rerouting a victim\'s traffic through the attacker first.',
  },
  {
    id: 'evil-twin-on-path',
    service: 'Evil Twin & On-Path Attack',
    front: 'What makes an "evil twin" a specific way of becoming an on-path attacker rather than a separate attack category?',
    back: "An evil twin — a rogue access point broadcasting a legitimate network's own SSID to lure clients — is one specific way to become an on-path attacker. On-path attack (the modern replacement for 'man-in-the-middle') just names the resulting position: sitting between two parties and able to see or alter their traffic, whether reached through an evil twin, ARP poisoning, or DNS poisoning.",
  },
  {
    id: 'dos-ddos',
    service: 'DoS vs. DDoS',
    front: 'Why is a DDoS attack harder to stop by filtering than a plain DoS attack?',
    back: "A DoS attack floods or crashes a target from one identifiable source, which a filter can simply block. A DDoS attack (RFC 4732) launches the same flood from many compromised hosts at once, so there's no single address to block, and the combined bandwidth of all those sources dwarfs what any one attacker could generate alone.",
  },
  {
    id: 'honeypot',
    service: 'Honeypot',
    front: 'Why does a honeypot generate almost no false positives compared to monitoring on a real production server?',
    back: "A honeypot has no legitimate purpose, so no genuine user has any reason to ever touch it — meaning any interaction with it at all is inherently suspicious by definition, unlike a production server where plenty of normal traffic has to be filtered out from the noise first.",
  },
  {
    id: 'acl',
    service: 'Access Control Lists (ACLs)',
    front: 'An ACL made entirely of permit rules still ends up blocking something. How?',
    back: "Every ACL carries an implicit deny at the very end — a packet that falls through every listed rule without a match still gets dropped, whether or not anyone actually typed that deny in. Because rules are checked in order and stop at the first match, a too-broad rule placed early can also quietly override a narrower one an administrator meant to take effect further down.",
  },
  {
    id: 'dmz',
    service: 'DMZ',
    front: 'If a web server in the DMZ gets compromised, what stops the attacker from reaching the internal network next?',
    back: "A second, separately enforced firewall boundary between the DMZ and the trusted internal zone. The whole point of putting internet-facing systems in a DMZ instead of directly on the internal network is that compromising one still leaves an attacker outside the zone holding the organization's actual sensitive resources.",
  },
  {
    id: 'nac-8021x',
    service: 'NAC & 802.1X',
    front: 'What traffic is allowed through an 802.1X port before authentication succeeds?',
    back: "Essentially nothing but the EAPOL handshake. Three parties are involved: the supplicant, meaning the connecting endpoint's own 802.1X client software; the authenticator — the switch port, which holds regular traffic back until a verdict comes down; and the authentication server — typically RADIUS — which is the party that actually renders the accept-or-reject verdict.",
  },
  {
    id: 'dot1q-vs-dot1x',
    service: '802.1Q vs. 802.1X',
    front: 'Between 802.1Q and 802.1X, which one tags frames for VLAN membership, and which one gates a port until a device authenticates?',
    back: "802.1Q inserts a tag into a frame crossing a trunk link so switches on either end can tell which VLAN that frame belongs to as multiple VLANs share the same physical link. 802.1X does something unrelated to tagging: it's port-based authentication, where a switch port blocks nearly all traffic from whatever's plugged in until an authentication server approves it, only then opening the port to ordinary traffic. The numbers look similar but the jobs don't overlap at all — one is a frame format, the other is an access-control handshake.",
  },
  {
    id: 'ids-vs-ips',
    service: 'IDS vs. IPS',
    front: 'Why can an IDS only alert on an attack while an IPS can actually stop it?',
    back: "An IDS typically only sees a mirrored copy of traffic (off a SPAN port, for instance) — it never sits in the actual forwarding path, so the most it can do is analyze and raise an alert. An IPS sits directly inline, which is exactly what lets it drop or block a malicious packet in real time instead of just reporting it after the fact.",
  },

  // ---------------------------------------------------------------------
  // Network Troubleshooting
  // ---------------------------------------------------------------------
  {
    id: 'troubleshooting-methodology',
    service: "CompTIA's Seven-Step Troubleshooting Process",
    front: "List CompTIA's seven troubleshooting stages in order.",
    back: '1) Identify the problem. 2) Establish a theory of probable cause. 3) Test the theory. 4) Establish a plan of action. 5) Implement the solution. 6) Verify full system functionality. 7) Document findings.',
  },
  {
    id: 'troubleshooting-theory-confirmed-next',
    service: 'Troubleshooting: After Confirming a Theory',
    front: "In CompTIA's troubleshooting methodology, what stage comes right after a theory of probable cause is confirmed by testing?",
    back: "Establish a plan of action for resolving the problem, CompTIA's fourth stage, turning the confirmed theory into a concrete, deliberate fix before anything is touched.",
  },
  {
    id: 'troubleshooting-theory-disproven-next',
    service: 'Troubleshooting: When a Theory Fails',
    front: 'If testing disproves a theory of probable cause, what should a technician do instead of adjusting the fix already in progress?',
    back: 'Rule out that theory instead of tweaking the same fix further, then move to the next most likely candidate and restart the plan-implement-verify cycle; escalating once every testable theory is exhausted counts as a legitimate outcome, not a failure of the process.',
  },
  {
    id: 'troubleshooting-after-verify-next',
    service: 'Troubleshooting: The Final Stage',
    front: "After verifying full system functionality, what's the seventh and final stage of CompTIA's process, and why does it matter?",
    back: 'Document findings, a written record explaining what broke and how it was fixed, giving whoever handles the next similar ticket a head start instead of starting from zero.',
  },
  {
    id: 'top-down-bottom-up',
    service: 'Top-Down, Bottom-Up & Divide-and-Conquer',
    front: 'A user reports one specific web app is broken while everything else works fine. Which troubleshooting approach fits best, and why?',
    back: "Top-down fits here — begin at the application layer, exactly where the symptom is pointing, and only drop to lower layers if that comes up empty. Bottom-up flips that order, beginning at the physical layer, which is the right call for cabling faults or a dead link light. Divide-and-conquer skips both endpoints and checks the middle first — typically Layer 3 — when nothing yet suggests which end is more likely to be broken.",
  },
  {
    id: 'cat6-vs-cat6a',
    service: 'Cat6 vs. Cat6a Distance Limit',
    front: 'A 90-meter run needs a guaranteed 10Gbps. Why does that rule out Cat6?',
    back: "Cat6 can hit 10GBASE-T, but only over a shortened distance — roughly 37 to 55 meters depending on alien crosstalk — not the standard 100-meter horizontal run. Cat6a adds shielding that suppresses that alien crosstalk specifically, which is what lets it guarantee 10Gbps across the full 100 meters instead.",
  },
  {
    id: 'attenuation-crosstalk',
    service: 'Attenuation & Crosstalk',
    front: "Attenuation and crosstalk are both signal-quality problems. What's the actual source of each?",
    back: "Attenuation comes from the cable itself — the signal simply loses strength the farther it travels, which is why every category has a maximum rated distance. Crosstalk comes from nearby wiring instead: NEXT leaks between pairs bundled inside the same cable, while alien crosstalk leaks in from a completely different cable running alongside it.",
  },
  {
    id: 'crc-errors',
    service: 'CRC Errors',
    front: 'A switch port shows climbing CRC errors but zero collisions. What layer does that point to?',
    back: "The physical layer. A CRC mismatch tells you the frame arrived different from how it was sent — the checksum no longer matches the data — which points to transmission damage from something like a worn cable, a bad connector, or a flaky transceiver. That kind of corruption doesn't come from two devices fighting over the same medium, so a zero collision count rules out a contention-based explanation.",
  },
  {
    id: 'duplex-mismatch',
    service: 'Duplex Mismatch',
    front: 'Late collisions are the textbook symptom of what physical-layer misconfiguration?',
    back: "Duplex mismatch — one side of the link is set to full duplex and just transmits without checking whether the wire is busy, colliding with the other side's still-outgoing half-duplex frame partway through, so the collision is only noticed after a meaningful chunk of data has already gone out rather than immediately.",
  },
  {
    id: 'stp-loop-cause',
    service: 'STP Loop Root Cause',
    front: 'What usually causes an active STP loop, given that STP logic itself is rarely at fault?',
    back: "The usual trigger is a previously blocked port that starts forwarding again simply because BPDUs stopped arriving to tell it to stay blocked — the link itself stays up while a duplex mismatch (or similar fault) silently corrupts the control traffic riding across it. STP's own logic is almost never actually at fault.",
  },
  {
    id: 'dhcp-decline-nak',
    service: 'DHCPDECLINE vs. DHCPNAK',
    front: 'A DHCP exchange fails partway through. How do you tell from a DHCPDECLINE versus a DHCPNAK which side sent it?',
    back: "DHCPDECLINE always comes from the client — it fires when the client's own ARP check finds its newly offered address already in use. DHCPNAK always comes from the server, refusing a renewal request outright, typically because the client is asking to keep an address that no longer fits the subnet it's actually connected to.",
  },
  {
    id: 'jitter',
    service: 'Jitter',
    front: "RFC 3550 defines jitter as more than casual delay variation. What's the actual formula behind it?",
    back: "Interarrival jitter is a running, smoothed estimate of how much the gap between consecutive packets' transit times varies — recalculated after every packet using exponential smoothing, weighting the newest measurement against the prior estimate, rather than a flat average taken across an entire session.",
  },
  {
    id: 'latency-vs-packet-loss',
    service: 'Latency vs. Packet Loss',
    front: 'Why can a link have low latency but still suffer heavy packet loss?',
    back: "They measure different things. Latency is how long a packet takes to arrive, adding up propagation, queuing, and processing delay. Packet loss is simply whether it arrived at all, which can happen fast (a full queue dropping it instantly) or slow, independent of how quick the surviving packets are.",
  },
  {
    id: 'traceroute',
    service: 'traceroute',
    front: 'How does manipulating TTL let traceroute map every hop along a path?',
    back: "It sends a burst of probes with TTL starting at 1 and increasing by one each round, so each probe expires exactly one hop farther than the last. Whichever router happens to be sitting at that hop returns an ICMP expiry message, and stringing those replies together reconstructs the path hop by hop.",
  },
  {
    id: 'nslookup',
    service: 'nslookup',
    front: 'A host is reachable by ping, but a specific hostname won\'t resolve. Which tool isolates that, and why not just use ping?',
    back: "nslookup (or dig), because it queries DNS directly instead of testing reachability. ping and traceroute only confirm whether a path or a host responds — they say nothing about whether a name maps to the right address, which is exactly the gap nslookup is built to check.",
  },
  {
    id: 'nmap',
    service: 'nmap',
    front: 'Beyond confirming a host is alive, what three things can an nmap scan reveal about it?',
    back: 'Which ports are actually open, what application and version is listening behind each open port, and — by fingerprinting subtle quirks in how the host\'s TCP/IP stack responds — a likely guess at its operating system.',
  },
  {
    id: 'tcpdump-troubleshoot',
    service: 'tcpdump',
    front: "A connectivity test says a path is up, but something is still wrong with one specific conversation. What's the next tool?",
    back: "tcpdump. Basic reachability tools like ping only confirm a path exists; tcpdump captures the actual packet contents of a conversation, which is what's needed to spot a malformed request, a handshake that never finishes, or a retransmission pattern that ping alone would never reveal.",
  },
  {
    id: 'poe-standards',
    service: 'PoE Standards (802.3af/at/bt)',
    front: "A device needs a guaranteed 25W of power. Which PoE tier actually clears that, and what number should be checked to find out?",
    back: "The device-side guaranteed figure, not the port's rated maximum. 802.3af (Type 1) only guarantees 12.95W actually reaches the device after cable loss. 802.3at/PoE+ (Type 2) guarantees 25.5W at the device, which is the first tier that clears a 25W requirement. 802.3bt Type 3 and Type 4 push that guarantee to roughly 51W and 71.3W.",
  },
];
