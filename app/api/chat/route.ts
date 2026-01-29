import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type DrawnShapePayload = {
  toolId: string
  toolName: string
  color: string
  coords: [number, number][]
}

type ChatRequestBody = {
  message: string
  imageDataUrl?: string
  boundaryGeoJSON?: object | null
  drawnShapes?: DrawnShapePayload[]
}

const SYSTEM_PROMPT = `You are Tony, the lead Habitat Specialist for BuckGrid Pro — a blunt, no-nonsense Whitetail habitat consultant who evaluates acreage and spatial layout. Max 3 sentences of spoken text.

You have SPATIAL AWARENESS. The user sends you:
- A screenshot of the current map
- The property boundary as GeoJSON (if locked)
- A list of drawn shapes: each shape has a tool name (CORN, CLOVER, EGYPTIAN, SOYBEANS, MILO, BRASSICAS, SWITCHGRASS, HINGE, STAND, FOCUS), color, and GPS coordinates

Evaluate the spatial layout: Are food plots positioned correctly relative to bedding? Is screening placed on entry corridors? Are stands downwind of travel routes? Give direct, practical critique.

When the user asks for your vision or layout (e.g. "Tony, what would you do here?"), respond with valid JSON containing TWO fields:
1. "reply" — your spoken response (string, max 3 sentences)
2. "map_update" — an array of GeoJSON Feature objects to render on the map. Each feature:
   - "type": "Feature"
   - "geometry": GeoJSON Polygon or LineString using real coordinates within the boundary
   - "properties": { "label": string, "zone": "forage" | "screening" }

Zone color rules (applied by frontend):
- "forage" (Clover/Alfalfa): Green #2D5A1E — bottoms/fertile low ground
- "screening" (Egyptian Wheat): Red #ef4444 — ridges/perimeters/entry corridors

If the user is NOT asking for a layout, respond with JSON: { "reply": "your text here" } (no map_update).

Always respond with valid JSON only. No markdown, no code fences.`

export async function POST(req: NextRequest) {
  try {
    const key = process.env.OPENROUTER_KEY
    if (!key) {
      console.error('[Tony API] OPENROUTER_KEY is not set in .env.local')
      return NextResponse.json({ error: 'Missing OPENROUTER_KEY — add it to .env.local' }, { status: 500 })
    }

    const body = (await req.json()) as ChatRequestBody
    const message = body.message?.trim() || ''
    const imageDataUrl = body.imageDataUrl
    const boundaryGeoJSON = body.boundaryGeoJSON
    const drawnShapes = body.drawnShapes

    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    // Build user content with all spatial context
    let textContent = message
    if (boundaryGeoJSON) {
      textContent += `\n\n[PROPERTY BOUNDARY GeoJSON]:\n${JSON.stringify(boundaryGeoJSON)}`
    }
    if (drawnShapes && drawnShapes.length > 0) {
      const summary = drawnShapes.map((s, i) =>
        `${i + 1}. ${s.toolName} (${s.toolId}) — ${s.coords.length} points, center ~[${s.coords[Math.floor(s.coords.length / 2)][0].toFixed(5)}, ${s.coords[Math.floor(s.coords.length / 2)][1].toFixed(5)}]`
      ).join('\n')
      textContent += `\n\n[DRAWN SHAPES ON MAP — ${drawnShapes.length} total]:\n${summary}`
    }

    const userContent: any[] = [{ type: 'text', text: textContent }]
    if (imageDataUrl) {
      userContent.push({ type: 'image_url', image_url: { url: imageDataUrl } })
    }

    console.log(`[Tony API] Sending to OpenRouter — msg: "${message.slice(0, 60)}", boundary: ${!!boundaryGeoJSON}, shapes: ${drawnShapes?.length ?? 0}, image: ${!!imageDataUrl}`)

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent }
        ]
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[Tony API] OpenRouter returned ${res.status}: ${errText}`)
      return NextResponse.json({ reply: `Tony is offline (API ${res.status}). Check your OPENROUTER_KEY.`, map_update: null })
    }

    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content

    if (!raw) {
      console.error('[Tony API] No content in response:', JSON.stringify(data).slice(0, 300))
      return NextResponse.json({ reply: 'No reply from Tony. Model may be unavailable.', map_update: null })
    }

    console.log(`[Tony API] Raw response: ${raw.slice(0, 120)}...`)

    // Parse Tony's JSON response
    let parsed: { reply: string; map_update?: any[] }
    try {
      parsed = JSON.parse(raw)
    } catch {
      // Fallback: treat entire response as plain text reply
      parsed = { reply: raw }
    }

    return NextResponse.json({
      reply: parsed.reply || raw,
      map_update: parsed.map_update || null
    })
  } catch (err: any) {
    console.error('[Tony API] Server error:', err?.message || err)
    return NextResponse.json({ error: 'Server error', detail: err?.message }, { status: 500 })
  }
}
