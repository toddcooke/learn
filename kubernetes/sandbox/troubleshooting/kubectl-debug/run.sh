#!/usr/bin/env bash
LAB="kubectl-debug"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# ---------------------------------------------------------------------------
# Cleanup. `kubectl debug node/<node>` is not an ephemeral container at all: it
# creates an ordinary Pod, in an ordinary namespace, with .spec.nodeName already
# filled in. This lab creates those in `default` — the namespace the documented
# command lands in for anyone who has not switched — and a Pod in `default` is
# invisible to ns_teardown. Worse, kubectl generates the name
# (node-debugger-<node>-<5 random characters>), so it is easy to create one and
# never find it again.
#
# The trap ns_setup installed is therefore replaced with one that removes every
# node-debugger Pod that appeared while this script was running, computed as a
# set difference against a snapshot taken before the first debug so that a Pod
# somebody else created is never touched. It is armed on EXIT INT TERM rather
# than written as a tidy delete at the bottom of the script, because the failure
# path is the one that leaks. It runs even under KEEP=1: a kept namespace is a
# debugging aid, a forgotten Pod in someone else's namespace is litter.
# ---------------------------------------------------------------------------
NODE="cka-sandbox-worker"
PRE_DEBUGGERS=""
NODE_DEBUG_POD=""

node_debuggers() {
  # `|| true` twice over: an empty namespace makes grep exit 1, and lib.sh runs
  # with `set -o pipefail`, so an unrescued pipeline here would kill the script.
  k -n default get pods -o name 2>/dev/null | grep "node-debugger-" || true
}

my_cleanup() {
  local code=$?
  # errexit stays armed inside a trap handler, and most of what follows is an
  # error when there is nothing to remove — which is exactly the case when the
  # script died early, the run that most needs cleaning up.
  set +e
  local p leaked=""
  for p in $(node_debuggers); do
    case " $PRE_DEBUGGERS " in *" $p "*) continue ;; esac
    leaked="$leaked $p"
    k -n default delete "$p" --ignore-not-found --now >/dev/null 2>&1
  done
  if [ -n "$leaked" ] && [ "${KEEP:-0}" = "1" ]; then
    note "these Pods live in the default namespace, outside $NS, so they were"
    note "deleted even under KEEP=1:$leaked"
  fi
  # ns_teardown reads $? to decide its own exit status, so hand it back the
  # status this handler was entered with.
  (exit "$code"); ns_teardown
}
trap my_cleanup EXIT INT TERM

PRE_DEBUGGERS=" $(node_debuggers | tr '\n' ' ')"

# Create a node debugger Pod and work out what kubectl called it, so the script
# can read its logs and the trap can delete it by name.
#   node_debug <profile> <command...>
node_debug() {
  local profile="$1"; shift
  local out name
  note "\$ kubectl debug node/$NODE --image=busybox:1.36 --profile=$profile --attach=false -- $*"
  out="$(k -n default debug "node/$NODE" --image=busybox:1.36 --profile="$profile" \
           --attach=false --stdin=false --tty=false -- "$@" 2>&1)"
  note "$out"
  # pipefail is on, and head closing the pipe early makes grep exit on SIGPIPE,
  # which would throw away a name we had already read. Both parses run with it
  # off for that reason.
  set +o pipefail
  name="$(printf '%s\n' "$out" | grep -o "node-debugger-$NODE-[a-z0-9]*" | head -n1 || true)"
  if [ -z "$name" ]; then
    # Belt and braces. If kubectl ever stops announcing the name, fall back to
    # the newest matching Pod rather than silently leaking one.
    name="$(k -n default get pods -o name --sort-by=.metadata.creationTimestamp 2>/dev/null \
             | grep -o "node-debugger-$NODE-[a-z0-9]*" | tail -n1 || true)"
  fi
  set -o pipefail
  # Stop rather than carry on blind. The trap's set-difference sweep will still
  # remove the Pod even though this function never learned its name.
  [ -n "$name" ] || fail "could not work out the debugger Pod's name"
  NODE_DEBUG_POD="$name"
}

pod_field() { k -n "$NS" get pod distroless -o jsonpath="{$1}"; }
node_pod_field() { k -n default get pod "$NODE_DEBUG_POD" -o jsonpath="{$1}"; }

# ---------------------------------------------------------------------------

step "A Pod you cannot exec into"
apply distroless.yaml
run k -n "$NS" wait --for=condition=Ready pod/distroless --timeout=180s
assert_eq "$(pod_field '.spec.containers[0].image')" "registry.k8s.io/pause:3.10" \
  "the app container runs registry.k8s.io/pause:3.10, an image built FROM scratch"
run k -n "$NS" get pod distroless

