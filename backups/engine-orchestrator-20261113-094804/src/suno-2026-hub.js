(() => {
  if (window.AK_SUNO_2026) return;
  window.AK_SUNO_2026 = true;

  const SPACE = 'https://ashklyrics-akstudiofreeai.hf.space';
  const $ = id => document.getElementById(id);

  const features = [
    ['AI Music Generation','ACE-Step','connected'],
    ['Hindi / Punjabi / English','Language workflows','available'],
    ['Multitrack Studio','Browser audio engine','available'],
    ['MIDI Editing','MIDI engine integration','planned'],
    ['AI Stem Separation','Demucs / compatible model','backend needed'],
    ['Voice Profiles','RVC / voice model','model needed'],
    ['Cover & Style Transfer','Audio-conditioned generation','backend needed'],
    ['Extend & Replace Section','Audio continuation / inpainting','backend needed'],
    ['Mashup & Sample','Audio composition pipeline','backend needed'],
    ['Automation & Effects','Browser audio engine','available'],
    ['AI Studio Chat','LLM connection','backend needed']
  ];

  const style = document.createElement('style');
  style.textContent = `
    #ak-suno-hub{position:fixed;right:14px;bottom:135px;z-index:99990;background:#eee;color:#111;border:0;border-radius:24px;padding:12px 16px;font-weight:800}
    #ak-suno-panel{display:none;position:fixed;inset:0;z-index:100020;background:#080808ed;padding:12px;overflow:auto;align-items:center;justify-content:center}
    #ak-suno-panel.open{display:flex}
    .ak-suno-card{width:min(900px,100%);max-height:96vh;overflow:auto;background:#151515;color:white;border:1px solid #444;border-radius:16px;padding:20px}
    .ak-suno-card header{display:flex;justify-content:space-between;align-items:center;gap:10px}
    .ak-suno-card h2{margin:8px 0}
    .ak-suno-card p,.ak-suno-card small{color:#aaa}
    .ak-suno-card button{border:0;border-radius:8px;padding:10px 14px;font-weight:700}
    .ak-suno-status{padding:12px;background:#222;border:1px solid #444;border-radius:9px;margin:12px 0;overflow-wrap:anywhere}
    .ak-suno-feature{display:flex;justify-content:space-between;gap:12px;padding:12px 4px;border-bottom:1px solid #333;font-size:13px}
    .ak-suno-feature small{display:block;color:#999;margin-top:4px}
    .ak-suno-card textarea{width:100%;box-sizing:border-box;background:#222;color:white;border:1px solid #555;border-radius:8px;padding:12px;min-height:90px}
    .ak-suno-actions{display:flex;gap:9px;flex-wrap:wrap;margin:12px 0}
    @media(max-width:550px){.ak-suno-card{padding:13px}.ak-suno-feature{font-size:12px}}
  `;
  document.head.appendChild(style);

  const launch = document.createElement('button');
  launch.id = 'ak-suno-hub';
  launch.textContent = '🚀 AI Studio 2026';
  document.body.appendChild(launch);

  const panel = document.createElement('div');
  panel.id = 'ak-suno-panel';
  panel.innerHTML = `
    <section class="ak-suno-card">
      <header>
        <div>
          <small>AKSTUDIOFREEAI · NEXT GENERATION</small>
          <h2>🚀 AI Music Studio 2026</h2>
          <p>Backend connection and advanced workflow center</p>
        </div>
        <button id="ak-suno-close">✕</button>
      </header>
      <h3>Backend connection</h3>
      <div id="ak-suno-connection" class="ak-suno-status">Not checked yet.</div>
      <div class="ak-suno-actions">
        <button id="ak-suno-check">Check backend</button>
        <button id="ak-suno-info">Discover Gradio API</button>
        <button id="ak-suno-open">Open backend</button>
      </div>
      <h3>2026 feature readiness</h3>
      <div id="ak-suno-features"></div>
      <h3>Music workflow prompt</h3>
      <textarea id="ak-suno-prompt" placeholder="Describe your song, language, mood, genre and production..."></textarea>
      <div class="ak-suno-actions">
        <button id="ak-suno-copy">Copy prompt</button>
        <button id="ak-suno-generator">Open music generator</button>
      </div>
      <div id="ak-suno-result" class="ak-suno-status">Existing ACE-Step generation is preserved.</div>
      <p>Feature status is based on integration readiness, not a claim that every AI model is deployed.</p>
    </section>`;
  document.body.appendChild(panel);

  $('ak-suno-features').innerHTML = features.map(([name,detail,status]) => `
    <div class="ak-suno-feature">
      <div><b>${name}</b><small>${detail}</small></div>
      <span>${status === 'connected' ? '🟢' : status === 'available' ? '🔵' : '🟡'} ${status}</span>
    </div>`).join('');

  launch.onclick = () => panel.classList.add('open');
  $('ak-suno-close').onclick = () => panel.classList.remove('open');

  $('ak-suno-check').onclick = async () => {
    const out = $('ak-suno-connection');
    out.textContent = 'Connecting to ACE-Step backend...';
    try {
      const response = await fetch(SPACE + '/config', {
        method:'GET',
        signal:AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const config = await response.json();
      out.textContent = 'CONNECTED · HTTP ' + response.status +
        ' · Gradio config received · ' +
        (config.version || 'Version not reported');
    } catch (error) {
      out.textContent = 'Connection check failed: ' + error.message +
        '. Space may be sleeping, starting, or unavailable.';
    }
  };

  $('ak-suno-info').onclick = async () => {
    const out = $('ak-suno-result');
    out.textContent = 'Reading Gradio API information...';
    try {
      const response = await fetch(SPACE + '/info', {
        signal:AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const info = await response.json();
      const endpoints = Object.keys(info.named_endpoints || {});
      out.textContent = endpoints.length
        ? 'Discovered endpoints: ' + endpoints.join(', ')
        : 'API responded, but named endpoint details were not exposed.';
    } catch (error) {
      out.textContent = 'API discovery failed: ' + error.message;
    }
  };

  $('ak-suno-open').onclick = () => window.open(SPACE,'_blank','noopener');
  $('ak-suno-copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText($('ak-suno-prompt').value);
      $('ak-suno-result').textContent = 'Prompt copied.';
    } catch {
      $('ak-suno-result').textContent = 'Select and copy the prompt manually.';
    }
  };
  $('ak-suno-generator').onclick = () => {
    panel.classList.remove('open');
    const nav = [...document.querySelectorAll('button')].find(b =>
      /create music/i.test(b.textContent || '')
    );
    if (nav) nav.click();
    else $('ak-suno-result').textContent =
      'Open Create Music from the main navigation.';
  };
})();
