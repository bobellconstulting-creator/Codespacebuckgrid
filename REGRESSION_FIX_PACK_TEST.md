# Regression Fix Pack - Test Guide

**Date**: January 27, 2026  
**Focus**: Desktop + iPhone usability fixes  
**Status**: Ready for testing

---

## What Was Fixed

### 1. ✅ Terrain Panel Mobile Usability
**Problem**: Controls not clickable/selectable on mobile, tiny hit targets

**Fixes Applied**:
- Added `pointer-events: auto` to all `.glass` elements
- Increased touch targets: all inputs/selects now `minHeight: 40px`
- Larger checkboxes: `18px × 18px` with padding
- Improved text input padding: `10px 8px`
- Better font sizes for mobile: `14px` for inputs
- Scrollable panel with `WebkitOverflowScrolling: touch`
- Responsive width: `maxWidth: calc(100vw - 20px)`
- Header click area expanded with `minHeight: 30px` and padding

### 2. ✅ Debug Box Removed
**Problem**: Unwanted debug/status box in bottom-right

**Fix**: Completely removed debug panel div

### 3. ✅ UI Panel Pointer Events
**Problem**: Glass panels might block clicks on mobile

**Fixes Applied**:
- `.glass` CSS: `pointer-events: auto`
- ToolGrid panel: explicit `pointerEvents: 'auto'`
- TonyChat panel: explicit `pointerEvents: 'auto'`
- Status panel: explicit `pointerEvents: 'auto'`

### 4. ✅ Brush Slider Visibility
**Status**: Already present in ToolGrid (lines 22-23)
- Label: "BRUSH SIZE: {brushSize}px"
- Range slider: 2-80px
- Orange accent color
- Already wired to `onBrushSize` callback

---

## Files Changed

1. **src/globals.css**
   - Added `pointer-events: auto` to `.glass`

2. **src/components/buckgrid/terrain/TerrainPanel.tsx**
   - Increased all input/select heights to 40px
   - Larger checkboxes (18px) with better spacing
   - Improved font sizes (14px for inputs, 10px for labels)
   - Added `WebkitOverflowScrolling: touch` for iOS
   - Responsive max-width
   - Better header click target

3. **src/components/buckgrid/BuckGridProPage.tsx**
   - Removed debug panel entirely
   - Added `pointerEvents: 'auto'` to ToolGrid and status panels

4. **src/components/buckgrid/chat/TonyChat.tsx**
   - Added `pointerEvents: 'auto'` to TonyChat panel

---

## Testing Protocol

### A. Desktop Testing (Codespaces Preview)

#### Test 1: Evaluate Property
1. Open app in Codespaces preview
2. Draw border with Border Tool
3. Click "LOCK BORDER"
4. Expand "TERRAIN & CONTEXT" panel
5. Fill at least: Season Phase, Cover Type
6. Open Tony Chat (top-right)
7. Click **EVALUATE PROPERTY** button
8. **VERIFY**:
   - See "⏳ Evaluating..." in chat
   - Console shows `[EVALUATE] Response:` log
   - Text appears in chat (OVERVIEW, PRIORITY ACTIONS, etc.)
   - If error, shows "❌ OPENROUTER_API_KEY missing..."

#### Test 2: Analyze Plan
1. Draw 2-3 features (CORN, BEANS, CLOVER)
2. Note the acres for each
3. Click **ANALYZE PLAN** button
4. **VERIFY**:
   - See "⏳ Analyzing..." in chat
   - Console shows `[ANALYZE] Response:` log
   - Analysis text appears (SUMMARY, TOP ACTIONS, WARNINGS)
   - Tony mentions specific plots: "Your Milo plot ~3.2 acres"
   - No "aerial imagery" language

#### Test 3: Chat
1. Type message in chat input: "What should I plant?"
2. Press Enter or click send arrow
3. **VERIFY**:
   - Message appears in chat as user bubble
   - Response appears from Tony
   - No silent failure

#### Test 4: Delete Selected
1. Draw a polygon
2. Click on polygon to select it (should highlight)
3. Click **DELETE SELECTED** button
4. **VERIFY**:
   - Polygon disappears from map
   - Polygon acres decreases
   - Feature count decreases
   - Console shows `[deleteSelected] Removing layer: <id>`

#### Test 5: Undo
1. After deleting polygon, click **⟲ UNDO**
2. **VERIFY**:
   - Polygon reappears
   - Acres restores
   - Feature count increases
   - Console shows `[undo] Restoring state: N features`

#### Test 6: Brush Slider
1. Look at left panel (ToolGrid)
2. Find "BRUSH SIZE: XXpx" label and slider
3. **VERIFY**: Slider is visible
4. Drag slider from 30px to 60px
5. Draw a polygon
6. **VERIFY**: Stroke is visibly thicker
7. Drag slider to 5px
8. Draw another polygon
9. **VERIFY**: Stroke is visibly thinner

#### Test 7: Terrain Panel (Desktop)
1. Expand "TERRAIN & CONTEXT" panel
2. Click on each dropdown (Season Phase, Cover Type, Elevation, Thermals)
3. **VERIFY**: All dropdowns open and are selectable
4. Check/uncheck terrain feature checkboxes
5. **VERIFY**: All checkboxes toggle properly
6. Type in text inputs (Wind, Access Points, etc.)
7. **VERIFY**: All text inputs accept keyboard input

---

### B. Mobile Testing (Responsive Mode)

#### Setup Mobile View
1. Open browser DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M or Cmd+Shift+M)
3. Select "iPhone 12 Pro" or similar
4. Rotate to portrait mode

