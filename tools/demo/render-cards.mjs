// Renders the brand intro/outro cards (opaque 1920x1080) and the caption strips
// (transparent 1920x1080, bar bottom-left) as PNGs using the real brand fonts
// (Teko / Barlow Condensed / Share Tech Mono) loaded from Google Fonts.
// Output → ~/Desktop/BuckGridPro-Demo/work/.
import { chromium } from 'playwright'
import fs from 'fs'
import os from 'os'
import path from 'path'

const OUT = path.join(os.homedir(), 'Desktop', 'BuckGridPro-Demo', 'work')
const LOGO = (process.env.DEMO_ORIGIN || 'http://localhost:3100') + '/buckgrid-logo.png'
const W = 1920, H = 1080
const INK = '#1E2122', MOSS = '#6B7A57', BONE = '#D8D3C5', ORANGE = '#FF6B00'

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Teko:wght@500;600;700&family=Barlow+Condensed:wght@500;600;700&family=Share+Tech+Mono&display=swap');`

const shell = (body, opaque) => `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;${opaque ? `background:${INK};` : 'background:transparent;'}}
.teko{font-family:'Teko',sans-serif}.barlow{font-family:'Barlow Condensed',sans-serif}.mono{font-family:'Share Tech Mono',monospace}
</style></head><body>${body}</body></html>`

const topo = `<svg width="${W}" height="${H}" style="position:absolute;inset:0;opacity:.10" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="${MOSS}" stroke-width="1.5">${
  Array.from({ length: 14 }, (_, i) => `<path d="M -100 ${80 + i * 80} Q 480 ${20 + i * 80} 960 ${80 + i * 80} T 2020 ${60 + i * 80}"/>`).join('')
}</g></svg>`

const glow = `<div style="position:absolute;inset:0;background:radial-gradient(900px 600px at 50% 42%, rgba(107,122,87,0.18), rgba(30,33,34,0) 70%)"></div>`

const intro = shell(`
${topo}${glow}
<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
  <img src="${LOGO}" style="height:150px;margin-bottom:10px;filter:drop-shadow(0 0 24px rgba(0,0,0,.5))"/>
  <div class="teko" style="font-size:118px;font-weight:700;color:${BONE};letter-spacing:.06em;line-height:.9">BUCKGRID <span style="color:${MOSS}">PRO</span></div>
  <div class="mono" style="font-size:21px;color:${MOSS};letter-spacing:.42em;margin-top:14px">AI&nbsp;&nbsp;WHITETAIL&nbsp;&nbsp;HABITAT&nbsp;&nbsp;PLANNING</div>
  <div style="width:120px;height:2px;background:${ORANGE};margin:30px 0 24px"></div>
  <div class="barlow" style="font-size:34px;font-weight:600;color:${BONE};letter-spacing:.10em">DRAW YOUR LAND&nbsp;&nbsp;·&nbsp;&nbsp;TALK TO TONY&nbsp;&nbsp;·&nbsp;&nbsp;KILL BIGGER BUCKS</div>
</div>`, true)

const outro = shell(`
${topo}${glow}
<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 140px">
  <img src="${LOGO}" style="height:92px;margin-bottom:30px"/>
  <div class="teko" style="font-size:74px;font-weight:600;color:${BONE};letter-spacing:.03em;line-height:1.02">THE ONLY AI THAT <span style="color:${MOSS}">SEES YOUR LAND</span><br/>AND DRAWS THE PLAN</div>
  <div style="width:120px;height:2px;background:${ORANGE};margin:34px 0 22px"></div>
  <div class="barlow" style="font-size:30px;font-weight:600;color:${BONE};letter-spacing:.10em">DRAW YOUR LAND · TALK TO TONY · KILL BIGGER BUCKS</div>
  <div class="mono" style="font-size:19px;color:${MOSS};letter-spacing:.30em;margin-top:30px">CODESPACEBUCKGRID.VERCEL.APP&nbsp;&nbsp;·&nbsp;&nbsp;DAY 1 · FOUNDER BUILD</div>
</div>`, true)

function captionHTML(text) {
  return shell(`
  <div style="position:absolute;left:64px;bottom:120px;max-width:1180px">
    <div style="display:inline-block;background:rgba(19,23,16,0.86);border-left:5px solid ${ORANGE};border-radius:4px;padding:16px 26px 18px;box-shadow:0 8px 40px rgba(0,0,0,.55)">
      <div class="mono" style="font-size:15px;color:${MOSS};letter-spacing:.26em;margin-bottom:6px">◢ TONY&nbsp;AI</div>
      <div class="teko" style="font-size:46px;font-weight:600;color:${BONE};letter-spacing:.03em;line-height:1.02">${text}</div>
    </div>
  </div>`, false)
}

const browser = await chromium.launch({ headless: true, args: ['--force-device-scale-factor=1'] })
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })

async function render(html, file, omitBackground) {
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.evaluate(async () => { try { await document.fonts.ready } catch {} })
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(OUT, file), omitBackground })
  console.log('rendered', file)
}

await render(intro, 'intro.png', false)
await render(outro, 'outro.png', false)

const captions = JSON.parse(fs.readFileSync(path.join(OUT, 'timeline.json'), 'utf8')).captions
for (let i = 0; i < captions.length; i++) {
  await render(captionHTML(captions[i].text), `cap_${i}.png`, true)
}
await browser.close()
console.log('cards + captions done')
