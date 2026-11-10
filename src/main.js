import './style.css'

const app = document.querySelector('#app')

app.innerHTML = `
<div class="layout">
  <aside class="sidebar" id="sidebar">
    <div class="brand"><span class="brand-icon">A</span><span>AkStudio<span class="muted">Freeai</span></span></div>
    <div class="side-label">WORKSPACE</div>
    <button class="nav active" data-page="create">✦ <span>Create Music</span></button>
    <button class="nav" data-page="library">▤ <span>My Library</span></button>
    <button class="nav" data-page="voices">◉ <span>AI Voices</span></button>
    <button class="nav" data-page="tools">⌘ <span>Audio Tools</span></button>
    <div class="side-label second">STUDIO</div>
    <div class="side-note"><span class="live-dot"></span> Studio workspace</div>
    <div class="sidebar-bottom">
      <div class="avatar">AK</div>
      <div><b>My Studio</b><small>Free workspace</small></div>
      <span class="more">···</span>
    </div>
  </aside>

  <main class="main">
    <header class="topbar">
      <button class="mobile-menu" id="menu">☰</button>
      <div class="breadcrumb">Workspace <span>/</span> <b id="crumb">Create Music</b></div>
      <div class="top-right"><span class="plan">FREE STUDIO</span><button class="help">?</button></div>
    </header>

    <section class="page" id="createPage">
      <div class="hero">
        <div class="eyebrow"><span class="live-dot"></span> YOUR PERSONAL AI MUSIC STUDIO</div>
        <h1>Make music.<br><span>Feel everything.</span></h1>
        <p>Turn your imagination into songs. Create, experiment and build your sound.</p>
      </div>

      <div class="studio-grid">
        <section class="editor panel">
          <div class="panel-head"><div><span class="step">01</span><b>Song creation</b></div><span class="subtle">TEXT TO MUSIC</span></div>

          <label class="field-label">SONG TITLE</label>
          <input id="songTitle" class="text-input" placeholder="Give your song a name..." maxlength="80">

          <div class="mode-row">
            <button class="mode active" data-mode="custom">✎ Custom lyrics</button>
            <button class="mode" data-mode="instrumental">♫ Instrumental</button>
          </div>

          <div id="lyricsArea">
            <div class="label-row"><label class="field-label">YOUR LYRICS</label><span class="subtle" id="count">0 characters</span></div>
            <textarea id="lyrics" class="lyrics" placeholder="Write your lyrics here...&#10;&#10;[Verse 1]&#10;Your story begins here...&#10;&#10;[Chorus]&#10;Add your chorus..."></textarea>
          </div>

          <label class="field-label prompt-label">MUSIC DESCRIPTION</label>
          <textarea id="prompt" class="prompt" placeholder="Describe the sound you imagine. Example: Emotional Hindi romantic ballad, soulful male vocals, acoustic guitar, cinematic strings, powerful chorus..."></textarea>
          <div class="prompt-foot"><span class="subtle">Describe genre, instruments, mood and vocal style</span><button id="idea" class="text-button">✦ Inspire me</button></div>

          <div class="divider"></div>
          <div class="panel-head settings-head"><div><span class="step">02</span><b>Sound settings</b></div></div>
          <div class="settings-grid">
            <div><label class="field-label">MUSIC STYLE</label><select id="genre"><option>Pop</option><option>Bollywood</option><option>Romantic</option><option>Hip Hop</option><option>Rock</option><option>Classical</option><option>EDM</option><option>Lo-fi</option><option>Qawwali</option><option>Acoustic</option><option>Jazz</option><option>Folk</option></select></div>
            <div><label class="field-label">MOOD</label><select id="mood"><option>Emotional</option><option>Romantic</option><option>Energetic</option><option>Sad</option><option>Peaceful</option><option>Dark</option><option>Hopeful</option><option>Epic</option></select></div>
            <div><label class="field-label">LANGUAGE</label><select id="language"><option>Hindi</option><option>English</option><option>Punjabi</option><option>Urdu</option><option>Bengali</option><option>Spanish</option><option>French</option><option>Japanese</option><option>Multi-language</option></select></div>
            <div><label class="field-label">SONG LENGTH</label><select id="duration"><option value="60">1 minute</option><option value="120">2 minutes</option><option value="180" selected>3 minutes</option><option value="240">4 minutes</option><option value="300">5 minutes</option></select></div>
          </div>

          <div class="divider"></div>
          <div class="panel-head"><div><span class="step">03</span><b>Vocal direction</b></div><span class="subtle">ADVANCED CONTROLS</span></div>
          <div class="settings-grid">
            <div><label class="field-label">VOICE</label><select id="voice"><option>Male — Warm</option><option>Male — Deep</option><option>Male — Soulful</option><option>Female — Soft</option><option>Female — Powerful</option><option>Duet</option><option>Instrumental only</option><option>My cloned voice (future)</option></select></div>
            <div><label class="field-label">SINGING STYLE</label><select id="singing"><option>Natural</option><option>Powerful</option><option>Breathy</option><option>Classical</option><option>Falsetto</option><option>Rap</option><option>Melodic</option></select></div>
          </div>
          <div class="range-row"><label>Vocal intensity <output id="intensityVal">70%</output></label><input type="range" id="intensity" min="0" max="100" value="70"></div>
          <div class="range-row"><label>Pitch <output id="pitchVal">0</output></label><input type="range" id="pitch" min="-12" max="12" value="0"></div>
          <div class="range-row"><label>Emotion <output id="emotionVal">75%</output></label><input type="range" id="emotion" min="0" max="100" value="75"></div>

          <div class="generate-area">
            <button id="generate" class="generate">✦ <span>Generate song</span> <span class="arrow">→</span></button>
            <p>AI generation becomes available after a compatible backend is connected.</p>
          </div>
          <div id="notice" class="notice" role="status">Studio interface ready. AI engine is not connected yet.</div>
        </section>

        <aside class="right-column">
          <section class="panel preview">
            <div class="panel-head"><b>Studio preview</b><span class="subtle">YOUR CANVAS</span></div>
            <div class="artwork"><div class="art-circle"></div><div class="art-center">A<span>✦</span></div><div class="art-caption">AK STUDIO FREEAI</div></div>
            <h3 id="previewTitle">Your next hit starts here</h3>
            <p id="previewDescription">Your generated tracks will appear here.</p>
            <div class="waveform">${Array.from({length:38},(_,i)=>`<i style="--h:${12+Math.abs(Math.sin(i*2.4))*35}px"></i>`).join('')}</div>
            <div class="player-meta"><span>00:00</span><span>--:--</span></div>
            <div class="player-controls"><button disabled>↶</button><button class="play" disabled>▶</button><button disabled>↷</button></div>
            <div class="preview-foot">No audio generated yet</div>
          </section>

          <section class="panel quick">
            <div class="panel-head"><b>Studio tools</b><span class="subtle">COMING NEXT</span></div>
            <div class="tool-row"><span class="tool-icon">◉</span><div><b>Voice cloning</b><small>Train your singing voice</small></div><span class="coming">SOON</span></div>
            <div class="tool-row"><span class="tool-icon">♫</span><div><b>Vocal separation</b><small>Vocals and instrumentals</small></div><span class="coming">SOON</span></div>
            <div class="tool-row"><span class="tool-icon">⌁</span><div><b>Audio mastering</b><small>Polish your final sound</small></div><span class="coming">SOON</span></div>
            <div class="tool-row"><span class="tool-icon">⟳</span><div><b>Remix & extend</b><small>Reimagine your music</small></div><span class="coming">SOON</span></div>
          </section>
        </aside>
      </div>
      <footer>AKSTUDIOFREEAI <span>·</span> CREATE WITHOUT LIMITS <span class="footer-right">Independent open-source project</span></footer>
    </section>

    <section class="page hidden" id="otherPage">
      <div class="hero small-hero"><div class="eyebrow">AKSTUDIOFREEAI WORKSPACE</div><h1 id="otherTitle">My Library</h1><p id="otherText">Your creative workspace.</p></div>
      <div class="panel empty-state"><div class="empty-icon">♫</div><h2 id="emptyTitle">Your music library is waiting</h2><p>This section will become active as we connect the audio backend.</p><button class="secondary" id="backCreate">← Back to Create Music</button></div>
    </section>
  </main>
</div>
`

