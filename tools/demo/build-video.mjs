// Assembles the highlight MP4 from the captured frames + caption strips + brand
// cards + a slow pan over the branded export report. Pure ffmpeg (no drawtext;
// captions are pre-rendered PNG overlays). Output → ~/Desktop/BuckGridPro-Demo/.
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const HOME = os.homedir()
const ROOT = path.join(HOME, 'Desktop', 'BuckGridPro-Demo')
const OUT = path.join(ROOT, 'work')
const tl = JSON.parse(fs.readFileSync(path.join(OUT, 'timeline.json'), 'utf8'))
const FPS = tl.fps
const INK = '0x1E2122'
const ff = (args) => { console.log('ffmpeg', args.find(a => a.endsWith('.mp4')) || ''); execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' }) }
const p = (f) => path.join(OUT, f)

// ── 1. Main captioned sequence ──────────────────────────────────────────────
const caps = tl.captions
const capInputs = caps.flatMap((_, i) => ['-i', p(`cap_${i}.png`)])
let fc = `[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=yuv420p,setsar=1[base];`
let last = 'base'
caps.forEach((c, i) => {
  const out = `v${i}`
  fc += `[${last}][${i + 1}:v]overlay=0:0:enable='between(t,${c.t0},${c.t1})'[${out}];`
  last = out
})
fc = fc.replace(/;$/, '')
ff(['-framerate', String(FPS), '-i', p('frames/f_%05d.jpg'), ...capInputs,
  '-filter_complex', fc, '-map', `[${last}]`, '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', p('seg_main.mp4')])

// ── 2. Intro / outro cards (with fades) ─────────────────────────────────────
const card = (png, dur, file) => ff(['-loop', '1', '-t', String(dur), '-i', p(png),
  '-vf', `scale=1920:1080,format=yuv420p,setsar=1,fade=in:st=0:d=0.5,fade=out:st=${dur - 0.6}:d=0.6`,
  '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', p(file)])
card('intro.png', 6.5, 'seg_intro.mp4')
card('outro.png', 8, 'seg_outro.mp4')

// ── 3. Slow pan over the tall branded export report ─────────────────────────
// report scaled to 1040px wide; scroll it up the Ink frame over the clip.
const PANW = 1040, REPORT_H = Math.round(2813 * PANW / 1200) // ≈2440
const PAN_DUR = 30 // slow cinematic scroll over the full branded report
const travel = REPORT_H - 1080 + 120 // a little headroom top+bottom
ff(['-f', 'lavfi', '-t', String(PAN_DUR), '-i', `color=c=${INK}:s=1920x1080:r=30`,
  '-loop', '1', '-t', String(PAN_DUR), '-i', p('cedar-hollow-export.png'),
  '-i', p('cap_8.png'),
  '-filter_complex',
  `[1:v]scale=${PANW}:-1[r];` +
  `[0:v][r]overlay=x=(W-w)/2:y='60-(t/${PAN_DUR})*${travel}'[bg];` +
  `[bg][2:v]overlay=0:0:enable='between(t,0.3,${PAN_DUR})',format=yuv420p,setsar=1,fade=in:st=0:d=0.5,fade=out:st=${PAN_DUR - 0.6}:d=0.6[v]`,
  '-map', '[v]', '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', p('seg_export.mp4')])

// ── 4. Crossfade-concat all segments ────────────────────────────────────────
const dur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p(f)]).toString().trim())
const segs = ['seg_intro.mp4', 'seg_main.mp4', 'seg_export.mp4', 'seg_outro.mp4']
const durs = segs.map(dur)
console.log('segment durations:', durs.map(d => d.toFixed(1)).join(', '))
const T = 0.6
const inputs = segs.flatMap(s => ['-i', p(s)])
let xf = `[0:v][1:v]xfade=transition=fade:duration=${T}:offset=${(durs[0] - T).toFixed(3)}[x1];`
let off = durs[0] + durs[1] - 2 * T
xf += `[x1][2:v]xfade=transition=fade:duration=${T}:offset=${off.toFixed(3)}[x2];`
off = durs[0] + durs[1] + durs[2] - 3 * T
xf += `[x2][3:v]xfade=transition=fade:duration=${T}:offset=${off.toFixed(3)}[v]`
const finalSilent = path.join(ROOT, 'BuckGridPro-Demo.mp4')
ff([...inputs, '-filter_complex', xf, '-map', '[v]', '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', finalSilent])

const total = durs.reduce((a, b) => a + b, 0) - 3 * T
console.log(`\n✓ ${finalSilent}\n  total ≈ ${total.toFixed(1)}s`)
