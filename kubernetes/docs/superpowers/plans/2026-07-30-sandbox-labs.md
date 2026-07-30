# Kubernetes Sandbox Labs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `kubernetes/sandbox/`, a set of 33 runnable labs that teach one Kubernetes concept each against a real local kind cluster.

**Architecture:** A `cluster/` directory owns the shared kind cluster and a `lib.sh` of shell helpers. Every lab is a folder holding `README.md` (the teaching artifact), its manifests, and a self-asserting `run.sh` that sources `lib.sh`, works only inside its own `sandbox-<lab>` namespace, and exits non-zero if the concept does not actually behave as the README claims. Because each `run.sh` asserts, "run all 33 and check exit codes" is the whole verification suite.

**Tech Stack:** Bash, YAML, kubectl v1.36.2, kind v0.31.0, Docker Desktop. No npm, no build step, no test framework.

## Global Constraints

- Node image pinned exactly: `kindest/node:v1.35.0@sha256:452d707d4862f52530247495d180205e029056831160e22870e37e3f6c1ac31f`. Never unpinned, never kind's default.
- Cluster name `cka-sandbox`; context `kind-cka-sandbox`. Every kubectl call goes through the `k()` wrapper in `lib.sh`, which passes `--context kind-cka-sandbox`. A bare `kubectl` in any lab is a defect — it can hit the user's `minikube` context.
- No file under `kubernetes/js/`, `kubernetes/css/`, or `kubernetes/index.html` may be touched. The only edit to an existing file is one new section in `kubernetes/README.md`.
- No npm packages, no Makefile, no task runner. Bash and YAML only.
- Every lab namespace is `sandbox-<lab>` and is deleted on exit (including on failure) unless `KEEP=1`. Leftover bare Pods break the drain lab; leftover bound PVCs pin nodes and distort scheduling labs.
- Labs wait on conditions (`kubectl wait`, `rollout status`, `assert_eventually`) — never bare `sleep` as a synchronisation primitive.
- Images used by labs must be public and multi-arch (arm64 host): prefer `registry.k8s.io/e2e-test-images/agnhost:2.53`, `nginx:alpine`, `busybox:1.36`, `registry.k8s.io/pause:3.10`.
- Every lab README states which CKA domain it belongs to and links back to the study guide.

---

## File Structure

```
kubernetes/sandbox/
  README.md                        index + prerequisites + full lab table
  cluster/
    kind-config.yaml               3 nodes, pinned image, ingress-ready control-plane
    lib.sh                         k(), step, run, note, assert_*, require_*, ns_setup/teardown
    up.sh                          create cluster + add-ons (--minimal skips add-ons)
    down.sh                        delete cluster
    README.md                      lifecycle, add-ons, cost, troubleshooting
  workloads-scheduling/<12 labs>/  README.md + *.yaml + run.sh
  services-networking/<5 labs>/
  storage/<3 labs>/
  cluster-architecture/<7 labs>/
  troubleshooting/<6 labs>/
```

`lib.sh` is the one file every other file depends on, so Task 1 must land and be verified before any lab is written.

---

### Task 1: Cluster scaffold and shared shell library

**Files:**
- Create: `kubernetes/sandbox/cluster/kind-config.yaml`
- Create: `kubernetes/sandbox/cluster/lib.sh`
- Create: `kubernetes/sandbox/cluster/up.sh`
- Create: `kubernetes/sandbox/cluster/down.sh`
- Create: `kubernetes/sandbox/cluster/README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the shell API every lab uses — `k`, `step`, `run`, `note`, `assert_eq`, `assert_contains`, `assert_not_contains`, `assert_eventually`, `require_cluster`, `require_addon`, `ns_setup`, `ns_teardown`, and the variables `CLUSTER_NAME`, `CONTEXT`, `LAB`, `NS`.

- [ ] **Step 1: Write `cluster/kind-config.yaml`**

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: cka-sandbox
nodes:
  - role: control-plane
    image: kindest/node:v1.35.0@sha256:452d707d4862f52530247495d180205e029056831160e22870e37e3f6c1ac31f
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
        protocol: TCP
      - containerPort: 443
        hostPort: 443
        protocol: TCP
  - role: worker
    image: kindest/node:v1.35.0@sha256:452d707d4862f52530247495d180205e029056831160e22870e37e3f6c1ac31f
  - role: worker
    image: kindest/node:v1.35.0@sha256:452d707d4862f52530247495d180205e029056831160e22870e37e3f6c1ac31f
```

- [ ] **Step 2: Write `cluster/lib.sh`**

