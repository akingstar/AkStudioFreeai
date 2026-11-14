// Generated songs ko browser me save karta hai (IndexedDB) taaki remote link expire ho jaye to bhi library me mile.
import { dl } from './ak-audio-utils.js'

const DB = 'akstudio_songs', STORE = 'songs', MAX = 30
let db
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' })
  r.onsuccess = () => res(r.result)
  r.onerror = () => rej(r.error)
})
const run = (mode, fn) => new Promise((res, rej) => {
  const t = db.transaction(STORE, mode), q = fn(t.objectStore(STORE))
  t.oncomplete = () => res(q?.result)
  t.onerror = () => rej(t.error)
})
const all = async () => ((await run('readonly', s => s.getAll())) || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

async function save(d) {
  try {
    const r = await fetch(d.url)
    if (!r.ok) return
    const blob = await r.blob()
    const title = (d.job?.title || d.job?.prompt || 'Untitled').slice(0, 60) + (d.cloned ? ' (meri awaaz)' : '')
    await run('readwrite', s => s.put({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title, prompt: d.job?.prompt || '', via: d.via || '', cloned: !!d.cloned,
      blob, createdAt: new Date().toISOString(),
    }))
    const list = await all()
    for (const old of list.slice(MAX)) await run('readwrite', s => s.delete(old.id))
  } catch (e) { console.warn('Song save skipped:', e?.message || e) }
}

let urls = []
window.akRenderSongs = async panel => {
  if (!db) return
  urls.forEach(URL.revokeObjectURL); urls = []
  const list = await all()
  if (!list.length) return
  const box = document.createElement('div')
  box.className = 'ak-songs'
  box.innerHTML = `<h3 style="margin:26px 0 10px">Generated songs (${list.length})</h3>` + list.map(x => {
    const u = URL.createObjectURL(x.blob); urls.push(u)
    return `<article class="ak-project" data-id="${esc(x.id)}">
      <div class="ak-project-icon">${x.cloned ? '🎤' : '♪'}</div>
      <div class="ak-project-info"><b>${esc(x.title)}</b><small>${esc(x.via)} · ${new Date(x.createdAt).toLocaleString()}</small>
        <audio controls preload="none" src="${u}" style="width:100%;margin-top:6px"></audio></div>
      <button class="secondary" data-dl="${esc(x.id)}">↓</button>
      <button class="ak-delete" data-rm="${esc(x.id)}">✕</button></article>`
  }).join('')
  box.addEventListener('click', async e => {
    const d = e.target.closest('[data-dl]'), r = e.target.closest('[data-rm]')
    if (d) { const x = list.find(i => i.id === d.dataset.dl); if (x) dl(x.blob, x.title.replace(/[^\w\- ]+/g, '') + '.mp3') }
    if (r && confirm('Ye song delete karein?')) { await run('readwrite', s => s.delete(r.dataset.rm)); window.akRenderSongs(panel); }
  })
  panel.querySelector('.ak-songs')?.remove()
  panel.appendChild(box)
}

open().then(d => { db = d; window.addEventListener('ak:song-ready', e => save(e.detail || {})) }).catch(() => {})
