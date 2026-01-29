import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const messages: { role: string; content: unknown }[] = body.messages ?? []

    // Also support legacy single-message format
    if (!messages.length && body.message) {
      const content = body.imageDataUrl
        ? [{ type: 'text', text: body.message }, { type: 'image_url', image_url: { url: body.imageDataUrl } }]
        : [{ type: 'text', text: body.message }]
      messages.push({ role: 'user', content })
    }

    if (!messages.length) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
    }

    const key = process.env.OPENROUTER_KEY
    if (!key) {
      return NextResponse.json({ reply: 'Tony is offline — no API key configured.' })
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
          ...messages,
        ],
      }),
    })

    const data = await res.json()
    const reply = data?.choices?.[0]?.message?.content || 'No reply.'
    return NextResponse.json({ reply })
  } catch (err) {
    console.error('[chat/route] error:', err)
    return NextResponse.json({ reply: 'Tony hit a snag. Try again.' }, { status: 200 })
  }
}
