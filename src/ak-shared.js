// Pure helpers (no DOM). Browser aur Termux relay dono yahi file use karte hain.
export const SPACE_ID = 'Ashklyrics/AkStudioFreeai'
export const SPACE_BASE = 'https://ashklyrics-akstudiofreeai.hf.space'
export const OFFICIAL_SEEDVC = 'Plachta/Seed-VC'

// ACE-Step v1 (classic 3.5B) — second engine, same free ZeroGPU Space
export const ACE_V1_SPACE_ID = 'ACE-Step/ACE-Step'
export const ACE_V1_BASE = 'https://ace-step-ace-step.hf.space'

export const LANG = {
  Hindi: 'hi', English: 'en', Punjabi: 'pa', Urdu: 'ur', Bengali: 'bn',
  Spanish: 'es', French: 'fr', Japanese: 'ja', 'Multi-language': 'unknown',
}

// Form values -> ek job object
export function makeJob(f) {
  const prompt = String(f.prompt || '').trim()
  const instrumental = !!f.instrumental
  const voiceText = f.cloneVoice ? 'clear natural lead vocals' : (f.voice || '')
  return {
    prompt,
    title: f.title || '',
    caption: [prompt, f.genre, f.mood, voiceText, (f.singing || 'Natural') + ' singing'].filter(Boolean).join(', '),
    lyrics: instrumental ? '[Instrumental]' : String(f.lyrics || ''),
    lang: instrumental ? 'unknown' : (LANG[f.language] || 'unknown'),
    duration: Math.max(10, Math.min(Number(f.duration) || 60, 600)),
    engine: f.engine || 'auto',
    fast: f.fast !== false,
  }
}

// ACE-Step Gradio /generation_api ke positional args (original order, unchanged)
export function argsFor(j) {
  return [
    'acestep-v15-turbo', 'custom', '', 'unknown',
    j.caption, j.lyrics,
    0, '', '', j.lang, 8, 7.0, true, '-1',
    null, j.duration, 1, null, '', 0.0, -1,
    'Fill the audio semantic mask based on the given conditions:',
    1.0, 'text2music', false, 0.0, 1.0, 3.0, 'ode', '', 'mp3',
    0.85, !j.fast, 2.0, 0, 0.9, 'NO USER INPUT',
    true, true, true, false, true, false, false, 8,
    'vocals', [], false,
  ]
}

// ACE-Step v1 (classic) Gradio /__call__ ke positional args
export function argsForV1(j) {
  return [
    Math.max(10, Math.min(Number(j.duration) || 60, 240)),
    j.caption,
    j.lyrics === '[Instrumental]' ? '[instrumental]' : j.lyrics,
    j.fast ? 27 : 60,
    15.0, 'euler', 'apg', 10.0,
    '', 0.5, 0.0, 3.0,
    true, false, true, '',
    0.0, 0.0,
    false, 0.5, null, 'none',
  ]
}

// "Try again in 23:30:50" -> seconds
export function waitSeconds(msg) {
  const m = /in (\d+):(\d+):(\d+)/.exec(msg || '')
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : null
}

export function isQuotaError(msg) {
  return /quota|exceeded|too many|rate.?limit|zerogpu|try again in|queue is full|429/i.test(String(msg || ''))
}

export function normBase(u) {
  u = String(u || '').trim()
  return u.endsWith('/') ? u.slice(0, -1) : u
}
