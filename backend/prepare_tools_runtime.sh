#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_TOOLS_DIR="${SRC_TOOLS_DIR:-$ROOT_DIR/tools}"
RUNTIME_DIR="${RUNTIME_DIR:-$ROOT_DIR/tools_runtime}"

log() {
  printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

need() {
  [[ -e "$1" ]] || { echo "Missing: $1" >&2; exit 1; }
}

log "Preparing runtime tool artifacts in $RUNTIME_DIR"
mkdir -p "$RUNTIME_DIR/Bridge" "$RUNTIME_DIR/ALLSorts/models" "$RUNTIME_DIR/TALLSorts/models"

# Bridge bundle (official bundle-first path)
need "$SRC_TOOLS_DIR/Bridge/bridge_inference_with_gtex1252_plus_srp03245568_healthy_balanced.bundle"
cp -f \
  "$SRC_TOOLS_DIR/Bridge/bridge_inference_with_gtex1252_plus_srp03245568_healthy_balanced.bundle" \
  "$RUNTIME_DIR/Bridge/"

# ALLSorts model artifacts
need "$SRC_TOOLS_DIR/ALLSorts/ALLSorts/models/allsorts"
rsync -a --delete \
  "$SRC_TOOLS_DIR/ALLSorts/ALLSorts/models/allsorts/" \
  "$RUNTIME_DIR/ALLSorts/models/allsorts/"

# TALLSorts model artifacts
need "$SRC_TOOLS_DIR/TALLSorts/TALLSorts/models/tallsorts"
rsync -a --delete \
  "$SRC_TOOLS_DIR/TALLSorts/TALLSorts/models/tallsorts/" \
  "$RUNTIME_DIR/TALLSorts/models/tallsorts/"

log "Done. Runtime artifacts:"
du -sh \
  "$RUNTIME_DIR/Bridge" \
  "$RUNTIME_DIR/ALLSorts/models/allsorts" \
  "$RUNTIME_DIR/TALLSorts/models/tallsorts"

