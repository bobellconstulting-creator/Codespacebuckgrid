'use client'

import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import type { Tool } from '../constants/tools'
import { useMapDrawing, type MapApi } from '../hooks/useMapDrawing'

export type MapContainerHandle = MapApi

const MapContainer = forwardRef<MapContainerHandle, { activeTool: Tool, brushSize: number }>(({ activeTool, brushSize }, ref) => {
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const { api, handlers } = useMapDrawing({ containerRef, activeTool, brushSize })
  useImperativeHandle(ref, () => api, [api])

  const runManualSearch = async () => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
    if (!token) { alert("Missing Token"); return }
    try {
      // 1. Get Location
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${token}`)
      const data = await res.json()
      // 2. Fly Map (Check if 'api' exists, otherwise just log for now)
      if (data.features?.[0]?.center) {
        const [lng, lat] = data.features[0].center
        console.log("Flying to:", lat, lng)
        if (api && typeof api.flyTo === 'function') {
          api.flyTo([lat, lng], 16)
        }
      }
    } catch (e) { console.error(e) }
  }

  return (
    <>
      {/* --- SEARCH BAR (New) --- */}
      <div style={{
          position: 'fixed',
          top: '20px',
          right: '80px',
          zIndex: 99999, /* Force on top */
          backgroundColor: 'white',
          padding: '10px',
          borderRadius: '8px',
          border: '4px solid red', /* RED BORDER FOR VISIBILITY */
          display: 'flex',
          gap: '5px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
      }}>
        <input 
           value={searchQuery} 
           onChange={(e) => setSearchQuery(e.target.value)}
           onKeyDown={(e) => e.key === 'Enter' && runManualSearch()}
           placeholder="Search Address..."
           style={{border: '1px solid #ccc', color: 'black', padding: '5px'}}
        />
        <button onClick={runManualSearch} style={{background: 'blue', color: 'white', padding: '5px 10px'}}>GO</button>
      </div>

      {/* --- EXISTING MAP CONTAINER (Preserved) --- */}
      <div
        ref={containerRef}
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        style={{ height: '100%', width: '100%', zIndex: 1, touchAction: 'none', background: '#000' }}
      />
    </>
  )
})

MapContainer.displayName = 'MapContainer'

export default React.memo(MapContainer)
