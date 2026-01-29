import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ChatRequestBody = {
  message: string
  imageDataUrl?: string
  boundaryGeoJSON?: object | null
}

const SYSTEM_PROMPT = `You are Tony, the lead Habitat Architect for BuckGrid Pro — a blunt, no-nonsense Whitetail habitat consultant. Max 3 sentences of spoken text.

You have SPATIAL AWARENESS. When the user provides boundary GeoJSON, analyze the property. Identify "bottoms" (low-lying areas) for high-protein forage and "ridges/perimeters" for tactical screening.

When the user asks for your vision or layout (e.g. "Tony, what would you do here?"), you MUST respond with valid JSON containing TWO fields:
1. "reply" — your spoken response (string, max 3 sentences)
2. "map_update" — an array of GeoJSON Feature objects to render on the map. Each feature must have:
   - "type": "Feature"
   - "geometry": a GeoJSON Polygon or LineString using real coordinates within the property boundary
   - "properties": { "label": string, "zone": "forage" | "screening" }

Zone color rules (applied by the frontend):
- "forage" (Clover/Alfalfa): Green #2D5A1E — place in bottoms/fertile low ground
- "screening" (Egyptian Wheat): Red #ef4444 — place on ridges/perimeters/entry corridors

If the user is NOT asking for a layout, respond with JSON: { "reply": "your text here" } (no map_update).

Always respond with valid JSON only. No markdown, no code fences.`

export async function POST(req: NextRequest) {
  try {
    const key = process.env.OPENROUTER_KEY
    if (!key) return NextResponse.json({ error: 'Missing OPENROUTER_KEY' }, { status: 500 })

    const body = (await req.json()) as ChatRequestBody
    const message = body.message?.trim() || ''
    const imageDataUrl = body.imageDataUrl
    const boundaryGeoJSON = body.boundaryGeoJSON

    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    // Build user content with context
    let textContent = message
    if (boundaryGeoJSON) {
      textContent += `\n\n[PROPERTY BOUNDARY GeoJSON]:\n${JSON.stringify(boundaryGeoJSON)}`
    }

    const userContent = imageDataUrl
      ? [{ type: 'text', text: textContent }, { type: 'image_url', image_url: { url: imageDataUrl } }]
      : [{ type: 'text', text: textContent }]

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

    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content || '{"reply":"No reply."}'

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
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
