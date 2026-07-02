// Builds 9:16 BuckGrid Pro short-form clips from Hermes-written scripts.
// Uses existing investor demo footage + ElevenLabs BuckGrid Narrator + kinetic captions.
// Usage: node tools/demo/build-shorts.mjs [short-id]
import { execFileSync } from 'child_process'
import { chromium } from 'playwright'
import fs from 'fs'
import os from 'os'
import path from 'path'

const HOME = os.homedir()
const ROOT = path.join(HOME, 'Desktop', 'BuckGridPro-Demo')
const FOOT = path.join(ROOT, 'work-inv', 'footage.mp4')
const OUTROOT = path.join(ROOT, 'shorts')
const CONFIG = JSON.parse(fs.readFileSync(new URL('./shorts-config.json', import.meta.url), 'utf8'))
const TARGET = process.argv[2]
const SHORTS = TARGET ? CONFIG.filter(s => s.id.includes(TARGET)) : CONFIG
if (!SHORTS.length) { console.error('No shorts matched'); process.exit(1) }

const W = 1080, H = 1920, R = '30'
const GOLD = '#E0B43A', BONE = '#F2EFE6', GREEN = '#7DD88F'
const ff = (args, label) => { if (label) console.log('ffmpeg', label); execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' }) }
const dur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())

function readKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim()
  const m = fs.readFileSync(path.join(HOME, '.openclaw', '.env'), 'utf8').match(/ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s]+)/)
  if (m) return m[1]
  throw new Error('ELEVENLABS_API_KEY not found')
}
const EL_KEY = readKey()
const EL_VOICE = process.env.EL_VOICE_ID || '0MRYJXNs3YpCskZuTsOT'

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Teko:wght@500;600;700&family=Share+Tech+Mono&display=swap');`
const shell = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:transparent}
.teko{font-family:'Teko',sans-serif}.mono{font-family:'Share Tech Mono',monospace}
</style></head><body>${body}</body></html>`

function captionHtml({ kicker, big, accent = GOLD, pos = 'low', size = 110 }) {
  const html = big.replace(/\*\*(.+?)\*\*/g, `<span style="color:${accent}">$1</span>`)
  const top = pos === 'mid' ? 'top:46%;transform:translateY(-50%)' : 'bottom:220px'
  const scrim = pos === 'mid'
    ? `<div style="position:absolute;inset:0;background:radial-gradient(900px 700px at 50% 46%, rgba(5,12,8,0.82), rgba(5,12,8,0) 72%)"></div>`
    : `<div style="position:absolute;left:0;right:0;bottom:0;height:560px;background:linear-gradient(to top, rgba(5,11,8,0.94) 0%, rgba(5,11,8,0.72) 45%, rgba(5,11,8,0) 100%)"></div>`
  return shell(`${scrim}
  <div style="position:absolute;left:50%;${top};transform:translateX(-50%)${pos === 'mid' ? ' translateY(-50%)' : ''};width:920px;text-align:center">
    ${kicker ? `<div class="mono" style="font-size:24px;color:${GOLD};letter-spacing:.34em;margin-bottom:16px;text-shadow:0 2px 10px rgba(0,0,0,.9)">${kicker}</div>` : ''}
    <div class="teko" style="font-size:${size}px;font-weight:700;color:${BONE};letter-spacing:.012em;line-height:0.9;text-shadow:0 5px 26px rgba(0,0,0,.92),0 0 3px rgba(0,0,0,.95)">${html}</div>
  </div>`)
}

async function synthLine(outMp3, text) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.85, style: 0.30, use_speaker_boost: true },
    }),
  })
  if (!res.ok) throw new Error(`EL ${res.status}: ${await res.text()}`)
  fs.writeFileSync(outMp3, Buffer.from(await res.arrayBuffer()))
}

async function buildShort(short) {
  const dir = path.join(OUTROOT, short.id)
  fs.mkdirSync(dir, { recursive: true })
  const p = (f) => path.join(dir, f)
  const ENC = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-r', R]
  const { start, end, zFrom, zTo, cx, cy } = short.footage
  const clipDur = (end - start).toFixed(3)
  const n = Math.round((end - start) * 30)
  const z = `${zFrom}+(${(zTo - zFrom).toFixed(5)})*on/${n}`

  console.log(`\n=== ${short.id}: ${short.title} ===`)
  ff(['-ss', String(start), '-t', clipDur, '-i', FOOT,
    '-filter_complex',
    `[0:v]fps=30,scale=3240:1822,setsar=1,crop=1024:1822:(iw-1024)/2:0,` +
    `zoompan=z='${z}':x='(iw-iw/zoom)*${cx}':y='(ih-ih/zoom)*${cy}':d=1:s=${W}x${H}:fps=30,` +
    `eq=contrast=1.08:brightness=0.02:saturation=1.12,format=yuv420p`,
    ...ENC, p('base.mp4')], 'vertical footage')

  let baseDur = dur(p('base.mp4'))
  const browser = await chromium.launch({ headless: true, args: ['--force-device-scale-factor=1'] })
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  for (const cap of short.captions) {
    await page.setContent(captionHtml(cap), { waitUntil: 'networkidle' })
    await page.evaluate(async () => { try { await document.fonts.ready } catch {} })
    await page.waitForTimeout(300)
    await page.screenshot({ path: p(`cap_${cap.i}.png`), omitBackground: true })
    console.log('caption', short.id, `cap_${cap.i}.png`)
  }
  await browser.close()

  const GAP = 0.25
  const wavs = []
  for (const line of short.lines) {
    const mp3 = p(`vo_${line.id}.mp3`)
    if (process.env.EL_REGEN || !fs.existsSync(mp3)) {
      await synthLine(mp3, line.s)
      console.log('vo', short.id, line.id)
    }
    const wav = p(`vo_${line.id}.wav`)
    ff(['-i', mp3, '-ar', '48000', '-ac', '2', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', wav])
    wavs.push({ ...line, wav, len: dur(wav) })
  }

  let cursor = 0
  const scheduled = wavs.map((w) => {
    const startAt = Math.max(w.t, cursor)
    cursor = startAt + w.len + GAP
    return { ...w, startAt }
  })
  const voEnd = scheduled[scheduled.length - 1].startAt + scheduled[scheduled.length - 1].len
  const total = Math.max(baseDur, voEnd + 1.8, 18)
  if (total > baseDur) {
    ff(['-i', p('base.mp4'), '-vf', `tpad=stop_mode=clone:stop_duration=${(total - baseDur).toFixed(3)}`, ...ENC, p('base_padded.mp4')])
    fs.renameSync(p('base_padded.mp4'), p('base.mp4'))
    baseDur = dur(p('base.mp4'))
  }

  const voIn = ['-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=r=48000:cl=stereo']
  scheduled.forEach(w => voIn.push('-i', w.wav))
  let vfc = ''
  scheduled.forEach((w, i) => { vfc += `[${i + 1}:a]adelay=${Math.round(w.startAt * 1000)}|${Math.round(w.startAt * 1000)}[v${i}];` })
  vfc += '[0:a]' + scheduled.map((_, i) => `[v${i}]`).join('') + `amix=inputs=${scheduled.length + 1}:duration=longest:normalize=0,alimiter=limit=0.97[vo]`
  ff([...voIn, '-filter_complex', vfc, '-map', '[vo]', '-c:a', 'pcm_s16le', p('vo.wav')], 'mix vo')

  ff(['-f', 'lavfi', '-i', 'sine=frequency=65.41:sample_rate=48000',
    '-f', 'lavfi', '-i', 'sine=frequency=98:sample_rate=48000',
    '-f', 'lavfi', '-i', 'sine=frequency=130.81:sample_rate=48000',
    '-filter_complex',
    '[0][1][2]amix=inputs=3:normalize=0,tremolo=f=0.22:d=0.35,lowpass=f=1200,highpass=f=45,' +
    `volume=0.11,afade=in:d=0.8:st=0,afade=out:st=${(total - 1.8).toFixed(2)}:d=1.8[bed]`,
    '-map', '[bed]', '-t', String(total), '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', p('bed.wav')], 'bed')

  ff(['-i', p('vo.wav'), '-i', p('bed.wav'),
    '-filter_complex', '[0:a][1:a]sidechaincompress=threshold=0.03:ratio=8:attack=5:release=180[ducked];[ducked]loudnorm=I=-12:TP=-1:LRA=9[out]',
    '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', p('audio.m4a')], 'final audio')

  const capInputs = short.captions.flatMap(c => ['-framerate', '30', '-loop', '1', '-t', total.toFixed(3), '-i', p(`cap_${c.i}.png`)])
  let cfc = '[0:v]setsar=1[b0];'
  let lab = 'b0'
  const FD = 0.18
  short.captions.forEach((c, k) => {
    const out = `b${k + 1}`
    cfc += `[${k + 1}:v]format=rgba,fade=in:st=${c.t0}:d=${FD}:alpha=1,fade=out:st=${(c.t1 - FD).toFixed(2)}:d=${FD}:alpha=1[c${k}];`
    cfc += `[${lab}][c${k}]overlay=0:0:enable='between(t,${c.t0},${c.t1})'[${out}];`
    lab = out
  })
  cfc = cfc.replace(/;$/, '')
  const final = path.join(OUTROOT, `BuckGridPro-Short-${short.id}.mp4`)
  ff(['-i', p('base.mp4'), ...capInputs, '-i', p('audio.m4a'),
    '-filter_complex', `${cfc};[${lab}]format=yuv420p[v]`,
    '-map', '[v]', '-map', `${short.captions.length + 1}:a`, ...ENC, '-c:a', 'copy', '-shortest', '-movflags', '+faststart', final], 'mux final')
  console.log(`✓ ${final} (${dur(final).toFixed(1)}s)`)
  return final
}

fs.mkdirSync(OUTROOT, { recursive: true })
const browserProbe = await chromium.launch({ headless: true })
await browserProbe.close()

const outputs = []
for (const short of SHORTS) outputs.push(await buildShort(short))
console.log('\nDone:', outputs.join('\n'))