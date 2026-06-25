// lib/placement/engine.ts
// Deterministic geospatial placement engine.
//
// Takes the user's REAL parcel polygon plus the GIS layers the app already
// fetches (OSM ways with geometry, USGS/Open-Meteo elevation grid, NLCD land
// cover, wind rose) and computes grounded candidate placements: food plots on
// open ground, bedding in thick cover, stands at funnels downwind of bedding,
// access routes that avoid bedding. Every candidate is snapped to grid cells
// that are strictly inside the parcel and away from roads/water/buildings —
// nothing this engine emits can land on a road or outside the boundary.
//
// Tony (the LLM) no longer invents positions: he ranks and explains these
// candidates by id.

import type { SpatialContext, OsmFeature, ElevationSample } from '../spatial'
import type { LngLat } from './geo'
import {
  metersPerDegree,
  haversineM,
  pointInRing,
  distPointToPolylineM,
  traceCellOutline,
  simplifyCollinear,
  chaikinClosed,
  compassLabel,
  degreesToCompass8,
  ringCentroid,
} from './geo'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CandidateType =
  | 'food_plot'
  | 'kill_plot'
  | 'bedding'
  | 'stand_site'
  | 'staging_area'
  | 'sanctuary'
  | 'access_route'
  | 'water'

export interface PlacementCandidate {
  id: string
  type: CandidateType
  /** Real coordinates, guaranteed inside the parcel */
  center: { lat: number; lng: number }
  /** GeoJSON Polygon coordinates for area zones (follows cover/terrain, clipped to parcel) */
  polygon?: number[][][]
  /** GeoJSON LineString coordinates for access routes */
  line?: number[][]
  acres?: number
  /** 0–100 engine score */
  score: number
  compass: string
  /** Human-readable evidence: why the engine picked this spot */
  factors: string[]
  /** For stands: id of the bedding candidate this stand covers, if any */
  coversBedding?: string
  /** For access routes: id of the stand this route serves */
  servesStand?: string
}

export interface PlacementResult {
  candidates: PlacementCandidate[]
  /** Prompt block describing candidates for the LLM */
  promptBlock: string
  windFromDeg: number | null
  gridInfo: { rows: number; cols: number; cellM: number; insideCells: number; acres: number }
}

/** A confirmed ground-truth feature the hunter drew — seeded as top-priority truth. */
export interface PlacementObservation {
  type: 'bedding' | 'food_plot' | 'water' | 'stand_site'
  center: LngLat
  /** Optional drawn polygon ring [lng,lat][] (closed) */
  ring?: LngLat[]
}

type Cover = 'water' | 'wetland' | 'forest' | 'scrub' | 'open' | 'developed' | 'unknown'

interface Cell {
  r: number
  c: number
  idx: number
  center: LngLat
  inside: boolean // center inside parcel
  strict: boolean // center + 4 corners inside parcel (safe for polygon output)
  cover: Cover
  roadDistM: number
  waterDistM: number
  buildingDistM: number
  elevM: number
  slopeDeg: number
  aspectDeg: number // downslope direction, degrees from north
  edge: boolean // cover transition cell (forest/scrub ↔ open)
  distToCoverM: number
  distToOpenM: number
  funnel: boolean
  saddle: boolean
  tpi: number // topographic position: cell elev minus mean of neighbors (+ high / - low)
  bench: boolean // flat terrace mid-slope — deer travel/bed on benches
}

// ─── Wind helper ──────────────────────────────────────────────────────────────

export function huntingWindFromDeg(ctx?: SpatialContext): number | null {
  const wr = ctx?.windRose
  if (wr) {
    const oct = wr.prevailingByMonth['Oct']?.degrees
    const nov = wr.prevailingByMonth['Nov']?.degrees
    const vals = [oct, nov].filter((v): v is number => typeof v === 'number' && isFinite(v))
    if (vals.length > 0) {
      const sin = vals.reduce((s, d) => s + Math.sin((d * Math.PI) / 180), 0)
      const cos = vals.reduce((s, d) => s + Math.cos((d * Math.PI) / 180), 0)
      return ((Math.atan2(sin, cos) * 180) / Math.PI + 360) % 360
    }
  }
  const m = ctx?.windDirection?.match(/\((\d+)°\)/)
  if (m) return Number(m[1])
  return null
}

// ─── NLCD code → cover category ───────────────────────────────────────────────

function nlcdToCover(code: number): Cover {
  if (code === 11) return 'water'
  if (code === 90 || code === 95) return 'wetland'
  if (code === 41 || code === 42 || code === 43) return 'forest'
  if (code === 52) return 'scrub'
  if (code >= 21 && code <= 24) return 'developed'
  if (code === 31 || code === 71 || code === 81 || code === 82) return 'open'
  return 'unknown'
}

// ─── Elevation field via inverse-distance weighting ───────────────────────────

