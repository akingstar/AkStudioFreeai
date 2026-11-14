export function wavBlob(float32, sr) {
  const n = float32.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf)
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  w(36, 'data'); v.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([buf], { type: 'audio/wav' })
}

// Koi bhi recording/upload -> mono WAV (24 kHz), shuru ki khamoshi hata kar, max maxSec.
export async function toRefWav(blob, { sr = 24000, maxSec = 25 } = {}) {
  const AC = window.AudioContext || window.webkitAudioContext
  const ctx = new AC()
  let dec
  try { dec = await ctx.decodeAudioData(await blob.arrayBuffer()) } finally { ctx.close?.() }
  const ch0 = dec.getChannelData(0)
  let first = 0
  while (first < ch0.length && Math.abs(ch0[first]) < 0.02) first++
  const offset = Math.max(0, first / dec.sampleRate - 0.1)
  const dur = Math.min(dec.duration - offset, maxSec)
  if (dur < 3) throw new Error('Recording bahut chhoti hai (kam se kam 3 sec saaf awaaz chahiye).')
  const off = new OfflineAudioContext(1, Math.ceil(dur * sr), sr)
  const src = off.createBufferSource()
  src.buffer = dec
  src.connect(off.destination)
  src.start(0, offset, dur)
  const out = await off.startRendering()
  return { blob: wavBlob(out.getChannelData(0), sr), seconds: dur }
}

export function dl(blob, name) {
  const u = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = u; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(u), 8000)
}
