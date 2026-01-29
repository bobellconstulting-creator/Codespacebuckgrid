'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Tool } from '../constants/tools'
import type * as LeafletNS from 'leaflet'

type LatLngLike = { lat: number; lng: number }

export type MapApi = {
  lockBoundary: () => number | null
  wipeAll: () => void
  getCaptureElement: () => HTMLElement | null
  getMapContext: () => any
  drawAISuggestions: (features: any[]) => void
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

export function useMapDrawing(args: { containerRef: React.RefObject<HTMLDivElement>, activeTool: Tool, brushSize: number }) {
  const { containerRef, activeTool, brushSize } = args
  const LRef = useRef<typeof LeafletNS | null>(null)
  const mapRef = useRef<LeafletNS.Map | null>(null)
  const drawnItemsRef = useRef<LeafletNS.FeatureGroup | null>(null)
  const boundaryLayerRef = useRef<LeafletNS.FeatureGroup | null>(null)
  const aiSuggestionsLayerRef = useRef<LeafletNS.FeatureGroup | null>(null)
  const boundaryPointsRef = useRef<LatLngLike[]>([])
  const tempPathRef = useRef<LeafletNS.Polyline | null>(null)
  const isDrawingRef = useRef(false)

  const activeToolRef = useRef(activeTool)
  const brushSizeRef = useRef(brushSize)
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  useEffect(() => { brushSizeRef.current = brushSize }, [brushSize])

  useEffect(() => {
    let mounted = true
    const init = async () => {
      const leaflet = await import('leaflet')
      if (!mounted || !containerRef.current) return
      LRef.current = leaflet
      const map = leaflet.map(containerRef.current, { center: [38.6583, -96.4937], zoom: 16, zoomControl: false, attributionControl: false })
      leaflet.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, crossOrigin: true }).addTo(map)
      drawnItemsRef.current = new leaflet.FeatureGroup().addTo(map)
      boundaryLayerRef.current = new leaflet.FeatureGroup().addTo(map)
      aiSuggestionsLayerRef.current = new leaflet.FeatureGroup().addTo(map)
      mapRef.current = map
      // Respect initial tool state
      if (activeToolRef.current.id !== 'nav') {
        map.dragging.disable()
        map.doubleClickZoom.disable()
      }
    }
    init()
    return () => { mounted = false }
  }, [containerRef])

  // Toggle map dragging based on active tool
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (activeTool.id === 'nav') {
      map.dragging.enable()
      map.doubleClickZoom.enable()
      if (containerRef.current) containerRef.current.style.cursor = 'grab'
    } else {
      map.dragging.disable()
      map.doubleClickZoom.disable()
      if (containerRef.current) containerRef.current.style.cursor = 'crosshair'
    }
  }, [activeTool, containerRef])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const L = LRef.current
    if (!mapRef.current || !L || activeToolRef.current.id === 'nav') return
    e.currentTarget.setPointerCapture(e.pointerId) // Prevent stroke interruption
    const rect = containerRef.current!.getBoundingClientRect()
    const latlng = mapRef.current.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top])
    if (activeToolRef.current.id === 'boundary') {
      boundaryPointsRef.current.push({ lat: latlng.lat, lng: latlng.lng })
      L.circleMarker(latlng, { color: '#FF6B00', radius: 5, fillOpacity: 1 }).addTo(boundaryLayerRef.current!)
      if (boundaryPointsRef.current.length > 1) L.polyline(boundaryPointsRef.current as any, { color: '#FF6B00', weight: 4 }).addTo(boundaryLayerRef.current!)
      return
    }
    isDrawingRef.current = true
    tempPathRef.current = L.polyline([latlng], { 
      color: activeToolRef.current.color, 
      weight: brushSizeRef.current * 0.5, 
      opacity: 0.6,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(drawnItemsRef.current!)
  }, [containerRef])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current || !tempPathRef.current) return
    const rect = containerRef.current!.getBoundingClientRect()
    tempPathRef.current.addLatLng(mapRef.current!.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top]))
  }, [containerRef])

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
        aiSuggestionsLayerRef.current?.clearLayers()
        boundaryPointsRef.current = []
      },
      getCaptureElement: () => containerRef.current,
      getMapContext: () => {
        const map = mapRef.current
        if (!map) return null
        const bounds = map.getBounds()
        return {
          bounds: {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
          },
          center: map.getCenter(),
          zoom: map.getZoom(),
          drawnFeatures: drawnItemsRef.current?.getLayers().length || 0
        }
      },
      drawAISuggestions: (features: any[]) => {
        const L = LRef.current
        if (!L || !aiSuggestionsLayerRef.current) return
        
        aiSuggestionsLayerRef.current.clearLayers()
        
        features.forEach(feature => {
          const { geometry, properties } = feature
          const color = properties.type === 'bedding' ? '#00FF00' 
            : properties.type === 'food_plot' ? '#FFD700'
            : properties.type === 'travel_corridor' ? '#00BFFF'
            : '#FF00FF'
          
          if (geometry.type === 'Point') {
            L.circleMarker(geometry.coordinates.reverse(), {
              color,
              radius: 8,
              fillOpacity: 0.6,
              weight: 3
            }).bindPopup(`<b>${properties.label || properties.type}</b>${properties.notes ? '<br>' + properties.notes : ''}`)
              .addTo(aiSuggestionsLayerRef.current!)
          } else if (geometry.type === 'Polygon') {
            L.polygon(geometry.coordinates[0].map((c: number[]) => [c[1], c[0]]), {
              color,
              weight: 3,
              fillOpacity: 0.2
            }).bindPopup(`<b>${properties.label || properties.type}</b>${properties.notes ? '<br>' + properties.notes : ''}`)
              .addTo(aiSuggestionsLayerRef.current!)
          } else if (geometry.type === 'LineString') {
            L.polyline(geometry.coordinates.map((c: number[]) => [c[1], c[0]]), {
              color,
              weight: 4,
              opacity: 0.7
            }).bindPopup(`<b>${properties.label || properties.type}</b>${properties.notes ? '<br>' + properties.notes : ''}`)
              .addTo(aiSuggestionsLayerRef.current!)
          }
        })
      }
    }, 
    handlers: { onPointerDown, onPointerMove, onPointerUp: () => { isDrawingRef.current = false; tempPathRef.current = null } } 
  }
}
