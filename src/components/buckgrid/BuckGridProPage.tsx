'use client'

import React, { useCallback, useRef, useState } from 'react'
import MapContainer, { type MapContainerHandle } from './map/MapContainer'
import ToolGrid from './ui/ToolGrid'
import TonyChat, { type TonyChatHandle } from './chat/TonyChat'
import { TOOLS, type Tool } from './constants/tools'

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
      <div className="glass" style={{ position: 'absolute', left: 10, top: 10, padding: 12, borderRadius: 12, width: 180 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: '#FF6B00', letterSpacing: 1 }}>BUCKGRID PRO</div>
        <ToolGrid tools={TOOLS} activeToolId={activeTool.id} brushSize={brushSize} onSelectTool={setActiveTool} onBrushSize={setBrushSize} onLockBorder={onLockBorder} onWipeAll={() => { mapRef.current?.wipeAll(); setPropertyAcres(0); }} />
      </div>
      <TonyChat ref={chatRef} getCaptureTarget={() => mapRef.current?.getCaptureElement() ?? null} spatialContext={{ propertyAcres, activeTool: activeTool.name, brushSize }} />
      <div className="glass" style={{ position: 'absolute', left: 10, bottom: 10, padding: '10px 15px', borderRadius: 10, borderLeft: '4px solid #FF6B00' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#FF6B00' }}>{propertyAcres} <span style={{ fontSize: 10, color: '#888' }}>ACRES</span></div>
      </div>
    </div>
  )
}
