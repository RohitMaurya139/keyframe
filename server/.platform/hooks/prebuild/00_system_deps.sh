#!/usr/bin/env bash
# Installs system deps (FFmpeg + Chromium libs + swap) and guarantees
# /home/webapp/.npm is webapp-owned so the webapp-user `npm install` works.
# Arch-aware: picks the correct FFmpeg static build for x86_64 or ARM64.
# Idempotent.

set -euo pipefail

log() { echo "[prebuild:system_deps] $*"; }

# ---------- npm cache prep (fixes EACCES from earlier failed deploys) ----------
if id -u webapp >/dev/null 2>&1; then
  WEBAPP_HOME="$(getent passwd webapp | cut -d: -f6)"
  WEBAPP_HOME="${WEBAPP_HOME:-/home/webapp}"
  mkdir -p "$WEBAPP_HOME/.npm"
  chown -R webapp:webapp "$WEBAPP_HOME/.npm"
  chmod -R u+rwX "$WEBAPP_HOME/.npm"
  log "ensured $WEBAPP_HOME/.npm is webapp-owned"
fi

if [ -e /tmp/.npm-cache ]; then
  log "clearing stale /tmp/.npm-cache"
  rm -rf /tmp/.npm-cache 2>/dev/null || chown -R 900:900 /tmp/.npm-cache 2>/dev/null || true
fi

# ---------- 2 GB swap (safety net) ----------
if ! swapon --show | grep -q '/swapfile'; then
  log "creating 2GB swapfile"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
  log "swapfile already present"
fi

# ---------- FFmpeg (arch-aware static build) ----------
if ! command -v ffmpeg >/dev/null 2>&1; then
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64)  FFURL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz" ;;
    aarch64) FFURL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz" ;;
    *) log "unsupported arch: $ARCH"; exit 1 ;;
  esac
  log "installing ffmpeg static build for $ARCH"
  TMP="$(mktemp -d)"
  curl -fsSL "$FFURL" -o "$TMP/ff.tar.xz"
  tar -xJf "$TMP/ff.tar.xz" -C "$TMP"
  cp "$TMP"/ffmpeg-*-static/ffmpeg  /usr/local/bin/
  cp "$TMP"/ffmpeg-*-static/ffprobe /usr/local/bin/
  chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe
  rm -rf "$TMP"
else
  log "ffmpeg already installed: $(ffmpeg -version | head -1)"
fi

# ---------- Chromium runtime shared libraries (Puppeteer bundles its own binary) ----------
log "installing chromium runtime libraries"
dnf install -y --setopt=install_weak_deps=False \
  nss atk at-spi2-atk cups-libs libdrm libxkbcommon \
  libXcomposite libXdamage libXrandr mesa-libgbm alsa-lib \
  pango cairo gtk3 libXScrnSaver \
  liberation-fonts dejavu-sans-fonts google-noto-sans-fonts \
  >/dev/null

# ---------- Chromium binary for website ingest (puppeteer-core needs one) ----------
# HyperFrames warms its own copy into the webapp user's puppeteer cache at
# first render; install a system chromium as the deterministic fallback that
# ingest/website.js findChrome() also checks via PUPPETEER_EXECUTABLE_PATH.
if ! command -v chromium-browser >/dev/null 2>&1 && [ ! -x /usr/bin/chromium ]; then
  log "installing chromium"
  dnf install -y chromium >/dev/null || log "WARN: chromium dnf install failed (ingest falls back to puppeteer cache)"
fi

# ---------- Python + faster-whisper (local STT for video ingest) ----------
if ! python3 -c "import faster_whisper" >/dev/null 2>&1; then
  log "installing python3 + faster-whisper"
  dnf install -y python3 python3-pip >/dev/null
  pip3 install --quiet faster-whisper || log "WARN: faster-whisper install failed (set config stt.provider to a hosted endpoint)"
else
  log "faster-whisper already installed"
fi

log "done"
