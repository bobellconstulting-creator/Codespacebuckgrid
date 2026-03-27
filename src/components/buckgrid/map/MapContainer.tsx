'use client'

import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react'
import { useMapDrawing, type LayerType, type TonyAnnotation } from '../hooks/useMapDrawing'

export interface MapContainerHandle {
  lockBoundary: () => any
  wipeAll: () => void
  getCaptureElement: () => HTMLDivElement | null
  addFeature: (geojson: any, type: string, label: string) => void
  drawTonyAnnotations: (annotations: TonyAnnotation[]) => void
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
    getCaptureElement: () => containerRef.current,
    addFeature: (geojson: any, type: string, label: string) => api.addSmartFeature(geojson, type as any, label)
  }))

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
})

MapContainer.displayName = 'MapContainer'
export default MapContainer
