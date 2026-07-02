// Assembles the X/Twitter short. Leads with live /demo footage + BIG kinetic
// burned-in captions (work muted), fast cuts, hero score reveal, report export,
// CTA card. Builds BOTH a 16:9 (1920x1080) and a 1:1 square (1080x1080, center-
// cropped on the map action). Muxes work-x/final_audio.m4a (-12 LUFS).
// Outputs: ~/Desktop/BuckGridPro-Demo/BuckGridPro-X.mp4 and -X-square.mp4
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const HOME = os.homedir()
const ROOT = path.join(HOME, 'Desktop', 'BuckGridPro-Demo')
const OUTI = path.join(ROOT, 'work-inv') // source footage master + export.png
const OUTX = path.join(ROOT, 'work-x')
const FOOT = path.join(OUTI, 'footage.mp4')
const FINAL_169 = path.join(ROOT, 'BuckGridPro-X.mp4')
const FINAL_SQ = path.join(ROOT, 'BuckGridPro-X-square.mp4')
const ff = (args, label) => { if (label) console.log('ff', label); execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' }) }
const dur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())
const px = (f) => path.join(OUTX, f)
const R = '30'
const ENC = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', '-r', R]

// Footage sub-clip [tStart,tEnd] with slow push toward (cx,cy). d=1 per-frame.
function footSeg(tStart, tEnd, file, zFrom, zTo, cx = 0.5, cy = 0.5) {
  const d = (tEnd - tStart).toFixed(3)
  const n = Math.round((tEnd - tStart) * 30)
  const z = `${zFrom}+(${(zTo - zFrom).toFixed(5)})*on/${n}`
  ff(['-ss', String(tStart), '-t', d, '-i', FOOT,
    '-filter_complex',
    `[0:v]fps=30,scale=2880:1620,setsar=1,zoompan=z='${z}':x='(iw-iw/zoom)*${cx}':y='(ih-ih/zoom)*${cy}':d=1:s=1920x1080:fps=30,format=yuv420p`,
    ...ENC, px(file)], `foot ${file}`)
}
// Report pan (short, fast scroll).
function reportSeg(d, file) {
  const img = path.join(OUTI, 'export.png')
  const meta = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', img]).toString().trim().split(',')
  const iw = +meta[0], ih = +meta[1], PANW = 920, RH = Math.round(ih * PANW / iw), travel = RH - 1080 + 80
  ff(['-f', 'lavfi', '-t', String(d), '-i', `color=c=0x07120D:s=1920x1080:r=30`,
    '-loop', '1', '-t', String(d), '-i', img,
    '-filter_complex', `[1:v]scale=${PANW}:-1[r];[0:v][r]overlay=x=(W-w)/2:y='40-(t/${d})*${travel}':shortest=1,setsar=1,format=yuv420p[v]`,
    '-map', '[v]', ...ENC, px(file)], `report ${file}`)
}
// CTA card with gentle push.
function cardSeg(png, d, file, zf, zt) {
  const n = Math.round(d * 30)
  const z = `${zf}+(${(zt - zf).toFixed(5)})*on/${n}`
  ff(['-framerate', '30', '-loop', '1', '-t', String(d), '-i', px(png),
    '-filter_complex', `[0:v]scale=2400:1350,setsar=1,zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,format=yuv420p`,
    ...ENC, px(file)], `card ${file}`)
}

// ── Footage anchors (master sec): boundary/plan visible ~2.5+; full plan ~16+;
//    Tonight's Sit visible ~26+; export ~36+. The plan is static after reveal,
//    so framing/zoom carries the motion. ───────────────────────────────────────
// 1) HOOK over plan footage (0–5)   master 2.0→6.5  slow push to center map
footSeg(2.0, 6.5, 's0.mp4', 1.02, 1.12, 0.40, 0.46)
// 2) PLAN auto-draw layers (5–13)   master 6.5→14.0
footSeg(6.5, 14.0, 's1.mp4', 1.05, 1.15, 0.40, 0.46)
// 3) HERO push into the stand cluster + score (13–21)  master 16→25
footSeg(16.0, 25.0, 's2.mp4', 1.12, 1.5, 0.30, 0.50)
// 4) TONIGHT'S SIT — sidebar rankings (21–27.5)  master 26→33
footSeg(26.0, 33.0, 's3.mp4', 1.15, 1.42, 0.93, 0.78)
// 5) MOAT over full plan (27.5–34)  master 14→20  slow wide push
footSeg(14.0, 20.0, 's4.mp4', 1.04, 1.14, 0.42, 0.46)
// 6) REPORT export (34–38)
reportSeg(4.6, 's5.mp4')
// 7) CTA card (38–42)
cardSeg('card_cta.png', 4.6, 's6.mp4', 1.0, 1.05)

