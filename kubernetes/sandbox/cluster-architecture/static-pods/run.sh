#!/usr/bin/env bash
LAB="static-pods"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# ---------------------------------------------------------------------------
# Cleanup. This lab writes a Pod manifest into /etc/kubernetes/manifests on
# cka-sandbox-worker. That file is outside Kubernetes entirely — ns_teardown
# deletes a namespace and has no idea it exists — and the Pod it produces lands
# in the "default" namespace, not in $NS. Leaving either behind is worse than
# untidy: the kubelet restarts a static Pod forever, so a forgotten manifest
# file is a Pod that no `kubectl delete` can ever remove, sitting on a worker
# consuming capacity and distorting every scheduling lab that runs afterwards.
#
# So the trap ns_setup installed is replaced here with one that scrubs the node
# too, and it is armed on EXIT INT TERM rather than written as a tidy delete at
# the bottom of the script, because the failure path is the one that most needs
# cleaning. The scrub happens even under KEEP=1: a kept namespace is a debugging
# aid, a Pod the kubelet resurrects forever is a booby trap.
# ---------------------------------------------------------------------------
NODE="cka-sandbox-worker"
CP_NODE="cka-sandbox-control-plane"
MANIFEST_DIR="/etc/kubernetes/manifests"
MANIFEST_FILE="$MANIFEST_DIR/sandbox-static.yaml"
POD_NAME="sandbox-static-web"
MIRROR="$POD_NAME-$NODE"

my_cleanup() {
  local code=$?
  # errexit is still armed inside a trap handler, and every command below is an
  # error when there is nothing to remove — which is exactly the case when the
  # script died early, the run that most needs cleaning up.
  set +e
  # Order matters. The file is the source of truth, so it goes first: deleting
  # the mirror Pod while the manifest is still on the node just makes the
  # kubelet put it straight back. The delete afterwards is belt and braces for
  # the moment between the unlink and the kubelet noticing it.
  docker exec "$NODE" rm -f "$MANIFEST_FILE" >/dev/null 2>&1
  k -n default delete pod "$MIRROR" --ignore-not-found --wait=false >/dev/null 2>&1
  if [ "${KEEP:-0}" = "1" ]; then
    note "the manifest on $NODE was removed even under KEEP=1 — a static Pod left"
    note "behind cannot be deleted with kubectl. Re-create it by hand if you want"
    note "to keep poking: docker exec -i $NODE sh -c 'cat > $MANIFEST_FILE'"
  fi
  # ns_teardown reads $? to decide its own exit status, so hand it back the
  # status this handler was entered with.
  (exit "$code"); ns_teardown
}
trap my_cleanup EXIT INT TERM

command -v docker >/dev/null 2>&1 \
  || fail "this lab needs the docker CLI: it writes a Pod manifest directly onto a node"
docker inspect "$NODE" >/dev/null 2>&1 \
  || fail "no container named $NODE — this lab assumes the 3-node kind cka-sandbox cluster"
docker inspect "$CP_NODE" >/dev/null 2>&1 \
  || fail "no container named $CP_NODE — this lab assumes the 3-node kind cka-sandbox cluster"
docker exec "$NODE" test -d "$MANIFEST_DIR" >/dev/null 2>&1 \
  || fail "$MANIFEST_DIR does not exist on $NODE — there is nowhere to put a static Pod"

# --- small readers, so the assertions below stay one line each -------------
# Every one of them ends in `|| true` so that a missing Pod yields an empty
# string instead of aborting the script under errexit — "gone" is a state this
# lab asserts on purpose, not an accident.
mirror_phase() { k -n default get pod "$MIRROR" -o jsonpath='{.status.phase}' 2>/dev/null || true; }
mirror_uid()   { k -n default get pod "$MIRROR" -o jsonpath='{.metadata.uid}'  2>/dev/null || true; }
mirror_name()  { k -n default get pod "$MIRROR" -o jsonpath='{.metadata.name}' 2>/dev/null || true; }
mirror_field() { k -n default get pod "$MIRROR" -o jsonpath="{$1}" 2>/dev/null || true; }
# Annotation keys contain dots and a slash, which JSONPath reads as structure.
# go-template's `index` takes the key as an ordinary string and sidesteps it.
mirror_ann() {
  k -n default get pod "$MIRROR" -o go-template="{{index .metadata.annotations \"$1\"}}" 2>/dev/null || true
}
node_manifests() { docker exec "$NODE" ls -A "$MANIFEST_DIR" 2>/dev/null || true; }
# Non-empty only once the API holds a DIFFERENT object under the same name, so
# polling on it cannot be satisfied by the Pod we are about to delete.
mirror_recreated() {
  local now; now="$(mirror_uid)"
  if [ -n "$now" ] && [ "$now" != "${UID_BEFORE:-}" ]; then echo recreated; fi
}
cp_manifests() { docker exec "$CP_NODE" ls -A "$MANIFEST_DIR" 2>/dev/null || true; }
cp_mirror_ann() {
  k -n kube-system get pod "$1" -o go-template="{{index .metadata.annotations \"$2\"}}" 2>/dev/null || true
}

