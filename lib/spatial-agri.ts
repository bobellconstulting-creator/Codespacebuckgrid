// spatial-agri.ts — Agriculture-focused wrapper around the existing spatial
// engine. Reuses OSM/elevation/soil/NLCD/wetland fetches from spatial.ts, but
// reframes the output for farmers, crop consultants, and land trusts instead
// of deer-hunting stand placement.
//
// Same bones as Tony AI, different lens.

import type { Bounds, SpatialContext } from './spatial'

export interface CropSuitability {
  rating: 'prime' | 'good' | 'marginal' | 'poor'
  reasons: string[]
}

export interface AgriSummary {
  bounds: Bounds
  totalAcres: number
  landCover: {
    cropPercent: number
    pasturePercent: number
    forestPercent: number
    wetlandPercent: number
    developedPercent: number
  }
  terrain: {
    avgSlopeDegrees: number
    slopeCategory: string
    dominantAspect: string
    erosionRisk: 'low' | 'moderate' | 'high'
  }
  soils: {
    dominantTexture?: string
    capabilityClass?: string
    drainageClass?: string
    summary: string
  }
  water: {
    hasStream: boolean
    hasPond: boolean
    hasWetland: boolean
    nearestWaterDistanceM?: number
  }
  suitability: {
    rowCrop: CropSuitability
    hayGrazing: CropSuitability
    orchardSpecialty: CropSuitability
    conservation: CropSuitability
  }
  flags: string[]
  fetchedAt: number
}

export interface AgriAnalysisInput {
  bounds: Bounds
  spatial: SpatialContext
  totalAcres: number
}

function boundsArea(b: Bounds): number {
  // Rough planar area for US latitudes; BuckGrid's spatial layer already
  // provides acres in most call sites so this is only a fallback.
  const latMid = (b.north + b.south) / 2
  const metersPerDegLat = 111_320
  const metersPerDegLng = 111_320 * Math.cos((latMid * Math.PI) / 180)
  const heightM = (b.north - b.south) * metersPerDegLat
  const widthM = (b.east - b.west) * metersPerDegLng
  const m2 = Math.max(0, heightM * widthM)
  return m2 * 0.000247105 // m2 -> acres
}

function classifyErosion(slope: number): 'low' | 'moderate' | 'high' {
  if (slope < 3) return 'low'
  if (slope < 8) return 'moderate'
  return 'high'
}

function rateRowCrop(summary: AgriSummary): CropSuitability {
  const reasons: string[] = []
  let score = 0
  if (summary.terrain.avgSlopeDegrees < 3) { score += 2; reasons.push('gentle slope (<3°)') }
  else if (summary.terrain.avgSlopeDegrees < 8) { score += 1; reasons.push('moderate slope (<8°)') }
  else reasons.push(`steep slope ${summary.terrain.avgSlopeDegrees.toFixed(1)}°`)

  if (summary.landCover.cropPercent > 50) { score += 2; reasons.push('already cropland-dominant') }
  else if (summary.landCover.cropPercent > 20) { score += 1; reasons.push('partial cropland') }

  if (summary.terrain.erosionRisk === 'low') score += 1
  if (summary.water.hasStream || summary.water.hasPond) { score += 1; reasons.push('surface water access') }

  const rating: CropSuitability['rating'] =
    score >= 5 ? 'prime' : score >= 3 ? 'good' : score >= 1 ? 'marginal' : 'poor'
  return { rating, reasons }
}

function rateHayGrazing(summary: AgriSummary): CropSuitability {
  const reasons: string[] = []
  let score = 0
  if (summary.terrain.avgSlopeDegrees < 12) { score += 2; reasons.push('graziable slope') }
  if (summary.landCover.pasturePercent > 20) { score += 2; reasons.push('existing pasture') }
  if (summary.water.hasStream || summary.water.hasPond) { score += 1; reasons.push('water for livestock') }
  if (summary.terrain.erosionRisk !== 'high') score += 1

  const rating: CropSuitability['rating'] =
    score >= 5 ? 'prime' : score >= 3 ? 'good' : score >= 1 ? 'marginal' : 'poor'
  return { rating, reasons }
}

function rateOrchard(summary: AgriSummary): CropSuitability {
  const reasons: string[] = []
  let score = 0
  if (summary.terrain.dominantAspect === 'S' || summary.terrain.dominantAspect === 'SE' || summary.terrain.dominantAspect === 'SW') {
    score += 2
    reasons.push(`${summary.terrain.dominantAspect}-facing (good sun)`)
  }
  if (summary.terrain.avgSlopeDegrees >= 2 && summary.terrain.avgSlopeDegrees < 12) {
    score += 2
    reasons.push('air drainage slope')
  }
  if (summary.terrain.erosionRisk !== 'high') score += 1
  if (summary.water.hasStream || summary.water.hasPond) { score += 1; reasons.push('irrigation source nearby') }

  const rating: CropSuitability['rating'] =
    score >= 5 ? 'prime' : score >= 3 ? 'good' : score >= 1 ? 'marginal' : 'poor'
  return { rating, reasons }
}

function rateConservation(summary: AgriSummary): CropSuitability {
  const reasons: string[] = []
  let score = 0
  if (summary.landCover.wetlandPercent > 5) { score += 2; reasons.push('wetland present') }
  if (summary.landCover.forestPercent > 30) { score += 2; reasons.push('mature forest cover') }
  if (summary.terrain.erosionRisk === 'high') { score += 1; reasons.push('erosion-prone — better as CRP/buffer') }
  if (summary.water.hasStream) { score += 1; reasons.push('riparian value') }

  const rating: CropSuitability['rating'] =
    score >= 4 ? 'prime' : score >= 2 ? 'good' : score >= 1 ? 'marginal' : 'poor'
  return { rating, reasons }
}

