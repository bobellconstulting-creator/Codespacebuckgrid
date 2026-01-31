'use client'

import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react'
import { useMapDrawing, type LayerType } from '../hooks/useMapDrawing'

export interface MapContainerHandle {
  lockBoundary: () => any // CHANGED: Returns full object, not just number
  wipeAll: () => void
  getCaptureElement: () => HTMLDivElement | null
}

interface Props {
  activeTool: any
  brushSize: number
}

const MapContainer = forwardRef<MapContainerHandle, Props>(({ activeTool, brushSize }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Initialize the Ferrari Engine
  const { api } = useMapDrawing({ 
    containerRef, 
    activeTool: activeTool.id, 
    brushSize 
  })

  useImperativeHandle(ref, () => ({
    // PASS THE FULL DATA PACKET
    lockBoundary: () => {
      const stats = api.lockAndBake()
      return stats // Returns { count, acres, pathYards, layers }
    },
    wipeAll: () => api.clearAll(),
    getCaptureElement: () => containerRef.current
  }))

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
})

MapContainer.displayName = 'MapContainer'
export default MapContainer
