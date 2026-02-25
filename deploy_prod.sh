#!/usr/bin/env bash

set -euo pipefail

# Production deploy script for Celvox (PM2-managed backend + static frontend build)
# Defaults match the current PM2 ecosystem and R startup scripts.

DEPLOY_ROOT="${DEPLOY_ROOT:-/root/celvox.co}"
BACKEND_DIR="${BACKEND_DIR:-$DEPLOY_ROOT/backend}"
SERVICE_DIR="${SERVICE_DIR:-$BACKEND_DIR/service}"
FRONTEND_DIR="${FRONTEND_DIR:-$DEPLOY_ROOT/vite-project}"
ECOSYSTEM_FILE="${ECOSYSTEM_FILE:-$SERVICE_DIR/ecosystem.config.js}"

MAMBA_ROOT_PREFIX="${MAMBA_ROOT_PREFIX:-/root/micromamba}"
R_ENV_PREFIX="${R_ENV_PREFIX:-$MAMBA_ROOT_PREFIX/envs/celvox_env}"
R_BIN="${R_BIN:-$R_ENV_PREFIX/bin/Rscript}"
R_CMD="${R_CMD:-$R_ENV_PREFIX/bin/R}"
MICROMAMBA_BIN="${MICROMAMBA_BIN:-$(command -v micromamba 2>/dev/null || true)}"

MOLECULAR_PYTHON="${MOLECULAR_PYTHON:-/root/.local/share/mamba/envs/molecular_diag_py310/bin/python}"
FRONTEND_PUBLISH_DIR="${FRONTEND_PUBLISH_DIR:-}"

SKIP_PULL=0
SKIP_FRONTEND=0
SKIP_R_DEPS=0
SKIP_PY_EDITABLE=0
NO_PM2_RESTART=0

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

die() {
  printf '\n[ERROR] %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: ./deploy_prod.sh [options]

Options:
  --skip-pull          Skip git fetch/pull
  --skip-frontend      Skip frontend build (and publish)
  --skip-r-deps        Skip micromamba R package install + ALLCatchR package install
  --skip-py-editable   Skip editable reinstall of ALLSorts/TALLSorts
  --no-pm2-restart     Skip PM2 restart/save
  -h, --help           Show this help

Optional env vars:
  DEPLOY_ROOT=/root/celvox.co
  FRONTEND_PUBLISH_DIR=/var/www/celvox   (if set, rsync dist/ there)
  MICROMAMBA_BIN=/opt/homebrew/bin/micromamba
  R_ENV_PREFIX=/root/micromamba/envs/celvox_env
  MOLECULAR_PYTHON=/root/.local/share/mamba/envs/molecular_diag_py310/bin/python
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-pull) SKIP_PULL=1 ;;
    --skip-frontend) SKIP_FRONTEND=1 ;;
    --skip-r-deps) SKIP_R_DEPS=1 ;;
    --skip-py-editable) SKIP_PY_EDITABLE=1 ;;
    --no-pm2-restart) NO_PM2_RESTART=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
  shift
done

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

require_path() {
  [[ -e "$1" ]] || die "Missing required path: $1"
}

log "Checking prerequisites"
require_cmd git
require_cmd npm
require_cmd pm2
require_cmd curl
if [[ $SKIP_FRONTEND -eq 0 || -n "$FRONTEND_PUBLISH_DIR" ]]; then
  require_cmd rsync
fi
require_path "$DEPLOY_ROOT"
require_path "$BACKEND_DIR"
require_path "$SERVICE_DIR"
if [[ $SKIP_FRONTEND -eq 0 ]]; then
  require_path "$FRONTEND_DIR"
fi
require_path "$ECOSYSTEM_FILE"
if [[ $SKIP_R_DEPS -eq 0 ]]; then
  require_path "$R_BIN"
  require_path "$R_CMD"
  [[ -n "$MICROMAMBA_BIN" ]] || die "MICROMAMBA_BIN is not set and micromamba is not on PATH"
  require_path "$MICROMAMBA_BIN"
