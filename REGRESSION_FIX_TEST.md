# Regression Fix Test Checklist

**Date**: January 27, 2026  
**Fixes**: 4 regressions + Undo functionality  
**Time Required**: ~10 minutes

---

## Prerequisites
- [ ] Dev server running: `npm run dev`
- [ ] Browser open to `http://localhost:3000`
- [ ] Console open (F12) - check for logs
- [ ] OPENROUTER_API_KEY set in `.env.local` (for API tests)

---

## 1. ✅ POLYGON ACRES FIX (PREVIOUSLY 0)

### Test Acres Calculation
- [ ] Draw a border with Border Tool
- [ ] Lock border
- [ ] Switch to CORN tool (or any polygon tool)
- [ ] Draw a polygon (click multiple points, make a closed shape)
- [ ] **VERIFY**: Bottom-left panel shows "Polygon Acres: X.XX" (NOT 0)
- [ ] **VERIFY**: Console shows `[onPointerUp] Calculated acres: X.XX`
- [ ] Draw another polygon (BEANS)
- [ ] **VERIFY**: Polygon acres increases
- [ ] Click polygon - should show popup with acres

**Expected**: 
- Small polygons: ~0.5-2 acres
- Medium polygons: ~3-10 acres
- Total polygon acres = sum of all drawn polygons

---

## 2. ✅ ANALYZE/EVALUATE UI OUTPUT

### Test Analyze Plan
- [ ] Draw 2-3 features (CORN, BEANS, CLOVER)
- [ ] Fill terrain inputs (Soil Type, Vegetation)
- [ ] Open Tony Chat
- [ ] Click **ANALYZE PLAN** button
- [ ] **VERIFY**: See "⏳ Analyzing..." message in chat
- [ ] **VERIFY**: Console logs `[ANALYZE] Response:` with data
- [ ] **VERIFY**: Tony returns structured analysis (SUMMARY, TOP ACTIONS, WARNINGS)
- [ ] **VERIFY**: Analysis text appears in chat UI (not blank)
- [ ] **VERIFY**: Analysis mentions specific plot types and acres (e.g., "Your Milo plot ~3.2 acres")

### Test Evaluate Property
- [ ] Refresh page or load new plan
- [ ] Draw border, lock it
- [ ] Fill terrain inputs
- [ ] Do NOT draw any features (0 polygons)
- [ ] Click **EVALUATE PROPERTY**
- [ ] **VERIFY**: See "⏳ Evaluating..." message
- [ ] **VERIFY**: Console logs `[EVALUATE] Response:` with data
- [ ] **VERIFY**: Evaluation text appears in chat (OVERVIEW, PRIORITY ACTIONS, LIKELY ZONES)
- [ ] **VERIFY**: Evaluation works with ZERO features
- [ ] **VERIFY**: Evaluation does NOT mention "aerial imagery" or "satellite photo"

### Test Error Handling
- [ ] Remove OPENROUTER_API_KEY from `.env.local` (or rename)
- [ ] Restart server
- [ ] Click ANALYZE or EVALUATE
- [ ] **VERIFY**: See "❌ OPENROUTER_API_KEY missing..." error message in chat
- [ ] **VERIFY**: Debug panel shows "Last API: Error"

---

## 3. ✅ TONY REFERENCES LAYERS, NOT IMAGERY

### Test Layer References
- [ ] Draw 3 different plot types: CORN (3 acres), BEANS (2 acres), CLOVER (1 acre)
- [ ] Click ANALYZE PLAN
- [ ] **VERIFY**: Tony's response mentions specific layers:
  - "Your Milo plot (~3 acres)"
  - "The 2-acre Beans plot"
  - "1-acre Clover plot"
- [ ] **VERIFY**: Tony does NOT say:
  - "I see from the aerial shot..."
  - "Looking at satellite imagery..."
  - "The aerial photo shows..."
- [ ] **VERIFY**: Console `[ANALYZE] Response:` shows layer summary with acres

### Test Evaluate Mode (No Features)
- [ ] New plan with border only (0 features)
- [ ] Click EVALUATE PROPERTY
- [ ] **VERIFY**: Response focuses on terrain, not imagery
- [ ] **VERIFY**: Suggests WHERE to place plots based on terrain inputs
- [ ] **VERIFY**: Does NOT claim to see visual features

---

## 4. ✅ DELETE SELECTED / DESELECT

### Test Selection
- [ ] Draw 3 polygons
- [ ] Click on first polygon
- [ ] **VERIFY**: Polygon highlights (thicker border, brighter)
- [ ] Click on second polygon
- [ ] **VERIFY**: First polygon deselects, second selects

### Test Delete Selected
- [ ] Select a polygon (click it)
- [ ] Click **DELETE SELECTED** button
- [ ] **VERIFY**: Polygon disappears from map
- [ ] **VERIFY**: Polygon acres decreases
- [ ] **VERIFY**: Feature count decreases

### Test Deselect Methods
- [ ] Select a polygon
- [ ] Click on empty map area
- [ ] **VERIFY**: Polygon deselects (returns to normal weight/opacity)
- [ ] Select another polygon
- [ ] Press **ESC** key
- [ ] **VERIFY**: Polygon deselects

---

