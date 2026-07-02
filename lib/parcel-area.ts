// lib/parcel-area.ts
// Single source of truth for parcel acreage. Geodesic area on the WGS84
// ellipsoid (GeographicLib) — survey-grade, the same math GIS/surveyors use.
// Validated to agree with an independent UTM-planar method to 0.001% on real
// parcels. This replaces the old H3 hex-count × 0.0344 estimate (quantized and
// off by 1%+), so the acreage we display and EXPORT is a real, defensible number.

import geographiclib from 'geographiclib-geodesic'

const SQ_M_PER_ACRE = 4046.8564224

/**
 * Geodesic area, in acres, of a closed ring of [lng, lat] points (WGS84).
 * Returns 0 for a degenerate ring.
 */
export function parcelAreaAcres(ring: Array<[number, number]> | number[][]): number {
  if (!ring || ring.length < 3) return 0
  const poly = geographiclib.Geodesic.WGS84.Polygon(false)
  for (const pt of ring) {
    const lng = pt[0], lat = pt[1]
    if (typeof lng !== 'number' || typeof lat !== 'number') continue
    poly.AddPoint(lat, lng)
  }
  const r = poly.Compute(false, true)
  const m2 = Math.abs(r.area ?? 0)
  return m2 / SQ_M_PER_ACRE
}

/** Rounded to 1 decimal — the headline "247.3 AC" form for display/export. */
export function parcelAcresLabel(ring: Array<[number, number]> | number[][]): number {
  return Math.round(parcelAreaAcres(ring) * 10) / 10
}
