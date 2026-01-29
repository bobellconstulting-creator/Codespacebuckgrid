'use client'

import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import type { Tool } from '../constants/tools'
import { useMapDrawing, type MapApi } from '../hooks/useMapDrawing'

export type MapContainerHandle = MapApi

const MapContainer = forwardRef<MapContainerHandle, { activeTool: Tool, brushSize: number }>(({ activeTool, brushSize }, ref) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const { api, handlers } = useMapDrawing({ mapContainerRef, overlayRef, activeTool, brushSize })
  useImperativeHandle(ref, () => api, [api])

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {/* Leaflet map lives here */}
      <div
        ref={mapContainerRef}
        style={{ position: 'absolute', inset: 0, zIndex: 1, background: '#000' }}
      />
      {/* Transparent overlay captures pointer events for drawing tools */}
      <div
        ref={overlayRef}
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          touchAction: 'none',
          pointerEvents: activeTool.id === 'nav' ? 'none' : 'auto',
          cursor: activeTool.id === 'nav' ? 'grab' : 'crosshair',
        }}
      />
    </div>
  )
})

export default React.memo(MapContainer)
