# CLAUDE.md — Codespacebuckgrid (LIVE PRODUCTION)

> **STOP. READ THIS BEFORE TOUCHING ANYTHING.**
> This is the LIVE revenue product at **https://codespacebuckgrid.vercel.app**.
> Main branch auto-deploys to Vercel on push. Every commit here is production.
> Do not confuse with `C:/Users/bobel/projects/buckgrid/` (v2 rebuild, dev port 3005).

Global profile: `C:/Users/bobel/CLAUDE.md`. Memory: `C:/Users/bobel/.claude/projects/C--Users-bobel/memory/MEMORY.md`.
Repo disambiguation: `C:/Users/bobel/.claude/projects/C--Users-bobel/memory/project_buckgrid_repos.md`.

---

## WHAT THIS IS

**LIVE BuckGrid Pro.** Next.js 14 App Router on Vercel. Tony AI (Gemini 2.5 Flash vision + spatial). Mapbox satellite base.
Headline: "Draw Your Land. Talk To Tony. Kill Bigger Bucks." Stand-placement tool first, food plots secondary.

**Deployment:** Vercel auto-deploys from `main` branch push. No staging gate. Treat `main` as production.

---

## PRE-COMMIT CHECKLIST (MANDATORY)

Before ANY push to main:

1. `npm run dev` locally and smoke-test the affected pages
2. `npx tsc --noEmit` — clean typecheck
3. `npm run build` — clean production build
4. `/api/tony` hits the right model (Gemini primary, not paid) — verify `lib/` routing
5. `NEXT_PUBLIC_MAPBOX_TOKEN` present in Vercel env (confirmed set as of 2026-04-11 audit)
6. Show Bo the exact file diff and the commit message BEFORE running `git push`
7. Never force-push main

If any check fails → STOP, report, ask.

---

## TONY AI ROUTING (HARD RULE)

Same rule as global and v2:

1. **Primary:** Gemini 2.5 Flash (vision, free)
2. **Fallback:** Groq / NVIDIA DeepSeek / Fireworks
3. **Paid Haiku/OpenAI:** opt-in only via `ENABLE_PAID_FALLBACK=1` + Bo's explicit OK. Never the default.

**Previous incident 2026-04-11:** Haiku was wired as primary "for production grade." Bo was furious and paid the bill. Never again.
Do not swap Tony to a paid API without a local-tested PR + Bo's sign-off.

---

## HONESTY RULES (PERMANENT)

From `C:/Users/bobel/.claude/projects/C--Users-bobel/memory/project_buckgrid_honesty_fix.md`:

- **Real paying users: ZERO.** Not 847. Not 100. Zero.
- **No fabricated stats, testimonials, hunter names, kill sizes, or dollar figures.** Anywhere on the site.
- Allowed social proof on landing: founder voice ("Day 1 / Founder Build / 6 Layers / Free Your First Map") — verifiable technical stats only.
- If you spot a resurgent fake stat anywhere in `app/page.tsx` or marketing copy, flag it immediately.
- Hunters catch BS faster than any consumer segment. One forum post burns the brand.

---

## KNOWN ISSUES

- `/api/tony` may return **404** after the v2 refactor path changes. Verify route handler exists at `app/api/tony/route.ts` before debugging upstream.
- Mapbox token: `NEXT_PUBLIC_MAPBOX_TOKEN` — confirmed set in Vercel env as of 2026-04-11. If map fails, check env propagation before assuming code bug.
- OpenAI key: hit 429 rate limits historically. Not a reason to fall back to Haiku automatically.

---

## COMMANDS

```bash
cd C:/Users/bobel/projects/codespacebuckgrid
npm run dev          # local smoke test
npm run build        # MUST pass before push
npx tsc --noEmit     # typecheck
git status           # show Bo the diff
git push             # ONLY after Bo's OK — deploys to Vercel prod
```

---

## DO NOT

- Do NOT force-push `main`. Ever.
- Do NOT deploy on Friday afternoons. Bo doesn't want to fix prod on Saturday.
- Do NOT modify the NextAuth / auth flow without Bo's explicit approval — breaks all sessions.
- Do NOT fabricate stats, testimonials, user counts, or social proof.
- Do NOT swap Tony's primary model to any paid API without a local-tested diff + Bo's per-session sign-off.
- Do NOT write branding changes here — branding work belongs in `buckgrid/` v2.
- Do NOT auto-commit. Show Bo the diff first, every time.

---

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Codespacebuckgrid** (356 symbols, 652 relationships, 28 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/Codespacebuckgrid/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Codespacebuckgrid/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Codespacebuckgrid/clusters` | All functional areas |
| `gitnexus://repo/Codespacebuckgrid/processes` | All execution flows |
| `gitnexus://repo/Codespacebuckgrid/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->