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

// ─── Apple-keynote luxury palette (investor edition) ────────────────────────
// Near-black forest base, deep forest-green primary, warm gold/amber accent
// used SPARINGLY (score, CTA, active state), bone/off-white text.
const BASE = '#07120D'        // near-black forest (page base)
const BASE_2 = '#0A140E'      // raised base
const FOREST = '#0A3D2F'      // deep forest-green primary
const MOSS = '#4E6B57'        // muted moss (secondary green)
const GOLD = '#C9A227'        // antique gold accent
const GOLD_HI = '#E0B43A'     // bright amber (emphasis only)
const BONE = '#E8E4D8'        // bone / off-white text
const BONE_DIM = '#A8A498'    // dimmed body text
const BONE_FAINT = '#7C8276'  // faintest labels

// Glass primitives
const GLASS = 'rgba(10,20,14,0.62)'        // translucent dark fill
const GLASS_DEEP = 'rgba(7,16,11,0.74)'    // denser glass (sidebar)
const HAIRLINE = 'rgba(255,255,255,0.08)'  // 1px hairline border
const HAIRLINE_HI = 'rgba(255,255,255,0.14)'
const INNER_HI = 'inset 0 1px 0 rgba(255,255,255,0.07)'  // subtle top highlight
const BLUR = 'blur(22px) saturate(125%)'
const PANEL_SHADOW = '0 18px 50px rgba(0,0,0,0.5)'

// Legacy alias kept for card backgrounds in the plan list
const INK = 'rgba(8,16,11,0.5)'
const CARD = '#0A140E'

const DISPLAY = "'Teko','Oswald',sans-serif"
const MONO = "'Share Tech Mono',monospace"
const BODY = "'Barlow Condensed','Inter',sans-serif"

