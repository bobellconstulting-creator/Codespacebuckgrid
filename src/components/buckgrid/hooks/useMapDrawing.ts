'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Tool } from '../constants/tools'
import type * as LeafletNS from 'leaflet'

type LatLngLike = { lat: number; lng: number }

export type DrawnFeature = {
  toolId: string
  toolName: string
  color: string
  latlngs: LatLngLike[]
}

export type MapApi = {
  lockBoundary: () => number | null
  wipeAll: () => void
  getCaptureElement: () => HTMLElement | null
  getDrawnFeatures: () => DrawnFeature[]
}

function calculateAreaAcres(pts: LatLngLike[]) {
  if (pts.length < 3) return 0
  const radius = 6378137
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i]
    const p2 = pts[(i + 1) % pts.length]
    area += (p2.lng - p1.lng) * (Math.PI / 180) * (2 + Math.sin(p1.lat * (Math.PI / 180)) + Math.sin(p2.lat * (Math.PI / 180)))
  }
  return Number((Math.abs((area * radius * radius) / 2.0) * 0.000247105).toFixed(2))
}

export function useMapDrawing(args: {
  mapContainerRef: React.RefObject<HTMLDivElement>
  overlayRef: React.RefObject<HTMLDivElement>
  activeTool: Tool
  brushSize: number
}) {
  const { mapContainerRef, overlayRef, activeTool, brushSize } = args
  const LRef = useRef<typeof LeafletNS | null>(null)
  const mapRef = useRef<LeafletNS.Map | null>(null)
  const drawnItemsRef = useRef<LeafletNS.FeatureGroup | null>(null)
  const boundaryLayerRef = useRef<LeafletNS.FeatureGroup | null>(null)
  const boundaryPointsRef = useRef<LatLngLike[]>([])
  const tempPathRef = useRef<LeafletNS.Polyline | null>(null)
  const isDrawingRef = useRef(false)
  const drawnFeaturesRef = useRef<DrawnFeature[]>([])
  const currentFeatureRef = useRef<DrawnFeature | null>(null)

  const activeToolRef = useRef(activeTool)
  const brushSizeRef = useRef(brushSize)
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  useEffect(() => { brushSizeRef.current = brushSize }, [brushSize])

  // Toggle map dragging and overlay pointer-events based on active tool
  useEffect(() => {
    const map = mapRef.current
    const overlay = overlayRef.current
    if (activeTool.id === 'nav') {
      map?.dragPan.enable()
      map?.scrollWheelZoom.enable()
      if (overlay) overlay.style.pointerEvents = 'none'
    } else {
      map?.dragPan.disable()
      if (overlay) overlay.style.pointerEvents = 'auto'
    }
  }, [activeTool, overlayRef])

  // Initialize Leaflet map
  useEffect(() => {
    let mounted = true
    const init = async () => {
      const leaflet = await import('leaflet')
      if (!mounted || !mapContainerRef.current) return
      LRef.current = leaflet
      const map = leaflet.map(mapContainerRef.current, {
        center: [38.6583, -96.4937],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      })
      leaflet.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, crossOrigin: true }
      ).addTo(map)
      drawnItemsRef.current = new leaflet.FeatureGroup().addTo(map)
      boundaryLayerRef.current = new leaflet.FeatureGroup().addTo(map)
      mapRef.current = map

      // Apply initial tool state
      if (activeToolRef.current.id !== 'nav') {
        map.dragPan.disable()
        if (overlayRef.current) overlayRef.current.style.pointerEvents = 'auto'
      }
    }
    init()
    return () => { mounted = false }
  }, [mapContainerRef, overlayRef])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const L = LRef.current
    if (!mapRef.current || !L || activeToolRef.current.id === 'nav') return

    const rect = mapContainerRef.current!.getBoundingClientRect()
    const latlng = mapRef.current.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top])

    if (activeToolRef.current.id === 'boundary') {
      boundaryPointsRef.current.push({ lat: latlng.lat, lng: latlng.lng })
      L.circleMarker(latlng, { color: '#FF6B00', radius: 5, fillOpacity: 1 }).addTo(boundaryLayerRef.current!)
      if (boundaryPointsRef.current.length > 1) {
        L.polyline(boundaryPointsRef.current as any, { color: '#FF6B00', weight: 4 }).addTo(boundaryLayerRef.current!)
      }
      return
    }

    isDrawingRef.current = true
    const tool = activeToolRef.current
    currentFeatureRef.current = {
      toolId: tool.id, toolName: tool.name, color: tool.color,
      latlngs: [{ lat: latlng.lat, lng: latlng.lng }],
    }
    tempPathRef.current = L.polyline([latlng], {
      color: tool.color, weight: brushSizeRef.current, opacity: 0.6,
    }).addTo(drawnItemsRef.current!)
  }, [mapContainerRef])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current || !tempPathRef.current || !mapRef.current) return
    e.preventDefault()
    const rect = mapContainerRef.current!.getBoundingClientRect()
    const latlng = mapRef.current.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top])
    tempPathRef.current.addLatLng(latlng)
    currentFeatureRef.current?.latlngs.push({ lat: latlng.lat, lng: latlng.lng })
  }, [mapContainerRef])

  const onPointerUp = useCallback(() => {
    if (isDrawingRef.current && currentFeatureRef.current && currentFeatureRef.current.latlngs.length > 1) {
      drawnFeaturesRef.current.push(currentFeatureRef.current)
    }
    isDrawingRef.current = false
    tempPathRef.current = null
    currentFeatureRef.current = null
  }, [])

  return {
    api: {
      lockBoundary: () => {
        const acres = calculateAreaAcres(boundaryPointsRef.current)
        if (!acres) return null
        boundaryLayerRef.current?.clearLayers()
        LRef.current!.polygon(boundaryPointsRef.current as any, { color: '#FF6B00', weight: 5, fillOpacity: 0.15 }).addTo(boundaryLayerRef.current!)
        return acres
      },
      wipeAll: () => {
        drawnItemsRef.current?.clearLayers()
        boundaryLayerRef.current?.clearLayers()
        boundaryPointsRef.current = []
        drawnFeaturesRef.current = []
      },
      getCaptureElement: () => mapContainerRef.current,
      getDrawnFeatures: () => [...drawnFeaturesRef.current],
    },
    handlers: { onPointerDown, onPointerMove, onPointerUp },
  }
}
