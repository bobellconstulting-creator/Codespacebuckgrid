import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { OsmFeature, SpatialContext } from '../../../lib/spatial'
import { fetchSpatialData } from '../../../lib/spatial'
import { fetchNlcdPoint } from '../../../lib/nlcd'
import type { PlacementCandidate, PlacementResult, PlacementObservation } from '../../../lib/placement/engine'
import { generatePlacements, candidateGeometry } from '../../../lib/placement/engine'
import { parseTonyV2 } from '../../../lib/tonyJson'
import { get as httpsGet } from 'node:https'

// Raw HTTPS download — bypasses Next's patched fetch, whose internal response
// clone deadlocks on binary bodies in dev and stalls the Esri image pull.
function fetchBinary(url: string, timeoutMs: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = httpsGet(url, res => {
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    })
    req.setTimeout(timeoutMs, () => {
      const err = new Error('TimeoutError')
      err.name = 'TimeoutError'
      req.destroy(err)
    })
    req.on('error', reject)
  })
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_MESSAGE_LENGTH = 2000
const MAX_FEATURES = 50
const ESRI_TIMEOUT_MS = 12000
const HAIKU_TIMEOUT_MS = 25000
const ANTHROPIC_TIMEOUT_MS = 50000
const GEMINI_TIMEOUT_MS = 20000 // fail fast — the deterministic engine guarantees output, so don't make the user wait a minute for a slow model
const OPENAI_TIMEOUT_MS = 25000
const OLLAMA_TIMEOUT_MS = 45000
// Global deadline — ensures we always respond before Vercel's 120s hard kill
const GLOBAL_DEADLINE_MS = 108_000

// ─── Tony v2 system prompt — relative positioning, no GPS output ──────────────
const TONY_SYSTEM_PROMPT = `You are Tony — a whitetail habitat consultant for BuckGrid Pro. You're the expert a landowner is lucky to have walking their property: warm, genuinely helpful, plain-spoken, and specific. You know the property in front of you and you give real advice, kindly.

CRITICAL OUTPUT RULE: NEVER output raw GPS coordinates. Always describe where features go using compass directions relative to the property boundary (north, northeast, east, southeast, south, southwest, west, northwest, center). The client handles coordinate translation — your job is analysis and reasoning, not GPS math.

HOW YOU TALK TO CLIENTS — FRIENDLY EXPERT, NOT A LECTURER:
- Answer the question they actually asked, first and directly. If they ask "what do I plant in this sanctuary," answer THAT — don't swerve into your own agenda. Add a helpful next thought after, never instead of, their answer.
- Be warm and encouraging. The client is putting real work into their land — respect it. Note what's already working, then build on it. No scolding, no "you're doing it wrong."
- Be decisive and specific without being pushy: make a clear call and say why ("here's what I'd do, and the reason"), but as friendly advice, not an order. Say "walk it to confirm" at most once, and only when it genuinely matters. Never "you know better than I do."
- The owner's field intel — water, food plots, bedding, stands they've drawn — is GROUND TRUTH that already EXISTS. Anchor your plan to it and reference it by location. Never grade an existing feature as if you'd proposed it ("well placed"), and never re-recommend something they already have. Your value is the NEW moves that work with what's there — and gently flagging anything existing that's hurting them, with the fix.
- NEVER quote a percentage quota or "target acreage." Size every recommendation to its JOB on THIS property (see sizing rules). Only call a plot too big or too small when the property gives a concrete reason, and say it kindly — otherwise leave the owner's acreage alone.
- You don't fabricate. If the data can't confirm water or a feature, say so plainly and kindly instead of inventing it.

WHAT YOU KNOW — proven whitetail habitat design (apply the principle in your own friendly voice; teach it, don't name-drop):
- SECURITY COVER IS KING: on most properties — especially open ag country — quality bedding/security cover is the single biggest lever. A mature buck demands security and will travel far to feed as long as he can bed safe. When a property is short on thick cover, that's usually the #1 fix, ahead of adding more food.
- BUILD BEDDING FAST WITH NATIVE GRASS: switchgrass and other native warm-season grasses (big bluestem, Indiangrass) create thick, secure bedding fast — often huntable the first season — and do best on south-facing slopes for thermal cover. Hinge-cutting achieves the same inside timber.
- DESIGN THE PROPERTY ON PURPOSE: engineer deer movement instead of hoping for it — connect bedding to food with defined travel corridors and staging areas, then place stands with dedicated entry/exit access so a buck passes the stand and your scent/access never blows him out. Design first, build to the design.
- WATER HOLES HOLD AND PATTERN DEER: a small, secluded water hole is a high-value, easy add — especially early season and in heat — and helps pattern movement. Recommend NEW water only where the property lacks it; never re-recommend water the owner already has.
- SANCTUARY IS NEVER-ENTER GROUND: the secure core you do not hunt and do not plant — its entire value is that deer feel zero pressure there.

ABSOLUTE RULES (violating any is a critical failure):
1. NEVER place any feature outside the user's stated property boundary
2. NEVER recommend water features unless OSM data explicitly confirms them
3. Every feature MUST include confidence and season fields
4. NEVER place a stand or food_plot inside a confirmed OSM forest polygon or water polygon
5. Every response MUST complete the 4-step Scene Analysis and 5-factor Habitat Audit before placing features
6. CITE VISUAL EVIDENCE: every recommendation must name the specific location using compass direction and cover type
7. QUANTIFY helpfully: use real numbers — acreage, distances in yards, soil pH targets — each sized to the feature's job, never as a percentage quota of the property`

// ─── v2 Zone and StandSite types ──────────────────────────────────────────────
type RelativePosition = 'north' | 'northeast' | 'east' | 'southeast' | 'south' | 'southwest' | 'west' | 'northwest' | 'center'
type ZoneType = 'food_plot' | 'kill_plot' | 'access_route' | 'bedding' | 'stand_site' | 'water' | 'staging_area' | 'sanctuary'
type RelativeSize = 'tiny' | 'small' | 'medium' | 'large'
type ConfidenceLevel = 'high' | 'medium' | 'low'
type SeasonLabel = 'all' | 'spring' | 'summer' | 'fall' | 'winter'

interface TonyZone {
  id: string
  name: string
  type: ZoneType
  relative_position: RelativePosition
  relative_size: RelativeSize
  description: string
  confidence: ConfidenceLevel
  season: SeasonLabel
  /** Grounded mode: id of the engine candidate this zone references */
  candidate_id?: string
  /** Grounded mode: real geometry computed by the placement engine */
  geometry?: { type: string; coordinates: any }
  acres?: number
  grounded?: boolean
}

interface StandSite {
  id: string
  name: string
  relative_position: RelativePosition
  wind_direction: string
  rating: number
  description: string
  candidate_id?: string
  geometry?: { type: string; coordinates: any }
  grounded?: boolean
}

