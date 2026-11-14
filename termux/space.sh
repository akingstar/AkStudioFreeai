#!/usr/bin/env bash
# ak space voice | music-cpu  : Hugging Face Space deploy/duplicate (free)
DIR="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
CONF="${AK_HOME:-$HOME/.akstudio}/config.json"
T="$(AKC="$CONF" node -e "try{console.log(JSON.parse(require('fs').readFileSync(process.env.AKC)).hfToken||'')}catch{console.log('')}")"
[ -z "$T" ] && { echo "Pehle: ak token hf_xxx   (token me WRITE permission chahiye: huggingface.co/settings/tokens)"; exit 1; }
WHO="$(curl -s -H "Authorization: Bearer $T" https://huggingface.co/api/whoami-v2 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).name||'')}catch{console.log('')}})")"
[ -z "$WHO" ] && { echo "Token galat/expire ya network issue."; exit 1; }
echo "HF user: $WHO"

case "$1" in
  voice)
    NAME="AkStudioFreeai-voice"
    curl -s -X POST https://huggingface.co/api/repos/create -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
      -d "{\"type\":\"space\",\"name\":\"$NAME\",\"sdk\":\"gradio\",\"private\":false}" | head -c 200; echo
    TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
    export GIT_TERMINAL_PROMPT=0
    git clone -q "https://$WHO:$T@huggingface.co/spaces/$WHO/$NAME" "$TMP/s" || { echo "Clone fail"; exit 1; }
    cp -r "$DIR/spaces/ak-voice/." "$TMP/s/"
    cd "$TMP/s" && git add -A && git -c user.name=akstudio -c user.email=akstudio@local commit -qm "Deploy AkStudio voice clone" && git push -q origin HEAD \
      && echo "✓ Deploy ho gaya. Build 5-15 min lagta hai: https://huggingface.co/spaces/$WHO/$NAME" \
      && echo "  Site ke Connections page par 'Mera Voice Space ID' = $WHO/$NAME rakho." \
      && echo "  Zyada speed chahiye to Space Settings -> Hardware me GPU/ZeroGPU chuno (free CPU bhi chalta hai, slow)." ;;
  music-cpu)
    NAME="AkStudioFreeai-cpu"
    echo "ZeroGPU Space ka CPU copy bana raha hoon (free CPU basic)..."
    curl -s -X POST "https://huggingface.co/api/spaces/Ashklyrics/AkStudioFreeai/duplicate" -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
      -d "{\"repository\":\"$WHO/$NAME\",\"private\":false,\"hardware\":\"cpu-basic\"}" | head -c 300; echo
    echo "Agar 'repo exists' ya URL aaya to theek. Space ready hone par site ke Connections page par 'Extra backends' me jodo:"
    echo "  AkStudio CPU | https://$(echo "$WHO-$NAME" | tr '[:upper:]_.' '[:lower:]--').hf.space"
    echo "Note: ACE-Step CPU par bahut slow hai (10+ min) aur ho sakta hai pehli baar fail ho; ye sirf last-resort cloud option hai." ;;
  *) echo "Use: ak space voice | ak space music-cpu" ;;
esac
