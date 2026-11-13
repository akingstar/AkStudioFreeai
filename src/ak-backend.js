import { Client } from '@gradio/client'

const SPACE = 'Ashklyrics/AkStudioFreeai'
const BASE = 'https://ashklyrics-akstudiofreeai.hf.space'
const $ = id => document.getElementById(id)
const LANG = { Hindi:'hi', English:'en', Punjabi:'pa', Urdu:'ur', Bengali:'bn', Spanish:'es', French:'fr', Japanese:'ja', 'Multi-language':'unknown' }

// purana "backend connect nahi hai" wala click handler hatao
const old = $('generate')
const btn = old.cloneNode(true)
old.replaceWith(btn)
const label = btn.querySelector('span')
const notice = $('notice')

// preview mein audio player
const audio = document.createElement('audio')
audio.controls = true
audio.style.cssText = 'width:100%;margin:10px 0;display:none'
document.querySelector('.preview-foot').insertAdjacentElement('beforebegin', audio)

let client = null
let busy = false

btn.addEventListener('click', async () => {
  if (busy) return
  const prompt = $('prompt').value.trim()
  if (!prompt) { notice.textContent = 'Please enter a music description first.'; $('prompt').focus(); return }

  const instrumental = document.querySelector('.mode.active')?.dataset.mode === 'instrumental'
  const caption = [prompt, $('genre').value, $('mood').value, $('voice').value, $('singing').value + ' singing'].join(', ')
  const lyrics = instrumental ? '[Instrumental]' : $('lyrics').value
  const lang = instrumental ? 'unknown' : (LANG[$('language').value] || 'unknown')
  const duration = Math.min(Number($('duration').value) || 60, 120)   // ZeroGPU limit ke liye cap

  busy = true
  btn.disabled = true
  label.textContent = 'Generating...'
  notice.textContent = 'AI engine se connect ho raha hai... pehli baar 20-60 sec lag sakte hain.'

  try {
    client = client || await Client.connect(SPACE)
    const args = [
      'acestep-v15-turbo', 'custom', '', 'unknown',
      caption, lyrics,
      0, '', '', lang, 8, 7.0, true, '-1',
      null, duration, 1, null, '', 0.0, -1,
      'Fill the audio semantic mask based on the given conditions:',
      1.0, 'text2music', false, 0.0, 1.0, 3.0, 'ode', '', 'mp3',
      0.85, true, 2.0, 0, 0.9, 'NO USER INPUT',
      true, true, true, false, true, false, false, 8,
      'vocals', [], false,
    ]
    const res = await client.predict('/generation_api', args)
    const d = JSON.parse(res.data[0])
    if (d.status !== 'Generation Complete') throw new Error(d.status)
    const mp3 = d.all_generated_files.find(f => f.endsWith('.mp3'))
    audio.src = `${BASE}/gradio_api/file=${mp3}`
    audio.style.display = 'block'
    audio.load()
    $('previewDescription').textContent = prompt
    notice.textContent = '✓ Song ready! Play karke suno.'
  } catch (e) {
    notice.textContent = 'Error: ' + String(e?.message || e)
  } finally {
    busy = false
    btn.disabled = false
    label.textContent = 'Generate song'
  }
})
