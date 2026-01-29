'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Tool } from '../constants/tools'
import type * as LeafletNS from 'leaflet'

export type GeoPin = {
  lat: number
  lng: number
  mediaUrl: string  // data-url or blob URL for photo/video
  note: string
}

export type ConsultantApi = {
  /** Returns all geo-pinned media entries */
  getPins: () => GeoPin[]
  /** Clear all consultant drawings */
  clearCorrections: () => void
  /** Programmatically add a geo-pin */
  addPin: (pin: GeoPin) => void
}

/**
 * useConsultantLayer — manages a distinct drawing layer for consultant corrections.
 * Drawings use dashed red strokes to visually separate from the user's layer.
 * Pin tool drops a marker that can hold a photo/video reference.
 */
export function useConsultantLayer(args: {
  containerRef: React.RefObject<HTMLDivElement>
  activeTool: Tool
  brushSize: number
  /** The Leaflet map instance from the main useMapDrawing hook */
  mapInstance: LeafletNS.Map | null
  enabled: boolean
}) {
  const { activeTool, brushSize, mapInstance, enabled } = args

  const LRef = useRef<typeof LeafletNS | null>(null)
  const layerRef = useRef<LeafletNS.FeatureGroup | null>(null)
  const pinsRef = useRef<GeoPin[]>([])
  const tempPathRef = useRef<LeafletNS.Polyline | null>(null)
  const isDrawingRef = useRef(false)

  const activeToolRef = useRef(activeTool)
  const brushSizeRef = useRef(brushSize)
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  useEffect(() => { brushSizeRef.current = brushSize }, [brushSize])

  // Initialize the consultant FeatureGroup once we have a map
  useEffect(() => {
    if (!mapInstance || !enabled) return
    let mounted = true
    const init = async () => {
      const leaflet = await import('leaflet')
      if (!mounted) return
      LRef.current = leaflet
      if (!layerRef.current) {
        layerRef.current = new leaflet.FeatureGroup().addTo(mapInstance)
      }
    }
    init()
    return () => { mounted = false }
  }, [mapInstance, enabled])

  const isConsultantTool = (t: Tool) => t.layer === 'consultant'

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const L = LRef.current
    const tool = activeToolRef.current
    if (!mapInstance || !L || !layerRef.current || !enabled || !isConsultantTool(tool)) return
    if (tool.id === 'nav') return

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const latlng = mapInstance.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top])

    // PIN tool — drop a geo-pin marker
    if (tool.id === 'cx-pin') {
      const pin: GeoPin = { lat: latlng.lat, lng: latlng.lng, mediaUrl: '', note: '' }
      pinsRef.current.push(pin)

      const marker = L.circleMarker(latlng, {
        color: tool.color,
        radius: 10,
        fillColor: tool.color,
        fillOpacity: 0.85,
        weight: 3,
      }).addTo(layerRef.current!)

      marker.bindPopup(
        `<div style="text-align:center;font-family:monospace;">
          <strong style="color:${tool.color}">📌 GEO-PIN</strong><br/>
          <span style="font-size:10px;color:#999">${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}</span><br/>
          <label style="font-size:11px;cursor:pointer;color:#FF6B00;margin-top:4px;display:inline-block;">
            📎 Attach Media
            <input type="file" accept="image/*,video/*" style="display:none" />
          </label>
        </div>`
      )
      return
    }

    // Drawing tools — dashed red corrections
    isDrawingRef.current = true
    const dashArray = tool.id === 'cx-trail' ? '8 6' : tool.id === 'cx-move' ? '14 8' : undefined
    tempPathRef.current = L.polyline([latlng], {
      color: tool.color,
      weight: Math.max(brushSizeRef.current * 0.5, 4),
      opacity: 0.85,
      dashArray,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(layerRef.current!)
  }, [mapInstance, enabled])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current || !tempPathRef.current || !mapInstance) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    tempPathRef.current.addLatLng(
      mapInstance.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top])
    )
  }, [mapInstance])

  const onPointerUp = useCallback(() => {
    isDrawingRef.current = false
    tempPathRef.current = null
  }, [])

  const api: ConsultantApi = {
    getPins: () => [...pinsRef.current],
    clearCorrections: () => {
      layerRef.current?.clearLayers()
      pinsRef.current = []
    },
    addPin: (pin: GeoPin) => {
      pinsRef.current.push(pin)
      const L = LRef.current
      if (L && layerRef.current) {
        L.circleMarker([pin.lat, pin.lng], {
          color: '#FFD600',
          radius: 10,
          fillColor: '#FFD600',
          fillOpacity: 0.85,
          weight: 3,
        }).addTo(layerRef.current)
      }
    },
  }

  return { api, handlers: { onPointerDown, onPointerMove, onPointerUp } }
}
