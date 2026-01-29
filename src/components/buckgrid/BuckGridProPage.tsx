'use client'

import React, { useCallback, useRef, useState } from 'react'
import MapContainer, { type MapContainerHandle } from './map/MapContainer'
import ToolGrid from './ui/ToolGrid'
import TonyChat, { type TonyChatHandle } from './chat/TonyChat'
import { TOOLS, type Tool } from './constants/tools'
import type { BlueprintFeature, TonySuggestedShape } from './hooks/useMapDrawing'

export default function BuckGridProPage() {
  const mapRef = useRef<MapContainerHandle>(null)
  const chatRef = useRef<TonyChatHandle>(null)
  const [activeTool, setActiveTool] = useState<Tool>(TOOLS[0])
  const [brushSize, setBrushSize] = useState(30)
  const [propertyAcres, setPropertyAcres] = useState(0)

  const onLockBorder = useCallback(() => {
    const acres = mapRef.current?.lockBoundary()
    if (!acres) return
    setPropertyAcres(acres)
    chatRef.current?.updateAcres(acres)
    setActiveTool(TOOLS[0])
  }, [])

  const handleBlueprintReceived = useCallback((features: BlueprintFeature[]) => {
    mapRef.current?.drawBlueprint(features)
  }, [])

  const handleSuggestionsReceived = useCallback((shapes: TonySuggestedShape[]) => {
    mapRef.current?.drawSuggestions(shapes)
  }, [])

  const handleApplySuggestions = useCallback(() => {
    return mapRef.current?.applySuggestions() ?? 0
  }, [])

  const handleClearSuggestions = useCallback(() => {
    mapRef.current?.clearSuggestions()
  }, [])

  const getBoundaryGeoJSON = useCallback(() => {
    return mapRef.current?.getBoundaryGeoJSON() ?? null
  }, [])

  const getDrawnShapes = useCallback(() => {
    return mapRef.current?.getDrawnShapes() ?? []
  }, [])

  return (
    <div style={{ height: '100dvh', width: '100vw', background: '#000', overflow: 'hidden', position: 'fixed' }}>
      <MapContainer ref={mapRef} activeTool={activeTool} brushSize={brushSize} />
      <div className="glass" style={{ position: 'absolute', left: 10, top: 10, padding: 12, borderRadius: 12, width: 180 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: '#FF6B00', letterSpacing: 1 }}>BUCKGRID PRO</div>
        <ToolGrid tools={TOOLS} activeToolId={activeTool.id} brushSize={brushSize} onSelectTool={setActiveTool} onBrushSize={setBrushSize} onLockBorder={onLockBorder} onWipeAll={() => { mapRef.current?.wipeAll(); setPropertyAcres(0); }} />
      </div>
      <TonyChat
        ref={chatRef}
        getCaptureTarget={() => mapRef.current?.getCaptureElement() ?? null}
        getBoundaryGeoJSON={getBoundaryGeoJSON}
        getDrawnShapes={getDrawnShapes}
        onBlueprintReceived={handleBlueprintReceived}
        onSuggestionsReceived={handleSuggestionsReceived}
        onApplySuggestions={handleApplySuggestions}
        onClearSuggestions={handleClearSuggestions}
        propertyAcres={propertyAcres}
      />
      <div className="glass" style={{ position: 'absolute', left: 10, bottom: 10, padding: '10px 15px', borderRadius: 10, borderLeft: '4px solid #FF6B00' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#FF6B00' }}>{propertyAcres} <span style={{ fontSize: 10, color: '#888' }}>ACRES</span></div>
      </div>
    </div>
  )
}
