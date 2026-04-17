import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { OsmFeature, SpatialContext } from '../../../lib/spatial'
import { fetchSpatialData } from '../../../lib/spatial'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_MESSAGE_LENGTH = 2000
const MAX_FEATURES = 50
const ESRI_TIMEOUT_MS = 12000
const ANTHROPIC_TIMEOUT_MS = 50000
const GEMINI_TIMEOUT_MS = 22000
const OPENAI_TIMEOUT_MS = 25000
// Global deadline — ensures we always respond before Vercel's 120s hard kill
const GLOBAL_DEADLINE_MS = 108_000

// ─── Tony's persistent identity — goes in system: field of every Anthropic call ──
const TONY_SYSTEM_PROMPT = `You are Tony — a direct, systematic whitetail habitat analyst. You analyze satellite imagery step by step and deliver specific, evidence-based placement advice. Every recommendation cites visible terrain. No generic tips. No padding.

ABSOLUTE RULES (violating any is a critical failure):
1. NEVER place any feature outside the user's stated property boundary
2. OSM-verified coordinates OVERRIDE visual inference — always anchor to OSM lat/lng
3. NEVER recommend water features unless OSM data explicitly confirms them
4. Every coordinate MUST be calculated via the pixel formula — pixel position first, then formula
5. Every feature MUST include confidence (0-100) and priority (1-5) fields
6. NEVER place a stand or food_plot inside a confirmed OSM forest polygon or water polygon
7. Every response MUST complete the 4-step Scene Analysis and 5-factor Habitat Audit before placing features
8. Your pixel_x and pixel_y fields are REQUIRED — the server verifies your math against them
9. CITE VISUAL EVIDENCE: every recommendation must name the specific location using compass direction and cover type — "NW corner where brushy fringe meets the creek draw" not "the edge area"
10. QUANTIFY: use real numbers — acreage, distances in yards, soil pH targets, plot % of total property`

// ─── Anthropic tool_use schema — enforces pixel→coordinate workflow ────────────
const HABITAT_TOOL: Record<string, unknown> = {
  name: 'place_habitat_features',
  description: 'Complete the 5-factor habitat audit, then place features using pixel-calculated coordinates',
  input_schema: {
    type: 'object',
    required: ['reply', 'features'],
    properties: {
      reply: { type: 'string', description: 'Full habitat analysis and recommendations for display to user. Must address all 5 audit factors.' },
      features: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          required: ['type', 'label', 'why', 'confidence', 'priority', 'pixel_x', 'pixel_y', 'geometry'],
          properties: {
            type: { type: 'string', enum: ['stand', 'food_plot', 'bedding', 'trail', 'water', 'mineral', 'scrape_line', 'travel_corridor'] },
            label: { type: 'string' },
            why: { type: 'string' },
            confidence: { type: 'integer', minimum: 0, maximum: 100 },
            priority: { type: 'integer', minimum: 1, maximum: 5 },
            pixel_x: { type: 'number', description: 'X pixel position of feature center in 640px-wide image (0=left/west, 640=right/east)' },
            pixel_y: { type: 'number', description: 'Y pixel position of feature center in 480px-tall image (0=top/north, 480=bottom/south)' },
            geometry: {
              type: 'object',
              required: ['type', 'coordinates'],
              properties: {
                type: { type: 'string', enum: ['Point', 'LineString', 'Polygon'] },
                coordinates: {}
              }
            }
          }
        }
      }
    }
  }
}

// ─── Recalculate coordinates from pixel positions — eliminates coordinate hallucination ──
function recalcCoordsFromPixels(f: any, bounds: Bounds): any {
  const px = f.pixel_x
  const py = f.pixel_y
  if (typeof px !== 'number' || typeof py !== 'number') return f
  const clampedPx = Math.max(0, Math.min(640, px))
  const clampedPy = Math.max(0, Math.min(480, py))
  const lng = bounds.west + (clampedPx / 640) * (bounds.east - bounds.west)
  const lat = bounds.north - (clampedPy / 480) * (bounds.north - bounds.south)

  if (f.geometry?.type === 'Point') {
    return { ...f, geometry: { type: 'Point', coordinates: [lng, lat] } }
  }
  // For polygons/lines: shift centroid toward pixel-derived center if drift > ~100m
  if (f.geometry?.type === 'Polygon') {
    const ring: [number, number][] = f.geometry.coordinates[0] ?? []
    if (ring.length > 0) {
      const centLng = ring.reduce((s, c) => s + c[0], 0) / ring.length
      const centLat = ring.reduce((s, c) => s + c[1], 0) / ring.length
      const dLng = lng - centLng
      const dLat = lat - centLat
      if (Math.abs(dLng) > 0.001 || Math.abs(dLat) > 0.001) {
        const shifted = ring.map(([lo, la]) => [lo + dLng, la + dLat] as [number, number])
        return { ...f, geometry: { type: 'Polygon', coordinates: [shifted] } }
      }
    }
  }
  return f
}

// ─── OSM bbox terrain validation — check coord isn't inside a forest/water polygon ──
function isPointInOsmBbox(coord: [number, number], f: OsmFeature): boolean {
  if (!f.bbox) return false
  const [minLng, minLat, maxLng, maxLat] = f.bbox
  return coord[0] >= minLng && coord[0] <= maxLng && coord[1] >= minLat && coord[1] <= maxLat
}

function validateTerrainType(f: any, osmFeatures: OsmFeature[]): string | undefined {
  const geom = f.geometry
  let coord: [number, number] | null = null
  if (geom?.type === 'Point') coord = geom.coordinates as [number, number]
  else if (geom?.type === 'Polygon') {
    const ring = geom.coordinates[0] as [number, number][]
    if (ring?.length > 0) coord = [ring.reduce((s, c) => s + c[0], 0) / ring.length, ring.reduce((s, c) => s + c[1], 0) / ring.length]
  }
  if (!coord) return undefined
  for (const osm of osmFeatures) {
    if ((osm.kind === 'forest') && (f.type === 'food_plot' || f.type === 'stand') && isPointInOsmBbox(coord, osm)) {
      return `Placed inside confirmed forest polygon — move to edge or open ground`
    }
    if ((osm.kind === 'water' || osm.kind === 'wetland') && isPointInOsmBbox(coord, osm)) {
      return `Placed inside confirmed water/wetland polygon — invalid placement`
    }
  }
  return undefined
}

// ─── Feature spacing — flag stands too close together ─────────────────────────
function checkFeatureSpacing(annotations: any[]): any[] {
  const stands = annotations.filter(f => f.type === 'stand' && f.geometry?.type === 'Point')
  return annotations.map(f => {
    if (f.type !== 'stand' || f.geometry?.type !== 'Point') return f
    const coord = f.geometry.coordinates as [number, number]
    const tooClose = stands.find(other => other !== f && haversineMeters(coord, other.geometry.coordinates) < 75)
    if (tooClose) {
      return { ...f, spacingWarning: `Stand within 75m of another stand — consider consolidating to reduce pressure` }
    }
    return f
  })
}

// ─── Terrain conflict detection ───────────────────────────────────────────────

// Haversine distance in meters between two [lng, lat] points
function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const dLat = (b[1] - a[1]) * Math.PI / 180
  const dLng = (b[0] - a[0]) * Math.PI / 180
  const lat1 = a[1] * Math.PI / 180
  const lat2 = b[1] * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(h))
}

// Check a proposed [lng, lat] coordinate against OSM features.
// Returns a conflict warning string if within threshold, or null if clear.
function checkTerrainConflict(coord: [number, number], osmFeatures: OsmFeature[]): string | null {
  const WATER_WARN_M = 20
  const BUILDING_WARN_M = 30

  for (const f of osmFeatures) {
    const dist = haversineMeters(coord, f.point)
    if (f.kind === 'water' && dist < WATER_WARN_M) {
      return `Within ${dist.toFixed(0)}m of a mapped water body — may be wet or inaccessible ground. Verify on satellite.`
    }
    if (f.kind === 'wetland' && dist < WATER_WARN_M) {
      return `Within ${dist.toFixed(0)}m of a mapped wetland — likely poor stand access. Verify on satellite.`
    }
    if (f.kind === 'building' && dist < BUILDING_WARN_M) {
      return `Within ${dist.toFixed(0)}m of a mapped structure — human pressure zone. Stand not recommended here.`
    }
  }
  return null
}

// In-memory rate limiter: 5 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

type Bounds = { north: number; south: number; east: number; west: number }

function isValidBounds(b: unknown): b is Bounds {
  if (!b || typeof b !== 'object') return false
  const { north, south, east, west } = b as Bounds
  return [north, south, east, west].every(v => typeof v === 'number' && isFinite(v))
    && north > south
    && east !== west
    && north <= 90 && south >= -90
    && east <= 180 && west >= -180
}

