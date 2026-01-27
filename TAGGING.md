# Git Tagging Instructions - Baseline Lock

## Purpose
Create immutable baseline tags to prevent regressions. Future work can reference this stable state.

---

## When to Tag

Tag a baseline **ONLY** after:
1. Running full smoke test (`scripts/smoke-test.md`)
2. Verifying all baseline requirements (`BASELINE.md`)
3. Confirming no console errors
4. Testing in clean browser session

---

## How to Tag

### 1. Verify Current State
```bash
# Ensure working directory clean
git status

# Run smoke test
# Follow scripts/smoke-test.md checklist
```

### 2. Create Annotated Tag
```bash
# Create baseline tag with message
git tag -a baseline-v0.1 -m "Baseline lock: PAN/DRAW separation, API integration, save/load stable"

# Verify tag created
git tag -l "baseline-*"
```

### 3. Push Tag to Remote
```bash
# Push tag to GitHub
git push origin baseline-v0.1

# Or push all tags
git push --tags
```

---

## Tag Naming Convention

**Format**: `baseline-vX.Y`

- **X**: Major baseline version (breaking baseline changes)
- **Y**: Minor baseline version (additive only)

**Examples**:
- `baseline-v0.1` - Initial baseline (PAN/DRAW, save/load, API)
- `baseline-v0.2` - Added new baseline requirement (e.g., undo/redo must work)
- `baseline-v1.0` - Production-ready baseline

---

## Verifying Tags

### List All Baseline Tags
```bash
git tag -l "baseline-*"
```

### Show Tag Details
```bash
git show baseline-v0.1
```

### Checkout Baseline (for testing)
```bash
# Create branch from baseline tag
git checkout -b test-baseline baseline-v0.1

# Return to current branch
git checkout main  # or your current branch
```

---

## Using Tags in PRs

When reporting regressions:
```markdown
**Regression from**: baseline-v0.1
**Broken behavior**: Map drags while drawing in DRAW mode
**Test to verify**: scripts/smoke-test.md section 1 (PAN/DRAW separation)
```

---

## Deleting Tags (if needed)

**CAUTION**: Only delete unmerged/local tags

```bash
# Delete local tag
git tag -d baseline-v0.1

# Delete remote tag (dangerous!)
git push origin :refs/tags/baseline-v0.1
```

**Better approach**: Create new tag instead of deleting:
```bash
git tag -a baseline-v0.2 -m "Fixed baseline v0.1 issues"
```

---

## Baseline v0.1 Checklist

Before tagging `baseline-v0.1`:
- [ ] PAN/DRAW mode separation works
- [ ] Border lock restricts drawing
- [ ] Save/load preserves all data
- [ ] Acres calculation accurate
- [ ] /api/evaluate works with 0 features
- [ ] /api/analyze works with features
- [ ] Brush slider changes stroke width
- [ ] No console errors
- [ ] Full smoke test passed

---

## Tag NOW (Ready to Execute)

If all smoke tests pass, run:
```bash
cd /workspaces/Codespacebuckgrid
git add BASELINE.md TAGGING.md scripts/smoke-test.md .github/pull_request_template.md
git commit -m "Add baseline lock documentation and smoke test"
git tag -a baseline-v0.1 -m "Baseline lock: core UX stable - PAN/DRAW, save/load, API integration"
git push origin HEAD
git push origin baseline-v0.1
```

**Done!** Baseline locked at `baseline-v0.1`.
