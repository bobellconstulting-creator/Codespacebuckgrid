// Generates cinematic B-roll establishing stills for the BuckGrid Pro investor
// demo using OpenAI gpt-image-1 (your OPENAI_API_KEY). Atmospheric mood shots
// only — NOT a claim about any specific real parcel. Output → ~/Desktop/BuckGridPro-Demo/broll/.
import fs from 'fs'
import os from 'os'
import path from 'path'

const HOME = os.homedir()
const OUT = path.join(HOME, 'Desktop', 'BuckGridPro-Demo', 'broll')
fs.mkdirSync(OUT, { recursive: true })

function readKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim()
  const m = fs.readFileSync(path.join(HOME, '.openclaw', '.env'), 'utf8').match(/OPENAI_API_KEY\s*=\s*["']?([^"'\s]+)/)
  if (!m) throw new Error('OPENAI_API_KEY not found')
  return m[1]
}
const KEY = readKey()

const STYLE = 'Cinematic photography, National Geographic quality, shot on ARRI Alexa, anamorphic, shallow depth of field, rich warm golden-hour color grade with cool shadow accents, atmospheric haze, photorealistic, no text, no logos, no people unless specified, 16:9 cinematic framing.'

const SHOTS = [
  { id: '01-hook-aerial', prompt: `Sweeping aerial drone view at sunrise over rolling tallgrass prairie hills with a winding river cutting through timber and crop fields, low golden light raking across the ridges, long shadows, mist in the low draws. ${STYLE}` },
  { id: '02-timber-firstlight', prompt: `Ground-level view into an oak and hardwood timber edge meeting a harvested crop field at first light, fog hanging between the trees, dew, autumn colors, soft sun flare through the trunks. ${STYLE}` },
  { id: '03-hunter-map', prompt: `A lone hunter in subdued earth-tone gear standing at the edge of fall timber at dawn, studying a worn paper property map, seen from behind and to the side, contemplative, soft overcast-to-golden light. ${STYLE}` },
  { id: '04-buck-dusk', prompt: `A mature whitetail buck with a heavy symmetrical rack stepping cautiously along a timber-to-field edge at dusk, backlit by warm low sun, tall grass, cinematic wildlife photography, sharp on the deer with creamy background. ${STYLE}` },
  { id: '05-close-landscape', prompt: `Wide cinematic landscape of a vast hunting property at last light — rolling timber, a glinting pond, distant ridgelines, dramatic dusk sky in amber and deep blue, immense sense of scale and stillness. ${STYLE}` },
]

const ENDPOINT = 'https://api.openai.com/v1/images/generations'

for (const shot of SHOTS) {
  process.stdout.write(`  ${shot.id} … `)
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1', prompt: shot.prompt, size: '1536x1024', quality: 'high', n: 1 }),
  })
  if (!res.ok) { console.log(`FAILED ${res.status}: ${(await res.text()).slice(0, 200)}`); continue }
  const json = await res.json()
  const b64 = json?.data?.[0]?.b64_json
  if (!b64) { console.log('no image in response'); continue }
  fs.writeFileSync(path.join(OUT, `${shot.id}.png`), Buffer.from(b64, 'base64'))
  console.log('✓')
}
console.log(`\n✓ B-roll → ${OUT}`)
