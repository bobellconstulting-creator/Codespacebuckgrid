'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Tool } from '../constants/tools'
import type * as LeafletNS from 'leaflet'

type LatLngLike = { lat: number; lng: number }

export type MapApi = {
  lockBoundary: () => number | null
  wipeAll: () => void
  getCaptureElement: () => HTMLElement | null
}

/* ─── Douglas-Peucker polyline simplification ─── */
function perpendicularDistance(pt: LatLngLike, lineStart: LatLngLike, lineEnd: LatLngLike): number {
  const dx = lineEnd.lng - lineStart.lng
  const dy = lineEnd.lat - lineStart.lat
  const mag = Math.sqrt(dx * dx + dy * dy)
  if (mag === 0) return Math.sqrt((pt.lng - lineStart.lng) ** 2 + (pt.lat - lineStart.lat) ** 2)
  return Math.abs(dx * (lineStart.lat - pt.lat) - dy * (lineStart.lng - pt.lng)) / mag
}

function simplifyDP(points: LatLngLike[], tolerance: number): LatLngLike[] {
  if (points.length <= 2) return points

  let maxDist = 0
  let maxIdx = 0
  const end = points.length - 1
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end])
    if (d > maxDist) { maxDist = d; maxIdx = i }
  }

  if (maxDist > tolerance) {
    const left = simplifyDP(points.slice(0, maxIdx + 1), tolerance)
    const right = simplifyDP(points.slice(maxIdx), tolerance)
    return left.slice(0, -1).concat(right)
  }
  return [points[0], points[end]]
}

/* Tolerance is in degrees — ~0.000005 ≈ ~0.5m at mid-latitudes, good for zoom 16+ */
const SIMPLIFY_TOLERANCE = 0.000008

/* ─── Area calculation ─── */
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

