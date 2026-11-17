import { VOICE_SPACE_DEFAULT } from './ak-voice-defaults.js'

const KEY = 'akstudio_settings_v2'
const DEFAULTS = {
  hfToken: '',                         // user ka apna free Hugging Face token (apna quota)
  relayUrl: 'http://127.0.0.1:8787',   // Termux relay (phone)
  useRelay: true,
  extraBackends: [],                   // [{name,url}] user ke apne Spaces
  voiceMode: 'own',                    // own | official
  voiceSpace: VOICE_SPACE_DEFAULT,     // apna voice Space id
  proApiUrl: '',                       // optional paid/proxy voice API (POST base64)
  proApiKey: '',
  voiceSteps: 25,                      // Seed-VC diffusion steps
  localUrl: 'http://127.0.0.1:7861',   // local voice engine (quota fallback)
  localMode: 'auto',
  workerUrl: 'https://akstudio-voice-fallback.akingstar205.workers.dev',
  workerPin: '',                   // auto (cloud fail par) | first | off
}

export function getSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
    return { ...DEFAULTS, ...saved, workerUrl: saved.workerUrl || DEFAULTS.workerUrl }
  }
  catch { return { ...DEFAULTS } }
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
  window.dispatchEvent(new CustomEvent('ak:settings', { detail: next }))
  return next
}
