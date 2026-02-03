import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/genai'

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
    // Check for either variable name to be safe
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing GEMINI_API_KEY or GOOGLE_API_KEY' }, { status: 500 })
    }

    const body = (await req.json()) as AnalyzeMapRequest
    let { imageBase64, mimeType } = body
    const prompt = body.prompt || VISION_PROMPT

    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 required' }, { status: 400 })
    }

    // Strip data URL prefix if present
    const dataUrlMatch = imageBase64.match(/^data:([^;]+);base64,(.+)$/)
    if (dataUrlMatch) {
      mimeType = mimeType || dataUrlMatch[1]
      imageBase64 = dataUrlMatch[2]
    }
    mimeType = mimeType || 'image/jpeg'

    // Initialize Gemini AI (1.5 Flash)
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    // Generate content
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
    
    // Parse JSON response
    let visionPacket
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      visionPacket = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('[analyze-map] JSON parse error:', parseErr)
      return NextResponse.json({ error: 'Failed to parse Gemini response', raw: text }, { status: 500 })
    }

    return NextResponse.json({ visionPacket })
  } catch (err) {
    console.error('[analyze-map] Error:', err)
    return NextResponse.json({ error: 'Vision analysis failed', details: String(err) }, { status: 500 })
  }
}
