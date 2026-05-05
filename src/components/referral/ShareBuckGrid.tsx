'use client'

/**
 * <ShareBuckGrid /> — "Share with your hunting crew" panel
 *
 * Drop this anywhere in the app. It:
 * 1. Reads the `buckgrid_ref` cookie so the sharer's code is pre-populated
 * 2. Lets a user type in their name to generate a personal referral link
 * 3. Copy-to-clipboard with visual confirmation
 *
 * Usage:
 *   import ShareBuckGrid from '@/components/referral/ShareBuckGrid'
 *   <ShareBuckGrid />
 */

import { useState, useEffect } from 'react'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://codespacebuckgrid.vercel.app'

const C = {
  card: '#131710',
  accent: '#6B7A57',
  text: '#D8D3C5',
  muted: '#6E6A5C',
  border: 'rgba(107,122,87,0.18)',
  green: '#5A8A5F',
  bg: 'rgba(107,122,87,0.08)',
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

interface ShareBuckGridProps {
  /** Optional: pre-fill with a name so hunters get a link right away */
  defaultName?: string
  /** Optional: compact card style vs full panel */
  compact?: boolean
}

export default function ShareBuckGrid({
  defaultName = '',
  compact = false,
}: ShareBuckGridProps) {
  const [name, setName] = useState(defaultName)
  const [refLink, setRefLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If the visitor already has a referral cookie from someone else, show it
  useEffect(() => {
    const existingCode = getCookie('buckgrid_ref')
    if (existingCode && !defaultName) {
      // Just preview the link without registering a new code
      setRefLink(`${SITE_URL}/ref/${existingCode}`)
    }
  }, [defaultName])

  async function generateLink() {
    if (!name.trim()) return
    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/referral/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const json = (await res.json()) as {
        success: boolean
        data?: { url: string }
        error?: string
      }

      if (!json.success) {
        // Code already exists — just build the URL from the slug
        const slug = slugify(name.trim())
        setRefLink(`${SITE_URL}/ref/${slug}`)
      } else {
        setRefLink(json.data?.url ?? `${SITE_URL}/ref/${slugify(name.trim())}`)
      }
    } catch {
      // Fallback: build URL client-side from slug
      const slug = slugify(name.trim())
      setRefLink(`${SITE_URL}/ref/${slug}`)
      setError('Could not register code — link generated locally.')
    } finally {
      setGenerating(false)
    }
  }

  async function copy() {
    if (!refLink) return
    await navigator.clipboard.writeText(refLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const containerStyle: React.CSSProperties = {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: compact ? 8 : 12,
    padding: compact ? '1rem' : '1.5rem',
    fontFamily: 'Inter, sans-serif',
    color: C.text,
    maxWidth: compact ? 340 : 480,
  }

  return (
    <div style={containerStyle}>
      {/* Heading */}
      <div style={{ marginBottom: '1rem' }}>
        <h3
          style={{
            fontSize: compact ? '0.95rem' : '1.1rem',
            fontWeight: 700,
            color: C.text,
            marginBottom: '0.2rem',
          }}
        >
          Share with your hunting crew
        </h3>
        <p style={{ fontSize: '0.8rem', color: C.muted, lineHeight: 1.4 }}>
          Get your personalized link. Anyone who signs up through it counts as
          your referral.
        </p>
      </div>

      {/* Name input + generate */}
      {!refLink && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void generateLink()}
            placeholder="Your name"
            style={{
              flex: 1,
              minWidth: 140,
              background: '#1a1f1c',
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              color: C.text,
              padding: '0.45rem 0.7rem',
              fontSize: '0.875rem',
              outline: 'none',
            }}
          />
          <button
            onClick={() => void generateLink()}
            disabled={generating || !name.trim()}
            style={{
              background: generating || !name.trim() ? '#2a3028' : C.green,
              color: generating || !name.trim() ? C.muted : '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '0.45rem 1rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: generating || !name.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {generating ? 'Getting link...' : 'Get My Link'}
          </button>
        </div>
      )}

      {/* Generated link display */}
      {refLink && (
        <div>
          <div
            style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: '0.6rem 0.85rem',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              color: C.accent,
              wordBreak: 'break-all',
              marginBottom: '0.6rem',
            }}
          >
            {refLink}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => void copy()}
              style={{
                background: copied ? 'rgba(90,138,95,0.25)' : C.green,
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '0.45rem 1rem',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                flex: 1,
              }}
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>

            <button
              onClick={() => {
                setRefLink(null)
                setName('')
              }}
              style={{
                background: 'transparent',
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                color: C.muted,
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              New
            </button>
          </div>
        </div>
      )}

      {/* Error note */}
      {error && (
        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#e88' }}>
          {error}
        </p>
      )}

      {/* Sharing shortcuts */}
      {refLink && (
        <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Hunt smarter with BuckGrid Pro — AI habitat intel for serious deer hunters. ${refLink}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.75rem',
              color: C.muted,
              textDecoration: 'none',
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              padding: '0.25rem 0.6rem',
            }}
          >
            Share on X
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(refLink)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.75rem',
              color: C.muted,
              textDecoration: 'none',
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              padding: '0.25rem 0.6rem',
            }}
          >
            Facebook
          </a>
          <a
            href={`sms:?body=${encodeURIComponent(`Check out BuckGrid Pro — ${refLink}`)}`}
            style={{
              fontSize: '0.75rem',
              color: C.muted,
              textDecoration: 'none',
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              padding: '0.25rem 0.6rem',
            }}
          >
            Text
          </a>
        </div>
      )}
    </div>
  )
}
