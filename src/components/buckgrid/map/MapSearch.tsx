'use client'

import React, { useEffect, useRef } from 'react'
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'

// This component expects a map instance (Mapbox GL JS) as prop
export default function MapSearch({ map }: { map: any }) {
  const geocoderContainer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!map || !geocoderContainer.current) return
    // Dynamically import to avoid SSR issues
    import('mapbox-gl').then((mapboxgl) => {
      import('@mapbox/mapbox-gl-geocoder').then((module) => {
        const MapboxGeocoder = module.default
        const geocoder = new MapboxGeocoder({
          accessToken: mapboxgl.default.accessToken || mapboxgl.accessToken,
          mapboxgl: mapboxgl.default || mapboxgl,
          marker: false,
          placeholder: 'Search property or place',
          flyTo: { zoom: 15 },
        })
        geocoderContainer.current.innerHTML = ''
        geocoderContainer.current.appendChild(geocoder.onAdd(map))
      })
    })
  }, [map])

  return (
    <div
      ref={geocoderContainer}
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 1000,
        minWidth: 220,
        maxWidth: 320,
      }}
    />
  )
}
