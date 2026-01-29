'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import * as turf from '@turf/turf'
import { useMapStore } from '@/stores/mapStore'
import { TOOLS } from '../constants/tools'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

export default function MapEngine() {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)
  const drawPointsRef = useRef<[number, number][]>([])
  const isDrawingRef = useRef(false)

  const {
    setMap,
    activeTool,
    brushSize,
    addShape,
    addCorrection,
    shapes,
    corrections,
    boundaryCoords,
    setBoundaryCoords,
    setPropertyAcres,
    setLocked,
    isLocked,
  } = useMapStore()

  // Initialize Mapbox 3D terrain map
  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return

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

    map.on('style.load', () => {
      // 3D Terrain with 1.5x exaggeration
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

      // Sources for drawn layers
      map.addSource('boundary', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'boundary-fill',
        type: 'fill',
        source: 'boundary',
        paint: { 'fill-color': '#FF6B00', 'fill-opacity': 0.12 },
      })
      map.addLayer({
        id: 'boundary-line',
        type: 'line',
        source: 'boundary',
        paint: { 'line-color': '#FF6B00', 'line-width': 3, 'line-opacity': 0.9 },
      })

      // Shapes layer
      map.addSource('shapes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'shapes-fill',
        type: 'fill',
        source: 'shapes',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.35,
        },
        filter: ['==', ['get', 'shapeType'], 'polygon'],
      })
      map.addLayer({
        id: 'shapes-line',
        type: 'line',
        source: 'shapes',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3,
        },
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

      // Consultant correction layer (red dashed)
      map.addSource('corrections', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'corrections-line',
        type: 'line',
        source: 'corrections',
        paint: {
          'line-color': '#FF0000',
          'line-width': 4,
          'line-dasharray': [4, 3],
          'line-opacity': 0.9,
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
        },
        paint: {
          'text-color': '#FF0000',
          'text-halo-color': '#000000',
          'text-halo-width': 1.5,
        },
      })
    })

    mapInstanceRef.current = map
    setMap(map)

    return () => {
      map.remove()
      mapInstanceRef.current = null
      setMap(null)
    }
  }, [setMap])

  // Sync shapes to map
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !map.isStyleLoaded()) return

    const features: GeoJSON.Feature[] = shapes.map((s) => {
      if (s.type === 'marker') {
        return {
          type: 'Feature',
          properties: { color: s.color, shapeType: 'marker', id: s.id },
          geometry: { type: 'Point', coordinates: s.coordinates[0] },
        }
      }
      if (s.type === 'polyline') {
        return {
          type: 'Feature',
          properties: { color: s.color, shapeType: 'polyline', id: s.id },
          geometry: { type: 'LineString', coordinates: s.coordinates },
        }
      }
      return {
        type: 'Feature',
        properties: { color: s.color, shapeType: 'polygon', id: s.id },
        geometry: { type: 'Polygon', coordinates: [s.coordinates.length > 2 ? [...s.coordinates, s.coordinates[0]] : s.coordinates] },
      }
    })

    const src = map.getSource('shapes') as any
    if (src) src.setData({ type: 'FeatureCollection', features })
  }, [shapes])

  // Sync corrections to map
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !map.isStyleLoaded()) return

    const features: GeoJSON.Feature[] = corrections.map((c) => ({
      type: 'Feature',
      properties: { label: c.label },
      geometry: { type: 'LineString', coordinates: c.coordinates },
    }))

    const src = map.getSource('corrections') as any
    if (src) src.setData({ type: 'FeatureCollection', features })
  }, [corrections])

  // Sync boundary to map
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !map.isStyleLoaded()) return

    const src = map.getSource('boundary') as any
    if (!src) return

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
  }, [boundaryCoords])

  // Drawing interaction
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

    // Start polyline/polygon drawing
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
        label: 'CORRECTION',
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

  // Disable map interaction when drawing
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    const tool = getActiveTool()
    if (tool && tool.drawType !== 'none') {
      map.getCanvas().style.cursor = 'crosshair'
    } else {
      map.getCanvas().style.cursor = ''
    }
  }, [activeTool, getActiveTool])

  return (
    <div
      ref={containerRef}
      id="map-engine"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
    />
  )
}
