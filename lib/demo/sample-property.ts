// lib/demo/sample-property.ts
// Pre-built sample parcel for /demo — a plausible ~150-acre mixed
// timber/row-crop farm in Pike County, IL (whitetail country).
//
// This is NOT a real client property and is labeled as a demo sample in the
// UI. The boundary, cover polygons, elevation grid, and wind rose below are
// hand-authored to look like what the live GIS pipeline (OSM Overpass +
// USGS elevation + Open-Meteo wind) returns for a real parcel, so the
// deterministic placement engine (lib/placement/engine.ts) runs on it
// unmodified — no API keys, no network calls.

import type { SpatialContext, OsmFeature, ElevationSample } from '../spatial'

// ── Parcel frame ──────────────────────────────────────────────────────────────
// bbox ≈ 900 m (E–W) × 755 m (N–S); the irregular ring below encloses ~150 ac.
const W = -90.93
const S = 39.438
const E = W + 0.0105
const N = S + 0.0068

/** Closed ring, [lng, lat]. Irregular: NE 40 is the neighbor's, NW corner beveled. */
export const DEMO_BOUNDARY_RING: [number, number][] = [
  [W, S],
  [E, S],                      // south line along the gravel road
  [E, S + 0.005],              // east line up to the neighbor's 40
  [W + 0.007, S + 0.005],      // step west around the neighbor
  [W + 0.007, N],              // notch north
  [W + 0.002, N],              // north line
  [W, S + 0.0055],             // beveled NW corner
  [W, S],
]

// ── Cover & infrastructure (shaped like downsampled OSM ways) ─────────────────
const rect = (w: number, s: number, e: number, n: number): [number, number][] => [
  [w, s], [e, s], [e, n], [w, n], [w, s],
]

const forestWest = rect(W - 0.0006, S - 0.0006, W + 0.0048, N + 0.0006)
const forestNorth = rect(W + 0.0048, S + 0.0058, W + 0.0071, N + 0.0006)
const scrubPocket = rect(W + 0.0058, S + 0.0044, W + 0.0071, S + 0.0058)
const cropField = rect(W + 0.0048, S - 0.0006, E + 0.0006, S + 0.0052)
const pond = rect(W + 0.0088, S + 0.0008, W + 0.0096, S + 0.0014)
const slough = rect(W + 0.0078, S + 0.0006, W + 0.0086, S + 0.0012)
const creek: [number, number][] = [
  [W + 0.001, N],
  [W + 0.0016, S + 0.0046],
  [W + 0.0024, S + 0.0022],
  [W + 0.003, S - 0.0006],
]
const gravelRoad: [number, number][] = [
  [W - 0.001, S - 0.00045],
  [E + 0.001, S - 0.00045],
]

const bboxOf = (pts: [number, number][]): [number, number, number, number] => {
  let mw = Infinity, ms = Infinity, me = -Infinity, mn = -Infinity
  for (const [x, y] of pts) {
    if (x < mw) mw = x
    if (x > me) me = x
    if (y < ms) ms = y
    if (y > mn) mn = y
  }
  return [mw, ms, me, mn]
}
const way = (kind: OsmFeature['kind'], geometry: [number, number][], closed: boolean, name?: string): OsmFeature => {
  const box = bboxOf(geometry)
  return {
    kind,
    name,
    point: [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2],
    bbox: box,
    geometry,
    closed,
  }
}

const osmFeatures: OsmFeature[] = [
  way('road', gravelRoad, false, 'County Road 410'),
  way('forest', forestWest, true, 'west timber'),
  way('forest', forestNorth, true, 'north timber finger'),
  way('scrub', scrubPocket, true, 'CRP brush pocket'),
  way('farmland', cropField, true, 'row crop field'),
  way('water', pond, true, 'farm pond'),
  way('wetland', slough, true, 'field-corner slough'),
  way('water', creek, false, 'spring creek'),
  // farmstead across the road, SW of the parcel
  { kind: 'building', point: [W + 0.0008, S - 0.0007] },
  { kind: 'building', point: [W + 0.0013, S - 0.0008] },
]

// ── Elevation: creek bottom on the west, N–S ridge through the timber with a
//    mid-ridge saddle, flattening into the crop field east ───────────────────
const elevationSamples: ElevationSample[] = []
const GRID = 16
for (let r = 0; r < GRID; r++) {
  for (let c = 0; c < GRID; c++) {
    const lng = (W - 0.0006) + (c / (GRID - 1)) * (E - W + 0.0012)
    const lat = (S - 0.0006) + (r / (GRID - 1)) * (N - S + 0.0012)
    const u = (lng - W) / (E - W) // 0 west → 1 east
    const v = (lat - S) / (N - S) // 0 south → 1 north
    const ridge = 22 * Math.exp(-(((u - 0.36) / 0.16) ** 2))
    const creekCut = -7 * Math.exp(-(((u - 0.13) / 0.09) ** 2))
    const saddle = -8 * Math.exp(-(((v - 0.45) / 0.13) ** 2)) * Math.exp(-(((u - 0.36) / 0.1) ** 2))
    const fieldTilt = 1.5 * v
    elevationSamples.push({ lat, lng, elevationM: 208 + ridge + creekCut + saddle + fieldTilt })
  }
}

// ── Assembled spatial context (same shape the live GIS fetch produces) ───────
export const DEMO_SPATIAL: SpatialContext = {
  osmFeatures,
  elevationSummary:
    'Creek bottom on the west line rising ~70 ft to a north–south oak ridge through the timber, with a saddle mid-ridge; ground flattens into the row-crop field on the east half.',
  elevationSamples,
  highGroundPoints: [{ lat: S + 0.0012, lng: W + 0.0038, elevationM: 230 }],
  lowGroundPoints: [{ lat: S + 0.006, lng: W + 0.001, elevationM: 202 }],
  windDirection: 'NW (315°)',
  fetchedAt: 0,
  windRose: {
    prevailingByMonth: {
      Oct: { direction: 'NW', degrees: 310, label: 'NW (310°)' },
      Nov: { direction: 'NNW', degrees: 330, label: 'NNW (330°)' },
    },
    huntingSeasonPrevailing: 'NW',
    morningThermalDirection: 'downhill',
    standRules: [],
    dataSource: 'sample climatology (demo parcel)',
  },
}

export const DEMO_PROPERTY = {
  name: 'Ridgeline 150',
  locationLabel: 'Sample parcel — Pike County, IL',
  acresLabel: '~150 ac',
  season: 'Early Fall',
  boundaryRing: DEMO_BOUNDARY_RING,
  spatial: DEMO_SPATIAL,
  /** Map start view */
  center: { lat: (S + N) / 2, lng: (W + E) / 2 },
}
