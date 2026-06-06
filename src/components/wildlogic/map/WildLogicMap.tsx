// INSTALLATION NOTE: mapbox-gl is not in package.json.
// Run: npm install mapbox-gl
// For TypeScript types: npm install --save-dev @types/mapbox-gl
// If @types/mapbox-gl is unavailable, the // @ts-ignore comments below suppress type errors.

'use client'

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'

// @ts-ignore — mapbox-gl may not have types installed yet
import mapboxgl from 'mapbox-gl'
// @ts-ignore
import 'mapbox-gl/dist/mapbox-gl.css'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ZONE_FILL_OPACITY = 0.35
const ZONE_OUTLINE_OPACITY = 0.85
const ZONE_HOVER_FILL_OPACITY = 0.55

const PROPERTY_BOUNDARY_SOURCE = 'property-boundary-source'
const PROPERTY_BOUNDARY_FILL_LAYER = 'property-boundary-fill'
const PROPERTY_BOUNDARY_OUTLINE_LAYER = 'property-boundary-outline'

const TONY_ZONES_SOURCE = 'tony-zones-source'
const TONY_ZONES_FILL_LAYER = 'tony-zones-fill'
const TONY_ZONES_OUTLINE_LAYER = 'tony-zones-outline'
const TONY_STANDS_LAYER = 'tony-stands-layer'

const MOSS_FILL = 'rgba(107,122,87,0.2)'
const MOSS_LINE = 'rgba(107,122,87,1)'

const US_CENTER: [number, number] = [-98.35, 39.5]
const US_ZOOM = 4

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeoJSONFeature {
  type: 'Feature'
  geometry: {
    type: string
    coordinates: any
  }
  properties: Record<string, any> | null
}

export interface WildLogicMapHandle {
  flyTo(lat: number, lng: number, zoom?: number): void
  getViewport(): { bounds: { north: number; south: number; east: number; west: number }; zoom: number } | null
  setTonyZones(zones: GeoJSONFeature[]): void
  clearTonyZones(): void
  setPropertyBoundary(geoJSON: any): void
  clearPropertyBoundary(): void
  getCurrentCenter(): { lat: number; lng: number } | null
  getUserLocation(): Promise<{ lat: number; lng: number } | null>
}

interface WildLogicMapProps {
  onBoundaryDrawn?: (polygon: any) => void
  drawingMode: 'none' | 'boundary'
  className?: string
}

// ---------------------------------------------------------------------------
// Drawing state (kept outside component to avoid re-render churn)
// ---------------------------------------------------------------------------

interface DrawingState {
  active: boolean
  points: [number, number][]          // [lng, lat]
  markers: any[]                       // mapboxgl.Marker[]
  previewSourceId: string
  previewLayerFillId: string
  previewLayerLineId: string
}

function makeEmptyDrawingState(): DrawingState {
  return {
    active: false,
    points: [],
    markers: [],
    previewSourceId: 'drawing-preview-source',
    previewLayerFillId: 'drawing-preview-fill',
    previewLayerLineId: 'drawing-preview-line',
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUserLocationAsync(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 6000, maximumAge: 60_000 }
    )
  })
}

function buildPolygonGeoJSON(points: [number, number][]): any {
  if (points.length < 3) return null
  const closed = [...points, points[0]]
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [closed],
    },
    properties: {},
  }
}

function buildLineStringGeoJSON(points: [number, number][]): any {
  if (points.length < 2) return null
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: points,
    },
    properties: {},
  }
}

// ---------------------------------------------------------------------------
// Source / layer lifecycle helpers
// ---------------------------------------------------------------------------

function ensureSource(map: any, id: string, data: any) {
  if (map.getSource(id)) {
    map.getSource(id).setData(data)
  } else {
    map.addSource(id, { type: 'geojson', data })
  }
}

function removeLayerSafe(map: any, id: string) {
  if (map.getLayer(id)) map.removeLayer(id)
}

function removeSourceSafe(map: any, id: string) {
  if (map.getSource(id)) map.removeSource(id)
}