function getSeasonalGuidance(season: string): string {
  const s = season.toLowerCase()
  if (s.includes('spring')) {
    return `SEASON: Spring (April-May) — food plot prep is your #1 priority.
Priority order: food_plot > water > bedding > trail > stand
Planting windows: clover April 1-May 15, soybeans April 15-May 30.
Focus: south-facing slopes (20-30% more effective sun than north-facing), field edges, openings with 6+ hours direct sun. Minimum plot sizes: soybeans 2 acres, clover 0.25 acres minimum (0.5 preferred). MANDATE: recommend soil test before any plot — target pH 6.2-6.8. Forest soils typically need 1-2 tons/acre lime.
Bedding and stand improvements are secondary — hang stands NOW before bucks pattern human intrusion, then leave the property alone.`
  }
  if (s.includes('summer')) {
    return `SEASON: Summer (June-August) — mineral sites and water are critical. Velvet antler growth phase.
Priority order: water > food_plot > bedding > stand > trail
Water rule: deer prefer water within 400 yards of bedding. Any property without confirmed water within 400 yards of primary bedding NEEDS a water development — this is the #1 summer limiting factor in Kansas, Oklahoma, and Missouri.
Brassica planting deadline: August 1-15 is ideal, August 16-31 is acceptable, September 1+ is risky.
Bachelor groups visible near food sources — summer is the most patternable period for individual buck identification.
Focus: mineral lick sites (establish by March 15 for full-season use), water sources tucked into timber with 50+ yards cover on two sides (open-field water goes unused during daylight).`
  }
  if (s.includes('early fall')) {
    return `SEASON: Early Fall (September-October 14) — bucks are on their most predictable food-to-bedding pattern of the year.
Priority order: stand > trail > food_plot > bedding > water
This is the highest-probability period for patterning a specific mature buck. Bucks leave bedding 30-60 minutes before dark and return 30-60 minutes after first light.
Stand placement: timber edge stands 100-150 yards minimum from confirmed bedding, on the feeding area side, downwind of expected approach route.
Entry discipline is critical: never enter a September/October stand with the wrong wind. One contaminated approach can end a buck's daylight patterns for the rest of the season.
Thermal rule — MORNING stands: elevated terrain, benches, mid-slope (cold air pools scent in drainages at dawn). EVENING stands: lower slopes, drainage edges (thermals rise uphill in evening).
Focus: transition zones between bedding and feeding. Recommend stand sites 80-150 yards from timber edge with clean entry/exit routes that never cross through bedding or feeding areas.`
  }
  if (s.includes('rut') && s.includes('chase')) {
    return `SEASON: Rut Chase (Oct 15-31) — bucks beginning to search for does. Movement increasing but not yet frantic.
Priority order: stand > trail > bedding > food_plot > water
October 20-31 is underrated — first shooter bucks of the rut are often killed this week. Do not wait for peak rut to move stands off food sources.
Scrape lines now active: look for scrapes along timber edges, two-tracks, and field corners. A scrape line stand is as good as a food source stand this week.
All-day sits become productive starting October 20. Food plot stands drop in value — shift to funnels and saddles.
Focus: transition zones near doe bedding, scrape lines near timber intersections, saddles and pinch points (50-200 yard corridor width). Bucks cruising these zones at dawn and dusk with increasing mid-day movement.`
  }
  if (s.includes('rut') && s.includes('peak')) {
    return `SEASON: Peak Rut (Nov 10-20) — maximum buck daylight movement. This is THE week.
Priority order: stand > trail > bedding > water > food_plot
Standard breeding peak: November 10-17 across the northern US (adjust 5-7 days south for properties below 38°N latitude).
Food plots are IRRELEVANT this week. Bucks have abandoned food patterns entirely — they follow does.
All-day sits are mandatory November 11-20. Enter at first light, stay until dark. Pack lunch.
Water sources adjacent to doe bedding are underrated peak-rut locations — bucks check them repeatedly while tending does.
Stand distance from bedding: 30-60 yards is acceptable during peak rut (bucks are moving regardless). Use this window to fill rut stands that are closer to bedding than normal.
Focus: pinch points, saddles (minimum 15 feet of relief to produce reliable movement), funnels 50-200 yards wide, doe bedding edges, creek crossings. Entry/exit trails that NEVER cross bedding are non-negotiable — contaminated bedding ends the hunt.`
  }
  if (s.includes('rut')) {
    return `SEASON: Rut — peak buck movement. Stand placement is everything right now.
Priority order: stand > trail > bedding > water > food_plot
Focus: pinch points, saddles, funnels, doe bedding edges, creek crossings. Bucks abandon food patterns during rut — they follow does. Food plots are nearly irrelevant. Recommend stands at terrain funnels with minimal human scent intrusion. Entry/exit trails that avoid bedding areas are critical.
All-day sits productive. Secondary rut (December 5-15) produces a brief second movement window for unbred does.`
  }
  return `SEASON: Late Season (November 20 - January) — thermal cover and emergency food are survival factors.
Priority order: food_plot > bedding > water > trail > stand
Bucks in survival mode: bedding 20+ hours/day, feeding for 1 hour before dark on standing food sources.
Most reliable late-season food: frosted brassica bulbs (turnips, radishes — palatability peaks AFTER first hard frost), standing corn, cereal grain (wheat, rye). Deer will plow through snow to reach frosted brassicas.
Thermal cover requirement: dense bedding adjacent to food (within 200 yards). If deer must travel more than 200 yards from cover to food in late December, they will stay nocturnal.
Stand placement: within 200 yards of standing food, adjacent to thick south-facing cover. Short, quiet entries mandatory — every intrusion costs you 2-3 days of deer presence.
Secondary rut window: December 5-15. Unbred does cycle again — brief but real movement increase. Worth sitting full-day December 8-12.`
}

// Convert a lat/lng to approximate pixel coordinates given image bounds
function latLngToPixel(lat: number, lng: number, bounds: Bounds): { px: number; py: number } {
  const px = Math.round(((lng - bounds.west) / (bounds.east - bounds.west)) * 640)
  const py = Math.round(((bounds.north - lat) / (bounds.north - bounds.south)) * 480)
  return { px: Math.max(0, Math.min(640, px)), py: Math.max(0, Math.min(480, py)) }
}

