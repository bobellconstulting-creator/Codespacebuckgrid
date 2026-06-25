'use client'

// Demo edition of "Tonight's Sit". Same pure-geometry stand ranking as the live
// card (windCall.ts), but bulletproof for the showcase: it tries the live
// /api/wind once with a short timeout, and on any failure falls back to a
// deterministic rut cold-front forecast (lib/demo/demo-wind.ts) so the panel
// NEVER spins or errors on camera. Runs automatically when stands appear.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { bestWindows, rankStands, type CoverZone, type HuntWindow, type HourlyWind, type SitCall, type SitTarget, type WindInfo } from './windCall'
import { demoWindForecast } from '../../../../lib/demo/demo-wind'

type Props = {
  stands: SitTarget[]
  cover: CoverZone[]
  center: { lat: number; lng: number }
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; wind: WindInfo; calls: SitCall[]; windows: HuntWindow[]; live: boolean }

const MONO = "'Share Tech Mono', monospace"
const DISPLAY = "'Teko', 'Oswald', sans-serif"
const BODY = "'Barlow Condensed','Inter',sans-serif"
const MOSS = '#4E6B57'
const GOLD = '#C9A227'
const GOLD_HI = '#E0B43A'
const BONE = '#E8E4D8'
const BONE_DIM = '#A8A498'
const GLASS = 'rgba(10,20,14,0.55)'
const HAIRLINE = 'rgba(255,255,255,0.08)'
const INNER_HI = 'inset 0 1px 0 rgba(255,255,255,0.06)'
const ROW: React.CSSProperties = {
  background: GLASS,
  border: `1px solid ${HAIRLINE}`,
  borderRadius: 9,
  boxShadow: INNER_HI,
}

export default function DemoTonightsSit({ stands, cover, center }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const ranOnce = useRef(false)

  const run = useCallback(async () => {
    if (stands.length === 0) return
    setState({ kind: 'loading' })
    let payload: WindInfo & { hourly?: HourlyWind[] } | null = null
    let live = false
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 2500)
      const res = await fetch(`/api/wind?lat=${center.lat.toFixed(4)}&lng=${center.lng.toFixed(4)}&hours=72`, { signal: ctrl.signal })
      clearTimeout(timer)
      if (res.ok) {
        payload = await res.json()
        if (typeof payload?.directionDeg === 'number') live = true
      }
    } catch {
      /* fall through to deterministic forecast */
    }
    if (!live || !payload) payload = demoWindForecast()
    const wind: WindInfo = { speedMph: payload.speedMph, directionDeg: payload.directionDeg, compass: payload.compass }
    const calls = rankStands(stands, cover, wind)
    const windows = bestWindows(stands, cover, payload.hourly ?? [])
    setState({ kind: 'ready', wind, calls, windows, live })
  }, [stands, cover, center])

  // Auto-run the first time stands are available.
  useEffect(() => {
    if (stands.length > 0 && !ranOnce.current) {
      ranOnce.current = true
      run()
    }
  }, [stands, run])

  const hero = state.kind === 'ready' ? state.calls[0] : null

  return (
    <div style={{ padding: '12px 14px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 18, color: BONE, letterSpacing: '.12em' }}>≋ TONIGHT&apos;S SIT</span>
        {state.kind === 'ready' && (
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.12em', color: GOLD }}>
            {state.live ? 'LIVE' : 'FORECAST'} · {state.wind.compass} {state.wind.speedMph}MPH
          </span>
        )}
      </div>

      {state.kind === 'loading' && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: BONE_DIM, letterSpacing: '.1em', padding: '4px 0 8px' }}><span className="bg-spinner">◌</span> Reading the wind…</div>
      )}

      {state.kind === 'ready' && hero && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ ...ROW, borderLeft: `2px solid ${hero.score >= 60 ? GOLD : '#ef4444'}`, padding: '10px 12px' }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.16em', color: GOLD }}>BEST SIT TONIGHT</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 18, color: BONE, letterSpacing: '.06em' }}>{hero.name}</div>
            <div style={{ fontFamily: BODY, fontSize: 12.5, color: BONE_DIM, lineHeight: 1.45 }}>{hero.reason}</div>
          </div>

          {state.windows.length > 0 && (
            <>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.16em', color: MOSS, marginTop: 4 }}>NEXT 72 HRS — BEST WINDOWS</div>
              {state.windows.map((w, i) => (
                <div key={`${w.dayLabel}-${w.period}-${i}`} style={{ ...ROW, display: 'flex', alignItems: 'center', gap: 7, borderLeft: `2px solid ${w.score >= 60 ? MOSS : GOLD}`, padding: '6px 9px' }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BONE, minWidth: 74 }}>{w.dayLabel} {w.period}</span>
                  <span style={{ fontFamily: BODY, fontSize: 12, color: BONE_DIM, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.standName}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: MOSS }}>{w.windLabel}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BONE_DIM, minWidth: 20, textAlign: 'right' }}>{w.score}</span>
                </div>
              ))}
            </>
          )}

          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.16em', color: MOSS, marginTop: 4 }}>RIGHT NOW — STANDS BY SCENT RISK</div>
          {state.calls.map((c, i) => (
            <div key={`${c.name}-${i}`} style={{ ...ROW, display: 'flex', alignItems: 'center', gap: 7, padding: '6px 9px' }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: GOLD }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ fontFamily: BODY, fontSize: 12, color: BONE, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
              <span style={{ width: 44, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                <span style={{ display: 'block', height: '100%', width: `${c.score}%`, background: c.score >= 60 ? '#7Fd88f' : c.score >= 40 ? GOLD_HI : '#ef4444', borderRadius: 3 }} />
              </span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BONE_DIM, minWidth: 24, textAlign: 'right' }}>{c.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
