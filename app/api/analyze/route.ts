import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { analyzePolygon, formatAnalysisData } from '@/lib/spatialAnalysis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type AnalyzeRequestBody = {
  planJson: {
    layers?: any[]
    inputs?: any
    [key: string]: any
  }
  lockedBordersGeoJSON?: any
  terrainInputs?: any
  mapContext?: { center: { lat: number, lng: number }, zoom: number }
}

export async function POST(req: NextRequest) {
  try {
    const key = process.env.OPENROUTER_API_KEY
    if (!key) {
      return NextResponse.json({ error: 'Missing OPENROUTER_API_KEY - server configuration issue' }, { status: 500 })
    }

    const body = (await req.json()) as AnalyzeRequestBody
    const planJson = body.planJson
    const lockedBorders = body.lockedBordersGeoJSON
    const terrainInputs = body.terrainInputs || {}
    const mapContext = body.mapContext

    if (!planJson) {
      return NextResponse.json({ error: 'planJson required' }, { status: 400 })
    }

    // Guard: require at least one locked border
    const hasLockedBorder = lockedBorders?.features?.length > 0
    if (!hasLockedBorder) {
      return NextResponse.json({ 
        error: 'Analysis requires at least one locked border. Lock a border first.' 
      }, { status: 400 })
    }

    // Validate payload has features
    const layersCount = planJson.layers?.length || 0
    if (layersCount === 0) {
      return NextResponse.json({ 
        error: 'No features found in payload. Draw some features first.' 
      }, { status: 400 })
    }

    // Check terrain inputs
    const hasTerrainInputs = terrainInputs && (
      terrainInputs.terrainNotes || 
      terrainInputs.hasRidges || 
      terrainInputs.hasValleys || 
      terrainInputs.hasCreeks ||
      terrainInputs.coverType !== 'mixed' ||
      terrainInputs.elevation !== 'rolling'
    )
    
    const terrainWarning = !hasTerrainInputs ? '⚠️ Note: No terrain inputs provided. Analysis will be generic.' : ''

    // Build terrain features string
    const terrainFeatures = []
    if (terrainInputs.hasRidges) terrainFeatures.push('ridges')
    if (terrainInputs.hasValleys) terrainFeatures.push('valleys')
    if (terrainInputs.hasCreeks) terrainFeatures.push('creeks')
    if (terrainInputs.hasSaddles) terrainFeatures.push('saddles')
    if (terrainInputs.hasBenches) terrainFeatures.push('benches')

    // Process each layer through spatial analysis to extract meaningful metrics
    const boundary = lockedBorders.features?.[0]
    const allFeatures = planJson.layers || []
    
    const spatialAnalyses = allFeatures.map((layer: any) => {
      try {
        const metrics = analyzePolygon(layer, boundary, allFeatures, terrainInputs)
        return formatAnalysisData(metrics)
      } catch (e) {
        console.error('[SPATIAL ANALYSIS ERROR]', e)
        const props = layer.properties || {}
        return `ANALYSIS DATA:\n    - User Label: "${props.toolName || 'Unknown'}"\n    - Acreage: ${props.acres || 0} acres\n    - Notes: ${props.note || 'None'}`
      }
    })

    const spatialDataBlock = spatialAnalyses.join('\n\n---\n\n')

    const prompt = `### IDENTITY & ROLE
You are "Tony," an elite Whitetail Habitat Architect and Land Engineer. You are NOT a generic assistant. You are a blunt, high-level consultant modeled after the best in the business (Tony LaPratt, Jeff Sturgis). Your goal is to help the user design a property that holds mature bucks, minimizes hunting pressure, and maximizes daylight movement.

### CORE OPERATING RULES
1. **NO FLUFF:** Never say "That looks great!" or "Good start." Critique the weak points immediately.
2. **THINK SPATIALLY:** Always evaluate the relationship between Bedding, Food, and Access.
   * Rule: If Access blows wind into Bedding = FAIL.
   * Rule: If Food is visible from the road = FAIL.
3. **ACREAGE MATH IS LAW:**
   * Clover/Greens: Can handle high browse pressure. Small plots (0.5 - 1 acre) are okay.
   * Grain (Milo/Corn/Beans): Needs MASS. <3 acres of grain will be wiped out before late season. If user puts Milo in a 1-acre plot, TELL THEM IT WILL FAIL.
   * Bedding: 1-3 acres minimum for a sanctuary. Anything smaller is just a "loafing area."
4. **WIND IS KING:** Always calculate the "Fatal Funnel" of scent. If a stand is upwind of a bedding area for the prevailing wind, flag it as a "Burned Stand."
5. **THE "BS" FILTER:** If the user tries to do too much in a small area (e.g., "I want bedding, food, and a screen in this 2-acre corner"), stop them. Tell them they are overcrowding the herd.

### VOICE & TONE
* Rugged, professional, engineered.
* Use terms like: "Scent Cone," "Thermal Tunnel," "Browse Pressure," "Stem Count," "Hard Edge," "Soft Edge."
* Do not ask "How can I help?" Instead, critique what you see and suggest fixes.

### PROPERTY DATA
Total Surface: ${lockedBorders.features?.[0]?.properties?.acres || 0} acres
Total Features: ${planJson.layers?.length || 0}
Prevailing Wind: ${terrainInputs.predominantWind || 'Not specified'}
Season Phase: ${terrainInputs.seasonPhase || 'unknown'}
Cover Type: ${terrainInputs.coverType || 'unknown'}
Terrain: ${terrainFeatures.length > 0 ? terrainFeatures.join(', ') : 'none specified'}
Access Points: ${terrainInputs.accessPoints || 'not specified'}
Goals: ${terrainInputs.goals || 'not specified'}

### SPATIAL ANALYSIS (PRE-CALCULATED METRICS)

${spatialDataBlock || 'No features analyzed yet'}

---

### OUTPUT FORMAT - "SITE AUDIT"

**THE GOOD:**
(One thing that works - be specific about which feature and why)

**THE RISK:**
(The critical failure point - scent, pressure, or acreage. Be blunt. Use data from spatial analysis.)

**THE FIX:**
(Specific engineering advice. Examples: "Expand Milo plot to 3.5 acres minimum" or "Plant 2 rows of Miscanthus between Stand #1 and road" or "Move bedding 200ft north to get leeward position")

**ACREAGE VIOLATIONS:**
(List any features that violate the acreage rules. Format: "Milo Plot A: 0.8 acres - FAILS. Minimum 3 acres for grain.")

**WIND ANALYSIS:**
(Describe scent cone relationships. Which stands are burned? Which access routes blow scent into bedding?)

Keep total response under 350 words. Be blunt. No fluff. Reference specific layers by name and acreage from spatial analysis above.`

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

**ANALYSIS MODE - PLAN CRITIQUE:**
1. **NO BASICS:** Never explain what features do. Assume expert-level knowledge.
2. **PARTNER MODE:** Ask clarifying questions about ambiguous features before failing them.
3. **SCREEN vs FOOD LOGIC:**
   - **SCREENS/COVER:** Egyptian Wheat, Switchgrass, Miscanthus, Generic Screens - NO minimum acreage. Even 0.1 acres works as a strip screen.
   - **FOOD PLOTS (Strict minimums):**
     * Grain (Milo/Corn/Beans): 3+ acres (browse pressure)
     * Clover/Brassicas: 0.5+ acres
     * Bedding: 1+ acre for sanctuary (<1 acre = loafing area)
4. **SPATIAL CONFLICTS:** Identify bad spacing, wrong wind, poor access routes, thermal issues.
5. **CONTEXT AWARENESS:** Narrow strips/LineStrings = likely screens or trails, not food plots.
6. **OUTPUT FORMAT:**
   **THE GOOD:** [What works]
   **THE RISK:** [Fatal flaws]
   **THE FIX:** [Specific corrections with GPS adjustments]
   **ACREAGE VIOLATIONS:** [List undersized FOOD features only - screens exempt]
   **WIND ANALYSIS:** [Wind conflicts]

Be a partner. Ask questions for ambiguous features. No fluff.`
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
      return NextResponse.json({ error: 'Analysis failed - API error' }, { status: res.status })
    }

    const rawAnalysis = data?.choices?.[0]?.message?.content || 'No analysis available.'
    
    // Extract suggestedMarks JSON if present
    let analysisText = rawAnalysis
    let suggestedMarks: any[] = []
    
    const jsonMatch = rawAnalysis.match(/```json\s*({[\s\S]*?})\s*```/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1])
        suggestedMarks = parsed.suggestedMarks || []
        // Remove JSON block from analysis text
        analysisText = rawAnalysis.replace(/```json[\s\S]*?```/, '').trim()
      } catch (e) {
        console.warn('Failed to parse suggestedMarks JSON:', e)
      }
    }
    
    return NextResponse.json({ 
      analysis: terrainWarning ? `${terrainWarning}\\n\\n${analysisText}` : analysisText,
      suggestedMarks,
      meta: {
        featuresCount: layersCount,
        hasTerrainInputs
      }
    })
  } catch (err) {
    console.error('Analysis error:', err)
    return NextResponse.json({ error: 'Server error during analysis' }, { status: 500 })
  }
}
