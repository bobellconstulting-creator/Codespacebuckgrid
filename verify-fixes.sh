#!/bin/bash
# Quick verification of all regression fixes

echo "=== REGRESSION FIX VERIFICATION ==="
echo ""

echo "✓ Checking if /api/evaluate exists..."
if [ -f "app/api/evaluate/route.ts" ]; then
    echo "  ✓ /api/evaluate/route.ts exists"
else
    echo "  ✗ /api/evaluate/route.ts MISSING"
fi

echo ""
echo "✓ Checking if /api/analyze exists..."
if [ -f "app/api/analyze/route.ts" ]; then
    echo "  ✓ /api/analyze/route.ts exists"
else
    echo "  ✗ /api/analyze/route.ts MISSING"
fi

echo ""
echo "✓ Checking if /api/chat exists..."
if [ -f "app/api/chat/route.ts" ]; then
    echo "  ✓ /api/chat/route.ts exists"
else
    echo "  ✗ /api/chat/route.ts MISSING"
fi

echo ""
echo "✓ Checking if debug panel was removed..."
if grep -q "DEV DEBUG PANEL" src/components/buckgrid/BuckGridProPage.tsx; then
    echo "  ✗ Debug panel still exists"
else
    echo "  ✓ Debug panel removed"
fi

echo ""
echo "✓ Checking if brush slider exists in ToolGrid..."
if grep -q "BRUSH SIZE" src/components/buckgrid/ui/ToolGrid.tsx; then
    echo "  ✓ Brush slider present in ToolGrid"
else
    echo "  ✗ Brush slider MISSING"
fi

echo ""
echo "✓ Checking if pointer-events added to .glass..."
if grep -q "pointer-events: auto" src/globals.css; then
    echo "  ✓ pointer-events: auto in .glass CSS"
else
    echo "  ✗ pointer-events MISSING from .glass"
fi

echo ""
echo "✓ Checking Turf.js installation..."
if grep -q "@turf/area" package.json; then
    echo "  ✓ @turf/area installed"
else
    echo "  ✗ @turf/area MISSING"
fi

echo ""
echo "=== VERIFICATION COMPLETE ==="
echo ""
echo "Next steps:"
echo "1. Open http://localhost:3000 in browser"
echo "2. Follow REGRESSION_FIX_PACK_TEST.md for manual testing"
echo "3. Test on desktop, then switch to mobile responsive mode"
echo ""
