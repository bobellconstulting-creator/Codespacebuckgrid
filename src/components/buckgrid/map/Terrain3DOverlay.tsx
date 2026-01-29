'use client'

import React, { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'

/**
 * Terrain3DOverlay — Mapbox GL JS powered 3D terrain view.
 * Renders as an absolute-positioned layer that covers the map viewport.
 * When `active` is false, unmounts the GL context to save resources.
 *
 * Requires a Mapbox access token passed via NEXT_PUBLIC_MAPBOX_TOKEN env var
 * or the `token` prop.
 */

export type Terrain3DHandle = {
  /** Fly to a coordinate so the 3D view stays in sync with Leaflet pans */
  flyTo: (center: [number, number], zoom: number) => void
}

type Props = {
  active: boolean
  /** initial center [lng, lat] */
  center?: [number, number]
  zoom?: number
  token?: string
}

const DEFAULT_CENTER: [number, number] = [-96.4937, 38.6583]
const DEFAULT_ZOOM = 14

const Terrain3DOverlay = forwardRef<Terrain3DHandle, Props>(
  ({ active, center = DEFAULT_CENTER, zoom = DEFAULT_ZOOM, token }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<any>(null) // mapboxgl.Map

    const flyTo = useCallback((c: [number, number], z: number) => {
      mapRef.current?.flyTo({ center: c, zoom: z, duration: 600 })
    }, [])

    useImperativeHandle(ref, () => ({ flyTo }), [flyTo])

    useEffect(() => {
      if (!active) {
        // Tear down when toggled off
        mapRef.current?.remove()
        mapRef.current = null
        return
      }

      let cancelled = false
      const init = async () => {
        const mapboxgl = (await import('mapbox-gl')).default
        if (cancelled || !containerRef.current) return

        const accessToken =
          token ||
          process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
          '' // will fail gracefully with no token

        ;(mapboxgl as any).accessToken = accessToken

        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: 'mapbox://styles/mapbox/satellite-streets-v12',
          center,
          zoom,
          pitch: 60,
          bearing: -30,
          antialias: true,
        })

        map.on('style.load', () => {
          // Add Mapbox Terrain-RGB DEM source
          map.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 512,
            maxzoom: 14,
          })
          map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 })

          // Sky atmosphere for realism
          map.addLayer({
            id: 'sky',
            type: 'sky',
            paint: {
              'sky-type': 'atmosphere',
              'sky-atmosphere-sun': [0.0, 0.0],
              'sky-atmosphere-sun-intensity': 15,
            },
          })

          // Hill-shade layer for ridge/draw visibility
          map.addSource('hillshade-src', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 512,
          })
          map.addLayer({
            id: 'hillshade',
            source: 'hillshade-src',
            type: 'hillshade',
            paint: {
              'hillshade-exaggeration': 0.5,
              'hillshade-shadow-color': '#000',
            },
          })
        })

        map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')
        mapRef.current = map
      }

      init()
      return () => {
        cancelled = true
        mapRef.current?.remove()
        mapRef.current = null
      }
    }, [active, center, zoom, token])

    return (
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: active ? 2 : -1,
          opacity: active ? 1 : 0,
          pointerEvents: active ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />
    )
  }
)

Terrain3DOverlay.displayName = 'Terrain3DOverlay'
export default React.memo(Terrain3DOverlay)
