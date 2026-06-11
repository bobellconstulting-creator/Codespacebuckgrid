'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as Dialog from '@radix-ui/react-dialog'
import { useWildLogicStore } from '@/store/wildlogicStore'
import type { ChatMessage } from '@/store/wildlogicStore'
import WildLogicMap, { type WildLogicMapHandle } from '@/components/wildlogic/map/WildLogicMap'
import TonyPanel, { type TonyPanelHandle } from '@/components/wildlogic/chat/TonyPanel'
import { zonesToMapFeatures } from '../../../lib/tonyZones'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isPro() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('wl_pro') === '1'
}
function getFreeUsed() {
  if (typeof window === 'undefined') return 0
  return parseInt(localStorage.getItem('wl_free_used') ?? '0', 10)
}
function incrementFree() {
  if (typeof window === 'undefined') return
  localStorage.setItem('wl_free_used', String(getFreeUsed() + 1))
}

// ─── Tool definitions ─────────────────────────────────────────────────────────
const TOOLS = [
  {
    id: 'nav' as const,
    label: 'Pan',
    tip: 'Pan & zoom',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M9 2L11 8L9 6.5L7 8L9 2Z" strokeLinejoin="round" />
        <path d="M16 9L10 11L11.5 9L10 7L16 9Z" strokeLinejoin="round" />
        <path d="M9 16L7 10L9 11.5L11 10L9 16Z" strokeLinejoin="round" />
        <path d="M2 9L8 7L6.5 9L8 11L2 9Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'boundary' as const,
    label: 'Boundary',
    tip: 'Draw property boundary',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="9,2 16,6 16,12 9,16 2,12 2,6" strokeLinejoin="round" />
        <circle cx="9" cy="2" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="16" cy="6" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="16" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="9" cy="16" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="2" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="2" cy="6" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'food_plot' as const,
    label: 'Food Plot',
    tip: 'Mark food plots',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="8" width="12" height="8" rx="1" />
        <path d="M9 8V5" /><path d="M9 5C9 5 6.5 3.5 6.5 1.5" /><path d="M9 5C9 5 11.5 3.5 11.5 1.5" />
        <path d="M5 11h8M5 14h8" strokeDasharray="2 2" />
      </svg>
    ),
  },
  {
    id: 'bedding' as const,
    label: 'Bedding',
    tip: 'Mark bedding areas',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 13C3 13 5 8 9 8C13 8 15 13 15 13" strokeLinejoin="round" />
        <path d="M2 13h14" strokeLinecap="round" />
        <path d="M6.5 8C6.5 6 7.8 4.5 9 4.5C10.2 4.5 11.5 6 11.5 8" />
        <circle cx="9" cy="3.5" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'stand' as const,
    label: 'Stand',
    tip: 'Place stand site',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="9" cy="3" r="1.8" />
        <path d="M9 4.8V9" strokeLinecap="round" />
        <path d="M6.5 7.5h5" strokeLinecap="round" />
        <path d="M7.5 9L6 13.5" strokeLinecap="round" />
        <path d="M10.5 9L12 13.5" strokeLinecap="round" />
        <rect x="4.5" y="13.5" width="9" height="2.5" rx="0.5" fill="currentColor" stroke="none" opacity="0.4" />
      </svg>
    ),
  },
  {
    id: 'trail' as const,
    label: 'Trail',
    tip: 'Draw travel corridor',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 15C5 12 4 10 6 8.5C8 7 8 5 10 3.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" />
        <path d="M15 15C13 12 14 10 12 8.5C10 7 10 5 10 3.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" />
        <circle cx="10" cy="3.5" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'water' as const,
    label: 'Water',
    tip: 'Mark water source',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 2C9 2 4.5 8 4.5 12C4.5 14.5 6.5 16.5 9 16.5C11.5 16.5 13.5 14.5 13.5 12C13.5 8 9 2 9 2Z" strokeLinejoin="round" />
        <path d="M7 13C7 11.8 7.8 11 9 10.5" strokeLinecap="round" opacity="0.6" />
      </svg>
    ),
  },
  {
    id: 'mineral' as const,
    label: 'Mineral',
    tip: 'Mark mineral lick',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="9,2.5 13,7.5 11,14 7,14 5,7.5" strokeLinejoin="round" />
        <path d="M5 7.5l4 3 4-3M7 14l2-6.5 2 6.5" opacity="0.5" />
      </svg>
    ),
  },
]

