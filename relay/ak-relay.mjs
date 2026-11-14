#!/usr/bin/env node
// AkStudio Termux relay: phone par chalne wala job-queue worker.
// - Cloud (ZeroGPU) quota khatam ho to job queue me rehta hai aur browser band hone par bhi retry hota hai
// - Aapka HF token sirf is phone me (~/.akstudio/config.json) rehta hai
// - ffmpeg ho to final song ko loudness-normalize karta hai
// Zero extra deps: sirf Node + @gradio/client (npm install se aata hai)
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { argsFor, waitSeconds, isQuotaError, normBase, SPACE_ID, SPACE_BASE } from '../src/ak-shared.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const HOME = process.env.AK_HOME || path.join(os.homedir(), '.akstudio')
const OUT = path.join(HOME, 'out')
const CONF = path.join(HOME, 'config.json')
const JOBS = path.join(HOME, 'jobs.json')
const DIST = path.join(HERE, '..', 'dist')
const REGISTRY = 'https://raw.githubusercontent.com/akingstar/AkStudioFreeai/main/backends.json'
const ALLOWED = [/^https:\/\/akingstar\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/]
const MAX_TRIES = 48

fs.mkdirSync(OUT, { recursive: true })
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return d } }
const conf = () => ({ port: 8787, host: '127.0.0.1', hfToken: '', extraBackends: [], loudnorm: true, ...readJson(CONF, {}) })
let jobs = readJson(JOBS, [])
const save = () => fs.writeFileSync(JOBS, JSON.stringify(jobs.slice(0, 100)))
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0

// ---------- backends ----------
let GradioClient = null
async function gradio() {
  if (!GradioClient) {
    try { GradioClient = (await import('@gradio/client')).Client }
    catch { throw new Error('@gradio/client missing: repo folder me "npm install" chalao') }
  }
  return GradioClient
}

async function registry() {
  try {
    const r = await fetch(REGISTRY + '?t=' + Date.now(), { signal: AbortSignal.timeout(8000) })
    const list = await r.json()
    return list.filter(x => x.url && (!x.updated || Date.now() - x.updated * 1000 < 12 * 3600e3))
      .map(x => ({ name: x.name || 'Registry', id: normBase(x.url), base: normBase(x.url) }))
  } catch { return [] }
}

async function chain() {
  const c = conf()
  const list = [{ name: 'ZeroGPU', id: SPACE_ID, base: SPACE_BASE }]
  if (c.hfToken) list.push({ name: 'ZeroGPU (HF token)', id: SPACE_ID, base: SPACE_BASE, token: c.hfToken })
  for (const x of c.extraBackends || []) if (x?.url) list.push({ name: x.name || 'Extra', id: normBase(x.url), base: normBase(x.url) })
  return [...list, ...(await registry())]
}

async function runOn(b, job) {
  const Client = await gradio()
  const client = await Client.connect(b.id, b.token ? { hf_token: b.token } : undefined)
  const res = await client.predict('/generation_api', argsFor(job))
  const d = JSON.parse(res.data[0])
  if (d.status !== 'Generation Complete') throw new Error(d.status || 'Generation failed')
  const mp3 = d.all_generated_files.find(f => f.endsWith('.mp3'))
  if (!mp3) throw new Error('mp3 file nahi mili')
  return `${b.base}/gradio_api/file=${mp3}`
}

async function download(url, file) {
  const r = await fetch(url, { headers: conf().hfToken && url.includes('.hf.space') ? { Authorization: 'Bearer ' + conf().hfToken } : {} })
  if (!r.ok) throw new Error('download HTTP ' + r.status)
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()))
}

