# BuckGrid Pro - Baseline Requirements

**Version**: baseline-v0.1  
**Date**: January 27, 2026

## Non-Negotiable Core Behavior

These behaviors MUST be preserved in all future changes. Any PR that breaks these will be rejected.

### 1. PAN/DRAW Mode Separation
- **PAN mode**: Map drags/pans/zooms normally
- **DRAW mode**: Map does NOT drag while drawing
  - Selecting any drawing tool (CORN, BEANS, etc.) enters DRAW mode
  - Drawing polygons should NOT cause map to pan
  - Only the drawing stroke should appear, map stays stationary

### 2. Border Lock Enforcement
- **When border is LOCKED**:
  - Drawing outside border is blocked with toast notification
  - Map pan/zoom still works normally
- **When border is UNLOCKED**:
  - Drawing allowed anywhere
  - Map pan/zoom works normally

### 3. Data Persistence
- **Save Plan**: 
  - Exports JSON with border, all feature layers, terrain data, map position
  - Filename: `plan-YYYYMMDD-HHMMSS.json`
- **Load Plan**:
  - Restores border, all layers, terrain inputs, map view
  - Features render correctly with colors

### 4. Area Calculations
- **Real-time tracking**:
  - Total acres shown in UI
  - Per-layer acres displayed
  - Updates as features are drawn/deleted
- **Accuracy**: Within 1% of actual acreage for typical hunting property sizes

### 5. API Integration
- **Analyze Plan** (`/api/analyze`):
  - Requires features.length > 0
  - Shows loading state: "⏳ Analyzing..."
  - Returns analysis or clear error message
  - Handles missing OPENROUTER_API_KEY gracefully
  
- **Evaluate Property** (`/api/evaluate`):
  - Works with ZERO features drawn
  - Uses terrain + border only
  - Shows loading state: "⏳ Evaluating..."
  - Returns evaluation or clear error message
  - Validates locked border exists

### 6. UI Controls
- **Brush Size Slider**: 2-80px range, updates stroke width in real-time
- **Layer Toggles**: Show/hide individual feature layers
- **Tool Selection**: Only one tool active at a time
- **Mode Indicator**: Clear visual indication of PAN vs DRAW mode

### 7. Terrain Input Panel
- All 11 fields functional:
  - Soil Type, Dominant Vegetation, Water Sources
  - Terrain Features, Wind Direction, Property Use
  - Existing Infrastructure, Hunting Pressure
  - Wildlife Observations, Target Species, Goals
- Persists with save/load

## Critical Files

Changes to these files require extra scrutiny:

- `src/components/buckgrid/hooks/useMapDrawing.ts` - Core drawing logic
- `src/components/buckgrid/BuckGridProPage.tsx` - Main orchestrator
- `src/components/buckgrid/chat/TonyChat.tsx` - API integration
- `app/api/analyze/route.ts` - Feature analysis endpoint
- `app/api/evaluate/route.ts` - Property evaluation endpoint

## Testing Requirements

Before considering any work "done":

1. Run full smoke test (see `scripts/smoke-test.md`)
2. Verify no console errors
3. Test both PAN and DRAW modes
4. Verify save/load cycle
5. Test both API endpoints

## Version Tagging

After verifying baseline behavior:
```bash
git tag -a baseline-v0.1 -m "Baseline lock: core UX stable"
git push origin baseline-v0.1
```

See `TAGGING.md` for full instructions.
