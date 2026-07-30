#!/usr/bin/env bash
LAB="helm-kustomize"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# Everything this lab creates is namespaced: the Deployments, their Pods, and
# the Secrets Helm writes to record release history all live in $NS. Nothing
# cluster-scoped is touched, so lib.sh's own ns_teardown trap is sufficient
# cleanup and this lab deliberately does not install one of its own.

step "Preflight: this lab needs the helm CLI"
command -v helm >/dev/null 2>&1 \
  || fail "helm is not installed. Install it (e.g. 'brew install helm') and re-run — the Helm half of this lab cannot be approximated with kubectl."
note "helm CLI: $(helm version --short)"
note "lib.sh's k() wrapper pins --context for kubectl, but helm is a separate"
note "binary that knows nothing about it, so every helm call below passes"
note "--kube-context $CONTEXT by hand. Forgetting that flag is the classic way"
note "to install a chart into whichever cluster your kubeconfig last pointed at."

step "Helm: install the chart that ships in this lab folder"
note "the chart is chart/ next to this script — no repo added, nothing fetched"
run helm --kube-context "$CONTEXT" -n "$NS" install demo "$LAB_DIR/chart"
run k -n "$NS" rollout status deploy/demo-hello --timeout=180s

REV1_REPLICAS="$(k -n "$NS" get deploy demo-hello -o jsonpath='{.spec.replicas}')"
assert_eq "$REV1_REPLICAS" "1" "revision 1 rendered replicaCount: 1 straight out of values.yaml"

RELEASES="$(helm --kube-context "$CONTEXT" -n "$NS" list -q)"
assert_contains "$RELEASES" "demo" "helm list reports a release named 'demo'"

REVS="$(helm --kube-context "$CONTEXT" -n "$NS" history demo --max 50 -o json | grep -o '"revision":' | wc -l | tr -d ' ' || true)"
assert_eq "$REVS" "1" "helm history shows 1 revision after install"

step "Where the release actually lives"
run k -n "$NS" get secret -l owner=helm
SECRETS="$(k -n "$NS" get secret -l owner=helm -o name | wc -l | tr -d ' ' || true)"
assert_eq "$SECRETS" "$REVS" "one Secret of type helm.sh/release.v1 per revision, in the release namespace"
note "that Secret is the entire release database. There is no Helm server and"
note "no state on your laptop: another engineer with kubectl access to this"
note "namespace sees exactly the same history you do."

step "Helm: upgrade by overriding a value"
run helm --kube-context "$CONTEXT" -n "$NS" upgrade demo "$LAB_DIR/chart" --set replicaCount=3
run k -n "$NS" rollout status deploy/demo-hello --timeout=180s

UPGRADED_REPLICAS="$(k -n "$NS" get deploy demo-hello -o jsonpath='{.spec.replicas}')"
assert_eq "$UPGRADED_REPLICAS" "3" "--set replicaCount=3 re-rendered the template to 3 replicas"

REVS="$(helm --kube-context "$CONTEXT" -n "$NS" history demo --max 50 -o json | grep -o '"revision":' | wc -l | tr -d ' ' || true)"
assert_eq "$REVS" "2" "helm history shows 2 revisions after the upgrade"

USER_VALUES="$(helm --kube-context "$CONTEXT" -n "$NS" get values demo)"
assert_contains "$USER_VALUES" "replicaCount: 3" "the release records the override the caller supplied"
note "nothing on disk changed — values.yaml still says replicaCount: 1. The 3"
note "lives in the release record, which is why 'helm get values' exists at all."

step "Helm: history and rollback"
run helm --kube-context "$CONTEXT" -n "$NS" history demo
run helm --kube-context "$CONTEXT" -n "$NS" rollback demo 1
run k -n "$NS" rollout status deploy/demo-hello --timeout=180s

ROLLED_BACK_REPLICAS="$(k -n "$NS" get deploy demo-hello -o jsonpath='{.spec.replicas}')"
assert_eq "$ROLLED_BACK_REPLICAS" "$REV1_REPLICAS" "the rolled-back Deployment matches revision 1's replica count ($REV1_REPLICAS)"

REVS="$(helm --kube-context "$CONTEXT" -n "$NS" history demo --max 50 -o json | grep -o '"revision":' | wc -l | tr -d ' ' || true)"
assert_eq "$REVS" "3" "rollback appended revision 3 — it did not delete revision 2"

MANIFEST_1="$(helm --kube-context "$CONTEXT" -n "$NS" get manifest demo --revision 1)"
assert_contains "$MANIFEST_1" "replicas: 1" "revision 1's stored manifest still says replicas: 1"
MANIFEST_2="$(helm --kube-context "$CONTEXT" -n "$NS" get manifest demo --revision 2)"
assert_contains "$MANIFEST_2" "replicas: 3" "revision 2's stored manifest still says replicas: 3"
note "rollback replays the manifest Helm archived at revision 1. It does not"
note "re-render the chart, so a rollback is unaffected by later chart edits."

step "Helm: uninstall removes the objects and the release record together"
run helm --kube-context "$CONTEXT" -n "$NS" uninstall demo
assert_eventually 90 "" "the Deployment Helm created is gone" \
  k -n "$NS" get deploy demo-hello --ignore-not-found -o name

LEFTOVER="$(helm --kube-context "$CONTEXT" -n "$NS" list -q || true)"
assert_not_contains "$LEFTOVER" "demo" "helm list no longer reports the release"

