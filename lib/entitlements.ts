// Lightweight entitlement check using Upstash Redis.
// No full DB or auth — email-based Pro access via KV.

const KV_URL   = process.env.KV_REST_API_URL   || ''
const KV_TOKEN = process.env.KV_REST_API_TOKEN  || ''

async function kvGet(key: string): Promise<string | null> {
  if (!KV_URL || !KV_TOKEN) return null
  try {
    const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      cache: 'no-store',
    })
    if (!r.ok) return null
    const j = await r.json()
    return j.result ?? null
  } catch { return null }
}

async function kvSet(key: string, value: string, exSeconds?: number): Promise<void> {
  if (!KV_URL || !KV_TOKEN) return
  const url = exSeconds
    ? `${KV_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}/ex/${exSeconds}`
    : `${KV_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`
  try {
    await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    })
  } catch {}
}

async function kvDel(key: string): Promise<void> {
  if (!KV_URL || !KV_TOKEN) return
  try {
    await fetch(`${KV_URL}/del/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    })
  } catch {}
}

function proKey(email: string) { return `pro:${email.toLowerCase().trim()}` }

export async function grantPro(email: string, stripeCustomerId: string, stripeSubId: string) {
  const ONE_YEAR_S = 365 * 24 * 3600
  const payload = JSON.stringify({ stripeCustomerId, stripeSubId, grantedAt: new Date().toISOString() })
  await kvSet(proKey(email), payload, ONE_YEAR_S)
}

export async function revokePro(email: string) {
  await kvDel(proKey(email))
}

export async function isPro(email: string): Promise<boolean> {
  if (!email) return false
  const val = await kvGet(proKey(email))
  return val !== null
}