fi
if [[ $SKIP_PY_EDITABLE -eq 0 ]]; then
  require_path "$MOLECULAR_PYTHON"
fi

log "Checking required molecular tool folders"
require_path "$BACKEND_DIR/tools/AMLmapR" # AMLmapR still runs from package source assets
require_path "$BACKEND_DIR/tools_runtime/Bridge/bridge_inference_with_gtex1252_plus_srp03245568_healthy_balanced.bundle"
require_path "$BACKEND_DIR/tools_runtime/ALLSorts/models/allsorts/allsorts.pkl.gz"
require_path "$BACKEND_DIR/tools_runtime/TALLSorts/models/tallsorts/tallsorts_default_model.pkl.gz"

if [[ $SKIP_R_DEPS -eq 0 ]]; then
  require_path "$BACKEND_DIR/tools/ALLCatchR_bcrabl1"
fi

if [[ $SKIP_PY_EDITABLE -eq 0 ]]; then
  require_path "$BACKEND_DIR/tools/ALLSorts"
  require_path "$BACKEND_DIR/tools/TALLSorts"
fi

if [[ $SKIP_PULL -eq 0 ]]; then
  log "Pulling latest code"
  cd "$DEPLOY_ROOT"
  git fetch --all --prune
  git pull
fi

log "Building backend Node service"
cd "$SERVICE_DIR"
npm ci
npm run build

if [[ $SKIP_R_DEPS -eq 0 ]]; then
  log "Installing/updating R dependencies for ALLCatchR_bcrabl1 in celvox_env"
  "$MICROMAMBA_BIN" install -y -p "$R_ENV_PREFIX" -c conda-forge -c bioconda \
    r-kknn r-ranger r-glmnet r-liblinear bioconductor-singscore

  log "Installing ALLCatchR_bcrabl1 R package"
  "$R_CMD" CMD INSTALL "$BACKEND_DIR/tools/ALLCatchR_bcrabl1"
fi

if [[ $SKIP_PY_EDITABLE -eq 0 ]]; then
  log "Reinstalling ALLSorts/TALLSorts editable packages in molecular Python env"
  "$MOLECULAR_PYTHON" -m pip install --no-deps -e "$BACKEND_DIR/tools/ALLSorts" -e "$BACKEND_DIR/tools/TALLSorts"
fi

if [[ $SKIP_FRONTEND -eq 0 ]]; then
  log "Building frontend"
  cd "$FRONTEND_DIR"
  npm ci
  npm run build

  if [[ -n "$FRONTEND_PUBLISH_DIR" ]]; then
    log "Publishing frontend dist to $FRONTEND_PUBLISH_DIR"
    mkdir -p "$FRONTEND_PUBLISH_DIR"
    rsync -a --delete "$FRONTEND_DIR/dist/" "$FRONTEND_PUBLISH_DIR/"
  else
    log "FRONTEND_PUBLISH_DIR not set; skipping frontend publish copy"
  fi
fi

if [[ $NO_PM2_RESTART -eq 0 ]]; then
  log "Restarting PM2 apps"
  cd "$SERVICE_DIR"
  pm2 restart "$ECOSYSTEM_FILE" --only celvox-service --env production
  pm2 restart "$ECOSYSTEM_FILE" --only celvox-r-backend --env production
  pm2 save
fi

log "Running smoke checks"
curl -fsS "http://127.0.0.1:3001/" >/dev/null
curl -fsS "http://127.0.0.1:5555/__docs__/" >/dev/null
curl -fsS "http://127.0.0.1:5555/molecular-tools?disease=ball" >/dev/null

log "Deploy complete"
echo "Backend: http://127.0.0.1:3001/"
echo "R API docs: http://127.0.0.1:5555/__docs__/"
