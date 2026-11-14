# Voice Clone + Training-free Voice Changer

Zero-shot voice cloning inside AkStudioFreeai. Record 10–25 s of your voice, upload any
song, and get it back in your voice (vocals separated, converted, re-mixed).

No per-voice training: the Seed-VC model clones from the reference sample at request time.

## How it works

```
Browser                          GitHub                         Hugging Face
-------                          ------                         ------------
record 10-25s  ──► quality scan (SNR / clipping / silence)
upload song    ──► Voice Clone page
                 convertVoice() ──► own Space /clone_song ──► Demucs (vocals/stems)
                                                          ──► Seed-VC (zero-shot VC,
                                                              chunked + crossfade)
                                                          ──► loudness-matched mix
                 fallback: Official Seed-VC Space (acapella only)
                 fallback: Local engine (same app on your PC, no quota)
                 fallback: optional Pro API (your own URL + key)
```

Local fallback setup: [local/README.md](../local/README.md). Chain order follows
Connections → *Local engine* mode: `auto` (cloud fail par), `first`, `only`, `off`.

* Everything is client-driven: the browser calls the Space directly (Gradio API), so it
  works from GitHub Pages with no server of your own.
* Voice profiles and songs are stored locally (IndexedDB / localStorage). Only the
  reference audio and the song are sent to the backend you selected.

## One-time setup (so it deploys straight from GitHub)

1. **Create a Hugging Face write token**
   huggingface.co → Settings → Access Tokens → *New token* → role **Write**.
2. **Add repo secret** `HF_TOKEN` (GitHub → Settings → Secrets and variables → Actions → Secrets).
3. **Add repo variables**
   * `HF_USERNAME` — your HF username (e.g. `Ashklyrics`).
   * `VOICE_SPACE_NAME` — optional, default `AkStudioFreeai-voice`.
   * `VITE_VOICE_SPACE` — `<HF_USERNAME>/<VOICE_SPACE_NAME>`; the site bakes this in at build.
4. Push to `main`. Two workflows run:
   * `deploy-space.yml` creates/updates the Space from `spaces/ak-voice/` and restarts it.
   * `deploy.yml` builds the site and deploys to GitHub Pages.
5. Space Settings → Hardware: pick **ZeroGPU** (fast) or leave on CPU (free but slow).
6. Site → Connections → *Voice clone backend*: confirm the Space ID, optionally paste the
   HF token into the browser (raises your personal quota) and set quality steps.

Branch protection note: GitHub Pages must be set to *Source: GitHub Actions*.

## Using it

1. **Voice Clone page → step 01**: record (auto-stops at 25 s) or upload. Wait for the
   quality badge:
   * **A** (85+): production-grade reference.
   * **B** (70+): usable.
   * **C/D**: follow the listed tips (noise, clipping, too short) and re-record.
2. Tick the consent checkbox (own voice or explicit permission) and save the profile.
3. **Step 03**: upload a song → keep “Poora gaana” to auto-separate vocals → Convert.
   Progress streams from the Space. You get mixed / vocals / instrumental WAVs plus a
   JSON report, and can save the result to My Library.
4. **Create Music page**: choose 🎤 *My cloned voice* as the voice preset. When an
   acapella-style track (“clear natural lead vocals”) finishes generating, it is
   automatically converted and you get an **Original / Meri awaaz** A/B toggle.

Limits: reference is trimmed to 25 s. On ZeroGPU hardware the free quota is a few
minutes per day and each call is billed up to its requested 120 s window, so a
~60–90 s clip is the practical ceiling — the Space fails fast with a clear message
instead of burning quota. On CPU hardware steps are capped at 12 and a song can take
many minutes. Long songs (up to `AK_MAX_SEC`, default 300 s) belong on CPU or a paid
Pro API.

## Optional paid / Pro API

If free quota is exhausted and you have a faster endpoint, point Connections → *Pro API*
at any service that accepts:

```json
POST { "audio_base64": "...", "reference_base64": "...", "pitch": 0, "separate": true }
→ { "mixed_base64": "...", "vocals_base64": "...", "instrumental_base64": "...", "report": {...} }
```

The key is sent as `Authorization: Bearer <key>`. The chain is: Pro API only runs after
the free backends fail, unless you switch *voiceMode* to official.

## Files

| File | Purpose |
| --- | --- |
| `src/ak-voice-engine.js` | reference analysis, backend chain, progress events |
| `src/ak-voice-clone.js` | Voice Clone page UI + create-page integration |
| `src/ak-voice-defaults.js` | `VITE_VOICE_SPACE` default Space ID |
| `src/ak-connections.js` | token / Space / Pro API / steps settings |
| `spaces/ak-voice/app.py` | Gradio Space: Demucs → Seed-VC (chunked) → mix |
| `.github/workflows/deploy-space.yml` | auto-deploy the Space from GitHub |

## Fair use

Use only your own voice or a voice you have explicit permission to clone. Do not
impersonate people. Label AI-generated audio where required by law or platform rules.
