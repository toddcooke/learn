// js/data/studyContent.js
// Study notes for the CKA exam domains, starting with Cluster Architecture,
// Installation and Configuration (25% exam weight) and Services and
// Networking (20% exam weight). Grounded in kubernetes.io and helm.sh
// documentation fetched into .cache/aws-docs/ (see scripts/fetch-doc.mjs).
// Written in the author's own words, not copied verbatim from the source docs.

export const STUDY_CONTENT = [
  {
    domain: 'cluster',
    taskStatement: 'RBAC and access control',
    topics: [
      {
        title: 'Roles and ClusterRoles: scoping permissions to a namespace or the whole cluster',
        body: "Kubernetes' RBAC authorization model works through four API objects in the rbac.authorization.k8s.io group: Role, ClusterRole, RoleBinding, and ClusterRoleBinding. A Role is namespaced — it must be created inside a specific namespace and only ever grants permissions on resources within that namespace — while a ClusterRole is cluster-scoped and can grant permissions on namespaced resources across every namespace, on resources that don't belong to any namespace such as Nodes, or on non-resource API paths like /healthz. Every rule inside a Role or ClusterRole is purely additive; RBAC has no concept of a rule that denies access, so a subject's effective permissions are simply the union of everything granted to it. A single rule combines an API group, one or more resource types (optionally narrowed to specific resource names or subresources such as pods/log), and a list of verbs like get, list, watch, create, update, or delete, and it's safer to spell out exact resources and verbs than to reach for wildcards, since a wildcard silently grants access to any resource type added later.",
      },
      {
        title: 'RoleBindings and ClusterRoleBindings: attaching a role to a subject',
        body: "A binding is what actually hands a role's permissions to someone; it lists one or more subjects — users, groups, or ServiceAccounts — together with a reference to the Role or ClusterRole being granted. A RoleBinding only takes effect inside its own namespace even when it points at a ClusterRole, which is the standard way to reuse one shared set of rules (say, a common developer ClusterRole) across many namespaces without redefining it each time. A ClusterRoleBinding, by comparison, applies its role everywhere in the cluster at once. Once a binding is created, the role it points to can't be changed in place — swapping in a different role means deleting the binding and creating a new one — while the list of subjects on an existing binding can still be edited freely, which keeps someone from quietly escalating a binding's power without a fresh, auditable object.",
      },
      {
        title: 'ServiceAccounts as the identity workloads use to call the API',
        body: 'A ServiceAccount is the identity a Pod authenticates with when it talks to the Kubernetes API, separate from the human or external identities administrators use; every Pod runs under some ServiceAccount, falling back to the "default" account of its own namespace when none is specified. Out of the box, RBAC hands ServiceAccounts outside kube-system no permissions beyond what the built-in discovery roles expose, so anything a workload needs has to be granted through an explicit binding. The more secure pattern is a dedicated ServiceAccount per application, bound only to the roles that application actually requires, rather than granting access through a namespace-wide default account or, worse, to every ServiceAccount in the cluster — that broadest option effectively lets any running container act with whatever privilege was handed out.',
      },
      {
        title: 'Built-in ClusterRoles: cluster-admin, admin, edit, and view',
        body: "Kubernetes ships several default, user-facing ClusterRoles covering the access levels administrators most often need to grant. cluster-admin is a super-user role that, bound cluster-wide, permits any action on any resource anywhere; admin and edit both give broad read/write access inside a namespace when attached through a RoleBinding, but neither can touch resource quotas, and edit additionally can't view or modify roles and role bindings even though it can still run Pods as any ServiceAccount in the namespace. view is read-only and, notably, withholds access to Secrets, because reading a Secret can itself be a path to acting as another ServiceAccount. These defaults rely on ClusterRole aggregation, so an administrator can extend admin, edit, or view to cover a new custom resource just by creating another ClusterRole carrying the matching rbac.authorization.k8s.io/aggregate-to-* label, instead of editing the built-in role directly.",
      },
      {
        title: 'Preventing privilege escalation through role and binding creation',
        body: "RBAC enforces a check at the API layer — active even when the RBAC authorizer itself isn't the one deciding a request — that stops a subject from granting more than it already has, and it does so through two separate gates. Creating or updating a Role or ClusterRole requires either already holding every permission it would contain at the same scope, or carrying explicit authorization to perform the escalate verb against roles or clusterroles resources. Creating or updating a binding to that role is a distinct check: it requires either already holding the referenced role's own permissions yourself, or carrying explicit authorization to perform the bind verb against that specific role. This closes the obvious loophole where a narrowly-scoped user could define a broader role and then bind it to themselves. The deliberate exception is bootstrapping: the very first roles and bindings on a brand-new cluster are created using a credential from the system:masters group, which the default bindings tie to the cluster-admin role, giving the initial administrator a starting point from which everything else can be granted.",
      },
    ],
  },
  {
    domain: 'cluster',
    taskStatement: 'Preparing infrastructure and creating clusters with kubeadm',
    topics: [
      {
        title: 'Planning a production-ready cluster: availability, scale, and access',
        body: "Moving from a single-machine learning setup to a production deployment means deliberately addressing availability, scale, and access management. Availability means pulling the control plane off the worker nodes, running more than one replica of each control-plane component, and putting a load balancer in front of the API server, rather than accepting the single point of failure a one-machine cluster has. Scale means having enough worker capacity for today's load and a plan for adding more as demand grows, whether that plan is manual or automated. And because a production cluster is typically shared far more widely than a personal one, access shifts from a single administrative account to layered authentication — verifying who's making a request, via client certificates, bearer tokens, or an external identity provider — combined with authorization, almost always RBAC, that decides what an already-verified identity is allowed to do.",
      },
      {
        title: 'Node roles and host prerequisites for kubeadm',
        body: "Every node destined for a kubeadm cluster needs a working container runtime already installed, since the kubelet has no way to start a Pod without one, plus full network connectivity to every other machine in the cluster. kubeadm's stated minimums call for at least 2 CPUs on any host that will run as a control-plane node, along with a memory floor of 2 GiB on every machine — dropping below that leaves an application little breathing room. Nodes take on one of two roles: a control-plane node hosts the cluster's control-plane services, including etcd — the cluster's backing datastore — and the API server that kubectl and every other client talks to, while a worker node is where ordinary application Pods actually get scheduled. kubeadm taints control-plane nodes by default so regular workloads land only on workers, reserving control-plane capacity for cluster management; that taint can be manually removed on small or single-machine setups where the separation isn't needed.",
      },
      {
        title: 'kubeadm init: bootstrapping the first control-plane node',
        body: "Running kubeadm init on a chosen machine stands up the very first control-plane node: it runs a batch of readiness checks, then pulls down and starts the control-plane components. If there's any chance this cluster will grow into a highly-available one later, the guidance is to pass --control-plane-endpoint at this very first init so every future control-plane node shares one stable DNS name or load-balancer address from day one, because a single control-plane cluster built without that flag can't later be converted into an HA one. Once the control plane is up, kubeadm prints a join command carrying a bootstrap token and a discovery hash that other machines will use to authenticate into the cluster, along with instructions for copying the admin kubeconfig so kubectl can be used without root access.",
      },
      {
        title: 'Deploying a Pod network add-on and joining nodes',
        body: "A newly initialized kubeadm cluster isn't functional yet: CoreDNS and ordinary Pod-to-Pod traffic won't work until a CNI-based Pod network add-on has been applied with kubectl apply. Only one Pod network can be installed per cluster, and since kubeadm enables and enforces RBAC by default, whatever add-on gets chosen needs manifests written to work under that enforcement. Once the network add-on is running and CoreDNS shows as Running, more machines can be added by executing the join command saved from the init output on each one, supplying the shared token and certificate hash so the new node can authenticate; the same command with an added --control-plane flag and a certificate key is how additional control-plane nodes — rather than plain workers — are added.",
      },
      {
        title: 'Draining and removing a node with kubeadm',
        body: "Decommissioning a node cleanly starts with kubectl drain against it, which evicts its running workloads and marks it unschedulable, before running kubeadm reset on the node itself to undo the local state kubeadm created there. kubeadm reset deliberately leaves iptables and IPVS rules untouched, so those have to be cleared by hand if a full cleanup is wanted. Only after the reset should the corresponding Node object be removed from the API with kubectl delete node. Getting this order right matters operationally: draining first gives the scheduler a chance to move workloads elsewhere before capacity disappears, whereas resetting or deleting out of turn can leave the cluster believing a node is still schedulable after its kubelet has already stopped.",
      },
    ],
  },
  {
    domain: 'cluster',
    taskStatement: 'Cluster lifecycle and high availability',
    topics: [
      {
        title: 'The kubeadm upgrade order: control plane first, then workers',
        body: "kubeadm upgrades a cluster in a strict sequence: the first control-plane node runs kubeadm upgrade apply against the target version, every remaining control-plane node then runs kubeadm upgrade node, and only once all control-plane nodes are upgraded do worker nodes get upgraded one at a time (or a few at a time) so the workload never drops below the capacity it needs. kubeadm only supports advancing one minor version per upgrade — skipping straight from, say, 1.34 to 1.36 isn't supported — while a node's kubelet is allowed to lag up to three minor versions behind the control plane, which is what makes staged rollouts across a large fleet practical. Crucially, kubeadm upgrade only manages components internal to Kubernetes itself; it never touches application workloads, so backing up anything at the workload level, like database state, stays a separate responsibility.",
      },
      {
        title: 'Draining, upgrading, and uncordoning individual nodes',
        body: "Before a node's kubelet is touched during a minor-version upgrade, that node needs to be drained with kubectl drain so its Pods get evicted and rescheduled elsewhere — important even for control-plane nodes, since one of them might be hosting CoreDNS or another critical workload at that moment. After its kubeadm, kubelet, and kubectl packages are upgraded and the kubelet service restarted, the node is returned to service with kubectl uncordon, clearing the unschedulable mark that drain had set. Every container on a node restarts once its kubelet's configuration changes during an upgrade, so a brief disruption to that one node's workloads is expected, and checking that its status flips back to Ready with kubectl get nodes is the normal way to confirm the upgrade succeeded.",
      },
      {
        title: 'HA control-plane topologies: stacked etcd vs external etcd',
        body: 'kubeadm supports two topologies for a highly-available control plane. In the stacked topology, each control-plane node runs its own etcd member side by side with its API server and other control-plane services, which needs less infrastructure overall; in the external topology, etcd instead runs as its own independent cluster of machines that every control-plane node connects to over the network, which needs more hardware but keeps an etcd failure from taking down a control-plane node\'s other services, and vice versa. Both approaches call for at least three control-plane nodes — and, for external etcd, at least three separate etcd hosts — because an odd number gives etcd\'s underlying consensus protocol a clean majority for leader election if a node or zone is lost. Whichever topology is chosen, a load balancer sitting in front of every control-plane node\'s API server, matching whatever address was set as --control-plane-endpoint, is what lets clients and joining nodes reach a healthy API server without depending on any single node\'s address.',
      },
      {
        title: 'Sharing certificates and adding control-plane nodes to an HA cluster',
        body: "Initializing the first control-plane node with kubeadm init --upload-certs encrypts its certificates and stores them as a Secret in the cluster, so additional control-plane nodes can join with kubeadm join ... --control-plane --certificate-key and have those shared certificates downloaded and decrypted automatically, instead of an administrator having to copy PKI files between hosts by hand. That uploaded Secret and its decryption key expire two hours after creation by default, though they can be regenerated later if more control-plane nodes still need to join. After a second or third control-plane node comes online, restarting the CoreDNS deployment is worth doing so its replicas get spread across nodes, since sequential initialization otherwise tends to leave every CoreDNS replica sitting on the first control-plane node alone.",
      },
      {
        title: 'etcd backups and single-control-plane resilience limits',
        body: "Because etcd holds every object definition, every Secret, and the entire current state of the cluster, a kubeadm cluster running just one control-plane node has effectively no resilience against that node failing — losing it can mean losing cluster data entirely and rebuilding from nothing. Regularly backing up the etcd data directory, which kubeadm places at /var/lib/etcd by default, is the documented safeguard for anyone running a single-node setup, and kubeadm upgrade itself automatically takes its own etcd and static-manifest backups before an upgrade proceeds, specifically so a failed upgrade has something to roll back to. For workloads that genuinely need continuous availability rather than backup-and-restore, running multiple control-plane nodes under either HA topology is what removes etcd, and the rest of the control plane, as a single point of failure in the first place.",
      },
    ],
  },
  {
    domain: 'cluster',
    taskStatement: 'Extending the cluster: Helm, Kustomize, CNI/CSI/CRI, CRDs and operators',
    topics: [
      {
        title: 'Helm: charts, repositories, and releases',
        body: "Helm packages a Kubernetes application as a chart — a bundle of resource templates and default configuration values needed to run it — and charts get published to repositories that a Helm client can search remotely or add locally. Running helm install against a chart doesn't just produce the underlying Kubernetes objects; it produces a release, a distinct, named, trackable installation of that chart, and installing the same chart repeatedly (two separate database instances, say) simply creates two independent releases that can each be upgraded or removed on their own. This release-oriented model is what sets Helm apart from applying raw manifests directly: Helm keeps a history of each release's configuration, which is what makes rolling a release back to an earlier revision or tearing it down as a single unit possible.",
      },
      {
        title: 'Kustomize: layering customization over plain manifests',
        body: "Kustomize takes a different approach than Helm's fill-in-the-template model: it works entirely from a kustomization.yaml file that lists ordinary, unmodified Kubernetes manifests as its resources, then layers transformations on top — generating ConfigMaps or Secrets from literal values or from files, applying common labels, or patching fields across a whole set of objects. Because kubectl has built-in Kustomize support since v1.14, a kustomization directory can be previewed with kubectl kustomize <dir> or applied straight to the cluster with kubectl apply -k <dir>. This generator-driven style suits keeping several environment-specific variants of the same application — dev, staging, production — in sync, since each variant's overlay only has to describe what differs from a shared base rather than duplicating whole manifests, and Kustomize automatically updates any reference to a generated ConfigMap or Secret so nothing breaks when the generated object's name changes.",
      },
      {
        title: 'CRI: how the kubelet talks to a container runtime',
        body: 'The Container Runtime Interface defines the gRPC-based protocol the kubelet uses to instruct a container runtime, and it is what allows Kubernetes to support multiple runtimes — containerd, CRI-O, and others — without runtime-specific logic being built into the kubelet; the kubelet always plays the client role, while the runtime exposes the CRI server side. Every node needs a CRI-compatible runtime installed and running before its kubelet can launch any Pods, and as of Kubernetes v1.26 the kubelet will flatly refuse to register a node whose runtime doesn\'t implement the current v1 CRI API. Because the interface cleanly separates "orchestration" from "running containers," swapping which runtime a node uses is possible without changing anything about Kubernetes itself, as long as the replacement still speaks the same protocol.',
      },
      {
        title: 'CNI: the plugin interface behind Pod networking',
        body: "The Container Network Interface is the plugin mechanism a cluster relies on to implement Kubernetes' networking model, and a cluster is not usable without one — on a kubeadm cluster specifically, CoreDNS won't even start before a CNI-based network add-on has been deployed. Kubernetes doesn't bundle a default network implementation of its own; administrators pick from a broad ecosystem of open- and closed-source CNI plugins that must, at minimum, support the v0.4.0 revision of the CNI specification, and only one such add-on can be active per cluster. Beyond basic connectivity between Pods, individual CNI plugins can layer on optional capabilities such as exposing a container's hostPort or enforcing NetworkPolicy objects, so the plugin an environment settles on can determine whether certain traffic-isolation features are even available.",
      },
      {
        title: 'CSI: pluggable storage drivers outside the core codebase',
        body: "The Container Storage Interface plays roughly the same role for storage that CNI plays for networking: a standard, out-of-tree interface that lets a storage vendor ship a driver handling provisioning, attaching, and mounting for their storage system without that vendor's code ever being compiled into Kubernetes itself. This model replaced the earlier approach where storage integrations were built directly into Kubernetes' own source tree, which meant adding support for a new storage backend was tied to Kubernetes' own release cycle. Once a CSI driver is deployed, Pods consume the storage it exposes the same way they'd consume any other volume, typically through a PersistentVolumeClaim bound to a PersistentVolume that names the driver, and a CSIMigration mechanism can transparently redirect requests aimed at an older built-in storage plugin to the equivalent CSI driver so existing configuration keeps working through a migration.",
      },
      {
        title: 'CustomResourceDefinitions and the operator pattern',
        body: "A CustomResourceDefinition lets a cluster admin register a brand-new kind of API object — complete with its own schema, its own API group, and normal kubectl support — without writing and running a separate API server; that's the simpler of Kubernetes' two extension paths, the other being a fully independent aggregated API server that takes more effort to build but allows deeper control over validation and storage. On its own, a custom resource is just structured data an administrator can create, read, and delete through the API. Pairing that custom resource with a custom controller that watches it and continuously drives the cluster toward whatever state it declares is what turns the pair into a genuine declarative API, and a CRD combined with a controller acting on it is exactly what the operator pattern describes. Operators typically encode the operational know-how for running a specific piece of software — backups, failover, version upgrades — as automation native to the cluster, turning what would otherwise be a manual runbook into editing a custom resource.",
      },
    ],
  },
  {
    domain: 'services',
    taskStatement: 'Pod connectivity and Network Policies',
    topics: [
      {
        title: 'The Kubernetes networking model: every Pod gets a routable IP',
        body: "Kubernetes assumes a flat network in which every Pod is reachable at its own IP address from every other Pod in the cluster, on every node, without any address translation getting in the way — the network plugin running on each node is what actually hands out and routes those addresses. This sidesteps the classic problem of coordinating which host port each process gets to avoid collisions when many applications share a handful of machines, since dynamic port negotiation between applications, load balancers, and the API server doesn't scale cleanly once dozens of teams are involved. Containers within one Pod already share a single network namespace and can reach each other over localhost, so the model really has three remaining connectivity concerns to solve: getting traffic from one Pod to another, routing Pod traffic through a Service, and letting traffic from outside the cluster reach a Service.",
      },
      {
        title: 'How the network plugin allocates addresses for Pods, Services, and Nodes',
        body: "Three different components are each responsible for handing out a different category of address in a cluster: the network plugin hands out Pod addresses, while the kube-apiserver allocates each Service's address out of the configured service IP range, and either the kubelet or, when the cluster integrates with a cloud provider, the cloud-controller-manager assigns addresses to Nodes. All of these have to draw from non-overlapping ranges, and every component has to agree on which IP families — IPv4 only, IPv6 only, or dual-stack — the cluster is actually using. Most container runtimes implement this addressing and routing behavior through a Container Network Interface plugin, and because so many CNI plugins exist, cluster operators can pick one that only handles basic interface setup or one that layers on more advanced features like running multiple plugins together or richer address-management schemes.",
      },
      {
        title: 'Pod isolation: ingress and egress are independent, and off by default',
        body: "A Pod's exposure to network traffic is governed by two separate notions of isolation, one for inbound (ingress) connections and one for outbound (egress) connections, and a Pod starts out non-isolated in both directions — meaning nothing restricts its traffic until some NetworkPolicy says otherwise. A Pod becomes isolated for a given direction as soon as any NetworkPolicy both selects that Pod and lists that direction among its policy types; once that happens, only the connections explicitly permitted by that policy's rules, plus reply traffic for connections already allowed, get through in that direction. Because these effects are purely additive across every applicable policy, a connection needs the union of all ingress rules touching the destination Pod, and separately the union of all egress rules touching the source Pod, to both agree the traffic should proceed.",
      },
      {
        title: 'Targeting traffic with podSelector, namespaceSelector, and ipBlock',
        body: "A NetworkPolicy's ingress sources or egress destinations are built out of up to three selector kinds: a podSelector matching Pods in the policy's own namespace, a namespaceSelector matching every Pod inside namespaces carrying certain labels, and an ipBlock naming external CIDR ranges, since Pod addresses themselves are too short-lived to be useful there. Combining a namespaceSelector and a podSelector inside one list entry narrows the match to Pods with both sets of labels at once, while listing them as two separate entries instead broadens the match to either condition — a YAML nesting detail worth checking with kubectl describe whenever a policy's actual effect is in doubt. Two exceptions apply no matter what a policy selects: a Pod can never be blocked from reaching itself, and traffic between a Pod and the node it happens to be running on is always permitted.",
      },
      {
        title: 'Building default-deny and default-allow policies for a namespace',
        body: "Because nothing is restricted anywhere a NetworkPolicy hasn't been applied, a common pattern is a namespace-wide baseline: a NetworkPolicy with an empty podSelector, matching every Pod in the namespace, paired with no ingress or egress entries creates a default-deny for that direction, while the same empty podSelector paired with a single all-matching rule creates an explicit default-allow that no narrower policy can override. A default-deny-egress policy is easy to get wrong in practice because it also blocks DNS lookups by default, so any namespace adopting one needs a companion rule that explicitly permits egress to the cluster's DNS service. Applying both an ingress and an egress default-deny policy together locks a namespace down in both directions at once, giving administrators a known baseline before layering on narrower allow rules for specific applications.",
      },
      {
        title: 'What NetworkPolicy enforcement requires and does not cover',
        body: "A NetworkPolicy object is inert on its own — it only takes effect once the cluster's network plugin actually implements NetworkPolicy support, so creating one against a plugin that lacks that support changes nothing. Where enforcement does apply, it is scoped to layer 3 and 4 traffic such as TCP, UDP, and optionally SCTP; behavior toward other protocols like ICMP is left undefined and varies by plugin. The API also has real gaps worth knowing when troubleshooting: it cannot target a Service by name, only Pods or namespaces by label, it has no explicit deny rule since the model is deny-by-default with only additive allows, it cannot apply automatically to every namespace cluster-wide, and it offers no built-in way to record which connections a policy blocked or accepted — those needs typically fall to a service mesh, a Layer 7 proxy, or OS-level tooling instead.",
      },
    ],
  },
  {
    domain: 'services',
    taskStatement: 'Service types and endpoints',
    topics: [
      {
        title: 'Why Services exist: stable access to a shifting set of Pod IPs',
        body: "Pods are deliberately disposable: a Deployment can replace them at any time, each replacement gets a brand-new address, and the set of currently healthy Pods backing an application can look completely different only moments later. That creates a real problem for anything depending on those Pods — a frontend has no reliable way to know which backend addresses are currently good without constantly re-discovering them. A Service closes that gap by giving a logical group of Pods, normally the ones matching a label selector, one stable point of contact that keeps working across every Pod replacement, so callers never need to track individual Pod addresses themselves.",
      },
      {
        title: 'ClusterIP: the default type, plus the headless variant',
        body: "ClusterIP is what a Service becomes if no type is specified at all: Kubernetes hands it a virtual address drawn from the cluster's reserved Service range, reachable only from inside the cluster, and every other Service type effectively layers on top of this one. Setting the clusterIP field to the literal value None instead turns a ClusterIP Service headless — no virtual address gets allocated, kube-proxy leaves it alone entirely, and DNS returns the real addresses of the individual backing Pods rather than one shared address, which suits workloads whose clients need to reach a specific Pod directly instead of being load-balanced across the group. A Service can also be created with a chosen address up front, provided it falls inside the configured Service range and isn't already claimed by another Service.",
      },
      {
        title: "NodePort: reaching a Service through every Node's own address",
        body: "Setting a Service's type to NodePort layers a cluster-wide static port on top of the ClusterIP behavior it already gets for free: the control plane picks a port from a configurable range, 30000 through 32767 by default, unless a specific one is requested, and every node in the cluster then listens on that exact port and forwards whatever arrives to a healthy endpoint for the Service. That means any node's address paired with the allocated port reaches the Service from outside the cluster, even a node that isn't currently running any of the backing Pods. To reduce the odds of two people colliding when manually picking a NodePort, the overall range is split into a smaller band reserved for manual assignment and a larger band that automatic allocation draws from first.",
      },
      {
        title: 'LoadBalancer: handing external exposure to a cloud provider',
        body: "A Service of type LoadBalancer asks whatever load-balancing integration the cluster has configured — typically a cloud provider's controller — to provision an external load balancer in front of the Service; because that provisioning happens asynchronously, the resulting external address only shows up in the Service's status once the balancer is actually ready. Under the hood, Kubernetes usually sets this up the same way it would a NodePort Service first, then configures the external balancer to forward onto that allocated node port, though a dedicated field can turn that node-port allocation off for balancer implementations that route straight to Pods instead. A Service can also name a non-default load-balancer class to hand its provisioning to an alternate implementation, useful when a cluster wants something other than whatever the cloud provider offers out of the box.",
      },
      {
        title: 'EndpointSlices: how a Service knows which Pods are ready',
        body: "Behind every selector-based Service, a controller continuously watches for matching Pods and keeps a set of EndpointSlice objects current to reflect them; each EndpointSlice covers a subset of a Service's backing addresses, and Kubernetes starts a new one automatically once the existing slices fill up, by default once each holds around a hundred endpoints. EndpointSlices superseded the older, singular Endpoints API, which had no way to represent dual-stack addressing and would silently truncate its list once a Service passed a thousand backing endpoints. A Service defined without a selector skips this automatic tracking entirely, which is exactly what lets it front an external database or a workload running outside the cluster — in that case, someone has to create matching EndpointSlice objects by hand, tagged with the Service's name, to tell Kubernetes where traffic should actually go.",
      },
    ],
  },
  {
    domain: 'services',
    taskStatement: 'Ingress, the Gateway API, and CoreDNS',
    topics: [
      {
        title: 'The Ingress resource: host- and path-based routing rules',
        body: "An Ingress is an API object that maps incoming HTTP and HTTPS requests to backend Services based on rules an administrator defines, matching on the request's host header and URL path; a rule with no host at all simply applies to any inbound request that doesn't match a more specific rule. Each path in a rule declares a path type — Exact for a case-sensitive full match, Prefix for an element-by-element prefix match, or ImplementationSpecific, whose matching behavior is left to the controller handling it — and when several paths in an Ingress could match the same request, the longest matching path wins, with an Exact match beating a Prefix match at equal length. Because Ingress only understands HTTP(S) semantics, any other protocol a workload needs exposed externally still has to go through a NodePort or LoadBalancer Service instead.",
      },
      {
        title: 'Ingress controllers and IngressClass tie a rule set to an implementation',
        body: "An Ingress resource by itself does nothing — some ingress controller has to be running in the cluster to actually watch for Ingress objects and program a load balancer or proxy to match, and a cluster can run more than one controller side by side as long as each Ingress states which one it wants. That linkage runs through IngressClass: each Ingress can reference an IngressClass object by name, which in turn names the controller responsible for it and can carry additional controller-specific settings; this replaced an older, informally defined annotation that served the same purpose before IngressClass existed. Marking one IngressClass as the cluster's default, through an annotation on that IngressClass, means any Ingress created without an explicit class reference automatically picks it up, though a cluster with more than one IngressClass marked default will instead have new, class-less Ingress creation blocked until the ambiguity is resolved.",
      },
      {
        title: 'TLS termination at the Ingress and the limits of its load balancing',
        body: "Securing an Ingress means pointing its TLS configuration at a Secret holding a certificate and private key pair; the Ingress terminates TLS right there, so everything beyond that point — the hop from Ingress to Service, and onward to the backing Pods — travels as plaintext, and because the resource only supports one TLS-secured port — 443 — multiple hostnames on one Ingress get multiplexed onto that single port using server name indication. Ingress controllers ship with their own baseline load-balancing behavior — algorithm choice, backend weighting, and so on — applied uniformly across every Ingress they manage, and Ingress itself has no field for more advanced needs like sticky sessions or dynamically adjusted weights; those have to come from the underlying Service's own load balancer or from controller-specific configuration instead. Because implementations vary quite a bit in how thoroughly they support TLS and these extra behaviors, checking a chosen controller's own documentation matters before relying on any of it.",
      },
      {
        title: 'The Gateway API: role-oriented successor to Ingress',
        body: "Gateway API is a separate, CRD-based family of resources that the Kubernetes project now recommends over Ingress for exposing network services, built around four stable kinds: GatewayClass names the controller implementation, a Gateway is a concrete instance of traffic-handling infrastructure — a cloud-provisioned load balancer or a proxy server living inside the cluster — that references a GatewayClass and defines listeners, and HTTPRoute or GRPCRoute objects then attach to a Gateway's listeners to describe how matching requests get forwarded to backend Services. Its design deliberately splits configuration along organizational lines — an infrastructure provider manages the GatewayClass, a cluster operator manages Gateways, and an application developer manages the routes attached to them — and a Gateway admits routes only from its own namespace unless its allowedRoutes configuration is explicitly opened up to others. Because Gateway API has no Ingress kind of its own, moving away from Ingress means a one-time conversion of existing rules into GatewayClass, Gateway, and route objects rather than a drop-in swap, though the payoff is native support for things like header-based matching and traffic-weight splitting that Ingress could only reach through vendor-specific annotations.",
      },
      {
        title: "CoreDNS and the cluster's Service and Pod naming scheme",
        body: "CoreDNS, or whatever cluster-aware DNS add-on is deployed, watches the API server for Services and Pods and keeps a matching set of DNS records current, so a Service named my-service in namespace my-ns becomes resolvable as my-service.my-ns from anywhere in the cluster, or as the bare name my-service from within that same namespace thanks to each Pod's DNS search list. An ordinary Service resolves to its cluster address, while a headless Service, or one backed by a named port, can also be queried for an SRV record to look up a specific port by name rather than a hard-coded number. Because an unqualified query gets expanded against that per-Pod search list before it's sent, a lookup for just a bare service name inside one namespace only succeeds if a matching Service exists in that same namespace — reaching a same-named Service in a different namespace requires spelling out the namespace explicitly in the query.",
      },
      {
        title: 'Pod DNS policy: choosing where name resolution comes from',
        body: "Every Pod carries a dnsPolicy field that decides where its resolver configuration comes from, and there's a naming gotcha built in: leaving the field unset does not select the policy literally called Default — that one instead inherits whatever resolver configuration the Pod's own node happens to use — but rather ClusterFirst, the policy that actually routes ordinary lookups through the cluster's own DNS. Under ClusterFirst, any query that doesn't match the cluster's own domain suffix gets forwarded upstream by the cluster DNS server, while ClusterFirstWithHostNet exists specifically for Pods that set hostNetwork to true, since without it such a Pod would silently fall back to Default-style resolution instead of using the cluster's DNS. Setting dnsPolicy to None hands full control to the Pod's own dnsConfig block, where custom nameservers, search domains, and resolver options can be listed explicitly — a Pod configured this way must supply at least one nameserver itself, since nothing is inherited automatically.",
      },
    ],
  },
];
