'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Tool } from '../constants/tools'
import type * as LeafletNS from 'leaflet'

type LatLngLike = { lat: number; lng: number }

type GeoJSONFeature = {
  type: 'Feature'
  geometry: { type: string; coordinates: number[] | number[][] | number[][][] }
  properties: Record<string, string>
}

type SuggestedFeatures = {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

export type MapApi = {
  lockBoundary: () => number | null
  wipeAll: () => void
  getCaptureElement: () => HTMLElement | null
  getBoundaryGeoJSON: () => object | null
  renderSuggestedFeatures: (fc: SuggestedFeatures) => void
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
  const suggestedLayerRef = useRef<LeafletNS.FeatureGroup | null>(null)
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
      suggestedLayerRef.current = new leaflet.FeatureGroup().addTo(map)
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
        suggestedLayerRef.current?.clearLayers()
        boundaryPointsRef.current = []
      },
      getCaptureElement: () => containerRef.current,
      getBoundaryGeoJSON: () => {
        const pts = boundaryPointsRef.current
        if (pts.length < 3) return null
        const coords = pts.map(p => [p.lng, p.lat])
        coords.push(coords[0]) // close ring
        return {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coords] },
          properties: { acres: calculateAreaAcres(pts) }
        }
      },
      renderSuggestedFeatures: (fc: SuggestedFeatures) => {
        const L = LRef.current
        if (!L || !suggestedLayerRef.current) return
        suggestedLayerRef.current.clearLayers()
        const styleMap: Record<string, { color: string; icon: string }> = {
          stand_location: { color: '#ef4444', icon: '🏹' },
          suggested_trail: { color: '#facc15', icon: '' },
          food_plot: { color: '#4ade80', icon: '🌱' },
          bedding_area: { color: '#713f12', icon: '🛏️' },
          water_source: { color: '#38bdf8', icon: '💧' },
        }
        for (const f of fc.features) {
          const ptype = f.properties?.type || ''
          const style = styleMap[ptype] || { color: '#ffffff', icon: '📍' }
          const { geometry } = f
          if (geometry.type === 'Point') {
            const [lng, lat] = geometry.coordinates as number[]
            const icon = L.divIcon({ html: `<div style="font-size:24px;text-shadow:0 0 4px #000">${style.icon || '📍'}</div>`, className: '', iconSize: [28, 28], iconAnchor: [14, 14] })
            const marker = L.marker([lat, lng], { icon }).addTo(suggestedLayerRef.current!)
            if (f.properties?.reason) marker.bindPopup(`<b>${ptype}</b><br/>${f.properties.reason}`)
          } else if (geometry.type === 'LineString') {
            const coords = (geometry.coordinates as number[][]).map(c => [c[1], c[0]] as [number, number])
            L.polyline(coords, { color: style.color, weight: 3, dashArray: f.properties?.style === 'dashed' ? '8 6' : undefined, opacity: 0.9 }).addTo(suggestedLayerRef.current!)
          } else if (geometry.type === 'Polygon') {
            const coords = (geometry.coordinates as number[][][])[0].map(c => [c[1], c[0]] as [number, number])
            L.polygon(coords, { color: style.color, weight: 2, fillOpacity: 0.25 }).addTo(suggestedLayerRef.current!)
          }
        }
      }
    },
    handlers: { onPointerDown, onPointerMove, onPointerUp: () => { isDrawingRef.current = false; tempPathRef.current = null } }
  }
}
