#!/usr/bin/env bash
LAB="init-sidecar"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

step "Two init containers, run one at a time, each to completion"
apply init-order.yaml
note "each init container sleeps 12s, so the status column can be caught in the act"
assert_eventually_contains 180 "Init:0/2" \
  "the status column read Init:0/2 — none of the two init containers has finished yet" \
  k -n "$NS" get pod init-order --no-headers
assert_eventually_contains 180 "PodInitializing" \
  "meanwhile the app container is Waiting, with reason PodInitializing" \
  k -n "$NS" get pod init-order -o jsonpath='{.status.containerStatuses[*].state.waiting.reason}'
assert_eventually_contains 180 "Init:1/2" \
  "the status advanced to Init:1/2 — the first one exited, the second is now running" \
  k -n "$NS" get pod init-order --no-headers
run k -n "$NS" get pod init-order
note "the counter is 'how many have completed', not 'how many are running': only"
note "ever one init container is running at a time, which is why the column never"
note "reads Init:2/2 — the Pod leaves initialization the moment the last one exits."
run k -n "$NS" wait --for=condition=Ready pod/init-order --timeout=180s

step "The app container started after both init containers had finished"
assert_eq "$(k -n "$NS" get pod init-order -o jsonpath='{.status.initContainerStatuses[*].state.terminated.exitCode}')" \
  "0 0" "both init containers are in state terminated with exit code 0"
INIT1_END="$(k -n "$NS" get pod init-order -o jsonpath='{.status.initContainerStatuses[?(@.name=="fetch-config")].state.terminated.finishedAt}')"
INIT2_END="$(k -n "$NS" get pod init-order -o jsonpath='{.status.initContainerStatuses[?(@.name=="warm-cache")].state.terminated.finishedAt}')"
APP_START="$(k -n "$NS" get pod init-order -o jsonpath='{.status.containerStatuses[?(@.name=="app")].state.running.startedAt}')"
if [ -z "$INIT1_END" ] || [ -z "$INIT2_END" ] || [ -z "$APP_START" ]; then
  fail "could not read all three timestamps (got '$INIT1_END', '$INIT2_END', '$APP_START')"
fi
note "fetch-config terminated.finishedAt = $INIT1_END"
note "warm-cache   terminated.finishedAt = $INIT2_END"
note "app          running.startedAt     = $APP_START"
note "these are RFC 3339, always UTC, always the same width — so comparing them"
note "as plain strings is a valid comparison of instants."
if [[ ! "$INIT1_END" < "$INIT2_END" ]]; then
  fail "fetch-config did not finish strictly before warm-cache: $INIT1_END vs $INIT2_END"
fi
ok "fetch-config finished strictly before warm-cache — they did not overlap"
if [[ ! "$APP_START" > "$INIT1_END" ]]; then
  fail "the app container started before the first init container finished: $APP_START vs $INIT1_END"
fi
ok "the app container started strictly later than fetch-config finished"
if [[ "$APP_START" < "$INIT2_END" ]]; then
  fail "the app container started before the last init container finished: $APP_START vs $INIT2_END"
fi
ok "the app container did not start before warm-cache finished"
note "the last check is 'not earlier' rather than 'strictly later' on purpose:"
note "these timestamps have one-second resolution, and the kubelet routinely"
note "starts the app container inside the same second the final init container"
note "exited. The ordering is real; the clock is just too coarse to show it."

step "The init containers' work is waiting for the app container"
SEEN="$(k -n "$NS" exec init-order -c app -- sh -c 'cat /work/config /work/cache' | tr '\n' ' ')"
assert_contains "$SEEN" "listen=8080" "the app container reads the file fetch-config wrote"
assert_contains "$SEEN" "warm" "and the file warm-cache wrote"
run k -n "$NS" logs init-order -c warm-cache
note "warm-cache read fetch-config's file on its own first line. Had the two run"
note "concurrently it would have exited 1 and the Pod would never have come up."

step "A native sidecar is an init container with restartPolicy: Always"
apply sidecar-pod.yaml
run k -n "$NS" wait --for=condition=Ready pod/sidecar --timeout=180s
assert_eq "$(k -n "$NS" get pod sidecar -o jsonpath='{.spec.initContainers[*].name}')" "log-shipper" \
  "log-shipper is declared under .spec.initContainers"
assert_eq "$(k -n "$NS" get pod sidecar -o jsonpath='{.spec.initContainers[?(@.name=="log-shipper")].restartPolicy}')" "Always" \
  "its restartPolicy is Always — that one field is the whole feature"
assert_eq "$(k -n "$NS" get pod sidecar -o jsonpath='{.spec.containers[*].name}')" "app" \
  "the only regular container is app"
run k -n "$NS" get pod sidecar
assert_eventually_contains 120 "Running" \
  "the STATUS column reads Running, not Init:0/1 — a started sidecar is not 'initializing'" \
  k -n "$NS" get pod sidecar --no-headers

step "The sidecar and the app container are running at the same instant"
SNAP="$(k -n "$NS" get pod sidecar -o jsonpath='{.status.initContainerStatuses[*].state}|{.status.containerStatuses[*].state}')"
SIDE_STATE="${SNAP%%|*}"
APP_STATE="${SNAP##*|}"
note "one API read, both states as of that single moment:"
note "  log-shipper (init) : $SIDE_STATE"
note "  app (regular)      : $APP_STATE"
assert_contains "$SIDE_STATE" "running" "the sidecar is running"
assert_not_contains "$SIDE_STATE" "terminated" "and has not terminated — a plain init container would have"
assert_contains "$APP_STATE" "running" "the app container is running at that same moment"
assert_not_contains "$(k -n "$NS" get pod sidecar -o jsonpath='{.status.containerStatuses[*].name}')" "log-shipper" \
  "however long it runs, the sidecar is reported under initContainerStatuses only"
