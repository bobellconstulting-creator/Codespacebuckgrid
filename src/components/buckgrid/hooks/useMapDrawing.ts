import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import L from 'leaflet'
// FIX: Using H3 v4 'polygonToCells' for spatial recognition
import { polygonToCells } from 'h3-js'
import 'leaflet/dist/leaflet.css'

export type LayerType = 'boundary' | 'bedding' | 'food' | 'water' | 'path' | 'structure'

export interface MapApi {
  flyTo: (center: [number, number], zoom: number) => void
  clearAll: () => void
  undoLast: () => void
  setDrawMode: (mode: LayerType) => void
  addSmartFeature: (geojson: any, type: LayerType, label: string) => void
  lockAndBake: () => { count: number; acres: number; pathYards: number; layers: any[] }
}

interface UseMapDrawingProps {
  containerRef: React.RefObject<HTMLDivElement>
  activeTool: string 
  brushSize: number
}

export function useMapDrawing({ containerRef, activeTool, brushSize }: UseMapDrawingProps) {
  const mapRef = useRef<L.Map | null>(null)
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null)
  const currentDrawRef = useRef<L.Polyline | null>(null) 
  
  // 1. INITIALIZE MAP
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView([38.5, -98.0], 7)
    
    // Satellite Layer
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: 'Google Satellite'
    }).addTo(map)

    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)
    drawnItemsRef.current = drawnItems
    mapRef.current = map

    return () => { map.remove(); mapRef.current = null }
  }, [containerRef])

  // 2. HANDLERS (Paint & Touch Fixed)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const onMouseDown = (e: L.LeafletMouseEvent) => {
        if (activeTool === 'cursor') return
        const { lat, lng } = e.latlng
        
        let color = '#FFD700' 
        if (activeTool === 'bedding') color = '#8B4513'
        if (activeTool === 'food') color = '#32CD32'
        if (activeTool === 'water') color = '#00BFFF'
        
        const polyline = L.polyline([[lat, lng]], { color, weight: brushSize || 4, opacity: 0.8 })
        polyline.addTo(drawnItemsRef.current!)
        currentDrawRef.current = polyline
    }

    const onMouseMove = (e: L.LeafletMouseEvent) => {
        if (!currentDrawRef.current) return 
        currentDrawRef.current.addLatLng(e.latlng)
    }

    const onMouseUp = () => {
        if (!currentDrawRef.current) return
        const shape = currentDrawRef.current
        const coords = shape.getLatLngs() as L.LatLng[]
        
        // Auto-Close Logic (The "Lazy Lock")
        if (activeTool !== 'path' && coords.length > 2) {
             const start = coords[0]
             const end = coords[coords.length - 1]
             if (start.distanceTo(end) > 5) shape.addLatLng(start) 
             
             const polygon = L.polygon(shape.getLatLngs() as L.LatLng[], { 
                 color: shape.options.color, 
                 fillColor: shape.options.color, 
                 fillOpacity: 0.3, 
                 weight: 2 
             })
             drawnItemsRef.current?.removeLayer(shape)
             drawnItemsRef.current?.addLayer(polygon)
        }
        currentDrawRef.current = null 
    }

    // Explicit Touch Wrappers to prevent errors
    const onTouchDown = (e: any) => onMouseDown(e)
    const onTouchMove = (e: any) => onMouseMove(e)
    const onTouchUp = () => onMouseUp()

    map.on('mousedown', onMouseDown)
    map.on('mousemove', onMouseMove)
    map.on('mouseup', onMouseUp)
    map.on('touchstart', onTouchDown)
    map.on('touchmove', onTouchMove)
    map.on('touchend', onTouchUp)

    return () => {
        map.off('mousedown', onMouseDown)
        map.off('mousemove', onMouseMove)
        map.off('mouseup', onMouseUp)
        map.off('touchstart', onTouchDown)
        map.off('touchmove', onTouchMove)
        map.off('touchend', onTouchUp)
    }
  }, [activeTool, brushSize])

  // 3. SPATIAL RECOGNITION (Tony's Eyes)
  const lockAndBake = useCallback(() => {
    if (!drawnItemsRef.current) return { count: 0, acres: 0, pathYards: 0, layers: [] }
    
    const layers = drawnItemsRef.current.getLayers()
    let boundaryGeo: any = null
    const allFeatures: any[] = []
    let totalPathDistanceMeters = 0

    for (const layer of layers) {
      // @ts-ignore
      if (layer.toGeoJSON) {
        // @ts-ignore
        const geo = layer.toGeoJSON()
        
        // Path Math
        if (geo.geometry.type === 'LineString') {
            // @ts-ignore
            if (layer.getLatLngs) {
               // @ts-ignore
               const latlngs = layer.getLatLngs()
               for(let i=0; i < latlngs.length -1; i++) {
                   totalPathDistanceMeters += latlngs[i].distanceTo(latlngs[i+1])
               }
            }
            // If it's the boundary tool, force it to be a polygon
            if (activeTool === 'boundary' || activeTool === 'draw_poly') {
                 const coords = geo.geometry.coordinates
                 coords.push(coords[0]) 
                 geo.geometry.type = 'Polygon'
                 geo.geometry.coordinates = [coords]
            }
        }

        allFeatures.push(geo)
        // The largest polygon becomes the "Property" for Tony to analyze
        if (geo.geometry.type === 'Polygon') boundaryGeo = geo
      }
    }

    if (!boundaryGeo) return { count: 0, acres: 0, pathYards: 0, layers: [] }

    // H3 SPATIAL CALCULATION
    const hexIds = polygonToCells(boundaryGeo.geometry.coordinates, 10, true)
    
    // SAVE DATA FOR TONY
    if (mapRef.current) {
        // @ts-ignore
        mapRef.current.options.hexGrid = hexIds
        // @ts-ignore
        mapRef.current.options.drawnFeatures = allFeatures
    }

    return { 
        count: hexIds.length, 
        acres: parseFloat((hexIds.length * 1.0).toFixed(1)), 
        pathYards: Math.round(totalPathDistanceMeters * 1.09361), 
        layers: allFeatures 
    }
  }, [activeTool])

  const api = useMemo<MapApi>(() => ({
    flyTo: (center, zoom) => mapRef.current?.setView(center, zoom),
    clearAll: () => drawnItemsRef.current?.clearLayers(),
    undoLast: () => { 
        if (drawnItemsRef.current) { 
            const l = drawnItemsRef.current.getLayers(); 
            if (l.length > 0) drawnItemsRef.current.removeLayer(l[l.length - 1]) 
        } 
    },
    setDrawMode: () => {}, 
    addSmartFeature: (geojson, type, label) => { 
        if (mapRef.current) { 
            const color = type === 'bedding' ? 'brown' : 'green'; 
            L.geoJSON(geojson, { style: { color } }).bindPopup(label).addTo(mapRef.current) 
        } 
    },
    lockAndBake
  }), [lockAndBake])

  return { api }
}
