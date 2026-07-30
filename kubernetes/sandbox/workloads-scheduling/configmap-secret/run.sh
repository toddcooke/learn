#!/usr/bin/env bash
LAB="configmap-secret"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# The --from-file inputs are ordinary files on THIS machine, written below and
# thrown away at the end. ns_teardown only knows about the namespace, so
# replace its trap with one that removes the scratch directory too — and that
# runs on failure just as much as on success.
WORKDIR="$(mktemp -d)"
my_cleanup() {
  local code=$?
  # rm overwrites $?, and a non-zero status here would abort the trap under
  # set -e, so drop errexit and hand ns_teardown back the status we entered
  # with. ns_teardown reads $? to decide what the script exits with.
  set +e
  rm -rf "$WORKDIR"
  (exit "$code")
  ns_teardown
}
trap my_cleanup EXIT INT TERM

PASSWORD='s3cr3t-p@ssw0rd'

step "Three ways to fill a ConfigMap"
note "scratch directory for the --from-file inputs: $WORKDIR"

cat >"$WORKDIR/banner.txt" <<'EOF'
Welcome to the CKA sandbox.
Config loaded from a file.
EOF

cat >"$WORKDIR/app.env" <<'EOF'
# comment lines and blank lines are dropped by the env-file parser

LOG_LEVEL=debug
MAX_RETRIES=3
EOF

run k -n "$NS" create configmap app-literal \
  --from-literal=GREETING=hello-v1 \
  --from-literal=TIER=dev
run k -n "$NS" create configmap app-file --from-file="$WORKDIR/banner.txt"
run k -n "$NS" create configmap app-env --from-env-file="$WORKDIR/app.env"

assert_eq "$(k -n "$NS" get cm app-literal -o jsonpath='{.data.GREETING}')" "hello-v1" \
  "--from-literal stored GREETING with exactly the value given"

FILE_KEYS="$(k -n "$NS" get cm app-file -o go-template='{{range $k, $v := .data}}{{$k}}{{"\n"}}{{end}}')"
assert_eq "$FILE_KEYS" "banner.txt" \
  "--from-file made one key named for the file's basename, path stripped"
assert_contains "$(k -n "$NS" get cm app-file -o go-template='{{index .data "banner.txt"}}')" \
  "Config loaded from a file." \
  "and its value is the entire file body, newlines and all"

assert_eq "$(k -n "$NS" get cm app-env -o jsonpath='{.data.LOG_LEVEL}')" "debug" \
  "--from-env-file parsed the file, making LOG_LEVEL a key in its own right"
assert_eq "$(k -n "$NS" get cm app-env -o jsonpath='{.data.MAX_RETRIES}')" "3" \
  "...and MAX_RETRIES alongside it"
assert_not_contains "$(k -n "$NS" get cm app-env -o yaml)" "comment lines and blank lines" \
  "the comment line was parsed away rather than stored"

note "the same file read with --from-file is a completely different object:"
run k -n "$NS" create configmap app-env-asfile --from-file="$WORKDIR/app.env"
ASFILE_KEYS="$(k -n "$NS" get cm app-env-asfile -o go-template='{{range $k, $v := .data}}{{$k}}{{"\n"}}{{end}}')"
assert_eq "$ASFILE_KEYS" "app.env" \
  "--from-file produced ONE key holding the raw text; LOG_LEVEL is not a key at all"

step "A Secret is the same shape, for values you would rather not print"
run k -n "$NS" create secret generic db-cred \
  --from-literal=username=appuser \
  --from-literal=password="$PASSWORD"
assert_eq "$(k -n "$NS" get secret db-cred -o jsonpath='{.type}')" "Opaque" \
  "no --type given, so the Secret is Opaque — an arbitrary key/value bag"
note "the password just went through your shell history in cleartext, which is"
note "the first hint about how much protection a Secret is really offering"

