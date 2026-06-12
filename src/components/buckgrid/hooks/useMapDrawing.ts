import { useRef, useEffect, useMemo, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import { polygonToCells } from 'h3-js'
import buffer from '@turf/buffer'
import simplify from '@turf/simplify'
import { lineString } from '@turf/helpers'
import 'maplibre-gl/dist/maplibre-gl.css'

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
// Tools that place a single point on click instead of painting a blob
const POINT_TOOLS = new Set(['stand', 'mineral', 'focus'])
// Tools whose stroke stays a line (trails) instead of being buffered to a polygon
const LINE_TOOLS = new Set(['path', 'scrape_line', 'travel_corridor'])

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
  tall_standing_cover: '#7B9E5A',
}

function colorForTool(tool: string): string {
  return TOOL_COLORS[tool] ?? '#FFD700'
}

// ── Geometry helpers (renderer-independent) ──────────────────────────────

function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const dLat = (b[1] - a[1]) * Math.PI / 180
  const dLng = (b[0] - a[0]) * Math.PI / 180
  const la1 = a[1] * Math.PI / 180
  const la2 = b[1] * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

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

function fc(features: any[]): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features }
}

// ── Map style: free Esri imagery + free AWS terrain. No tokens, ever. ────

const MAP_STYLE: any = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Esri World Imagery',
    },
    'dem-terrain': {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 15,
    },
    'dem-hillshade': {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 15,
    },
  },
  layers: [
    { id: 'satellite', type: 'raster', source: 'satellite' },
    {
      id: 'hillshade',
      type: 'hillshade',
      source: 'dem-hillshade',
      paint: {
        'hillshade-exaggeration': 0.35,
        'hillshade-shadow-color': '#0a0f09',
        'hillshade-highlight-color': '#d8d3c5',
        'hillshade-accent-color': '#1E2122',
      },
    },
  ],
  sky: {
    'sky-color': '#0b1118',
    'horizon-color': '#26323b',
    'fog-color': '#161a16',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.6,
    'fog-ground-blend': 0.85,
  },
}

const GLOBAL_CSS = `
.maplibregl-popup-content { background: #1E2122 !important; border: 1px solid rgba(107,122,87,0.35) !important; border-radius: 3px !important; box-shadow: 0 4px 20px rgba(0,0,0,0.6), 0 0 20px rgba(107,122,87,0.15) !important; color: #D8D3C5 !important; padding: 10px 12px !important; }
.maplibregl-popup-tip { border-top-color: #1E2122 !important; border-bottom-color: #1E2122 !important; }
.maplibregl-popup-close-button { color: #6E6A5C !important; font-size: 16px !important; }
.maplibregl-ctrl-group { background: #1E2122 !important; border: 1px solid rgba(107,122,87,0.35) !important; box-shadow: 0 2px 12px rgba(0,0,0,0.5) !important; }
.maplibregl-ctrl-group button { background: transparent !important; border-color: rgba(107,122,87,0.2) !important; }
.maplibregl-ctrl-group button span { filter: invert(0.8) sepia(0.2) !important; }
.bg-3d-btn { font-family: 'Teko','Oswald',sans-serif; font-weight: 800; font-size: 13px; letter-spacing: 0.08em; color: #6B7A57 !important; width: 100%; height: 29px; cursor: pointer; }
.bg-3d-btn.on { color: #1E2122 !important; background: #6B7A57 !important; }
.bg-draw-hud { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 50; background: rgba(10,15,9,0.85); border: 1px solid rgba(255,107,0,0.5); border-radius: 3px; padding: 6px 14px; font-family: 'Share Tech Mono', monospace; font-size: 11px; letter-spacing: 0.08em; color: #FFB273; text-transform: uppercase; pointer-events: none; white-space: nowrap; box-shadow: 0 0 16px rgba(255,107,0,0.2); }
.bg-brush-cursor { position: absolute; border: 1.5px solid rgba(255,255,255,0.9); border-radius: 50%; pointer-events: none; z-index: 49; transform: translate(-50%, -50%); box-shadow: 0 0 10px rgba(0,0,0,0.5), inset 0 0 10px rgba(0,0,0,0.25); display: none; }
.bg-acres-pop { font-family: 'Teko','Oswald',sans-serif; }
`

