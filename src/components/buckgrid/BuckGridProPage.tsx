'use client'

import React, { useCallback, useRef, useState } from 'react'
import MapContainer, { type MapContainerHandle } from './map/MapContainer'
import ToolGrid from './ui/ToolGrid'
import TonyChat, { type TonyChatHandle } from './chat/TonyChat'
import { TOOLS, type Tool } from './constants/tools'

const glassPanel: React.CSSProperties = {
  background: 'rgba(17, 24, 39, 0.8)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 20,
}

export default function BuckGridProPage() {
  const mapRef = useRef<MapContainerHandle>(null)
  const chatRef = useRef<TonyChatHandle>(null)
  const [activeTool, setActiveTool] = useState<Tool>(TOOLS[0])
  const [brushSize, setBrushSize] = useState(10)
  const [propertyAcres, setPropertyAcres] = useState(0)

  const onLockBorder = useCallback(() => {
    const acres = mapRef.current?.lockBoundary()
    if (!acres) return
    setPropertyAcres(acres)
    chatRef.current?.addTonyMessage(`Locked: ${acres} acres. Send your notes.`)
    setActiveTool(TOOLS[0])
  }, [])

  return (
    <div style={{ height: '100dvh', width: '100vw', background: '#000', overflow: 'hidden', position: 'fixed' }}>
      <MapContainer ref={mapRef} activeTool={activeTool} brushSize={brushSize} />

      {/* Top-left: Logo + Acres badge */}
      <div style={{ ...glassPanel, position: 'absolute', left: 12, top: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: '#FF6B00', letterSpacing: 1.5 }}>BUCKGRID PRO</div>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ fontSize: 18, fontWeight: 900, color: '#FF6B00' }}>{propertyAcres} <span style={{ fontSize: 9, color: '#888', fontWeight: 600 }}>ACRES</span></div>
      </div>

      {/* Tony Chat - right side */}
      <TonyChat ref={chatRef} getCaptureTarget={() => mapRef.current?.getCaptureElement() ?? null} spatialContext={{ propertyAcres, activeTool: activeTool.name, brushSize }} />

      {/* Bottom dock: ToolGrid */}
      <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', ...glassPanel, padding: 4, maxWidth: 'calc(100vw - 24px)' }}>
        <ToolGrid tools={TOOLS} activeToolId={activeTool.id} brushSize={brushSize} onSelectTool={setActiveTool} onBrushSize={setBrushSize} onLockBorder={onLockBorder} onWipeAll={() => { mapRef.current?.wipeAll(); setPropertyAcres(0); }} />
      </div>
    </div>
  )
}