const $ = id => document.getElementById(id)
const notice = $('notice')
let mode = 'custom'

$('lyrics').addEventListener('input', () => $('count').textContent = `${$('lyrics').value.length} characters`)

$('intensity').addEventListener('input', e => $('intensityVal').textContent = e.target.value + '%')
$('emotion').addEventListener('input', e => $('emotionVal').textContent = e.target.value + '%')
$('pitch').addEventListener('input', e => $('pitchVal').textContent = e.target.value)

document.querySelectorAll('.mode').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.mode').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  mode = btn.dataset.mode
  $('lyricsArea').classList.toggle('hidden', mode === 'instrumental')
  notice.textContent = mode === 'instrumental' ? 'Instrumental mode selected.' : 'Custom lyrics mode selected.'
}))

$('idea').addEventListener('click', () => {
  const ideas = [
    'Cinematic Bollywood romantic ballad, soulful expressive male vocals, acoustic guitar, piano, lush strings and an emotional soaring chorus.',
    'Modern Punjabi pop, energetic dhol rhythm, deep bass, catchy melodic hook and confident male vocals.',
    'Dreamy lo-fi atmosphere, soft piano, warm ambient textures, gentle percussion and intimate emotional vocals.',
    'Epic orchestral soundtrack, powerful choir, dramatic strings, cinematic percussion and a triumphant melody.'
  ]
  $('prompt').value = ideas[Math.floor(Math.random() * ideas.length)]
  notice.textContent = 'A new music idea has been added to your description.'
})

