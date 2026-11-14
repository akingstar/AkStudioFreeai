import { getSettings, saveSettings } from './ak-settings.js'
import { relayHealth } from './ak-relay-client.js'
import { loadRegistry } from './ak-registry.js'
import { SPACE_BASE, OFFICIAL_SEEDVC } from './ak-shared.js'

const $ = id => document.getElementById(id)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const spaceBase = id => 'https://' + id.replace('/', '-').replace(/[._]/g, '-').toLowerCase() + '.hf.space'

const ONE_LINER = 'termux-setup-storage; cd ~ && unzip -o ~/storage/downloads/AkStudioFreeai-pro.zip -d ~ && bash ~/AkStudioFreeai/termux/install.sh'

async function ping(url, ms = 12000) {
  try {
    const r = await fetch(url + '/config', { signal: AbortSignal.timeout(ms), cache: 'no-store' })
    return r.ok ? 'ok' : 'down'
  } catch { return 'down' }
}

function dot(state) { return state === 'ok' ? '🟢' : state === 'down' ? '🔴' : state === 'off' ? '⚪' : '🟡' }

async function checkAll() {
  const s = getSettings()
  const rows = [
    ['ZeroGPU music (primary)', SPACE_BASE, 'space'],
    ['Termux relay (aapka phone)', s.relayUrl, 'relay'],
    ['Voice clone Space', s.voiceMode === 'official' ? spaceBase(OFFICIAL_SEEDVC) : spaceBase(s.voiceSpace), 'space'],
  ]
  for (const x of s.extraBackends || []) rows.push([x.name || 'Custom', x.url, 'space'])
  for (const r of await loadRegistry()) rows.push([r.name + ' (registry)', r.base, 'space'])
  const box = $('connStatus')
  box.innerHTML = rows.map(r => `<div class="ak-conn-row"><span>🟡</span><b>${esc(r[0])}</b><small>${esc(r[1])}</small></div>`).join('')
  const res = await Promise.all(rows.map(async ([, url, kind]) => {
    if (kind === 'relay') { const h = await relayHealth(url, 2500); return h?.ok ? 'ok' : 'off' }
    return ping(url)
  }))
  box.innerHTML = rows.map((r, i) => `<div class="ak-conn-row"><span>${dot(res[i])}</span><b>${esc(r[0])}</b><small>${esc(r[1])}${res[i] === 'off' ? ' — chalu nahi (Termux me: ak start)' : ''}</small></div>`).join('')
}

function render() {
  const s = getSettings()
  $('connectRoot').innerHTML = `
  <div class="clone-grid">
    <section class="panel">
      <div class="panel-head"><div><span class="step">01</span><b>Free quota badhao</b></div><span class="subtle">HUGGING FACE</span></div>
      <p class="subtle clone-help">Free Hugging Face account banao (huggingface.co/settings/tokens → "Read" token). ZeroGPU quota per-account hota hai, aur logged-in account ko anonymous se zyada milta hai. Token sirf is browser me save hota hai.</p>
      <label class="field-label">HF TOKEN (hf_...)</label>
      <input id="connToken" class="text-input" type="password" autocomplete="off" placeholder="hf_xxxxxxxxxxxxxxxx" value="${esc(s.hfToken)}">

      <div class="divider"></div>
      <div class="panel-head"><div><span class="step">02</span><b>Termux relay (phone)</b></div><span class="subtle">QUOTA FALLBACK</span></div>
      <p class="subtle clone-help">Phone par Termux me <code>ak start</code> chalao. Cloud quota khatam hone par job relay me queue hoti hai aur browser band hone par bhi retry hota rehta hai.</p>
      <label class="field-label">RELAY URL</label>
      <input id="connRelay" class="text-input" value="${esc(s.relayUrl)}">
      <label class="clone-consent"><input type="checkbox" id="connUseRelay" ${s.useRelay ? 'checked' : ''}> Cloud fail hone par relay use karo</label>

      <div class="divider"></div>
      <div class="panel-head"><div><span class="step">03</span><b>Voice clone backend</b></div></div>
      <select id="connVoiceMode"><option value="own" ${s.voiceMode === 'own' ? 'selected' : ''}>Mera Voice Space (vocals alag + clone + mix)</option><option value="official" ${s.voiceMode === 'official' ? 'selected' : ''}>Official Seed-VC Space (sirf acapella convert)</option></select>
      <label class="field-label" style="margin-top:12px">MERA VOICE SPACE ID</label>
      <input id="connVoiceSpace" class="text-input" value="${esc(s.voiceSpace)}">

      <div class="divider"></div>
      <div class="panel-head"><div><span class="step">04</span><b>Extra backends</b></div></div>
      <p class="subtle clone-help">Apne duplicate kiye hue Spaces (jaise CPU Space). Har line: <code>Naam | https://...hf.space</code></p>
      <textarea id="connExtra" class="prompt" style="min-height:80px">${esc((s.extraBackends || []).map(x => `${x.name} | ${x.url}`).join('\n'))}</textarea>
      <button class="generate" id="connSave" type="button">✦ Save settings</button>
      <div class="notice" id="connNotice" role="status">Settings is browser me save hoti hain.</div>
    </section>

    <section class="panel">
      <div class="panel-head"><b>Backend status</b><button class="secondary" id="connCheck" type="button">↻ Check</button></div>
      <div id="connStatus"><p class="subtle">Check dabao...</p></div>
      <div class="divider"></div>
      <div class="panel-head"><b>Termux setup (ek command)</b></div>
      <p class="subtle clone-help">Zip ko phone ke Downloads me rakho, phir Termux me ye chalao:</p>
      <pre class="ak-code" id="connCmd">${esc(ONE_LINER)}</pre>
      <button class="secondary" id="connCopy" type="button">Copy command</button>
      <p class="subtle clone-help" style="margin-top:12px">Baad me: <code>ak start</code> · <code>ak status</code> · <code>ak token hf_xxx</code> · <code>ak push "msg"</code></p>
    </section>
  </div>`

  $('connSave').onclick = () => {
    const extra = $('connExtra').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [n, u] = l.includes('|') ? l.split('|').map(x => x.trim()) : ['Custom', l]
      return { name: n || 'Custom', url: u }
    }).filter(x => /^https?:\/\//.test(x.url))
    const tok = $('connToken').value.trim()
    if (tok && !tok.startsWith('hf_')) { $('connNotice').textContent = 'Token "hf_" se shuru hona chahiye.'; return }
    saveSettings({
      hfToken: tok,
      relayUrl: $('connRelay').value.trim() || 'http://127.0.0.1:8787',
      useRelay: $('connUseRelay').checked,
      voiceMode: $('connVoiceMode').value,
      voiceSpace: $('connVoiceSpace').value.trim() || getSettings().voiceSpace,
      extraBackends: extra,
    })
    $('connNotice').textContent = '✓ Save ho gaya.'
    checkAll()
  }
  $('connCheck').onclick = checkAll
  $('connCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(ONE_LINER); $('connNotice').textContent = 'Command copy ho gaya.' }
    catch { $('connNotice').textContent = 'Copy nahi hua, command ko select karke copy karo.' }
  }
}

window.akRenderConnections = () => { render(); checkAll() }
