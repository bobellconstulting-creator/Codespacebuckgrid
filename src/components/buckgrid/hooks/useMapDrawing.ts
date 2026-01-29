'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Tool } from '../constants/tools'
import type * as LeafletNS from 'leaflet'
import type { Feature, FeatureCollection, LineString, Polygon } from 'geojson'

type LatLngLike = { lat: number; lng: number }

type DrawnPath = {
  toolId: string
  color: string
  points: LatLngLike[]
}

export type MapContext = {
  bounds?: { north: number; south: number; east: number; west: number }
  center?: { lat: number; lng: number }
  zoom?: number
  boundary?: Feature<Polygon> | null
  focusFeatures: Feature<LineString>[]
  userDrawn: FeatureCollection
}

export type MapApi = {
  lockBoundary: () => number | null
  wipeAll: () => void
  getCaptureElement: () => HTMLElement | null
  getMapContext: () => MapContext | null
  drawAISuggestions: (features: Feature[]) => void
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
  const drawnPathsRef = useRef<DrawnPath[]>([])
  const currentPathRef = useRef<DrawnPath | null>(null)

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
    const tool = activeToolRef.current
    currentPathRef.current = { toolId: tool.id, color: tool.color, points: [{ lat: latlng.lat, lng: latlng.lng }] }
    tempPathRef.current = L.polyline([latlng], { 
      color: tool.color, 
      weight: brushSizeRef.current * 0.5, 
      opacity: 0.6,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(drawnItemsRef.current!)
  }, [containerRef])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current || !tempPathRef.current) return
    const rect = containerRef.current!.getBoundingClientRect()
    const latlng = mapRef.current!.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top])
    tempPathRef.current.addLatLng(latlng)
    if (currentPathRef.current) currentPathRef.current.points.push({ lat: latlng.lat, lng: latlng.lng })
  }, [containerRef])

  const onPointerUp = useCallback(() => {
    isDrawingRef.current = false
    tempPathRef.current = null
    if (currentPathRef.current && currentPathRef.current.points.length > 1) {
      drawnPathsRef.current.push(currentPathRef.current)
    }
    currentPathRef.current = null
  }, [])

  const toGeoJSONLine = (path: DrawnPath): Feature<LineString> => ({
    type: 'Feature',
    properties: { toolId: path.toolId, color: path.color },
    geometry: {
      type: 'LineString',
      coordinates: path.points.map(pt => [pt.lng, pt.lat])
    }
  })

  const buildBoundaryFeature = (): Feature<Polygon> | null => {
    if (boundaryPointsRef.current.length < 3) return null
    return {
      type: 'Feature',
      properties: { type: 'property_boundary' },
      geometry: {
        type: 'Polygon',
        coordinates: [[...boundaryPointsRef.current, boundaryPointsRef.current[0]].map(pt => [pt.lng, pt.lat])]
      }
    }
  }

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
        drawnPathsRef.current = []
        currentPathRef.current = null
      },
      getCaptureElement: () => containerRef.current,
      getMapContext: () => {
        const map = mapRef.current
        if (!map) return null
        const bounds = map.getBounds()
        const boundary = buildBoundaryFeature()
        const features = drawnPathsRef.current.map(toGeoJSONLine)
        const focusFeatures = features.filter(f => f.properties?.toolId === 'focus') as Feature<LineString>[]
        const center = map.getCenter()
        return {
          bounds: {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
          },
          center: { lat: center.lat, lng: center.lng },
          zoom: map.getZoom(),
          boundary,
          focusFeatures,
          userDrawn: {
            type: 'FeatureCollection',
            features
          }
        }
      },
      drawAISuggestions: (features: Feature[]) => {
        const L = LRef.current
        if (!L || !aiSuggestionsLayerRef.current) return
        
        aiSuggestionsLayerRef.current.clearLayers()
        
        features.forEach(feature => {
          const { geometry, properties = {} } = feature
          if (!geometry) return
          const color = properties.type === 'bedding' ? '#00FF6A' 
            : properties.type === 'food_plot' ? '#F4C95D'
            : properties.type === 'travel_corridor' ? '#38BDF8'
            : '#C084FC'
          
          if (geometry.type === 'Point') {
            const [lng, lat] = geometry.coordinates as [number, number]
            L.circleMarker([lat, lng], {
              color,
              radius: 8,
              fillOpacity: 0.6,
              weight: 3
            }).bindPopup(`<b>${properties.label || properties.type || 'Suggestion'}</b>${properties.notes ? '<br>' + properties.notes : ''}`)
              .addTo(aiSuggestionsLayerRef.current!)
          } else if (geometry.type === 'Polygon') {
            const ring = geometry.coordinates?.[0] || []
            L.polygon(ring.map((c: number[]) => [c[1], c[0]]), {
              color,
              weight: 3,
              fillOpacity: 0.2
            }).bindPopup(`<b>${properties.label || properties.type || 'Suggestion'}</b>${properties.notes ? '<br>' + properties.notes : ''}`)
              .addTo(aiSuggestionsLayerRef.current!)
          } else if (geometry.type === 'LineString') {
            L.polyline(geometry.coordinates.map((c: number[]) => [c[1], c[0]]), {
              color,
              weight: 4,
              opacity: 0.7
            }).bindPopup(`<b>${properties.label || properties.type || 'Suggestion'}</b>${properties.notes ? '<br>' + properties.notes : ''}`)
              .addTo(aiSuggestionsLayerRef.current!)
          }
        })
      }
    }, 
    handlers: { onPointerDown, onPointerMove, onPointerUp } 
  }
}
