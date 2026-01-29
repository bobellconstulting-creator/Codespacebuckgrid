'use client'

import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react'
import type { Tool } from '../constants/tools'
import { useMapDrawing, type MapApi } from '../hooks/useMapDrawing'
import { useConsultantLayer, type ConsultantApi } from '../hooks/useConsultantLayer'
import type * as LeafletNS from 'leaflet'

export type MapContainerHandle = MapApi & {
  consultant: ConsultantApi
}

type Props = {
  activeTool: Tool
  brushSize: number
  consultantMode: boolean
}

const MapContainer = forwardRef<MapContainerHandle, Props>(
  ({ activeTool, brushSize, consultantMode }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const { api, handlers } = useMapDrawing({ containerRef, activeTool, brushSize })

    // Track Leaflet map instance for the consultant layer
    const [mapInstance, setMapInstance] = useState<LeafletNS.Map | null>(null)
    useEffect(() => {
      // Poll briefly for the map to initialize (it's async in useMapDrawing)
      const id = setInterval(() => {
        const m = api.getMapInstance()
        if (m) { setMapInstance(m); clearInterval(id) }
      }, 100)
      return () => clearInterval(id)
    }, [api])

    const consultant = useConsultantLayer({
      containerRef,
      activeTool,
      brushSize,
      mapInstance,
      enabled: consultantMode,
    })

    useImperativeHandle(ref, () => ({
      ...api,
      consultant: consultant.api,
    }), [api, consultant.api])

    const isConsultantTool = activeTool.layer === 'consultant'

    return (
      <div
        ref={containerRef}
        onPointerDown={(e) => {
          if (isConsultantTool && consultantMode) consultant.handlers.onPointerDown(e)
          else handlers.onPointerDown(e)
        }}
        onPointerMove={(e) => {
          if (isConsultantTool && consultantMode) consultant.handlers.onPointerMove(e)
          else handlers.onPointerMove(e)
        }}
        onPointerUp={(e) => {
          if (isConsultantTool && consultantMode) consultant.handlers.onPointerUp()
          else handlers.onPointerUp()
        }}
        style={{ height: '100%', width: '100%', zIndex: 1, touchAction: 'none', background: '#000' }}
      />
    )
  }
)

MapContainer.displayName = 'MapContainer'
export default React.memo(MapContainer)
