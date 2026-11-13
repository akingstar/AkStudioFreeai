const $ = id => document.getElementById(id)
const gen = $('generate')

const wrap = document.createElement('label')
wrap.style.cssText = 'display:flex;gap:8px;align-items:center;margin:0 0 10px;font-size:13px;cursor:pointer'
wrap.innerHTML = '<input type="checkbox" id="akFast"> ⚡ Fast mode (jaldi gaana, quality thodi kam)'
gen.insertAdjacentElement('beforebegin', wrap)
const fast = $('akFast')
fast.checked = localStorage.getItem('ak_fast') !== '0'
window.AK_FAST = fast.checked
fast.addEventListener('change', () => {
  window.AK_FAST = fast.checked
  localStorage.setItem('ak_fast', fast.checked ? '1' : '0')
})

const span = gen.querySelector('span')
let t0 = 0, timer = null
new MutationObserver(() => {
  if (gen.disabled && !timer) {
    t0 = Date.now()
    timer = setInterval(() => { span.textContent = 'Generating... ' + Math.round((Date.now() - t0) / 1000) + 's' }, 1000)
  }
  if (!gen.disabled && timer) { clearInterval(timer); timer = null }
}).observe(gen, { attributes: true, attributeFilter: ['disabled'] })

const audio = document.querySelector('.preview audio')
if (audio) {
  const dl = document.createElement('button')
  dl.className = 'secondary'
  dl.textContent = '↓ Download MP3'
  dl.style.cssText = 'display:none;width:100%;margin-bottom:6px'
  const note = document.createElement('small')
  note.textContent = 'Server par gaana temporary hota hai, isliye download kar lo.'
  note.style.cssText = 'display:none;margin-bottom:10px;opacity:.7'
  audio.insertAdjacentElement('afterend', dl)
  dl.insertAdjacentElement('afterend', note)
  setInterval(() => {
    const show = audio.src && audio.style.display !== 'none'
    dl.style.display = show ? 'block' : 'none'
    note.style.display = show ? 'block' : 'none'
  }, 800)
  dl.onclick = async () => {
    const name = (($('songTitle').value.trim() || 'AkStudio-song').replace(/[^\w\- ]+/g, '')) + '.mp3'
    try {
      const r = await fetch(audio.src)
      const u = URL.createObjectURL(await r.blob())
      const a = document.createElement('a')
      a.href = u; a.download = name; a.click()
      setTimeout(() => URL.revokeObjectURL(u), 5000)
    } catch { window.open(audio.src, '_blank') }
  }
}
