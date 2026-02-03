'use client'

import React, { useCallback, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { type MapContainerHandle } from './map/MapContainer'
import TonyChat, { type TonyChatHandle } from './chat/TonyChat'
import { TOOLS, type Tool } from './constants/tools'

// Dynamic import to prevent SSR issues with Leaflet
const MapContainer = dynamic(() => import('./map/MapContainer'), { ssr: false })

export default function BuckGridProPage() {
  const mapRef = useRef<MapContainerHandle>(null)
  const chatRef = useRef<TonyChatHandle>(null)
  const hexLayerRef = useRef<any>(null)
  
  const [activeTool, setActiveTool] = useState<Tool>(TOOLS[0])
  const [brushSize, setBrushSize] = useState(30)
  const [propertyAcres, setPropertyAcres] = useState(0)
  const [hexCount, setHexCount] = useState(0)
  const [activeTab, setActiveTab] = useState<'HABITAT' | 'FOOD'>('HABITAT')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [searchLocation, setSearchLocation] = useState('')

  // Filter tools by category
  const habitatTools = TOOLS.filter(t => ['nav', 'boundary', 'bedding', 'stand', 'focus'].includes(t.id))
  const foodTools = TOOLS.filter(t => ['clover', 'brassicas', 'corn', 'soybeans', 'milo', 'egyptian', 'switchgrass'].includes(t.id))

  const onLockBorder = useCallback(async () => {
    const stats = mapRef.current?.lockBoundary()
    if (!stats) return

    setPropertyAcres(stats.acres)
    setHexCount(stats.count)
    
    // Generate H3 Hex Grid Overlay
    if (stats.layers && stats.layers.length > 0) {
      const boundaryFeature = stats.layers.find((f: any) => f.geometry.type === 'Polygon')
      if (boundaryFeature && mapRef.current) {
        const mapElement = mapRef.current.getCaptureElement()
        if (mapElement) {
          await renderH3HexGrid(boundaryFeature, mapElement)
        }
      }
    }

    chatRef.current?.addTonyMessage(`Locked: ${stats.acres} acres (${stats.count} hexes). Ready for analysis.`)
    setActiveTool(TOOLS[0])
  }, [])

  const renderH3HexGrid = async (boundaryGeoJSON: any, mapElement: HTMLElement) => {
    // Dynamic import of h3-js and Leaflet to avoid SSR issues
    const { latLngToCell, cellToBoundary } = await import('h3-js')
    const L = await import('leaflet')
    
    // Access Leaflet map instance from the DOM
    const mapContainer = mapElement.querySelector('.leaflet-container') as any
    if (!mapContainer || !mapContainer._leaflet_map) return
    
    const map = mapContainer._leaflet_map

    // Clear existing hex layer
    if (hexLayerRef.current) {
      map.removeLayer(hexLayerRef.current)
    }

    const hexLayer = L.layerGroup()
    const coords = boundaryGeoJSON.geometry.coordinates[0]

    // Sample points inside polygon to generate H3 cells
    const resolution = 11 // Higher = smaller hexes
    const hexSet = new Set<string>()

    // Convert polygon coords to LatLng and get bounds
    const latlngs = coords.map((c: number[]) => ({ lat: c[1], lng: c[0] }))
    const bounds = L.latLngBounds(latlngs)

    // Generate grid by sampling area
    const latStep = (bounds.getNorth() - bounds.getSouth()) / 20
    const lngStep = (bounds.getEast() - bounds.getWest()) / 20

    for (let lat = bounds.getSouth(); lat <= bounds.getNorth(); lat += latStep) {
      for (let lng = bounds.getWest(); lng <= bounds.getEast(); lng += lngStep) {
        const point = L.latLng(lat, lng)
        
        // Check if point is inside polygon
        if (isPointInPolygon(point, latlngs)) {
          const h3Index = latLngToCell(lat, lng, resolution)
          hexSet.add(h3Index)
        }
      }
    }

    // Render hexagons
    hexSet.forEach(h3Index => {
      const hexBoundary = cellToBoundary(h3Index)
      const hexCoords = hexBoundary.map(([lat, lng]) => [lat, lng] as [number, number])
      
      const polygon = L.polygon(hexCoords, {
        color: '#FFD700',
        weight: 1,
        fillColor: '#FFD700',
        fillOpacity: 0.15,
        interactive: false
      })
      
      hexLayer.addLayer(polygon)
    })

    hexLayer.addTo(map)
    hexLayerRef.current = hexLayer
  }

  // Point-in-polygon check (ray casting)
  const isPointInPolygon = (point: any, polygon: any[]) => {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng, yi = polygon[i].lat
      const xj = polygon[j].lng, yj = polygon[j].lat
      
      const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
        (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi)
      
      if (intersect) inside = !inside
    }
    return inside
  }

  const onAnalyze = useCallback(async () => {
    if (isAnalyzing) return
    setIsAnalyzing(true)
    
    chatRef.current?.addTonyMessage("Analyzing terrain with Gemini Vision...")
    
    try {
      const target = mapRef.current?.getCaptureElement()
      if (!target) throw new Error("Map not ready")

      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(target, { useCORS: true, scale: 1 })
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]

      const res = await fetch('/api/analyze-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 })
      })

      const data = await res.json()
      
      if (data.visionPacket) {
        const features = data.visionPacket.features || []
        const notes = data.visionPacket.notes || []
        chatRef.current?.addTonyMessage(
          `Vision detected ${features.length} habitat zones: ${notes.join(', ')}`
        )
      } else {
        chatRef.current?.addTonyMessage("Vision analysis complete. Review your habitat zones.")
      }
    } catch (err) {
      chatRef.current?.addTonyMessage("Analysis failed. Check your connection.")
    }
    
    setIsAnalyzing(false)
  }, [isAnalyzing])

  const currentTools = activeTab === 'HABITAT' ? habitatTools : foodTools

  return (
    <div style={{ height: '100dvh', width: '100vw', background: '#000', overflow: 'hidden', position: 'fixed' }}>
      <MapContainer ref={mapRef} activeTool={activeTool} brushSize={brushSize} />

      {/* LEFT PANEL: Tabbed Interface */}
      <div className="glass" style={{ position: 'absolute', left: 10, top: 10, width: 220, borderRadius: 12, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: 12, borderBottom: '1px solid #222', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#FF6B00', letterSpacing: 1.5 }}>
            BUCKGRID PRO
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#888', letterSpacing: 0.5, marginTop: 4, lineHeight: 1.3 }}>
            Elite Habitat Intelligence
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #222' }}>
          <button
            onClick={() => setActiveTab('HABITAT')}
            style={{
              flex: 1,
              padding: '10px',
              background: activeTab === 'HABITAT' ? '#FF6B00' : 'transparent',
              color: activeTab === 'HABITAT' ? '#000' : '#888',
              border: 'none',
              fontWeight: 900,
              fontSize: 10,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            🦌 HABITAT
          </button>
          <button
            onClick={() => setActiveTab('FOOD')}
            style={{
              flex: 1,
              padding: '10px',
              background: activeTab === 'FOOD' ? '#FF6B00' : 'transparent',
              color: activeTab === 'FOOD' ? '#000' : '#888',
              border: 'none',
              fontWeight: 900,
              fontSize: 10,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            🌽 FOOD
          </button>
        </div>

        {/* Tool Grid */}
        <div style={{ padding: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
            {currentTools.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTool(t)}
                style={{
                  padding: 8,
                  borderRadius: 6,
                  border: `1px solid ${activeTool.id === t.id ? '#FF6B00' : 'transparent'}`,
                  background: activeTool.id === t.id ? 'rgba(255, 107, 0, 0.15)' : '#222',
                  color: activeTool.id === t.id ? '#FF6B00' : '#888',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <span>{t.icon}</span>
                <span>{t.name}</span>
              </button>
            ))}
          </div>

          {/* Brush Size (only for drawing tools) */}
          {activeTool.id !== 'nav' && (
            <input
              type="range"
              min={10}
              max={150}
              value={brushSize}
              onChange={e => setBrushSize(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#FF6B00', marginBottom: 10 }}
            />
          )}

          {/* HABITAT TAB: Analyze Button */}
          {activeTab === 'HABITAT' && (
            <button
              onClick={onAnalyze}
              disabled={isAnalyzing || propertyAcres === 0}
              style={{
                width: '100%',
                background: isAnalyzing ? '#555' : '#4ade80',
                color: '#000',
                padding: 12,
                borderRadius: 8,
                fontWeight: 900,
                fontSize: 11,
                cursor: propertyAcres === 0 ? 'not-allowed' : 'pointer',
                opacity: propertyAcres === 0 ? 0.5 : 1,
                marginBottom: 8,
                border: 'none'
              }}
            >
              {isAnalyzing ? '🔍 ANALYZING...' : '🤖 ANALYZE HABITAT'}
            </button>
          )}

          {/* Lock Border Button */}
          <button
            onClick={onLockBorder}
            style={{
              width: '100%',
              background: '#FF6B00',
              color: '#000',
              padding: 12,
              borderRadius: 8,
              fontWeight: 900,
              fontSize: 11,
              cursor: 'pointer',
              border: 'none',
              marginBottom: 8
            }}
          >
            🔒 LOCK BORDER
          </button>

          {/* Wipe All */}
          <button
            onClick={async () => {
              mapRef.current?.wipeAll()
              setPropertyAcres(0)
              setHexCount(0)
              if (hexLayerRef.current && mapRef.current) {
                const mapElement = mapRef.current.getCaptureElement()
                const mapContainer = mapElement?.querySelector('.leaflet-container') as any
                if (mapContainer?._leaflet_map) {
                  mapContainer._leaflet_map.removeLayer(hexLayerRef.current)
                  hexLayerRef.current = null
                }
              }
            }}
            style={{
              width: '100%',
              color: '#555',
              background: 'none',
              border: 'none',
              padding: 8,
              cursor: 'pointer',
              fontSize: 10
            }}
          >
            WIPE ALL
          </button>
        </div>
      </div>

      {/* BOTTOM LEFT: Stats Display */}
      <div className="glass" style={{ position: 'absolute', left: 10, bottom: 10, padding: '12px 18px', borderRadius: 10, borderLeft: '4px solid #FF6B00' }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#FF6B00' }}>
          {propertyAcres}
          <span style={{ fontSize: 10, color: '#888', marginLeft: 4 }}>ACRES</span>
        </div>
        {hexCount > 0 && (
          <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
            {hexCount.toLocaleString()} hex cells
          </div>
        )}
      </div>

      {/* RIGHT: Tony Chat */}
      <TonyChat ref={chatRef} getCaptureTarget={() => mapRef.current?.getCaptureElement() ?? null} />
    </div>
  )
}
