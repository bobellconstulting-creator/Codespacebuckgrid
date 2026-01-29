'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
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

/** IDs that should NOT draw and should leave the map fully interactive */
const NON_DRAW_IDS = new Set(['nav', 'eraser'])

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

  // ---------- Enable / disable map dragging based on active tool ----------
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (activeTool.id === 'nav' || activeTool.id === 'eraser') {
      map.dragging.enable()
      map.scrollWheelZoom.enable()
      map.touchZoom.enable()
    } else {
      map.dragging.disable()
      map.scrollWheelZoom.enable()   // keep zoom always available
      map.touchZoom.enable()
    }
  }, [activeTool])

  // ---------- Initialise Leaflet map ----------
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
      })
      leaflet.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, crossOrigin: true },
      ).addTo(map)
      drawnItemsRef.current = new leaflet.FeatureGroup().addTo(map)
      boundaryLayerRef.current = new leaflet.FeatureGroup().addTo(map)
      mapRef.current = map
    }
    init()
    return () => { mounted = false }
  }, [containerRef])

  // ---------- Pointer handlers ----------

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const L = LRef.current
    const map = mapRef.current
    if (!map || !L) return
    const tool = activeToolRef.current

    // --- NAV: let the map handle it ---
    if (tool.id === 'nav') return

    const rect = containerRef.current!.getBoundingClientRect()
    const latlng = map.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top])

    // --- ERASER: click-to-delete nearest feature ---
    if (tool.id === 'eraser') {
      const drawn = drawnItemsRef.current
      if (!drawn) return
      let closest: LeafletNS.Layer | null = null
      let closestDist = Infinity
      drawn.eachLayer((layer: any) => {
        if (typeof layer.getLatLngs === 'function') {
          const pts: LeafletNS.LatLng[] = layer.getLatLngs().flat()
          for (const pt of pts) {
            const d = map.latLngToContainerPoint(pt).distanceTo(map.latLngToContainerPoint(latlng))
            if (d < closestDist) { closestDist = d; closest = layer }
          }
        } else if (typeof layer.getLatLng === 'function') {
          const d = map.latLngToContainerPoint(layer.getLatLng()).distanceTo(map.latLngToContainerPoint(latlng))
          if (d < closestDist) { closestDist = d; closest = layer }
        }
      })
      // Only delete if click is within 30px of a feature
      if (closest && closestDist < 30) {
        drawn.removeLayer(closest)
      }
      return
    }

    // --- BOUNDARY: click-to-place vertices ---
    if (tool.id === 'boundary') {
      boundaryPointsRef.current.push({ lat: latlng.lat, lng: latlng.lng })
      L.circleMarker(latlng, { color: '#facc15', radius: 5, fillOpacity: 1 }).addTo(boundaryLayerRef.current!)
      if (boundaryPointsRef.current.length > 1) {
        L.polyline(boundaryPointsRef.current as any, { color: '#facc15', weight: 4 }).addTo(boundaryLayerRef.current!)
      }
      return
    }

    // --- ALL OTHER DRAW TOOLS: freehand path ---
    // Disable dragging while actively drawing
    map.dragging.disable()
    isDrawingRef.current = true
    tempPathRef.current = L.polyline([latlng], {
      color: tool.color,
      weight: brushSizeRef.current,
      opacity: 0.6,
    }).addTo(drawnItemsRef.current!)
  }, [containerRef])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current || !tempPathRef.current) return
    const rect = containerRef.current!.getBoundingClientRect()
    tempPathRef.current.addLatLng(
      mapRef.current!.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top]),
    )
  }, [containerRef])

  const onPointerUp = useCallback(() => {
    isDrawingRef.current = false
    tempPathRef.current = null
    // Re-enable dragging after stroke finishes (draw tools disable it on down)
    const map = mapRef.current
    if (map && !NON_DRAW_IDS.has(activeToolRef.current.id)) {
      // Keep dragging disabled between strokes for draw tools — user must switch to PAN.
      // But we do NOT keep it disabled for nav/eraser.
    }
  }, [])

  return {
    api: {
      lockBoundary: () => {
        const acres = calculateAreaAcres(boundaryPointsRef.current)
        if (!acres) return null
        boundaryLayerRef.current?.clearLayers()
        LRef.current!.polygon(boundaryPointsRef.current as any, { color: '#facc15', weight: 5, fillOpacity: 0.15 }).addTo(boundaryLayerRef.current!)
        return acres
      },
      wipeAll: () => {
        drawnItemsRef.current?.clearLayers()
        boundaryLayerRef.current?.clearLayers()
        boundaryPointsRef.current = []
      },
      getCaptureElement: () => containerRef.current,
    },
    handlers: { onPointerDown, onPointerMove, onPointerUp },
  }
}
