(() => {
  if (document.getElementById('ak-song-mixer')) return;

  const style = document.createElement('style');
  style.textContent = `
  #ak-song-mixer{position:fixed;right:18px;bottom:86px;z-index:99999;
  width:min(390px,calc(100vw - 28px));max-height:80vh;overflow:auto;
  background:#101010;color:#fff;border:1px solid #444;border-radius:18px;
  padding:20px;font:14px Arial;box-shadow:0 10px 50px #0009;display:none}
  #ak-song-mixer h2{margin:0 0 14px;font-size:21px}
  #ak-song-mixer label{display:block;margin:13px 0 6px;color:#ddd}
  #ak-song-mixer input[type=file]{width:100%;font-size:12px}
  #ak-song-mixer input[type=range]{width:100%;accent-color:#fff}
  #ak-song-mixer audio{width:100%;height:38px;margin-top:7px}
  #ak-song-mixer button{background:#fff;color:#000;border:0;border-radius:9px;
  padding:11px 14px;font-weight:bold;cursor:pointer;margin:7px 5px 0 0}
  #ak-song-mixer .close{background:#333;color:white;float:right}
  #ak-song-mixer .muted{color:#aaa;font-size:12px;line-height:1.5}
  #ak-mixer-launch{position:fixed;right:18px;bottom:18px;z-index:99998;
  background:#fff;color:#000;border:0;border-radius:30px;padding:14px 19px;
  font-weight:bold;box-shadow:0 5px 25px #0008;cursor:pointer}
  `;
  document.head.appendChild(style);

  const panel = document.createElement('section');
  panel.id = 'ak-song-mixer';
  panel.innerHTML = `
    <button class="close" id="ak-mixer-close">Close ✕</button>
    <h2>🎚️ Song Mixer</h2>
    <p class="muted">Mix your converted vocals with an instrumental track. Processing happens in your browser.</p>

    <label>🎤 Vocals / Converted RVC Voice</label>
    <input id="ak-vocal-file" type="file" accept="audio/*">
    <audio id="ak-vocal-preview" controls></audio>
    <label>Vocal volume: <span id="ak-vocal-value">100%</span></label>
    <input id="ak-vocal-gain" type="range" min="0" max="150" value="100">

    <label>🎹 Instrumental / Music</label>
    <input id="ak-music-file" type="file" accept="audio/*">
    <audio id="ak-music-preview" controls></audio>
    <label>Music volume: <span id="ak-music-value">100%</span></label>
    <input id="ak-music-gain" type="range" min="0" max="150" value="100">

    <label>Master volume: <span id="ak-master-value">100%</span></label>
    <input id="ak-master-gain" type="range" min="0" max="100" value="100">

    <button id="ak-mix-export">Download Mixed WAV</button>
    <button id="ak-mix-reset">Reset</button>
    <p id="ak-mix-status" class="muted">Upload both tracks to begin.</p>
    <p class="muted">Tip: Use WAV files for best quality. Export time depends on song length and phone performance.</p>
  `;
  document.body.appendChild(panel);

  const launch = document.createElement('button');
  launch.id = 'ak-mixer-launch';
  launch.textContent = '🎚️ Song Mixer';
  document.body.appendChild(launch);

  const $ = id => document.getElementById(id);
  const vocalFile = $('ak-vocal-file');
  const musicFile = $('ak-music-file');

  launch.onclick = () => panel.style.display = 'block';
  $('ak-mixer-close').onclick = () => panel.style.display = 'none';

  function loadPreview(input, audio) {
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      audio.src = URL.createObjectURL(file);
      audio.load();
      $('ak-mix-status').textContent = file.name + ' loaded.';
    });
  }

  loadPreview(vocalFile, $('ak-vocal-preview'));
  loadPreview(musicFile, $('ak-music-preview'));

  [
    ['ak-vocal-gain', 'ak-vocal-value'],
    ['ak-music-gain', 'ak-music-value'],
    ['ak-master-gain', 'ak-master-value']
  ].forEach(([slider, output]) => {
    $(slider).addEventListener('input', () => {
      $(output).textContent = $(slider).value + '%';
    });
  });

  function writeWav(buffer) {
    const channels = buffer.numberOfChannels;
    const frames = buffer.length;
    const sampleRate = buffer.sampleRate;
    const bytesPerSample = 2;
    const dataSize = frames * channels * bytesPerSample;
    const array = new ArrayBuffer(44 + dataSize);
    const view = new DataView(array);

    function str(offset, value) {
      for (let i = 0; i < value.length; i++) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
    }

    str(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    str(8, 'WAVE');
    str(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * bytesPerSample, true);
    view.setUint16(32, channels * bytesPerSample, true);
    view.setUint16(34, 16, true);
    str(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < frames; i++) {
      for (let ch = 0; ch < channels; ch++) {
        let sample = buffer.getChannelData(ch)[i];
        sample = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
        offset += 2;
      }
    }
    return new Blob([array], { type: 'audio/wav' });
  }

  async function decode(file, context) {
    return context.decodeAudioData(await file.arrayBuffer());
  }

  $('ak-mix-export').onclick = async () => {
    const vocals = vocalFile.files?.[0];
    const music = musicFile.files?.[0];
    const button = $('ak-mix-export');
    const status = $('ak-mix-status');

    if (!vocals || !music) {
      status.textContent = 'Please upload both vocals and instrumental.';
      return;
    }

    button.disabled = true;
    status.textContent = 'Decoding audio files...';

    let context;
    try {
      context = new AudioContext();
      const [vocalBuffer, musicBuffer] = await Promise.all([
        decode(vocals, context),
        decode(music, context)
      ]);

      const sampleRate = 44100;
      const duration = Math.max(vocalBuffer.duration, musicBuffer.duration);
      const frames = Math.ceil(duration * sampleRate);

      if (!Number.isFinite(frames) || frames <= 0 || frames > sampleRate * 600) {
        throw new Error('Audio duration is invalid or exceeds 10 minutes.');
      }

      status.textContent = 'Mixing audio... Please wait.';
      const offline = new OfflineAudioContext(2, frames, sampleRate);

      function addTrack(buffer, volume) {
        const source = offline.createBufferSource();
        const gain = offline.createGain();
        source.buffer = buffer;
        gain.gain.value = volume;
        source.connect(gain).connect(offline.destination);
        source.start(0);
      }

      const vocalGain = Number($('ak-vocal-gain').value) / 100;
      const musicGain = Number($('ak-music-gain').value) / 100;
      const master = Number($('ak-master-gain').value) / 100;

      const originalDestination = offline.destination;
      const masterNode = offline.createGain();
      masterNode.gain.value = master;
      masterNode.connect(originalDestination);

      // Route both tracks through the master gain.
      offline.destination.disconnect();
      masterNode.connect(offline.destination);

      function addMasterTrack(buffer, volume) {
        const source = offline.createBufferSource();
        const gain = offline.createGain();
        source.buffer = buffer;
        gain.gain.value = volume;
        source.connect(gain).connect(masterNode);
        source.start(0);
      }

      addMasterTrack(vocalBuffer, vocalGain);
      addMasterTrack(musicBuffer, musicGain);

      const mixed = await offline.startRendering();
      status.textContent = 'Creating WAV download...';
      const blob = writeWav(mixed);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'AkStudioFreeai-Mixed-Song.wav';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status.textContent = 'Success! Your mixed WAV is downloaded.';
    } catch (error) {
      console.error(error);
      status.textContent = 'Mixing failed: ' + error.message;
    } finally {
      if (context) await context.close().catch(() => {});
      button.disabled = false;
    }
  };

  $('ak-mix-reset').onclick = () => {
    vocalFile.value = '';
    musicFile.value = '';
    $('ak-vocal-preview').removeAttribute('src');
    $('ak-music-preview').removeAttribute('src');
    $('ak-vocal-gain').value = 100;
    $('ak-music-gain').value = 100;
    $('ak-master-gain').value = 100;
    ['ak-vocal-value', 'ak-music-value', 'ak-master-value']
      .forEach(id => $(id).textContent = '100%');
    $('ak-mix-status').textContent = 'Upload both tracks to begin.';
  };
})();
