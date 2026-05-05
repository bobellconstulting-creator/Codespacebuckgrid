'use client'

/**
 * /admin/referral — Referral link generator + dashboard
 *
 * Client Component — fetches data from /api/referral/codes
 * No auth UI here; protect the route by setting REFERRAL_ADMIN_SECRET
 * in Vercel env and only sharing the page URL privately.
 */

import { useState, useEffect, useCallback } from 'react'

interface ReferralCodeRow {
  code: string
  name: string
  createdAt: string
  url: string
  hits: number
}

const C = {
  bg: '#0E1410',
  card: '#131710',
  accent: '#6B7A57',
  text: '#D8D3C5',
  muted: '#6E6A5C',
  border: 'rgba(107,122,87,0.18)',
  green: '#5A8A5F',
}

export default function ReferralAdminPage() {
  const [codes, setCodes] = useState<ReferralCodeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [adminSecret, setAdminSecret] = useState('')

  const fetchCodes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/referral/codes', {
        headers: adminSecret ? { 'x-admin-secret': adminSecret } : {},
      })
      const json = (await res.json()) as { success: boolean; data?: ReferralCodeRow[]; error?: string }
      if (!json.success) throw new Error(json.error ?? 'Failed to load codes')
      setCodes(json.data ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [adminSecret])

  useEffect(() => {
    void fetchCodes()
  }, [fetchCodes])

  async function handleCreate() {
    if (!name.trim()) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/referral/codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminSecret ? { 'x-admin-secret': adminSecret } : {}),
        },
        body: JSON.stringify({ name: name.trim() }),
      })
      const json = (await res.json()) as { success: boolean; data?: ReferralCodeRow; error?: string }
      if (!json.success) throw new Error(json.error ?? 'Failed to create code')
      setName('')
      await fetchCodes()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCreating(false)
    }
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        color: C.text,
        fontFamily: 'Inter, sans-serif',
        padding: '2rem 1rem',
      }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: C.text,
              marginBottom: '0.25rem',
              fontFamily: 'Teko, sans-serif',
              letterSpacing: '0.05em',
            }}
          >
            BUCKGRID — REFERRAL DASHBOARD
          </h1>
          <p style={{ color: C.muted, fontSize: '0.875rem' }}>
            Generate links. Share with hunters. Track clicks.
          </p>
        </div>

        {/* Admin secret (optional) */}
        {process.env.NODE_ENV !== 'development' && (
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <label
              style={{ display: 'block', fontSize: '0.75rem', color: C.muted, marginBottom: '0.4rem' }}
            >
              ADMIN SECRET (if configured)
            </label>
            <input
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="Leave blank in dev"
              style={{
                background: '#1a1f1c',
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                color: C.text,
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                width: '100%',
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* Create form */}
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: C.text }}>
            New Referral Link
          </h2>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
              placeholder="Name (e.g. Jake Smith, Facebook Group)"
              style={{
                flex: 1,
                minWidth: 220,
                background: '#1a1f1c',
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                color: C.text,
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
            <button
              onClick={() => void handleCreate()}
              disabled={creating || !name.trim()}
              style={{
                background: creating || !name.trim() ? '#2a3028' : C.green,
                color: creating || !name.trim() ? C.muted : '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '0.5rem 1.25rem',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: creating || !name.trim() ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {creating ? 'Creating...' : 'Generate Link'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              background: 'rgba(180,60,60,0.15)',
              border: '1px solid rgba(180,60,60,0.4)',
              borderRadius: 6,
              padding: '0.75rem 1rem',
              color: '#e88',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Codes table */}
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '0.75rem 1.25rem',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: C.text }}>
              Active Codes
            </h2>
            <button
              onClick={() => void fetchCodes()}
              style={{
                background: 'transparent',
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                color: C.muted,
                padding: '0.25rem 0.75rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: C.muted }}>
              Loading...
            </div>
          ) : codes.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: C.muted }}>
              No codes yet. Create one above.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: `1px solid ${C.border}`,
                    fontSize: '0.7rem',
                    color: C.muted,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em',
                  }}
                >
                  {['Name', 'Slug', 'Hits', 'Created', 'URL'].map((h) => (
                    <th
                      key={h}
                      style={{ padding: '0.6rem 1rem', textAlign: 'left', fontWeight: 600 }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {codes.map((row) => (
                  <tr
                    key={row.code}
                    style={{
                      borderBottom: `1px solid ${C.border}`,
                      fontSize: '0.85rem',
                    }}
                  >
                    <td style={{ padding: '0.75rem 1rem', color: C.text }}>{row.name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: C.accent, fontFamily: 'monospace' }}>
                      {row.code}
                    </td>
                    <td
                      style={{
                        padding: '0.75rem 1rem',
                        color: row.hits > 0 ? C.green : C.muted,
                        fontWeight: row.hits > 0 ? 700 : 400,
                      }}
                    >
                      {row.hits}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: C.muted, fontSize: '0.75rem' }}>
                      {new Date(row.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <button
                        onClick={() => void copyUrl(row.url)}
                        style={{
                          background: copied === row.url ? 'rgba(90,138,95,0.2)' : 'rgba(107,122,87,0.1)',
                          border: `1px solid ${C.border}`,
                          borderRadius: 4,
                          color: copied === row.url ? C.green : C.accent,
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          fontFamily: 'monospace',
                          whiteSpace: 'nowrap' as const,
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'block',
                        }}
                        title={row.url}
                      >
                        {copied === row.url ? 'Copied!' : row.url.replace('https://', '')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Storage note */}
        <p style={{ marginTop: '1.5rem', color: C.muted, fontSize: '0.75rem', lineHeight: 1.5 }}>
          <strong style={{ color: C.accent }}>Storage:</strong> Dev uses{' '}
          <code style={{ background: 'rgba(107,122,87,0.1)', padding: '0 4px', borderRadius: 3 }}>
            data/referrals.json
          </code>
          . On Vercel the filesystem is read-only — hits are counted in memory per request only.
          Wire a DB (Supabase, Vercel KV, PlanetScale) via the{' '}
          <code style={{ background: 'rgba(107,122,87,0.1)', padding: '0 4px', borderRadius: 3 }}>
            lib/referral-store.ts
          </code>{' '}
          adapter when ready to persist in production.
        </p>
      </div>
    </div>
  )
}