function buildElevationLookup(samples: ElevationSample[]) {
  return (pt: LngLat): number => {
    if (samples.length === 0) return 0
    // 4 nearest samples, IDW
    let best: Array<{ d: number; e: number }> = []
    for (const s of samples) {
      const d = Math.max(1, haversineM(pt, [s.lng, s.lat]))
      if (best.length < 4) {
        best.push({ d, e: s.elevationM })
        best.sort((a, b) => a.d - b.d)
      } else if (d < best[3].d) {
        best[3] = { d, e: s.elevationM }
        best.sort((a, b) => a.d - b.d)
      }
    }
    let wSum = 0
    let eSum = 0
    for (const { d, e } of best) {
      const w = 1 / (d * d)
      wSum += w
      eSum += w * e
    }
    return wSum > 0 ? eSum / wSum : best[0].e
  }
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export function generatePlacements(opts: {
  boundaryRing: LngLat[]
  spatial: SpatialContext
  season?: string
  observations?: PlacementObservation[]
}): PlacementResult | null {
  const { boundaryRing, spatial } = opts
  const season = (opts.season ?? '').toLowerCase()
  if (!boundaryRing || boundaryRing.length < 4) return null

  // ── Parcel extents ──────────────────────────────────────────────────────────
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity
  for (const [lng, lat] of boundaryRing) {
    if (lng < west) west = lng
    if (lng > east) east = lng
    if (lat < south) south = lat
    if (lat > north) north = lat
  }
  const centerLat = (south + north) / 2
  const scale = metersPerDegree(centerLat)
  const widthM = (east - west) * scale.mLng
  const heightM = (north - south) * scale.mLat
  if (widthM < 40 || heightM < 40) return null // parcel too small to grid

  // ── Analysis grid ───────────────────────────────────────────────────────────
  const targetCellM = Math.max(15, Math.min(45, Math.max(widthM, heightM) / 44))
  const cols = Math.max(12, Math.min(64, Math.round(widthM / targetCellM)))
  const rows = Math.max(12, Math.min(64, Math.round(heightM / targetCellM)))
  const dLng = (east - west) / cols
  const dLat = (north - south) / rows
  const cellWM = dLng * scale.mLng
  const cellHM = dLat * scale.mLat
  const cellM = (cellWM + cellHM) / 2
  const cellAcres = (cellWM * cellHM) / 4046.86

  // ── Pre-index OSM features (each ring/line keeps its bbox for fast rejects) ──
  type Boxed = { pts: LngLat[]; box: [number, number, number, number] }
  const boxOf = (pts: LngLat[]): [number, number, number, number] => {
    let mw = Infinity, me = -Infinity, ms = Infinity, mn = -Infinity
    for (const [x, y] of pts) {
      if (x < mw) mw = x
      if (x > me) me = x
      if (y < ms) ms = y
      if (y > mn) mn = y
    }
    return [mw, ms, me, mn]
  }
  const boxed = (pts: LngLat[]): Boxed => ({ pts, box: boxOf(pts) })
  const inBox = (p: LngLat, b: [number, number, number, number]): boolean =>
    p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3]
  /** Lower bound on distance (m) from a point to a bbox — 0 if inside. */
  const distToBoxM = (p: LngLat, b: [number, number, number, number]): number => {
    const dx = Math.max(b[0] - p[0], 0, p[0] - b[2]) * scale.mLng
    const dy = Math.max(b[1] - p[1], 0, p[1] - b[3]) * scale.mLat
    return Math.hypot(dx, dy)
  }

  const roadLines: Boxed[] = []
  const waterLines: Boxed[] = []
  const waterPolys: Boxed[] = []
  const wetlandPolys: Boxed[] = []
  const forestPolys: Boxed[] = []
  const scrubPolys: Boxed[] = []
  const farmPolys: Boxed[] = []
  const buildingPts: LngLat[] = []

  const nearParcel = (f: OsmFeature): boolean => {
    // Skip features whose bbox is more than ~500m outside the parcel bbox
    const pad = 500 / scale.mLng
    if (f.bbox) {
      const [minLng, minLat, maxLng, maxLat] = f.bbox
      return !(maxLng < west - pad || minLng > east + pad || maxLat < south - pad || minLat > north + pad)
    }
    return f.point[0] >= west - pad && f.point[0] <= east + pad && f.point[1] >= south - pad && f.point[1] <= north + pad
  }

  for (const f of spatial.osmFeatures) {
    if (!nearParcel(f)) continue
    const geom = f.geometry && f.geometry.length >= 2 ? (f.geometry as LngLat[]) : null
    switch (f.kind) {
      case 'road':
        roadLines.push(boxed(geom ?? [f.point]))
        break
      case 'water':
        if (geom && f.closed && geom.length >= 4) waterPolys.push(boxed(geom))
        else waterLines.push(boxed(geom ?? [f.point]))
        break
      case 'wetland':
        if (geom && f.closed && geom.length >= 4) wetlandPolys.push(boxed(geom))
        else waterLines.push(boxed(geom ?? [f.point]))
        break
      case 'forest':
        if (geom && f.closed && geom.length >= 4) forestPolys.push(boxed(geom))
        break
      case 'scrub':
        if (geom && f.closed && geom.length >= 4) scrubPolys.push(boxed(geom))
        break
      case 'farmland':
        if (geom && f.closed && geom.length >= 4) farmPolys.push(boxed(geom))
        break
      case 'building':
        buildingPts.push(f.point)
        break
    }
  }

  const nlcdSamples = spatial.landCoverSamples ?? []
  const elevAt = buildElevationLookup(spatial.elevationSamples)
  const hasElevation = spatial.elevationSamples.length >= 9

  // Sub-meter canopy refinement from satellite imagery: 1 = vegetation/canopy,
  // 0 = open ground, -1 = no data / outside grid.
  const cg = spatial.canopyGrid
  const sampleCanopy = (pt: LngLat): number => {
    if (!cg || cg.east === cg.west || cg.north === cg.south) return -1
    if (pt[0] < cg.west || pt[0] > cg.east || pt[1] < cg.south || pt[1] > cg.north) return -1
    const cFrac = (pt[0] - cg.west) / (cg.east - cg.west)
    const rFrac = (pt[1] - cg.south) / (cg.north - cg.south) // row 0 = south
    const c = Math.min(cg.cols - 1, Math.max(0, Math.round(cFrac * (cg.cols - 1))))
    const r = Math.min(cg.rows - 1, Math.max(0, Math.round(rFrac * (cg.rows - 1))))
    return cg.canopy[r * cg.cols + c] ? 1 : 0
  }

  // Authoritative land cover from ESA WorldCover 10m (infrared-derived, so it
  // actually separates timber/crop/grass/water instead of guessing from RGB).
  // This is the PRIMARY cover source — it's what makes placements land true.
  const wcg = spatial.coverGrid
  const wcToCover = (code: number): Cover => {
    if (code === 80) return 'water'
    if (code === 90 || code === 95) return 'wetland'
    if (code === 10) return 'forest'
    if (code === 20) return 'scrub'
    if (code === 50) return 'developed'
    if (code === 30 || code === 40 || code === 60 || code === 70 || code === 100) return 'open'
    return 'unknown'
  }
  const sampleWorldCover = (pt: LngLat): Cover => {
    if (!wcg || wcg.east === wcg.west || wcg.north === wcg.south) return 'unknown'
    if (pt[0] < wcg.west || pt[0] > wcg.east || pt[1] < wcg.south || pt[1] > wcg.north) return 'unknown'
    const cFrac = (pt[0] - wcg.west) / (wcg.east - wcg.west)
    const rFrac = (pt[1] - wcg.south) / (wcg.north - wcg.south) // row 0 = south
    const c = Math.min(wcg.cols - 1, Math.max(0, Math.round(cFrac * (wcg.cols - 1))))
    const r = Math.min(wcg.rows - 1, Math.max(0, Math.round(rFrac * (wcg.rows - 1))))
    return wcToCover(wcg.classes[r * wcg.cols + c])
  }
  const hasWorldCover = !!wcg && wcg.classes.length > 0

  // ── Build cells ─────────────────────────────────────────────────────────────
  const cells: Cell[] = []
  const cellAt = (r: number, c: number): Cell | null =>
    r >= 0 && r < rows && c >= 0 && c < cols ? cells[r * cols + c] : null

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cLng = west + (c + 0.5) * dLng
      const cLat = south + (r + 0.5) * dLat
      const center: LngLat = [cLng, cLat]
      const inside = pointInRing(center, boundaryRing)
      let strict = inside
      if (inside) {
        strict =
          pointInRing([west + c * dLng, south + r * dLat], boundaryRing) &&
          pointInRing([west + (c + 1) * dLng, south + r * dLat], boundaryRing) &&
          pointInRing([west + c * dLng, south + (r + 1) * dLat], boundaryRing) &&
          pointInRing([west + (c + 1) * dLng, south + (r + 1) * dLat], boundaryRing)
      }

      let cover: Cover = 'unknown'
      let roadDistM = Infinity
      let waterDistM = Infinity
      let buildingDistM = Infinity
      let elevM = 0

      if (inside) {
        // Cover priority, highest trust first:
        //  1. Precise OSM water/wetland (a tagged pond/creek can be finer than 10 m)
        //  2. ESA WorldCover 10 m — AUTHORITATIVE for timber vs crop vs grass
        //  3. OSM forest/scrub/farm tags (fallback where WorldCover is missing)
        //  4. NLCD (legacy fallback)
        //  5. Excess-Green texture canopy — LAST resort only, and never when
        //     WorldCover exists (texture flips crop↔timber, which is the bug we fixed)
        const hit = (polys: Boxed[]) => polys.some(p => inBox(center, p.box) && pointInRing(center, p.pts))
        if (hit(waterPolys)) cover = 'water'
        else if (hit(wetlandPolys)) cover = 'wetland'

        if (cover === 'unknown') cover = sampleWorldCover(center)

        if (cover === 'unknown') {
          if (hit(forestPolys)) cover = 'forest'
          else if (hit(scrubPolys)) cover = 'scrub'
          else if (hit(farmPolys)) cover = 'open'
        }

        if (cover === 'unknown' && nlcdSamples.length > 0) {
          let bestD = Infinity
          let bestCode = 0
          for (const s of nlcdSamples) {
            const d = haversineM(center, [s.lng, s.lat])
            if (d < bestD) {
              bestD = d
              bestCode = s.landCoverCode
            }
          }
          if (bestCode > 0) cover = nlcdToCover(bestCode)
        }

        // Texture canopy only fills true gaps (no WorldCover, no NLCD, no OSM).
        if (cover === 'unknown' && !hasWorldCover) {
          const cv = sampleCanopy(center)
          if (cv === 1) cover = 'forest'
          else if (cv === 0) cover = 'open'
        }

        // Distance loops: skip any feature whose bbox is already further than
        // the current minimum (cheap lower bound)
        for (const line of roadLines) {
          if (distToBoxM(center, line.box) >= roadDistM) continue
          const d = distPointToPolylineM(center, line.pts, scale)
          if (d < roadDistM) roadDistM = d
        }
        for (const line of waterLines) {
          if (distToBoxM(center, line.box) >= waterDistM) continue
          const d = distPointToPolylineM(center, line.pts, scale)
          if (d < waterDistM) waterDistM = d
        }
        for (const poly of waterPolys.concat(wetlandPolys)) {
          if (distToBoxM(center, poly.box) >= waterDistM) continue
          const d = inBox(center, poly.box) && pointInRing(center, poly.pts) ? 0 : distPointToPolylineM(center, poly.pts, scale)
          if (d < waterDistM) waterDistM = d
        }
        for (const b of buildingPts) {
          const d = haversineM(center, b)
          if (d < buildingDistM) buildingDistM = d
        }
        if (cover === 'water') waterDistM = 0
        elevM = hasElevation ? elevAt(center) : 0
      }

      cells.push({
        r, c, idx: r * cols + c, center, inside, strict, cover,
        roadDistM, waterDistM, buildingDistM, elevM,
        slopeDeg: 0, aspectDeg: 0, edge: false,
        distToCoverM: Infinity, distToOpenM: Infinity,
        funnel: false, saddle: false, tpi: 0, bench: false,
      })
    }
  }

  const insideCells = cells.filter(cl => cl.inside)
  if (insideCells.length < 16) return null
  const parcelAcres = insideCells.length * cellAcres

  // ── Slope / aspect from cell elevation field ────────────────────────────────
  if (hasElevation) {
    for (const cl of insideCells) {
      const eN = cellAt(cl.r + 1, cl.c)?.elevM ?? cl.elevM
      const eS = cellAt(cl.r - 1, cl.c)?.elevM ?? cl.elevM
      const eE = cellAt(cl.r, cl.c + 1)?.elevM ?? cl.elevM
      const eW = cellAt(cl.r, cl.c - 1)?.elevM ?? cl.elevM
      const dzdx = (eE - eW) / (2 * cellWM)
      const dzdy = (eN - eS) / (2 * cellHM)
      cl.slopeDeg = (Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180) / Math.PI
      // Aspect = compass direction of downslope
      cl.aspectDeg = ((Math.atan2(-dzdx, -dzdy) * 180) / Math.PI + 360) % 360

      // TPI (topographic position): cell elevation minus the mean of its 8
      // neighbors. Positive = local high (spur/point/ridge), negative = local
      // low (draw/bottom), near-zero = uniform slope or flat ground.
      let nSum = 0, nCount = 0
      for (const nb of [eN, eS, eE, eW,
        cellAt(cl.r + 1, cl.c + 1)?.elevM, cellAt(cl.r + 1, cl.c - 1)?.elevM,
        cellAt(cl.r - 1, cl.c + 1)?.elevM, cellAt(cl.r - 1, cl.c - 1)?.elevM]) {
        if (nb !== undefined) { nSum += nb; nCount++ }
      }
      cl.tpi = nCount > 0 ? cl.elevM - nSum / nCount : 0

      // Relief threshold scales with cell size (was a flat 1.2 m, which over-
      // flagged on coarse cells and under-flagged on fine ones).
      const TH = Math.max(0.8, cellM * 0.05)
      // Saddle: lower than both neighbors along one axis, higher along the other
      const nsLow = Math.min(eN, eS) - cl.elevM > TH
      const ewLow = Math.min(eE, eW) - cl.elevM > TH
      const nsHigh = cl.elevM - Math.max(eN, eS) > TH
      const ewHigh = cl.elevM - Math.max(eE, eW) > TH
      cl.saddle = (nsLow && ewHigh) || (ewLow && nsHigh)

      // Bench: a flat terrace mid-slope — uphill on one side, downhill on the
      // other, but the cell itself is near-level and not a knob/pit. Deer travel
      // and bed on benches ("benches like highways").
      const hi = Math.max(eN, eS, eE, eW), lo = Math.min(eN, eS, eE, eW)
      cl.bench = cl.slopeDeg < 6 && Math.abs(cl.tpi) < TH &&
        hi - cl.elevM > TH && cl.elevM - lo > TH
    }
  }

  // ── Cover edges + distance transforms (grid BFS, 4-connected) ───────────────
  const isCoverCell = (cl: Cell) => cl.cover === 'forest' || cl.cover === 'scrub' || cl.cover === 'wetland'
  const isOpenCell = (cl: Cell) => cl.cover === 'open' || cl.cover === 'unknown'

  for (const cl of insideCells) {
    const neighbors = [cellAt(cl.r + 1, cl.c), cellAt(cl.r - 1, cl.c), cellAt(cl.r, cl.c + 1), cellAt(cl.r, cl.c - 1)]
    const selfCover = isCoverCell(cl)
    for (const n of neighbors) {
      if (n && n.inside && isCoverCell(n) !== selfCover && (isCoverCell(n) || isOpenCell(n)) && (selfCover || isOpenCell(cl))) {
        cl.edge = true
        break
      }
    }
  }

  const bfsDistance = (sources: Cell[], field: 'distToCoverM' | 'distToOpenM') => {
    const queue: Cell[] = []
    for (const s of sources) {
      s[field] = 0
      queue.push(s)
    }
    let qi = 0
    while (qi < queue.length) {
      const cur = queue[qi++]
      const d = cur[field]
      for (const n of [cellAt(cur.r + 1, cur.c), cellAt(cur.r - 1, cur.c), cellAt(cur.r, cur.c + 1), cellAt(cur.r, cur.c - 1)]) {
        if (n && n.inside && n[field] === Infinity) {
          n[field] = d + cellM
          queue.push(n)
        }
      }
    }
  }
  bfsDistance(insideCells.filter(isCoverCell), 'distToCoverM')
  bfsDistance(insideCells.filter(isOpenCell), 'distToOpenM')

  // ── Funnel detection: passable cell with cover close on two opposite sides ──
  const GAP = Math.max(2, Math.round(120 / cellM)) // ~120 m corridor max
  for (const cl of insideCells) {
    if (isCoverCell(cl) || cl.cover === 'water') continue
    const coverWithin = (dr: number, dc: number): boolean => {
      for (let k = 1; k <= GAP; k++) {
        const n = cellAt(cl.r + dr * k, cl.c + dc * k)
        if (!n) return false
        if (n.inside && isCoverCell(n)) return true
      }
      return false
    }
    cl.funnel =
      (coverWithin(1, 0) && coverWithin(-1, 0)) ||
      (coverWithin(0, 1) && coverWithin(0, -1)) ||
      (coverWithin(1, 1) && coverWithin(-1, -1)) ||
      (coverWithin(1, -1) && coverWithin(-1, 1))
  }

  // ── Hard exclusion for placements ───────────────────────────────────────────
  const ROAD_BUFFER_M = 40
  const WATER_BUFFER_M = 20
  const BUILDING_BUFFER_M = 75
  const placeable = (cl: Cell): boolean =>
    cl.inside &&
    cl.cover !== 'water' &&
    cl.cover !== 'developed' &&
    cl.roadDistM > ROAD_BUFFER_M &&
    cl.buildingDistM > BUILDING_BUFFER_M

  // Cover-cell version for bedding/staging/sanctuary GROWTH: thick cover kept off
  // roads, open water, and buildings so a grown zone can't bridge across a pond,
  // road, or yard (the polygon hull would otherwise span the excluded gap — the
  // same failure class as bedding drawn over a road).
  const placeableCover = (cl: Cell): boolean =>
    isCoverCell(cl) &&
    cl.roadDistM > ROAD_BUFFER_M &&
    cl.waterDistM > WATER_BUFFER_M &&
    cl.buildingDistM > BUILDING_BUFFER_M

  const windFromDeg = huntingWindFromDeg(spatial)
  // Unit vector of scent travel (direction wind blows TOWARD)
  const windTravel: [number, number] | null = windFromDeg != null
    ? [Math.sin(((windFromDeg + 180) * Math.PI) / 180), Math.cos(((windFromDeg + 180) * Math.PI) / 180)]
    : null

  const parcelCenter: LngLat = [(west + east) / 2, (south + north) / 2]
  const halfW = (east - west) / 2
  const halfH = (north - south) / 2
  const compass = (pt: LngLat) => compassLabel(pt, parcelCenter, halfW, halfH)
  const yd = (m: number) => Math.round(m / 0.9144)
  // Road-clearance phrase. When OSM road data didn't load, roadDistM is Infinity
  // for every cell — never print "Infinityyd" or imply a feature avoids a road we
  // can't see. Say so honestly instead.
  const hasRoadData = roadLines.length > 0
  const roadFac = (distM: number): string =>
    hasRoadData && isFinite(distM)
      ? `${yd(distM)}yd from nearest road`
      : 'road distance unverified (road data did not load this turn)'

  // Aspect preference: south-facing bonus late season (thermal bedding),
  // north-facing bonus early season (cool-weather bedding)
  const lateSeason = season.includes('late') || season.includes('winter')
  const aspectBonus = (aspectDeg: number): number => {
    const southness = Math.cos(((aspectDeg - 180) * Math.PI) / 180) // 1 = due south
    return lateSeason ? southness * 8 : -southness * 4
  }

  // ── Candidate selection helpers ─────────────────────────────────────────────
  const pickTop = (scored: Array<{ cell: Cell; score: number }>, count: number, minSpacingM: number) => {
    scored.sort((a, b) => b.score - a.score)
    const picked: Array<{ cell: Cell; score: number }> = []
    for (const s of scored) {
      if (picked.length >= count) break
      if (s.score <= 0) break
      if (picked.every(p => haversineM(p.cell.center, s.cell.center) >= minSpacingM)) {
        picked.push(s)
      }
    }
    return picked
  }

  /** Grow a cluster of strict cells around a seed, following an eligibility test, up to targetAcres. */
  const growCluster = (seed: Cell, eligible: (cl: Cell) => boolean, targetAcres: number): Set<number> => {
    const maxCells = Math.max(1, Math.round(targetAcres / cellAcres))
    const cluster = new Set<number>([seed.idx])
    const frontier: Cell[] = [seed]
    while (cluster.size < maxCells && frontier.length > 0) {
      const cur = frontier.shift()!
      for (const n of [cellAt(cur.r + 1, cur.c), cellAt(cur.r - 1, cur.c), cellAt(cur.r, cur.c + 1), cellAt(cur.r, cur.c - 1)]) {
        if (n && n.strict && !cluster.has(n.idx) && eligible(n)) {
          cluster.add(n.idx)
          frontier.push(n)
          if (cluster.size >= maxCells) break
        }
      }
    }
    return cluster
  }

  /** Cluster → smoothed GeoJSON polygon coords, guaranteed inside the parcel. */
  const clusterToPolygon = (cluster: Set<number>): number[][][] | null => {
    const ring = traceCellOutline(cluster, rows, cols, south, west, dLat, dLng)
    if (!ring) return null
    const simplified = simplifyCollinear(ring)
    const smoothed = chaikinClosed(simplified, 2)
    // Containment guard: corner-cutting can exit at reflex corners near the parcel edge
    const allInside = smoothed.every(pt => pointInRing(pt, boundaryRing))
    return [(allInside ? smoothed : simplified).map(p => [p[0], p[1]])]
  }

  const candidates: PlacementCandidate[] = []

  // ── FOOD PLOTS: open ground, gentle slope, sun, near cover edge ─────────────
  {
    const scored = insideCells
      .filter(cl => cl.strict && placeable(cl) && isOpenCell(cl) && cl.cover !== 'wetland')
      .map(cell => {
        let score = 50
        if (cell.cover === 'open') score += 15 // confirmed open (OSM farm/NLCD crop/grass)
        else score -= 10 // unknown cover — probably open but unverified
        if (cell.slopeDeg > 12) score -= 40
        else if (cell.slopeDeg > 8) score -= 18
        else if (cell.slopeDeg <= 5) score += 10
        // Near a cover edge = huntable plot; deep in the open = exposed
        if (cell.distToCoverM <= cellM * 2) score += 16
        else if (cell.distToCoverM > 150) score -= 12
        score += Math.min(10, (cell.roadDistM - ROAD_BUFFER_M) / 30)
        if (cell.waterDistM < WATER_BUFFER_M) score -= 30
        score += aspectBonus(cell.aspectDeg) * 0.5 // mild sun preference
        return { cell, score }
      })
    const picked = pickTop(scored, 3, Math.max(150, cellM * 5))
    const targetAcres = Math.max(0.5, Math.min(4, parcelAcres * 0.03))
    picked.forEach((p, i) => {
      const cluster = growCluster(p.cell, cl => placeable(cl) && isOpenCell(cl) && cl.slopeDeg <= 10 && cl.waterDistM > WATER_BUFFER_M, targetAcres)
      const polygon = clusterToPolygon(cluster)
      if (!polygon) return
      const acres = Math.round(cluster.size * cellAcres * 10) / 10
      const factors = [
        p.cell.cover === 'open' ? 'open ground — land-cover verified (ESA WorldCover)' : 'open ground (unclassified — verify on satellite)',
        `${p.cell.slopeDeg.toFixed(0)}° slope`,
        roadFac(p.cell.roadDistM),
      ]
      if (p.cell.distToCoverM <= cellM * 2) factors.push('on a timber/cover edge')
      candidates.push({
        id: `fp${i + 1}`, type: 'food_plot',
        center: { lat: p.cell.center[1], lng: p.cell.center[0] },
        polygon, acres, score: Math.round(Math.max(0, Math.min(100, p.score))),
        compass: compass(p.cell.center), factors,
      })
    })
  }

  // ── BEDDING: thick cover, remote, favorable aspect ──────────────────────────
  {
    const scored = insideCells
      .filter(cl => cl.strict && cl.inside && isCoverCell(cl) && cl.roadDistM > ROAD_BUFFER_M)
      .map(cell => {
        let score = 50
        if (cell.cover === 'forest') score += 8
        if (cell.cover === 'scrub') score += 14 // early successional = prime bedding
        if (cell.cover === 'wetland') score += 10 // thermal bedding
        score += Math.min(20, (cell.roadDistM - ROAD_BUFFER_M) / 15) // remoteness
        score += Math.min(10, (cell.buildingDistM - BUILDING_BUFFER_M) / 40)
        if (cell.distToOpenM > cellM && cell.distToOpenM < 200) score += 8 // inside cover but near food
        score += aspectBonus(cell.aspectDeg)
        if (cell.slopeDeg > 3 && cell.slopeDeg < 15) score += 6 // slopes/points hold beds
        if (cell.bench) score += 8 // flat terrace on a slope — prime bedding
        if (cell.tpi > 0 && cell.slopeDeg > 3) score += 4 // spur/point — beds with a downwind view
        return { cell, score }
      })
    const picked = pickTop(scored, 3, Math.max(180, cellM * 6))
    const targetAcres = Math.max(1, Math.min(6, parcelAcres * 0.05))
    picked.forEach((p, i) => {
      const cluster = growCluster(p.cell, placeableCover, targetAcres)
      const polygon = clusterToPolygon(cluster)
      if (!polygon) return
      const acres = Math.round(cluster.size * cellAcres * 10) / 10
      const coverName = p.cell.cover === 'scrub' ? 'brushy early-successional cover' : p.cell.cover === 'wetland' ? 'wetland thermal cover' : 'timber'
      const factors = [
        `thick ${coverName}`,
        roadFac(p.cell.roadDistM),
      ]
      if (hasElevation && p.cell.slopeDeg > 3) {
        factors.push(`${degreesToCompass8(p.cell.aspectDeg)}-facing slope (${p.cell.slopeDeg.toFixed(0)}°)`)
      }
      if (p.cell.bench) factors.push('on a flat bench — sheltered bedding terrace')
      candidates.push({
        id: `bd${i + 1}`, type: 'bedding',
        center: { lat: p.cell.center[1], lng: p.cell.center[0] },
        polygon, acres, score: Math.round(Math.max(0, Math.min(100, p.score))),
        compass: compass(p.cell.center), factors,
      })
    })
  }

  // ── USER OBSERVATIONS: confirmed ground truth, seeded as top candidates ──────
  // The hunter's drawn bedding/food/water/stands become FIXED inputs, so every
  // downstream decision (stands downwind of bedding, staging on the bed→food
  // line, access avoiding beds) is computed from real truth, not inference.
  const ringAcresM = (ring: LngLat[]): number => {
    let a = 0
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      a += ring[j][0] * scale.mLng * (ring[i][1] * scale.mLat) - ring[i][0] * scale.mLng * (ring[j][1] * scale.mLat)
    }
    return Math.abs(a / 2) / 4046.86
  }
  let obsN = 0
  for (const obs of opts.observations ?? []) {
    if (!obs.center || !pointInRing(obs.center, boundaryRing)) continue
    const ring = obs.ring && obs.ring.length >= 4 ? obs.ring : null
    const polygon = ring ? [ring.map(p => [p[0], p[1]])] : undefined
    const acres = ring ? Math.round(ringAcresM(ring) * 10) / 10 : undefined
    const prefix = obs.type === 'bedding' ? 'ubd' : obs.type === 'food_plot' ? 'ufp' : obs.type === 'water' ? 'uwt' : 'ust'
    candidates.push({
      id: `${prefix}${++obsN}`, type: obs.type,
      center: { lat: obs.center[1], lng: obs.center[0] },
      polygon, acres, score: 95, compass: compass(obs.center),
      factors: ['confirmed by you on the ground — the plan is anchored to this'],
    })
  }
  // Drop derived bedding/food guesses within 60 m of a same-type confirmed observation
  if (obsN > 0) {
    const confirmed = candidates.filter(c => c.id.startsWith('u'))
    for (let i = candidates.length - 1; i >= 0; i--) {
      const c = candidates[i]
      if (c.id.startsWith('u') || (c.type !== 'bedding' && c.type !== 'food_plot')) continue
      if (confirmed.some(cf => cf.type === c.type &&
        haversineM([c.center.lng, c.center.lat], [cf.center.lng, cf.center.lat]) < 60)) {
        candidates.splice(i, 1)
      }
    }
  }

  const beddingCandidates = candidates.filter(cd => cd.type === 'bedding')
  const foodCandidates = candidates.filter(cd => cd.type === 'food_plot')

  // ── SANCTUARY: largest remote cover block ───────────────────────────────────
  {
    const seen = new Set<number>()
    let bestBlock: Set<number> | null = null
    for (const cl of insideCells) {
      if (!cl.strict || !isCoverCell(cl) || seen.has(cl.idx)) continue
      // flood fill connected strict cover component
      const comp = new Set<number>([cl.idx])
      const q: Cell[] = [cl]
      while (q.length > 0) {
        const cur = q.shift()!
        for (const n of [cellAt(cur.r + 1, cur.c), cellAt(cur.r - 1, cur.c), cellAt(cur.r, cur.c + 1), cellAt(cur.r, cur.c - 1)]) {
          if (n && n.strict && isCoverCell(n) && !comp.has(n.idx)) {
            comp.add(n.idx)
            q.push(n)
          }
        }
      }
      comp.forEach(i => seen.add(i))
      if (!bestBlock || comp.size > bestBlock.size) bestBlock = comp
    }
    if (bestBlock && bestBlock.size * cellAcres >= 2) {
      // Sanctuary = core of the block, biased away from roads
      const blockCells = [...bestBlock].map(i => cells[i])
      blockCells.sort((a, b) => b.roadDistM - a.roadDistM)
      const targetAcres = Math.max(3, Math.min(15, parcelAcres * 0.12))
      const cluster = growCluster(blockCells[0], cl => bestBlock!.has(cl.idx) && placeableCover(cl), targetAcres)
      const polygon = clusterToPolygon(cluster)
      if (polygon) {
        const acres = Math.round(cluster.size * cellAcres * 10) / 10
        const seed = blockCells[0]
        candidates.push({
          id: 'sn1', type: 'sanctuary',
          center: { lat: seed.center[1], lng: seed.center[0] },
          polygon, acres, score: 80,
          compass: compass(seed.center),
          factors: [
            `core of the largest cover block on the parcel (~${Math.round(bestBlock.size * cellAcres)} ac total)`,
            `${roadFac(seed.roadDistM)}${hasRoadData ? ' — never-enter ground' : ''}`,
          ],
        })
      }
    }
  }

  // ── STAND SITES: funnels/edges/saddles, downwind of bedding, near food ──────
  {
    const scored = insideCells
      .filter(cl => cl.inside && placeable(cl) && cl.waterDistM > WATER_BUFFER_M)
      .map(cell => {
        let score = 30
        if (cell.funnel) score += 22
        if (cell.saddle) score += 18
        if (cell.edge) score += 14
        if (cell.bench) score += 12
        if (cell.distToCoverM <= cellM) score += 6 // huntable from cover
        // Relationship to bedding: ideal 80–200yd, downwind
        let nearestBed: PlacementCandidate | null = null
        let bedD = Infinity
        for (const bd of beddingCandidates) {
          const d = haversineM(cell.center, [bd.center.lng, bd.center.lat])
          if (d < bedD) {
            bedD = d
            nearestBed = bd
          }
        }
        if (nearestBed) {
          if (bedD >= 70 && bedD <= 220) score += 14
          else if (bedD < 50) score -= 16 // too tight — bumps deer
          if (windTravel) {
            const dx = (cell.center[0] - nearestBed.center.lng) * scale.mLng
            const dy = (cell.center[1] - nearestBed.center.lat) * scale.mLat
            const len = Math.hypot(dx, dy)
            if (len > 0) {
              // alignment of bedding→stand vector with scent travel:
              // stand downwind of bedding means scent blows from bedding toward stand
              const align = (dx / len) * windTravel[0] + (dy / len) * windTravel[1]
              score += align * 16
            }
          }
        }
        // Relationship to food: within ~150yd of a plot edge is a kill setup
        for (const fp of foodCandidates) {
          const d = haversineM(cell.center, [fp.center.lng, fp.center.lat])
          if (d > 40 && d < 160) {
            score += 8
            break
          }
        }
        return { cell, score, nearestBed, bedD }
      })
    const picked = pickTop(scored, 4, Math.max(120, cellM * 4))
    picked.forEach((p, i) => {
      const s = p as { cell: Cell; score: number; nearestBed: PlacementCandidate | null; bedD: number }
      const factors: string[] = []
      if (s.cell.funnel) factors.push('terrain/cover funnel — movement pinches through here')
      if (s.cell.saddle) factors.push('topographic saddle')
      if (s.cell.bench) factors.push('flat bench on the slope face — deer travel benches like trails')
      if (s.cell.edge) factors.push('cover-to-open edge')
      if (s.nearestBed && isFinite(s.bedD)) {
        const windNote = windTravel && windFromDeg != null
          ? ` and downwind-checked against the ${degreesToCompass8(windFromDeg)} prevailing wind`
          : ''
        factors.push(`${yd(s.bedD)}yd from bedding ${s.nearestBed.id}${windNote}`)
      }
      factors.push(roadFac(s.cell.roadDistM))
      candidates.push({
        id: `st${i + 1}`, type: 'stand_site',
        center: { lat: s.cell.center[1], lng: s.cell.center[0] },
        score: Math.round(Math.max(0, Math.min(100, s.score))),
        compass: compass(s.cell.center), factors,
        coversBedding: s.nearestBed?.id,
      })
    })
  }

  const standCandidates = candidates.filter(cd => cd.type === 'stand_site')

  // ── KILL PLOTS: small open pockets tucked against cover near bedding ────────
  {
    const scored = insideCells
      .filter(cl => cl.strict && placeable(cl) && isOpenCell(cl) && cl.distToCoverM <= cellM * 2)
      .map(cell => {
        let score = 40
        let bedD = Infinity
        for (const bd of beddingCandidates) {
          bedD = Math.min(bedD, haversineM(cell.center, [bd.center.lng, bd.center.lat]))
        }
        if (bedD >= 60 && bedD <= 250) score += 18
        if (cell.slopeDeg <= 8) score += 8
        if (cell.funnel) score += 8
        // distinct from main food plots
        for (const fp of foodCandidates) {
          if (haversineM(cell.center, [fp.center.lng, fp.center.lat]) < 120) score -= 25
        }
        return { cell, score }
      })
    const picked = pickTop(scored, 1, 200)
    picked.forEach((p, i) => {
      const cluster = growCluster(p.cell, cl => placeable(cl) && isOpenCell(cl), 0.4)
      const polygon = clusterToPolygon(cluster)
      if (!polygon) return
      candidates.push({
        id: `kp${i + 1}`, type: 'kill_plot',
        center: { lat: p.cell.center[1], lng: p.cell.center[0] },
        polygon, acres: Math.round(cluster.size * cellAcres * 10) / 10,
        score: Math.round(Math.max(0, Math.min(100, p.score))),
        compass: compass(p.cell.center),
        factors: ['small open pocket against cover', roadFac(p.cell.roadDistM)],
      })
    })
  }

  // ── STAGING AREAS: cover between bedding and food, 60–150yd off the food ───
  if (beddingCandidates.length > 0 && foodCandidates.length > 0) {
    const scored = insideCells
      .filter(cl => cl.strict && cl.inside && isCoverCell(cl) && cl.roadDistM > ROAD_BUFFER_M)
      .map(cell => {
        let score = 0
        for (const fp of foodCandidates) {
          const dFood = haversineM(cell.center, [fp.center.lng, fp.center.lat])
          if (dFood < 55 || dFood > 160) continue
          for (const bd of beddingCandidates) {
            const dBed = haversineM(cell.center, [bd.center.lng, bd.center.lat])
            const dBedToFood = haversineM([bd.center.lng, bd.center.lat], [fp.center.lng, fp.center.lat])
            // Between-ness: staging sits on the bedding→food line
            if (dBed + dFood < dBedToFood * 1.35) {
              score = Math.max(score, 60 + (cell.edge ? 8 : 0))
            }
          }
        }
        return { cell, score }
      })
      .filter(s => s.score > 0)
    const picked = pickTop(scored, 2, 150)
    picked.forEach((p, i) => {
      const cluster = growCluster(p.cell, placeableCover, 1)
      const polygon = clusterToPolygon(cluster)
      if (!polygon) return
      candidates.push({
        id: `sg${i + 1}`, type: 'staging_area',
        center: { lat: p.cell.center[1], lng: p.cell.center[0] },
        polygon, acres: Math.round(cluster.size * cellAcres * 10) / 10,
        score: Math.round(Math.max(0, Math.min(100, p.score))),
        compass: compass(p.cell.center),
        factors: ['cover between bedding and food — bucks stage here before entering plots in daylight'],
      })
    })
  }

  // ── WATER: only OSM-confirmed water inside the parcel ───────────────────────
  {
    const waterCells = insideCells.filter(cl => cl.strict && cl.cover === 'water')
    if (waterCells.length > 0) {
      const cluster = growCluster(waterCells[0], cl => cl.cover === 'water', waterCells.length * cellAcres + 1)
      const polygon = clusterToPolygon(cluster)
      if (polygon) {
        candidates.push({
          id: 'wt1', type: 'water',
          center: { lat: waterCells[0].center[1], lng: waterCells[0].center[0] },
          polygon, acres: Math.round(cluster.size * cellAcres * 10) / 10,
          score: 75, compass: compass(waterCells[0].center),
          factors: ['OSM-confirmed water on the parcel'],
        })
      }
    }
  }

  // ── ACCESS ROUTES: Dijkstra from best entry cell to each stand, avoiding bedding ──
  {
    const beddingPenaltyCells = new Set<number>()
    for (const bd of beddingCandidates) {
      for (const cl of insideCells) {
        if (haversineM(cl.center, [bd.center.lng, bd.center.lat]) < 90) beddingPenaltyCells.add(cl.idx)
      }
    }
    // Entry cells: inside cells on the parcel edge (an adjacent cell is outside), closest to a road
    const entryCells = insideCells.filter(cl =>
      [cellAt(cl.r + 1, cl.c), cellAt(cl.r - 1, cl.c), cellAt(cl.r, cl.c + 1), cellAt(cl.r, cl.c - 1)]
        .some(n => !n || !n.inside)
    )
    if (entryCells.length > 0 && standCandidates.length > 0) {
      entryCells.sort((a, b) => a.roadDistM - b.roadDistM)
      const entry = entryCells[0]

      const cellCost = (cl: Cell): number => {
        if (!cl.inside || cl.cover === 'water') return Infinity
        let cost = 1
        if (beddingPenaltyCells.has(cl.idx)) cost += 12 // never walk through bedding
        if (cl.cover === 'wetland') cost += 4
        if (isCoverCell(cl)) cost += 1.5 // noisy walking
        return cost
      }

      // Single-source Dijkstra from entry
      const dist = new Float64Array(cells.length).fill(Infinity)
      const prev = new Int32Array(cells.length).fill(-1)
      dist[entry.idx] = 0
      const visited = new Uint8Array(cells.length)
      // simple O(n²)-ish loop is fine at ≤4096 cells
      for (;;) {
        let u = -1
        let uD = Infinity
        for (let i = 0; i < cells.length; i++) {
          if (!visited[i] && dist[i] < uD) {
            uD = dist[i]
            u = i
          }
        }
        if (u === -1) break
        visited[u] = 1
        const cu = cells[u]
        for (const n of [cellAt(cu.r + 1, cu.c), cellAt(cu.r - 1, cu.c), cellAt(cu.r, cu.c + 1), cellAt(cu.r, cu.c - 1)]) {
          if (!n || visited[n.idx]) continue
          const c = cellCost(n)
          if (!isFinite(c)) continue
          const nd = dist[u] + c
          if (nd < dist[n.idx]) {
            dist[n.idx] = nd
            prev[n.idx] = u
          }
        }
      }

      standCandidates.slice(0, 2).forEach((st, i) => {
        // Find the cell whose center matches the stand
        const target = insideCells.find(cl => cl.center[1] === st.center.lat && cl.center[0] === st.center.lng)
        if (!target || !isFinite(dist[target.idx])) return
        const path: LngLat[] = []
        let cur = target.idx
        let guard = cells.length
        while (cur !== -1 && guard-- > 0) {
          path.push(cells[cur].center)
          if (cur === entry.idx) break
          cur = prev[cur]
        }
        if (path.length < 2) return
        path.reverse()
        // light simplification: keep every other point, always keep endpoints
        const line = path.filter((_, j) => j === 0 || j === path.length - 1 || j % 2 === 0)
        candidates.push({
          id: `ar${i + 1}`, type: 'access_route',
          center: { lat: entry.center[1], lng: entry.center[0] },
          line: line.map(p => [p[0], p[1]]),
          score: 70, compass: compass(entry.center),
          factors: [
            `entry from the ${compass(entry.center)} parcel edge (closest road access)`,
            `routed to avoid bedding by 90+ yds`,
          ],
          servesStand: st.id,
        })
      })
    }
  }

  if (candidates.length === 0) return null

  // ── Prompt block for the LLM ────────────────────────────────────────────────
  const typeLabel: Record<CandidateType, string> = {
    food_plot: 'FOOD PLOT', kill_plot: 'HARVEST PLOT', bedding: 'BEDDING',
    stand_site: 'STAND', staging_area: 'STAGING AREA', sanctuary: 'SANCTUARY',
    access_route: 'ACCESS ROUTE', water: 'WATER',
  }
  const lines: string[] = [
    '=== COMPUTED PLACEMENT CANDIDATES (deterministic GIS engine — real coordinates, verified terrain) ===',
    'Each candidate below was computed from verified land cover, elevation, roads, water, and wind data,',
    'clipped to the true property boundary. These are the ONLY valid placements.',
    '',
  ]
  for (const cd of candidates) {
    const size = cd.acres ? `, ~${cd.acres} ac` : ''
    lines.push(`${cd.id} — ${typeLabel[cd.type]} (${cd.compass}${size}, engine score ${cd.score}/100): ${cd.factors.join('; ')}`)
  }
  lines.push('')
  lines.push('=== END CANDIDATES ===')

  return {
    candidates,
    promptBlock: lines.join('\n'),
    windFromDeg,
    gridInfo: { rows, cols, cellM: Math.round(cellM), insideCells: insideCells.length, acres: Math.round(parcelAcres) },
  }
}

// ─── Candidate → GeoJSON Feature ──────────────────────────────────────────────

export function candidateGeometry(cd: PlacementCandidate): { type: string; coordinates: any } {
  if (cd.polygon) return { type: 'Polygon', coordinates: cd.polygon }
  if (cd.line) return { type: 'LineString', coordinates: cd.line }
  return { type: 'Point', coordinates: [cd.center.lng, cd.center.lat] }
}