/* ─── Hook ─── */
export function useMapDrawing(args: { containerRef: React.RefObject<HTMLDivElement>, activeTool: Tool, brushSize: number }) {
  const { containerRef, activeTool, brushSize } = args
  const LRef = useRef<typeof LeafletNS | null>(null)
  const mapRef = useRef<LeafletNS.Map | null>(null)
  const drawnItemsRef = useRef<LeafletNS.FeatureGroup | null>(null)
  const boundaryLayerRef = useRef<LeafletNS.FeatureGroup | null>(null)
  const boundaryPointsRef = useRef<LatLngLike[]>([])
  const tempPathRef = useRef<LeafletNS.Polyline | null>(null)
  const freehandPtsRef = useRef<LatLngLike[]>([])
  const isDrawingRef = useRef(false)

  const activeToolRef = useRef(activeTool)
  const brushSizeRef = useRef(brushSize)
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  useEffect(() => { brushSizeRef.current = brushSize }, [brushSize])

  /* ── Anchor Lock: kill all map interaction when a drawing tool is active ── */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (activeTool.id === 'nav') {
      map.dragging.enable()
      map.scrollWheelZoom.enable()
      map.doubleClickZoom.enable()
      map.touchZoom.enable()
      map.boxZoom.enable()
      if (containerRef.current) containerRef.current.style.cursor = 'grab'
    } else {
      map.dragging.disable()
      map.doubleClickZoom.disable()
      map.touchZoom.disable()
      map.boxZoom.disable()
      // Keep scroll-wheel zoom so user can zoom while painting
      map.scrollWheelZoom.enable()
      if (containerRef.current) containerRef.current.style.cursor = 'crosshair'
    }
  }, [activeTool, containerRef])

  /* ── Map initialization ── */
  useEffect(() => {
    let mounted = true
    const init = async () => {
      const leaflet = await import('leaflet')
      if (!mounted || !containerRef.current) return
      LRef.current = leaflet

      const isNavTool = activeToolRef.current.id === 'nav'
      const map = leaflet.map(containerRef.current, {
        center: [38.6583, -96.4937],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
        dragging: isNavTool,
        doubleClickZoom: isNavTool,
        touchZoom: isNavTool,
        boxZoom: isNavTool,
      })
      leaflet.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, crossOrigin: true }).addTo(map)
      drawnItemsRef.current = new leaflet.FeatureGroup().addTo(map)
      boundaryLayerRef.current = new leaflet.FeatureGroup().addTo(map)
      mapRef.current = map

      if (containerRef.current) {
        containerRef.current.style.cursor = isNavTool ? 'grab' : 'crosshair'
        // Prevent context menu on right-click/long-press while drawing
        containerRef.current.addEventListener('contextmenu', (e) => e.preventDefault())
      }
    }
    init()
    return () => { mounted = false }
  }, [containerRef])

  /* ── Pointer Down: start freehand stroke ── */
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const L = LRef.current
    if (!mapRef.current || !L || activeToolRef.current.id === 'nav') return

    // Lock the pointer to the element for uninterrupted freehand
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    e.preventDefault()

    const rect = containerRef.current!.getBoundingClientRect()
    const latlng = mapRef.current.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top])
    const pt: LatLngLike = { lat: latlng.lat, lng: latlng.lng }

    isDrawingRef.current = true
    freehandPtsRef.current = [pt]

    if (activeToolRef.current.id === 'boundary') {
      // Freehand boundary: live polyline preview while dragging
      tempPathRef.current = L.polyline([latlng], {
        color: '#C8A55C',
        weight: 3,
        dashArray: '6,4',
        opacity: 0.8,
      }).addTo(boundaryLayerRef.current!)
    } else {
      // Paint tool: freehand brush stroke
      const effectiveWeight = brushSizeRef.current * 0.5
      tempPathRef.current = L.polyline([latlng], {
        color: activeToolRef.current.color,
        weight: effectiveWeight,
        opacity: 0.6,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(drawnItemsRef.current!)
    }
  }, [containerRef])

  /* ── Pointer Move: accumulate freehand points ── */
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current || !tempPathRef.current || !mapRef.current) return
    e.preventDefault()

    const rect = containerRef.current!.getBoundingClientRect()
    const latlng = mapRef.current.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top])
    const pt: LatLngLike = { lat: latlng.lat, lng: latlng.lng }

    freehandPtsRef.current.push(pt)
    tempPathRef.current.addLatLng(latlng)
  }, [containerRef])

  /* ── Pointer Up: simplify and finalize ── */
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)

    const L = LRef.current
    const rawPts = freehandPtsRef.current
    freehandPtsRef.current = []

    if (!L || rawPts.length < 2) {
      tempPathRef.current = null
      return
    }

    // Simplify dense freehand points
    const simplified = simplifyDP(rawPts, SIMPLIFY_TOLERANCE)

    if (activeToolRef.current.id === 'boundary') {
      // Remove the live-preview polyline
      if (tempPathRef.current) {
        boundaryLayerRef.current?.removeLayer(tempPathRef.current)
      }
      // Store simplified boundary points
      boundaryPointsRef.current = simplified
      // Draw the simplified boundary preview
      L.polyline(simplified as any, { color: '#C8A55C', weight: 3, opacity: 0.9 }).addTo(boundaryLayerRef.current!)
      // Mark start/end
      L.circleMarker(simplified[0] as any, { color: '#C8A55C', radius: 5, fillOpacity: 1 }).addTo(boundaryLayerRef.current!)
      L.circleMarker(simplified[simplified.length - 1] as any, { color: '#C8A55C', radius: 5, fillOpacity: 1 }).addTo(boundaryLayerRef.current!)
    } else {
      // Replace the raw polyline with the simplified version
      if (tempPathRef.current) {
        drawnItemsRef.current?.removeLayer(tempPathRef.current)
      }
      const effectiveWeight = brushSizeRef.current * 0.5
      L.polyline(simplified as any, {
        color: activeToolRef.current.color,
        weight: effectiveWeight,
        opacity: 0.6,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(drawnItemsRef.current!)
    }

    tempPathRef.current = null
  }, [])

  return {
    api: {
      lockBoundary: () => {
        const acres = calculateAreaAcres(boundaryPointsRef.current)
        if (!acres) return null
        boundaryLayerRef.current?.clearLayers()
        LRef.current!.polygon(boundaryPointsRef.current as any, { color: '#C8A55C', weight: 4, fillOpacity: 0.12, fillColor: '#C8A55C' }).addTo(boundaryLayerRef.current!)
        return acres
      },
      wipeAll: () => {
        drawnItemsRef.current?.clearLayers()
        boundaryLayerRef.current?.clearLayers()
        boundaryPointsRef.current = []
      },
      getCaptureElement: () => containerRef.current
    },
    handlers: { onPointerDown, onPointerMove, onPointerUp }
  }
}
