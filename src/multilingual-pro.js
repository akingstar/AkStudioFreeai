(() => {
  if (window.AK_MULTILINGUAL_PRO) return;
  window.AK_MULTILINGUAL_PRO = true;

  const languages = {
    hindi: {name:'Hindi', script:'देवनागरी', instruction:'Write natural Hindi lyrics in Devanagari. Use expressive, singable phrasing and natural rhymes.'},
    punjabi: {name:'Punjabi', script:'ਗੁਰਮੁਖੀ', instruction:'Write natural Punjabi lyrics in Gurmukhi script. Use authentic Punjabi expressions, rhythm and rhymes.'},
    romanpunjabi: {name:'Roman Punjabi', script:'Latin', instruction:'Write natural Punjabi lyrics using Roman Punjabi spelling, not Hindi translation.'},
    english: {name:'English', script:'Latin', instruction:'Write fluent, natural English lyrics with musical phrasing and memorable rhymes.'},
    hinglish: {name:'Hindi + English', script:'Mixed', instruction:'Mix natural Hindi and English lyrics smoothly. Avoid awkward literal translations.'},
    punenglish: {name:'Punjabi + English', script:'Mixed', instruction:'Mix authentic Punjabi and English naturally, keeping Punjabi expressions and musical flow.'},
    hindipunjabi: {name:'Hindi + Punjabi', script:'Mixed', instruction:'Blend Hindi and Punjabi naturally with culturally appropriate expressions.'},
    trilingual: {name:'Hindi + Punjabi + English', script:'Mixed', instruction:'Create a balanced Hindi, Punjabi and English multilingual song with natural transitions.'}
  };

  const genres = ['Bollywood','Romantic','Sad','Sufi','Punjabi Pop','Bhangra','Hip-Hop','Rap','Lo-fi','Indie Pop','EDM','Acoustic','Devotional','Folk','Rock','Cinematic'];
  const moods = ['Romantic','Heartbreak','Emotional','Energetic','Motivational','Peaceful','Party','Dark','Nostalgic','Spiritual'];
  const structures = ['Intro → Verse → Chorus → Verse → Chorus → Bridge → Outro','Verse → Pre-Chorus → Chorus → Verse → Chorus → Outro','Intro → Hook → Verse → Hook → Rap → Final Hook'];

  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function addStyles() {
    if (document.getElementById('ak-multi-css')) return;
    const style=document.createElement('style');
    style.id='ak-multi-css';
    style.textContent=`
      #ak-multi-modal{display:none;position:fixed;inset:0;z-index:100005;background:#080808ed;overflow:auto;padding:12px;align-items:center;justify-content:center}
      #ak-multi-modal.open{display:flex}
      .ak-multi-card{width:min(900px,100%);max-height:96vh;overflow:auto;background:#151515;color:#fff;border:1px solid #444;border-radius:17px;padding:20px}
      .ak-multi-card header{display:flex;justify-content:space-between;align-items:center;gap:10px}
      .ak-multi-card h2{font-size:25px;margin:8px 0}
      .ak-multi-card p{color:#aaa;font-size:13px}
      .ak-multi-card label{display:grid;gap:7px;color:#ccc;font-size:13px}
      .ak-multi-card input,.ak-multi-card select,.ak-multi-card textarea{box-sizing:border-box;width:100%;background:#242424;color:white;border:1px solid #555;border-radius:8px;padding:11px}
      .ak-multi-card textarea{min-height:130px;resize:vertical}
      .ak-multi-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin:15px 0}
      .ak-multi-actions{display:flex;gap:9px;flex-wrap:wrap;margin:15px 0}
      .ak-multi-actions button,.ak-multi-card header button{background:#eee;color:#111;border:0;border-radius:8px;padding:12px 15px;font-weight:700}
      .ak-multi-card button:disabled{opacity:.5}
      #ak-multi-result{white-space:pre-wrap;overflow-wrap:anywhere;background:#202020;border:1px solid #444;border-radius:9px;padding:14px;min-height:70px;color:#eee;font-size:13px}
      .ak-multi-note{border-top:1px solid #444;padding-top:12px}
      @media(max-width:550px){.ak-multi-grid{grid-template-columns:1fr}.ak-multi-card{padding:13px}}
    `;
    document.head.appendChild(style);
  }

  function buildUI() {
    if (document.getElementById('ak-multi-modal')) return;
    addStyles();

    const modal=document.createElement('div');
    modal.id='ak-multi-modal';
    modal.innerHTML=`
      <section class="ak-multi-card">
        <header>
          <div><small>AKSTUDIOFREEAI · MULTILINGUAL PRO</small><h2>🌍 Multilingual Song Studio</h2><p>Hindi · Punjabi · English · Mixed Languages</p></div>
          <button id="ak-multi-close">✕</button>
        </header>
        <div class="ak-multi-grid">
          <label>Song language
            <select id="ak-multi-language">
              <option value="hindi">Hindi — हिन्दी</option>
              <option value="punjabi">Punjabi — ਪੰਜਾਬੀ</option>
              <option value="romanpunjabi">Roman Punjabi</option>
              <option value="english">English</option>
              <option value="hinglish">Hindi + English</option>
              <option value="punenglish">Punjabi + English</option>
              <option value="hindipunjabi">Hindi + Punjabi</option>
              <option value="trilingual">Hindi + Punjabi + English</option>
            </select>
          </label>
          <label>Genre
            <select id="ak-multi-genre">${genres.map(x=>`<option>${esc(x)}</option>`).join('')}</select>
          </label>
          <label>Mood
            <select id="ak-multi-mood">${moods.map(x=>`<option>${esc(x)}</option>`).join('')}</select>
          </label>
          <label>Song structure
            <select id="ak-multi-structure">${structures.map(x=>`<option>${esc(x)}</option>`).join('')}</select>
          </label>
          <label>Vocal style
            <select id="ak-multi-voice">
              <option>Male lead vocal</option><option>Female lead vocal</option>
              <option>Male and female duet</option><option>Group vocals</option>
              <option>Rap vocal</option><option>Soft intimate vocal</option>
              <option>Powerful high-energy vocal</option>
            </select>
          </label>
          <label>Production style
            <select id="ak-multi-production">
              <option>Professional studio production</option>
              <option>Acoustic and organic</option>
              <option>Cinematic orchestral</option>
              <option>Modern electronic production</option>
              <option>Live band sound</option>
              <option>Minimal lo-fi production</option>
              <option>Modern Punjabi pop production</option>
            </select>
          </label>
        </div>
        <label>Song topic / story
          <input id="ak-multi-topic" placeholder="Example: long-distance love, heartbreak, friendship...">
        </label>
        <label style="margin-top:14px">Lyrics or ideas (optional)
          <textarea id="ak-multi-lyrics" placeholder="Write your lyrics, hook, story or rough ideas here..."></textarea>
        </label>
        <div class="ak-multi-actions">
          <button id="ak-multi-compose">Create AI Music Prompt</button>
          <button id="ak-multi-apply">Apply to Existing Studio</button>
          <button id="ak-multi-copy">Copy Prompt</button>
        </div>
        <h3>Generated production prompt</h3>
        <div id="ak-multi-result">Choose a language and create your music prompt.</div>
        <p id="ak-multi-status">Your original lyrics are not sent anywhere by this workspace.</p>
        <p class="ak-multi-note">This workspace prepares multilingual instructions for the connected music generator. Actual language quality depends on the connected model. It does not pretend to generate lyrics or clone voices locally.</p>
      </section>`;
    document.body.appendChild(modal);

    const $=id=>document.getElementById(id);
    $('ak-multi-close').onclick=()=>modal.classList.remove('open');

    function compose() {
      const lang=languages[$('ak-multi-language').value];
      const topic=$('ak-multi-topic').value.trim() || 'Create an original song with a memorable emotional hook';
      const lyrics=$('ak-multi-lyrics').value.trim();
      const prompt=[
        'AKSTUDIOFREEAI MULTILINGUAL MUSIC GENERATION',
        'LANGUAGE: '+lang.name,
        'WRITING SYSTEM: '+lang.script,
        'LANGUAGE INSTRUCTION: '+lang.instruction,
        'GENRE: '+$('ak-multi-genre').value,
        'MOOD: '+$('ak-multi-mood').value,
        'VOCAL STYLE: '+$('ak-multi-voice').value,
        'PRODUCTION: '+$('ak-multi-production').value,
        'SONG STRUCTURE: '+$('ak-multi-structure').value,
        'TOPIC: '+topic,
        lyrics ? 'USER LYRICS / IDEAS:\n'+lyrics : 'Create original lyrics matching the selected language and theme.',
        'Keep pronunciation natural, preserve the selected language, use memorable hooks and coherent verses. Do not randomly switch languages unless a mixed-language option is selected.'
      ].join('\n\n');
      $('ak-multi-result').textContent=prompt;
      $('ak-multi-status').textContent='Prompt prepared. Apply it to the existing music studio or copy it.';
      return prompt;
    }

    $('ak-multi-compose').onclick=compose;
    $('ak-multi-copy').onclick=async()=>{
      const p=$('ak-multi-result').textContent;
      if(!p || p.startsWith('Choose a language')) compose();
      try {
        await navigator.clipboard.writeText($('ak-multi-result').textContent);
        $('ak-multi-status').textContent='✓ Prompt copied.';
      } catch {
        $('ak-multi-status').textContent='Clipboard unavailable. Select and copy the prompt manually.';
      }
    };

    $('ak-multi-apply').onclick=()=>{
      const prompt=$('ak-multi-result').textContent.startsWith('Choose a language')?compose():$('ak-multi-result').textContent;
      const candidates=[
        '#prompt','#description','#song-description','#music-prompt',
        'textarea[name="prompt"]','textarea[name="description"]',
        'textarea[placeholder*="prompt" i]','textarea[placeholder*="describe" i]'
      ];
      let target=null;
      for(const selector of candidates){
        const el=document.querySelector(selector);
        if(el && !el.closest('#ak-multi-modal')) {target=el;break;}
      }
      if(!target){
        $('ak-multi-status').textContent='Could not identify the existing prompt field. Prompt is ready to copy.';
        return;
      }
      target.value=prompt;
      target.dispatchEvent(new Event('input',{bubbles:true}));
      target.dispatchEvent(new Event('change',{bubbles:true}));
      $('ak-multi-status').textContent='✓ Prompt inserted into the detected existing field. Review before generating.';
      modal.classList.remove('open');
      target.scrollIntoView({behavior:'smooth',block:'center'});
    };
  }

  const launch=document.createElement('button');
  launch.id='ak-multilingual-launch';
  launch.hidden=true;
  document.body.appendChild(launch);
  launch.onclick=()=>{buildUI();document.getElementById('ak-multi-modal').classList.add('open');};

  document.addEventListener('click',e=>{
    const b=e.target.closest('.ak-tool-open[data-target="ak-multilingual-launch"]');
    if(b){e.preventDefault();launch.click();}
  });
})();