// ─── OSM bbox terrain validation — check coord isn't inside a forest/water polygon ──
function isPointInOsmBbox(coord: [number, number], f: OsmFeature): boolean {
  if (!f.bbox) return false
  const [minLng, minLat, maxLng, maxLat] = f.bbox
  return coord[0] >= minLng && coord[0] <= maxLng && coord[1] >= minLat && coord[1] <= maxLat
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

// Persistent rate limiter + free tier enforcement via Upstash Redis
// Falls back to in-memory if KV not configured (local dev)
const _rateLimitFallback = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_S = 60
const FREE_TIER_DAILY_LIMIT = 3

const _KV_URL = process.env.KV_REST_API_URL || ''
const _KV_TOKEN = process.env.KV_REST_API_TOKEN || ''

async function _kvIncr(key: string): Promise<number> {
  if (!_KV_URL || !_KV_TOKEN) return 0
  try {
    const r = await fetch(`${_KV_URL}/incr/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${_KV_TOKEN}` },
    })
    if (!r.ok) return 0
    const j = await r.json() as { result?: number }
    return j.result ?? 0
  } catch { return 0 }
}

async function _kvExpire(key: string, seconds: number): Promise<void> {
  if (!_KV_URL || !_KV_TOKEN) return
  try {
    await fetch(`${_KV_URL}/expire/${encodeURIComponent(key)}/${seconds}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${_KV_TOKEN}` },
    })
  } catch {}
}

async function checkRateLimit(ip: string): Promise<boolean> {
  const key = `rl:${ip}`
  if (!_KV_URL || !_KV_TOKEN) {
    const now = Date.now()
    const entry = _rateLimitFallback.get(key)
    if (!entry || now > entry.resetAt) {
      _rateLimitFallback.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_S * 1000 })
      return true
    }
    if (entry.count >= RATE_LIMIT_MAX) return false
    entry.count++
    return true
  }
  const count = await _kvIncr(key)
  if (count === 1) await _kvExpire(key, RATE_LIMIT_WINDOW_S)
  return count <= RATE_LIMIT_MAX
}

