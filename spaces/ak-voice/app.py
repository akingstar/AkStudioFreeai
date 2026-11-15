"""AkStudio Voice Space v2: vocals alag (Demucs) -> zero-shot singing voice conversion (Seed-VC) -> mix.

API: /clone_song  (mixed.wav, converted_vocals.wav, instrumental.wav, report.json)
Chalta hai: free CPU (slow) ya ZeroGPU (fast). Zero-shot — koi training nahi.

Env knobs:
  AK_CHUNK_SEC   (default 26)   per-chunk conversion window
  AK_MAX_SEC     (default 300)  input song ka max length
  AK_CROSSFADE   (default 0.08) chunk crossfade seconds
  SEEDVC_REPO    (optional)     local seed-vc checkout path

Seed-VC (GPL-3.0) https://github.com/Plachtaa/seed-vc | Demucs
Sirf apni ya permission wali awaaz use karo.
"""
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import uuid

import gradio as gr
import numpy as np
import soundfile as sf
import torch

# Gradio localhost par cross-origin ko block karta hai; GitHub Pages site ko allow karo.
# Revert: AK_ALLOWED_ORIGINS ko khali rakho.
try:
    import gradio.route_utils as _ru
    import gradio.routes as _grr

    _ALLOWED_ORIGINS = {h.strip().lower() for h in os.getenv("AK_ALLOWED_ORIGINS", "akingstar.github.io").split(",") if h.strip()}
    _orig_is_valid = _ru.CustomCORSMiddleware.is_valid_origin

    class _Cors(_ru.CustomCORSMiddleware):
        def is_valid_origin(self, request_headers):
            try:
                if _ru.get_hostname(request_headers["Origin"]).lower() in _ALLOWED_ORIGINS:
                    return True
            except Exception:
                pass
            return _orig_is_valid(self, request_headers)

    _grr.CustomCORSMiddleware = _Cors
except Exception as _e:
    print(f"cors patch skipped: {_e}", flush=True)

try:
    import spaces
    GPU = spaces.GPU
except Exception:  # CPU hardware: decorator no-op
    def GPU(*a, **k):
        if len(a) == 1 and callable(a[0]):
            return a[0]
        return lambda f: f

APP_VERSION = "2.0"
CHUNK_SEC = float(os.getenv("AK_CHUNK_SEC", "26"))
MAX_SEC = float(os.getenv("AK_MAX_SEC", "300"))
CROSSFADE = float(os.getenv("AK_CROSSFADE", "0.08"))

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.getenv("SEEDVC_REPO") or os.path.join(HERE, "seed-vc")
if not os.path.isdir(REPO):
    subprocess.run(
        ["git", "clone", "--depth", "1", "https://github.com/Plachtaa/seed-vc.git", REPO],
        check=True,
    )
sys.path.insert(0, REPO)
os.chdir(REPO)  # Seed-VC configs relative paths use karta hai

from seed_vc_wrapper import SeedVCWrapper  # noqa: E402


def _prewarm_weights():
    """ZeroGPU budget 120s hai — weights startup par cache karo, warna pehla call timeout."""
    try:
        from huggingface_hub import snapshot_download
        for repo in ("Plachta/Seed-VC", "openai/whisper-small",
                     "nvidia/bigvgan_v2_22khz_80band_256x",
                     "nvidia/bigvgan_v2_44khz_128band_512x",
                     "lj1995/VoiceConversionWebUI", "funasr/campplus"):
            try:
                snapshot_download(repo)
            except Exception as e:
                print(f"prewarm skip {repo}: {e}", flush=True)
        print("model cache ready", flush=True)
    except Exception as e:
        print(f"prewarm disabled: {e}", flush=True)


if os.getenv("AK_PREWARM", "1") not in ("0", "false", "False"):
    threading.Thread(target=_prewarm_weights, daemon=True).start()

_VC = None