step "Two Pods consuming the same key three ways"
apply consumer.yaml
apply pinned.yaml
run k -n "$NS" wait --for=condition=Ready pod/consumer --timeout=120s
run k -n "$NS" wait --for=condition=Ready pod/pinned --timeout=120s

step "What the containers see at start"
run k -n "$NS" exec consumer -- sh -c 'echo "GREETING=$GREETING TIER=$TIER APP_LOG_LEVEL=$APP_LOG_LEVEL"'
assert_eq "$(k -n "$NS" exec consumer -- sh -c 'printf "%s" "$GREETING"')" "hello-v1" \
  "envFrom turned every key of app-literal into an environment variable"
assert_eq "$(k -n "$NS" exec consumer -- sh -c 'printf "%s" "$APP_LOG_LEVEL"')" "debug" \
  "configMapKeyRef pulled one key from another ConfigMap under a new name"
run k -n "$NS" exec consumer -- ls -l /etc/appconfig
note "those entries are symlinks into a hidden ..data directory — that"
note "indirection is what lets the kubelet swap the whole config atomically"
assert_eq "$(k -n "$NS" exec consumer -- cat /etc/appconfig/GREETING)" "hello-v1" \
  "the volume mount surfaced the same key as a file"
assert_eq "$(k -n "$NS" exec pinned -- cat /etc/pinned/GREETING)" "hello-v1" \
  "and the subPath mount in the other Pod surfaced it as a standalone file"

step "Change the ConfigMap"
run k -n "$NS" patch configmap app-literal --type merge -p '{"data":{"GREETING":"hello-v2"}}'
assert_eq "$(k -n "$NS" get cm app-literal -o jsonpath='{.data.GREETING}')" "hello-v2" \
  "the stored object now says hello-v2"
assert_eq "$(k -n "$NS" get cm app-literal -o jsonpath='{.data.TIER}')" "dev" \
  "a merge patch touched only the key it named — TIER survived"
assert_eq "$(k -n "$NS" exec consumer -- sh -c 'printf "%s" "$GREETING"')" "hello-v1" \
  "but the environment variable inside the running container still says hello-v1"
note "an environment is a copy taken once, when the container was started."
note "Nothing propagates into a process environment after exec(2)."

step "The mounted file catches up; the env var and the subPath copy never do"
note "the kubelet re-projects the volume on its next periodic sync, working"
note "from its own cached copy of the ConfigMap, so the delay is the kubelet"
note "sync period plus the cache propagation delay. Waiting up to 150s."
assert_eventually 150 "hello-v2" "the mounted file /etc/appconfig/GREETING now reads hello-v2" \
  k -n "$NS" exec consumer -- cat /etc/appconfig/GREETING
assert_eq "$(k -n "$NS" get pod consumer -o jsonpath='{.status.containerStatuses[0].restartCount}')" "0" \
  "the consumer container never restarted, so nothing here is explained by a restart"
assert_eq "$(k -n "$NS" get pod pinned -o jsonpath='{.status.containerStatuses[0].restartCount}')" "0" \
  "neither did the pinned container"
assert_eq "$(k -n "$NS" exec consumer -- sh -c 'printf "%s" "$GREETING"')" "hello-v1" \
  "the environment variable is STILL hello-v1, long after the file moved on"
assert_eq "$(k -n "$NS" exec pinned -- cat /etc/pinned/GREETING)" "hello-v1" \
  "and the subPath file is still hello-v1 — subPath mounts are never refreshed"

step "Only a restart refreshes the environment"
run k -n "$NS" delete pod consumer --wait=true
apply consumer.yaml
run k -n "$NS" wait --for=condition=Ready pod/consumer --timeout=120s
assert_eq "$(k -n "$NS" exec consumer -- sh -c 'printf "%s" "$GREETING"')" "hello-v2" \
  "a fresh container read the ConfigMap again and got hello-v2"
note "for a Deployment the one-liner is: kubectl rollout restart deploy/<name>"