#### Test 1: Terrain Panel Mobile
1. Find "▶ TERRAIN & CONTEXT" panel (left side)
2. **VERIFY**: Panel visible and not cut off
3. Tap the header to expand
4. **VERIFY**: Panel expands and scrolls
5. Tap on "Season Phase" dropdown
6. **VERIFY**: Dropdown opens (40px tall touch target)
7. Select different option
8. **VERIFY**: Selection works
9. Tap checkboxes (Ridges, Valleys, etc.)
10. **VERIFY**: 
    - Checkboxes are 18px and easy to tap
    - Toggles work on first tap
11. Tap text inputs (Predominant Wind, Access Points)
12. **VERIFY**:
    - Inputs focus properly
    - Keyboard appears
    - Can type in all fields
13. Scroll panel down
14. **VERIFY**: Smooth scrolling with momentum (iOS)

#### Test 2: Brush Slider Mobile
1. Find ToolGrid panel (left side, top)
2. Locate "BRUSH SIZE" slider
3. **VERIFY**: Slider is visible
4. Drag slider with finger/pointer
5. **VERIFY**: Slider responds to touch
6. Draw polygon
7. **VERIFY**: Line width changes

#### Test 3: Evaluate/Analyze Mobile
1. Tap TERRAIN panel, fill some fields
2. Lock border
3. Open Tony Chat (top-right)
4. Tap **EVALUATE PROPERTY**
5. **VERIFY**: 
   - Button responds to tap
   - Loading message appears
   - Response renders
6. Draw features
7. Tap **ANALYZE PLAN**
8. **VERIFY**:
   - Button responds
   - Analysis appears

#### Test 4: Delete Selected Mobile
1. Draw polygon with finger
2. Tap polygon to select
3. Tap **DELETE SELECTED** in ToolGrid
4. **VERIFY**: Polygon removes

#### Test 5: Mobile Chat Input
1. Open Tony Chat
2. Tap chat input field
3. **VERIFY**: Keyboard appears
4. Type message
5. Tap send button
6. **VERIFY**: Message sends

---

## Root Cause Analysis

### Why Evaluate/Analyze Weren't Working
**Likely Root Causes** (to verify during testing):

1. **API Endpoints Missing/Broken**
   - Check console for 404 errors on `/api/evaluate` or `/api/analyze`
   - If 404: endpoints exist but routing broken

2. **OPENROUTER_API_KEY Missing**
   - If you see "❌ OPENROUTER_API_KEY missing" → expected error
   - Need to set in `.env.local` on server

3. **Response Not Rendering**
   - Console should show `[ANALYZE] Response:` and `[EVALUATE] Response:`
   - If logs show data but no UI → state update issue (already fixed)
   - If no logs → fetch failing silently (now has try/catch)

4. **Silent Failures**
   - Previous code had `catch` blocks but didn't display errors
   - Now all errors show in chat with ❌ prefix

### Why Terrain Panel Wasn't Usable (Mobile)
**Root Causes** (FIXED):

1. **Missing `pointer-events: auto`**
   - Glass panels had no explicit pointer-events
   - Map container has `touch-action: none`
   - Fixed: added `pointer-events: auto` to `.glass` and all panels

2. **Tiny Touch Targets**
   - Inputs/selects were 6px padding = ~22px total height
   - iOS requires 44px minimum for comfortable tapping
   - Fixed: increased to 40px min-height with 10px padding

3. **Small Checkboxes**
   - Default checkboxes ~13px
   - Hard to tap on mobile
   - Fixed: 18px × 18px with larger padding around labels

4. **No iOS Scroll Momentum**
   - Missing `-webkit-overflow-scrolling: touch`
   - Fixed: added to panel style

### Why Delete Selected Wasn't Working
**To Investigate During Testing**:

Check console logs:
- Should see `[deleteSelected] Removing layer: <id>`
- If no log → callback not wired properly
- If log but no visual change → layer removal not triggering re-render

---

## Acceptance Criteria

All tests must pass:

- [ ] **A) Evaluate returns text and displays it**
  - Loading state shows
  - Text renders in chat
  - Errors display clearly

- [ ] **B) Analyze returns text and displays it**
  - Loading state shows
  - Text renders in chat
  - References specific plot types and acres

- [ ] **C) Chat sends and receives at least 1 message**
  - Input works
  - Send button works
  - Response appears

- [ ] **D) Delete Selected removes a feature; Undo restores it**
  - Delete removes layer
  - Undo brings it back
  - Console logs confirm

- [ ] **E) Slider changes line/polygon outline thickness visibly**
  - Slider is visible in ToolGrid
  - Dragging changes value
  - New polygons use new width

- [ ] **F) Terrain panel inputs can be toggled/clicked on mobile viewport**
  - All dropdowns open
  - All checkboxes toggle
  - All text inputs focus
  - Panel scrolls smoothly

---

## Known Issues to Document

If any test fails, document:

1. **Which test failed**
2. **What happened** (screenshot if possible)
3. **Console errors** (copy from DevTools)
4. **Network errors** (check Network tab)
5. **Expected behavior**

---

## Next Steps After Testing

**If all tests PASS**:
1. Commit changes
2. Update BASELINE.md
3. Tag as `baseline-v0.2`

**If tests FAIL**:
1. Document failures here
2. Check console for specific errors
3. Verify OPENROUTER_API_KEY is set (if API tests fail)
4. Fix issues before merging

---

**Last Updated**: January 27, 2026  
**Test By**: [Your Name]  
**Test Date**: ____________
