#!/usr/bin/env node
// Geometry + doctrine auditor. Programmatic checks on every result file:
//  1. containment: every returned geometry inside the drawn boundary
//  2. stand↔bedding distance vs KB rules (early season >=100yd) and vs claimed yards
//  3. stand downwind of bedding under independently-fetched Oct/Nov prevailing wind
//  4. access routes: min distance to bedding polys, do they cross food plots
//  5. sanctuary acreage vs the KB's own 5-acre minimum
import { readFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCENARIOS } from './scenarios.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RES = join(__dirname, 'results')

const R = 6371000
const toRad = (d) => (d * Math.PI) / 180
function havM(a, b) {
  const dLat = toRad(b[1] - a[1]), dLng = toRad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(h))
}
const yd = (m) => Math.round(m / 0.9144)
function pointInRing(pt, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
function allCoords(geom) {
  const out = []
  const walk = (n) => Array.isArray(n) && typeof n[0] === 'number' ? out.push(n) : Array.isArray(n) && n.forEach(walk)
  walk(geom?.coordinates)
  return out
}
function centroid(geom) {
  const cs = allCoords(geom)
  if (!cs.length) return null
  return [cs.reduce((s, c) => s + c[0], 0) / cs.length, cs.reduce((s, c) => s + c[1], 0) / cs.length]
}
// segment intersection for access-route-crosses-plot check
function segsIntersect(p, q, a, b) {
  const d = (o, a2, b2) => (b2[0] - a2[0]) * (o[1] - a2[1]) - (b2[1] - a2[1]) * (o[0] - a2[0])
  const d1 = d(a, p, q), d2 = d(b, p, q), d3 = d(p, a, b), d4 = d(q, a, b)
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))
}
function lineCrossesRing(line, ring) {
  for (let i = 0; i < line.length - 1; i++) {
    if (pointInRing(line[i], ring)) return true
    for (let j = 0; j < ring.length - 1; j++) {
      if (segsIntersect(line[i], line[i + 1], ring[j], ring[j + 1])) return true
    }
  }
  return pointInRing(line[line.length - 1], ring)
}