let cssInjected = false
function injectCss() {
  if (cssInjected || typeof document === 'undefined') return
  const style = document.createElement('style')
  style.id = 'bg-maplibre-css'
  style.textContent = GLOBAL_CSS
  document.head.appendChild(style)
  cssInjected = true
}

// Custom 3D terrain toggle control
class TerrainToggle {
  _map: maplibregl.Map | null = null
  _container: HTMLDivElement | null = null
  _btn: HTMLButtonElement | null = null
  _on = false

  onAdd(map: maplibregl.Map) {
    this._map = map
    const div = document.createElement('div')
    div.className = 'maplibregl-ctrl maplibregl-ctrl-group'
    const btn = document.createElement('button')
    btn.className = 'bg-3d-btn'
    btn.type = 'button'
    btn.textContent = '3D'
    btn.title = 'Toggle 3D terrain'
    btn.onclick = () => this.toggle()
    div.appendChild(btn)
    this._container = div
    this._btn = btn
    return div
  }

  toggle() {
    const map = this._map
    if (!map) return
    this._on = !this._on
    if (this._on) {
      try { map.setTerrain({ source: 'dem-terrain', exaggeration: 1.5 }) } catch { /* terrain unavailable */ }
      map.easeTo({ pitch: 62, duration: 1200 })
      this._btn?.classList.add('on')
      if (this._btn) this._btn.textContent = '2D'
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 800 })
      try { map.setTerrain(null) } catch { /* noop */ }
      this._btn?.classList.remove('on')
      if (this._btn) this._btn.textContent = '3D'
    }
  }

  onRemove() {
    this._container?.remove()
    this._map = null
  }
}

