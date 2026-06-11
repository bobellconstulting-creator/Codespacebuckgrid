// lib/placement/geo.ts
// Pure geometry helpers for the deterministic placement engine.
// All coordinates are GeoJSON order: [lng, lat]. No external dependencies.

export type LngLat = [number, number]

/** Approximate meters per degree at a given latitude (good to <0.5% for parcel-scale work). */
export function metersPerDegree(lat: number): { mLat: number; mLng: number } {
  return {
    mLat: 111_320,
    mLng: 111_320 * Math.cos((lat * Math.PI) / 180),
  }
}

export function haversineM(a: LngLat, b: LngLat): number {
  const R = 6371000
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLng = ((b[0] - a[0]) * Math.PI) / 180
  const lat1 = (a[1] * Math.PI) / 180
  const lat2 = (b[1] * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(h))
}

/** Ray-casting point-in-ring test. Ring may be open or closed. */
export function pointInRing(pt: LngLat, ring: LngLat[]): boolean {
  const [x, y] = pt
  let inside = false
  const n = ring.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/** Planar distance in meters from a point to a segment, using local meter scaling. */
export function distPointToSegmentM(
  p: LngLat,
  a: LngLat,
  b: LngLat,
  scale: { mLat: number; mLng: number }
): number {
  const px = (p[0] - a[0]) * scale.mLng
  const py = (p[1] - a[1]) * scale.mLat
  const bx = (b[0] - a[0]) * scale.mLng
  const by = (b[1] - a[1]) * scale.mLat
  const lenSq = bx * bx + by * by
  let t = lenSq > 0 ? (px * bx + py * by) / lenSq : 0
  t = Math.max(0, Math.min(1, t))
  const dx = px - t * bx
  const dy = py - t * by
  return Math.sqrt(dx * dx + dy * dy)
}

/** Distance in meters from a point to a polyline (sequence of segments). */
export function distPointToPolylineM(
  p: LngLat,
  line: LngLat[],
  scale: { mLat: number; mLng: number }
): number {
  if (line.length === 0) return Infinity
  if (line.length === 1) return haversineM(p, line[0])
  let min = Infinity
  for (let i = 0; i < line.length - 1; i++) {
    const d = distPointToSegmentM(p, line[i], line[i + 1], scale)
    if (d < min) min = d
  }
  return min
}

export function ringCentroid(ring: LngLat[]): LngLat {
  let sx = 0
  let sy = 0
  const n = ring.length
  for (const [x, y] of ring) {
    sx += x
    sy += y
  }
  return [sx / n, sy / n]
}

/** Signed area of a ring in degree² (sign indicates winding). */
export function ringSignedArea(ring: LngLat[]): number {
  let area = 0
  const n = ring.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1])
  }
  return area / 2
}

/**
 * Trace the outer outline of a set of grid cells as a closed ring of cell-corner
 * coordinates. Cells are identified by row*cols+col. Corner (r, c) maps to
 * [west + c*dLng, south + r*dLat]; cell (r, c) spans corners (r,c)..(r+1,c+1).
 * Returns the largest ring (closed, first === last), or null.
 */
