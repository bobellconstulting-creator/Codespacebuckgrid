# BuckGrid Pro - Smoke Test Checklist

**Purpose**: Verify baseline requirements before tagging or merging.  
**Time**: ~5 minutes  
**Baseline**: See `BASELINE.md` for requirements

## Prerequisites
- [ ] Dev server running: `npm run dev`
- [ ] Browser open to `http://localhost:3000`
- [ ] Console open (F12) - should have no errors

---

## 1. PAN/DRAW Mode Separation

### Test PAN Mode
- [ ] Click **PAN** button (or ensure PAN is active)
- [ ] Drag map - should move smoothly
- [ ] Zoom in/out - should work
- [ ] **Debug panel** (bottom-right) shows "Mode: PAN"

### Test DRAW Mode
- [ ] Click **CORN** tool
- [ ] **Debug panel** shows "Mode: DRAW"
- [ ] Try to drag map - should NOT move
- [ ] Draw a polygon by clicking points
- [ ] Polygon appears, map stays still
- [ ] **CRITICAL**: Map does NOT pan while drawing

---

## 2. Border Lock Enforcement

### Unlock Border
- [ ] Click **Border Tool**
- [ ] Draw a border rectangle
- [ ] Click "Lock Border" (checkbox or button)
- [ ] Switch to **CORN** tool

### Test Border Lock (DRAW mode)
- [ ] Try to draw OUTSIDE border - should see toast: "Cannot draw outside border"
- [ ] Draw INSIDE border - should work normally

### Test Border Lock (PAN mode)
- [ ] Click **PAN** button
- [ ] Drag map - should still work
- [ ] Zoom - should still work
- [ ] **Border lock only restricts drawing, not pan/zoom**

---

## 3. Data Persistence

### Save Plan
- [ ] Draw 2-3 features (CORN, BEANS, CLOVER)
- [ ] Fill in some terrain inputs (e.g., "Sandy Loam", "Oak/Hickory")
- [ ] Click **Save Plan**
- [ ] File downloads: `plan-YYYYMMDD-HHMMSS.json`

### Load Plan
- [ ] Refresh page (clear state)
- [ ] Click **Load Plan**
- [ ] Select saved file
- [ ] Border restores
- [ ] All features restore with correct colors
- [ ] Terrain inputs restore
- [ ] Map view approximately restored

---

## 4. Area Calculations

- [ ] Draw a polygon
- [ ] UI shows total acres (e.g., "12.5 ac")
- [ ] Per-layer acres displayed
- [ ] Draw another polygon - acres update
- [ ] Delete a polygon - acres decrease
- [ ] **Verify non-zero values for reasonable polygons**

---

## 5. API Integration

### Test Evaluate Property (0 features)
- [ ] Clear all features (or fresh page)
- [ ] Lock a border
- [ ] Fill terrain: Soil Type, Dominant Vegetation
- [ ] Open Tony Chat (if closed)
- [ ] Click **Evaluate Property**
- [ ] See "⏳ Evaluating..." message
- [ ] Receive evaluation response OR clear error
- [ ] **Debug panel** shows "Last API: OK" or "Last API: Error"

### Test Analyze Plan (with features)
- [ ] Draw 2-3 features (CORN, BEANS)
- [ ] Fill terrain inputs
- [ ] Click **Analyze Plan**
- [ ] See "⏳ Analyzing..." message
- [ ] Receive analysis response OR clear error
- [ ] If error, should mention missing API key (if OPENROUTER_API_KEY not set)

---

## 6. UI Controls

### Brush Size Slider
- [ ] Open Tool Grid (if not visible)
- [ ] See "Brush Width" slider (2-80px)
- [ ] Drag slider to 40px
- [ ] Draw a feature - stroke width noticeably thicker
- [ ] Drag slider to 5px
- [ ] Draw another feature - stroke width thin
- [ ] **Debug panel** shows current brush size

### Layer Toggles
- [ ] Draw features in 3 different layers (CORN, BEANS, CLOVER)
- [ ] Toggle CORN layer off - features disappear
- [ ] Toggle CORN layer on - features reappear
- [ ] All layers toggle independently

### Tool Selection
- [ ] Click CORN - becomes active
- [ ] Click BEANS - CORN deactivates, BEANS active
- [ ] Only one tool active at a time

---

## 7. Terrain Input Panel

- [ ] Open Terrain Panel (if collapsed)
- [ ] Fill all 11 fields:
  1. Soil Type
  2. Dominant Vegetation
  3. Water Sources
  4. Terrain Features
  5. Wind Direction
  6. Property Use
  7. Existing Infrastructure
  8. Hunting Pressure
  9. Wildlife Observations
  10. Target Species
  11. Goals
- [ ] Save plan
- [ ] Load plan
- [ ] All 11 fields restored correctly

---

## 8. Browser Console

- [ ] Open DevTools Console (F12)
- [ ] Check for errors (red text)
- [ ] **Should be clean** - no React errors, no API errors (unless OPENROUTER_API_KEY missing)
- [ ] Warnings acceptable if minor

---

## Results

### Pass Criteria
- [ ] All sections above pass
- [ ] No critical console errors
- [ ] Debug panel shows correct mode/status

### Fail Criteria
- Map drags while drawing (PAN/DRAW broken)
- Border lock doesn't restrict drawing
- Save/load loses data
- API calls fail silently (no loading state)

---

## Next Steps

**If all tests PASS**:
```bash
# Tag baseline version
git tag -a baseline-v0.1 -m "Baseline lock: core UX stable"
git push origin baseline-v0.1
```

**If any tests FAIL**:
1. Document failure in issue/PR
2. Fix regression
3. Re-run smoke test
4. DO NOT merge or tag until passing

---

**Last Updated**: January 27, 2026  
**Baseline Version**: v0.1
