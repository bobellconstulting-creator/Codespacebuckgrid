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

/** The actual COG window read — wrapped in a timeout by fetchWorldCover.
 *  Tries a multi-tile read first (for parcels straddling a 3° tile seam) and
 *  falls back to the proven single center-tile read, so the common single-tile
 *  case never regresses. */
async function readCover(bounds: Bounds): Promise<CoverGrid | null> {
  try {
    const multi = await readCoverMulti(bounds)
    if (multi && multi.classes.some((v) => v !== 0)) return multi
  } catch { /* fall through to single-tile read */ }
  return readCoverSingle(bounds)
}

/**
 * Read every 3° WorldCover tile the parcel touches and stitch them into one
 * grid. Fixes the seam bug where a parcel crossing a tile boundary read only the
 * center tile and smeared the far half to a single clamped edge pixel. Returns
 * null for the single-tile case (handled by readCoverSingle) or on any failure.
 */
async function readCoverMulti(bounds: Bounds): Promise<CoverGrid | null> {
  const { west, south, east, north } = bounds

  // 3° tiles (SW corners) covering the bbox
  const tiles: Array<{ lat: number; lng: number }> = []
  for (let tLat = Math.floor(south / 3) * 3; tLat <= Math.floor(north / 3) * 3; tLat += 3) {
    for (let tLng = Math.floor(west / 3) * 3; tLng <= Math.floor(east / 3) * 3; tLng += 3) {
      tiles.push({ lat: tLat, lng: tLng })
    }
  }
  if (tiles.length <= 1) return null // single tile → use the simpler proven path

  // Open each tile (missing tiles, e.g. ocean, resolve to null and stay no-data)
  const images = await Promise.all(tiles.map(async (t) => {
    try {
      const url = `${BASE}/ESA_WorldCover_10m_2021_v200_${tileName(t.lat + 1, t.lng + 1)}_Map.tif`
      const tiff = await fromUrl(url)
      return await tiff.getImage()
    } catch { return null }
  }))
  const ref = images.find((im) => im)
  if (!ref) return null

  // All WorldCover tiles share one global pixel grid + resolution, so any tile's
  // origin/resolution serves as the global reference for indexing across tiles.
  const [ox0, oy0] = ref.getOrigin()
  const [rx, ry] = ref.getResolution() // rx > 0, ry < 0 (north-up)

  const gLeft = Math.floor((west - ox0) / rx)
  const gRight = Math.ceil((east - ox0) / rx)
  const gTop = Math.floor((north - oy0) / ry) // ry < 0 → north = smaller row
  const gBottom = Math.ceil((south - oy0) / ry)
  const fullW = gRight - gLeft, fullH = gBottom - gTop
  if (fullW <= 0 || fullH <= 0) return null

  const CAP = 220
  const step = Math.max(1, Math.ceil(Math.max(fullW, fullH) / CAP))
  const outW = Math.ceil(fullW / step)
  const outH = Math.ceil(fullH / step)
  const northUp = new Uint8Array(outW * outH) // 0 = no data; row 0 = NORTH here

  for (const img of images) {
    if (!img) continue
    const [ox, oy] = img.getOrigin()
    const tw = img.getWidth(), th = img.getHeight()
    const offCol = Math.round((ox - ox0) / rx)
    const offRow = Math.round((oy - oy0) / ry)

    const interLeft = Math.max(gLeft, offCol)
    const interRight = Math.min(gRight, offCol + tw)
    const interTop = Math.max(gTop, offRow)
    const interBottom = Math.min(gBottom, offRow + th)
    if (interRight <= interLeft || interBottom <= interTop) continue

    const ocStart = Math.ceil((interLeft - gLeft) / step)
    const ocEnd = Math.floor((interRight - 1 - gLeft) / step)
    const orStart = Math.ceil((interTop - gTop) / step)
    const orEnd = Math.floor((interBottom - 1 - gTop) / step)
    if (ocEnd < ocStart || orEnd < orStart) continue

    const winW = Math.max(1, Math.round((interRight - interLeft) / step))
    const winH = Math.max(1, Math.round((interBottom - interTop) / step))
    let src: ArrayLike<number> | null = null
    try {
      const rasters = await img.readRasters({
        window: [interLeft - offCol, interTop - offRow, interRight - offCol, interBottom - offRow],
        width: winW, height: winH,
        resampleMethod: 'nearest',
        pool: getPool(),
      })
      src = rasters[0] as unknown as ArrayLike<number>
    } catch { continue }
    if (!src) continue

    for (let or = orStart; or <= orEnd; or++) {
      const sy = Math.min(winH - 1, Math.max(0, Math.round((gTop + or * step - interTop) / step)))
      for (let oc = ocStart; oc <= ocEnd; oc++) {
        const sx = Math.min(winW - 1, Math.max(0, Math.round((gLeft + oc * step - interLeft) / step)))
        northUp[or * outW + oc] = src[sy * winW + sx] & 0xff
      }
    }
  }

  // Flip to engine orientation (row 0 = SOUTH increasing north)
  const classes = new Uint8Array(outW * outH)
  for (let r = 0; r < outH; r++) {
    for (let c = 0; c < outW; c++) {
      classes[(outH - 1 - r) * outW + c] = northUp[r * outW + c]
    }
  }

  return {
    west: ox0 + gLeft * rx, east: ox0 + gRight * rx,
    north: oy0 + gTop * ry, south: oy0 + gBottom * ry,
    cols: outW, rows: outH, classes,
  }
}

/** Single center-tile COG window read (the original, proven path). */
async function readCoverSingle(bounds: Bounds): Promise<CoverGrid | null> {
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
