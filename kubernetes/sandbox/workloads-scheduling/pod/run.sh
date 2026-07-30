#!/usr/bin/env bash
LAB="pod"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

step "Create a Pod with two containers"
apply two-containers.yaml
run k -n "$NS" wait --for=condition=Ready pod/shared --timeout=120s

step "Both containers live at one Pod IP"
POD_IP="$(k -n "$NS" get pod shared -o jsonpath='{.status.podIP}')"
note "Pod IP: $POD_IP — one address for the Pod, not one per container"
run k -n "$NS" get pod shared -o jsonpath='{range .spec.containers[*]}{.name}{"\n"}{end}'

step "The sidecar reaches the server over localhost"
OUT="$(k -n "$NS" exec shared -c sidecar -- /agnhost connect --timeout=5s 127.0.0.1:8080 && echo CONNECTED)"
assert_contains "$OUT" "CONNECTED" "sidecar reached the server on localhost:8080"
note "no Service and no cluster networking involved — same network namespace"
note "the flip side: one namespace means one port space, so a second"
note "container in this Pod could not also bind :8080"

step "The volume belongs to the Pod, so both containers see it"
run k -n "$NS" exec shared -c sidecar -- sh -c 'echo "written by sidecar" > /scratch/note.txt'
SEEN="$(k -n "$NS" exec shared -c server -- cat /scratch/note.txt)"
assert_eq "$SEEN" "written by sidecar" "the server read the file the sidecar wrote"

step "What this proves"
note "A Pod is one network namespace plus a set of shared volumes, scheduled"
note "as a unit onto one node. That is why the Pod — not the container — is"
note "the smallest thing Kubernetes deploys: containers that need to share"
note "an address, a port space, or a filesystem must travel together."