async function checkFreeTier(ip: string): Promise<boolean> {
  if (!_KV_URL || !_KV_TOKEN) return true
  const today = new Date().toISOString().slice(0, 10)
  const key = `ft:${ip}:${today}`
  const count = await _kvIncr(key)
  if (count === 1) await _kvExpire(key, 86400)
  return count <= FREE_TIER_DAILY_LIMIT
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

  // OSM land cover — described in compass terms for v2 relative positioning
  if (ctx.osmFeatures.length > 0) {
    const osmLines: string[] = ['VERIFIED LAND COVER (OpenStreetMap) — use compass directions to reference these:']
    const byKind: Record<string, typeof ctx.osmFeatures> = {}
    for (const f of ctx.osmFeatures) {
      byKind[f.kind] = byKind[f.kind] ?? []
      byKind[f.kind].push(f)
    }

    // Helper: convert lat/lng to compass quadrant relative to property center
    const centerLat = (bounds.north + bounds.south) / 2
    const centerLng = (bounds.east + bounds.west) / 2
    function toCompass(lat: number, lng: number): string {
      const ns = lat > centerLat ? 'north' : 'south'
      const ew = lng > centerLng ? 'east' : 'west'
      const latFrac = Math.abs(lat - centerLat) / ((bounds.north - bounds.south) / 2)
      const lngFrac = Math.abs(lng - centerLng) / ((bounds.east - bounds.west) / 2)
      if (latFrac < 0.25 && lngFrac < 0.25) return 'center'
      if (latFrac > lngFrac * 1.5) return ns
      if (lngFrac > latFrac * 1.5) return ew
      return `${ns}${ew}`
    }

    if (byKind.water?.length) {
      const dirs = byKind.water.slice(0, 3).map(f => toCompass(f.point[1], f.point[0])).join(', ')
      osmLines.push(`- WATER (${byKind.water.length}): ${dirs} portion of property — DO NOT place stands or food plots within 20m. Verify on satellite.`)
    }
    if (byKind.wetland?.length) {
      const dirs = byKind.wetland.slice(0, 2).map(f => toCompass(f.point[1], f.point[0])).join(', ')
      osmLines.push(`- WETLAND (${byKind.wetland.length}): ${dirs} — Poor access, soft ground. Avoid stands and plots within 20m.`)
    }
    if (byKind.building?.length) {
      const dirs = byKind.building.slice(0, 3).map(f => toCompass(f.point[1], f.point[0])).join(', ')
      osmLines.push(`- STRUCTURE (${byKind.building.length}): ${dirs} — Human pressure zone. DO NOT place stands within 100m.`)
    }
    if (byKind.forest?.length) {
      osmLines.push(`- FOREST (${byKind.forest.length} polygon(s)): Confirmed timber cover. Use edges for stand placement — place stands on the OPEN GROUND side of these forest boundaries, not inside canopy.`)
    }
    if (byKind.road?.length) {
      const dirs = byKind.road.slice(0, 2).map(f => toCompass(f.point[1], f.point[0])).join(', ')
      osmLines.push(`- ROAD (${byKind.road.length}): ${dirs} — Use as access route reference. Stands must be placed UPWIND of roads, never downwind.`)
    }
    if (byKind.farmland?.length) {
      const dirs = byKind.farmland.slice(0, 3).map(f => toCompass(f.point[1], f.point[0])).join(', ')
      osmLines.push(`- FARMLAND (${byKind.farmland.length}): ${dirs} — CONFIRMED food source field(s). The EDGE of this field adjacent to timber is your #1 food plot / stand candidate.`)
    }
    if (byKind.scrub?.length) {
      const dirs = byKind.scrub.slice(0, 2).map(f => toCompass(f.point[1], f.point[0])).join(', ')
      osmLines.push(`- SCRUB/THICKET (${byKind.scrub.length}): ${dirs} — Dense brushy cover. Prime bedding zone. Stands on downwind edge are excellent rut sites.`)
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
      const ns = py < 240 ? 'north' : 'south'
      const ew = px > 320 ? 'east' : 'west'
      return `${ns}${ew} (${p.elevationM.toFixed(0)}m)`
    }).join(' | ')
    lines.push(`HIGH GROUND — Stand placement rule: place stands 20-40m DOWNHILL from these peaks (thermals carry scent upward from the valley; stands at the exact peak are exposed to wind from all directions). Look for benches or saddles near:\n  ${pts}`)
  }

  if (ctx.lowGroundPoints.length > 0) {
    const pts = ctx.lowGroundPoints.slice(0, 3).map(p => {
      const { px, py } = latLngToPixel(p.lat, p.lng, bounds)
      const ns = py < 240 ? 'north' : 'south'
      const ew = px > 320 ? 'east' : 'west'
      return `${ns}${ew} (${p.elevationM.toFixed(0)}m)`
    }).join(' | ')
    lines.push(`LOW DRAINAGE ZONES — Natural creek bottoms and bedding pinch points. These are trail and bedding candidates, NOT stand sites (cold air drainage, scent pooling):\n  ${pts}`)
  }

  // Soil data — capability class and drainage
  if (ctx.soilSummary) {
    lines.push(`\n${ctx.soilSummary}`)
    lines.push('SOIL PLACEMENT RULES: Class I-II = prime food plot ground. Class VI-VIII = do not plant. "Poorly drained" = wet/soft in spring, may hold water — avoid food plots, good for natural water source locations. State soil capability class in every food plot description.')
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

// ─── v2 buildTonyPrompt — outputs relative zones, NOT GPS coordinates ─────────
function buildTonyPrompt(
  message: string,
  bounds: Bounds,
  zoom: number,
  features: any[],
  season: string,
  propertyName: string,
  spatialContext?: SpatialContext,
  windDirection?: string,
  boundaryRing?: [number, number][] | null,
  chatHistory?: Array<{ role: string; text: string }>,
  placement?: PlacementResult | null
): string {
  const featureDesc = features.length > 0
    ? `\n\nThe owner has marked ${features.length} EXISTING feature(s) on the map — this is field intel about what is ALREADY on the property (water, food plots, bedding they've watched, stands), not a request for you to grade it:\n${features.slice(0, MAX_FEATURES).map((f, i) => {
        const type = f.properties?.layerType ?? f.type ?? 'unknown'
        const geomType = f.geometry?.type ?? 'unknown'
        const label = String(f.properties?.label ?? '').replace(/["""]/g, "'").slice(0, 80)
        return `  ${i + 1}. ${type} (${geomType})${label ? ` — "${label}"` : ''}`
      }).join('\n')}\nTreat these as FIXED ground truth — water and food plots the owner drew already EXIST (don't call them "well placed" or re-recommend them). Anchor your plan to them and reference them by location ("with your water in the SW, I'd..."). Then prescribe NEW moves: stands/access/sanctuary/plots that work with what's there, plus resize or relocate an existing plot ONLY if the property gives a concrete reason.`
    : '\n\nThe owner has not marked anything yet — give your decisive first read of the property and the plan you would build.'

  const seasonGuidance = season ? getSeasonalGuidance(season) : ''
  const propertyLine = propertyName ? `Property name: "${propertyName}"` : ''

  const historyBlock = chatHistory && chatHistory.length > 0
    ? `\n\nPRIOR CONVERSATION CONTEXT (last ${chatHistory.length} exchanges — use this for continuity, do NOT repeat advice already given):\n${chatHistory.map(m => `${m.role === 'tony' ? 'Tony' : 'User'}: ${m.text.slice(0, 300)}`).join('\n')}\n--- END PRIOR CONTEXT ---`
    : ''

  const centerLat = (bounds.north + bounds.south) / 2
  const approxAcres = Math.round(
    ((bounds.north - bounds.south) * 111000) *
    ((bounds.east - bounds.west) * 111000 * Math.cos(centerLat * Math.PI / 180)) / 4047
  )

  const prevailingWind = windDirection ?? getRegionalWindDefault(bounds)

  const boundaryBlock = boundaryRing && boundaryRing.length >= 3
    ? `\nPROPERTY BOUNDARY — HARD RULE: The user ONLY owns land INSIDE the drawn boundary. Every zone and stand site you recommend MUST be positioned INSIDE this boundary. The satellite image shows neighboring land the user does not own. Describe all placements using compass directions relative to the property center.\n`
    : ''

  return `You are Tony — a direct whitetail habitat consultant for BuckGrid Pro. You know every property. You give specific advice.
${propertyLine}${approxAcres > 0 ? `\nVisible area: approximately ${approxAcres} acres (rough — use it for scale, not as a quota).` : ''}${historyBlock}

${seasonGuidance}

PROPERTY ORIENTATION (for compass directions in your output):
- NORTH = top of image (lat ${bounds.north.toFixed(5)})
- SOUTH = bottom of image (lat ${bounds.south.toFixed(5)})
- WEST = left of image (lng ${bounds.west.toFixed(5)})
- EAST = right of image (lng ${bounds.east.toFixed(5)})
- Property center = lat ${centerLat.toFixed(5)}, lng ${((bounds.east + bounds.west) / 2).toFixed(5)}

${boundaryBlock}PREVAILING WIND: ${prevailingWind}

${featureDesc}

${spatialContext ? buildSpatialContextBlock(spatialContext, bounds) + '\n\n' : ''}SCENE ANALYSIS PROTOCOL — COMPLETE STEPS 1-4 INTERNALLY BEFORE PLACING ANY FEATURE:

STEP 1 — COVER TYPE INVENTORY: List every distinct cover type visible (mature hardwood, conifer, open field, early successional brush, wetland, cultivated). Note which compass quadrant each occupies.

STEP 2 — EDGE AND TRANSITION MAPPING: Identify every edge where two cover types meet. Flag inside corners (L/V shaped edge junctions) — these are top stand candidates.

STEP 3 — TERRAIN AND DRAINAGE READ: Does the property slope toward any compass direction? Are there visible ridges, draws, or potential saddle points?

STEP 4 — WATER AND LIMITING FACTOR: Identify confirmed water (OSM only). State the single biggest limiting factor: food, cover, water, sanctuary, or access.

HABITAT AUDIT — COMPLETE ALL 5 FACTORS BEFORE OUTPUTTING ZONES:

1. EDGE DENSITY AND COVER DIVERSITY: Count distinct cover types. Flag hard vs soft edges. Name any inside corners.
2. SANCTUARY ASSESSMENT: Is there a 5+ acre block of dense cover far from roads? If no, flag it — "No sanctuary: mature bucks won't hold here."
3. WATER AVAILABILITY: OSM-verified water within 400 yards of bedding? If no: "No confirmed water within range — water development is a priority."
4. TERRAIN FEATURES: Saddles, benches, pinch points, funnels. Terrain features outrank food sources for stand placement Oct 15–Nov 20.
5. HUMAN PRESSURE MAP: Roads, structures, exclusion zones. Huntable sanctuary = 200+ yards from all roads and structures.

TERRAIN READING RULES:
- Dense canopy edges: place stands on the TIMBER SIDE, 20-40m inside canopy, facing toward the open.
- Soft edges (feathered timber-to-field transition) are premium habitat — call them out.
- Inside corners where two field edges form an L/V are almost always the highest-value stand site on the property.
- SANCTUARY: If no 5+ acre undisturbed block exists, state this explicitly. Sanctuary is never-entry ground.
- KILL PLOT vs DESTINATION PLOT: Kill plot = 0.1-0.5 acres tucked 60-100 yards inside timber edge near staging area. Destination plot = 2-5+ acres in open ground for herd nutrition.
- FOOD PLOT SIZING — TACTICAL, NOT A QUOTA: Size the plot to its job, never to a percentage. Kill plot = 0.25–1 ac tucked tight to cover near bedding/staging (a place to kill, not herd nutrition). Destination/feeding plot = 2–5+ ac in open ground for the herd. Only call a plot "too big" or "too small" when THIS property gives a concrete reason (e.g., a 5-ac plot crowds a 30-ac timber block and piles on pressure; a 0.25-ac plot gets browsed to dirt where deer density is high). Do NOT scold the owner's acreage against a generic rule.
- TSI: Where canopy is too open for bedding (deer visible 100+ yards), prescribe hinge-cut TSI — 10-20 trees/acre cut 60% through at 4 feet height.
- SOUTH-FACING SLOPES: Deer bed here November–February. Flag when slope/aspect data confirms.
- THERMAL RULES: Morning hunts = elevated/mid-slope stands. Evening hunts = lower slope/drainage edge stands.
- STAND-TO-BEDDING DISTANCE: Early season minimum 100 yards, 150 preferred. Rut funnel stands 30-60 yards acceptable.
- STAGING AREAS: Dense 1-5 acre thicket 60-150 yards from primary food source. Staging area stands outperform food-edge stands for mature bucks.
- WATER: Only recommend if OSM-confirmed. Water features require 50+ yards of timber cover on at least two sides.

${placement ? placement.promptBlock + '\n\n' : ''}User says: "${message}"

${placement ? `OUTPUT FORMAT (GROUNDED MODE): The placement engine above already computed WHERE everything goes — real coordinates snapped to verified terrain inside the boundary. Your job is to SELECT, RANK, and EXPLAIN. Return JSON with 'message', 'zones', and 'stand_sites' arrays. Every zone and stand MUST reference one of the candidate ids above via "candidate_id". NEVER invent a position, NEVER output lat/lng, NEVER use a candidate id that is not listed above. Pick the 4-8 strongest zones and 2-4 stands for this property and season; skip weak candidates. You MUST return at least one zone or stand whenever candidates are listed above — selecting nothing leaves the map blank and is a failure. Candidate ids that start with "u" are the OWNER'S OWN existing features (already drawn on the map): reference them in your reasoning but do NOT select them as zones/stands — draw only your NEW recommendations (fp/kp/bd/st/sn/sg/ar/wt ids). In each description, explain WHY that computed spot works (wind, terrain, cover, distances from the candidate's evidence) in hunter language.

Exact JSON format:
{
  "message": "Conversational text — 3-4 sentences max. Direct, specific, named features. Tony voice.",
  "zones": [
    {
      "candidate_id": "fp1",
      "name": "North Field Edge Plot",
      "description": "One sentence of specific habitat advice grounded in the candidate's evidence.",
      "confidence": "high",
      "season": "fall"
    }
  ],
  "stand_sites": [
    {
      "candidate_id": "st1",
      "name": "Funnel Stand",
      "wind_direction": "northwest",
      "rating": 9,
      "description": "One sentence — what the hunter covers, which wind to hunt it on."
    }
  ]
}` : `OUTPUT FORMAT: Return JSON with 'message', 'zones', and 'stand_sites' arrays. NEVER output lat/lng coordinates. Use relative_position (northeast, southwest, etc.) for all placements. The client software translates positions to map coordinates using the property boundary.`}

VALID confidence: "high" | "medium" | "low"
VALID season: "all" | "spring" | "summer" | "fall" | "winter"

CRITICAL OUTPUT RULES:
- Respond ONLY with raw valid JSON — no markdown, no code fences, zero text outside JSON
- NEVER output lat/lng/coordinates
- "message" field: 3-4 sentences MAX. Direct, specific, named features. v2 Tony voice: like a land manager who's walked 1000 properties. Lead with your single biggest finding. Follow with #1 priority action.
${placement ? '' : `
VALID relative_position values: "north" | "northeast" | "east" | "southeast" | "south" | "southwest" | "west" | "northwest" | "center"
VALID zone types: "food_plot" | "kill_plot" | "access_route" | "bedding" | "stand_site" | "water" | "staging_area" | "sanctuary"
VALID relative_size: "tiny" (under 0.5ac) | "small" (0.5-2ac) | "medium" (2-10ac) | "large" (10+ ac)
- Reference actual visible terrain in descriptions — name what you see (field edge, timber corner, creek bottom, bench, saddle)
- Use compass directions (NW corner, SE field edge, etc.) consistently

Exact JSON format:
{
  "message": "Conversational text — 3-4 sentences max. Direct, specific, named features. v2 Tony voice.",
  "zones": [
    {
      "id": "z1",
      "name": "NE Bench Kill Plot",
      "type": "kill_plot",
      "relative_position": "northeast",
      "relative_size": "small",
      "description": "One sentence of specific habitat advice referencing visible terrain.",
      "confidence": "high",
      "season": "fall"
    }
  ],
  "stand_sites": [
    {
      "id": "s1",
      "name": "SE Bench Stand",
      "relative_position": "southeast",
      "wind_direction": "northwest",
      "rating": 9,
      "description": "One sentence — distance from bedding, thermal strategy, what the hunter covers."
    }
  ]
}

Return 4-8 zones and 2-4 stand_sites ranked by seasonal priority. A complete plan includes: at least 1 sanctuary zone, 1-2 staging_area zones, food plots on open ground only, and stand_sites with wind direction specified.`}`
}