const SEASONS = ['Spring', 'Summer', 'Early Fall', 'Rut', 'Late Season'] as const
type Season = typeof SEASONS[number]

// ─── Wordmark logo — BUCKGRID + blaze PRO badge (brand guide §5) ───────────────
function WordMark({ size = 22 }: { size?: number }) {
  return (
    <div className="flex items-baseline gap-1.5" style={{ fontFamily: "'Big Shoulders Display','Oswald',sans-serif" }}>
      <span style={{ fontSize: size, fontWeight: 800, color: '#F4EFE3', letterSpacing: '0.02em', lineHeight: 1 }}>
        BUCKGRID
      </span>
      <span
        style={{
          fontSize: size * 0.52,
          fontWeight: 800,
          color: '#F4EFE3',
          background: '#E45A24',
          letterSpacing: '0.08em',
          lineHeight: 1,
          padding: '2px 5px 1px',
          borderRadius: 3,
          transform: 'translateY(-1px)',
        }}
      >
        PRO
      </span>
    </div>
  )
}

// ─── Glass panel wrapper ───────────────────────────────────────────────────────
function GlassPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: 'rgba(10, 14, 10, 0.82)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(127, 176, 105, 0.12)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    />
  )
}

// ─── Paywall modal ─────────────────────────────────────────────────────────────
function PaywallModal({ open, onUpgrade, onDismiss }: { open: boolean; onUpgrade: () => void; onDismiss: () => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onDismiss()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[500]"
                style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 20 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-0 z-[501] flex items-center justify-center pointer-events-none"
              >
                <div
                  className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden pointer-events-auto"
                  style={{
                    background: 'rgba(15,34,24,0.96)',
                    border: '1px solid rgba(228,90,36,0.3)',
                    boxShadow: '0 0 0 1px rgba(228,90,36,0.1), 0 32px 64px rgba(0,0,0,0.7)',
                  }}
                >
                  <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #E45A24, transparent)' }} />
                  <div className="px-8 pt-8 pb-10 flex flex-col items-center gap-5">
                    <WordMark size={26} />
                    <Dialog.Title asChild>
                      <div className="text-center">
                        <p style={{ fontFamily: "'Big Shoulders Display','Oswald',sans-serif", fontSize: 32, fontWeight: 700, color: '#F4EFE3', letterSpacing: '0.04em', lineHeight: 1.1 }}>
                          Upgrade to Pro
                        </p>
                        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: 'rgba(244,239,227,0.5)', marginTop: 6 }}>
                          Unlimited access — $79/year
                        </p>
                      </div>
                    </Dialog.Title>
                    <Dialog.Description className="sr-only">Upgrade to WildLogic Pro for unlimited Tony analyses.</Dialog.Description>
                    <ul className="w-full flex flex-col gap-2.5">
                      {['Unlimited Tony analyses', 'Save & revisit properties', 'Season-by-season breakdown', 'Mobile field access'].map(f => (
                        <li key={f} className="flex items-center gap-3">
                          <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(127,176,143,0.15)', border: '1px solid rgba(127,176,143,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5l2 2L8 1" stroke="#7FB08F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </span>
                          <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: 'rgba(244,239,227,0.8)' }}>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={onUpgrade}
                      className="w-full py-3.5 rounded-xl transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
                      style={{ background: 'linear-gradient(135deg, #E45A24, #C2410C)', fontFamily: "'Big Shoulders Display','Oswald',sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: '0.08em', color: '#F4EFE3' }}
                    >
                      UPGRADE NOW — $79/YR
                    </button>
                    <Dialog.Close asChild>
                      <button style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: 'rgba(244,239,227,0.35)' }} className="hover:text-white/60 transition-colors underline underline-offset-2">
                        Not right now
                      </button>
                    </Dialog.Close>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

// ─── Main app ─────────────────────────────────────────────────────────────────
export default function WildLogicAppV2() {
  const boundary         = useWildLogicStore(s => s.boundary)
  const acres            = useWildLogicStore(s => s.acres)
  const name             = useWildLogicStore(s => s.name)
  const season           = useWildLogicStore(s => s.season)
  const activeTool       = useWildLogicStore(s => s.activeTool)
  const isMobile         = useWildLogicStore(s => s.isMobile)
  const isAnalyzing      = useWildLogicStore(s => s.isAnalyzing)
  const paywallHit       = useWildLogicStore(s => s.paywallHit)
  const userFeatures     = useWildLogicStore(s => s.userFeatures)
  const messages         = useWildLogicStore(s => s.messages)

  const setActiveTool    = useWildLogicStore(s => s.setActiveTool)
  const setPropertyName  = useWildLogicStore(s => s.setPropertyName)
  const setPropertyBoundary = useWildLogicStore(s => s.setPropertyBoundary)
  const setPropertyAcres = useWildLogicStore(s => s.setPropertyAcres)
  const setIsMobile      = useWildLogicStore(s => s.setIsMobile)
  const setIsAnalyzing   = useWildLogicStore(s => s.setIsAnalyzing)
  const setIsLoading     = useWildLogicStore(s => s.setIsLoading)
  const setPaywallHit    = useWildLogicStore(s => s.setPaywallHit)
  const setTonyZones     = useWildLogicStore(s => s.setTonyZones)
  const setSeason        = useWildLogicStore(s => s.setSeason)
  const addMessage       = useWildLogicStore(s => s.addMessage)
  const removeUserFeature = useWildLogicStore(s => s.removeUserFeature)

  const mapRef  = useRef<WildLogicMapHandle>(null)
  const tonyRef = useRef<TonyPanelHandle>(null)

  const [tonyOpen, setTonyOpen] = useState(false)
  const [drawingMode, setDrawingMode] = useState<'none' | 'boundary'>('boundary')

  const hasAnalysis = messages.some(m => m.role === 'tony' && m.tonyZoneIds.length > 0)

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [setIsMobile])

  // Sync active tool → drawing mode
  useEffect(() => {
    setDrawingMode(activeTool === 'boundary' ? 'boundary' : 'none')
  }, [activeTool])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTonyOpen(false)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && userFeatures.length > 0) {
        removeUserFeature(userFeatures.length - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [userFeatures, removeUserFeature])

  const handleBoundaryDrawn = useCallback((polygon: any) => {
    setPropertyBoundary(polygon)
    const ring: number[][] = polygon?.geometry?.coordinates?.[0] ?? []
    if (ring.length >= 3) {
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
      for (const [lng, lat] of ring) {
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat
        if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng
      }
      const latMid = (minLat + maxLat) / 2
      const acres = Math.max(1, Math.round(
        (maxLat - minLat) * 69 * (maxLng - minLng) * 69 * Math.cos(latMid * Math.PI / 180) * 640
      ))
      setPropertyAcres(acres)
    }
    mapRef.current?.setPropertyBoundary(polygon)
  }, [setPropertyBoundary, setPropertyAcres])

  const askTony = useCallback(async (message: string) => {
    if (!isPro() && getFreeUsed() >= 1) { setPaywallHit(true); return }
    setIsAnalyzing(true); setIsLoading(true); setTonyOpen(true)
    const viewport = mapRef.current?.getViewport()
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          bounds: viewport?.bounds ?? null,
          // Send the real parcel polygon — the server placement engine clips
          // every zone to this boundary
          features: boundary
            ? [{ type: 'Feature', properties: { layerType: 'boundary' }, geometry: boundary.geometry }]
            : [],
          propertyName: name || 'My Property',
          season,
        }),
      })
      const data = await res.json()
      if (data.paywallHit) { setPaywallHit(true); return }
      incrementFree()
      const newZoneIds: string[] = []
      // Merge stand sites into the renderable zone list (they arrive as a
      // separate array but draw as point features on the map)
      const standZones = (data.stand_sites ?? []).map((s: any) => ({
        ...s,
        type: 'stand_site',
        confidence: typeof s.rating === 'number' ? (s.rating >= 8 ? 'high' : s.rating >= 6 ? 'medium' : 'low') : 'medium',
        season: s.season ?? 'all',
      }))
      const allZones = [...(data.zones ?? []), ...standZones]
      if (allZones.length > 0 && boundary) {
        const geo = zonesToMapFeatures(allZones, boundary.geometry)
        const zones = allZones.map((z: any, i: number) => {
          const id = z.id ?? `tz-${Date.now()}-${i}`
          newZoneIds.push(id)
          return { id, name: z.name ?? z.type ?? 'Zone', type: z.type ?? 'food_plot', relative_position: z.relative_position ?? 'center', relative_size: z.relative_size ?? 'medium', description: z.description ?? '', confidence: z.confidence ?? 'medium', season: z.season ?? 'all', messageId: `tony-${Date.now()}`, geoJSON: geo[i] ?? null }
        })
        setTonyZones(zones)
        mapRef.current?.setTonyZones(geo.filter(Boolean))
      }
      addMessage({ id: `tony-${Date.now()}`, role: 'tony', text: data.reply ?? 'Analysis complete.', tonyZoneIds: newZoneIds })
    } catch {
      addMessage({ id: `err-${Date.now()}`, role: 'tony', text: "Couldn't connect. Check your signal and try again.", tonyZoneIds: [] })
    } finally {
      setIsAnalyzing(false); setIsLoading(false)
    }
  }, [boundary, name, season, setIsAnalyzing, setIsLoading, setPaywallHit, setTonyZones, addMessage])

  const handleAnalyze = useCallback(() => {
    askTony(`Analyze my ${acres > 0 ? `${Math.round(acres)}-acre ` : ''}property for ${season} hunting. Give me stand placement, food plot locations, bedding areas, and access routes.`)
  }, [acres, season, askTony])

  const SEASON_COLORS: Record<Season, string> = {
    Spring: '#7FB08F', Summer: '#7FB08F', 'Early Fall': '#E0A23B', Rut: '#E45A24', 'Late Season': '#5E7C8A'
  }

  return (
    <Tooltip.Provider delayDuration={600}>
      <div className="fixed inset-0" style={{ background: '#0F2218' }}>

        {/* ── Full-bleed map ────────────────────────────────────────────────── */}
        <WildLogicMap
          ref={mapRef}
          drawingMode={drawingMode}
          onBoundaryDrawn={handleBoundaryDrawn}
          className="absolute inset-0 w-full h-full"
        />

        {/* ── Top bar — glass strip ─────────────────────────────────────────── */}
        <div
          className="absolute top-0 left-0 right-0 z-40 h-14 flex items-center px-4 gap-4"
          style={{
            background: 'linear-gradient(to bottom, rgba(15,34,24,0.92) 0%, rgba(15,34,24,0) 100%)',
          }}
        >
          <WordMark size={20} />

          {/* Property name — inline edit */}
          <div className="flex items-center gap-2 min-w-0 flex-1 max-w-xs">
            {acres > 0 && (
              <span
                className="shrink-0 text-xs font-mono px-2 py-0.5 rounded"
                style={{ background: 'rgba(194,174,138,0.12)', color: '#C2AE8A', border: '1px solid rgba(194,174,138,0.25)', fontFamily: "'JetBrains Mono','Roboto Mono',monospace", letterSpacing: '0.08em' }}
              >
                {Math.round(acres).toLocaleString()} AC
              </span>
            )}
            <input
              type="text"
              value={name}
              onChange={e => setPropertyName(e.target.value)}
              placeholder="Property name"
              className="bg-transparent text-sm outline-none min-w-0 truncate"
              style={{ fontFamily: "'Big Shoulders Display','Oswald',sans-serif", fontSize: 15, letterSpacing: '0.05em', color: 'rgba(244,239,227,0.7)', caretColor: '#7FB08F' }}
            />
          </div>

          <div className="flex-1" />

          {/* Season pill */}
          <div className="hidden md:flex items-center gap-1.5">
            {SEASONS.map(s => (
              <button
                key={s}
                onClick={() => setSeason(s)}
                className="px-2.5 py-1 rounded-full text-xs transition-all"
                style={{
                  fontFamily: "'Inter',sans-serif",
                  fontWeight: 500,
                  fontSize: 11,
                  background: season === s ? 'rgba(127,176,143,0.15)' : 'transparent',
                  color: season === s ? SEASON_COLORS[s as Season] : 'rgba(244,239,227,0.35)',
                  border: `1px solid ${season === s ? 'rgba(127,176,143,0.25)' : 'transparent'}`,
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Tony button */}
          <button
            onClick={() => setTonyOpen(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all active:scale-[0.98]"
            style={{
              background: tonyOpen ? 'rgba(127,176,143,0.2)' : 'linear-gradient(135deg, rgba(228,90,36,0.9), rgba(160,120,32,0.9))',
              border: tonyOpen ? '1px solid rgba(127,176,143,0.3)' : '1px solid rgba(228,90,36,0.4)',
              color: tonyOpen ? '#7FB08F' : '#F4EFE3',
              fontFamily: "'Big Shoulders Display','Oswald',sans-serif",
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: '0.08em',
              boxShadow: tonyOpen ? 'none' : '0 4px 16px rgba(228,90,36,0.3)',
            }}
          >
            {isAnalyzing ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(127,176,143,0.3)', borderTopColor: '#7FB08F' }} />
                ANALYZING
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" /><path d="M4.5 7h5M7 4.5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                ASK TONY
              </>
            )}
          </button>
        </div>

        {/* ── Vertical tool rail — left ─────────────────────────────────────── */}
        <div
          className="absolute left-4 z-40 flex flex-col gap-1 rounded-xl overflow-hidden"
          style={{
            top: 72,
            background: 'rgba(15,34,24,0.82)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(127,176,143,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            padding: 4,
          }}
        >
          {TOOLS.map((tool) => {
            const active = activeTool === tool.id
            return (
              <Tooltip.Root key={tool.id}>
                <Tooltip.Trigger asChild>
                  <button
                    onClick={() => setActiveTool(tool.id)}
                    aria-label={tool.tip}
                    className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150"
                    style={{
                      background: active ? 'rgba(127,176,143,0.2)' : 'transparent',
                      border: active ? '1px solid rgba(127,176,143,0.35)' : '1px solid transparent',
                      color: active ? '#7FB08F' : 'rgba(244,239,227,0.4)',
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(244,239,227,0.8)' }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(244,239,227,0.4)' }}
                  >
                    {tool.icon}
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="right" sideOffset={10}
                    className="z-50 px-2.5 py-1.5 rounded-lg text-xs"
                    style={{ background: 'rgba(15,34,24,0.95)', border: '1px solid rgba(127,176,143,0.15)', color: 'rgba(244,239,227,0.85)', fontFamily: "'Inter',sans-serif", boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}
                  >
                    {tool.tip}
                    <Tooltip.Arrow style={{ fill: 'rgba(15,34,24,0.95)' }} />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            )
          })}

          {/* Separator */}
          <div style={{ height: 1, background: 'rgba(127,176,143,0.1)', margin: '2px 4px' }} />

          {/* Undo */}
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={() => userFeatures.length > 0 && removeUserFeature(userFeatures.length - 1)}
                disabled={userFeatures.length === 0}
                className="flex items-center justify-center w-10 h-10 rounded-lg transition-all"
                style={{ color: 'rgba(244,239,227,0.3)', border: '1px solid transparent' }}
                aria-label="Undo last"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6h7a4 4 0 0 1 0 8H5" /><path d="M2 6L5 3M2 6l3 3" />
                </svg>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content side="right" sideOffset={10} className="z-50 px-2.5 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(15,34,24,0.95)', border: '1px solid rgba(127,176,143,0.15)', color: 'rgba(244,239,227,0.85)', fontFamily: "'Inter',sans-serif" }}>
                Undo last (⌘Z)
                <Tooltip.Arrow style={{ fill: 'rgba(15,34,24,0.95)' }} />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>

        {/* ── Tony chat panel — right drawer ────────────────────────────────── */}
        <AnimatePresence>
          {tonyOpen && (
            <motion.div
              key="tony-panel"
              initial={{ x: 380, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 380, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="absolute top-0 bottom-0 right-0 z-40 w-[360px]"
              style={{
                background: 'rgba(15,34,24,0.9)',
                backdropFilter: 'blur(32px)',
                WebkitBackdropFilter: 'blur(32px)',
                borderLeft: '1px solid rgba(127,176,143,0.1)',
              }}
            >
              <TonyPanel
                ref={tonyRef}
                onAskTony={askTony}
                onFlyToZone={() => {}}
                isMobile={false}
                topOffset={0}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Step prompt — floats bottom-left ─────────────────────────────── */}
        <AnimatePresence mode="wait">
          {!boundary && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: 'rgba(15,34,24,0.85)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(127,176,143,0.15)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(127,176,143,0.15)', border: '1px solid rgba(127,176,143,0.3)' }}>
                <span style={{ fontFamily: "'Big Shoulders Display',sans-serif", fontSize: 13, color: '#7FB08F', fontWeight: 700 }}>1</span>
              </div>
              <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: 'rgba(244,239,227,0.7)' }}>
                Select <strong style={{ color: '#F4EFE3' }}>Boundary</strong> and draw your property outline
              </span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="rgba(244,239,227,0.3)" strokeWidth="1.2">
                <polygon points="7,1 13,4.5 13,9.5 7,13 1,9.5 1,4.5" />
                <circle cx="7" cy="1" r="1.2" fill="rgba(244,239,227,0.3)" stroke="none" />
                <circle cx="13" cy="4.5" r="1.2" fill="rgba(244,239,227,0.3)" stroke="none" />
                <circle cx="13" cy="9.5" r="1.2" fill="rgba(244,239,227,0.3)" stroke="none" />
                <circle cx="7" cy="13" r="1.2" fill="rgba(244,239,227,0.3)" stroke="none" />
                <circle cx="1" cy="9.5" r="1.2" fill="rgba(244,239,227,0.3)" stroke="none" />
                <circle cx="1" cy="4.5" r="1.2" fill="rgba(244,239,227,0.3)" stroke="none" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Analyze FAB — appears after boundary drawn ────────────────────── */}
        <AnimatePresence>
          {boundary && !tonyOpen && (
            <motion.div
              key="fab"
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 16 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40"
            >
              {/* pulse ring */}
              <motion.span
                animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{ background: 'rgba(228,90,36,0.25)' }}
              />
              <button
                onClick={handleAnalyze}
                className="relative flex items-center gap-3 px-7 py-4 rounded-2xl transition-all active:scale-[0.97]"
                style={{
                  background: 'linear-gradient(135deg, #E45A24 0%, #C2410C 100%)',
                  boxShadow: '0 8px 32px rgba(228,90,36,0.4), 0 2px 8px rgba(0,0,0,0.5)',
                  fontFamily: "'Big Shoulders Display','Oswald',sans-serif",
                  fontWeight: 700,
                  fontSize: 20,
                  letterSpacing: '0.08em',
                  color: '#F4EFE3',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.3" /><path d="M6 9l2.5 2.5L13 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ANALYZE WITH TONY
                {acres > 0 && (
                  <span className="text-sm font-mono opacity-60" style={{ fontSize: 13 }}>
                    · {Math.round(acres)}ac
                  </span>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Paywall ───────────────────────────────────────────────────────── */}
        <PaywallModal
          open={paywallHit}
          onUpgrade={() => { setPaywallHit(false); window.location.href = '/api/checkout' }}
          onDismiss={() => setPaywallHit(false)}
        />
      </div>
    </Tooltip.Provider>
  )
}
