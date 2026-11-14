// Phone AI: user ke apne phone/browser par chalta hai (free, offline-capable, koi quota nahi).
// Experimental: MusicGen-small (instrumental only), transformers.js CDN se load hota hai.
const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/+esm'
import { wavBlob } from './ak-audio-utils.js'
let synthPromise = null

async function loadSynth(onStatus) {
  if (!synthPromise) {
    synthPromise = (async () => {
      onStatus?.('Phone AI model download ho raha hai (pehli baar bada hota hai, phir cache)...')
      const tf = await import(/* @vite-ignore */ CDN)
      return tf.pipeline('text-to-audio', 'Xenova/musicgen-small', {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: p => {
          if (p?.status === 'progress' && p.file) onStatus?.(`Model download: ${p.file.split('/').pop()} ${Math.round(p.progress || 0)}%`)
        },
      })
    })().catch(e => { synthPromise = null; throw e })
  }
  return synthPromise
}

export async function phoneGenerate(prompt, seconds = 15, onStatus) {
  const synth = await loadSynth(onStatus)
  onStatus?.('Phone par music ban raha hai... (slow ho sakta hai, tab band mat karo)')
  const tokens = Math.round(Math.max(5, Math.min(seconds, 30)) * 50)
  let out
  try {
    out = await synth(prompt, { max_new_tokens: tokens, do_sample: true, guidance_scale: 3 })
  } catch {
    out = await synth(prompt, { do_sample: true, guidance_scale: 3 })
  }
  return URL.createObjectURL(wavBlob(out.audio, out.sampling_rate))
}
