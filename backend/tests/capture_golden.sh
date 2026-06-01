#!/usr/bin/env bash
#
# Capture golden responses for reference-level endpoints, per cohort, against a
# running backend. These snapshots are the regression baseline for the universal
# platform rearchitecture: re-run after each refactor phase and `git diff` the
# output to confirm AML/B-ALL/T-ALL behavior is unchanged.
#
# Only endpoints that work WITHOUT uploaded samples are captured here (cohort
# reference views + catalog). Sample-dependent endpoints (qc-metrics, knn,
# sample-dysregulation, cnv, molecular-predict, ...) need an uploaded+harmonized
# session and are out of scope for an unattended baseline.
#
# Usage:
#   backend/start_r_backend.sh           # in another shell
#   BASE_URL=http://127.0.0.1:5555 backend/tests/capture_golden.sh
#
# Requires: curl. Uses jq for stable (key-sorted) output if available.

set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5555}"
OUT_DIR="${OUT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/golden}"
COHORTS=("aml" "ball" "tall")

mkdir -p "$OUT_DIR"

if command -v jq >/dev/null 2>&1; then
    normalize() { jq -S . 2>/dev/null || cat; }
else
    echo "note: jq not found; saving raw JSON (key order may vary between runs)" >&2
    normalize() { cat; }
fi

capture() {
    local name="$1" path="$2"
    local out="$OUT_DIR/${name}.json"
    local tmp code
    tmp="$(mktemp)"
    printf '  %-44s ' "$name"
    # Fetch to a temp file and capture the HTTP status; only promote to a golden
    # on 200 so a failed/erroring endpoint never leaves an empty or stale file.
    code="$(curl -sS -m 60 -o "$tmp" -w '%{http_code}' "${BASE_URL}${path}" 2>/dev/null || echo 000)"
    if [ "$code" = "200" ]; then
        normalize < "$tmp" > "$out"
        echo "ok ($(wc -c < "$out" | tr -d ' ') bytes)"
    else
        rm -f "$out"
        echo "FAILED (HTTP $code)"
        echo "    GET ${BASE_URL}${path}" >&2
    fi
    rm -f "$tmp"
}

echo "Capturing golden responses from ${BASE_URL} -> ${OUT_DIR}"

# Deployment-wide (cohort-independent)
capture "catalog"                "/catalog"
capture "molecular-tools"        "/molecular-tools"
capture "sample-data-names"      "/sample-data-names"
capture "harmonized-data-names"  "/harmonized-data-names"

# Per-cohort reference views
for c in "${COHORTS[@]}"; do
    capture "tsne__${c}"                  "/tsne?disease=${c}"
    capture "harmonization-manifest__${c}" "/harmonization-manifest?disease=${c}"
    capture "molecular-tools__${c}"        "/molecular-tools?disease=${c}"
done

# AML-only reference datasets (drug response / aberrations)
capture "drug-response__aml"      "/drug-response?disease=aml"
capture "mutation-tsne__aml"      "/mutation-tsne?disease=aml"
capture "aberrations-tsne__aml"   "/aberrations-tsne?disease=aml"

echo "Done. Review with: git -C \"$OUT_DIR\" status && git diff -- \"$OUT_DIR\""