// ─── Validate and normalize a relative_position value ────────────────────────
const VALID_POSITIONS: RelativePosition[] = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'center']
function normalizePosition(val: unknown): RelativePosition {
  if (typeof val === 'string' && VALID_POSITIONS.includes(val as RelativePosition)) {
    return val as RelativePosition
  }
  return 'center'
}

function normalizeConfidence(val: unknown): ConfidenceLevel {
  if (val === 'high' || val === 'medium' || val === 'low') return val
  if (typeof val === 'number') {
    if (val >= 75) return 'high'
    if (val >= 50) return 'medium'
    return 'low'
  }
  return 'medium'
}

function normalizeSeason(val: unknown): SeasonLabel {
  const valid: SeasonLabel[] = ['all', 'spring', 'summer', 'fall', 'winter']
  if (typeof val === 'string' && valid.includes(val as SeasonLabel)) return val as SeasonLabel
  return 'all'
}

function normalizeZoneType(val: unknown): ZoneType {
  const valid: ZoneType[] = ['food_plot', 'kill_plot', 'access_route', 'bedding', 'stand_site', 'water', 'staging_area', 'sanctuary']
  if (typeof val === 'string' && valid.includes(val as ZoneType)) return val as ZoneType
  return 'food_plot'
}

function normalizeSize(val: unknown): RelativeSize {
  const valid: RelativeSize[] = ['tiny', 'small', 'medium', 'large']
  if (typeof val === 'string' && valid.includes(val as RelativeSize)) return val as RelativeSize
  return 'small'
}

// ─── Parse and sanitize Tony v2 response → typed zones + stand_sites ─────────
// Delegates to the hardened scanner in lib/tonyJson (markdown fences, prose
// wrappers, raw newlines in strings, trailing commas, mid-token truncation).
function parseV2Response(rawText: string): { message: string; zones: TonyZone[]; stand_sites: StandSite[] } {
  const { message, zones, stand_sites } = parseTonyV2(rawText)
  return { message, zones, stand_sites }
}

