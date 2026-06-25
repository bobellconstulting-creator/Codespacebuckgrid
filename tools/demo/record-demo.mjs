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
const DUR = 40 // seconds of capture
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

// Actions fired at elapsed-second marks during capture.
const actions = [
  { t: 6.2, fn: async () => { await page.getByRole('button', { name: /ASK TONY/i }).click().catch(e => console.log('ask', e.message)) } },
  { t: 31.0, fn: async () => { await page.getByRole('button', { name: /SHARE \/ EXPORT/i }).click().catch(e => console.log('share', e.message)) } },
  { t: 32.4, fn: async () => {
      const dl = page.waitForEvent('download', { timeout: 12000 }).catch(() => null)
      await page.getByRole('button', { name: /PNG/i }).click().catch(() => {})
      const d = await dl; if (d) { await d.saveAs(path.join(OUT, 'cedar-hollow-export.png')); console.log('export PNG saved') }
    } },
]

// Caption beats (id, start, end in seconds, text).
const captions = [
  { t0: 0.4, t1: 5.9, text: 'Real Iowa timber-and-crop ground · ~101 acres' },
  { t0: 6.4, t1: 9.2, text: 'One click — Tony reads the terrain, cover & wind' },
  { t0: 9.4, t1: 12.6, text: 'Sanctuary core — found automatically' },
  { t0: 12.8, t1: 15.8, text: 'Bedding on the south-facing slopes' },
  { t0: 16.0, t1: 19.0, text: 'Food plots on the timber-to-crop edge' },
  { t0: 19.2, t1: 23.0, text: 'Stand placed downwind of bedding' },
  { t0: 23.2, t1: 27.0, text: 'Every call shows its evidence — not an LLM guess' },
  { t0: 27.2, t1: 30.8, text: "Tonight's Sit ranks every stand on tonight's wind" },
  { t0: 31.2, t1: 39.5, text: 'Branded plan — export for the truck or the group chat' },
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
