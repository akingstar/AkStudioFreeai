import { Client } from '@gradio/client'
import { loadRegistry } from './ak-registry.js'
import { getSettings } from './ak-settings.js'
import { relayHealth, relayEnqueue, relayWait } from './ak-relay-client.js'
import { phoneGenerate } from './ak-phone-ai.js'
import { SPACE_ID, SPACE_BASE, makeJob, argsFor, waitSeconds, normBase } from './ak-shared.js'

const QUEUE_KEY = 'akstudio_pending_v2'
const $ = id => document.getElementById(id)

const old = $('generate')
const btn = old.cloneNode(true)
old.replaceWith(btn)
const label = btn.querySelector('span')
const notice = $('notice')

const audio = document.createElement('audio')
audio.controls = true
audio.preload = 'metadata'
audio.style.cssText = 'width:100%;margin:10px 0;display:none'
document.querySelector('.preview-foot').insertAdjacentElement('beforebegin', audio)

// Fallback buttons (notice ke neeche)
const actions = document.createElement('div')
actions.className = 'ak-fallback-actions'
actions.hidden = true
actions.innerHTML = `
  <button type="button" class="secondary" id="akPhoneAi">📱 Phone AI (free, instrumental)</button>
  <button type="button" class="secondary" id="akOpenConn">⚙ Connections</button>`
notice.insertAdjacentElement('afterend', actions)

const clients = {}
let busy = false
let retryTimer = null

function say(t) { notice.textContent = t }

function formJob() {
  const voice = $('voice').value
  return makeJob({
    prompt: $('prompt').value,
    title: $('songTitle').value,
    genre: $('genre').value,
    mood: $('mood').value,
    voice,
    cloneVoice: voice === '__clone__',
    singing: $('singing').value,
    lyrics: $('lyrics').value,
    language: $('language').value,
    duration: $('duration').value,
    instrumental: document.querySelector('.mode.active')?.dataset.mode === 'instrumental' || voice === 'Instrumental only',
    fast: window.AK_FAST !== false,
  })
}

async function clientFor(b) {
  const key = b.id + (b.token ? '#t' : '')
  if (!clients[key]) clients[key] = await Client.connect(b.id, b.token ? { hf_token: b.token } : undefined)
  return { key, client: clients[key] }
}

async function runOn(b, j) {
  const { key, client } = await clientFor(b)
  try {
    const res = await client.predict('/generation_api', argsFor(j))
    const d = JSON.parse(res.data[0])
    if (d.status !== 'Generation Complete') throw new Error(d.status || 'Generation failed')
    const mp3 = d.all_generated_files.find(f => f.endsWith('.mp3'))
    if (!mp3) throw new Error('Backend ne mp3 file nahi di')
    return `${b.base}/gradio_api/file=${mp3}`
  } catch (e) { delete clients[key]; throw e }
}

async function buildChain() {
  const s = getSettings()
  const chain = [{ name: 'ZeroGPU', id: SPACE_ID, base: SPACE_BASE }]
  if (s.hfToken) chain.push({ name: 'ZeroGPU (aapka HF account)', id: SPACE_ID, base: SPACE_BASE, token: s.hfToken })
  for (const x of s.extraBackends || []) {
    if (x?.url) chain.push({ name: x.name || 'Custom backend', id: normBase(x.url), base: normBase(x.url) })
  }
  for (const r of await loadRegistry()) chain.push(r)
  return chain
}

async function generateWithFallback(j) {
  let minWait = null
  const errors = []
  for (const b of await buildChain()) {
    try {
      say(`${b.name} se generate ho raha hai... (30-90 sec)`)
      return { url: await runOn(b, j), via: b.name }
    } catch (e) {
      const msg = String(e?.message || e)
      errors.push(`${b.name}: ${msg}`)
      const w = waitSeconds(msg)
      if (w && (minWait === null || w < minWait)) minWait = w
    }
  }
  // Sab cloud backends fail -> Termux relay (phone) agar chal raha ho
  const s = getSettings()
  if (s.useRelay) {
    const h = await relayHealth(s.relayUrl)
    if (h?.ok) {
      say('Cloud limit par hai. Termux relay (aapka phone) job queue karke retry karega...')
      const id = await relayEnqueue(s.relayUrl, j)
      const url = await relayWait(s.relayUrl, id, st => {
        const nxt = st.nextAt ? Math.max(0, Math.round((st.nextAt - Date.now()) / 60000)) : 0
        say(`Termux relay: ${st.status}${st.tries ? ` (try ${st.tries})` : ''}${nxt ? ` · agla retry ~${nxt} min` : ''} — page khula rakho ya baad me wapas aao.`)
      })
      return { url, via: 'Termux relay' }
    }
  }
  const err = new Error(errors.join(' | '))
  err.wait = minWait
  throw err
}

