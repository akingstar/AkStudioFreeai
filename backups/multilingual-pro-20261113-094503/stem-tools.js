(() => {
  if (document.getElementById('ak-stem-launch')) return;

  const style = document.createElement('style');
  style.textContent = `
  #ak-stem-panel{position:fixed;z-index:99995;left:50%;top:50%;
    transform:translate(-50%,-50%);width:min(420px,calc(100vw - 28px));
    max-height:85vh;overflow:auto;background:#101010;color:white;
    border:1px solid #555;border-radius:18px;padding:20px;
    box-shadow:0 15px 60px #000b;display:none;font:14px Arial}
  #ak-stem-panel h2{margin:0 0 12px;font-size:21px}
  #ak-stem-panel label{display:block;margin:14px 0 7px}
  #ak-stem-panel input,#ak-stem-panel select{width:100%}
  #ak-stem-panel button{padding:11px 14px;border:0;border-radius:9px;
    background:#fff;color:#111;font-weight:bold;margin:8px 5px 0 0}
  #ak-stem-panel .close{float:right;background:#333;color:white}
  #ak-stem-panel .info{font-size:12px;color:#aaa;line-height:1.6}
  #ak-stem-launch{position:fixed;right:18px;bottom:134px;z-index:99994;
    background:white;color:black;border:0;border-radius:30px;
    padding:13px 18px;font-weight:bold;cursor:pointer}
  `;
  document.head.appendChild(style);

  const panel = document.createElement('section');
  panel.id = 'ak-stem-panel';
  panel.innerHTML = `
    <button class="close" id="ak-stem-close">Close ✕</button>
    <h2>🎤 Vocal & Stem Tools</h2>
    <p class="info">Basic stereo center processing. Results depend on the original song mix.</p>

    <label>Upload song</label>
    <input id="ak-stem-file" type="file" accept="audio/*">
    <audio id="ak-stem-preview" controls style="width:100%;margin-top:10px"></audio>

    <label>Processing mode</label>
    <select id="ak-stem-mode">
      <option value="remove">Karaoke — Reduce Center Vocals</option>
      <option value="extract">Extract Center Audio</option>
    </select>

    <button id="ak-stem-process">Process & Download WAV</button>
    <button id="ak-stem-reset">Reset</button>
    <p id="ak-stem-status" class="info">Upload a stereo song to begin.</p>
    <p class="info">Important: This is not AI source separation. Center extraction can contain vocals, bass, drums and other centered instruments. Mono files cannot provide reliable vocal removal.</p>
  `;
  document.body.appendChild(panel);

  const launch = document.createElement('button');
  launch.id = 'ak-stem-launch';
  launch.textContent = '🎤 Vocal Separation';
  document.body.appendChild(launch);

  const $ = id => document.getElementById(id);
  const input = $('ak-stem-file');
  const preview = $('ak-stem-preview');

  launch.onclick = () => panel.style.display = 'block';
  $('ak-stem-close').onclick = () => panel.style.display = 'none';

  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    preview.src = URL.createObjectURL(file);
    preview.load();
    $('ak-stem-status').textContent = file.name + ' loaded.';
  };

  function wavBlob(buffer) {
    const channels = buffer.numberOfChannels;
    const frames = buffer.length;
    const rate = buffer.sampleRate;
    const size = frames * channels * 2;
    const ab = new ArrayBuffer(44 + size);
    const v = new DataView(ab);

    function write(offset, value) {
      for (let i = 0; i < value.length; i++) {
        v.setUint8(offset + i, value.charCodeAt(i));
      }
    }

    write(0, 'RIFF');
    v.setUint32(4, 36 + size, true);
    write(8, 'WAVE');
    write(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, channels, true);
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * channels * 2, true);
    v.setUint16(32, channels * 2, true);
    v.setUint16(34, 16, true);
    write(36, 'data');
    v.setUint32(40, size, true);

    let offset = 44;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < channels; c++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i]));
        v.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
        offset += 2;
      }
    }
    return new Blob([ab], { type: 'audio/wav' });
  }

  $('ak-stem-process').onclick = async () => {
    const file = input.files?.[0];
    const button = $('ak-stem-process');
    const status = $('ak-stem-status');

    if (!file) {
      status.textContent = 'Please upload an audio file.';
      return;
    }

    button.disabled = true;
    let context;

    try {
      status.textContent = 'Reading audio...';
      context = new AudioContext();
      const decoded = await context.decodeAudioData(await file.arrayBuffer());

      if (decoded.duration > 600) {
        throw new Error('Maximum supported duration is 10 minutes.');
      }

      const channels = decoded.numberOfChannels;
      const frames = decoded.length;
      const output = new AudioBuffer({
        numberOfChannels: 2,
        length: frames,
        sampleRate: decoded.sampleRate
      });

      const left = decoded.getChannelData(0);
      const right = channels > 1 ? decoded.getChannelData(1) : left;
      const outL = output.getChannelData(0);
      const outR = output.getChannelData(1);
      const mode = $('ak-stem-mode').value;

      if (mode === 'remove' && channels < 2) {
        throw new Error('Vocal reduction needs a stereo audio file. This file is mono.');
      }

      status.textContent = 'Processing audio...';

      for (let i = 0; i < frames; i++) {
        const center = (left[i] + right[i]) * 0.5;

        if (mode === 'extract') {
          outL[i] = center;
          outR[i] = center;
        } else {
          outL[i] = left[i] - center;
          outR[i] = right[i] - center;
        }
      }

      const blob = wavBlob(output);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mode === 'extract'
        ? 'AkStudioFreeai-Center-Extract.wav'
        : 'AkStudioFreeai-Karaoke.wav';
      a.click();

      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status.textContent = 'Success! WAV file downloaded.';
    } catch (error) {
      console.error(error);
      status.textContent = 'Processing failed: ' + error.message;
    } finally {
      if (context) await context.close().catch(() => {});
      button.disabled = false;
    }
  };

  $('ak-stem-reset').onclick = () => {
    input.value = '';
    preview.removeAttribute('src');
    $('ak-stem-mode').value = 'remove';
    statusReset();
  };

  function statusReset() {
    $('ak-stem-status').textContent = 'Upload a stereo song to begin.';
  }
})();
