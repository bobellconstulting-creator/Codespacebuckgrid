# WildLogic v2 — Developer Guide

## Brand
- Name: WildLogic (formerly BuckGrid Pro)
- AI: Tony (unchanged)
- Live: https://codespacebuckgrid.vercel.app (update domain when ready)

## Local Development
```bash
cd /Users/bobell/Desktop/buckgrid-src
npm install
npm run dev  # runs on port 3000
```

## Tony AI Flow (v2)
1. User draws property boundary on Mapbox satellite map
2. User taps "Analyze with Tony"
3. /api/chat receives: { message, bounds, propertyName, season }
4. Tony responds with: { reply, zones, stand_sites } — NO GPS COORDS
5. Client translates zones via lib/tonyZones.ts → GeoJSON features
6. Map renders zones as Mapbox layers

## Free vs Pro
- Free: 1 Tony analysis per day
- Pro ($79/yr): unlimited Tony, property save, season analysis
- Field Report ($97): one-time PDF generation

## Ollama / Local Hermes
Set OLLAMA_BASE_URL=http://localhost:11434 and OLLAMA_MODEL=hermes3 in .env.local
When set, the Tony chain becomes: Gemini → Ollama/Hermes → Groq → paid APIs
This is completely free when running locally.

## Key Files
- Tony AI: app/api/chat/route.ts
- Zone translation: lib/tonyZones.ts
- State: src/store/wildlogicStore.ts
- Map: src/components/wildlogic/map/WildLogicMap.tsx
- Main app: src/components/wildlogic/WildLogicApp.tsx
