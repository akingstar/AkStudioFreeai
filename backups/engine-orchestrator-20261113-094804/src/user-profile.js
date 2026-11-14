(() => {
  if (document.getElementById('ak-profile-launch')) return;

  const KEY = 'akstudiofreeai_profile_v1';

  const defaults = {
    displayName: '',
    language: 'Hindi',
    genre: 'Bollywood',
    theme: 'dark'
  };

  function readProfile() {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
      return { ...defaults };
    }
  }

  const style = document.createElement('style');
  style.textContent = `
  #ak-profile-panel{position:fixed;z-index:99993;left:50%;top:50%;
    transform:translate(-50%,-50%);width:min(410px,calc(100vw - 28px));
    max-height:85vh;overflow:auto;background:#101010;color:#fff;
    border:1px solid #555;border-radius:18px;padding:20px;
    box-shadow:0 15px 60px #000b;display:none;font:14px Arial}
  #ak-profile-panel h2{margin:0 0 15px;font-size:21px}
  #ak-profile-panel label{display:block;margin:13px 0 6px;color:#ddd}
  #ak-profile-panel input,#ak-profile-panel select{
    width:100%;box-sizing:border-box;padding:11px;background:#202020;
    color:white;border:1px solid #555;border-radius:8px}
  #ak-profile-panel button{padding:11px 14px;border:0;border-radius:9px;
    background:white;color:#111;font-weight:bold;margin:8px 5px 0 0}
  #ak-profile-panel .close{float:right;background:#333;color:white}
  #ak-profile-panel .info{font-size:12px;color:#aaa;line-height:1.6}
  #ak-profile-launch{position:fixed;right:18px;bottom:192px;z-index:99992;
    background:#fff;color:#000;border:0;border-radius:30px;
    padding:13px 18px;font-weight:bold;cursor:pointer}
  `;
  document.head.appendChild(style);

  const panel = document.createElement('section');
  panel.id = 'ak-profile-panel';
  panel.innerHTML = `
    <button class="close" id="ak-profile-close">Close ✕</button>
    <h2>👤 My Profile</h2>
    <p class="info">Your preferences are saved only in this browser on this device.</p>

    <label>Display name</label>
    <input id="ak-profile-name" maxlength="40" placeholder="Enter your display name">

    <label>Default language</label>
    <select id="ak-profile-language">
      <option>Hindi</option><option>English</option><option>Punjabi</option>
      <option>Urdu</option><option>Bengali</option><option>Spanish</option>
      <option>French</option><option>Japanese</option><option>Multi-language</option>
    </select>

    <label>Default music genre</label>
    <select id="ak-profile-genre">
      <option>Bollywood</option><option>Pop</option><option>Romantic</option>
      <option>Hip Hop</option><option>Rock</option><option>Classical</option>
      <option>EDM</option><option>Lo-fi</option><option>Qawwali</option>
      <option>Acoustic</option><option>Jazz</option><option>Folk</option>
    </select>

    <label>Appearance preference</label>
    <select id="ak-profile-theme">
      <option value="dark">Dark</option>
      <option value="system">System default</option>
    </select>

    <button id="ak-profile-save">Save Preferences</button>
    <button id="ak-profile-export">Export Profile</button>
    <button id="ak-profile-import">Import Profile</button>
    <input id="ak-profile-import-file" type="file" accept="application/json" hidden>
    <button id="ak-profile-reset">Reset Profile</button>
    <p id="ak-profile-status" class="info">Ready.</p>
  `;
  document.body.appendChild(panel);

  const launch = document.createElement('button');
  launch.id = 'ak-profile-launch';
  launch.textContent = '👤 My Profile';
  document.body.appendChild(launch);

  const $ = id => document.getElementById(id);

  function fillForm() {
    const p = readProfile();
    $('ak-profile-name').value = p.displayName;
    $('ak-profile-language').value = p.language;
    $('ak-profile-genre').value = p.genre;
    $('ak-profile-theme').value = p.theme;
  }

  function save() {
    const p = {
      displayName: $('ak-profile-name').value.trim(),
      language: $('ak-profile-language').value,
      genre: $('ak-profile-genre').value,
      theme: $('ak-profile-theme').value
    };
    localStorage.setItem(KEY, JSON.stringify(p));
    $('ak-profile-status').textContent = 'Preferences saved on this device.';
  }

  launch.onclick = () => {
    fillForm();
    panel.style.display = 'block';
  };
  $('ak-profile-close').onclick = () => panel.style.display = 'none';
  $('ak-profile-save').onclick = save;

  $('ak-profile-export').onclick = () => {
    save();
    const blob = new Blob([JSON.stringify(readProfile(), null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AkStudioFreeai-Profile-Backup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    $('ak-profile-status').textContent = 'Profile backup exported.';
  };

  $('ak-profile-import').onclick = () => $('ak-profile-import-file').click();

  $('ak-profile-import-file').onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const allowedLanguages = [...$('ak-profile-language').options].map(x => x.value);
      const allowedGenres = [...$('ak-profile-genre').options].map(x => x.value);

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Invalid profile file.');
      }

      const profile = {
        displayName: typeof data.displayName === 'string'
          ? data.displayName.slice(0, 40) : '',
        language: allowedLanguages.includes(data.language)
          ? data.language : defaults.language,
        genre: allowedGenres.includes(data.genre)
          ? data.genre : defaults.genre,
        theme: data.theme === 'system' ? 'system' : 'dark'
      };

      localStorage.setItem(KEY, JSON.stringify(profile));
      fillForm();
      $('ak-profile-status').textContent = 'Profile imported successfully.';
    } catch (error) {
      $('ak-profile-status').textContent = 'Import failed: ' + error.message;
    }
    event.target.value = '';
  };

  $('ak-profile-reset').onclick = () => {
    if (!confirm('Reset your saved profile preferences?')) return;
    localStorage.removeItem(KEY);
    fillForm();
    $('ak-profile-status').textContent = 'Profile preferences reset.';
  };

  // Expose saved preferences for future studio modules.
  window.AkStudioProfile = {
    get: readProfile,
    save
  };
})();
