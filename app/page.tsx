'use client'

import React, { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

export default function Home() {
  const ref = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('MOUNTING...')

  useEffect(() => {
    if (!ref.current) { setStatus('NO REF'); return }
    setStatus('INIT MAP...')
    try {
      mapboxgl.accessToken = 'pk.eyJ1IjoiYm9iZWxsODciLCJhIjoiY21rdDBkb2V5MHo5NzNlb2RyeWJ0dnZkMSJ9.cBBzJ0BR4wm5TLeItbOI_g'
      const map = new mapboxgl.Map({
        container: ref.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [-96.4937, 38.6583],
        zoom: 15,
        pitch: 45,
      })
      map.on('load', () => setStatus('MAP LOADED'))
      map.on('error', (e: any) => setStatus('ERROR: ' + (e.error?.message || 'unknown')))
    } catch (err: any) {
      setStatus('CRASH: ' + err.message)
    }
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative' }}>
      <div ref={ref} style={{ width: '100%', height: '100%', border: '10px solid green' }} />
      <div style={{
        position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
        background: '#000', color: '#0f0', padding: '12px 24px', borderRadius: 8,
        fontSize: 18, fontWeight: 900, zIndex: 9999, border: '2px solid #0f0',
      }}>
        {status}
      </div>
    </div>
  )
}
