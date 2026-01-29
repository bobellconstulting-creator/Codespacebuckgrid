'use client'

import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import mapboxgl from 'mapbox-gl'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

export type MapboxEngineHandle = {
  getMap: () => mapboxgl.Map | null
  getCaptureElement: () => HTMLElement | null
}

const MapboxEngine = forwardRef<MapboxEngineHandle>((_, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  useImperativeHandle(ref, () => ({
    getMap: () => mapRef.current,
    getCaptureElement: () => containerRef.current,
  }))

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-96.4937, 38.6583],
      zoom: 15,
      pitch: 60,
      bearing: -20,
      antialias: true,
    })

    map.on('style.load', () => {
      // 3D Terrain — mapbox-dem with 1.5x exaggeration
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      })
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 })

      // Sky layer for 3D atmosphere
      map.addLayer({
        id: 'sky',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 0.0],
          'sky-atmosphere-sun-intensity': 15,
        },
      })

      // Consultant Correction Layer — dashed red lines
      map.addSource('consultant-corrections', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: 'consultant-corrections-layer',
        type: 'line',
        source: 'consultant-corrections',
        paint: {
          'line-color': '#ef4444',
          'line-width': 3,
          'line-dasharray': [4, 3],
        },
      })
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        height: '100vh',
        width: '100vw',
        zIndex: 1,
      }}
    />
  )
})

MapboxEngine.displayName = 'MapboxEngine'

export default React.memo(MapboxEngine)
