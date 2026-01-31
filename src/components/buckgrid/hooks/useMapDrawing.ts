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
  type?: string
  acres?: number
  isExternal?: boolean
}

export type MapContext = {
  bounds?: { north: number; south: number; east: number; west: number }
  center?: { lat: number; lng: number }
  zoom?: number
  boundary?: Feature<Polygon> | null
  focusFeatures: Feature<LineString>[]
  userDrawn: FeatureCollection
  sceneGraphLite?: {
    boundary: { acres: number, locked: boolean },
    features: Array<{ id: string, type: string, acres?: number, label?: string }>,
    totalsByType: Record<string, { count: number, acres?: number }>
  }
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

function pointInPolygon(point: LatLngLike, polygon: LatLngLike[]): boolean {
  if (polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat
    const xj = polygon[j].lng, yj = polygon[j].lat
    const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
      (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

export function useMapDrawing(args: { containerRef: React.RefObject<HTMLDivElement>, activeTool: Tool, brushSize: number }) {
  const { containerRef, activeTool, brushSize } = args
  const LRef = useRef<typeof LeafletNS | null>(null)
  const mapRef = useRef<LeafletNS.Map | null>(null)
  const drawnItemsRef = useRef<LeafletNS.FeatureGroup | null>(null)
  const boundaryLayerRef = useRef<LeafletNS.FeatureGroup | null>(null)
  // Store locked boundary and acres
  const lockedBoundaryRef = useRef<Feature<Polygon> | null>(null)
  const lockedAcresRef = useRef<number>(0)
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
      map.scrollWheelZoom.enable()
      map.touchZoom.enable()
      if (containerRef.current) containerRef.current.style.cursor = 'grab'
    } else {
      map.dragging.disable()
      map.doubleClickZoom.disable()
      map.scrollWheelZoom.disable()
      map.touchZoom.disable()
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
    currentPathRef.current = { 
      toolId: tool.id, 
      color: tool.color, 
      type: tool.type,
      points: [{ lat: latlng.lat, lng: latlng.lng }] 
    }
    const polyline = L.polyline([latlng], { 
      color: tool.color, 
      weight: brushSizeRef.current * 0.5, 
      opacity: 0.6,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(drawnItemsRef.current!)
    
    // Add click handler for user shapes
    polyline.on('click', () => {
      const acres = currentPathRef.current?.acres || 0
      const type = tool.type || tool.name
      const popupContent = buildPopupHtml({
        color: tool.color,
        type,
        title: tool.name,
        reason: acres > 0 ? `${acres.toFixed(2)} acres` : 'Drawing in progress'
      })
      polyline.bindPopup(popupContent).openPopup()
    })
    attachInteractivity(polyline)
    tempPathRef.current = polyline
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
      const path = currentPathRef.current
      // Calculate acreage if closed path (polygon-like)
      if (path.points.length >= 3) {
        path.acres = calculateAreaAcres(path.points)
      }
      // Check if outside boundary (for focus tool)
      if (path.toolId === 'focus' && boundaryPointsRef.current.length >= 3) {
        const centroid = path.points.reduce(
          (acc, pt) => ({ lat: acc.lat + pt.lat / path.points.length, lng: acc.lng + pt.lng / path.points.length }),
          { lat: 0, lng: 0 }
        )
        path.isExternal = !pointInPolygon(centroid, boundaryPointsRef.current)
      }
      drawnPathsRef.current.push(path)
    }
    currentPathRef.current = null
  }, [])

  const toGeoJSONLine = (path: DrawnPath): Feature<LineString> => ({
    type: 'Feature',
    properties: { 
      toolId: path.toolId, 
      color: path.color,
      type: path.type,
      acres: path.acres,
      isExternal: path.isExternal
    },
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

  const smoothLatLngPoints = (points: LatLngLike[], iterations: number, closed: boolean) => {
    if (points.length < 3) return points
    let pts = points.map(p => ({ ...p }))
    for (let i = 0; i < iterations; i++) {
      if (pts.length < 2) break
      const next: LatLngLike[] = []
      const limit = closed ? pts.length : pts.length - 1
      for (let j = 0; j < limit; j++) {
        const curr = pts[j]
        const nextPt = pts[(j + 1) % pts.length]
        const q: LatLngLike = {
          lat: 0.75 * curr.lat + 0.25 * nextPt.lat,
          lng: 0.75 * curr.lng + 0.25 * nextPt.lng,
        }
        const r: LatLngLike = {
          lat: 0.25 * curr.lat + 0.75 * nextPt.lat,
          lng: 0.25 * curr.lng + 0.75 * nextPt.lng,
        }
        next.push(q, r)
      }
      if (closed) {
        next.push({ ...next[0] })
      } else {
        next.unshift({ ...pts[0] })
        next.push({ ...pts[pts.length - 1] })
      }
      pts = next
    }
    return pts
  }

  const colorByType: Record<string, string> = {
    bedding: '#00FF6A',
    food_plot: '#F4C95D',
    travel_corridor: '#38BDF8',
    staging_area: '#FDA4AF',
    observation: '#C084FC',
  }

  const buildPopupHtml = (opts: { color: string; type?: string; title?: string; reason?: string }) => {
    const { color, type, title, reason } = opts
    const badge = type ? type.replace(/_/g, ' ').toUpperCase() : 'SUGGESTION'
    return `
      <div style="background:#1a1a1a;border-radius:8px;border:1px solid rgba(255,255,255,0.08);padding:10px 12px;min-width:220px;color:#f5f5f0;font-family:'Inter', sans-serif;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="font-size:10px;letter-spacing:1.2px;font-weight:600;padding:2px 8px;border-radius:999px;background:${color}1f;color:${color};border:1px solid ${color}40;">${badge}</span>
          <span style="font-size:13px;font-weight:600;color:#fff;">${title || 'Tony Suggestion'}</span>
        </div>
        <div style="font-size:12px;color:#d4c8b4;line-height:1.5;">${reason || 'Placement rationale unavailable.'}</div>
      </div>`
  }

  const resetCursorForTool = () => {
    if (!containerRef.current) return
    containerRef.current.style.cursor = activeToolRef.current.id === 'nav' ? 'grab' : 'crosshair'
  }

  const attachInteractivity = (layer: LeafletNS.Layer) => {
    layer.on('mouseover', () => {
      if (containerRef.current) containerRef.current.style.cursor = 'pointer'
    })
    layer.on('mouseout', () => {
      resetCursorForTool()
    })
  }

  return { 
    api: { 
      flyTo: (lat: number, lng: number, zoom: number = 16) => {
        if (mapRef.current) {
          mapRef.current.setView([lat, lng], zoom)
        }
      },
      lockBoundary: () => {
        // Only lock if valid polygon
        if (boundaryPointsRef.current.length < 3) return null
        const acres = calculateAreaAcres(boundaryPointsRef.current)
        if (!acres) return null
        boundaryLayerRef.current?.clearLayers()
        LRef.current!.polygon(boundaryPointsRef.current as any, { color: '#FF6B00', weight: 5, fillOpacity: 0.15 }).addTo(boundaryLayerRef.current!)
        // Store locked boundary and acres
        lockedBoundaryRef.current = {
          type: 'Feature',
          properties: { type: 'property_boundary' },
          geometry: {
            type: 'Polygon',
            coordinates: [[...boundaryPointsRef.current, boundaryPointsRef.current[0]].map(pt => [pt.lng, pt.lat])]
          }
        }
        lockedAcresRef.current = acres
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
        // Use locked boundary if set, else current drawn
        const boundary = lockedBoundaryRef.current || buildBoundaryFeature()
        const features = drawnPathsRef.current.map(toGeoJSONLine)
        const focusFeatures = features.filter(f => f.properties?.toolId === 'focus') as Feature<LineString>[]
        const center = map.getCenter()
        // SceneGraphLite builder
        const boundaryAcres = lockedBoundaryRef.current ? lockedAcresRef.current : (boundary ? calculateAreaAcres(boundary.geometry.coordinates[0].map(([lng, lat]) => ({ lat, lng }))) : 0)
        const locked = !!lockedBoundaryRef.current
        const featureList = features.map(f => ({
          id: f.properties?.toolId || '',
          type: f.properties?.type || '',
          acres: f.properties?.acres,
          label: f.properties?.label
        }))
        const totalsByType: Record<string, { count: number, acres?: number }> = {}
        featureList.forEach(f => {
          if (!f.type) return
          if (!totalsByType[f.type]) totalsByType[f.type] = { count: 0, acres: 0 }
          totalsByType[f.type].count++
          if (f.acres) totalsByType[f.type].acres = (totalsByType[f.type].acres || 0) + f.acres
        })
        const sceneGraphLite = {
          boundary: { acres: boundaryAcres, locked },
          features: featureList,
          totalsByType
        }
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
            type: 'FeatureCollection' as const,
            features
          },
          sceneGraphLite
        }
      },
      drawAISuggestions: (features: Feature[]) => {
        const L = LRef.current
        if (!L || !aiSuggestionsLayerRef.current) return
        
        aiSuggestionsLayerRef.current.clearLayers()

        features.forEach(feature => {
          const { geometry, properties } = feature
          if (!geometry || !properties) return
          const type = (properties.type || 'suggestion') as string
          const color = colorByType[type] || '#C084FC'
          const title = properties.title || properties.label || type
          const reason = properties.reason || properties.notes
          const popupHtml = buildPopupHtml({ color, type, title, reason })

          if (geometry.type === 'Point') {
            const [lng, lat] = geometry.coordinates as [number, number]
            const marker = L.marker([lat, lng], {
              icon: L.divIcon({
                className: '',
                html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};box-shadow:0 0 12px ${color};border:2px solid #0f0f0f"></div>`
              })
            }).bindPopup(popupHtml)
              .addTo(aiSuggestionsLayerRef.current!)
            attachInteractivity(marker)
            return
          }

          if (geometry.type === 'Polygon') {
            const ring = geometry.coordinates?.[0] || []
            if (ring.length < 3) return
            const trimmed = [...ring]
            if (trimmed.length > 2) {
              const first = trimmed[0]
              const last = trimmed[trimmed.length - 1]
              if (first && last && first[0] === last[0] && first[1] === last[1]) {
                trimmed.pop()
              }
            }
            const latLngs = trimmed.map(([lng, lat]) => ({ lat, lng }))
            const smooth = smoothLatLngPoints(latLngs, 3, true)
            const polygon = L.polygon(smooth.map(pt => [pt.lat, pt.lng]), {
              color,
              weight: 2.5,
              fillOpacity: 0.25,
            }).bindPopup(popupHtml)
              .addTo(aiSuggestionsLayerRef.current!)
            attachInteractivity(polygon)
            return
          }

          if (geometry.type === 'LineString') {
            const coords = geometry.coordinates || []
            if (coords.length < 2) return
            const latLngs = coords.map(([lng, lat]) => ({ lat, lng }))
            const smooth = smoothLatLngPoints(latLngs, 2, false)
            const line = L.polyline(smooth.map(pt => [pt.lat, pt.lng]), {
              color,
              weight: 4,
              opacity: 0.8,
            }).bindPopup(popupHtml)
              .addTo(aiSuggestionsLayerRef.current!)
            attachInteractivity(line)
          }
        })
      }
    }, 
    handlers: { onPointerDown, onPointerMove, onPointerUp } 
  }
}