```bash
# Shared helpers for every sandbox lab. Source this, don't execute it.
#
# A lab sets LAB before sourcing, then calls require_cluster and ns_setup:
#
#   LAB="replicaset"
#   source "$(dirname "$0")/../../cluster/lib.sh"
#   require_cluster
#   ns_setup

set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-cka-sandbox}"
CONTEXT="kind-${CLUSTER_NAME}"
LAB="${LAB:-unnamed}"
NS="sandbox-${LAB}"

if [ -t 1 ]; then
  C_HEAD=$'\033[1;36m'; C_CMD=$'\033[0;33m'; C_NOTE=$'\033[0;37m'
  C_OK=$'\033[0;32m'; C_ERR=$'\033[1;31m'; C_OFF=$'\033[0m'
else
  C_HEAD=""; C_CMD=""; C_NOTE=""; C_OK=""; C_ERR=""; C_OFF=""
fi

_STEP=0

# Every kubectl call in every lab goes through this. Never call kubectl
# directly: the ambient context may be the user's minikube cluster.
k() { kubectl --context "$CONTEXT" "$@"; }

step() { _STEP=$((_STEP + 1)); printf '\n%s== %d. %s%s\n' "$C_HEAD" "$_STEP" "$1" "$C_OFF"; }
note() { printf '%s   %s%s\n' "$C_NOTE" "$1" "$C_OFF"; }
ok()   { printf '%s   ✓ %s%s\n' "$C_OK" "$1" "$C_OFF"; }
fail() { printf '%s   ✗ %s%s\n' "$C_ERR" "$1" "$C_OFF" >&2; exit 1; }

# Echo a command, then run it. Use for anything the learner should see.
run() { printf '%s   $ %s%s\n' "$C_CMD" "$*" "$C_OFF"; "$@"; }

assert_eq() {
  [ "$1" = "$2" ] && ok "${3:-got '$1'}" || fail "${3:-assertion}: expected '$2', got '$1'"
}
assert_contains() {
  case "$1" in *"$2"*) ok "${3:-contains '$2'}";; *) fail "${3:-assertion}: '$2' not found in: $1";; esac
}
assert_not_contains() {
  case "$1" in *"$2"*) fail "${3:-assertion}: unexpectedly found '$2'";; *) ok "${3:-does not contain '$2'}";; esac
}

# Poll a command until its stdout matches, or give up. Never sleep blindly.
# usage: assert_eventually <seconds> <expected> <description> <cmd...>
assert_eventually() {
  local timeout="$1" expected="$2" desc="$3"; shift 3
  local deadline=$((SECONDS + timeout)) actual=""
  while [ $SECONDS -lt $deadline ]; do
    actual="$("$@" 2>/dev/null || true)"
    if [ "$actual" = "$expected" ]; then ok "$desc"; return 0; fi
    sleep 2
  done
  fail "$desc: expected '$expected', last saw '$actual' after ${timeout}s"
}

require_cluster() {
  if ! kubectl config get-contexts -o name 2>/dev/null | grep -qx "$CONTEXT"; then
    fail "no '$CONTEXT' context. Run: kubernetes/sandbox/cluster/up.sh"
  fi
  k cluster-info >/dev/null 2>&1 || fail "cluster '$CLUSTER_NAME' unreachable. Is Docker running? Try: cluster/up.sh"
}

# usage: require_addon metrics-server | ingress | networkpolicy
require_addon() {
  case "$1" in
    metrics-server)
      k -n kube-system get deploy metrics-server >/dev/null 2>&1 \
        || fail "metrics-server missing. Run: cluster/up.sh (without --minimal)" ;;
    ingress)
      k -n ingress-nginx get deploy ingress-nginx-controller >/dev/null 2>&1 \
        || fail "ingress-nginx missing. Run: cluster/up.sh (without --minimal)" ;;
    networkpolicy)
      # kindnet enforces NetworkPolicy but FAILS OPEN: if the DaemonSet is
      # unhealthy, policies are silently ignored and a demo proves nothing.
      local want have
      want="$(k -n kube-system get ds kindnet -o jsonpath='{.status.desiredNumberScheduled}' 2>/dev/null || echo 0)"
      have="$(k -n kube-system get ds kindnet -o jsonpath='{.status.numberReady}' 2>/dev/null || echo -1)"
      [ "$want" = "$have" ] && [ "$want" != "0" ] \
        || fail "kindnet not fully ready ($have/$want). NetworkPolicy fails OPEN — refusing to run a demo that would prove nothing."
      k get clusterrole kindnet -o yaml 2>/dev/null | grep -q networkpolicies \
        || fail "this node image predates NetworkPolicy support (needs k8s >= v1.31 image)" ;;
    *) fail "unknown addon '$1'" ;;
  esac
}

ns_teardown() {
  local code=$?
  if [ "${KEEP:-0}" = "1" ]; then
    printf '\n%s   KEEP=1 — namespace %s left running. Inspect with:%s\n' "$C_NOTE" "$NS" "$C_OFF"
    printf '%s   kubectl --context %s -n %s get all%s\n' "$C_NOTE" "$CONTEXT" "$NS" "$C_OFF"
    printf '%s   Clean up later: kubectl --context %s delete ns %s%s\n' "$C_NOTE" "$CONTEXT" "$NS" "$C_OFF"
  else
    printf '\n%s   cleaning up namespace %s%s\n' "$C_NOTE" "$NS" "$C_OFF"
    k delete ns "$NS" --wait=false >/dev/null 2>&1 || true
  fi
  exit $code
}

ns_setup() {
  k delete ns "$NS" --ignore-not-found --wait=true >/dev/null 2>&1 || true
  k create ns "$NS" >/dev/null
  k config set-context "$CONTEXT" --namespace "$NS" >/dev/null 2>&1 || true
  trap ns_teardown EXIT INT TERM
  note "working in namespace $NS (KEEP=1 to leave it running)"
}

# Apply a manifest from the lab's own directory.
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
apply() { run k -n "$NS" apply -f "$LAB_DIR/$1"; }
```

