import { useRef, useEffect, useMemo, useCallback } from 'react'
import L from 'leaflet'
import { polygonToCells } from 'h3-js'
import 'leaflet/dist/leaflet.css'

export type LayerType = 'boundary' | 'bedding' | 'food' | 'water' | 'path' | 'structure'

export interface TonyAnnotation {
  type: string
  label: string
  geojson: any // GeoJSON Feature with Point geometry
}

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
  drawAnnotations: (annotations: TonyAnnotation[]) => void
  clearAnnotations: () => void
}

interface UseMapDrawingProps {
  containerRef: React.RefObject<HTMLDivElement>
  activeTool: string
  brushSize: number
}

const TOOL_COLORS: Record<string, string> = {
  boundary: '#FF6B00',
  bedding: '#8B4513',
  food: '#32CD32',
  water: '#00BFFF',
  path: '#FFD700',
}

const ANNOTATION_COLORS: Record<string, string> = {
  food: '#32CD32',
  bedding: '#8B4513',
  stand: '#ef4444',
  water: '#00BFFF',
  path: '#FFD700',
  structure: '#FF6B00',
}

function colorForTool(tool: string): string {
  return TOOL_COLORS[tool] ?? '#FFD700'
}

export function useMapDrawing({ containerRef, activeTool, brushSize }: UseMapDrawingProps) {
  const mapRef = useRef<L.Map | null>(null)
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null)
  const tonyAnnotationsRef = useRef<L.FeatureGroup | null>(null)
  const currentDrawRef = useRef<L.Polyline | null>(null)

  // 1. INITIALIZE MAP
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView([38.5, -98.0], 7)

    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: 'Google Satellite'
    }).addTo(map)

    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)
    drawnItemsRef.current = drawnItems

    const tonyAnnotations = new L.FeatureGroup()
    map.addLayer(tonyAnnotations)
    tonyAnnotationsRef.current = tonyAnnotations

    mapRef.current = map

    return () => { map.remove(); mapRef.current = null }
  }, [containerRef])

  // 2. DRAW HANDLERS
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const onMouseDown = (e: L.LeafletMouseEvent) => {
      if (activeTool === 'nav') return
      const { lat, lng } = e.latlng
      const color = colorForTool(activeTool)
      const polyline = L.polyline([[lat, lng]], { color, weight: brushSize || 4, opacity: 0.8 })
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

      if (layerType !== 'path' && layerType !== 'nav' && coords.length > 2) {
        const start = coords[0]
        const end = coords[coords.length - 1]
        if (start.distanceTo(end) > 0.5) shape.addLatLng(start)
        const polygon = L.polygon(shape.getLatLngs() as L.LatLng[], {
          color: shape.options.color,
          fillColor: shape.options.color,
          fillOpacity: 0.3,
          weight: 2
        })
        ;(polygon as any).options.layerType = layerType
        drawnItemsRef.current?.removeLayer(shape)
        drawnItemsRef.current?.addLayer(polygon)
      }
      currentDrawRef.current = null
    }

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

  // 3. SPATIAL RECOGNITION
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

      if (layerType in summary) {
        (summary as any)[layerType]++
      } else {
        summary.other++
      }

      if (geo.geometry.type === 'LineString') {
        // @ts-ignore
        const latlngs: L.LatLng[] = layer.getLatLngs?.() ?? []
        for (let i = 0; i < latlngs.length - 1; i++) {
          totalPathDistanceMeters += latlngs[i].distanceTo(latlngs[i + 1])
        }
      }

      geo.properties = { ...(geo.properties ?? {}), layerType }
      allFeatures.push(geo)

      if (geo.geometry.type === 'Polygon' && layerType === 'boundary') {
        boundaryGeo = geo
      }
      if (!boundaryGeo && geo.geometry.type === 'Polygon') {
        boundaryGeo = geo
      }
    }

    if (!boundaryGeo) return empty

    const hexIds = polygonToCells(boundaryGeo.geometry, 10, true)

    if (mapRef.current) {
      // @ts-ignore
      mapRef.current.options.hexGrid = hexIds
      // @ts-ignore
      mapRef.current.options.drawnFeatures = allFeatures
    }

    return {
      count: hexIds.length,
      acres: parseFloat((hexIds.length * 3.718).toFixed(1)),
      pathYards: Math.round(totalPathDistanceMeters * 1.09361),
      layers: allFeatures,
      summary,
    }
  }, [])

  // 4. TONY ANNOTATION DRAWING
  const drawAnnotations = useCallback((annotations: TonyAnnotation[]) => {
    const layer = tonyAnnotationsRef.current
    if (!layer) return
    layer.clearLayers()

    for (const ann of annotations) {
      const coords = ann.geojson?.geometry?.coordinates
      if (!Array.isArray(coords) || coords.length < 2) continue
      const [lng, lat] = coords
      const color = ANNOTATION_COLORS[ann.type] ?? '#FF6B00'
      L.circleMarker([lat, lng], {
        radius: 10,
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.75,
      }).bindTooltip(ann.label, { permanent: true, direction: 'top', offset: [0, -12] }).addTo(layer)
    }
  }, [])

  const api = useMemo<MapApi>(() => ({
    flyTo: (center, zoom) => mapRef.current?.setView(center, zoom),
    clearAll: () => drawnItemsRef.current?.clearLayers(),
    undoLast: () => {
      if (drawnItemsRef.current) {
        const l = drawnItemsRef.current.getLayers()
        if (l.length > 0) drawnItemsRef.current.removeLayer(l[l.length - 1])
      }
    },
    setDrawMode: () => {},
    addSmartFeature: (geojson, type, label) => {
      if (!mapRef.current) return
      const color = ANNOTATION_COLORS[type] ?? '#FF6B00'
      L.geoJSON(geojson, {
        pointToLayer: (_f, latlng) => L.circleMarker(latlng, {
          radius: 10, color, weight: 2, fillColor: color, fillOpacity: 0.75,
        }),
        style: { color, fillColor: color, fillOpacity: 0.3, weight: 2 }
      }).bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -12] }).addTo(mapRef.current)
    },
    lockAndBake,
    drawAnnotations,
    clearAnnotations: () => tonyAnnotationsRef.current?.clearLayers(),
  }), [lockAndBake, drawAnnotations])

  return { api }
}
