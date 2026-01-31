'use client'

import React, { useCallback, useRef, useState } from 'react'
import MapContainer, { type MapContainerHandle } from './map/MapContainer'
import ToolGrid from './ui/ToolGrid'
import TonyChat, { type TonyChatHandle } from './chat/TonyChat'
import BuckGridLogo from './ui/BuckGridLogo'
import { TOOLS, type Tool } from './constants/tools'

export default function BuckGridProPage() {
  const mapRef = useRef<MapContainerHandle>(null)
  const chatRef = useRef<TonyChatHandle>(null)
  const [activeTool, setActiveTool] = useState<Tool>(TOOLS[0])
  const [brushSize, setBrushSize] = useState(30)
  const [propertyAcres, setPropertyAcres] = useState(0)
  const [toolTab, setToolTab] = useState<'habitat' | 'food'>('habitat')

  // Prevent duplicate lock actions (React Strict Mode guard)
  const lockOnceRef = useRef(false)
  const onLockBorder = useCallback(() => {
    if (lockOnceRef.current) return
    lockOnceRef.current = true
    const acres = mapRef.current?.lockBoundary()
    if (!acres) return
    setPropertyAcres(acres)
    chatRef.current?.addTonyMessage(`Locked: ${acres} acres. Send your notes.`)
    setActiveTool(TOOLS[0])
    // Reset ref after short delay to allow future locks if needed
    setTimeout(() => { lockOnceRef.current = false }, 500)
  }, [])

  return (
    <div style={{ height: '100dvh', width: '100vw', background: '#0A0A08', overflow: 'hidden', position: 'fixed' }}>
      {/* Full-bleed satellite map */}
      <MapContainer ref={mapRef} activeTool={activeTool} brushSize={brushSize} />

      {/* ─── Top Brand Bar ─── */}
      <div className="brandBar">
        <div className="brandMark">
          <BuckGridLogo size={42} />
          <div>
            <h1>BUCKGRID <span>PRO</span></h1>
            <div className="brandTagline">Elite Whitetail Habitat Intelligence</div>
          </div>
        </div>
      </div>

      {/* ─── Left Panel: Tools ─── */}
      <div
        className="glass textureOverlay"
        style={{
          position: 'absolute',
          left: 14,
          top: 70,
          padding: '16px 14px',
          borderRadius: 8,
          width: 200,
          borderTop: '2px solid rgba(200, 165, 92, 0.3)',
        }}
      >
        <div style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 14,
          letterSpacing: 3,
          color: 'var(--gold)',
          marginBottom: 4,
        }}>
          MAPPING TOOLS
        </div>
        <div className="dividerGold" />
        {/* Tabs for Habitat / Food */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            style={{
              flex: 1,
              padding: '6px 0',
              background: toolTab === 'habitat' ? 'var(--gold)' : 'none',
              color: toolTab === 'habitat' ? '#222' : 'var(--gold)',
              border: 'none',
              borderRadius: 6,
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 13,
              letterSpacing: 2,
              transition: 'background 0.15s',
            }}
            onClick={() => setToolTab('habitat')}
          >HABITAT</button>
          <button
            style={{
              flex: 1,
              padding: '6px 0',
              background: toolTab === 'food' ? 'var(--gold)' : 'none',
              color: toolTab === 'food' ? '#222' : 'var(--gold)',
              border: 'none',
              borderRadius: 6,
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 13,
              letterSpacing: 2,
              transition: 'background 0.15s',
            }}
            onClick={() => setToolTab('food')}
          >FOOD</button>
        </div>
        {/* Filter tools for tab, always show PAN/BOUNDARY */}
        {(() => {
          const alwaysVisible = TOOLS.filter(t => t.id === 'nav' || t.id === 'boundary');
          let tabTools: Tool[] = [];
          if (toolTab === 'habitat') {
            tabTools = TOOLS.filter(t => [
              'bedding',
              'sanctuary',
              'focus',
              'food',
              'egyptian_wheat',
              'switchgrass'
            ].includes(t.id));
          } else {
            tabTools = TOOLS.filter(t => [
              'clover',
              'corn',
              'milo',
              'alfalfa',
              'brassicas',
              'winter_wheat'
            ].includes(t.id));
          }
          // Hide eraser for now
          const filtered = [...alwaysVisible, ...tabTools];
          return (
            <ToolGrid
              tools={filtered}
              activeToolId={activeTool.id}
              brushSize={brushSize}
              onSelectTool={setActiveTool}
              onBrushSize={setBrushSize}
              onLockBorder={onLockBorder}
              onWipeAll={() => { mapRef.current?.wipeAll(); setPropertyAcres(0) }}
            />
          );
        })()}
        {/* Dedicated Audit button for Tony */}
        <button
          style={{
            marginTop: 12,
            width: '100%',
            padding: '8px 0',
            background: 'var(--gold)',
            color: '#222',
            fontWeight: 700,
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            fontSize: 15
          }}
          onClick={() => {
            chatRef.current?.addTonyMessage('Audit request: Please analyze the current map context.')
          }}
        >Audit Property</button>
      </div>

      {/* ─── Tony Chat Panel ─── */}
      <TonyChat 
        ref={chatRef} 
        getCaptureTarget={() => mapRef.current?.getCaptureElement() ?? null} 
        acres={propertyAcres}
        activeTool={activeTool}
        getMapContext={() => mapRef.current?.getMapContext() ?? null}
        onDrawFeatures={(features) => mapRef.current?.drawAISuggestions(features)}
      />

      {/* ─── Bottom Status Bar ─── */}
      <div
        className="glass"
        style={{
          position: 'absolute',
          left: 14,
          bottom: 14,
          borderRadius: 6,
          borderLeft: '3px solid var(--gold)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div className="statusBadge">
          <span className="value">{propertyAcres}</span>
          <span className="unit">Acres Locked</span>
        </div>
      </div>

      {/* ─── Bottom-right brand footer ─── */}
      <div style={{
        position: 'absolute',
        right: 14,
        bottom: 14,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        opacity: 0.4,
      }}>
        <BuckGridLogo size={20} />
        <span style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 11,
          letterSpacing: 3,
          color: 'var(--gold-dark)',
        }}>
          BUCKGRID PRO
        </span>
      </div>
    </div>
  )
}
