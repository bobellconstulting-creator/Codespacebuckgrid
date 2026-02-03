import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Increase payload size limit for large map screenshots
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
}

const VISION_PROMPT = `You are a spatial scanner. Analyze this aerial map image. Locate all visible regions: timber/forest areas, open fields/pasture, water features, and agricultural land. Return ONLY raw JSON coordinates. NO TEXT. NO EXPLANATIONS. NO MARKDOWN. Use this exact schema: {"features":[{"label":"heavy_timber"|"scrub_brush"|"open_pasture","box_2d":[ymin,xmin,ymax,xmax],"confidence":0.0-1.0}]} where coordinates are 0-1000 scale normalized to image bounds. START WITH { and END WITH }.`

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

    // Debug: Log incoming request details
    console.log('[analyze-map] Vision API received request. Image size:', imageBase64?.length || 'No image')

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

    // Use direct v1 API call with the latest stable model
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`
    
    // Debug: Log image data being sent
    console.log('[analyze-map] SENDING TO GEMINI via v1 API (gemini-1.5-flash-latest):', imageBase64.substring(0, 50) + '...')

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { 
              inline_data: {
                mime_type: mimeType,
                data: imageBase64
              }
            }
          ]
        }]
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[analyze-map] Gemini API error:', errorData)
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      console.error('[analyze-map] No text in response:', data)
      throw new Error('No text content in Gemini response')
    }
    
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
    // Enhanced error logging - log FULL error object for debugging
    console.error('[analyze-map] Vision analysis failed - Full error details:', err)
    
    const errorMessage = err instanceof Error ? err.message : String(err)
    const errorStack = err instanceof Error ? err.stack : undefined
    const errorStatus = (err as any)?.status || 500
    const errorDetails = (err as any)?.errorDetails || undefined
    
    console.error('[analyze-map] Parsed error info:', {
      message: errorMessage,
      status: errorStatus,
      details: errorDetails,
      stack: errorStack
    })
    
    return NextResponse.json({ 
      error: 'Vision analysis failed', 
      message: errorMessage,
      status: errorStatus,
      details: errorDetails || errorStack 
    }, { status: 500 })
  }
}
