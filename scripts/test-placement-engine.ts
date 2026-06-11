// scripts/test-placement-engine.ts
// Synthetic verification of the placement engine's hard guarantees:
//  1. Every candidate center is inside the parcel polygon (L-shaped, NOT its bbox)
//  2. Every polygon vertex is inside the parcel
//  3. Nothing lands within the road buffer
//  4. The old bbox method WOULD have failed (NE bbox corner is outside the L)
// Run: npx tsx scripts/test-placement-engine.ts

import { generatePlacements } from '../lib/placement/engine'
import { pointInRing, distPointToPolylineM, metersPerDegree, type LngLat } from '../lib/placement/geo'
import type { SpatialContext } from '../lib/spatial'

// ── Synthetic 100-acre L-shaped parcel near Columbia MO ──────────────────────
// bbox is 0.009° x 0.009° (~1000m x 800m); the NE quadrant is NOT owned.
const W = -92.35, S = 38.95
const dx = 0.009, dy = 0.009
const boundaryRing: LngLat[] = [
  [W, S],
  [W + dx, S],
  [W + dx, S + dy * 0.5],     // east edge stops halfway up
  [W + dx * 0.5, S + dy * 0.5], // notch west
  [W + dx * 0.5, S + dy],     // notch north
  [W, S + dy],
  [W, S],
]

// A county road runs along the NORTH bbox edge — inside the bbox, OUTSIDE the
// parcel on the east half, clipping the parcel's NW corner area.
const roadLine: [number, number][] = [
  [W - 0.001, S + dy * 0.97],
  [W + dx + 0.001, S + dy * 0.97],
]

// Forest covers the west half of the parcel; farmland the east half
const forestPoly: [number, number][] = [
  [W - 0.0005, S - 0.0005],
  [W + dx * 0.5, S - 0.0005],
  [W + dx * 0.5, S + dy + 0.0005],
  [W - 0.0005, S + dy + 0.0005],
  [W - 0.0005, S - 0.0005],
]
const farmPoly: [number, number][] = [
  [W + dx * 0.5, S - 0.0005],
  [W + dx + 0.0005, S - 0.0005],
  [W + dx + 0.0005, S + dy + 0.0005],
  [W + dx * 0.5, S + dy + 0.0005],
  [W + dx * 0.5, S - 0.0005],
]

// Pond in the SE corner of the parcel
const pondPoly: [number, number][] = [
  [W + dx * 0.85, S + dy * 0.05],
  [W + dx * 0.95, S + dy * 0.05],
  [W + dx * 0.95, S + dy * 0.15],
  [W + dx * 0.85, S + dy * 0.15],
  [W + dx * 0.85, S + dy * 0.05],
]

// Elevation: a ridge running E-W across the middle with a saddle
const elevationSamples = [] as Array<{ lat: number; lng: number; elevationM: number }>
for (let r = 0; r < 16; r++) {
  for (let c = 0; c < 16; c++) {
    const lat = S + (r / 15) * dy
    const lng = W + (c / 15) * dx
    const ridge = 240 + 25 * Math.exp(-(((r / 15 - 0.5) * 4) ** 2)) // ridge at mid-lat
    const saddleDip = -10 * Math.exp(-(((c / 15 - 0.5) * 5) ** 2)) * Math.exp(-(((r / 15 - 0.5) * 4) ** 2))
    elevationSamples.push({ lat, lng, elevationM: ridge + saddleDip })
  }
}