def get_vc():
    """Lazy init: ZeroGPU me CUDA sirf decorated call ke andar visible hota hai."""
    global _VC
    if _VC is None:
        _VC = SeedVCWrapper()
    return _VC


def has_cuda():
    return torch.cuda.is_available()


# ---------- audio helpers ----------
def _ffmpeg_wav(src, dst, sr=None, mono=False):
    cmd = ["ffmpeg", "-y", "-i", src]
    if sr:
        cmd += ["-ar", str(sr)]
    if mono:
        cmd += ["-ac", "1"]
    subprocess.run(cmd + [dst], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def _duration(path):
    return float(sf.info(path).duration)


def _rms(x):
    return float(np.sqrt(np.mean(np.square(x, dtype=np.float64))))


def _to_2d(audio):
    a = np.asarray(audio, dtype=np.float32)
    if a.dtype.kind in "iu" or (a.size and np.abs(a).max() > 2):
        a = a / 32768.0
    if a.ndim == 1:
        a = a[:, None]
    return a


def separate_vocals(song, work):
    """Demucs htdemucs two-stem. returns (vocals_path, instrumental_path)"""
    wav = os.path.join(work, "song.wav")
    _ffmpeg_wav(song, wav, sr=44100)
    out = os.path.join(work, "demucs")
    subprocess.run(
        [sys.executable, "-m", "demucs.separate", "-n", "htdemucs",
         "--two-stems=vocals", "-o", out, wav],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    base = os.path.join(out, "htdemucs", "song")
    return os.path.join(base, "vocals.wav"), os.path.join(base, "no_vocals.wav")


def run_vc(source_path, reference_path, steps, pitch):
    """Seed-VC generator -> (sr, float32 numpy) full result."""
    full = None
    gen = get_vc().convert_voice(
        source=source_path, target=reference_path, diffusion_steps=int(steps),
        length_adjust=1.0, inference_cfg_rate=0.7, f0_condition=True,
        auto_f0_adjust=False, pitch_shift=int(pitch), stream_output=True,
    )
    for item in gen:  # generator: aakhri yield me full (sr, audio) hota hai
        if isinstance(item, (tuple, list)) and len(item) > 1 and item[1] is not None:
            full = item[1]
    if full is None:
        raise RuntimeError("Seed-VC se audio nahi mila")
    sr, audio = full
    return int(sr), _to_2d(audio)


def _crossfade_concat(parts, sr, fade_sec=CROSSFADE):
    if not parts:
        raise RuntimeError("Koi converted chunk nahi mila")
    if len(parts) == 1:
        return parts[0]
    fade = max(1, int(fade_sec * sr))
    out = parts[0].copy()
    for p in parts[1:]:
        overlap = int(min(fade, len(out), len(p)))
        if overlap > 0:
            ramp = np.linspace(0.0, 1.0, overlap, dtype=np.float32)[:, None]
            out[-overlap:] = out[-overlap:] * (1.0 - ramp) + p[:overlap] * ramp
        out = np.concatenate([out, p[overlap:]], axis=0)
    return out


def convert_song(vocals_path, reference_path, steps, pitch, progress, t0, total_sec):
    """Long vocals ko chunks me convert karta hai (Seed-VC ~30s windows par best)."""
    audio, sr = sf.read(vocals_path, always_2d=True)
    audio = _to_2d(audio)
    dur = len(audio) / sr
    if dur <= CHUNK_SEC:
        progress(0.25, desc="Voice convert ho rahi hai...")
        out_sr, out = run_vc(vocals_path, reference_path, steps, pitch)
        if out_sr != sr:
            import librosa
            out = np.stack([librosa.resample(out[:, c], orig_sr=out_sr, target_sr=sr)
                            for c in range(out.shape[1])], axis=1)
        progress(0.8, desc="Convert complete")
        return out.astype(np.float32), sr, dur

    # Chunked path: temp wavs -> per-chunk VC -> crossfade concat
    win = int(CHUNK_SEC * sr)
    hop = max(1, win - int(CROSSFADE * sr))
    chunks = []
    n_chunks = max(1, int(np.ceil(max(0, len(audio) - win) / hop)) + 1)
    for i, start in enumerate(range(0, len(audio), hop)):
        if i >= n_chunks:
            break
        seg = audio[start:start + win]
        if len(seg) < int(1.0 * sr):
            break
        seg_path = os.path.join(os.path.dirname(vocals_path), f"_chunk_{i}.wav")
        sf.write(seg_path, seg, sr)
        progress(0.2 + 0.6 * (i / n_chunks),
                 desc=f"Chunk {i + 1}/{n_chunks} convert ho raha hai...")
        out_sr, out = run_vc(seg_path, reference_path, steps, pitch)
        if out_sr != sr:
            import librosa
            out = np.stack([librosa.resample(out[:, c], orig_sr=out_sr, target_sr=sr)
                            for c in range(out.shape[1])], axis=1)
        chunks.append(out.astype(np.float32))
        if time.time() - t0 > 0 and total_sec and (time.time() - t0) > total_sec * 6:
            raise RuntimeError("Conversion time limit cross ho gaya — chhota gaana ya kam steps try karo.")
    merged = _crossfade_concat(chunks, sr)
    progress(0.85, desc="Chunks merge ho rahe hain")
    return merged, sr, dur


def mix(vocals, sr_v, inst_path, vocals_path=None):
    inst, sr_i = sf.read(inst_path, always_2d=True)
    inst = _to_2d(inst)
    v = _to_2d(vocals)
    if sr_v != sr_i:
        import librosa
        v = np.stack([librosa.resample(v[:, c], orig_sr=sr_v, target_sr=sr_i)
                      for c in range(v.shape[1])], axis=1)
    n = min(len(v), len(inst))
    v, inst = v[:n], inst[:n]
    if v.shape[1] == 1 and inst.shape[1] == 2:
        v = np.repeat(v, 2, axis=1)
    if inst.shape[1] == 1 and v.shape[1] == 2:
        inst = np.repeat(inst, 2, axis=1)

    # Loudness match: converted vocals ko original vocals ke level par lao
    gain = 1.0
    if vocals_path and os.path.exists(vocals_path):
        try:
            orig, _ = sf.read(vocals_path, always_2d=True)
            orig = _to_2d(orig)[:n]
            r_orig, r_conv = _rms(orig), _rms(v)
            if r_orig > 1e-4 and r_conv > 1e-4:
                gain = float(np.clip(r_orig / r_conv, 0.25, 4.0))
        except Exception:
            gain = 1.0
    v = v * gain

    out = v + inst * 0.9
    peak = float(np.abs(out).max()) or 1.0
    if peak > 0.97:
        out = out * (0.97 / peak)
    return out.astype(np.float32), sr_i, round(gain, 3)


@GPU(duration=120)
def clone_song(song, reference, pitch=0, steps=25, separate=True, progress=gr.Progress()):
    t0 = time.time()
    if not song or not reference:
        raise gr.Error("Song aur reference awaaz dono chahiye.")

    ref_sec = _duration(reference)
    song_sec = _duration(song)
    if ref_sec < 3:
        raise gr.Error(f"Reference bahut chhoti hai ({ref_sec:.1f}s) — kam se kam 5-10 sec clean awaaz do.")
    if song_sec > MAX_SEC:
        raise gr.Error(f"Song {song_sec:.0f}s hai, limit {MAX_SEC:.0f}s hai. Chhota clip do ya ak max-sec badhao.")

    steps = int(max(6, min(int(steps), 50)))
    if not has_cuda():
        steps = min(steps, 12)  # CPU par tez rakhne ke liye
    pitch = int(max(-24, min(int(pitch), 24)))

    # ZeroGPU budget = 120s per call (billed per call, not per second used).
    # ~90s vocals @ 25 steps is the safe ceiling; fail fast instead of wasting quota.
    if has_cuda():
        est = song_sec * (0.05 + 0.0225 * steps)
        if est > 110:
            raise gr.Error(
                f"ZeroGPU budget ~120s: ye job ~{est:.0f}s lega. Chhota clip (max ~60-90s), "
                f"kam steps, ya Pro API use karo."
            )

    work = tempfile.mkdtemp(prefix="akv_")
    progress(0.05, desc="Setup")

    if separate:
        progress(0.1, desc="Demucs vocals alag kar raha hai...")
        vocals_path, inst_path = separate_vocals(song, work)
    else:
        vocals_path, inst_path = song, None

    total = _duration(vocals_path)
    progress(0.2, desc=f"Vocals convert ho rahe hain ({total:.0f}s)...")
    converted, sr, _ = convert_song(vocals_path, reference, steps, pitch, progress, t0, total)

    uid = uuid.uuid4().hex[:8]
    conv = os.path.join(work, f"converted_vocals_{uid}.wav")
    sf.write(conv, converted, sr)

    progress(0.9, desc="Mix ho raha hai...")
    if inst_path:
        mixed_audio, sr_m, gain = mix(converted, sr, inst_path, vocals_path)
        mixed = os.path.join(work, f"mixed_{uid}.wav")
        sf.write(mixed, mixed_audio, sr_m)
        outputs = (mixed, conv, inst_path)
    else:
        gain = 1.0
        outputs = (conv, conv, None)

    report = {
        "version": APP_VERSION,
        "device": "cuda" if has_cuda() else "cpu",
        "song_seconds": round(song_sec, 2),
        "reference_seconds": round(ref_sec, 2),
        "chunk_seconds": CHUNK_SEC,
        "steps": steps,
        "pitch": pitch,
        "vocal_gain": gain,
        "elapsed_seconds": round(time.time() - t0, 1),
    }
    progress(1.0, desc="Done")
    return (*outputs, json.dumps(report))


def voice_info():
    return json.dumps({
        "app": "AkStudio Voice Clone",
        "version": APP_VERSION,
        "device": "cuda" if has_cuda() else "cpu",
        "chunk_seconds": CHUNK_SEC,
        "max_seconds": MAX_SEC,
        "endpoints": ["clone_song", "voice_info"],
    })


with gr.Blocks(title="AkStudio Voice Clone") as demo:
    gr.Markdown(
        "# 🎤 AkStudio Voice Clone v2\n"
        "Demucs + Seed-VC zero-shot. Sirf apni ya permission wali awaaz use karo. "
        "Chhota clean reference (5-25s) = best result."
    )
    with gr.Row():
        song = gr.Audio(type="filepath", label="Song / vocals")
        ref = gr.Audio(type="filepath", label="Reference voice (5-25 sec)")
    with gr.Row():
        pitch = gr.Slider(-24, 24, value=0, step=1, label="Pitch shift (semitones)")
        steps = gr.Slider(4, 50, value=25, step=1, label="Diffusion steps (quality vs speed)")
        sep = gr.Checkbox(value=True, label="Poora gaana (vocals alag karo)")
    go = gr.Button("Clone", variant="primary")
    o1 = gr.Audio(label="Mixed", type="filepath")
    o2 = gr.Audio(label="Converted vocals", type="filepath")
    o3 = gr.Audio(label="Instrumental", type="filepath")
    o4 = gr.Textbox(label="Report (JSON)", lines=6)
    go.click(clone_song, [song, ref, pitch, steps, sep], [o1, o2, o3, o4], api_name="clone_song")
    info_btn = gr.Button("Engine info", size="sm")
    info_out = gr.Textbox(label="Info", lines=5)
    info_btn.click(voice_info, None, info_out, api_name="voice_info")

HOST = os.getenv("AK_HOST", "0.0.0.0")
PORT = int(os.getenv("AK_PORT", "7860"))
demo.queue(max_size=8).launch(server_name=HOST, server_port=PORT)
