#!/usr/bin/env node
import crypto from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_ENV_PATH = '/Users/bobell/.secrets/x-oauth.env'
const API_URL = 'https://api.x.com/2/tweets'
const UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json'

function parseArgs(argv) {
  const args = {
    dryRun: false,
    env: DEFAULT_ENV_PATH,
    media: '',
    text: '',
    textFile: '',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--env') args.env = argv[++i] ?? ''
    else if (arg === '--media') args.media = argv[++i] ?? ''
    else if (arg === '--text') args.text = argv[++i] ?? ''
    else if (arg === '--text-file') args.textFile = argv[++i] ?? ''
    else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return args
}

function printHelp() {
  console.log(`Usage:
  node tools/social/post-x.mjs --text "Post copy" [--media /path/image.png]
  node tools/social/post-x.mjs --text-file /path/copy.txt --media /path/image.png

Options:
  --dry-run       Validate inputs and credentials without posting
  --env PATH      OAuth env file. Default: ${DEFAULT_ENV_PATH}
  --media PATH    Optional image file to attach
  --text TEXT     Post text
  --text-file     Read post text from a file`)
}

function shellUnquote(value) {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && trimmed[0] === trimmed.at(-1) && ['"', "'"].includes(trimmed[0])) {
    return trimmed.slice(1, -1).replace(/'\\''/g, "'")
  }

  return trimmed
}

async function readEnv(envPath) {
  const text = await readFile(envPath, 'utf8')
  const env = {}

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    env[trimmed.slice(0, index)] = shellUnquote(trimmed.slice(index + 1))
  }

  return env
}

function requiredEnv(env) {
  return [
    'X_OAUTH1_CONSUMER_KEY',
    'X_OAUTH1_CONSUMER_SECRET',
    'X_OAUTH1_ACCESS_TOKEN',
    'X_OAUTH1_ACCESS_TOKEN_SECRET',
  ].filter(key => !env[key])
}

function encode(value) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

function normalizedUrl(rawUrl) {
  const url = new URL(rawUrl)
  const defaultPort = (url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')
  const host = `${url.hostname.toLowerCase()}${defaultPort || !url.port ? '' : `:${url.port}`}`
  return `${url.protocol}//${host}${url.pathname || '/'}`
}

function oauthHeader(method, rawUrl, extraParams, env) {
  const oauthParams = {
    oauth_consumer_key: env.X_OAUTH1_CONSUMER_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: env.X_OAUTH1_ACCESS_TOKEN,
    oauth_version: '1.0',
  }

  const url = new URL(rawUrl)
  const signatureParams = []
  for (const source of [oauthParams, Object.fromEntries(url.searchParams.entries()), extraParams ?? {}]) {
    for (const [key, value] of Object.entries(source)) {
      signatureParams.push([encode(key), encode(value)])
    }
  }

  signatureParams.sort(([aKey, aValue], [bKey, bValue]) => (aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey)))
  const paramString = signatureParams.map(([key, value]) => `${key}=${value}`).join('&')
  const baseString = [method.toUpperCase(), normalizedUrl(rawUrl), paramString].map(encode).join('&')
  const signingKey = `${encode(env.X_OAUTH1_CONSUMER_SECRET)}&${encode(env.X_OAUTH1_ACCESS_TOKEN_SECRET)}`
  oauthParams.oauth_signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64')

  return `OAuth ${Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encode(key)}="${encode(value)}"`)
    .join(', ')}`
}

async function uploadMedia(mediaPath, env) {
  const bytes = await readFile(mediaPath)
  const form = new FormData()
  const type = mediaPath.toLowerCase().endsWith('.jpg') || mediaPath.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 'image/png'
  form.append('media', new Blob([bytes], { type }), path.basename(mediaPath))

  const response = await fetch(UPLOAD_URL, {
    body: form,
    headers: {
      Authorization: oauthHeader('POST', UPLOAD_URL, {}, env),
    },
    method: 'POST',
  })

  const body = await response.text()
  if (!response.ok) throw new Error(`Media upload failed: HTTP ${response.status} ${body}`)

  const payload = JSON.parse(body)
  const mediaId = payload.media_id_string || String(payload.media_id || '')
  if (!mediaId) throw new Error('Media upload succeeded but did not return a media id.')
  return mediaId
}

async function createPost(text, mediaId, env) {
  const body = {
    text,
    ...(mediaId ? { media: { media_ids: [mediaId] } } : {}),
  }

  const response = await fetch(API_URL, {
    body: JSON.stringify(body),
    headers: {
      Authorization: oauthHeader('POST', API_URL, {}, env),
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  const responseText = await response.text()
  if (!response.ok) throw new Error(`Post creation failed: HTTP ${response.status} ${responseText}`)
  return JSON.parse(responseText).data
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const env = await readEnv(args.env)
  const missing = requiredEnv(env)
  if (missing.length) throw new Error(`Missing OAuth values: ${missing.join(', ')}`)

  const text = args.textFile ? (await readFile(args.textFile, 'utf8')).trim() : args.text.trim()
  if (!text) throw new Error('Post text is required.')
  if (text.length > 280) throw new Error(`Post text is ${text.length} characters; keep it under 280 for this workflow.`)

  if (args.dryRun) {
    console.log(JSON.stringify({ status: 'dry_run_ok', chars: text.length, hasMedia: Boolean(args.media) }, null, 2))
    return
  }

  const mediaId = args.media ? await uploadMedia(args.media, env) : ''
  const post = await createPost(text, mediaId, env)
  const handle = (env.X_HANDLE || 'BuckGrid_pro').replace(/^@/, '')
  console.log(JSON.stringify({
    status: 'posted',
    postId: post.id,
    url: `https://x.com/${handle}/status/${post.id}`,
    mediaId,
  }, null, 2))
}

main().catch(error => {
  console.error(JSON.stringify({ status: 'error', message: error.message }, null, 2))
  process.exit(1)
})
