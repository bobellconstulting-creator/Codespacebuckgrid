/**
 * Referral store — flat JSON file for MVP.
 * On Vercel, the filesystem is read-only after build, so hits logged here
 * will only persist in dev. Set REFERRAL_STORAGE=vercel-kv (or similar)
 * when you wire a real DB. For now, API route also returns data via response
 * so the admin UI can accumulate state client-side.
 */

import fs from 'fs'
import path from 'path'

const DATA_PATH = path.join(process.cwd(), 'data', 'referrals.json')

export interface ReferralCode {
  code: string
  name: string
  createdAt: string
  url: string
}

export interface ReferralHit {
  code: string
  timestamp: string
  userAgent: string
  page: string
  ip?: string
}

export interface ReferralStore {
  codes: Record<string, ReferralCode>
  hits: ReferralHit[]
}

function readStore(): ReferralStore {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf-8')
    return JSON.parse(raw) as ReferralStore
  } catch {
    return { codes: {}, hits: [] }
  }
}

function writeStore(store: ReferralStore): void {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2), 'utf-8')
  } catch {
    // Vercel prod filesystem is read-only — silently swallow.
    // In prod, wire a real DB via REFERRAL_STORAGE env.
  }
}

export function getAllCodes(): ReferralCode[] {
  const store = readStore()
  return Object.values(store.codes)
}

export function getCode(code: string): ReferralCode | null {
  const store = readStore()
  return store.codes[code] ?? null
}

export function createCode(name: string): ReferralCode {
  const store = readStore()
  const slug = slugify(name)
  const code: ReferralCode = {
    code: slug,
    name,
    createdAt: new Date().toISOString(),
    url: `${baseUrl()}/ref/${slug}`,
  }
  store.codes[slug] = code
  writeStore(store)
  return code
}

export function recordHit(hit: ReferralHit): void {
  const store = readStore()
  store.hits.push(hit)
  // Keep last 10k hits to bound file size
  if (store.hits.length > 10_000) {
    store.hits = store.hits.slice(-10_000)
  }
  writeStore(store)
}

export function getHitsForCode(code: string): ReferralHit[] {
  const store = readStore()
  return store.hits.filter((h) => h.code === code)
}

export function getAllHits(): ReferralHit[] {
  return readStore().hits
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)
}

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://codespacebuckgrid.vercel.app'
  )
}
