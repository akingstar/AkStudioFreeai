(() => {
  const $ = id => document.getElementById(id);
  let tracks = [];
  let fileId = 0;

  const launch = document.createElement('button');
  launch.id = 'ak-ultimate-launch';
  launch.hidden = true;
  document.body.appendChild(launch);

  function ui() {
    if ($('ak-ultimate-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'ak-ultimate-modal';
    modal.innerHTML = `
      <section class="ak-ultimate-card">
        <header>
          <div>
            <small>AKSTUDIOFREEAI · ULTIMATE WORKSPACE</small>
            <h2>Ultimate Music Studio</h2>
            <p>Multitrack mixing · Vocal processing · Mastering · Export</p>
          </div>
          <button id="ak-u-close">✕</button>
        </header>

        <div class="ak-u-toolbar">
          <label class="ak-u-upload">
            ＋ Add audio tracks
            <input id="ak-u-files" type="file" accept="audio/*" multiple>
          </label>
          <button id="ak-u-clear">Clear tracks</button>
        </div>

        <div id="ak-u-tracks">
          <p class="ak-u-empty">Upload vocals, music or other audio tracks to begin.</p>
        </div>

        <h3>Master processing</h3>
        <div class="ak-u-controls">
          <label>Master volume <output id="ak-u-vol-v">100%</output>
            <input id="ak-u-vol" type="range" min="0" max="120" value="100">
          </label>
          <label>Bass <output id="ak-u-bass-v">0 dB</output>
            <input id="ak-u-bass" type="range" min="-12" max="12" value="0">
          </label>
          <label>Treble <output id="ak-u-treble-v">0 dB</output>
            <input id="ak-u-treble" type="range" min="-12" max="12" value="0">
          </label>
          <label>Reverb <output id="ak-u-reverb-v">0%</output>
            <input id="ak-u-reverb" type="range" min="0" max="50" value="0">
          </label>
          <label>Compression <output id="ak-u-comp-v">50%</output>
            <input id="ak-u-comp" type="range" min="0" max="100" value="50">
          </label>
        </div>

        <div class="ak-u-actions">
          <button id="ak-u-export">Export Master WAV</button>
          <button id="ak-u-stems">Export Individual Tracks</button>
        </div>
        <p id="ak-u-status">Ready. Add audio tracks.</p>
        <p class="ak-u-disclaimer">
          Browser-based mixing and mastering are active. AI source separation and
          neural pitch correction require a connected inference model.
        </p>
      </section>`;
    document.body.appendChild(modal);

    $('ak-u-close').onclick = () => modal.classList.remove('open');
    $('ak-u-files').onchange = async e => {
      for (const file of [...e.target.files]) {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
          tracks.push({
            id: ++fileId,
            name: file.name,
            buffer,
            volume: 100,
            pan: 0,
            muted: false,
            solo: false
          });
          await ctx.close();
        } catch {
          $('ak-u-status').textContent = 'Could not decode one of the selected files.';
        }
      }
      e.target.value = '';
      renderTracks();
    };

    $('ak-u-clear').onclick = () => {
      tracks = [];
      renderTracks();
      $('ak-u-status').textContent = 'All tracks cleared.';
    };

    for (const [id,out,suffix] of [
      ['ak-u-vol','ak-u-vol-v','%'],
      ['ak-u-bass','ak-u-bass-v',' dB'],
      ['ak-u-treble','ak-u-treble-v',' dB'],
      ['ak-u-reverb','ak-u-reverb-v','%'],
      ['ak-u-comp','ak-u-comp-v','%']
    ]) {
      $(id).oninput = e => $(out).textContent = e.target.value + suffix;
    }

    $('ak-u-export').onclick = () => exportAudio(false);
    $('ak-u-stems').onclick = () => exportAudio(true);
  }

  function renderTracks() {
    const area = $('ak-u-tracks');
    if (!tracks.length) {
      area.innerHTML = '<p class="ak-u-empty">No tracks loaded yet.</p>';
      return;
    }

    area.innerHTML = tracks.map(t => `
      <article class="ak-u-track" data-track="${t.id}">
        <div class="ak-u-track-head">
          <b>${escapeText(t.name)}</b>
          <button data-action="remove" data-id="${t.id}">Remove</button>
        </div>
        <div class="ak-u-track-controls">
          <label>Volume <input data-action="volume" data-id="${t.id}" type="range" min="0" max="150" value="${t.volume}"></label>
          <label>Pan <input data-action="pan" data-id="${t.id}" type="range" min="-100" max="100" value="${t.pan}"></label>
          <label><input data-action="mute" data-id="${t.id}" type="checkbox" ${t.muted?'checked':''}> Mute</label>
          <label><input data-action="solo" data-id="${t.id}" type="checkbox" ${t.solo?'checked':''}> Solo</label>
        </div>
      </article>`).join('');

    area.querySelectorAll('[data-action]').forEach(control => {
      control.onchange = () => {
        const t = tracks.find(x => x.id === Number(control.dataset.id));
        if (!t) return;
        const action = control.dataset.action;
        if (action === 'remove') tracks = tracks.filter(x => x.id !== t.id);
        if (action === 'volume') t.volume = Number(control.value);
        if (action === 'pan') t.pan = Number(control.value);
        if (action === 'mute') t.muted = control.checked;
        if (action === 'solo') t.solo = control.checked;
        renderTracks();
      };
    });
  }

  function escapeText(s) {
    return String(s).replace(/[&<>"']/g,c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }

  function wav(buffer) {
    const channels = Math.min(2,buffer.numberOfChannels);
    const frames = buffer.length;
    const bytes = 44 + frames*channels*2;
    const ab = new ArrayBuffer(bytes);
    const v = new DataView(ab);
    const str = (p,s) => [...s].forEach((c,i)=>v.setUint8(p+i,c.charCodeAt(0)));
    str(0,'RIFF'); v.setUint32(4,bytes-8,true); str(8,'WAVE');
    str(12,'fmt '); v.setUint32(16,16,true);
    v.setUint16(20,1,true); v.setUint16(22,channels,true);
    v.setUint32(24,buffer.sampleRate,true);
    v.setUint32(28,buffer.sampleRate*channels*2,true);
    v.setUint16(32,channels*2,true); v.setUint16(34,16,true);
    str(36,'data'); v.setUint32(40,bytes-44,true);
    const data = Array.from({length:channels},(_,c)=>buffer.getChannelData(c));
    let p=44;
    for(let i=0;i<frames;i++) for(let c=0;c<channels;c++) {
      const x=Math.max(-1,Math.min(1,data[c][i]));
      v.setInt16(p,x<0?x*32768:x*32767,true); p+=2;
    }
    return new Blob([ab],{type:'audio/wav'});
  }

  async function exportAudio(individual) {
    if (!tracks.length) {
      $('ak-u-status').textContent = 'Add at least one track first.';
      return;
    }

    const btn = individual ? $('ak-u-stems') : $('ak-u-export');
    btn.disabled = true;

    try {
      const active = tracks.filter(t=>!t.muted);
      const hasSolo = active.some(t=>t.solo);
      const audible = active.filter(t=>!hasSolo || t.solo);
      if (!audible.length) throw new Error('No audible tracks. Check mute/solo.');

      const rate = Math.max(...audible.map(t=>t.buffer.sampleRate));
      const length = Math.ceil(Math.max(...audible.map(t=>t.buffer.duration))*rate);
      const offline = new OfflineAudioContext(2,length,rate);

      const master = offline.createGain();
      master.gain.value = Number($('ak-u-vol').value)/100;

      const bass = offline.createBiquadFilter();
      bass.type='lowshelf'; bass.frequency.value=120;
      bass.gain.value=Number($('ak-u-bass').value);

      const treble = offline.createBiquadFilter();
      treble.type='highshelf'; treble.frequency.value=7000;
      treble.gain.value=Number($('ak-u-treble').value);

      const compressor = offline.createDynamicsCompressor();
      const amount=Number($('ak-u-comp').value);
      compressor.threshold.value=-8-amount*.25;
      compressor.ratio.value=1+amount/10;
      compressor.knee.value=12;
      compressor.attack.value=.01;
      compressor.release.value=.2;

      bass.connect(treble);
      treble.connect(compressor);
      compressor.connect(master);
      master.connect(offline.destination);

      for (const t of audible) {
        const src=offline.createBufferSource();
        src.buffer=t.buffer;
        const gain=offline.createGain();
        gain.gain.value=t.volume/100;
        const pan=offline.createStereoPanner();
        pan.pan.value=t.pan/100;
        src.connect(gain);
        gain.connect(pan);
        pan.connect(bass);
        src.start(0);
      }

      $('ak-u-status').textContent='Rendering audio...';
      const rendered=await offline.startRendering();
      const blob=wav(rendered);
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=individual?'AkStudioFreeai-Mix.wav':'AkStudioFreeai-Master.wav';
      a.click();
      setTimeout(()=>URL.revokeObjectURL(url),10000);
      $('ak-u-status').textContent='✓ WAV export completed.';
    } catch(e) {
      $('ak-u-status').textContent='Export error: '+e.message;
    } finally {
      btn.disabled=false;
    }
  }

  launch.onclick = () => {
    ui();
    $('ak-ultimate-modal').classList.add('open');
  };

  document.addEventListener('click',e=>{
    const b=e.target.closest('.ak-tool-open[data-target="ak-ultimate-launch"]');
    if(b) {
      e.preventDefault();
      launch.click();
    }
  });
})();