function normalize(file) {
  if (!hasFfmpeg || !conf().loudnorm) return Promise.resolve(false)
  const tmp = file + '.norm.mp3'
  return new Promise(res => {
    const p = spawn('ffmpeg', ['-y', '-i', file, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-b:a', '192k', tmp], { stdio: 'ignore' })
    p.on('exit', code => { if (code === 0) { fs.renameSync(tmp, file); res(true) } else { try { fs.unlinkSync(tmp) } catch {} ; res(false) } })
    p.on('error', () => res(false))
  })
}

function notify(msg) { try { spawn('termux-notification', ['--title', 'AkStudio', '--content', msg], { stdio: 'ignore' }).on('error', () => {}) } catch {} }

// ---------- worker ----------
let working = false
async function tick() {
  if (working) return
  const job = jobs.find(j => j.status === 'queued' && (j.nextAt || 0) <= Date.now())
  if (!job) return
  working = true
  job.status = 'running'; job.tries = (job.tries || 0) + 1; job.updatedAt = Date.now(); save()
  log(`job ${job.id.slice(0, 6)} try ${job.tries}`)
  let minWait = null
  const errors = []
  try {
    for (const b of await chain()) {
      try {
        const url = await runOn(b, job.job)
        const file = path.join(OUT, job.id + '.mp3')
        await download(url, file)
        const normed = await normalize(file)
        Object.assign(job, { status: 'done', url: '/out/' + job.id + '.mp3', via: b.name, normalized: normed, updatedAt: Date.now() })
        save(); log(`job ${job.id.slice(0, 6)} done via ${b.name}`); notify('Aapka song ready hai 🎵')
        return
      } catch (e) {
        const msg = String(e?.message || e)
        errors.push(`${b.name}: ${msg.slice(0, 120)}`)
        const w = waitSeconds(msg)
        if (w && (minWait === null || w < minWait)) minWait = w
      }
    }
    if (job.tries >= MAX_TRIES) {
      Object.assign(job, { status: 'failed', error: errors.join(' | ').slice(0, 400) })
    } else {
      const backoff = Math.min(3600, 300 * 2 ** Math.min(job.tries - 1, 4))
      const wait = Math.max(60, Math.min(minWait ?? backoff, 3600))
      Object.assign(job, { status: 'queued', nextAt: Date.now() + wait * 1000, lastError: errors.join(' | ').slice(0, 400) })
      log(`job ${job.id.slice(0, 6)} retry in ${Math.round(wait / 60)}m`)
    }
    job.updatedAt = Date.now(); save()
  } catch (e) {
    Object.assign(job, { status: 'failed', error: String(e.message || e) }); save()
  } finally { working = false }
}
setInterval(() => tick().catch(e => log('tick error', e.message)), 4000)

// ---------- http ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2' }

function cors(req, res) {
  const o = req.headers.origin
  const ok = !o || ALLOWED.some(r => r.test(o))
  if (o && ok) {
    res.setHeader('Access-Control-Allow-Origin', o)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Private-Network', 'true')
  }
  return ok
}

const send = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function body(req) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = []
    req.on('data', c => { n += c.length; if (n > 200_000) { reject(new Error('too large')); req.destroy() } else chunks.push(c) })
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')) } catch (e) { reject(e) } })
  })
}

function serveFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, { error: 'not found' })
    const type = MIME[path.extname(file)] || 'application/octet-stream'
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '')
    if (range) {
      const start = range[1] ? +range[1] : 0
      const end = range[2] ? Math.min(+range[2], st.size - 1) : st.size - 1
      res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 })
      return fs.createReadStream(file, { start, end }).pipe(res)
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' })
    fs.createReadStream(file).pipe(res)
  })
}

const server = http.createServer(async (req, res) => {
  const allowed = cors(req, res)
  const u = new URL(req.url, 'http://x')
  const p = u.pathname
  if (req.method === 'OPTIONS') { res.writeHead(allowed ? 204 : 403); return res.end() }
  if (!allowed) return send(res, 403, { error: 'origin not allowed' })
  try {
    if (p === '/api/health') {
      const c = conf()
      return send(res, 200, { ok: true, name: 'akstudio-relay', version: 1, queued: jobs.filter(j => j.status === 'queued' || j.status === 'running').length, hasToken: !!c.hfToken, ffmpeg: hasFfmpeg })
    }
    if (p === '/api/jobs' && req.method === 'POST') {
      const { job } = await body(req)
      if (!job || typeof job.caption !== 'string') return send(res, 400, { error: 'bad job' })
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
      jobs.unshift({ id, job, status: 'queued', tries: 0, nextAt: 0, createdAt: Date.now(), updatedAt: Date.now() })
      save(); tick().catch(() => {})
      return send(res, 200, { id })
    }
    if (p === '/api/jobs' && req.method === 'GET') return send(res, 200, jobs.map(({ id, status, tries, nextAt, url, error }) => ({ id, status, tries, nextAt, url, error })))
    const m = /^\/api\/jobs\/([\w-]+)$/.exec(p)
    if (m) {
      const j = jobs.find(x => x.id === m[1])
      if (!j) return send(res, 404, { error: 'no such job' })
      if (req.method === 'DELETE') { jobs = jobs.filter(x => x !== j); save(); return send(res, 200, { ok: true }) }
      return send(res, 200, { id: j.id, status: j.status, tries: j.tries, nextAt: j.nextAt, url: j.url, via: j.via, error: j.error, lastError: j.lastError })
    }
    if (p.startsWith('/out/')) return serveFile(req, res, path.join(OUT, path.basename(p)))
    // Optional: poora app phone se serve (npm run build ke baad)
    if (fs.existsSync(DIST)) {
      let rel = p.replace(/^\/AkStudioFreeai\/?/, '/')
      if (rel === '/' || rel === '') rel = '/index.html'
      const f = path.normalize(path.join(DIST, rel))
      if (f.startsWith(DIST)) return serveFile(req, res, f)
    }
    send(res, 404, { error: 'not found' })
  } catch (e) { send(res, 500, { error: String(e.message || e) }) }
})

const c = conf()
server.listen(c.port, c.host, () => {
  log(`AkStudio relay ready: http://${c.host}:${c.port}  (ffmpeg: ${hasFfmpeg ? 'yes' : 'no'}, token: ${c.hfToken ? 'yes' : 'no'})`)
  jobs.filter(j => j.status === 'running').forEach(j => { j.status = 'queued' })
  save()
})
