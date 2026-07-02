# BuckGrid Pro X Posting Handoff

Date: 2026-07-01

## Result

BuckGrid Pro can now post to X through the API with an attached image.

Verified live post:

- Account: `@BuckGrid_pro`
- URL: https://x.com/BuckGrid_pro/status/2072451214831169982
- Image used: `/Users/bobell/Desktop/BuckGrid/BuckGridPro-Demo/social/buckgrid-x-know-your-ground-2026-07-01.png`
- Vertical derivative for TikTok/Shorts: `/Users/bobell/Desktop/BuckGrid/BuckGridPro-Demo/social/buckgrid-vertical-know-your-ground-2026-07-01.png`

## What Made It Work

The OAuth2 token could read the account and create text posts, but image upload failed. The working path is:

1. Upload image with OAuth 1.0a user context via `https://upload.twitter.com/1.1/media/upload.json`.
2. Create the post with OAuth 1.0a user context via `https://api.x.com/2/tweets`.

OAuth 1.0a consumer credentials and user token credentials were regenerated in the X Developer Console and saved locally in:

`/Users/bobell/.secrets/x-oauth.env`

Do not print the secret values. Relevant key names:

- `X_OAUTH1_CONSUMER_KEY`
- `X_OAUTH1_CONSUMER_SECRET`
- `X_OAUTH1_ACCESS_TOKEN`
- `X_OAUTH1_ACCESS_TOKEN_SECRET`
- `X_HANDLE`

The X Developer account had zero credits, which blocked post creation with `CreditsDepleted`. Bo approved and added `$25` of X API credits on 2026-07-01. After that, API posting succeeded.

## Reusable Command

A reusable CLI now exists:

```bash
cd /Users/bobell/Projects/_active/buckgrid-pro-integration-launcher
npm run post:x -- --text "Post copy here" --media /absolute/path/to/image.png
```

Dry-run example:

```bash
cd /Users/bobell/Projects/_active/buckgrid-pro-integration-launcher
npm run post:x -- --dry-run --text "Post copy here" --media /absolute/path/to/image.png
```

The script lives at:

`/Users/bobell/Projects/_active/buckgrid-pro-integration-launcher/tools/social/post-x.mjs`

It intentionally reads secrets from `/Users/bobell/.secrets/x-oauth.env` and avoids dependencies beyond Node built-ins and built-in `fetch`/`FormData`.

## Site/Social Links Added

The public footer and metadata were updated in both BuckGrid app lanes:

- `/Users/bobell/Projects/_active/buckgrid-pro-integration-launcher/app/page.tsx`
- `/Users/bobell/Projects/_active/buckgrid-pro-integration-launcher/app/layout.tsx`
- `/Users/bobell/Projects/_active/buckgrid-pro-clean/app/page.tsx`
- `/Users/bobell/Projects/_active/buckgrid-pro-clean/app/layout.tsx`

Visible footer links now include:

- Website: `https://www.buckgridpro.com`
- X: `https://x.com/BuckGrid_pro`
- TikTok: `https://www.tiktok.com/@buckgridpro`
- Email: `bo@buckgrid.pro`

No verified YouTube URL was found. Do not invent one; add it when Bo confirms the handle/channel.

## Verification

Completed:

- `npm run build` passed in `/Users/bobell/Projects/_active/buckgrid-pro-integration-launcher`.
- `node tools/social/post-x.mjs --dry-run ...` passed with the same image path and 270-character text.
- Live API post succeeded after the `$25` credit top-up.

Not completed:

- `/Users/bobell/Projects/_active/buckgrid-pro-clean` build did not run because dependencies are not installed there (`next: command not found`).
- Footer changes were not deployed to production during this session.
- Mission Control/Agent OS has not yet been wired to call `npm run post:x`.

## Browser Notes

Chrome file upload through the Codex extension failed because the extension does not have file URL access. The workaround is no longer needed because API media upload works. If browser upload is needed later, enable Chrome extension file access:

`chrome://extensions` -> Codex extension -> Details -> Allow access to file URLs.

## Next Step For Claude Or Codex

Wire an approval-gated Mission Control action that:

1. Generates or selects a post image.
2. Writes post text to a temp file or passes it as `--text`.
3. Calls:

```bash
npm --prefix /Users/bobell/Projects/_active/buckgrid-pro-integration-launcher run post:x -- --text-file /path/to/copy.txt --media /path/to/image.png
```

4. Shows the returned X URL in Mission Control.

Keep human approval before public posting unless Bo explicitly changes that policy.
