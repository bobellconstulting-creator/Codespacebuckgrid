'use client'

import { useEffect, useCallback } from 'react'
import type { VaultNode } from './useVaultGraph'

const REGION_COLORS: Record<string, string> = {
  PREFRONTAL:  '#00d4ff',
  MOTOR:       '#00ffaa',
  MEMORY:      '#a855f7',
  ASSOCIATION: '#f97316',
  SENSORY:     '#3b82f6',
  CONCEPT:     '#ec4899',
  INTEL:       '#fbbf24',
  SYSTEM:      '#6b7280',
}

function regionColor(region: string): string {
  return REGION_COLORS[region.toUpperCase()] ?? '#6b7280'
}

function timeAgo(timestampMs: number): string {
  const diff = Date.now() - timestampMs
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

interface NodeDetailPanelProps {
  node: VaultNode | null
  linkCount: number
  onDismiss: () => void
}

export function NodeDetailPanel({ node, linkCount, onDismiss }: NodeDetailPanelProps) {
  const visible = node !== null

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) onDismiss()
    },
    [visible, onDismiss]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Click-outside: the backdrop div handles it
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onDismiss()
  }

  const accent = node ? regionColor(node.region) : '#00d4ff'

  return (
    <>
      {/* Backdrop — click outside to dismiss */}
      <div
        onClick={handleBackdropClick}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          pointerEvents: visible ? 'auto' : 'none',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: visible
            ? 'translate(-50%, 0)'
            : 'translate(-50%, 110%)',
          transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 51,
          width: 'min(520px, 92vw)',
          pointerEvents: visible ? 'auto' : 'none',
        }}
      >
        {/* Clip-path corners via SVG mask trick using outline box */}
        <div
          style={{
            background: 'rgba(0, 8, 18, 0.94)',
            border: `1px solid ${accent}44`,
            borderTop: `2px solid ${accent}`,
            padding: '20px 24px 28px',
            fontFamily: "'Share Tech Mono', 'Courier New', monospace",
            position: 'relative',
            // Clip corners
            clipPath:
              'polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)',
            boxShadow: `0 -4px 40px ${accent}22, 0 0 80px rgba(0,0,0,0.8)`,
          }}
        >
          {/* Corner accents */}
          <CornerAccent color={accent} corner="top-left" />
          <CornerAccent color={accent} corner="top-right" />

          {/* Dismiss button */}
          <button
            onClick={onDismiss}
            style={{
              position: 'absolute',
              top: 12,
              right: 16,
              background: 'none',
              border: 'none',
              color: '#4b5563',
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              padding: '2px 6px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.color = accent
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.color = '#4b5563'
            }}
          >
            [ESC]
          </button>

          {node && (
            <>
              {/* Label */}
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: accent,
                  textShadow: `0 0 12px ${accent}, 0 0 24px ${accent}88`,
                  marginBottom: 10,
                  paddingRight: 48,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {node.label}
              </div>

              {/* Region badge + meta row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 12,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    background: `${accent}22`,
                    border: `1px solid ${accent}66`,
                    color: accent,
                    fontSize: '9px',
                    letterSpacing: '0.18em',
                    padding: '2px 8px',
                    clipPath:
                      'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)',
                  }}
                >
                  {node.region.toUpperCase()}
                </span>
                {node.isAgentGenerated && (
                  <span
                    style={{
                      background: '#fbbf2411',
                      border: '1px solid #fbbf2444',
                      color: '#fbbf24',
                      fontSize: '9px',
                      letterSpacing: '0.12em',
                      padding: '2px 8px',
                      clipPath:
                        'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)',
                    }}
                  >
                    AGENT GENERATED
                  </span>
                )}
              </div>

              {/* Path */}
              <div
                style={{
                  fontSize: '10px',
                  color: '#4b5563',
                  letterSpacing: '0.04em',
                  marginBottom: 16,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={node.path}
              >
                {node.path}
              </div>

              {/* Stats row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12,
                }}
              >
                <StatBox label="WORDS" value={node.wordCount.toLocaleString()} accent={accent} />
                <StatBox label="LINKS" value={String(linkCount)} accent={accent} />
                <StatBox label="MODIFIED" value={timeAgo(node.modifiedAt)} accent={accent} />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: string
}) {
  return (
    <div
      style={{
        background: `${accent}08`,
        border: `1px solid ${accent}22`,
        padding: '8px 10px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '8px',
          color: '#4b5563',
          letterSpacing: '0.16em',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '14px',
          color: '#e5e7eb',
          letterSpacing: '0.06em',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function CornerAccent({
  color,
  corner,
}: {
  color: string
  corner: 'top-left' | 'top-right'
}) {
  const isLeft = corner === 'top-left'
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      style={{
        position: 'absolute',
        top: 0,
        left: isLeft ? 0 : undefined,
        right: isLeft ? undefined : 0,
        display: 'block',
      }}
    >
      {isLeft ? (
        <polyline
          points="0,12 0,0 12,0"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
        />
      ) : (
        <polyline
          points="12,12 12,0 0,0"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
        />
      )}
    </svg>
  )
}
