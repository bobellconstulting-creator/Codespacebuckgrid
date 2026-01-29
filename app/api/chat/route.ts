import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ChatRequestBody = {
  message: string
  imageDataUrl?: string
  spatialContext?: string
}

export async function POST(req: NextRequest) {
  try {
    const key = process.env.OPENROUTER_KEY
    if (!key) return NextResponse.json({ error: 'Missing OPENROUTER_KEY' }, { status: 500 })

    const body = (await req.json()) as ChatRequestBody
    const message = body.message?.trim() || ''
    const imageDataUrl = body.imageDataUrl
    const spatialContext = body.spatialContext || ''

    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    const systemPrompt = `You are Tony, a blunt Whitetail Habitat Partner. Max 3 sentences.${spatialContext ? `\n\nSpatial Context: ${spatialContext}` : ''}`

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: imageDataUrl 
              ? [{ type: 'text', text: message }, { type: 'image_url', image_url: { url: imageDataUrl } }]
              : [{ type: 'text', text: message }]
          }
        ]
      }),
    })

    const data = await res.json()
    const reply = data?.choices?.[0]?.message?.content || 'No reply.'
    return NextResponse.json({ reply })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
