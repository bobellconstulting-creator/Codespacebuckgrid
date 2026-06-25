// Builds the INVESTOR narration track: ElevenLabs "Bill" VO, per-line loudnorm
// to -16 LUFS, gap-safe scheduling, procedural cinematic music bed, sidechain-duck
// the bed under VO, subtle SFX (card whoosh + score-reveal tone), final mix to
// -12 LUFS. Outputs the full-length stereo audio → work-inv/final_audio.m4a.
// Cached: reuses work-inv/nv_*.mp3 unless EL_REGEN=1. Voice "Bill", eleven_multilingual_v2.
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const HOME = os.homedir()
const ROOT = path.join(HOME, 'Desktop', 'BuckGridPro-Demo')
const OUT = path.join(ROOT, 'work-inv')
const LINES = JSON.parse(fs.readFileSync(process.env.VO_LINES, 'utf8'))
const TOTAL = parseFloat(process.env.TOTAL || '112')

function readKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim()
  const m = fs.readFileSync(path.join(HOME, '.openclaw', '.env'), 'utf8').match(/ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s]+)/)
  if (m) return m[1]
  throw new Error('ELEVENLABS_API_KEY not found')
}
const KEY = readKey()
// "BuckGrid Narrator" — custom gravelly Mike-Rowe-style permanent voice.
const VOICE = process.env.EL_VOICE_ID || '0MRYJXNs3YpCskZuTsOT'
const MODEL = 'eleven_multilingual_v2'
const GAP = 0.45

const ff = (args) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' })
const dur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())
const p = (f) => path.join(OUT, f)

