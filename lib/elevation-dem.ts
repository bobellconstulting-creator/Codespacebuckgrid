// lib/elevation-dem.ts
// Dense elevation grid in ONE batched request to the USGS 3DEP ImageServer
// `getSamples` endpoint (1 m LiDAR-derived, US coverage, free, no key).
//
// Replaces the old 256 individual EPQS point-queries — which ran ~11 sequential
// batches and routinely blew the /api/chat 12 s spatial budget, silently
// dropping the placement engine into legacy guess-mode. One request now returns
// a 24×24 grid (576 points) of 1 m LiDAR-derived elevation, giving the terrain
// engine denser, sharper, reliably-delivered data for slope/aspect/saddle/funnel.
//
// NOTE: the getSamples service hard-caps at ~1,000 returned samples and carries
// ~6 s fixed latency, so 576 is the density/latency sweet spot that returns in
// full (~8 s) within the spatial budget. For instant + far denser terrain, the
// AWS terrarium DEM tiles (already CSP-allowed for the 3D map) are the next step.

import type { ElevationSample, Bounds } from './spatial'

const DEM_ENDPOINT =
  'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples'

interface DemSample {
  location?: { x?: number; y?: number }
  locationId?: number
  value?: string | number
}

export async function fetchElevationGridDEM(bounds: Bounds, gridN = 24): Promise<ElevationSample[]> {
  try {
    const { north, south, east, west } = bounds
    if (gridN < 2) return []

    // Build the sample grid in row-major order: points[r*gridN + c]
    const points: [number, number][] = []
    for (let r = 0; r < gridN; r++) {
      for (let c = 0; c < gridN; c++) {
        const lat = south + (r * (north - south)) / (gridN - 1)
        const lng = west + (c * (east - west)) / (gridN - 1)
        points.push([lng, lat]) // ArcGIS expects [x, y] = [lng, lat]
      }
    }

    const body = new URLSearchParams({
      geometry: JSON.stringify({ points, spatialReference: { wkid: 4326 } }),
      geometryType: 'esriGeometryMultipoint',
      returnFirstValueOnly: 'true',
      sampleCount: String(gridN * gridN),
      f: 'json',
    })

    const res = await fetch(DEM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(11000),
    })
    if (!res.ok) return []

    const data = (await res.json()) as { samples?: DemSample[] }
    if (!Array.isArray(data.samples)) return []

    // The service returns samples OUT OF ORDER — sort by locationId (the input
    // index) so downstream row-major grid math (terrain derivatives) stays valid.
    const ordered = [...data.samples].sort(
      (a, b) => (a.locationId ?? 0) - (b.locationId ?? 0),
    )

    const out: ElevationSample[] = []
    for (const s of ordered) {
      const lng = s.location?.x
      const lat = s.location?.y
      const elevationM = Number(s.value)
      if (typeof lng !== 'number' || typeof lat !== 'number') continue
      if (!Number.isFinite(elevationM) || elevationM < -500 || elevationM > 9000) continue
      out.push({ lat, lng, elevationM })
    }
    return out
  } catch {
    return []
  }
}
