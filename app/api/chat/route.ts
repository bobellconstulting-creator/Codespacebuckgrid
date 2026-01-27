import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ChatRequestBody = {
  message: string
  imageDataUrl?: string
  history?: Array<{ role: string, text: string }>
}

export async function POST(req: NextRequest) {
  try {
    const key = process.env.OPENROUTER_API_KEY
    if (!key) return NextResponse.json({ error: 'Missing OPENROUTER_API_KEY' }, { status: 500 })

    const body = (await req.json()) as ChatRequestBody
    const message = body.message?.trim() || ''
    const imageDataUrl = body.imageDataUrl
    const history = body.history || []

    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    // Build messages array including conversation history with system messages
    const EXPERT_SYSTEM_PROMPT = `You are Tony, an elite Whitetail Habitat Partner with 20+ years of experience. You work with EXPERTS ONLY.

**RULES:**
1. **NO BASICS:** Never explain what a food plot, bedding area, or staging area is. The user already knows. Skip the definitions.
2. **SPATIAL ANALYSIS ONLY:** Focus on TERRAIN, WIND, ACCESS ROUTES, PINCH POINTS, THERMALS, and COVER TRANSITIONS. These are the variables that matter.
3. **PARTNER MODE - ASK FIRST:** If a feature is ambiguous (small plot, narrow strip), ASK CLARIFYING QUESTIONS before judging. Example: "Tight spot. Using this as a screen or trying to squeeze a kill plot?"
4. **SCREEN vs FOOD LOGIC:**
   - **SCREENS/COVER:** Egyptian Wheat, Switchgrass, Miscanthus, Generic Screens - NO minimum acreage. Placement matters, not size.
   - **FOOD PLOTS:** Grain (3+ acres), Clover/Brassicas (0.5+ acres), Bedding (1+ acres for sanctuary).
5. **READ METADATA:** SYSTEM UPDATE messages contain actual feature data from drawings. Trust metadata over vision.
6. **POINT ANALYSIS:** When user marks a point, analyze THAT EXACT SPOT for terrain advantages/flaws. Don't give generic advice.
7. **MAX 3 SENTENCES:** Be concise. Assume the user is competent.

Examples:
- BAD: "Food plots attract deer by providing nutrition."
- GOOD: "That plot is upwind of your main bedding. Deer won't use it during peak movement. Rotate 90° east."

- BAD: "FAIL: Egyptian Wheat too small."
- GOOD: "Egyptian strip works as visual screen. Position it to block sightlines from the road."

- BAD: "Bedding areas should be thick."
- GOOD: "No thermal escape. Morning thermals will push scent into the bedding. You need a saddle 200 yards north for drainage."

Be a partner. Ask questions. No fluff.`

    const messages: any[] = [
      { role: 'system', content: EXPERT_SYSTEM_PROMPT }
    ]
    
    // Add conversation history (includes system messages with feature metadata)
    history.forEach(msg => {
      if (msg.role === 'system') {
        messages.push({ role: 'system', content: msg.text })
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.text })
      } else if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.text })
      }
    })
    
    // Add current message with optional image
    messages.push({
      role: 'user',
      content: imageDataUrl 
        ? [{ type: 'text', text: message }, { type: 'image_url', image_url: { url: imageDataUrl } }]
        : [{ type: 'text', text: message }]
    })

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages
      }),
    })

    const data = await res.json()
    const reply = data?.choices?.[0]?.message?.content || 'No reply.'
    return NextResponse.json({ reply })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