$('generate').addEventListener('click', () => {
  const prompt = $('prompt').value.trim()
  if (!prompt) {
    notice.textContent = 'Please enter a music description first.'
    $('prompt').focus()
    return
  }
  notice.textContent = 'Your settings are ready. Connect an AI music backend in the next development stage to generate real audio.'
})

$('songTitle').addEventListener('input', e => {
  $('previewTitle').textContent = e.target.value.trim() || 'Your next hit starts here'
})

$('menu').addEventListener('click', () => $('sidebar').classList.toggle('open'))

const pages = {
  create: ['Create Music', 'Create your next song', 'Your creative workspace'],
  library: ['My Library', 'Your music library', 'Your saved tracks and creations will live here.'],
  voices: ['AI Voices', 'Your voice studio', 'Voice profiles and voice training tools will live here.'],
  tools: ['Audio Tools', 'Your audio toolbox', 'Separation, mastering, remixing and audio processing tools will live here.']
}

document.querySelectorAll('.nav').forEach(btn => btn.addEventListener('click', () => {
  const page = btn.dataset.page
  document.querySelectorAll('.nav').forEach(b => b.classList.toggle('active', b === btn))
  $('crumb').textContent = pages[page][0]
  $('createPage').classList.toggle('hidden', page !== 'create')
  $('otherPage').classList.toggle('hidden', page === 'create')
  $('otherTitle').textContent = pages[page][1]
  $('otherText').textContent = pages[page][2]
  $('emptyTitle').textContent = page === 'library' ? 'Your music library is waiting' : page === 'voices' ? 'Your voice studio is waiting' : 'Your audio tools are waiting'
  $('sidebar').classList.remove('open')
}))

$('backCreate').addEventListener('click', () => document.querySelector('[data-page="create"]').click())

// ===== AKSTUDIO STAGE 3: MY LIBRARY =====
const AK_KEY = 'akstudiofreeai_projects_v1';

