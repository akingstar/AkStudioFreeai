# Local voice engine (quota fallback)

Free cloud GPUs have a daily quota. When it runs out, AkStudioFreeai can fall back to
the **same voice engine running on your own machine** (CPU or GPU). No account, no
quota — just slower on CPU.

## One-time setup

Requirements: Git, [Python 3.10–3.12](https://www.python.org/downloads/), and `ffmpeg`.

* Windows: `winget install Gyan.FFmpeg` (ya ffmpeg.org se zip), phir terminal restart.
* Linux: `sudo apt install ffmpeg`
* macOS: `brew install ffmpeg`

## Start

* **Windows** (PowerShell, repo root se):
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\local\start-windows.ps1
  ```
* **Linux / macOS**:
  ```bash
  bash local/start-linux.sh
  ```

Pehli baar: 4–5 GB models download hote hain (background me), phir
`http://127.0.0.1:7861` par engine ready.

## Site me connect karo

1. Site → **Connections** → **Local engine** section.
2. URL: `http://127.0.0.1:7861` → **Test local engine** → 🟢 dikhna chahiye.
3. Mode chuno:
   * **Auto** — cloud fail/quota khatam hone par local use hoga (default).
   * **Pehle local** — cloud quota bachao, har job local.
   * **Sirf local** — offline mode, cloud bilkul nahi.
   * **Off** — sirf cloud.

Voice Clone page → **Gaana → meri awaaz** ab local engine par bhi chalega; result ke
neeche `via Local engine` dikhega.

## Speed (approx, 10 s clip, 25 steps)

| Hardware | Time |
| --- | --- |
| NVIDIA GPU (8 GB+) | 15–40 s |
| CPU (modern 6-core) | 3–8 min |
| Termux (phone, proot) | avoid — bahut slow |

Tip: CPU par steps 6–10 rakho aur acapella (separate off) mode use karo; 26 s chunks
me conversion hoti hai, isliye lambe gaane bhi chalte hain (bas time lagega).

## Notes

* Same `spaces/ak-voice/app.py` chalta hai — koi alag model nahi.
* Models `~/.cache/huggingface` me cache hote hain; dusri baar fast.
* Engine band karte hi site automatically cloud par wapas chali jayegi (Auto mode).
* Port badalna ho: `AK_PORT=7862` set karke start karo, phir Connections me wahi URL.