// Builds the spatial intelligence block injected into Tony's prompt
function buildSpatialContextBlock(ctx: SpatialContext, bounds: Bounds): string {
  const lines: string[] = ['=== SPATIAL INTELLIGENCE (verified data — trust this over visual inference) ===']

  // OSM land cover — with pixel positions so Tony can cross-reference against visible image
  if (ctx.osmFeatures.length > 0) {
    const osmLines: string[] = ['VERIFIED LAND COVER (OpenStreetMap) — pixel positions are approximate (±10px):']
    const byKind: Record<string, typeof ctx.osmFeatures> = {}
    for (const f of ctx.osmFeatures) {
      byKind[f.kind] = byKind[f.kind] ?? []
      byKind[f.kind].push(f)
    }

    if (byKind.water?.length) {
      const pts = byKind.water.slice(0, 3).map(f => {
        const { px, py } = latLngToPixel(f.point[1], f.point[0], bounds)
        return `pixel(${px},${py}) = lat ${f.point[1].toFixed(4)}, lng ${f.point[0].toFixed(4)}`
      }).join(' | ')
      osmLines.push(`- WATER (${byKind.water.length}): ${pts} — DO NOT place stands or food plots within 20m. Verify blue/dark tones at these pixels.`)
    }
    if (byKind.wetland?.length) {
      const pts = byKind.wetland.slice(0, 2).map(f => {
        const { px, py } = latLngToPixel(f.point[1], f.point[0], bounds)
        return `pixel(${px},${py}) = lat ${f.point[1].toFixed(4)}, lng ${f.point[0].toFixed(4)}`
      }).join(' | ')
      osmLines.push(`- WETLAND (${byKind.wetland.length}): ${pts} — Poor access, soft ground. Avoid stands and plots within 20m.`)
    }
    if (byKind.building?.length) {
      const pts = byKind.building.slice(0, 3).map(f => {
        const { px, py } = latLngToPixel(f.point[1], f.point[0], bounds)
        return `pixel(${px},${py}) = lat ${f.point[1].toFixed(4)}, lng ${f.point[0].toFixed(4)}`
      }).join(' | ')
      osmLines.push(`- STRUCTURE (${byKind.building.length}): ${pts} — Human pressure zone. DO NOT place stands within 100m.`)
    }
    if (byKind.forest?.length) {
      osmLines.push(`- FOREST (${byKind.forest.length} polygon(s)): Confirmed timber cover. Use edges for stand placement — place stands on the OPEN GROUND side of these forest boundaries, not inside canopy.`)
    }
    if (byKind.road?.length) {
      const pts = byKind.road.slice(0, 2).map(f => {
        const { px, py } = latLngToPixel(f.point[1], f.point[0], bounds)
        return `pixel(${px},${py}) = lat ${f.point[1].toFixed(4)}, lng ${f.point[0].toFixed(4)}`
      }).join(' | ')
      osmLines.push(`- ROAD (${byKind.road.length}): ${pts} — Use as access route reference. Stands must be placed UPWIND of roads, never downwind.`)
    }
    if (byKind.farmland?.length) {
      const pts = byKind.farmland.slice(0, 3).map(f => {
        const { px, py } = latLngToPixel(f.point[1], f.point[0], bounds)
        return `pixel(${px},${py}) = lat ${f.point[1].toFixed(4)}, lng ${f.point[0].toFixed(4)}`
      }).join(' | ')
      osmLines.push(`- FARMLAND (${byKind.farmland.length}): ${pts} — CONFIRMED food source field(s). The EDGE of this field adjacent to timber is your #1 food plot / stand candidate.`)
    }
    if (byKind.scrub?.length) {
      const pts = byKind.scrub.slice(0, 2).map(f => {
        const { px, py } = latLngToPixel(f.point[1], f.point[0], bounds)
        return `pixel(${px},${py}) = lat ${f.point[1].toFixed(4)}, lng ${f.point[0].toFixed(4)}`
      }).join(' | ')
      osmLines.push(`- SCRUB/THICKET (${byKind.scrub.length}): ${pts} — Dense brushy cover. Prime bedding zone. Stands on downwind edge are excellent rut sites.`)
    }
    lines.push(osmLines.join('\n'))
  }

  // Elevation — translated to placement rules, not just labeled points
  if (ctx.elevationSummary) {
    lines.push(`\nTERRAIN ANALYSIS (Open-Meteo elevation):\n${ctx.elevationSummary}`)
  }

  if (ctx.highGroundPoints.length > 0) {
    const pts = ctx.highGroundPoints.slice(0, 3).map(p => {
      const { px, py } = latLngToPixel(p.lat, p.lng, bounds)
      return `pixel(${px},${py}) = lat ${p.lat.toFixed(5)}, lng ${p.lng.toFixed(5)} (${p.elevationM.toFixed(0)}m)`
    }).join(' | ')
    lines.push(`HIGH GROUND — Stand placement rule: place stands 20-40m DOWNHILL from these peaks (thermals carry scent upward from the valley; stands at the exact peak are exposed to wind from all directions). Look for benches or saddles near these coordinates:\n  ${pts}`)
  }

  if (ctx.lowGroundPoints.length > 0) {
    const pts = ctx.lowGroundPoints.slice(0, 3).map(p => {
      const { px, py } = latLngToPixel(p.lat, p.lng, bounds)
      return `pixel(${px},${py}) = lat ${p.lat.toFixed(5)}, lng ${p.lng.toFixed(5)} (${p.elevationM.toFixed(0)}m)`
    }).join(' | ')
    lines.push(`LOW DRAINAGE ZONES — Natural creek bottoms and bedding pinch points. These are trail and bedding candidates, NOT stand sites (cold air drainage, scent pooling). Water sources and travel corridors likely here:\n  ${pts}`)
  }

  // Soil data — capability class and drainage
  if (ctx.soilSummary) {
    lines.push(`\n${ctx.soilSummary}`)
    lines.push('SOIL PLACEMENT RULES: Class I-II = prime food plot ground. Class VI-VIII = do not plant. "Poorly drained" = wet/soft in spring, may hold water — avoid food plots, good for natural water source locations. State soil capability class in every food plot "why" field.')
  }

  // NLCD land cover
  if (ctx.landCoverSummary) {
    lines.push(`\n${ctx.landCoverSummary}`)
    lines.push('LAND COVER RULES: "Deciduous Forest" = mast producers, hunt the edges. "Shrub/Scrub" = early successional browse + bedding zone. "Cultivated Crops" = confirmed food source, hunt the timber/field edge. "Woody Wetlands" = thermal bedding + water, high value sanctuary. Use these classifications to override visual color interpretation.')
  }

  // NWI Wetlands — USFWS federal wetland inventory
  if (ctx.nwiWetlands) {
    const w = ctx.nwiWetlands
    const wetlandLines: string[] = [`\nFEDERAL WETLAND INVENTORY (USFWS NWI — authoritative):`,
      `- ${w.types.length} wetland type(s) mapped within this area, totaling ~${w.totalAcres.toFixed(0)} acres`]
    if (w.types.length > 0) wetlandLines.push(`- Types: ${w.types.slice(0, 4).join(' | ')}`)
    if (w.hasForestWetland) wetlandLines.push('- FORESTED/SHRUB WETLAND confirmed: dense thermal bedding cover, high sanctuary value. Deer use these heavily November-January. Stand on downwind edge.')
    if (w.hasEmergentMarsh) wetlandLines.push('- EMERGENT MARSH confirmed: open water-edge habitat, deer feeding on emergent vegetation in summer. Not prime stand location but confirms water availability.')
    if (!w.hasForestWetland && !w.hasEmergentMarsh && w.totalAcres > 0) wetlandLines.push('- Wetland present but type is less critical for deer habitat. Note soft wet ground for access planning.')
    lines.push(wetlandLines.join('\n'))
  }

  // Neighboring cropland — CropScape CDL
  if (ctx.neighboringCrops && ctx.neighboringCrops.length > 0) {
    const crops = ctx.neighboringCrops
    const hasCorn = crops.some(c => c.toLowerCase().includes('corn'))
    const hasSoy = crops.some(c => c.toLowerCase().includes('soy') || c.toLowerCase().includes('bean'))
    const hasAlfalfa = crops.some(c => c.toLowerCase().includes('alfalfa'))
    const hasGrain = crops.some(c => c.toLowerCase().includes('wheat') || c.toLowerCase().includes('grain'))
    const cropNotes: string[] = [`\nNEIGHBORING LAND USE (USDA CropScape ~1 mile radius): ${crops.slice(0, 5).join(', ')}`]
    if (hasCorn || hasSoy) cropNotes.push('- Adjacent CORN/SOY detected: this property competes with high-calorie neighbor food. Deer may stage on this property and feed off it. Kill plots and staging area stands are more valuable than large destination plots in this context.')
    if (hasAlfalfa) cropNotes.push('- Adjacent ALFALFA detected: extremely high-draw forage. Deer will gravitate to alfalfa fields heavily in summer and early fall. Property food plots need variety to compete — brassicas and turnips after first frost become more attractive than standing alfalfa.')
    if (!hasCorn && !hasSoy && !hasAlfalfa) cropNotes.push('- No dominant row crops detected nearby: on-property food sources are more critical here — deer cannot supplement easily off-property. Larger destination plots justified.')
    if (hasGrain) cropNotes.push('- Cereal grain (wheat/rye) nearby: excellent late-season food draw. Property management should focus on cover and water since grain is already available off-property.')
    lines.push(cropNotes.join('\n'))
  }

  // Terrain derivatives — slope/aspect from elevation grid
  if (ctx.terrainDerivatives) {
    const t = ctx.terrainDerivatives
    lines.push(`\nTERRAIN SLOPE/ASPECT ANALYSIS (computed from elevation data):`)
    lines.push(`- Average slope: ${t.avgSlopeDegrees}° (${t.slopeDescription})`)
    lines.push(`- Dominant aspect: ${t.dominantAspect}-facing`)
    if (t.slopeCategory === 'moderate' || t.slopeCategory === 'steep') {
      lines.push(`- BENCH TERRAIN likely present: look for horizontal "step" features cut into slope face — deer travel benches like roads. Stands on the downhill lip of a bench facing upslope are consistent producers.`)
      if (t.dominantAspect.includes('S') || t.dominantAspect === 'SW' || t.dominantAspect === 'SE') {
        lines.push(`- SOUTH-FACING CONFIRMATION: this aspect warms first in winter. Deer bed on south-facing slopes November through February. Stand on the north side of any bedding on these slopes with prevailing wind in mind.`)
      }
    }
  }

  // Wind Rose — Open-Meteo historical hourly wind analysis
  if (ctx.windRose) {
    const wr = ctx.windRose
    lines.push(`\nWIND ROSE (Open-Meteo historical — actual measured data, not an estimate):`)
    lines.push(`- Hunting season prevailing (Oct-Nov): ${wr.huntingSeasonPrevailing}`)
    lines.push(`- Thermal pattern: ${wr.morningThermalDirection}`)
    const monthKeys = ['Sep', 'Oct', 'Nov', 'Dec']
    const monthData = monthKeys.flatMap(m => {
      const d = wr.prevailingByMonth[m]
      return d ? [`${m}: ${d.label}`] : []
    })
    if (monthData.length > 0) lines.push(`- Monthly breakdown: ${monthData.join(' | ')}`)
    for (const rule of wr.standRules) {
      lines.push(`- ${rule}`)
    }
    lines.push(`- Data source: ${wr.dataSource}`)
  }

  // Deer Pressure — county harvest tier and season dates
  if (ctx.deerPressure) {
    const dp = ctx.deerPressure
    lines.push(`\nDEER PRESSURE & HARVEST DATA (${dp.state} — ${dp.county}):`)
    lines.push(`- Harvest tier: ${dp.harvestTier.toUpperCase()} — ${dp.annualHarvestPer1000Acres} deer/1000 acres/year`)
    lines.push(`- ${dp.pressureNotes}`)
    const seasonParts: string[] = []
    if (dp.archeryDates) seasonParts.push(`Archery: ${dp.archeryDates}`)
    if (dp.rifleDates) seasonParts.push(`Rifle/Firearm: ${dp.rifleDates}`)
    if (dp.muzzleloaderDates) seasonParts.push(`Muzzleloader: ${dp.muzzleloaderDates}`)
    if (seasonParts.length > 0) lines.push(`- Season dates: ${seasonParts.join(' | ')}`)
    lines.push(`- Management: ${dp.managementNotes}`)
    if (dp.harvestTier === 'high') {
      lines.push(`PRESSURE RULES: HIGH-PRESSURE COUNTY — educated deer, mature bucks (3.5+ yrs) are predominantly nocturnal by Oct 20. Stand placement must be deeper in timber (not field-edge). Entry/exit routes more critical than stand location itself. Minimize intrusion — hunt stands less frequently, not more.`)
    } else if (dp.harvestTier === 'moderate') {
      lines.push(`PRESSURE RULES: MODERATE PRESSURE — food source stands productive into November with careful scent management. Bucks respond to calling/decoys during rut window. Designating a sanctuary block (never hunt) increases daylight activity on surrounding huntable ground.`)
    } else if (dp.harvestTier === 'low') {
      lines.push(`PRESSURE RULES: LOW PRESSURE — food source stands produce consistent daylight deer activity. Standard hunting techniques effective. Habitat improvement (food plots, TSI, water) will directly increase buck quality and density over 3-5 year timeframe.`)
    }
  }

  lines.push('=== END SPATIAL INTELLIGENCE ===')
  return lines.join('\n')
}

