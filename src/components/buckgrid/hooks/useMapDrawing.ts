import { useRef, useEffect, useMemo, useCallback } from 'react'
import L from 'leaflet'
import { polygonToCells } from 'h3-js'
import buffer from '@turf/buffer'
import simplify from '@turf/simplify'
import { lineString } from '@turf/helpers'
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
  stand: number
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
  getBoundsAndFeatures: () => { bounds: { north: number; south: number; east: number; west: number }; zoom: number; features: any[] } | null
}

interface UseMapDrawingProps {
  containerRef: React.RefObject<HTMLDivElement>
  activeTool: string
  brushSize: number
}

const FOOD_TOOLS = new Set(['food', 'clover', 'brassicas', 'corn', 'soybeans', 'milo', 'egyptian', 'switchgrass'])

const TOOL_COLORS: Record<string, string> = {
  boundary: '#FF6B00',
  bedding: '#8B4513',
  food: '#32CD32',
  water: '#00BFFF',
  path: '#FFD700',
  clover: '#4ade80',
  brassicas: '#c084fc',
  corn: '#facc15',
  soybeans: '#86efac',
  milo: '#d97706',
  egyptian: '#fb923c',
  switchgrass: '#fdba74',
  stand: '#ef4444',
  focus: '#FF0000',
  mineral: '#CD853F',
  scrape_line: '#8B0000',
  travel_corridor: '#B8860B',
}

