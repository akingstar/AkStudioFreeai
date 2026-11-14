#!/usr/bin/env bash
# AkStudio Pro: Termux one-shot setup
set -e
DIR="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
BIN="${PREFIX:-/data/data/com.termux/files/usr}/bin"
echo "== AkStudioFreeai Pro setup =="
echo "[1/4] Packages (nodejs, git, ffmpeg)..."
if command -v pkg >/dev/null; then
  yes | pkg update -y >/dev/null 2>&1 || true
  pkg install -y nodejs-lts git ffmpeg curl >/dev/null
  pkg install -y termux-api >/dev/null 2>&1 || true
fi
echo "[2/4] Node packages (relay ke liye)..."
cd "$DIR"
npm install --omit=dev --no-audit --no-fund
echo "[3/4] 'ak' command install..."
chmod +x "$DIR/termux/ak" "$DIR/relay/ak-relay.mjs"
mkdir -p "$BIN"
ln -sf "$DIR/termux/ak" "$BIN/ak"
echo "[4/4] Relay start..."
"$DIR/termux/ak" start || true
cat <<'DONE'

✓ Ho gaya. Ab ye commands use karo:
  ak status                  relay check
  ak token hf_xxxxxxxx       apna free Hugging Face token (zyada quota)
  ak push "AkStudio pro"     code GitHub par bhejo -> site auto update
  ak help                    sab commands
Site: https://akingstar.github.io/AkStudioFreeai/  (Connections page par status green dikhega)
DONE
