// Renders investor-grade DARK-GLASS cards (opaque 1920x1080) with the brand
// palette + topo motif + brand fonts. Output → ~/Desktop/BuckGridPro-Demo/work-inv/.
// Cards: hook(title), problem, reveal(solution), roadmap, cta(end). Also B-roll
// placeholder cards for hook/problem/close where no drone/nature footage exists.
import { chromium } from 'playwright'
import fs from 'fs'
import os from 'os'
import path from 'path'

const OUT = path.join(os.homedir(), 'Desktop', 'BuckGridPro-Demo', 'work-inv')
fs.mkdirSync(OUT, { recursive: true })
const LOGO = (process.env.DEMO_ORIGIN || 'http://localhost:3100') + '/buckgrid-logo.png'
const W = 1920, H = 1080

// Apple-keynote luxury palette (matches DemoPage investor edition)
const BASE = '#07120D', BASE2 = '#0A140E', FOREST = '#0A3D2F', MOSS = '#4E6B57'
const GOLD = '#C9A227', GOLD_HI = '#E0B43A', BONE = '#E8E4D8', BONE_DIM = '#A8A498', BONE_FAINT = '#7C8276'

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Teko:wght@400;500;600;700&family=Barlow+Condensed:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');`

const shell = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:radial-gradient(120% 90% at 50% -10%, ${BASE2} 0%, ${BASE} 62%);}
.teko{font-family:'Teko',sans-serif}.barlow{font-family:'Barlow Condensed',sans-serif}.mono{font-family:'Share Tech Mono',monospace}
</style></head><body>${body}</body></html>`

// Topo contour motif — faint forest lines drifting across the frame.
const topo = `<svg width="${W}" height="${H}" style="position:absolute;inset:0;opacity:.09" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="${MOSS}" stroke-width="1.4">${
  Array.from({ length: 15 }, (_, i) => `<path d="M -120 ${40 + i * 78} Q 480 ${-20 + i * 78} 960 ${60 + i * 78} T 2040 ${30 + i * 78}"/>`).join('')
}</g></svg>`
const glow = `<div style="position:absolute;inset:0;background:radial-gradient(1000px 640px at 50% 40%, rgba(78,107,87,0.16), rgba(7,18,11,0) 70%)"></div>`
const vignette = `<div style="position:absolute;inset:0;box-shadow:inset 0 0 220px 50px rgba(3,8,5,0.7)"></div>`
const center = (inner, pad = 160) => `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 ${pad}px">${inner}</div>`
const rule = (w = 130) => `<div style="width:${w}px;height:2px;background:${GOLD};margin:34px auto 28px;box-shadow:0 0 14px rgba(201,162,39,.5)"></div>`
const kicker = (t) => `<div class="mono" style="font-size:20px;color:${GOLD};letter-spacing:.42em;margin-bottom:26px">${t}</div>`

// ── Title / Hook (also serves as the prairie B-roll placeholder) ──────────────
const hook = shell(`${topo}${glow}${vignette}${center(`
  <img src="${LOGO}" style="height:150px;margin-bottom:16px;filter:drop-shadow(0 0 30px rgba(0,0,0,.6))"/>
  <div class="teko" style="font-size:138px;font-weight:700;color:${BONE};letter-spacing:.05em;line-height:.86">BUCKGRID <span style="color:${MOSS}">PRO</span></div>
  <div class="mono" style="font-size:22px;color:${MOSS};letter-spacing:.46em;margin-top:20px">HABITAT&nbsp;&nbsp;INTELLIGENCE</div>
  ${rule()}
  <div class="barlow" style="font-size:40px;font-weight:500;color:${BONE_DIM};letter-spacing:.04em;line-height:1.3;max-width:1180px">Where, exactly, does the mature buck<br/>live on your ground?</div>
`)}`)

// ── Problem ───────────────────────────────────────────────────────────────────
const problem = shell(`${topo}${glow}${vignette}${center(`
  ${kicker('◢ THE OLD WAY')}
  <div class="teko" style="font-size:96px;font-weight:600;color:${BONE};letter-spacing:.02em;line-height:1.0">BOOT LEATHER<br/><span style="color:${MOSS}">AND&nbsp;GUESSWORK</span></div>
  ${rule()}
  <div class="barlow" style="font-size:36px;font-weight:500;color:${BONE_DIM};letter-spacing:.03em;line-height:1.35;max-width:1240px">Walk it. Hang stands. Hope the wind cooperates.<br/>Burn a season learning what the land already knew.</div>
`)}`)