export function buildAgriSummary(input: AgriAnalysisInput): AgriSummary {
  const { bounds, spatial, totalAcres } = input

  // Land cover percentages — derived from NLCD samples if present.
  const lc = { cropPercent: 0, pasturePercent: 0, forestPercent: 0, wetlandPercent: 0, developedPercent: 0 }
  const samples = spatial.landCoverSamples ?? []
  if (samples.length > 0) {
    const counts: Record<string, number> = {}
    for (const s of samples) {
      const k = (s.landCoverLabel ?? s.tonyLabel ?? 'Unknown').toLowerCase()
      counts[k] = (counts[k] ?? 0) + 1
    }
    const total = samples.length
    const pct = (substr: string) => {
      let c = 0
      for (const [k, v] of Object.entries(counts)) if (k.includes(substr)) c += v
      return Math.round((c / total) * 100)
    }
    lc.cropPercent = pct('crop') + pct('cultivated')
    lc.pasturePercent = pct('pasture') + pct('hay') + pct('grassland')
    lc.forestPercent = pct('forest') + pct('wood')
    lc.wetlandPercent = pct('wetland') + pct('emergent') + pct('woody wetland')
    lc.developedPercent = pct('developed') + pct('urban')
  }

  const avgSlope = spatial.terrainDerivatives?.avgSlopeDegrees ?? 0
  const dominantAspect = spatial.terrainDerivatives?.dominantAspect ?? 'flat'
  const slopeCategory = spatial.terrainDerivatives?.slopeCategory ?? 'unknown'
  const erosionRisk = classifyErosion(avgSlope)

  const osm = spatial.osmFeatures ?? []
  const hasStream = osm.some((f) => f.kind === 'water' && (f.name ?? '').toLowerCase().match(/creek|stream|branch|river/))
  const hasPond = osm.some((f) => f.kind === 'water' && !(f.name ?? '').toLowerCase().match(/creek|stream|branch|river/))
  const hasWetland = (spatial.nwiWetlands?.totalAcres ?? 0) > 0 || osm.some((f) => f.kind === 'wetland')

  const dominantSoil = spatial.soilUnits?.[0]
  const soilsSummary = spatial.soilSummary ?? 'No SSURGO data available for this AOI.'

  const acres = totalAcres > 0 ? totalAcres : boundsArea(bounds)

  const summary: AgriSummary = {
    bounds,
    totalAcres: Math.round(acres * 10) / 10,
    landCover: lc,
    terrain: {
      avgSlopeDegrees: Math.round(avgSlope * 10) / 10,
      slopeCategory,
      dominantAspect,
      erosionRisk,
    },
    soils: {
      dominantTexture: (dominantSoil as { texture?: string } | undefined)?.texture,
      capabilityClass: (dominantSoil as { capabilityClass?: string } | undefined)?.capabilityClass,
      drainageClass: (dominantSoil as { drainageClass?: string } | undefined)?.drainageClass,
      summary: soilsSummary,
    },
    water: {
      hasStream,
      hasPond,
      hasWetland,
    },
    suitability: {
      rowCrop: { rating: 'poor', reasons: [] },
      hayGrazing: { rating: 'poor', reasons: [] },
      orchardSpecialty: { rating: 'poor', reasons: [] },
      conservation: { rating: 'poor', reasons: [] },
    },
    flags: [],
    fetchedAt: Date.now(),
  }

  summary.suitability.rowCrop = rateRowCrop(summary)
  summary.suitability.hayGrazing = rateHayGrazing(summary)
  summary.suitability.orchardSpecialty = rateOrchard(summary)
  summary.suitability.conservation = rateConservation(summary)

  if (erosionRisk === 'high') summary.flags.push('HIGH_EROSION_RISK')
  if (lc.wetlandPercent > 10) summary.flags.push('WETLAND_REGULATED')
  if (acres < 5) summary.flags.push('TOO_SMALL_FOR_COMMERCIAL_ROW_CROP')

  return summary
}

export function formatAgriSummaryForLLM(summary: AgriSummary): string {
  const s = summary
  const lc = s.landCover
  return [
    `AOI: ${s.totalAcres} acres`,
    `Land cover: crop ${lc.cropPercent}% | pasture ${lc.pasturePercent}% | forest ${lc.forestPercent}% | wetland ${lc.wetlandPercent}% | developed ${lc.developedPercent}%`,
    `Terrain: ${s.terrain.avgSlopeDegrees}° avg slope (${s.terrain.slopeCategory}), ${s.terrain.dominantAspect}-facing, erosion ${s.terrain.erosionRisk}`,
    `Soils: ${s.soils.summary}`,
    `Water: stream=${s.water.hasStream} pond=${s.water.hasPond} wetland=${s.water.hasWetland}`,
    `Suitability:`,
    `  Row crop:     ${s.suitability.rowCrop.rating} — ${s.suitability.rowCrop.reasons.join('; ') || 'n/a'}`,
    `  Hay/grazing:  ${s.suitability.hayGrazing.rating} — ${s.suitability.hayGrazing.reasons.join('; ') || 'n/a'}`,
    `  Orchard/spec: ${s.suitability.orchardSpecialty.rating} — ${s.suitability.orchardSpecialty.reasons.join('; ') || 'n/a'}`,
    `  Conservation: ${s.suitability.conservation.rating} — ${s.suitability.conservation.reasons.join('; ') || 'n/a'}`,
    s.flags.length > 0 ? `Flags: ${s.flags.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