- [ ] **Step 3: Write `cluster/up.sh`**

```bash
#!/usr/bin/env bash
# Create the shared sandbox cluster and install add-ons.
#   ./up.sh              cluster + metrics-server + ingress-nginx
#   ./up.sh --minimal    cluster only
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh

MINIMAL=0
[ "${1:-}" = "--minimal" ] && MINIMAL=1

METRICS_URL="https://github.com/kubernetes-sigs/metrics-server/releases/download/v0.9.0/components.yaml"
INGRESS_URL="https://kind.sigs.k8s.io/examples/ingress/deploy-ingress-nginx.yaml"

docker info >/dev/null 2>&1 || fail "Docker is not running. Start Docker Desktop and retry."

step "Create the kind cluster"
if kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
  note "cluster '$CLUSTER_NAME' already exists — reusing it"
else
  note "first run pulls ~1GB node image; later runs are much faster"
  run kind create cluster --config ./kind-config.yaml --wait 180s
fi
run k get nodes

if [ "$MINIMAL" = "1" ]; then
  step "Skipping add-ons (--minimal)"
  note "the hpa and ingress labs will refuse to run until you re-run without --minimal"
  exit 0
fi

step "Install metrics-server (for kubectl top and the hpa lab)"
run k apply -f "$METRICS_URL"
# kind's kubelet serves a self-signed cert with no IP SANs, so the scrape
# fails without --kubelet-insecure-tls. This strategic-merge form lists the
# full args array so re-running up.sh is idempotent; a JSON `add` op would
# append the flag again on every run.
run k -n kube-system patch deployment metrics-server -p '{"spec":{"template":{"spec":{"containers":[{"name":"metrics-server","args":["--cert-dir=/tmp","--secure-port=10250","--kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname","--kubelet-use-node-status-port","--metric-resolution=15s","--kubelet-insecure-tls"]}]}}}}'
run k -n kube-system rollout status deployment/metrics-server --timeout=180s

step "Install ingress-nginx (for the ingress lab)"
note "kind's frozen copy: upstream kubernetes/ingress-nginx is retired"
run k apply -f "$INGRESS_URL"
run k -n ingress-nginx wait --for=condition=ready pod \
  -l app.kubernetes.io/component=controller --timeout=300s

step "Ready"
run k get nodes
note "NetworkPolicy needs no add-on: kind's default CNI enforces it."
note "Run any lab with: bash <domain>/<lab>/run.sh"
```

- [ ] **Step 4: Write `cluster/down.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh
step "Delete the sandbox cluster"
run kind delete cluster --name "$CLUSTER_NAME"
note "the node image stays cached, so the next up.sh is fast"
```

- [ ] **Step 5: Make the scripts executable**

```bash
chmod +x kubernetes/sandbox/cluster/up.sh kubernetes/sandbox/cluster/down.sh
```

- [ ] **Step 6: Verify the scaffold end to end**

Run:
```bash
bash kubernetes/sandbox/cluster/up.sh
```
Expected: three nodes `Ready` on `v1.35.0`; metrics-server rollout completes; ingress controller Pod becomes ready; final `Ready` banner.

Then confirm the add-on and NetworkPolicy preflights agree with reality:
```bash
kubectl --context kind-cka-sandbox -n kube-system get ds kindnet
kubectl --context kind-cka-sandbox top nodes
```
Expected: kindnet `DESIRED == READY == 3`; `top nodes` prints CPU/memory for three nodes (allow ~30s after install).

- [ ] **Step 7: Verify idempotency**

Run `bash kubernetes/sandbox/cluster/up.sh` a second time.
Expected: "cluster 'cka-sandbox' already exists — reusing it", and the metrics-server patch reports no change rather than triggering a new rollout. Confirm the flag was not duplicated:
```bash
kubectl --context kind-cka-sandbox -n kube-system get deploy metrics-server \
  -o jsonpath='{.spec.template.spec.containers[0].args}'
```
Expected: exactly one `--kubelet-insecure-tls`.

- [ ] **Step 8: Commit**

```bash
git add kubernetes/sandbox/cluster
git commit -m "feat(k8s sandbox): cluster scaffold and shared shell library"
```

---

### Task 2: Reference lab — `workloads-scheduling/pod`

This task establishes the pattern every later lab copies. Implement it exactly; later tasks specify only what differs.

**Files:**
- Create: `kubernetes/sandbox/workloads-scheduling/pod/README.md`
- Create: `kubernetes/sandbox/workloads-scheduling/pod/two-containers.yaml`
- Create: `kubernetes/sandbox/workloads-scheduling/pod/run.sh`

**Interfaces:**
- Consumes: `cluster/lib.sh` — `require_cluster`, `ns_setup`, `step`, `run`, `note`, `k`, `apply`, `assert_eq`, `assert_contains`, `assert_eventually`.
- Produces: the lab layout contract — `README.md` + manifests + self-asserting `run.sh`, sourced as `source "$(dirname "$0")/../../cluster/lib.sh"`.

- [ ] **Step 1: Write `two-containers.yaml`**

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: shared
  labels:
    app: shared