// ── 1. Synthesize each line (cached) → loudnorm -16 LUFS wav ──────────────────
for (let i = 0; i < LINES.length; i++) {
  const id = LINES[i].id
  if (process.env.EL_REGEN || !fs.existsSync(p(`nv_${id}.mp3`))) {
    const body = JSON.stringify({
      text: LINES[i].s, model_id: MODEL,
      voice_settings: { stability: 0.45, similarity_boost: 0.85, style: 0.30, use_speaker_boost: true },
    })
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' }, body,
    })
    if (!res.ok) throw new Error(`EL ${res.status}: ${await res.text()}`)
    fs.writeFileSync(p(`nv_${id}.mp3`), Buffer.from(await res.arrayBuffer()))
    console.log(`  synthesized nv_${id}`)
  }
  ff(['-i', p(`nv_${id}.mp3`), '-ar', '48000', '-ac', '2', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', p(`nv_${id}.wav`)])
}

// ── 2. Gap-safe schedule ──────────────────────────────────────────────────────
const durs = LINES.map(l => dur(p(`nv_${l.id}.wav`)))
const starts = []
let cursor = 0
LINES.forEach((l, i) => {
  const start = Math.max(l.t, cursor)
  starts.push(start)
  cursor = start + durs[i] + GAP
  console.log(`  line ${l.id} (${l.seg}): ${start.toFixed(1)}–${(start + durs[i]).toFixed(1)}s`)
})
const lastEnd = starts[starts.length - 1] + durs[durs.length - 1]
console.log(lastEnd > TOTAL ? `  ⚠ VO ends ${lastEnd.toFixed(1)}s > ${TOTAL}s` : `  ✓ VO ends ${lastEnd.toFixed(1)}s of ${TOTAL}s`)
fs.writeFileSync(p('schedule.json'), JSON.stringify({ total: TOTAL, lines: LINES.map((l, i) => ({ ...l, start: starts[i], dur: durs[i] })) }, null, 2))

// ── 3. Mix VO lines onto a full-length silent bed ─────────────────────────────
const voIn = ['-f', 'lavfi', '-t', String(TOTAL), '-i', 'anullsrc=r=48000:cl=stereo']
LINES.forEach(l => voIn.push('-i', p(`nv_${l.id}.wav`)))
let vfc = ''
starts.forEach((st, i) => { vfc += `[${i + 1}:a]adelay=${Math.round(st * 1000)}|${Math.round(st * 1000)}[v${i}];` })
vfc += '[0:a]' + LINES.map((_, i) => `[v${i}]`).join('') + `amix=inputs=${LINES.length + 1}:duration=longest:normalize=0,alimiter=limit=0.97[vo]`
ff([...voIn, '-filter_complex', vfc, '-map', '[vo]', '-c:a', 'pcm_s16le', p('vo_full.wav')])

// ── 4. Procedural cinematic bed — warm C-minor pad, tremolo + reverb, lowpassed
//      and quiet so it's felt not heard; swells in, fades out. ─────────────────
ff(['-f', 'lavfi', '-i', 'sine=frequency=65.41:sample_rate=48000',
  '-f', 'lavfi', '-i', 'sine=frequency=98:sample_rate=48000',
  '-f', 'lavfi', '-i', 'sine=frequency=130.81:sample_rate=48000',
  '-f', 'lavfi', '-i', 'sine=frequency=155.56:sample_rate=48000',
  '-filter_complex',
  '[0][1][2][3]amix=inputs=4:normalize=0,tremolo=f=0.10:d=0.32,' +
  'aecho=0.8:0.9:900|1600:0.35|0.25,lowpass=f=1250,highpass=f=42,' +
  `volume=0.085,afade=in:d=3:st=0,afade=out:st=${(TOTAL - 4).toFixed(2)}:d=4[bed]`,
  '-map', '[bed]', '-t', String(TOTAL), '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', p('bed.wav')])

// ── 5. Subtle SFX bed: soft whooshes on card cuts + a soft tone on score reveal.
//      Synthesized locally (no API) — filtered noise bursts + a sine ping. ──────
// Card transition cue times (FINAL seconds) — soft, low, brief.
const whooshes = [10.0, 23.5, 49.5, 71.5, 90.0, 104.5]
const scoreTone = 51.5 // soft tone as the hero score reads
// Build each SFX as its own short wav, then adelay+mix.
const sfxFiles = []
whooshes.forEach((t, i) => {
  const f = p(`sfx_w${i}.wav`)
  ff(['-f', 'lavfi', '-i', 'anoisesrc=d=0.7:c=pink:r=48000:a=0.5',
    '-af', 'highpass=f=300,lowpass=f=2600,afade=in:d=0.18,afade=out:st=0.25:d=0.45,volume=0.10',
    '-ac', '2', f])
  sfxFiles.push({ f, t })
})
{
  const f = p('sfx_tone.wav')
  ff(['-f', 'lavfi', '-i', 'sine=frequency=880:duration=1.1:sample_rate=48000',
    '-f', 'lavfi', '-i', 'sine=frequency=1320:duration=1.1:sample_rate=48000',
    '-filter_complex', '[0][1]amix=inputs=2:normalize=0,lowpass=f=3200,afade=in:d=0.05,afade=out:st=0.4:d=0.7,volume=0.07[t]',
    '-map', '[t]', '-ac', '2', f])
  sfxFiles.push({ f, t: scoreTone })
}
const sfxIn = ['-f', 'lavfi', '-t', String(TOTAL), '-i', 'anullsrc=r=48000:cl=stereo']
sfxFiles.forEach(s => sfxIn.push('-i', s.f))
let sfc = ''
sfxFiles.forEach((s, i) => { sfc += `[${i + 1}:a]adelay=${Math.round(s.t * 1000)}|${Math.round(s.t * 1000)}[s${i}];` })
sfc += '[0:a]' + sfxFiles.map((_, i) => `[s${i}]`).join('') + `amix=inputs=${sfxFiles.length + 1}:duration=longest:normalize=0[sfx]`
ff([...sfxIn, '-filter_complex', sfc, '-map', '[sfx]', '-c:a', 'pcm_s16le', p('sfx_full.wav')])

// ── 6. Duck bed under VO (sidechain), add SFX, final mix → -12 LUFS ───────────
ff(['-i', p('vo_full.wav'), '-i', p('bed.wav'), '-i', p('sfx_full.wav'),
  '-filter_complex',
  '[1:a][0:a]sidechaincompress=threshold=0.02:ratio=6:attack=20:release=380:makeup=1[duck];' +
  '[0:a][duck][2:a]amix=inputs=3:duration=first:normalize=0,' +
  'loudnorm=I=-12:TP=-1.0:LRA=11,alimiter=limit=0.98[mix]',
  '-map', '[mix]', '-c:a', 'aac', '-b:a', '192k', p('final_audio.m4a')])

console.log(`\n✓ investor audio: ${p('final_audio.m4a')} (${dur(p('final_audio.m4a')).toFixed(1)}s)`)
