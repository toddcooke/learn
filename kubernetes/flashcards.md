# CKA — flashcards

109 cards. Exported to Anki by scripts/export-anki.mjs.
<!-- domains: Workloads & Scheduling | Cluster Architecture | Services & Networking | Storage | Troubleshooting -->

## Workloads & Scheduling

### `pod` · Pod

**What is a Pod?**

<details><summary>Answer</summary>

Kubernetes' smallest deployable unit: one or more containers that always land on the same node and share a network namespace (one IP, one port space) and any volumes attached to the Pod. Containers in the same Pod can reach each other over localhost.

</details>

### `replicaset` · ReplicaSet

**What does a ReplicaSet do?**

<details><summary>Answer</summary>

Watches a label selector and continuously creates or deletes Pods so the number of matching, running Pods stays at the replica count it was given. In normal use you don't create ReplicaSets directly — a Deployment creates and owns them for you.

</details>

### `deployment` · Deployment

**What does a Deployment manage, and how?**

<details><summary>Answer</summary>

A stateless workload, by owning a chain of ReplicaSets rather than Pods directly. Changing the Pod template creates a fresh ReplicaSet and shifts replicas from the old one to the new one at a controlled pace, which is what makes rollout, pause/resume, and rollback to a prior revision possible.

</details>

### `deployment-rolling-update` · Deployment

**What do maxUnavailable and maxSurge each control during a rolling update?**

<details><summary>Answer</summary>

maxUnavailable is the largest number (or percentage) of desired replicas allowed to be missing at once while old Pods are torn down; maxSurge is the largest number (or percentage) of Pods allowed above the desired count while new ones are being added; both default to 25%. Together they set how fast the old ReplicaSet drains as the new one fills in.

</details>

### `kubectl-rollout` · Deployment Rollout

**Which kubectl rollout subcommands manage a Deployment's rollout?**

<details><summary>Answer</summary>

kubectl rollout status (watch progress; its exit code reports rollout success or failure), history (list revisions; --revision=N for details), undo (roll back to the previous revision, or --to-revision=N for a specific one), pause/resume (batch several Pod-template edits into a single rollout), and restart (trigger a fresh rolling update without editing your spec — it stamps a restartedAt annotation into the Pod template, e.g. to re-pull images or reload mounted config).

</details>

### `daemonset` · DaemonSet

**What is a DaemonSet used for?**

<details><summary>Answer</summary>

Runs exactly one copy of a Pod on every node that matches its selector, automatically adding the Pod as new nodes join and cleaning it up as nodes leave. Typical uses: a per-node log shipper, metrics agent, or networking/storage plugin daemon.

</details>

### `daemonset-tolerations` · DaemonSet Scheduling

**Why can a DaemonSet's Pods land on a cordoned or not-yet-Ready node when ordinary Pods can't?**

<details><summary>Answer</summary>

