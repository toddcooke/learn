#!/usr/bin/env bash
LAB="statefulset"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# Everything this lab creates — Service, StatefulSet, Pods, and the PVCs that
# volumeClaimTemplates stamps out — is namespaced, so ns_teardown removes all
# of it. Deleting the PVCs releases their dynamically provisioned PVs, whose
# StorageClass reclaim policy is Delete. No extra cleanup trap is needed.

step "Create the headless Service and the StatefulSet"
apply web.yaml
note "podManagementPolicy defaults to OrderedReady, so the controller creates"
note "web-0 and waits for it to be Ready before it creates web-1 at all —"
note "which means we can catch the set while it is still half built"

# Poll with no pause of our own — a kubectl round trip is already ~0.1s, and
# the window we are looking for is seconds wide: web-0 has to be scheduled,
# have its PVC bound, pull an image and pass a readiness probe before web-1 is
# created at all. So the first non-empty listing is reliably web-0 on its own.
# The Pod *object* appears almost immediately, so 60s is a generous ceiling.
FIRST_SEEN=""
SS_DEADLINE=$((SECONDS + 60))
while [ $SECONDS -lt $SS_DEADLINE ]; do
  FIRST_SEEN="$(k -n "$NS" get pods -l app=web -o 'jsonpath={range .items[*]}{.metadata.name}{" "}{end}' 2>/dev/null || true)"
  if [ -n "$FIRST_SEEN" ]; then break; fi
done
assert_eq "${FIRST_SEEN% }" "web-0" "the first Pod to exist was web-0, on its own"

run k -n "$NS" rollout status statefulset/web --timeout=300s

CLUSTER_IP="$(k -n "$NS" get svc web -o jsonpath='{.spec.clusterIP}')"
assert_eq "$CLUSTER_IP" "None" "the Service is headless — no virtual IP, so DNS hands back Pod addresses"

step "Ordinal names and one PersistentVolumeClaim per Pod"
run k -n "$NS" get pods -l app=web -o wide
NAMES="$(k -n "$NS" get pods -l app=web -o 'jsonpath={range .items[*]}{.metadata.name}{" "}{end}')"
assert_eq "${NAMES% }" "web-0 web-1" "the Pods are named exactly web-0 and web-1, not <name>-<hash>-<hash>"

run k -n "$NS" get pvc
PVCS="$(k -n "$NS" get pvc -o 'jsonpath={range .items[*]}{.metadata.name}{" "}{end}')"
assert_eq "${PVCS% }" "data-web-0 data-web-1" "volumeClaimTemplates stamped out one PVC per Pod, named <template>-<pod>"
assert_eq "$(k -n "$NS" get pvc data-web-0 -o jsonpath='{.status.phase}')" "Bound" "data-web-0 is Bound"
assert_eq "$(k -n "$NS" get pvc data-web-1 -o jsonpath='{.status.phase}')" "Bound" "data-web-1 is Bound"
assert_eq "$(k -n "$NS" get pvc data-web-0 -o jsonpath='{.spec.resources.requests.storage}')" "100Mi" "each claim asked for 100Mi from the default StorageClass"
note "a Deployment cannot do this: its Pods all share one volume or none,"
note "because there is no per-replica identity to key a claim on"

step "Per-Pod DNS through the headless Service"
apply client.yaml
run k -n "$NS" wait --for=condition=Ready pod/client --timeout=180s

WEB0_IP="$(k -n "$NS" get pod web-0 -o jsonpath='{.status.podIP}')"
WEB1_IP="$(k -n "$NS" get pod web-1 -o jsonpath='{.status.podIP}')"
if [ -z "$WEB0_IP" ] || [ -z "$WEB1_IP" ]; then fail "could not read both Pod IPs"; fi
if [ "$WEB0_IP" = "$WEB1_IP" ]; then fail "web-0 and web-1 reported the same Pod IP"; fi
ok "web-0 is $WEB0_IP and web-1 is $WEB1_IP — two distinct Pods"

FQDN0="web-0.web.${NS}.svc.cluster.local"
FQDN1="web-1.web.${NS}.svc.cluster.local"
note "resolving the per-Pod names from the client Pod"
# assert_eventually_contains retries, which is what we want: the record only
# appears once the Pod is an endpoint of the Service and CoreDNS has caught up.
assert_eventually_contains 120 "$WEB0_IP" "$FQDN0 resolves to web-0's own address" \
  k -n "$NS" exec client -- nslookup "$FQDN0"
assert_eventually_contains 120 "$WEB1_IP" "$FQDN1 resolves to web-1's own address" \
  k -n "$NS" exec client -- nslookup "$FQDN1"
# Display only — the assertions above already established that this resolves.
run k -n "$NS" exec client -- nslookup "$FQDN0" || true

SVC_LOOKUP="$(k -n "$NS" exec client -- nslookup "web.${NS}.svc.cluster.local" 2>&1 || true)"
assert_contains "$SVC_LOOKUP" "$WEB0_IP" "the Service name returns the whole set, and web-0 is in it"
assert_contains "$SVC_LOOKUP" "$WEB1_IP" "the Service name returns the whole set, and web-1 is in it"
note "one name for the set, one name per member — that is what headless buys you"

