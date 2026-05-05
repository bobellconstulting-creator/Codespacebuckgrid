#!/usr/bin/env node
// Tony eval harness — zero deps, uses Node built-ins + global fetch.
// Usage: `npm run eval:tony` (after `npm run dev`)

import { readFile, readdir, writeFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = join(__dirname, 'cases')
const ENDPOINT = process.env.TONY_EVAL_URL || 'http://localhost:3000/api/chat'
const COMPASS_RE = /\b(n|s|e|w|ne|nw|se|sw|north|south|east|west|northeast|northwest|southeast|southwest)\b/i

// ─── helpers ──────────────────────────────────────────────────────────────────
async function loadCases() {
  const entries = await readdir(CASES_DIR)
  const files = entries.filter(
    (f) => f.endsWith('.json') && !f.startsWith('case-template'),
  )
  const cases = []
  for (const f of files.sort()) {
    const raw = await readFile(join(CASES_DIR, f), 'utf8')
    const c = JSON.parse(raw)
    c.__file = f
    cases.push(c)
  }
  return cases
}

async function loadImageBase64(caseFile, imagePath) {
  const abs = resolve(CASES_DIR, imagePath)
  if (!existsSync(abs)) return null
  const buf = await readFile(abs)
  const ext = extname(abs).slice(1).toLowerCase() || 'png'
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
  return `data:${mime};base64,${buf.toString('base64')}`
}

function flattenCoords(geometry) {
  if (!geometry || !geometry.coordinates) return []
  const out = []
  const walk = (node) => {
    if (Array.isArray(node) && typeof node[0] === 'number') {
      out.push(node)
    } else if (Array.isArray(node)) {
      node.forEach(walk)
    }
  }
  walk(geometry.coordinates)
  return out
}

function coordInBbox([lng, lat], bbox) {
  return (
    lat <= bbox.north &&
    lat >= bbox.south &&
    lng <= bbox.east &&
    lng >= bbox.west
  )
}

// ─── scoring ──────────────────────────────────────────────────────────────────
function scoreCase(c, response, error) {
  const checks = []
  const rubric = c.rubric || {}

  if (error) {
    checks.push({ name: 'api_call', pass: false, detail: error })
    return { checks, pass: false }
  }

  const features = Array.isArray(response?.annotations) ? response.annotations : (Array.isArray(response?.features) ? response.features : [])
  const reply = typeof response?.reply === 'string' ? response.reply : ''

  if (Array.isArray(rubric.must_include_features)) {
    const present = new Set(features.map((f) => f?.type))
    const missing = rubric.must_include_features.filter((t) => !present.has(t))
    checks.push({
      name: 'must_include_features',
      pass: missing.length === 0,
      detail:
        missing.length === 0
          ? `all present: ${rubric.must_include_features.join(', ')}`
          : `missing: ${missing.join(', ')}`,
    })
  }

  if (rubric.must_cite_compass_direction) {
    const hit = COMPASS_RE.test(reply)
    checks.push({
      name: 'must_cite_compass_direction',
      pass: hit,
      detail: hit ? 'compass word found in reply' : 'no compass word in reply',
    })
  }

  if (rubric.must_be_inside_bbox && c.bbox) {
    const offenders = []
    for (const f of features) {
      const coords = flattenCoords(f?.geojson?.geometry ?? f?.geometry)
      for (const xy of coords) {
        if (!coordInBbox(xy, c.bbox)) {
          offenders.push(`${f?.type ?? '?'}@[${xy[0]},${xy[1]}]`)
          break
        }
      }
    }
    checks.push({
      name: 'must_be_inside_bbox',
      pass: offenders.length === 0,
      detail:
        offenders.length === 0
          ? `${features.length} features inside bbox`
          : `out of bbox: ${offenders.join(', ')}`,
    })
  }

  if (rubric.min_confidence_field_present) {
    const bad = features.filter(
      (f) =>
        !Number.isFinite(f?.confidence) || !Number.isFinite(f?.priority),
    )
    checks.push({
      name: 'min_confidence_field_present',
      pass: bad.length === 0 && features.length > 0,
      detail:
        features.length === 0
          ? 'no features returned'
          : bad.length === 0
            ? 'all features have confidence + priority'
            : `${bad.length} features missing confidence/priority`,
    })
  }

  if (rubric.no_water_unless_osm) {
    const water = features.filter((f) => f?.type === 'water')
    checks.push({
      name: 'no_water_unless_osm',
      pass: water.length === 0,
      detail:
        water.length === 0
          ? 'no water features placed'
          : `${water.length} water feature(s) placed`,
    })
  }

  return { checks, pass: checks.every((c) => c.pass) }
}

// ─── runner ───────────────────────────────────────────────────────────────────
async function callTony(c) {
  const image = await loadImageBase64(c.__file, c.image_path)
  if (!image) {
    return { error: `image not found at ${c.image_path} (drop a PNG in evals/tony/cases/images/)` }
  }

  const body = {
    message: c.user_message,
    image,
    bbox: c.bbox,
    features: [],
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
    }
    const json = await res.json()
    return { response: json }
  } catch (e) {
    return { error: `fetch failed: ${e?.message ?? e}` }
  }
}

