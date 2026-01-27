import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type EvaluateRequestBody = {
  lockedBordersGeoJSON?: any
  terrainInputs?: any
  mapContext?: { center: { lat: number, lng: number }, zoom: number }
  features?: any[]
  layersWithDetails?: Array<{ type: string, name: string, acres: number, note: string, geometry: any }>
}

export async function POST(req: NextRequest) {
  try {
    const key = process.env.OPENROUTER_API_KEY
    if (!key) {
      return NextResponse.json({ error: 'Missing OPENROUTER_API_KEY - server configuration issue' }, { status: 500 })
    }

    const body = (await req.json()) as EvaluateRequestBody
    const lockedBorders = body.lockedBordersGeoJSON
    const terrainInputs = body.terrainInputs || {}
    const mapContext = body.mapContext
    const features = body.features || []

    // Guard: require at least one locked border
    const hasLockedBorder = lockedBorders?.features?.length > 0
    if (!hasLockedBorder) {
      return NextResponse.json({ 
        error: 'Lock a border to evaluate. Property evaluation requires a defined boundary.' 
      }, { status: 400 })
    }

    // Calculate border acres
    const borderFeature = lockedBorders.features[0]
    const borderAcres = borderFeature?.properties?.acres || 0

    // Build terrain features string
    const terrainFeatures = []
    if (terrainInputs.hasRidges) terrainFeatures.push('ridges')
    if (terrainInputs.hasValleys) terrainFeatures.push('valleys')
    if (terrainInputs.hasCreeks) terrainFeatures.push('creeks')
    if (terrainInputs.hasSaddles) terrainFeatures.push('saddles')
    if (terrainInputs.hasBenches) terrainFeatures.push('benches')

    // Get layer details if provided
    const layersWithDetails = body.layersWithDetails || []
    const layerInfo = layersWithDetails.length > 0 
      ? '\n\n**EXISTING FEATURES DRAWN:**\n' + layersWithDetails.map((layer: any) => {
          return `- ${layer.name || 'Unknown'} (${layer.type || 'unknown'}): ${layer.acres || 0} acres${layer.note ? ' - ' + layer.note : ''}`
        }).join('\n')
      : features.length > 0 
        ? `\n\n**EXISTING FEATURES:** ${features.length} features drawn (details not provided)`
        : ''

    // Prepare the property evaluation prompt
    const prompt = `You are Tony, a tactical habitat surveyor conducting initial property assessment. Output technical evaluation in surveyor format: data-first, precise measurements, no conversational language.

**TONE:** Technical surveyor processing terrain data. Example: "Property boundaries confirmed. Total surface area: ${borderAcres} acres. Terrain analysis: ${terrainFeatures.length > 0 ? terrainFeatures.join(', ') + ' detected' : 'minimal topographic variation'}. Primary wind vector: ${terrainInputs.predominantWind || 'unknown - recommend wind survey'}."

**CRITICAL CONTEXT:**  
First-pass evaluation from TERRAIN DATA only. User has ${features.length > 0 ? `drawn ${features.length} feature(s)` : 'not drawn features'}. Suggest WHERE and WHAT based on topography and wind patterns. Do NOT reference imagery.**

**PROPERTY DATA:**
- Total Property: ${borderAcres} acres
- Existing Features Drawn: ${features.length} (evaluation works with zero features)
- Map Location: ${mapContext?.center?.lat || 0}, ${mapContext?.center?.lng || 0}, zoom ${mapContext?.zoom || 0}${layerInfo}

**LOCKED BORDER:**
${JSON.stringify(lockedBorders, null, 2)}

**TERRAIN & CONTEXT:**
- Season: ${terrainInputs.seasonPhase || 'unknown'}
- Cover Type: ${terrainInputs.coverType || 'unknown'}
- Elevation: ${terrainInputs.elevation || 'unknown'}
- Terrain Features: ${terrainFeatures.length > 0 ? terrainFeatures.join(', ') : 'none specified'}
- Thermals: ${terrainInputs.thermals || 'unknown'}
- Predominant Wind: ${terrainInputs.predominantWind || 'not specified - provide wind range guidance'}
- Access Points: ${terrainInputs.accessPoints || 'not specified'}
- Pressure Concerns: ${terrainInputs.pressureConcerns || 'none specified'}
- Neighbors' Food Sources: ${terrainInputs.neighborsFood || 'unknown'}
- Property Goals: ${terrainInputs.goals || 'not specified'}
- Terrain Notes: ${terrainInputs.terrainNotes || 'none'}

**OUTPUT FORMAT (SURVEYOR REPORT):**

**INITIAL ASSESSMENT:**
[2-3 sentences with data. Example: "Property boundaries confirmed. Total surface area: ${borderAcres} acres. Topographic analysis: ${terrainFeatures.length > 0 ? terrainFeatures.join(', ') : 'flat terrain'}. Wind pattern: ${terrainInputs.predominantWind || 'data required'}. Preliminary classification: [category based on size/terrain]."]

**NOTE:** [One sentence disclaimer: Terrain-based analysis only. Ground verification required.]

**PRIORITY ACTIONS (Next 30 days):**
- [Format: "Task: [action]. Priority: [1-3]. Reason: [data point]."]  
- [Example: "Task: Survey bedding areas. Priority: 1. Reason: Thermal advantage on NE slopes confirmed."]

**ZONE RECOMMENDATIONS (5-8 locations):**
- **[Zone type]** | Coordinates: [terrain feature] | Justification: [specific data]  
- [Example: "**BEDDING ZONE** | Coordinates: South ridge elevation +15m | Justification: Thermal uplift AM, wind protection 3 sides, escape routes confirmed."]
${terrainInputs.predominantWind ? '' : '- Include wind range guidance for each zone (e.g., "good on W-NW winds")'}

**WARNINGS (5 bullets):**
- [Critical mistakes to avoid with access, pressure, stand placement]
- [Common errors for this terrain type]

**SCOUTING CHECKS (3 bullets):**
- [What to verify on the ground to confirm these assumptions]
- [Signs to look for: rubs, trails, bedding sign, browse]

**WIND STRATEGY:**
${terrainInputs.predominantWind ? 
  '[Wind-specific access and hunting strategies]' : 
  '[General wind range guidance: which areas work on which wind directions, how to approach property from multiple angles]'}

Keep total response under 500 words. Be tactical and specific. Admit uncertainty. This is a PLANNING tool, not gospel.`

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'system',
            content: `You are Tony, an elite Whitetail Habitat Partner with 20+ years of experience. You work with EXPERTS ONLY.

**EVALUATION MODE - RAW PROPERTY ANALYSIS:**
1. **NO BASICS:** Skip definitions. User already knows what bedding/food/staging means.
2. **TERRAIN ANALYSIS:** Focus on RIDGES, SADDLES, PINCH POINTS, WIND PATTERNS, THERMAL FLOWS, and COVER TRANSITIONS.
3. **PARTNER MODE:** Ask about user's goals and existing features before prescribing solutions.
4. **SCREEN vs FOOD AWARENESS:**
   - Screens/cover (Egyptian, Switchgrass, Miscanthus): Placement > Size
   - Food plots: Size matters (grain 3+ acres, clover 0.5+ acres)
5. **ACTIONABLE ZONES:** Suggest specific GPS zones for bedding, food, and access based on TERRAIN, not theory.
6. **WIND-FIRST:** Every recommendation must account for predominant wind direction. Wrong wind = failed plan.

Output format:
**THE GOOD:** [What terrain features work]
**THE RISK:** [What will fail and why]
**THE FIX:** [Specific GPS zones and strategies]

Be a partner. Ask questions. No fluff.`
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      }),
    })

    const data = await res.json()
    
    if (!res.ok) {
      console.error('OpenRouter API error:', data)
      return NextResponse.json({ error: 'Property evaluation failed - API error' }, { status: res.status })
    }

    const evaluation = data?.choices?.[0]?.message?.content || 'No evaluation available.'
    return NextResponse.json({ 
      evaluation,
      meta: {
        borderAcres,
        featuresCount: features.length,
        hasTerrainInputs: !!(terrainFeatures.length > 0 || terrainInputs.terrainNotes || terrainInputs.goals),
        mode: 'property_evaluation'
      }
    })
  } catch (err) {
    console.error('Evaluation error:', err)
    return NextResponse.json({ error: 'Server error during property evaluation' }, { status: 500 })
  }
}
