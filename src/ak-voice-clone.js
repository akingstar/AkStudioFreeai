import { Client, handle_file } from '@gradio/client'
import { getSettings } from './ak-settings.js'
import { toRefWav, dl } from './ak-audio-utils.js'
import { OFFICIAL_SEEDVC } from './ak-shared.js'

const $ = id => document.getElementById(id)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const DB = 'akstudio_voice_clone', STORE = 'profiles'
const CLONE_VALUE = '__clone__'
const READ_LINES = [
  'आज मैं अपनी आवाज़ में एक नया गीत गाने जा रहा हूँ, दिल की हर धड़कन में एक कहानी छुपी है।',
  'The sound of my voice is clear and natural, and I can sing softly or loudly with real emotion.',
  'चाँदनी रात में सपनों का एक नया संसार है, तेरी यादों में दिल आज भी खोया रहता है।',
]

let db, rec, stream, recChunks = [], recTimer, recStart = 0, audioCtx, rafId
let lastOriginal = null

// ---------- IndexedDB ----------
const openDB = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' })
  r.onsuccess = () => res(r.result)
  r.onerror = () => rej(r.error)
})
const tx = (mode, fn) => new Promise((res, rej) => {
  const t = db.transaction(STORE, mode), q = fn(t.objectStore(STORE))
  t.oncomplete = () => res(q?.result)
  t.onerror = () => rej(t.error)
})
const allProfiles = async () => ((await tx('readonly', s => s.getAll())) || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
const putProfile = p => tx('readwrite', s => s.put(p))
const delProfile = id => tx('readwrite', s => s.delete(id))

async function defaultProfile() {
  const list = await allProfiles()
  return list.find(p => p.isDefault) || list[0] || null
}

async function setDefault(id) {
  for (const p of await allProfiles()) { p.isDefault = p.id === id; await putProfile(p) }
}

// ---------- Engine ----------
async function connectVoice(spaceId) {
  const t = getSettings().hfToken
  return Client.connect(spaceId, t ? { hf_token: t } : undefined)
}

const fileOf = (blob, name) => handle_file(new File([blob], name, { type: blob.type || 'audio/wav' }))
const urlOf = x => (x && (x.url || x.path)) || null

async function fetchBlob(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error('Result download fail: HTTP ' + r.status)
  return r.blob()
}

// source: Blob (gaana ya acapella), ref: Blob (aapki awaaz, WAV)
export async function cloneConvert({ source, ref, separate = true, pitch = 0, steps = 25, onStatus = () => {} }) {
  const s = getSettings()
  if (s.voiceMode === 'official') {
    if (separate) onStatus('Note: Official Seed-VC Space gaane se vocals alag nahi karta; acapella (sirf vocals) upload karo.')
    onStatus('Official Seed-VC Space se convert ho raha hai...')
    const client = await connectVoice(OFFICIAL_SEEDVC)
    const args = [fileOf(source, 'source.wav'), fileOf(ref, 'ref.wav'), steps, 1.0, 0.7, true, false, pitch]
    let res
    try { res = await client.predict('/convert_voice_v1_wrapper', args) }
    catch { res = await client.predict('/predict', args) }
    const u = urlOf(res.data[1]) || urlOf(res.data[0])
    if (!u) throw new Error('Official Space ne audio nahi diya (quota ya busy ho sakta hai).')
    const out = await fetchBlob(u)
    return { mixed: out, vocals: out, instrumental: null }
  }
  onStatus(`Voice Space (${s.voiceSpace}) se connect ho raha hai... (sleeping Space ko jagne me 1-3 min lag sakte hain)`)
  const client = await connectVoice(s.voiceSpace)
  onStatus(separate ? 'Vocals alag ho rahe hain, phir aapki awaaz me convert + mix... (1-5 min)' : 'Aapki awaaz me convert ho raha hai... (1-3 min)')
  const res = await client.predict('/clone_song', [fileOf(source, 'source.mp3'), fileOf(ref, 'reference.wav'), pitch, steps, separate])
  const [m, v, i] = res.data
  if (!urlOf(m)) throw new Error('Voice Space ne result nahi diya.')
  return {
    mixed: await fetchBlob(urlOf(m)),
    vocals: urlOf(v) ? await fetchBlob(urlOf(v)) : null,
    instrumental: urlOf(i) ? await fetchBlob(urlOf(i)) : null,
  }
}

// ---------- Page UI ----------
function renderShell() {
  const root = $('cloneRoot')
  root.innerHTML = `
  <div class="clone-grid">
    <section class="panel">
      <div class="panel-head"><div><span class="step">01</span><b>Aapki awaaz record karo</b></div><span class="subtle">10–25 SEC</span></div>
      <p class="subtle clone-help">Saaf jagah, bina music ke. Gaate hue record karoge to singing clone behtar banta hai.</p>
      <div class="clone-line" id="cloneLine"></div>
      <div class="clone-meter"><i id="cloneMeter"></i></div>
      <div class="clone-actions">
        <button class="generate clone-rec" id="cloneRec" type="button">● Record</button>
        <button class="secondary" id="cloneStop" type="button" disabled>■ Stop</button>
        <label class="secondary clone-upload">⬆ Upload audio<input id="cloneFile" type="file" accept="audio/*" hidden></label>
      </div>
      <input id="cloneName" class="text-input" placeholder="Voice ka naam (jaise: Meri awaaz)" maxlength="40">
      <label class="clone-consent"><input type="checkbox" id="cloneConsent"> Ye meri apni awaaz hai ya mere paas is awaaz ke use ki permission hai. Kisi aur ki awaaz nakal (impersonate) nahi karunga.</label>
      <audio id="clonePreview" controls hidden></audio>
      <button class="generate" id="cloneSave" type="button" disabled>✦ Voice save karo</button>
      <div class="notice" id="cloneNotice" role="status">Record ya upload karo.</div>
    </section>

    <section class="panel">
      <div class="panel-head"><div><span class="step">02</span><b>Meri voices</b></div><span class="subtle" id="cloneCount"></span></div>
      <div id="cloneList"></div>
      <div class="divider"></div>
      <div class="panel-head"><div><span class="step">03</span><b>Gaana/vocal apni awaaz me badlo</b></div></div>
      <input id="convFile" type="file" accept="audio/*" class="text-input">
      <div class="settings-grid">
        <div><label class="field-label">SOURCE TYPE</label><select id="convSep"><option value="1">Poora gaana (vocals alag karo)</option><option value="0">Sirf vocals / acapella</option></select></div>
        <div><label class="field-label">PITCH (semitones)</label><input id="convPitch" class="text-input" type="number" min="-24" max="24" value="0"></div>
      </div>
      <button class="generate" id="convGo" type="button">✦ Meri awaaz me convert karo</button>
      <div class="notice" id="convNotice" role="status">Create page par "My cloned voice" chun kar bhi seedha gaana bana sakte ho.</div>
      <div id="convOut"></div>
    </section>
  </div>
  <p class="subtle clone-foot">Voice conversion cloud (Hugging Face free GPU) par chalta hai. Quota khatam ho to Connections me apna HF token jodo. Sirf apni ya permission wali awaaz use karo; AI-generated music ko label karo.</p>`
  $('cloneLine').textContent = READ_LINES[Math.floor(Math.random() * READ_LINES.length)]
}

let pendingRef = null // {blob, seconds}

function cnote(t) { $('cloneNotice').textContent = t }

async function renderList() {
  const list = await allProfiles()
  $('cloneCount').textContent = list.length ? `${list.length} saved` : ''
  $('cloneList').innerHTML = list.length ? list.map(p => `
    <article class="ak-project">
      <div class="ak-project-icon">${p.isDefault ? '★' : '◉'}</div>
      <div class="ak-project-info"><b>${esc(p.name)}</b><small>${p.seconds.toFixed(1)}s · ${new Date(p.createdAt).toLocaleDateString()}</small>
        <audio controls src="${URL.createObjectURL(p.blob)}" style="width:100%;margin-top:6px"></audio></div>
      <button class="secondary" data-def="${esc(p.id)}">${p.isDefault ? 'Default' : 'Use'}</button>
      <button class="ak-delete" data-del="${esc(p.id)}">✕</button>
    </article>`).join('') : '<p class="subtle">Abhi koi voice save nahi hai.</p>'
  syncVoiceOption(list)
}

function syncVoiceOption(list) {
  const sel = $('voice')
  if (!sel) return
  let opt = [...sel.options].find(o => o.value === CLONE_VALUE)
  if (!opt) { opt = new Option('', CLONE_VALUE); sel.add(opt) }
  const d = list.find(p => p.isDefault) || list[0]
  opt.textContent = d ? `🎤 My cloned voice — ${d.name}` : '🎤 My cloned voice (pehle voice record karo)'
}

function meterLoop(analyser) {
  const buf = new Uint8Array(analyser.fftSize)
  const tick = () => {
    analyser.getByteTimeDomainData(buf)
    let peak = 0
    for (const v of buf) peak = Math.max(peak, Math.abs(v - 128))
    $('cloneMeter').style.width = Math.min(100, peak / 128 * 140) + '%'
    rafId = requestAnimationFrame(tick)
  }
  tick()
}

function stopMic() {
  cancelAnimationFrame(rafId)
  clearInterval(recTimer)
  stream?.getTracks().forEach(t => t.stop())
  audioCtx?.close?.()
  stream = null
  $('cloneRec').disabled = false
  $('cloneStop').disabled = true
  $('cloneMeter').style.width = '0'
}

async function startRec() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { cnote('Is browser me recording support nahi hai. Chrome (HTTPS) try karo ya audio upload karo.'); return }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true } })
  } catch (e) { cnote('Mic permission nahi mili: ' + e.message); return }
  audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const an = audioCtx.createAnalyser()
  audioCtx.createMediaStreamSource(stream).connect(an)
  meterLoop(an)
  recChunks = []
  rec = new MediaRecorder(stream)
  rec.ondataavailable = e => e.data.size && recChunks.push(e.data)
  rec.onstop = async () => {
    const blob = new Blob(recChunks, { type: rec.mimeType || 'audio/webm' })
    stopMic()
    await takeReference(blob)
  }
  rec.start()
  recStart = Date.now()
  $('cloneRec').disabled = true
  $('cloneStop').disabled = false
  recTimer = setInterval(() => {
    const s = (Date.now() - recStart) / 1000
    cnote(`🔴 Recording ${s.toFixed(0)}s (25s par auto-stop)`)
    if (s >= 25) rec.state !== 'inactive' && rec.stop()
  }, 250)
}

