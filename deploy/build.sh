#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# KEYFRAME — build & install step. Run from the repo root after every `git pull`.
#
#   1. Installs server production deps (server/)
#   2. Installs web deps + builds the React app → server/public/dist
#      (Express serves that dist same-origin, so frontend + API + videos are
#       all one origin. No CORS, no separate frontend host needed.)
#
# Usage:  bash deploy/build.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
log() { echo "[build] $*"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Don't let puppeteer try to download Chrome (no ARM64 build; we use system Chromium).
export PUPPETEER_SKIP_DOWNLOAD=true

log "installing server deps"
cd "$ROOT/server"
npm ci --omit=dev 2>/dev/null || npm install --omit=dev

log "installing web deps + building frontend → server/public/dist"
cd "$ROOT/web"
npm ci 2>/dev/null || npm install
npm run build

log "verifying build output"
test -f "$ROOT/server/public/dist/index.html" \
  && log "OK: server/public/dist/index.html present" \
  || { echo "[build] ERROR: dist/index.html missing"; exit 1; }

log "done. Start/restart the service:  sudo systemctl restart keyframe"