// ─── NLCD-based zone confidence downgrade ────────────────────────────────────
// For food_plot and kill_plot zones in the 'high' confidence tier,
// spot-check the target compass position against NLCD. If it lands on forest,
// downgrade confidence to 'low' and add a note.
async function nlcdCheckZones(zones: TonyZone[], bounds: Bounds): Promise<TonyZone[]> {
  const FOREST_CLASSES = new Set([41, 42, 43, 90])
  const WATER_CLASSES = new Set([11])

  // Map relative_position to approximate center lat/lng within bounds
  function positionToLatLng(pos: RelativePosition): [number, number] {
    const centerLat = (bounds.north + bounds.south) / 2
    const centerLng = (bounds.east + bounds.west) / 2
    const latSpan = (bounds.north - bounds.south) * 0.3
    const lngSpan = (bounds.east - bounds.west) * 0.3

    const offsets: Record<RelativePosition, [number, number]> = {
      north:     [latSpan,       0],
      northeast: [latSpan,       lngSpan],
      east:      [0,             lngSpan],
      southeast: [-latSpan,      lngSpan],
      south:     [-latSpan,      0],
      southwest: [-latSpan,      -lngSpan],
      west:      [0,             -lngSpan],
      northwest: [latSpan,       -lngSpan],
      center:    [0,             0],
    }
    const [dLat, dLng] = offsets[pos]
    return [centerLat + dLat, centerLng + dLng]
  }

  return Promise.all(
    zones.map(async (zone): Promise<TonyZone> => {
      if (zone.type !== 'food_plot' && zone.type !== 'kill_plot') return zone
      try {
        const [lat, lng] = positionToLatLng(zone.relative_position)
        const sample = await fetchNlcdPoint(lat, lng).catch(() => null)
        if (!sample) return zone
        if (FOREST_CLASSES.has(sample.landCoverCode)) {
          return {
            ...zone,
            confidence: 'low',
            description: zone.description + ' (Note: NLCD shows forest cover at this position — verify open ground before planting.)',
          }
        }
        if (WATER_CLASSES.has(sample.landCoverCode)) {
          return {
            ...zone,
            confidence: 'low',
            description: zone.description + ' (Note: NLCD shows open water at this position — invalid plot location.)',
          }
        }
      } catch {}
      return zone
    })
  )
}

// ─── Grounded zone assembly — snap Tony's selections to engine candidates ────
// Tony only picks candidate ids; the geometry ALWAYS comes from the engine, so
// nothing can render outside the boundary or on a road regardless of what the
// LLM says.

function titleCompass(compass: string): string {
  const map: Record<string, string> = {
    north: 'North', northeast: 'NE', east: 'East', southeast: 'SE',
    south: 'South', southwest: 'SW', west: 'West', northwest: 'NW', center: 'Center',
  }
  return map[compass] ?? compass
}

function defaultZoneName(cd: PlacementCandidate): string {
  const names: Record<string, string> = {
    food_plot: 'Food Plot', kill_plot: 'Kill Plot', bedding: 'Bedding',
    stand_site: 'Stand', staging_area: 'Staging Area', sanctuary: 'Sanctuary',
    access_route: 'Access Route', water: 'Water',
  }
  return `${titleCompass(cd.compass)} ${names[cd.type] ?? cd.type}`
}

function scoreToConfidence(score: number): ConfidenceLevel {
  if (score >= 68) return 'high'
  if (score >= 48) return 'medium'
  return 'low'
}

function acresToSize(acres?: number): RelativeSize {
  if (!acres) return 'small'
  if (acres < 0.5) return 'tiny'
  if (acres < 2) return 'small'
  if (acres < 10) return 'medium'
  return 'large'
}

function groundResponse(
  zones: TonyZone[],
  stands: StandSite[],
  placement: PlacementResult
): { zones: TonyZone[]; stands: StandSite[] } {
  // Drawable pool excludes the owner's OWN drawn features (ids starting "u"):
  // those are already on the map — Tony adds NEW recommendations, never re-draws them.
  const drawable = placement.candidates.filter(cd => !cd.id.startsWith('u'))
  const byId = new Map(drawable.map(cd => [cd.id, cd]))
  const used = new Set<string>()

  const claim = (candidateId: string | undefined, wantedType?: string): PlacementCandidate | null => {
    if (candidateId && byId.has(candidateId) && !used.has(candidateId)) {
      const cd = byId.get(candidateId)!
      if (!wantedType || cd.type === wantedType) {
        used.add(cd.id)
        return cd
      }
    }
    // Fallback: best unused candidate of the wanted type
    if (wantedType) {
      const fallback = drawable
        .filter(cd => cd.type === wantedType && !used.has(cd.id))
        .sort((a, b) => b.score - a.score)[0]
      if (fallback) {
        used.add(fallback.id)
        return fallback
      }
    }
    return null
  }

  const groundedZones: TonyZone[] = []
  for (const z of zones) {
    // In grounded mode the candidate id determines the real type and geometry
    const direct = z.candidate_id ? byId.get(z.candidate_id) : undefined
    const cd = claim(z.candidate_id, direct ? direct.type : z.type)
    if (!cd) continue
    if (cd.type === 'stand_site') {
      // A stand picked in the zones array — keep it as a zone point
    }
    groundedZones.push({
      ...z,
      id: cd.id,
      type: cd.type as ZoneType,
      relative_position: normalizePosition(cd.compass),
      relative_size: acresToSize(cd.acres),
      acres: cd.acres,
      candidate_id: cd.id,
      geometry: candidateGeometry(cd),
      grounded: true,
      description: z.description || cd.factors.join('; '),
    })
  }

  const groundedStands: StandSite[] = []
  for (const s of stands) {
    const cd = claim(s.candidate_id, 'stand_site')
    if (!cd) continue
    groundedStands.push({
      ...s,
      id: cd.id,
      relative_position: normalizePosition(cd.compass),
      candidate_id: cd.id,
      geometry: candidateGeometry(cd),
      grounded: true,
      description: s.description || cd.factors.join('; '),
    })
  }

  // Auto-include the access route serving any selected stand
  for (const st of groundedStands) {
    const route = placement.candidates.find(
      cd => cd.type === 'access_route' && cd.servesStand === st.id && !used.has(cd.id)
    )
    if (route && groundedZones.length < 12) {
      used.add(route.id)
      groundedZones.push({
        id: route.id,
        name: `Access to ${st.name}`,
        type: 'access_route',
        relative_position: normalizePosition(route.compass),
        relative_size: 'tiny',
        description: route.factors.join('; '),
        confidence: 'high',
        season: 'all',
        candidate_id: route.id,
        geometry: candidateGeometry(route),
        grounded: true,
      })
    }
  }

  return { zones: groundedZones.slice(0, 12), stands: groundedStands.slice(0, 6) }
}

// When every model fails but the engine ran, return the deterministic plan
// instead of a 503 — the placements are real either way.
function deterministicFallback(placement: PlacementResult): {
  message: string
  zones: TonyZone[]
  stands: StandSite[]
} {
  const zones: TonyZone[] = []
  const stands: StandSite[] = []
  for (const cd of placement.candidates) {
    if (cd.id.startsWith('u')) continue // owner's own drawn features — already on the map
    if (cd.type === 'stand_site') {
      stands.push({
        id: cd.id,
        name: defaultZoneName(cd),
        relative_position: normalizePosition(cd.compass),
        wind_direction: placement.windFromDeg != null ? `${Math.round(placement.windFromDeg)}°` : '',
        rating: Math.max(1, Math.min(10, Math.round(cd.score / 10))),
        description: cd.factors.join('; '),
        candidate_id: cd.id,
        geometry: candidateGeometry(cd),
        grounded: true,
      })
    } else {
      zones.push({
        id: cd.id,
        name: defaultZoneName(cd),
        type: cd.type as ZoneType,
        relative_position: normalizePosition(cd.compass),
        relative_size: acresToSize(cd.acres),
        description: cd.factors.join('; '),
        confidence: scoreToConfidence(cd.score),
        season: 'all',
        acres: cd.acres,
        candidate_id: cd.id,
        geometry: candidateGeometry(cd),
        grounded: true,
      })
    }
  }
  return {
    message:
      "Tony's AI commentary is offline right now, but the terrain engine still ran the full analysis. " +
      'Every placement below is computed from verified land cover, elevation, roads, and wind — snapped to real ground inside your boundary. ' +
      'Ask again in a minute for the strategic breakdown.',
    zones: zones.slice(0, 10),
    stands: stands.slice(0, 4),
  }
}