ANSWERED_BY="$(k -n "$NS" exec client -- curl -sS --max-time 10 "http://${FQDN0}:8080/hostname" || true)"
assert_eq "$ANSWERED_BY" "web-0" "an HTTP request to $FQDN0:8080 was answered by the Pod that calls itself web-0"

step "Delete web-0: the replacement keeps the name, the volume, and the data"
run k -n "$NS" exec web-0 -- sh -c 'echo "written by the first web-0" > /data/id.txt'
UID_BEFORE="$(k -n "$NS" get pod web-0 -o jsonpath='{.metadata.uid}')"
NODE_BEFORE="$(k -n "$NS" get pod web-0 -o jsonpath='{.spec.nodeName}')"
VOL_BEFORE="$(k -n "$NS" get pvc data-web-0 -o jsonpath='{.spec.volumeName}')"
note "before: uid=$UID_BEFORE node=$NODE_BEFORE  data-web-0 -> $VOL_BEFORE"

run k -n "$NS" delete pod web-0
assert_eventually 300 "Running" "a Pod named web-0 exists again — the name was reused, not regenerated" \
  k -n "$NS" get pod web-0 -o 'jsonpath={.status.phase}'
run k -n "$NS" wait --for=condition=Ready pod/web-0 --timeout=300s

UID_AFTER="$(k -n "$NS" get pod web-0 -o jsonpath='{.metadata.uid}')"
NODE_AFTER="$(k -n "$NS" get pod web-0 -o jsonpath='{.spec.nodeName}')"
VOL_AFTER="$(k -n "$NS" get pvc data-web-0 -o jsonpath='{.spec.volumeName}')"
if [ "$UID_BEFORE" = "$UID_AFTER" ]; then fail "the Pod was never actually replaced — same UID"; fi
ok "it is a genuinely new Pod object (new UID) wearing the old name"
assert_eq "$VOL_AFTER" "$VOL_BEFORE" "data-web-0 is still bound to the same PV, $VOL_AFTER"
assert_eq "$NODE_AFTER" "$NODE_BEFORE" "the replacement was scheduled onto $NODE_AFTER, the node its PV is pinned to"

SEEN="$(k -n "$NS" exec web-0 -- cat /data/id.txt || true)"
assert_eq "$SEEN" "written by the first web-0" "the new web-0 read back the file its predecessor wrote"

WEB0_IP_AFTER="$(k -n "$NS" get pod web-0 -o jsonpath='{.status.podIP}')"
assert_eventually_contains 120 "$WEB0_IP_AFTER" "$FQDN0 now resolves to the replacement's address, $WEB0_IP_AFTER" \
  k -n "$NS" exec client -- nslookup "$FQDN0"
note "the name is stable; the IP behind it is not. That is exactly why peers in"
note "a StatefulSet address each other by DNS name and never by address."

step "Scale down in reverse ordinal order, and back up onto the same volume"
run k -n "$NS" scale statefulset web --replicas=1
assert_eventually 300 "web-0" "web-1 was removed first — scale-down runs highest ordinal first" \
  k -n "$NS" get pods -l app=web -o 'jsonpath={range .items[*]}{.metadata.name}{"\n"}{end}'

VOL1_BEFORE="$(k -n "$NS" get pvc data-web-1 -o jsonpath='{.spec.volumeName}')"
PVCS_AFTER="$(k -n "$NS" get pvc -o 'jsonpath={range .items[*]}{.metadata.name}{" "}{end}')"
assert_eq "${PVCS_AFTER% }" "data-web-0 data-web-1" "both PVCs survive: scaling down does not throw away data"
assert_eq "$(k -n "$NS" get pvc data-web-1 -o jsonpath='{.status.phase}')" "Bound" "data-web-1 is still Bound with no Pod using it"
note "persistentVolumeClaimRetentionPolicy defaults to Retain for both"
note "whenScaled and whenDeleted — deleting data is never the default"

run k -n "$NS" scale statefulset web --replicas=2
run k -n "$NS" rollout status statefulset/web --timeout=300s
assert_eq "$(k -n "$NS" get pvc data-web-1 -o jsonpath='{.spec.volumeName}')" "$VOL1_BEFORE" "the new web-1 reattached to its original PV, $VOL1_BEFORE"

step "What this proves"
note "A StatefulSet gives each replica an identity that outlives the Pod running"
note "it. The name web-0 is not a label on a disposable process: it is a slot,"
note "and the controller refills that slot with the same name, the same"
note "PersistentVolumeClaim, and therefore the same data on disk. The headless"
note "Service turns each slot into a DNS name, so peers can address one another"
note "individually instead of through a load balancer that would scatter their"
note "traffic. Ordered creation and reverse-ordered scale-down exist for the"
note "same reason: a quorum-based database has to know which member is joining"
note "or leaving, and it can only know that if the members are distinguishable."
note "Reach for a Deployment whenever replicas are interchangeable — and for a"
note "StatefulSet only when they genuinely are not."
