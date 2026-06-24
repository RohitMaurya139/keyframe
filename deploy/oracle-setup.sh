#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# KEYFRAME — one-shot provisioning for an Oracle Cloud "Always Free" Ubuntu VM.
#
#   Recommended shape (free, always-on):
#     • Ampere A1 (ARM64), 4 OCPU / 24 GB RAM, Ubuntu 22.04
#     • This is the ONLY Always-Free shape with enough RAM to render.
#       (The AMD Micro shapes have just 1 GB — too small for Chromium.)
#
# Installs: Node 22, FFmpeg, Chromium + its runtime libs, fonts, a 4 GB swap
# safety net, and (optionally) python3 + faster-whisper for local video STT.
# Mirrors server/.platform/hooks/prebuild/*  (the AWS EB setup) but for apt.
#
# Idempotent — safe to re-run. Run as a sudo-capable user (e.g. `ubuntu`):
#     bash deploy/oracle-setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
log() { echo "[oracle-setup] $*"; }

export DEBIAN_FRONTEND=noninteractive
ARCH="$(uname -m)"
log "architecture: $ARCH"

# ── 4 GB swap (rendering spikes RAM; cheap insurance even on the 24 GB box) ──
if ! swapon --show | grep -q '/swapfile'; then
  log "creating 4GB swapfile"
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
else
  log "swapfile already present"
fi

# ── Base packages ──
log "apt update + base packages"
sudo apt-get update -y
sudo apt-get install -y curl ca-certificates gnupg xz-utils fontconfig

# ── Node.js 22 (package.json requires >=22) ──
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  log "installing Node.js 22 via NodeSource"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  log "node already present: $(node --version)"
fi

# ── FFmpeg (arch-aware static build — same source as the EB hook) ──
if ! command -v ffmpeg >/dev/null 2>&1; then
  case "$ARCH" in
    x86_64)  FFURL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz" ;;
    aarch64) FFURL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz" ;;
    *) log "unsupported arch for static ffmpeg: $ARCH — trying apt"; sudo apt-get install -y ffmpeg; FFURL="" ;;
  esac
  if [ -n "${FFURL:-}" ]; then
    log "installing ffmpeg static build for $ARCH"
    TMP="$(mktemp -d)"
    curl -fsSL "$FFURL" -o "$TMP/ff.tar.xz"
    tar -xJf "$TMP/ff.tar.xz" -C "$TMP"
    sudo cp "$TMP"/ffmpeg-*-static/ffmpeg  /usr/local/bin/
    sudo cp "$TMP"/ffmpeg-*-static/ffprobe /usr/local/bin/
    sudo chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe
    rm -rf "$TMP"
  fi
else
  log "ffmpeg already installed: $(ffmpeg -version | head -1)"
fi

# ── Chromium runtime shared libraries (apt equivalents of the EB dnf list) ──
log "installing Chromium runtime libraries + fonts"
sudo apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2 libpango-1.0-0 \
  libcairo2 libgtk-3-0 libxshmfence1 libnspr4 libxss1 libx11-xcb1 \
  fonts-liberation fonts-dejavu fonts-noto-core fonts-noto-color-emoji

# Roboto (composer's primary webfont) so server-side Chromium renders text as expected.
FONT_DIR="/usr/share/fonts/webfonts"
sudo mkdir -p "$FONT_DIR"
for f in Roboto-Regular Roboto-Bold; do
  if [ ! -f "$FONT_DIR/$f.ttf" ]; then
    sudo curl -fsSL "https://github.com/googlefonts/roboto/raw/main/src/hinted/$f.ttf" \
      -o "$FONT_DIR/$f.ttf" || log "warning: $f fetch failed (non-fatal)"
  fi
done
sudo fc-cache -f >/dev/null 2>&1 || true

# ── Chromium binary ──
# The render engine (hyperframes) and the puppeteer-core ingest/validation paths
# both need a Chromium. On ARM64 there is NO Chrome-for-Testing download, so we
# install a system Chromium and point puppeteer at it via PUPPETEER_EXECUTABLE_PATH
# (set in the systemd unit) + PUPPETEER_SKIP_DOWNLOAD=true.
if ! command -v chromium-browser >/dev/null 2>&1 && ! command -v chromium >/dev/null 2>&1 && [ ! -x /snap/bin/chromium ]; then
  log "installing Chromium"
  sudo apt-get install -y chromium-browser || sudo snap install chromium || \
    log "WARN: chromium install failed — set PUPPETEER_EXECUTABLE_PATH manually"
fi
CHROME_BIN="$(command -v chromium-browser || command -v chromium || echo /snap/bin/chromium)"
log "Chromium binary: ${CHROME_BIN:-<not found>}"

# ── Optional: local STT for video-file ingest (skip if you only do prompt/URL) ──
if ! python3 -c "import faster_whisper" >/dev/null 2>&1; then
  log "installing python3 + faster-whisper (optional, for video ingest)"
  sudo apt-get install -y python3 python3-pip >/dev/null
  pip3 install --quiet faster-whisper 2>/dev/null || \
    log "WARN: faster-whisper install failed (set config stt.provider to a hosted endpoint)"
fi

log "done. Detected Chromium at: ${CHROME_BIN:-NONE}"
log "next: deploy/build.sh, then install the systemd service (see DEPLOY.md)"
