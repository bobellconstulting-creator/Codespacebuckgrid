// /api/agri-tony — BuckGrid Agri endpoint.
//
// Takes the same AOI bounds as /api/spatial, reuses the existing spatial
// fetch (OSM/elevation/soil/NLCD/wetlands), and returns an agriculture-
// focused suitability summary plus an LLM-generated recommendation aimed
// at farmers, crop consultants, and land trusts instead of deer hunters.
//
// Same engine. Different lens. $5-15k engagements, not $29/mo.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { fetchSpatialData, isValidBounds, boundsAreaDegreesSq } from '../../../lib/spatial'
import { buildAgriSummary, formatAgriSummaryForLLM, type AgriSummary } from '../../../lib/spatial-agri'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface AgriTonyRequestBody {
  bounds?: unknown
  totalAcres?: unknown
  question?: unknown
}

interface AgriTonyResponse {
  success: boolean
  summary?: AgriSummary
  recommendation?: string
  error?: string
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return 'Unexpected error'
}

const AGRI_SYSTEM_PROMPT = [
  'You are Tony Agri — an expert agronomist and land-use consultant.',
  'You analyze real satellite + SSURGO + NLCD data for a specific parcel and give',
  'farmers, crop consultants, and land trusts specific, actionable recommendations.',
  '',
  'Rules:',
  '- Only cite facts present in the data block below. Do NOT invent soil types or yields.',
  '- Be specific and numeric. Name crops, rotations, and practices.',
  '- If the data is missing something critical, say so.',
  '- Keep the response under 400 words.',
  '- Lead with the best use of the land. Follow with 2–4 bullet recommendations.',
].join('\n')

async function callGeminiForRecommendation(summaryText: string, question: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_KEY
  if (!apiKey) throw new Error('No Gemini key')

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: AGRI_SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: `DATA:\n${summaryText}\n\nQUESTION: ${question}` }] }],
        generationConfig: { maxOutputTokens: 1024 },
      }),
    }
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = await res.json()
  const text: string | undefined = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini empty response')
  return text.trim()
}

async function callGroqForRecommendation(summaryText: string, question: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('No Groq key')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: AGRI_SYSTEM_PROMPT },
        { role: 'user', content: `DATA:\n${summaryText}\n\nQUESTION: ${question}` },
      ],
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Groq ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = await res.json()
  const text: string | undefined = json.choices?.[0]?.message?.content
  if (!text) throw new Error('Groq empty response')
  return text.trim()
}

async function callLlmForRecommendation(summaryText: string, question: string): Promise<string> {
  // Primary: Gemini 2.5 Flash (free)
  try {
    return await callGeminiForRecommendation(summaryText, question)
  } catch (geminiErr) {
    console.warn('[agri-tony] Gemini failed, trying Groq:', geminiErr instanceof Error ? geminiErr.message : geminiErr)
  }
  // Fallback: Groq llama-3.3-70b (free)
  return callGroqForRecommendation(summaryText, question)
}

export async function POST(req: NextRequest): Promise<NextResponse<AgriTonyResponse>> {
  try {
    const body = (await req.json()) as AgriTonyRequestBody
    const { bounds, totalAcres, question } = body

    if (!isValidBounds(bounds)) {
      return NextResponse.json({ success: false, error: 'Valid bounds required' }, { status: 400 })
    }
    if (boundsAreaDegreesSq(bounds) > 0.25) {
      return NextResponse.json(
        { success: false, error: 'Bounds too large — zoom in closer to your parcel' },
        { status: 400 },
      )
    }

    const spatial = await fetchSpatialData(bounds)
    const acres = typeof totalAcres === 'number' && totalAcres > 0 ? totalAcres : 0
    const summary = buildAgriSummary({ bounds, spatial, totalAcres: acres })
    const summaryText = formatAgriSummaryForLLM(summary)

    const q = typeof question === 'string' && question.trim().length > 0
      ? question.trim()
      : 'What is the best agricultural use of this parcel, and what are the top 3 practices you would recommend for the first year?'

    let recommendation = ''
    try {
      recommendation = await callLlmForRecommendation(summaryText, q)
    } catch (llmErr) {
      recommendation = `LLM unavailable: ${getErrorMessage(llmErr)}\n\nData summary:\n${summaryText}`
    }

    return NextResponse.json({ success: true, summary, recommendation })
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(err) },
      { status: 500 },
    )
  }
}