function getRegionalWindDefault(bounds: Bounds): string {
  const centerLat = (bounds.north + bounds.south) / 2
  const centerLng = (bounds.east + bounds.west) / 2
  if (centerLng > -80) return 'NW/N (Northeast US prevailing)'
  if (centerLng < -104) return 'SW/W (Mountain West prevailing)'
  if (centerLat < 35) return 'SE/E (Southeast US prevailing)'
  return 'W/NW (Central/Midwest US prevailing)'
}

function buildTonyPrompt(message: string, bounds: Bounds, zoom: number, features: any[], season: string, propertyName: string, spatialContext?: SpatialContext, windDirection?: string, boundaryRing?: [number, number][] | null, chatHistory?: Array<{ role: string; text: string }>): string {
  const featureDesc = features.length > 0
    ? `\n\nThe user has already drawn ${features.length} feature(s) on the map:\n${features.slice(0, MAX_FEATURES).map((f, i) => {
        const type = f.properties?.layerType ?? f.type ?? 'unknown'
        const geomType = f.geometry?.type ?? 'unknown'
        const label = String(f.properties?.label ?? '').replace(/["""]/g, "'").slice(0, 80)
        return `  ${i + 1}. ${type} (${geomType})${label ? ` — "${label}"` : ''}`
      }).join('\n')}\nReact specifically to what they've drawn — validate, improve, or redirect as needed.`
    : '\n\nThe user has not drawn any features yet — give your initial read of the property.'

  const seasonGuidance = season ? getSeasonalGuidance(season) : ''
  const propertyLine = propertyName ? `Property name: "${propertyName}"` : ''

  const historyBlock = chatHistory && chatHistory.length > 0
    ? `\n\nPRIOR CONVERSATION CONTEXT (last ${chatHistory.length} exchanges — use this for continuity, do NOT repeat advice already given):\n${chatHistory.map(m => `${m.role === 'tony' ? 'Tony' : 'User'}: ${m.text.slice(0, 300)}`).join('\n')}\n--- END PRIOR CONTEXT ---`
    : ''

  const centerLat = (bounds.north + bounds.south) / 2
  const centerLng = (bounds.east + bounds.west) / 2
  const metersPerPixelNS = ((bounds.north - bounds.south) * 111000) / 480
  const metersPerPixelEW = ((bounds.east - bounds.west) * 111000 * Math.cos(centerLat * Math.PI / 180)) / 640
  const approxAcres = Math.round(
    ((bounds.north - bounds.south) * 111000) *
    ((bounds.east - bounds.west) * 111000 * Math.cos(centerLat * Math.PI / 180)) / 4047
  )
  const targetFoodPlotAcres = `${(approxAcres * 0.03).toFixed(1)}–${(approxAcres * 0.05).toFixed(1)}`

  // Worked coordinate examples using image quadrant centers for anchor reference
  const nwLat = bounds.north - (bounds.north - bounds.south) * 0.25
  const nwLng = bounds.west + (bounds.east - bounds.west) * 0.25
  const seLat = bounds.north - (bounds.north - bounds.south) * 0.75
  const seLng = bounds.west + (bounds.east - bounds.west) * 0.75

  const prevailingWind = windDirection ?? getRegionalWindDefault(bounds)

  // Build strict boundary constraint block if user has drawn a boundary
  const boundaryBlock = boundaryRing && boundaryRing.length >= 3
    ? `\nPROPERTY BOUNDARY — HARD RULE (NON-NEGOTIABLE):
The user ONLY owns land INSIDE the following polygon. Every single feature you place — stands, food plots, trails, water, bedding — MUST have coordinates that fall INSIDE this boundary. Do not place anything outside it. The satellite image shows neighboring land the user does not own.
Boundary polygon corners (lng, lat): ${boundaryRing.slice(0, 8).map(([lng, lat]) => `[${lng.toFixed(5)}, ${lat.toFixed(5)}]`).join(' → ')}
Before placing each feature: verify its coordinates are inside this polygon. If you cannot fit a feature inside the boundary, omit it.\n`
    : ''

  // Food plot size constraints in degrees (approximate)
  const minPlotDegLat = 0.00045 // ~50m minimum dimension
  const maxPlotDegLat = 0.00360 // ~400m maximum dimension (≈15 acres at this scale)

  return `You are Tony — a systematic, direct whitetail habitat analyst. You work through this satellite image step by step before making any recommendations. Every feature you place must land on terrain that visually matches its purpose, backed by specific visual evidence you can name.
${propertyLine}${approxAcres > 0 ? `\nVisible area: approximately ${approxAcres} acres. Target food plot coverage for this property: ${targetFoodPlotAcres} acres total (3–5% of huntable area).` : ''}${historyBlock}

${seasonGuidance}

IMAGE ORIENTATION AND COORDINATE SYSTEM — MEMORIZE BEFORE PLACING ANYTHING:
- TOP of image = NORTH (lat ${bounds.north.toFixed(5)})
- BOTTOM of image = SOUTH (lat ${bounds.south.toFixed(5)})
- LEFT of image = WEST (lng ${bounds.west.toFixed(5)})
- RIGHT of image = EAST (lng ${bounds.east.toFixed(5)})
- Image dimensions: 640px wide × 480px tall
- Each pixel ≈ ${metersPerPixelNS.toFixed(1)}m N–S and ${metersPerPixelEW.toFixed(1)}m E–W

COORDINATE FORMULA (compute exactly — never estimate from vibes):
  lng = ${bounds.west.toFixed(5)} + (pixel_x / 640) × ${(bounds.east - bounds.west).toFixed(6)}
  lat = ${bounds.north.toFixed(5)} - (pixel_y / 480) × ${(bounds.north - bounds.south).toFixed(6)}

ANCHOR-OFFSET PROCEDURE — use this for EVERY coordinate placement:
Step 1: Identify which anchor below is nearest to your target
Step 2: Estimate pixel offset from that anchor (e.g., "60px east, 40px south")
Step 3: Compute target pixel: anchor_pixel + offset
Step 4: Apply formula above to get lat/lng
Step 5: Record pixel_x and pixel_y in the feature — the server verifies these

CALIBRATION ANCHORS for this image:
  NW quadrant center → pixel(160,120) = lat ${nwLat.toFixed(5)}, lng ${nwLng.toFixed(5)}
  NE quadrant center → pixel(480,120) = lat ${nwLat.toFixed(5)}, lng ${seLng.toFixed(5)}
  SW quadrant center → pixel(160,360) = lat ${seLat.toFixed(5)}, lng ${nwLng.toFixed(5)}
  SE quadrant center → pixel(480,360) = lat ${seLat.toFixed(5)}, lng ${seLng.toFixed(5)}
  Image center       → pixel(320,240) = lat ${centerLat.toFixed(5)}, lng ${centerLng.toFixed(5)}

VISUAL IDENTIFICATION GUIDE — use these signatures when reading THIS satellite image:
- MATURE HARDWOOD FOREST: Dark green to gray-green, rounded crown shapes visible, irregular dense texture, continuous cover
- CONIFER STAND: Darker green, pointed/star-shaped crowns, sharper cleaner edges, uniform height canopy
- OPEN FIELD / CLEARED GROUND: Lighter tan, green, or brown — smooth uniform texture, often geometric edges if cultivated
- EARLY SUCCESSIONAL / BRUSH (prime bedding): Mottled green-gray, patchy irregular texture, intermediate between open and forest — denser than field, thinner than timber
- WETLAND / SATURATED GROUND: Dark coloration with irregular wet patches, possible standing water (very dark/black patches), found at terrain low points
- FOOD PLOT / CULTIVATED: Geometric shape, uniform color across entire area, typically rectangular or follows field contours
- WATER (POND/STREAM): Dark to black in direct sun, bright white if sun glare angle; streams = sinuous dark lines through terrain
- HARD EDGE: Abrupt color change where forest meets field — good, but lower value than soft edge
- SOFT EDGE (premium habitat): Gradual color gradient from dark forest → lighter brushy fringe → open field — highest deer use
- INSIDE CORNER: Where two field edges meet forming an L or V — deer funnel to inside corners; these are top stand sites
- STAGING AREA INDICATORS: Dense brush 60–150 yards back from field edge, between timber block and open ground — where mature bucks wait before entering fields

OSM-FIRST PLACEMENT RULE — when OSM has confirmed a feature at exact coordinates:
  - Use the OSM lat/lng as your anchor point, NOT a visual estimate
  - Confirmed farmland: center your food_plot polygon on the OSM farmland coordinates
  - Confirmed forest edge: place your stand within 30m of the OSM forest boundary
  - Confirmed water: your water feature goes at the OSM water coordinates
  Visual estimates may be off by 100-300m. OSM coordinates are within 5-10m. Always anchor to OSM when available.

CONFIDENCE CALIBRATION — score against these anchors (be honest, not optimistic):
  90-100: OSM confirmed feature at exact coordinates, clear satellite imagery, no occlusion
  75-89:  Visually clear terrain type, no OSM conflict, good image resolution
  50-74:  Edge zone visible but unclear if timber vs scrub, or partial shadow
  25-49:  Area in shadow/cloud, uncertain terrain type — MUST say "verify on-site" in why
  <25:    Cannot see terrain — omit the feature entirely
  NOTE: If confidence < 60, you MUST explain what you cannot see and instruct user to verify before acting.

${boundaryBlock}TERRAIN READING RULES — use OSM verified features as primary ground truth, satellite color as secondary:
- Verified OSM features (listed in SPATIAL INTELLIGENCE section below) are ground truth. Trust coordinates there over visual color inference.
- Dense canopy (forest/woodland) edges are your highest-value stand zones — place stands on the TIMBER SIDE of the edge, 20-40m inside the canopy, facing toward the open. This conceals the hunter while giving a clear shooting lane into the edge.
- EDGE TYPES: A hard edge (timber directly into field) is lower value than a soft edge (timber → brushy fringe → grass strip → field). If you see a gradual "feathered" color transition in the satellite image, call it out as a soft edge — this is premium habitat.
- INSIDE CORNERS: Where two field edges meet in an L-shape, the inside corner is almost always the highest-value stand site on the property. Flag this whenever visible.
- Open agricultural/cleared ground: primary food plot candidate. Never place food plots inside confirmed forest polygons.
- FOOD PLOT SIZE MANDATE: Never recommend a soybean plot under 2 acres or corn under 3 acres — undersized plots are eaten out before they provide hunting value. Clover and brassicas minimum 0.5 acres. Always state the acreage in the food_plot label.
- SUN EXPOSURE: Food plots need 6-8 hours direct sun. Any clearing entirely surrounded by tall timber may get less than 4 hours — flag this and note that minimum clearing width for adequate sun is approximately 1.5x the height of surrounding trees.
- SOIL TEST MANDATE: For every food plot recommendation, include in the "why": "Soil test required before seeding — target pH 6.2-6.8. Forest soils typically need 1-2 tons/acre lime."
- WATER FEATURES — STRICT RULE: Do NOT recommend ponds, impoundments, or water features unless they are explicitly confirmed in the SPATIAL INTELLIGENCE section as OSM-verified water. Dark patches, shadows, or low depressions visible in the satellite image are NOT proof of water. If OSM shows no water feature, do not place one. Water features placed in open areas will NOT be used during daylight — they require 50+ yards of timber cover on at least two sides.
- Structures/buildings: human pressure zone. No stands within 100m. Effective exclusion zone 200+ yards for mature bucks on pressured properties.
- Roads/tracks: access reference only. Stands must be upwind of roads. Every road contaminates 200+ yards on both sides with human scent — factor this into stand approach routes.
- SANCTUARY FLAG: If no area on this property appears to be 5+ contiguous acres of undisturbed dense cover away from roads and structures, call this out explicitly. No sanctuary = no mature bucks holding on the property.
- SADDLES: Where elevation shows two adjacent high points with a lower saddle between them, this is a top-5 rut location. Flag saddles with at least 15 feet of relief between the saddle floor and adjacent ridgetops.
- BENCHES: A flat terrace cut into a hillside (appears as a slight horizontal "step" in slope). Deer travel benches like highways. Stands on the downhill edge of a bench are consistent producers.
- THERMAL RULES — MORNING HUNTS: stands should be on elevated terrain, benches, or mid-slope. Cold air pools scent in drainages at dawn — a morning stand in a drainage is a mistake. EVENING HUNTS: stands in lower terrain, drainage edges, or valley floors. Thermals rise uphill in the evening — scent goes upward.
- ENTRY TRAIL RULE: Every entry trail you recommend must (1) never cross through bedding, (2) approach from downwind or crosswind of bedding, (3) use creek bottoms when available (sound and scent masking), and (4) be designed for a specific wind direction — state which wind the trail is designed for.
- STAND-TO-BEDDING DISTANCE: Early season and food-based stands: minimum 100 yards from confirmed bedding, 150 yards preferred. Rut funnel stands: 30-60 yards is acceptable. State the approximate distance in every stand's "why" field.
- CORRIDOR WIDTH: Only call something a "funnel" or "pinch point" if the wooded corridor is 50-200 yards wide. Wider than 300 yards = open block — set up on an interior feature instead.
- STAGING AREAS: Every mature buck has a staging area — a dense 1-5 acre thicket 60-150 yards from the primary food source where he waits for darkness. You CANNOT see these from summer satellite (leaves mask them) but you CAN identify WHERE they would be: look for brushy fringe or early-successional cover between the main timber block and any field edge. Staging area stands outperform food-edge stands for mature bucks. Label any stand in this 60-150 yard zone a "staging area stand" and specify how it intercepts the buck before he commits to the field.
- KILL PLOT vs DESTINATION PLOT: A kill plot is 0.1-0.5 acres of clover or brassicas tucked inside the timber edge 60-100 yards from the main food source — designed specifically to hold mature bucks in daylight, adjacent to their staging area. A destination plot is 2-5+ acres in open ground for herd nutrition, not usually hunted. When both fit the property, put the kill plot on the timber edge nearest suspected bedding; destination plot further away.
- FOOD PLOT COVERAGE RULE: Total food plot acreage should be 3-5% of huntable property acres. If this property has ~${approxAcres} visible acres, the target is ${targetFoodPlotAcres} acres in food plots. State this calculation in your reply when evaluating food plot needs.
- TSI (TIMBER STAND IMPROVEMENT): When recommending bedding area improvements where canopy is too open (deer visible 100+ yards under canopy), prescribe TSI: hinge-cut 10-20 trees per acre — cut 60% through the trunk at 4 feet height so tree falls but stays alive, creating immediate horizontal screening cover and deer browse. State "hinge-cut TSI recommended" with estimated tree density when this applies.
- SOUTH-FACING SLOPES: Identified from satellite by lighter, drier-looking ground, less dense canopy, more open appearance. These warm first in winter — deer bed on south-facing slopes in November-February. Identify these in your terrain read when slope/aspect data confirms south-facing terrain.
- FOOD PLOT % MANDATE: In every food plot recommendation, state the acreage as a % of total visible property: "X.X acres = Y% of ~${approxAcres}-acre property (target: ${targetFoodPlotAcres} acres total for this size)."
- When uncertain about terrain type, state your uncertainty and recommend the user verify on satellite before acting.

PREVAILING WIND: ${prevailingWind}
Stand approach rule: hunters must approach from DOWNWIND (stand is downwind of where deer will be). Entry trail must approach from the direction OPPOSITE to prevailing wind. Example: if wind is NW, hunter approaches from SW or S and stand faces NW toward timber.

${featureDesc}

${spatialContext ? buildSpatialContextBlock(spatialContext, bounds) + '\n\n' : ''}SCENE ANALYSIS PROTOCOL — COMPLETE STEPS 1-4 IN YOUR REPLY BEFORE ANY FEATURE OR HABITAT AUDIT:

STEP 1 — COVER TYPE INVENTORY: Look at the entire image. List every distinct cover type you see using the Visual Identification Guide above. For each type: (a) cover type name, (b) approximate % of total visible area, (c) which quadrant(s) of the image (NW/NE/SW/SE/center). Count total distinct cover types — fewer than 3 means low habitat diversity, call it out.

STEP 2 — EDGE AND TRANSITION MAPPING: Identify every edge where two cover types meet. For each edge: (a) which two cover types meet, (b) compass location in image, (c) is it a hard edge (abrupt) or soft edge (gradual brushy fringe)? Flag any inside corners where two edges form an L or V. These are your top stand candidates.

STEP 3 — TERRAIN AND DRAINAGE READ: Based on shadows, drainage patterns, and color gradients in the image: (a) does the property appear to slope toward any compass direction? (b) are there any visible ridges, draws, or low creek bottoms? (c) do you see any potential saddle points where a ridge narrows between two higher points?

STEP 4 — WATER AND LIMITING FACTOR: Identify any confirmed water (dark/reflective patches + OSM confirmation). Then state the single biggest limiting factor on this property right now: is it food, cover, water, sanctuary, or access? This shapes the priority order for your recommendations.

State your Step 1-4 findings concisely in your reply (2-4 sentences each), then proceed to the Habitat Audit below.

HABITAT AUDIT — YOU MUST COMPLETE THIS BEFORE PLACING ANY FEATURE:
This is the 5-factor check a professional consultant runs on every property. State each finding explicitly in your reply:

1. EDGE DENSITY AND COVER DIVERSITY: How many distinct cover types are visible? (timber, brush/scrub, open field, transitional edge). Count them. A property with fewer than 3 cover types needs diversity work before stand placement pays off. Identify hard edges (abrupt timber-to-field transition) vs soft edges (feathered transition with brushy fringe) — soft edges are higher value. Flag any L-shaped inside corners where two field edges meet (top-5 stand locations).

2. SANCTUARY ASSESSMENT: Is there a block of 5+ contiguous acres of dense cover that is far from roads, structures, and likely access points? If yes, identify it. If no, flag this explicitly — "No sanctuary identified: no mature bucks will hold on this property without one." Sanctuary is the single most important habitat element.

3. WATER AVAILABILITY: Based on OSM verified data only — is water confirmed within 400 yards of the likely bedding area? If yes, state distance. If no, state "No confirmed water within range — water development is a priority in summer months."

4. TERRAIN FEATURES (saddles, benches, pinch points, funnels): Identify any saddles (elevation low point between two adjacent high points — top rut location if 15+ feet of relief). Identify any benches (flat horizontal terrace cut into a hillside — deer travel these like roads). Identify any pinch points or funnels (wooded corridors 50-200 yards wide connecting two larger blocks). These terrain features outrank food sources for mature buck stand placement Oct 15-Nov 20.

5. HUMAN PRESSURE MAP: Trace all roads, two-tracks, and structures. Deer near paved roads shift nocturnal within 48 hours of regular traffic. The huntable sanctuary is what remains inside the property boundary, at least 200 yards from all roads and structures.

You MUST address all 5 audit points in your reply text before describing any feature. This is non-negotiable.

User says: "${message}"

PRE-PLACEMENT VERIFICATION — for each feature before including it:
[ ] Is the coordinate INSIDE the user's property boundary? (This is the #1 check — if outside boundary, DO NOT include it)
[ ] Is the center coordinate on the correct terrain type?
[ ] Is the coordinate within image bounds? (lng ${bounds.west.toFixed(5)}–${bounds.east.toFixed(5)}, lat ${bounds.south.toFixed(5)}–${bounds.north.toFixed(5)})
[ ] STAND: Is it at least 100 yards from confirmed bedding (or 30 yards minimum during rut only)? State the estimated distance in "why".
[ ] STAND: Is it positioned on the timber side of the edge (not open ground)? Is it 20-40m inside canopy facing the open?
[ ] STAND: Does the entry trail approach from downwind/crosswind of bedding, NEVER crossing through bedding or feeding areas?
[ ] STAND: Does the thermal strategy match time-of-day? (Morning = elevated/mid-slope; Evening = lower slope/drainage edge)
[ ] FOOD PLOT: Is it on open ground with estimated 6+ hours of sun (not surrounded by tall timber on all sides)?
[ ] FOOD PLOT: Is it above the drainage bottom (not in a natural depression that will collect standing water)?
[ ] FOOD PLOT: Is it the minimum viable size for the species? (soybeans 2 acres min, corn 3 acres min, clover/brassicas 0.5 acres min)
[ ] FOOD PLOT: Does the "why" field include a soil test recommendation?
[ ] FOOD PLOT: Is the polygon at a reasonable size? (food_plot: 0.5–15 acres ≈ lat span ${minPlotDegLat.toFixed(5)}–${maxPlotDegLat.toFixed(5)}°; bedding: 2–50 acres)
[ ] WATER: Is it confirmed by OSM data? If not, omit it. Does it have 50+ yards of timber cover on at least two sides?
[ ] BEDDING IMPROVEMENT: Is the proposed bedding area at least 5 contiguous acres? Is it the furthest point from roads and structures?
If any check fails, adjust or drop the feature.

CRITICAL OUTPUT RULES:
- Respond ONLY with raw valid JSON — no markdown, no code fences, zero text outside JSON
- "stand" features MUST use geometry type "Point" — a stand is a single tree or blind, not a polygon
- "trail" features MUST use geometry type "LineString" — minimum 3 coordinate pairs
- "food_plot" and "bedding" features MUST use geometry type "Polygon" — ring must close (first coordinate = last coordinate)
- "water" features use geometry type "Point" for a water source or "Polygon" for a pond/impoundment
- Reference actual visible terrain in your reply — name what you see (field edge, timber corner, creek bottom, bench, saddle, etc.)
- Use compass directions (NW corner, SE field edge, etc.) consistently

Exact JSON format:
{
  "reply": "Terrain read: [your 5-point terrain summary]. [Then your specific recommendations. Reference visible terrain. Use compass directions. Be direct.]",
  "features": [
    {
      "type": "stand",
      "label": "Timber edge stand — NE corner",
      "why": "Timber edge meets open field at NE, 50 yards downwind of bedding, clean approach from S",
      "confidence": 85,
      "priority": 1,
      "pixel_x": 420,
      "pixel_y": 145,
      "geometry": {
        "type": "Point",
        "coordinates": [lng, lat]
      }
    },
    {
      "type": "food_plot",
      "label": "3-acre brassica plot — SE clearing",
      "why": "Open tan ground SE quadrant, timber wind block on north side, 80 yards from creek bedding",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[lng, lat], [lng, lat], [lng, lat], [lng, lat], [lng, lat]]]
      }
    },
    {
      "type": "trail",
      "label": "Access trail — S entry to stand",
      "why": "Downwind approach from S, stays out of bedding timber, connects parking to stand",
      "geometry": {
        "type": "LineString",
        "coordinates": [[lng, lat], [lng, lat], [lng, lat]]
      }
    }
  ]
}

Feature types: "food_plot" (Polygon), "bedding" (Polygon), "trail" (LineString), "stand" (Point), "water" (Point or Polygon), "mineral" (Point), "scrape_line" (LineString), "travel_corridor" (LineString)
Return 3-5 features ranked by seasonal priority. Place every feature on terrain that visually matches its purpose.
Each feature MUST include:
- "confidence": integer 0-100 (how certain you are this placement is correct given satellite clarity and OSM data)
- "priority": integer 1-5 (1 = do this first this season)
Low confidence (<60): you cannot clearly see the terrain — say so in "why" and tell user to verify on-site.

"why" field requirements by feature type:
- STAND: state (1) estimated distance from nearest bedding, (2) which wind direction this stand is designed for, (3) thermal strategy (morning/evening), (4) what the hunter is covering (field edge / saddle / pinch point / etc.)
- FOOD PLOT: state (1) estimated acreage, (2) sun exposure estimate, (3) "Soil test required — target pH 6.2-6.8", (4) species recommendation for this season
- TRAIL: state (1) which wind direction this approach is designed for, (2) confirmation it does not cross bedding or feeding areas, (3) whether a creek/drainage bottom approach is available
- BEDDING: state (1) approximate acreage, (2) why this location is sanctuary-quality (distance from roads/structures), (3) recommended enhancement (hinge cuts, native grass planting, etc.)
- WATER: state (1) OSM confirmation status, (2) cover situation on approach sides, (3) distance to nearest bedding`
}

