'use client'

// "Tonight's sit" — fetches live wind for the property and ranks Tony's
// stands by scent risk against the bedding zones on the map. Pure geometry
// after one cached /api/wind call; re-rank is free.

import React, { useCallback, useState } from 'react'
import { bestWindows, rankStands, type CoverZone, type HuntWindow, type HourlyWind, type SitCall, type SitTarget, type WindInfo } from './windCall'

export type SitInputs = {
  stands: SitTarget[]
  cover: CoverZone[]
  center: { lat: number; lng: number }
}

type Props = {
  getInputs: () => SitInputs | null
  onWind?: (label: string | null) => void
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; wind: WindInfo; calls: SitCall[]; windows: HuntWindow[] }

const MONO = "'Share Tech Mono', monospace"
const DISPLAY = "'Teko', 'Oswald', sans-serif"

export default function TonightsSit({ getInputs, onWind }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  const run = useCallback(async () => {
    const inputs = getInputs()
    if (!inputs || inputs.stands.length === 0) {
      setState({ kind: 'error', message: 'No stands on the map yet — hit Get Advice first.' })
      return
    }
    setState({ kind: 'loading' })
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 10_000)
      let res: Response
      try {
        res = await fetch(
          `/api/wind?lat=${inputs.center.lat.toFixed(4)}&lng=${inputs.center.lng.toFixed(4)}&hours=72`,
          { signal: ctrl.signal }
        )
      } finally {
        clearTimeout(timer)
      }
      if (!res.ok) throw new Error('bad status')
      const payload = (await res.json()) as WindInfo & { hourly?: HourlyWind[] }
      const wind: WindInfo = { speedMph: payload.speedMph, directionDeg: payload.directionDeg, compass: payload.compass }
      const calls = rankStands(inputs.stands, inputs.cover, wind)
      const windows = bestWindows(inputs.stands, inputs.cover, payload.hourly ?? [])
      setState({ kind: 'ready', wind, calls, windows })
      onWind?.(`${wind.compass} ${wind.speedMph} MPH`)
    } catch {
      setState({ kind: 'error', message: "Couldn't read the wind. Try again." })
      onWind?.(null)
    }
  }, [getInputs, onWind])

  const hero = state.kind === 'ready' ? state.calls[0] : null

  return (
    <div style={{ padding: '8px 12px 0', background: '#3A4042' }}>
      <button
        onClick={run}
        disabled={state.kind === 'loading'}
        style={{
          width: '100%',
          minHeight: '36px',
          background: 'rgba(107,122,87,0.12)',
          border: '1px solid rgba(107,122,87,0.45)',
          borderRadius: '3px',
          color: '#6B7A57',
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: '13px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          cursor: state.kind === 'loading' ? 'wait' : 'pointer',
          opacity: state.kind === 'loading' ? 0.6 : 1,
        }}
      >
        {state.kind === 'loading'
          ? '◌ Reading wind…'
          : state.kind === 'ready'
            ? `⟳ Wind: ${state.wind.compass} ${state.wind.speedMph} mph — re-check`
            : "≋ Tonight's Sit — wind call"}
      </button>

      {state.kind === 'error' && (
        <div style={{ marginTop: '5px', fontFamily: MONO, fontSize: '9px', letterSpacing: '0.06em', color: '#ef4444' }}>
          {state.message}
        </div>
      )}

      {state.kind === 'ready' && hero && (
        <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div
            style={{
              background: '#1E2122',
              borderLeft: `3px solid ${hero.score >= 60 ? '#6B7A57' : '#ef4444'}`,
              border: '1px solid rgba(107,122,87,0.3)',
              padding: '7px 10px',
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.12em', color: '#6B7A57' }}>
              TONIGHT'S SIT
            </div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: '15px', color: '#D8D3C5', letterSpacing: '0.04em' }}>
              {hero.name}
            </div>
            <div style={{ fontSize: '11px', color: '#9A9588', lineHeight: 1.4 }}>{hero.reason}</div>
          </div>
          {state.windows.length > 0 && (
            <>
              <div style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.12em', color: '#6B7A57', marginTop: '3px' }}>
                NEXT 72 HRS — BEST WINDOWS
              </div>
              {state.windows.map((w, i) => (
                <div
                  key={`${w.dayLabel}-${w.period}-${i}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#1E2122', border: '1px solid rgba(107,122,87,0.18)', borderLeft: `2px solid ${w.score >= 60 ? '#6B7A57' : '#facc15'}`, padding: '4px 8px' }}
                >
                  <span style={{ fontFamily: MONO, fontSize: '9px', color: '#D8D3C5', minWidth: '78px' }}>
                    {w.dayLabel} {w.period}
                  </span>
                  <span style={{ fontSize: '11px', color: '#9A9588', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.standName}</span>
                  <span style={{ fontFamily: MONO, fontSize: '9px', color: '#6B7A57' }}>{w.windLabel}</span>
                  <span style={{ fontFamily: MONO, fontSize: '9px', color: '#8A8578', minWidth: '22px', textAlign: 'right' }}>{w.score}</span>
                </div>
              ))}
              <div style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.12em', color: '#6B7A57', marginTop: '3px' }}>
                RIGHT NOW
              </div>
            </>
          )}
          {state.calls.slice(0, 4).map((c, i) => (
            <div
              key={`${c.name}-${i}`}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#1E2122', border: '1px solid rgba(107,122,87,0.18)', padding: '4px 8px' }}
            >
              <span style={{ fontFamily: MONO, fontSize: '9px', color: '#6B7A57' }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ fontSize: '11px', color: '#D8D3C5', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
              <span style={{ width: '44px', height: '3px', background: 'rgba(107,122,87,0.15)', borderRadius: '1px', overflow: 'hidden', flexShrink: 0 }}>
                <span style={{ display: 'block', height: '100%', width: `${c.score}%`, background: c.score >= 60 ? '#4ade80' : c.score >= 40 ? '#facc15' : '#ef4444' }} />
              </span>
              <span style={{ fontFamily: MONO, fontSize: '9px', color: '#8A8578', minWidth: '26px', textAlign: 'right' }}>{c.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
