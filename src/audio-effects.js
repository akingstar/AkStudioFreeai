(() => {
  if (document.getElementById('ak-effects-launch')) return;

  const style = document.createElement('style');
  style.textContent = `
  #ak-effects-panel{position:fixed;z-index:99997;left:50%;top:50%;
    transform:translate(-50%,-50%);width:min(430px,calc(100vw - 28px));
    max-height:85vh;overflow:auto;background:#101010;color:#fff;
    border:1px solid #555;border-radius:18px;padding:20px;
    box-shadow:0 15px 60px #000b;display:none;font:14px Arial}
  #ak-effects-panel h2{font-size:21px;margin:0 0 12px}
  #ak-effects-panel label{display:block;margin:13px 0 5px;color:#ddd}
  #ak-effects-panel input[type=file],#ak-effects-panel select{width:100%}
  #ak-effects-panel input[type=range]{width:100%;accent-color:white}
  #ak-effects-panel button{padding:11px 14px;border:0;border-radius:9px;
    background:white;color:#111;font-weight:bold;margin:7px 5px 0 0}
  #ak-effects-panel .close{float:right;background:#333;color:white}
  #ak-effects-panel .info{font-size:12px;color:#aaa;line-height:1.5}
  #ak-effects-launch{position:fixed;right:18px;bottom:76px;z-index:99996;
    background:#fff;color:#000;border:0;border-radius:30px;
    padding:13px 18px;font-weight:bold;cursor:pointer}
  `;
  document.head.appendChild(style);

  const panel = document.createElement('section');
  panel.id = 'ak-effects-panel';
  panel.innerHTML = `
    <button class="close" id="ak-effects-close">Close ✕</button>
    <h2>🎛️ Audio Effects Studio</h2>
    <p class="info">Upload a song, apply effects and export a WAV file. Processing stays in your browser.</p>

    <label>Upload audio</label>
    <input id="ak-effects-file" type="file" accept="audio/*">
    <audio id="ak-effects-preview" controls style="width:100%;margin-top:10px"></audio>

    <label>Preset</label>
    <select id="ak-effects-preset">
      <option value="custom">Custom</option>
      <option value="clean">Clean Vocal</option>
      <option value="bass">Bass Boost</option>
      <option value="bright">Bright Studio</option>
      <option value="warm">Warm Sound</option>
      <option value="radio">Radio Voice</option>
    </select>

    <label>Bass: <span id="ak-bass-value">0</span> dB</label>
    <input id="ak-bass" type="range" min="-12" max="12" value="0">

    <label>Mid: <span id="ak-mid-value">0</span> dB</label>
    <input id="ak-mid" type="range" min="-12" max="12" value="0">

    <label>Treble: <span id="ak-treble-value">0</span> dB</label>
    <input id="ak-treble" type="range" min="-12" max="12" value="0">

    <label>Reverb: <span id="ak-reverb-value">0</span>%</label>
    <input id="ak-reverb" type="range" min="0" max="60" value="0">

    <label>Compression: <span id="ak-compression-value">0</span>%</label>
    <input id="ak-compression" type="range" min="0" max="100" value="0">

    <label>Output volume: <span id="ak-output-value">100</span>%</label>
    <input id="ak-output" type="range" min="10" max="100" value="100">

    <button id="ak-effects-export">Render & Download WAV</button>
    <button id="ak-effects-reset">Reset</button>
    <p id="ak-effects-status" class="info">Choose an audio file to begin.</p>
  `;
  document.body.appendChild(panel);

  const launch = document.createElement('button');
  launch.id = 'ak-effects-launch';
  launch.textContent = '🎛️ Audio Effects';
  document.body.appendChild(launch);

  const $ = id => document.getElementById(id);
  const fileInput = $('ak-effects-file');
  const preview = $('ak-effects-preview');

  launch.onclick = () => panel.style.display = 'block';
  $('ak-effects-close').onclick = () => panel.style.display = 'none';

  fileInput.onchange = () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    preview.src = URL.createObjectURL(file);
    preview.load();
    $('ak-effects-status').textContent = file.name + ' loaded.';
  };

  const controls = ['bass','mid','treble','reverb','compression','output'];
  controls.forEach(name => {
    $(name).oninput = () => {
      $(name + '-value').textContent = $(name).value;
    };
  });

  const presets = {
    clean: [0, 1, 3, 8, 35, 90],
    bass: [8, 0, -1, 5, 20, 90],
    bright: [-1, 1, 7, 10, 25, 88],
    warm: [4, 2, -2, 15, 35, 90],
    radio: [-3, 4, 3, 0, 70, 85]
  };

  $('ak-effects-preset').onchange = () => {
    const values = presets[$('ak-effects-preset').value];
    if (!values) return;
    controls.forEach((name, i) => {
      $(name).value = values[i];
      $(name + '-value').textContent = values[i];
    });
  };

  function makeWav(buffer) {
    const channels = buffer.numberOfChannels;
    const frames = buffer.length;
    const rate = buffer.sampleRate;
    const size = frames * channels * 2;
    const ab = new ArrayBuffer(44 + size);
    const v = new DataView(ab);
    const write = (offset, s) => {
      for (let i = 0; i < s.length; i++) v.setUint8(offset+i,s.charCodeAt(i));
    };
    write(0,'RIFF'); v.setUint32(4,36+size,true);
    write(8,'WAVE'); write(12,'fmt ');
    v.setUint32(16,16,true); v.setUint16(20,1,true);
    v.setUint16(22,channels,true); v.setUint32(24,rate,true);
    v.setUint32(28,rate*channels*2,true);
    v.setUint16(32,channels*2,true); v.setUint16(34,16,true);
    write(36,'data'); v.setUint32(40,size,true);
    let p=44;
    for(let i=0;i<frames;i++){
      for(let c=0;c<channels;c++){
        const x=Math.max(-1,Math.min(1,buffer.getChannelData(c)[i]));
        v.setInt16(p,x<0?x*32768:x*32767,true); p+=2;
      }
    }
    return new Blob([ab],{type:'audio/wav'});
  }

  $('ak-effects-reset').onclick = () => {
    controls.forEach(name => {
      const value = name === 'output' ? 100 : 0;
      $(name).value = value;
      $(name+'-value').textContent = value;
    });
    $('ak-effects-preset').value = 'custom';
    $('ak-effects-status').textContent = 'Settings reset.';
  };

  $('ak-effects-export').onclick = async () => {
    const file = fileInput.files?.[0];
    const button = $('ak-effects-export');
    const status = $('ak-effects-status');
    if (!file) {
      status.textContent = 'Please upload an audio file first.';
      return;
    }

    button.disabled = true;
    let context;
    try {
      status.textContent = 'Loading audio...';
      context = new AudioContext();
      const buffer = await context.decodeAudioData(await file.arrayBuffer());

      if (buffer.duration > 300) {
        throw new Error('For phone memory safety, maximum duration is 5 minutes.');
      }

      const rate = 44100;
      const frames = Math.ceil(buffer.duration * rate);
      const offline = new OfflineAudioContext(2,frames,rate);

      const source = offline.createBufferSource();
      source.buffer = buffer;

      const bass = offline.createBiquadFilter();
      bass.type = 'lowshelf';
      bass.frequency.value = 180;
      bass.gain.value = Number($('ak-bass').value);

      const mid = offline.createBiquadFilter();
      mid.type = 'peaking';
      mid.frequency.value = 1200;
      mid.Q.value = 0.8;
      mid.gain.value = Number($('ak-mid').value);

      const treble = offline.createBiquadFilter();
      treble.type = 'highshelf';
      treble.frequency.value = 5000;
      treble.gain.value = Number($('ak-treble').value);

      const compressor = offline.createDynamicsCompressor();
      const comp = Number($('ak-compression').value) / 100;
      compressor.threshold.value = -8 - comp * 22;
      compressor.ratio.value = 1 + comp * 7;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.2;

      const output = offline.createGain();
      output.gain.value = Number($('ak-output').value)/100;

      const dry = offline.createGain();
      const wet = offline.createGain();
      const reverb = Number($('ak-reverb').value)/100;
      dry.gain.value = 1 - reverb * 0.35;
      wet.gain.value = reverb * 0.55;

      const convolver = offline.createConvolver();
      const impulseLength = Math.floor(rate * 2);
      const impulse = offline.createBuffer(2,impulseLength,rate);
      for(let c=0;c<2;c++){
        const data=impulse.getChannelData(c);
        for(let i=0;i<impulseLength;i++){
          data[i]=(Math.random()*2-1)*Math.pow(1-i/impulseLength,3);
        }
      }
      convolver.buffer = impulse;

      source.connect(bass);
      bass.connect(mid);
      mid.connect(treble);
      treble.connect(compressor);
      compressor.connect(dry);
      compressor.connect(convolver);
      convolver.connect(wet);
      dry.connect(output);
      wet.connect(output);
      output.connect(offline.destination);

      status.textContent = 'Applying effects...';
      const rendered = await offline.startRendering();
      status.textContent = 'Preparing WAV download...';

      const blob = makeWav(rendered);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'AkStudioFreeai-Mastered.wav';
      a.click();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      status.textContent = 'Done! Mastered WAV downloaded.';
    } catch(error) {
      console.error(error);
      status.textContent = 'Error: ' + error.message;
    } finally {
      if(context) await context.close().catch(()=>{});
      button.disabled = false;
    }
  };
})();