async function takeReference(blob) {
  cnote('Awaaz process ho rahi hai...')
  try {
    pendingRef = await toRefWav(blob)
    const pv = $('clonePreview')
    pv.src = URL.createObjectURL(pendingRef.blob)
    pv.hidden = false
    $('cloneSave').disabled = false
    cnote(`✓ ${pendingRef.seconds.toFixed(1)}s ready. Naam likho, consent tick karo aur save karo.`)
  } catch (e) {
    pendingRef = null
    $('cloneSave').disabled = true
    cnote(String(e.message || e))
  }
}

async function saveProfile() {
  if (!pendingRef) return
  if (!$('cloneConsent').checked) { cnote('Pehle consent tick karo (apni/permission wali awaaz).'); return }
  const name = $('cloneName').value.trim() || 'Meri awaaz'
  const first = !(await allProfiles()).length
  await putProfile({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, blob: pendingRef.blob, seconds: pendingRef.seconds,
    createdAt: new Date().toISOString(), isDefault: first,
  })
  pendingRef = null
  $('clonePreview').hidden = true
  $('cloneSave').disabled = true
  $('cloneName').value = ''
  cnote('✓ Voice save ho gayi. Create page par "My cloned voice" chun lo.')
  renderList()
}

async function convertFile() {
  const f = $('convFile').files?.[0]
  const note = t => { $('convNotice').textContent = t }
  if (!f) { note('Pehle gaana/vocal file chuno.'); return }
  const prof = await defaultProfile()
  if (!prof) { note('Pehle apni voice record + save karo (step 01).'); return }
  $('convGo').disabled = true
  try {
    const r = await cloneConvert({
      source: f, ref: prof.blob, separate: $('convSep').value === '1',
      pitch: Number($('convPitch').value) || 0, onStatus: note,
    })
    const u = URL.createObjectURL(r.mixed)
    $('convOut').innerHTML = `<audio controls src="${u}" style="width:100%;margin-top:10px"></audio>
      <div class="clone-actions"><button class="secondary" id="convDl">↓ Download</button>${r.vocals ? '<button class="secondary" id="convDlV">↓ Sirf vocals</button>' : ''}</div>`
    $('convDl').onclick = () => dl(r.mixed, 'AkStudio-cloned.wav')
    if (r.vocals) $('convDlV').onclick = () => dl(r.vocals, 'AkStudio-cloned-vocals.wav')
    note('✓ Ho gaya.')
  } catch (e) {
    note('Convert fail: ' + String(e.message || e).slice(0, 220) + ' — Connections page par voice backend/HF token check karo.')
  } finally { $('convGo').disabled = false }
}

