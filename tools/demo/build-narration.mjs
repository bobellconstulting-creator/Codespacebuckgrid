// Builds the NARRATED master: a deep, documentary ("Mike Rowe") ElevenLabs
// voiceover time-aligned to the cut, under a subtle procedural cinematic music
// bed that ducks beneath the voice (sidechain). Muxes under the silent captioned
// video. Output → ~/Desktop/BuckGridPro-Demo/BuckGridPro-Demo-Narrated.mp4
//
// Voice: "Bill — Wise, Mature, Balanced" (deep, weighty, documentary). Override
// with EL_VOICE_ID. Key read from ~/.openclaw/.env (ELEVENLABS_API_KEY).
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const HOME = os.homedir()
const ROOT = path.join(HOME, 'Desktop', 'BuckGridPro-Demo')
const OUT = path.join(ROOT, 'work')
const SILENT = path.join(ROOT, 'BuckGridPro-Demo.mp4')
const FINAL = path.join(ROOT, 'BuckGridPro-Demo-Narrated.mp4')

// ── EL key ───────────────────────────────────────────────────────────────────
function readKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim()
  for (const p of [path.join(HOME, '.openclaw', '.env')]) {
    try {
      const m = fs.readFileSync(p, 'utf8').match(/ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s]+)/)
      if (m) return m[1]
    } catch {}
  }
  throw new Error('ELEVENLABS_API_KEY not found')
}
const KEY = readKey()
const VOICE = process.env.EL_VOICE_ID || 'pqHfZKP75CvOlQylNhV4' // Bill
const MODEL = 'eleven_multilingual_v2'

// ── Cut geometry (must match build-video.mjs) ────────────────────────────────
const INTRO = 6.5, MAIN = 42, EXPORT = 30, OUTRO = 8, T = 0.6
const outroStart = INTRO + MAIN + EXPORT - 3 * T // ≈ 76.7
const GAP = 0.45 // min silence between lines (documentary breathing room)

// ── Narration — slow, weighty, hunter-credible. `t` is the EARLIEST start in
//    FINAL seconds (a visual anchor); placement is gap-safe so a long line just
//    pushes the next one later — lines never overlap. ──────────────────────────
const LINES = [
  { t: 1.6, s: 'Every hunter knows the feeling. New ground... and no idea where the big ones live.' },
  { t: 11.0, s: 'BuckGrid changes that. One click.' },
  { t: 14.5, s: 'Tony reads the land like a lifelong hunter. Terrain, cover, wind — in seconds.' },
  { t: 21.0, s: 'He finds the sanctuary first. The core they never leave in daylight.' },
  { t: 26.0, s: 'Then the bedding, on the south slopes.' },
  { t: 29.5, s: 'Food plots, on the timber-to-crop edge.' },
  { t: 33.0, s: 'And the stands — downwind of every bed, where the bucks have to move.' },
  { t: 40.0, s: 'Every call shows its work. Not a guess... math.' },
  { t: 44.5, s: "Tonight's Sit ranks every stand on tonight's actual wind." },
  { t: 52.0, s: 'Then take the whole plan to the truck, or the group chat. Branded.' },
  { t: 61.0, s: 'Every pin, earned by the ground itself.' },
  { t: outroStart + 0.9, s: 'BuckGrid Pro. Draw your land. Talk to Tony. Kill bigger bucks.' },
]

const ff = (args) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' })
const dur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())
const p = (f) => path.join(OUT, f)

const total = dur(SILENT)
console.log(`silent master: ${total.toFixed(1)}s · voice ${VOICE} · ${LINES.length} lines`)