// ── Solution reveal ───────────────────────────────────────────────────────────
const reveal = shell(`${topo}${glow}${vignette}${center(`
  ${kicker('◢ A NEW WAY TO READ THE GROUND')}
  <div class="teko" style="font-size:104px;font-weight:600;color:${BONE};letter-spacing:.02em;line-height:.98">READ THE GROUND<br/>THE WAY THE <span style="color:${GOLD}">DEER&nbsp;DO</span></div>
  ${rule()}
  <div class="barlow" style="font-size:40px;font-weight:500;color:${BONE_DIM};letter-spacing:.10em">REAL TERRAIN&nbsp;&nbsp;·&nbsp;&nbsp;REAL CANOPY&nbsp;&nbsp;·&nbsp;&nbsp;REAL WIND</div>
`)}`)

// ── Roadmap (header MUST read WHAT'S NEXT — ROADMAP; items labeled as vision) ──
const roadItem = (t, d) => `
  <div style="flex:1 1 0;min-width:0;background:rgba(10,20,14,0.55);border:1px solid rgba(255,255,255,0.08);border-top:2px solid ${GOLD};border-radius:14px;padding:26px 24px;text-align:left;box-shadow:inset 0 1px 0 rgba(255,255,255,0.06)">
    <div class="teko" style="font-size:34px;font-weight:600;color:${BONE};letter-spacing:.04em;line-height:1.05">${t}</div>
    <div class="barlow" style="font-size:21px;font-weight:400;color:${BONE_FAINT};letter-spacing:.02em;margin-top:10px;line-height:1.3">${d}</div>
  </div>`
const roadmap = shell(`${topo}${glow}${vignette}
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 130px">
    <div class="mono" style="font-size:22px;color:${GOLD};letter-spacing:.40em;margin-bottom:10px">WHAT'S NEXT — ROADMAP</div>
    <div class="mono" style="font-size:15px;color:${BONE_FAINT};letter-spacing:.30em;margin-bottom:44px">VISION · NOT YET SHIPPED</div>
    <div style="display:flex;gap:22px;width:100%;max-width:1640px">
      ${roadItem('IMAGERY UPLOAD', 'Bring your own drone &amp; satellite imagery.')}
      ${roadItem('VEGETATION HEALTH', 'Greenness &amp; cover, season over season.')}
      ${roadItem('PORTFOLIO DASHBOARDS', 'Every property you manage, one view.')}
      ${roadItem('WHITE-LABEL', 'For outfitters &amp; land brokers.')}
    </div>
  </div>`)

// ── CTA end card ──────────────────────────────────────────────────────────────
const cta = shell(`${topo}${glow}${vignette}${center(`
  <img src="${LOGO}" style="height:96px;margin-bottom:26px;filter:drop-shadow(0 0 24px rgba(0,0,0,.5))"/>
  <div class="teko" style="font-size:96px;font-weight:600;color:${BONE};letter-spacing:.02em;line-height:.98">THIS IS <span style="color:${GOLD}">HABITAT<br/>INTELLIGENCE</span></div>
  ${rule()}
  <div class="barlow" style="font-size:34px;font-weight:500;color:${BONE_DIM};letter-spacing:.05em;line-height:1.3">Built by a landowner, for people who manage land seriously.</div>
  <div style="margin-top:40px;display:flex;flex-direction:column;align-items:center;gap:8px">
    <div class="teko" style="font-size:46px;font-weight:600;color:${BONE};letter-spacing:.10em">BO BELL · FOUNDER</div>
    <div class="mono" style="font-size:26px;color:${GOLD_HI};letter-spacing:.20em">bo@buckgrid.pro</div>
  </div>
`)}`)

const browser = await chromium.launch({ headless: true, args: ['--force-device-scale-factor=1'] })
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
async function render(html, file) {
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.evaluate(async () => { try { await document.fonts.ready } catch {} })
  await page.waitForTimeout(450)
  await page.screenshot({ path: path.join(OUT, file) })
  console.log('rendered', file)
}
await render(hook, 'card_hook.png')
await render(problem, 'card_problem.png')
await render(reveal, 'card_reveal.png')
await render(roadmap, 'card_roadmap.png')
await render(cta, 'card_cta.png')
await browser.close()
console.log('investor cards done')
