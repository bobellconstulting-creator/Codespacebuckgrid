
'use client'

import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import type { Tool } from '../constants/tools'
import { useMapDrawing, type MapApi } from '../hooks/useMapDrawing'

export type MapContainerHandle = MapApi

const MapContainer = forwardRef<MapContainerHandle, { activeTool: Tool, brushSize: number, chatRef?: React.RefObject<any> }>(({ activeTool, brushSize }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Initialize the drawing engine
  const { api, handlers } = useMapDrawing({ containerRef, activeTool, brushSize })
  
  // Expose the API to the parent
  useImperativeHandle(ref, () => api, [api])

  // Listen for search flyTo events from Tony chat
  React.useEffect(() => {
    const handleFlyTo = (e: CustomEvent) => {
      const { lat, lng, zoom } = e.detail;
      if (api && typeof api.flyTo === 'function') {
        api.flyTo(lat, lng, zoom);
      }
    };
    window.addEventListener('mapFlyTo', handleFlyTo as EventListener);
    return () => window.removeEventListener('mapFlyTo', handleFlyTo as EventListener);
  }, [api]);

  return (
    <>
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
