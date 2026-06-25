// INVESTOR CUT recorder. Captures CLEAN product footage of the /demo flow as a
// screenshot sequence (no baked caption strips — the premium UI + VO carry it).
// Beats captured (elapsed seconds in the single continuous take):
//   0–4   boundary established, tight fitBounds framing, ASK TONY visible
//   4–18  staggered plan reveal (sanctuary→bedding→food→stands→access)
//   18–26 full plan dwell (clean, de-cluttered labels)
//   26–34 Tonight's Sit visible + ranked
//   34–42 Share/Export → branded report export PNG saved
// Output → ~/Desktop/BuckGridPro-Demo/work-inv/
import { chromium } from 'playwright'
import fs from 'fs'
import os from 'os'
import path from 'path'

const OUT = path.join(os.homedir(), 'Desktop', 'BuckGridPro-Demo', 'work-inv')
const FR = path.join(OUT, 'frames')
fs.rmSync(FR, { recursive: true, force: true })
fs.mkdirSync(FR, { recursive: true })
const URL = process.env.DEMO_URL || 'http://localhost:3100/demo'
const W = 1920, H = 1080
const FPS = 15
const DUR = 44
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist', '--hide-scrollbars', '--force-device-scale-factor=1'],
})
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await page.route('**/api/wind**', r => r.abort())
await page.goto(URL, { waitUntil: 'domcontentloaded' }).catch(() => {})

async function waitPainted(timeout = 25000) {
  const s = Date.now()
  while (Date.now() - s < timeout) {
    const ok = await page.evaluate(() => {
      const c = document.querySelector('canvas'); if (!c) return false
      const g = c.getContext('webgl2') || c.getContext('webgl'); if (!g) return false
      const p = new Uint8Array(4); g.readPixels(c.width / 2 | 0, c.height / 2 | 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, p)
      return (p[0] + p[1] + p[2]) > 40
    }).catch(() => false)
    if (ok) return true
    await sleep(200)
  }
  return false
}
await waitPainted()
await sleep(2200) // let fitBounds settle + tiles sharpen

async function declutterLabels() {
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.tony-label'))
    const kept = []
    const M = 6
    for (const el of els) {
      const r = el.getBoundingClientRect()
      if (r.width === 0) continue
      const hit = kept.some(k => !(r.right + M < k.left || r.left - M > k.right || r.bottom + M < k.top || r.top - M > k.bottom))
      if (hit) { el.style.display = 'none' } else { kept.push(r) }
    }
  }).catch(() => {})
}

const actions = [
  { t: 3.0, fn: async () => { await page.getByRole('button', { name: /ASK TONY/i }).click().catch(e => console.log('ask', e.message)) } },
  { t: 16.0, fn: declutterLabels },
  { t: 18.0, fn: declutterLabels },
  { t: 26.5, fn: declutterLabels },
  // Open Share/Export and trigger the branded PNG export late so the report renders
  { t: 35.0, fn: async () => { await page.getByRole('button', { name: /SHARE \/ EXPORT/i }).click().catch(e => console.log('share', e.message)) } },
  { t: 36.4, fn: async () => {
      const dl = page.waitForEvent('download', { timeout: 14000 }).catch(() => null)
      await page.getByRole('button', { name: /PNG/i }).click().catch(() => {})
      const d = await dl; if (d) { await d.saveAs(path.join(OUT, 'export.png')); console.log('export PNG saved') }
    } },
]

let frame = 0
const start = Date.now()
let nextAction = 0
let scoresDumped = false
console.log('capturing investor footage...')
while (true) {
  const elapsed = (Date.now() - start) / 1000
  if (elapsed >= DUR) break
  while (nextAction < actions.length && elapsed >= actions[nextAction].t) {
    actions[nextAction].fn()
    nextAction++
  }
  // Once the plan is drawn, dump the real scores so the VO can be locked to them.
  if (!scoresDumped && elapsed > 20) {
    scoresDumped = true
    page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.bg-card-rise'))
      return cards.map(c => c.innerText.replace(/\n/g, ' | ').trim())
    }).then(d => { fs.writeFileSync(path.join(OUT, 'scores.json'), JSON.stringify(d, null, 2)) }).catch(() => {})
  }
  const buf = await page.screenshot({ type: 'jpeg', quality: 92 }).catch(() => null)
  if (buf) { fs.writeFileSync(path.join(FR, `f_${String(frame).padStart(5, '0')}.jpg`), buf); frame++ }
  const drift = (Date.now() - start) / 1000 - elapsed
  await sleep(Math.max(0, 1000 / FPS - drift * 1000))
}
const realFps = frame / ((Date.now() - start) / 1000)
console.log(`captured ${frame} frames, ~${realFps.toFixed(1)} fps`)

await browser.close()
fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify({ fps: realFps, frames: frame, w: W, h: H }, null, 2))
console.log('done. timeline.json written')
