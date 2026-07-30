# Kubernetes Sandbox Labs

The rest of this module is read-only — a study guide, quizzes, flashcards,
and a mock exam. These labs are the other half: 34 folders, one per
concept, that each demonstrate a piece of Kubernetes behavior against a
real cluster you create and throw away.

The unit of use is lookup, not curriculum. Go to `workloads-scheduling/replicaset/`
because you want to see how a ReplicaSet behaves, run it, and watch what
happens. The labs are independent and can be run in any order.

## Prerequisites

- **Docker** running (Docker Desktop on macOS)
- **[kind](https://kind.sigs.k8s.io/)** — `brew install kind`
- **kubectl**
- **helm** — only for `cluster-architecture/helm-kustomize`

## Quick start

```
cluster/up.sh                                  # once: builds a 3-node cluster
bash workloads-scheduling/pod/run.sh           # run any lab
cluster/down.sh                                # when you're done
```

`cluster/up.sh` creates a 3-node kind cluster running the Kubernetes
version the CKA exam tests, then installs metrics-server and ingress-nginx.
The first run pulls a ~1GB node image; later runs reuse it. Pass
`--minimal` to skip the add-ons (the `hpa` and `ingress` labs will then
refuse to run and tell you so).

Every lab cleans up after itself. To keep a lab's namespace around and
poke at it by hand:

```
KEEP=1 bash workloads-scheduling/pod/run.sh
```

Each lab's `README.md` is written to be read on its own — you don't have to
run anything to learn from it. `run.sh` executes the same walkthrough
unattended and **asserts** the behavior, so a lab that exits non-zero means
Kubernetes did not do what its README claims.

## Safety

Every command in every lab is pinned to the `kind-cka-sandbox` context, so
nothing here can touch another cluster in your kubeconfig. The cluster is
disposable by design: two labs deliberately break things (one drains nodes,
one stops the API server and recovers it), which is safe precisely because
`cluster/down.sh && cluster/up.sh` rebuilds everything in a couple of
minutes.

## The labs

### Workloads & Scheduling

| Lab | What you'll see |
| --- | --- |
| `pod` | Two containers sharing one IP and one volume, talking over localhost |
| `replicaset` | A deleted Pod being replaced; why editing the template does nothing to existing Pods |
| `deployment` | A rolling update in flight, then history, undo, pause/resume, and restart |
| `daemonset` | One Pod per node, and the automatic tolerations that let it run where others can't |
| `statefulset` | Ordered startup, stable names, and a PVC that follows its Pod across deletion |
| `job-cronjob` | Parallel completions, indexed Pods, `backoffLimit` exhaustion, and `DeadlineExceeded` |
| `configmap-secret` | Why an env var goes stale when a mounted file updates; immutable ConfigMaps |
| `init-sidecar` | Init containers gating startup; a native sidecar that keeps running alongside the app |
| `probes` | A liveness failure restarting a container; a readiness failure quietly pulling it from a Service |
| `resources-qos` | Guaranteed vs Burstable vs BestEffort, and an OOMKill with exit code 137 |
| `scheduling` | Taints, tolerations, affinity, anti-affinity, and topology spread on a 3-node cluster |
| `priorityclass` | A high-priority Pod evicting a lower-priority one to get scheduled |
| `hpa` | Load driving a scale-up, reconciled against the autoscaler's own formula |

### Services & Networking

| Lab | What you'll see |
| --- | --- |
| `service-clusterip` | Load balancing across backends; a headless Service returning Pod IPs instead |
| `service-nodeport-loadbalancer` | A NodePort answering on every node; a LoadBalancer stuck at `<pending>` forever |
| `ingress` | Path and host routing to two backends through one Ingress |
| `networkpolicy` | Default-deny cutting traffic, an allow rule restoring it, and egress rules breaking DNS |
| `dns-endpointslices` | Cluster DNS names and search paths; an unready endpoint that stays listed as `ready: false` |

### Storage

| Lab | What you'll see |
| --- | --- |
| `volumes` | `emptyDir` surviving a container restart but not the Pod; tmpfs; `hostPath` |
| `pv-pvc` | Static provisioning, one-to-one binding, and a `Retain` volume left `Released` |
| `storageclass` | A PVC sitting `Pending` on purpose until a Pod consumes it |

### Cluster Architecture

| Lab | What you'll see |
| --- | --- |
| `namespaces` | The same name in two namespaces; what lives outside namespaces entirely |
| `rbac` | `can-i` before and after a RoleBinding; why a binding's `roleRef` can't be edited |
| `serviceaccounts` | A Pod calling the API with its projected token — 403, then 200 |
| `quotas-limitranges` | A Deployment that succeeds while its Pods are rejected, and a LimitRange that fixes it |
| `static-pods` | A manifest dropped on a node becoming a Pod; deleting the mirror and watching it return |
| `etcd-backup` | A real snapshot, plus the three traps that make most published commands fail |
| `helm-kustomize` | Install, upgrade, rollback with Helm; the same app patched by a Kustomize overlay |

### Troubleshooting

| Lab | What you'll see |
| --- | --- |
| `pod-failure-states` | Pending, ImagePullBackOff, CrashLoopBackOff, and OOMKilled — and how to tell them apart |
| `node-maintenance` | Cordon, drain, and uncordon; a PDB blocking a drain; storage stranding a Pod |
| `logs` | The `kubectl logs` flags that matter, and why control-plane logs aren't in `journalctl` |
| `kubectl-debug` | Getting a shell into a distroless Pod, and onto a node, without SSH |
| `service-debugging` | An empty EndpointSlice traced back to a typo'd selector |
| `control-plane-debugging` | Breaking the API server, diagnosing it with `crictl`, and putting it back |

## See also

- The [study guide](../index.html) covers the same five domains in prose.
- `docs/superpowers/specs/2026-07-30-sandbox-labs-design.md` records why the
  cluster is built this way, including several kind-specific behaviors that
  would otherwise make a lab silently prove nothing.