# ---------------------------------------------------------------------------

step "Where the kubelet looks for static Pod manifests"
note "this lab hardly touches $NS. A static Pod manifest that omits"
note "metadata.namespace lands in the DEFAULT namespace, because the kubelet —"
note "not kubectl, and not your kubeconfig — decides where it goes. So every"
note "query below says -n default."
PATH_LINE="$(docker exec "$NODE" sh -c "grep -s staticPodPath /var/lib/kubelet/config.yaml" 2>/dev/null || true)"
note "from /var/lib/kubelet/config.yaml on $NODE: ${PATH_LINE:-<not found>}"
assert_contains "$PATH_LINE" "$MANIFEST_DIR" \
  "the kubelet on $NODE is configured with staticPodPath: $MANIFEST_DIR"
run docker exec "$NODE" ls -A "$MANIFEST_DIR"
assert_not_contains "$(node_manifests)" "sandbox-static.yaml" \
  "nothing of ours is in the worker's manifest directory yet"
note "a worker has the directory and the kubelet watching it; it simply has no"
note "files in it. Every node in the cluster is one file away from running a Pod"
note "the API server was never asked about."

step "Write a Pod manifest onto the node"
note "no kubectl, no API server, no scheduler — just a file, placed with"
note "docker exec because that is the closest this sandbox gets to an ssh session"
docker exec -i "$NODE" sh -c "cat > $MANIFEST_FILE" <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: $POD_NAME
  labels:
    app: sandbox-static
spec:
  containers:
    - name: web
      image: registry.k8s.io/e2e-test-images/agnhost:2.53
      command: ["/agnhost", "netexec", "--http-port=8080"]
      ports:
        - containerPort: 8080
EOF
run docker exec "$NODE" cat "$MANIFEST_FILE"
assert_contains "$(node_manifests)" "sandbox-static.yaml" \
  "the manifest file now exists on $NODE"
note "note what the manifest does NOT contain: no namespace, no nodeName, no"
note "nodeSelector. The namespace defaults to \"default\" and the node is decided"
note "by which machine the file happens to be sitting on."

step "The mirror Pod appears in the API within seconds"
assert_eventually 90 "$MIRROR" \
  "a Pod called $MIRROR showed up in the default namespace, unasked" mirror_name
note "it appears as soon as the kubelet reads the file — well before the image"
note "has finished pulling, because the object is a report of intent, not a result"
assert_eventually 300 "Running" \
  "...and reached Running once the kubelet had pulled the image and started it" mirror_phase
run k -n default get pod "$MIRROR" -o wide
note "the kubelet appended the node name: <pod name>-<node name>. That suffix is"
note "not decoration — it is what keeps two nodes running the same manifest from"
note "colliding on one API object."
if OUT="$(k -n default get pod "$POD_NAME" 2>&1)"; then
  fail "expected no Pod named $POD_NAME — the mirror is created under a node-suffixed name"
fi
assert_contains "$OUT" "not found" \
  "there is no Pod named $POD_NAME: the only name the API knows is $MIRROR"
assert_eq "$(mirror_field ".spec.nodeName")" "$NODE" \
  "the Pod is bound to $NODE, the machine whose disk holds the file"
CONNECT="$(k -n default exec "$MIRROR" -- /agnhost connect --timeout=5s 127.0.0.1:8080 >/dev/null 2>&1 && echo CONNECTED || echo FAILED)"
assert_eq "$CONNECT" "CONNECTED" \
  "the container really is serving on $NODE — kubectl exec reaches a mirror Pod normally"

step "What marks it as a mirror rather than an ordinary Pod"
run k -n default get pod "$MIRROR" -o jsonpath='{.metadata.annotations}{"\n"}'
assert_eq "$(mirror_ann 'kubernetes.io/config.source')" "file" \
  "kubernetes.io/config.source is 'file' — the kubelet read this Pod off a disk"
MIRROR_HASH="$(mirror_ann 'kubernetes.io/config.mirror')"
note "kubernetes.io/config.mirror: $MIRROR_HASH"
assert_eq "$(mirror_ann 'kubernetes.io/config.hash')" "$MIRROR_HASH" \
  "config.mirror matches config.hash — this object is the shadow of that file"
run k -n default get pod "$MIRROR" -o jsonpath='{.metadata.ownerReferences}{"\n"}'
assert_eq "$(mirror_field ".metadata.ownerReferences[0].kind")" "Node" \
  "its owner is a Node, not a ReplicaSet, Job or DaemonSet"
assert_eq "$(mirror_field ".metadata.ownerReferences[0].name")" "$NODE" \
  "...specifically $NODE, so deleting the Node object garbage-collects the mirror"
assert_eq "$(mirror_field ".spec.schedulerName")" "default-scheduler" \
  "the spec still names default-scheduler — a field that in this case nobody ever read"
run k -n default get events --field-selector "involvedObject.name=$MIRROR"
REASONS="$(k -n default get events --field-selector "involvedObject.name=$MIRROR" \
  -o jsonpath='{range .items[*]}{.reason}{"\n"}{end}' 2>/dev/null || true)"
