#!/usr/bin/env bash
# Local voice engine (quota fallback) — Linux / macOS / Termux(proot)
# Usage: bash local/start-linux.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

command -v git >/dev/null || { echo "Git chahiye."; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg chahiye: sudo apt install ffmpeg (mac: brew install ffmpeg)"; exit 1; }

PY=""
for c in python3.12 python3.11 python3.10 python3; do
  if command -v "$c" >/dev/null && "$c" -c 'import sys; sys.exit(0 if sys.version_info[:2] >= (3,10) else 1)'; then PY="$c"; break; fi
done
[ -n "$PY" ] || { echo "Python 3.10+ chahiye."; exit 1; }

VENV="$ROOT/local/.venv"
[ -x "$VENV/bin/python" ] || "$PY" -m venv "$VENV"
VPY="$VENV/bin/python"
"$VPY" -m pip install -q -U pip

if command -v nvidia-smi >/dev/null; then
  echo "NVIDIA GPU mila — CUDA build install..."
  "$VPY" -m pip install -q torch torchaudio --index-url https://download.pytorch.org/whl/cu126
else
  echo "CPU build install (slow chalega)..."
  "$VPY" -m pip install -q torch torchaudio
fi

"$VPY" -m pip install -q -r "$ROOT/local/requirements-local.txt"

export AK_PORT="${AK_PORT:-7861}"
export AK_HOST="${AK_HOST:-127.0.0.1}"
echo
echo "Local engine ready: http://127.0.0.1:$AK_PORT"
echo "Pehli baar model download ~4-5 GB. Ctrl+C se band."
echo
exec "$VPY" "$ROOT/spaces/ak-voice/app.py"
