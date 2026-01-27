'use client'

import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import type { Tool } from '../constants/tools'
import { useMapDrawing, type MapApi } from '../hooks/useMapDrawing'

export type MapContainerHandle = MapApi

const MapContainer = forwardRef<MapContainerHandle, { 
  activeTool: Tool, 
  brushSize: number, 
  isDrawMode: boolean,
  onModeChange: (mode: 'PAN' | 'DRAW') => void,
  onBlockMessage: () => void,
  suggestedMarks?: any[],
  onFeatureCreated?: (feature: { type: string, name: string, acres: number, note?: string, geometry?: any, coordinates?: [number, number] }) => void
}>(({ activeTool, brushSize, isDrawMode, onModeChange, onBlockMessage, suggestedMarks, onFeatureCreated }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { api, handlers } = useMapDrawing({ 
    containerRef, 
    activeTool, 
    brushSize, 
    isDrawMode,
    onModeChange,
    onBlockMessage,
    suggestedMarks,
    onFeatureCreated
  })
  useImperativeHandle(ref, () => api, [api])

  return (
    <div
      ref={containerRef}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      style={{ height: '100%', width: '100%', zIndex: 1, touchAction: 'none', background: '#000' }}
    />
  )
})

export default React.memo(MapContainer)
