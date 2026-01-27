# 🧪 TONY-TO-MAP QUICK TEST GUIDE

**Goal:** Verify Tony's suggested marks appear on the map

---

## 🚀 QUICK START (2 minutes)

### 1. Start Dev Server
```bash
npm run dev
```
Open: http://localhost:3000

### 2. Draw a Basic Plan

**Border:**
1. Click "BOUNDARY" tool (orange square icon)
2. Click 4 corners on map to create rectangle (~100 acres)
3. Click "LOCK" button (🔒) - should say "Locked: XX acres"

**Food Plots:**
1. Click "FOOD PLOT" tool (green square)
2. Enable DRAW mode if not already on
3. Draw 2-3 small polygons inside border
4. Label them: "Milo Plot", "Bean Field", etc.

**Bedding:**
1. Click "BEDDING" tool (brown square)
2. Draw 1-2 bedding areas

### 3. Fill Terrain Inputs

Click "TERRAIN" tab (mobile) or bottom panel (desktop):
- Terrain Notes: "Rolling hills, creek on east side"
- Check: Ridges, Valleys, Creeks
- Thermals: Uphill AM
- Cover Type: Mixed
- Elevation: Rolling
- Season: Pre-rut
- Wind: NW-W
- Goals: "Improve doe bedding, add staging area"

### 4. Run Analyze

Click "TONY" tab → "ANALYZE"

**Expected:**
- Tony returns analysis text
- Console shows: `[ANALYZE] Suggested marks: [...]`
- Chat shows: "✨ **X SUGGESTED MARKS** added to map"
- **Gold markers appear on map** (points, polygons, or polylines)

### 5. Verify Suggestions

**Visual Check:**
- ✅ Gold colored marks on map
- ✅ Dashed lines (not solid)
- ✅ Semi-transparent fills

**Interaction:**
- Click a gold mark
- Should show popup with: Label, Reason, Acres

**Console Check:**
```javascript
// Open DevTools Console
[ANALYZE] Suggested marks: [
  {kind: "point", layerType: "Stand", lat: 38.123, lng: -96.456, ...},
  {kind: "polygon", layerType: "Food Plot", coordinates: [...], ...}
]
```

---

## 🎯 WHAT TO LOOK FOR

### ✅ SUCCESS INDICATORS:
1. Tony analysis text appears in chat
2. Mark count shows: "✨ **X SUGGESTED MARKS**"
3. Gold markers visible on map (distinct from user drawings)
4. Clicking mark shows popup with label/reason
5. No console errors

### ❌ FAILURE INDICATORS:
1. No gold marks on map
2. Console error: `Cannot read property 'lat' of undefined`
3. Chat says "0 SUGGESTED MARKS" but analysis looks good
4. Marks appear outside locked border
5. API returns 500 error

---

## 🔍 DEBUGGING

### If No Marks Appear:

**Check Console:**
```javascript
// Should see:
[ANALYZE] Suggested marks: [...]

// If empty array:
[ANALYZE] Suggested marks: []
```

**Check API Response:**
```javascript
// In Network tab, look at /api/analyze response:
{
  "analysis": "...",
  "suggestedMarks": [...],  // <-- Should be present
  "meta": {...}
}
```

**Check State:**
```javascript
// In React DevTools:
BuckGridProPage → suggestedMarks: [...]  // <-- Should update
```

### If Marks Render Incorrectly:

**Invalid Coordinates:**
- Points need: `{lat, lng}`
- Polygons need: `coordinates: [[[lng, lat], ...]]`

**Check Leaflet Layer:**
```javascript
// In Console:
document.querySelectorAll('.leaflet-overlay-pane path')
// Should include gold-colored paths
```

### If API Fails:

**Check Environment:**
```bash
# In terminal:
echo $OPENROUTER_API_KEY
# Should output key (or check .env.local)
```

**Check API Route:**
```bash
curl http://localhost:3000/api/analyze -X POST \
  -H "Content-Type: application/json" \
  -d '{"features": [], "terrainInputs": {}}'
```

---

## 📊 EXPECTED JSON FORMAT

### Point Suggestion:
```json
{
  "kind": "point",
  "layerType": "Stand",
  "lat": 38.6583,
  "lng": -96.4937,
  "label": "NW Stand",
  "reason": "Downwind of bedding, good on W-NW winds"
}
```

### Polygon Suggestion:
```json
{
  "kind": "polygon",
  "layerType": "Food Plot",
  "coordinates": [
    [
      [-96.4937, 38.6583],
      [-96.4927, 38.6583],
      [-96.4927, 38.6593],
      [-96.4937, 38.6593],
      [-96.4937, 38.6583]
    ]
  ],
  "label": "Milo Plot",
  "reason": "Staging area 50y from bedding",
  "acres": 2.5
}
```

### Polyline Suggestion:
```json
{
  "kind": "polyline",
  "layerType": "Trail",
  "coordinates": [
    [38.6583, -96.4937],
    [38.6593, -96.4927]
  ],
  "label": "Access Trail",
  "reason": "Low-impact route to NW stand"
}
```

---

## 🎨 STYLING REFERENCE

**Gold Color:** `#FFD700`

**Point Markers:**
- Radius: 8px
- Fill Opacity: 60%
- Stroke Weight: 2px

**Polygons:**
- Dash Array: "5, 10"
- Fill Opacity: 20%
- Stroke Opacity: 80%
- Stroke Weight: 2px

**Polylines:**
- Dash Array: "5, 10"
- Opacity: 80%
- Weight: 3px

---

## 📝 TEST SCENARIOS

### Scenario 1: Basic Analysis
- Draw border + 2 food plots
- Run Analyze
- **Expected:** 2-3 suggested stand locations (points)

### Scenario 2: Complex Plan
- Draw border + 5 layers (food, bedding, water, trails)
- Fill all terrain inputs
- Run Analyze
- **Expected:** 3-5 suggestions (mix of points, polygons)

### Scenario 3: Mobile View
- Resize browser to mobile (< 768px)
- Same flow as Scenario 1
- **Expected:** Suggestions render correctly

### Scenario 4: Multiple Analyses
- Run Analyze twice in a row
- **Expected:** 
  - First suggestions cleared
  - New suggestions replace old ones
  - No duplicate markers

### Scenario 5: Save/Load with Suggestions
- Run Analyze → get suggestions
- Save plan
- Load plan
- **Expected:** Suggestions NOT saved (ephemeral, regenerate on Analyze)

---

## ✅ SIGN-OFF CHECKLIST

Before marking complete:
- [ ] Gold markers appear on map
- [ ] Clicking marker shows popup
- [ ] Console shows suggestedMarks array
- [ ] Chat displays mark count
- [ ] No TypeScript errors
- [ ] No runtime errors
- [ ] Mobile view works
- [ ] Multiple analyses work

---

**Status:** READY FOR TESTING
**Time to Test:** 2-5 minutes
**Difficulty:** Easy

**Next:** Test, find edge cases, iterate if needed. 🚀
