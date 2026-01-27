'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Tool } from '../constants/tools'
import type * as LeafletNS from 'leaflet'
import area from '@turf/area'
import { polygon as turfPolygon } from '@turf/helpers'

type LatLngLike = { lat: number; lng: number }

export type MapApi = {
  lockBoundary?: () => number | null
  finishCurrentBorder: () => void
  lockAllBorders: () => void
  unlockAllBorders: () => void
  getBorders: () => Array<{ id: number, locked: boolean, acres: number }>
  wipeAll: () => void
  deleteSelected: () => string | void
  undo: () => void
  getCaptureElement: () => HTMLElement | null
  getGeoJSON: () => any
  getLockedBordersGeoJSON: () => any
  getMapContext: () => { center: LatLngLike, zoom: number }
  getFeatureCount: () => number
  setBrushSize: (size: number) => void
  getLayersWithAcres: () => Array<{ type: string, name: string, acres: number, note?: string }>
  getTotalAcresByType: () => Array<{ type: string, totalAcres: number }>
  fitToBorder: () => void
  getTotalPolygonAcres: () => number
  hasTerrainInputs: (inputs: any) => boolean
  loadPlan: (planData: any) => void
}

type BorderData = {
  id: number
  points: LatLngLike[]
  locked: boolean
  polygon: any
  acres: number
}

type LayerMetadata = {
  acres: number
  toolId: string
  toolName: string
  layerType: string
}

function calculateAreaAcres(pts: LatLngLike[]) {
  if (pts.length < 3) return 0
  
  // Convert to GeoJSON polygon format [[lng, lat], ...] and use Turf.js
  const coordinates = pts.map(p => [p.lng, p.lat])
  // Close the polygon if not already closed
  if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
      coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
    coordinates.push(coordinates[0])
  }
  
  try {
    const poly = turfPolygon([coordinates])
    const areaMeters = area(poly)
    const acres = areaMeters * 0.000247105 // m² to acres
    return Number(acres.toFixed(2))
  } catch (err) {
    console.error('[calculateAreaAcres] Error:', err)
    return 0
  }
}

