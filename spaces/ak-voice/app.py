"""AkStudio Voice Space: vocals alag (Demucs) -> aapki awaaz me convert (Seed-VC, zero-shot, no training) -> mix.

Chalta hai: free CPU basic (slow) ya GPU/ZeroGPU (fast). API: /clone_song
Inputs : song(audio), reference(audio 5-25s), pitch(int), steps(int), separate(bool)
Outputs: mixed.wav, converted_vocals.wav, instrumental.wav

Seed-VC (GPL-3.0) https://github.com/Plachtaa/seed-vc  |  Demucs https://github.com/facebookresearch/demucs
Sirf apni ya permission wali awaaz use karo.
"""
import os
import subprocess
import sys
import tempfile
import uuid

import gradio as gr
import numpy as np
import soundfile as sf
import torch

try:
    import spaces
    GPU = spaces.GPU
except Exception:  # CPU hardware: decorator no-op
    def GPU(*a, **k):
        if len(a) == 1 and callable(a[0]):
            return a[0]
        return lambda f: f

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.join(HERE, "seed-vc")
if not os.path.isdir(REPO):
    subprocess.run(["git", "clone", "--depth", "1", "https://github.com/Plachtaa/seed-vc.git", REPO], check=True)
sys.path.insert(0, REPO)
os.chdir(REPO)  # Seed-VC configs relative paths use karta hai

from seed_vc_wrapper import SeedVCWrapper  # noqa: E402

VC = SeedVCWrapper()
HAS_CUDA = torch.cuda.is_available()


def _ffmpeg_wav(src, dst, sr=None, mono=False):
    cmd = ["ffmpeg", "-y", "-i", src]
    if sr:
        cmd += ["-ar", str(sr)]
    if mono:
        cmd += ["-ac", "1"]
    subprocess.run(cmd + [dst], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def separate_vocals(song, work):
    """Demucs htdemucs two-stem. returns (vocals_path, instrumental_path)"""
    wav = os.path.join(work, "song.wav")
    _ffmpeg_wav(song, wav, sr=44100)
    out = os.path.join(work, "demucs")
    subprocess.run(
        [sys.executable, "-m", "demucs.separate", "-n", "htdemucs", "--two-stems=vocals", "-o", out, wav],
        check=True,
    )
    base = os.path.join(out, "htdemucs", "song")
    return os.path.join(base, "vocals.wav"), os.path.join(base, "no_vocals.wav")


def run_vc(source, reference, steps, pitch):
    full = None
    gen = VC.convert_voice(
        source=source, target=reference, diffusion_steps=int(steps), length_adjust=1.0,
        inference_cfg_rate=0.7, f0_condition=True, auto_f0_adjust=False,
        pitch_shift=int(pitch), stream_output=True,
    )
    for item in gen:  # generator: aakhri yield me full (sr, audio) hota hai
        if isinstance(item, (tuple, list)) and len(item) > 1 and item[1] is not None:
            full = item[1]
    if full is None:
        raise RuntimeError("Seed-VC se audio nahi mila")
    sr, audio = full
    return int(sr), np.asarray(audio)


def mix(vocals, sr_v, inst_path):
    inst, sr_i = sf.read(inst_path, always_2d=True)
    v = vocals.astype(np.float32)
    if v.dtype.kind == "i" or np.abs(v).max() > 2:
        v = v / 32768.0
    if v.ndim == 1:
        v = v[:, None]
    if sr_v != sr_i:
        import librosa
        v = np.stack([librosa.resample(v[:, c], orig_sr=sr_v, target_sr=sr_i) for c in range(v.shape[1])], axis=1)
    n = min(len(v), len(inst))
    v, inst = v[:n], inst[:n]
    if v.shape[1] == 1 and inst.shape[1] == 2:
        v = np.repeat(v, 2, axis=1)
    out = v * 1.0 + inst * 0.9
    peak = float(np.abs(out).max()) or 1.0
    if peak > 0.97:
        out = out * (0.97 / peak)
    return out, sr_i


@GPU(duration=120)
def clone_song(song, reference, pitch=0, steps=25, separate=True):
    if not song or not reference:
        raise gr.Error("Song aur reference awaaz dono chahiye.")
    work = tempfile.mkdtemp(prefix="akv_")
    steps = int(steps)
    if not HAS_CUDA:
        steps = min(steps, 12)  # CPU par tez rakhne ke liye
    if separate:
        vocals_path, inst_path = separate_vocals(song, work)
    else:
        vocals_path, inst_path = song, None
    sr, audio = run_vc(vocals_path, reference, steps, pitch)
    uid = uuid.uuid4().hex[:8]
    conv = os.path.join(work, f"converted_vocals_{uid}.wav")
    sf.write(conv, audio, sr)
    if inst_path:
        mixed_audio, sr_m = mix(audio, sr, inst_path)
        mixed = os.path.join(work, f"mixed_{uid}.wav")
        sf.write(mixed, mixed_audio, sr_m)
        return mixed, conv, inst_path
    return conv, conv, None


with gr.Blocks(title="AkStudio Voice Clone") as demo:
    gr.Markdown("# AkStudio Voice Clone\nDemucs + Seed-VC. Sirf apni ya permission wali awaaz use karo.")
    with gr.Row():
        song = gr.Audio(type="filepath", label="Song / vocals")
        ref = gr.Audio(type="filepath", label="Reference voice (5-25 sec)")
    with gr.Row():
        pitch = gr.Slider(-24, 24, value=0, step=1, label="Pitch shift (semitones)")
        steps = gr.Slider(1, 60, value=25, step=1, label="Diffusion steps")
        sep = gr.Checkbox(value=True, label="Poora gaana (vocals alag karo)")
    go = gr.Button("Clone")
    o1 = gr.Audio(label="Mixed", type="filepath")
    o2 = gr.Audio(label="Converted vocals", type="filepath")
    o3 = gr.Audio(label="Instrumental", type="filepath")
    go.click(clone_song, [song, ref, pitch, steps, sep], [o1, o2, o3], api_name="clone_song")

demo.queue(max_size=8).launch()
