'use client'

import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import { useMapDrawing, type LayerType, type TonyAnnotation, type LayerSummary } from '../hooks/useMapDrawing'

export interface MapContainerHandle {
  lockBoundary: () => { count: number; acres: number; pathYards: number; layers: any[]; summary: LayerSummary }
  wipeAll: () => void
  getCaptureElement: () => HTMLDivElement | null
  addFeature: (geojson: any, type: string, label: string) => void
  drawTonyAnnotations: (annotations: TonyAnnotation[]) => void
  getBoundsAndFeatures: () => { bounds: { north: number; south: number; east: number; west: number }; zoom: number; features: any[] } | null
  flyTo: (lat: number, lng: number, zoom: number) => void
}

interface Props {
  activeTool: any
  brushSize: number
}

const MapContainer = forwardRef<MapContainerHandle, Props>(({ activeTool, brushSize }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)

  const { api } = useMapDrawing({
    containerRef,
    activeTool: activeTool.id,
    brushSize
  })

  useImperativeHandle(ref, () => ({
    lockBoundary: () => api.lockAndBake(),
    wipeAll: () => api.clearAll(),
    getCaptureElement: () => containerRef.current,
    addFeature: (geojson: any, type: string, label: string) => api.addSmartFeature(geojson, type as LayerType, label),
    drawTonyAnnotations: (annotations: TonyAnnotation[]) => api.drawAnnotations(annotations),
    getBoundsAndFeatures: () => api.getBoundsAndFeatures(),
    flyTo: (lat: number, lng: number, zoom: number) => api.flyTo([lat, lng], zoom),
  }))

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
})

MapContainer.displayName = 'MapContainer'
export default MapContainer
