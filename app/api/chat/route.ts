import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type DrawnFeature = {
  toolId: string
  toolName: string
  color: string
  latlngs: { lat: number; lng: number }[]
}

type ChatRequestBody = {
  message: string
  imageDataUrl?: string
  features?: DrawnFeature[]
  propertyAcres?: number
}

export async function POST(req: NextRequest) {
  try {
    const key = process.env.OPENROUTER_KEY
    if (!key) return NextResponse.json({ reply: 'I am having trouble connecting. Please try again.', features: [] })

    const body = (await req.json()) as ChatRequestBody
    console.log('[chat/route] incoming request:', {
      messageLength: body.message?.length,
      hasImage: !!body.imageDataUrl,
      featureCount: body.features?.length ?? 0,
      propertyAcres: body.propertyAcres,
    })

    const message = body.message?.trim() || ''
    const imageDataUrl = body.imageDataUrl
    const features = body.features ?? []
    const propertyAcres = body.propertyAcres ?? 0

    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    // Build context about drawn layers
    let layerContext = ''
    if (features.length > 0) {
      const summary = features.reduce<Record<string, number>>((acc, f) => {
        acc[f.toolName] = (acc[f.toolName] || 0) + 1
        return acc
      }, {})
      const parts = Object.entries(summary).map(([name, count]) => `${count} ${name} zone(s)`)
      layerContext = `\n\nThe user's map currently has: ${parts.join(', ')}.`
      if (propertyAcres) layerContext += ` Property size: ${propertyAcres} acres.`
    }

    const systemPrompt = `You are Tony, a blunt Whitetail Habitat Partner. You help landowners plan food plots, bedding areas, sanctuary zones, and stand placements for whitetail deer management. Max 3 sentences.${layerContext}`

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
              : [{ type: 'text', text: message }],
          },
        ],
      }),
    })

    if (!res.ok) {
      console.error('[chat/route] OpenRouter error:', res.status, await res.text().catch(() => ''))
      return NextResponse.json({ reply: 'I am having trouble connecting. Please try again.', features: [] })
    }

    const data = await res.json()
    const reply = data?.choices?.[0]?.message?.content

    if (!reply) {
      console.error('[chat/route] Empty reply from model:', JSON.stringify(data))
      return NextResponse.json({ reply: 'I am having trouble connecting. Please try again.', features: [] })
    }

    return NextResponse.json({ reply, features: [] })
  } catch (err) {
    console.error('[chat/route] Server error:', err)
    return NextResponse.json({ reply: 'I am having trouble connecting. Please try again.', features: [] })
  }
}
