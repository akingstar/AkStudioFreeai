(() => {
  if (window.AK_SONGWRITING_PRO) return;
  window.AK_SONGWRITING_PRO = true;

  const sections = ['Title','Intro','Verse 1','Pre-Chorus','Chorus','Verse 2','Rap / Verse 3','Bridge','Final Chorus','Outro'];
  const $ = id => document.getElementById(id);
  const key = 'akstudiofreeai-songwriting-v2';

  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function mount() {
    if ($('ak-sw-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'ak-sw-modal';
    modal.innerHTML = `
      <main class="ak-sw-card">
        <header>
          <div><small>AKSTUDIOFREEAI · SONGWRITING PRO</small>
          <h2>✍️ Lyrics & Song Builder</h2>
          <p>Hindi · Punjabi · English · Multilingual</p></div>
          <button id="ak-sw-close">✕</button>
        </header>

        <div class="ak-sw-grid">
          <label>Song title<input id="ak-sw-title" placeholder="My New Song"></label>
          <label>Language
            <select id="ak-sw-lang">
              <option>Hindi — Devanagari</option>
              <option>Punjabi — Gurmukhi</option>
              <option>Roman Punjabi</option>
              <option>English</option>
              <option>Hindi + English</option>
              <option>Punjabi + English</option>
              <option>Hindi + Punjabi</option>
              <option>Hindi + Punjabi + English</option>
            </select>
          </label>
          <label>Genre
            <select id="ak-sw-genre">
              <option>Bollywood</option><option>Punjabi Pop</option>
              <option>Sufi</option><option>Romantic</option>
              <option>Sad</option><option>Hip-Hop</option>
              <option>Rap</option><option>Lo-fi</option>
              <option>Indie</option><option>Devotional</option>
              <option>Folk</option><option>Rock</option>
            </select>
          </label>
          <label>Mood
            <select id="ak-sw-mood">
              <option>Emotional</option><option>Romantic</option>
              <option>Heartbreak</option><option>Energetic</option>
              <option>Motivational</option><option>Peaceful</option>
              <option>Nostalgic</option><option>Party</option>
            </select>
          </label>
        </div>

        <label class="ak-sw-topic">Song story / idea
          <textarea id="ak-sw-topic" rows="2" placeholder="Describe the story, emotion or message..."></textarea>
        </label>

        <div class="ak-sw-layout">
          <nav id="ak-sw-sections"></nav>
          <section>
            <label id="ak-sw-active-label">Song lyrics
              <textarea id="ak-sw-editor" rows="12" placeholder="Write your lyrics here..."></textarea>
            </label>
            <div class="ak-sw-stats" id="ak-sw-stats">0 words · 0 characters</div>
          </section>
        </div>

        <div class="ak-sw-actions">
          <button id="ak-sw-add">＋ Add section</button>
          <button id="ak-sw-prompt">Build AI lyrics prompt</button>
          <button id="ak-sw-transfer">Send lyrics to generator</button>
          <button id="ak-sw-export">Export TXT</button>
          <button id="ak-sw-clear">New song</button>
        </div>

        <label>AI songwriting prompt
          <textarea id="ak-sw-output" rows="6" placeholder="Your structured AI prompt appears here..."></textarea>
        </label>
        <p id="ak-sw-status">Autosave enabled on this device.</p>
      </main>`;
    document.body.appendChild(modal);

    const style=document.createElement('style');
    style.textContent=`
      #ak-sw-modal{display:none;position:fixed;z-index:100010;inset:0;background:#080808ed;overflow:auto;padding:12px;align-items:center;justify-content:center}
      #ak-sw-modal.open{display:flex}
      .ak-sw-card{width:min(1000px,100%);max-height:96vh;overflow:auto;background:#151515;color:white;border:1px solid #444;border-radius:16px;padding:20px}
      .ak-sw-card header{display:flex;justify-content:space-between;gap:10px}
      .ak-sw-card h2{margin:8px 0;font-size:25px}
      .ak-sw-card p,.ak-sw-card small{color:#aaa}
      .ak-sw-card label{display:grid;gap:7px;color:#ccc;font-size:13px}
      .ak-sw-card input,.ak-sw-card select,.ak-sw-card textarea{box-sizing:border-box;width:100%;background:#242424;color:white;border:1px solid #555;border-radius:8px;padding:11px;font:inherit}
      .ak-sw-card textarea{resize:vertical}
      .ak-sw-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0}
      .ak-sw-layout{display:grid;grid-template-columns:170px minmax(0,1fr);gap:14px;margin:16px 0}
      #ak-sw-sections{display:flex;flex-direction:column;gap:6px}
      #ak-sw-sections button{background:#252525;color:#ddd;border:1px solid #444;border-radius:7px;padding:10px;text-align:left}
      #ak-sw-sections button.active{background:#eee;color:#111}
      .ak-sw-stats{font-size:12px;color:#aaa;padding-top:8px}
      .ak-sw-actions{display:flex;gap:8px;flex-wrap:wrap;margin:15px 0}
      .ak-sw-actions button,#ak-sw-close{background:#eee;color:#111;border:0;border-radius:8px;padding:11px 13px;font-weight:700}
      @media(max-width:600px){.ak-sw-card{padding:13px}.ak-sw-grid{grid-template-columns:1fr}.ak-sw-layout{grid-template-columns:1fr}#ak-sw-sections{display:grid;grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(style);

    let data={title:'',lang:'Hindi — Devanagari',genre:'Bollywood',mood:'Emotional',topic:'',lyrics:{},custom:[]};
    let active='Title';
    let dirty=false;

    function allSections(){return [...sections,...data.custom];}
    function save(){
      data.title=$('ak-sw-title').value;
      data.lang=$('ak-sw-lang').value;
      data.genre=$('ak-sw-genre').value;
      data.mood=$('ak-sw-mood').value;
      data.topic=$('ak-sw-topic').value;
      data.lyrics[active]=$('ak-sw-editor').value;
      try{
        localStorage.setItem(key,JSON.stringify(data));
        $('ak-sw-status').textContent='✓ Saved on this device.';
      }catch(e){
        $('ak-sw-status').textContent='Autosave unavailable: '+e.message;
      }
      stats();
    }
    function stats(){
      const s=$('ak-sw-editor').value;
      const words=s.trim()?s.trim().split(/\s+/u).length:0;
      $('ak-sw-stats').textContent=words+' words · '+s.length+' characters · '+[...s].length+' letters';
    }
    function renderSections(){
      $('ak-sw-sections').innerHTML=allSections().map(s=>
        `<button class="${s===active?'active':''}" data-section="${esc(s)}">${esc(s)}</button>`
      ).join('');
      $('ak-sw-sections').querySelectorAll('button').forEach(b=>{
        b.onclick=()=>{
          save();
          active=b.dataset.section;
          loadSection();
        };
      });
    }
    function loadSection(){
      $('ak-sw-editor').value=data.lyrics[active]||'';
      $('ak-sw-active-label').firstChild.textContent=active+' lyrics';
      renderSections();
      stats();
    }
    function restore(){
      try{
        const old=JSON.parse(localStorage.getItem(key)||'null');
        if(old)data={...data,...old,lyrics:old.lyrics||{},custom:old.custom||[]};
      }catch{}
      $('ak-sw-title').value=data.title;
      $('ak-sw-lang').value=data.lang;
      $('ak-sw-genre').value=data.genre;
      $('ak-sw-mood').value=data.mood;
      $('ak-sw-topic').value=data.topic;
      loadSection();
    }
    function fullLyrics(){
      save();
      return allSections().map(s=>(data.lyrics[s]||'').trim()?`[${s}]\n${data.lyrics[s].trim()}`:'').filter(Boolean).join('\n\n');
    }

    $('ak-sw-close').onclick=()=>{save();modal.classList.remove('open');};
    ['ak-sw-title','ak-sw-lang','ak-sw-genre','ak-sw-mood','ak-sw-topic'].forEach(id=>$(id).addEventListener('input',save));
    $('ak-sw-editor').addEventListener('input',save);

    $('ak-sw-add').onclick=()=>{
      const name=prompt('Enter new section name:');
      if(!name||!name.trim())return;
      const clean=name.trim().slice(0,40);
      if(allSections().includes(clean))return;
      data.custom.push(clean);
      save();
      active=clean;
      loadSection();
    };

    $('ak-sw-prompt').onclick=()=>{
      const promptText=[
        'Create original, professional song lyrics.',
        'LANGUAGE: '+data.lang,
        'GENRE: '+data.genre,
        'MOOD: '+data.mood,
        'STORY: '+data.topic,
        'STRUCTURE: '+allSections().join(' → '),
        'Use natural pronunciation, strong hooks, memorable rhymes and coherent storytelling.',
        'Respect the selected language and script. Do not translate or randomly mix languages.',
        'Existing lyrics to continue or improve:\n'+fullLyrics()
      ].join('\n\n');
      $('ak-sw-output').value=promptText;
      $('ak-sw-status').textContent='Songwriting prompt prepared.';
    };

    $('ak-sw-transfer').onclick=()=>{
      const lyrics=fullLyrics();
      if(!lyrics){$('ak-sw-status').textContent='Write some lyrics first.';return;}
      const selectors=['#lyrics','#lyrics-input','#song-lyrics','textarea[name="lyrics"]','textarea[placeholder*="lyrics" i]'];
      let target=null;
      for(const selector of selectors){
        const el=document.querySelector(selector);
        if(el&&!el.closest('#ak-sw-modal')){target=el;break;}
      }
      if(!target){$('ak-sw-status').textContent='Generator lyrics field not detected. Export or copy your lyrics instead.';return;}
      target.value=lyrics;
      target.dispatchEvent(new Event('input',{bubbles:true}));
      target.dispatchEvent(new Event('change',{bubbles:true}));
      $('ak-sw-status').textContent='Lyrics inserted. Review before generating.';
      modal.classList.remove('open');
    };

    $('ak-sw-export').onclick=()=>{
      const content=`${data.title||'Untitled Song'}\nLanguage: ${data.lang}\nGenre: ${data.genre}\nMood: ${data.mood}\n\n${fullLyrics()}`;
      const blob=new Blob([content],{type:'text/plain;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;a.download=(data.title||'AkStudioFreeai-Lyrics').replace(/[^\p{L}\p{N}_-]+/gu,'_')+'.txt';
      a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
      $('ak-sw-status').textContent='Lyrics TXT exported.';
    };

    $('ak-sw-clear').onclick=()=>{
      if(!confirm('Start a new song? Current saved lyrics will be cleared.'))return;
      data={title:'',lang:'Hindi — Devanagari',genre:'Bollywood',mood:'Emotional',topic:'',lyrics:{},custom:[]};
      active='Title';
      localStorage.removeItem(key);
      restore();
      $('ak-sw-output').value='';
      $('ak-sw-status').textContent='New song started.';
    };
    restore();
  }

  const button=document.createElement('button');
  button.textContent='✍️ Songwriting Studio';
  button.id='ak-songwriting-launch';
  button.style.cssText='position:fixed;right:14px;bottom:82px;z-index:99990;background:#eee;color:#111;border:0;border-radius:24px;padding:12px 16px;font-weight:700;box-shadow:0 3px 16px #0008';
  button.onclick=()=>{mount();$('ak-sw-modal').classList.add('open');};
  document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(button));
  if(document.body)document.body.appendChild(button);
})();
