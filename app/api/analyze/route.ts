import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export async function POST(req: Request) {
  try {
    const spatialData = await req.json();

    if (!spatialData || !spatialData.mapData) {
      return NextResponse.json({ error: 'Invalid spatial data provided' }, { status: 400 });
    }

    const prompt = `Analyze the following spatial map data for topography, ditches, trees, grass, and other features. Provide detailed guidance for client use based on the analysis. Data: ${JSON.stringify(spatialData.mapData, null, 2)}`;

    const result = await model.generateContent(prompt);
    const analysis = result.response.text();

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
