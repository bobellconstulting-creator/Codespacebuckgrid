'use client'

import React, { useCallback, useRef, useState } from 'react'
import MapboxEngine, { type MapboxEngineHandle } from './map/MapboxEngine'
import ToolGrid from './ui/ToolGrid'
import TonyChat, { type TonyChatHandle } from './chat/TonyChat'
import { TOOLS, type Tool } from './constants/tools'

export default function BuckGridProPage() {
  const mapRef = useRef<MapboxEngineHandle>(null)
  const chatRef = useRef<TonyChatHandle>(null)
  const [activeTool, setActiveTool] = useState<Tool>(TOOLS[0])
  const [brushSize, setBrushSize] = useState(30)
  const [propertyAcres, setPropertyAcres] = useState(0)

  const onLockBorder = useCallback(() => {
    // TODO: Re-wire boundary lock with Mapbox drawing tools in Phase 2
    chatRef.current?.addTonyMessage('Boundary lock coming in Phase 2.')
    setActiveTool(TOOLS[0])
  }, [])

  return (
    <div style={{ height: '100dvh', width: '100vw', background: '#000', overflow: 'hidden', position: 'fixed' }}>
      <MapboxEngine ref={mapRef} />
      <div className="glass" style={{ position: 'absolute', left: 10, top: 10, padding: 12, borderRadius: 12, width: 180 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: '#FF6B00', letterSpacing: 1 }}>BUCKGRID PRO</div>
        <ToolGrid tools={TOOLS} activeToolId={activeTool.id} brushSize={brushSize} onSelectTool={setActiveTool} onBrushSize={setBrushSize} onLockBorder={onLockBorder} onWipeAll={() => { setPropertyAcres(0); }} />
      </div>
      <TonyChat ref={chatRef} getCaptureTarget={() => mapRef.current?.getCaptureElement() ?? null} />
      <div className="glass" style={{ position: 'absolute', left: 10, bottom: 10, padding: '10px 15px', borderRadius: 10, borderLeft: '4px solid #FF6B00' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#FF6B00' }}>{propertyAcres} <span style={{ fontSize: 10, color: '#888' }}>ACRES</span></div>
      </div>
    </div>
  )
}