spec:
  volumes:
    - name: scratch
      emptyDir: {}
  containers:
    - name: server
      image: registry.k8s.io/e2e-test-images/agnhost:2.53
      command: ["/agnhost", "netexec", "--http-port=8080"]
      volumeMounts:
        - name: scratch
          mountPath: /scratch
    - name: sidecar
      image: registry.k8s.io/e2e-test-images/agnhost:2.53
      command: ["sleep", "3600"]
      volumeMounts:
        - name: scratch
          mountPath: /scratch
```

- [ ] **Step 2: Write `run.sh`**

```bash
#!/usr/bin/env bash
LAB="pod"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

step "Create a Pod with two containers"
apply two-containers.yaml
run k -n "$NS" wait --for=condition=Ready pod/shared --timeout=120s

step "Both containers share one Pod IP"
POD_IP="$(k -n "$NS" get pod shared -o jsonpath='{.status.podIP}')"
note "Pod IP: $POD_IP"
run k -n "$NS" get pod shared -o jsonpath='{range .spec.containers[*]}{.name}{"\n"}{end}'

step "The sidecar reaches the server over localhost"
OUT="$(k -n "$NS" exec shared -c sidecar -- /agnhost connect --timeout=5s 127.0.0.1:8080 && echo CONNECTED)"
assert_contains "$OUT" "CONNECTED" "sidecar reached the server on localhost:8080"
note "no Service, no cluster networking — same network namespace"

step "The volume is shared between them"
run k -n "$NS" exec shared -c sidecar -- sh -c 'echo "written by sidecar" > /scratch/note.txt'
SEEN="$(k -n "$NS" exec shared -c server -- cat /scratch/note.txt)"
assert_eq "$SEEN" "written by sidecar" "server read the file the sidecar wrote"

step "What this proves"
note "One Pod = one network namespace + shared volumes. Containers in a Pod"
note "are co-scheduled on one node and talk over localhost, which is why a"
note "Pod — not a container — is the smallest deployable unit."
```

- [ ] **Step 3: Write `README.md`**

Structure every lab README follows:

```markdown
# Pod

**CKA domain:** Workloads & Scheduling

A Pod is Kubernetes' smallest deployable unit: one or more containers that
always land on the same node and share a network namespace and volumes.
This lab shows both kinds of sharing directly.

## Run it

    bash run.sh          # runs the whole walkthrough and cleans up
    KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it

## Walkthrough

### 1. Create a Pod with two containers

    kubectl apply -f two-containers.yaml

`two-containers.yaml` declares one Pod, `shared`, with a `server` container
and a `sidecar` container, plus an `emptyDir` volume both mount at `/scratch`.

### 2. They share one IP

    kubectl get pod shared -o jsonpath='{.status.podIP}'

One address for the whole Pod, not one per container.

### 3. They reach each other over localhost

    kubectl exec shared -c sidecar -- /agnhost connect --timeout=5s 127.0.0.1:8080

This succeeds with no Service and no cluster networking involved, because
both containers are in the same network namespace. It also means they
share one port space: two containers in a Pod cannot both bind :8080.

### 4. They share the volume

    kubectl exec shared -c sidecar -- sh -c 'echo "written by sidecar" > /scratch/note.txt'
    kubectl exec shared -c server -- cat /scratch/note.txt

The file written by one container is readable by the other, because the
volume belongs to the Pod rather than to either container.

## What this proves

Co-scheduling, one network namespace, and shared volumes are what make a
Pod the unit of deployment. Anything needing those three things together
belongs in one Pod; anything else belongs in its own.

## See also

