import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type AnalyzeRequestBody = {
  planJson: {
    layers?: any[]
    inputs?: any
    [key: string]: any
  }
}

export async function POST(req: NextRequest) {
  try {
    const key = process.env.OPENROUTER_API_KEY
    if (!key) {
      return NextResponse.json({ error: 'Missing OPENROUTER_API_KEY' }, { status: 500 })
    }

    const body = (await req.json()) as AnalyzeRequestBody
    const planJson = body.planJson

    if (!planJson) {
      return NextResponse.json({ error: 'planJson required' }, { status: 400 })
    }

    // Prepare the analysis prompt
    const prompt = `Analyze this habitat plan:
${JSON.stringify(planJson, null, 2)}

Provide a brief analysis of the property layout, food plots, and deer management strategy. Keep response under 5 sentences.`

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'system',
            content: 'You are Tony, a blunt Whitetail Habitat Partner. Analyze property layouts and provide actionable insights.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      }),
    })

    const data = await res.json()
    
    if (!res.ok) {
      console.error('OpenRouter API error:', data)
      return NextResponse.json({ error: 'Analysis failed' }, { status: res.status })
    }

    const analysis = data?.choices?.[0]?.message?.content || 'No analysis available.'
    return NextResponse.json({ analysis })
  } catch (err) {
    console.error('Analysis error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
