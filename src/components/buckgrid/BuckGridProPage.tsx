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
  if (month >= 3 && month <= 5) return { label: 'Spring', tip: 'Food plot planting season — Tony can plan your layout', color: '' }
  if (month >= 6 && month <= 8) return { label: 'Summer', tip: 'Velvet growth — mineral sites and water critical', color: '' }
  if (month === 9 || month === 10) return { label: 'Early Fall', tip: 'Pre-rut prep — stand placement is critical now', color: '' }
  if (month === 11) return { label: 'Rut', tip: "Peak rut — pinch points are highest value", color: '' }
  return { label: 'Late Season', tip: 'Food and thermal cover — survival habitat matters', color: '' }
}

const SIDEBAR_W = 220
const TONY_W = 300
const HEADER_H = 52

export default function BuckGridProPage() {
  const mapRef = useRef<MapContainerHandle>(null)
  const chatRef = useRef<TonyChatHandle>(null)
  const [activeTool, setActiveTool] = useState<Tool>(TOOLS[0])
  const [brushSize, setBrushSize] = useState(30)
  const [propertyAcres, setPropertyAcres] = useState(0)
  const [featureCount, setFeatureCount] = useState(0)
  const [propertyName, setPropertyName] = useState('')
  const [hasDrawn, setHasDrawn] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  )
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const { save, restore, savedIndicator, hasRestorable } = usePropertyMemory()
  const season = getSeason(new Date())

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const seen = localStorage.getItem('buckgrid_onboarded')
    if (!seen) setShowOnboarding(true)
  }, [])

  const handleSelectTool = useCallback((t: Tool) => {
    setActiveTool(t)
    if (t.id !== 'nav') setHasDrawn(true)
  }, [])

  const onLockBorder = useCallback(() => {
    setActiveTool(TOOLS[0])
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
    if (isMobile) setIsMenuOpen(false)
  }, [propertyName, save, isMobile])

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

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#080808', fontFamily: "'Barlow Condensed', 'Inter', sans-serif", overflow: 'hidden' }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 1; } 40% { transform: translateY(-6px); opacity: 0.7; } }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0A0A0A; } ::-webkit-scrollbar-thumb { background: #2A2A2A; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #C8650A; }
      `}</style>

      {/* ═══════════════════════════════════════════════
          TOP HEADER BAR
      ═══════════════════════════════════════════════ */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: `${HEADER_H}px`,
        background: '#0B0B0B',
        borderBottom: '1px solid #1A1A1A',
        display: 'flex', alignItems: 'center',
        paddingLeft: '0', paddingRight: '16px',
        zIndex: 1100,
        gap: 0,
      }}>
        {/* Brand lockup — same width as sidebar */}
        <div style={{
          width: `${SIDEBAR_W}px`,
          height: '100%',
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '0 16px',
          borderRight: '1px solid #1A1A1A',
          flexShrink: 0,
        }}>
          <BuckLogo size={30} color="#C8650A" />
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '17px', letterSpacing: '0.1em', color: '#D0D0D0', textTransform: 'uppercase', lineHeight: 1 }}>
              Buck<span style={{ color: '#C8650A' }}>Grid</span> Pro
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '7px', letterSpacing: '0.2em', color: '#2E2E2E', textTransform: 'uppercase', marginTop: '3px' }}>
              Precision Land Intelligence
            </div>
          </div>
        </div>

        {/* Property search */}
        <div style={{ width: '180px', padding: '0 12px', borderRight: '1px solid #141414', flexShrink: 0 }}>
          <PropertySearch
            onResult={(lat, lng) => { mapRef.current?.flyTo(lat, lng, 15) }}
            compact
          />
        </div>

        {/* Property name inline input */}
        <div style={{ padding: '0 12px', borderRight: '1px solid #141414' }}>
          <input
            type="text"
            value={propertyName}
            onChange={e => setPropertyName(e.target.value)}
            placeholder="Property name..."
            maxLength={60}
            aria-label="Property name"
            style={{
              background: 'transparent', border: 'none',
              borderBottom: '1px solid #252525',
              color: '#666', fontSize: '12px',
              padding: '2px 0', outline: 'none',
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: '0.04em', width: '140px',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onFocus={e => { e.currentTarget.style.borderBottomColor = '#C8650A'; e.currentTarget.style.color = '#D0D0D0' }}
            onBlur={e => { e.currentTarget.style.borderBottomColor = '#252525'; e.currentTarget.style.color = '#666' }}
          />
          {savedIndicator && (
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#C8650A', letterSpacing: '0.1em', marginLeft: '6px' }}>SAVED</span>
          )}
        </div>

        {hasRestorable && !savedIndicator && (
          <div style={{ padding: '0 12px', borderRight: '1px solid #141414' }}>
            <button
              onClick={handleRestoreSession}
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', color: '#C8650A', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textTransform: 'uppercase' }}
            >
              ↩ Restore
            </button>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Drawing mode pill */}
        {isDrawing && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px',
            background: `${activeTool.color}15`,
            border: `1px solid ${activeTool.color}40`,
            borderRadius: '2px',
            marginRight: '12px',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '1px', background: activeTool.color, display: 'block', boxShadow: `0 0 8px ${activeTool.color}` }} />
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: activeTool.color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {activeTool.name}
            </span>
          </div>
        )}

        {/* Season chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '12px', borderLeft: '1px solid #141414', marginLeft: '4px' }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#3D7A4F', display: 'inline-block' }} />
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '0.14em', color: '#3D7A4F', textTransform: 'uppercase' }}>
            {season.label}
          </span>
        </div>

        {/* Acres */}
        {propertyAcres > 0 ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', paddingLeft: '14px', borderLeft: '1px solid #1A1A1A', marginLeft: '8px' }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '24px', letterSpacing: '0.02em', color: '#C8650A', lineHeight: 1 }}>
              {propertyAcres.toLocaleString()}
            </span>
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#444', letterSpacing: '0.12em', paddingBottom: '2px' }}>AC</span>
            {featureCount > 0 && (
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#2A2A2A', letterSpacing: '0.08em', paddingBottom: '2px', marginLeft: '2px' }}>
                / {featureCount}F
              </span>
            )}
          </div>
        ) : (
          <div style={{ paddingLeft: '14px', borderLeft: '1px solid #1A1A1A', marginLeft: '8px' }}>
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#2A2A2A', letterSpacing: '0.1em' }}>NO PROPERTY</span>
          </div>
        )}

        {/* Mobile hamburger */}
        {isMobile && (
          <button
            onClick={() => setIsMenuOpen(v => !v)}
            style={{ marginLeft: '12px', width: '36px', height: '36px', background: 'none', border: '1px solid #222', borderRadius: '3px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            aria-label="Open tools menu"
          >
            <span style={{ display: 'block', width: '16px', height: '1.5px', background: '#C8650A' }} />
            <span style={{ display: 'block', width: '16px', height: '1.5px', background: '#C8650A' }} />
            <span style={{ display: 'block', width: '16px', height: '1.5px', background: '#C8650A' }} />
          </button>
        )}
      </header>

      {/* ═══════════════════════════════════════════════
          MAP — fills the center
      ═══════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute',
        top: `${HEADER_H}px`,
        left: isMobile ? 0 : `${SIDEBAR_W}px`,
        right: isMobile ? 0 : `${TONY_W}px`,
        bottom: 0,
      }}>
        <MapContainer ref={mapRef} activeTool={activeTool} brushSize={brushSize} />
      </div>

      {/* ═══════════════════════════════════════════════
          LEFT SIDEBAR — tools
      ═══════════════════════════════════════════════ */}
      {!isMobile && (
        <div style={{
          position: 'absolute',
          top: `${HEADER_H}px`,
          left: 0,
          width: `${SIDEBAR_W}px`,
          bottom: 0,
          background: '#0B0B0B',
          borderRight: '1px solid #161616',
          overflowY: 'auto',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Season advisory */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #131313' }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', letterSpacing: '0.18em', color: '#3D7A4F', textTransform: 'uppercase', marginBottom: '5px' }}>
              {season.label.toUpperCase()} // ADVISORY
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#2A3A2A', lineHeight: 1.6 }}>
              {season.tip}
            </div>
          </div>

          {/* Tools — fill the rest */}
          <div style={{ flex: 1 }}>
            <ToolGrid
              tools={TOOLS}
              activeToolId={activeTool.id}
              brushSize={brushSize}
              onSelectTool={handleSelectTool}
              onBrushSize={setBrushSize}
              onLockBorder={onLockBorder}
              onWipeAll={handleWipeAll}
            />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          MOBILE DRAWER
      ═══════════════════════════════════════════════ */}
      {isMobile && isMenuOpen && (
        <div
          onClick={() => setIsMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1900, background: 'rgba(0,0,0,0.7)' }}
        />
      )}
      {isMobile && (
        <div style={{
          position: 'fixed',
          top: `${HEADER_H}px`,
          left: 0,
          right: 0,
          zIndex: 2000,
          maxHeight: '80vh',
          overflowY: 'auto',
          background: '#0B0B0B',
          borderBottom: '1px solid #1C1C1C',
          transform: isMenuOpen ? 'translateY(0)' : 'translateY(-110%)',
          transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <ToolGrid
            tools={TOOLS}
            activeToolId={activeTool.id}
            brushSize={brushSize}
            onSelectTool={t => { handleSelectTool(t); setIsMenuOpen(false) }}
            onBrushSize={setBrushSize}
            onLockBorder={onLockBorder}
            onWipeAll={handleWipeAll}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          TONY CHAT — right panel
      ═══════════════════════════════════════════════ */}
      <TonyChat
        ref={chatRef}
        getBoundsAndFeatures={() => mapRef.current?.getBoundsAndFeatures() ?? null}
        drawAnnotations={(annotations) => mapRef.current?.drawTonyAnnotations(annotations)}
        propertyName={propertyName}
        seasonBanner={season}
        isMobile={isMobile}
        topOffset={HEADER_H}
        panelWidth={TONY_W}
      />

      {/* ═══════════════════════════════════════════════
          ONBOARDING MODAL
      ═══════════════════════════════════════════════ */}
      {showOnboarding && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}>
          <div style={{
            width: '380px', maxWidth: 'calc(100vw - 32px)',
            background: '#0D0D0D',
            border: '1px solid #222',
            borderTop: '3px solid #C8650A',
            borderRadius: '4px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.95)',
            overflow: 'hidden',
          }}>
            {/* Modal header */}
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #161616' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <BuckLogo size={44} color="#C8650A" />
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '26px', letterSpacing: '0.06em', color: '#D8D8D8', textTransform: 'uppercase', lineHeight: 1 }}>
                    Buck<span style={{ color: '#C8650A' }}>Grid</span> Pro
                  </div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#2E2E2E', textTransform: 'uppercase', marginTop: '5px' }}>
                    AI Habitat Intelligence System
                  </div>
                </div>
              </div>
            </div>

            {/* Steps */}
            <div style={{ padding: '20px 28px' }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', letterSpacing: '0.2em', color: '#333', textTransform: 'uppercase', marginBottom: '16px' }}>
                MISSION BRIEFING — 4 STEPS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { n: '01', label: 'Navigate to your land', desc: 'Search an address or tap GPS to find your property on the map.' },
                  { n: '02', label: 'Trace your boundary', desc: 'Select Boundary tool and draw your property perimeter.' },
                  { n: '03', label: 'Mark habitat features', desc: 'Draw food plots, bedding areas, stand locations, pinch points.' },
                  { n: '04', label: 'Lock Border — deploy Tony', desc: 'Tony analyzes your exact terrain and delivers a full habitat audit.' },
                ].map(({ n, label, desc }) => (
                  <div key={n} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{
                      fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, fontSize: '11px', color: '#C8650A',
                      width: '28px', flexShrink: 0, paddingTop: '1px',
                      letterSpacing: '0.04em',
                    }}>{n}</div>
                    <div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '14px', color: '#C8C8C8', letterSpacing: '0.02em', lineHeight: 1, marginBottom: '3px' }}>
                        {label}
                      </div>
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#3A3A3A', lineHeight: 1.6 }}>
                        {desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div style={{ padding: '0 28px 24px' }}>
              <button
                onClick={() => { localStorage.setItem('buckgrid_onboarded', '1'); setShowOnboarding(false) }}
                style={{
                  width: '100%',
                  background: '#C8650A',
                  color: '#fff',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 800, fontSize: '14px', letterSpacing: '0.14em', textTransform: 'uppercase',
                  padding: '13px', borderRadius: '3px', border: 'none', cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#D97210' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#C8650A' }}
              >
                DEPLOY TO MAP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