if OUT="$(k -n "$NS" exec distroless -c app -- sh -c 'echo hello' 2>&1)"; then
  fail "expected 'kubectl exec -- sh' to fail: this image contains no shell"
fi
ok "kubectl exec -- sh failed, as it must: the image has no shell to start"
note "kubectl said: $OUT"
assert_contains "$OUT" "not found" \
  "...and the runtime said so — it could find no executable called sh"
if OUT="$(k -n "$NS" exec distroless -c app -- ls / 2>&1)"; then
  fail "expected 'kubectl exec -- ls' to fail as well"
fi
ok "and there is no ls either — the image holds one file, /pause, and nothing else"
note "this is not a permissions problem and not a kubectl problem. kubectl exec"
note "asks the kubelet to start a new process inside the container's existing"
note "filesystem, and that filesystem has no program to start."

step "kubectl debug adds an ephemeral container to the running Pod"
UID_BEFORE="$(pod_field '.metadata.uid')"
START_BEFORE="$(pod_field '.status.startTime')"
note "Pod uid before: $UID_BEFORE"
run k -n "$NS" debug pod/distroless --image=busybox:1.36 -c shell --profile=general \
  --attach=false --stdin=false --tty=false \
  -- sh -c 'hostname; ls /; ps; echo SHELL-OK'
note "--attach=false because this script has no TTY. Interactively you would"
note "write: kubectl debug -it pod/distroless --image=busybox:1.36 -- sh"
note "--profile=general is spelled out for the same reason: general is already"
note "the default, but a lab should not depend on a default to make its point."

assert_eventually_contains 240 "SHELL-OK" \
  "the ephemeral container started and ran a real shell" \
  k -n "$NS" logs distroless -c shell
LOGS_SHELL="$(k -n "$NS" logs distroless -c shell)"
run k -n "$NS" logs distroless -c shell
assert_contains "$LOGS_SHELL" "distroless" \
  "hostname printed the Pod's name: the shell is inside this Pod, sharing its network namespace"
assert_contains "$LOGS_SHELL" "bin" \
  "and ls / listed busybox's filesystem — the tools come from the debug image, not the app's"
assert_eventually 60 "0" "the debug container exited 0, and its status is recorded on the Pod" \
  k -n "$NS" get pod distroless -o jsonpath='{.status.ephemeralContainerStatuses[?(@.name=="shell")].state.terminated.exitCode}'

step "What changed on the Pod, and what did not"
assert_eq "$(pod_field '.metadata.uid')" "$UID_BEFORE" \
  "the Pod's uid is unchanged — this is the same object, not a replacement"
assert_eq "$(pod_field '.status.startTime')" "$START_BEFORE" \
  "...and its startTime is unchanged: nothing was restarted"
assert_eq "$(pod_field '.spec.containers[0].image')" "registry.k8s.io/pause:3.10" \
  "the app still runs the same image — no rebuild, no redeploy, no shell smuggled in"
assert_eq "$(pod_field '.status.containerStatuses[0].restartCount')" "0" \
  "its restartCount is still 0"
assert_eq "$(pod_field '.spec.containers[*].name')" "app" \
  ".spec.containers still holds exactly one container, app"
assert_eq "$(pod_field '.spec.ephemeralContainers[*].name')" "shell" \
  "the debug container is in a separate list, .spec.ephemeralContainers"
run k -n "$NS" get pod distroless
assert_contains "$(k -n "$NS" get pod distroless --no-headers)" "1/1" \
  "kubectl still reports READY 1/1 — an ephemeral container is not counted towards readiness"
assert_eq "$(pod_field '.status.phase')" "Running" \
  "and the Pod is still Running"
assert_contains "$(pod_field '.spec.ephemeralContainers[0].securityContext.capabilities.add')" "SYS_PTRACE" \
  "--profile=general granted the debug container SYS_PTRACE, and only it"
assert_eq "$(pod_field '.spec.containers[0].securityContext.capabilities.add')" "" \
  "...the app container's own security context was not touched"

step "Without --target, the debug container has its own process namespace"
assert_not_contains "$LOGS_SHELL" "pause" \
  "ps in that first debug container saw no /pause process at all"
note "containers in a Pod share a network namespace and their volumes, but by"
note "default each one gets its own PID namespace. The shell was in the Pod and"
note "still could not see the process it was sent to diagnose."

step "With --target, it joins the target container's process namespace"
run k -n "$NS" debug pod/distroless --image=busybox:1.36 -c inspector --target=app --profile=general \
  --attach=false --stdin=false --tty=false \
  -- sh -c 'ps; echo PS-OK'
assert_eventually_contains 240 "PS-OK" "the inspector container ran" \
  k -n "$NS" logs distroless -c inspector
