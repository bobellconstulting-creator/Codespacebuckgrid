'use client'

// BuckGrid Pro — /demo
// A reliable, on-rails showcase of the deterministic placement engine on real
// Iowa whitetail ground. Pick a hero property → Tony reads the parcel and draws
// a full game plan (sanctuary, bedding, food, stands, access) with the evidence
// behind every call → "Tonight's Sit" ranks the stands on tonight's wind → a
// branded report exports for the group chat. No API keys, no live LLM in the
// draw path: cover is real Esri-imagery canopy, terrain is real 3DEP elevation,
// and the engine is pure geometry — so the magic moment lands every time.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapContainer, { type MapContainerHandle } from './map/MapContainer'
import type { TonyAnnotation } from './hooks/useMapDrawing'
import { TOOLS } from './constants/tools'
import { HERO_PROPERTIES, type HeroProperty } from '../../../lib/demo/hero-properties'
import { generatePlacements, candidateGeometry, type PlacementCandidate } from '../../../lib/placement/engine'
import { degreesToCompass8 } from '../../../lib/placement/geo'
import DemoTonightsSit from './wind/DemoTonightsSit'
import ShareReportButton from './report/ShareReportButton'
import type { ReportZone } from './report/reportRenderer'

const NAV_TOOL = TOOLS[0] // 'nav' — non-drawing

// Brand palette (task spec)
const INK = '#1E2122'
const MOSS = '#6B7A57'
const BONE = '#D8D3C5'
const CARD = '#131710'
const DISPLAY = "'Teko','Oswald',sans-serif"
const MONO = "'Share Tech Mono',monospace"
const BODY = "'Barlow Condensed','Inter',sans-serif"

const TYPE_LABEL: Record<string, string> = {
  sanctuary: 'Sanctuary', bedding: 'Bedding', food_plot: 'Food Plot', kill_plot: 'Kill Plot',
  stand_site: 'Stand', staging_area: 'Staging', access_route: 'Access', water: 'Water',
}
// map engine type → the key drawAnnotations / report color tables understand
const ANN_TYPE: Record<string, string> = {
  food_plot: 'food_plot', kill_plot: 'food', bedding: 'bedding', stand_site: 'stand',
  staging_area: 'staging_area', sanctuary: 'sanctuary', access_route: 'access_trail', water: 'water',
}
const DOT: Record<string, string> = {
  sanctuary: '#5F7A52', bedding: '#9B7A2A', food_plot: '#32CD32', kill_plot: '#7B9E5A',
  stand_site: '#ef4444', staging_area: '#6B7A4F', access_route: '#D4AC4A', water: '#3B82F6',
}
// reveal order = how a consultant walks the property: protect → where they live →
// what they eat → where you kill → how you get in.
const REVEAL_ORDER = ['sanctuary', 'bedding', 'water', 'food_plot', 'kill_plot', 'staging_area', 'stand_site', 'access_route']

// Tony's read per property (generated locally with qwen2.5:32b, lightly trimmed)
const TONY_READ: Record<string, string> = {
  'cedar-hollow':
    "That timbered creek bottom is the whole farm — a 52-acre sanctuary core they'll never leave in daylight. Hang downwind of the bedding on the funnels where the timber pinches to crop, and slip in from the south road without ever bumping a bed.",
  timberedge:
    "Classic rut ground: a big timber block jammed against standing crops with a pond on the seam. Beds sit deep in the block; the kill is on the edge funnels downwind of them. Come in from the west lane so your wind and your boots stay off the bedding.",
}

// In the demo, open-ground cover is classified from real Esri satellite-imagery
// canopy (the live app also has OSM/NLCD); say so honestly in the reasoning.
function cleanFactors(factors: string[]): string[] {
  return factors.map(f => f.replace('verified open ground (OSM/NLCD)', 'open ground (satellite-canopy verified)'))
}

function toAnnotation(cd: PlacementCandidate): TonyAnnotation {
  const name = TYPE_LABEL[cd.type] ?? cd.type
  return {
    type: ANN_TYPE[cd.type] ?? cd.type,
    label: `${name} · ${cd.compass.toUpperCase()}`,
    geojson: { type: 'Feature', properties: {}, geometry: candidateGeometry(cd) },
    ...({ why: cleanFactors(cd.factors).join(' · '), confidence: cd.score } as object),
  } as TonyAnnotation
}

