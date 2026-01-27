# FIX PACK TEST GUIDE

## Files Changed:
1. `/src/components/buckgrid/hooks/useMapDrawing.ts` - Enhanced deleteSelected to handle boundary deletion, made boundary clickable
2. `/src/components/buckgrid/BuckGridProPage.tsx` - Handle boundary deletion result

## Test Checklist (in Codespaces Preview):

### ✅ 1. Draw & Lock Boundary
- [ ] Click BOUNDARY tool
- [ ] Click 4 corners to draw rectangle
- [ ] Click LOCK button (🔒)
- [ ] Verify: Shows "Locked: XX acres"

### ✅ 2. Draw Features (Including Notes & Trails)
- [ ] Draw 2 food plots inside boundary
- [ ] Draw 1 bedding area
- [ ] Draw 1 trail (use TRAIL tool)
- [ ] Draw 1 note circle (use NOTE tool)
- [ ] Verify: All features visible on map

### ✅ 3. Fill Terrain & Context
- [ ] Click TERRAIN tab/panel
- [ ] Add terrain notes: "Rolling hills, creek on east"
- [ ] Check: Ridges, Valleys, Creeks
- [ ] Select: Thermals = Uphill AM, Cover = Mixed
- [ ] Add goals: "Improve bedding, add staging areas"
- [ ] Verify: Inputs are saved (no Apply button needed - auto-saves)

### ✅ 4. Run ANALYZE
- [ ] Click TONY tab
- [ ] Click "ANALYZE PLAN"
- [ ] Verify: Loading message appears: "⏳ Analyzing..."
- [ ] Verify: Tony returns analysis text referencing:
  - Food plots by acres
  - Bedding areas
  - Trails
  - Note circles
  - Terrain features
- [ ] Verify: Gold suggestion markers appear (if API returns them)
- [ ] Verify: No error about API key

### ✅ 5. Run EVALUATE  
- [ ] Click "EVALUATE PROPERTY"
- [ ] Verify: Tony returns property evaluation text
- [ ] Verify: References locked border acres
- [ ] Verify: References terrain inputs

### ✅ 6. Delete Selected (Regular Features)
- [ ] Click a food plot polygon
- [ ] Verify: Polygon highlights (thicker border)
- [ ] Click "DELETE SELECTED" button
- [ ] Verify: Polygon is removed from map
- [ ] Verify: Feature count decreases
- [ ] Verify: Acres update correctly

### ✅ 7. Delete Selected (Boundary)
- [ ] Click the boundary (orange border)
- [ ] Verify: Boundary highlights (thicker, brighter)
- [ ] Click "DELETE SELECTED" button
- [ ] Verify: Toast shows "Boundary deleted"
- [ ] Verify: Boundary is removed
- [ ] Verify: Property acres resets to 0
- [ ] Verify: Can draw new boundary

### ✅ 8. Verify Acres Still Work
- [ ] Draw new boundary and lock
- [ ] Draw 2-3 polygons
- [ ] Verify: Each polygon shows acres in layer list
- [ ] Verify: Total acres by type shows correctly

## Expected API Behavior:

### ANALYZE Response:
```json
{
  "analysis": "Your 42-acre property shows solid potential...",
  "suggestedMarks": [
    {"kind": "point", "layerType": "Stand", "lat": 38.XX, "lng": -96.XX, "label": "NW Stand", "reason": "..."},
    ...
  ],
  "meta": {...}
}
```

### EVALUATE Response:
```json
{
  "evaluation": "This property offers good whitetail habitat potential..."
}
```

## Common Issues:

### ❌ API Key Error
**Message:** "OPENROUTER_API_KEY missing"  
**Fix:** Check `.env.local` file has key, restart server

### ❌ No Response from Tony
**Check:** Browser console for errors  
**Check:** Network tab for /api/analyze or /api/evaluate calls  
**Verify:** Status code 200, not 500

### ❌ Notes/Trails Not Mentioned
**Check:** Console log: `[ANALYZE] Response`  
**Verify:** `layersWithDetails` includes all layer types  
**Fix:** May need to enhance GeoJSON export in next iteration

### ❌ Can't Delete Boundary
**Check:** Click directly on orange boundary line  
**Verify:** Boundary highlights before clicking DELETE SELECTED  
**Fix:** Click might be hitting map instead of polygon

## Success Criteria:
- ✅ ANALYZE returns text that mentions user's drawings
- ✅ EVALUATE returns property assessment
- ✅ DELETE SELECTED removes clicked feature
- ✅ DELETE SELECTED removes boundary when selected
- ✅ Acres calculation still works
- ✅ No API key errors
- ✅ Terrain inputs persist and affect Tony's analysis

## Current Status:
- **Build:** ✅ No TypeScript errors
- **Server:** ✅ Running on localhost:3000
- **API Key:** ✅ Configured in .env.local
- **Ready for Testing:** ✅ YES

---

**Test in Codespaces preview at:** http://localhost:3000
