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

/**
 * Chaikin corner-cutting smoothing — turns sharp polygons into organic curves.
 * Each iteration doubles vertex count and rounds corners.
 */
function chaikinSmooth(coords: [number, number][], iterations = 3, closed = true): [number, number][] {
  let pts = coords.slice()
  for (let iter = 0; iter < iterations; iter++) {
    const next: [number, number][] = []
    const len = closed ? pts.length : pts.length - 1
    for (let i = 0; i < len; i++) {
      const p0 = pts[i]
      const p1 = pts[(i + 1) % pts.length]
      next.push([0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]])
      next.push([0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]])
    }
    if (!closed) {
      // preserve endpoints for open lines
      next.unshift(pts[0])
      next.push(pts[pts.length - 1])
    }
    pts = next
  }
  return pts
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
        const map = mapRef.current
        if (!L || !map || !suggestedLayerRef.current) return
        suggestedLayerRef.current.clearLayers()
        const styleMap: Record<string, { color: string; icon: string }> = {
          stand_location: { color: '#ef4444', icon: '🏹' },
          suggested_trail: { color: '#facc15', icon: '' },
          food_plot: { color: '#4ade80', icon: '🌱' },
          bedding_area: { color: '#713f12', icon: '🛏️' },
          water_source: { color: '#38bdf8', icon: '💧' },
        }

        const popupStyle = `
          <style>
            .tony-popup .leaflet-popup-content-wrapper{background:#1a1a1a;color:#fff;border:1px solid #FF6B00;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.6)}
            .tony-popup .leaflet-popup-tip{background:#1a1a1a;border:1px solid #FF6B00}
            .tony-popup .leaflet-popup-content{margin:10px 14px;font-family:system-ui,sans-serif}
            .tony-popup h3{margin:0 0 4px;font-size:13px;color:#FF6B00;font-weight:900;letter-spacing:.5px}
            .tony-popup p{margin:0;font-size:11px;color:#ccc;line-height:1.4}
            .tony-popup .badge{display:inline-block;font-size:9px;padding:2px 6px;border-radius:4px;margin-bottom:6px;font-weight:700;text-transform:uppercase}
          </style>`

        const makePopup = (f: GeoJSONFeature, style: { color: string }) => {
          const title = f.properties?.title || f.properties?.type || 'Suggestion'
          const reason = f.properties?.reason || ''
          const ptype = f.properties?.type || ''
          return L.popup({ className: 'tony-popup', maxWidth: 220 }).setContent(
            `${popupStyle}<div><span class="badge" style="background:${style.color}33;color:${style.color};border:1px solid ${style.color}">${ptype.replace(/_/g, ' ')}</span><h3>${title}</h3><p>${reason}</p></div>`
          )
        }

        const addHover = (layer: LeafletNS.Path | LeafletNS.Marker) => {
          layer.on('mouseover', () => { map.getContainer().style.cursor = 'pointer' })
          layer.on('mouseout', () => { map.getContainer().style.cursor = '' })
        }

        for (const f of fc.features) {
          const ptype = f.properties?.type || ''
          const style = styleMap[ptype] || { color: '#ffffff', icon: '📍' }
          const { geometry } = f
          if (geometry.type === 'Point') {
            const [lng, lat] = geometry.coordinates as number[]
            const icon = L.divIcon({
              html: `<div style="font-size:24px;text-shadow:0 0 6px #000,0 0 12px ${style.color};cursor:pointer">${style.icon || '📍'}</div>`,
              className: '', iconSize: [28, 28], iconAnchor: [14, 14]
            })
            const marker = L.marker([lat, lng], { icon }).addTo(suggestedLayerRef.current!)
            marker.bindPopup(makePopup(f, style))
            addHover(marker)
          } else if (geometry.type === 'LineString') {
            const rawCoords = (geometry.coordinates as number[][]).map(c => [c[1], c[0]] as [number, number])
            // Smooth trails with Chaikin (open curve)
            const smoothed = rawCoords.length >= 3 ? chaikinSmooth(rawCoords, 2, false) : rawCoords
            const line = L.polyline(smoothed, {
              color: style.color, weight: 3,
              dashArray: f.properties?.style === 'dashed' ? '8 6' : undefined,
              opacity: 0.9
            }).addTo(suggestedLayerRef.current!)
            line.bindPopup(makePopup(f, style))
            addHover(line)
          } else if (geometry.type === 'Polygon') {
            const rawCoords = (geometry.coordinates as number[][][])[0].map(c => [c[1], c[0]] as [number, number])
            // Smooth polygon edges with Chaikin (closed curve)
            const smoothed = rawCoords.length >= 3 ? chaikinSmooth(rawCoords, 3, true) : rawCoords
            const poly = L.polygon(smoothed, {
              color: style.color, weight: 2, fillOpacity: 0.2,
              fillColor: style.color
            }).addTo(suggestedLayerRef.current!)
            poly.bindPopup(makePopup(f, style))
            addHover(poly)
          }
        }
      }
    },
    handlers: { onPointerDown, onPointerMove, onPointerUp: () => { isDrawingRef.current = false; tempPathRef.current = null } }
  }
}
