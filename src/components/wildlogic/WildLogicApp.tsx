'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useWildLogicStore } from '@/store/wildlogicStore'
import type { ChatMessage } from '@/store/wildlogicStore'
import WildLogicHeader from '@/components/wildlogic/ui/WildLogicHeader'
import ToolSidebar from '@/components/wildlogic/ui/ToolSidebar'
import WildLogicMap, { type WildLogicMapHandle } from '@/components/wildlogic/map/WildLogicMap'
import TonyPanel, { type TonyPanelHandle } from '@/components/wildlogic/chat/TonyPanel'
import MobileBottomNav from '@/components/wildlogic/ui/MobileBottomNav'
import WildLogicOnboarding from '@/components/wildlogic/ui/WildLogicOnboarding'
import { translateZonesToGeoJSON } from '../../../lib/tonyZones'

// ─── Pro / paywall helpers ────────────────────────────────────────────────────

function isPro(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('wl_pro') === '1'
}

function getFreeUsedCount(): number {
  if (typeof window === 'undefined') return 0
  return parseInt(localStorage.getItem('wl_free_used') ?? '0', 10)
}

function incrementFreeUsed(): void {
  if (typeof window === 'undefined') return
  const n = getFreeUsedCount()
  localStorage.setItem('wl_free_used', String(n + 1))
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WildLogicApp() {
  // ── Store selectors ──────────────────────────────────────────────────────────
  const boundary         = useWildLogicStore((s) => s.boundary)
  const acres            = useWildLogicStore((s) => s.acres)
  const name             = useWildLogicStore((s) => s.name)
  const season           = useWildLogicStore((s) => s.season)
  const activeTool       = useWildLogicStore((s) => s.activeTool)
  const isMobile         = useWildLogicStore((s) => s.isMobile)
  const tonyPanelOpen    = useWildLogicStore((s) => s.tonyPanelOpen)
  const isAnalyzing      = useWildLogicStore((s) => s.isAnalyzing)
  const paywallHit       = useWildLogicStore((s) => s.paywallHit)
  const userFeatures     = useWildLogicStore((s) => s.userFeatures)

  // ── Store actions ────────────────────────────────────────────────────────────
  const setPropertyBoundary = useWildLogicStore((s) => s.setPropertyBoundary)
  const setPropertyAcres    = useWildLogicStore((s) => s.setPropertyAcres)
  const setIsMobile         = useWildLogicStore((s) => s.setIsMobile)
  const setTonyPanelOpen    = useWildLogicStore((s) => s.setTonyPanelOpen)
  const setIsAnalyzing      = useWildLogicStore((s) => s.setIsAnalyzing)
  const setPaywallHit       = useWildLogicStore((s) => s.setPaywallHit)
  const setTonyZones        = useWildLogicStore((s) => s.setTonyZones)
  const addMessage          = useWildLogicStore((s) => s.addMessage)
  const setIsLoading        = useWildLogicStore((s) => s.setIsLoading)
  const removeUserFeature   = useWildLogicStore((s) => s.removeUserFeature)

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const mapRef   = useRef<WildLogicMapHandle>(null)
  const tonyRef  = useRef<TonyPanelHandle>(null)

  // ── Local state ───────────────────────────────────────────────────────────────
  const [drawingMode, setDrawingMode] = useState<'none' | 'boundary'>('boundary')

  // ── Mobile detection ──────────────────────────────────────────────────────────
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [setIsMobile])

  // ── Sync activeTool → drawingMode ─────────────────────────────────────────────
  useEffect(() => {
    setDrawingMode(activeTool === 'boundary' ? 'boundary' : 'none')
  }, [activeTool])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Escape: close Tony panel on mobile
      if (e.key === 'Escape' && isMobile) {
        setTonyPanelOpen(false)
      }

      // Ctrl+Z: undo last drawn user feature
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (userFeatures.length > 0) {
          removeUserFeature(userFeatures.length - 1)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMobile, setTonyPanelOpen, userFeatures, removeUserFeature])

  // ── Boundary drawn callback ───────────────────────────────────────────────────
  const handleBoundaryDrawn = useCallback(
    (polygon: any) => {
      setPropertyBoundary(polygon)

      // Compute approximate acreage from bounding box
      const ring: number[][] = polygon?.geometry?.coordinates?.[0] ?? []
      if (ring.length >= 3) {
        let minLat = Infinity
        let maxLat = -Infinity
        let minLng = Infinity
        let maxLng = -Infinity
        for (const [lng, lat] of ring) {
          if (lat < minLat) minLat = lat
          if (lat > maxLat) maxLat = lat
          if (lng < minLng) minLng = lng
          if (lng > maxLng) maxLng = lng
        }
        // 1 degree lat ≈ 69 miles; 1 degree lng ≈ 69 * cos(lat) miles
        const latMid  = (minLat + maxLat) / 2
        const latDiff = maxLat - minLat
        const lngDiff = maxLng - minLng
        const milesLat = latDiff * 69
        const milesLng = lngDiff * 69 * Math.cos((latMid * Math.PI) / 180)
        const sqMiles  = milesLat * milesLng
        const estAcres = Math.round(sqMiles * 640)
        setPropertyAcres(Math.max(1, estAcres))
      }

      // Render boundary on map
      mapRef.current?.setPropertyBoundary(polygon)
    },
    [setPropertyBoundary, setPropertyAcres]
  )

  // ── Tony AI call ──────────────────────────────────────────────────────────────
  const askTony = useCallback(
    async (message: string) => {
      // Paywall check: after 1 free analysis, require Pro
      if (!isPro() && getFreeUsedCount() >= 1) {
        setPaywallHit(true)
        return
      }

      setIsAnalyzing(true)
      setIsLoading(true)
      setTonyPanelOpen(true)

      // Capture current map bounds for spatial context
      const viewport   = mapRef.current?.getViewport()
      const bounds     = viewport?.bounds ?? null

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            bounds,
            propertyName: name || 'My Property',
            season,
          }),
        })

        const data = await res.json()

        // Paywall enforced server-side
        if (data.paywallHit) {
          setPaywallHit(true)
          return
        }

        // Track free usage
        incrementFreeUsed()

        // Translate zones to GeoJSON and push to map
        const tonyZoneFeatures: any[] = []
        const newZoneIds: string[] = []

        if (data.zones && data.zones.length > 0 && boundary) {
          const geoFeatures = translateZonesToGeoJSON(data.zones, boundary.geometry)
          tonyZoneFeatures.push(...geoFeatures)

          // Map API zone objects to store TonyZone shape
          const storeZones = data.zones.map((z: any, i: number) => {
            const id = z.id ?? `tony-zone-${Date.now()}-${i}`
            newZoneIds.push(id)
            return {
              id,
              name: z.name ?? z.type ?? 'Zone',
              type: z.type ?? 'food_plot',
              relative_position: z.relative_position ?? 'center',
              relative_size: z.relative_size ?? 'medium',
              description: z.description ?? '',
              confidence: z.confidence ?? 'medium',
              season: z.season ?? 'all',
              messageId: `tony-${Date.now()}`,
              geoJSON: geoFeatures[i] ?? null,
            }
          })

          setTonyZones(storeZones)
          mapRef.current?.setTonyZones(tonyZoneFeatures)
        }

        // Handle stand_sites as additional zones if present
        if (data.stand_sites && data.stand_sites.length > 0 && boundary) {
          const standFeatures = translateZonesToGeoJSON(
            data.stand_sites.map((s: any) => ({ ...s, type: 'stand_site' })),
            boundary.geometry
          )
          mapRef.current?.setTonyZones([...tonyZoneFeatures, ...standFeatures])
        }

        // Add Tony reply to chat
        const tonyMsg: ChatMessage = {
          id: `tony-${Date.now()}`,
          role: 'tony',
          text: data.reply ?? 'I analyzed your property.',
          tonyZoneIds: newZoneIds,
        }
        addMessage(tonyMsg)
      } catch (err) {
        console.error('[WildLogicApp] askTony error:', err)
        const errMsg: ChatMessage = {
          id: `tony-err-${Date.now()}`,
          role: 'tony',
          text: "Sorry, I had trouble connecting. Check your signal and try again.",
          tonyZoneIds: [],
        }
        addMessage(errMsg)
      } finally {
        setIsAnalyzing(false)
        setIsLoading(false)
      }
    },
    [
      boundary,
      name,
      season,
      setIsAnalyzing,
      setIsLoading,
      setPaywallHit,
      setTonyPanelOpen,
      setTonyZones,
      addMessage,
    ]
  )

  // ── Fly to zone ───────────────────────────────────────────────────────────────
  const handleFlyToZone = useCallback((zoneId: string) => {
    // No-op hook for future implementation — zone GeoJSON centroid fly-to
    void zoneId
  }, [])

  // ── Analyze handler (from onboarding FAB) ─────────────────────────────────────
  const handleAnalyze = useCallback(() => {
    const prompt = `Analyze my ${acres > 0 ? `${Math.round(acres)}-acre ` : ''}property for ${season} hunting. Give me stand placement, food plot locations, bedding areas, and access routes.`
    askTony(prompt)
  }, [acres, season, askTony])

  // ── Upgrade / paywall handler ─────────────────────────────────────────────────
  const handleUpgrade = useCallback(() => {
    // Redirect to Stripe checkout — URL managed server-side
    window.location.href = '/api/checkout'
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  const hasDrawnBoundary = boundary !== null

  return (
    <div className="fixed inset-0 bg-ink-800">

      {/* ── Header (fixed top, h-16) ──────────────────────────────────────────── */}
      <WildLogicHeader />

      {/* ── Desktop layout ────────────────────────────────────────────────────── */}

      {/* Tool sidebar: fixed left, w-[220px], top-16 to bottom */}
      <div className="hidden md:block fixed left-0 top-16 bottom-0 w-[220px] z-30">
        <ToolSidebar />
      </div>

      {/* Map: absolute, left-[220px] on desktop, full-width on mobile */}
      <div className="absolute top-16 bottom-0 right-0 left-0 md:left-[220px] md:right-[300px]">
        <WildLogicMap
          ref={mapRef}
          drawingMode={drawingMode}
          onBoundaryDrawn={handleBoundaryDrawn}
          className="absolute inset-0 w-full h-full"
        />
      </div>

      {/* Tony panel: fixed right, w-[300px], top-16 to bottom — desktop only */}
      <div className="hidden md:block">
        <TonyPanel
          ref={tonyRef}
          onAskTony={askTony}
          onFlyToZone={handleFlyToZone}
          isMobile={false}
          topOffset={64}
        />
      </div>

      {/* ── Mobile layout ─────────────────────────────────────────────────────── */}

      {/* Mobile bottom nav: fixed bottom, h-[60px] */}
      <div className="block md:hidden">
        <MobileBottomNav />
      </div>

      {/* Tony panel mobile bottom sheet — slides up when tonyPanelOpen */}
      {isMobile && tonyPanelOpen && (
        <TonyPanel
          ref={tonyRef}
          onAskTony={askTony}
          onFlyToZone={handleFlyToZone}
          isMobile={true}
          topOffset={64}
        />
      )}

      {/* ── Onboarding + paywall: floating, z-50 ──────────────────────────────── */}
      <WildLogicOnboarding
        onAnalyze={handleAnalyze}
        onUpgrade={handleUpgrade}
        hasDrawnBoundary={hasDrawnBoundary}
        propertyAcres={acres}
      />

    </div>
  )
}