note "a dashboard or script that scrapes .status.containerStatuses will not see"
note "your sidecars at all — they never move out of the init list."

step "The sidecar still went first"
SIDE_START="$(k -n "$NS" get pod sidecar -o jsonpath='{.status.initContainerStatuses[?(@.name=="log-shipper")].state.running.startedAt}')"
APP_START2="$(k -n "$NS" get pod sidecar -o jsonpath='{.status.containerStatuses[?(@.name=="app")].state.running.startedAt}')"
if [ -z "$SIDE_START" ] || [ -z "$APP_START2" ]; then
  fail "could not read both startedAt values (got '$SIDE_START', '$APP_START2')"
fi
note "log-shipper running.startedAt = $SIDE_START"
note "app         running.startedAt = $APP_START2"
if [[ ! "$APP_START2" > "$SIDE_START" ]]; then
  fail "the app container did not start after the sidecar: $APP_START2 vs $SIDE_START"
fi
ok "the app container started strictly later than the sidecar"
assert_eq "$(k -n "$NS" get pod sidecar -o jsonpath='{.status.containerStatuses[?(@.name=="app")].restartCount}')" "0" \
  "the app container never crashed, so it found the sidecar's file on its first try"
note "the app container's command exits 1 unless /shared/shipper-up exists, and"
note "the sidecar's startupProbe is what gates that file. restartCount 0 means"
note "the kubelet really did hold the app back until the sidecar had started —"
note "and probes are themselves a sidecar-only privilege: a plain init container"
note "may not declare one."
OUT="$(k -n "$NS" exec sidecar -c app -- /agnhost connect --timeout=5s 127.0.0.1:9090 && echo CONNECTED)"
assert_contains "$OUT" "CONNECTED" "the app container reached the sidecar's port while both were running"

step "In a Job, a sidecar does not block completion — a regular container does"
apply sidecar-job.yaml
apply blocking-job.yaml
note "identical Pods apart from where log-shipper is declared"
run k -n "$NS" wait --for=condition=Complete job/with-sidecar --timeout=180s
assert_eq "$(k -n "$NS" get job with-sidecar -o jsonpath='{.status.succeeded}')" "1" \
  "with-sidecar completed even though its log shipper runs forever"
note "when main exited, the kubelet tore the sidecar down for it, in reverse"
note "declaration order, and the Pod reached Succeeded."
assert_eventually_contains 120 "no-sidecar-" "the no-sidecar Job created its Pod" \
  k -n "$NS" get pods -l batch.kubernetes.io/job-name=no-sidecar -o jsonpath='{.items[*].metadata.name}'
BLOCK_POD="$(k -n "$NS" get pods -l batch.kubernetes.io/job-name=no-sidecar -o jsonpath='{.items[0].metadata.name}')"
assert_eventually_contains 180 "terminated" \
  "in the no-sidecar Pod, main has terminated — the work is finished there too" \
  k -n "$NS" get pod "$BLOCK_POD" -o jsonpath='{.status.containerStatuses[?(@.name=="main")].state}'
BSNAP="$(k -n "$NS" get pod "$BLOCK_POD" -o jsonpath='{.status.phase}|{.status.containerStatuses[?(@.name=="log-shipper")].state}')"
assert_eq "${BSNAP%%|*}" "Running" "yet the Pod is still Running"
assert_contains "${BSNAP##*|}" "running" \
  "because log-shipper, declared as a regular container, is still up"
assert_eq "$(k -n "$NS" get job no-sidecar -o jsonpath='{.status.succeeded}')" "" \
  "no-sidecar has recorded no successes"
assert_eventually 60 "1" "and still counts one active Pod, indefinitely" \
  k -n "$NS" get job no-sidecar -o jsonpath='{.status.active}'
run k -n "$NS" get jobs
run k -n "$NS" get pods

step "What this proves"
note "Init containers are the Pod's serialised prologue: one at a time, in"
note "declaration order, each run to a successful exit before the next begins,"
note "and no regular container is started until the last of them is done. That"
note "is not a scheduling nicety you have to trust — it is legible in the status"
note "column as Init:0/2 then Init:1/2, and in the timestamps, where the app"
note "container's state.running.startedAt is later than every init container's"
note "state.terminated.finishedAt."
note ""
note "A native sidecar keeps the position and drops the deadline. It is still an"
note "entry in .spec.initContainers, so it still starts before every regular"
note "container, but restartPolicy: Always tells the kubelet not to wait for it"
note "to exit and to keep it alive for the life of the Pod — so the sidecar and"
note "the app report state.running in the same API read. Because it is an init"
note "container it may also carry probes, which a plain init container may not,"
note "and its startupProbe is a real gate on when the app container starts."
note ""
note "The payoff is Job completion. A Pod is Succeeded only when every regular"
note "container has terminated, so a companion process declared as an ordinary"
note "container pins a batch Pod in Running forever. Move the same container,"
note "unchanged, into .spec.initContainers with restartPolicy: Always and the"
note "kubelet shuts it down once the main container exits: with-sidecar reached"
note "succeeded=1 while no-sidecar sat there active=1, both still running their"
note "identical log shipper. Sidecars are stable as of Kubernetes 1.33, so this"
note "is the answer to 'my Job never finishes' on any current cluster."
