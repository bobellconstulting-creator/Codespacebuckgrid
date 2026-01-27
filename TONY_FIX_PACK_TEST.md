# TONY FIX PACK - TEST GUIDE

## Files Changed (4):

### Created:
1. **`/src/lib/buildPlanPayload.ts`** - Unified plan payload builder
   - Extracts all layers with type, name, acres, notes
   - Calculates stats (food acres, bedding acres, trail count, etc.)
   - Includes terrain context
   - Used by both Analyze and Evaluate

### Modified:
2. **`/src/components/buckgrid/chat/TonyChat.tsx`** 
   - Import buildPlanPayload
   - Updated analyze() to use plan payload
   - Updated evaluate() to use plan payload
   - Both send comprehensive layer data to API

3. **`/app/api/analyze/route.ts`**
   - Already returns structured JSON with suggestedMarks
   - Receives full plan payload with all layers
   - Surveyor-style prompts

4. **`/src/globals.css`**
   - Added CSS variables (--bg-deep-blue, --brand-orange, etc.)
   - Added .tony-panel styling (grid background, orange border)
   - Added .map-mark halo effect

## How to Test in Codespaces Preview:

### Step 1: Start Dev Server
```bash
cd /workspaces/Codespacebuckgrid
npm run dev
```
Open preview at: **http://localhost:3000**

### Step 2: Draw Property Boundary
- Click **BOUNDARY** tool (orange square)
- Click 4 corners on map to create rectangle
- Click **LOCK** button (🔒)
- ✅ Verify: Tony says "Boundary locked. Total surface area: XX acres. Terrain data required."

### Step 3: Draw Multiple Layer Types
Draw at least one of each:
- **Food Plot** (green) - 2 plots
- **Bedding** (brown) - 1 area
- **Trail** (line) - 1 trail
- **Note** circle - 1 annotation with text

✅ Verify: All layers visible on map

### Step 4: Fill Terrain Inputs
- Click **TERRAIN** tab/panel
- Fill in:
  - Terrain Notes: "Rolling hills, creek on east side"
  - Check: Ridges, Valleys, Creeks
  - Thermals: "Uphill AM"
  - Cover: "Mixed"
  - Wind: "NW-W"
  - Goals: "Improve bedding, add staging areas"

✅ Verify: Inputs save automatically

### Step 5: Test EVALUATE PROPERTY
- Click **TONY** tab
- Click **"EVALUATE PROPERTY"** button
- ✅ Verify:
  - Loading message: "⏳ Evaluating..."
  - Tony returns property evaluation text
  - Response mentions:
    - Boundary acres
    - Terrain features (ridges, valleys, creeks)
    - Wind patterns
    - Recommendations for zones
  - No errors in console

### Step 6: Test ANALYZE PLAN
- Click **"ANALYZE PLAN"** button
- ✅ Verify:
  - Loading message: "⏳ Analyzing..."
  - Tony returns analysis text referencing:
    - Food plots by name/acres
    - Bedding areas by acres
    - Trails
    - Note annotations
    - Terrain context
  - **Gold suggestion markers** appear on map
  - Console shows: `[ANALYZE] Suggested marks: [...]`
  - Chat shows: "✨ X SUGGESTED MARKS added to map"
  - No errors

### Step 7: Verify Console Logs
Open browser DevTools Console:
```
[ANALYZE] Response: {status: 200, data: {...}}
[ANALYZE] Analysis text: "Property boundaries confirmed..."
[ANALYZE] Suggested marks: [{kind: "point", ...}, ...]
```

### Step 8: Test Error Handling
Remove API key from .env.local and restart:
- ✅ Verify: Tony shows "❌ OPENROUTER_API_KEY missing"

## Expected Behavior:

### EVALUATE Response Format:
```
Property boundaries confirmed. Total surface area: 142 acres. 
Terrain analysis: ridges, valleys, creeks detected. 
Primary wind vector: NW-W.

[Evaluation continues with priority actions and zone recommendations...]
```

### ANALYZE Response Format:
```
Analysis Summary:
Property boundaries confirmed. Total acreage: 142. Bedding-to-food ratio: 1:3.2. 
Status: Imbalanced.

PRIORITY ACTIONS:
- Action: Relocate stand #2. Target: 180m west. Justification: Current position downwind 67% of season.
- ...

[Gold markers appear on map for suggested stands/plots/screens]
```

### Suggested Marks (Gold on Map):
- Points: Circle markers for stands
- Polygons: Dashed outlines for food plots
- Clickable popups with label + reason

## Common Issues:

### ❌ No Response from Tony
**Check:** 
- Network tab shows `/api/analyze` or `/api/evaluate` call
- Status 200 (not 500)
- Response body has `{analysis: "...", suggestedMarks: [...]}`

### ❌ Tony Doesn't Mention Layers
**Check:**
- Console log: `[ANALYZE] Response` shows `plan.layers` array
- Each layer has `type`, `name`, `acres`, `notes`
- GeoJSON features have `properties.toolId`

### ❌ No Gold Markers
**Check:**
- `data.suggestedMarks` array is not empty
- `onSuggestedMarks()` callback is called
- MapContainer receives `suggestedMarks` prop
- useMapDrawing renders in `suggestionsLayerRef`

### ❌ API Key Error
**Fix:**
- Check `.env.local` has `OPENROUTER_API_KEY=sk-or-v1-...`
- Restart dev server: `npm run dev`

## Success Criteria:
- ✅ EVALUATE returns text about property potential
- ✅ ANALYZE returns text referencing user's exact layers
- ✅ Gold suggestion markers render on map
- ✅ Both work with all layer types (food, bedding, trails, notes)
- ✅ Terrain inputs affect analysis
- ✅ No console errors
- ✅ Surveyor-style technical language

## What's Fixed:
1. ✅ Unified plan payload builder used everywhere
2. ✅ Both Evaluate and Analyze buttons work
3. ✅ Tony sees ALL drawn layers (notes, trails, everything)
4. ✅ Terrain inputs sent to API
5. ✅ Structured JSON responses
6. ✅ Suggested marks render on map
7. ✅ Surveyor tone/voice applied
8. ✅ Error messages display clearly

---

**Ready to test!** Start at http://localhost:3000
