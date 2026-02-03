#!/usr/bin/env node

/**
 * List available Gemini models for the current API key
 * Usage: node scripts/list-models.js
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not found in .env.local');
  process.exit(1);
}

console.log('🔑 API Key loaded:', apiKey.substring(0, 10) + '...');
console.log('');

const genAI = new GoogleGenerativeAI(apiKey);

async function listAvailableModels() {
  console.log('📋 Attempting to list available models...\n');
  
  // Try using the listModels method if it exists
  try {
    if (typeof genAI.listModels === 'function') {
      console.log('✓ Using genAI.listModels() method\n');
      const models = await genAI.listModels();
      
      console.log('✅ Available models:');
      console.log('='.repeat(60));
      
      for (const model of models) {
        console.log(`  • ${model.name}`);
        if (model.displayName) console.log(`    Display: ${model.displayName}`);
        if (model.supportedGenerationMethods) {
          console.log(`    Methods: ${model.supportedGenerationMethods.join(', ')}`);
        }
        console.log('');
      }
      
      return;
    }
  } catch (error) {
    console.log('⚠️  listModels() failed:', error.message);
    console.log('');
  }
  
  // Fallback: Test specific model names
  console.log('📝 Falling back to testing specific model names...\n');
  
  const modelsToTest = [
    'gemini-pro',
    'gemini-1.0-pro',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-2.0-flash-exp',
    'gemini-pro-vision',
    'gemini-1.0-pro-vision',
  ];
  
  console.log('Testing models with countTokens (minimal API call)...');
  console.log('='.repeat(60));
  
  const workingModels = [];
  const failedModels = [];
  
  for (const modelName of modelsToTest) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      
      // Try a minimal operation - countTokens
      if (typeof model.countTokens === 'function') {
        await model.countTokens('test');
        console.log(`✅ ${modelName} - AVAILABLE`);
        workingModels.push(modelName);
      } else {
        // If countTokens doesn't exist, try generateContent with minimal input
        const result = await model.generateContent('hi');
        console.log(`✅ ${modelName} - AVAILABLE (via generateContent)`);
        workingModels.push(modelName);
      }
    } catch (error) {
      const status = error.status || 'unknown';
      const msg = error.message?.split('\n')[0] || error.toString();
      console.log(`❌ ${modelName} - FAILED (${status})`);
      console.log(`   ${msg.substring(0, 80)}...`);
      failedModels.push({ name: modelName, error: status });
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY:');
  console.log(`   ✅ Working: ${workingModels.length}`);
  console.log(`   ❌ Failed: ${failedModels.length}`);
  
  if (workingModels.length > 0) {
    console.log('\n✨ Use one of these models:');
    workingModels.forEach(m => console.log(`   • ${m}`));
  } else {
    console.log('\n⚠️  No working models found. Check your API key permissions.');
  }
}

// Run the script
listAvailableModels()
  .then(() => {
    console.log('\n✓ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
