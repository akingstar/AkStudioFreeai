(() => {
  const $ = id => document.getElementById(id);
  let selectedFile = null;

  const launch = document.createElement('button');
  launch.id = 'ak-mastering-launch';
  launch.type = 'button';
  launch.hidden = true;
  document.body.appendChild(launch);

  const frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

  function makeUI() {
    if ($('ak-mastering-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'ak-mastering-modal';
    overlay.innerHTML = `
      <section class="ak-master-card">
        <div class="ak-master-top">
          <div>
            <small>AKSTUDIOFREEAI · PRO AUDIO</small>
            <h2>Mastering Studio 2.0</h2>
            <p>Upload audio, shape your sound and export a mastered WAV.</p>
          </div>
          <button id="ak-master-close" type="button">✕</button>
        </div>
        <label class="ak-master-upload">
          <input id="ak-master-file" type="file" accept="audio/*">
          <strong>＋ Choose audio file</strong>
          <span id="ak-master-filename">MP3, WAV, FLAC, OGG and browser-supported formats</span>
        </label>
        <div class="ak-master-eq">
          <h3>10-Band Equalizer</h3>
          <div class="ak-master-bands">
            ${frequencies.map((f,i) => `
              <label><span>${f >= 1000 ? (f/1000)+'k' : f} Hz</span>
              <input type="range" min="-12" max="12" value="0" step="0.5" data-band="${i}">
              <output>0 dB</output></label>
            `).join('')}
          </div>
        </div>
        <div class="ak-master-controls">
          <label>Reverb <output id="ak-reverb-val">15%</output>
            <input id="ak-reverb" type="range" min="0" max="60" value="15"></label>
          <label>Stereo width <output id="ak-width-val">100%</output>
            <input id="ak-width" type="range" min="0" max="200" value="100"></label>
          <label>Compression <output id="ak-comp-val">Medium</output>
            <input id="ak-comp" type="range" min="0" max="100" value="50"></label>
          <label>Output level <output id="ak-level-val">100%</output>
            <input id="ak-level" type="range" min="50" max="120" value="100"></label>
        </div>
        <div class="ak-master-actions">
          <button id="ak-master-reset" type="button">Reset settings</button>
          <button id="ak-master-render" type="button">✦ Master & Export WAV</button>
        </div>
        <p id="ak-master-status">Choose an audio file to begin.</p>
        <audio id="ak-master-preview" controls></audio>
      </section>`;
    document.body.appendChild(overlay);

    $('ak-master-close').onclick = () => overlay.classList.remove('open');
    $('ak-master-file').onchange = e => {
      selectedFile = e.target.files?.[0] || null;
      $('ak-master-filename').textContent = selectedFile?.name || 'No file selected';
      $('ak-master-status').textContent = selectedFile ? 'Audio selected. Ready to master.' : 'Choose an audio file.';
    };

    const ranges = [
      ['ak-reverb','ak-reverb-val',v => v+'%'],
      ['ak-width','ak-width-val',v => v+'%'],
      ['ak-comp','ak-comp-val',v => v < 30 ? 'Light' : v < 70 ? 'Medium' : 'Strong'],
      ['ak-level','ak-level-val',v => v+'%']
    ];
    ranges.forEach(([id,out,fmt]) => $(id).oninput = e => $(out).textContent = fmt(e.target.value));

    document.querySelectorAll('[data-band]').forEach(input => {
      input.oninput = () => input.nextElementSibling.textContent = input.value+' dB';
    });

    $('ak-master-reset').onclick = () => {
      document.querySelectorAll('[data-band]').forEach(x => {
        x.value = 0;
        x.nextElementSibling.textContent = '0 dB';
      });
      ranges.forEach(([id,out,fmt]) => {
        const defaults = {'ak-reverb':15,'ak-width':100,'ak-comp':50,'ak-level':100};
        $(id).value = defaults[id];
        $(out).textContent = fmt(defaults[id]);
      });
      $('ak-master-status').textContent = 'Settings reset.';
    };

    $('ak-master-render').onclick = renderMaster;
  }

  function wavBlob(buffer) {
    const channels = Math.min(2, buffer.numberOfChannels);
    const frames = buffer.length;
    const bytes = 44 + frames * channels * 2;
    const out = new ArrayBuffer(bytes);
    const view = new DataView(out);
    const write = (offset, str) => [...str].forEach((c,i) => view.setUint8(offset+i,c.charCodeAt(0)));
    write(0,'RIFF'); view.setUint32(4,bytes-8,true); write(8,'WAVE');
    write(12,'fmt '); view.setUint32(16,16,true);
    view.setUint16(20,1,true); view.setUint16(22,channels,true);
    view.setUint32(24,buffer.sampleRate,true);
    view.setUint32(28,buffer.sampleRate*channels*2,true);
    view.setUint16(32,channels*2,true); view.setUint16(34,16,true);
    write(36,'data'); view.setUint32(40,bytes-44,true);

    const data = Array.from({length:channels},(_,c) => buffer.getChannelData(c));
    let offset = 44;
    for (let i=0;i<frames;i++) for (let c=0;c<channels;c++) {
      const sample = Math.max(-1,Math.min(1,data[c][i]));
      view.setInt16(offset,sample < 0 ? sample*32768 : sample*32767,true);
      offset += 2;
    }
    return new Blob([out],{type:'audio/wav'});
  }

  async function renderMaster() {
    if (!selectedFile) {
      $('ak-master-status').textContent = 'Pehle audio file choose karo.';
      return;
    }
    const button = $('ak-master-render');
    button.disabled = true;
    try {
      $('ak-master-status').textContent = 'Reading audio file...';
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const bytes = await selectedFile.arrayBuffer();
      const decoded = await ctx.decodeAudioData(bytes.slice(0));
      const rate = decoded.sampleRate;
      const offline = new OfflineAudioContext(2,Math.ceil(decoded.duration*rate),rate);
      const source = offline.createBufferSource();
      source.buffer = decoded;

      let previous = source;
      const bands = [...document.querySelectorAll('[data-band]')];
      frequencies.forEach((freq,i) => {
        const filter = offline.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1.1;
        filter.gain.value = Number(bands[i].value);
        previous.connect(filter);
        previous = filter;
      });

      const comp = offline.createDynamicsCompressor();
      const amount = Number($('ak-comp').value);
      comp.threshold.value = -10 - amount*0.25;
      comp.knee.value = 20;
      comp.ratio.value = 1 + amount/12;
      comp.attack.value = 0.008;
      comp.release.value = 0.22;
      previous.connect(comp);

      const sum = offline.createGain();
      const dry = offline.createGain();
      const convolver = offline.createConvolver();
      const wet = offline.createGain();
      const reverbAmount = Number($('ak-reverb').value)/100;
      dry.gain.value = 1 - reverbAmount*0.45;
      wet.gain.value = reverbAmount;

      const impulseLength = Math.floor(rate*2.2);
      const impulse = offline.createBuffer(2,impulseLength,rate);
      for(let c=0;c<2;c++) {
        const data = impulse.getChannelData(c);
        for(let i=0;i<impulseLength;i++) {
          data[i]=(Math.random()*2-1)*Math.pow(1-i/impulseLength,3);
        }
      }
      convolver.buffer = impulse;
      comp.connect(dry); dry.connect(sum);
      comp.connect(convolver); convolver.connect(wet); wet.connect(sum);

      const splitter = offline.createChannelSplitter(2);
      const merger = offline.createChannelMerger(2);
      const mid = offline.createGain();
      const side = offline.createGain();
      const left = offline.createGain();
      const right = offline.createGain();
      const sideLeft = offline.createGain();
      const sideRight = offline.createGain();
      const width = Number($('ak-width').value)/100;

      splitter.connect(mid,0); splitter.connect(mid,1);
      splitter.connect(side,0); splitter.connect(side,1);
      mid.gain.value = 0.5;
      side.gain.value = 0.5;
      sideLeft.gain.value = width;
      sideRight.gain.value = -width;
      mid.connect(left); mid.connect(right);
      side.connect(sideLeft); side.connect(sideRight);
      left.connect(merger,0,0); sideLeft.connect(merger,0,0);
      right.connect(merger,0,1); sideRight.connect(merger,0,1);

      const limiter = offline.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.12;
      const output = offline.createGain();
      output.gain.value = Number($('ak-level').value)/100;

      sum.connect(splitter);
      merger.connect(limiter);
      limiter.connect(output);
      output.connect(offline.destination);

      source.connect(previous === source ? comp : previous);
      source.start(0);
      $('ak-master-status').textContent = 'Mastering audio... Please wait.';
      const rendered = await offline.startRendering();
      $('ak-master-status').textContent = 'Creating WAV file...';

      const blob = wavBlob(rendered);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'AkStudioFreeai-Mastered.wav';
      a.click();
      $('ak-master-preview').src = url;
      $('ak-master-status').textContent = '✓ Mastered WAV exported successfully.';
      await ctx.close();
    } catch(error) {
      $('ak-master-status').textContent = 'Mastering error: '+(error.message || error);
    } finally {
      button.disabled = false;
    }
  }

  launch.addEventListener('click',() => {
    makeUI();
    $('ak-mastering-modal').classList.add('open');
  });

  document.addEventListener('click',e => {
    const tool = e.target.closest('.ak-tool-open[data-target="ak-mastering-launch"]');
    if (tool) {
      e.preventDefault();
      launch.click();
    }
  });
})();
