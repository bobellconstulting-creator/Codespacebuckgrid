'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Tool } from '../constants/tools'
import type * as LeafletNS from 'leaflet'

type LatLngLike = { lat: number; lng: number }

export type BlueprintFeature = {
  type: 'Feature'
  geometry: { type: string; coordinates: any }
  properties: { label: string; zone: 'forage' | 'screening' }
}

const ZONE_COLORS: Record<string, string> = {
  forage: '#2D5A1E',
  screening: '#ef4444',
}

export type DrawnShape = {
  toolId: string
  toolName: string
  color: string
  coords: [number, number][] // [lat, lng] pairs
}

export type MapApi = {
  lockBoundary: () => number | null
  wipeAll: () => void
  getCaptureElement: () => HTMLElement | null
  getBoundaryGeoJSON: () => object | null
  getDrawnShapes: () => DrawnShape[]
  drawBlueprint: (features: BlueprintFeature[]) => void
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
  const blueprintLayerRef = useRef<LeafletNS.FeatureGroup | null>(null)
  const boundaryPointsRef = useRef<LatLngLike[]>([])
  const tempPathRef = useRef<LeafletNS.Polyline | null>(null)
  const isDrawingRef = useRef(false)
  const drawnShapesRef = useRef<DrawnShape[]>([])

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
      const map = leaflet.map(containerRef.current, { center: [38.6583, -96.4937], zoom: 16, zoomControl: false, attributionControl: false, zoomSnap: 0.1, zoomDelta: 0.5, wheelDebounceTime: 80, wheelPxPerZoomLevel: 120 })
      leaflet.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, crossOrigin: true }).addTo(map)
      drawnItemsRef.current = new leaflet.FeatureGroup().addTo(map)
      boundaryLayerRef.current = new leaflet.FeatureGroup().addTo(map)
      blueprintLayerRef.current = new leaflet.FeatureGroup().addTo(map)
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
        blueprintLayerRef.current?.clearLayers()
        boundaryPointsRef.current = []
        drawnShapesRef.current = []
      },
      getCaptureElement: () => containerRef.current,
      getBoundaryGeoJSON: () => {
        const pts = boundaryPointsRef.current
        if (pts.length < 3) return null
        // GeoJSON uses [lng, lat] order, closed ring
        const coords = pts.map(p => [p.lng, p.lat])
        coords.push(coords[0]) // close the ring
        return {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coords] },
          properties: { acres: calculateAreaAcres(pts) }
        }
      },
      getDrawnShapes: () => drawnShapesRef.current,
      drawBlueprint: (features: BlueprintFeature[]) => {
        const L = LRef.current
        const map = mapRef.current
        if (!L || !map || !blueprintLayerRef.current) return

        // Disable drag pan while Tony draws
        map.dragging.disable()
        map.touchZoom.disable()
        map.doubleClickZoom.disable()
        map.scrollWheelZoom.disable()

        // Clear previous blueprint
        blueprintLayerRef.current.clearLayers()

        for (const feature of features) {
          const color = ZONE_COLORS[feature.properties.zone] || '#ffffff'
          const geom = feature.geometry

          if (geom.type === 'Polygon') {
            // GeoJSON coords are [lng, lat], Leaflet needs [lat, lng]
            const latLngs = geom.coordinates[0].map((c: number[]) => [c[1], c[0]])
            const poly = L.polygon(latLngs, {
              color,
              weight: 3,
              fillColor: color,
              fillOpacity: 0.35,
            })
            poly.bindTooltip(feature.properties.label, { permanent: true, direction: 'center', className: 'blueprint-label' })
            poly.addTo(blueprintLayerRef.current!)
          } else if (geom.type === 'LineString') {
            const latLngs = geom.coordinates.map((c: number[]) => [c[1], c[0]])
            const line = L.polyline(latLngs, {
              color,
              weight: 6,
              opacity: 0.8,
            })
            line.bindTooltip(feature.properties.label, { permanent: true, direction: 'center', className: 'blueprint-label' })
            line.addTo(blueprintLayerRef.current!)
          }
        }

        // Re-enable interaction after a short delay so user can see the result
        setTimeout(() => {
          map.dragging.enable()
          map.touchZoom.enable()
          map.doubleClickZoom.enable()
          map.scrollWheelZoom.enable()
        }, 1500)
      }
    },
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: () => {
        if (isDrawingRef.current && tempPathRef.current) {
          const latlngs = tempPathRef.current.getLatLngs() as LeafletNS.LatLng[]
          if (latlngs.length > 1) {
            drawnShapesRef.current.push({
              toolId: activeToolRef.current.id,
              toolName: activeToolRef.current.name,
              color: activeToolRef.current.color,
              coords: latlngs.map(ll => [ll.lat, ll.lng] as [number, number])
            })
          }
        }
        isDrawingRef.current = false
        tempPathRef.current = null
      }
    }
  }
}
