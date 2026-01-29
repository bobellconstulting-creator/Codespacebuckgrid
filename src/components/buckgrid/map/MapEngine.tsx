'use client'

import React, { useEffect, useRef, useCallback, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import * as turf from '@turf/turf'
import { useMapStore, computeFieldRec } from '@/stores/mapStore'
import { TOOLS } from '../constants/tools'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

export default function MapEngine() {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)
  const drawPointsRef = useRef<[number, number][]>([])
  const isDrawingRef = useRef(false)

  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  const {
    setMap,
    activeTool,
    addShape,
    addCorrection,
    shapes,
    corrections,
    showCorrections,
    boundaryCoords,
    boundaryGeoJSON,
    setBoundaryCoords,
    setSelectedShape,
    setFieldRecommendation,
  } = useMapStore()

  // Initialize Mapbox GL v3 — 3D Terrain Engine
  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return

    if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes('placeholder')) {
      console.error('[BuckGrid] Missing NEXT_PUBLIC_MAPBOX_TOKEN in .env.local')
      setErrorMsg('Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local')
      setMapStatus('error')
      return
    }

    try {
      mapboxgl.accessToken = MAPBOX_TOKEN

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [-96.4937, 38.6583],
        zoom: 15,
        pitch: 45,
        bearing: 0,
        antialias: true,
        attributionControl: false,
      })

      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right')

      map.on('error', (e: any) => {
        console.error('[BuckGrid] Mapbox error:', e.error?.message || e)
      })

      map.on('load', () => {
        console.log('[BuckGrid] Map loaded successfully')
        setMapStatus('ready')
      })

      map.on('style.load', () => {
        // 3D Terrain — 1.5x exaggeration (ridges, draws, bedding benches)
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        })
        map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 })

        // Sky atmosphere
        map.addLayer({
          id: 'sky',
          type: 'sky',
          paint: {
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [0.0, 0.0],
            'sky-atmosphere-sun-intensity': 15,
          },
        })

        // === BOUNDARY ===
        map.addSource('boundary', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addLayer({
          id: 'boundary-fill',
          type: 'fill',
          source: 'boundary',
          paint: { 'fill-color': '#FF6B00', 'fill-opacity': 0.1 },
        })
        map.addLayer({
          id: 'boundary-line',
          type: 'line',
          source: 'boundary',
          paint: { 'line-color': '#FF6B00', 'line-width': 3, 'line-opacity': 0.9 },
        })

        // === SHAPES ===
        map.addSource('shapes', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addLayer({
          id: 'shapes-fill',
          type: 'fill',
          source: 'shapes',
          paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.35 },
          filter: ['==', ['get', 'shapeType'], 'polygon'],
        })
        map.addLayer({
          id: 'shapes-line',
          type: 'line',
          source: 'shapes',
          paint: { 'line-color': ['get', 'color'], 'line-width': 3 },
          filter: ['any',
            ['==', ['get', 'shapeType'], 'polygon'],
            ['==', ['get', 'shapeType'], 'polyline'],
          ],
        })
        map.addLayer({
          id: 'shapes-points',
          type: 'circle',
          source: 'shapes',
          paint: {
            'circle-radius': 8,
            'circle-color': ['get', 'color'],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
          },
          filter: ['==', ['get', 'shapeType'], 'marker'],
        })

        // === ACREAGE LABELS (centroid of each polygon) ===
        map.addSource('shape-labels', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addLayer({
          id: 'shape-labels-text',
          type: 'symbol',
          source: 'shape-labels',
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 12,
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
            'text-anchor': 'center',
            'text-allow-overlap': true,
          },
          paint: {
            'text-color': '#FFFFFF',
            'text-halo-color': '#000000',
            'text-halo-width': 1.5,
          },
        })

        // === CONSULTANT CORRECTIONS (red #ef4444, heavy dashed) ===
        map.addSource('corrections', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addLayer({
          id: 'corrections-line',
          type: 'line',
          source: 'corrections',
          paint: {
            'line-color': '#ef4444',
            'line-width': 4,
            'line-dasharray': [4, 3],
            'line-opacity': 0.95,
          },
        })
        map.addLayer({
          id: 'corrections-label',
          type: 'symbol',
          source: 'corrections',
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 11,
            'text-offset': [0, -1.2],
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
          },
          paint: {
            'text-color': '#ef4444',
            'text-halo-color': '#000000',
            'text-halo-width': 1.5,
          },
        })

        // === CLICK: field recommendation on food plot polygons ===
        map.on('click', 'shapes-fill', (e: any) => {
          const props = e.features?.[0]?.properties
          if (!props) return
          const { id, toolId, acreage } = props
          if (acreage && toolId) {
            const rec = computeFieldRec(toolId, acreage)
            if (rec) {
              setSelectedShape(id)
              setFieldRecommendation({ ...rec, shapeId: id })
            }
          }
        })

        map.on('mouseenter', 'shapes-fill', () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', 'shapes-fill', () => {
          const tool = TOOLS.find((t) => t.id === useMapStore.getState().activeTool)
          map.getCanvas().style.cursor = tool && tool.drawType !== 'none' ? 'crosshair' : ''
        })
      })

      mapInstanceRef.current = map
      setMap(map)

      return () => {
        map.remove()
        mapInstanceRef.current = null
        setMap(null)
      }
    } catch (err) {
      console.error('[BuckGrid] Failed to initialize map:', err)
      setErrorMsg('Map initialization failed. Check console.')
      setMapStatus('error')
    }
  }, [setMap, setSelectedShape, setFieldRecommendation])

  // Sync shapes + acreage labels
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !map.isStyleLoaded()) return

    const shapeFeatures: GeoJSON.Feature[] = []
    const labelFeatures: GeoJSON.Feature[] = []

    shapes.forEach((s) => {
      if (s.type === 'marker') {
        shapeFeatures.push({
          type: 'Feature',
          properties: { color: s.color, shapeType: 'marker', id: s.id, toolId: s.toolId },
          geometry: { type: 'Point', coordinates: s.coordinates[0] },
        })
      } else if (s.type === 'polyline') {
        shapeFeatures.push({
          type: 'Feature',
          properties: { color: s.color, shapeType: 'polyline', id: s.id, toolId: s.toolId },
          geometry: { type: 'LineString', coordinates: s.coordinates },
        })
      } else {
        const ring = s.coordinates.length > 2 ? [...s.coordinates, s.coordinates[0]] : s.coordinates
        shapeFeatures.push({
          type: 'Feature',
          properties: { color: s.color, shapeType: 'polygon', id: s.id, toolId: s.toolId, acreage: s.acreage },
          geometry: { type: 'Polygon', coordinates: [ring] },
        })

        // Dynamic acreage label at centroid
        if (s.acreage && s.coordinates.length >= 3) {
          const poly = turf.polygon([ring])
          const center = turf.centroid(poly)
          const toolName = TOOLS.find((t) => t.id === s.toolId)?.name || ''
          labelFeatures.push({
            type: 'Feature',
            properties: { label: `${toolName}\n${s.acreage} ac` },
            geometry: center.geometry,
          })
        }
      }
    })

    const shapeSrc = map.getSource('shapes') as any
    if (shapeSrc) shapeSrc.setData({ type: 'FeatureCollection', features: shapeFeatures })

    const labelSrc = map.getSource('shape-labels') as any
    if (labelSrc) labelSrc.setData({ type: 'FeatureCollection', features: labelFeatures })
  }, [shapes])

  // Sync corrections + visibility toggle
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !map.isStyleLoaded()) return

    const vis = showCorrections ? 'visible' : 'none'
    if (map.getLayer('corrections-line')) map.setLayoutProperty('corrections-line', 'visibility', vis)
    if (map.getLayer('corrections-label')) map.setLayoutProperty('corrections-label', 'visibility', vis)

    if (!showCorrections) return

    const features: GeoJSON.Feature[] = corrections.map((c) => ({
      type: 'Feature',
      properties: { label: c.label },
      geometry: { type: 'LineString', coordinates: c.coordinates },
    }))

    const src = map.getSource('corrections') as any
    if (src) src.setData({ type: 'FeatureCollection', features })
  }, [corrections, showCorrections])

  // Sync boundary (hand-drawn OR uploaded GeoJSON/KML)
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !map.isStyleLoaded()) return

    const src = map.getSource('boundary') as any
    if (!src) return

    // Uploaded GeoJSON takes precedence
    if (boundaryGeoJSON) {
      src.setData(boundaryGeoJSON)
      const bbox = turf.bbox(boundaryGeoJSON) as [number, number, number, number]
      map.fitBounds(bbox, { padding: 80, pitch: 45, duration: 1500 })
      return
    }

    if (boundaryCoords.length < 3) {
      src.setData({ type: 'FeatureCollection', features: [] })
      return
    }

    const ring = [...boundaryCoords, boundaryCoords[0]]
    src.setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [ring] },
      }],
    })
  }, [boundaryCoords, boundaryGeoJSON])

  // Drawing handlers
  const getActiveTool = useCallback(() => TOOLS.find((t) => t.id === activeTool), [activeTool])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const tool = getActiveTool()
    if (!tool || tool.drawType === 'none') return

    const map = mapInstanceRef.current
    if (!map) return

    const lngLat = map.unproject([e.nativeEvent.offsetX, e.nativeEvent.offsetY])
    const coord: [number, number] = [lngLat.lng, lngLat.lat]

    if (tool.id === 'boundary') {
      const newCoords = [...boundaryCoords, coord]
      setBoundaryCoords(newCoords)
      return
    }

    if (tool.drawType === 'marker') {
      addShape({
        id: `shape-${Date.now()}`,
        toolId: tool.id,
        color: tool.color,
        coordinates: [coord],
        type: 'marker',
      })
      return
    }

    isDrawingRef.current = true
    drawPointsRef.current = [coord]
    map.dragPan.disable()
  }, [activeTool, boundaryCoords, setBoundaryCoords, addShape, getActiveTool])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawingRef.current) return
    const map = mapInstanceRef.current
    if (!map) return
    const lngLat = map.unproject([e.nativeEvent.offsetX, e.nativeEvent.offsetY])
    drawPointsRef.current.push([lngLat.lng, lngLat.lat])
  }, [])

  const handleMouseUp = useCallback(() => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    mapInstanceRef.current?.dragPan.enable()

    const tool = getActiveTool()
    if (!tool) return
    const coords = drawPointsRef.current
    if (coords.length < 2) return

    if (tool.id === 'correction') {
      addCorrection({
        id: `corr-${Date.now()}`,
        coordinates: coords,
        label: 'TONY CORRECTION',
      })
    } else {
      let acreage: number | undefined
      if (tool.drawType === 'polygon' && coords.length >= 3) {
        const ring = [...coords, coords[0]]
        const poly = turf.polygon([ring])
        acreage = Number((turf.area(poly) * 0.000247105).toFixed(2))
      }

      addShape({
        id: `shape-${Date.now()}`,
        toolId: tool.id,
        color: tool.color,
        coordinates: coords,
        type: tool.drawType as 'polygon' | 'polyline',
        acreage,
      })
    }

    drawPointsRef.current = []
  }, [activeTool, addShape, addCorrection, getActiveTool])

  // Cursor
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    const tool = getActiveTool()
    map.getCanvas().style.cursor = tool && tool.drawType !== 'none' ? 'crosshair' : ''
  }, [activeTool, getActiveTool])

  return (
    <>
      {/* Map container — always rendered for Mapbox to attach */}
      <div
        ref={containerRef}
        id="map-engine"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
      />

      {/* Loading overlay */}
      {mapStatus === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: '#0A0F0A', gap: 12,
        }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#FF6B00', letterSpacing: 3 }}>
            BUCKGRID PRO
          </div>
          <div style={{ fontSize: 11, color: '#6B8060', letterSpacing: 1 }}>
            Loading 3D terrain engine...
          </div>
          <div style={{
            width: 40, height: 40, border: '3px solid #1C2820',
            borderTopColor: '#FF6B00', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error overlay */}
      {mapStatus === 'error' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: '#0A0F0A', gap: 14,
        }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#FF6B00', letterSpacing: 3 }}>
            BUCKGRID PRO
          </div>
          <div style={{
            padding: '14px 20px', background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
            maxWidth: 340, textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', marginBottom: 6 }}>
              MAP ENGINE ERROR
            </div>
            <div style={{ fontSize: 11, color: '#6B8060', lineHeight: 1.6 }}>
              {errorMsg || 'Failed to initialize Mapbox.'}
            </div>
            <div style={{
              fontSize: 10, color: '#3D4F35', marginTop: 10,
              fontFamily: 'monospace', background: '#0D120D',
              padding: '8px 10px', borderRadius: 6, textAlign: 'left',
            }}>
              # .env.local<br />
              NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token
            </div>
          </div>
        </div>
      )}
    </>
  )
}