// ---------- Create-page integration ----------
function ensureToggle() {
  if ($('akCloneToggle')) return $('akCloneToggle')
  const box = document.createElement('div')
  box.id = 'akCloneToggle'
  box.className = 'ak-clone-toggle'
  box.hidden = true
  box.innerHTML = '<button type="button" class="secondary" data-v="orig">Original</button><button type="button" class="secondary active" data-v="clone">Meri awaaz</button>'
  window.AK.audio.insertAdjacentElement('afterend', box)
  box.addEventListener('click', e => {
    const b = e.target.closest('button[data-v]')
    if (!b || !lastOriginal) return
    const t = window.AK.audio.currentTime
    const was = !window.AK.audio.paused
    window.AK.audio.src = b.dataset.v === 'orig' ? lastOriginal.original : lastOriginal.cloned
    window.AK.audio.currentTime = t
    if (was) window.AK.audio.play().catch(() => {})
    box.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b))
  })
  return box
}

async function onSongReady(e) {
  const d = e.detail || {}
  if (d.cloned) return
  if (d.noClone || !d.job || !String(d.job.caption).includes('clear natural lead vocals')) { ensureToggle().hidden = true; return }
  if ($('voice').value !== CLONE_VALUE) return
  const prof = await defaultProfile()
  const say = window.AK.say
  if (!prof) { say('Song ready, par voice clone ke liye pehle "Voice Clone" page par apni awaaz save karo.'); return }
  try {
    say('Song ready ✓ Ab aapki awaaz me convert ho raha hai... (1-5 min)')
    const src = await fetchBlob(d.url)
    const r = await cloneConvert({ source: src, ref: prof.blob, separate: true, pitch: 0, onStatus: say })
    const cloned = URL.createObjectURL(r.mixed)
    lastOriginal = { original: d.url, cloned }
    const box = ensureToggle()
    box.hidden = false
    window.AK.setSong(cloned, { job: d.job, via: d.via + ' + voice clone', cloned: true })
    say('✓ Aapki cloned awaaz me gaana ready! "Original / Meri awaaz" se compare karo.')
  } catch (err) {
    say('Song ready hai, par voice clone fail hua: ' + String(err.message || err).slice(0, 180) + ' (Original song chal raha hai.)')
  }
}

async function init() {
  if (!$('cloneRoot')) return
  db = await openDB()
  renderShell()
  $('cloneRec').onclick = startRec
  $('cloneStop').onclick = () => rec?.state !== 'inactive' && rec.stop()
  $('cloneSave').onclick = saveProfile
  $('convGo').onclick = convertFile
  $('cloneFile').onchange = e => { const f = e.target.files?.[0]; if (f) takeReference(f) }
  $('cloneList').addEventListener('click', async e => {
    const d = e.target.closest('[data-def]'), x = e.target.closest('[data-del]')
    if (d) { await setDefault(d.dataset.def); renderList() }
    if (x && confirm('Ye voice delete karein?')) { await delProfile(x.dataset.del); renderList() }
  })
  await renderList()
  window.addEventListener('ak:song-ready', onSongReady)
}

init().catch(e => console.error('Voice clone init failed', e))
