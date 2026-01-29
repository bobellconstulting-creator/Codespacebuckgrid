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

  // ── FIX 1: Anchor Lock — disable/enable map dragging based on active tool ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (activeTool.id === 'nav') {
      map.dragging.enable()
      map.scrollWheelZoom.enable()
      map.doubleClickZoom.enable()
      if (containerRef.current) containerRef.current.style.cursor = 'grab'
    } else {
      map.dragging.disable()
      map.doubleClickZoom.disable()
      // Keep scroll zoom so user can still zoom in/out while painting
      map.scrollWheelZoom.enable()
      if (containerRef.current) containerRef.current.style.cursor = 'crosshair'
    }
  }, [activeTool, containerRef])

  useEffect(() => {
    let mounted = true
    const init = async () => {
      const leaflet = await import('leaflet')
      if (!mounted || !containerRef.current) return
      LRef.current = leaflet
      const map = leaflet.map(containerRef.current, {
        center: [38.6583, -96.4937],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
        // Start with dragging disabled if a tool is already selected
        dragging: activeToolRef.current.id === 'nav',
        doubleClickZoom: activeToolRef.current.id === 'nav',
      })
      leaflet.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, crossOrigin: true }).addTo(map)
      drawnItemsRef.current = new leaflet.FeatureGroup().addTo(map)
      boundaryLayerRef.current = new leaflet.FeatureGroup().addTo(map)
      mapRef.current = map

      // Set initial cursor
      if (containerRef.current) {
        containerRef.current.style.cursor = activeToolRef.current.id === 'nav' ? 'grab' : 'crosshair'
      }
    }
    init()
    return () => { mounted = false }
  }, [containerRef])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const L = LRef.current
    if (!mapRef.current || !L || activeToolRef.current.id === 'nav') return

    // Capture pointer for reliable freehand drawing
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)

    const rect = containerRef.current!.getBoundingClientRect()
    const latlng = mapRef.current.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top])

    if (activeToolRef.current.id === 'boundary') {
      boundaryPointsRef.current.push({ lat: latlng.lat, lng: latlng.lng })
      L.circleMarker(latlng, { color: '#C8A55C', radius: 5, fillOpacity: 1 }).addTo(boundaryLayerRef.current!)
      if (boundaryPointsRef.current.length > 1) L.polyline(boundaryPointsRef.current as any, { color: '#C8A55C', weight: 3 }).addTo(boundaryLayerRef.current!)
      return
    }

    isDrawingRef.current = true
    // ── FIX 2: Apply 0.5x multiplier to brush weight ──
    const effectiveWeight = brushSizeRef.current * 0.5
    tempPathRef.current = L.polyline([latlng], { color: activeToolRef.current.color, weight: effectiveWeight, opacity: 0.6, lineCap: 'round', lineJoin: 'round' }).addTo(drawnItemsRef.current!)
  }, [containerRef])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current || !tempPathRef.current) return
    e.preventDefault()
    const rect = containerRef.current!.getBoundingClientRect()
    tempPathRef.current.addLatLng(mapRef.current!.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top]))
  }, [containerRef])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    isDrawingRef.current = false
    tempPathRef.current = null
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
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
