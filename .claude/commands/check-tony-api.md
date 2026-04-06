# Check Tony AI — Full Provider Chain Health

Verify Tony AI's complete provider chain is alive and responding.

## Steps

1. **Check .env.local keys** — read `C:\Users\bobel\projects\Codespacebuckgrid\.env.local` and verify:
   - `ANTHROPIC_API_KEY` is set and not a placeholder
   - `OPENAI_API_KEY` is set and not a placeholder
   - `GOOGLE_AI_KEY` is set and not a placeholder

2. **Test Anthropic (primary)** — make a minimal API call:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" https://api.anthropic.com/v1/messages \
     -H "x-api-key: $ANTHROPIC_API_KEY" \
     -H "anthropic-version: 2023-06-01" \
     -H "content-type: application/json" \
     -d '{"model":"claude-sonnet-4-6","max_tokens":10,"messages":[{"role":"user","content":"ping"}]}'
   ```
   Expect: `200`. Anything else = key issue.

3. **Check rate limits** — if getting 429, note which provider and check billing.

4. **Check Vercel env** — run `npx vercel env ls --cwd C:\Users\bobel\projects\Codespacebuckgrid` to confirm production env matches local.

5. **Report** — table of provider | status | issue for each key checked.
