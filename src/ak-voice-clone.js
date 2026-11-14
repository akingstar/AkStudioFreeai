import { analyzeReference, convertVoice, probeVoiceBackend } from './ak-voice-engine.js'
import { toRefWav, dl } from './ak-audio-utils.js'
import { getSettings } from './ak-settings.js'

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
let pending = null
let lastOriginal = null
let resultUrls = []
let listUrls = []
let styleInjected = false

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

function gradeColor(g) {
  return g === 'A' ? '#39d98a' : g === 'B' ? '#8bc34a' : g === 'C' ? '#f0b429' : '#e5533d'
}

function injectStyles() {
  if (styleInjected) return
  styleInjected = true
  const s = document.createElement('style')
  s.textContent = `
  .vc-quality{margin:12px 0;padding:12px;border:1px solid #333;border-radius:12px;background:#141414}
  .vc-qhead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
  .vc-qgrade{font-weight:800;font-size:15px}
  .vc-qbar{height:8px;border-radius:99px;background:#2a2a2a;overflow:hidden}
  .vc-qbar i{display:block;height:100%;width:0;background:#39d98a;transition:width .3s}
  .vc-qmeta{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:#aaa;margin-top:8px}
  .vc-qtips{margin:8px 0 0;padding-left:18px;font-size:12px;color:#f0b429}
  .vc-badge{display:inline-block;min-width:18px;text-align:center;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:800;color:#080808}
  .vc-convert{margin-top:18px}
  .vc-progress{margin:12px 0}
  .vc-progress .vc-bar{height:10px;border-radius:99px;background:#242424;overflow:hidden;border:1px solid #333}
  .vc-progress .vc-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#6a5cff,#39d98a);transition:width .4s}
  .vc-progress small{display:block;margin-top:6px;color:#bbb}
  .vc-result{margin-top:14px;padding:14px;border:1px solid #333;border-radius:14px;background:#121212}
  .vc-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
  .vc-tabs button{padding:8px 12px;border-radius:8px;border:1px solid #444;background:#1d1d1d;color:#ddd;font-weight:700;cursor:pointer}
  .vc-tabs button.active{background:#eee;color:#111}
  .vc-report{font-size:12px;color:#9a9a9a;margin-top:8px;white-space:pre-wrap}
  `
  document.head.appendChild(s)
}

function renderShell() {
  injectStyles()
  $('cloneRoot').innerHTML = `
  <div class="clone-grid">
    <section class="panel">
      <div class="panel-head"><div><span class="step">01</span><b>Voice profile banao</b></div><span class="subtle">10–25 SEC</span></div>
      <p class="subtle clone-help">Saaf jagah, bina music ke. Gaate hue record karoge to singing clone behtar banta hai. Engine zero-shot hai — koi training nahi.</p>
      <div class="clone-line" id="vcLine"></div>
      <div class="clone-meter"><i id="vcMeter"></i></div>
      <div class="clone-actions">
        <button class="generate clone-rec" id="vcRec" type="button">● Record</button>
        <button class="secondary" id="vcStop" type="button" disabled>■ Stop</button>
        <label class="secondary clone-upload">⬆ Upload audio<input id="vcFile" type="file" accept="audio/*" hidden></label>
      </div>
      <input id="vcName" class="text-input" placeholder="Voice ka naam (jaise: Meri awaaz)" maxlength="40">
      <div id="vcQuality"></div>
      <audio id="vcPreview" controls hidden></audio>
      <label class="clone-consent"><input type="checkbox" id="vcConsent"> Ye meri apni awaaz hai ya mere paas is awaaz ke use ki permission hai. Kisi aur ki awaaz nakal (impersonate) nahi karunga.</label>
      <button class="generate" id="vcSave" type="button" disabled>✦ Voice save karo</button>
      <div class="notice" id="vcNotice" role="status">Record ya upload karo.</div>
    </section>

    <section class="panel">
      <div class="panel-head"><b>Meri voices</b><span class="subtle" id="vcCount"></span></div>
      <div id="vcList"></div>
      <div class="divider"></div>
      <div class="panel-head"><b>Backend</b><button class="secondary" id="vcCheck" type="button">↻ Check</button></div>
      <div id="vcBackend" class="subtle">Check dabao...</div>
    </section>
  </div>

  <section class="panel vc-convert">
    <div class="panel-head"><div><span class="step">03</span><b>Gaana → meri awaaz</b></div><span class="subtle">DEMUCS + SEED-VC</span></div>
    <p class="subtle clone-help">Poora gaana do: vocals alag honge, aapki awaaz me convert honge, phir instrumental ke saath mix. Free ZeroGPU par ~60-90s clip best; lambe gaane CPU/Pro API par.</p>
    <input id="vcConvFile" type="file" accept="audio/*" class="text-input">
    <div class="settings-grid">
      <div><label class="field-label">SOURCE TYPE</label><select id="vcSep"><option value="1">Poora gaana (vocals alag karo)</option><option value="0">Sirf vocals / acapella</option></select></div>
      <div><label class="field-label">PITCH (semitones)</label><input id="vcPitch" class="text-input" type="number" min="-24" max="24" value="0"></div>
      <div><label class="field-label">QUALITY STEPS</label><input id="vcSteps" class="text-input" type="number" min="4" max="50" value="25"></div>
    </div>
    <button class="generate" id="vcGo" type="button">✦ Meri awaaz me convert karo</button>
    <div class="vc-progress" id="vcProgress" hidden>
      <div class="vc-bar"><i id="vcBar"></i></div>
      <small id="vcProgText">Shuru ho raha hai...</small>
    </div>
    <div class="notice" id="vcConvNotice" role="status">Create page par "My cloned voice" chun kar bhi seedha gaana bana sakte ho.</div>
    <div id="vcOut"></div>
  </section>
  <p class="subtle clone-foot">Voice conversion cloud (Hugging Face) par chalti hai. Quota khatam ho to Connections me apna HF token ya Pro API jodo. Sirf apni ya permission wali awaaz use karo; AI-generated music ko label karo.</p>`
  $('vcLine').textContent = READ_LINES[Math.floor(Math.random() * READ_LINES.length)]
}

