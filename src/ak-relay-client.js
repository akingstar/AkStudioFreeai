import { normBase } from './ak-shared.js'

export async function relayHealth(base, ms = 1500) {
  try {
    const r = await fetch(normBase(base) + '/api/health', { signal: AbortSignal.timeout(ms), cache: 'no-store' })
    return r.ok ? await r.json() : null
  } catch { return null }
}

export async function relayEnqueue(base, job) {
  const r = await fetch(normBase(base) + '/api/jobs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job }),
  })
  if (!r.ok) throw new Error('Relay enqueue failed: HTTP ' + r.status)
  return (await r.json()).id
}

// done hone tak poll karta hai. onTick(jobState) har poll par.
export async function relayWait(base, id, onTick, shouldStop = () => false) {
  base = normBase(base)
  for (;;) {
    if (shouldStop()) throw new Error('Cancelled')
    const r = await fetch(`${base}/api/jobs/${id}`, { cache: 'no-store' })
    if (!r.ok) throw new Error('Relay job lookup failed: HTTP ' + r.status)
    const st = await r.json()
    onTick?.(st)
    if (st.status === 'done') return `${base}${st.url}`
    if (st.status === 'failed') throw new Error(st.error || 'Relay job failed')
    await new Promise(res => setTimeout(res, 3000))
  }
}