- Study guide → Workloads and Scheduling
- Flashcards: `pod`, `volume`
```

- [ ] **Step 4: Run it and confirm every assertion passes**

```bash
bash kubernetes/sandbox/workloads-scheduling/pod/run.sh; echo "exit=$?"
```
Expected: four `✓` lines, `exit=0`, and a final cleanup line.

- [ ] **Step 5: Confirm cleanup and KEEP both work**

```bash
kubectl --context kind-cka-sandbox get ns | grep sandbox-pod || echo "cleaned up"
KEEP=1 bash kubernetes/sandbox/workloads-scheduling/pod/run.sh >/dev/null
kubectl --context kind-cka-sandbox -n sandbox-pod get pods
kubectl --context kind-cka-sandbox delete ns sandbox-pod
```
Expected: "cleaned up" after the first run; the `shared` Pod listed after the `KEEP=1` run.

- [ ] **Step 6: Commit**

```bash
git add kubernetes/sandbox/workloads-scheduling/pod
git commit -m "feat(k8s sandbox): pod lab"
```

---

## Tasks 3–34: the remaining 32 labs

Each follows Task 2's contract exactly: `README.md` (same section order: title, CKA domain, one-paragraph framing, Run it, Walkthrough, What this proves, See also) + manifests + a self-asserting `run.sh` that sources `lib.sh`, calls `require_cluster` and `ns_setup`, and ends with a "What this proves" `note` block. Each ends with the same two steps: run it and confirm every assertion passes with `exit=0`, then commit as `feat(k8s sandbox): <lab> lab`.

The table below specifies, per lab, what the walkthrough must demonstrate and what `run.sh` must assert. An implementer needs no other source.

### Task 3: `workloads-scheduling/replicaset`

Demonstrate: a ReplicaSet of 3; delete one Pod and watch a replacement appear; `ownerReferences` on a Pod naming the RS; editing the RS Pod template leaves existing Pods untouched.
Assert: `assert_eventually 60 3` on ready replica count after deletion; Pod's `.metadata.ownerReferences[0].kind` equals `ReplicaSet`; after patching the template image, existing Pods still report the old image.

### Task 4: `workloads-scheduling/deployment`

Demonstrate: rollout with `maxSurge: 1`/`maxUnavailable: 0` observed via `rollout status`; `rollout history` showing revisions; `rollout undo` restoring the prior image; `rollout pause`/`resume`; `rollout restart` stamping `kubectl.kubernetes.io/restartedAt`.
Assert: two ReplicaSets exist after the update; image reverts to the original after `undo`; the restart annotation is present on the Pod template.

### Task 5: `workloads-scheduling/daemonset`

Demonstrate: a DaemonSet landing exactly one Pod per node across all three nodes; the controller's automatic tolerations shown via `kubectl get pod -o jsonpath='{.spec.tolerations}'`; a `nodeSelector` narrowing it to one node.
Assert: desired == current == 3; tolerations include `node.kubernetes.io/not-ready`; after adding the nodeSelector, desired drops to 1.

### Task 6: `workloads-scheduling/statefulset`

Demonstrate: ordered creation `web-0` then `web-1`; stable names surviving deletion; a per-Pod PVC that outlives its Pod; per-Pod DNS through a headless Service.
Assert: Pod names are exactly `web-0`,`web-1`; deleting `web-0` brings back a Pod with the same name and the same `volumeName` on its PVC; `nslookup web-0.web.sandbox-statefulset.svc.cluster.local` from a client Pod resolves.

### Task 7: `workloads-scheduling/job-cronjob`

Demonstrate: a Job with `completions: 3`/`parallelism: 2`; an `Indexed` Job exposing `JOB_COMPLETION_INDEX`; a deliberately failing Job exhausting `backoffLimit: 2`; `activeDeadlineSeconds` beating `backoffLimit` with reason `DeadlineExceeded`; a CronJob with `concurrencyPolicy: Forbid`.
Assert: succeeded count reaches 3; the failing Job's condition is `Failed`; the deadline Job's failure reason is `DeadlineExceeded`.

### Task 8: `workloads-scheduling/configmap-secret`

Demonstrate: `--from-literal`, `--from-file`, `--from-env-file`; `envFrom` frozen at container start vs a volume mount that refreshes; `immutable: true` rejecting an update.
Assert: env var matches the original value after the ConfigMap changes; the mounted file eventually shows the new value (`assert_eventually 120`); patching the immutable ConfigMap exits non-zero and the error contains `immutable`.

### Task 9: `workloads-scheduling/init-sidecar`

Demonstrate: two init containers running in order, the app container blocked until both finish; Pod status showing `Init:1/2`; a native sidecar (`restartPolicy: Always` on an init container) staying up alongside the app.
Assert: app container start time is after both init containers' finish times; the sidecar container is `Running` while the app container is `Running`.

### Task 10: `workloads-scheduling/probes`

Demonstrate: a liveness probe failing and restarting its container; a readiness probe failing and removing the Pod from its Service's EndpointSlice without a restart; a startup probe delaying liveness.
Assert: restart count for the liveness Pod becomes >= 1; the readiness Pod's restart count stays 0 while its address leaves the EndpointSlice.

### Task 11: `workloads-scheduling/resources-qos`

Demonstrate: three Pods classified `Guaranteed`, `Burstable`, `BestEffort` from their requests/limits; a container exceeding its memory limit being OOMKilled with exit code 137.
Assert: `.status.qosClass` equals the expected class for each of the three; the OOM Pod's `lastState.terminated.reason` is `OOMKilled` and `exitCode` is 137.

### Task 12: `workloads-scheduling/scheduling`

Demonstrate: a `NoSchedule` taint on one worker repelling a Pod until a toleration is added; `nodeSelector` vs `nodeAffinity` with `In`; pod anti-affinity spreading 2 replicas across 2 nodes; `topologySpreadConstraints` with `maxSkew: 1`; a PriorityClass preempting a lower-priority Pod.
Assert: the untolerated Pod is `Pending` with `FailedScheduling`; after the toleration it is `Running`; the anti-affinity Deployment's Pods sit on two distinct nodes; the low-priority Pod is evicted once the high-priority one needs room.

### Task 13: `workloads-scheduling/hpa`

Requires `require_addon metrics-server`.
Demonstrate: `kubectl top pods` returning data; an HPA targeting 50% CPU; a load generator driving replicas up; the `ceil(current × ratio)` formula reconciled against the observed count.
Assert: `kubectl top pods` output is non-empty; `assert_eventually 300` that replica count exceeds the initial 1.

### Task 14: `services-networking/service-clusterip`

Demonstrate: a ClusterIP Service load-balancing across 3 backends (repeated calls returning different hostnames); a headless Service (`clusterIP: None`) whose DNS returns Pod IPs.
Assert: at least 2 distinct backend hostnames across 12 requests; the ClusterIP Service resolves to one IP while the headless one resolves to 3.

### Task 15: `services-networking/service-nodeport-loadbalancer`

Demonstrate: a NodePort reachable via any node's internal IP; a LoadBalancer Service whose `EXTERNAL-IP` stays `<pending>`, with `kubectl describe` explaining why.
Assert: NodePort is inside 30000–32767 and a curl from a Pod to `<nodeIP>:<nodePort>` succeeds; after 30s the LoadBalancer's ingress list is still empty.
README must state that `<pending>` is correct on kind (no cloud provider), and that `cloud-provider-kind` is deliberately not used because it mutates every kind cluster on the machine.

### Task 16: `services-networking/ingress`

Requires `require_addon ingress`.
Demonstrate: one Ingress routing `/foo` and `/bar` to two Services; host-based routing with a `Host:` header; `IngressClass` naming the controller.
Assert: curl through the controller to `/foo` returns the foo backend and `/bar` the bar backend.
README must note ingress-nginx is retired upstream and Gateway API is its successor.

### Task 17: `services-networking/networkpolicy`

Requires `require_addon networkpolicy`.
Demonstrate: traffic flowing with no policy; `podSelector: {}` default-deny cutting it; an allow rule restoring it for one label only; default-deny egress breaking DNS until a port-53 rule (UDP **and** TCP) to `kube-system` is added; two `from:` items ORed vs one item with both selectors ANDed.
Assert: the reachable → blocked → reachable → blocked-for-other-label sequence; `nslookup` fails under default-deny egress and succeeds after the DNS rule.
README must warn that probing from the node (`docker exec <node> curl`) bypasses policy because node-root traffic is accepted, and that established connections survive a new policy — open a fresh one.

### Task 18: `services-networking/dns-endpointslices`

Demonstrate: `<svc>.<ns>.svc.cluster.local` resolution and `/etc/resolv.conf` search paths; EndpointSlice contents including a not-ready endpoint carrying `ready: false`.
Assert: the FQDN resolves to the Service ClusterIP; the EndpointSlice for the Service lists 3 addresses; after failing one Pod's readiness, one endpoint's `conditions.ready` is `false` while the address is still listed.

### Task 19: `storage/volumes`

Demonstrate: `emptyDir` shared by two containers and destroyed with the Pod; `medium: Memory` mounting a tmpfs; a `hostPath` mount reading a file created on the node.
Assert: the second container reads the first's file; `df -t tmpfs` inside the memory-backed mount succeeds; recreating the Pod shows the emptyDir empty again.

### Task 20: `storage/pv-pvc`

Demonstrate: a manually created PV and a matching PVC binding one-to-one; a PVC with no matching PV staying `Pending`; `persistentVolumeReclaimPolicy: Retain` leaving the PV `Released` after the PVC is deleted.
Assert: PVC phase becomes `Bound` and the PV's `claimRef` names it; the unmatched PVC is still `Pending` after 30s; the retained PV's phase is `Released`.

### Task 21: `storage/storageclass`

Demonstrate: the default `standard` StorageClass; a lone PVC sitting `Pending` with a `WaitForFirstConsumer` event; the PVC binding within seconds once a consuming Pod is scheduled; the resulting PV's node affinity.
Assert: PVC is `Pending` and `kubectl describe` output contains `WaitForFirstConsumer`; after the Pod is created, `assert_eventually 60 Bound`; the PV has `nodeAffinity` naming one node.

### Task 22: `cluster-architecture/namespaces`

Demonstrate: the same Deployment name in two namespaces; `kubectl api-resources --namespaced=false` listing cluster-scoped kinds; a Role's reach stopping at its namespace boundary.
Assert: both namespaces report a Deployment named `web`; `api-resources --namespaced=false` output contains `nodes` and `persistentvolumes`.
Note: this lab creates a second namespace beyond `$NS`; it must delete it in its own trap.

### Task 23: `cluster-architecture/rbac`

Demonstrate: a ServiceAccount with no permissions; a Role granting `get,list` on pods plus a RoleBinding; `kubectl auth can-i --as=system:serviceaccount:<ns>:<sa>` before and after; a RoleBinding to a ClusterRole staying namespace-confined; an attempt to edit a binding's `roleRef` failing.
Assert: `can-i list pods` is `no` before and `yes` after; `can-i list pods --all-namespaces` remains `no`; patching `roleRef` exits non-zero.

### Task 24: `cluster-architecture/serviceaccounts`

Demonstrate: the projected token at `/var/run/secrets/kubernetes.io/serviceaccount/token`; calling the API from inside the Pod with it and getting 403; granting a Role and getting 200; `kubectl create token` minting one from outside.
Assert: the in-Pod API call returns 403 before the RoleBinding and 200 after; `kubectl create token` prints a three-segment JWT.

### Task 25: `cluster-architecture/quotas-limitranges`

Demonstrate: a ResourceQuota on `requests.cpu`; a Deployment that is *accepted* while its Pods are rejected, with the error surfacing on the ReplicaSet; a LimitRange injecting defaults that make an otherwise-rejected Pod admissible.
Assert: the Deployment create succeeds; its `availableReplicas` stays 0 and the ReplicaSet's events contain `exceeded quota`; after the LimitRange, a Pod with no explicit requests is created successfully.

### Task 26: `cluster-architecture/static-pods`

Demonstrate: writing a manifest into `/etc/kubernetes/manifests` on a worker via `docker exec`; the mirror Pod appearing; deleting the mirror with kubectl and watching it return; removing the file to delete it for real; the control plane's own four static Pods on the control-plane node.
Assert: `assert_eventually 90` that the mirror Pod appears; it returns after deletion; it is gone after the file is removed; the control-plane manifests directory lists all four components.
Note: uses `docker exec cka-sandbox-worker`, not `k`. Must restore state even on failure.

### Task 27: `cluster-architecture/etcd-backup`

Demonstrate: `etcdctl snapshot save` execed **directly** (no `sh -c`) with the kubeadm cert paths, writing to `/var/lib/etcd/`; `etcdutl snapshot status -w table`; `docker cp` retrieving the snapshot to the host.
Assert: the command exits 0 and its output contains `Snapshot saved`; `etcdutl snapshot status` output contains `REVISION`; the copied file exists on the host and is non-empty.
README must state all three traps: the etcd image is distroless so `sh -c` fails; etcd 3.6 removed `etcdctl snapshot status`/`restore` in favour of `etcdutl`; writing to `/tmp` appears to succeed but is unreachable by `docker cp` and `kubectl cp` (no `tar` in the image).

### Task 28: `cluster-architecture/helm-kustomize`

Demonstrate: `helm install` of a local chart in the lab folder, `helm upgrade` with `--set`, `helm history`, `helm rollback`; the same app as a Kustomize base plus an overlay applied with `kubectl apply -k`.
Assert: `helm history` lists 2 revisions after the upgrade and 3 after the rollback; the rolled-back replica count matches revision 1; the Kustomize overlay's Deployment carries the overlay's label and replica count.
Use a minimal chart committed in the lab folder — no network fetch, no external repo.

### Task 29: `troubleshooting/pod-failure-states`

Demonstrate four Pods broken four ways: unschedulable (impossible resource request) → `Pending`/`FailedScheduling`; bad image tag → `ImagePullBackOff`; command exiting 1 → `CrashLoopBackOff` diagnosed with `logs --previous`; memory hog → `OOMKilled`/137.
Assert: each Pod reaches its expected state via `assert_eventually`; `logs --previous` returns the crashed instance's output.

### Task 30: `troubleshooting/node-maintenance`

Demonstrate: `cordon` marking a node unschedulable while its Pods keep running; `drain --ignore-daemonsets` relocating a **stateless** Deployment; a PodDisruptionBudget with `minAvailable` blocking a drain until replicas allow it; `uncordon` restoring the node. Then, deliberately, a Pod using a local-path PVC stranded `Pending` after its node is drained.
Assert: node `unschedulable` is true after cordon; the Deployment's Pods all move off the drained node; the drain blocked by the PDB times out; the PVC-bound Pod's events contain `didn't match PersistentVolume's node affinity`.
Must `uncordon` every node in its teardown, including on failure.

### Task 31: `troubleshooting/logs`

Demonstrate: `logs -c`, `--previous`, `-l`, `--since`, `--tail`; where log files live on the node (`/var/log/pods`); why control-plane components are absent from `journalctl -u kubelet` but present as container logs.
Assert: `-c` returns only the named container's output; `--tail=5` returns 5 lines; the node's `/var/log/pods` listing is non-empty; `crictl ps` on the control-plane node lists `kube-apiserver`.

### Task 32: `troubleshooting/kubectl-debug`

Demonstrate: `kubectl debug` attaching an ephemeral container to a distroless Pod with no shell; `--target` joining the target's process namespace so `ps` sees its processes; `kubectl debug node/` with the host filesystem at `/host`.
Assert: `exec` into the distroless container fails; the ephemeral container's shell succeeds; with `--target`, `ps` output contains the target process; the node debugger sees `/host/etc/kubernetes` on the control-plane node.
Must delete the node-debugger Pod in teardown.

### Task 33: `troubleshooting/service-debugging`

Demonstrate: a Service whose selector has a typo, producing an empty EndpointSlice; walking the documented order (Service exists → NetworkPolicy → DNS → spec ports → EndpointSlices → Pods); fixing the selector and watching endpoints appear.
Assert: the EndpointSlice has 0 addresses before the fix and 3 after; a curl from a client Pod fails before and succeeds after.

### Task 34: `troubleshooting/control-plane-debugging`

Demonstrate: corrupting `/etc/kubernetes/manifests/kube-apiserver.yaml` on the control-plane node so the API server stops; `kubectl` failing; diagnosing over `docker exec` + `crictl ps -a` + `crictl logs`; restoring the manifest and watching the API server return.
Assert: `k get nodes` fails while broken; `crictl ps -a` output mentions `kube-apiserver`; `assert_eventually 240` that `k get nodes` succeeds again after restore.
The teardown **must** restore the manifest from its backup even on failure or interrupt — this is the one lab that can leave the cluster unusable. README must open with that warning and state the recovery command (`cluster/down.sh && cluster/up.sh`).

---

### Task 35: Sandbox index and module README link

**Files:**
- Create: `kubernetes/sandbox/README.md`
- Modify: `kubernetes/README.md`

- [ ] **Step 1: Write `kubernetes/sandbox/README.md`**

Contents: what the sandbox is; prerequisites (Docker running, `kind`, `kubectl`, `helm`); the three-command quick start (`cluster/up.sh`, `bash <domain>/<lab>/run.sh`, `cluster/down.sh`); the `KEEP=1` convention; a table of all 33 labs grouped by domain with a one-line description each; a note that the cluster is disposable and no lab ever touches a non-kind context.

- [ ] **Step 2: Add a section to `kubernetes/README.md`**

Insert after the "A note on format" section, since that section already tells the reader to pair the site with hands-on practice:

```markdown
## Hands-on labs

