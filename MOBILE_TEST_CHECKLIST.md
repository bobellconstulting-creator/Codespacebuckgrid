# Mobile Test Checklist

## Test Environment
- **Server**: http://localhost:3000
- **Mobile Viewport**: < 768px (iPhone 12 Pro: 390x844)
- **Desktop Viewport**: ≥ 768px (1920x1080)

## Mobile Layout Tests (< 768px)

### ✅ Bottom Drawer
- [ ] Drawer appears at bottom of screen
- [ ] Handle visible and grabbable
- [ ] Drawer opens/closes on handle tap
- [ ] Max height ~70vh (doesn't cover map)
- [ ] Smooth transitions

### ✅ Tabs (Tools, Layers, Tony, Terrain)
- [ ] All 4 tabs visible
- [ ] Tab switching works
- [ ] Active tab highlighted
- [ ] Icons render correctly

### ✅ Tools Tab
- [ ] All tools visible and selectable
- [ ] Brush size slider works (2-80px)
- [ ] Draw mode toggle works
- [ ] Delete Selected button visible
- [ ] Undo button visible
- [ ] Wipe All button visible
- [ ] Lock Border hidden (uses floating button)
- [ ] Fit to Border hidden (uses floating button)

### ✅ Layers Tab
- [ ] Property acres displayed prominently
- [ ] Border status shows (Locked ✓ / Not Locked)
- [ ] Terrain status shows (OK / Missing)
- [ ] Feature count accurate
- [ ] Polygon acres accurate
- [ ] Layer list shows all drawn polygons
- [ ] Each layer shows type + acres
- [ ] Empty state: "No layers drawn yet"

### ✅ Tony Tab
- [ ] Chat interface visible
- [ ] Input box accessible
- [ ] Speech-to-text button works
- [ ] Analyze button sends request
- [ ] Evaluate button sends request
- [ ] Responses render properly
- [ ] Collapsible sections work
- [ ] Scroll works for long responses

### ✅ Terrain Tab
- [ ] All checkboxes visible (40px min-height)
- [ ] Touch targets large enough (18px checkboxes)
- [ ] Scroll works if content overflows
- [ ] iOS momentum scrolling enabled

### ✅ Floating Buttons
- [ ] Lock Border button visible (top-right, orange)
- [ ] Fit to Border button visible (below Lock, blue)
- [ ] Buttons don't overlap drawer handle
- [ ] Tap feedback works
- [ ] Z-index above drawer (2500)

### ✅ Draw Mode Indicator
- [ ] "DRAW MODE ON" appears top-left when drawing
- [ ] Green background, black text
- [ ] Visible but not blocking controls
- [ ] Disappears when draw mode off

### ✅ Map Interactions
- [ ] Pan works (2-finger drag or 1-finger in PAN mode)
- [ ] Pinch-zoom works
- [ ] Drawing works when Draw Mode ON
- [ ] Drawing blocked when Draw Mode OFF (shows toast)
- [ ] Map doesn't drag while drawing polygon
- [ ] Undo removes last polygon
- [ ] Delete Selected removes selected polygon

## Desktop Layout Tests (≥ 768px)

### ✅ Side Panels
- [ ] ToolGrid visible on left
- [ ] TonyChat visible on right
- [ ] TerrainPanel visible bottom-left
- [ ] Status panel visible bottom-left
- [ ] PlanManager visible top-right

### ✅ Mobile Elements Hidden
- [ ] MobileDrawer NOT visible
- [ ] Floating buttons NOT visible
- [ ] Draw indicator centered (not left)

### ✅ All Features Still Work
- [ ] Tools selectable
- [ ] Brush slider works
- [ ] Chat works
- [ ] Terrain inputs work
- [ ] Save/Load plans work
- [ ] Lock Border button in ToolGrid
- [ ] Fit to Border button in ToolGrid

## Responsive Breakpoint Test

### Switch from Desktop → Mobile (resize to < 768px)
- [ ] Side panels disappear
- [ ] Bottom drawer appears
- [ ] Floating buttons appear
- [ ] Map remains interactive
- [ ] State preserved (drawn features, terrain)

### Switch from Mobile → Desktop (resize to ≥ 768px)
- [ ] Bottom drawer disappears
- [ ] Side panels appear
- [ ] Floating buttons disappear
- [ ] Map remains interactive
- [ ] State preserved

## Touch Gesture Tests (Mobile Only)

### Pan Map
- [ ] 1-finger drag pans map (when isDrawMode=false)
- [ ] 2-finger drag always pans
- [ ] No jank or lag

### Draw Polygon
- [ ] Tap to start polygon
- [ ] Tap to add vertices
- [ ] Double-tap to complete
- [ ] No accidental panning while drawing
- [ ] Brush size preview visible

### Pinch Zoom
- [ ] Smooth zoom in/out
- [ ] Centers on pinch point
- [ ] No content jumping

## Performance Tests

### Frame Rate
- [ ] 60fps during pan
- [ ] 60fps during zoom
- [ ] 60fps during drawer open/close
- [ ] No jank when switching tabs

### Memory
- [ ] No memory leaks after 5min use
- [ ] Undo stack doesn't grow unbounded (20 max)
- [ ] Map tiles release properly

### Re-renders
- [ ] Drawer doesn't re-render on map pan
- [ ] Map doesn't re-render on tab switch
- [ ] Only active tab content renders

## PWA Tests

### Installation
- [ ] Manifest loads (check Network tab)
- [ ] Service worker registers
- [ ] "Add to Home Screen" prompt appears (Android)
- [ ] Install banner appears (desktop Chrome)

### Offline Capability
- [ ] App loads from cache when offline
- [ ] Service worker intercepts requests
- [ ] Cached version shows correctly

### Icons + Theme
- [ ] App icon shows in task switcher
- [ ] Theme color #FF6B00 applied
- [ ] Status bar styled correctly

## Bug Regression Tests

### Previous Fixes Must Still Work
- [ ] PAN/DRAW separation (map doesn't drag while drawing)
- [ ] Acres calculation accurate (@turf/area)
- [ ] API responses render in UI
- [ ] Terrain panel mobile usable
- [ ] Delete Selected works
- [ ] Undo works (max 20 actions)
- [ ] Lock Border allows pan/zoom after locking
- [ ] Fit to Border centers on locked border

## Final QA

- [ ] No console errors
- [ ] No TypeScript errors
- [ ] All buttons labeled clearly
- [ ] Touch targets ≥44x44px
- [ ] Text readable at all sizes
- [ ] Contrast ratios meet WCAG AA
- [ ] Works on iPhone Safari
- [ ] Works on Android Chrome
- [ ] Works on desktop Chrome

## Known Issues / Tech Debt

- [ ] None currently - clean build! 🎉
