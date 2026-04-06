// USGS NLCD — Land Cover and Tree Canopy Cover via WMS GetFeatureInfo
// Free, no API key. https://www.mrlc.gov/data-services-page

const NLCD_WMS = 'https://www.mrlc.gov/geoserver/mrlc_display/wms'

const NLCD_CLASSES: Record<number, string> = {
  11: 'Open Water',
  21: 'Developed-Open',
  22: 'Developed-Low',
  23: 'Developed-Medium',
  24: 'Developed-High',
  31: 'Barren',
  41: 'Deciduous Forest',
  42: 'Evergreen Forest',
  43: 'Mixed Forest',
  52: 'Shrub/Scrub',
  71: 'Grassland',
  81: 'Pasture/Hay',
  82: 'Cultivated Crops',
  90: 'Woody Wetlands',
  95: 'Herbaceous Wetlands',
}

// Tony-facing labels — what each class means for habitat
const TONY_LABELS: Record<number, string> = {
  41: 'deciduous forest (mast producer — prime edge hunting)',
  42: 'evergreen forest (thermal bedding cover)',
  43: 'mixed forest (edge value)',
  52: 'shrub/scrub (early successional browse — bedding zone)',
  71: 'grassland/herbaceous (browse and travel)',
  81: 'pasture/hay (food source, low hunting value)',
  82: 'cultivated crops (confirmed food source — hunt the edge)',
  90: 'woody wetlands (thermal bedding + water — high value)',
  95: 'herbaceous wetlands (water corridor)',
  11: 'open water',
  21: 'developed land (pressure zone)',
  22: 'developed land (pressure zone)',
}

export interface NlcdSample {
  lat: number
  lng: number
  landCoverCode: number
  landCoverLabel: string
  tonyLabel: string
}

async function fetchNlcdPoint(lat: number, lng: number): Promise<NlcdSample | null> {
  const BUFFER = 0.001
  const bbox = `${lat - BUFFER},${lng - BUFFER},${lat + BUFFER},${lng + BUFFER}`
  const params = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo',
    LAYERS: 'NLCD_2021_Land_Cover_L48_20230630',
    QUERY_LAYERS: 'NLCD_2021_Land_Cover_L48_20230630',
    STYLES: '', CRS: 'EPSG:4326', BBOX: bbox,
    WIDTH: '100', HEIGHT: '100', FORMAT: 'image/png',
    INFO_FORMAT: 'application/json', I: '50', J: '50',
  })
  try {
    const res = await fetch(`${NLCD_WMS}?${params}`, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return null
    const json = await res.json()
    const feature = json.features?.[0]
    const code = Number(feature?.properties?.GRAY_INDEX ?? feature?.properties?.pixel_value ?? 0)
    if (!code) return null
    return {
      lat, lng,
      landCoverCode: code,
      landCoverLabel: NLCD_CLASSES[code] ?? `Class ${code}`,
      tonyLabel: TONY_LABELS[code] ?? NLCD_CLASSES[code] ?? `Class ${code}`,
    }
  } catch {
    return null
  }
}

export async function fetchNlcdGrid(bounds: {
  north: number; south: number; east: number; west: number
}): Promise<NlcdSample[]> {
  const GRID_N = 4
  const { north, south, east, west } = bounds
  const latStep = (north - south) / (GRID_N - 1)
  const lngStep = (east - west) / (GRID_N - 1)
  const points: Array<{ lat: number; lng: number }> = []
  for (let r = 0; r < GRID_N; r++) {
    for (let c = 0; c < GRID_N; c++) {
      points.push({ lat: south + r * latStep, lng: west + c * lngStep })
    }
  }
  const results = await Promise.allSettled(points.map(p => fetchNlcdPoint(p.lat, p.lng)))
  return results
    .filter((r): r is PromiseFulfilledResult<NlcdSample | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((s): s is NlcdSample => s !== null)
}

export function summarizeNlcdForTony(samples: NlcdSample[]): string {
  if (!samples.length) return ''
  const counts: Record<string, { count: number; code: number }> = {}
  for (const s of samples) {
    if (!counts[s.tonyLabel]) counts[s.tonyLabel] = { count: 0, code: s.landCoverCode }
    counts[s.tonyLabel].count++
  }
  const total = samples.length
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b.count - a.count)
  const lines = ['LAND COVER (NLCD 2021 verified):']
  for (const [label, { count }] of sorted) {
    lines.push(`  ${Math.round((count / total) * 100)}% ${label}`)
  }
  return lines.join('\n')
}
