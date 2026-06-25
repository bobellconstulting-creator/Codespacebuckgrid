// Optional voiceover variant using macOS `say` (local TTS, voice "Reed"), with
// the qwen2.5:32b-written narration, each line time-aligned to its on-screen
// beat, then muxed under the silent captioned cut. Output: BuckGridPro-Demo-VO.mp4
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const ROOT = path.join(os.homedir(), 'Desktop', 'BuckGridPro-Demo')
const OUT = path.join(ROOT, 'work')
const VOICE = 'Reed'
const RATE = 178
const SILENT = path.join(ROOT, 'BuckGridPro-Demo.mp4')

// Narration lines (qwen2.5:32b) with their start time in FINAL-video seconds.
// (intro adds ~4.4s; main caption times shifted by that offset.)
const LINES = [
  { t: 5.0, s: 'Here is a real hundred-acre spread in Iowa — timber and crops.' },
  { t: 10.6, s: 'One click, and Tony reads the terrain, the cover, and the wind.' },
  { t: 14.0, s: 'He finds the sanctuary core and the bedding — where the deer live.' },
  { t: 19.8, s: 'Food plots drop on the crop edges, tight to cover.' },
  { t: 23.4, s: 'Stands land on the funnels, downwind of every bedding area.' },
  { t: 27.4, s: 'Every call shows its evidence — slope, cover, distance, wind.' },
  { t: 31.4, s: "Tonight's Sit ranks the stands on tonight's actual wind." },
  { t: 45.0, s: 'Then export the whole plan, branded, for the truck or the group chat.' },
]

const dur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())
const total = dur(SILENT)

// 1) Synthesize each line → wav
LINES.forEach((l, i) => {
  const aiff = path.join(OUT, `vo_${i}.aiff`)
  execFileSync('say', ['-v', VOICE, '-r', String(RATE), '-o', aiff, l.s])
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', aiff, '-ar', '48000', '-ac', '2', path.join(OUT, `vo_${i}.wav`)])
  console.log(`vo_${i} (${dur(path.join(OUT, `vo_${i}.wav`)).toFixed(1)}s): "${l.s.slice(0, 40)}…"`)
})

// 2) Mix all lines onto a silent bed of the full length, each delayed to its cue.
const inputs = ['-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=r=48000:cl=stereo']
LINES.forEach((_, i) => { inputs.push('-i', path.join(OUT, `vo_${i}.wav`)) })
let fc = ''
LINES.forEach((l, i) => { fc += `[${i + 1}:a]adelay=${Math.round(l.t * 1000)}|${Math.round(l.t * 1000)},volume=1.7[a${i}];` })
const amixIns = '[0:a]' + LINES.map((_, i) => `[a${i}]`).join('')
fc += `${amixIns}amix=inputs=${LINES.length + 1}:duration=longest:normalize=0,alimiter=limit=0.95[mix]`
const voTrack = path.join(OUT, 'vo_track.m4a')
execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...inputs, '-filter_complex', fc, '-map', '[mix]', '-c:a', 'aac', '-b:a', '192k', voTrack], { stdio: 'inherit' })

// 3) Mux under the silent video.
const VO = path.join(ROOT, 'BuckGridPro-Demo-VO.mp4')
execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', SILENT, '-i', voTrack, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', VO], { stdio: 'inherit' })
console.log('\n✓ voiceover variant:', VO)
