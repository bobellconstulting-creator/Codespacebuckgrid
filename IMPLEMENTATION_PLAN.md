# BuckGrid Pro - Comprehensive UX Upgrade Implementation Plan

## Current Status
- ✅ Basic PAN/DRAW mode toggle working
- ✅ Single border drawing with lock
- ✅ /api/chat and /api/analyze working with OPENROUTER_API_KEY
- ✅ Basic acreage calculation
- ⚠️ Needs comprehensive upgrade per requirements

## PART 1: Multiple Borders + Advanced Lock Behavior

### Requirements
- [ ] Support multiple Border polygons (currently only 1)
- [ ] Each border has independent locked/unlocked state
- [ ] "Lock All Borders" and "Unlock All Borders" buttons
- [ ] When ANY border is locked:
  - [ ] Disable map panning/zooming
  - [ ] Restrict drawing to inside locked border(s)
  - [ ] Show message: "Draw inside a locked border" when blocked
- [ ] If no borders locked: normal pan/zoom, unrestricted drawing

### Implementation Steps
1. Refactor `useMapDrawing.ts` to store array of borders instead of single boundary
2. Add `borders` state: `Array<{id, points, locked, polygon, acres}>`
3. Add "Finish Border" button to complete current border polygon
4. Add "Lock All" / "Unlock All" controls to ToolGrid
5. Implement `isPointInPolygon()` check before allowing drawing
6. Add visual feedback for locked borders (red outline)

## PART 2: Tools Auto-Switch to DRAW Mode

### Requirements
- [ ] Clear PAN vs DRAW mode indicator
- [ ] Clicking any non-nav tool switches to DRAW mode automatically
- [ ] Ensure map panning doesn't trigger drawing

### Implementation Steps
1. Update `onSelectTool` in BuckGridProPage to auto-switch mode
2. Add clearer mode indicator UI
3. Ensure drawing handlers only fire when `isDrawMode === true`

## PART 3: Select / Edit / Delete Features

### Requirements
- [ ] Click selects an existing feature
- [ ] Selected feature can be edited (move vertices)
- [ ] "Delete Selected" button

### Implementation Steps
1. Add click handlers to existing layers
2. Visual highlight for selected layer
3. Enable Leaflet edit mode for selected layer
4. Add "Delete Selected" button to ToolGrid

## PART 4: Enhanced Tony "Seeing" with Terrain Inputs

### Requirements
- [ ] Create TerrainPanel component with manual inputs:
  - terrainNotes (text + checkboxes for ridges/valleys/creeks/saddles/benches)
  - suspectedThermals (morning up / evening down toggle)
  - predominantCoverType (timber/cedar/CRP/crop select)
  - elevationGuess (flat/rolling/steep select)
- [ ] Create "Context Pack" structure for /api/analyze:
  ```typescript
  {
    lockedBordersGeoJSON: {},
    allLayersGeoJSON: {},
    userInputs: {
      seasonPhase, wind, access, pressure, 
      neighborsFood, goals
    },
    terrainInputs: { ... },
    mapContext: { center, zoom }
  }
  ```
- [ ] Update /api/analyze prompt for structured output:
  1. What you drew means (movement intent)
  2. Wind + access conflicts
  3. Stand-by-stand recommendations
  4. Top 10 actions next 30 days
  5. Warnings list
  6. If/Then conditional plan by wind/season

### Implementation Steps
1. Create `TerrainPanel.tsx` component
2. Add terrain state to BuckGridProPage
3. Update TonyChat to pass terrain inputs to analyze
4. Restructure /api/analyze route.ts with enhanced prompt
5. Add guard: analyze only runs when ≥1 border locked

## PART 5: Visual Texture Patterns for Crops

### Requirements
- [ ] Different fill patterns for crop layers:
  - clover: subtle speckle
  - corn: denser hatch
  - brassicas: different hatch angle

### Implementation Steps
1. Research Leaflet pattern fills or canvas overlay approach
2. Create pattern definitions for each crop type
3. Apply patterns when drawing food plot layers
4. Keep performance lightweight

## PART 6: Click-to-Vertex Drawing

### Current State
- Using press-and-drag for freehand polylines
- Need: click-to-add-vertices for polygons

### Requirements
- [ ] Click adds vertex to current polygon
- [ ] Preview line shows next segment
- [ ] Double-click or "Finish" button completes polygon
- [ ] Support for LINE vs POLYGON layer types

### Implementation Steps
1. Track `currentDrawingPoints` array
2. On click: add point, render circle marker
3. On move: show preview line to cursor
4. On double-click or finish: complete polygon/line
5. Add "Finish Drawing" or "Cancel" buttons when drawing

## Layer Types to Support

Ensure these exist in tools.ts with correct `layerType`:
- ✅ boundary (polygon)
- ✅ food_plot (polygon) - multiple crop types
- ✅ pinch_point (polygon)
- ✅ stand (point)
- ✅ bedding (polygon)
- ✅ screen (polygon or line)
- ✅ access_trail (line)
- ✅ pressure_zone (polygon)
- ✅ switchgrass (polygon)

## Testing Checklist

After implementation:
- [ ] Add 2 borders, lock all, confirm map doesn't move
- [ ] Draw a plot inside border (should work)
- [ ] Attempt draw outside border (should block with message)
- [ ] Select a feature and delete it
- [ ] Analyze runs only when ≥1 border is locked
- [ ] Click any tool auto-switches to DRAW mode
- [ ] PAN mode allows map movement without drawing
- [ ] Crop layers show different visual textures
- [ ] Tony analysis includes terrain-aware output

## Priority Order

1. **HIGH**: Multiple borders + lock behavior (PART 1)
2. **HIGH**: Auto-switch to DRAW mode (PART 2)
3. **HIGH**: Enhanced Tony analysis with terrain inputs (PART 4)
4. **MEDIUM**: Select/Edit/Delete (PART 3)
5. **MEDIUM**: Click-to-vertex drawing (PART 6)
6. **LOW**: Visual textures (PART 5)

## Notes

- Current draw mode uses press-and-drag freehand
- To avoid breaking existing functionality, implement incrementally
- Test after each major change
- Keep OPENROUTER_API_KEY server-side only
- No auth/payments
- Minimal, focused changes
