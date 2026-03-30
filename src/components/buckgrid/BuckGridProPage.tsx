'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import MapContainer, { type MapContainerHandle } from './map/MapContainer'
import ToolGrid from './ui/ToolGrid'
import PropertySearch from './ui/PropertySearch'
import TonyChat, { type TonyChatHandle } from './chat/TonyChat'
import { TOOLS, type Tool } from './constants/tools'
import { usePropertyMemory } from './hooks/usePropertyMemory'
import BuckLogo from './ui/BuckLogo'

type SeasonInfo = { label: string; tip: string; color: string }

function getSeason(now: Date): SeasonInfo {
  const month = now.getMonth() + 1
  if (month >= 3 && month <= 5) return { label: 'Spring', tip: 'Food plot planting season — Tony can plan your layout', color: 'bg-green-900/50 text-green-300 border-green-800/50' }
  if (month >= 6 && month <= 8) return { label: 'Summer', tip: 'Velvet growth — mineral sites and water critical', color: 'bg-emerald-900/50 text-emerald-300 border-emerald-800/50' }
  if (month === 9 || month === 10) return { label: 'Early Fall', tip: 'Pre-rut prep — stand placement is critical now', color: 'bg-orange-900/50 text-orange-300 border-orange-800/50' }
  if (month === 11) return { label: 'Rut', tip: "Peak rut — pinch points are highest value", color: 'bg-red-900/50 text-red-300 border-red-800/50' }
  return { label: 'Late Season', tip: 'Food and thermal cover — survival habitat matters', color: 'bg-blue-900/50 text-blue-300 border-blue-800/50' }
}

