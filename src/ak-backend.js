import { Client } from '@gradio/client'

// Order mein try honge. Naya backend add karna ho to yahan ek line jodo.
const BACKENDS = [
  { name: 'ZeroGPU', id: 'Ashklyrics/AkStudioFreeai', base: 'https://ashklyrics-akstudiofreeai.hf.space' },
  // { name: 'CPU backup', id: 'Ashklyrics/AkStudioFreeai-cpu', base: 'https://ashklyrics-akstudiofreeai-cpu.hf.space' },
]
const QUEUE_KEY = 'akstudio_pending_v1'
const $ = id => document.getElementById(id)
const LANG = { Hindi:'hi', English:'en', Punjabi:'pa', Urdu:'ur', Bengali:'bn', Spanish:'es', French:'fr', Japanese:'ja', 'Multi-language':'unknown' }

const old = $('generate')
const btn = old.cloneNode(true)
old.replaceWith(btn)
const label = btn.querySelector('span')
const notice = $('notice')

const audio = document.createElement('audio')
audio.controls = true
audio.style.cssText = 'width:100%;margin:10px 0;display:none'
document.querySelector('.preview-foot').insertAdjacentElement('beforebegin', audio)

const clients = {}
let busy = false
let retryTimer = null

function buildJob() {
  const prompt = $('prompt').value.trim()
  const instrumental = document.querySelector('.mode.active')?.dataset.mode === 'instrumental'
  return {
    prompt,
    caption: [prompt, $('genre').value, $('mood').value, $('voice').value, $('singing').value + ' singing'].join(', '),
    lyrics: instrumental ? '[Instrumental]' : $('lyrics').value,
    lang: instrumental ? 'unknown' : (LANG[$('language').value] || 'unknown'),
    duration: Math.min(Number($('duration').value) || 60, 60),
  }
}

function argsFor(j) {
  return [
    'acestep-v15-turbo', 'custom', '', 'unknown',
    j.caption, j.lyrics,
    0, '', '', j.lang, 8, 7.0, true, '-1',
    null, j.duration, 1, null, '', 0.0, -1,
    'Fill the audio semantic mask based on the given conditions:',
    1.0, 'text2music', false, 0.0, 1.0, 3.0, 'ode', '', 'mp3',
    0.85, true, 2.0, 0, 0.9, 'NO USER INPUT',
    true, true, true, false, true, false, false, 8,
    'vocals', [], false,
  ]
}

// "Try again in 23:30:50" -> seconds
function waitSeconds(msg) {
  const m = /in (\d+):(\d+):(\d+)/.exec(msg || '')
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : null
}

async function runOn(b, j) {
  clients[b.id] = clients[b.id] || await Client.connect(b.id)
  const res = await clients[b.id].predict('/generation_api', argsFor(j))
  const d = JSON.parse(res.data[0])
  if (d.status !== 'Generation Complete') throw new Error(d.status || 'Generation failed')
  const mp3 = d.all_generated_files.find(f => f.endsWith('.mp3'))
  return `${b.base}/gradio_api/file=${mp3}`
}

async function generateWithFallback(j) {
  let minWait = null
  const errors = []
  for (const b of BACKENDS) {
    try {
      notice.textContent = `${b.name} se generate ho raha hai... (30-90 sec)`
      return await runOn(b, j)
    } catch (e) {
      const msg = String(e?.message || e)
      errors.push(`${b.name}: ${msg}`)
      delete clients[b.id]
      const w = waitSeconds(msg)
      if (w && (minWait === null || w < minWait)) minWait = w
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
  const { job } = JSON.parse(raw)
  await start(job, true)
}

async function start(j, fromQueue = false) {
  busy = true
  btn.disabled = true
  label.textContent = 'Generating...'
  try {
    const url = await generateWithFallback(j)
    localStorage.removeItem(QUEUE_KEY)
    audio.src = url
    audio.style.display = 'block'
    audio.load()
    $('previewDescription').textContent = j.prompt
    notice.textContent = fromQueue ? '✓ Queued song ready!' : '✓ Song ready! Play karke suno.'
  } catch (e) {
    queueJob(j, e.wait)
    const mins = e.wait ? Math.ceil(e.wait / 60) : 60
    notice.textContent = `Sab backends busy/limit par hain. Tumhara song queue mein hai, ~${mins} min baad apne aap retry hoga (page khula rakho). Details: ${e.message.slice(0, 160)}`
  } finally {
    busy = false
    btn.disabled = false
    label.textContent = 'Generate song'
  }
}

btn.addEventListener('click', () => {
  if (busy) return
  const j = buildJob()
  if (!j.prompt) { notice.textContent = 'Please enter a music description first.'; $('prompt').focus(); return }
  start(j)
})

// page khulte hi pending job ho to retry schedule karo
try {
  const raw = localStorage.getItem(QUEUE_KEY)
  if (raw) {
    const { at, wait } = JSON.parse(raw)
    const left = Math.max(0, (wait || 3600) - (Date.now() - at) / 1000)
    notice.textContent = 'Ek pending song queue mein hai, quota aate hi retry hoga.'
    scheduleRetry(left)
  }
} catch {}