// ── 1. Synthesize each line via ElevenLabs → wav ─────────────────────────────
for (let i = 0; i < LINES.length; i++) {
  const body = JSON.stringify({
    text: LINES[i].s,
    model_id: MODEL,
    voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.16, use_speaker_boost: true },
  })
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body,
  })
  if (!res.ok) throw new Error(`EL ${res.status}: ${await res.text()}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(p(`nv_${i}.mp3`), buf)
  ff(['-i', p(`nv_${i}.mp3`), '-ar', '48000', '-ac', '2', p(`nv_${i}.wav`)])
  console.log(`  nv_${i} @${LINES[i].t}s (${dur(p(`nv_${i}.wav`)).toFixed(1)}s): "${LINES[i].s.slice(0, 46)}…"`)
}

// ── Gap-safe schedule: each line starts no earlier than its anchor AND no
//    earlier than (previous line end + GAP). Long lines push the rest later;
//    overlaps are impossible. ──────────────────────────────────────────────────
const durs = LINES.map((_, i) => dur(p(`nv_${i}.wav`)))
const starts = []
let cursor = 0
LINES.forEach((l, i) => {
  const start = Math.max(l.t, cursor)
  starts.push(start)
  cursor = start + durs[i] + GAP
  console.log(`  line ${i}: ${start.toFixed(1)}–${(start + durs[i]).toFixed(1)}s`)
})
const lastEnd = starts[starts.length - 1] + durs[durs.length - 1]
if (lastEnd > total) console.log(`  ⚠ narration ends ${lastEnd.toFixed(1)}s > video ${total.toFixed(1)}s — trim a line`)
else console.log(`  ✓ narration fits: ends ${lastEnd.toFixed(1)}s of ${total.toFixed(1)}s`)

// ── 2. Mix lines onto a full-length silent bed, each delayed to its cue ───────
const voIn = ['-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=r=48000:cl=stereo']
LINES.forEach((_, i) => voIn.push('-i', p(`nv_${i}.wav`)))
let vfc = ''
starts.forEach((st, i) => { vfc += `[${i + 1}:a]adelay=${Math.round(st * 1000)}|${Math.round(st * 1000)},volume=1.9[v${i}];` })
vfc += '[0:a]' + LINES.map((_, i) => `[v${i}]`).join('') + `amix=inputs=${LINES.length + 1}:duration=longest:normalize=0,alimiter=limit=0.97[vo]`
ff([...voIn, '-filter_complex', vfc, '-map', '[vo]', '-c:a', 'pcm_s16le', p('vo_full.wav')])

// ── 3. Procedural cinematic bed — low warm pad (C-minor drone), tremolo +
//      reverb, lowpassed and quiet so it's felt, not heard. Swells at the cards.
const pad =
  'sine=frequency=65.41:sample_rate=48000[a];' +   // C2 root
  'sine=frequency=98.00:sample_rate=48000[b];' +    // G2
  'sine=frequency=130.81:sample_rate=48000[c];' +   // C3
  'sine=frequency=155.56:sample_rate=48000[d];' +   // Eb3 (minor color)
  '[a][b][c][d]amix=inputs=4:normalize=0,' +
  'tremolo=f=0.10:d=0.35,' +
  'aecho=0.8:0.9:900|1600:0.35|0.25,' +
  'lowpass=f=1300,highpass=f=45,' +
  `volume=0.075,afade=in:d=2.5,afade=out:st=${(total - 3).toFixed(2)}:d=3[bed]`
ff(['-f', 'lavfi', '-i', `sine=frequency=65.41:sample_rate=48000`,
  '-f', 'lavfi', '-i', `sine=frequency=98:sample_rate=48000`,
  '-f', 'lavfi', '-i', `sine=frequency=130.81:sample_rate=48000`,
  '-f', 'lavfi', '-i', `sine=frequency=155.56:sample_rate=48000`,
  '-filter_complex',
  '[0][1][2][3]amix=inputs=4:normalize=0,tremolo=f=0.10:d=0.35,' +
  'aecho=0.8:0.9:900|1600:0.35|0.25,lowpass=f=1300,highpass=f=45,' +
  `volume=0.075,afade=in:d=2.5,afade=out:st=${(total - 3).toFixed(2)}:d=3[bed]`,
  '-map', '[bed]', '-t', String(total), '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', p('bed.wav')])

// ── 4. Duck the bed under the voice (sidechain), then mix → final audio ───────
ff(['-i', p('vo_full.wav'), '-i', p('bed.wav'),
  '-filter_complex',
  '[1:a][0:a]sidechaincompress=threshold=0.02:ratio=6:attack=20:release=380:makeup=1[duck];' +
  '[0:a][duck]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.96[mix]',
  '-map', '[mix]', '-c:a', 'aac', '-b:a', '192k', p('final_audio.m4a')])

// ── 5. Mux under the silent video ────────────────────────────────────────────
ff(['-i', SILENT, '-i', p('final_audio.m4a'),
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
  '-shortest', '-movflags', '+faststart', FINAL])

console.log(`\n✓ narrated master: ${FINAL}  (${dur(FINAL).toFixed(1)}s)`)
