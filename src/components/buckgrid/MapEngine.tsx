'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import { area as turfArea } from '@turf/turf'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

import { useMapStore } from '@/store/useMapStore'

/**
 * BuckGrid Pro — MapEngine
 * - Rule A: Anchor Lock (disable pan/zoom while drawing tools active)
 * - Rule B: Live Acreage (draw.create/update/delete → turf area → acres HUD)
 * - Rule C: Precision Brush (hard-cap line width for trail/line features)
 *
 * Notes:
 * - Draw tools are controlled by Zustand `activeTool`.
 * - This component updates store: center, drawnShapes GeoJSON, toolCounts, propertyAcres.
 * - Tony suggestion lines are rendered as a red dashed line layer from store `tonySuggestions`.
 */

type LngLat = { lng: number; lat: number }

const MAP_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12'

// --- Precision Brush (Rule C) ---
// "30% of default" here means: whatever width you consider normal for a line on this map,
// you clamp the user brush to 30% of that, to force pencil-thin trails.
const DEFAULT_TRAIL_WIDTH_PX = 10
const MAX_TRAIL_WIDTH_PX = Math.max(1, Math.round(DEFAULT_TRAIL_WIDTH_PX * 0.3)) // => 3px

const DRAWING_TOOLS = new Set([
  'boundary',
  'corn',
  'bedding',
  'stand',
  'trail',
  'hinge',
  'plot',
])

