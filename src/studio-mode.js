import './studio-mode.css'

const editor = document.querySelector('.editor')
const firstHead = editor?.querySelector('.panel-head')
if (!editor || !firstHead) throw new Error('Studio editor not found')

const toolbar = document.createElement('div')
toolbar.className = 'ak-studio-mode'
toolbar.innerHTML = `
  <div>
    <b>Studio controls</b>
    <small>Choose your workspace</small>
  </div>
  <div class="ak-mode-switch">
    <button type="button" data-mode="simple">Simple</button>
    <button type="button" data-mode="advanced">Advanced</button>
  </div>
`
firstHead.before(toolbar)

const settings = editor.querySelector('.settings-grid')
const extraFields = settings ? [...settings.children].slice(2) : []
const singingField = editor.querySelector('#singing')?.closest('div')
const vocalRanges = [...editor.querySelectorAll('.range-row')]
const modeButtons = [...toolbar.querySelectorAll('[data-mode]')]

function setMode(mode) {
  const advanced = mode === 'advanced'

  extraFields.forEach(el => { el.hidden = !advanced })
  if (singingField) singingField.hidden = !advanced
  vocalRanges.forEach(el => { el.hidden = !advanced })

  modeButtons.forEach(button => {
    const active = button.dataset.mode === mode
    button.classList.toggle('active', active)
    button.setAttribute('aria-pressed', String(active))
  })

  try { localStorage.setItem('akstudio_ui_mode', mode) } catch {}
}

modeButtons.forEach(button => {
  button.addEventListener('click', () => setMode(button.dataset.mode))
})

let savedMode = 'simple'
try {
  savedMode = localStorage.getItem('akstudio_ui_mode') || 'simple'
} catch {}

setMode(savedMode === 'advanced' ? 'advanced' : 'simple')
