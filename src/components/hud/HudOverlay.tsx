'use client'

import { useEffect, useRef, useState } from 'react'
import { ActivityFeed } from './ActivityFeed'
import type { VaultGraph } from './useVaultGraph'

// Animated counter that slowly drifts ±delta around a base value
function LiveMetric({ label, base, delta, suffix = '' }: { label: string; base: number; delta: number; suffix?: string }) {
  const [value, setValue] = useState(base)

  useEffect(() => {
    setValue(base)  // reset when base changes (real data arrived)
  }, [base])

  useEffect(() => {
    const interval = setInterval(() => {
      setValue((prev) => {
        const drift = (Math.random() - 0.5) * delta * 2
        return Math.round(Math.max(base - delta * 3, Math.min(base + delta * 3, prev + drift)))
      })
    }, 800 + Math.random() * 400)
    return () => clearInterval(interval)
  }, [base, delta])

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: 'rgba(184,244,255,0.5)', letterSpacing: '0.1em' }}>
        {label}
      </span>
      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: '#00d4ff', textShadow: '0 0 8px #00d4ff', fontWeight: 600 }}>
        {value.toLocaleString()}{suffix}
      </span>
    </div>
  )
}

// Radar/compass ring
function RadarRing() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const size = canvas.width
    const cx = size / 2
    const cy = size / 2
    const r = size / 2 - 4

    let angle = 0

    const draw = () => {
      ctx.clearRect(0, 0, size, size)

      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0,212,255,0.25)'
      ctx.lineWidth = 1
      ctx.stroke()

      ;[0.65, 0.38].forEach((scale) => {
        ctx.beginPath()
        ctx.arc(cx, cy, r * scale, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(0,212,255,0.15)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      })

      ctx.strokeStyle = 'rgba(0,212,255,0.12)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(cx - r, cy)
      ctx.lineTo(cx + r, cy)
      ctx.moveTo(cx, cy - r)
      ctx.lineTo(cx, cy + r)
      ctx.stroke()

      for (let i = 0; i < 36; i++) {
        const a = (Math.PI * 2 * i) / 36
        const len = i % 9 === 0 ? 8 : 4
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
        ctx.lineTo(cx + Math.cos(a) * (r - len), cy + Math.sin(a) * (r - len))
        ctx.strokeStyle = 'rgba(0,212,255,0.4)'
        ctx.lineWidth = i % 9 === 0 ? 1 : 0.5
        ctx.stroke()
      }

      const sweepArc = Math.PI / 3
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r - 2, angle - sweepArc, angle)
      ctx.closePath()
      const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      sweepGrad.addColorStop(0, 'rgba(0,212,255,0)')
      sweepGrad.addColorStop(1, 'rgba(0,212,255,0.12)')
      ctx.fillStyle = sweepGrad
      ctx.fill()
      ctx.restore()

      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r)
      ctx.strokeStyle = 'rgba(0,212,255,0.8)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      const blipSeeds = [0.3, 1.1, 2.4, 3.8, 5.2]
      blipSeeds.forEach((seed) => {
        const ba = (seed + angle * 0.5) % (Math.PI * 2)
        const br = r * (0.3 + (seed % 0.7))
        const bx = cx + Math.cos(ba) * br
        const by = cy + Math.sin(ba) * br
        ctx.beginPath()
        ctx.arc(bx, by, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = '#00d4ff'
        ctx.shadowColor = '#00d4ff'
        ctx.shadowBlur = 4
        ctx.fill()
        ctx.shadowBlur = 0
      })

      angle += 0.018
      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={130}
      height={130}
      style={{ display: 'block' }}
    />
  )
}

