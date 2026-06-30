// lib/canopyHeight.ts
// 1 m canopy-height refinement from the Meta / WRI High-Resolution Canopy Height
// model (v1, "alsgedi_global_v6_float"). Free, global, NO signup, NO API key:
// public Cloud-Optimized GeoTIFFs read directly over HTTP range requests with
// pure-JS geotiff.js (works on Vercel serverless — no GDAL/Python).
//
// Where ESA WorldCover (10 m) only knows tree-vs-not, this knows tree HEIGHT —
// so it sees the small food-plot opening or logging road inside a timber block
// that 10 m cover smears over, and it flags low early-successional cover (the
// thick bedding deer actually use).
//
// Tiles are addressed by a standard zoom-9 slippy-map quadkey (so we compute the
// tile straight from lat/lng — no 15 MB index needed) and are in EPSG:3857.

import { fromUrl, Pool } from 'geotiff'
import type { Bounds } from './spatial'

export interface CanopyHeightGrid {
  west: number; south: number; east: number; north: number
  cols: number; rows: number
  /** row-major; row 0 = SOUTH increasing north. Values = canopy height in METERS (0 = open ground). */
  heights: Uint8Array
}

const Z = 9
const BASE = 'https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm'
const R = 20037508.342789244 // EPSG:3857 half-extent (meters)

/** Standard slippy-map quadkey for a lng/lat at zoom z. */
function quadkey(lng: number, lat: number, z: number): string {
  const n = 2 ** z
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  let qk = ''
  for (let i = z; i > 0; i--) {
    let d = 0
    const m = 1 << (i - 1)
    if ((x & m) !== 0) d++
    if ((y & m) !== 0) d += 2
    qk += d
  }
  return qk
}

// EPSG:4326 <-> EPSG:3857 (Web Mercator)
const lngToX = (lng: number): number => (lng * R) / 180
const latToY = (lat: number): number => (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) * (R / 180)
const xToLng = (x: number): number => (x / R) * 180
const yToLat = (y: number): number => (180 / Math.PI) * (2 * Math.atan(Math.exp(((y / R) * 180 * Math.PI) / 180)) - Math.PI / 2)

let pool: Pool | null = null
function getPool(): Pool | undefined {
  try { pool = pool ?? new Pool() } catch { pool = null }
  return pool ?? undefined
}

const cache = new Map<string, { exp: number; grid: CanopyHeightGrid | null }>()
const TTL = 6 * 60 * 60 * 1000

/**
 * Fetch the canopy-height grid for the parcel bounds. Returns null on any
 * failure so callers degrade gracefully (cover then falls back to WorldCover).
 */
export async function fetchCanopyHeight(bounds: Bounds): Promise<CanopyHeightGrid | null> {
  const { west, south, east, north } = bounds
  const key = `${west.toFixed(4)},${south.toFixed(4)},${east.toFixed(4)},${north.toFixed(4)}`
  const hit = cache.get(key)
  if (hit && hit.exp > Date.now()) return hit.grid

  let grid: CanopyHeightGrid | null = null
  try {
    grid = await Promise.race([
      readCanopy(bounds),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ])
  } catch {
    grid = null
  }
  cache.set(key, { exp: Date.now() + TTL, grid })
  return grid
}

/** The actual COG window read (single zoom-9 tile — they're ~78 km wide, so a
 *  parcel is effectively always inside one). Wrapped in a timeout by the caller. */
async function readCanopy(bounds: Bounds): Promise<CanopyHeightGrid | null> {
  const { west, south, east, north } = bounds
  try {
    const cLng = (west + east) / 2
    const cLat = (south + north) / 2
    const url = `${BASE}/${quadkey(cLng, cLat, Z)}.tif`

    const tiff = await fromUrl(url)
    const image = await tiff.getImage()
    const [ox, oy] = image.getOrigin()
    const [rx, ry] = image.getResolution() // 3857 meters; ry < 0 (north-up)
    const tw = image.getWidth(), th = image.getHeight()

    // Parcel bounds in EPSG:3857
    const wX = lngToX(west), eX = lngToX(east), sY = latToY(south), nY = latToY(north)
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    const left = clamp(Math.floor((wX - ox) / rx), 0, tw - 1)
    const right = clamp(Math.ceil((eX - ox) / rx), 1, tw)
    const top = clamp(Math.floor((nY - oy) / ry), 0, th - 1)
    const bottom = clamp(Math.ceil((sY - oy) / ry), 1, th)
    if (right <= left || bottom <= top) return null // parcel outside this tile

    const CAP = 200
    const outW = Math.min(right - left, CAP)
    const outH = Math.min(bottom - top, CAP)

    const rasters = await image.readRasters({
      window: [left, top, right, bottom],
      width: outW, height: outH,
      resampleMethod: 'nearest',
      pool: getPool(),
    })
    const src = rasters[0] as unknown as ArrayLike<number>
    const cols = (rasters as { width: number }).width
    const rows = (rasters as { height: number }).height

    // geotiff returns rows north→south; engine wants row 0 = south → flip, and
    // clamp heights into a byte (0 = open ground; tallest canopy is well under 255 m).
    const heights = new Uint8Array(cols * rows)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = src[r * cols + c]
        const h = Number.isFinite(v) ? Math.round(Math.max(0, Math.min(255, v))) : 0
        heights[(rows - 1 - r) * cols + c] = h
      }
    }

    // Geo extent actually covered by the integer pixel window, converted back to
    // lng/lat. Sampling is linear in lng/lat (the mercator non-linearity over a
    // single parcel is < 0.1 %).
    return {
      west: xToLng(ox + left * rx),
      east: xToLng(ox + right * rx),
      north: yToLat(oy + top * ry),
      south: yToLat(oy + bottom * ry),
      cols, rows, heights,
    }
  } catch {
    return null
  }
}
