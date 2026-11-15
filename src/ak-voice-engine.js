// Voice engine: reference quality analysis + zero-shot conversion chain.
// Chain: apna Space (clone_song) -> official Seed-VC (acapella) -> pro proxy API.
import { Client, handle_file } from '@gradio/client'
import { getSettings } from './ak-settings.js'
import { OFFICIAL_SEEDVC } from './ak-shared.js'

export const VOICE_ENGINE_VERSION = '2.0'
const CONVERT_TIMEOUT_MS = 20 * 60 * 1000

const fileOf = (blob, name) => handle_file(new File([blob], name, { type: blob.type || 'audio/wav' }))
const urlOf = x => (x && (x.url || x.path)) || null

async function fetchBlob(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error('Result download fail: HTTP ' + r.status)
  return r.blob()
}

const b64 = async blob => {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let s = ''
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromB64 = (data, type = 'audio/wav') => {
  const bin = atob(data)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return new Blob([buf], { type })
}

// ---------- Reference quality ----------
// Score = kitni achhi reference hai (0-100). Ye quality bar UI me dikhta hai.
export async function analyzeReference(blob, { sr = 24000, maxSec = 25 } = {}) {
  const AC = window.AudioContext || window.webkitAudioContext
  const ctx = new AC()
  let dec
  try {
    dec = await ctx.decodeAudioData(await blob.arrayBuffer())
  } finally { ctx.close?.() }

  const data = dec.getChannelData(0)
  const rate = dec.sampleRate
  const seconds = dec.duration

  let peak = 0, clip = 0
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i])
    if (a > peak) peak = a
    if (a >= 0.99) clip++
  }
  const clipPct = data.length ? (clip / data.length) * 100 : 0

  const frame = Math.max(1, Math.round(rate * 0.02))
  const levels = []
  for (let i = 0; i + frame <= data.length; i += frame) {
    let sum = 0
    for (let j = 0; j < frame; j++) sum += data[i + j] * data[i + j]
    levels.push(Math.sqrt(sum / frame))
  }
  levels.sort((a, b) => a - b)
  const pick = q => levels[Math.min(levels.length - 1, Math.floor(levels.length * q))] || 0
  const noise = pick(0.1)
  const signal = pick(0.9)
  const snrDb = signal > 1e-6 ? Math.round(20 * Math.log10(signal / Math.max(noise, 1e-6))) : 0
  const silencePct = levels.length ? (levels.filter(l => l < 0.02 * Math.max(signal, 1e-6)).length / levels.length) * 100 : 100

  const tips = []
  let score = 100
  if (seconds < 5) { score -= 40; tips.push('Kam se kam 5-10 sec record karo (ideal 10-25s).') }
  else if (seconds < 10) { score -= 15; tips.push('Thoda lamba sample behtar: 10-25 sec.') }
  else if (seconds > maxSec + 5) { score -= 5; tips.push('25 sec se zyada ki zaroorat nahi — engine khud trim karta hai.') }
  if (clipPct > 0.5) { score -= 25; tips.push('Clipping ho rahi hai — mic volume kam karo ya thoda door raho.') }
  if (snrDb < 15) { score -= 25; tips.push('Background noise zyada hai — quiet room me record karo.') }
  else if (snrDb < 22) { score -= 10; tips.push('Noise thoda hai — mic ke paas record karo.') }
  if (silencePct > 55) { score -= 15; tips.push('Bahut khamoshi hai — lagatar gaao/bolo.') }
  if (peak < 0.05) { score -= 30; tips.push('Awaaz bahut dheemi hai — mic ke paas aao.') }
  score = Math.max(0, Math.min(100, score))

  // Trim spec (shuru ki silence hata kar, mono 24k)
  const first = data.findIndex(v => Math.abs(v) > 0.02)
  const offset = Math.max(0, (first >= 0 ? first / rate : 0) - 0.1)
  const dur = Math.min(Math.max(0, seconds - offset), maxSec)
  if (dur < 3) throw new Error('Recording bahut chhoti hai (kam se kam 3 sec saaf awaaz chahiye).')

  return {
    seconds: Number(dur.toFixed(2)),
    sourceSeconds: Number(seconds.toFixed(2)),
    peak: Number(peak.toFixed(3)),
    clipPct: Number(clipPct.toFixed(2)),
    snrDb,
    silencePct: Number(silencePct.toFixed(1)),
    score,
    grade: score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D',
    tips,
    offset,
    sampleRate: sr,
  }
}

// ---------- Backends ----------
async function connect(spaceId, token) {
  return Client.connect(spaceId, token ? { token } : undefined)
}