/** Curate the engine output into a clean, readable plan for the showcase. */
function curate(all: PlacementCandidate[]): PlacementCandidate[] {
  const byType = new Map<string, PlacementCandidate[]>()
  for (const c of all) {
    const arr = byType.get(c.type) ?? []
    arr.push(c)
    byType.set(c.type, arr)
  }
  const cap: Record<string, number> = {
    sanctuary: 1, bedding: 2, food_plot: 2, kill_plot: 1, water: 1, staging_area: 1, stand_site: 3, access_route: 1,
  }
  const picks: PlacementCandidate[] = []
  for (const t of REVEAL_ORDER) {
    const arr = (byType.get(t) ?? []).sort((a, b) => b.score - a.score)
    picks.push(...arr.slice(0, cap[t] ?? 1))
  }
  return picks
}

export default function DemoPage() {
  const mapRef = useRef<MapContainerHandle>(null)
  const [heroId, setHeroId] = useState<string>(HERO_PROPERTIES[0].id)
  const hero = useMemo<HeroProperty>(() => HERO_PROPERTIES.find(h => h.id === heroId) ?? HERO_PROPERTIES[0], [heroId])

  const [phase, setPhase] = useState<'loading' | 'ready' | 'analyzing' | 'done'>('loading')
  const [calls, setCalls] = useState<PlacementCandidate[]>([])
  const [shown, setShown] = useState(0)
  const [windDeg, setWindDeg] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const mapReadyRef = useRef(false)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 820)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }

  // Draw the selected hero's boundary + fly in. Re-runs when the property changes.
  const showBoundary = useCallback((h: HeroProperty) => {
    const api = mapRef.current
    if (!api) return
    api.wipeAll()
    api.flyTo(h.center.lat, h.center.lng, 14.6)
    api.addFeature(
      { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [h.boundaryRing] } },
      'boundary', h.name
    )
  }, [])

  // Wait for the map once, then show the first property.
  useEffect(() => {
    let tries = 0
    const t = setInterval(() => {
      const api = mapRef.current
      if (api && api.getBoundsAndFeatures()) {
        clearInterval(t)
        mapReadyRef.current = true
        showBoundary(hero)
        setPhase('ready')
      } else if (++tries > 120) clearInterval(t)
    }, 150)
    return () => { clearInterval(t); clearTimers() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Switching property resets the plan and re-frames the map.
  const selectHero = useCallback((id: string) => {
    if (id === heroId) return
    clearTimers()
    setHeroId(id)
    setCalls([])
    setShown(0)
    setWindDeg(null)
    setPhase('ready')
    const h = HERO_PROPERTIES.find(x => x.id === id)
    if (h && mapReadyRef.current) showBoundary(h)
  }, [heroId, showBoundary])

  const runTony = useCallback(() => {
    if (phase === 'analyzing') return
    const result = generatePlacements({ boundaryRing: hero.boundaryRing, spatial: hero.spatial, season: hero.season })
    if (!result) return
    setWindDeg(result.windFromDeg)
    const top = curate(result.candidates)
    setCalls(top)
    setShown(0)
    setPhase('analyzing')
    // Stagger the reveal so it reads on camera; draw cumulatively.
    top.forEach((_, i) => {
      timers.current.push(setTimeout(() => {
        mapRef.current?.drawTonyAnnotations(top.slice(0, i + 1).map(toAnnotation))
        setShown(i + 1)
        if (i === top.length - 1) setPhase('done')
      }, 560 * (i + 1)))
    })
  }, [phase, hero])

  // Inputs for Tonight's Sit + the export report, derived from the drawn plan.
  const standTargets = useMemo(
    () => calls.filter(c => c.type === 'stand_site').map(c => ({ name: `${TYPE_LABEL[c.type]} · ${c.compass.toUpperCase()}`, lat: c.center.lat, lng: c.center.lng })),
    [calls]
  )
  const coverZones = useMemo(
    () => calls.filter(c => c.type === 'bedding' || c.type === 'sanctuary').map(c => ({ name: `${TYPE_LABEL[c.type]} · ${c.compass.toUpperCase()}`, lat: c.center.lat, lng: c.center.lng })),
    [calls]
  )
  const reportZones = useMemo<ReportZone[]>(
    () => calls.map(c => ({ type: ANN_TYPE[c.type] ?? c.type, label: `${TYPE_LABEL[c.type] ?? c.type} · ${c.compass.toUpperCase()}`, why: cleanFactors(c.factors).join('. '), confidence: c.score })),
    [calls]
  )

  const prevailingLabel = windDeg != null ? `${degreesToCompass8(windDeg)} (${Math.round(windDeg)}°)` : `${degreesToCompass8(huntingDegOf(hero))} prevailing`

  // ── Layout pieces ───────────────────────────────────────────────────────────
  const Selector = (
    <div style={{ display: 'flex', gap: 6 }}>
      {HERO_PROPERTIES.map(h => {
        const on = h.id === heroId
        return (
          <button key={h.id} onClick={() => selectHero(h.id)}
            style={{
              background: on ? MOSS : 'transparent', color: on ? '#10140e' : '#9A9588',
              border: `1px solid ${on ? MOSS : '#3A3F39'}`, borderRadius: 4, padding: '5px 10px',
              fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, letterSpacing: '.06em', cursor: 'pointer',
              textTransform: 'uppercase', whiteSpace: 'nowrap', transition: 'all .15s',
            }}>
            {h.name}
          </button>
        )
      })}
    </div>
  )

  const Plan = (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, color: MOSS, letterSpacing: '.1em' }}>TONY&apos;S GAME PLAN</div>
        {phase === 'done' && <div style={{ fontFamily: MONO, fontSize: 9, color: '#6E7A5C', letterSpacing: '.1em' }}>{calls.length} CALLS</div>}
      </div>

      {(phase === 'loading' || phase === 'ready') && (
        <div style={{ fontFamily: BODY, fontSize: 14.5, color: '#A7A293', lineHeight: 1.5, marginTop: 8 }}>
          {hero.blurb} <span style={{ color: '#7E7A6C' }}>Hit the button — Tony reads the terrain, cover, and wind in code and draws the whole plan, every call backed by what&apos;s on the ground.</span>
        </div>
      )}

      {(phase === 'analyzing' || phase === 'done') && (
        <div style={{ borderLeft: `3px solid ${MOSS}`, background: '#10140e', borderRadius: 4, padding: '9px 11px', margin: '10px 0' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: MOSS, letterSpacing: '.14em', marginBottom: 3 }}>TONY&apos;S READ</div>
          <div style={{ fontFamily: BODY, fontSize: 14, color: BONE, lineHeight: 1.45 }}>{TONY_READ[hero.id]}</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 4 }}>
        {calls.slice(0, shown).map((c) => (
          <div key={c.id} style={{ borderLeft: `3px solid ${DOT[c.type] ?? MOSS}`, background: INK, borderRadius: 4, padding: '8px 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 700, color: BONE, letterSpacing: '.04em' }}>
                {(TYPE_LABEL[c.type] ?? c.type).toUpperCase()} · {c.compass.toUpperCase()}{c.acres ? ` · ${c.acres} AC` : ''}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: c.score >= 75 ? '#7Fd88f' : '#e3c34d' }}>{Math.round(c.score)}</span>
            </div>
            <div style={{ fontFamily: BODY, fontSize: 13, color: '#A7A293', lineHeight: 1.45, marginTop: 2 }}>
              {cleanFactors(c.factors).join(' · ')}
            </div>
          </div>
        ))}
      </div>

      {phase === 'done' && (
        <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 10.5, color: MOSS, letterSpacing: '.06em', lineHeight: 1.5 }}>
          EVERY PIN: TERRAIN-MATH BACKED · BOUNDARY-GUARANTEED · NOT AN LLM GUESS.
        </div>
      )}
    </>
  )

  const sidebar = (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#232623', borderLeft: isMobile ? 'none' : '1px solid #32362F', borderTop: isMobile ? '1px solid #32362F' : 'none' }}>
      <div style={{ overflowY: 'auto', padding: 16, flex: '1 1 auto' }}>{Plan}</div>
      {phase === 'done' && (
        <div style={{ flex: '0 0 auto', borderTop: '1px solid #32362F', background: '#3A4042' }}>
          <DemoTonightsSit stands={standTargets} cover={coverZones} center={hero.center} />
          <ShareReportButton
            getMapElement={() => mapRef.current?.getCaptureElement() ?? null}
            propertyName={`${hero.name} — ${hero.locationLabel}`}
            acres={parseInt(hero.acresLabel.replace(/\D/g, '')) || 0}
            season={hero.season}
            zones={reportZones}
            wind={windDeg != null ? `${degreesToCompass8(windDeg)} prevailing` : undefined}
          />
          <div style={{ height: 12 }} />
        </div>
      )}
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: INK, display: 'flex', flexDirection: 'column', fontFamily: BODY }}>
      {/* Header */}
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 12, padding: isMobile ? '8px 12px' : '0 18px', height: isMobile ? 'auto' : 62, minHeight: 56, borderBottom: '1px solid #32362F', background: 'rgba(20,23,20,0.6)', flexWrap: 'wrap' }}>
        <img src="/buckgrid-logo.png" alt="BuckGrid Pro" style={{ height: 34 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 700, color: BONE, letterSpacing: '.05em', lineHeight: 1 }}>
            {hero.name.toUpperCase()}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: MOSS, letterSpacing: '.14em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {hero.locationLabel} · {hero.acresLabel} · {hero.season}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.12em', color: '#9A9588', border: '1px solid #44483F', borderRadius: 4, padding: '5px 9px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            ⌁ {prevailingLabel}
          </div>
          {Selector}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: 0 }}>
        <div style={{ position: 'relative', flex: isMobile ? '0 0 52vh' : 1, minHeight: 0 }}>
          <MapContainer ref={mapRef} activeTool={NAV_TOOL} brushSize={30} />
          {phase === 'ready' && (
            <button onClick={runTony}
              style={{ position: 'absolute', bottom: 26, left: '50%', transform: 'translateX(-50%)', background: '#FF6B00', color: '#1E2122', border: 'none', borderRadius: 7, padding: isMobile ? '12px 20px' : '14px 30px', fontFamily: DISPLAY, fontSize: isMobile ? 18 : 22, fontWeight: 700, letterSpacing: '.06em', cursor: 'pointer', boxShadow: '0 6px 28px rgba(0,0,0,.55)', whiteSpace: 'nowrap' }}>
              ASK TONY TO ANALYZE {isMobile ? 'THE PARCEL' : 'THIS PROPERTY'}
            </button>
          )}
          {phase === 'analyzing' && (
            <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', background: 'rgba(10,15,9,0.85)', border: `1px solid rgba(255,107,0,0.5)`, borderRadius: 4, padding: '6px 14px', fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', color: '#FFB273', textTransform: 'uppercase', pointerEvents: 'none' }}>
              ◌ Tony is reading {hero.name}…
            </div>
          )}
        </div>
        <div style={{ flex: isMobile ? '1 1 auto' : '0 0 340px', minHeight: 0, display: 'flex' }}>
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>{sidebar}</div>
        </div>
      </div>
    </div>
  )
}

// The hunting wind the engine designs to (Oct+Nov circular mean of the rose),
// used only for the header chip before analysis runs.
function huntingDegOf(h: HeroProperty): number {
  const wr = h.spatial.windRose
  const oct = wr?.prevailingByMonth?.['Oct']?.degrees
  const nov = wr?.prevailingByMonth?.['Nov']?.degrees
  const vals = [oct, nov].filter((v): v is number => typeof v === 'number')
  if (!vals.length) return 315
  const sin = vals.reduce((s, d) => s + Math.sin((d * Math.PI) / 180), 0)
  const cos = vals.reduce((s, d) => s + Math.cos((d * Math.PI) / 180), 0)
  return ((Math.atan2(sin, cos) * 180) / Math.PI + 360) % 360
}
