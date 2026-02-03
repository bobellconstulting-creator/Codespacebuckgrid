#!/usr/bin/env node
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.GEMINI_API_KEY;
console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING');

if (!apiKey) {
  console.error('❌ No GEMINI_API_KEY in .env.local');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

// Test with a simple base64 image (1x1 red pixel)
const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

async function testVision() {
  console.log('\n🧪 Testing gemini-1.5-flash with vision...\n');
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: 'What color is this image?' },
          { inlineData: { mimeType: 'image/png', data: testImage } }
        ]
      }]
    });
    
    const response = result.response.text();
    console.log('✅ SUCCESS!');
    console.log('Response:', response);
    console.log('\n✨ Gemini Vision is working!\n');
  } catch (error) {
    console.error('❌ FAILED:', error.message);
    console.error('Status:', error.status);
    console.error('\nFull error:', error);
  }
}

testVision();