[`sandbox/`](sandbox) holds 33 runnable labs — one per concept, grouped by
the same five exam domains — that demonstrate Kubernetes behavior against a
disposable local [kind](https://kind.sigs.k8s.io/) cluster the labs create
themselves. Each folder has a README you can read on its own, the manifests
it applies, and a `run.sh` that executes the whole walkthrough and checks
the result.

    kubernetes/sandbox/cluster/up.sh                       # once
    bash kubernetes/sandbox/workloads-scheduling/pod/run.sh
    kubernetes/sandbox/cluster/down.sh                     # when finished
```

- [ ] **Step 3: Verify the lab table matches the filesystem**

```bash
find kubernetes/sandbox -name run.sh | wc -l          # expect 33
grep -c '^| `' kubernetes/sandbox/README.md            # expect 33
```

- [ ] **Step 4: Commit**

```bash
git add kubernetes/sandbox/README.md kubernetes/README.md
git commit -m "docs(k8s sandbox): index and module README link"
```

---

### Task 36: Full-suite verification

- [ ] **Step 1: Recreate the cluster from scratch**

```bash
bash kubernetes/sandbox/cluster/down.sh || true
bash kubernetes/sandbox/cluster/up.sh
```
Proves the labs work on a clean cluster, not one carrying state from development.

- [ ] **Step 2: Run every lab in sequence, recording exit codes**

```bash
cd kubernetes/sandbox
fail=0
for s in */*/run.sh; do
  printf '\n########## %s\n' "$s"
  if bash "$s"; then echo "PASS $s"; else echo "FAIL $s"; fail=$((fail+1)); fi
done
echo "failed: $fail of $(ls -d */*/run.sh | wc -l)"
```
Expected: `failed: 0 of 33`. Any failure is fixed in its lab, not documented around.

- [ ] **Step 3: Confirm no lab leaked state**

```bash
kubectl --context kind-cka-sandbox get ns | grep sandbox- || echo "no leftover namespaces"
kubectl --context kind-cka-sandbox get nodes -o jsonpath='{range .items[*]}{.metadata.name}{" unschedulable="}{.spec.unschedulable}{"\n"}{end}'
kubectl --context kind-cka-sandbox get pv
```
Expected: no leftover namespaces; every node `unschedulable=<none>`; no stray PVs.

- [ ] **Step 4: Confirm the repo's own checks still pass**

```bash
node scripts/check-drift.mjs
node kubernetes/scripts/validate-content.mjs
```
Expected: no drift; content validates. (The sandbox touches neither, so this is a regression guard.)

- [ ] **Step 5: Commit any fixes**

```bash
git add -A kubernetes/sandbox
git commit -m "fix(k8s sandbox): corrections from full-suite verification"
```

---

## Self-Review

**Spec coverage.** Cluster + `lib.sh` → Task 1. All 33 labs → Tasks 2–34, matching the spec's inventory one-for-one (12 + 5 + 3 + 7 + 6). Index and README link → Task 35. The spec's verification requirement ("not complete until all 33 have run end to end") → Task 36. Every "Verified cluster mechanics" finding is bound to the task that must honour it: node-image pin → Task 1 Step 1; NetworkPolicy fail-open, node-root bypass, established connections → `require_addon networkpolicy` in Task 1 Step 2 and Task 17; storage lazy binding → Task 21; node-pinned PV vs drain → Task 30; LoadBalancer `<pending>` and the cloud-provider-kind rejection → Task 15; etcd's three traps → Task 27; ingress-nginx retirement → Task 1 Step 3 and Task 16; metrics-server single flag and idempotent patch → Task 1 Step 3 and Step 7; context safety → the `k()` wrapper, Global Constraints; lab isolation → `ns_setup`/`ns_teardown`, Task 36 Step 3.

**Placeholder scan.** No TBDs. Tasks 3–34 are specified as behavior-plus-assertions rather than transcribed code, which is deliberate: the README prose is authored content, and every mechanical detail an implementer could get wrong (exact flags, cert paths, thresholds, teardown obligations) is stated. The shared code they all depend on is given in full in Tasks 1 and 2.

**Type consistency.** The `lib.sh` API is defined once in Task 1 Step 2 and used with those exact names throughout: `k`, `step`, `run`, `note`, `ok`, `fail`, `apply`, `assert_eq`, `assert_contains`, `assert_not_contains`, `assert_eventually`, `require_cluster`, `require_addon`, `ns_setup`, `ns_teardown`. `assert_eventually` is always called as `<timeout> <expected> <description> <cmd...>`, matching its definition. `require_addon` is called only with `metrics-server`, `ingress`, `networkpolicy` — the three cases it implements. `$LAB` is set before sourcing in every lab, which is what makes `$NS` correct.