SECRETS="$(k -n "$NS" get secret -l owner=helm -o name | wc -l | tr -d ' ' || true)"
assert_eq "$SECRETS" "0" "all three revision Secrets were purged too"

if HIST_OUT="$(helm --kube-context "$CONTEXT" -n "$NS" history demo 2>&1)"; then
  fail "expected 'helm history' to fail once the release was uninstalled"
fi
assert_contains "$HIST_OUT" "not found" "the history went with the release (pass --keep-history to retain it)"

step "Kustomize: apply the base, which is ordinary apply-able YAML"
run k -n "$NS" apply -k "$LAB_DIR/base"
run k -n "$NS" rollout status deploy/hello --timeout=180s

BASE_REPLICAS="$(k -n "$NS" get deploy hello -o jsonpath='{.spec.replicas}')"
assert_eq "$BASE_REPLICAS" "1" "the base Deployment runs the 1 replica its file declares"
BASE_LABELS="$(k -n "$NS" get deploy hello -o jsonpath='{.metadata.labels}')"
assert_not_contains "$BASE_LABELS" "tier" "the base carries no tier label"

step "Kustomize: the prod overlay layers patches onto that same base"
run k -n "$NS" apply -k "$LAB_DIR/overlays/prod"
run k -n "$NS" rollout status deploy/prod-hello --timeout=180s

PROD_REPLICAS="$(k -n "$NS" get deploy prod-hello -o jsonpath='{.spec.replicas}')"
assert_eq "$PROD_REPLICAS" "3" "the overlay's strategic-merge patch set replicas: 3"

PROD_LABELS="$(k -n "$NS" get deploy prod-hello -o jsonpath='{.metadata.labels}')"
assert_contains "$PROD_LABELS" '"tier":"production"' "the overlay stamped its common label onto the Deployment"
assert_contains "$PROD_LABELS" '"app":"hello"' "and the base's own label survived alongside it"

PROD_SELECTOR="$(k -n "$NS" get deploy prod-hello -o jsonpath='{.spec.selector.matchLabels}')"
assert_not_contains "$PROD_SELECTOR" "tier" "includeSelectors defaulted to false, so the immutable selector was left alone"

BASE_REPLICAS_AFTER="$(k -n "$NS" get deploy hello -o jsonpath='{.spec.replicas}')"
assert_eq "$BASE_REPLICAS_AFTER" "1" "applying the overlay did not disturb the base Deployment"
BASE_LABELS_AFTER="$(k -n "$NS" get deploy hello -o jsonpath='{.metadata.labels}')"
assert_not_contains "$BASE_LABELS_AFTER" "tier" "and did not label it either"
run k -n "$NS" get deploy

step "Templating versus patching, side by side"
RENDERED="$(helm --kube-context "$CONTEXT" -n "$NS" template demo "$LAB_DIR/chart" --set replicaCount=7)"
assert_contains "$RENDERED" "replicas: 7" "helm template produced a value that appears in no file on disk"

BUILT="$(k kustomize "$LAB_DIR/overlays/prod")"
assert_contains "$BUILT" "name: prod-hello" "kustomize build applied namePrefix"
assert_contains "$BUILT" "replicas: 3" "kustomize build applied the replica patch"
assert_contains "$BUILT" "tier: production" "kustomize build applied the common label"
note "both commands render locally and print YAML. The difference is the input:"
note "helm evaluated a template language, kustomize merged two plain manifests."

run k -n "$NS" apply --dry-run=client -f "$LAB_DIR/base/deployment.yaml"
if TPL_OUT="$(k -n "$NS" apply --dry-run=client -f "$LAB_DIR/chart/templates/deployment.yaml" 2>&1)"; then
  fail "expected kubectl to reject the raw chart template"
fi
assert_contains "$TPL_OUT" "error" "kubectl cannot parse chart/templates/deployment.yaml — it is Go template text, not YAML"

step "What this proves"
note "Helm and Kustomize solve the same problem — one app, many environments —"
note "with opposite mechanics, and the difference is visible in the source files."
note ""
note "Helm templates. chart/templates/deployment.yaml is Go template text that"
note "kubectl refuses to parse; only 'helm template' or an install turns it into"
note "a manifest. Values flow in from values.yaml, -f files and --set, so a chart"
note "can express variation its author never anticipated — at the cost of source"
note "no other Kubernetes tool can read, and of a values contract you must learn."
note ""
note "Helm also tracks releases. install, upgrade and rollback each append a"
note "revision, stored as a Secret of type helm.sh/release.v1 in the release"
note "namespace: install gave 1 revision, --set replicaCount=3 gave 2, and"
note "rolling back to revision 1 gave 3 — a new revision replaying revision 1's"
note "archived manifest, not a deletion of revision 2. That release record is"
note "what makes 'uninstall' able to delete precisely what it created, and why"
note "uninstalling drops the history unless you pass --keep-history."
note ""
note "Kustomize patches. base/deployment.yaml is a finished manifest that"
note "kubectl accepts on its own; overlays/prod adds a name prefix, a label and"
note "a two-line replica patch without editing a byte of it. There is no"
note "templating language and no release object: 'kubectl apply -k' renders the"
note "overlay and applies the result, so what the cluster sees is ordinary YAML"
note "and what you track is git. The base kept 1 replica and no tier label while"
note "the overlay ran 3 with tier=production, from one source of truth."
note ""
note "Rule of thumb: Kustomize for variation you own and can enumerate; Helm for"
note "software you ship to strangers, or when you want revisions and rollback."