The DaemonSet controller automatically adds tolerations for node conditions — not-ready and unreachable (NoExecute, so the Pods also aren't evicted), plus disk-pressure, memory-pressure, pid-pressure, and unschedulable (NoSchedule). This lets critical node-level agents like a CNI plugin start on a node that can't become Ready until they're running — breaking the chicken-and-egg deadlock.

</details>

### `statefulset` · StatefulSet

**How is a StatefulSet different from a Deployment?**

<details><summary>Answer</summary>

Its Pods are not interchangeable: each gets a stable ordinal name, network identity, and (usually) its own PersistentVolumeClaim that follow it across rescheduling, and StatefulSets can enforce ordered, one-at-a-time startup and scaling. Use it when an app needs durable per-instance identity or storage rather than uniform, disposable replicas. Its stable hostnames require a headless Service (clusterIP: None) named by spec.serviceName — the StatefulSet never creates that Service itself.

</details>

### `job` · Job

**How does a Job differ from a Deployment or ReplicaSet?**

<details><summary>Answer</summary>

A Job runs Pods to completion rather than indefinitely: it retries failed or deleted Pods until enough finish successfully, then stops on its own — or gives up and marks itself Failed after spec.backoffLimit retries (default 6). Deployments and ReplicaSets instead keep a fixed number of Pods running forever.

</details>

### `job-completion-modes` · Job

**The Kubernetes docs describe three patterns for how a Job runs its Pods to completion — name them.**

<details><summary>Answer</summary>

Non-parallel (a single Pod, retried until it succeeds), fixed completion count (spec.completions Pods must each succeed for the Job to finish, optionally each getting a distinct index), and work queue (no spec.completions set; Pods pull tasks from a shared queue and coordinate among themselves to detect when the whole Job is done).

</details>

### `job-failure-mechanics` · Job

**How do a Job's backoffLimit and activeDeadlineSeconds interact when both are set, and which restartPolicy values may its Pod template use?**

<details><summary>Answer</summary>

restartPolicy must be Never or OnFailure — Always, the default elsewhere, is invalid for a Job. Failed Pods are retried with a doubling back-off delay (10s, 20s, 40s...) capped at six minutes until backoffLimit (default 6) is exceeded — but activeDeadlineSeconds takes precedence: once that wall-clock deadline hits, all running Pods are terminated and the Job is marked Failed with reason DeadlineExceeded, even with retries left.

</details>

### `cronjob` · CronJob

**What does a CronJob add on top of a Job?**

<details><summary>Answer</summary>

Creates a new Job on a repeating cron-formatted schedule, the way one line of a crontab does. Its concurrencyPolicy decides what happens if the previous run is still going when the next one is due: Allow (default) runs them side by side, Forbid skips the new one, Replace kills the old run and starts the new one.

</details>

### `init-containers` · Init Containers

**How do init containers behave differently from app containers?**

<details><summary>Answer</summary>

They run one at a time, in the order listed, each to successful completion before any app container starts — used for setup like waiting on a dependency or preparing a volume. If one fails, the kubelet restarts it until it succeeds (unless the Pod's restartPolicy is Never, in which case the whole Pod is marked Failed), and Pod status shows Init:N/M while they run.

</details>

### `sidecar-containers` · Sidecar Containers

**What is a native sidecar container?**

<details><summary>Answer</summary>

An init container with restartPolicy: Always — stable since Kubernetes 1.33 (on by default since 1.29). It starts before the app containers but, unlike a plain init container, does not have to run to completion: it keeps running alongside them for the Pod's whole life (log shippers, proxies), is restarted if it dies, and is terminated only after the app containers stop on shutdown. In a Job, a running sidecar does not block completion.

</details>

### `taints-tolerations` · Taints and Tolerations

**How do taints and tolerations work together?**

<details><summary>Answer</summary>

A taint on a node repels Pods that don't tolerate it; a toleration on a Pod lets it be scheduled onto (or stay on) a tainted node. NoSchedule blocks new scheduling, PreferNoSchedule is a soft version the scheduler tries to honor, and NoExecute also evicts already-running Pods that lack a matching toleration.

</details>

### `node-affinity` · Node Affinity

**How does node affinity compare to a plain nodeSelector?**

<details><summary>Answer</summary>

nodeSelector is an exact-match label filter on the Pod spec. Node affinity is more expressive: it supports operators like In, NotIn, and Exists, plus two flavors — requiredDuringSchedulingIgnoredDuringExecution (a hard requirement) and preferredDuringSchedulingIgnoredDuringExecution (a weighted preference the scheduler tries to satisfy but won't block on).

</details>

### `pod-affinity-anti-affinity` · Pod Affinity & Anti-Affinity

**What do Pod affinity and anti-affinity schedule against that node affinity cannot?**

<details><summary>Answer</summary>

The labels of other Pods rather than of nodes, evaluated within a topology domain named by topologyKey (e.g. kubernetes.io/hostname or a zone label) — anti-affinity is the standard way to spread an app's replicas across nodes or zones; both come in required and preferred flavors like node affinity. For even distribution with a tolerated imbalance, topologySpreadConstraints (maxSkew + topologyKey) is the dedicated alternative.

</details>

### `priorityclass` · PriorityClass

**What does a PriorityClass do?**

<details><summary>Answer</summary>

A cluster-scoped object mapping a name to an integer priority; a Pod opts in via spec.priorityClassName. When a higher-priority Pod cannot be scheduled, the scheduler may preempt (evict) lower-priority Pods to make room, and higher-priority Pods also sit ahead in the scheduling queue (a PriorityClass with preemptionPolicy: Never keeps the queue benefit without evicting anything).

</details>

### `configmap` · ConfigMap

**What is a ConfigMap for?**

<details><summary>Answer</summary>

Holds non-sensitive configuration as key-value pairs, decoupling config from the container image so the same image can run with different settings. A container can pick it up as an injected env var, a CLI flag value, a mounted file inside a volume, or a direct read through the API.

</details>

### `configmap-create-consume` · ConfigMap

**How do you create a ConfigMap imperatively with kubectl, and how does consuming it via envFrom differ from a volume mount when the ConfigMap is later updated?**

<details><summary>Answer</summary>

kubectl create configmap `<name>` takes three data sources: --from-literal=key=value, --from-file=`<file-or-directory>`, and --from-env-file=`<file>`. envFrom (configMapRef) injects every key as an env var, captured once at container start — changes need a Pod restart (kubectl rollout restart for Deployments). A volume mount surfaces each key as a file the kubelet refreshes after its sync period plus cache-propagation delay — except subPath mounts, which never update. A ConfigMap marked immutable: true cannot be changed at all: delete and recreate it (and its consumer Pods). A single ConfigMap is capped at 1 MiB.

</details>

### `secret` · Secret

**How does a Secret differ from a ConfigMap in practice?**

<details><summary>Answer</summary>

Structurally almost identical, but meant for sensitive values — Kubernetes only base64-encodes Secret data, which is obfuscation rather than encryption unless encryption at rest is separately configured. Built-in types standardize common cases: kubernetes.io/tls, kubernetes.io/dockerconfigjson, kubernetes.io/basic-auth, and the now-legacy kubernetes.io/service-account-token among them.

</details>

### `limitrange` · LimitRange

**What does a LimitRange enforce that ResourceQuota does not?**

<details><summary>Answer</summary>

Per-object constraints within a namespace — minimum and maximum CPU/memory for a single Pod or container, a default request/limit auto-injected when a container omits one, and a bound on the ratio between limit and request. ResourceQuota instead caps the namespace's aggregate consumption across all objects combined.

</details>

### `resourcequota` · ResourceQuota

**What can a ResourceQuota restrict?**

<details><summary>Answer</summary>

Total resource consumption across an entire namespace: aggregate CPU/memory requests and limits, storage requested (overall or per StorageClass), and raw object counts like count/pods or count/secrets. Quota is enforced at admission on the object that consumes it: a Pod (or PVC) that would push the namespace over any hard limit is rejected with 403 Forbidden — but creating an owning Deployment still succeeds; its Pods then fail admission and the ReplicaSet reports the errors. Once a quota covers cpu or memory, every new Pod must declare a request or limit for that resource (a LimitRange can supply defaults), and scopeSelector can narrow a quota to a subset of Pods, such as only BestEffort ones.

</details>

### `pod-disruption-budget` · PodDisruptionBudget

**What does a PodDisruptionBudget protect against?**

<details><summary>Answer</summary>

Voluntary disruptions only — things like a node drain or cluster-autoscaler defragmentation, not a hardware failure. It sets a floor (minAvailable) or ceiling (maxUnavailable) on how many of an app's Pods can be evicted at once through the Eviction API, which tools like kubectl drain are expected to call rather than deleting Pods directly.

</details>

### `image-pull-secrets` · ImagePullSecrets

**What is imagePullSecrets for, and how can it be applied once to cover many Pods instead of being repeated on each one?**

<details><summary>Answer</summary>

It tells the kubelet which registry-credential Secret to use when pulling a private container image for a Pod. Rather than repeating the reference on every Pod, the same imagePullSecrets entry can be attached once to a ServiceAccount so every Pod created under that ServiceAccount inherits it automatically.

</details>

### `hpa` · HorizontalPodAutoscaler

**What does a HorizontalPodAutoscaler do?**

<details><summary>Answer</summary>

Watches a metric (commonly CPU or memory utilization) and adjusts spec.replicas on a scalable workload resource — a Deployment or StatefulSet, for example — up or down to keep the metric near its target.

</details>

### `hpa-daemonset-exception` · HorizontalPodAutoscaler

**Why can't a HorizontalPodAutoscaler target a DaemonSet?**

<details><summary>Answer</summary>

Because a DaemonSet's Pod count is fixed by the number of matching nodes, not a replica field, there's nothing for the HPA to adjust — a DaemonSet doesn't implement the scale subresource the HPA acts through.

</details>

### `hpa-scaling-formula` · HorizontalPodAutoscaler

**What formula does the HorizontalPodAutoscaler use to compute how many replicas a workload should have?**

<details><summary>Answer</summary>

desiredReplicas = ceil(currentReplicas x currentMetricValue / desiredMetricValue) — Pods averaging 200m against a 100m target double the count. Ratios within a tolerance band (10% by default) are treated as noise and trigger no scaling, which prevents thrashing on marginal fluctuations.

</details>

### `hpa-spec-replicas-removal` · HorizontalPodAutoscaler

**After putting a Deployment under an HPA, why does the documentation say to delete spec.replicas from the Deployment's manifest?**

<details><summary>Answer</summary>

Because every kubectl apply of a manifest that still hardcodes spec.replicas silently resets the Pod count to that stale value, overriding whatever count the HPA had converged on and reintroducing the flapping the HPA's smoothing exists to prevent.

</details>

### `resource-requests` · Resource Requests

**What does a container resource request actually do?**

<details><summary>Answer</summary>

Tells the scheduler how much CPU and memory a container needs, and the scheduler only places a Pod on a node that has that much unallocated capacity. Requests don't cap how much a container can actually use at runtime — that's the job of a limit.

</details>

### `resource-limits` · Resource Limits

**How are CPU limits enforced differently from memory limits?**

<details><summary>Answer</summary>

A CPU limit is enforced proactively by throttling — a hard ceiling the container cannot exceed, though it keeps running when it hits it. A memory limit is enforced reactively: a container can transiently exceed it, and the kernel only steps in with an OOM kill (OOMKilled) once it actually detects memory pressure, since memory usage can't be throttled back the way CPU time can.

</details>

### `qos-classes` · Pod QoS Class

**What determines whether a Pod is Guaranteed, Burstable, or BestEffort?**

<details><summary>Answer</summary>

Guaranteed means every container sets a request and a limit for both CPU and memory, with the request equal to the limit in each case. Burstable means at least one container sets some request or limit, but the Pod doesn't meet the stricter Guaranteed bar. BestEffort means no container sets any request or limit at all — these are first in line to be killed for memory during resource pressure.

</details>

### `liveness-probe` · Liveness Probe

**What action does a failing liveness probe trigger?**

<details><summary>Answer</summary>

A container restart. Liveness probes exist to catch an app that's still running as a process but has locked up or otherwise stopped making progress — the kind of broken state a restart, not more traffic-shaping, is the actual fix for.

</details>

### `readiness-probe` · Readiness Probe

**What does a failing readiness probe do — and what does it not do?**

<details><summary>Answer</summary>

It removes the Pod from the Endpoints/EndpointSlices backing its Services, so it stops receiving traffic through them, without restarting the container or otherwise touching the Pod. It's the right tool for a Pod that's temporarily unable to serve requests, such as one still loading a large dataset at startup.

</details>

### `startup-probe` · Startup Probe

**Why add a startup probe alongside a liveness probe?**

<details><summary>Answer</summary>

It gives a slow-starting container a longer grace period — the kubelet holds off on running the liveness (and readiness) probe until the startup probe first succeeds — so a container isn't killed for still being mid-boot under a liveness probe timing tuned for steady-state failures instead.

</details>

## Cluster Architecture

### `namespace` · Namespace

**What does a Namespace scope?**

<details><summary>Answer</summary>

Provides a scope for object names — two Deployments named 'web' can coexist in different namespaces — and a boundary that ResourceQuotas and RBAC bindings can apply to.

</details>

### `namespace-scope-exceptions` · Namespace

**What kinds of Kubernetes objects live outside any Namespace?**

<details><summary>Answer</summary>

Cluster-scoped objects: Nodes, PersistentVolumes, StorageClasses, ClusterRoles, and Namespaces themselves, among others. Namespace scoping only applies to namespaced objects — cluster-scoped ones exist outside every namespace regardless of your current namespace. List them with kubectl api-resources --namespaced=false.

</details>

### `static-pod` · Static Pod

**What makes a static Pod different from an ordinary Pod?**

<details><summary>Answer</summary>

A kubelet on one specific node manages it directly from a manifest file on that node's disk, without the API server scheduling it. The kubelet reports a read-only mirror Pod to the API server so it's visible via kubectl, but deleting that mirror through kubectl does not stop the real static Pod — only editing or removing the manifest file does.

</details>

### `role` · Role

**What can a Role grant, and where?**

<details><summary>Answer</summary>

A namespaced set of RBAC rules (API group, resource, and verbs like get/list/create/delete) that only grants permissions on resources inside the one namespace it was created in. Nodes and other objects that live outside every namespace are simply out of its reach, no matter how the rule is written.

</details>

### `rolebinding` · RoleBinding

**What does a RoleBinding do, and can it reference a ClusterRole?**

<details><summary>Answer</summary>

Grants the permissions of a Role or ClusterRole to one or more subjects — a user, a group, a ServiceAccount, any mix of the three. Yes — a RoleBinding can point at a ClusterRole, but the grant still only applies within the RoleBinding's own namespace, which is the standard way to reuse one shared set of rules across many namespaces without redefining it.

</details>

### `clusterrole` · ClusterRole

**When is a ClusterRole required instead of a Role?**

<details><summary>Answer</summary>

When the permission needs to cover resources that exist outside any namespace (Nodes, PersistentVolumes), non-resource API paths like /healthz, or a namespace-scoped resource across every namespace at once — none of which a plain Role can express.

</details>

### `clusterrolebinding` · ClusterRoleBinding

**How does a ClusterRoleBinding differ from a RoleBinding?**

<details><summary>Answer</summary>

It grants its referenced ClusterRole to its subjects everywhere in the cluster at once, with no namespace boundary — unlike a RoleBinding, which always confines the grant to the one namespace it lives in even when it points at a ClusterRole.

</details>

### `default-clusterroles` · Default ClusterRoles

**Which four user-facing ClusterRoles ship with Kubernetes, and why does view exclude Secrets?**

<details><summary>Answer</summary>

cluster-admin (super-user; bound cluster-wide it allows any action anywhere), admin and edit (broad namespace read/write via a RoleBinding; only admin can manage roles and bindings), and view (namespace read-only). view deliberately withholds Secrets: reading a Secret can expose ServiceAccount credentials, letting the reader act as any ServiceAccount in the namespace — a privilege-escalation path.

</details>

### `rbac-escalation-guards` · RBAC Escalation Guards

**What stops a user from creating a Role broader than their own access, and can a binding's roleRef be edited afterward?**

<details><summary>Answer</summary>

Two API-level gates: creating or updating a Role/ClusterRole requires already holding every permission it contains at the same scope, or explicit authorization for the escalate verb on roles/clusterroles; creating or updating a binding requires already holding the referenced role's permissions, or the bind verb on that specific role. A binding's roleRef is immutable — changing it triggers a validation error, so swapping roles means deleting the binding and creating a replacement (only the subjects list stays editable).

</details>

### `serviceaccount` · Pod Identity

**What identity does a Pod use to call the Kubernetes API?**

<details><summary>Answer</summary>

A ServiceAccount, not a human user account — every Pod runs under one, falling back to its namespace's 'default' ServiceAccount if none is specified. By default a ServiceAccount outside kube-system has no permissions beyond basic discovery, so anything a workload needs must be granted through an explicit RoleBinding or ClusterRoleBinding, ideally one dedicated ServiceAccount per application rather than a shared default.

</details>

### `serviceaccount-tokens` · ServiceAccount Tokens

**Since v1.22, how should a workload obtain a ServiceAccount credential, and where do service-account-token Secrets fit?**

<details><summary>Answer</summary>

Through the TokenRequest API — a short-lived, auto-rotating token the kubelet mounts into the Pod via a projected volume, or one minted on demand with kubectl create token `<sa-name>`, the standard way to test RBAC as a ServiceAccount. A manually created kubernetes.io/service-account-token Secret is a legacy, non-expiring credential reserved for cases where TokenRequest genuinely can't be used.

</details>

### `admission-controllers` · Admission Controller

**When does an admission controller run, and what can it do?**

<details><summary>Answer</summary>

It intercepts a create, update, or delete request after authentication and authorization succeed but before the object is persisted to etcd. Mutating admission controllers can modify the request (like injecting a default value); validating ones can only accept or reject it — they can never affect plain read requests like get, list, or watch.

</details>

### `kube-apiserver` · kube-apiserver

**What role does the kube-apiserver play in the control plane?**

<details><summary>Answer</summary>

The front door of the cluster: it exposes the Kubernetes HTTP API that every other component and every kubectl command goes through, handling authentication, authorization, and admission before reading or writing state, all of which it persists to etcd.

</details>

### `etcd` · etcd

**What is etcd, and why does it matter for cluster availability?**

<details><summary>Answer</summary>

The consistent, highly-available key-value store that holds all of the API server's data — every object in the cluster ultimately lives there. Because it's the cluster's single source of truth, an HA control plane needs etcd to survive a control-plane node failure, whether that's a stacked etcd member on each control-plane node or an external etcd cluster.

</details>

### `etcd-backup` · etcd Backup

**How do you back up etcd?**

<details><summary>Answer</summary>

etcdctl snapshot save `<file>` against the etcd endpoint, authenticating with --endpoints, --cacert, --cert, and --key (the cert paths — typically under /etc/kubernetes/pki/etcd/ — are readable from the etcd static-Pod manifest); verify with etcdutl snapshot status (the etcdctl status/restore subcommands are deprecated). kubeadm keeps etcd's data at /var/lib/etcd by default, and kubeadm upgrade automatically backs up etcd and the static-Pod manifests under /etc/kubernetes/tmp before proceeding.

</details>

### `etcd-restore` · etcd Restore

**How do you restore an etcd snapshot on a kubeadm cluster?**

<details><summary>Answer</summary>

etcdutl snapshot restore `<file>` --data-dir `<new-dir>` (etcdutl replaced the deprecated etcdctl restore subcommand), then point the etcd static-Pod manifest's hostPath volume at the new directory — the kubelet recreates the etcd Pod and the API server comes back reading the restored state. The docs recommend restoring while API server instances are stopped and restarting control-plane components afterward so nothing relies on stale state. Backups matter most on a single-control-plane cluster, where the one etcd data directory is the cluster's entire state.

</details>

### `kube-scheduler` · kube-scheduler

**What does kube-scheduler decide?**

<details><summary>Answer</summary>

Which node an unbound Pod should run on. It watches for newly created Pods that have no node assigned yet and picks a suitable node for each one, taking constraints like resource requests, taints and tolerations, and affinity rules into account.

</details>

### `kube-controller-manager` · kube-controller-manager

**What runs inside kube-controller-manager?**

<details><summary>Answer</summary>

A bundle of separate control loops — including the ones behind ReplicaSet, Deployment, Job, and Node lifecycle behavior — each watching the cluster's actual state and driving it toward whatever is declared, compiled into a single control-plane process for operational simplicity.

</details>

### `cloud-controller-manager` · cloud-controller-manager

**What does the (optional) cloud-controller-manager do?**

<details><summary>Answer</summary>

Integrates the cluster with an underlying cloud provider, handling things a self-managed cluster can't do on its own — provisioning a LoadBalancer Service's external load balancer, or labeling and assigning addresses to Nodes based on cloud metadata, for example.

</details>

### `kubelet` · kubelet

**What is the kubelet's job on a node?**

<details><summary>Answer</summary>

Makes sure the containers described in every Pod assigned to its node are actually running and healthy, talking to the container runtime through the CRI to start and stop them. It's one of the few components that runs directly on the node rather than inside a container, and it's also what runs static Pods from local manifest files.

</details>

### `kubeadm` · kubeadm

**What do kubeadm init and kubeadm join each set up, and what must you deploy afterward before CoreDNS leaves Pending and nodes go Ready?**

<details><summary>Answer</summary>

Bootstraps a minimum-viable, best-practice cluster: kubeadm init brings up a brand-new control-plane node and kubeadm join enrolls workers or extra control-plane nodes into that cluster afterward. Setting up Pod networking is left to the operator, so CoreDNS stays Pending and nodes stay NotReady until a CNI plugin is deployed separately.

</details>

### `kubeadm-prerequisites` · Cluster Prerequisites

**What must be prepared on a Linux host before running kubeadm init or join?**

<details><summary>Answer</summary>

A CRI-compatible container runtime (such as containerd) installed and running; swap disabled — or the kubelet explicitly configured to tolerate it (failSwapOn: false); IPv4 forwarding enabled (net.ipv4.ip_forward=1; many CNI setups additionally need the br_netfilter kernel module so iptables sees bridged traffic, and container runtimes typically need the overlay module for OverlayFS); required ports open (6443 API server, 2379-2380 etcd, 10250 kubelet); a unique hostname, MAC address, and product_uuid per node; and the kubeadm, kubelet, and kubectl packages installed at matching versions.

</details>

### `kubeadm-upgrade` · Cluster Upgrades

**What is the order of operations for upgrading a kubeadm cluster one minor version?**

<details><summary>Answer</summary>

Upgrade the kubeadm package first, then run kubeadm upgrade plan and kubeadm upgrade apply v1.x.y on the first control-plane node; every other node (remaining control-plane nodes and workers) runs kubeadm upgrade node instead. Then for each node in turn: kubectl drain it, upgrade the kubelet and kubectl packages, restart the kubelet, and kubectl uncordon. The control plane always upgrades before workers, one minor version at a time — skipping minor versions is unsupported.

</details>

### `version-skew-policy` · Version Skew Policy

**What version skew is allowed between the kubelet and the API server?**

<details><summary>Answer</summary>

The kubelet may be up to three minor versions older than kube-apiserver (widened from two in Kubernetes 1.28), but never newer than it — which is why the control plane always upgrades before worker kubelets.

</details>

### `ha-control-plane-endpoint` · HA Control Plane

**What does an HA kubeadm control plane need in front of its API servers, and how are extra control-plane nodes added?**

<details><summary>Answer</summary>

A stable shared endpoint — a load balancer address or DNS name passed as --control-plane-endpoint at kubeadm init, so kubeconfigs and kubelets never pin to one node's IP. Additional control-plane nodes then run kubeadm join --control-plane --certificate-key `<key>` (the key decrypts the CA certificates that init --upload-certs stored in the cluster), each bringing up its own apiserver, scheduler, and controller-manager, with the schedulers and controller-managers using leader election so only one of each is active.

</details>

### `ha-endpoint-day-one` · HA Control Plane

**Why should kubeadm init be given --control-plane-endpoint even on a cluster that starts with one control-plane node?**

<details><summary>Answer</summary>

That flag gives every future control-plane node one stable DNS name or load-balancer address from day one. kubeadm has no supported path to retrofit it: a cluster bootstrapped without a shared control-plane endpoint cannot later be converted into a highly-available one.

</details>

### `control-plane-manifests` · Static Pod Manifests

**Where do control-plane component manifests live on a kubeadm cluster, and what happens when you edit one?**

<details><summary>Answer</summary>

In /etc/kubernetes/manifests (kube-apiserver, kube-controller-manager, kube-scheduler, etcd) as static-Pod manifests. The kubelet periodically rescans that directory (staticPodPath) and recreates the component with the new settings when a file changes — no kubectl needed — but a syntax or flag error there leaves the component down until you fix the file.

</details>

### `kubeadm-cert-renewal` · kubeadm Certificates

**How do you check and renew kubeadm-managed certificates?**

<details><summary>Answer</summary>

kubeadm certs check-expiration lists each certificate with its expiry; kubeadm certs renew all (or a named cert) renews them, after which the control-plane components must be restarted to pick the new certs up. kubeadm upgrade also renews all certificates as a side effect, so clusters upgraded at least yearly never hit the 1-year client-cert expiry.

</details>

### `cri` · CRI (Container Runtime Interface)

**What problem does the CRI solve?**

<details><summary>Answer</summary>

It's the gRPC-based plugin interface between the kubelet and a container runtime, letting Kubernetes support multiple runtimes (containerd, CRI-O, and others) without runtime-specific code baked into the kubelet itself. Every node needs a CRI-compatible runtime installed before its kubelet can start any Pods.

</details>

### `helm` · Helm

**What is a Helm chart, and what is a release?**

<details><summary>Answer</summary>

A chart bundles the resource templates and default configuration values needed to run an application, and is published to a repository a Helm client can search or add. Running helm install against a chart produces a release — a distinct, named, trackable installation that can be upgraded or rolled back on its own, and the same chart can be installed multiple times as separate releases.

</details>

### `helm-lifecycle` · Helm

**Which Helm commands cover the install-to-rollback lifecycle of a release?**

<details><summary>Answer</summary>

helm repo add then helm repo update to register and refresh chart repos, helm search repo to find charts in them, helm install `<release>` `<chart>` with -f values.yaml or --set key=value to override chart defaults (--set wins when combined), helm list to see deployed releases, helm upgrade --install to apply new values or chart versions (installing if the release doesn't exist yet), and helm rollback `<release>` [revision] to return to a prior revision — helm history `<release>` shows the numbered revisions, and helm uninstall removes the release.

</details>

### `kustomize` · Kustomize

**How does Kustomize customize manifests differently from Helm?**

<details><summary>Answer</summary>

It works from plain, unmodified Kubernetes YAML plus a kustomization.yaml that layers transformations on top — generating ConfigMaps/Secrets, adding common labels, or patching fields — rather than filling in a templating language. kubectl has had built-in support since v1.14 via kubectl apply -k, so no separate templating step or tool is required.

</details>

### `crd` · CustomResourceDefinition

**What does a CustomResourceDefinition let you do?**

<details><summary>Answer</summary>

Register a brand-new kind of API object — with its own schema, API group, and normal kubectl support — without writing and running a separate aggregated API server. On its own a custom resource is just structured data the API can store and retrieve; it needs a controller acting on it to do anything.

</details>

### `operator-pattern` · Operator Pattern

**What is the Operator pattern?**

<details><summary>Answer</summary>

Pairing a CustomResourceDefinition with a custom controller that watches instances of it and continuously drives the cluster toward whatever state they declare — turning that pair into a genuine declarative API. Operators typically encode operational knowledge for one specific piece of software (backups, failover, upgrades) as automation native to the cluster.

</details>

## Services & Networking

### `service-clusterip` · Service (ClusterIP)

**What does a ClusterIP Service provide, and what is a headless Service?**

<details><summary>Answer</summary>

The default Service type: a single stable virtual IP, internal to the cluster, that load-balances traffic across the Pods matching its selector even as those Pods are replaced. Setting clusterIP: None makes it headless — no virtual IP is allocated, and DNS lookups return the backing Pods' addresses directly instead.

</details>

### `service-nodeport` · Service (NodePort)

**How does a NodePort Service expose an application?**

<details><summary>Answer</summary>

It opens the same port on every node in the cluster (by default from the 30000-32767 range) and forwards traffic arriving on that port, on any node, to the Service — so a client can reach the app by hitting any node's IP on that port, without going through a cloud load balancer.

</details>

### `service-loadbalancer` · Service (LoadBalancer)

**What does a LoadBalancer Service depend on that ClusterIP and NodePort do not?**

<details><summary>Answer</summary>

It asks the cloud provider it's running on to provision an external load balancer pointed at the Service, giving it a stable external IP or hostname. Without a cloud provider integration configured, a LoadBalancer Service behaves like a NodePort and never gets that external address assigned.

</details>

### `endpointslices` · Service Backend Tracking

**What objects track the backend addresses of a Service, and what API did they supersede?**

<details><summary>Answer</summary>

EndpointSlices: the EndpointSlice controller maintains one or more per Service (a new slice starts past ~100 endpoints by default), each listing endpoint Pod IPs, ports, and ready/serving/terminating conditions — kube-proxy programs its rules from them and routes only to ready endpoints. They superseded the singular Endpoints API — now deprecated — which had no dual-stack support and truncated past 1000 endpoints (flagged only by an endpoints.kubernetes.io/over-capacity: truncated annotation). An empty slice is the signature of a selector/label mismatch.

</details>

### `ingress` · Ingress

**What does an Ingress resource define?**

<details><summary>Answer</summary>

HTTP/HTTPS routing rules — which incoming host and URL path should be sent to which backend Service — plus optional TLS termination, all in one object instead of one Service per hostname.

</details>

### `ingress-controller` · Ingress Controller

**What software actually implements an Ingress's rules, and how does an Ingress select which one handles it?**

<details><summary>Answer</summary>

Ingress is just a spec — Kubernetes ships no built-in implementation of it. An Ingress controller (a separate, chosen-by-you piece of software, often bundled with a reverse proxy) watches Ingress objects and actually programs a load balancer or proxy to match their rules; IngressClass names which controller a given Ingress belongs to.

</details>

### `gateway-api` · Gateway API

**How does the Gateway API differ from Ingress?**

<details><summary>Answer</summary>

It is a newer, role-oriented set of resources split across the people who configure infrastructure and the people who configure routing: a GatewayClass names the controller implementation, a Gateway represents a deployed listener bound to that class, and route resources like HTTPRoute attach traffic rules to a Gateway — a cleaner separation than the single, all-in-one Ingress object.

</details>

### `network-policy` · NetworkPolicy

**What does a NetworkPolicy control, and what is true before any policy is applied?**

<details><summary>Answer</summary>

Which ingress and/or egress traffic is allowed to/from a set of Pods, matched by podSelector, namespaceSelector, or ipBlock rules. Before any NetworkPolicy selects a Pod, all traffic to and from it is unrestricted — enforcement only begins once at least one policy applies, and it additionally requires a CNI plugin that implements NetworkPolicy.

</details>

### `network-policy-default-deny` · NetworkPolicy Patterns

**How do you write a namespace-wide default-deny NetworkPolicy, and what does a default-deny-egress policy silently break?**

<details><summary>Answer</summary>

A NetworkPolicy with podSelector: {} (selects every Pod in the namespace) and a policyType listed with no rules for that direction denies it by default — selected Pods then accept only traffic some other policy explicitly allows. A default-deny-egress policy also blocks DNS lookups, so the namespace needs a companion rule allowing egress to the cluster DNS service (kube-dns in kube-system) on port 53 over both UDP and TCP.

</details>

### `network-policy-selector-semantics` · NetworkPolicy Selectors

**In a NetworkPolicy ingress rule, what is the difference between namespaceSelector and podSelector as two list items versus combined in one item?**

<details><summary>Answer</summary>

As separate items in the from: list they are ORed — traffic matching either is allowed; combined in a single item they are ANDed — only Pods matching the podSelector inside namespaces matching the namespaceSelector are allowed. A misplaced dash changes the policy's meaning, and the same rule applies to the to: list in egress rules.

</details>

### `coredns` · CoreDNS

**How does CoreDNS end up running in a cluster, and what DNS name format does a Pod typically use to reach a Service through it?**

<details><summary>Answer</summary>

It's installed by default as the cluster DNS add-on — kubeadm deploys it during init as a Deployment in kube-system — and it answers name lookups so a Pod can reach a Service by name (typically `<service>`.`<namespace>`.svc.cluster.local) instead of tracking its virtual IP directly.

</details>

### `pod-dns-policy` · Pod DNS Policy

**What does a Pod's dnsPolicy field control?**

<details><summary>Answer</summary>

Where a Pod's containers get their DNS configuration from. ClusterFirst (the default) sends cluster-domain lookups to the cluster's DNS service and forwards everything else upstream; Default inherits the node's own resolv.conf; ClusterFirstWithHostNet is what hostNetwork Pods must set explicitly to keep using cluster DNS — left on ClusterFirst they silently fall back to Default behavior; None ignores all of these and requires dnsConfig to fully specify resolution by hand.

</details>

### `kube-proxy` · kube-proxy

**What does kube-proxy do, and in what modes?**

<details><summary>Answer</summary>

Runs on every node and programs that node's packet-forwarding rules so traffic sent to a Service's virtual IP actually reaches one of the matching backend Pods. On Linux it has three modes: iptables (the default; rules chained KUBE-SERVICES to KUBE-SVC to KUBE-SEP), nftables (GA since v1.33 and now the recommended mode, with the biggest wins in clusters with many Services), and IPVS, a kernel load-balancing hash table that is deprecated as of v1.35.

</details>

### `cni` · CNI (Container Network Interface)

**What role does a CNI plugin play, and does Kubernetes ship one?**

<details><summary>Answer</summary>

CNI plugins implement Kubernetes' Pod networking model — giving every Pod a routable IP and handling the interface setup that makes cross-node Pod communication work. Kubernetes bundles no default implementation at all; until a compatible CNI plugin is installed, Pods can't get addresses and cluster add-ons like CoreDNS stay stuck Pending.

</details>

## Storage

### `volume` · Volume

**What problem do Kubernetes volumes solve that a container's own filesystem does not?**

<details><summary>Answer</summary>

A container's own filesystem is wiped on every restart, and files can't easily be shared between containers in a Pod. A Volume is storage attached to the Pod rather than to any one container, so its contents survive container restarts and, depending on the volume type, can be shared across every container in the Pod.

</details>

### `emptydir-vs-hostpath` · emptyDir vs hostPath

**When do you use an emptyDir volume versus a hostPath volume?**

<details><summary>Answer</summary>

emptyDir: scratch space created empty when the Pod is assigned to a node, shared by all containers in the Pod, surviving container crashes but deleted permanently when the Pod is removed (medium: "Memory" mounts a RAM-backed tmpfs, whose files count against the writing container's memory limit). hostPath: mounts a file or directory from the node's own filesystem, so data outlives the Pod but is tied to that one node and is a security risk — use it for node-level agents (DaemonSets) or to back a manually created PersistentVolume on a single-node/practice cluster.

</details>

### `persistent-volume` · PersistentVolume

**What is a PersistentVolume, and how is it provisioned?**

<details><summary>Answer</summary>

A cluster-scoped storage resource representing an actual piece of underlying storage, independent of any Pod's lifecycle. It's provisioned either statically (an administrator creates the PV ahead of time) or dynamically (a StorageClass tells the cluster how to create one automatically when a claim needs it).

</details>

### `persistent-volume-claim` · PersistentVolumeClaim

**What is a PersistentVolumeClaim, and how does it relate to a PersistentVolume?**

<details><summary>Answer</summary>

A namespaced request for storage — a user asks for a size and access mode without needing to know the storage details — that the control plane binds to a matching PersistentVolume in an exclusive one-to-one pairing. A Pod then references the claim, not the volume, in its spec.

</details>

### `pv-access-modes` · PersistentVolume Access Modes

**Name the PersistentVolume access modes.**

<details><summary>Answer</summary>

ReadWriteOnce/RWO (one node at a time can mount it read-write — several Pods on that node can still share it), ReadOnlyMany/ROX (many nodes can mount it read-only), ReadWriteMany/RWX (many nodes can mount it read-write), and ReadWriteOncePod/RWOP, which restricts the mount to a single Pod cluster-wide. Access modes are matching criteria for binding a PVC to a PV, not enforced write protection — ReadWriteOncePod is the only mode Kubernetes actually enforces at mount time.

</details>

### `pv-reclaim-policy` · PV Lifecycle

**What happens to a PersistentVolume's storage after its claim is deleted?**

<details><summary>Answer</summary>

It depends on the reclaim policy: Retain keeps both the PV object and its underlying storage around for manual cleanup or reattachment; Delete removes the PV and its backing storage automatically (the default for most dynamically provisioned volumes); Recycle, which wiped and reused the volume, is deprecated in favor of dynamic provisioning.

</details>

### `storage-class` · StorageClass

**What does a StorageClass represent?**

<details><summary>Answer</summary>

A named storage profile an administrator publishes — pointing at a specific provisioner and its parameters — that PersistentVolumeClaims can request by name to get dynamically provisioned storage instead of waiting for a pre-created PV. Its volumeBindingMode can delay binding until a Pod using the claim is actually scheduled (WaitForFirstConsumer), which matters for storage tied to a particular zone or node.

</details>

### `csi` · CSI (Container Storage Interface)

**What does CSI let a storage vendor do?**

<details><summary>Answer</summary>

Ship a storage driver — handling provisioning, attaching, and mounting for their system — as an out-of-tree plugin that Pods consume through ordinary PersistentVolumeClaims, without that vendor's code needing to be compiled into Kubernetes itself. It replaced the older approach where storage integrations lived directly in the Kubernetes source tree.

</details>

## Troubleshooting

### `ephemeral-containers` · Ephemeral Container

**When would you reach for an ephemeral container instead of kubectl exec?**

<details><summary>Answer</summary>

When kubectl exec isn't an option — the target container has already crashed, or its image is distroless and has no shell to exec into. kubectl debug adds a temporary ephemeral container to the already-running Pod, giving you a shell without altering the original container image. Process namespace sharing is not automatic: add --target=`<container>` (requires container-runtime support) to join that container's process namespace so ps in the debug shell can see its processes.

</details>

### `metrics-server` · Metrics Server

**What is metrics-server, and what depends on it?**

<details><summary>Answer</summary>

A cluster add-on, not something built into Kubernetes core, that polls each kubelet's resource-usage endpoint and aggregates the results into the cluster's Metrics API. kubectl top, the HorizontalPodAutoscaler, and the VerticalPodAutoscaler all read from that API and simply don't work until metrics-server (or an equivalent) has been deployed.

</details>

### `pod-pending-triage` · Pod Triage

**A Pod is stuck Pending — what do you run first, and what are the usual causes?**

<details><summary>Answer</summary>

kubectl describe pod, and read the Events: FailedScheduling names what blocked placement — insufficient CPU or memory on every node, an untolerated taint, an unsatisfiable nodeSelector/affinity rule, an unbound PersistentVolumeClaim, or a hostPort no node has free. Pending means no node has accepted the Pod yet; fix the constraint or free capacity and the scheduler places it on its next pass.

</details>

### `crashloop-vs-imagepull` · Pod Triage

**CrashLoopBackOff vs ImagePullBackOff — what does each mean, and how do you investigate each?**

<details><summary>Answer</summary>

CrashLoopBackOff: the container starts and keeps exiting, and the kubelet is waiting out an increasing back-off before the next restart — investigate with kubectl logs --previous (-c `<container>` for multi-container Pods) to see why the last instance died. ImagePullBackOff: the container never starts because the image pull keeps failing — kubectl describe pod's Events show the cause: a bad image name or tag, missing or wrong imagePullSecrets, or an unreachable registry.

</details>

### `oomkilled-diagnosis` · Pod Triage

**How do you confirm a container was OOMKilled?**

<details><summary>Answer</summary>

kubectl describe pod: the container's Last State shows Terminated with Reason: OOMKilled and exit code 137. The fix is raising the memory limit or fixing the leak — otherwise the restart loop repeats as soon as usage hits the limit again.

</details>

### `pod-stuck-terminating` · Pod Triage

**A deleted Pod is stuck Terminating long past its grace period — what is the documented cause, and how do you confirm it?**

<details><summary>Answer</summary>

A finalizer on the Pod that the control plane cannot clear, typically because a Validating or Mutating webhook intercepting Pod UPDATE requests blocks the finalizer's removal — the webhook may be unreachable (with failurePolicy: Fail) or up but misbehaving, e.g. a mutating webhook changing immutable fields or a validating webhook rejecting Pods with pre-existing violations. Confirm by checking the Pod's metadata.finalizers and listing webhook configurations that target Pods (kubectl get validatingwebhookconfigurations,mutatingwebhookconfigurations).

</details>

### `container-logs` · Container Logs

**Where do container logs come from, and which kubectl logs flags matter most for troubleshooting?**

<details><summary>Answer</summary>

Containers write plain text to stdout/stderr; the runtime captures both via the CRI logging format into per-Pod files under /var/log/pods on the node, and kubectl logs retrieves them through the kubelet. Key flags: -f to follow, -c `<container>` (or --all-containers) for multi-container Pods, --previous for the prior instance's output — the standard way to see why a container crashed before restarting, -l `<selector>` across Pods, and --since/--tail to bound output.

</details>

### `container-log-rotation` · Log Rotation

**A chatty container has written 40Mi of logs but kubectl logs shows only the tail end. Why?**

<details><summary>Answer</summary>

The kubelet rotates container logs: containerLogMaxSize (default 10Mi) caps each file and containerLogMaxFiles (default 5) caps files kept per container, but only the contents of the latest, unrotated log file are available through kubectl logs — already-rotated output can't be retrieved that way, which is why longer retention requires shipping logs off-node (e.g. a DaemonSet logging agent).

</details>

### `component-log-locations` · Component Logs

**On a kubeadm control-plane node, why doesn't journalctl show kube-apiserver output, and where do you look instead?**

<details><summary>Answer</summary>

kubeadm runs the API server, scheduler, controller-manager, and etcd as static Pods, so their output is ordinary container logs — read with kubectl logs -n kube-system (or crictl logs / files under /var/log/pods if the API server itself is down). Only the kubelet and the container runtime run as host services, so they are what journalctl -u kubelet / -u containerd actually shows.

</details>

### `node-notready-triage` · Node Troubleshooting

**A node reports NotReady — what do you check, in order?**

<details><summary>Answer</summary>

kubectl describe node first, for conditions (Ready, MemoryPressure, DiskPressure, PIDPressure) and the last kubelet heartbeat; then on the node itself: systemctl status kubelet and journalctl -u kubelet for crashes, certificate, or config errors, plus a check that the container runtime is running and a CNI plugin is installed. kubectl debug node/`<name>` gives a host-namespace debugging Pod without SSH — but only if the kubelet can still run Pods, so a dead kubelet usually means SSH.

</details>

### `cordon-drain-uncordon` · Node Maintenance

**What do kubectl cordon, drain, and uncordon each do?**

<details><summary>Answer</summary>

cordon marks the node unschedulable; existing Pods keep running. drain cordons it, then evicts every Pod through the Eviction API, respecting PodDisruptionBudgets — it needs --ignore-daemonsets to proceed past DaemonSet Pods, --delete-emptydir-data for Pods using emptyDir volumes, and --force for bare Pods no controller manages. uncordon marks the node schedulable again after maintenance.

</details>

### `node-pressure-conditions` · Node Pressure Conditions

**What do the MemoryPressure and DiskPressure node conditions signal, and what do they trigger?**

<details><summary>Answer</summary>

The kubelet crossed an eviction threshold and begins node-pressure eviction, ignoring PodDisruptionBudgets and ranking Pods by whether usage exceeds requests, then priority, then how far usage exceeds requests — so BestEffort and over-request Burstable Pods go first (not strictly by QoS class). Each condition is also mirrored as a NoSchedule taint: DiskPressure blocks all new Pods, while MemoryPressure blocks only new BestEffort Pods, since non-BestEffort Pods automatically tolerate it.

</details>

### `down-node-timeline` · Down-Node Timeline

**A node loses its kubelet and goes unreachable. What happens to its reported conditions, and how long until its Pods are evicted?**

<details><summary>Answer</summary>

Its MemoryPressure, DiskPressure, PIDPressure, and Ready conditions all flip to Unknown (reason NodeStatusUnknown, 'Kubelet stopped posting node status'), and the node controller automatically taints it node.kubernetes.io/unreachable with both NoExecute and NoSchedule effects. Kubernetes auto-adds a toleration for that NoExecute taint (and the not-ready one) with tolerationSeconds=300 to ordinary Pods, so they keep showing as Running for about five minutes before taint-based eviction removes them — a Pod can override the window with its own tolerationSeconds.

</details>

### `node-debugging` · Node Debugging

**How do you get a shell on a node without SSH, and what are that technique's two main limits?**

<details><summary>Answer</summary>

kubectl debug node/`<name>` -it --image=`<image>` runs a debugging Pod on the node with the node's root filesystem mounted at /host and the Pod in the host IPC, network, and PID namespaces. Limits: it isn't privileged by default — chroot /host fails until you use --profile=sysadmin (or a manually built privileged Pod) — and it can't help with a node that's down or unreachable, since no working kubelet is left to run the debugging Pod (fall back to kubectl describe node from the API side). Delete the node-debugger Pod manually when done.

</details>

### `debug-apiserver-down` · Control-Plane Debugging

**kubectl times out against a kubeadm cluster — how do you debug the API server itself?**

<details><summary>Answer</summary>

kubectl is useless while the apiserver is down, so SSH to the control-plane node and use the container runtime directly: crictl ps -a to see whether the kube-apiserver container is running or crash-looping, crictl logs `<id>` for its output, and journalctl -u kubelet for kubelet-side errors (a manifest the kubelet can't parse never even becomes a container). Common causes: a bad edit to its static-Pod manifest, expired certificates, or etcd being down.

</details>

### `service-debugging-workflow` · Service Debugging Workflow

**A Service is not answering — what is the documented debugging order?**

<details><summary>Answer</summary>

First confirm the Service exists (kubectl get svc); then review any NetworkPolicy ingress rules affecting the target Pods; then test DNS for it from a Pod; then check the Service spec itself (port vs targetPort, protocol); then kubectl get endpointslices -l kubernetes.io/service-name=`<svc>` — no addresses almost always means the Service's selector matches none of your Pods' labels (confirm with kubectl get pods --selector=<the Service's own selector>; matching-but-unready Pods still appear as endpoints, just with ready: false); then check the Pods themselves answer on the targetPort, and finally kube-proxy on the node.

</details>

### `dns-debugging` · DNS Debugging

**How do you debug cluster DNS resolution?**

<details><summary>Answer</summary>

From a Pod with DNS tools (kubectl exec into a dnsutils-style Pod, or a throwaway kubectl run), run nslookup `<svc>`.`<ns>`.svc.cluster.local and inspect /etc/resolv.conf — the nameserver should be the kube-dns ClusterIP, with cluster search domains present. Then check the CoreDNS Pods and their logs: kubectl -n kube-system get pods -l k8s-app=kube-dns and kubectl -n kube-system logs -l k8s-app=kube-dns.

</details>

### `kubectl-connectivity-triage` · kubectl Connectivity Triage

**kubectl version returns an i/o timeout instead of a Server Version line. What does that indicate, and how do you check whether the kubeconfig's client certificate has expired?**

<details><summary>Answer</summary>

A reachability problem between kubectl and the API server — wrong context, stale $KUBECONFIG or --kubeconfig, dropped VPN — not cluster ill-health; verify with kubectl config get-contexts / use-context before blaming the cluster. To check certificate expiry, extract the kubeconfig's base64-encoded client-certificate-data, decode it with base64 -d, and pipe it into openssl x509 -noout -dates to read the notBefore/notAfter window. A credential that authenticates but gets requests rejected is an RBAC problem, not a certificate one.

</details>
