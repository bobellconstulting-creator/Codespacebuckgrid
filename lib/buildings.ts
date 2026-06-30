// lib/buildings.ts
// Building/structure detection from Microsoft's Global ML Building Footprints —
// AI-detected from satellite imagery, free, NO signup, comprehensive rural-US
// coverage. Fills the gap that put a stand in a homestead's yard: OpenStreetMap
// misses most rural buildings, so the engine was blind to them. These footprints
// feed the engine's existing building-buffer as kind:'building' OSM features.
//
// Source: https://minedbuildings.z5.web.core.windows.net/global-buildings/
// (quadkey z9 tiles of gzipped GeoJSONL, indexed by dataset-links.csv).

import type { Bounds, OsmFeature } from './spatial'
// Bundled US quadkey→tile index (2415 z9 tiles, ~512KB) so there's no slow live
// index fetch on the hot path — only the small per-tile read. Regenerate with
// tools when Microsoft re-releases the dataset (URLs carry a release date).
import US_INDEX from './data/ms-buildings-us-index.json'

const INDEX: Record<string, string> = US_INDEX as Record<string, string>

// zoom-9 Bing/slippy quadkey for a lat/lng
function quadkey(lat: number, lng: number, z = 9): string {
  const n = 2 ** z
  const x = Math.floor(((lng + 180) / 360) * n)
  const r = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)
  let q = ''
  for (let i = z; i > 0; i--) {
    let d = 0
    const m = 1 << (i - 1)
    if (x & m) d++
    if (y & m) d += 2
    q += d
  }
  return q
}

// Per-instance result cache (keyed by parcel bounds)
const resultCache = new Map<string, { exp: number; feats: OsmFeature[] }>()
const RESULT_TTL = 6 * 60 * 60 * 1000

/**
 * Fetch building footprints intersecting the parcel bounds (+ small pad) as
 * kind:'building' OSM features (centroids). Returns [] on any failure/timeout so
 * the engine degrades gracefully (same contract as the other GIS layers).
 */
export async function fetchBuildings(bounds: Bounds): Promise<OsmFeature[]> {
  const { west, south, east, north } = bounds
  const key = `${west.toFixed(3)},${south.toFixed(3)},${east.toFixed(3)},${north.toFixed(3)}`
  const hit = resultCache.get(key)
  if (hit && hit.exp > Date.now()) return hit.feats

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 9000)
  let feats: OsmFeature[] = []
  try {
    // parcels are tiny vs z9 tiles — usually one quadkey; cover corners to be safe
    const qks = new Set([
      quadkey(south, west), quadkey(north, east), quadkey((south + north) / 2, (west + east) / 2),
    ])
    const padLat = (north - south) * 0.25 + 0.0008
    const padLng = (east - west) * 0.25 + 0.0008
    const w = west - padLng, e = east + padLng, s = south - padLat, n = north + padLat

    for (const qk of qks) {
      const url = INDEX[qk]
      if (!url) continue
      const buf = Buffer.from(await (await fetch(url, { signal: ctrl.signal })).arrayBuffer())
      const { gunzipSync } = await import('zlib')
      const txt = gunzipSync(buf).toString('utf8')
      for (const ln of txt.split('\n')) {
        if (!ln) continue
        let cx = 0, cy = 0
        try {
          const ring = JSON.parse(ln).geometry.coordinates[0] as [number, number][]
          let sx = 0, sy = 0
          for (const [px, py] of ring) { sx += px; sy += py }
          cx = sx / ring.length; cy = sy / ring.length
        } catch { continue }
        if (cx < w || cx > e || cy < s || cy > n) continue
        feats.push({ kind: 'building', point: [cx, cy] })
        if (feats.length > 2000) break
      }
    }
  } catch {
    feats = []
  } finally {
    clearTimeout(timer)
  }

  resultCache.set(key, { exp: Date.now() + RESULT_TTL, feats })
  return feats
}
