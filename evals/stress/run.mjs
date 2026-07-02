#!/usr/bin/env node
// Stress-test driver: runs every scenario turn against the BuckGrid /api/chat
// endpoint, threading chatHistory like the real TonyChat client does.
// Results land in ./results/<scenario>-t<n>.json
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCENARIOS, boundsOf } from './scenarios.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, 'results')
const ENDPOINT = process.env.TONY_URL || 'http://localhost:4801/api/chat'
const PACE_MS = Number(process.env.PACE_MS || 13500) // in-memory limiter: 5/min

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function callTony(scenario, turn, history) {
  const bounds = boundsOf(scenario.ring)
  const body = {
    message: turn.q,
    bounds,
    zoom: 15,
    features: scenario.features,
    season: scenario.season,
    propertyName: scenario.propertyName,
    chatHistory: history,
  }
  const t0 = Date.now()
  let status = 0, json = null, err = null
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    status = res.status
    json = await res.json().catch(() => null)
  } catch (e) {
    err = String(e)
  }
  return { status, json, err, latencyMs: Date.now() - t0 }
}

await mkdir(OUT, { recursive: true })
const only = process.argv[2] // optional scenario id filter

for (const sc of SCENARIOS) {
  if (only && sc.id !== only) continue
  const history = []
  for (let i = 0; i < sc.turns.length; i++) {
    const turn = sc.turns[i]
    process.stdout.write(`[${sc.id}] turn ${i + 1}/${sc.turns.length}: ${turn.q.slice(0, 60)}... `)
    const r = await callTony(sc, turn, [...history])
    const reply = r.json?.reply ?? r.json?.error ?? r.err ?? ''
    console.log(`HTTP ${r.status} ${r.latencyMs}ms zones=${r.json?.zones?.length ?? 0} stands=${r.json?.stand_sites?.length ?? 0} grounded=${r.json?.grounded ?? '-'}`)
    await writeFile(
      join(OUT, `${sc.id}-t${i + 1}.json`),
      JSON.stringify({ scenario: sc.id, season: sc.season, turn: i + 1, probe: turn.probe, question: turn.q, ...r }, null, 2),
    )
    history.push({ role: 'user', text: turn.q })
    if (typeof reply === 'string' && reply) history.push({ role: 'tony', text: reply })
    await sleep(PACE_MS)
  }
}
console.log('done')
