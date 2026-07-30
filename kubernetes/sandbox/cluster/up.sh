#!/usr/bin/env bash
# Create the shared sandbox cluster and install the add-ons some labs need.
#
#   ./up.sh              cluster + metrics-server + ingress-nginx
#   ./up.sh --minimal    cluster only (faster; the hpa and ingress labs
#                        will refuse to run)
#
# Safe to re-run: an existing cluster is reused and the add-ons are
# re-checked rather than reinstalled from scratch.
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh

MINIMAL=0
[ "${1:-}" = "--minimal" ] && MINIMAL=1

METRICS_URL="https://github.com/kubernetes-sigs/metrics-server/releases/download/v0.9.0/components.yaml"
# kind's own frozen copy of ingress-nginx. Upstream kubernetes/ingress-nginx
# is retired and its repo archived, so this URL is the durable one.
INGRESS_URL="https://kind.sigs.k8s.io/examples/ingress/deploy-ingress-nginx.yaml"

docker info >/dev/null 2>&1 || fail "Docker is not running. Start Docker Desktop and try again."
command -v kind >/dev/null 2>&1 || fail "kind is not installed. brew install kind"

step "Create the kind cluster"
if kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
  note "cluster '$CLUSTER_NAME' already exists — reusing it"
else
  note "the first run pulls a ~1GB node image; later runs reuse the cache"
  run kind create cluster --config ./kind-config.yaml --wait 180s
fi
run k get nodes

if [ "$MINIMAL" = "1" ]; then
  step "Skipping add-ons (--minimal)"
  note "the hpa and ingress labs will refuse to run until you re-run without --minimal"
  note "NetworkPolicy needs no add-on — kind's default CNI enforces it"
  exit 0
fi

step "Install metrics-server (kubectl top, and the hpa lab)"
run k apply -f "$METRICS_URL"
# kind's kubelet serves a self-signed certificate with no IP SANs, so the
# scrape fails with an x509 error until --kubelet-insecure-tls is added and
# the Pod sits at 0/1 Running forever.
#
# The patch lists the full args array rather than appending one element,
# because a JSON `add` op is not idempotent: re-running up.sh would append
# the flag a second time and force a pointless rollout.
#
# --kubelet-preferred-address-types is deliberately absent. It is the most
# commonly repeated piece of advice here and it is already in the shipped
# manifest, so adding it does nothing.
run k -n kube-system patch deployment metrics-server -p '{"spec":{"template":{"spec":{"containers":[{"name":"metrics-server","args":["--cert-dir=/tmp","--secure-port=10250","--kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname","--kubelet-use-node-status-port","--metric-resolution=15s","--kubelet-insecure-tls"]}]}}}}'
run k -n kube-system rollout status deployment/metrics-server --timeout=180s

step "Install ingress-nginx (the ingress lab)"
run k apply -f "$INGRESS_URL"
run k -n ingress-nginx wait --for=condition=ready pod \
  -l app.kubernetes.io/component=controller --timeout=300s

step "Ready"
run k get nodes
note "NetworkPolicy needs no add-on — kind's default CNI enforces it."
note "Run a lab with: bash <domain>/<lab>/run.sh"
note "Tear the cluster down with: cluster/down.sh"
