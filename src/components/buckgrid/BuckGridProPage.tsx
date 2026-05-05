'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import MapContainer, { type MapContainerHandle } from './map/MapContainer'
import type { TonyAnnotation } from './hooks/useMapDrawing'
import ToolGrid from './ui/ToolGrid'
import PropertySearch from './ui/PropertySearch'
import TonyChat, { type TonyChatHandle } from './chat/TonyChat'
import { TOOLS, type Tool } from './constants/tools'
import { usePropertyMemory } from './hooks/usePropertyMemory'

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
const HEADER_H = 70

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
  const [isMobile, setIsMobile] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const { save, restore, savedIndicator, hasRestorable, updateFeatures } = usePropertyMemory()
  const currentSeason = getSeason(new Date())
  const [seasonOverride, setSeasonOverride] = useState<string | null>(null)
  const effectiveSeason = seasonOverride ?? currentSeason.label
  const season = { ...currentSeason, label: effectiveSeason }

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
    if (!showOnboarding) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { localStorage.setItem('buckgrid_onboarded', '1'); setShowOnboarding(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showOnboarding])

  const handleSelectTool = useCallback((t: Tool) => {
    setActiveTool(t)
    if (t.id !== 'nav') setHasDrawn(true)
  }, [])

  const onLockBorder = useCallback(() => {
    if (isAnalyzing) return
    setActiveTool(TOOLS[0])
    const result = mapRef.current?.lockBoundary()
    if (!result) return
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

    const data = mapRef.current?.getBoundsAndFeatures()
    if (data?.features) updateFeatures(data.features)

    if (!chatRef.current) { setIsAnalyzing(false); return }
    setIsAnalyzing(true)
    chatRef.current.triggerScan(contextPrompt)
    save({ name: propertyName || 'Unnamed Property', acres: result.acres, lastAnalysis: contextPrompt, date: new Date().toLocaleDateString(), uiPropertyName: propertyName || undefined })
    if (isMobile) setIsMenuOpen(false)
  }, [propertyName, save, updateFeatures, isMobile, isAnalyzing])

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
    if (!window.confirm('Clear all drawn features? This cannot be undone.')) return
    mapRef.current?.wipeAll()
    setPropertyAcres(0)
    setFeatureCount(0)
    setHasDrawn(false)
  }, [])

  const handleUndoLast = useCallback(() => {
    mapRef.current?.undoLast()
  }, [])

  const handleAnalyze = useCallback(() => {
    if (isAnalyzing || !chatRef.current) return
    const data = mapRef.current?.getBoundsAndFeatures()
    const featureInfo = data && data.features.length > 0
      ? ` I've drawn ${data.features.length} feature(s) on the map.`
      : ''
    const prompt = `Full property analysis.${featureInfo} Read the terrain, identify all key habitat features, and give me your top 3 stand placements for ${season.label}.`
    setIsAnalyzing(true)
    chatRef.current.triggerScan(prompt)
    if (isMobile) setIsMenuOpen(false)
  }, [season.label, isMobile, isAnalyzing])

  // Stable refs for TonyChat props — prevents React.memo bailout on every render
  const getBoundsAndFeatures = useCallback(() => mapRef.current?.getBoundsAndFeatures() ?? null, [])
  const drawAnnotations = useCallback((annotations: TonyAnnotation[]) => mapRef.current?.drawTonyAnnotations(annotations), [])
  const handleScanComplete = useCallback(() => setIsAnalyzing(false), [])

  const isDrawing = activeTool.id !== 'nav'

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#3A4042', fontFamily: "'Barlow Condensed', 'Inter', sans-serif", overflow: 'hidden' }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 1; } 40% { transform: translateY(-6px); opacity: 0.7; } }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #1E2122; } ::-webkit-scrollbar-thumb { background: #2A2A2A; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #6B7A57; }
      `}</style>

      {/* ═══════════════════════════════════════════════
          TOP HEADER BAR
      ═══════════════════════════════════════════════ */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: `${HEADER_H}px`,
        background: 'linear-gradient(135deg, #1E2122 0%, #3A4042 50%, #1E2122 100%)',
        borderBottom: '1px solid rgba(107,122,87,0.15)',
        display: 'flex', alignItems: 'center',
        paddingLeft: '0', paddingRight: '16px',
        zIndex: 1100,
        gap: 0,
        boxShadow: '0 2px 12px rgba(107,122,87,0.08)',
      }}>
        {isMobile ? (
          /* ── Mobile header: logo + hamburger only ── */
          <>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', flex: 1 }}>
              <img src="/buckgrid-logo.png" alt="BuckGrid Pro" style={{ height: '54px', width: 'auto', objectFit: 'contain', display: 'block', maxHeight: '54px' }} />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              style={{ minHeight: '44px', padding: '0 14px', background: 'rgba(107,122,87,0.12)', border: '1px solid rgba(107,122,87,0.4)', borderRadius: '3px', cursor: isAnalyzing ? 'not-allowed' : 'pointer', color: '#6B7A57', fontFamily: "'Teko', 'Oswald', sans-serif", fontWeight: 700, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: '8px', opacity: isAnalyzing ? 0.5 : 1 }}
              aria-label="Analyze property"
            >
              {isAnalyzing ? '◌' : 'Analyze'}
            </button>
            <button
              onClick={() => setIsMenuOpen(v => !v)}
              style={{ minWidth: '44px', minHeight: '44px', background: 'none', border: '1px solid rgba(107,122,87,0.2)', borderRadius: '3px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              aria-label="Open tools menu"
            >
              <span style={{ display: 'block', width: '16px', height: '1.5px', background: '#6B7A57' }} />
              <span style={{ display: 'block', width: '16px', height: '1.5px', background: '#6B7A57' }} />
              <span style={{ display: 'block', width: '16px', height: '1.5px', background: '#6B7A57' }} />
            </button>
          </>
        ) : (
          /* ── Desktop header: full row ── */
          <>
            {/* Brand lockup — same width as sidebar */}
            <div style={{
              width: `${SIDEBAR_W}px`,
              height: '100%',
              display: 'flex', alignItems: 'center', gap: '0',
              padding: '0 16px',
              borderRight: '1px solid rgba(107,122,87,0.15)',
              flexShrink: 0,
            }}>
              <img src="/buckgrid-logo.png" alt="BuckGrid Pro" style={{ height: '58px', width: 'auto', objectFit: 'contain', display: 'block', maxHeight: '58px', maxWidth: '100%' }} />
            </div>

            {/* Property search */}
            <div style={{ width: '180px', padding: '0 12px', borderRight: '1px solid rgba(107,122,87,0.15)', flexShrink: 0 }}>
              <PropertySearch
                onResult={(lat, lng) => { mapRef.current?.flyTo(lat, lng, 15) }}
                compact
              />
            </div>

            {/* Property name inline input */}
            <div style={{ padding: '0 12px', borderRight: '1px solid rgba(107,122,87,0.15)' }}>
              <input
                type="text"
                value={propertyName}
                onChange={e => setPropertyName(e.target.value)}
                placeholder="Property name..."
                maxLength={60}
                aria-label="Property name"
                style={{
                  background: 'transparent', border: 'none',
                  borderBottom: '1px solid rgba(107,122,87,0.2)',
                  color: '#8A8580', fontSize: '14px', fontWeight: 600,
                  padding: '4px 0', outline: 'none',
                  fontFamily: "'Teko', 'Oswald', sans-serif",
                  letterSpacing: '0.04em', width: '140px',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onFocus={e => { e.currentTarget.style.borderBottomColor = '#6B7A57'; e.currentTarget.style.color = '#D8D3C5' }}
                onBlur={e => { e.currentTarget.style.borderBottomColor = 'rgba(107,122,87,0.2)'; e.currentTarget.style.color = '#8A8580' }}
              />
              {savedIndicator && (
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#6B7A57', letterSpacing: '0.1em', marginLeft: '6px' }}>SAVED</span>
              )}
            </div>

            {hasRestorable && !savedIndicator && (
              <div style={{ padding: '0 12px', borderRight: '1px solid rgba(107,122,87,0.15)' }}>
                <button
                  onClick={handleRestoreSession}
                  style={{ fontFamily: "'Teko', 'Oswald', sans-serif", fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', color: '#6B7A57', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textTransform: 'uppercase' }}
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
                background: `${activeTool.color}22`,
                border: `1px solid ${activeTool.color}50`,
                borderRadius: '2px',
                marginRight: '12px',
                boxShadow: `0 0 12px ${activeTool.color}25`,
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '1px', background: activeTool.color, display: 'block', boxShadow: `0 0 12px ${activeTool.color}` }} />
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: activeTool.color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {activeTool.name}
                </span>
              </div>
            )}

            {/* Analyze button */}
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              style={{ padding: '7px 18px', background: isAnalyzing ? 'rgba(107,122,87,0.06)' : 'rgba(107,122,87,0.12)', border: '1px solid rgba(107,122,87,0.45)', borderRadius: '3px', cursor: isAnalyzing ? 'not-allowed' : 'pointer', color: isAnalyzing ? 'rgba(107,122,87,0.4)' : '#6B7A57', fontFamily: "'Teko', 'Oswald', sans-serif", fontWeight: 700, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: '8px', transition: 'all 0.15s ease', whiteSpace: 'nowrap', opacity: isAnalyzing ? 0.6 : 1 }}
              onMouseEnter={e => { if (!isAnalyzing) { e.currentTarget.style.background = 'rgba(107,122,87,0.22)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(107,122,87,0.25)' } }}
              onMouseLeave={e => { e.currentTarget.style.background = isAnalyzing ? 'rgba(107,122,87,0.06)' : 'rgba(107,122,87,0.12)'; e.currentTarget.style.boxShadow = 'none' }}
              aria-label="Analyze property with Tony"
            >
              {isAnalyzing ? '◌ Analyzing...' : '▲ Analyze'}
            </button>

            {/* Season chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '12px', borderLeft: '1px solid #1A2A1F', marginLeft: '4px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#5A8A5F', display: 'inline-block', boxShadow: '0 0 8px #5A8A5F' }} />
              <span style={{ fontFamily: "'Teko', 'Oswald', sans-serif", fontWeight: 700, fontSize: '11px', letterSpacing: '0.14em', color: '#6B7A57', textTransform: 'uppercase' }}>
                {season.label}
              </span>
            </div>

            {/* Acres */}
            {propertyAcres > 0 ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', paddingLeft: '14px', borderLeft: '1px solid rgba(107,122,87,0.15)', marginLeft: '8px' }}>
                <span style={{ fontFamily: "'Teko', 'Oswald', sans-serif", fontWeight: 900, fontSize: '28px', letterSpacing: '0.04em', color: '#6B7A57', lineHeight: 1 }}>
                  {propertyAcres.toLocaleString()}
                </span>
                <span style={{ fontFamily: "'Teko', 'Oswald', sans-serif", fontWeight: 700, fontSize: '11px', color: '#6B7A57', letterSpacing: '0.12em', paddingBottom: '2px', opacity: 0.7 }}>AC</span>
                {featureCount > 0 && (
                  <span style={{ fontFamily: "'Teko', 'Oswald', sans-serif", fontSize: '10px', color: '#6B7A57', letterSpacing: '0.08em', paddingBottom: '2px', marginLeft: '2px', opacity: 0.5 }}>
                    · {featureCount}
                  </span>
                )}
              </div>
            ) : (
              <div style={{ paddingLeft: '14px', borderLeft: '1px solid rgba(107,122,87,0.15)', marginLeft: '8px' }} />
            )}
          </>
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
          background: '#3A4042',
          borderRight: '1px solid rgba(107,122,87,0.15)',
          overflowY: 'auto',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '2px 0 12px rgba(0,0,0,0.4)',
        }}>
          {/* Season advisory */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(107,122,87,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#6DB87F', textTransform: 'uppercase' }}>
                {season.label.toUpperCase()} // ADVISORY
              </div>
              {seasonOverride && (
                <button
                  onClick={() => setSeasonOverride(null)}
                  title="Reset to current season"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5A8A5F', fontSize: '10px', padding: '0 2px', lineHeight: 1 }}
                >
                  ×
                </button>
              )}
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: '#8A8A7A', lineHeight: 1.6, marginBottom: '8px' }}>
              {season.tip}
            </div>
            <select
              value={seasonOverride ?? ''}
              onChange={e => setSeasonOverride(e.target.value || null)}
              style={{
                width: '100%',
                background: '#1E2122',
                border: '1px solid rgba(107,122,87,0.25)',
                borderRadius: '2px',
                color: seasonOverride ? '#6B7A57' : '#5A5A50',
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '9px',
                letterSpacing: '0.1em',
                padding: '4px 6px',
                outline: 'none',
                cursor: 'pointer',
                textTransform: 'uppercase' as const,
              }}
            >
              <option value="">AUTO-DETECT</option>
              {['Spring', 'Summer', 'Early Fall', 'Rut', 'Late Season'].map(s => (
                <option key={s} value={s}>{s.toUpperCase()}</option>
              ))}
            </select>
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
              onUndoLast={handleUndoLast}
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
        <div
          aria-hidden={!isMenuOpen}
          inert={!isMenuOpen || undefined}
          style={{
          position: 'fixed',
          top: `${HEADER_H}px`,
          left: 0,
          right: 0,
          zIndex: 2000,
          maxHeight: '80dvh',
          overflowY: 'auto',
          background: '#3A4042',
          borderBottom: '1px solid rgba(107,122,87,0.12)',
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
            onUndoLast={handleUndoLast}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          TONY CHAT — right panel
      ═══════════════════════════════════════════════ */}
      <TonyChat
        ref={chatRef}
        getBoundsAndFeatures={getBoundsAndFeatures}
        drawAnnotations={drawAnnotations}
        flyTo={(lat, lng, zoom) => mapRef.current?.flyTo(lat, lng, zoom ?? 17)}
        propertyName={propertyName}
        seasonBanner={season}
        isMobile={isMobile}
        topOffset={HEADER_H}
        panelWidth={TONY_W}
        onScanComplete={handleScanComplete}
      />

      {/* ═══════════════════════════════════════════════
          ONBOARDING MODAL
      ═══════════════════════════════════════════════ */}
      {showOnboarding && (
        <div onClick={() => { localStorage.setItem('buckgrid_onboarded', '1'); setShowOnboarding(false) }} style={{ position: 'absolute', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '440px', maxWidth: 'calc(100vw - 32px)',
            background: '#2E3335',
            border: '1px solid rgba(107,122,87,0.2)',
            borderTop: '3px solid #6B7A57',
            borderRadius: '8px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.6), 0 24px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(107,122,87,0.08)',
            overflow: 'hidden',
          }}>
            {/* Hero section with gradient background */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(10,15,9,0.9) 0%, rgba(90,138,95,0.2) 50%, rgba(107,122,87,0.1) 100%)',
              padding: '36px 32px 32px',
              borderBottom: '1px solid rgba(107,122,87,0.15)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Accent glow */}
              <div style={{
                position: 'absolute',
                top: '-50%',
                right: '-30%',
                width: '400px',
                height: '400px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(107,122,87,0.2) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                  <img src="/buckgrid-logo.png" alt="BuckGrid Pro" style={{ height: '160px', width: 'auto', objectFit: 'contain', display: 'block', maxWidth: '100%' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Teko', 'Oswald', sans-serif", fontWeight: 900, fontSize: '42px', letterSpacing: '0.12em', color: '#D8D3C5', textTransform: 'uppercase', lineHeight: 1, marginBottom: '8px', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '10px' }}>
                    <span>BUCK<span style={{ color: '#6B7A57' }}>GRID</span></span>
                    <span style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '0.16em', color: '#6E6A5C' }}>PRO</span>
                  </div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', letterSpacing: '0.28em', color: '#5A8A5F', textTransform: 'uppercase', fontWeight: 700, marginBottom: '18px' }}>
                    AI-POWERED HUNTING PROPERTY INTELLIGENCE
                  </div>
                  <p style={{ fontFamily: "'Teko', 'Oswald', sans-serif", fontSize: '15px', color: '#C8C3B5', letterSpacing: '0.03em', lineHeight: 1.8, margin: 0, maxWidth: '320px', marginLeft: 'auto', marginRight: 'auto' }}>
                    Transform raw acreage into an unfair advantage. Map terrain, model habitat, and receive precision AI analysis — before you ever pull the trigger.
                  </p>
                </div>
              </div>
            </div>

            {/* Steps */}
            <div style={{ padding: '24px 28px' }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', letterSpacing: '0.22em', color: '#6B7A57', textTransform: 'uppercase', marginBottom: '20px', fontWeight: 700, borderBottom: '1px solid rgba(107,122,87,0.15)', paddingBottom: '10px' }}>
                GET STARTED IN 4 STEPS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {[
                  { n: '01', icon: '⊕', label: 'Navigate to Your Property', desc: 'Search by address or GPS coordinates. Satellite imagery loads instantly.' },
                  { n: '02', icon: '◻', label: 'Trace Your Boundary', desc: 'Draw your exact property perimeter with precision polygon tools.' },
                  { n: '03', icon: '◉', label: 'Mark Key Habitat Features', desc: 'Plot food plots, bedding zones, stand locations, and kill zones.' },
                  { n: '04', icon: '▲', label: 'Run AI Analysis', desc: 'Receive a full habitat audit, terrain breakdown, and hunt strategy from Tony.' },
                ].map(({ n, icon, label, desc }) => (
                  <div key={n} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{
                      fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, fontSize: '13px', color: '#6B7A57',
                      width: '36px', height: '36px', flexShrink: 0,
                      letterSpacing: '0.05em',
                      background: 'rgba(107,122,87,0.08)',
                      border: '1px solid rgba(107,122,87,0.3)',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>{icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Teko', 'Oswald', sans-serif", fontWeight: 700, fontSize: '15px', color: '#D8D3C5', letterSpacing: '0.05em', lineHeight: 1, marginBottom: '6px', textTransform: 'uppercase' as const }}>
                        {label}
                      </div>
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: '#8A8A7A', lineHeight: 1.65 }}>
                        {desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div style={{ padding: '24px 28px', borderTop: '1px solid rgba(107,122,87,0.15)', background: 'rgba(10,15,9,0.5)' }}>
              <button
                onClick={() => { localStorage.setItem('buckgrid_onboarded', '1'); setShowOnboarding(false) }}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #6B7A57 0%, #6B7A57 100%)',
                  color: '#1E2122',
                  fontFamily: "'Teko', 'Oswald', sans-serif",
                  fontWeight: 800, fontSize: '14px', letterSpacing: '0.16em', textTransform: 'uppercase',
                  padding: '14px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 16px rgba(107,122,87,0.25)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(107,122,87,0.4), 0 0 20px rgba(107,122,87,0.2)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(107,122,87,0.25)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                ▶ DEPLOY TO MAP
              </button>
              <div style={{ marginTop: '12px', textAlign: 'center', fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#5A8A5F', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Start mapping your habitat now
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
