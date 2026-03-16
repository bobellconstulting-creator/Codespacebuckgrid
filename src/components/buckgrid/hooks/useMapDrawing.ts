import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import L from 'leaflet'
// FIX: Using H3 v4 'polygonToCells' for spatial recognition
import { polygonToCells } from 'h3-js'
import 'leaflet/dist/leaflet.css'

export type LayerType = 'boundary' | 'bedding' | 'food' | 'water' | 'path' | 'structure'

export interface LayerSummary {
  boundary: number
  food: number
  bedding: number
  water: number
  path: number
  other: number
}

export interface MapApi {
  flyTo: (center: [number, number], zoom: number) => void
  clearAll: () => void
  undoLast: () => void
  setDrawMode: (mode: LayerType) => void
  addSmartFeature: (geojson: any, type: LayerType, label: string) => void
  lockAndBake: () => { count: number; acres: number; pathYards: number; layers: any[]; summary: LayerSummary }
}

interface UseMapDrawingProps {
  containerRef: React.RefObject<HTMLDivElement>
  activeTool: string
  brushSize: number
}

// Colour palette keyed by tool id
const TOOL_COLORS: Record<string, string> = {
  boundary: '#FF6B00',
  bedding:  '#8B4513',
  food:     '#32CD32',
  water:    '#00BFFF',
  path:     '#FFD700',
}

function colorForTool(tool: string): string {
  return TOOL_COLORS[tool] ?? '#FFD700'
}

