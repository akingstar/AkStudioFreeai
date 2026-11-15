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

# torch pin: naye Windows builds (2.15+) par shm.dll load fail hota hai
if command -v nvidia-smi >/dev/null; then
  echo "NVIDIA GPU mila — CUDA build install..."
  "$VPY" -m pip install -q "torch==2.6.0" "torchaudio==2.6.0" --index-url https://download.pytorch.org/whl/cu126
else
  echo "CPU build install (slow chalega)..."
  "$VPY" -m pip install -q "torch==2.6.0" "torchaudio==2.6.0"
fi

"$VPY" -m pip install -q -r "$ROOT/local/requirements-local.txt"

# httpx crash karta hai jab NO_PROXY me bracket wale entries hon (jaise [::1])
if [ -n "${NO_PROXY:-}" ]; then
  export NO_PROXY="$(printf '%s' "$NO_PROXY" | awk -F, '{out=""; for(i=1;i<=NF;i++){g=$i; gsub(/^ +| +$/,"",g); if(g!="" && g !~ /\[/ && g !~ /\]/){out=out (out?",":"") g}} print out}')"
  export no_proxy="$NO_PROXY"
fi

export AK_PORT="${AK_PORT:-7861}"
export AK_HOST="${AK_HOST:-127.0.0.1}"
export AK_PREWARM=0  # local: prewarm nahi (duplicate download + RAM waste)

RAM_GB=$(awk '/MemTotal/ {printf "%d", $2/1048576}' /proc/meminfo 2>/dev/null || echo 0)
if [ "${RAM_GB:-0}" -gt 0 ] && [ "$RAM_GB" -lt 8 ]; then
  echo "WARNING: is machine me ${RAM_GB} GB RAM hai. CPU mode me Seed-VC ko ~5-6 GB free chahiye — conversion OOM ho sakta hai (8 GB+ recommended)."
fi
echo
echo "Local engine ready: http://127.0.0.1:$AK_PORT"
echo "Pehli baar model download ~4-5 GB. Ctrl+C se band."
echo
exec "$VPY" "$ROOT/spaces/ak-voice/app.py"
