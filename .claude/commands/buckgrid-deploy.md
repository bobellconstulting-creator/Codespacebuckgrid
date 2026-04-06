# BuckGrid Pro — Full Deploy

Run a complete, verified deploy of BuckGrid Pro to Vercel production.

## Steps

1. **Check env vars** — verify these are set in Vercel:
   - `ANTHROPIC_API_KEY` (Tony's primary AI)
   - `OPENAI_API_KEY` (fallback provider)
   - `GOOGLE_AI_KEY` (Gemini fallback)
   - Run: `npx vercel env ls` and scan the output

2. **Build check** — run `npm run build` locally. Fix any TypeScript or build errors before deploying. Do NOT deploy a broken build.

3. **Deploy** — run: `npx vercel --prod --yes`

4. **Verify Tony is alive** — after deploy, make a test request:
   ```bash
   curl -X POST https://codespacebuckgrid.vercel.app/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message":"quick test","bounds":{"north":38.65,"south":38.64,"east":-96.49,"west":-96.50},"features":[]}'
   ```
   Check: response has `reply` field and no `error` field.

5. **Report** — output the deployment URL and Tony's health status.
