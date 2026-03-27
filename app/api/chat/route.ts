import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TONY_SYSTEM = `You are Tony, an expert wildlife biologist and whitetail habitat consultant with 25 years of field experience. You analyze satellite map screenshots of hunting properties and give specific, actionable habitat management advice.

Your expertise covers:
- Food plot placement, size, and crop selection for maximum deer attraction
- Bedding area identification and enhancement (thermal cover, screening, sanctuary creation)
- Deer movement corridors — pinch points, funnels, ridge saddles, creek crossings
- Stand and blind placement for prevailing wind directions and entry/exit routes
- Water source management — natural ponds, man-made water holes, creek access
- Timber and brush management — TSI, hinge cutting, edge creation
- Mast production — oak identification, hard mast diversity
- Property layout and habitat diversity (30% food, 40% bedding, 30% travel)

When you analyze a map, give SPECIFIC location recommendations tied to visible terrain features. Explain the WHY. Prioritize the 2-3 highest-impact improvements.

CRITICAL: You must ALWAYS respond with valid JSON in this exact format:
{"reply": "Your detailed analysis text here", "annotations": [{"type": "food", "label": "Food plot - SE corner", "lat": 38.5, "lng": -98.0}]}

Annotation types: "food" (food plots), "bedding" (bedding areas), "stand" (stand locations), "water" (water sources), "path" (travel corridors), "structure" (blinds/feeders)
Only include annotations when you can confidently identify specific map locations from the image. If coordinates are unclear, return an empty annotations array [].
The reply field should be your full conversational analysis — detailed, expert, specific.`

type ChatRequestBody = {
  message: string
  imageDataUrl?: string
}

type Annotation = {
  type: string
  label: string
  lat: number
  lng: number
}

type TonyResponse = {
  reply: string
  annotations: Annotation[]
}

export async function POST(req: NextRequest) {
  try {
    const key = process.env.GOOGLE_API_KEY ?? 'AIzaSyBRiqfk0YsNcxpjlT0PCAFf7j7Bfr_Yr8A'

    const body = (await req.json()) as ChatRequestBody
    const message = body.message?.trim() || ''
    const imageDataUrl = body.imageDataUrl

    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', systemInstruction: TONY_SYSTEM })

    const parts: any[] = [{ text: message }]

    if (imageDataUrl) {
      const [meta, base64] = imageDataUrl.split(',')
      const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg'
      parts.push({ inlineData: { mimeType, data: base64 } })
    }

    const result = await model.generateContent(parts)
    const rawText = result.response.text() ?? ''

    // Parse Tony's structured JSON response
    let tonyResponse: TonyResponse = { reply: rawText, annotations: [] }
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText.trim()
      const parsed = JSON.parse(jsonStr)
      if (parsed.reply) {
        tonyResponse = {
          reply: parsed.reply,
          annotations: Array.isArray(parsed.annotations) ? parsed.annotations : []
        }
      }
    } catch {
      tonyResponse = { reply: rawText || 'No response from Tony.', annotations: [] }
    }

    // Convert lat/lng annotations to GeoJSON points
    const features = tonyResponse.annotations
      .filter((a: Annotation) => typeof a.lat === 'number' && typeof a.lng === 'number')
      .map((a: Annotation) => ({
        type: a.type,
        label: a.label,
        geojson: {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
          properties: { type: a.type, label: a.label }
        }
      }))

    return NextResponse.json({ reply: tonyResponse.reply, annotations: features })
  } catch (err) {
    console.error('[chat] error:', err)
    return NextResponse.json({ error: 'Server error', reply: 'Tony is unavailable right now. Try again.' }, { status: 500 })
  }
}