const TYPE_LABEL: Record<string, string> = {
  sanctuary: 'Sanctuary', bedding: 'Bedding', food_plot: 'Food Plot', kill_plot: 'Harvest Plot',
  stand_site: 'Stand', staging_area: 'Staging', access_route: 'Access', water: 'Water',
}
// map engine type → the key drawAnnotations / report color tables understand
const ANN_TYPE: Record<string, string> = {
  food_plot: 'food_plot', kill_plot: 'food', bedding: 'bedding', stand_site: 'stand',
  staging_area: 'staging_area', sanctuary: 'sanctuary', access_route: 'access_trail', water: 'water',
}
const DOT: Record<string, string> = {
  sanctuary: '#5F7A52', bedding: '#C9A227', food_plot: '#4ADE80', kill_plot: '#7B9E5A',
  stand_site: '#ef4444', staging_area: '#6B7A4F', access_route: '#E0B43A', water: '#3B82F6',
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
    api.addFeature(
      { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [h.boundaryRing] } },
      'boundary', h.name
    )
    // Frame tight on the parcel so the land + every placement fills the map pane.
    const ring = h.boundaryRing
    let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity
    for (const [lng, lat] of ring) {
      if (lng < west) west = lng
      if (lng > east) east = lng
      if (lat < south) south = lat
      if (lat > north) north = lat
    }
    if (isFinite(west)) api.fitBounds({ north, south, east, west }, 70)
    else api.flyTo(h.center.lat, h.center.lng, 15.4)
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
    <div style={{ display: 'flex', gap: 7 }}>
      {HERO_PROPERTIES.map(h => {
        const on = h.id === heroId
        return (
          <button key={h.id} onClick={() => selectHero(h.id)} className="bg-chip"
            style={{
              background: on ? 'rgba(10,61,47,0.85)' : 'rgba(255,255,255,0.03)',
              color: on ? BONE : BONE_DIM,
              border: `1px solid ${on ? 'rgba(125,216,143,0.45)' : HAIRLINE}`,
              borderRadius: 10, padding: '7px 14px',
              fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.1em', cursor: 'pointer',
              textTransform: 'uppercase', whiteSpace: 'nowrap',
              backdropFilter: BLUR, WebkitBackdropFilter: BLUR,
              boxShadow: on
                ? `0 0 18px rgba(95,122,82,0.4), ${INNER_HI}`
                : INNER_HI,
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
        <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 600, color: BONE, letterSpacing: '.14em' }}>
          TONY&apos;S GAME PLAN
        </div>
        {phase === 'done' && (
          <div style={{ fontFamily: MONO, fontSize: 9, color: GOLD, letterSpacing: '.16em', padding: '3px 8px', borderRadius: 6, border: `1px solid rgba(201,162,39,0.3)`, background: 'rgba(201,162,39,0.08)' }}>
            {calls.length} CALLS
          </div>
        )}
      </div>
      <div style={{ height: 1, background: HAIRLINE, margin: '12px 0 2px' }} />

      {(phase === 'loading' || phase === 'ready') && (
        <div style={{ fontFamily: BODY, fontSize: 15, color: BONE_DIM, lineHeight: 1.6, marginTop: 12, fontWeight: 400 }}>
          {hero.blurb} <span style={{ color: BONE_FAINT }}>Hit the button — Tony reads the terrain, cover, and wind in code and draws the whole plan, every call backed by what&apos;s on the ground.</span>
        </div>
      )}

      {(phase === 'analyzing' || phase === 'done') && (
        <div className="bg-card-rise" style={{
          borderLeft: `2px solid ${GOLD}`,
          background: 'linear-gradient(180deg, rgba(201,162,39,0.07), rgba(10,20,14,0.35))',
          border: `1px solid ${HAIRLINE}`, borderLeftWidth: 2, borderLeftColor: GOLD,
          borderRadius: 12, padding: '12px 14px', margin: '14px 0',
          boxShadow: INNER_HI,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: GOLD, letterSpacing: '.2em', marginBottom: 6 }}>TONY&apos;S READ</div>
          <div style={{ fontFamily: BODY, fontSize: 14.5, color: BONE, lineHeight: 1.55 }}>{TONY_READ[hero.id]}</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 10 }}>
        {calls.slice(0, shown).map((c) => (
          <div key={c.id} className="bg-card-rise" style={{
            borderLeft: `2px solid ${DOT[c.type] ?? MOSS}`,
            background: GLASS,
            border: `1px solid ${HAIRLINE}`, borderLeftWidth: 2, borderLeftColor: DOT[c.type] ?? MOSS,
            borderRadius: 12, padding: '11px 13px',
            backdropFilter: BLUR, WebkitBackdropFilter: BLUR,
            boxShadow: `0 8px 22px rgba(0,0,0,0.32), ${INNER_HI}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, color: BONE, letterSpacing: '.08em' }}>
                {(TYPE_LABEL[c.type] ?? c.type).toUpperCase()} · {c.compass.toUpperCase()}{c.acres ? ` · ${c.acres} AC` : ''}
              </span>
              <span style={{
                fontFamily: MONO, fontSize: 13, fontWeight: 700,
                color: c.score >= 75 ? GOLD_HI : c.score >= 60 ? GOLD : BONE_DIM,
                textShadow: c.score >= 75 ? '0 0 12px rgba(224,180,58,0.5)' : 'none',
              }}>{Math.round(c.score)}</span>
            </div>
            <div style={{ fontFamily: BODY, fontSize: 13, color: BONE_DIM, lineHeight: 1.5, marginTop: 4 }}>
              {cleanFactors(c.factors).join(' · ')}
            </div>
          </div>
        ))}
      </div>

      {phase === 'done' && (
        <div className="bg-fade-in" style={{ marginTop: 16, fontFamily: MONO, fontSize: 10, color: MOSS, letterSpacing: '.1em', lineHeight: 1.7, opacity: 0.85 }}>
          EVERY PIN: TERRAIN-MATH BACKED · BOUNDARY-GUARANTEED · NOT AN LLM GUESS.
        </div>
      )}
    </>
  )

  const sidebar = (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: GLASS_DEEP,
      backdropFilter: BLUR, WebkitBackdropFilter: BLUR,
      borderLeft: isMobile ? 'none' : `1px solid ${HAIRLINE}`,
      borderTop: isMobile ? `1px solid ${HAIRLINE}` : 'none',
      boxShadow: isMobile ? 'none' : `-20px 0 50px rgba(0,0,0,0.45), ${INNER_HI}`,
    }}>
      <div className="bg-scroll" style={{ overflowY: 'auto', padding: '20px 18px', flex: '1 1 auto' }}>{Plan}</div>
      {phase === 'done' && (
        <div className="bg-fade-in" style={{ flex: '0 0 auto', borderTop: `1px solid ${HAIRLINE}`, background: 'rgba(7,16,11,0.5)', padding: '4px 6px 0' }}>
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
    <div style={{ position: 'fixed', inset: 0, background: `radial-gradient(120% 90% at 50% -10%, ${BASE_2} 0%, ${BASE} 60%)`, display: 'flex', flexDirection: 'column', fontFamily: BODY }}>
      {/* Header — floating glass bar */}
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 14, padding: isMobile ? '10px 14px' : '0 22px', height: isMobile ? 'auto' : 70, minHeight: 60, borderBottom: `1px solid ${HAIRLINE}`, background: GLASS, backdropFilter: BLUR, WebkitBackdropFilter: BLUR, boxShadow: `0 12px 32px rgba(0,0,0,0.4), ${INNER_HI}`, flexWrap: 'wrap', position: 'relative', zIndex: 20 }}>
        <img src="/buckgrid-logo.png" alt="BuckGrid Pro" style={{ height: 36, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 600, color: BONE, letterSpacing: '.1em', lineHeight: 1 }}>
            {hero.name.toUpperCase()}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: GOLD, letterSpacing: '.18em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 3 }}>
            {hero.locationLabel} · {hero.acresLabel} · {hero.season}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.14em', color: BONE_DIM, border: `1px solid ${HAIRLINE}`, borderRadius: 10, padding: '7px 12px', textTransform: 'uppercase', whiteSpace: 'nowrap', background: 'rgba(255,255,255,0.03)', boxShadow: INNER_HI }}>
            <span style={{ color: GOLD }}>⌁</span> {prevailingLabel}
          </div>
          {Selector}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: 0 }}>
        <div style={{ position: 'relative', flex: isMobile ? '0 0 52vh' : 1, minHeight: 0 }}>
          <MapContainer ref={mapRef} activeTool={NAV_TOOL} brushSize={30} />
          {/* Cinematic edge vignette — frames the imagery, deepens the mood, and
              guarantees text contrast at the margins. Center stays fully legible. */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, boxShadow: 'inset 0 0 160px 30px rgba(5,12,8,0.55)' }} />
          {/* Top scrim — keeps any imagery from fighting the glass header */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(180deg, rgba(5,12,8,0.5), transparent)', pointerEvents: 'none', zIndex: 5 }} />
          {/* Bottom scrim — seats the floating CTA on a darker base */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(0deg, rgba(5,12,8,0.55), transparent)', pointerEvents: 'none', zIndex: 5 }} />
          {phase === 'ready' && (
            <button onClick={runTony} className="bg-cta"
              style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`, color: '#1B1405', border: '1px solid rgba(255,235,170,0.5)', borderRadius: 14, padding: isMobile ? '13px 22px' : '15px 34px', fontFamily: DISPLAY, fontSize: isMobile ? 19 : 24, fontWeight: 600, letterSpacing: '.1em', cursor: 'pointer', whiteSpace: 'nowrap', zIndex: 10, textShadow: '0 1px 0 rgba(255,255,255,0.25)' }}>
              ASK TONY TO ANALYZE {isMobile ? 'THE PARCEL' : 'THIS PROPERTY'}
            </button>
          )}
          {phase === 'analyzing' && (
            <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', background: GLASS_DEEP, backdropFilter: BLUR, WebkitBackdropFilter: BLUR, border: `1px solid rgba(224,180,58,0.4)`, borderRadius: 10, padding: '8px 16px', fontFamily: MONO, fontSize: 11, letterSpacing: '.14em', color: GOLD_HI, textTransform: 'uppercase', pointerEvents: 'none', zIndex: 10, boxShadow: `0 10px 28px rgba(0,0,0,0.45), 0 0 22px rgba(201,162,39,0.18), ${INNER_HI}` }}>
              <span className="bg-spinner" style={{ display: 'inline-block' }}>◌</span> Tony is reading {hero.name}…
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
