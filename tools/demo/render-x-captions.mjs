// Renders BIG kinetic burned-in captions for the X cut as transparent 1920x1080
// PNGs (bottom-center, heavy scrim for muted legibility). Brand fonts + palette.
// Output → work-x/. Caption list is shared with the video builder via captions.json.
import { chromium } from 'playwright'
import fs from 'fs'
import os from 'os'
import path from 'path'

const OUT = path.join(os.homedir(), 'Desktop', 'BuckGridPro-Demo', 'work-x')
fs.mkdirSync(OUT, { recursive: true })
const W = 1920, H = 1080
const GOLD = '#E0B43A', BONE = '#F2EFE6', GREEN = '#7DD88F'

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Teko:wght@500;600;700&family=Barlow+Condensed:wght@600;700&family=Share+Tech+Mono&display=swap');`
const shell = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:transparent}
.teko{font-family:'Teko',sans-serif}.mono{font-family:'Share Tech Mono',monospace}.barlow{font-family:'Barlow Condensed',sans-serif}
</style></head><body>${body}</body></html>`

// Caption card: a kicker (small mono) + a big punch line, centered low enough to
// survive a 1:1 center-crop (keep within the middle 1080px-wide column too).
// `pos`: 'mid' (vertically centered, for the hook) or 'low' (lower third).
function caption({ kicker, big, accent, pos = 'low', size = 110 }) {
  // Color a span wrapped in **...** with the accent color.
  const html = big.replace(/\*\*(.+?)\*\*/g, `<span style="color:${accent || GOLD}">$1</span>`)
  const top = pos === 'mid' ? 'top:50%;transform:translateY(-50%)' : 'bottom:120px'
  const scrim = pos === 'mid'
    ? `<div style="position:absolute;inset:0;background:radial-gradient(1100px 520px at 50% 50%, rgba(5,12,8,0.78), rgba(5,12,8,0) 72%)"></div>`
    : `<div style="position:absolute;left:0;right:0;bottom:0;height:440px;background:linear-gradient(to top, rgba(5,11,8,0.92) 0%, rgba(5,11,8,0.74) 45%, rgba(5,11,8,0) 100%)"></div>`
  return shell(`${scrim}
  <div style="position:absolute;left:50%;${top};transform:translateX(-50%)${pos === 'mid' ? ' translateY(-50%)' : ''};width:1500px;text-align:center">
    ${kicker ? `<div class="mono" style="font-size:26px;color:${GOLD};letter-spacing:.34em;margin-bottom:18px;text-shadow:0 2px 10px rgba(0,0,0,.9)">${kicker}</div>` : ''}
    <div class="teko" style="font-size:${size}px;font-weight:700;color:${BONE};letter-spacing:.012em;line-height:0.92;text-shadow:0 5px 26px rgba(0,0,0,.92),0 0 3px rgba(0,0,0,.95)">${html}</div>
  </div>`)
}

// Ordered caption set (index = file cap_N.png). Timing lives in the video builder.
const CAPS = [
  { kicker: '◢ BUCKGRID PRO', big: 'DRAW YOUR LAND.', pos: 'mid', size: 130 },
  { big: 'AI BUILDS THE<br/>**ENTIRE HUNT PLAN**', pos: 'mid', size: 118, accent: GOLD },
  { kicker: 'AUTO-DRAWN IN SECONDS', big: 'SANCTUARY · BEDDING<br/>FOOD · STANDS · ACCESS', size: 92 },
  { kicker: 'EVERY STAND SCORES', big: 'THIS ONE: **100**', accent: GREEN, size: 132 },
  { big: 'DOWNWIND OF BEDDING.<br/>ON A **PINCH POINT.**', size: 90, accent: GOLD },
  { kicker: "TONIGHT'S SIT", big: 'RE-RANKED ON<br/>**TONIGHT’S WIND**', accent: GOLD, size: 100 },
  { big: 'THE AI **CAN’T** PUT A PIN<br/>OFF YOUR LAND', size: 92, accent: GOLD },
  { big: 'THE TERRAIN MATH<br/>PLACES IT. **EVIDENCE.**', size: 92, accent: GREEN },
  { kicker: 'ONE CLICK', big: 'BRANDED REPORT,<br/>**TRUCK-READY**', accent: GOLD, size: 100 },
]

const browser = await chromium.launch({ headless: true, args: ['--force-device-scale-factor=1'] })
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
async function render(html, file) {
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.evaluate(async () => { try { await document.fonts.ready } catch {} })
  await page.waitForTimeout(350)
  await page.screenshot({ path: path.join(OUT, file), omitBackground: true })
  console.log('rendered', file)
}
for (let i = 0; i < CAPS.length; i++) await render(caption(CAPS[i]), `cap_${i}.png`)
await browser.close()
fs.writeFileSync(path.join(OUT, 'captions.json'), JSON.stringify(CAPS, null, 2))
console.log('x captions done')