// Scan line component
function ScanLine() {
  const lineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let startTime: number | null = null
    const PERIOD = 8000
    const DURATION = 1200

    const animate = (time: number) => {
      if (startTime === null) startTime = time
      const elapsed = (time - startTime) % PERIOD
      const line = lineRef.current
      if (!line) return

      if (elapsed < DURATION) {
        const progress = elapsed / DURATION
        const y = progress * 100
        line.style.top = `${y}vh`
        line.style.opacity = String(0.3 - Math.abs(progress - 0.5) * 0.6)
      } else {
        line.style.opacity = '0'
      }
      requestAnimationFrame(animate)
    }

    const raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      ref={lineRef}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '100vw',
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.6), rgba(0,212,255,0.9), rgba(0,212,255,0.6), transparent)',
        pointerEvents: 'none',
        zIndex: 50,
        opacity: 0,
        boxShadow: '0 0 8px rgba(0,212,255,0.4)',
      }}
    />
  )
}

// Panel component with clipped corner borders
function HudPanel({
  children,
  style,
  cornerSize = 10,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
  cornerSize?: number
}) {
  const clipPath = `polygon(
    ${cornerSize}px 0%, calc(100% - ${cornerSize}px) 0%,
    100% ${cornerSize}px, 100% calc(100% - ${cornerSize}px),
    calc(100% - ${cornerSize}px) 100%, ${cornerSize}px 100%,
    0% calc(100% - ${cornerSize}px), 0% ${cornerSize}px
  )`

  return (
    <div
      style={{
        background: 'rgba(0,8,16,0.82)',
        border: '1px solid rgba(0,212,255,0.22)',
        clipPath,
        backdropFilter: 'blur(4px)',
        padding: '10px 12px',
        position: 'relative',
        ...style,
      }}
    >
      <div style={{ position: 'absolute', top: 2, left: 2, width: 8, height: 8, borderTop: '1px solid rgba(0,212,255,0.7)', borderLeft: '1px solid rgba(0,212,255,0.7)' }} />
      <div style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderTop: '1px solid rgba(0,212,255,0.7)', borderRight: '1px solid rgba(0,212,255,0.7)' }} />
      <div style={{ position: 'absolute', bottom: 2, left: 2, width: 8, height: 8, borderBottom: '1px solid rgba(0,212,255,0.7)', borderLeft: '1px solid rgba(0,212,255,0.7)' }} />
      <div style={{ position: 'absolute', bottom: 2, right: 2, width: 8, height: 8, borderBottom: '1px solid rgba(0,212,255,0.7)', borderRight: '1px solid rgba(0,212,255,0.7)' }} />
      {children}
    </div>
  )
}

function StatusDot({ status }: { status: 'online' | 'warn' | 'offline' }) {
  const colors = { online: '#00d4ff', warn: '#f97316', offline: '#ef4444' }
  return (
    <div
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: colors[status],
        boxShadow: `0 0 8px ${colors[status]}`,
        animation: 'hud-blink 2s infinite',
        display: 'inline-block',
      }}
    />
  )
}

// ── Fallback mock values when vault data isn't loaded yet ─────────────────────
const MOCK_MEMORY_NODES   = 2847
const MOCK_SYNAPTIC_LOAD  = 73
const MOCK_CONTEXT_TOKENS = 12400

interface HudOverlayProps {
  graph?: VaultGraph | null
}