const spatial: SpatialContext = {
  osmFeatures: [
    { kind: 'road', point: [W + dx / 2, S + dy * 0.97], bbox: [W - 0.001, S + dy * 0.96, W + dx + 0.001, S + dy * 0.98], geometry: roadLine, closed: false },
    { kind: 'forest', point: [W + dx * 0.25, S + dy / 2], bbox: [W, S, W + dx * 0.5, S + dy], geometry: forestPoly, closed: true },
    { kind: 'farmland', point: [W + dx * 0.75, S + dy / 2], bbox: [W + dx * 0.5, S, W + dx, S + dy], geometry: farmPoly, closed: true },
    { kind: 'water', point: [W + dx * 0.9, S + dy * 0.1], bbox: [W + dx * 0.85, S + dy * 0.05, W + dx * 0.95, S + dy * 0.15], geometry: pondPoly, closed: true },
  ],
  elevationSummary: 'test',
  elevationSamples,
  highGroundPoints: [],
  lowGroundPoints: [],
  fetchedAt: 0,
  windRose: {
    prevailingByMonth: { Oct: { direction: 'NW', degrees: 315, label: 'NW (315°)' }, Nov: { direction: 'NW', degrees: 320, label: 'NW (320°)' } },
    huntingSeasonPrevailing: 'NW',
    morningThermalDirection: 'downhill',
    standRules: [],
    dataSource: 'test',
  },
}

const result = generatePlacements({ boundaryRing, spatial, season: 'Early Fall' })
if (!result) {
  console.error('FAIL: engine returned null')
  process.exit(1)
}

console.log(`Engine produced ${result.candidates.length} candidates (grid ${result.gridInfo.rows}x${result.gridInfo.cols}, ${result.gridInfo.cellM}m cells, ~${result.gridInfo.acres} ac inside)\n`)

const scale = metersPerDegree(S + dy / 2)
let failures = 0
const check = (ok: boolean, label: string) => {
  if (!ok) {
    failures++
    console.error(`  ✗ ${label}`)
  }
}

for (const cd of result.candidates) {
  const center: LngLat = [cd.center.lng, cd.center.lat]
  check(pointInRing(center, boundaryRing), `${cd.id} center inside parcel`)
  // Access routes intentionally START at the road — exempt from the buffer
  if (cd.type !== 'water' && cd.type !== 'access_route') {
    const roadD = distPointToPolylineM(center, roadLine, scale)
    check(roadD > 40, `${cd.id} center ${roadD.toFixed(0)}m from road (must be >40m)`)
    check(!pointInRing(center, pondPoly), `${cd.id} center not in pond`)
  }
  if (cd.polygon) {
    const outside = cd.polygon[0].filter(pt => !pointInRing(pt as LngLat, boundaryRing))
    check(outside.length === 0, `${cd.id} polygon: ${outside.length}/${cd.polygon[0].length} vertices outside parcel`)
  }
  if (cd.line) {
    const outside = cd.line.filter(pt => !pointInRing(pt as LngLat, boundaryRing))
    check(outside.length === 0, `${cd.id} route: ${outside.length}/${cd.line.length} points outside parcel`)
  }
  console.log(`${cd.id.padEnd(4)} ${cd.type.padEnd(13)} ${cd.compass.padEnd(10)} score=${String(cd.score).padStart(3)} ${cd.acres ? `${cd.acres}ac ` : ''}— ${cd.factors.join('; ')}`)
}

// Sanity on cover logic: food plots must be on the east (farmland) half
for (const fp of result.candidates.filter(c => c.type === 'food_plot')) {
  check(fp.center.lng > W + dx * 0.45, `${fp.id} on the open/farmland half`)
}
// Bedding must be on the west (forest) half
for (const bd of result.candidates.filter(c => c.type === 'bedding')) {
  check(bd.center.lng < W + dx * 0.55, `${bd.id} in the forest half`)
}

// Demonstrate the OLD failure: legacy bbox method puts a "northeast" zone at
// 70% toward the bbox NE corner — inside the notch the user does NOT own.
const neLat = (S + dy) * 0.7 + (S + dy / 2) * 0.3
const neLng = (W + dx) * 0.7 + (W + dx / 2) * 0.3
const oldInside = pointInRing([neLng, neLat], boundaryRing)
console.log(`\nLegacy bbox 'northeast' placement lands ${oldInside ? 'INSIDE (unexpected for this shape)' : 'OUTSIDE the parcel — the exact bug the engine fixes'}`)

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECKS FAILED`)
process.exit(failures === 0 ? 0 : 1)