function toAcres(squareMeters: number) {
  // 1 acre = 4046.8564224 m²
  return squareMeters / 4046.8564224
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export default function MapEngine() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const drawRef = useRef<MapboxDraw | null>(null)

  const activeTool = useMapStore((s) => s.activeTool)
  const brushSize = useMapStore((s) => s.brushSize)

  const setCenter = useMapStore((s) => s.setCenter)
  const setPropertyAcres = useMapStore((s) => s.setPropertyAcres)
  const setDrawnShapes = useMapStore((s) => s.setDrawnShapes)
  const setToolCounts = useMapStore((s) => s.setToolCounts)

  const tonySuggestions = useMapStore((s) => s.tonySuggestions) // FeatureCollection<LineString | Polygon> expected

  const [hudAcres, setHudAcres] = useState<number>(0)

  const drawStyles = useMemo(() => {
    // Custom styles let us:
    // - Keep tactical look
    // - Apply trail width from feature property "brush" clamped to MAX_TRAIL_WIDTH_PX
    return [
      // ACTIVE POLYGON FILL
      {
        id: 'gl-draw-polygon-fill-active',
        type: 'fill',
        filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
        paint: {
          'fill-color': '#16a34a', // emerald-ish (active)
          'fill-opacity': 0.12,
        },
      },
      // INACTIVE POLYGON FILL
      {
        id: 'gl-draw-polygon-fill-inactive',
        type: 'fill',
        filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
        paint: {
          'fill-color': '#0ea5e9',
          'fill-opacity': 0.08,
        },
      },
      // POLYGON OUTLINE
      {
        id: 'gl-draw-polygon-stroke',
        type: 'line',
        filter: ['==', '$type', 'Polygon'],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#e2e8f0',
          'line-width': 1.5,
          'line-opacity': 0.9,
        },
      },
      // LINESTRING (TRAILS / LINES) — width is clamped (Rule C)
      {
        id: 'gl-draw-line',
        type: 'line',
        filter: ['==', '$type', 'LineString'],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#e2e8f0',
          'line-opacity': 0.95,
          'line-width': [
            'min',
            ['coalesce', ['get', 'brush'], 1],
            MAX_TRAIL_WIDTH_PX,
          ],
        },
      },
      // VERTICES
      {
        id: 'gl-draw-points',
        type: 'circle',
        filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']],
        paint: {
          'circle-radius': 3,
          'circle-color': '#e2e8f0',
        },
      },
    ] as any
  }, [])

  // --- init map + draw
  useEffect(() => {
    if (!containerRef.current) return
    if (mapRef.current) return

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
    if (!mapboxgl.accessToken) {
      console.error('Missing NEXT_PUBLIC_MAPBOX_TOKEN')
      return
    }

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [-96.57, 38.66], // default-ish Kansas
      zoom: 12,
      attributionControl: false,
    })

    mapRef.current = map

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      // We'll switch modes ourselves based on activeTool.
      // Keep simple controls off (dock drives selection).
      styles: drawStyles,
      userProperties: true, // keep tool/brush metadata
    })
    drawRef.current = draw

    map.addControl(draw, 'top-left')

    // Track center for spatialContext
    const updateCenter = () => {
      const c = map.getCenter()
      setCenter({ lng: c.lng, lat: c.lat })
    }
    map.on('moveend', updateCenter)

    // --- Rule B: Live Acreage on every draw event
    const recalc = () => {
      const d = drawRef.current
      if (!d) return
      const fc = d.getAll()

      // Update store with raw geojson
      setDrawnShapes(fc)

      // Count tools (based on feature property "tool")
      const counts: Record<string, number> = {}
      for (const f of fc.features) {
        const tool = (f.properties?.tool as string) || 'unknown'
        counts[tool] = (counts[tool] || 0) + 1
      }
      setToolCounts(counts)

      // "Current shape" acreage:
      // - If a single feature is selected, show that.
      // - Otherwise show total polygon acres.
      const selected = d.getSelected()
      const selectedFeature = selected?.features?.length === 1 ? selected.features[0] : null

      const calcFeatureAcres = (feature: any) => {
        try {
          if (!feature?.geometry) return 0
          // turfArea returns m² for Polygon/MultiPolygon; LineStrings are 0
          const m2 = turfArea(feature as any)
          return toAcres(m2)
        } catch {
          return 0
        }
      }

      let acres = 0
      if (selectedFeature) {
        acres = calcFeatureAcres(selectedFeature)
      } else {
        // total of all polygons
        for (const f of fc.features) {
          const t = f.geometry?.type
          if (t === 'Polygon' || t === 'MultiPolygon') {
            acres += calcFeatureAcres(f)
          }
        }
      }

      setHudAcres(acres)
      setPropertyAcres(acres)
    }

    const onCreate = (e: any) => {
      // Apply tool + brush metadata to created features
      const d = drawRef.current
      if (!d) return

      const clampedBrush = clamp(brushSize, 1, MAX_TRAIL_WIDTH_PX)

      for (const f of e.features || []) {
        // Tag feature with the tool that created it
        if (f?.id) d.setFeatureProperty(f.id, 'tool', activeTool)

        // If LineString (trail), set brush width property (Rule C)
        if (f?.id && f?.geometry?.type === 'LineString') {
          d.setFeatureProperty(f.id, 'brush', clampedBrush)
        }
      }

      recalc()
    }

    const onUpdate = (e: any) => {
      // Keep trail brush clamped on updates too (Rule C)
      const d = drawRef.current
      if (!d) return

      const clampedBrush = clamp(brushSize, 1, MAX_TRAIL_WIDTH_PX)

      for (const f of e.features || []) {
        if (f?.id && f?.geometry?.type === 'LineString') {
          d.setFeatureProperty(f.id, 'brush', clampedBrush)
        }
      }

      recalc()
    }

    const onDelete = () => recalc()

    map.on('draw.create', onCreate)
    map.on('draw.update', onUpdate)
    map.on('draw.delete', onDelete)
    map.on('draw.selectionchange', recalc)

    map.on('load', () => {
      updateCenter()

      // Tony suggestion layer (red dashed lines)
      // Source id/layer id are stable so we can update data later.
      map.addSource('tony-suggestions', {
        type: 'geojson',
        data: tonySuggestions || { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: 'tony-suggestions-line',
        type: 'line',
        source: 'tony-suggestions',
        filter: ['==', '$type', 'LineString'],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#ea580c', // orange-red
          'line-width': 2,
          'line-dasharray': [2, 2],
          'line-opacity': 0.95,
        },
      })
    })

    return () => {
      try {
        map.off('moveend', updateCenter)
        map.remove()
      } finally {
        mapRef.current = null
        drawRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Rule A: Anchor Lock (bolted map while drawing)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const isDrawing = DRAWING_TOOLS.has(activeTool)

    if (isDrawing) {
      map.dragPan.disable()
      map.scrollZoom.disable()
      map.doubleClickZoom.disable()
      map.boxZoom.disable()
      map.keyboard.disable()
      map.touchZoomRotate.disable()
    } else {
      map.dragPan.enable()
      map.scrollZoom.enable()
      map.doubleClickZoom.enable()
      map.boxZoom.enable()
      map.keyboard.enable()
      map.touchZoomRotate.enable()
    }
  }, [activeTool])

  // Switch MapboxDraw mode based on tool selection (minimal, no sidebar)
  useEffect(() => {
    const d = drawRef.current
    if (!d) return

    // Keep selection mode for nav/inspect
    if (activeTool === 'nav') {
      d.changeMode('simple_select')
      return
    }

    // Pick a draw mode based on your tool taxonomy
    // - trails -> line
    // - stands -> point (you can later swap to custom stand icon layer)
    // - everything else -> polygon
    if (activeTool === 'trail') d.changeMode('draw_line_string')
    else if (activeTool === 'stand') d.changeMode('draw_point')
    else d.changeMode('draw_polygon')
  }, [activeTool])

  // Update Tony suggestions source when store changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const src = map.getSource('tony-suggestions') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    src.setData(tonySuggestions || { type: 'FeatureCollection', features: [] })
  }, [tonySuggestions])

  return (
    <div className="relative h-full w-full bg-zinc-950">
      {/* Map canvas */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Tactical HUD: acreage badge (Rule B) */}
      <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2">
        <div className="bg-gray-900/85 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl px-4 py-2">
          <div className="text-[11px] tracking-[0.22em] uppercase text-stone-400">
            Acreage
          </div>
          <div className="text-lg font-semibold text-white tabular-nums">
            {hudAcres.toFixed(2)} <span className="text-stone-400 text-sm">ac</span>
          </div>
          <div className="text-[10px] text-stone-400">
            Brush cap: {MAX_TRAIL_WIDTH_PX}px
          </div>
        </div>
      </div>
    </div>
  )
}
