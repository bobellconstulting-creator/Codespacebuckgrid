// lib/worldcover.ts
// Authoritative land cover from ESA WorldCover 10m — derived from real
// multispectral satellite (Sentinel-1/2, with infrared), so it actually sees
// trees vs crops vs water instead of guessing from RGB. Free, global, NO signup,
// NO API key: public Cloud-Optimized GeoTIFFs read directly over HTTP range
// requests with pure-JS geotiff.js (works on Vercel serverless — no GDAL/Python).
//
// This replaces the dead MRLC NLCD endpoint and the unreliable Excess-Green
// texture canopy as the engine's primary cover source.

import { fromUrl, Pool } from 'geotiff'
import type { Bounds } from './spatial'

// WorldCover class codes (v200)
export const WC = {
  TREE: 10, SHRUB: 20, GRASS: 30, CROP: 40, BUILT: 50, BARE: 60,
  SNOW: 70, WATER: 80, WETLAND: 90, MANGROVE: 95, MOSS: 100,
} as const

export interface CoverGrid {
  west: number; south: number; east: number; north: number
  cols: number; rows: number
  /** row-major; row 0 = SOUTH increasing north, col 0 = WEST increasing east. Values = WorldCover class codes. */
  classes: Uint8Array
}

const BASE = 'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map'

/** WorldCover tiles are 3°×3°, named by their SW corner (e.g. N39W093). */
function tileName(lat: number, lng: number): string {
  const tLat = Math.floor(lat / 3) * 3
  const tLng = Math.floor(lng / 3) * 3
  const ns = tLat >= 0 ? 'N' : 'S'
  const ew = tLng >= 0 ? 'E' : 'W'
  const la = String(Math.abs(tLat)).padStart(2, '0')
  const lo = String(Math.abs(tLng)).padStart(3, '0')
  return `${ns}${la}${ew}${lo}`
}

// One Pool per process (worker threads for decode); created lazily.
let pool: Pool | null = null
function getPool(): Pool | undefined {
  try { pool = pool ?? new Pool() } catch { pool = null }
  return pool ?? undefined
}

const cache = new Map<string, { exp: number; grid: CoverGrid | null }>()
const TTL = 6 * 60 * 60 * 1000

/**
 * Fetch the ESA WorldCover class grid for the parcel bounds. Resolution is the
 * native 10 m, downsampled only if the parcel is very large (cap ~200 cells/side).
 * Returns null on any failure so callers degrade gracefully.
 */
export async function fetchWorldCover(bounds: Bounds): Promise<CoverGrid | null> {
  const { west, south, east, north } = bounds
  const key = `${west.toFixed(4)},${south.toFixed(4)},${east.toFixed(4)},${north.toFixed(4)}`
  const hit = cache.get(key)
  if (hit && hit.exp > Date.now()) return hit.grid

  let grid: CoverGrid | null = null
  try {
    grid = await Promise.race([
      readCover(bounds),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ])
  } catch {
    grid = null
  }

  cache.set(key, { exp: Date.now() + TTL, grid })
  return grid
}

/** The actual COG window read — wrapped in a timeout by fetchWorldCover. */
async function readCover(bounds: Bounds): Promise<CoverGrid | null> {
  const { west, south, east, north } = bounds
  let grid: CoverGrid | null = null
  try {
    const cLat = (south + north) / 2
    const cLng = (west + east) / 2
    const url = `${BASE}/ESA_WorldCover_10m_2021_v200_${tileName(cLat, cLng)}_Map.tif`

    const tiff = await fromUrl(url)
    const image = await tiff.getImage()
    const [ox, oy] = image.getOrigin()
    const [rx, ry] = image.getResolution() // ry is negative (north-up)
    const tw = image.getWidth(), th = image.getHeight()

    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    const left = clamp(Math.floor((west - ox) / rx), 0, tw - 1)
    const right = clamp(Math.ceil((east - ox) / rx), 1, tw)
    const top = clamp(Math.floor((north - oy) / ry), 0, th - 1)
    const bottom = clamp(Math.ceil((south - oy) / ry), 1, th)
    if (right <= left || bottom <= top) throw new Error('empty window (parcel outside tile)')

    const wPx = right - left, hPx = bottom - top
    const CAP = 200
    const outW = Math.min(wPx, CAP)
    const outH = Math.min(hPx, CAP)

    const rasters = await image.readRasters({
      window: [left, top, right, bottom],
      width: outW, height: outH,
      resampleMethod: 'nearest',
      pool: getPool(),
    })
    const src = rasters[0] as unknown as ArrayLike<number>
    const cols = (rasters as { width: number }).width
    const rows = (rasters as { height: number }).height

    // geotiff returns rows north→south; engine wants row 0 = south → flip vertically
    const classes = new Uint8Array(cols * rows)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        classes[(rows - 1 - r) * cols + c] = src[r * cols + c] & 0xff
      }
    }

    // Geo extent actually covered by the integer pixel window (for accurate sampling)
    grid = {
      west: ox + left * rx,
      east: ox + right * rx,
      north: oy + top * ry,
      south: oy + bottom * ry,
      cols, rows, classes,
    }
  } catch {
    grid = null
  }
  return grid
}