export function useMapDrawing({ containerRef, activeTool, brushSize }: UseMapDrawingProps) {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapReadyRef = useRef(false)
  // User-drawn features live here as plain GeoJSON — single source of truth
  const drawnRef = useRef<any[]>([])
  // Tony annotation features + their DOM label markers
  const tonyFeaturesRef = useRef<any[]>([])
  const tonyMarkersRef = useRef<maplibregl.Marker[]>([])
  const hudRef = useRef<HTMLDivElement | null>(null)
  const brushCursorRef = useRef<HTMLDivElement | null>(null)

  const refreshDrawn = useCallback(() => {
    const src = mapRef.current?.getSource('drawn') as maplibregl.GeoJSONSource | undefined
    src?.setData(fc(drawnRef.current) as any)
  }, [])

  const refreshTony = useCallback(() => {
    const src = mapRef.current?.getSource('tony') as maplibregl.GeoJSONSource | undefined
    src?.setData(fc(tonyFeaturesRef.current) as any)
  }, [])

  // 1. INITIALIZE MAP
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    injectCss()

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [-98.0, 38.5],
      zoom: 7,
      maxPitch: 70,
      canvasContextAttributes: { antialias: true, preserveDrawingBuffer: true }, // preserveDrawingBuffer required for html2canvas report capture
      attributionControl: { compact: true, customAttribution: 'Terrain: AWS Open Data' } as any,
    })

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    map.addControl(new TerrainToggle() as any, 'bottom-right')

    map.on('load', () => {
      // User-drawn features
      map.addSource('drawn', { type: 'geojson', data: fc([]) as any })
      map.addLayer({
        id: 'drawn-fill', type: 'fill', source: 'drawn',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['coalesce', ['get', 'fillOpacity'], 0.3] },
      })
      map.addLayer({
        id: 'drawn-line', type: 'line', source: 'drawn',
        filter: ['!=', ['geometry-type'], 'Point'],
        paint: { 'line-color': ['get', 'color'], 'line-width': ['coalesce', ['get', 'lineWidth'], 2], 'line-opacity': 0.95 },
      })
      map.addLayer({
        id: 'drawn-glow', type: 'line', source: 'drawn',
        filter: ['==', ['get', 'layerType'], 'boundary'],
        paint: { 'line-color': '#FF6B00', 'line-width': 9, 'line-blur': 7, 'line-opacity': 0.45 },
      })
      map.addLayer({
        id: 'drawn-point', type: 'circle', source: 'drawn',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 9, 'circle-color': ['get', 'color'], 'circle-opacity': 0.9,
          'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff',
        },
      })

      // Tony annotations
      map.addSource('tony', { type: 'geojson', data: fc([]) as any })
      map.addLayer({
        id: 'tony-fill', type: 'fill', source: 'tony',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.32 },
      })
      map.addLayer({
        id: 'tony-line', type: 'line', source: 'tony',
        filter: ['!=', ['geometry-type'], 'Point'],
        paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['==', ['geometry-type'], 'LineString'], 3, 2], 'line-dasharray': [2, 1], 'line-opacity': 0.9 },
      })
      map.addLayer({
        id: 'tony-point', type: 'circle', source: 'tony',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 10, 'circle-color': ['get', 'color'], 'circle-opacity': 0.9,
          'circle-stroke-width': 2, 'circle-stroke-color': ['get', 'color'],
        },
      })

      // Draft layers for in-progress boundary / freehand strokes
      map.addSource('draft', { type: 'geojson', data: fc([]) as any })
      map.addLayer({
        id: 'draft-fill', type: 'fill', source: 'draft',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#FF6B00', 'fill-opacity': 0.12 },
      })
      map.addLayer({
        id: 'draft-line', type: 'line', source: 'draft',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': ['coalesce', ['get', 'color'], '#FF6B00'], 'line-width': ['coalesce', ['get', 'width'], 2], 'line-dasharray': [2, 1.4], 'line-opacity': 0.9 },
      })
      map.addLayer({
        id: 'draft-vertex', type: 'circle', source: 'draft',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': ['coalesce', ['get', 'r'], 5], 'circle-color': '#ffffff',
          'circle-stroke-width': 2, 'circle-stroke-color': '#FF6B00',
        },
      })

      // Tony popups on click
      const popupFor = (e: maplibregl.MapLayerMouseEvent) => {
        const f = e.features?.[0]
        if (!f) return
        const p = f.properties ?? {}
        new maplibregl.Popup({ maxWidth: '260px', closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(String(p.popupHtml ?? ''))
          .addTo(map)
      }
      for (const layerId of ['tony-fill', 'tony-line', 'tony-point']) {
        map.on('click', layerId, popupFor)
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })
      }

      mapReadyRef.current = true
      refreshDrawn()
      refreshTony()
    })

    // Floating HUD for live acreage while drawing the boundary
    const hud = document.createElement('div')
    hud.className = 'bg-draw-hud'
    hud.style.display = 'none'
    containerRef.current.appendChild(hud)
    hudRef.current = hud

    // Brush-size cursor ring for paint tools
    const ring = document.createElement('div')
    ring.className = 'bg-brush-cursor'
    containerRef.current.appendChild(ring)
    brushCursorRef.current = ring

    mapRef.current = map

    return () => {
      tonyMarkersRef.current.forEach(m => m.remove())
      tonyMarkersRef.current = []
      hud.remove()
      ring.remove()
      map.remove()
      mapRef.current = null
      mapReadyRef.current = false
    }
  }, [containerRef, refreshDrawn, refreshTony])

  // 2. TOOL INTERACTION — nav / boundary / point tools / paint tools
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const canvas = map.getCanvas()
    const setDraft = (features: any[]) => {
      const src = map.getSource('draft') as maplibregl.GeoJSONSource | undefined
      src?.setData(fc(features) as any)
    }
    const hud = hudRef.current
    const ring = brushCursorRef.current
    const hideHud = () => { if (hud) hud.style.display = 'none' }
    const showHud = (text: string) => { if (hud) { hud.style.display = 'block'; hud.textContent = text } }

    // The map is NEVER fully locked anymore: zoom, rotate and two-finger
    // gestures stay live in every mode. Only left-drag changes meaning.
    map.scrollZoom.enable()
    map.touchZoomRotate.enable()
    map.doubleClickZoom.enable()

    const isPaint = activeTool !== 'nav' && activeTool !== 'boundary' && !POINT_TOOLS.has(activeTool)
    const isLine = LINE_TOOLS.has(activeTool)

    if (activeTool === 'nav') {
      map.dragPan.enable()
      canvas.style.cursor = ''
      if (ring) ring.style.display = 'none'
      return () => { /* nothing to detach */ }
    }

    // ── POINT TOOLS: one click = one feature ─────────────────────────────
    if (POINT_TOOLS.has(activeTool)) {
      map.dragPan.enable() // panning still works; a clean click drops the point
      canvas.style.cursor = 'crosshair'
      if (ring) ring.style.display = 'none'
      const color = colorForTool(activeTool)
      const onClick = (e: maplibregl.MapMouseEvent) => {
        drawnRef.current.push({
          type: 'Feature',
          properties: { layerType: activeTool, color },
          geometry: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] },
        })
        refreshDrawn()
      }
      map.on('click', onClick)
      return () => { map.off('click', onClick) }
    }

    // ── BOUNDARY: click-to-corner with live acreage + snap-to-close ──────
    if (activeTool === 'boundary') {
      map.dragPan.enable() // pan freely between corner clicks — this is the fix
      map.doubleClickZoom.disable()
      canvas.style.cursor = 'crosshair'
      if (ring) ring.style.display = 'none'

      const color = '#FF6B00'
      const points: [number, number][] = []

      const draftFeatures = (cursor?: [number, number]) => {
        const feats: any[] = points.map((c, i) => ({
          type: 'Feature',
          properties: { r: i === 0 && points.length >= 3 ? 8 : 5 },
          geometry: { type: 'Point', coordinates: c },
        }))
        const all = cursor ? [...points, cursor] : points
        if (all.length >= 2) {
          feats.push({ type: 'Feature', properties: { color, width: 2 }, geometry: { type: 'LineString', coordinates: all } })
        }
        if (all.length >= 3) {
          feats.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...all, all[0]]] } })
        }
        return feats
      }

      const updateHud = (cursor?: [number, number]) => {
        if (points.length === 0) { showHud('BOUNDARY — CLICK YOUR FIRST CORNER'); return }
        const all = cursor ? [...points, cursor] : points
        const parts: string[] = [`${points.length} PT${points.length > 1 ? 'S' : ''}`]
        if (cursor && points.length >= 1) {
          const legYds = Math.round(haversineMeters(points[points.length - 1], cursor) * 1.09361)
          parts.push(`LEG ${legYds} YDS`)
        }
        if (all.length >= 3) parts.push(`${polygonAreaAcres(all).toFixed(1)} AC`)
        parts.push(points.length >= 3 ? 'CLICK FIRST PT / ENTER TO CLOSE' : 'KEEP CLICKING CORNERS')
        showHud(parts.join('  ·  '))
      }

      const reset = () => { points.length = 0; setDraft([]); hideHud() }

      const closePolygon = () => {
        if (points.length < 3) return
        drawnRef.current.push({
          type: 'Feature',
          properties: { layerType: 'boundary', color, fillOpacity: 0.07, lineWidth: 3 },
          geometry: { type: 'Polygon', coordinates: [[...points, points[0]]] },
        })
        reset()
        refreshDrawn()
      }

      const onClick = (e: maplibregl.MapMouseEvent) => {
        if (points.length >= 3) {
          const a = map.project(e.lngLat)
          const b = map.project({ lng: points[0][0], lat: points[0][1] })
          if (Math.hypot(a.x - b.x, a.y - b.y) < 28) { closePolygon(); return }
        }
        points.push([e.lngLat.lng, e.lngLat.lat])
        setDraft(draftFeatures())
        updateHud()
      }

      const onMove = (e: maplibregl.MapMouseEvent) => {
        if (points.length === 0) { updateHud(); return }
        const cursor: [number, number] = [e.lngLat.lng, e.lngLat.lat]
        setDraft(draftFeatures(cursor))
        updateHud(cursor)
      }

      const onDblClick = (e: maplibregl.MapMouseEvent) => {
        e.preventDefault()
        // remove the duplicate point the preceding click added
        if (points.length > 0) points.pop()
        closePolygon()
      }

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') { closePolygon(); return }
        if (e.key === 'Escape') { reset(); return }
        if (e.key === 'Backspace' && points.length > 0) {
          points.pop()
          setDraft(draftFeatures())
          updateHud()
        }
      }

      map.on('click', onClick)
      map.on('mousemove', onMove)
      map.on('dblclick', onDblClick)
      document.addEventListener('keydown', onKeyDown)
      updateHud()

      return () => {
        map.off('click', onClick)
        map.off('mousemove', onMove)
        map.off('dblclick', onDblClick)
        document.removeEventListener('keydown', onKeyDown)
        // Auto-close if user switches away mid-draw with 3+ points
        if (points.length >= 3) closePolygon()
        else reset()
        map.doubleClickZoom.enable()
      }
    }

    // ── PAINT / LINE TOOLS: hold left mouse (or finger) and stroke ────────
    map.dragPan.disable() // left-drag paints; wheel + two-finger gestures still navigate
    canvas.style.cursor = 'none'
    const color = colorForTool(activeTool)
    if (ring) {
      ring.style.display = 'block'
      ring.style.width = `${brushSize}px`
      ring.style.height = `${brushSize}px`
      ring.style.borderColor = color
      ring.style.left = '-9999px'
    }

    let stroke: [number, number][] | null = null
    let lastMove = 0

    const finishStroke = () => {
      if (!stroke) return
      const coords = stroke
      stroke = null
      setDraft([])
      if (coords.length < 3) return

      if (isLine) {
        drawnRef.current.push({
          type: 'Feature',
          properties: { layerType: activeTool, color, lineWidth: 3 },
          geometry: { type: 'LineString', coordinates: coords },
        })
        refreshDrawn()
        return
      }

      // Buffer the stroke into a filled blob sized to the brush (paint feel)
      try {
        const bounds = map.getBounds()
        const metersPerPixel = (bounds.getNorth() - bounds.getSouth()) * 111000 / map.getContainer().clientHeight
        const radiusKm = Math.max(0.005, (brushSize / 2) * metersPerPixel / 1000)
        const line = lineString(coords)
        const simplified = simplify(line, { tolerance: 0.00005, highQuality: false })
        const buffered = buffer(simplified, radiusKm, { units: 'kilometers' })
        if (buffered && buffered.geometry) {
          let ringCoords: number[][] | null = null
          if (buffered.geometry.type === 'Polygon') ringCoords = buffered.geometry.coordinates[0]
          else if (buffered.geometry.type === 'MultiPolygon') ringCoords = buffered.geometry.coordinates[0][0]
          if (ringCoords && ringCoords.length >= 3) {
            drawnRef.current.push({
              type: 'Feature',
              properties: { layerType: activeTool, color },
              geometry: { type: 'Polygon', coordinates: [ringCoords] },
            })
            refreshDrawn()
            return
          }
        }
      } catch { /* fall through to plain close */ }

      drawnRef.current.push({
        type: 'Feature',
        properties: { layerType: activeTool, color },
        geometry: { type: 'Polygon', coordinates: [[...coords, coords[0]]] },
      })
      refreshDrawn()
    }

    const strokeDraft = () => {
      if (!stroke || stroke.length < 2) return
      setDraft([{ type: 'Feature', properties: { color, width: Math.max(3, brushSize / 3) }, geometry: { type: 'LineString', coordinates: stroke } }])
    }

    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      if ((e.originalEvent as MouseEvent).button !== 0) return
      stroke = [[e.lngLat.lng, e.lngLat.lat]]
    }
    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (ring) {
        ring.style.left = `${e.point.x}px`
        ring.style.top = `${e.point.y}px`
      }
      if (!stroke) return
      const now = Date.now()
      if (now - lastMove < 33) return // ~30Hz
      lastMove = now
      stroke.push([e.lngLat.lng, e.lngLat.lat])
      strokeDraft()
    }
    const onMouseUp = () => finishStroke()

    const onTouchStart = (e: maplibregl.MapTouchEvent) => {
      if (e.originalEvent.touches.length > 1) { stroke = null; setDraft([]); return } // two fingers = navigate
      e.preventDefault()
      stroke = [[e.lngLat.lng, e.lngLat.lat]]
    }
    const onTouchMove = (e: maplibregl.MapTouchEvent) => {
      if (!stroke || e.originalEvent.touches.length > 1) return
      e.preventDefault()
      stroke.push([e.lngLat.lng, e.lngLat.lat])
      strokeDraft()
    }
    const onTouchEnd = () => finishStroke()

    map.on('mousedown', onMouseDown)
    map.on('mousemove', onMouseMove)
    map.on('mouseup', onMouseUp)
    map.on('touchstart', onTouchStart)
    map.on('touchmove', onTouchMove)
    map.on('touchend', onTouchEnd)

    return () => {
      map.off('mousedown', onMouseDown)
      map.off('mousemove', onMouseMove)
      map.off('mouseup', onMouseUp)
      map.off('touchstart', onTouchStart)
      map.off('touchmove', onTouchMove)
      map.off('touchend', onTouchEnd)
      finishStroke()
      if (ring) ring.style.display = 'none'
      canvas.style.cursor = ''
      map.dragPan.enable()
    }
  }, [activeTool, brushSize, refreshDrawn])

  // 3. SPATIAL RECOGNITION (same math as before — engine-independent)
  const lockAndBake = useCallback(() => {
    const empty = { count: 0, acres: 0, pathYards: 0, layers: [], summary: { boundary: 0, food: 0, bedding: 0, water: 0, stand: 0, other: 0 } }
    const features = drawnRef.current
    if (features.length === 0) return empty

    let boundaryGeo: any = null
    const allFeatures: any[] = []
    let totalPathDistanceMeters = 0
    const summary: LayerSummary = { boundary: 0, food: 0, bedding: 0, water: 0, stand: 0, other: 0 }

    for (const geo of features) {
      const layerType: string = geo.properties?.layerType ?? 'other'

      if (FOOD_TOOLS.has(layerType)) {
        summary.food++
      } else if (layerType in summary) {
        (summary as any)[layerType]++
      } else {
        summary.other++
      }

      if (geo.geometry.type === 'LineString') {
        const coords = geo.geometry.coordinates as [number, number][]
        for (let i = 0; i < coords.length - 1; i++) {
          totalPathDistanceMeters += haversineMeters(coords[i], coords[i + 1])
        }
      }

      allFeatures.push(geo)

      if (geo.geometry.type === 'Polygon' && layerType === 'boundary') boundaryGeo = geo
      if (!boundaryGeo && geo.geometry.type === 'Polygon') boundaryGeo = geo
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
      if (hexCount > 0) acres = parseFloat((hexCount * 0.0344).toFixed(1))
    } catch { /* fall through to shoelace below */ }

    if (acres === 0) {
      const coords = boundaryGeo.geometry.coordinates[0] as [number, number][]
      acres = parseFloat(polygonAreaAcres(coords).toFixed(2))
      hexCount = Math.max(1, Math.round(acres / 0.0344))
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
    const map = mapRef.current
    tonyMarkersRef.current.forEach(m => m.remove())
    tonyMarkersRef.current = []
    tonyFeaturesRef.current = []

    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const popupContent = (ann: TonyAnnotation) => {
      const why = esc((ann as any).why ?? '')
      const label = esc(ann.label ?? '')
      const typeName = esc(ann.type.replace(/_/g, ' '))
      const conf = (ann as any).confidence
      const pri = (ann as any).priority
      const confBar = typeof conf === 'number'
        ? `<div style="height:3px;background:#1a2a1a;border-radius:2px;margin:4px 0 6px"><div style="height:100%;width:${Math.max(0, Math.min(100, conf))}%;background:${conf >= 75 ? '#4ade80' : conf >= 50 ? '#facc15' : '#ef4444'};border-radius:2px"></div></div>`
        : ''
      return `<div style="font-family:'Barlow Condensed',sans-serif;min-width:180px;max-width:240px;padding:2px 0">
        <div style="font-family:'Teko',sans-serif;font-weight:700;font-size:13px;color:#6B7A57;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px">${typeName}</div>
        <div style="font-size:13px;color:#D8D3C5;line-height:1.4;margin-bottom:4px">${label}</div>
        ${confBar}
        ${why ? `<div style="font-size:11px;color:#9A9588;line-height:1.4">${why}</div>` : ''}
        ${typeof pri === 'number' ? `<div style="font-size:10px;color:#6B7A57;margin-top:4px;letter-spacing:.06em">PRIORITY ${pri}</div>` : ''}
      </div>`
    }

    const addLabel = (lngLat: [number, number], text: string) => {
      if (!map) return
      const el = document.createElement('div')
      el.className = 'tony-label'
      el.textContent = text
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -10] })
        .setLngLat(lngLat)
        .addTo(map)
      tonyMarkersRef.current.push(marker)
    }

    for (const ann of annotations) {
      const geometry = ann.geojson?.geometry
      if (!geometry) continue
      const color = ANNOTATION_COLORS[ann.type] ?? '#FF6B00'
      const feature = {
        type: 'Feature',
        properties: { color, popupHtml: popupContent(ann), annType: ann.type, label: ann.label },
        geometry,
      }
      tonyFeaturesRef.current.push(feature)

      if (geometry.type === 'Polygon') {
        const ring = geometry.coordinates[0] as [number, number][]
        const centLng = ring.reduce((s, c) => s + c[0], 0) / ring.length
        const centLat = ring.reduce((s, c) => s + c[1], 0) / ring.length
        addLabel([centLng, centLat], ann.label)
      } else if (geometry.type === 'LineString') {
        const coords = geometry.coordinates as [number, number][]
        const mid = coords[Math.floor(coords.length / 2)]
        if (mid) addLabel([mid[0], mid[1]], ann.label)
      } else if (geometry.type === 'Point') {
        const [lng, lat] = geometry.coordinates as [number, number]
        addLabel([lng, lat], ann.label)
      }
    }

    refreshTony()
  }, [refreshTony])

  const api = useMemo<MapApi>(() => ({
    flyTo: (center, zoom) => {
      // center arrives as [lat, lng] (legacy Leaflet order)
      mapRef.current?.flyTo({ center: [center[1], center[0]], zoom, duration: 1800, essential: true })
    },
    clearAll: () => {
      drawnRef.current = []
      refreshDrawn()
    },
    undoLast: () => {
      drawnRef.current.pop()
      refreshDrawn()
    },
    setDrawMode: () => {},
    addSmartFeature: (geojson, type, label) => {
      const map = mapRef.current
      if (!map) return
      const color = ANNOTATION_COLORS[type] ?? '#FF6B00'
      const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson]
      for (const f of features) {
        tonyFeaturesRef.current.push({
          type: 'Feature',
          properties: { ...(f.properties ?? {}), color, label },
          geometry: f.geometry,
        })
        const g = f.geometry
        if (g?.type === 'Point') {
          const [lng, lat] = g.coordinates
          const el = document.createElement('div')
          el.className = 'tony-label'
          el.textContent = label
          tonyMarkersRef.current.push(
            new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -12] }).setLngLat([lng, lat]).addTo(map)
          )
        }
      }
      refreshTony()
    },
    lockAndBake,
    drawAnnotations,
    clearAnnotations: () => {
      tonyFeaturesRef.current = []
      tonyMarkersRef.current.forEach(m => m.remove())
      tonyMarkersRef.current = []
      refreshTony()
    },
    getBoundsAndFeatures: () => {
      const map = mapRef.current
      if (!map) return null
      const b = map.getBounds()
      const features = drawnRef.current.map(f => ({
        ...f,
        properties: { ...(f.properties ?? {}), layerType: f.properties?.layerType ?? 'other' },
      }))
      return {
        bounds: { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
        zoom: map.getZoom(),
        features,
      }
    },
  }), [lockAndBake, drawAnnotations, refreshDrawn, refreshTony])

  return { api }
}