// ─── Frontend annotation contract ─────────────────────────────────────────────
// TonyChat draws `data.annotations` (geojson Feature + label/why/confidence).
// Convert grounded zones/stands into that shape so every response renders.
const ANN_TYPE_FOR_ZONE: Record<string, string> = {
  food_plot: 'food_plot', kill_plot: 'food_plot', bedding: 'bedding',
  stand_site: 'stand', staging_area: 'staging_area', sanctuary: 'sanctuary',
  access_route: 'access_trail', water: 'water',
}

function confidenceToNumber(c?: ConfidenceLevel): number {
  return c === 'high' ? 85 : c === 'medium' ? 60 : 35
}

function toAnnotations(zones: TonyZone[], stands: StandSite[]): Array<Record<string, unknown>> {
  const anns: Array<Record<string, unknown>> = []
  let priority = 1
  for (const s of stands) {
    if (!s.geometry) continue
    anns.push({
      type: 'stand',
      label: s.name,
      why: s.description,
      confidence: typeof s.rating === 'number' ? Math.max(0, Math.min(100, s.rating * 10)) : 70,
      priority: priority++,
      geojson: { type: 'Feature', properties: {}, geometry: s.geometry },
    })
  }
  for (const z of zones) {
    if (!z.geometry) continue
    anns.push({
      type: ANN_TYPE_FOR_ZONE[z.type] ?? z.type,
      label: z.name,
      why: z.description,
      confidence: confidenceToNumber(z.confidence),
      priority: priority++,
      geojson: { type: 'Feature', properties: {}, geometry: z.geometry },
    })
  }
  return anns
}

