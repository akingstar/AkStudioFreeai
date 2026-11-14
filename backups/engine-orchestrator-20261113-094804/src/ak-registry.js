const REGISTRY = 'https://raw.githubusercontent.com/akingstar/AkStudioFreeai/main/backends.json'

export async function loadRegistry() {
  try {
    const r = await fetch(REGISTRY + '?t=' + Date.now(), { cache: 'no-store' })
    const list = await r.json()
    const maxAge = 12 * 3600 * 1000
    return list
      .filter(x => x.url && (!x.updated || Date.now() - x.updated * 1000 < maxAge))
      .sort((x, y) => (x.kind === 'local') - (y.kind === 'local'))
      .map(x => {
        const base = x.url.endsWith('/') ? x.url.slice(0, -1) : x.url
        return { name: x.name || 'Backup', id: base, base }
      })
  } catch {
    return []
  }
}
