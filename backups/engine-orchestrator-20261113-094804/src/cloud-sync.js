import { createClient } from '@supabase/supabase-js';

(() => {
  if (window.__AKSTUDIO_CLOUD_LOADED__) return;
  window.__AKSTUDIO_CLOUD_LOADED__ = true;

  const URL = import.meta.env.VITE_SUPABASE_URL || '';
  const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const CONFIGURED = URL.startsWith('https://') && KEY.length > 10;

  const PROFILE_KEY = 'akstudiofreeai_profile_v1';
  const PROJECTS_KEY = 'akstudiofreeai_projects_v1';
  const TABLE = 'akstudio_user_data';

  const style = document.createElement('style');
  style.textContent = `
    #ak-cloud-launch {
      position:fixed;right:18px;bottom:250px;z-index:99994;
      background:#fff;color:#000;border:0;border-radius:30px;
      padding:13px 17px;font-weight:bold;cursor:pointer;
    }
    #ak-cloud-panel {
      display:none;position:fixed;z-index:99995;left:50%;top:50%;
      transform:translate(-50%,-50%);width:min(420px,calc(100vw - 28px));
      max-height:85vh;overflow:auto;padding:20px;box-sizing:border-box;
      border:1px solid #555;border-radius:18px;background:#101010;color:#fff;
      box-shadow:0 15px 60px #000b;font:14px Arial;
    }
    #ak-cloud-panel h2{margin:0 0 12px;font-size:21px}
    #ak-cloud-panel label{display:block;margin:12px 0 5px;color:#ddd}
    #ak-cloud-panel input{
      width:100%;box-sizing:border-box;padding:12px;background:#202020;
      color:white;border:1px solid #555;border-radius:8px;
    }
    #ak-cloud-panel button{
      padding:11px 13px;margin:7px 5px 0 0;border:0;
      border-radius:9px;background:#fff;color:#111;font-weight:bold;
    }
    #ak-cloud-panel button.secondary{background:#333;color:white}
    #ak-cloud-panel .info{color:#aaa;font-size:12px;line-height:1.6}
    #ak-cloud-status{white-space:pre-wrap;overflow-wrap:anywhere}
  `;
  document.head.appendChild(style);

  const panel = document.createElement('section');
  panel.id = 'ak-cloud-panel';
  panel.innerHTML = `
    <button class="secondary" id="ak-cloud-close" style="float:right">Close ✕</button>
    <h2>☁️ AkStudio Cloud</h2>
    <p class="info">Sign in to back up your profile and music library privately.</p>
    <label>Email</label>
    <input id="ak-cloud-email" type="email" autocomplete="email" placeholder="Your email">
    <label>Password</label>
    <input id="ak-cloud-password" type="password" autocomplete="current-password"
      placeholder="Minimum 8 characters">
    <button id="ak-cloud-signup">Create Account</button>
    <button id="ak-cloud-login">Login</button>
    <button id="ak-cloud-logout" class="secondary">Logout</button>
    <hr style="border-color:#444;margin-top:15px">
    <button id="ak-cloud-sync">Sync Local + Cloud</button>
    <button id="ak-cloud-restore" class="secondary">Restore Cloud Backup</button>
    <p class="info" id="ak-cloud-status">Checking configuration...</p>
    <p class="info">Your password is handled by Supabase Authentication.
    Never share your password or secret service-role key.</p>
  `;
  document.body.appendChild(panel);

  const launch = document.createElement('button');
  launch.id = 'ak-cloud-launch';
  launch.textContent = '☁️ Cloud Login';
  document.body.appendChild(launch);

  const $ = id => document.getElementById(id);
  const status = message => { $('ak-cloud-status').textContent = message; };

  let supabase = null;
  if (CONFIGURED) {
    supabase = createClient(URL, KEY);
    status('Supabase configured. Sign up or log in.');
  } else {
    status('Setup required: add Supabase URL and anon key in GitHub repository variables.');
  }

  launch.onclick = () => { panel.style.display = 'block'; };
  $('ak-cloud-close').onclick = () => { panel.style.display = 'none'; };

  function localProfile() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
    } catch { return {}; }
  }

  function localProjects() {
    try {
      const value = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function projectKey(project) {
    return project?.id || [
      project?.title || '',
      project?.date || '',
      project?.prompt || ''
    ].join('|');
  }

  function mergeProjects(first, second) {
    const map = new Map();
    for (const project of [...first, ...second]) {
      if (project && typeof project === 'object') {
        map.set(projectKey(project), project);
      }
    }
    return [...map.values()];
  }

  async function currentUser() {
    if (!supabase) throw new Error('Supabase configuration is missing.');
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error('Please log in first.');
    return data.user;
  }

  $('ak-cloud-signup').onclick = async () => {
    try {
      if (!supabase) throw new Error('Supabase setup is not complete.');
      const email = $('ak-cloud-email').value.trim();
      const password = $('ak-cloud-password').value;
      if (!email || password.length < 8) {
        throw new Error('Enter a valid email and password of at least 8 characters.');
      }
      status('Creating account...');
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      status(data.session
        ? 'Account created. You are logged in.'
        : 'Account created. Check your email for verification, then log in.');
    } catch (error) { status('Signup error: ' + error.message); }
  };

  $('ak-cloud-login').onclick = async () => {
    try {
      if (!supabase) throw new Error('Supabase setup is not complete.');
      status('Logging in...');
      const { error } = await supabase.auth.signInWithPassword({
        email: $('ak-cloud-email').value.trim(),
        password: $('ak-cloud-password').value
      });
      if (error) throw error;
      status('Login successful. Your cloud account is ready.');
    } catch (error) { status('Login error: ' + error.message); }
  };

  $('ak-cloud-logout').onclick = async () => {
    try {
      if (!supabase) throw new Error('Supabase setup is not complete.');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      status('Logged out. Local projects remain on this device.');
    } catch (error) { status('Logout error: ' + error.message); }
  };

  $('ak-cloud-sync').onclick = async () => {
    try {
      const user = await currentUser();
      status('Reading cloud backup...');
      const { data: cloud, error: readError } = await supabase
        .from(TABLE).select('profile,projects')
        .eq('user_id', user.id).maybeSingle();

      if (readError) throw readError;

      const profile = {
        ...(cloud?.profile || {}),
        ...localProfile()
      };
      const projects = mergeProjects(
        cloud?.projects || [],
        localProjects()
      );

      status('Uploading profile and ' + projects.length + ' projects...');
      const { error } = await supabase.from(TABLE).upsert({
        user_id: user.id,
        profile,
        projects,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

      if (error) throw error;

      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
      status('Sync successful!\nProjects backed up: ' + projects.length);
    } catch (error) { status('Sync error: ' + error.message); }
  };

  $('ak-cloud-restore').onclick = async () => {
    try {
      const user = await currentUser();
      if (!confirm('Restore cloud profile and library? This replaces the local profile and project list.')) return;

      status('Downloading cloud backup...');
      const { data, error } = await supabase.from(TABLE)
        .select('profile,projects')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('No cloud backup found. Run Sync Local + Cloud first.');

      localStorage.setItem(PROFILE_KEY, JSON.stringify(data.profile || {}));
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(data.projects || []));
      status('Cloud backup restored. Refresh the website to reload your library.');
    } catch (error) { status('Restore error: ' + error.message); }
  };

  if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') status('Logged in: ' + session.user.email);
      if (event === 'SIGNED_OUT') status('Logged out. Local data is unchanged.');
    });
  }

  window.AkStudioCloud = {
    configured: CONFIGURED,
    sync: () => $('ak-cloud-sync').click()
  };
})();
