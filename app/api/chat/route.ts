import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ChatRequestBody = {
  message: string
  imageDataUrl?: string
}

export async function POST(req: NextRequest) {
  try {
    const key = process.env.OPENROUTER_KEY
    if (!key) return NextResponse.json({ error: 'Missing OPENROUTER_KEY' }, { status: 500 })

    const body = (await req.json()) as ChatRequestBody
    const message = body.message?.trim() || ''
    const imageDataUrl = body.imageDataUrl

    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    // Guard for large images (413)
    if (imageDataUrl && imageDataUrl.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large' }, { status: 413 })
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: 'You are Tony, a blunt Whitetail Habitat Partner. Max 3 sentences.' },
          {
            role: 'user',
            content: imageDataUrl 
              ? [{ type: 'text', text: message }, { type: 'image_url', image_url: { url: imageDataUrl } }]
              : [{ type: 'text', text: message }]
          }
        ]
      }),
    })

    // Return 502 for upstream failures
    if (!res.ok) {
      console.error('OpenRouter API error:', res.status, await res.text())
      return NextResponse.json({ error: 'Upstream service error' }, { status: 502 })
    }

    const data = await res.json()
    const reply = data?.choices?.[0]?.message?.content || 'No reply.'
    
    // In non-production, also return raw data for debugging
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ reply, _debug: data })
    }
    
    return NextResponse.json({ reply })
  } catch (err) {
    console.error('Server error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
