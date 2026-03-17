import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VISION_PROMPT = `Classify the aerial map image into habitat features. Identify regions as heavy_timber, scrub_brush, or open_pasture. Return bounding boxes in normalized coordinates (0..1000 scale). Output ONLY valid JSON with this exact schema: {"features":[{"label":"heavy_timber"|"scrub_brush"|"open_pasture","box_2d":[ymin,xmin,ymax,xmax],"confidence":0.0-1.0}],"notes":["max 3 short observations"]}. No markdown, no extra keys.`

type AnalyzeMapRequest = {
  imageBase64: string
  prompt?: string
  mimeType?: string
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 })
    }

    const body = (await req.json()) as AnalyzeMapRequest
    let { imageBase64, mimeType } = body
    const prompt = body.prompt || VISION_PROMPT

    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 required' }, { status: 400 })
    }

    // Strip data URL prefix if present (e.g., "data:image/jpeg;base64,")
    const dataUrlMatch = imageBase64.match(/^data:([^;]+);base64,(.+)$/)
    if (dataUrlMatch) {
      mimeType = mimeType || dataUrlMatch[1]
      imageBase64 = dataUrlMatch[2]
    }
    mimeType = mimeType || 'image/jpeg'

    // Calculate size for logging (base64 size * 0.75 ≈ binary size)
    const imageSizeMB = (imageBase64.length * 0.75) / (1024 * 1024)

    // Log metadata only (NO base64 logging)
    console.log('[analyze-map]', {
      hasImage: true,
      imageSizeMB: imageSizeMB.toFixed(2),
      mimeType,
      promptLength: prompt.length
    })

    // Initialize Gemini AI
    const genAI = new GoogleGenAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })

    // Generate content with image + prompt
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { 
            inlineData: {
              mimeType,
              data: imageBase64
            }
          }
        ]
      }]
    })

    const response = await result.response
    const text = response.text()

    console.log('[analyze-map] Raw Gemini response:', text.substring(0, 200))

    // Parse JSON response (strip markdown fences if present)
    let visionPacket
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      visionPacket = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('[analyze-map] JSON parse error:', parseErr)
      return NextResponse.json({
        error: 'Failed to parse Gemini response as JSON',
        rawResponse: text.substring(0, 500)
      }, { status: 500 })
    }

    console.log('[analyze-map] Parsed visionPacket:', JSON.stringify(visionPacket, null, 2))

    return NextResponse.json({ visionPacket })
  } catch (err) {
    console.error('[analyze-map] Error:', err)
    return NextResponse.json({
      error: 'Vision analysis failed',
      details: err instanceof Error ? err.message : String(err)
    }, { status: 500 })
  }
}