async function predictWithProgress(client, fn, args, onProgress) {
  const job = client.submit(fn, args)
  if (job && typeof job[Symbol.asyncIterator] === 'function') {
    let out = null
    let events = 0
    for await (const m of job) {
      events++
      if (m?.type === 'status') {
        const p = m.progress_data?.[0]
        if (m.stage === 'error') throw new Error(typeof m.message === 'string' ? m.message : 'Backend error')
        if (m.stage === 'pending') onProgress?.({ progress: 0, desc: 'Queue me hai...' })
        else if (typeof p?.progress === 'number') onProgress?.({ progress: p.progress, desc: p.desc || m.title || 'Process ho raha hai...' })
      } else if (m?.type === 'data') {
        out = m.data
      }
    }
    if (out) return out
    if (events > 0) throw new Error('Backend ne result nahi diya')
  }
  // Kuch client versions GPU endpoint par silently zero events dete hain — predict se real error milega.
  const r = await client.predict(fn, args)
  return r.data
}

async function runOwnSpace({ source, ref, separate, pitch, steps }, onStatus, onProgress) {
  const s = getSettings()
  const space = s.voiceSpace
  if (!space) throw new Error('Voice Space ID set nahi hai (Connections page).')
  onStatus?.(`Mera Voice Space (${space}) se connect... (sleeping Space 1-3 min le sakta hai)`)
  const client = await Promise.race([
    connect(space, s.hfToken),
    new Promise((_, rej) => setTimeout(() => rej(new Error('Voice Space se connect timeout — Space build/runtime error me ho sakta hai')), 25000)),
  ])
  onStatus?.(separate ? 'Demucs + Seed-VC + mix chal raha hai...' : 'Seed-VC convert ho raha hai...')
  const args = [fileOf(source, 'source.mp3'), fileOf(ref, 'reference.wav'), Number(pitch) || 0, Number(steps) || 25, !!separate]
  const data = await predictWithProgress(client, '/clone_song', args, onProgress)
  const [m, v, i, report] = data
  if (!urlOf(m)) throw new Error('Voice Space ne result nahi diya (ya purana version deploy hai).')
  return {
    mixed: await fetchBlob(urlOf(m)),
    vocals: urlOf(v) ? await fetchBlob(urlOf(v)) : null,
    instrumental: urlOf(i) ? await fetchBlob(urlOf(i)) : null,
    report: typeof report === 'string' ? JSON.parse(report || '{}') : null,
    via: 'Mera Voice Space',
  }
}

async function runOfficial({ source, ref, pitch, steps }, onStatus, onProgress) {
  onStatus?.('Official Seed-VC Space (acapella only) se convert ho raha hai...')
  const client = await connect(OFFICIAL_SEEDVC, getSettings().hfToken)
  const args = [fileOf(source, 'source.wav'), fileOf(ref, 'ref.wav'), Number(steps) || 25, 1.0, 0.7, true, false, Number(pitch) || 0]
  const data = await predictWithProgress(client, '/predict_1', args, onProgress)
  const u = urlOf(data[1]) || urlOf(data[0])
  if (!u) throw new Error('Official Space ne audio nahi diya (quota/busy).')
  const out = await fetchBlob(u)
  return { mixed: out, vocals: out, instrumental: null, report: null, via: 'Official Seed-VC' }
}

async function runPro({ source, ref, separate, pitch }, onStatus, onProgress) {
  const { proApiUrl, proApiKey } = getSettings()
  if (!proApiUrl) throw new Error('Pro API URL configured nahi hai.')
  onStatus?.('Pro API backend se convert ho raha hai...')
  onProgress?.({ progress: 0.15, desc: 'Upload ho raha hai...' })
  const body = JSON.stringify({
    audio_base64: await b64(source),
    reference_base64: await b64(ref),
    pitch: Number(pitch) || 0,
    separate: !!separate,
  })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CONVERT_TIMEOUT_MS)
  let res
  try {
    res = await fetch(proApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(proApiKey ? { Authorization: 'Bearer ' + proApiKey } : {}) },
      body,
      signal: controller.signal,
    })
  } finally { clearTimeout(timer) }
  if (!res.ok) throw new Error('Pro API HTTP ' + res.status)
  const j = await res.json()
  if (!j.mixed_base64) throw new Error('Pro API ne mixed audio nahi diya.')
  return {
    mixed: fromB64(j.mixed_base64, j.mixed_type || 'audio/wav'),
    vocals: j.vocals_base64 ? fromB64(j.vocals_base64) : null,
    instrumental: j.instrumental_base64 ? fromB64(j.instrumental_base64) : null,
    report: j.report || null,
    via: 'Pro API',
  }
}

