
'use client'

import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import type { Tool } from '../constants/tools'
import { useMapDrawing, type MapApi } from '../hooks/useMapDrawing'

export type MapContainerHandle = MapApi

const MapContainer = forwardRef<MapContainerHandle, { activeTool: Tool, brushSize: number }>(({ activeTool, brushSize }, ref) => {
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Initialize the drawing engine
  const { api, handlers } = useMapDrawing({ containerRef, activeTool, brushSize })
  
  // Expose the API to the parent
  useImperativeHandle(ref, () => api, [api])

  const runManualSearch = async () => {
    // 1. HARDCODED TOKEN (Fixes Audit Point #1)
    const token = "pk.eyJ1IjoiYm9iZWxsODciLCJhIjoiY21rdDBkb2V5MHo5NzNlb2RyeWJ0dnZkMSJ9.cBBzJ0BR4wm5TLeItbOI_g";
    
    if (!searchQuery) return;

    try {
      // 2. FETCH LOCATION
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${token}`);
      const data = await res.json();
      
      if (data.features?.[0]?.center) {
         const [lng, lat] = data.features[0].center;
         console.log(`Flying to: ${lat}, ${lng}`);

         // 3. FIX NAVIGATION (Now uses api.flyTo)
         if (api && typeof api.flyTo === 'function') {
           api.flyTo(lat, lng, 16);
         } else {
           alert("Map Error: Could not move map.");
         }
      } else {
        alert("Location not found.");
      }
    } catch (e) { console.error("Search Error:", e); }
  };

  return (
    <>
      {/* --- BUCKGRID PRO SEARCH BAR (Fixes Audit Point #3) --- */}
      <div style={{
          position: 'fixed',
          top: '20px',
          right: '80px',
          zIndex: 99999,
          backgroundColor: '#1a1a1a', /* Dark Background */
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid #333',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)'
      }}>
        <input 
           value={searchQuery} 
           onChange={(e) => setSearchQuery(e.target.value)}
           onKeyDown={(e) => e.key === 'Enter' && runManualSearch()}
           placeholder="Search location..."
           style={{
             background: 'transparent',
             border: 'none',
             color: 'white',
             outline: 'none',
             width: '200px',
             fontSize: '14px'
           }}
        />
        <button 
          onClick={runManualSearch} 
          style={{
            background: '#ea580c', /* Orange Accent */
            color: 'white', 
            padding: '6px 12px',
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '12px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          GO
        </button>
      </div>

      {/* MAP CONTAINER */}
      <div
        ref={containerRef}
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        style={{ height: '100%', width: '100%', zIndex: 1, touchAction: 'none', background: '#000' }}
      />
    </>
  );
})

MapContainer.displayName = 'MapContainer'

export default MapContainer