export function HudOverlay({ graph }: HudOverlayProps = {}) {
  // Derive real metric bases from graph, fall back to mock values
  const memoryNodesBase   = graph ? graph.totalNodes                                                      : MOCK_MEMORY_NODES
  const synapticLoadBase  = graph ? Math.min(99, Math.round((graph.totalEdges / Math.max(graph.totalNodes * 3, 1)) * 100)) : MOCK_SYNAPTIC_LOAD
  const contextTokensBase = graph ? graph.totalWords                                                       : MOCK_CONTEXT_TOKENS

  return (
    <>
      <ScanLine />

      {/* CRT Vignette */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.75) 100%)',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />

      {/* Star field background texture */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: `radial-gradient(1px 1px at 10% 15%, rgba(255,255,255,0.5) 0%, transparent 100%),
                       radial-gradient(1px 1px at 25% 42%, rgba(255,255,255,0.3) 0%, transparent 100%),
                       radial-gradient(1px 1px at 38% 8%, rgba(255,255,255,0.4) 0%, transparent 100%),
                       radial-gradient(1px 1px at 52% 78%, rgba(255,255,255,0.3) 0%, transparent 100%),
                       radial-gradient(1px 1px at 67% 22%, rgba(255,255,255,0.5) 0%, transparent 100%),
                       radial-gradient(1px 1px at 78% 55%, rgba(255,255,255,0.3) 0%, transparent 100%),
                       radial-gradient(1px 1px at 88% 38%, rgba(255,255,255,0.4) 0%, transparent 100%),
                       radial-gradient(1px 1px at 92% 72%, rgba(255,255,255,0.3) 0%, transparent 100%)`,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* TOP LEFT: Neuradex logo + status */}
      <div style={{ position: 'fixed', top: 20, left: 20, zIndex: 20, pointerEvents: 'none' }}>
        <HudPanel style={{ minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <polygon
                points="14,2 25,8 25,20 14,26 3,20 3,8"
                stroke="rgba(0,212,255,0.8)"
                strokeWidth="1.5"
                fill="rgba(0,212,255,0.08)"
              />
              <polygon
                points="14,6 21,10 21,18 14,22 7,18 7,10"
                stroke="rgba(0,212,255,0.35)"
                strokeWidth="0.8"
                fill="none"
              />
              <circle cx="14" cy="14" r="3" fill="#00d4ff" opacity="0.9" />
            </svg>
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '13px', color: '#00d4ff', letterSpacing: '0.2em', textShadow: '0 0 10px #00d4ff', lineHeight: 1 }}>
                NEURADEX
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: 'rgba(0,212,255,0.5)', letterSpacing: '0.18em' }}>
                AI COMMAND SYSTEM
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusDot status="online" />
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#00d4ff', letterSpacing: '0.12em' }}>
              SYSTEM ONLINE
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <StatusDot status="online" />
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: 'rgba(0,212,255,0.6)', letterSpacing: '0.12em' }}>
              ALL AGENTS NOMINAL
            </span>
          </div>
        </HudPanel>
      </div>

      {/* TOP RIGHT: Live metrics */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 20, pointerEvents: 'none' }}>
        <HudPanel style={{ minWidth: 210 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: 'rgba(0,212,255,0.5)', letterSpacing: '0.15em', marginBottom: 8 }}>
            NEURAL METRICS
          </div>
          <LiveMetric label="SYNAPTIC LOAD"  base={synapticLoadBase}  delta={4}   suffix="%" />
          <LiveMetric label="ACTIVE AGENTS"  base={4}                 delta={1}              />
          <LiveMetric label="MEMORY NODES"   base={memoryNodesBase}   delta={12}             />
          <LiveMetric label="INFERENCE / S"  base={248}               delta={18}             />
          <LiveMetric label="CONTEXT TOKENS" base={contextTokensBase} delta={300}            />
          <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(0,212,255,0.12)' }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: 'rgba(0,212,255,0.35)', letterSpacing: '0.1em' }}>
              NEURADEX v2.4.1 // BUILD 20260413
            </div>
          </div>
        </HudPanel>
      </div>

      {/* BOTTOM LEFT: Activity feed */}
      <div style={{ position: 'fixed', bottom: 20, left: 20, zIndex: 20, pointerEvents: 'none', width: 420 }}>
        <HudPanel style={{ height: 160 }}>
          <ActivityFeed />
        </HudPanel>
      </div>

      {/* BOTTOM RIGHT: Radar */}
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 20, pointerEvents: 'none' }}>
        <HudPanel>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: 'rgba(0,212,255,0.5)', letterSpacing: '0.15em', marginBottom: 6 }}>
            AGENT COMPASS
          </div>
          <RadarRing />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: 'rgba(0,212,255,0.3)', letterSpacing: '0.1em', marginTop: 4, textAlign: 'center' }}>
            NEURADEX AI FLEET
          </div>
        </HudPanel>
      </div>

      <style>{`
        @keyframes hud-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes hud-fadein {
          from { opacity: 0; transform: translateX(-4px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  )
}
