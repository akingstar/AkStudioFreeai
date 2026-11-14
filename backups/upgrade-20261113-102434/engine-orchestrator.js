(() => {
  if (window.AKEngine) return;

  const DB = 'akstudiofreeai-engine-jobs';
  const jobs = [];
  const engines = {
    music: {name:'ACE-Step Music Generator',status:'configured'},
    stems: {name:'Demucs Stem Separation',status:'requires-model'},
    voice: {name:'RVC Voice Conversion',status:'requires-model'},
    speech: {name:'Speaking Voice Engine',status:'requires-model'},
    midi: {name:'MIDI Generation',status:'requires-engine'},
    extend: {name:'Audio Extend / Inpainting',status:'requires-model'},
    lyrics: {name:'Multilingual Lyrics Engine',status:'requires-llm'}
  };

  const api = {
    engines,
    jobs,
    createJob(type,payload={}) {
      if (!engines[type]) throw Error('Unknown engine: '+type);
      const job = {
        id: crypto.randomUUID(),
        type,
        payload,
        status:'queued',
        progress:0,
        createdAt:new Date().toISOString(),
        updatedAt:new Date().toISOString()
      };
      jobs.unshift(job);
      this.persist();
      this.emit();
      return job;
    },
    updateJob(id,changes={}) {
      const job=jobs.find(x=>x.id===id);
      if(!job) throw Error('Job not found');
      Object.assign(job,changes,{updatedAt:new Date().toISOString()});
      this.persist();
      this.emit();
      return job;
    },
    retryJob(id) {
      const job=jobs.find(x=>x.id===id);
      if(!job) throw Error('Job not found');
      if(job.status!=='failed') throw Error('Only failed jobs can be retried');
      return this.updateJob(id,{status:'queued',progress:0,error:null});
    },
    async persist() {
      try { localStorage.setItem(DB,JSON.stringify(jobs.slice(0,100))); }
      catch(e) { console.warn('Job persistence:',e); }
    },
    restore() {
      try {
        const saved=JSON.parse(localStorage.getItem(DB)||'[]');
        jobs.splice(0,jobs.length,...saved);
      } catch {}
      this.emit();
    },
    emit() {
      window.dispatchEvent(new CustomEvent('ak:jobs-updated',{detail:jobs}));
    },
    async health() {
      const url='https://ashklyrics-akstudiofreeai.hf.space/config';
      try {
        const r=await fetch(url,{signal:AbortSignal.timeout(15000)});
        return {ok:r.ok,status:r.status,engine:'ACE-Step'};
      } catch(e) {
        return {ok:false,error:e.message,engine:'ACE-Step'};
      }
    },
    async runMusic(payload) {
      const job=this.createJob('music',payload);
      this.updateJob(job.id,{
        status:'ready-for-generator',
        message:'Use the existing ACE-Step generator to submit this job.'
      });
      return job;
    }
  };

  window.AKEngine=api;
  api.restore();

  const style=document.createElement('style');
  style.textContent=`
    #ak-engine-launch{position:fixed;right:14px;bottom:190px;z-index:99990;background:#eee;color:#111;border:0;border-radius:24px;padding:12px 15px;font-weight:800}
    #ak-engine-panel{display:none;position:fixed;inset:0;z-index:100030;background:#080808ed;padding:12px;overflow:auto;align-items:center;justify-content:center}
    #ak-engine-panel.open{display:flex}
    .ak-engine-card{width:min(850px,100%);max-height:96vh;overflow:auto;background:#151515;color:white;border:1px solid #444;border-radius:16px;padding:18px}
    .ak-engine-card header{display:flex;justify-content:space-between}
    .ak-engine-card button{padding:10px 13px;border:0;border-radius:8px;font-weight:700}
    .ak-engine-row{padding:12px 4px;border-bottom:1px solid #333;display:flex;justify-content:space-between;gap:10px;font-size:13px}
    .ak-engine-muted{color:#aaa;font-size:12px}
    #ak-engine-jobs{margin-top:14px}
  `;
  document.head.appendChild(style);

  const launch=document.createElement('button');
  launch.id='ak-engine-launch';
  launch.textContent='⚙️ AI Engine Manager';
  document.body.appendChild(launch);

  const panel=document.createElement('div');
  panel.id='ak-engine-panel';
  panel.innerHTML=`
    <section class="ak-engine-card">
      <header>
        <div><small>AKSTUDIOFREEAI · ENGINE CONTROL</small>
        <h2>AI Engine Manager 2.0</h2></div>
        <button id="ak-engine-close">✕</button>
      </header>
      <button id="ak-engine-health">Check ACE-Step backend</button>
      <div id="ak-engine-health-result" class="ak-engine-muted">Not checked.</div>
      <h3>Engine registry</h3>
      <div id="ak-engine-list"></div>
      <h3>Generation job queue</h3>
      <div id="ak-engine-jobs"></div>
    </section>`;
  document.body.appendChild(panel);

  const $=id=>document.getElementById(id);

  function render() {
    $('ak-engine-list').innerHTML=Object.entries(engines).map(([id,e])=>
      `<div class="ak-engine-row"><b>${e.name}</b><span>${e.status}</span></div>`
    ).join('');

    $('ak-engine-jobs').innerHTML=jobs.length?jobs.map(j=>
      `<div class="ak-engine-row">
        <div><b>${j.type} · ${j.id.slice(0,8)}</b>
        <div class="ak-engine-muted">${j.status} · ${j.progress}%</div>
        ${j.error?`<div>${String(j.error)}</div>`:''}</div>
        ${j.status==='failed'?`<button data-retry="${j.id}">Retry</button>`:''}
      </div>`
    ).join(''):'<p class="ak-engine-muted">No jobs yet.</p>';

    $('ak-engine-jobs').querySelectorAll('[data-retry]').forEach(b=>{
      b.onclick=()=>api.retryJob(b.dataset.retry);
    });
  }

  launch.onclick=()=>{render();panel.classList.add('open');};
  $('ak-engine-close').onclick=()=>panel.classList.remove('open');
  $('ak-engine-health').onclick=async()=>{
    $('ak-engine-health-result').textContent='Checking...';
    const result=await api.health();
    $('ak-engine-health-result').textContent=result.ok
      ? 'Connected · HTTP '+result.status
      : 'Unavailable · '+result.error;
  };
  window.addEventListener('ak:jobs-updated',render);
  render();
})();