function queueJob(j, wait) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify({ job: j, at: Date.now(), wait }))
  scheduleRetry(wait)
}

function scheduleRetry(wait) {
  clearTimeout(retryTimer)
  const secs = Math.max(30, wait || 3600)
  retryTimer = setTimeout(runQueued, Math.min(secs, 3600) * 1000)
}

async function runQueued() {
  const raw = localStorage.getItem(QUEUE_KEY)
  if (!raw || busy) return
  await start(JSON.parse(raw).job, true)
}

export function setSong(url, meta = {}) {
  audio.src = url
  audio.style.display = 'block'
  audio.load()
  window.dispatchEvent(new CustomEvent('ak:song-ready', { detail: { url, ...meta } }))
}
window.AK = Object.assign(window.AK || {}, { audio, setSong, say, busy: () => busy })
const wave = document.querySelector('.waveform')
audio.addEventListener('play', () => wave?.classList.add('playing'))
;['pause', 'ended'].forEach(ev => audio.addEventListener(ev, () => wave?.classList.remove('playing')))

async function start(j, fromQueue = false) {
  busy = true
  btn.disabled = true
  actions.hidden = true
  label.textContent = 'Generating...'
  try {
    const { url, via } = await generateWithFallback(j)
    localStorage.removeItem(QUEUE_KEY)
    $('previewDescription').textContent = j.prompt
    setSong(url, { job: j, via, queued: fromQueue })
    say(`✓ Song ready (${via}).` + (j.caption.includes('clear natural lead vocals') ? ' Voice clone chal raha hai...' : ' Play karke suno.'))
  } catch (e) {
    queueJob(j, e.wait)
    const mins = e.wait ? Math.ceil(e.wait / 60) : 60
    say(`Sab cloud backends limit par hain. Song queue me hai (~${mins} min baad auto-retry, page khula rakho). ` +
        `Abhi chahiye to "Phone AI" try karo, ya Connections me apna HF token / Termux relay jodo. ` +
        `Detail: ${String(e.message).slice(0, 140)}`)
    actions.hidden = false
  } finally {
    busy = false
    btn.disabled = false
    label.textContent = 'Generate song'
  }
}

btn.addEventListener('click', () => {
  if (busy) return
  const j = formJob()
  if (!j.prompt) { say('Please enter a music description first.'); $('prompt').focus(); return }
  start(j)
})

$('akPhoneAi').addEventListener('click', async () => {
  if (busy) return
  const j = formJob()
  if (!j.prompt) { say('Pehle music description likho.'); return }
  busy = true
  btn.disabled = true
  try {
    const url = await phoneGenerate(`${j.prompt}, ${j.genre}, ${j.mood}`, 15, say)
    setSong(url, { job: j, via: 'Phone AI', noClone: true })
    say('✓ Phone AI se instrumental ready (lyrics/vocals ke liye cloud ya relay chahiye).')
  } catch (e) {
    say('Phone AI nahi chala: ' + String(e.message || e).slice(0, 160) + ' — purane/slow phone par ye aksar fail hota hai.')
  } finally { busy = false; btn.disabled = false }
})
$('akOpenConn').addEventListener('click', () => document.querySelector('[data-page="connect"]')?.click())

// Page khulte hi pending job ho to retry schedule karo
try {
  const raw = localStorage.getItem(QUEUE_KEY)
  if (raw) {
    const { at, wait } = JSON.parse(raw)
    const left = Math.max(0, (wait || 3600) - (Date.now() - at) / 1000)
    say('Ek pending song queue me hai, quota aate hi retry hoga.')
    scheduleRetry(left)
  }
} catch {}

// Warmup: connection ready rakho
Client.connect(SPACE_ID).then(c => { clients[SPACE_ID] = c }).catch(() => {})
