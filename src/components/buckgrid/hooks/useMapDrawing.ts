'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Tool } from '../constants/tools'
import mapboxgl from 'mapbox-gl'

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

let canvasIdCounter = 0
function uniqueCanvasId() { return `draw-canvas-${canvasIdCounter++}` }

export function useMapDrawing(args: { containerRef: React.RefObject<HTMLDivElement>, activeTool: Tool, brushSize: number }) {
  const { containerRef, activeTool, brushSize } = args
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const boundaryPointsRef = useRef<LatLngLike[]>([])
  const boundaryMarkersRef = useRef<mapboxgl.Marker[]>([])
  const boundarySourceAdded = useRef(false)
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)

  const activeToolRef = useRef(activeTool)
  const brushSizeRef = useRef(brushSize)
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  useEffect(() => { brushSizeRef.current = brushSize }, [brushSize])

  // Create a transparent canvas overlay for free-draw painting
  const ensureDrawCanvas = useCallback(() => {
    if (drawCanvasRef.current) return drawCanvasRef.current
    const container = containerRef.current
    if (!container) return null
    const canvas = document.createElement('canvas')
    canvas.width = container.clientWidth
    canvas.height = container.clientHeight
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;'
    container.appendChild(canvas)
    drawCanvasRef.current = canvas
    return canvas
  }, [containerRef])

  useEffect(() => {
    if (!containerRef.current) return

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-96.4937, 38.6583],
      zoom: 16,
      pitch: 60,
      bearing: -17,
      antialias: true,
      attributionControl: false,
    })

    map.on('style.load', () => {
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      })
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 })
    })

    mapRef.current = map

    return () => { map.remove() }
  }, [containerRef])

  // Sync map drag enable/disable with active tool
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (activeTool.id === 'nav') {
      map.dragPan.enable()
      map.scrollZoom.enable()
      map.dragRotate.enable()
    } else {
      map.dragPan.disable()
      map.scrollZoom.disable()
      map.dragRotate.disable()
    }
  }, [activeTool])

  const updateBoundaryLine = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const pts = boundaryPointsRef.current
    if (pts.length < 2) return
    const coords = pts.map(p => [p.lng, p.lat] as [number, number])
    const geojson: GeoJSON.Feature = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }

    if (!boundarySourceAdded.current) {
      map.addSource('boundary-line', { type: 'geojson', data: geojson })
      map.addLayer({ id: 'boundary-line-layer', type: 'line', source: 'boundary-line', paint: { 'line-color': '#FF6B00', 'line-width': 4 } })
      boundarySourceAdded.current = true
    } else {
      (map.getSource('boundary-line') as mapboxgl.GeoJSONSource).setData(geojson)
    }
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const map = mapRef.current
    if (!map || activeToolRef.current.id === 'nav') return

    const rect = containerRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const lngLat = map.unproject([x, y])

    if (activeToolRef.current.id === 'boundary') {
      boundaryPointsRef.current.push({ lat: lngLat.lat, lng: lngLat.lng })
      const marker = new mapboxgl.Marker({ color: '#FF6B00', scale: 0.6 }).setLngLat(lngLat).addTo(map)
      boundaryMarkersRef.current.push(marker)
      updateBoundaryLine()
      return
    }

    // Free-draw mode
    isDrawingRef.current = true
    const canvas = ensureDrawCanvas()
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.strokeStyle = activeToolRef.current.color
    ctx.lineWidth = brushSizeRef.current
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = 0.6
  }, [containerRef, ensureDrawCanvas, updateBoundaryLine])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current) return
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = containerRef.current!.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }, [containerRef])

  const onPointerUp = useCallback(() => {
    isDrawingRef.current = false
  }, [])

  const api: MapApi = useMemo(() => ({
    lockBoundary: () => {
      const map = mapRef.current
      const pts = boundaryPointsRef.current
      const acres = calculateAreaAcres(pts)
      if (!acres || !map) return null

      // Remove markers
      boundaryMarkersRef.current.forEach(m => m.remove())
      boundaryMarkersRef.current = []

      // Draw polygon
      const coords = pts.map(p => [p.lng, p.lat] as [number, number])
      coords.push(coords[0]) // close ring
      const geojson: GeoJSON.Feature = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } }

      if (boundarySourceAdded.current) {
        // Replace line with polygon
        if (map.getLayer('boundary-line-layer')) map.removeLayer('boundary-line-layer')
        if (map.getSource('boundary-line')) map.removeSource('boundary-line')
        boundarySourceAdded.current = false
      }
      map.addSource('boundary-poly', { type: 'geojson', data: geojson })
      map.addLayer({ id: 'boundary-poly-fill', type: 'fill', source: 'boundary-poly', paint: { 'fill-color': '#FF6B00', 'fill-opacity': 0.15 } })
      map.addLayer({ id: 'boundary-poly-line', type: 'line', source: 'boundary-poly', paint: { 'line-color': '#FF6B00', 'line-width': 5 } })

      return acres
    },
    wipeAll: () => {
      const map = mapRef.current
      if (!map) return
      boundaryMarkersRef.current.forEach(m => m.remove())
      boundaryMarkersRef.current = []
      boundaryPointsRef.current = []
      if (boundarySourceAdded.current) {
        if (map.getLayer('boundary-line-layer')) map.removeLayer('boundary-line-layer')
        if (map.getSource('boundary-line')) map.removeSource('boundary-line')
        boundarySourceAdded.current = false
      }
      if (map.getLayer('boundary-poly-fill')) map.removeLayer('boundary-poly-fill')
      if (map.getLayer('boundary-poly-line')) map.removeLayer('boundary-poly-line')
      if (map.getSource('boundary-poly')) map.removeSource('boundary-poly')

      // Clear draw canvas
      const canvas = drawCanvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx?.clearRect(0, 0, canvas.width, canvas.height)
      }
    },
    getCaptureElement: () => containerRef.current,
  }), [containerRef, updateBoundaryLine])

  return { api, handlers: { onPointerDown, onPointerMove, onPointerUp } }
}
