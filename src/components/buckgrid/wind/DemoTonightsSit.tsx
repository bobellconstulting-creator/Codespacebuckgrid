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
const MOSS = '#6B7A57'

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
    <div style={{ padding: '10px 12px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, color: MOSS, letterSpacing: '.1em' }}>≋ TONIGHT&apos;S SIT</span>
        {state.kind === 'ready' && (
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.08em', color: '#8A8578' }}>
            {state.live ? 'LIVE' : 'FORECAST'} · {state.wind.compass} {state.wind.speedMph}MPH
          </span>
        )}
      </div>

      {state.kind === 'loading' && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: '#8A8578', letterSpacing: '.08em', padding: '4px 0 8px' }}>◌ Reading the wind…</div>
      )}

      {state.kind === 'ready' && hero && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ background: '#1E2122', borderLeft: `3px solid ${hero.score >= 60 ? MOSS : '#ef4444'}`, border: '1px solid rgba(107,122,87,0.3)', padding: '8px 10px' }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.12em', color: MOSS }}>BEST SIT TONIGHT</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, color: '#D8D3C5', letterSpacing: '.04em' }}>{hero.name}</div>
            <div style={{ fontFamily: BODY, fontSize: 12.5, color: '#A7A293', lineHeight: 1.4 }}>{hero.reason}</div>
          </div>

          {state.windows.length > 0 && (
            <>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.12em', color: MOSS, marginTop: 3 }}>NEXT 72 HRS — BEST WINDOWS</div>
              {state.windows.map((w, i) => (
                <div key={`${w.dayLabel}-${w.period}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1E2122', border: '1px solid rgba(107,122,87,0.18)', borderLeft: `2px solid ${w.score >= 60 ? MOSS : '#e3c34d'}`, padding: '4px 8px' }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: '#D8D3C5', minWidth: 74 }}>{w.dayLabel} {w.period}</span>
                  <span style={{ fontFamily: BODY, fontSize: 12, color: '#9A9588', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.standName}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: MOSS }}>{w.windLabel}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: '#8A8578', minWidth: 20, textAlign: 'right' }}>{w.score}</span>
                </div>
              ))}
            </>
          )}

          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.12em', color: MOSS, marginTop: 3 }}>RIGHT NOW — STANDS BY SCENT RISK</div>
          {state.calls.map((c, i) => (
            <div key={`${c.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1E2122', border: '1px solid rgba(107,122,87,0.18)', padding: '4px 8px' }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: MOSS }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ fontFamily: BODY, fontSize: 12, color: '#D8D3C5', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
              <span style={{ width: 42, height: 3, background: 'rgba(107,122,87,0.15)', borderRadius: 1, overflow: 'hidden', flexShrink: 0 }}>
                <span style={{ display: 'block', height: '100%', width: `${c.score}%`, background: c.score >= 60 ? '#7Fd88f' : c.score >= 40 ? '#e3c34d' : '#ef4444' }} />
              </span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#8A8578', minWidth: 24, textAlign: 'right' }}>{c.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
