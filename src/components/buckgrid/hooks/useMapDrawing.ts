'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Tool } from '../constants/tools'
import type * as LeafletNS from 'leaflet'

type LatLngLike = { lat: number; lng: number }

export type MapApi = {
  lockBoundary: () => number | null
  wipeAll: () => void
  getCaptureElement: () => HTMLElement | null
  getGeoJSON: () => any
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
      mapRef.current = map
    }
    init()
    return () => { mounted = false }
  }, [containerRef])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const L = LRef.current
    if (!mapRef.current || !L || activeToolRef.current.id === 'nav') return
    const rect = containerRef.current!.getBoundingClientRect()
    const latlng = mapRef.current.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top])
    if (activeToolRef.current.id === 'boundary') {
      boundaryPointsRef.current.push({ lat: latlng.lat, lng: latlng.lng })
      L.circleMarker(latlng, { color: '#FF6B00', radius: 5, fillOpacity: 1 }).addTo(boundaryLayerRef.current!)
      if (boundaryPointsRef.current.length > 1) L.polyline(boundaryPointsRef.current as any, { color: '#FF6B00', weight: 4 }).addTo(boundaryLayerRef.current!)
      return
    }
    isDrawingRef.current = true
    tempPathRef.current = L.polyline([latlng], { color: activeToolRef.current.color, weight: brushSizeRef.current, opacity: 0.6 }).addTo(drawnItemsRef.current!)
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
        boundaryPointsRef.current = []
      },
      getCaptureElement: () => containerRef.current,
      getGeoJSON: () => {
        const layers: any[] = []
        
        // Add boundary layer
        if (boundaryPointsRef.current.length > 0) {
          layers.push({
            type: 'Feature',
            properties: { type: 'boundary', acres: calculateAreaAcres(boundaryPointsRef.current) },
            geometry: {
              type: 'Polygon',
              coordinates: [boundaryPointsRef.current.map(p => [p.lng, p.lat])]
            }
          })
        }
        
        // Add drawn items
        drawnItemsRef.current?.eachLayer((layer: any) => {
          if (layer.toGeoJSON) {
            const geoJSON = layer.toGeoJSON()
            geoJSON.properties = { 
              color: layer.options?.color || '#fff',
              weight: layer.options?.weight || 1
            }
            layers.push(geoJSON)
          }
        })
        
        return {
          type: 'FeatureCollection',
          features: layers
        }
      }
    }, 
    handlers: { onPointerDown, onPointerMove, onPointerUp: () => { isDrawingRef.current = false; tempPathRef.current = null } } 
  }
}