function emptyFeatureCollection() {
  return { type: 'FeatureCollection' as const, features: [] }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const WildLogicMap = forwardRef<WildLogicMapHandle, WildLogicMapProps>(
  ({ onBoundaryDrawn, drawingMode, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<any>(null)                 // mapboxgl.Map
    const drawingStateRef = useRef<DrawingState>(makeEmptyDrawingState())
    const hoveredZoneIdRef = useRef<string | number | null>(null)
    const drawingModeRef = useRef(drawingMode)
    const onBoundaryDrawnRef = useRef(onBoundaryDrawn)

    // Keep refs in sync without re-running effects
    useEffect(() => { drawingModeRef.current = drawingMode }, [drawingMode])
    useEffect(() => { onBoundaryDrawnRef.current = onBoundaryDrawn }, [onBoundaryDrawn])

    // ------------------------------------------------------------------
    // imperativeHandle
    // ------------------------------------------------------------------
    useImperativeHandle(ref, () => ({
      flyTo(lat, lng, zoom = 14) {
        mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1400 })
      },

      getViewport() {
        const map = mapRef.current
        if (!map) return null
        const bounds = map.getBounds()
        return {
          bounds: {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          },
          zoom: map.getZoom(),
        }
      },

      setTonyZones(zones) {
        const map = mapRef.current
        if (!map) return
        const fc = { type: 'FeatureCollection', features: zones }

        if (map.getSource(TONY_ZONES_SOURCE)) {
          map.getSource(TONY_ZONES_SOURCE).setData(fc)
        } else {
          map.addSource(TONY_ZONES_SOURCE, { type: 'geojson', data: fc })
          // Fill layer
          map.addLayer({
            id: TONY_ZONES_FILL_LAYER,
            type: 'fill',
            source: TONY_ZONES_SOURCE,
            filter: ['!=', ['geometry-type'], 'Point'],
            paint: {
              'fill-color': ['coalesce', ['get', 'color'], '#6B7A57'],
              'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                ZONE_HOVER_FILL_OPACITY,
                ZONE_FILL_OPACITY,
              ],
            },
          })
          // Outline layer (dashed)
          map.addLayer({
            id: TONY_ZONES_OUTLINE_LAYER,
            type: 'line',
            source: TONY_ZONES_SOURCE,
            filter: ['!=', ['geometry-type'], 'Point'],
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#6B7A57'],
              'line-width': 2,
              'line-opacity': ZONE_OUTLINE_OPACITY,
              'line-dasharray': [4, 2],
            },
          })
          // Stand/site symbol layer (circle marker for Point features)
          map.addLayer({
            id: TONY_STANDS_LAYER,
            type: 'circle',
            source: TONY_ZONES_SOURCE,
            filter: ['==', ['geometry-type'], 'Point'],
            paint: {
              'circle-color': ['coalesce', ['get', 'color'], '#ef4444'],
              'circle-radius': 7,
              'circle-stroke-color': '#fff',
              'circle-stroke-width': 2,
              'circle-opacity': 0.9,
            },
          })
        }
      },

      clearTonyZones() {
        const map = mapRef.current
        if (!map) return
        removeLayerSafe(map, TONY_STANDS_LAYER)
        removeLayerSafe(map, TONY_ZONES_OUTLINE_LAYER)
        removeLayerSafe(map, TONY_ZONES_FILL_LAYER)
        removeSourceSafe(map, TONY_ZONES_SOURCE)
      },

      setPropertyBoundary(geoJSON) {
        const map = mapRef.current
        if (!map) return
        const data = geoJSON.type === 'FeatureCollection'
          ? geoJSON
          : { type: 'FeatureCollection', features: [geoJSON] }

        ensureSource(map, PROPERTY_BOUNDARY_SOURCE, data)

        if (!map.getLayer(PROPERTY_BOUNDARY_FILL_LAYER)) {
          map.addLayer({
            id: PROPERTY_BOUNDARY_FILL_LAYER,
            type: 'fill',
            source: PROPERTY_BOUNDARY_SOURCE,
            paint: {
              'fill-color': MOSS_FILL,
            },
          })
          map.addLayer({
            id: PROPERTY_BOUNDARY_OUTLINE_LAYER,
            type: 'line',
            source: PROPERTY_BOUNDARY_SOURCE,
            paint: {
              'line-color': MOSS_LINE,
              'line-width': 2,
            },
          })
        }
      },

      clearPropertyBoundary() {
        const map = mapRef.current
        if (!map) return
        removeLayerSafe(map, PROPERTY_BOUNDARY_OUTLINE_LAYER)
        removeLayerSafe(map, PROPERTY_BOUNDARY_FILL_LAYER)
        removeSourceSafe(map, PROPERTY_BOUNDARY_SOURCE)
      },

      getCurrentCenter() {
        const map = mapRef.current
        if (!map) return null
        const c = map.getCenter()
        return { lat: c.lat, lng: c.lng }
      },

      getUserLocation: getUserLocationAsync,
    }))

    // ------------------------------------------------------------------
    // Map initialisation
    // ------------------------------------------------------------------
    useEffect(() => {
      if (!containerRef.current || mapRef.current) return

      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      if (!token) {
        console.error('[WildLogicMap] NEXT_PUBLIC_MAPBOX_TOKEN is not set.')
        return
      }

      mapboxgl.accessToken = token

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/satellite-v9',
        center: US_CENTER,
        zoom: US_ZOOM,
        attributionControl: false,
      })

      mapRef.current = map

      map.on('load', () => {
        // Initialise preview drawing sources
        const ds = drawingStateRef.current
        map.addSource(ds.previewSourceId, {
          type: 'geojson',
          data: emptyFeatureCollection(),
        })
        map.addLayer({
          id: ds.previewLayerFillId,
          type: 'fill',
          source: ds.previewSourceId,
          paint: {
            'fill-color': MOSS_FILL,
          },
        })
        map.addLayer({
          id: ds.previewLayerLineId,
          type: 'line',
          source: ds.previewSourceId,
          paint: {
            'line-color': MOSS_LINE,
            'line-width': 2,
            'line-dasharray': [4, 3],
          },
        })

        // Fly to user's location
        getUserLocationAsync().then((loc) => {
          if (!mapRef.current) return
          const center: [number, number] = loc ? [loc.lng, loc.lat] : US_CENTER
          const zoom = loc ? 13 : US_ZOOM
          mapRef.current.flyTo({ center, zoom, duration: 1800 })
        })
      })

      // Resize observer
      const observer = new ResizeObserver(() => map.resize())
      observer.observe(containerRef.current)

      return () => {
        observer.disconnect()
        map.remove()
        mapRef.current = null
      }
    }, [])

    // ------------------------------------------------------------------
    // Tony zones hover interaction
    // ------------------------------------------------------------------
    useEffect(() => {
      const map = mapRef.current
      if (!map) return

      const onMouseEnter = (e: any) => {
        map.getCanvas().style.cursor = 'pointer'
        const feature = e.features?.[0]
        if (!feature) return
        const id = feature.id ?? feature.properties?.id
        if (id == null) return
        if (hoveredZoneIdRef.current !== null) {
          map.setFeatureState(
            { source: TONY_ZONES_SOURCE, id: hoveredZoneIdRef.current },
            { hover: false }
          )
        }
        hoveredZoneIdRef.current = id
        map.setFeatureState({ source: TONY_ZONES_SOURCE, id }, { hover: true })
      }

      const onMouseLeave = () => {
        map.getCanvas().style.cursor = ''
        if (hoveredZoneIdRef.current !== null) {
          map.setFeatureState(
            { source: TONY_ZONES_SOURCE, id: hoveredZoneIdRef.current },
            { hover: false }
          )
          hoveredZoneIdRef.current = null
        }
      }

      map.on('mouseenter', TONY_ZONES_FILL_LAYER, onMouseEnter)
      map.on('mouseleave', TONY_ZONES_FILL_LAYER, onMouseLeave)
      map.on('mouseenter', TONY_STANDS_LAYER, onMouseEnter)
      map.on('mouseleave', TONY_STANDS_LAYER, onMouseLeave)

      return () => {
        map.off('mouseenter', TONY_ZONES_FILL_LAYER, onMouseEnter)
        map.off('mouseleave', TONY_ZONES_FILL_LAYER, onMouseLeave)
        map.off('mouseenter', TONY_STANDS_LAYER, onMouseEnter)
        map.off('mouseleave', TONY_STANDS_LAYER, onMouseLeave)
      }
    }, [])

    // ------------------------------------------------------------------
    // Drawing mode effect
    // ------------------------------------------------------------------
    useEffect(() => {
      const map = mapRef.current
      if (!map) return

      const ds = drawingStateRef.current

      if (drawingMode === 'boundary') {
        // Activate drawing
        ds.active = true
        ds.points = []
        map.getCanvas().style.cursor = 'crosshair'

        const updatePreview = () => {
          const src = map.getSource(ds.previewSourceId)
          if (!src) return

          const features: any[] = []
          const poly = buildPolygonGeoJSON(ds.points)
          if (poly) features.push(poly)
          const line = buildLineStringGeoJSON(ds.points)
          if (line) features.push(line)

          src.setData({ type: 'FeatureCollection', features })
        }

        const clearPreview = () => {
          const src = map.getSource(ds.previewSourceId)
          if (src) src.setData(emptyFeatureCollection())
        }

        const removeVertexMarkers = () => {
          ds.markers.forEach((m) => m.remove())
          ds.markers = []
        }

        const onClick = (e: any) => {
          if (!ds.active) return

          // Snap-to-close: if 3+ points and click near first vertex, close polygon
          if (ds.points.length >= 3) {
            const firstPx = map.project(ds.points[0] as [number, number])
            const clickPx = map.project([e.lngLat.lng, e.lngLat.lat])
            const dist = Math.hypot(clickPx.x - firstPx.x, clickPx.y - firstPx.y)
            if (dist < 20) {
              finishPolygon()
              return
            }
          }

          const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat]
          ds.points.push(pt)

          // Add a small circle marker at each vertex
          const el = document.createElement('div')
          el.style.cssText = [
            'width:10px',
            'height:10px',
            'border-radius:50%',
            'background:#6B7A57',
            'border:2px solid #fff',
            'box-shadow:0 0 4px rgba(0,0,0,0.5)',
          ].join(';')
          // @ts-ignore
          const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat(pt)
            .addTo(map)
          ds.markers.push(marker)

          updatePreview()
        }

        const onDblClick = (e: any) => {
          // DblClick fires two click events first; remove the duplicate last point
          if (ds.points.length > 0) {
            ds.points.pop()
            const last = ds.markers.pop()
            if (last) last.remove()
          }
          finishPolygon()
        }

        const finishPolygon = () => {
          if (ds.points.length < 3) {
            cleanup()
            return
          }
          const polygon = buildPolygonGeoJSON(ds.points)
          clearPreview()
          removeVertexMarkers()
          ds.active = false
          ds.points = []
          map.getCanvas().style.cursor = ''
          if (polygon && onBoundaryDrawnRef.current) {
            onBoundaryDrawnRef.current(polygon)
          }
        }

        const cleanup = () => {
          clearPreview()
          removeVertexMarkers()
          ds.active = false
          ds.points = []
          map.getCanvas().style.cursor = ''
          map.off('click', onClick)
          map.off('dblclick', onDblClick)
        }

        map.on('click', onClick)
        map.on('dblclick', onDblClick)

        return () => {
          map.off('click', onClick)
          map.off('dblclick', onDblClick)
          // Auto-commit if switching away with sufficient points
          if (ds.active && ds.points.length >= 3) {
            finishPolygon()
          } else {
            cleanup()
          }
        }
      } else {
        // Drawing mode turned off — restore cursor
        map.getCanvas().style.cursor = ''
        ds.active = false
        ds.points = []
        ds.markers.forEach((m) => m.remove())
        ds.markers = []
        const src = map.getSource(ds.previewSourceId)
        if (src) src.setData(emptyFeatureCollection())
      }
    }, [drawingMode])

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />
    )
  }
)

WildLogicMap.displayName = 'WildLogicMap'

export default WildLogicMap
