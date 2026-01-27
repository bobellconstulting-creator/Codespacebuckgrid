# Pull Request

## What Changed
<!-- Describe what this PR does in 2-3 sentences -->


## How to Test
<!-- Check all that apply and add specific steps -->

### Baseline Compliance Checklist
- [ ] **PAN mode**: Map drags/pans/zooms correctly
- [ ] **DRAW mode**: Map does NOT drag while drawing features
- [ ] **Border Lock**: Restricts drawing outside border (drawing only, not pan/zoom)
- [ ] **Save Plan**: Exports complete JSON with all data
- [ ] **Load Plan**: Restores border, layers, terrain, map position
- [ ] **Acres Calculation**: Displays and updates correctly
- [ ] **Analyze Plan**: Shows loading, returns analysis or error
- [ ] **Evaluate Property**: Works with 0 features, shows loading
- [ ] **Brush Slider**: Changes stroke width (2-80px)
- [ ] **No console errors**: Clean browser console

### Test Steps
<!-- Add specific steps to verify this PR -->
1. 
2. 
3. 

## Files Touched
<!-- List main files changed -->
- 
- 

## Breaking Changes
<!-- Any behavior changes that affect existing functionality? -->
- [ ] No breaking changes
- [ ] Contains breaking changes (explain below)


## Related Issues
<!-- Link to issues, PRs, or discussions -->
Closes #

---
**Before merging**: Run `scripts/smoke-test.md` checklist to verify baseline requirements.
