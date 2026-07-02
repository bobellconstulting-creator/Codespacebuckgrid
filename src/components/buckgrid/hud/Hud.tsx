'use client'

// src/components/buckgrid/hud/Hud.tsx
// Reusable BuckGrid Pro HUD chrome — corner frame, wordmark header, status bar,
// acre pill, game-plan label, zone callout cards, "reading" pill. Pixel-matched
// to the demo render engine (buckgrid-pro-demo/pipeline/render.py). Pure inline
// styles + tokens; shared by /buckgrid and the landing page.

import React from 'react'
import { HUD, FONT, ZONE_HUD, rgba } from './tokens'

// ── Corner-bracket frame (the 4 ANTLER L's) ─────────────────────────────────
export function CornerFrame({ inset = 18, len = 34, weight = 2, color = HUD.antler, opacity = 0.55 }:
  { inset?: number; len?: number; weight?: number; color?: string; opacity?: number }) {
  const c = rgba(color, opacity)
  const corner = (pos: React.CSSProperties, h: React.CSSProperties, v: React.CSSProperties): React.CSSProperties[] => [
    { position: 'absolute', background: c, ...pos, ...h },
    { position: 'absolute', background: c, ...pos, ...v },
  ]
  const items: React.CSSProperties[] = [
    // top-left
    ...corner({ top: inset, left: inset }, { width: len, height: weight }, { width: weight, height: len }),
    // top-right
    ...corner({ top: inset, right: inset }, { width: len, height: weight, left: 'auto' }, { width: weight, height: len, left: 'auto' }),
    // bottom-left
    ...corner({ bottom: inset, left: inset }, { width: len, height: weight }, { width: weight, height: len, top: 'auto', bottom: 0 }),
    // bottom-right
    ...corner({ bottom: inset, right: inset }, { width: len, height: weight }, { width: weight, height: len, top: 'auto', bottom: 0, left: 'auto' }),
  ]
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30 }}>
      {items.map((s, i) => <span key={i} style={s} />)}
    </div>
  )
}

// ── Wordmark: BUCKGRID + orange PRO chip ────────────────────────────────────
export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.32 }}>
      <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: size, letterSpacing: '.02em', color: HUD.bone, lineHeight: 1 }}>
        BUCKGRID
      </span>
      <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: size * 0.72, letterSpacing: '.08em', color: HUD.bone, background: HUD.blaze, borderRadius: size * 0.2, padding: `${size * 0.08}px ${size * 0.26}px`, lineHeight: 1 }}>
        PRO
      </span>
    </div>
  )
}

// ── Season-phase chip (RUT // PEAK etc.) ────────────────────────────────────
export function PhaseChip({ text, size = 12 }: { text: string; size?: number }) {
  return (
    <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: size, letterSpacing: '.18em', color: HUD.ember, border: `1.5px solid ${rgba(HUD.ember, 0.9)}`, borderRadius: 6, padding: `${size * 0.45}px ${size * 0.9}px`, whiteSpace: 'nowrap' }}>
      {text.toUpperCase()}
    </span>
  )
}

// ── HUD header: wordmark + phase chip + mono status bar with hairline ────────
export type StatusField = { label: string }
export function HudHeader({ fields, phase = 'RUT // PEAK', size = 30, compact = false }:
  { fields: string[]; phase?: string; size?: number; compact?: boolean }) {
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Wordmark size={size} />
        <PhaseChip text={phase} size={compact ? 10 : 12} />
      </div>
      <div style={{
        marginTop: size * 0.36, paddingBottom: size * 0.34, borderBottom: `1px solid ${rgba(HUD.field, 0.7)}`,
        fontFamily: FONT.mono, fontWeight: 500, fontSize: compact ? 10 : 12, letterSpacing: '.12em',
        color: HUD.sage, display: 'flex', flexWrap: 'wrap', gap: '2px 12px', textTransform: 'uppercase',
      }}>
        {fields.filter(Boolean).map((f, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: rgba(HUD.field, 0.9) }}>·</span>}
            <span style={{ whiteSpace: 'nowrap' }}>{f}</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

// ── Acre pill (dark fill, ember outline) ────────────────────────────────────
export function AcrePill({ acres, size = 22 }: { acres: number | string; size?: number }) {
  const txt = typeof acres === 'number' ? `${acres.toFixed(1)} AC` : acres
  return (
    <span style={{ display: 'inline-block', fontFamily: FONT.mono, fontWeight: 700, fontSize: size, letterSpacing: '.06em', color: HUD.bone, background: rgba(HUD.panel, 0.82), border: `2px solid ${rgba(HUD.ember, 0.92)}`, borderRadius: 8, padding: `${size * 0.28}px ${size * 0.7}px`, lineHeight: 1 }}>
      {txt}
    </span>
  )
}

// ── "TONY'S GAME PLAN / N CALLS PLACED" label ───────────────────────────────
export function GamePlanLabel({ count, title = "TONY'S GAME PLAN" }: { count?: number; title?: string }) {
  return (
    <div>
      <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 22, letterSpacing: '.04em', color: HUD.bone, lineHeight: 1 }}>{title}</div>
      {typeof count === 'number' && (
        <div style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 12, letterSpacing: '.2em', color: HUD.ember, marginTop: 4 }}>
          {count} CALL{count === 1 ? '' : 'S'} PLACED
        </div>
      )}
    </div>
  )
}

// ── Zone callout card (dark glass, colored left bar) — the SANCTUARY/BEDDING card
export function ZoneCard({ type, title, sub, score }: { type: string; title?: string; sub?: string; score?: number }) {
  const z = ZONE_HUD[type] ?? { color: HUD.ember, label: type.replace(/_/g, ' ').toUpperCase() }
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 2, background: HUD.panelGlass, border: `1.4px solid ${rgba(z.color, 0.85)}`, borderRadius: 10, padding: '9px 12px 9px 14px', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: z.color }} />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 13, letterSpacing: '.1em', color: HUD.bone }}>{title ?? z.label}</span>
        {typeof score === 'number' && <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 11, color: score >= 75 ? HUD.success : HUD.ember }}>{Math.round(score)}</span>}
      </div>
      {sub && <span style={{ fontFamily: FONT.mono, fontWeight: 500, fontSize: 11, letterSpacing: '.04em', color: HUD.sage, lineHeight: 1.4 }}>{sub}</span>}
    </div>
  )
}

// ── "◌ TONY IS READING …" pill (animated dots via CSS) ──────────────────────
export function ReadingPill({ name }: { name: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FONT.mono, fontWeight: 700, fontSize: 13, letterSpacing: '.14em', color: HUD.ember, background: rgba(HUD.panel, 0.85), border: `2px solid ${rgba(HUD.ember, 0.92)}`, borderRadius: 8, padding: '8px 16px', textTransform: 'uppercase' }}>
      <span className="bg-hud-spin">◌</span>
      TONY IS READING {name}<span className="bg-hud-dots" />
    </span>
  )
}