assert_contains "$REASONS" "Started" "the kubelet logged pulling and starting the container"
assert_not_contains "$REASONS" "Scheduled" \
  "there is no Scheduled event, because the scheduler never saw this Pod"
TOLERATIONS="$(mirror_field '.spec.tolerations[?(@.effect=="NoExecute")].operator')"
note "NoExecute tolerations on this Pod: $TOLERATIONS"
assert_contains "$TOLERATIONS" "Exists" \
  "the kubelet added a blanket NoExecute toleration so taints cannot evict a static Pod"

step "kubectl delete does not delete it"
UID_BEFORE="$(mirror_uid)"
note "UID before the delete: $UID_BEFORE"
run k -n default delete pod "$MIRROR" --wait=false
assert_eventually 120 "recreated" \
  "the Pod is back under the same name with a NEW uid — the kubelet rebuilt it" mirror_recreated
note "UID after the delete:  $(mirror_uid)"
assert_eventually 120 "Running" "...and it is Running again" mirror_phase
assert_contains "$(node_manifests)" "sandbox-static.yaml" \
  "the manifest file on $NODE was never touched — kubectl had no say in it"
note "this is the whole point of a static Pod. The API object is a read-only"
note "projection of a file. Deleting the projection changes nothing about the"
note "thing being projected, so the kubelet simply draws it again."

step "Removing the file is the only real delete"
run docker exec "$NODE" rm -f "$MANIFEST_FILE"
assert_eventually 120 "" \
  "the mirror Pod vanished from the API once the file was gone" mirror_name
assert_not_contains "$(node_manifests)" "sandbox-static.yaml" \
  "and the worker's manifest directory is back to how we found it"
note "the kubelet watches the directory, so this takes about as long as an"
note "ordinary Pod delete. The lifecycle ran entirely through the filesystem:"
note "the file created the Pod and the file destroyed it."

step "The control plane is itself four static Pods"
run docker exec "$CP_NODE" ls -A "$MANIFEST_DIR"
CP_FILES="$(cp_manifests)"
assert_contains "$CP_FILES" "etcd.yaml"                    "$CP_NODE runs etcd from a file"
assert_contains "$CP_FILES" "kube-apiserver.yaml"          "...and kube-apiserver"
assert_contains "$CP_FILES" "kube-controller-manager.yaml" "...and kube-controller-manager"
assert_contains "$CP_FILES" "kube-scheduler.yaml"          "...and kube-scheduler"
for COMP in etcd kube-apiserver kube-controller-manager kube-scheduler; do
  CP_MIRROR="$COMP-$CP_NODE"
  assert_eq "$(k -n kube-system get pod "$CP_MIRROR" -o jsonpath='{.metadata.name}' 2>/dev/null || true)" \
    "$CP_MIRROR" "$CP_MIRROR is visible in kube-system, suffixed exactly like ours"
done
assert_eq "$(cp_mirror_ann "kube-apiserver-$CP_NODE" 'kubernetes.io/config.source')" "file" \
  "the API server's own Pod is annotated config.source=file, same as ours was"
note "these four set metadata.namespace: kube-system explicitly, which is why"
note "they are not in default alongside the Pod we just built."
note "and this is why the control plane is bootstrapped this way at all: nothing"
note "here can be a Deployment, because a Deployment needs a controller-manager,"
note "which needs an API server, which needs etcd. A kubelet reading files off"
note "local disk is the one thing that works before any of them exist."

step "What this proves"
note "A static Pod is a Pod the kubelet owns outright. You create one by putting"
note "a manifest in the directory named by staticPodPath on a specific node, and"
note "you delete one by removing that file. Nothing else — not kubectl, not a"
note "controller, not the scheduler — has a vote."
note ""
note "The mirror Pod is the seam between that world and the API. It exists so the"
note "Pod is visible: it shows up in kubectl get pods, it accepts exec and logs,"
note "and its status is kept current by the kubelet. But it is a projection, not"
note "the Pod itself, which is why deleting it produced a brand-new object under"
note "the same name a moment later while the container carried on running."
note ""
note "Three details give a mirror Pod away, and all three are worth recognising"
note "in an exam or an incident: the name ends in -<node name>; the annotations"
note "carry kubernetes.io/config.source: file and a config.mirror hash; and the"
note "ownerReference points at a Node rather than at a workload controller. There"
note "is also no Scheduled event, because .spec.nodeName was filled in by the"
note "kubelet from the fact of the file's location rather than by a scheduling"
note "decision — which is exactly why static Pods ignore taints, cordons and"
note "unschedulable nodes."
note ""
note "That independence is the feature, not a quirk. It is what lets kubeadm boot"
note "an empty machine into a control plane: etcd, the API server, the controller"
note "manager and the scheduler all start as files under /etc/kubernetes/manifests"
note "with no control plane available to schedule them. It is also the trap. A"
note "static Pod cannot be drained, cannot be evicted, and cannot be deleted by"
note "anyone who only has API access, so 'kubectl delete pod' on a control-plane"
note "component restarts it rather than removing it, and the only way to stop one"
note "is to get onto the node and move the file."