LOGS_INSPECTOR="$(k -n "$NS" logs distroless -c inspector)"
run k -n "$NS" logs distroless -c inspector
assert_contains "$LOGS_INSPECTOR" "pause" \
  "ps now lists the app's process, /pause, as PID 1 of the namespace they share"
assert_eq "$(pod_field '.spec.ephemeralContainers[?(@.name=="inspector")].targetContainerName')" "app" \
  "the field that did it is targetContainerName: app"
note "--target is a request to the container runtime, not something the kubelet"
note "can emulate. containerd honours it; a runtime that does not will either"
note "refuse to start the container or start it with its own namespace anyway,"
note "which is why the flag is documented as runtime-dependent."

step "Sharing the process namespace also gets you the target's filesystem"
run k -n "$NS" debug pod/distroless --image=busybox:1.36 -c rootfs --target=app --profile=general \
  --attach=false --stdin=false --tty=false \
  -- sh -c 'ls /proc/1/root/ && echo ROOTFS-OK'
assert_eventually_contains 240 "ROOTFS-OK" "the listing of /proc/1/root succeeded" \
  k -n "$NS" logs distroless -c rootfs
LOGS_ROOTFS="$(k -n "$NS" logs distroless -c rootfs)"
run k -n "$NS" logs distroless -c rootfs
assert_contains "$LOGS_ROOTFS" "pause" \
  "and there is the app's root filesystem: the pause binary, plus what the runtime injected"
note "the two containers do not share a mount namespace, so /proc is the way in."
note "/proc/<pid>/root is the kernel's view of that process's filesystem root, so"
note "once you are in the same PID namespace you can read the config files and"
note "logs of an image that has no way to read them itself."

step "An ephemeral container cannot be added by writing the Pod"
if OUT="$(k -n "$NS" patch pod distroless --type=strategic \
          -p '{"spec":{"ephemeralContainers":[{"name":"sneaky","image":"busybox:1.36"}]}}' 2>&1)"; then
  note "the patch returned without an error, but look at what it actually did:"
else
  note "the API rejected it outright: $OUT"
fi
assert_eq "$(pod_field '.spec.ephemeralContainers[*].name')" "shell inspector rootfs" \
  "the list is untouched — no 'sneaky' container was added"
run k -n "$NS" get pod distroless -o jsonpath='{range .spec.ephemeralContainers[*]}{.name}{"\t"}{.image}{"\n"}{end}'
note "ephemeral containers are written through a dedicated ephemeralcontainers"
note "subresource, not through the Pod resource, which is why kubectl edit and"
note "kubectl apply cannot add one. The same rule works in the other direction:"
note "the three above are now part of this Pod for as long as it lives. You"
note "cannot change them and you cannot remove them — you delete the Pod."

step "kubectl debug node/<node> is a Pod, not an ephemeral container"
note "-n default is deliberate: the debugger for a node is an ordinary Pod, and"
note "it is created in whatever namespace you are pointed at. Run the command as"
note "the documentation writes it and it lands in default, where nothing that"
note "cleans up this lab's namespace will ever find it."
node_debug general sh -c 'ls /host/etc && echo NODE-FS-OK'
note "kubectl generated the Pod name: default/$NODE_DEBUG_POD"
assert_eventually_contains 300 "NODE-FS-OK" "the debugger Pod ran on $NODE" \
  k -n default logs "$NODE_DEBUG_POD"
LOGS_NODE="$(k -n default logs "$NODE_DEBUG_POD")"
run k -n default logs "$NODE_DEBUG_POD"
assert_contains "$LOGS_NODE" "kubernetes" \
  "/host/etc contains the node's own /etc/kubernetes — that is the machine's disk, not an image"

run k -n default get pod "$NODE_DEBUG_POD" -o wide
assert_eq "$(node_pod_field '.metadata.namespace')" "default" \
  "the Pod is in default, outside this lab's namespace entirely"
assert_eq "$(node_pod_field '.spec.nodeName')" "$NODE" \
  ".spec.nodeName was filled in by kubectl — the scheduler was never consulted"
assert_eq "$(node_pod_field '.spec.hostPID')" "true"     "hostPID: true"
assert_eq "$(node_pod_field '.spec.hostNetwork')" "true" "hostNetwork: true"
assert_eq "$(node_pod_field '.spec.hostIPC')" "true"     "hostIPC: true"
assert_eq "$(node_pod_field '.spec.volumes[?(@.name=="host-root")].hostPath.path')" "/" \
  "a hostPath volume named host-root maps the node's / into the Pod"
assert_eq "$(node_pod_field '.spec.containers[0].volumeMounts[?(@.name=="host-root")].mountPath')" "/host" \
  "...mounted at /host, which is why every node path you know gains a prefix"
