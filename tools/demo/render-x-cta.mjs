// Renders the X-cut CTA end card (opaque 1920x1080, dark-glass) using the local
// logo file (no server needed). Output → work-x/card_cta.png.
import { chromium } from 'playwright'
import fs from 'fs'
import os from 'os'
import path from 'path'

const HOME = os.homedir()
const OUT = path.join(HOME, 'Desktop', 'BuckGridPro-Demo', 'work-x')
fs.mkdirSync(OUT, { recursive: true })
const LOGO_PATH = path.join(HOME, 'Desktop', 'codespacebuckgrid', 'public', 'buckgrid-logo.png')
const LOGO = 'data:image/png;base64,' + fs.readFileSync(LOGO_PATH).toString('base64')
const W = 1920, H = 1080
const BASE = '#07120D', BASE2 = '#0A140E', MOSS = '#4E6B57', GOLD = '#C9A227', GOLD_HI = '#E0B43A', BONE = '#E8E4D8', BONE_DIM = '#A8A498'

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Teko:wght@500;600;700&family=Barlow+Condensed:wght@500;600;700&family=Share+Tech+Mono&display=swap');`
const topo = `<svg width="${W}" height="${H}" style="position:absolute;inset:0;opacity:.09" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="${MOSS}" stroke-width="1.4">${
  Array.from({ length: 15 }, (_, i) => `<path d="M -120 ${40 + i * 78} Q 480 ${-20 + i * 78} 960 ${60 + i * 78} T 2040 ${30 + i * 78}"/>`).join('')}</g></svg>`
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:radial-gradient(120% 90% at 50% -10%, ${BASE2} 0%, ${BASE} 62%)}
.teko{font-family:'Teko',sans-serif}.barlow{font-family:'Barlow Condensed',sans-serif}.mono{font-family:'Share Tech Mono',monospace}
</style></head><body>
${topo}
<div style="position:absolute;inset:0;background:radial-gradient(1000px 640px at 50% 42%, rgba(78,107,87,0.16), rgba(7,18,11,0) 70%)"></div>
<div style="position:absolute;inset:0;box-shadow:inset 0 0 220px 50px rgba(3,8,5,0.7)"></div>
<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
  <img src="${LOGO}" style="height:150px;margin-bottom:22px;filter:drop-shadow(0 0 28px rgba(0,0,0,.6))"/>
  <div class="teko" style="font-size:128px;font-weight:700;color:${BONE};letter-spacing:.05em;line-height:.86">BUCKGRID <span style="color:${MOSS}">PRO</span></div>
  <div style="width:130px;height:2px;background:${GOLD};margin:32px auto 26px;box-shadow:0 0 14px rgba(201,162,39,.5)"></div>
  <div class="teko" style="font-size:62px;font-weight:600;color:${BONE};letter-spacing:.04em;line-height:1.0">DRAW YOUR LAND. <span style="color:${GOLD}">TALK TO TONY.</span></div>
  <div class="mono" style="font-size:30px;color:${GOLD_HI};letter-spacing:.20em;margin-top:34px">bo@buckgrid.pro</div>
</div></body></html>`

const browser = await chromium.launch({ headless: true, args: ['--force-device-scale-factor=1'] })
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'networkidle' })
await page.evaluate(async () => { try { await document.fonts.ready } catch {} })
await page.waitForTimeout(450)
await page.screenshot({ path: path.join(OUT, 'card_cta.png') })
await browser.close()
console.log('x cta card done')