export default function BuckGridProPage() {
  const mapRef = useRef<MapContainerHandle>(null)
  const chatRef = useRef<TonyChatHandle>(null)
  const [activeTool, setActiveTool] = useState<Tool>(TOOLS[0])
  const [brushSize, setBrushSize] = useState(30)
  const [propertyAcres, setPropertyAcres] = useState(0)
  const [featureCount, setFeatureCount] = useState(0)
  const [propertyName, setPropertyName] = useState('')
  const [showDrawHint, setShowDrawHint] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hintDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { memory, save, restore, savedIndicator, hasRestorable } = usePropertyMemory()
  const season = getSeason(new Date())

  // Detect mobile and listen for resize
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const seen = localStorage.getItem('buckgrid_onboarded')
    if (!seen) setShowOnboarding(true)
  }, [])

  useEffect(() => {
    hintTimerRef.current = setTimeout(() => {
      if (!hasDrawn) setShowDrawHint(true)
    }, 30_000)
    return () => { if (hintTimerRef.current) clearTimeout(hintTimerRef.current) }
  }, [hasDrawn])

  useEffect(() => {
    if (showDrawHint) {
      hintDismissRef.current = setTimeout(() => setShowDrawHint(false), 5_000)
    }
    return () => { if (hintDismissRef.current) clearTimeout(hintDismissRef.current) }
  }, [showDrawHint])

  const handleSelectTool = useCallback((t: Tool) => {
    setActiveTool(t)
    if (t.id !== 'nav') {
      setHasDrawn(true)
      setShowDrawHint(false)
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    }
  }, [])

  const onLockBorder = useCallback(() => {
    setActiveTool(TOOLS[0]) // always release tool — even if lock fails
    const result = mapRef.current?.lockBoundary()
    if (!result || result.acres === 0) return
    setPropertyAcres(result.acres)
    setFeatureCount(result.layers.length)
    setHasDrawn(true)

    const { summary } = result
    const parts: string[] = []
    if (summary.food > 0) parts.push(`${summary.food} food plot${summary.food > 1 ? 's' : ''}`)
    if (summary.bedding > 0) parts.push(`${summary.bedding} bedding area${summary.bedding > 1 ? 's' : ''}`)
    if (summary.water > 0) parts.push(`${summary.water} water source${summary.water > 1 ? 's' : ''}`)
    if (summary.stand > 0) parts.push(`${summary.stand} stand location${summary.stand > 1 ? 's' : ''}`)
    const layerLine = parts.length > 0 ? ` I can see ${parts.join(', ')}.` : ''

    const contextPrompt =
      `Property locked at ${result.acres} acres.${layerLine}` +
      (result.pathYards > 0 ? ` Total trail: ${result.pathYards} yds.` : '') +
      (propertyName ? ` Property name: ${propertyName}.` : '') +
      ` Give me a quick habitat audit.`

    chatRef.current?.triggerScan(contextPrompt)
    save({ name: propertyName || 'Unnamed Property', acres: result.acres, lastAnalysis: contextPrompt, date: new Date().toLocaleDateString() })
  }, [propertyName, save])

  const handleRestoreSession = useCallback(() => {
    const restored = restore()
    if (restored) {
      setPropertyName(restored.name)
      setPropertyAcres(restored.acres)
      chatRef.current?.addTonyMessage(
        `Welcome back. Restored your session for **${restored.name}** (${restored.acres} acres) from ${restored.date}. What would you like to work on?`
      )
    }
  }, [restore])

  const handleWipeAll = useCallback(() => {
    mapRef.current?.wipeAll()
    setPropertyAcres(0)
    setFeatureCount(0)
    setHasDrawn(false)
  }, [])

  const isDrawing = activeTool.id !== 'nav'

  // The left panel content — shared between desktop panel and mobile drawer
  const leftPanelContent = (
    <div className="flex flex-col gap-2.5 p-3" style={{ background: 'transparent' }}>
      {/* ── BRANDING CARD — standalone with top accent bar ── */}
      <div style={{
        background: 'rgba(14,14,14,0.96)',
        border: '1px solid #2A2A2A',
        borderTop: '2px solid #C8650A',
        borderRadius: '5px',
        padding: '12px 12px 10px',
        marginBottom: '2px',
      }}>
        <div className="flex items-center gap-2.5">
          <BuckLogo size={38} color="#C8650A" />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '18px', letterSpacing: '0.06em', color: '#C8650A', textTransform: 'uppercase', lineHeight: 1 }}>
              BuckGrid Pro
            </div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 400, fontSize: '8px', letterSpacing: '0.22em', color: '#444', textTransform: 'uppercase', marginTop: '4px' }}>
              Precision Land Intelligence
            </div>
          </div>
          {isDrawing && (
            <div style={{ fontSize: '8px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.12em', padding: '3px 6px', background: 'rgba(200,101,10,0.12)', color: '#C8650A', border: '1px solid rgba(200,101,10,0.4)', borderRadius: '2px', textTransform: 'uppercase', flexShrink: 0 }}>
              LIVE
            </div>
          )}
        </div>
      </div>

      {/* ── TACTICAL SEASON READOUT ── */}
      <div style={{
        background: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(200,101,10,0.35)',
        borderLeft: '2px solid rgba(200,101,10,0.6)',
        borderRadius: '3px',
        padding: '7px 9px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
          <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '1px', background: '#C8650A', flexShrink: 0 }} />
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', fontWeight: 500, letterSpacing: '0.14em', color: '#C8650A', textTransform: 'uppercase' }}>
            SEASON // {season.label.toUpperCase()}
          </span>
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9.5px', color: 'rgba(200,101,10,0.65)', lineHeight: 1.5, letterSpacing: '0.02em' }}>
          {season.tip}
        </div>
      </div>

      {/* ── FIND PROPERTY ── */}
      <div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', color: '#555', textTransform: 'uppercase', marginBottom: '6px' }}>
          LOCATE PROPERTY
        </div>
        <PropertySearch onResult={(lat, lng) => { mapRef.current?.flyTo(lat, lng, 15); setIsMenuOpen(false) }} />
      </div>

      {/* ── PROPERTY NAME ── */}
      <div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', color: '#555', textTransform: 'uppercase', marginBottom: '6px' }}>
          PROPERTY DESIGNATION
        </div>
        <input
          type="text"
          value={propertyName}
          onChange={e => setPropertyName(e.target.value)}
          placeholder="e.g. North 40, Home Farm..."
          maxLength={60}
          style={{ width: '100%', background: '#111', border: '1px solid #2E2E2E', color: '#E0E0E0', fontSize: '12px', padding: '7px 9px', borderRadius: '3px', outline: 'none', fontFamily: "'Barlow Condensed', sans-serif", boxSizing: 'border-box' } as React.CSSProperties}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(200,101,10,0.5)' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#2E2E2E' }}
        />
      </div>

      {savedIndicator && (
        <div style={{ fontSize: '10px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, letterSpacing: '0.1em', color: '#C8650A', textAlign: 'center' }}>SAVED ✓</div>
      )}
      {hasRestorable && !savedIndicator && (
        <button
          onClick={handleRestoreSession}
          style={{ fontSize: '10px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, letterSpacing: '0.08em', color: '#C8650A', border: '1px solid rgba(200,101,10,0.25)', background: 'transparent', padding: '5px 8px', borderRadius: '3px', cursor: 'pointer', textAlign: 'left', width: '100%' }}
        >
          ↩ RESTORE LAST SESSION
        </button>
      )}

      {/* ── DRAW TOOLS ── */}
      <div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', color: '#555', textTransform: 'uppercase', marginBottom: '6px' }}>
          DRAW TOOLS
        </div>
        <ToolGrid
          tools={TOOLS}
          activeToolId={activeTool.id}
          brushSize={brushSize}
          onSelectTool={t => { handleSelectTool(t); if (isMobile) setIsMenuOpen(false) }}
          onBrushSize={setBrushSize}
          onLockBorder={() => { onLockBorder(); if (isMobile) setIsMenuOpen(false) }}
          onWipeAll={handleWipeAll}
        />
      </div>
    </div>
  )

  return (
    <div className="h-screen w-screen overflow-hidden fixed" style={{ background: '#0A0A0A', fontFamily: "'Barlow Condensed', 'Inter', sans-serif" }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 1; } 40% { transform: translateY(-6px); opacity: 0.7; } }
      `}</style>
      <MapContainer ref={mapRef} activeTool={activeTool} brushSize={brushSize} />

      {/* Onboarding modal */}
      {showOnboarding && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}>
          <div className="p-6 max-w-sm w-full mx-4 rounded-lg" style={{ background: '#1A1A1A', border: '1px solid rgba(200,101,10,0.3)', boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 40px rgba(200,101,10,0.05)' }}>
            <div className="flex items-center gap-3 mb-5">
              <BuckLogo size={38} color="#C8650A" />
              <div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '18px', letterSpacing: '0.04em', color: '#C8650A', textTransform: 'uppercase', lineHeight: 1 }}>BuckGrid Pro</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '10px', letterSpacing: '0.15em', color: '#666', textTransform: 'uppercase', marginTop: '2px' }}>Precision Land Intelligence</div>
              </div>
            </div>
            <div className="flex flex-col gap-3 mb-5">
              {[
                { n: '1', label: 'Find your land', desc: 'Search an address or use GPS to navigate to your property.' },
                { n: '2', label: 'Draw your boundary', desc: 'Select Boundary tool and trace your property line on the map.' },
                { n: '3', label: 'Mark your habitat', desc: 'Draw food plots, bedding areas, stand locations, pinch points.' },
                { n: '4', label: 'Lock Border → Ask Tony', desc: 'Lock your boundary and Tony will analyze your terrain instantly.' },
              ].map(({ n, label, desc }) => (
                <div key={n} className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0 mt-0.5" style={{ background: '#C8650A', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{n}</div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#E0E0E0', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.02em' }}>{label}</div>
                    <div style={{ fontSize: '11px', color: '#777', lineHeight: 1.4, marginTop: '1px' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => { localStorage.setItem('buckgrid_onboarded', '1'); setShowOnboarding(false) }}
              style={{ width: '100%', background: '#C8650A', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '10px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
            >
              Deploy to Map
            </button>
          </div>
        </div>
      )}

      {/* ── DESKTOP: Left panel ── */}
      {!isMobile && (
        <div
          className="absolute left-3 top-3 z-[1000] flex flex-col gap-0"
          style={{ width: '224px', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto' }}
        >
          <div className="rounded-lg" style={{
            background: 'rgba(14,14,14,0.9)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
            overflow: 'hidden',
          }}>
            {leftPanelContent}
          </div>
        </div>
      )}

      {/* ── MOBILE: Hamburger button (top-left) ── */}
      {isMobile && (
        <button
          onClick={() => setIsMenuOpen(v => !v)}
          style={{
            position: 'fixed',
            top: '12px',
            left: '12px',
            zIndex: 1800,
            width: '44px',
            height: '44px',
            borderRadius: '6px',
            background: 'rgba(26,26,26,0.95)',
            border: '1px solid #2E2E2E',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          }}
          aria-label="Open menu"
        >
          <span style={{ display: 'block', width: '20px', height: '2px', background: '#C8650A', borderRadius: '1px' }} />
          <span style={{ display: 'block', width: '20px', height: '2px', background: '#C8650A', borderRadius: '1px' }} />
          <span style={{ display: 'block', width: '20px', height: '2px', background: '#C8650A', borderRadius: '1px' }} />
        </button>
      )}

      {/* ── MOBILE: Slide-down drawer backdrop ── */}
      {isMobile && isMenuOpen && (
        <div
          onClick={() => setIsMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1900,
            background: 'rgba(0,0,0,0.6)',
          }}
        />
      )}

      {/* ── MOBILE: Slide-down drawer ── */}
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2000,
            maxHeight: '85vh',
            overflowY: 'auto',
            background: '#1A1A1A',
            border: '1px solid #2E2E2E',
            borderTop: 'none',
            borderRadius: '0 0 12px 12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            transform: isMenuOpen ? 'translateY(0)' : 'translateY(-100%)',
            transition: 'transform 0.3s ease',
          }}
        >
          {/* Drawer header with close */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid #2E2E2E',
            background: '#141414',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BuckLogo size={24} color="#C8650A" />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '14px', letterSpacing: '0.08em', color: '#C8650A', textTransform: 'uppercase' }}>
                BuckGrid Pro
              </span>
            </div>
            <button
              onClick={() => setIsMenuOpen(false)}
              style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px' }}
            >
              ✕
            </button>
          </div>
          {leftPanelContent}
        </div>
      )}

      {/* Tony Chat */}
      <TonyChat
        ref={chatRef}
        getBoundsAndFeatures={() => mapRef.current?.getBoundsAndFeatures() ?? null}
        drawAnnotations={(annotations) => mapRef.current?.drawTonyAnnotations(annotations)}
        propertyName={propertyName}
        seasonBanner={season}
        isMobile={isMobile}
      />

      {/* Acres counter — bottom-left on desktop, top-center pill on mobile */}
      {!isMobile ? (
        <div
          className="absolute left-3 bottom-3 z-[1000] px-4 py-2.5"
          style={{
            background: '#1A1A1A',
            border: '1px solid #2E2E2E',
            borderLeft: '3px solid #C8650A',
            borderRadius: '3px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          }}
        >
          {propertyAcres > 0 ? (
            <>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '30px', letterSpacing: '0.04em', color: '#C8650A', lineHeight: 1 }}>
                {propertyAcres.toLocaleString()}{' '}
                <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', color: '#555' }}>ACRES</span>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#555', marginTop: '2px', letterSpacing: '0.06em' }}>
                {featureCount} FEATURE{featureCount !== 1 ? 'S' : ''} LOGGED
              </div>
            </>
          ) : (
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '13px', letterSpacing: '0.08em', color: '#3A3A3A' }}>— ACRES</div>
          )}
        </div>
      ) : propertyAcres > 0 ? (
        <div
          style={{
            position: 'fixed',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1700,
            background: 'rgba(26,26,26,0.95)',
            border: '1px solid rgba(200,101,10,0.4)',
            borderRadius: '20px',
            padding: '5px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '16px', color: '#C8650A', lineHeight: 1 }}>
            {propertyAcres.toLocaleString()}
          </span>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '9px', fontWeight: 600, letterSpacing: '0.14em', color: '#555' }}>ACRES</span>
        </div>
      ) : null}

      {/* Draw mode indicator — bottom center */}
      {isDrawing && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
          <div style={{ background: activeTool.color, color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 18px', borderRadius: '2px', boxShadow: `0 0 24px ${activeTool.color}90` }}>
            {activeTool.name} — DRAWING ACTIVE
          </div>
        </div>
      )}

      {/* Draw hint */}
      {showDrawHint && !isDrawing && (
        <div className="absolute left-1/2 bottom-16 -translate-x-1/2 z-[500] pointer-events-none">
          <div style={{ background: '#1A1A1A', border: '1px solid rgba(200,101,10,0.35)', borderRadius: '3px', color: '#E0E0E0', fontSize: '12px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.04em', padding: '10px 18px', textAlign: 'center' }}>
            <span style={{ color: '#C8650A', fontWeight: 700 }}>STEP 1:</span> Select Boundary, trace your property line, then hit Lock Border
          </div>
        </div>
      )}
    </div>
  )
}
