import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ChatRequestBody = {
  message: string
  imageDataUrl?: string
}

const TONY_PROMPT = 'You are Tony, a blunt Whitetail Habitat Partner. Give specific, actionable habitat advice based on what you see. Max 3 sentences.'

export async function POST(req: NextRequest) {
  try {
    const key = process.env.GOOGLE_API_KEY
    if (!key) return NextResponse.json({ error: 'Missing GOOGLE_API_KEY' }, { status: 500 })

    const body = (await req.json()) as ChatRequestBody
    const message = body.message?.trim() || ''
    const imageDataUrl = body.imageDataUrl

    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', systemInstruction: TONY_PROMPT })

    const parts: any[] = [{ text: message }]

    if (imageDataUrl) {
      const [meta, base64] = imageDataUrl.split(',')
      const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/png'
      parts.push({ inlineData: { mimeType, data: base64 } })
    }

    const result = await model.generateContent(parts)
    const reply = result.response.text() || 'No reply.'
    return NextResponse.json({ reply })
  } catch (err) {
    console.error('[chat] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