## 5. ✅ UNDO FUNCTIONALITY

### Test Undo After Draw
- [ ] Draw a polygon (CORN)
- [ ] Note the polygon acres (e.g., 3.5 ac)
- [ ] Click **⟲ UNDO** button
- [ ] **VERIFY**: Last polygon disappears
- [ ] **VERIFY**: Polygon acres returns to previous value
- [ ] **VERIFY**: Feature count decreases by 1

### Test Undo After Delete
- [ ] Draw 3 polygons
- [ ] Select middle polygon, delete it
- [ ] Click **⟲ UNDO**
- [ ] **VERIFY**: Deleted polygon reappears
- [ ] **VERIFY**: Polygon acres restores
- [ ] **VERIFY**: Feature count restores

### Test Undo Stack Limit
- [ ] Draw 25 polygons (more than 20)
- [ ] Click UNDO multiple times
- [ ] **VERIFY**: Can undo last 20 actions
- [ ] **VERIFY**: Undo stops at stack limit (not infinite)

### Test Undo with No History
- [ ] Refresh page (empty state)
- [ ] Click **⟲ UNDO**
- [ ] **VERIFY**: Nothing happens (no crash)
- [ ] **VERIFY**: Console shows `[undo] No undo history`

---

## 6. 🔍 INTEGRATION TESTS

### Test Full Workflow
- [ ] Lock border (40 acres)
- [ ] Draw CORN plot (5 acres)
- [ ] Draw BEANS plot (3 acres)
- [ ] **VERIFY**: Polygon acres = 8 acres
- [ ] Click ANALYZE PLAN
- [ ] **VERIFY**: Analysis mentions "Milo plot ~5 acres" and "Beans plot ~3 acres"
- [ ] Delete CORN plot
- [ ] **VERIFY**: Polygon acres = 3 acres
- [ ] Click UNDO
- [ ] **VERIFY**: CORN plot reappears, acres = 8 acres
- [ ] Click EVALUATE PROPERTY
- [ ] **VERIFY**: Works even with drawn features (not just 0)

### Test Save/Load Persistence
- [ ] Draw 2-3 polygons with different acres
- [ ] Note total polygon acres
- [ ] Click SAVE PLAN
- [ ] Refresh page
- [ ] Click LOAD PLAN, select saved file
- [ ] **VERIFY**: All polygons restore
- [ ] **VERIFY**: Polygon acres match saved values
- [ ] **VERIFY**: Can delete restored polygons
- [ ] **VERIFY**: Can undo after load

---

## 7. 📊 CONSOLE VERIFICATION

### Required Console Logs
- [ ] `[onPointerUp] Calculated acres: X.XX for points: N`
- [ ] `[ANALYZE] Response: { status: 200, data: {...} }`
- [ ] `[ANALYZE] Analysis text: <full text>`
- [ ] `[EVALUATE] Response: { status: 200, data: {...} }`
- [ ] `[EVALUATE] Evaluation text: <full text>`
- [ ] `[deleteSelected] Removing layer: <id>`
- [ ] `[undo] Restoring state: N features`

### No Errors
- [ ] No React errors
- [ ] No Leaflet errors
- [ ] No API fetch errors (unless OPENROUTER_API_KEY missing)

---

## Pass Criteria

**ALL tests must pass:**
- ✅ Polygon acres show >0 for drawn polygons
- ✅ Analyze/Evaluate return visible text in UI
- ✅ Tony references layers by type and acres (no "aerial shot" language)
- ✅ Delete Selected removes features
- ✅ Deselect works (click empty area or ESC)
- ✅ Undo restores deleted/drawn features
- ✅ Console logs show expected output
- ✅ No console errors

---

## Files Changed

1. **src/components/buckgrid/chat/TonyChat.tsx**
   - Added console logging for API responses
   - Fixed response text extraction (`data.analysis || data.evaluation`)

2. **src/components/buckgrid/hooks/useMapDrawing.ts**
   - Replaced custom acres calculation with @turf/area
   - Added undo stack (max 20 actions)
   - Added `undo()` method to MapApi
   - Fixed ESC key deselect
   - Added console logging for acres calculation

3. **src/components/buckgrid/ui/ToolGrid.tsx**
   - Added "⟲ UNDO" button

4. **src/components/buckgrid/BuckGridProPage.tsx**
   - Added `handleUndo()` callback
   - Wired undo to ToolGrid

5. **app/api/analyze/route.ts**
   - Updated prompt: "You are analyzing DRAWN GeoJSON LAYERS, not satellite imagery"
   - Emphasizes referencing layers by type and acres

6. **app/api/evaluate/route.ts**
   - Updated prompt: "based on TERRAIN DATA, not satellite imagery"
   - Clarifies no visual analysis

7. **package.json**
   - Added `@turf/area` and `@turf/helpers` dependencies

---

## Next Steps

**If all tests PASS**:
- Update BASELINE.md with undo requirement
- Commit changes with detailed message
- Run smoke test for full baseline verification

**If any tests FAIL**:
- Document failure
- Check console for error details
- Review relevant file changes
- DO NOT merge until all tests pass

---

**Last Updated**: January 27, 2026  
**Regression Fix Version**: post-baseline-v0.1