function isPointInPolygon(point: LatLngLike, polygon: LatLngLike[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat
    const xj = polygon[j].lng, yj = polygon[j].lat
    const intersect = ((yi > point.lat) !== (yj > point.lat)) && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

export function useMapDrawing(args: { 
  containerRef: React.RefObject<HTMLDivElement>, 
  activeTool: Tool, 
  brushSize: number, 
  isDrawMode: boolean,
  onModeChange: (mode: 'PAN' | 'DRAW') => void,
  onBlockMessage: (show: boolean) => void,
  suggestedMarks?: any[],
  onFeatureCreated?: (feature: { type: string, name: string, acres: number, note?: string, geometry?: any, coordinates?: [number, number] }) => void
}) {
  const { containerRef, activeTool, brushSize, isDrawMode, onModeChange, onBlockMessage, suggestedMarks, onFeatureCreated } = args
  const LRef = useRef<typeof LeafletNS | null>(null)
  const mapRef = useRef<LeafletNS.Map | null>(null)
  const drawnItemsRef = useRef<LeafletNS.FeatureGroup | null>(null)
  const boundaryLayerRef = useRef<LeafletNS.FeatureGroup | null>(null)
  const suggestionsLayerRef = useRef<LeafletNS.FeatureGroup | null>(null)
  const boundaryPointsRef = useRef<LatLngLike[]>([])
  const isDrawingRef = useRef(false)
  const tempPathRef = useRef<any>(null)
  const [borders, setBorders] = useState<BorderData[]>([])
  const [currentPoints, setCurrentPoints] = useState<LatLngLike[]>([])
  const [tempMarkers, setTempMarkers] = useState<any[]>([])
  const tempPolylineRef = useRef<any>(null)
  const layerMetadataRef = useRef<Map<number, LayerMetadata>>(new Map())
  const selectedLayerRef = useRef<any>(null)
  const [savedFeatures, setSavedFeatures] = useState<any[]>([])
  const undoStackRef = useRef<Array<{ savedFeatures: any[], metadata: Map<number, LayerMetadata> }>>([])
  const maxUndoStack = 20

  const activeToolRef = useRef(activeTool)
  const brushSizeRef = useRef(brushSize)
  const isDrawModeRef = useRef(isDrawMode)
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  useEffect(() => { brushSizeRef.current = brushSize }, [brushSize])
  useEffect(() => { isDrawModeRef.current = isDrawMode }, [isDrawMode])

  // Initialize map
  useEffect(() => {
    let mounted = true
    const init = async () => {
      const leaflet = await import('leaflet')
      if (!mounted || !containerRef.current) return
      LRef.current = leaflet
      const map = leaflet.map(containerRef.current, { 
        center: [38.6583, -96.4937], 
        zoom: 16, 
        zoomControl: false, 
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: true
      })
      leaflet.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { 
        maxZoom: 19, 
        crossOrigin: true 
      }).addTo(map)
      drawnItemsRef.current = new leaflet.FeatureGroup().addTo(map)
      boundaryLayerRef.current = new leaflet.FeatureGroup().addTo(map)
      suggestionsLayerRef.current = new leaflet.FeatureGroup().addTo(map)
      mapRef.current = map
      
      // Click on map to deselect
      map.on('click', () => {
        if (selectedLayerRef.current) {
          selectedLayerRef.current.setStyle({ 
            weight: selectedLayerRef.current.options.originalWeight || 2, 
            opacity: 0.6 
          })
          if (selectedLayerRef.current.editing?.disable) {
            selectedLayerRef.current.editing.disable()
          }
          selectedLayerRef.current = null
        }
      })
    }
    
    // ESC key to deselect (separate handler for cleanup)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedLayerRef.current) {
        selectedLayerRef.current.setStyle({ 
          weight: selectedLayerRef.current.options.originalWeight || 2, 
          opacity: 0.6 
        })
        if (selectedLayerRef.current.editing?.disable) {
          selectedLayerRef.current.editing.disable()
        }
        selectedLayerRef.current = null
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    
    init()
    return () => { 
      mounted = false
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [containerRef])

  // PAN/DRAW mode separation:
  // PAN mode: map is draggable, no drawing
  // DRAW mode: map dragging disabled so pointer events go to drawing
  const updateMapInteractions = useCallback(() => {
    if (!mapRef.current) return
    
    if (isDrawModeRef.current) {
      // DRAW MODE: Disable map dragging so we can draw
      mapRef.current.dragging.disable()
      mapRef.current.doubleClickZoom.disable()
      mapRef.current.touchZoom.disable()
      // Keep scroll zoom enabled for convenience
      mapRef.current.scrollWheelZoom.enable()
      mapRef.current.boxZoom.disable()
      mapRef.current.keyboard.disable()
    } else {
      // PAN MODE: Enable all map interactions
      mapRef.current.dragging.enable()
      mapRef.current.scrollWheelZoom.enable()
      mapRef.current.doubleClickZoom.enable()
      mapRef.current.touchZoom.enable()
      mapRef.current.boxZoom.enable()
      mapRef.current.keyboard.enable()
    }
  }, [isDrawMode])

  // Update interactions when mode changes
  useEffect(() => {
    updateMapInteractions()
  }, [isDrawMode, updateMapInteractions])

  // Render suggested marks from Tony's analysis
  useEffect(() => {
    const L = LRef.current
    if (!L || !suggestionsLayerRef.current) return
    
    // Clear previous suggestions
    suggestionsLayerRef.current.clearLayers()
    
    if (!suggestedMarks || suggestedMarks.length === 0) return
    
    // Render each suggested mark
    suggestedMarks.forEach((mark: any) => {
      const { kind, layerType, lat, lng, coordinates, label, reason, acres } = mark
      
      if (layerType === 'point' && lat && lng) {
        // Render point marker
        const marker = L.circleMarker([lat, lng], {
          color: '#FFD700', // Gold for suggestions
          fillColor: '#FFD700',
          fillOpacity: 0.6,
          radius: 8,
          weight: 2
        }).addTo(suggestionsLayerRef.current!)
        
        if (label || reason) {
          marker.bindPopup(`<strong>${label || 'Suggestion'}</strong><br/>${reason || ''}${acres ? `<br/>${acres} acres` : ''}`)
        }
      } else if (layerType === 'polygon' && coordinates && coordinates.length > 0) {
        // Render polygon
        const polygon = L.polygon(coordinates, {
          color: '#FFD700',
          fillColor: '#FFD700',
          fillOpacity: 0.2,
          weight: 2,
          dashArray: '5, 10',
          opacity: 0.8
        }).addTo(suggestionsLayerRef.current!)
        
        if (label || reason) {
          polygon.bindPopup(`<strong>${label || 'Suggestion'}</strong><br/>${reason || ''}${acres ? `<br/>${acres} acres` : ''}`)
        }
      } else if (layerType === 'polyline' && coordinates && coordinates.length > 0) {
        // Render polyline/trail
        const polyline = L.polyline(coordinates, {
          color: '#FFD700',
          weight: 3,
          dashArray: '5, 10',
          opacity: 0.8
        }).addTo(suggestionsLayerRef.current!)
        
        if (label || reason) {
          polyline.bindPopup(`<strong>${label || 'Suggestion'}</strong><br/>${reason || ''}`)
        }
      }
    })
  }, [suggestedMarks])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const L = LRef.current
    if (!mapRef.current || !L) return
    
    // Allow selection in PAN mode even when map is frozen
    if (!isDrawModeRef.current) {
      // Don't prevent selection - let layers handle their own click events
      return
    }
    
    const rect = containerRef.current!.getBoundingClientRect()
    const latlng = mapRef.current.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top])
    
    // Allow boundary drawing without restriction
    if (activeToolRef.current.id === 'boundary') {
      boundaryPointsRef.current.push({ lat: latlng.lat, lng: latlng.lng })
      L.circleMarker(latlng, { color: '#FF6B00', radius: 5, fillOpacity: 1 }).addTo(boundaryLayerRef.current!)
      if (boundaryPointsRef.current.length > 1) L.polyline(boundaryPointsRef.current as any, { color: '#FF6B00', weight: 4 }).addTo(boundaryLayerRef.current!)
      return
    }
    
    // TASK 2: Handle point tools (Stand, etc.) - create simple CircleMarker dots
    if (activeToolRef.current.layerType === 'point') {
      // Check if inside locked boundary
      const hasLockedBoundary = boundaryPointsRef.current.length > 0
      if (hasLockedBoundary) {
        const isInside = isPointInPolygon(latlng, boundaryPointsRef.current)
        if (!isInside) {
          onBlockMessage(true)
          return
        }
      }
      
      // Create simple CircleMarker dot
      const markerColor = activeToolRef.current.id === 'stand' ? '#FFD700' : '#ef4444' // Gold for Stand, Red for others
      const marker = L.circleMarker(latlng, {
        color: markerColor,
        fillColor: markerColor,
        fillOpacity: 1,
        radius: 5,
        weight: 2
      }).addTo(drawnItemsRef.current!)
      
      marker.bindPopup(`${activeToolRef.current.name}`)
      
      // Save marker to features
      saveUndoSnapshot()
      const layerId = L.Util.stamp(marker)
      const metadata = {
        acres: 0,
        toolName: activeToolRef.current.name,
        toolId: activeToolRef.current.id,
        layerType: 'point'
      }
      layerMetadataRef.current.set(layerId, metadata)
      
      const geoJSON = marker.toGeoJSON()
      geoJSON.properties = {
        ...metadata,
        color: markerColor,
        coordinates: [latlng.lng, latlng.lat]
      }
      setSavedFeatures(prev => [...prev, { id: layerId, geojson: geoJSON, layer: marker }])
      
      // Notify parent
      if (onFeatureCreated) {
        onFeatureCreated({
          type: activeToolRef.current.id,
          name: activeToolRef.current.name,
          acres: 0,
          note: '',
          geometry: { type: 'Point' },
          coordinates: [latlng.lng, latlng.lat]
        })
      }
      
      return
    }
    
    // Check if there's a locked boundary
    const hasLockedBoundary = boundaryPointsRef.current.length > 0
    if (hasLockedBoundary) {
      // Check if point is inside boundary
      const isInside = isPointInPolygon(latlng, boundaryPointsRef.current)
      if (!isInside) {
        onBlockMessage(true)
        return
      }
    }
    
    isDrawingRef.current = true
    tempPathRef.current = L.polyline([latlng], { color: activeToolRef.current.color, weight: brushSizeRef.current, opacity: 0.8, fillOpacity: 0.4 }).addTo(drawnItemsRef.current!)
  }, [containerRef, onBlockMessage])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current || !tempPathRef.current) return
    const rect = containerRef.current!.getBoundingClientRect()
    const latlng = mapRef.current!.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top])
    
    // Check if drawing inside boundary when boundary is locked
    const hasLockedBoundary = boundaryPointsRef.current.length > 0
    if (hasLockedBoundary) {
      const isInside = isPointInPolygon(latlng, boundaryPointsRef.current)
      if (!isInside) {
        // Stop drawing if moving outside boundary
        isDrawingRef.current = false
        tempPathRef.current = null
        return
      }
    }
    
    tempPathRef.current.addLatLng(latlng)
  }, [containerRef])

  // Helper to save undo snapshot
  const saveUndoSnapshot = useCallback(() => {
    // Save current state to undo stack
    const snapshot = {
      savedFeatures: savedFeatures.map(f => ({ ...f })),
      metadata: new Map(layerMetadataRef.current)
    }
    undoStackRef.current.push(snapshot)
    if (undoStackRef.current.length > maxUndoStack) {
      undoStackRef.current.shift() // Remove oldest
    }
  }, [savedFeatures])

  const onPointerUp = useCallback(() => {
    if (!isDrawingRef.current || !tempPathRef.current) {
      isDrawingRef.current = false
      tempPathRef.current = null
      return
    }
    
    // Calculate acres for the drawn path
    const L = LRef.current
    if (L && tempPathRef.current) {
      const latlngs = (tempPathRef.current as any).getLatLngs() as LatLngLike[]
      if (latlngs.length > 2) {
        // Save undo state BEFORE adding new feature
        saveUndoSnapshot()
        
        const acres = calculateAreaAcres(latlngs)
        console.log('[onPointerUp] Calculated acres:', acres, 'for points:', latlngs.length)
        const layerId = L.Util.stamp(tempPathRef.current)
        const metadata = {
          acres,
          toolName: activeToolRef.current.name,
          toolId: activeToolRef.current.id,
          layerType: activeToolRef.current.layerType
        }
        layerMetadataRef.current.set(layerId, metadata)
        
        // Save feature to state for persistence
        const geoJSON = tempPathRef.current.toGeoJSON()
        geoJSON.properties = {
          ...metadata,
          color: activeToolRef.current.color,
          weight: brushSizeRef.current
        }
        setSavedFeatures(prev => [...prev, { id: layerId, geojson: geoJSON, layer: tempPathRef.current }])
        
        // FIX 2: Special handling for Blue Zone (Conversation Zone)
        if (activeToolRef.current.id === 'conversation_zone') {
          // Trigger conversation prompt for blue zone - NO ACRES POPUP
          if (onFeatureCreated) {
            onFeatureCreated({
              type: 'conversation_zone',
              name: 'BLUE NOTE',
              acres: acres,
              note: 'User wants to discuss this specific Blue Zone. Ask them what they see here.',
              geometry: { type: 'Polygon' }
            })
          }
          // Blue zones DON'T show acreage popup - they trigger conversation
        } else {
          // Notify parent that a feature was created (for auto-analysis)
          if (onFeatureCreated) {
            onFeatureCreated({
              type: activeToolRef.current.id,
              name: activeToolRef.current.name,
              acres: acres,
              note: ''
            })
          }
          // Add a popup to show acreage for non-blue zones
          tempPathRef.current.bindPopup(`${activeToolRef.current.name}: ${acres} acres`)
        }
        
        // Make layer selectable and editable
        const layer = tempPathRef.current
        layer.on('click', (e: any) => {
          L.DomEvent.stopPropagation(e)
          // Deselect previous
          if (selectedLayerRef.current && selectedLayerRef.current !== layer) {
            selectedLayerRef.current.setStyle({ 
              weight: selectedLayerRef.current.options.originalWeight || brushSizeRef.current, 
              opacity: 0.6 
            })
            if (selectedLayerRef.current.editing?.disable) {
              selectedLayerRef.current.editing.disable()
            }
          }
          // Select this layer
          selectedLayerRef.current = layer
          layer.options.originalWeight = layer.options.weight
          layer.setStyle({ weight: (layer.options.weight || brushSizeRef.current) + 4, opacity: 1 })
          
          // Enable editing
          if (layer.editing?.enable) {
            layer.editing.enable()
          }
        })
      }
    }
    
    isDrawingRef.current = false
    tempPathRef.current = null
  }, [saveUndoSnapshot])

  return { 
    api: { 
      lockBoundary: () => {
        const acres = calculateAreaAcres(boundaryPointsRef.current)
        if (!acres) return null
        boundaryLayerRef.current?.clearLayers()
        const boundaryPolygon = LRef.current!.polygon(boundaryPointsRef.current as any, { 
          color: '#FF6B00', 
          weight: 5, 
          fillOpacity: 0.15 
        }).addTo(boundaryLayerRef.current!)
        
        // Make boundary selectable for deletion
        boundaryPolygon.on('click', (e: any) => {
          const L = LRef.current
          if (!L) return
          L.DomEvent.stopPropagation(e)
          
          // Deselect previous
          if (selectedLayerRef.current && selectedLayerRef.current !== boundaryPolygon) {
            selectedLayerRef.current.setStyle({ 
              weight: selectedLayerRef.current.options.originalWeight || 2, 
              opacity: 0.6 
            })
            if (selectedLayerRef.current.editing?.disable) {
              selectedLayerRef.current.editing.disable()
            }
          }
          
          // Select boundary
          selectedLayerRef.current = boundaryPolygon
          boundaryPolygon.setStyle({ weight: 7, opacity: 1 })
          console.log('[lockBoundary] Boundary selected for deletion')
        })
        
        return acres
      },
      wipeAll: () => {
        drawnItemsRef.current?.clearLayers()
        boundaryLayerRef.current?.clearLayers()
        boundaryPointsRef.current = []
        borders.forEach(b => mapRef.current?.removeLayer(b.polygon))
        tempMarkers.forEach(m => mapRef.current?.removeLayer(m))
        if (tempPolylineRef.current) {
          mapRef.current?.removeLayer(tempPolylineRef.current)
        }
        setBorders([])
        setCurrentPoints([])
        setTempMarkers([])
        layerMetadataRef.current.clear()
        selectedLayerRef.current = null
        setSavedFeatures([])
      },
      finishCurrentBorder: () => {
        // Placeholder for future multi-border implementation
        return null
      },
      lockAllBorders: () => {
        // Placeholder for future multi-border implementation
      },
      unlockAllBorders: () => {
        // Placeholder for future multi-border implementation
      },
      getBorders: () => {
        // Placeholder for future multi-border implementation
        return []
      },
      deleteSelected: () => {
        const L = LRef.current
        if (!L) return
        
        // Check if boundary is selected
        if (selectedLayerRef.current && boundaryLayerRef.current) {
          const isLayerInBoundary = boundaryLayerRef.current.hasLayer(selectedLayerRef.current)
          if (isLayerInBoundary) {
            // Delete boundary
            console.log('[deleteSelected] Removing boundary')
            boundaryLayerRef.current.clearLayers()
            boundaryPointsRef.current = []
            selectedLayerRef.current = null
            return 'boundary'
          }
        }
        
        // Delete regular feature
        if (!selectedLayerRef.current || !drawnItemsRef.current) return
        
        // Save undo state BEFORE deleting
        saveUndoSnapshot()
        
        const layerId = L.Util.stamp(selectedLayerRef.current)
        console.log('[deleteSelected] Removing layer:', layerId)
        drawnItemsRef.current.removeLayer(selectedLayerRef.current)
        layerMetadataRef.current.delete(layerId)
        setSavedFeatures(prev => prev.filter(f => f.id !== layerId))
        selectedLayerRef.current = null
      },
      undo: () => {
        if (undoStackRef.current.length === 0) {
          console.log('[undo] No undo history')
          return
        }
        
        // Pop last state from undo stack
        const previousState = undoStackRef.current.pop()
        if (!previousState) return
        
        console.log('[undo] Restoring state:', previousState.savedFeatures.length, 'features')
        
        // Clear current layers
        drawnItemsRef.current?.clearLayers()
        layerMetadataRef.current.clear()
        selectedLayerRef.current = null
        
        // Restore previous features
        const L = LRef.current
        if (L && drawnItemsRef.current) {
          previousState.savedFeatures.forEach(feature => {
            const coords = feature.geojson.geometry?.coordinates
            if (coords && coords.length > 0) {
              const latlngs = coords.map((c: number[]) => ({ lat: c[1], lng: c[0] }))
              const layer = L.polyline(latlngs, {
                color: feature.geojson.properties?.color || '#4ade80',
                weight: feature.geojson.properties?.weight || 30,
                opacity: 0.8,
                fillOpacity: 0.4
              }).addTo(drawnItemsRef.current!)
              
              const layerId = L.Util.stamp(layer)
              const metadata = {
                acres: feature.geojson.properties?.acres || 0,
                toolName: feature.geojson.properties?.toolName || 'Unknown',
                toolId: feature.geojson.properties?.toolId || 'unknown',
                layerType: feature.geojson.properties?.layerType || 'polygon'
              }
              layerMetadataRef.current.set(layerId, metadata)
              feature.layer = layer
            }
          })
        }
        
        // Update state
        setSavedFeatures(previousState.savedFeatures)
        layerMetadataRef.current = new Map(previousState.metadata)
      },
      getCaptureElement: () => containerRef.current,
      getGeoJSON: () => {
        const layers: any[] = []
        
        // Add boundary layer
        if (boundaryPointsRef.current.length > 0) {
          layers.push({
            type: 'Feature',
            properties: { type: 'boundary', acres: calculateAreaAcres(boundaryPointsRef.current), locked: true },
            geometry: {
              type: 'Polygon',
              coordinates: [boundaryPointsRef.current.map(p => [p.lng, p.lat])]
            }
          })
        }
        
        // Add saved features
        savedFeatures.forEach(feature => {
          layers.push(feature.geojson)
        })
        
        return {
          type: 'FeatureCollection',
          features: layers
        }
      },
      getLockedBordersGeoJSON: () => {
        // Return locked boundary if it exists
        if (boundaryPointsRef.current.length > 0) {
          return {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              properties: { type: 'boundary', acres: calculateAreaAcres(boundaryPointsRef.current), locked: true },
              geometry: {
                type: 'Polygon',
                coordinates: [boundaryPointsRef.current.map(p => [p.lng, p.lat])]
              }
            }]
          }
        }
        return { type: 'FeatureCollection', features: [] }
      },
      getMapContext: () => {
        if (!mapRef.current) return { center: { lat: 0, lng: 0 }, zoom: 0 }
        const center = mapRef.current.getCenter()
        const zoom = mapRef.current.getZoom()
        return { center: { lat: center.lat, lng: center.lng }, zoom }
      },
      getFeatureCount: () => savedFeatures.length,
      setBrushSize: (newSize: number) => {
        brushSizeRef.current = newSize
        // Update selected layer if any
        if (selectedLayerRef.current && selectedLayerRef.current.setStyle) {
          selectedLayerRef.current.setStyle({ weight: newSize })
        }
      },
      fitToBorder: () => {
        if (!mapRef.current || !LRef.current || boundaryPointsRef.current.length === 0) return
        const bounds = LRef.current.latLngBounds(boundaryPointsRef.current as any)
        mapRef.current.fitBounds(bounds, { padding: [50, 50] })
      },
      getTotalPolygonAcres: () => {
        let total = 0
        if (boundaryPointsRef.current.length > 0) {
          total += calculateAreaAcres(boundaryPointsRef.current)
        }
        savedFeatures.forEach(feature => {
          const acres = feature.geojson.properties?.acres || 0
          total += acres
        })
        return Number(total.toFixed(2))
      },
      hasTerrainInputs: (inputs: any) => {
        return !!(inputs && (inputs.terrainNotes || inputs.hasRidges || inputs.hasValleys || inputs.coverType !== 'mixed'))
      },
      loadPlan: (planData: any) => {
        // Clear current state first
        drawnItemsRef.current?.clearLayers()
        boundaryLayerRef.current?.clearLayers()
        boundaryPointsRef.current = []
        setSavedFeatures([])
        layerMetadataRef.current.clear()
        selectedLayerRef.current = null
        
        // Load border if exists
        if (planData.border && planData.border.points && planData.border.points.length > 0) {
          boundaryPointsRef.current = planData.border.points
          if (planData.border.locked && LRef.current) {
            LRef.current.polygon(planData.border.points as any, { color: '#FF6B00', weight: 5, fillOpacity: 0.15 }).addTo(boundaryLayerRef.current!)
          }
        }
        
        // Load layers
        if (planData.layers && planData.layers.length > 0 && LRef.current && drawnItemsRef.current) {
          planData.layers.forEach((layerData: any) => {
            const coords = layerData.geometry?.coordinates?.[0]
            if (coords && coords.length > 0) {
              const latlngs = coords.map((c: number[]) => ({ lat: c[1], lng: c[0] }))
              const layer = LRef.current!.polyline(latlngs, {
                color: layerData.properties?.color || '#4ade80',
                weight: layerData.properties?.weight || 30,
                opacity: 0.8,
                fillOpacity: 0.4
              }).addTo(drawnItemsRef.current!)
              
              const layerId = LRef.current!.Util.stamp(layer)
              const metadata = {
                acres: layerData.properties?.acres || 0,
                toolName: layerData.properties?.toolName || 'Unknown',
                toolId: layerData.properties?.toolId || 'unknown',
                layerType: layerData.properties?.layerType || 'polygon'
              }
              layerMetadataRef.current.set(layerId, metadata)
              setSavedFeatures(prev => [...prev, { id: layerId, geojson: layerData, layer }])
            }
          })
        }
        
        // Set map view
        if (planData.mapCenter && planData.zoom && mapRef.current) {
          mapRef.current.setView([planData.mapCenter.lat, planData.mapCenter.lng], planData.zoom)
        }
      },
      getLayersWithAcres: () => {
        const layers: Array<{ type: string, name: string, acres: number, note?: string }> = []
        
        // Add boundary
        if (boundaryPointsRef.current.length > 0) {
          layers.push({
            type: 'boundary',
            name: 'BORDER',
            acres: calculateAreaAcres(boundaryPointsRef.current)
          })
        }
        
        // Add saved features
        savedFeatures.forEach(feature => {
          const props = feature.geojson.properties || {}
          layers.push({
            type: props.toolId || 'unknown',
            name: props.toolName || 'Unknown',
            acres: props.acres || 0,
            note: props.note
          })
        })
        
        return layers
      },
      getTotalAcresByType: () => {
        const totals = new Map<string, number>()
        
        // Add boundary
        if (boundaryPointsRef.current.length > 0) {
          totals.set('boundary', calculateAreaAcres(boundaryPointsRef.current))
        }
        
        // Add saved features
        savedFeatures.forEach(feature => {
          const props = feature.geojson.properties || {}
          const type = props.toolId || 'unknown'
          const acres = props.acres || 0
          totals.set(type, (totals.get(type) || 0) + acres)
        })
        
        return Array.from(totals.entries()).map(([type, totalAcres]) => ({ type, totalAcres }))
      }
    }, 
    handlers: { onPointerDown, onPointerMove, onPointerUp } 
  }
}
