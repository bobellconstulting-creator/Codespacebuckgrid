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
  const [brushSize, setBrushSize] = useState(30)
  const [propertyAcres, setPropertyAcres] = useState(0)

  const onLockBorder = useCallback(() => {
    const result = mapRef.current?.lockBoundary()
    if (!result || result.count === 0) return
    setPropertyAcres(result.acres)

    // Build a human-readable layer breakdown for Tony's context
    const { summary } = result
    const parts: string[] = []
    if (summary.food > 0)    parts.push(`${summary.food} food plot${summary.food > 1 ? 's' : ''}`)
    if (summary.bedding > 0) parts.push(`${summary.bedding} bedding area${summary.bedding > 1 ? 's' : ''}`)
    if (summary.water > 0)   parts.push(`${summary.water} water source${summary.water > 1 ? 's' : ''}`)
    if (summary.path > 0)    parts.push(`${summary.path} trail${summary.path > 1 ? 's' : ''}`)
    const layerLine = parts.length > 0 ? ` I can see ${parts.join(', ')}.` : ''

    const contextPrompt =
      `Property locked at ${result.acres} acres.${layerLine}` +
      (result.pathYards > 0 ? ` Total trail: ${result.pathYards} yds.` : '') +
      ` Give me a quick habitat audit.`

    setActiveTool(TOOLS[0])
    // Auto-trigger Tony's visual scan with the spatial context
    chatRef.current?.triggerScan(contextPrompt)
  }, [])

  return (
    <div style={{ height: '100dvh', width: '100vw', background: '#000', overflow: 'hidden', position: 'fixed' }}>
      <MapContainer ref={mapRef} activeTool={activeTool} brushSize={brushSize} />
      <div className="glass" style={{ position: 'absolute', left: 10, top: 10, padding: 12, borderRadius: 12, width: 180 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: '#FF6B00', letterSpacing: 1 }}>BUCKGRID PRO</div>
        <ToolGrid tools={TOOLS} activeToolId={activeTool.id} brushSize={brushSize} onSelectTool={setActiveTool} onBrushSize={setBrushSize} onLockBorder={onLockBorder} onWipeAll={() => { mapRef.current?.wipeAll(); setPropertyAcres(0); }} />
      </div>
      <TonyChat ref={chatRef} getCaptureTarget={() => mapRef.current?.getCaptureElement() ?? null} />
      <div className="glass" style={{ position: 'absolute', left: 10, bottom: 10, padding: '10px 15px', borderRadius: 10, borderLeft: '4px solid #FF6B00' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#FF6B00' }}>{propertyAcres} <span style={{ fontSize: 10, color: '#888' }}>ACRES</span></div>
      </div>
    </div>
  )
}