const ANNOTATION_COLORS: Record<string, string> = {
  food: '#32CD32',
  food_plot: '#32CD32',
  bedding: '#8B4513',
  stand: '#ef4444',
  water: '#00BFFF',
  path: '#FFD700',
  trail: '#FFD700',
  sneak_trail: '#8B8678',
  access_trail: '#D4AC4A',
  access_point: '#B8923A',
  sanctuary: '#263428',
  staging_area: '#6B7A4F',
  pinch_point: '#7A1F1F',
  structure: '#FF6B00',
  mineral: '#CD853F',
  scrape_line: '#8B0000',
  travel_corridor: '#B8860B',
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

    L.tileLayer(
      'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Esri World Imagery', crossOrigin: 'anonymous' }
    ).addTo(map)

    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)
    drawnItemsRef.current = drawnItems

    const tonyAnnotations = new L.FeatureGroup()
    map.addLayer(tonyAnnotations)
    tonyAnnotationsRef.current = tonyAnnotations

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    mapRef.current = map

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize()
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [containerRef])

  // 2. DRAW HANDLERS
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Lock/unlock map drag and zoom based on tool mode
    if (activeTool === 'nav') {
      map.dragging.enable()
      if (map.touchZoom) map.touchZoom.enable()
      if (map.scrollWheelZoom) map.scrollWheelZoom.enable()
      map.getContainer().style.cursor = 'grab'
    } else {
      map.dragging.disable()
      if (map.touchZoom) map.touchZoom.disable()
      if (map.scrollWheelZoom) map.scrollWheelZoom.disable()
      map.getContainer().style.cursor = 'crosshair'
    }

    let lastMoveTime = 0
    const MOVE_THROTTLE_MS = 33 // ~30Hz

    const onMouseDown = (e: L.LeafletMouseEvent) => {
      if (activeTool === 'nav' || activeTool === 'boundary') return
      const { lat, lng } = e.latlng
      const color = colorForTool(activeTool)
      const polyline = L.polyline([[lat, lng]], { color, weight: brushSize || 4, opacity: 0.8 })
      ;(polyline as any).options.layerType = activeTool
      polyline.addTo(drawnItemsRef.current!)
      currentDrawRef.current = polyline
    }

    const onMouseMove = (e: L.LeafletMouseEvent) => {
      if (!currentDrawRef.current) return
      const now = Date.now()
      if (now - lastMoveTime < MOVE_THROTTLE_MS) return
      lastMoveTime = now
      currentDrawRef.current.addLatLng(e.latlng)
    }

    const onMouseUp = () => {
      if (!currentDrawRef.current) return
      const shape = currentDrawRef.current
      const coords = shape.getLatLngs() as L.LatLng[]
      const layerType = (shape as any).options.layerType
      const color = shape.options.color as string

      currentDrawRef.current = null

      if (layerType === 'path' || layerType === 'nav' || coords.length < 3) return

      // Try turf buffer to create a fat filled polygon (paint brush effect)
      try {
        const mapBounds = map.getBounds()
        const metersPerPixel = (mapBounds.getNorth() - mapBounds.getSouth()) * 111000 / map.getSize().y
        const radiusKm = Math.max(0.005, (brushSize / 2) * metersPerPixel / 1000)

        // turf uses [lng, lat]; Leaflet LatLng is {lat, lng}
        const turfCoords = coords.map(ll => [ll.lng, ll.lat] as [number, number])
        const line = lineString(turfCoords)
        const simplified = simplify(line, { tolerance: 0.00005, highQuality: false })
        const buffered = buffer(simplified, radiusKm, { units: 'kilometers' })

        if (buffered && buffered.geometry) {
          let ringCoords: number[][] | null = null
          if (buffered.geometry.type === 'Polygon') {
            ringCoords = buffered.geometry.coordinates[0]
          } else if (buffered.geometry.type === 'MultiPolygon') {
            ringCoords = buffered.geometry.coordinates[0][0]
          }

          if (ringCoords && ringCoords.length >= 3) {
            // Convert back to Leaflet [lat, lng]
            const latlngs = ringCoords.map(([lng, lat]) => [lat, lng] as [number, number])
            const polygon = L.polygon(latlngs, {
              color,
              fillColor: color,
              fillOpacity: 0.3,
              weight: 2,
            })
            ;(polygon as any).options.layerType = layerType
            drawnItemsRef.current?.removeLayer(shape)
            drawnItemsRef.current?.addLayer(polygon)
            return
          }
        }
      } catch {
        // fall through to simple close-and-polygon
      }

      // Fallback: close the polyline and convert to a plain polygon
      const start = coords[0]
      const end = coords[coords.length - 1]
      if (start.distanceTo(end) > 0.5) shape.addLatLng(start)
      const polygon = L.polygon(shape.getLatLngs() as L.LatLng[], {
        color,
        fillColor: color,
        fillOpacity: 0.3,
        weight: 2,
      })
      ;(polygon as any).options.layerType = layerType
      drawnItemsRef.current?.removeLayer(shape)
      drawnItemsRef.current?.addLayer(polygon)
    }

    const onTouchDown = (e: any) => onMouseDown(e)
    const onTouchMove = (e: any) => onMouseMove(e)
    const onTouchUp = () => onMouseUp()

    // Native touchmove with passive:false so preventDefault() works during drawing
    const container = map.getContainer()
    const nativeTouchMove = (e: TouchEvent) => {
      if (activeTool === 'nav') return
      e.preventDefault()
    }
    container.addEventListener('touchmove', nativeTouchMove, { passive: false })

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
      container.removeEventListener('touchmove', nativeTouchMove)
    }
  }, [activeTool, brushSize])

  // 2b. BOUNDARY CLICK-TO-CORNER MODE
  useEffect(() => {
    const map = mapRef.current
    if (!map || activeTool !== 'boundary') return

    const color = '#FF6B00'
    const points: L.LatLng[] = []
    const vertexMarkers: L.CircleMarker[] = []
    let previewLine: L.Polyline | null = null
    let previewPoly: L.Polygon | null = null

    const clearPreview = () => {
      if (previewLine) { previewLine.remove(); previewLine = null }
      if (previewPoly) { previewPoly.remove(); previewPoly = null }
    }

    const updatePreview = (mouseLatlng?: L.LatLng) => {
      clearPreview()
      if (points.length === 0) return
      const allPts = mouseLatlng ? [...points, mouseLatlng] : points
      if (allPts.length >= 2) {
        previewLine = L.polyline(allPts, { color, weight: 2, opacity: 0.8, dashArray: '6 4' }).addTo(map)
      }
      if (points.length >= 3) {
        previewPoly = L.polygon([...points], { color, fillColor: color, fillOpacity: 0.12, weight: 2, opacity: 0.5 }).addTo(map)
      }
    }

    const closePolygon = () => {
      if (points.length < 3) return
      clearPreview()
      vertexMarkers.forEach(m => map.removeLayer(m))
      vertexMarkers.length = 0
      const polygon = L.polygon([...points], { color, fillColor: color, fillOpacity: 0.07, weight: 3 })
      ;(polygon as any).options.layerType = 'boundary'
      drawnItemsRef.current?.addLayer(polygon)
      points.length = 0
    }

    const onClick = (e: L.LeafletMouseEvent) => {
      // Snap to first point if close enough
      if (points.length >= 3) {
        const screenDist = map.latLngToContainerPoint(e.latlng)
          .distanceTo(map.latLngToContainerPoint(points[0]))
        if (screenDist < 28) { closePolygon(); return }
      }
      points.push(e.latlng)
      const m = L.circleMarker(e.latlng, { radius: 5, color, fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(map)
      vertexMarkers.push(m)
      updatePreview()
    }

    const onMouseMove = (e: L.LeafletMouseEvent) => { updatePreview(e.latlng) }

    const onDblClick = (e: L.LeafletMouseEvent) => {
      L.DomEvent.stop(e)
      // Remove the duplicate click point that fired before dblclick
      if (points.length > 0) {
        points.pop()
        const last = vertexMarkers.pop()
        if (last) map.removeLayer(last)
      }
      closePolygon()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { closePolygon(); return }
      if (e.key === 'Escape') {
        clearPreview()
        vertexMarkers.forEach(m => map.removeLayer(m))
        vertexMarkers.length = 0
        points.length = 0
      }
      if (e.key === 'Backspace' && points.length > 0) {
        points.pop()
        const last = vertexMarkers.pop()
        if (last) map.removeLayer(last)
        updatePreview()
      }
    }

    map.on('click', onClick)
    map.on('mousemove', onMouseMove)
    map.on('dblclick', onDblClick)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      map.off('click', onClick)
      map.off('mousemove', onMouseMove)
      map.off('dblclick', onDblClick)
      document.removeEventListener('keydown', onKeyDown)
      // Auto-close if user switches away mid-draw with 3+ points
      if (points.length >= 3) closePolygon()
      clearPreview()
      vertexMarkers.forEach(m => map.removeLayer(m))
    }
  }, [activeTool])

  // 3. SPATIAL RECOGNITION
  function polygonAreaAcres(coords: [number, number][]): number {
    // Shoelace formula with WGS84 correction — coords are [lng, lat] (GeoJSON order)
    let area = 0
    const n = coords.length
    for (let i = 0; i < n; i++) {
      const [lng1, lat1] = coords[i]
      const [lng2, lat2] = coords[(i + 1) % n]
      const latRad = ((lat1 + lat2) / 2) * Math.PI / 180
      const metersPerLng = 111320 * Math.cos(latRad)
      const metersPerLat = 111320
      area += (lng2 - lng1) * metersPerLng * (lat1 + lat2) / 2 * metersPerLat
    }
    return Math.abs(area) / 2 / 4047
  }

  const lockAndBake = useCallback(() => {
    const empty = { count: 0, acres: 0, pathYards: 0, layers: [], summary: { boundary: 0, food: 0, bedding: 0, water: 0, stand: 0, other: 0 } }
    if (!drawnItemsRef.current) return empty

    const layers = drawnItemsRef.current.getLayers()
    let boundaryGeo: any = null
    const allFeatures: any[] = []
    let totalPathDistanceMeters = 0
    const summary: LayerSummary = { boundary: 0, food: 0, bedding: 0, water: 0, stand: 0, other: 0 }

    for (const layer of layers) {
      // @ts-ignore
      if (!layer.toGeoJSON) continue
      // @ts-ignore
      const geo = layer.toGeoJSON()
      const layerType: string = (layer as any).options?.layerType ?? 'other'

      if (FOOD_TOOLS.has(layerType)) {
        summary.food++
      } else if (layerType in summary) {
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

    // h3-js v4 API: takes [[lat, lng], ...] not GeoJSON [lng, lat]
    let acres = 0
    let hexCount = 0
    try {
      const ring = (boundaryGeo.geometry.coordinates[0] as [number, number][])
        .map(([lng, lat]) => [lat, lng] as [number, number])
      const hexIds = polygonToCells([ring], 10)
      hexCount = hexIds.length
      if (hexCount > 0) {
        acres = parseFloat((hexCount * 0.0344).toFixed(1))
        if (mapRef.current) {
          // @ts-ignore
          mapRef.current.options.hexGrid = hexIds
        }
      }
    } catch {
      // fall through to bounding-box fallback below
    }

    if (acres === 0) {
      // Fallback: Shoelace formula for polygon area
      const coords = boundaryGeo.geometry.coordinates[0] as [number, number][]
      acres = parseFloat(polygonAreaAcres(coords).toFixed(2))
      hexCount = Math.max(1, Math.round(acres / 0.0344))
    }

    if (mapRef.current) {
      // @ts-ignore
      mapRef.current.options.drawnFeatures = allFeatures
    }

    return {
      count: hexCount,
      acres,
      pathYards: Math.round(totalPathDistanceMeters * 1.09361),
      layers: allFeatures,
      summary,
    }
  }, [])

  // 4. TONY ANNOTATION DRAWING — handles Polygon, LineString, Point
  const drawAnnotations = useCallback((annotations: TonyAnnotation[]) => {
    const layer = tonyAnnotationsRef.current
    if (!layer) return
    layer.clearLayers()

    for (const ann of annotations) {
      const geometry = ann.geojson?.geometry
      if (!geometry) continue
      const color = ANNOTATION_COLORS[ann.type] ?? '#FF6B00'
      const tooltip = ann.label + ((ann as any).why ? `\n${(ann as any).why}` : '')

      if (geometry.type === 'Polygon') {
        const ring = geometry.coordinates[0] as [number, number][]
        const latlngs = ring.map(([lng, lat]) => [lat, lng] as [number, number])
        L.polygon(latlngs, { color, weight: 2, fillColor: color, fillOpacity: 0.25 })
          .bindTooltip(tooltip, { sticky: true }).addTo(layer)
      } else if (geometry.type === 'LineString') {
        const coords = geometry.coordinates as [number, number][]
        const latlngs = coords.map(([lng, lat]) => [lat, lng] as [number, number])
        L.polyline(latlngs, { color, weight: 3, dashArray: '8 4' })
          .bindTooltip(tooltip, { sticky: true }).addTo(layer)
      } else if (geometry.type === 'Point') {
        const [lng, lat] = geometry.coordinates as [number, number]
        L.circleMarker([lat, lng], { radius: 9, color, weight: 2, fillColor: color, fillOpacity: 0.85 })
          .bindTooltip(ann.label, { permanent: true, direction: 'top', offset: [0, -12] }).addTo(layer)
      }
    }
  }, [])

  const api = useMemo<MapApi>(() => ({
    flyTo: (center, zoom) => mapRef.current?.flyTo(center, zoom, { duration: 1.5 }),
    clearAll: () => {
      drawnItemsRef.current?.clearLayers()
      if (mapRef.current) (mapRef.current as any).options.drawnFeatures = []
    },
    undoLast: () => {
      if (drawnItemsRef.current) {
        const l = drawnItemsRef.current.getLayers()
        if (l.length > 0) drawnItemsRef.current.removeLayer(l[l.length - 1])
      }
    },
    setDrawMode: () => {},
    addSmartFeature: (geojson, type, label) => {
      const layer = tonyAnnotationsRef.current
      if (!layer) return
      const color = ANNOTATION_COLORS[type] ?? '#FF6B00'
      L.geoJSON(geojson, {
        pointToLayer: (_f, latlng) => L.circleMarker(latlng, {
          radius: 10, color, weight: 2, fillColor: color, fillOpacity: 0.75,
        }),
        style: { color, fillColor: color, fillOpacity: 0.3, weight: 2 }
      }).bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -12] }).addTo(layer)
    },
    lockAndBake,
    drawAnnotations,
    clearAnnotations: () => tonyAnnotationsRef.current?.clearLayers(),
    getBoundsAndFeatures: () => {
      if (!mapRef.current) return null
      const b = mapRef.current.getBounds()
      // Read live from drawn layers — don't wait for lockAndBake
      const features: any[] = []
      drawnItemsRef.current?.getLayers().forEach(layer => {
        if ((layer as any).toGeoJSON) {
          const geo = (layer as any).toGeoJSON()
          const layerType = (layer as any).options?.layerType ?? 'other'
          geo.properties = { ...(geo.properties ?? {}), layerType }
          features.push(geo)
        }
      })
      return {
        bounds: { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
        zoom: mapRef.current.getZoom(),
        features,
      }
    },
  }), [lockAndBake, drawAnnotations])

  return { api }
}