function renderReport(results, startedAt, endpoint) {
  const total = results.length
  const passed = results.filter((r) => r.pass).length
  const lines = []
  lines.push(`# Tony Eval Report`)
  lines.push('')
  lines.push(`- Started: ${startedAt}`)
  lines.push(`- Endpoint: \`${endpoint}\``)
  lines.push(`- Aggregate: **${passed}/${total} cases passed** (${total === 0 ? 0 : Math.round((passed / total) * 100)}%)`)
  lines.push('')
  for (const r of results) {
    lines.push(`## ${r.pass ? 'PASS' : 'FAIL'} — ${r.id}: ${r.name}`)
    lines.push('')
    lines.push(`- File: \`${r.file}\``)
    lines.push(`- Latency: ${r.ms}ms`)
    if (r.featureCount != null) lines.push(`- Features returned: ${r.featureCount}`)
    lines.push('')
    lines.push('| Check | Result | Detail |')
    lines.push('|---|---|---|')
    for (const ch of r.checks) {
      lines.push(`| ${ch.name} | ${ch.pass ? 'PASS' : 'FAIL'} | ${ch.detail} |`)
    }
    lines.push('')
    if (r.replyPreview) {
      lines.push('<details><summary>reply preview</summary>')
      lines.push('')
      lines.push('```')
      lines.push(r.replyPreview)
      lines.push('```')
      lines.push('')
      lines.push('</details>')
      lines.push('')
    }
  }
  return lines.join('\n')
}

async function main() {
  const startedAt = new Date().toISOString()
  console.log(`[tony-eval] endpoint: ${ENDPOINT}`)
  const cases = await loadCases()
  if (cases.length === 0) {
    console.error('[tony-eval] no cases found in evals/tony/cases/')
    process.exit(1)
  }
  console.log(`[tony-eval] running ${cases.length} case(s)...`)

  const results = []
  for (const c of cases) {
    const t0 = Date.now()
    const { response, error } = await callTony(c)
    const ms = Date.now() - t0
    const { checks, pass } = scoreCase(c, response, error)
    const featureCount = Array.isArray(response?.annotations) ? response.annotations.length : (Array.isArray(response?.features) ? response.features.length : null)
    const replyPreview =
      typeof response?.reply === 'string' ? response.reply.slice(0, 600) : null
    results.push({
      id: c.id,
      name: c.name,
      file: c.__file,
      ms,
      checks,
      pass,
      featureCount,
      replyPreview,
    })
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${c.id}  (${ms}ms)`)
  }

  const md = renderReport(results, startedAt, ENDPOINT)
  const stamp = startedAt.replace(/[:.]/g, '-')
  const outPath = join(__dirname, `results-${stamp}.md`)
  await writeFile(outPath, md, 'utf8')
  console.log(`[tony-eval] report: ${outPath}`)

  const allPass = results.every((r) => r.pass)
  process.exit(allPass ? 0 : 1)
}

main().catch((e) => {
  console.error('[tony-eval] fatal:', e)
  process.exit(1)
})
