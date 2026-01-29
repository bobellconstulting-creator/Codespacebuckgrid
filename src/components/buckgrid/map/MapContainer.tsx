'use client'

import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import type { Tool } from '../constants/tools'
import { useMapDrawing, type MapApi } from '../hooks/useMapDrawing'

export type MapContainerHandle = MapApi

const MapContainer = forwardRef<MapContainerHandle, { activeTool: Tool, brushSize: number }>(({ activeTool, brushSize }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { api, handlers } = useMapDrawing({ containerRef, activeTool, brushSize })
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

MapContainer.displayName = 'MapContainer'

export default React.memo(MapContainer)