const segs = ['s0.mp4', 's1.mp4', 's2.mp4', 's3.mp4', 's4.mp4', 's5.mp4', 's6.mp4']
const durs = segs.map(s => dur(px(s)))
console.log('seg durs:', durs.map(d => d.toFixed(1)).join(', '))

// ── Concat with quick 0.3s dissolves ─────────────────────────────────────────
const T = 0.3
const inputs = segs.flatMap(s => ['-i', px(s)])
let xf = '', label = '0:v', offset = 0
for (let i = 1; i < segs.length; i++) {
  offset += durs[i - 1] - T
  const out = i === segs.length - 1 ? 'vbase' : `x${i}`
  xf += `[${label}][${i}:v]xfade=transition=fade:duration=${T}:offset=${offset.toFixed(3)}[${out}];`
  label = out
}
xf = xf.replace(/;$/, '')
const totalV = durs.reduce((a, b) => a + b, 0) - (segs.length - 1) * T
console.log(`base video ≈ ${totalV.toFixed(1)}s`)
ff([...inputs, '-filter_complex', xf, '-map', '[vbase]', ...ENC, px('base.mp4')], 'concat base')

// ── Burn in kinetic captions (timed overlays, quick fade-in/out) ─────────────
// [t0,t1] windows on the FINAL timeline; cap index → cap_N.png.
const CAPS = [
  { i: 0, t0: 0.3, t1: 2.6 },   // DRAW YOUR LAND.
  { i: 1, t0: 2.7, t1: 5.0 },   // AI BUILDS THE ENTIRE HUNT PLAN
  { i: 2, t0: 5.3, t1: 12.6 },  // SANCTUARY · BEDDING · FOOD · STANDS · ACCESS
  { i: 3, t0: 13.0, t1: 17.0 }, // THIS ONE: 100
  { i: 4, t0: 17.1, t1: 20.8 }, // DOWNWIND OF BEDDING / PINCH POINT
  { i: 5, t0: 21.0, t1: 27.2 }, // RE-RANKED ON TONIGHT'S WIND
  { i: 6, t0: 27.5, t1: 30.6 }, // AI CAN'T PUT A PIN OFF YOUR LAND
  { i: 7, t0: 30.7, t1: 33.8 }, // TERRAIN MATH PLACES IT. EVIDENCE.
  { i: 8, t0: 34.1, t1: 37.6 }, // BRANDED REPORT TRUCK-READY
]
// Loop each caption PNG over the full duration so its frame PTS runs along the
// MAIN timeline — required for the absolute-time alpha fades to trigger.
const capInputs = CAPS.flatMap(c => ['-framerate', '30', '-loop', '1', '-t', totalV.toFixed(3), '-i', px(`cap_${c.i}.png`)])
let cfc = '[0:v]setsar=1[b0];'
let lab = 'b0'
const FD = 0.22 // fade window for kinetic pop
CAPS.forEach((c, k) => {
  const out = `b${k + 1}`
  // fade alpha in/out (kinetic punch). PTS now matches the main timeline.
  cfc += `[${k + 1}:v]format=rgba,fade=in:st=${c.t0}:d=${FD}:alpha=1,fade=out:st=${(c.t1 - FD).toFixed(2)}:d=${FD}:alpha=1[c${k}];`
  cfc += `[${lab}][c${k}]overlay=0:0:enable='between(t,${c.t0},${c.t1})'[${out}];`
  lab = out
})
cfc = cfc.replace(/;$/, '')
ff(['-i', px('base.mp4'), ...capInputs, '-filter_complex', cfc, '-map', `[${lab}]`, ...ENC, px('captioned.mp4')], 'burn captions')

// ── Mux audio → 16:9 final ───────────────────────────────────────────────────
ff(['-i', px('captioned.mp4'), '-i', px('final_audio.m4a'),
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-shortest', '-movflags', '+faststart', FINAL_169], 'mux 16:9')

// ── 1:1 square: center-crop the 16:9 captioned video to 1080x1080. Captions are
//    authored within the middle 1080-wide column so they survive the crop. ─────
ff(['-i', px('captioned.mp4'), '-i', px('final_audio.m4a'),
  '-filter_complex', '[0:v]crop=1080:1080:(in_w-1080)/2:0,setsar=1[v]',
  '-map', '[v]', '-map', '1:a', ...ENC, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-shortest', '-movflags', '+faststart', FINAL_SQ], 'mux square')

console.log(`\n✓ ${FINAL_169} (${dur(FINAL_169).toFixed(1)}s)`)
console.log(`✓ ${FINAL_SQ} (${dur(FINAL_SQ).toFixed(1)}s)`)
