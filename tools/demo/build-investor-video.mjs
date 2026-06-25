// Assembles the INVESTOR cut. Paces clean product footage to the VO with slow,
// intentional motion (cinematic push-ins / pans), dark-glass cards for the
// B-roll-placeholder + roadmap + CTA beats, smooth 0.5s dissolves. Muxes the
// final_audio.m4a (VO + ducked music bed + SFX, -12 LUFS). Pure ffmpeg.
// Output → ~/Desktop/BuckGridPro-Demo/BuckGridPro-Investor.mp4
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const HOME = os.homedir()
const ROOT = path.join(HOME, 'Desktop', 'BuckGridPro-Demo')
const OUT = path.join(ROOT, 'work-inv')
const FINAL = path.join(ROOT, 'BuckGridPro-Investor.mp4')
const tl = JSON.parse(fs.readFileSync(path.join(OUT, 'timeline.json'), 'utf8'))
const FPS = tl.fps
const FOOT = path.join(OUT, 'footage.mp4')
const ff = (args, label) => { if (label) console.log('ff', label); execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' }) }
const p = (f) => path.join(OUT, f)
const R = '30' // output fps
const ENC = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', '-r', R]

// ── 0. Footage master (30fps, 1920x1080) from the captured frames ─────────────
ff(['-framerate', String(FPS), '-i', p('frames/f_%05d.jpg'),
  '-vf', 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,format=yuv420p',
  ...ENC, FOOT], 'footage master')
const footDur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', FOOT]).toString().trim())
console.log(`footage master: ${footDur.toFixed(1)}s`)

// ── Helpers ───────────────────────────────────────────────────────────────────
// Ken-Burns push-in on a STILL image. Drive zoom by output-frame index `on`
// (linear ease over `frames`), d=1 so each looped input frame → one output frame
// (avoids zoompan's frame-multiplication blowup). Center-anchored push.
function cardSeg(png, dur, file, fromZoom, toZoom) {
  const frames = Math.round(dur * 30)
  const z = `${fromZoom}+(${(toZoom - fromZoom).toFixed(5)})*on/${frames}`
  ff(['-framerate', '30', '-loop', '1', '-t', String(dur), '-i', p(png),
    '-filter_complex',
    `[0:v]scale=2400:1350,setsar=1,zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,format=yuv420p`,
    ...ENC, p(file)], `card ${file}`)
}

// Product footage sub-clip [tStart,tEnd] with a slow push-in toward focus point
// (cx,cy in 0..1). Reads from the footage master video. d=1, zoom driven by `on`.
function footSeg(tStart, tEnd, file, zoomFrom, zoomTo, cx = 0.5, cy = 0.5) {
  const dur = (tEnd - tStart).toFixed(3)
  const frames = Math.round((tEnd - tStart) * 30)
  const z = `${zoomFrom}+(${(zoomTo - zoomFrom).toFixed(5)})*on/${frames}`
  ff(['-ss', String(tStart), '-t', dur, '-i', FOOT,
    '-filter_complex',
    `[0:v]fps=30,scale=2880:1620,setsar=1,zoompan=z='${z}':x='(iw-iw/zoom)*${cx}':y='(ih-ih/zoom)*${cy}':d=1:s=1920x1080:fps=30,format=yuv420p`,
    ...ENC, p(file)], `foot ${file}`)
}

// Report pan: scroll the tall branded report up the dark base over `dur`.
function reportSeg(dur, file) {
  const img = p('export.png')
  const meta = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', img]).toString().trim().split(',')
  const iw = parseInt(meta[0]), ih = parseInt(meta[1])
  const PANW = 980
  const RH = Math.round(ih * PANW / iw)
  const travel = RH - 1080 + 100
  ff(['-f', 'lavfi', '-t', String(dur), '-i', `color=c=0x07120D:s=1920x1080:r=30`,
    '-loop', '1', '-t', String(dur), '-i', img,
    '-filter_complex',
    `[1:v]scale=${PANW}:-1[r];` +
    `[0:v][r]overlay=x=(W-w)/2:y='50-(t/${dur})*${travel}':shortest=1,setsar=1,format=yuv420p[v]`,
    '-map', '[v]', ...ENC, p(file)], `report ${file}`)
}

// ── Segment table. Each entry: a built mp4 + its intended duration. The video is
//    paced to the VO schedule (work-inv/schedule.json). Footage times reference
//    the footage master seconds. ───────────────────────────────────────────────
// Footage anchors (master seconds): boundary settled ~2.5; reveal 4–10;
// full plan + Tonight's Sit visible ~16–34; export ~36.5+.
const segs = []
// Durations include +0.5 headroom each so post-dissolve on-screen time matches
// the VO schedule (sum ≈ 123.5 → after 11×0.5s dissolves ≈ 118s).
// Raw durations sum ≈ 123.5 → after 11×0.5s dissolves ≈ 118s, matched to the VO
// schedule (each beat slightly out-lasts its spoken line).
// 1) HOOK card (placeholder B-roll) — VO 1.2–10.9
cardSeg('card_hook.png', 12.0, 'iseg_0.mp4', 1.0, 1.06); segs.push('iseg_0.mp4')
// 2) PROBLEM card (placeholder B-roll) — VO 11.3–24.4
cardSeg('card_problem.png', 14.6, 'iseg_1.mp4', 1.06, 1.0); segs.push('iseg_1.mp4')
// 3) REVEAL card — VO 24.9–33.6
cardSeg('card_reveal.png', 10.3, 'iseg_2.mp4', 1.0, 1.05); segs.push('iseg_2.mp4')
// 4) DRAW: boundary → plan begins. Master 1.0→11.5, slow push.  (VO 35.0–52.2)
footSeg(1.0, 11.5, 'iseg_3.mp4', 1.0, 1.10, 0.42, 0.45); segs.push('iseg_3.mp4')
// 5) DRAW continued: plan completes, slow dwell. Master 11.5→19.0.
footSeg(11.5, 19.0, 'iseg_4.mp4', 1.10, 1.16, 0.40, 0.45); segs.push('iseg_4.mp4')
// 6) HERO push-in on the stand cluster (left-center of map). (VO 52.7–63.4)
footSeg(16.0, 27.5, 'iseg_5.mp4', 1.10, 1.46, 0.30, 0.50); segs.push('iseg_5.mp4')
// 7) HERO2: push to the sidebar score cards (right). (VO 63.8–76.9)
footSeg(16.0, 27.0, 'iseg_6.mp4', 1.16, 1.5, 0.93, 0.26); segs.push('iseg_6.mp4')
// 8) TONIGHT'S SIT: focus lower-right sidebar rankings. (VO 77.3–84.6)
footSeg(26.5, 35.0, 'iseg_7.mp4', 1.15, 1.42, 0.93, 0.78); segs.push('iseg_7.mp4')
// 9) REPORT pan — branded report scrolls. (VO 85.1–90.5)
reportSeg(6.6, 'iseg_8.mp4'); segs.push('iseg_8.mp4')
// 10) ROADMAP card — labeled vision. (VO 90.9–105.9)
cardSeg('card_roadmap.png', 16.2, 'iseg_9.mp4', 1.0, 1.04); segs.push('iseg_9.mp4')
// 11) CTA: brief product return then CTA card. (VO 106.3–116.7)
footSeg(13.0, 18.5, 'iseg_10.mp4', 1.04, 1.13, 0.45, 0.45); segs.push('iseg_10.mp4')
cardSeg('card_cta.png', 9.7, 'iseg_11.mp4', 1.0, 1.05); segs.push('iseg_11.mp4')

// ── Crossfade-concat all segments (0.5s dissolves) ────────────────────────────
const dur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p(f)]).toString().trim())
const durs = segs.map(dur)
console.log('seg durs:', durs.map(d => d.toFixed(1)).join(', '))
const T = 0.5
const inputs = segs.flatMap(s => ['-i', p(s)])
let xf = ''
let label = '0:v'
let offset = 0
for (let i = 1; i < segs.length; i++) {
  offset += durs[i - 1] - T
  const out = i === segs.length - 1 ? 'vout' : `x${i}`
  xf += `[${label}][${i}:v]xfade=transition=fade:duration=${T}:offset=${offset.toFixed(3)}[${out}];`
  label = out
}
xf = xf.replace(/;$/, '')
const totalV = durs.reduce((a, b) => a + b, 0) - (segs.length - 1) * T
console.log(`total video ≈ ${totalV.toFixed(1)}s`)
const silent = p('investor_silent.mp4')
ff([...inputs, '-filter_complex', xf, '-map', '[vout]', ...ENC, '-movflags', '+faststart', silent], 'concat')

// ── Mux audio ─────────────────────────────────────────────────────────────────
ff(['-i', silent, '-i', p('final_audio.m4a'),
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-shortest', '-movflags', '+faststart', FINAL], 'mux')

const fd = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', FINAL]).toString().trim())
console.log(`\n✓ ${FINAL} (${fd.toFixed(1)}s)`)