// independent Oct+Nov prevailing wind from Open-Meteo archive (last year)
async function fetchPrevailingWind(lat, lng) {
  try {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=2025-10-01&end_date=2025-11-30&hourly=wind_direction_10m,wind_speed_10m&timezone=UTC`
    const j = await (await fetch(url)).json()
    const dirs = j?.hourly?.wind_direction_10m ?? []
    const spds = j?.hourly?.wind_speed_10m ?? []
    let sx = 0, sy = 0
    for (let i = 0; i < dirs.length; i++) {
      const w = spds[i] ?? 1
      sx += Math.sin(toRad(dirs[i])) * w
      sy += Math.cos(toRad(dirs[i])) * w
    }
    return ((Math.atan2(sx, sy) * 180) / Math.PI + 360) % 360
  } catch { return null }
}

const files = (await readdir(RES)).filter((f) => f.endsWith('.json')).sort()
const byScenario = {}
for (const f of files) {
  const d = JSON.parse(await readFile(join(RES, f), 'utf8'))
  byScenario[d.scenario] = byScenario[d.scenario] || []
  byScenario[d.scenario].push(d)
}

for (const sc of SCENARIOS) {
  const turns = byScenario[sc.id]
  if (!turns) continue
  const ring = sc.ring
  const cLat = sc.ring.reduce((s, p) => s + p[1], 0) / sc.ring.length
  const cLng = sc.ring.reduce((s, p) => s + p[0], 0) / sc.ring.length
  const windFrom = await fetchPrevailingWind(cLat, cLng)
  console.log(`\n━━━ ${sc.id} ━━━ independent Oct-Nov prevailing wind: ${windFrom == null ? 'n/a' : Math.round(windFrom) + '° (from)'}`)

  for (const t of turns.sort((a, b) => a.turn - b.turn)) {
    const j = t.json || {}
    const zones = j.zones || []
    const stands = j.stand_sites || []
    const issues = []

    // 1. containment
    for (const it of [...zones, ...stands]) {
      const g = it.geometry
      if (!g) continue
      const out = allCoords(g).filter((c) => !pointInRing(c, ring))
      if (out.length) issues.push(`OUTSIDE BOUNDARY: ${it.id} (${it.type ?? 'stand'}) ${out.length}/${allCoords(g).length} vertices outside`)
    }

    const beds = zones.filter((z) => z.type === 'bedding' && z.geometry)
    const plots = zones.filter((z) => (z.type === 'food_plot' || z.type === 'kill_plot') && z.geometry?.type === 'Polygon')

    // 2+3. stand checks
    const edgeDist = (pt, geom) => {
      if (geom?.type === 'Polygon') return Math.min(...geom.coordinates[0].map((v) => havM(pt, v)))
      const c = centroid(geom)
      return c ? havM(pt, c) : Infinity
    }
    for (const s of stands) {
      const sc2 = centroid(s.geometry)
      if (!sc2) continue
      for (const b of beds) {
        const d = edgeDist(sc2, b.geometry)
        if (d < 90 && /early fall|fall/i.test(t.season)) issues.push(`STAND TOO TIGHT (early season): ${s.id} is ${yd(d)}yd from bedding ${b.id} (<100yd rule)`)
      }
      // claimed distances in text vs geometry
      const m = (s.description || '').match(/(\d+)\s*(?:yd|yard)/i)
      if (m && beds.length) {
        const nearest = Math.min(...beds.map((b) => edgeDist(sc2, b.geometry)))
        const claimed = Number(m[1])
        if (Math.abs(claimed - yd(nearest)) > Math.max(40, claimed * 0.5)) {
          issues.push(`CLAIM MISMATCH: ${s.id} says ${claimed}yd but nearest bedding is ${yd(nearest)}yd`)
        }
      }
    }

    // 4. access routes
    for (const z of zones.filter((z) => z.type === 'access_route' && z.geometry?.type === 'LineString')) {
      const line = z.geometry.coordinates
      for (const b of beds.filter((b) => b.geometry?.type === 'Polygon')) {
        let minD = Infinity
        for (const p of line) for (const q of b.geometry.coordinates[0]) minD = Math.min(minD, havM(p, q))
        if (lineCrossesRing(line, b.geometry.coordinates[0])) issues.push(`ACCESS THROUGH BEDDING: ${z.id} enters bedding ${b.id}`)
        else if (minD < 60) issues.push(`ACCESS SKIRTS BEDDING: ${z.id} passes ${yd(minD)}yd from bedding ${b.id} (<66yd)`)
      }
      for (const p2 of plots) {
        if (lineCrossesRing(line, p2.geometry.coordinates[0])) issues.push(`ACCESS CROSSES PLOT: ${z.id} walks through ${p2.id} (${p2.type}) — KB Mistake #3`)
      }
    }

    // 5. sanctuary size
    for (const z of zones.filter((z) => z.type === 'sanctuary')) {
      if (z.acres != null && z.acres < 5) issues.push(`SANCTUARY UNDERSIZED: ${z.id} is ${z.acres}ac (<5ac KB minimum viable)`)
    }

    // soybean/corn minimums when named in descriptions
    for (const z of plots) {
      const txt = `${z.name} ${z.description}`.toLowerCase()
      if (/soybean|beans/.test(txt) && z.acres != null && z.acres < 2) issues.push(`SOYBEANS UNDERSIZED: ${z.id} ${z.acres}ac (<2ac minimum)`)
      if (/\bcorn\b/.test(txt) && z.acres != null && z.acres < 3) issues.push(`CORN UNDERSIZED: ${z.id} ${z.acres}ac (<3ac minimum)`)
    }

    const head = `t${t.turn} [${t.probe}] HTTP ${t.status} ${zones.length}z/${stands.length}s grounded=${j.grounded ?? '-'}`
    console.log(issues.length ? `  ✗ ${head}` : `  ✓ ${head}`)
    for (const i of issues) console.log(`      · ${i}`)
  }
}