export function traceCellOutline(
  cells: Set<number>,
  rows: number,
  cols: number,
  south: number,
  west: number,
  dLat: number,
  dLng: number
): LngLat[] | null {
  if (cells.size === 0) return null

  // Directed boundary edges keyed by start corner, oriented with interior on the left.
  // Corner key: r * (cols + 1) + c  (corner grid is (rows+1) x (cols+1))
  const cw = cols + 1
  const edges = new Map<number, number[]>() // startCorner -> array of endCorners
  const addEdge = (from: number, to: number) => {
    const list = edges.get(from)
    if (list) list.push(to)
    else edges.set(from, [to])
  }

  for (const idx of cells) {
    const r = Math.floor(idx / cols)
    const c = idx % cols
    const sw = r * cw + c
    const se = r * cw + (c + 1)
    const nw = (r + 1) * cw + c
    const ne = (r + 1) * cw + (c + 1)
    // South neighbor missing → south edge, west→east (interior north of edge, on left)
    if (r === 0 || !cells.has((r - 1) * cols + c)) addEdge(sw, se)
    // East neighbor missing → east edge, south→north
    if (c === cols - 1 || !cells.has(r * cols + (c + 1))) addEdge(se, ne)
    // North neighbor missing → north edge, east→west
    if (r === rows - 1 || !cells.has((r + 1) * cols + c)) addEdge(ne, nw)
    // West neighbor missing → west edge, north→south
    if (c === 0 || !cells.has(r * cols + (c - 1))) addEdge(nw, sw)
  }

  const cornerToLngLat = (corner: number): LngLat => {
    const r = Math.floor(corner / cw)
    const c = corner % cw
    return [west + c * dLng, south + r * dLat]
  }

  // Chain directed edges into rings. At diagonal pinch corners a vertex has two
  // outgoing edges — pick the one turning sharpest left relative to incoming
  // direction so we stay on the outer contour.
  const rings: LngLat[][] = []
  while (edges.size > 0) {
    const start = edges.keys().next().value as number
    const ring: number[] = [start]
    let current = start
    let prevDir: [number, number] | null = null
    let guard = (rows + 1) * (cols + 1) * 4

    while (guard-- > 0) {
      const outs = edges.get(current)
      if (!outs || outs.length === 0) break
      let chosenIdx = 0
      if (outs.length > 1 && prevDir) {
        // Choose sharpest left turn
        let bestScore = -Infinity
        for (let i = 0; i < outs.length; i++) {
          const [cr, cc] = [Math.floor(current / cw), current % cw]
          const [nr, nc] = [Math.floor(outs[i] / cw), outs[i] % cw]
          const dir: [number, number] = [nc - cc, nr - cr]
          // cross > 0 means left turn; prefer left, then straight, then right
          const cross = prevDir[0] * dir[1] - prevDir[1] * dir[0]
          const dot = prevDir[0] * dir[0] + prevDir[1] * dir[1]
          const score = cross * 2 + dot
          if (score > bestScore) {
            bestScore = score
            chosenIdx = i
          }
        }
      }
      const next = outs.splice(chosenIdx, 1)[0]
      if (outs.length === 0) edges.delete(current)
      const [cr, cc] = [Math.floor(current / cw), current % cw]
      const [nr, nc] = [Math.floor(next / cw), next % cw]
      prevDir = [nc - cc, nr - cr]
      ring.push(next)
      current = next
      if (current === start) break
    }

    if (ring.length >= 4 && ring[0] === ring[ring.length - 1]) {
      rings.push(ring.map(cornerToLngLat))
    }
  }

  if (rings.length === 0) return null
  // Keep the ring with the largest absolute area (outer contour)
  let best = rings[0]
  let bestArea = Math.abs(ringSignedArea(rings[0]))
  for (let i = 1; i < rings.length; i++) {
    const a = Math.abs(ringSignedArea(rings[i]))
    if (a > bestArea) {
      bestArea = a
      best = rings[i]
    }
  }
  return best
}

/** Remove collinear midpoints from a closed ring (keeps shape, shrinks vertex count). */
export function simplifyCollinear(ring: LngLat[]): LngLat[] {
  if (ring.length < 5) return ring
  const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
  const pts = closed ? ring.slice(0, -1) : ring.slice()
  const out: LngLat[] = []
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]
    const cur = pts[i]
    const next = pts[(i + 1) % n]
    const cross = (cur[0] - prev[0]) * (next[1] - prev[1]) - (cur[1] - prev[1]) * (next[0] - prev[0])
    if (Math.abs(cross) > 1e-15) out.push(cur)
  }
  if (out.length < 3) return ring
  out.push(out[0])
  return out
}

/**
 * One pass of Chaikin corner-cutting on a closed ring. The result hugs the
 * original shape; callers must re-verify containment (cutting can exit the
 * original polygon at reflex corners).
 */
export function chaikinClosed(ring: LngLat[], iterations = 2): LngLat[] {
  let pts = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring.slice()
  for (let it = 0; it < iterations; it++) {
    const out: LngLat[] = []
    const n = pts.length
    for (let i = 0; i < n; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % n]
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25])
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }
    pts = out
  }
  pts.push(pts[0])
  return pts
}

/** Compass label (north/northeast/.../center) of a point relative to a reference center and extent. */
export function compassLabel(
  pt: LngLat,
  center: LngLat,
  halfWidthDeg: number,
  halfHeightDeg: number
): string {
  const dx = pt[0] - center[0]
  const dy = pt[1] - center[1]
  const fx = halfWidthDeg > 0 ? dx / halfWidthDeg : 0
  const fy = halfHeightDeg > 0 ? dy / halfHeightDeg : 0
  if (Math.abs(fx) < 0.22 && Math.abs(fy) < 0.22) return 'center'
  const ns = fy > 0 ? 'north' : 'south'
  const ew = fx > 0 ? 'east' : 'west'
  if (Math.abs(fy) > Math.abs(fx) * 2.2) return ns
  if (Math.abs(fx) > Math.abs(fy) * 2.2) return ew
  return `${ns}${ew}`
}

/** Compass word for the direction wind blows FROM, given degrees. */
export function degreesToCompass8(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8]
}