export async function POST(req: NextRequest) {
  // Global deadline — ensures we always respond before Vercel's hard kill
  const globalAbort = new AbortController()
  const globalTimer = setTimeout(() => globalAbort.abort(), GLOBAL_DEADLINE_MS)

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
    const [rateLimitOk, freeTierOk] = await Promise.all([checkRateLimit(ip), checkFreeTier(ip)])
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Too many requests', reply: 'Slow down — Tony can only handle so many questions per minute. Try again shortly.' }, { status: 429 })
    }
    if (!freeTierOk) {
      return NextResponse.json({ error: 'Free tier limit reached', reply: "You've used your 3 free Tony analyses for today. Upgrade to Pro for unlimited access.", paywallHit: true }, { status: 402 })
    }

    const googleKey = process.env.GOOGLE_AI_KEY || process.env.GOOGLE_API_KEY
    const groqKey = process.env.GROQ_API_KEY || process.env.GROQ_JARVIS_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    const ollamaUrl = process.env.OLLAMA_BASE_URL   // e.g., http://localhost:11434
    const ollamaModel = process.env.OLLAMA_MODEL || 'hermes3'

    if (!googleKey && !groqKey && !openaiKey && !anthropicKey && !ollamaUrl) {
      return NextResponse.json({ error: 'Server configuration error', reply: 'Tony needs a fresh API key — contact support to get Tony back online.' }, { status: 500 })
    }

    const body = await req.json()
    const { message, bounds, zoom, features = [], season = '', propertyName = '', spatialContext, chatHistory } = body

    // Validate and sanitize inputs
    const rawMsg = typeof message === 'string' ? message.trim().slice(0, MAX_MESSAGE_LENGTH).replace(/["""]/g, "'") : ''
    if (!rawMsg) return NextResponse.json({ error: 'Message required' }, { status: 400 })
    // Only expand terse first messages into a full-analysis request. Mid-conversation,
    // short replies ("ok do it", "yes") must stay as-is — rewriting them forced Tony
    // to restart the whole analysis script every turn and repeat himself.
    const hasHistory = Array.isArray(chatHistory) && chatHistory.length > 0
    const trimmedMsg = rawMsg.length < 20 && !hasHistory
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

    // When the user has drawn a boundary, anchor the analysis on the PARCEL
    // (padded bbox) instead of whatever the viewport happens to show — the
    // satellite image, GIS fetch, and placement engine all see the property.
    let effBounds: Bounds = bounds
    if (boundaryRing && boundaryRing.length >= 4) {
      let w = Infinity, e = -Infinity, s = Infinity, n = -Infinity
      for (const [lng, lat] of boundaryRing) {
        if (typeof lng !== 'number' || typeof lat !== 'number') continue
        if (lng < w) w = lng
        if (lng > e) e = lng
        if (lat < s) s = lat
        if (lat > n) n = lat
      }
      if (isFinite(w) && isFinite(s) && n > s && e > w) {
        const padLat = (n - s) * 0.15
        const padLng = (e - w) * 0.15
        const padded = { north: n + padLat, south: s - padLat, east: e + padLng, west: w - padLng }
        if (isValidBounds(padded)) effBounds = padded
      }
    }

    // Fetch satellite image and spatial context in parallel
    const esriUrl = `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export` +
      `?bbox=${effBounds.west},${effBounds.south},${effBounds.east},${effBounds.north}` +
      `&bboxSR=4326&imageSR=4326&size=640,480&format=png&f=image`

    const SPATIAL_TIMEOUT_MS = 12_000

    const [imgResult, spatialResult] = await Promise.allSettled([
      fetchBinary(esriUrl, ESRI_TIMEOUT_MS),
      Promise.race([
        fetchSpatialData(effBounds),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SpatialTimeout')), SPATIAL_TIMEOUT_MS)),
      ]).catch((): SpatialContext | undefined => undefined),
    ])

    if (imgResult.status === 'rejected') {
      const isTimeout = imgResult.reason instanceof Error && imgResult.reason.name === 'TimeoutError'
      return NextResponse.json({
        error: 'Map image unavailable',
        reply: isTimeout
          ? "Satellite image took too long to load. Move the map slightly and try again."
          : "Couldn't pull the satellite image. Check your connection and try again."
      }, { status: 500 })
    }

    const imgBase64 = imgResult.value.toString('base64')

    const resolvedSpatial = spatialResult.status === 'fulfilled' ? spatialResult.value : undefined

    // ── Deterministic placement engine — the source of truth for WHERE ───────
    // Runs whenever a real boundary polygon exists. Tony then ranks/explains
    // these candidates instead of inventing positions.
    // Extract the hunter's drawn features as confirmed observations — ground
    // truth the engine anchors the plan to (real bedding, food, water, stands).
    const FOOD_LAYERS = new Set(['clover', 'brassicas', 'corn', 'soybeans', 'milo', 'egyptian', 'switchgrass', 'food_plot', 'kill_plot'])
    const observations: PlacementObservation[] = []
    for (const f of safeFeatures as any[]) {
      const lt = f?.properties?.layerType ?? f?.type
      if (!lt || lt === 'boundary' || lt === 'nav') continue
      let type: PlacementObservation['type'] | null = null
      if (lt === 'bedding') type = 'bedding'
      else if (lt === 'stand') type = 'stand_site'
      else if (lt === 'water') type = 'water'
      else if (FOOD_LAYERS.has(lt)) type = 'food_plot'
      if (!type) continue // focus/scrape/mineral/corridor: Tony still sees them via features
      const g = f?.geometry
      let center: [number, number] | null = null
      let ring: [number, number][] | undefined
      if (g?.type === 'Polygon' && Array.isArray(g.coordinates?.[0]) && g.coordinates[0].length >= 4) {
        ring = g.coordinates[0] as [number, number][]
        let sx = 0, sy = 0
        for (const [x, y] of ring) { sx += x; sy += y }
        center = [sx / ring.length, sy / ring.length]
      } else if (g?.type === 'Point' && Array.isArray(g.coordinates)) {
        center = g.coordinates as [number, number]
      }
      if (center && typeof center[0] === 'number' && typeof center[1] === 'number') {
        observations.push({ type, center, ring })
      }
    }

    let placement: PlacementResult | null = null
    if (boundaryRing && boundaryRing.length >= 4 && resolvedSpatial) {
      try {
        placement = generatePlacements({
          boundaryRing: boundaryRing as [number, number][],
          spatial: resolvedSpatial,
          season: typeof season === 'string' ? season : '',
          observations,
        })
        if (placement) {
          console.log(`[chat] placement engine: ${placement.candidates.length} candidates, grid ${placement.gridInfo.rows}x${placement.gridInfo.cols} (${placement.gridInfo.cellM}m cells, ~${placement.gridInfo.acres} ac)`)
        }
      } catch (e) {
        console.warn('[chat] placement engine failed:', e instanceof Error ? e.message : e)
      }
    }

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
        trimmedMsg, effBounds, zoom ?? 14, safeFeatures,
        typeof season === 'string' ? season : '',
        safePropertyName,
        resolvedSpatial,
        resolvedSpatial?.windDirection,
        boundaryRing,
        safeChatHistory,
        placement,
      )

      let usedVision = false
      let usedFallback = false
      const paidFallbackEnabled = process.env.ENABLE_PAID_FALLBACK === '1'
      let geminiRateLimited = false

      const geminiContents = [{ parts: [
        { inline_data: { mime_type: 'image/png', data: imgBase64 } },
        { text: tonyPrompt }
      ]}]
      // 2.5 Flash runs "thinking" by default, which pushed this heavy vision +
      // JSON request to ~23s — past GEMINI_TIMEOUT_MS — so it silently fell to
      // the (rate-limited) 2.0 fallback. Disabling thinking drops it to ~7s.
      // 2.5 only ranks/explains the engine's candidates; the deterministic
      // engine is the source of truth, so extended reasoning isn't needed here.
      const geminiBody25 = JSON.stringify({
        contents: geminiContents,
        generationConfig: { maxOutputTokens: 8192, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
      const geminiBody = JSON.stringify({
        contents: geminiContents,
        generationConfig: { maxOutputTokens: 8192, responseMimeType: 'application/json' },
      })

      // ── 1. Gemini 2.5 Flash — PRIMARY (best spatial vision, free) ────────────
      if (googleKey) {
        try {
          const result = await Promise.race([
            fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': googleKey },
              body: geminiBody25,
            }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TonyTimeout')), GEMINI_TIMEOUT_MS)),
          ])
          if (result.status === 429) { geminiRateLimited = true; throw new Error('Gemini2.5 429') }
          if (!result.ok) throw new Error(`Gemini2.5 ${result.status}`)
          const j = await result.json()
          rawText = j.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
          if (rawText) usedVision = true
          else throw new Error('Gemini2.5 empty')
        } catch (e: unknown) {
          console.warn('[chat] Gemini 2.5 Flash failed:', e instanceof Error ? e.message : e)
        }
      }

      // ── 2. Gemini 2.0 Flash — stable Google vision fallback ──────────────────
      if (!usedVision && googleKey) {
        try {
          const result = await Promise.race([
            fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': googleKey },
              body: geminiBody,
            }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TonyTimeout')), GEMINI_TIMEOUT_MS)),
          ])
          if (result.status === 429) { geminiRateLimited = true; throw new Error('Gemini2.0 429') }
          if (!result.ok) throw new Error(`Gemini2.0 ${result.status}`)
          const j = await result.json()
          rawText = j.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
          if (rawText) usedVision = true
          else throw new Error('Gemini2.0 empty')
        } catch (e: unknown) {
          console.warn('[chat] Gemini 2.0 Flash failed:', e instanceof Error ? e.message : e)
        }
      }

      // ── 3. Ollama/Hermes — FREE local fallback (before cloud paid APIs) ──────
      // Fires when Gemini fails AND OLLAMA_BASE_URL is configured.
      // Text-only (no satellite image) but zero cost if user runs local Hermes.
      if (!usedVision && ollamaUrl) {
        try {
          const degradedPrompt = `${tonyPrompt}\n\n[NOTE: Satellite image unavailable. Advise based on property description, spatial data context, and user message only. Be explicit that you cannot see the satellite image this turn.]`
          const ollamaResult = await Promise.race([
            fetch(`${ollamaUrl}/api/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: ollamaModel,
                prompt: degradedPrompt,
                stream: false,
              }),
            }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('OllamaTimeout')), OLLAMA_TIMEOUT_MS)),
          ])
          if (ollamaResult.ok) {
            const ollamaJson = await ollamaResult.json()
            const ollamaText = (typeof ollamaJson.response === 'string' ? ollamaJson.response : '').trim()
            if (ollamaText) {
              // Wrap as v2 JSON if Ollama returned prose
              try {
                JSON.parse(ollamaText) // already JSON?
                rawText = ollamaText
              } catch {
                rawText = JSON.stringify({
                  message: ollamaText.slice(0, 800) + '\n\n_(Satellite image temporarily unavailable — Tony is working from terrain data only this turn.)_',
                  zones: [],
                  stand_sites: [],
                })
              }
              usedFallback = true
            }
          }
        } catch (e: unknown) {
          console.warn('[chat] Ollama/Hermes fallback failed:', e instanceof Error ? e.message : e)
        }
      }

      // ── 4. Groq text-only — free cloud fallback (rate-limited Gemini path) ───
      if (!usedVision && !usedFallback && geminiRateLimited && groqKey) {
        try {
          const degradedPrompt = `${tonyPrompt}\n\n[NOTE: Satellite image unavailable due to rate limits. Advise based on property description, spatial data context, and user message only. Be explicit that you cannot see the satellite image this turn.]`
          const groqResult = await Promise.race([
            fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
              body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: degradedPrompt }],
                max_tokens: 1400,
                temperature: 0.3,
              }),
            }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('GroqTimeout')), 20_000)),
          ])
          if (groqResult.ok) {
            const groqJson = await groqResult.json()
            const groqText = groqJson.choices?.[0]?.message?.content?.trim() ?? ''
            if (groqText) {
              // Try to parse as JSON first; fall back to wrapping in v2 envelope
              try {
                JSON.parse(groqText)
                rawText = groqText
              } catch {
                rawText = JSON.stringify({
                  message: groqText.slice(0, 800) + '\n\n_(Satellite image temporarily unavailable — Tony is working from terrain data only this turn.)_',
                  zones: [],
                  stand_sites: [],
                })
              }
              usedFallback = true
            }
          }
        } catch (e: unknown) {
          console.warn('[chat] Groq degraded fallback failed:', e instanceof Error ? e.message : e)
        }
      }

      // ── 5. Anthropic Haiku 4.5 — paid vision fallback (ENABLE_PAID_FALLBACK=1) ──
      if (!usedVision && !usedFallback && anthropicKey && paidFallbackEnabled) {
        try {
          const haikuResult = await Promise.race([
            fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': anthropicKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 4096,
                system: TONY_SYSTEM_PROMPT,
                messages: [{
                  role: 'user',
                  content: [
                    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imgBase64 } },
                    { type: 'text', text: tonyPrompt },
                  ],
                }],
              }),
            }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TonyTimeout')), HAIKU_TIMEOUT_MS)),
          ])
          if (!haikuResult.ok) throw new Error(`Haiku ${haikuResult.status}`)
          const haikuJson = await haikuResult.json()
          rawText = haikuJson.content?.find((c: any) => c.type === 'text')?.text?.trim() ?? ''
          if (rawText) usedVision = true
          else throw new Error('Haiku empty response')
        } catch (e: unknown) {
          console.warn('[chat] Haiku 4.5 failed, trying Sonnet:', e instanceof Error ? e.message : e)
        }
      }

      // ── 6. Anthropic Sonnet 4.6 — deeper paid fallback (ENABLE_PAID_FALLBACK=1) ──
      if (!usedVision && !usedFallback && anthropicKey && paidFallbackEnabled) {
        try {
          const result = await Promise.race([
            fetch('https://api.anthropic.com/v1/messages', {
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
                messages: [{
                  role: 'user',
                  content: [
                    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imgBase64 } },
                    { type: 'text', text: tonyPrompt },
                  ],
                }],
              }),
            }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TonyTimeout')), ANTHROPIC_TIMEOUT_MS)),
          ])
          if (!result.ok) throw new Error(`Anthropic ${result.status}`)
          const anthropicJson = await result.json()
          rawText = anthropicJson.content?.find((c: any) => c.type === 'text')?.text?.trim() ?? ''
          if (rawText) usedVision = true
          else throw new Error('Anthropic Sonnet empty response')
        } catch (e: unknown) {
          console.warn('[chat] Anthropic Sonnet failed, trying OpenAI:', e instanceof Error ? e.message : e)
        }
      }

      // ── 7. OpenAI — final paid fallback (ENABLE_PAID_FALLBACK=1) ─────────────
      if (!usedVision && !usedFallback && openaiKey && paidFallbackEnabled) {
        try {
          const result = await Promise.race([
            fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
              body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                  { role: 'system', content: 'You are a JSON API. Respond with raw valid JSON only — no markdown, no code fences. The JSON must have "message" (string), "zones" (array), and "stand_sites" (array) keys.' },
                  { role: 'user', content: [
                    { type: 'text', text: tonyPrompt },
                    { type: 'image_url', image_url: { url: `data:image/png;base64,${imgBase64}` } }
                  ]}
                ],
                max_tokens: 4096,
                temperature: 0.3,
              }),
            }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TonyTimeout')), OPENAI_TIMEOUT_MS)),
          ])
          if (!result.ok) throw new Error(`OpenAI ${result.status}`)
          const openaiJson = await result.json()
          rawText = openaiJson.choices?.[0]?.message?.content?.trim() ?? ''
          if (rawText) usedVision = true
        } catch (e: unknown) {
          console.warn('[chat] OpenAI failed:', e instanceof Error ? e.message : e)
        }
      }

      if (!usedVision && !usedFallback) {
        throw new Error(geminiRateLimited ? 'TonyRateLimit' : 'TonyTimeout')
      }
    } catch (err: unknown) {
      // Every model failed. If the placement engine ran, the plan is still
      // real — return the deterministic placements instead of an error.
      if (placement) {
        const fallback = deterministicFallback(placement)
        clearTimeout(globalTimer)
        return NextResponse.json({
          reply: fallback.message,
          zones: fallback.zones,
          stand_sites: fallback.stands,
          annotations: toAnnotations(fallback.zones, fallback.stands),
          grounded: true,
          engineOnly: true,
        })
      }
      const msg = err instanceof Error ? err.message : ''
      const isRateLimit = msg === 'TonyRateLimit'
      const isTimeout = msg === 'TonyTimeout'
      return NextResponse.json({
        error: isRateLimit ? 'Rate limited' : 'AI timeout',
        reply: isRateLimit
          ? "Tony's getting a lot of traffic right now — Google's AI is temporarily at capacity. Give it 30 seconds and try again."
          : isTimeout
            ? "Tony's taking too long — probably a slow connection. Try again."
            : "Tony is unavailable right now. Try again in a moment."
      }, { status: 503 })
    }

    // ── Parse response → typed zones + stand_sites ───────────────────────────
    const { message: tonyMessage, zones: rawZones, stand_sites: rawStands } = parseV2Response(rawText)

    if (placement) {
      // Grounded mode: every zone snaps to engine-computed geometry. If Tony
      // returned nothing usable, fall back to the deterministic plan.
      let { zones: groundedZones, stands: groundedStands } = groundResponse(rawZones, rawStands, placement)
      if (groundedZones.length === 0 && groundedStands.length === 0) {
        const fb = deterministicFallback(placement)
        groundedZones = fb.zones
        groundedStands = fb.stands
      }
      clearTimeout(globalTimer)
      return NextResponse.json({
        reply: tonyMessage,
        zones: groundedZones,
        stand_sites: groundedStands,
        annotations: toAnnotations(groundedZones, groundedStands),
        grounded: true,
      })
    }

    // Boundary drawn but the engine couldn't produce a grounded plan (terrain/
    // cover data failed this turn). Be honest and ask for a retry instead of
    // dropping into the compass-guess path — never "talk but draw nothing" on a
    // real property.
    if (boundaryRing && boundaryRing.length >= 4) {
      clearTimeout(globalTimer)
      return NextResponse.json({
        reply:
          "I pulled your boundary but couldn't read the land data (terrain/cover) cleanly this turn — and I won't guess on your ground. Nudge the map a hair and ask again; it usually loads on the second pass.",
        zones: [],
        stand_sites: [],
        annotations: [],
        grounded: false,
        retryable: true,
      })
    }

    // Legacy path (no boundary drawn): compass zones + NLCD confidence check
    const checkedZones = await nlcdCheckZones(rawZones, effBounds)

    clearTimeout(globalTimer)
    return NextResponse.json({
      reply: tonyMessage,
      zones: checkedZones,
      stand_sites: rawStands,
    })
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