export function useMapDrawing({ containerRef, activeTool, brushSize }: UseMapDrawingProps) {
  const mapRef = useRef<L.Map | null>(null)
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null)
  const currentDrawRef = useRef<L.Polyline | null>(null)

  // 1. INITIALIZE MAP
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView([38.5, -98.0], 7)

    // Satellite Layer
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: 'Google Satellite'
    }).addTo(map)

    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)
    drawnItemsRef.current = drawnItems
    mapRef.current = map

    return () => { map.remove(); mapRef.current = null }
  }, [containerRef])

  // 2. HANDLERS (Paint & Touch Fixed)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const onMouseDown = (e: L.LeafletMouseEvent) => {
        if (activeTool === 'cursor') return
        const { lat, lng } = e.latlng
        const color = colorForTool(activeTool)

        const polyline = L.polyline([[lat, lng]], { color, weight: brushSize || 4, opacity: 0.8 })
        // Store which tool drew this layer for Tony's context
        ;(polyline as any).options.layerType = activeTool
        polyline.addTo(drawnItemsRef.current!)
        currentDrawRef.current = polyline
    }

    const onMouseMove = (e: L.LeafletMouseEvent) => {
        if (!currentDrawRef.current) return
        currentDrawRef.current.addLatLng(e.latlng)
    }

    const onMouseUp = () => {
        if (!currentDrawRef.current) return
        const shape = currentDrawRef.current
        const coords = shape.getLatLngs() as L.LatLng[]
        const layerType = (shape as any).options.layerType

        // Auto-Close Logic (The "Lazy Lock") — skip for path/cursor tools
        if (layerType !== 'path' && layerType !== 'cursor' && coords.length > 2) {
             const start = coords[0]
             const end = coords[coords.length - 1]
             // FIX: Lower threshold from 5m to 0.5m for better UX on zoomed drawings
             if (start.distanceTo(end) > 0.5) shape.addLatLng(start)

             const polygon = L.polygon(shape.getLatLngs() as L.LatLng[], {
                 color: shape.options.color,
                 fillColor: shape.options.color,
                 fillOpacity: 0.3,
                 weight: 2
             })
             // Preserve layer type on the final polygon
             ;(polygon as any).options.layerType = layerType
             drawnItemsRef.current?.removeLayer(shape)
             drawnItemsRef.current?.addLayer(polygon)
        }
        currentDrawRef.current = null
    }

    // Explicit Touch Wrappers to prevent errors
    const onTouchDown = (e: any) => onMouseDown(e)
    const onTouchMove = (e: any) => onMouseMove(e)
    const onTouchUp = () => onMouseUp()

    map.on('mousedown', onMouseDown)
    map.on('mousemove', onMouseMove)
    map.on('mouseup', onMouseUp)
    map.on('touchstart', onTouchDown)
    map.on('touchmove', onTouchMove)
    map.on('touchend', onTouchUp)

    return () => {
        map.off('mousedown', onMouseDown)
        map.off('mousemove', onMouseMove)
        map.off('mouseup', onMouseUp)
        map.off('touchstart', onTouchDown)
        map.off('touchmove', onTouchMove)
        map.off('touchend', onTouchUp)
    }
  }, [activeTool, brushSize])

  // 3. SPATIAL RECOGNITION (Tony's Eyes)
  const lockAndBake = useCallback(() => {
    const empty = { count: 0, acres: 0, pathYards: 0, layers: [], summary: { boundary: 0, food: 0, bedding: 0, water: 0, path: 0, other: 0 } }
    if (!drawnItemsRef.current) return empty

    const layers = drawnItemsRef.current.getLayers()
    let boundaryGeo: any = null
    const allFeatures: any[] = []
    let totalPathDistanceMeters = 0
    const summary: LayerSummary = { boundary: 0, food: 0, bedding: 0, water: 0, path: 0, other: 0 }

    for (const layer of layers) {
      // @ts-ignore
      if (!layer.toGeoJSON) continue
      // @ts-ignore
      const geo = layer.toGeoJSON()
      const layerType: string = (layer as any).options?.layerType ?? 'other'

      // Tally layer summary
      if (layerType in summary) {
        (summary as any)[layerType]++
      } else {
        summary.other++
      }

      // Path distance
      if (geo.geometry.type === 'LineString') {
          // @ts-ignore
          const latlngs: L.LatLng[] = layer.getLatLngs?.() ?? []
          for (let i = 0; i < latlngs.length - 1; i++) {
              totalPathDistanceMeters += latlngs[i].distanceTo(latlngs[i + 1])
          }
      }

      // Attach layer type to GeoJSON properties for Tony's vision
      geo.properties = { ...(geo.properties ?? {}), layerType }
      allFeatures.push(geo)

      // The boundary polygon drives the H3 calculation
      if (geo.geometry.type === 'Polygon' && layerType === 'boundary') {
        boundaryGeo = geo
      }
      // Fall back to any polygon if no explicit boundary drawn
      if (!boundaryGeo && geo.geometry.type === 'Polygon') {
        boundaryGeo = geo
      }
    }

    if (!boundaryGeo) return empty

    // H3 SPATIAL CALCULATION
    // Pass the full GeoJSON geometry object so h3-js handles lng/lat → lat/lng conversion correctly
    const hexIds = polygonToCells(boundaryGeo.geometry, 10, true)

    // SAVE DATA FOR TONY
    if (mapRef.current) {
        // @ts-ignore
        mapRef.current.options.hexGrid = hexIds
        // @ts-ignore
        mapRef.current.options.drawnFeatures = allFeatures
    }

    return {
        count: hexIds.length,
        acres: parseFloat((hexIds.length * 3.718).toFixed(1)), // H3 res-10 cell ≈ 3.718 acres
        pathYards: Math.round(totalPathDistanceMeters * 1.09361),
        layers: allFeatures,
        summary,
    }
  }, [])

  const api = useMemo<MapApi>(() => ({
    flyTo: (center, zoom) => mapRef.current?.setView(center, zoom),
    clearAll: () => drawnItemsRef.current?.clearLayers(),
    undoLast: () => {
        if (drawnItemsRef.current) {
            const l = drawnItemsRef.current.getLayers();
            if (l.length > 0) drawnItemsRef.current.removeLayer(l[l.length - 1])
        }
    },
    setDrawMode: () => {},
    addSmartFeature: (geojson, type, label) => {
        if (mapRef.current) {
            const color = type === 'bedding' ? 'brown' : 'green';
            L.geoJSON(geojson, { style: { color } }).bindPopup(label).addTo(mapRef.current)
        }
    },
    lockAndBake
  }), [lockAndBake])

  return { api }
}