assert_contains "$(node_pod_field '.spec.tolerations[*].operator')" "Exists" \
  "and a blanket toleration, so a cordoned or fully tainted node still gets its debugger"
assert_eq "$(node_pod_field '.spec.containers[0].securityContext.privileged')" "" \
  "with the default --profile=general the container is NOT privileged"
assert_eq "$(node_pod_field '.spec.restartPolicy')" "Never" \
  "restartPolicy: Never — it runs your command once and stays there as a completed Pod"

step "chroot /host needs --profile=sysadmin"
note "host namespaces and a mount of / are not the same thing as root on the box."
note "the general profile leaves the container unprivileged, and the Kubernetes"
note "documentation is explicit that chroot /host will fail under it."
node_debug sysadmin sh -c 'chroot /host /bin/sh -c "cat /etc/os-release" && echo CHROOT-OK'
note "the second debugger Pod: default/$NODE_DEBUG_POD"
assert_eventually_contains 300 "CHROOT-OK" \
  "chroot /host succeeded under --profile=sysadmin" \
  k -n default logs "$NODE_DEBUG_POD"
LOGS_CHROOT="$(k -n default logs "$NODE_DEBUG_POD")"
run k -n default logs "$NODE_DEBUG_POD"
assert_contains "$LOGS_CHROOT" "PRETTY_NAME" \
  "and inside the chroot we read the node's own /etc/os-release, not busybox's"
assert_eq "$(node_pod_field '.spec.containers[0].securityContext.privileged')" "true" \
  "--profile=sysadmin set privileged: true on the debug container"
note "sysadmin is the profile that turns kubectl debug node/ into something close"
note "to an ssh session. It is also the profile you should think twice about"
note "handing out: privileged plus the host's namespaces plus / at /host is root"
note "on the machine, and anyone who can create Pods on a node can already do it."

step "Cleaning up the node debuggers"
assert_eventually 120 "Succeeded" \
  "the debugger Pod has finished — and is still sitting in default, doing nothing" \
  k -n default get pod "$NODE_DEBUG_POD" -o jsonpath='{.status.phase}'
run k -n default get pod "$NODE_DEBUG_POD" -o wide
note "restartPolicy: Never means Succeeded is the end of the line. Nothing in"
note "Kubernetes garbage-collects a completed Pod that no controller owns, so"
note "both node debuggers would stay there indefinitely. This lab's trap deletes"
note "exactly the ones it created, on the failure path too. On a real cluster the"
note "chore is yours: kubectl delete pod node-debugger-<node>-xxxxx --now"

step "What this proves"
note "kubectl exec runs a program that is already in the container's image. When"
note "the image is distroless or built FROM scratch there is no program to run,"
note "and no amount of flags will change that. kubectl debug solves it by adding"
note "a container rather than a binary: an ephemeral container, with its own"
note "image, scheduled into the Pod that is already running."
note ""
note "Nothing about the Pod is disturbed. The uid, the startTime, the app's image"
note "and its restartCount were all identical afterwards, and READY stayed 1/1"
note "because an ephemeral container is not counted towards readiness. That is"
note "the whole appeal: you can debug the failing instance instead of a fresh one"
note "that may not reproduce the fault."
note ""
note "The debug container joins the Pod's network namespace automatically, but"
note "not its process namespace. Without --target, ps saw nothing; with"
note "--target=app it saw /pause as PID 1, and through /proc/1/root it could read"
note "the app's filesystem as well. --target is passed down to the container"
note "runtime, so it is the one part of this that depends on what is under the"
note "kubelet."
note ""
note "Ephemeral containers are written through a separate ephemeralcontainers"
note "subresource. That is why kubectl edit cannot add one, why the strategic"
note "patch above changed nothing, and — the part that surprises people — why"
note "they can never be removed. Every debug container you add is a permanent"
note "entry in that Pod's spec until the Pod dies."
note ""
note "kubectl debug node/<node> is a different mechanism wearing the same verb."
note "There is no ephemeral container involved: kubectl writes an ordinary Pod"
note "with .spec.nodeName already set, a blanket toleration, the host's network,"
note "PID and IPC namespaces, and the node's / mounted at /host. It bypasses the"
note "scheduler, so a cordoned or tainted node is not a problem — but it needs a"
note "working kubelet, so a node that is genuinely down is still an ssh job. And"
note "unprivileged is the default: chroot /host wants --profile=sysadmin."
note ""
note "Both halves leave litter. Ephemeral containers stay in the Pod spec; the"
note "node debugger stays as a Completed Pod in whatever namespace you happened"
note "to be in, which for most people is default. Deleting it is a manual step,"
note "and it is the step everyone forgets."
