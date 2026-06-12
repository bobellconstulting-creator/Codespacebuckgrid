'use client'

// BuckGrid Pro — /demo
// Self-contained showcase: loads the hand-authored Ridgeline 150 sample parcel
// (lib/demo/sample-property.ts) and runs the deterministic placement engine
// client-side. No API keys, no GIS network calls — only free map tiles.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import MapContainer, { type MapContainerHandle } from './map/MapContainer'
import type { TonyAnnotation } from './hooks/useMapDrawing'
import { TOOLS } from './constants/tools'
import { DEMO_PROPERTY, DEMO_BOUNDARY_RING } from '../../../lib/demo/sample-property'
import { generatePlacements, candidateGeometry, type PlacementCandidate } from '../../../lib/placement/engine'

const NAV_TOOL = TOOLS[0] // 'nav' — non-drawing

const TYPE_LABEL: Record<string, string> = {
  food_plot: 'Food Plot',
  kill_plot: 'Kill Plot',
  bedding: 'Bedding',
  stand_site: 'Stand',
  staging_area: 'Staging',
  sanctuary: 'Sanctuary',
  access_route: 'Access',
  water: 'Water',
}

// drawAnnotations colors are keyed by ann.type — map engine types onto keys it knows
const ANN_TYPE: Record<string, string> = {
  food_plot: 'food_plot',
  kill_plot: 'food',
  bedding: 'bedding',
  stand_site: 'stand',
  staging_area: 'staging_area',
  sanctuary: 'sanctuary',
  access_route: 'access_trail',
  water: 'water',
}

function toAnnotation(cd: PlacementCandidate): TonyAnnotation {
  const name = TYPE_LABEL[cd.type] ?? cd.type
  return {
    type: ANN_TYPE[cd.type] ?? cd.type,
    label: `${name} — ${cd.compass.toUpperCase()}`,
    geojson: { type: 'Feature', properties: {}, geometry: candidateGeometry(cd) },
    // extra fields read by the popup renderer
    ...({ why: cd.factors.slice(0, 3).join(' · '), confidence: cd.score } as object),
  } as TonyAnnotation
}

export default function DemoPage() {
  const mapRef = useRef<MapContainerHandle>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'analyzing' | 'done'>('loading')
  const [calls, setCalls] = useState<PlacementCandidate[]>([])
  const [shown, setShown] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  // Wait for the map, then fly in and draw the boundary
  useEffect(() => {
    let tries = 0
    const t = setInterval(() => {
      const api = mapRef.current
      tries++
      if (api && api.getBoundsAndFeatures()) {
        clearInterval(t)
        api.flyTo(DEMO_PROPERTY.center.lat, DEMO_PROPERTY.center.lng, 14.5)
        api.addFeature(
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [DEMO_BOUNDARY_RING] },
          },
          'boundary',
          DEMO_PROPERTY.name
        )
        setPhase('ready')
      } else if (tries > 100) clearInterval(t)
    }, 150)
    return () => { clearInterval(t); timers.current.forEach(clearTimeout) }
  }, [])

  const runTony = useCallback(() => {
    if (phase === 'analyzing') return
    const result = generatePlacements({
      boundaryRing: DEMO_BOUNDARY_RING,
      spatial: DEMO_PROPERTY.spatial,
      season: DEMO_PROPERTY.season,
    })
    if (!result) return
    // Top calls: every stand + the best of each other type, max 8
    const byType = new Map<string, PlacementCandidate[]>()
    for (const c of result.candidates) {
      const arr = byType.get(c.type) ?? []
      arr.push(c)
      byType.set(c.type, arr)
    }
    const picks: PlacementCandidate[] = []
    for (const [, arr] of byType) {
      arr.sort((a, b) => b.score - a.score)
      picks.push(...arr.slice(0, arr[0]?.type === 'stand_site' ? 2 : 1))
    }
    picks.sort((a, b) => b.score - a.score)
    const top = picks.slice(0, 8)

    setCalls(top)
    setShown(0)
    setPhase('analyzing')

    // Stagger the pin drops so the reveal reads well on camera
    top.forEach((_, i) => {
      timers.current.push(
        setTimeout(() => {
          mapRef.current?.drawTonyAnnotations(top.slice(0, i + 1).map(toAnnotation))
          setShown(i + 1)
          if (i === top.length - 1) setPhase('done')
        }, 650 * (i + 1))
      )
    })
  }, [phase])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1E2122', display: 'flex', flexDirection: 'column', fontFamily: "'Barlow Condensed', sans-serif" }}>
      {/* Header */}
      <div style={{ height: 64, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', borderBottom: '1px solid #32362F', background: '#23262380' }}>
        <img src="/buckgrid-logo.png" alt="BuckGrid Pro" style={{ height: 40 }} />
        <div>
          <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 20, fontWeight: 700, color: '#D8D3C5', letterSpacing: '.06em', lineHeight: 1 }}>
            {DEMO_PROPERTY.name.toUpperCase()}
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#6B7A57', letterSpacing: '.18em', textTransform: 'uppercase' }}>
            {DEMO_PROPERTY.locationLabel} · {DEMO_PROPERTY.acresLabel} · {DEMO_PROPERTY.season}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: '.22em', color: '#9A9588', border: '1px solid #44483F', borderRadius: 4, padding: '5px 10px', textTransform: 'uppercase' }}>
          Demo · sample property
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer ref={mapRef} activeTool={NAV_TOOL} brushSize={30} />
          {phase === 'ready' && (
            <button
              onClick={runTony}
              style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#FF6B00', color: '#1E2122', border: 'none', borderRadius: 6, padding: '14px 28px', fontFamily: "'Teko', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: '.08em', cursor: 'pointer', boxShadow: '0 4px 24px #000a' }}
            >
              ASK TONY TO ANALYZE THIS PROPERTY
            </button>
          )}
        </div>

        {/* Tony's call sheet */}
        <div style={{ width: 320, borderLeft: '1px solid #32362F', background: '#232623', overflowY: 'auto', padding: 16 }}>
          <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 18, fontWeight: 700, color: '#6B7A57', letterSpacing: '.1em', marginBottom: 10 }}>
            TONY&apos;S GAME PLAN
          </div>
          {phase !== 'analyzing' && phase !== 'done' && (
            <div style={{ fontSize: 14, color: '#9A9588', lineHeight: 1.5 }}>
              This is a real run of BuckGrid&apos;s placement engine on a sample 150-acre Pike County, IL parcel —
              terrain, cover, and wind are analyzed in code, then every call is anchored to visible ground and
              guaranteed inside the boundary. Hit the button to watch it work.
            </div>
          )}
          {calls.slice(0, shown).map((c) => (
            <div key={c.id} style={{ borderLeft: '3px solid #6B7A57', background: '#1E2122', borderRadius: 4, padding: '8px 10px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: "'Teko', sans-serif", fontSize: 16, fontWeight: 700, color: '#D8D3C5', letterSpacing: '.05em' }}>
                  {(TYPE_LABEL[c.type] ?? c.type).toUpperCase()} · {c.compass.toUpperCase()}
                </span>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: c.score >= 75 ? '#4ade80' : '#facc15' }}>
                  {Math.round(c.score)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#9A9588', lineHeight: 1.45, marginTop: 2 }}>
                {c.factors.slice(0, 2).join(' · ')}
              </div>
            </div>
          ))}
          {phase === 'done' && (
            <div style={{ marginTop: 14, fontSize: 13, color: '#6B7A57', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '.08em' }}>
              EVERY PIN: TERRAIN-MATH BACKED, BOUNDARY-GUARANTEED.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