function akGetProjects() {
  try {
    const data = JSON.parse(localStorage.getItem(AK_KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function akStoreProjects(data) {
  localStorage.setItem(AK_KEY, JSON.stringify(data));
}

function akSafe(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}

const akSave = document.createElement('button');
akSave.id = 'akSaveProject';
akSave.className = 'secondary ak-save';
akSave.textContent = '＋ Save Project to My Library';
akSave.type = 'button';
$('generate').insertAdjacentElement('afterend', akSave);

akSave.addEventListener('click', () => {
  const project = {
    id: Date.now().toString() + Math.random().toString(16).slice(2),
    title: $('songTitle').value.trim() || 'Untitled Project',
    mode,
    lyrics: $('lyrics').value,
    prompt: $('prompt').value,
    genre: $('genre').value,
    mood: $('mood').value,
    language: $('language').value,
    duration: $('duration').value,
    voice: $('voice').value,
    singing: $('singing').value,
    intensity: $('intensity').value,
    pitch: $('pitch').value,
    emotion: $('emotion').value,
    date: new Date().toISOString()
  };

  if (!project.prompt.trim() && !project.lyrics.trim()) {
    notice.textContent = 'Pehle lyrics ya music description likho.';
    return;
  }

  try {
    const projects = akGetProjects();
    projects.unshift(project);
    akStoreProjects(projects);
    notice.textContent = '✓ Project successfully My Library mein save ho gaya!';
    akSave.textContent = '✓ Project Saved';
    setTimeout(() => akSave.textContent = '＋ Save Project to My Library', 1800);
  } catch {
    notice.textContent = 'Storage full hai. Kuch browser storage clear karo.';
  }
});

function akRenderLibrary() {
  const panel = $('otherPage').querySelector('.empty-state');
  const projects = akGetProjects();

  panel.classList.add('ak-library-panel');

  if (!projects.length) {
    panel.innerHTML = `
      <div class="empty-icon">♫</div>
      <h2>Your Library is Empty</h2>
      <p>Create Music page par apna project save karo. Woh yahan dikhega.</p>
      <button class="secondary" id="akBack">← Create Music</button>`;
    $('akBack').onclick = () => document.querySelector('[data-page="create"]').click();
    return;
  }

  panel.innerHTML = `
    <div class="ak-library-heading">
      <div><h2>My Projects</h2><p>${projects.length} saved projects</p></div>
      <button class="secondary" id="akExport">↓ Export Backup</button>
    </div>
    <div class="ak-project-list">
      ${projects.map(p => `
        <article class="ak-project">
          <div class="ak-project-icon">♫</div>
          <div class="ak-project-info">
            <b>${akSafe(p.title)}</b>
            <small>${akSafe(p.genre)} · ${akSafe(p.language)} · ${akSafe(p.mood)}</small>
            <small>${new Date(p.date).toLocaleString()}</small>
          </div>
          <button class="secondary ak-open" data-id="${akSafe(p.id)}">Open</button>
          <button class="ak-delete" data-id="${akSafe(p.id)}">✕</button>
        </article>`).join('')}
    </div>
    <p class="ak-local-note">Saved on this device/browser. Cloud sync is not connected.</p>`;

  $('akExport').onclick = () => {
    const blob = new Blob([JSON.stringify(projects, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AkStudioFreeai-Library-Backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };
}

$('otherPage').querySelector('.empty-state').addEventListener('click', e => {
  const open = e.target.closest('.ak-open');
  const remove = e.target.closest('.ak-delete');

  if (open) {
    const p = akGetProjects().find(x => x.id === open.dataset.id);
    if (!p) return;

    $('songTitle').value = p.title || '';
    $('lyrics').value = p.lyrics || '';
    $('prompt').value = p.prompt || '';

    ['genre','mood','language','duration','voice','singing',
     'intensity','pitch','emotion'].forEach(key => {
      if (p[key] !== undefined) $(key).value = p[key];
    });

    mode = p.mode === 'instrumental' ? 'instrumental' : 'custom';
    document.querySelectorAll('.mode').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === mode)
    );

    $('lyricsArea').classList.toggle('hidden', mode === 'instrumental');
    $('count').textContent = $('lyrics').value.length + ' characters';
    $('intensityVal').textContent = $('intensity').value + '%';
    $('pitchVal').textContent = $('pitch').value;
    $('emotionVal').textContent = $('emotion').value + '%';
    $('previewTitle').textContent = p.title;
    notice.textContent = 'Project opened successfully.';

    document.querySelector('[data-page="create"]').click();
  }

  if (remove) {
    if (!confirm('Delete this project permanently?')) return;
    akStoreProjects(akGetProjects().filter(p => p.id !== remove.dataset.id));
    akRenderLibrary();
  }
});

document.querySelector('[data-page="library"]').addEventListener(
  'click', akRenderLibrary
);

import './song-mixer.js';

import './audio-effects.js';

import './stem-tools.js';

import './user-profile.js';