function extractJsonFromText(text: string): string {
  // Try markdown fences first
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    const candidate = fenceMatch[1].trim()
    try { JSON.parse(candidate); return candidate } catch {}
  }
  // Try raw JSON object
  const objMatch = text.match(/\{[\s\S]*\}/)
  if (objMatch) {
    const candidate = objMatch[0]
    try { JSON.parse(candidate); return candidate } catch {
      // Try to recover partial JSON by finding last complete closing brace
      const lastBrace = candidate.lastIndexOf('}')
      if (lastBrace > 0) {
        const truncated = candidate.slice(0, lastBrace + 1)
        try { JSON.parse(truncated); return truncated } catch {}
      }
    }
  }
  return text.trim()
}

function isCoordInBounds(coord: number[], bounds: Bounds): boolean {
  const [lng, lat] = coord
  return typeof lng === 'number' && typeof lat === 'number'
    && lng >= bounds.west && lng <= bounds.east
    && lat >= bounds.south && lat <= bounds.north
}

// Ray-casting point-in-polygon for boundary enforcement
function isPointInPolygon(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function isFeatureInBoundary(f: any, ring: [number, number][]): boolean {
  const { type, coordinates } = f.geometry
  const checkPoint = (c: number[]) => isPointInPolygon(c[0], c[1], ring)
  if (type === 'Point') return checkPoint(coordinates)
  // Require ALL vertices inside boundary — partial containment is not acceptable
  if (type === 'LineString') return (coordinates as number[][]).every(checkPoint)
  if (type === 'Polygon') return (coordinates[0] as number[][])?.every(checkPoint)
  return true
}

export async function POST(req: NextRequest) {
  // Global deadline — race everything against this so we always respond before Vercel's hard kill
  const globalAbort = new AbortController()
  const globalTimer = setTimeout(() => globalAbort.abort(), GLOBAL_DEADLINE_MS)

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests', reply: 'Slow down — Tony can only handle so many questions per minute. Try again shortly.' }, { status: 429 })
    }

    const nvidiaKey = process.env.NVIDIA_API_KEY
    const googleKey = process.env.GOOGLE_AI_KEY || process.env.GOOGLE_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!nvidiaKey && !googleKey && !openaiKey && !anthropicKey) {
      return NextResponse.json({ error: 'Server configuration error', reply: 'Tony needs a fresh API key — contact support to get Tony back online.' }, { status: 500 })
    }

    const body = await req.json()
    const { message, bounds, zoom, features = [], season = '', propertyName = '', spatialContext, chatHistory } = body

    // Validate and sanitize inputs
    const rawMsg = typeof message === 'string' ? message.trim().slice(0, MAX_MESSAGE_LENGTH).replace(/["""]/g, "'") : ''
    if (!rawMsg) return NextResponse.json({ error: 'Message required' }, { status: 400 })
    // Augment very short messages so LLMs don't refuse or hallucinate without context
    const trimmedMsg = rawMsg.length < 20
      ? `Analyze this hunting property and ${rawMsg}. Recommend stand locations, food plots, and bedding areas based on what you see.`
      : rawMsg
    if (!isValidBounds(bounds)) return NextResponse.json({ error: 'Valid map bounds required' }, { status: 400 })
    const safeFeatures = Array.isArray(features) ? features.slice(0, MAX_FEATURES) : []
    const safePropertyName = typeof propertyName === 'string' ? propertyName.replace(/[^a-zA-Z0-9 '\-_.]/g, '').slice(0, 100) : ''

    // Extract boundary polygon if user has drawn one
    const boundaryFeature = safeFeatures.find((f: any) =>
      (f.properties?.layerType === 'boundary' || f.type === 'boundary') &&
      f.geometry?.type === 'Polygon'
    )
    const boundaryRing: [number, number][] | null = boundaryFeature?.geometry?.coordinates?.[0] ?? null

    // Fetch satellite image and spatial context in parallel — neither waits on the other
    const esriUrl = `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export` +
      `?bbox=${bounds.west},${bounds.south},${bounds.east},${bounds.north}` +
      `&bboxSR=4326&imageSR=4326&size=640,480&format=png&f=image`

    const SPATIAL_TIMEOUT_MS = 7_000 // Spatial must resolve within 7s or Tony fires without it

    const [imgResult, spatialResult] = await Promise.allSettled([
      fetch(esriUrl, { signal: AbortSignal.any([AbortSignal.timeout(ESRI_TIMEOUT_MS), globalAbort.signal]) }),
      Promise.race([
        fetchSpatialData(bounds),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SpatialTimeout')), SPATIAL_TIMEOUT_MS)),
      ]).catch((): SpatialContext | undefined => undefined),
    ])

    if (imgResult.status === 'rejected' || !imgResult.value.ok) {
      const isTimeout = imgResult.status === 'rejected' && imgResult.reason instanceof Error && imgResult.reason.name === 'TimeoutError'
      return NextResponse.json({
        error: 'Map image unavailable',
        reply: isTimeout
          ? "Satellite image took too long to load. Move the map slightly and try again."
          : "Couldn't pull the satellite image. Check your connection and try again."
      }, { status: 500 })
    }

    let imgBase64: string
    try {
      imgBase64 = Buffer.from(await imgResult.value.arrayBuffer()).toString('base64')
    } catch {
      return NextResponse.json({
        error: 'Map image unavailable',
        reply: 'Satellite image timed out while downloading. Move the map slightly and try again.',
      }, { status: 500 })
    }
    // spatialResult is always 'fulfilled' (Promise.allSettled + inner .catch)
    const resolvedSpatial = spatialResult.status === 'fulfilled' ? spatialResult.value : undefined

    let rawText = ''
    try {
      const safeChatHistory = Array.isArray(chatHistory)
        ? chatHistory.slice(-6).map((m: unknown) => {
            const msg = m as Record<string, unknown>
            const role = typeof msg.role === 'string' ? msg.role : 'user'
            return { role: (role === 'tony' || role === 'user') ? role : 'user', text: typeof msg.text === 'string' ? msg.text.slice(0, 400) : '' }
          }).filter(m => m.text)
        : undefined

      const tonyPrompt = buildTonyPrompt(
        trimmedMsg, bounds, zoom ?? 14, safeFeatures,
        typeof season === 'string' ? season : '',
        safePropertyName,
        resolvedSpatial,
        resolvedSpatial?.windDirection,
        boundaryRing,
        safeChatHistory,
      )

      let usedGemini = false
      let usedAnthropic = false
      let usedOpenAI = false

      // 1. Gemini 2.0 Flash — PRIMARY (fast vision, no thinking overhead)
      if (googleKey) {
        try {
          const geminiPromise = fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': googleKey },
              body: JSON.stringify({
                contents: [{ parts: [
                  { inline_data: { mime_type: 'image/png', data: imgBase64 } },
                  { text: tonyPrompt }
                ]}],
                generationConfig: { maxOutputTokens: 8192 },
              }),
            }
          )
          const result = await Promise.race([
            geminiPromise,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TonyTimeout')), GEMINI_TIMEOUT_MS)),
          ])
          if (!result.ok) throw new Error(`Gemini ${result.status}`)
          const geminiJson = await result.json()
          rawText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
          if (rawText) usedGemini = true
          else throw new Error('Gemini empty response')
        } catch (geminiErr: unknown) {
          console.warn('[chat] Gemini failed, falling back to Anthropic:', geminiErr instanceof Error ? geminiErr.message : geminiErr)
        }
      }

      // 2. NVIDIA Llama 3.2 90B Vision — free fallback (moved before paid tiers)
      if (!usedGemini && nvidiaKey) {
        try {
          const nvidiaPromise = fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${nvidiaKey}` },
            body: JSON.stringify({
              model: 'meta/llama-3.2-90b-vision-instruct',
              messages: [{
                role: 'user',
                content: [
                  { type: 'text', text: tonyPrompt },
                  { type: 'image_url', image_url: { url: `data:image/png;base64,${imgBase64}` } },
                ],
              }],
              max_tokens: 4096,
              temperature: 0.3,
            }),
          })
          const result = await Promise.race([
            nvidiaPromise,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TonyTimeout')), 25_000)),
          ])
          if (!result.ok) throw new Error(`NVIDIA ${result.status}`)
          const nvidiaJson = await result.json()
          rawText = nvidiaJson.choices?.[0]?.message?.content?.trim() ?? ''
          if (rawText) { usedGemini = true } // reuse flag to skip further fallbacks
          else throw new Error('NVIDIA empty response')
        } catch (nvidiaErr: unknown) {
          console.warn('[chat] NVIDIA failed, falling back to Anthropic:', nvidiaErr instanceof Error ? nvidiaErr.message : nvidiaErr)
        }
      }

      // 3. Anthropic Sonnet 4.6 — paid fallback: tool_use schema for strict JSON
      if (!usedGemini && anthropicKey) {
        try {
          const anthropicPromise = fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': anthropicKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6',
              max_tokens: 5000,
              system: TONY_SYSTEM_PROMPT,
              tools: [HABITAT_TOOL],
              tool_choice: { type: 'tool', name: 'place_habitat_features' },
              messages: [{
                role: 'user',
                content: [
                  { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imgBase64 } },
                  { type: 'text', text: tonyPrompt },
                ],
              }],
            }),
          })
          const result = await Promise.race([
            anthropicPromise,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TonyTimeout')), ANTHROPIC_TIMEOUT_MS)),
          ])
          if (!result.ok) throw new Error(`Anthropic ${result.status}`)
          const anthropicJson = await result.json()
          const toolBlock = anthropicJson.content?.find((c: any) => c.type === 'tool_use')
          if (toolBlock?.input) {
            rawText = JSON.stringify(toolBlock.input)
          } else {
            rawText = anthropicJson.content?.find((c: any) => c.type === 'text')?.text?.trim() ?? ''
          }
          if (rawText) usedAnthropic = true
          else throw new Error('Anthropic empty response')
        } catch (anthropicErr: unknown) {
          console.warn('[chat] Anthropic failed, falling back to OpenAI:', anthropicErr instanceof Error ? anthropicErr.message : anthropicErr)
        }
      }

      // 4. OpenAI — final fallback
      if (!usedGemini && !usedAnthropic && openaiKey) {
        try {
          const openaiPromise = fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: [
                { role: 'system', content: 'You are a JSON API. You MUST respond with raw valid JSON only — no markdown, no code fences, no prose before or after. The JSON must have "reply" (string) and "features" (array) keys.' },
                { role: 'user', content: [
                  { type: 'text', text: tonyPrompt },
                  { type: 'image_url', image_url: { url: `data:image/png;base64,${imgBase64}` } }
                ]}
              ],
              max_tokens: 4096,
              temperature: 0.3,
            }),
          })
          const result = await Promise.race([
            openaiPromise,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TonyTimeout')), OPENAI_TIMEOUT_MS)),
          ])
          if (!result.ok) throw new Error(`OpenAI ${result.status}`)
          const openaiJson = await result.json()
          rawText = openaiJson.choices?.[0]?.message?.content?.trim() ?? ''
          if (rawText) usedOpenAI = true
        } catch (openaiErr: unknown) {
          console.warn('[chat] OpenAI failed:', openaiErr instanceof Error ? openaiErr.message : openaiErr)
        }
      }

      if (!usedGemini && !usedAnthropic && !usedOpenAI) {
        throw new Error('TonyTimeout') // all providers failed
      }
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.message === 'TonyTimeout'
      return NextResponse.json({
        error: 'AI timeout',
        reply: isTimeout
          ? "Tony's taking too long — probably a slow connection. Try again."
          : "Tony is unavailable right now. Try again in a moment."
      }, { status: 503 })
    }

    let reply = rawText
    let tonyFeatures: any[] = []

    try {
      const jsonStr = extractJsonFromText(rawText)
      const parsed = JSON.parse(jsonStr)
      tonyFeatures = Array.isArray(parsed.features) ? parsed.features : []
      if (parsed.reply) {
        reply = parsed.reply
      } else if (tonyFeatures.length > 0) {
        reply = `Identified ${tonyFeatures.length} feature recommendation(s). Check the map.`
      } else {
        reply = rawText || 'No response from Tony.'
      }
    } catch {
      reply = rawText || 'No response from Tony.'
    }

    // Resolve OSM features for conflict checking — use server-fetched spatial data
    const osmFeatures: OsmFeature[] = Array.isArray(resolvedSpatial?.osmFeatures)
      ? resolvedSpatial.osmFeatures
      : []

    // Phase 1: Recalculate coordinates from pixel positions before any other checks
    tonyFeatures = tonyFeatures.map(f => recalcCoordsFromPixels(f, bounds))

    // Filter annotations to valid geometry within bounds, then flag terrain conflicts
    const annotations = tonyFeatures
      .filter(f => f.geometry?.type && Array.isArray(f.geometry?.coordinates))
      .filter(f => {
        const { type, coordinates } = f.geometry
        if (type === 'Point') return isCoordInBounds(coordinates, bounds)
        if (type === 'LineString') return coordinates.some((c: number[]) => isCoordInBounds(c, bounds))
        if (type === 'Polygon') return coordinates[0]?.some((c: number[]) => isCoordInBounds(c, bounds))
        return false
      })
      .filter(f => {
        const validGeomTypes: Record<string, string[]> = {
          stand: ['Point'],
          water: ['Point', 'Polygon'],
          food_plot: ['Polygon'],
          bedding: ['Polygon'],
          trail: ['LineString'],
          mineral: ['Point'],
          scrape_line: ['LineString'],
          travel_corridor: ['LineString'],
        }
        const allowed = validGeomTypes[f.type]
        if (!allowed) return true // unknown type, allow through
        return allowed.includes(f.geometry.type)
      })
      .filter(f => !boundaryRing || isFeatureInBoundary(f, boundaryRing))
      .map(f => {
        // Auto-close unclosed polygons; drop degenerate LineStrings
        if (f.geometry.type === 'Polygon') {
          const ring: [number, number][] = f.geometry.coordinates[0]
          if (ring && ring.length > 0) {
            const first = ring[0]
            const last = ring[ring.length - 1]
            if (first[0] !== last[0] || first[1] !== last[1]) {
              f = { ...f, geometry: { ...f.geometry, coordinates: [[...ring, first]] } }
            }
          }
        }
        if (f.geometry.type === 'LineString' && f.geometry.coordinates.length < 3) {
          return null
        }
        return f
      })
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .map(f => {
        // Terrain conflict check: only run on stand-type features where placement matters most
        let conflictWarning: string | undefined
        if (osmFeatures.length > 0 && (f.type === 'stand' || f.type === 'food_plot')) {
          const geom = f.geometry
          let checkCoord: [number, number] | null = null
          if (geom.type === 'Point') checkCoord = geom.coordinates as [number, number]
          else if (geom.type === 'Polygon') {
            // Use centroid of the first ring for a polygon check
            const ring = geom.coordinates[0] as [number, number][]
            if (ring.length > 0) {
              const lngSum = ring.reduce((s: number, c: [number, number]) => s + c[0], 0)
              const latSum = ring.reduce((s: number, c: [number, number]) => s + c[1], 0)
              checkCoord = [lngSum / ring.length, latSum / ring.length]
            }
          }
          if (checkCoord) {
            const warning = checkTerrainConflict(checkCoord, osmFeatures)
            if (warning) conflictWarning = warning
          }
        }

        const confidence = typeof f.confidence === 'number' ? Math.max(0, Math.min(100, Math.round(f.confidence))) : undefined
        const priority = typeof f.priority === 'number' ? Math.max(1, Math.min(5, Math.round(f.priority))) : undefined

        // Phase 1: OSM bbox terrain type validation
        const terrainConflict = validateTerrainType(f, osmFeatures)
        const effectiveConflict = conflictWarning ?? terrainConflict

        return {
          type: f.type ?? 'stand',
          label: f.label ?? '',
          why: f.why ?? '',
          confidence,
          priority,
          conflictWarning: effectiveConflict,
          geojson: {
            type: 'Feature',
            geometry: f.geometry,
            properties: { type: f.type, label: f.label, why: f.why, confidence, priority, conflictWarning: effectiveConflict }
          }
        }
      })

    // Phase 1: Feature spacing check
    const spacedAnnotations = checkFeatureSpacing(annotations).map(f => ({
      ...f,
      conflictWarning: f.conflictWarning ?? f.spacingWarning,
    }))

    // Post-validation removed — Tony's primary call + OSM bbox checks already enforce placement rules.
    clearTimeout(globalTimer)
    return NextResponse.json({ reply, annotations: spacedAnnotations })
  } catch (err) {
    clearTimeout(globalTimer)
    console.error('[chat] error:', err)
    const isGlobalTimeout = globalAbort.signal.aborted
    return NextResponse.json({
      error: isGlobalTimeout ? 'AI timeout' : 'Server error',
      reply: isGlobalTimeout
        ? "Tony's thinking hard — took too long this time. Move the map slightly and try again."
        : 'Tony is unavailable right now. Try again.'
    }, { status: isGlobalTimeout ? 503 : 500 })
  }
}
