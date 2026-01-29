'use client'

import React, { useCallback, useRef, useState } from 'react'
import MapContainer, { type MapContainerHandle } from './map/MapContainer'
import Terrain3DOverlay from './map/Terrain3DOverlay'
import ToolGrid from './ui/ToolGrid'
import TonyChat, { type TonyChatHandle } from './chat/TonyChat'
import { TOOLS, CONSULTANT_TOOLS, type Tool } from './constants/tools'

export default function BuckGridProPage() {
  const mapRef = useRef<MapContainerHandle>(null)
  const chatRef = useRef<TonyChatHandle>(null)
  const [activeTool, setActiveTool] = useState<Tool>(TOOLS[0])
  const [brushSize, setBrushSize] = useState(30)
  const [propertyAcres, setPropertyAcres] = useState(0)
  const [show3D, setShow3D] = useState(false)
  const [consultantMode, setConsultantMode] = useState(false)

  const onLockBorder = useCallback(() => {
    const acres = mapRef.current?.lockBoundary()
    if (!acres) return
    setPropertyAcres(acres)
    chatRef.current?.addTonyMessage(`Locked: ${acres} acres. Send your notes.`)
    setActiveTool(TOOLS[0])
  }, [])

  const toggleConsultant = useCallback(() => {
    setConsultantMode(prev => {
      const next = !prev
      // When entering consultant mode, default to the first consultant tool
      if (next) setActiveTool(CONSULTANT_TOOLS[0])
      else setActiveTool(TOOLS[0])
      return next
    })
  }, [])

  const visibleTools = consultantMode ? [...TOOLS, ...CONSULTANT_TOOLS] : TOOLS

  return (
    <div style={{ height: '100dvh', width: '100vw', background: '#000', overflow: 'hidden', position: 'fixed' }}>
      {/* Leaflet 2D base map */}
      <MapContainer ref={mapRef} activeTool={activeTool} brushSize={brushSize} consultantMode={consultantMode} />

      {/* Mapbox GL 3D terrain overlay */}
      <Terrain3DOverlay active={show3D} />

      {/* Tool panel */}
      <div className="glass" style={{ position: 'absolute', left: 10, top: 10, padding: 12, borderRadius: 12, width: 180 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: '#FF6B00', letterSpacing: 1 }}>BUCKGRID PRO</div>

        {/* 3D terrain toggle */}
        <button
          onClick={() => setShow3D(p => !p)}
          style={{
            width: '100%',
            marginTop: 8,
            marginBottom: 4,
            padding: '8px 0',
            borderRadius: 6,
            border: show3D ? '2px solid #00BFFF' : '1px solid rgba(255,255,255,0.15)',
            background: show3D ? 'rgba(0,191,255,0.15)' : 'transparent',
            color: show3D ? '#00BFFF' : '#888',
            fontWeight: 900,
            fontSize: 11,
            letterSpacing: 1,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {show3D ? '🌍 3D TERRAIN ON' : '🗺️ 3D TERRAIN'}
        </button>

        {/* Consultant mode toggle */}
        <button
          onClick={toggleConsultant}
          style={{
            width: '100%',
            marginBottom: 8,
            padding: '8px 0',
            borderRadius: 6,
            border: consultantMode ? '2px solid #FF2D2D' : '1px solid rgba(255,255,255,0.15)',
            background: consultantMode ? 'rgba(255,45,45,0.15)' : 'transparent',
            color: consultantMode ? '#FF2D2D' : '#888',
            fontWeight: 900,
            fontSize: 11,
            letterSpacing: 1,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {consultantMode ? '🔴 CONSULTANT ON' : '👤 CONSULTANT'}
        </button>

        <ToolGrid
          tools={visibleTools}
          activeToolId={activeTool.id}
          brushSize={brushSize}
          onSelectTool={setActiveTool}
          onBrushSize={setBrushSize}
          onLockBorder={onLockBorder}
          onWipeAll={() => {
            mapRef.current?.wipeAll()
            mapRef.current?.consultant.clearCorrections()
            setPropertyAcres(0)
          }}
        />
      </div>

      <TonyChat ref={chatRef} getCaptureTarget={() => mapRef.current?.getCaptureElement() ?? null} />

      {/* Acres + mode indicator */}
      <div className="glass" style={{ position: 'absolute', left: 10, bottom: 10, padding: '10px 15px', borderRadius: 10, borderLeft: `4px solid ${consultantMode ? '#FF2D2D' : '#FF6B00'}` }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#FF6B00' }}>
          {propertyAcres} <span style={{ fontSize: 10, color: '#888' }}>ACRES</span>
        </div>
        {consultantMode && (
          <div style={{ fontSize: 9, fontWeight: 700, color: '#FF2D2D', letterSpacing: 1, marginTop: 2 }}>
            CONSULTANT MODE
          </div>
        )}
      </div>
    </div>
  )
}
