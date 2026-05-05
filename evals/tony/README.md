# Tony Eval Harness

Objective regression tests for the Tony habitat consultant API
(`app/api/chat/route.ts`). Run before and after every Tony change so you
know whether the change helped or regressed quality.

## Run

```bash
# 1. Start the dev server in another terminal
npm run dev

# 2. Run the eval suite
npm run eval:tony
```

A markdown report lands in `evals/tony/results-<timestamp>.md` with
per-case pass/fail and an aggregate score.

## What it scores

For every case, the harness scores Tony's response against a rubric:

| Check | What it verifies |
|-------|------------------|
| `must_include_features` | Every required feature `type` appears in `features[]` |
| `must_cite_compass_direction` | `reply` mentions a compass word (N/S/E/W/NE/NW/SE/SW/north/south/east/west) |
| `must_be_inside_bbox` | Every feature coordinate falls inside the case bbox |
| `min_confidence_field_present` | Every feature has `confidence` and `priority` integers |
| `no_water_unless_osm` | No `water` features (cases here have no OSM-confirmed water) |

A case PASSES only if every enabled rubric check passes.

## Adding a case

1. Drop a satellite screenshot in `evals/tony/cases/images/` (PNG, ~640x480).
2. Copy `cases/case-template.json` to `cases/case-NN.json`.
3. Set `image_path`, real `bbox` (north/south/east/west lat-lng), the
   `user_message`, and which rubric checks to enforce.
4. Re-run `npm run eval:tony`.

## Schema

See `cases/case-template.json` for the case schema. Image paths are
resolved relative to the case file.

## Exit codes

- `0` — every case passed
- `1` — at least one case failed (use this in CI)

## Files

- `run.mjs` — the harness (Node built-ins only, uses global `fetch`)
- `cases/*.json` — test cases (template excluded automatically)
- `cases/images/` — satellite screenshots referenced by cases
- `results-*.md` — generated reports (gitignore-friendly)