// ---------- recording ----------
function meterLoop(analyser) {
  const buf = new Uint8Array(analyser.fftSize)
  const tick = () => {
    analyser.getByteTimeDomainData(buf)
    let peak = 0
    for (const v of buf) peak = Math.max(peak, Math.abs(v - 128))
    const el = $('vcMeter')
    if (el) el.style.width = Math.min(100, peak / 128 * 140) + '%'
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
  if ($('vcRec')) $('vcRec').disabled = false
  if ($('vcStop')) $('vcStop').disabled = true
  if ($('vcMeter')) $('vcMeter').style.width = '0'
}

async function startRec() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    cnote('Is browser me recording support nahi hai. Chrome (HTTPS) try karo ya audio upload karo.')
    return
  }
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
  $('vcRec').disabled = true
  $('vcStop').disabled = false
  recTimer = setInterval(() => {
    const s = (Date.now() - recStart) / 1000
    cnote(`🔴 Recording ${s.toFixed(0)}s (25s par auto-stop)`)
    if (s >= 25 && rec.state !== 'inactive') rec.stop()
  }, 250)
}

function cnote(t) { if ($('vcNotice')) $('vcNotice').textContent = t }

function renderQuality(q) {
  $('vcQuality').innerHTML = `
    <div class="vc-quality">
      <div class="vc-qhead">
        <div><b>Reference quality</b> <span class="subtle">${q.seconds.toFixed(1)}s</span></div>
        <div class="vc-qgrade" style="color:${gradeColor(q.grade)}">${q.grade} · ${q.score}/100</div>
      </div>
      <div class="vc-qbar"><i style="width:${q.score}%;background:${gradeColor(q.grade)}"></i></div>
      <div class="vc-qmeta">
        <span>SNR ${q.snrDb} dB</span>
        <span>Clip ${q.clipPct}%</span>
        <span>Silence ${q.silencePct}%</span>
      </div>
      ${q.tips.length ? `<ul class="vc-qtips">${q.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="subtle" style="margin:8px 0 0">Quality achhi hai — save kar sakte ho.</p>'}
    </div>`
}

async function takeReference(blob) {
  cnote('Awaaz trim + check ho rahi hai...')
  try {
    const ref = await toRefWav(blob)
    const quality = await analyzeReference(ref.blob)
    pending = { ...ref, quality }
    const pv = $('vcPreview')
    pv.src = URL.createObjectURL(ref.blob)
    pv.hidden = false
    renderQuality(quality)
    $('vcSave').disabled = false
    cnote(`✓ ${ref.seconds.toFixed(1)}s ready. Naam likho, consent tick karo aur save karo.`)
  } catch (e) {
    pending = null
    $('vcSave').disabled = true
    $('vcQuality').innerHTML = ''
    cnote(String(e.message || e))
  }
}

async function saveProfile() {
  if (!pending) return
  if (!$('vcConsent').checked) { cnote('Pehle consent tick karo (apni/permission wali awaaz).'); return }
  const name = $('vcName').value.trim() || 'Meri awaaz'
  const first = !(await allProfiles()).length
  await putProfile({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, blob: pending.blob, seconds: pending.seconds,
    quality: pending.quality,
    createdAt: new Date().toISOString(), isDefault: first,
  })
  pending = null
  $('vcPreview').hidden = true
  $('vcSave').disabled = true
  $('vcName').value = ''
  $('vcQuality').innerHTML = ''
  cnote('✓ Voice save ho gayi. Create page par "My cloned voice" chun lo.')
  renderList()
}

// ---------- list ----------
async function renderList() {
  const list = await allProfiles()
  listUrls.forEach(URL.revokeObjectURL)
  listUrls = []
  $('vcCount').textContent = list.length ? `${list.length} saved` : ''
  $('vcList').innerHTML = list.length ? list.map(p => {
    const q = p.quality || null
    const badge = q ? `<span class="vc-badge" style="background:${gradeColor(q.grade)}">${q.grade}</span>` : ''
    const u = URL.createObjectURL(p.blob)
    listUrls.push(u)
    return `
    <article class="ak-project">
      <div class="ak-project-icon">${p.isDefault ? '★' : '◉'}</div>
      <div class="ak-project-info"><b>${badge} ${esc(p.name)}</b>
      <small>${p.seconds.toFixed(1)}s · ${q ? `score ${q.score} · SNR ${q.snrDb}dB` : 'no quality data'} · ${new Date(p.createdAt).toLocaleDateString()}</small>
      <audio controls preload="none" src="${u}" style="width:100%;margin-top:6px"></audio></div>
      <button class="secondary" data-def="${esc(p.id)}">${p.isDefault ? 'Default' : 'Use'}</button>
      <button class="ak-delete" data-del="${esc(p.id)}">✕</button>
    </article>`
  }).join('') : '<p class="subtle">Abhi koi voice save nahi hai. Step 01 se record karo.</p>'
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

// ---------- convert ----------
function setProgress(p, text) {
  const box = $('vcProgress')
  if (!box) return
  box.hidden = false
  const bar = $('vcBar')
  bar.style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%'
  if (text) $('vcProgText').textContent = text
}

function showResult(r, label) {
  resultUrls.forEach(URL.revokeObjectURL)
  resultUrls = []
  const outs = [['Mixed', r.mixed], ['Vocals', r.vocals], ['Instrumental', r.instrumental]].filter(x => x[1])
  const urls = outs.map(([n, b]) => { const u = URL.createObjectURL(b); resultUrls.push(u); return [n, u] })
  $('vcOut').innerHTML = `
    <div class="vc-result">
      <div class="vc-tabs">${urls.map(([n], i) => `<button data-i="${i}" class="${i === 0 ? 'active' : ''}">${n}</button>`).join('')}</div>
      <audio id="vcResultAudio" controls src="${urls[0][1]}" style="width:100%"></audio>
      <div class="clone-actions" style="margin-top:10px">
        <button class="secondary" id="vcDlAll">↓ Download ${label.expand}${urls[0][0]}</button>
        ${r.vocals ? '<button class="secondary" id="vcDlVoc">↓ Vocals</button>' : ''}
        ${r.instrumental ? '<button class="secondary" id="vcDlInst">↓ Instrumental</button>' : ''}
        <button class="secondary" id="vcSaveSong">＋ Save to My Library</button>
      </div>
      <div class="vc-report">${esc(`via ${r.via} · ${(r.ms / 1000).toFixed(1)}s`)}${r.report ? esc(`\n${JSON.stringify(r.report, null, 0)}`) : ''}</div>
    </div>`
  $('vcOut').querySelectorAll('.vc-tabs button').forEach(b => b.onclick = () => {
    const i = Number(b.dataset.i)
    $('vcResultAudio').src = urls[i][1]
    $('vcOut').querySelectorAll('.vc-tabs button').forEach(x => x.classList.toggle('active', x === b))
  })
  $('vcDlAll').onclick = () => dl(r.mixed, `AkStudio-${label.name}-mixed.wav`)
  if (r.vocals) $('vcDlVoc').onclick = () => dl(r.vocals, `AkStudio-${label.name}-vocals.wav`)
  if (r.instrumental) $('vcDlInst').onclick = () => dl(r.instrumental, `AkStudio-${label.name}-instrumental.wav`)
  $('vcSaveSong').onclick = () => {
    window.AK?.setSong?.(urls[0][1], { job: { title: `Cloned: ${label.name}`, prompt: '' }, via: r.via, cloned: true })
    $('vcConvNotice').textContent = '✓ My Library me save ho gaya (Generated songs section).'
  }
}

async function convertFile() {
  const f = $('vcConvFile').files?.[0]
  const note = t => { if ($('vcConvNotice')) $('vcConvNotice').textContent = t }
  if (!f) { note('Pehle gaana/vocal file chuno.'); return }
  const prof = await defaultProfile()
  if (!prof) { note('Pehle apni voice record + save karo (step 01).'); return }
  const steps = Number($('vcSteps').value) || getSettings().voiceSteps || 25
  $('vcGo').disabled = true
  setProgress(0.01, 'Backend connect ho raha hai...')
  try {
    const r = await convertVoice({
      source: f, ref: prof.blob,
      separate: $('vcSep').value === '1',
      pitch: Number($('vcPitch').value) || 0,
      steps,
      onStatus: t => setProgress(0.05, t),
      onProgress: ({ progress, desc }) => setProgress(Math.max(0.05, progress), desc || 'Process ho raha hai...'),
    })
    setProgress(1, `✓ Ready (${r.via})`)
    showResult(r, { name: (prof.name || 'voice').replace(/[^\w\- ]+/g, '').trim() || 'voice', expand: '' })
    note('✓ Ho gaya.')
  } catch (e) {
    setProgress(0, '')
    $('vcProgress').hidden = true
    note('Convert fail: ' + String(e.message || e).slice(0, 260) + ' — Connections page par voice backend/HF token check karo.')
  } finally { $('vcGo').disabled = false }
}

// ---------- create-page integration ----------
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
    const src = await (await fetch(d.url)).blob()
    const r = await convertVoice({ source: src, ref: prof.blob, separate: true, pitch: 0, steps: getSettings().voiceSteps || 25, onStatus: say })
    const cloned = URL.createObjectURL(r.mixed)
    lastOriginal = { original: d.url, cloned }
    const box = ensureToggle()
    box.hidden = false
    window.AK.setSong(cloned, { job: d.job, via: r.via + ' + voice clone', cloned: true })
    say('✓ Aapki cloned awaaz me gaana ready! "Original / Meri awaaz" se compare karo.')
  } catch (err) {
    say('Song ready hai, par voice clone fail hua: ' + String(err.message || err).slice(0, 180) + ' (Original song chal raha hai.)')
  }
}

async function checkBackend() {
  const box = $('vcBackend')
  box.textContent = 'Checking...'
  const rows = await probeVoiceBackend()
  box.innerHTML = rows.map(r => `<div class="ak-conn-row"><span>${r.ok ? '🟢' : '🔴'}</span><b>${esc(r.name)}</b><small>${esc(r.url)}${r.ok ? '' : ' — ' + esc(r.error || ('HTTP ' + r.status))}</small></div>`).join('')
}

async function init() {
  if (!$('cloneRoot')) return
  db = await openDB()
  renderShell()
  $('vcRec').onclick = startRec
  $('vcStop').onclick = () => rec?.state !== 'inactive' && rec.stop()
  $('vcSave').onclick = saveProfile
  $('vcGo').onclick = convertFile
  $('vcCheck').onclick = checkBackend
  $('vcFile').onchange = e => { const f = e.target.files?.[0]; if (f) takeReference(f) }
  $('vcSteps').value = getSettings().voiceSteps || 25
  $('vcList').addEventListener('click', async e => {
    const d = e.target.closest('[data-def]'), x = e.target.closest('[data-del]')
    if (d) { await setDefault(d.dataset.def); renderList() }
    if (x && confirm('Ye voice delete karein?')) { await delProfile(x.dataset.del); renderList() }
  })
  await renderList()
  window.addEventListener('ak:song-ready', onSongReady)
}

init().catch(e => console.error('Voice clone init failed', e))
