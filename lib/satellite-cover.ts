// lib/satellite-cover.ts
// Sub-meter canopy/open cover grid derived from the Esri World Imagery tile the
// app already fetches — decoded from an uncompressed BMP with ZERO dependencies.
//
// NLCD (30 m) and sparse rural OSM can't resolve a small food-plot opening inside
// timber, or a precise timber edge. This reads the actual satellite pixels at
// ~5 m/cell and flags vegetation vs open via the Excess-Green index (2G−R−B),
// giving the placement engine a fine cover signal where the coarse layers fail.

import type { Bounds } from './spatial'

export interface CanopyGrid {
  west: number; south: number; east: number; north: number
  cols: number; rows: number
  /** row-major; row 0 = SOUTH edge increasing north, col 0 = WEST increasing east. 1 = vegetation/canopy, 0 = open */
  canopy: Uint8Array
}

const EXG_CANOPY_THRESHOLD = 12

export async function fetchCanopyGrid(bounds: Bounds, grid = 64): Promise<CanopyGrid | null> {
  try {
    const { west, south, east, north } = bounds
    const url =
      'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export' +
      `?bbox=${west},${south},${east},${north}&bboxSR=4326&imageSR=4326&size=256,256&format=bmp&f=image`

    const res = await fetch(url, { signal: AbortSignal.timeout(9000) })
    if (!res.ok) return null
    const data = new Uint8Array(await res.arrayBuffer())
    if (data.length < 54 || data[0] !== 0x42 || data[1] !== 0x4d) return null // 'BM'

    const u32 = (o: number) => data[o] | (data[o + 1] << 8) | (data[o + 2] << 16) | (data[o + 3] << 24)
    const pixelOffset = u32(10)
    const biWidth = u32(18)
    const biHeightRaw = u32(22)
    const height = Math.abs(biHeightRaw)
    const topDown = biHeightRaw < 0
    const bpp = data[28] | (data[29] << 8)
    if ((bpp !== 24 && bpp !== 32) || biWidth <= 0 || height <= 0) return null
    const bytesPerPx = bpp / 8
    const rowStride = (biWidth * bytesPerPx + 3) & ~3

    const canopy = new Uint8Array(grid * grid)
    for (let orow = 0; orow < grid; orow++) {
      const northFrac = orow / (grid - 1) // 0 = south, 1 = north
      // BMP memory row 0 is the NORTH edge when top-down, SOUTH edge when bottom-up.
      const srcY = topDown
        ? Math.round((1 - northFrac) * (height - 1))
        : Math.round(northFrac * (height - 1))
      for (let ocol = 0; ocol < grid; ocol++) {
        const srcX = Math.round((ocol / (grid - 1)) * (biWidth - 1))
        const p = pixelOffset + srcY * rowStride + srcX * bytesPerPx
        if (p + 2 >= data.length) continue // guard → leaves 0 (open)
        const exg = 2 * data[p + 1] - data[p + 2] - data[p] // 2G − R − B
        canopy[orow * grid + ocol] = exg > EXG_CANOPY_THRESHOLD ? 1 : 0
      }
    }
    return { west, south, east, north, cols: grid, rows: grid, canopy }
  } catch {
    return null
  }
}
