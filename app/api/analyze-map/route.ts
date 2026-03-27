import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

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
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing OPENROUTER_API_KEY' }, { status: 500 })
    }

    const body = (await req.json()) as AnalyzeMapRequest
    let { imageBase64, mimeType } = body
    const prompt = body.prompt || VISION_PROMPT

    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 required' }, { status: 400 })
    }

    // Normalize to a data URL for OpenRouter
    let imageUrl: string
    if (imageBase64.startsWith('data:')) {
      imageUrl = imageBase64
    } else {
      const resolvedMime = mimeType || 'image/jpeg'
      imageUrl = `data:${resolvedMime};base64,${imageBase64}`
    }

    const imageSizeMB = (imageBase64.length * 0.75) / (1024 * 1024)
    console.log('[analyze-map]', {
      hasImage: true,
      imageSizeMB: imageSizeMB.toFixed(2),
      mimeType,
      promptLength: prompt.length
    })

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://codespacebuckgrid.vercel.app',
        'X-Title': 'BuckGrid Pro - Habitat Analyzer'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        temperature: 0.2,
        max_tokens: 1000
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[analyze-map] OpenRouter error:', response.status, errText)
      return NextResponse.json({ error: 'Vision analysis failed', details: errText }, { status: 500 })
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content ?? ''

    console.log('[analyze-map] Raw response:', text.substring(0, 200))

    let visionPacket
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      visionPacket = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('[analyze-map] JSON parse error:', parseErr)
      return NextResponse.json({
        error: 'Failed to parse response as JSON',
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
