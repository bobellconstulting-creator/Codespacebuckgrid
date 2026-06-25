// Tiny reusable TTS helper for the "BuckGrid Narrator" voice (Mike-Rowe style).
// Usage: node tools/demo/say.mjs "Text to speak" out.mp3
//        EL_VOICE_ID=<id> node tools/demo/say.mjs "..." out.mp3   (override voice)
// Key read from $ELEVENLABS_API_KEY or ~/.openclaw/.env.
import fs from 'fs'
import os from 'os'
import path from 'path'

const text = process.argv[2]
const out = process.argv[3] || 'out.mp3'
if (!text) { console.error('usage: node say.mjs "text" [out.mp3]'); process.exit(1) }

const KEY = process.env.ELEVENLABS_API_KEY
  || (fs.readFileSync(path.join(os.homedir(), '.openclaw', '.env'), 'utf8').match(/ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s]+)/) || [])[1]
if (!KEY) { console.error('ELEVENLABS_API_KEY not found'); process.exit(1) }

const VOICE = process.env.EL_VOICE_ID || '0MRYJXNs3YpCskZuTsOT' // BuckGrid Narrator

const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
  method: 'POST',
  headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: { stability: 0.45, similarity_boost: 0.85, style: 0.30, use_speaker_boost: true },
  }),
})
if (!res.ok) { console.error(`EL ${res.status}: ${await res.text()}`); process.exit(1) }
fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()))
console.log(`✓ wrote ${out}`)
