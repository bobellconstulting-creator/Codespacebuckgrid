import { NextResponse } from 'next/server';

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing OPENROUTER_API_KEY' }, { status: 500 });
    }

    const spatialData = await req.json();

    if (!spatialData || !spatialData.mapData) {
      return NextResponse.json({ error: 'Invalid spatial data provided' }, { status: 400 });
    }

    const prompt = `Analyze the following spatial map data for topography, ditches, trees, grass, and other features. Provide detailed guidance for client use based on the analysis. Data: ${JSON.stringify(spatialData.mapData, null, 2)}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://codespacebuckgrid.vercel.app',
        'X-Title': 'BuckGrid Pro - Spatial Analyzer'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errText = await response.text()
      console.error('[analyze] OpenRouter error:', response.status, errText)
      return NextResponse.json({ error: 'Failed to analyze spatial data' }, { status: 500 });
    }

    const data = await response.json()
    const analysis = data.choices?.[0]?.message?.content ?? ''

    const guidanceData = {
      analysis,
      features: {
        topography: extractFeature(analysis, 'topography'),
        ditches: extractFeature(analysis, 'ditches'),
        trees: extractFeature(analysis, 'trees'),
        grass: extractFeature(analysis, 'grass'),
        other: extractFeature(analysis, 'other features'),
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(guidanceData);
  } catch (error) {
    console.error('Error analyzing spatial data:', error);
    return NextResponse.json({ error: 'Failed to analyze spatial data' }, { status: 500 });
  }
}

function extractFeature(analysisText: string, featureName: string): string {
  const regex = new RegExp(`${featureName}:[^\n]*`, 'i');
  const match = analysisText.match(regex);
  return match ? match[0].replace(`${featureName}:`, '').trim() : 'Not specified';
}
