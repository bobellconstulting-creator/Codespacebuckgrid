// Records the /demo hero flow as a SCREENSHOT SEQUENCE (Playwright screenshots
// capture the WebGL satellite reliably; video screencast does not), plus the
// branded export PNG and a caption timeline. Output → ~/Desktop/BuckGridPro-Demo/work/.
// Run against the production server (fast, stable). /api/wind blocked → Tonight's
// Sit uses the deterministic forecast.
import { chromium } from 'playwright'
import fs from 'fs'
import os from 'os'
import path from 'path'

const OUT = path.join(os.homedir(), 'Desktop', 'BuckGridPro-Demo', 'work')
const FR = path.join(OUT, 'frames')
fs.rmSync(FR, { recursive: true, force: true })
fs.mkdirSync(FR, { recursive: true })
const URL = process.env.DEMO_URL || 'http://localhost:3100/demo'
const W = 1920, H = 1080
const FPS = 12
const DUR = 42 // seconds of capture
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
await sleep(1800) // let flyTo settle + tiles sharpen before capture

// De-clutter the map labels once the plan is fully drawn: greedily hide any
// '.tony-label' whose box overlaps one already kept (kept order = reveal order =
// importance), so the final frame reads clean instead of a pile of pins.
async function declutterLabels() {
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.tony-label'))
    const kept = []
    const M = 6 // collision margin px
    for (const el of els) {
      const r = el.getBoundingClientRect()
      if (r.width === 0) continue
      const hit = kept.some(k => !(r.right + M < k.left || r.left - M > k.right || r.bottom + M < k.top || r.top - M > k.bottom))
      if (hit) { el.style.display = 'none' } else { kept.push(r) }
    }
  }).catch(() => {})
}

// Actions fired at elapsed-second marks during capture.
const actions = [
  { t: 3.2, fn: async () => { await page.getByRole('button', { name: /ASK TONY/i }).click().catch(e => console.log('ask', e.message)) } },
  { t: 12.0, fn: declutterLabels },   // reveal finished (~3.2 + 12*0.56s) → tidy labels
  { t: 14.0, fn: declutterLabels },   // re-run once in case a marker landed late
  { t: 31.0, fn: async () => { await page.getByRole('button', { name: /SHARE \/ EXPORT/i }).click().catch(e => console.log('share', e.message)) } },
  { t: 32.4, fn: async () => {
      const dl = page.waitForEvent('download', { timeout: 12000 }).catch(() => null)
      await page.getByRole('button', { name: /PNG/i }).click().catch(() => {})
      const d = await dl; if (d) { await d.saveAs(path.join(OUT, 'cedar-hollow-export.png')); console.log('export PNG saved') }
    } },
]

// Caption beats (start, end in CAPTURE seconds, text). Short + punchy — the
// narrator carries it; captions just anchor the eye. Bigger = phone-readable.
const captions = [
  { t0: 0.5, t1: 3.0, text: '~101 acres · real Iowa ground' },
  { t0: 3.6, t1: 7.4, text: 'One click — Tony reads it all' },
  { t0: 7.6, t1: 11.0, text: 'Sanctuary core, found' },
  { t0: 11.2, t1: 14.4, text: 'Bedding on the south slopes' },
  { t0: 14.6, t1: 18.0, text: 'Food on the timber edge' },
  { t0: 18.2, t1: 22.2, text: 'Stands downwind of every bed' },
  { t0: 22.4, t1: 27.0, text: 'Every call shows its math' },
  { t0: 27.2, t1: 30.6, text: "Tonight's Sit ranks the wind" },
  { t0: 33.2, t1: 41.5, text: 'Export it — truck-ready' },
]

let frame = 0
const start = Date.now()
let nextAction = 0
console.log('capturing...')
while (true) {
  const elapsed = (Date.now() - start) / 1000
  if (elapsed >= DUR) break
  while (nextAction < actions.length && elapsed >= actions[nextAction].t) {
    actions[nextAction].fn() // fire and forget (don't block the capture cadence)
    nextAction++
  }
  const buf = await page.screenshot({ type: 'jpeg', quality: 90 }).catch(() => null)
  if (buf) { fs.writeFileSync(path.join(FR, `f_${String(frame).padStart(5, '0')}.jpg`), buf); frame++ }
  const drift = (Date.now() - start) / 1000 - elapsed
  await sleep(Math.max(0, 1000 / FPS - drift * 1000))
}
const realFps = frame / ((Date.now() - start) / 1000)
console.log(`captured ${frame} frames, ~${realFps.toFixed(1)} fps`)

await browser.close()
fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify({ fps: realFps, frames: frame, w: W, h: H, captions }, null, 2))
console.log('timeline.json written')