step "immutable: true is a one-way door"
apply immutable.yaml
if OUT="$(k -n "$NS" patch configmap app-frozen --type merge -p '{"data":{"GREETING":"try-me"}}' 2>&1)"; then
  fail "expected the API server to reject an edit to an immutable ConfigMap, but it succeeded"
fi
note "$OUT"
assert_contains "$OUT" "immutable" "the API server refused to change data"
if OUT="$(k -n "$NS" patch configmap app-frozen --type merge -p '{"immutable":false}' 2>&1)"; then
  fail "expected the API server to reject clearing the immutable flag, but it succeeded"
fi
assert_contains "$OUT" "immutable" "and refused to clear the flag itself, so there is no way back"
assert_eq "$(k -n "$NS" get cm app-frozen -o jsonpath='{.data.GREETING}')" "locked-at-creation" \
  "the stored value came through both attempts untouched"

run k -n "$NS" delete configmap app-frozen
run k -n "$NS" create configmap app-frozen --from-literal=GREETING=recreated
assert_eq "$(k -n "$NS" get cm app-frozen -o jsonpath='{.data.GREETING}')" "recreated" \
  "delete-and-recreate is the only route — and consumers need restarting too"
FROZEN_FLAG="$(k -n "$NS" get cm app-frozen -o jsonpath='{.immutable}' 2>/dev/null || true)"
assert_eq "$FROZEN_FLAG" "" \
  "the replacement carries no immutable flag: immutability belongs to the object, not the name"

step "A Secret is encoded, not encrypted"
run k -n "$NS" describe secret db-cred
DESC="$(k -n "$NS" describe secret db-cred)"
assert_not_contains "$DESC" "$PASSWORD" \
  "describe reports the size of each value and prints none of the values"
assert_contains "$DESC" "password:" "though it still tells you the key names"

ENCODED="$(k -n "$NS" get secret db-cred -o jsonpath='{.data.password}')"
note "what 'get -o yaml' hands to anyone who asks:  password: $ENCODED"
assert_not_contains "$ENCODED" "s3cr3t" "the stored form is not the literal plaintext"
DECODED="$(printf '%s' "$ENCODED" | base64 -d)"
assert_eq "$DECODED" "$PASSWORD" \
  "one 'base64 -d' brings the plaintext straight back — that is encoding, not encryption"
assert_eq "$(k -n "$NS" get secret db-cred -o go-template='{{.data.password | base64decode}}')" "$PASSWORD" \
  "kubectl will even do the decoding for you, with base64decode"
assert_eq "$(k -n "$NS" exec consumer -- cat /etc/dbcred/password)" "$PASSWORD" \
  "and mounted into the Pod it is simply a file containing the password"
note "anyone who can 'get' the Secret, and anyone who can read etcd, has the"
note "value. Real protection is RBAC plus encryption at rest — never base64."

step "What this proves"
note "How a ConfigMap is created decides its shape. --from-literal gives you the"
note "key you asked for; --from-file gives you one key per file, named for the"
note "file's basename with the path stripped; --from-env-file parses the file"
note "into one key per line. The last two can be handed the same file and"
note "produce completely different objects."
note ""
note "How a ConfigMap is consumed decides whether an update ever reaches the"
note "workload. Environment variables — envFrom or valueFrom — are a snapshot"
note "taken when the container starts, and stay wrong until something restarts"
note "the Pod. A plain volume mount tracks the object, after a delay of the"
note "kubelet sync period plus its cache propagation delay. A subPath mount is"
note "the trap: it looks like a volume mount and behaves like an environment"
note "variable."
note ""
note "immutable: true removes the question by making the object unchangeable,"
note "including the flag itself; delete and recreate is the only path."
note ""
note "And a Secret is a ConfigMap with a warning label. base64 is an encoding"
note "chosen so binary values survive JSON, not a protection mechanism."
