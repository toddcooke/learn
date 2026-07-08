// js/data/studyContent.js
// Study notes for the Cluster Architecture, Installation and Configuration
// domain (25% exam weight). Grounded in kubernetes.io and helm.sh
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
        body: "RBAC enforces a check at the API layer — active even when the RBAC authorizer itself isn't the one deciding a request — that stops a subject from granting more than it already has: creating or updating a Role or ClusterRole requires already holding every permission it contains at the same scope, and creating a binding to a role requires either already holding that role's permissions or explicit authorization to perform the escalate or bind verb against it. This closes the obvious loophole where a narrowly-scoped user could define a broader role and then bind it to themselves. The deliberate exception is bootstrapping: the very first roles and bindings on a brand-new cluster are created using a credential from the system:masters group, which the default bindings tie to the cluster-admin role, giving the initial administrator a starting point from which everything else can be granted.",
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
        body: "Every node destined for a kubeadm cluster needs a working container runtime already installed, since the kubelet has no way to start a Pod without one, plus full network connectivity to every other machine in the cluster. kubeadm's stated minimums are 2 GiB or more of RAM per machine and at least 2 CPUs on any host that will run as a control-plane node. Nodes take on one of two roles: a control-plane node hosts the cluster's control-plane services, including etcd — the cluster's backing datastore — and the API server that kubectl and every other client talks to, while a worker node is where ordinary application Pods actually get scheduled. kubeadm taints control-plane nodes by default so regular workloads land only on workers, reserving control-plane capacity for cluster management; that taint can be manually removed on small or single-machine setups where the separation isn't needed.",
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
];
