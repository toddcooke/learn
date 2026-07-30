#!/usr/bin/env bash
# Delete the sandbox cluster. The node image stays in Docker's cache, so
# the next up.sh is much faster than the first.
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh

step "Delete the sandbox cluster"
if kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
  run kind delete cluster --name "$CLUSTER_NAME"
  note "gone. The node image stays cached, so the next up.sh is fast."
else
  note "no cluster named '$CLUSTER_NAME' — nothing to do"
fi
