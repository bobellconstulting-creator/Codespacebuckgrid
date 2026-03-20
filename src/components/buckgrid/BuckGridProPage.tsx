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
    <div className="h-screen w-screen bg-neural-noir-primary overflow-hidden fixed">
      <MapContainer ref={mapRef} activeTool={activeTool} brushSize={brushSize} />
      <div className="bg-neural-noir-secondary bg-opacity-80 backdrop-blur-lg p-3 rounded-neural shadow-neural-bold absolute left-3 top-3 w-48">
        <div className="text-xs font-bold text-neural-noir-accent uppercase tracking-wide">BuckGrid Pro</div>
        <ToolGrid tools={TOOLS} activeToolId={activeTool.id} brushSize={brushSize} onSelectTool={setActiveTool} onBrushSize={setBrushSize} onLockBorder={onLockBorder} onWipeAll={() => { mapRef.current?.wipeAll(); setPropertyAcres(0); }} />
      </div>
      <TonyChat ref={chatRef} getCaptureTarget={() => mapRef.current?.getCaptureElement() ?? null} />
      <div className="bg-neural-noir-secondary bg-opacity-80 backdrop-blur-lg p-3 rounded-neural border-l-4 border-neural-noir-accent absolute left-3 bottom-3">
        <div className="text-xl font-bold text-neural-noir-accent">{propertyAcres} <span className="text-xs text-neural-noir-text opacity-70">ACRES</span></div>
      </div>
    </div>
  )
}
