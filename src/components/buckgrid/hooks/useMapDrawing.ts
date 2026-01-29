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

export type TonySuggestedShape = {
  type: 'sneak_trail' | 'forage_zone' | 'screen_zone'
  label: string
  coords: [number, number][] // [lat, lng] pairs
  convertTo: 'clover' | 'egyptian' | 'switchgrass' | 'corn' | 'soybeans' | 'bedding'
}

const ZONE_COLORS: Record<string, string> = {
  forage: '#2D5A1E',
  screening: '#ef4444',
}

const CONVERT_COLORS: Record<string, string> = {
  clover: '#4ade80',
  egyptian: '#fb923c',
  switchgrass: '#fdba74',
  corn: '#fbbf24',
  soybeans: '#166534',
  bedding: '#713f12',
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
  drawSuggestions: (shapes: TonySuggestedShape[]) => void
  applySuggestions: () => number
  clearSuggestions: () => void
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
  const suggestionLayerRef = useRef<LeafletNS.FeatureGroup | null>(null)
  const boundaryPointsRef = useRef<LatLngLike[]>([])
  const tempPathRef = useRef<LeafletNS.Polyline | null>(null)
  const isDrawingRef = useRef(false)
  const drawnShapesRef = useRef<DrawnShape[]>([])
  const pendingSuggestionsRef = useRef<TonySuggestedShape[]>([])

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
      suggestionLayerRef.current = new leaflet.FeatureGroup().addTo(map)
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
        suggestionLayerRef.current?.clearLayers()
        boundaryPointsRef.current = []
        drawnShapesRef.current = []
        pendingSuggestionsRef.current = []
      },
      getCaptureElement: () => containerRef.current,
      getBoundaryGeoJSON: () => {
        const pts = boundaryPointsRef.current
        if (pts.length < 3) return null
        const coords = pts.map(p => [p.lng, p.lat])
        coords.push(coords[0])
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

        map.dragging.disable()
        map.touchZoom.disable()
        map.doubleClickZoom.disable()
        map.scrollWheelZoom.disable()

        blueprintLayerRef.current.clearLayers()

        for (const feature of features) {
          const color = ZONE_COLORS[feature.properties.zone] || '#ffffff'
          const geom = feature.geometry

          if (geom.type === 'Polygon') {
            const latLngs = geom.coordinates[0].map((c: number[]) => [c[1], c[0]])
            const poly = L.polygon(latLngs, { color, weight: 3, fillColor: color, fillOpacity: 0.35 })
            poly.bindTooltip(feature.properties.label, { permanent: true, direction: 'center', className: 'blueprint-label' })
            poly.addTo(blueprintLayerRef.current!)
          } else if (geom.type === 'LineString') {
            const latLngs = geom.coordinates.map((c: number[]) => [c[1], c[0]])
            const line = L.polyline(latLngs, { color, weight: 6, opacity: 0.8 })
            line.bindTooltip(feature.properties.label, { permanent: true, direction: 'center', className: 'blueprint-label' })
            line.addTo(blueprintLayerRef.current!)
          }
        }

        setTimeout(() => {
          map.dragging.enable()
          map.touchZoom.enable()
          map.doubleClickZoom.enable()
          map.scrollWheelZoom.enable()
        }, 1500)
      },

      // Tony suggestion layer — red dashed lines
      drawSuggestions: (shapes: TonySuggestedShape[]) => {
        const L = LRef.current
        const map = mapRef.current
        if (!L || !map || !suggestionLayerRef.current) return

        map.dragging.disable()
        map.touchZoom.disable()
        map.doubleClickZoom.disable()
        map.scrollWheelZoom.disable()

        suggestionLayerRef.current.clearLayers()
        pendingSuggestionsRef.current = shapes

        for (const shape of shapes) {
          const latLngs = shape.coords.map(c => [c[0], c[1]] as [number, number])

          if (shape.type === 'sneak_trail') {
            // Red dashed line — ~6ft width at farm zoom = 4px
            const line = L.polyline(latLngs, {
              color: '#ef4444',
              weight: 4,
              opacity: 0.9,
              dashArray: '10, 8',
              dashOffset: '0',
            })
            line.bindTooltip(shape.label, { permanent: true, direction: 'center', className: 'blueprint-label' })
            line.addTo(suggestionLayerRef.current!)
          } else {
            // Forage/screen zones — red dashed polygon
            const poly = L.polygon(latLngs, {
              color: '#ef4444',
              weight: 3,
              fillColor: '#ef4444',
              fillOpacity: 0.15,
              dashArray: '10, 8',
            })
            poly.bindTooltip(shape.label, { permanent: true, direction: 'center', className: 'blueprint-label' })
            poly.addTo(suggestionLayerRef.current!)
          }
        }

        setTimeout(() => {
          map.dragging.enable()
          map.touchZoom.enable()
          map.doubleClickZoom.enable()
          map.scrollWheelZoom.enable()
        }, 1500)
      },

      // Convert pending suggestions into permanent drawn shapes
      applySuggestions: () => {
        const L = LRef.current
        if (!L || !drawnItemsRef.current) return 0

        const pending = pendingSuggestionsRef.current
        if (pending.length === 0) return 0

        for (const shape of pending) {
          const color = CONVERT_COLORS[shape.convertTo] || '#ef4444'
          const latLngs = shape.coords.map(c => [c[0], c[1]] as [number, number])

          if (shape.type === 'sneak_trail') {
            L.polyline(latLngs, { color, weight: 4, opacity: 0.7 }).addTo(drawnItemsRef.current!)
          } else {
            L.polygon(latLngs, { color, weight: 3, fillColor: color, fillOpacity: 0.35 }).addTo(drawnItemsRef.current!)
          }

          // Register as drawn shape for spatial context
          drawnShapesRef.current.push({
            toolId: shape.convertTo,
            toolName: shape.convertTo.toUpperCase(),
            color,
            coords: shape.coords
          })
        }

        // Clear suggestion layer — they're now permanent
        suggestionLayerRef.current?.clearLayers()
        const count = pending.length
        pendingSuggestionsRef.current = []
        return count
      },

      clearSuggestions: () => {
        suggestionLayerRef.current?.clearLayers()
        pendingSuggestionsRef.current = []
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