// ---------- Public API ----------
async function runLocal({ source, ref, separate, pitch, steps }, onStatus, onProgress) {
  const url = getSettings().localUrl
  if (!url) throw new Error('Local engine URL configured nahi hai.')
  onStatus?.('Local engine (aapka PC) se convert ho raha hai... (CPU par slow)')
  const client = await Client.connect(url)
  const args = [fileOf(source, 'source.wav'), fileOf(ref, 'reference.wav'), Number(pitch) || 0, Number(steps) || 25, !!separate]
  const data = await predictWithProgress(client, '/clone_song', args, onProgress)
  const [m, v, i, report] = data
  if (!urlOf(m)) throw new Error('Local engine ne result nahi diya (app chal raha hai?)')
  return {
    mixed: await fetchBlob(urlOf(m)),
    vocals: urlOf(v) ? await fetchBlob(urlOf(v)) : null,
    instrumental: urlOf(i) ? await fetchBlob(urlOf(i)) : null,
    report: typeof report === 'string' ? JSON.parse(report || '{}') : null,
    via: 'Local engine',
  }
}

export async function localReachable(url, ms = 2500) {
  if (!url) return false
  try {
    const r = await fetch(url.replace(/\/+$/, '') + '/config', { cache: 'no-store', signal: AbortSignal.timeout(ms) })
    return r.ok
  } catch { return false }
}

export async function convertVoice({ source, ref, separate = true, pitch = 0, steps = 25, onStatus = () => {}, onProgress = () => {} }) {
  const s = getSettings()
  const localReady = s.localMode !== 'off' && await localReachable(s.localUrl)
  const chain = []
  if (localReady && s.localMode === 'first') chain.push({ name: 'Local engine', run: runLocal })
  if (s.localMode !== 'only') {
    if (s.voiceMode === 'official' || s.useOfficial) chain.push({ name: 'Official Seed-VC', run: runOfficial })
    chain.push({ name: 'Mera Voice Space', run: runOwnSpace })
    // Apna Space down/quota par ho to official Seed-VC bhi try karo (acapella only)
    if (s.voiceMode !== 'official') chain.push({ name: 'Official Seed-VC', run: runOfficial })
  }
  if (localReady && s.localMode !== 'first') chain.push({ name: 'Local engine', run: runLocal })
  if (s.proApiUrl) chain.push({ name: 'Pro API', run: runPro })
  if (!chain.length) {
    if (s.localMode === 'only') throw new Error(`Sirf-local mode on hai par local engine ${s.localUrl} par nahi chal raha — local\\start-windows.ps1 chalao (ya Connections me mode badlo).`)
    throw new Error('Koi voice backend available nahi: Connections me voice backend ya local engine set karo.')
  }

  const errors = []
  const t0 = Date.now()
  for (const b of chain) {
    try {
      onProgress({ progress: 0.02, desc: b.name + '...' })
      const r = await Promise.race([
        b.run({ source, ref, separate, pitch, steps }, onStatus, onProgress),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout (20 min)')), CONVERT_TIMEOUT_MS)),
      ])
      return { ...r, ms: Date.now() - t0 }
    } catch (e) {
      let msg = String(e?.message || e).slice(0, 200)
      if (/quota|ZeroGPU runs limit/i.test(msg)) msg += ' — Connections me apna HF token ya Pro API daalo'
      errors.push(`${b.name}: ${msg}`)
      onStatus?.(`${b.name} fail: ${msg} — agla backend try...`)
    }
  }
  const err = new Error(errors.join(' | '))
  err.attempts = errors
  throw err
}

export async function probeVoiceBackend() {
  const s = getSettings()
  const targets = []
  if (s.voiceSpace) targets.push({ name: 'Mera Voice Space', url: 'https://' + s.voiceSpace.replace('/', '-').replace(/[._]/g, '-').toLowerCase() + '.hf.space', path: '/config' })
  targets.push({ name: 'Official Seed-VC', url: 'https://plachta-seed-vc.hf.space', path: '/config' })
  if (s.localUrl && s.localMode !== 'off') targets.push({ name: 'Local engine', url: s.localUrl.replace(/\/+$/, ''), path: '/config' })
  if (s.proApiUrl) targets.push({ name: 'Pro API', url: s.proApiUrl, path: '' })
  return Promise.all(targets.map(async t => {
    try {
      const r = await fetch(t.url + t.path, {
        cache: 'no-store', signal: AbortSignal.timeout(t.path ? 12000 : 8000),
      })
      return { name: t.name, url: t.url, ok: r.ok, status: r.status }
    } catch (e) { return { name: t.name, url: t.url, ok: false, error: String(e.message || e) } }
  }))
}
