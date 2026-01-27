'use client'

import React, { useCallback, useRef, useState, useEffect } from 'react'
import MapContainer, { type MapContainerHandle } from './map/MapContainer'
import ToolGrid from './ui/ToolGrid'
import TonyChat, { type TonyChatHandle } from './chat/TonyChat'
import TerrainPanel, { type TerrainInputs } from './terrain/TerrainPanel'
import MobileDrawer, { MobileDrawerMemo } from './mobile/MobileDrawer'
import { PlanManager, type Plan } from './plan/PlanManager'
import FeatureList from './ui/FeatureList'
import { TOOLS, type Tool } from './constants/tools'
import * as turf from '@turf/turf'

export default function BuckGridProPage() {
  const mapRef = useRef<MapContainerHandle>(null)
  const chatRef = useRef<TonyChatHandle>(null)
  const [activeTool, setActiveTool] = useState<Tool>(TOOLS[0])
  const [brushSize, setBrushSize] = useState(15)
  const [propertyAcres, setPropertyAcres] = useState(0)
  const [featureCount, setFeatureCount] = useState(0)
  const [totalPolygonAcres, setTotalPolygonAcres] = useState(0)
  const [terrainStatus, setTerrainStatus] = useState('Missing')
  const [totalAcresByType, setTotalAcresByType] = useState<Array<{ type: string, totalAcres: number }>>([])
  const [isDrawMode, setIsDrawMode] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [saveTimestamp, setSaveTimestamp] = useState('')
  const [lastApiStatus, setLastApiStatus] = useState('None')
  const [isMobile, setIsMobile] = useState(false)
  const [suggestedMarks, setSuggestedMarks] = useState<any[]>([])
  const [layers, setLayers] = useState<Array<{ type: string, name: string, acres: number, note?: string }>>([])
  const [showDebug, setShowDebug] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [terrainInputs, setTerrainInputs] = useState<TerrainInputs>({
    terrainNotes: '',
    hasRidges: false,
    hasValleys: false,
    hasCreeks: false,
    hasSaddles: false,
    hasBenches: false,
    thermals: 'unknown',
    coverType: 'mixed',
    elevation: 'rolling',
    seasonPhase: 'pre-rut',
    predominantWind: '',
    accessPoints: '',
    pressureConcerns: '',
    neighborsFood: '',
    goals: ''
  })

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // AUTO-SAVE: Load saved map state when app starts
  useEffect(() => {
    const saved = localStorage.getItem('buckgrid_autosave')
    if (saved) {
      try {
        const savedData = JSON.parse(saved)
        console.log('[AutoSave] Restoring saved state:', savedData)
        
        // Restore the saved plan
        if (savedData.layers && savedData.layers.length > 0) {
          mapRef.current?.loadPlan?.(savedData)
          setTerrainInputs(savedData.terrainInputs || terrainInputs)
          setPropertyAcres(savedData.border?.acres ?? 0)
          setFeatureCount(savedData.layers?.length ?? 0)
          
          setToastMessage('Auto-saved work restored ✓')
          setShowToast(true)
          setTimeout(() => setShowToast(false), 2000)
        }
      } catch (e) {
        console.error('[AutoSave] Could not load save:', e)
      }
    }
  }, [])

  // AUTO-SAVE: Save map state every time features or terrain change
  useEffect(() => {
    const geoJSON = mapRef.current?.getGeoJSON?.() ?? { type: 'FeatureCollection', features: [] }
    const lockedBorders = mapRef.current?.getLockedBordersGeoJSON?.() ?? { type: 'FeatureCollection', features: [] }
    const mapContext = mapRef.current?.getMapContext?.() ?? { center: { lat: 0, lng: 0 }, zoom: 16 }
    
    // Only auto-save if there are features or terrain data
    if (geoJSON.features.length > 0 || terrainInputs.terrainNotes || terrainInputs.goals) {
      const autoSaveData = {
        id: 'autosave',
        name: 'Auto-saved Work',
        createdAt: Date.now(),
        mapCenter: mapContext.center,
        zoom: mapContext.zoom,
        layers: geoJSON.features,
        terrainInputs,
        analysisHistory: [],
        border: lockedBorders.features.length > 0 ? {
          points: lockedBorders.features[0].geometry.coordinates[0].map((c: number[]) => ({ lat: c[1], lng: c[0] })),
          locked: true,
          acres: propertyAcres
        } : undefined
      }
      
      localStorage.setItem('buckgrid_autosave', JSON.stringify(autoSaveData))
      console.log('[AutoSave] State saved:', geoJSON.features.length, 'features')
    }
  }, [featureCount, terrainInputs, propertyAcres])

  const handleModeChange = useCallback((mode: 'PAN' | 'DRAW') => {
    setIsDrawMode(mode === 'DRAW')
    // Update feature count
    const count = mapRef.current?.getFeatureCount?.() || 0
    setFeatureCount(count)
  }, [])

  const handleBlockMessage = useCallback(() => {
    setToastMessage('Draw inside a locked border')
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }, [])

  const handleFeatureCreated = useCallback((feature: { type: string, name: string, acres: number, note?: string, geometry?: any, coordinates?: [number, number] }) => {
    // Update feature count when a new feature is created
    setFeatureCount(mapRef.current?.getFeatureCount() ?? 0)
    // Update acres summary
    const totals = mapRef.current?.getTotalAcresByType?.() ?? []
    setTotalAcresByType(totals)
    setTotalPolygonAcres(mapRef.current?.getTotalPolygonAcres?.() ?? 0)
    
    // FIX 3: Update layers list for FeatureList component
    const allLayers = mapRef.current?.getLayersWithAcres?.() ?? []
    setLayers(allLayers)
    
    // FIX 2: Special handling for Blue Zone (Conversation Zone)
    if (feature.type === 'conversation_zone') {
      // Get approximate center coordinates for context
      const coords = feature.geometry?.coordinates || feature.coordinates
      const coordsText = coords ? ` at coordinates` : ''
      
      // Send SYSTEM message to force AI conversation starter
      const systemMsg = `User just drew a BLUE CONVERSATION ZONE${coordsText}. ASK THEM IMMEDIATELY: "I see the zone. What is happening in this specific area?"`
      chatRef.current?.addSystemMessage(systemMsg)
      
      // Force AI to respond to system message
      chatRef.current?.addUserMessage(`I drew a blue zone. Ask me about it.`)
      return
    }
    
    // TASK 2: Check if this is a Point/Note feature for spatial analysis
    const isPoint = feature.geometry?.type === 'Point' || feature.type === 'note' || feature.type === 'point'
    
    if (isPoint && feature.coordinates) {
      // USER MARKED A SPECIFIC SPOT - Request spatial analysis
      const [lng, lat] = feature.coordinates
      const noteText = feature.note || 'No context provided'
      const userNoteMessage = `USER NOTE: I just marked a point at [${lat.toFixed(6)}, ${lng.toFixed(6)}]. Context: "${noteText}". Analyze this specific spot for terrain, wind, access routes, and pinch points. Be specific about what makes THIS location work or fail.`
      chatRef.current?.addSystemMessage(userNoteMessage)
      
      // Auto-trigger AI response for Point features
      chatRef.current?.addUserMessage(`Analyze the spot I just marked: "${noteText}"`)
    } else {
      // POLYGON/AREA FEATURE - Inject metadata to prevent AI hallucination
      const systemMessage = `SYSTEM UPDATE: User just drew a ${feature.name} (${feature.type}) covering ${feature.acres.toFixed(1)} acres${feature.note ? ` with note: "${feature.note}"` : ''}.`
      chatRef.current?.addSystemMessage(systemMessage)
      
      // FIX 1: TRIGGER TONY'S INSTANT RESPONSE - Call quickCheck to get immediate AI analysis
      chatRef.current?.quickCheck({
        type: feature.type,
        name: feature.name,
        acres: feature.acres,
        note: feature.note
      })
    }
  }, [])

  const handleDeleteSelected = useCallback(() => {
    const result = mapRef.current?.deleteSelected?.()
    if (result === 'boundary') {
      // Boundary was deleted
      setPropertyAcres(0)
      setToastMessage('Boundary deleted')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2000)
    }
    setFeatureCount(mapRef.current?.getFeatureCount() ?? 0)
    // Update acres after deletion
    const totals = mapRef.current?.getTotalAcresByType?.() ?? []
    setTotalAcresByType(totals)
    setTotalPolygonAcres(mapRef.current?.getTotalPolygonAcres?.() ?? 0)
    
    // FIX 3: Update layers list after deletion
    const allLayers = mapRef.current?.getLayersWithAcres?.() ?? []
    setLayers(allLayers)
  }, [])

  const handleUndo = useCallback(() => {
    mapRef.current?.undo?.()
    // Update UI after undo
    setFeatureCount(mapRef.current?.getFeatureCount() ?? 0)
    const totals = mapRef.current?.getTotalAcresByType?.() ?? []
    setTotalAcresByType(totals)
    setTotalPolygonAcres(mapRef.current?.getTotalPolygonAcres?.() ?? 0)
    
    // FIX 3: Update layers list after undo
    const allLayers = mapRef.current?.getLayersWithAcres?.() ?? []
    setLayers(allLayers)
  }, [])

  const handleAssessProperty = useCallback(() => {
    // Trigger comprehensive property assessment from Tony
    chatRef.current?.assessProperty()
  }, [])

  const onLockBorder = useCallback(() => {
    const acres = mapRef.current?.lockBoundary?.()
    if (!acres) return
    setPropertyAcres(acres)
    chatRef.current?.addTonyMessage(`Boundary locked. Total surface area: ${acres} acres. Terrain data required. Input context parameters.`)
    setActiveTool(TOOLS[0])
  }, [])

  const handleSavePlan = useCallback((): Plan => {
    const geoJSON = mapRef.current?.getGeoJSON?.() ?? { type: 'FeatureCollection', features: [] }
    const lockedBorders = mapRef.current?.getLockedBordersGeoJSON?.() ?? { type: 'FeatureCollection', features: [] }
    const mapContext = mapRef.current?.getMapContext?.() ?? { center: { lat: 0, lng: 0 }, zoom: 16 }
    
    const plan: Plan = {
      id: Date.now().toString(),
      name: 'Untitled Plan',
      createdAt: Date.now(),
      mapCenter: mapContext.center,
      zoom: mapContext.zoom,
      layers: geoJSON.features,
      terrainInputs,
      analysisHistory: [],
      border: lockedBorders.features.length > 0 ? {
        points: lockedBorders.features[0].geometry.coordinates[0].map((c: number[]) => ({ lat: c[1], lng: c[0] })),
        locked: true,
        acres: propertyAcres
      } : undefined
    }
    
    // Show save confirmation
    const timestamp = new Date().toLocaleTimeString()
    setSaveTimestamp(timestamp)
    setToastMessage(`Saved ✓ ${timestamp}`)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
    
    return plan
  }, [terrainInputs, propertyAcres])

  const handleLoadPlan = useCallback((plan: Plan) => {
    // Load plan data into map
    mapRef.current?.loadPlan?.(plan)
    
    // Restore UI state
    setTerrainInputs(plan.terrainInputs)
    setPropertyAcres(plan.border?.acres ?? 0)
    setFeatureCount(plan.layers?.length ?? 0)
    
    // Update acres summary
    const totals = mapRef.current?.getTotalAcresByType?.() ?? []
    setTotalAcresByType(totals)
    setTotalPolygonAcres(mapRef.current?.getTotalPolygonAcres?.() ?? 0)
    
    setToastMessage('Plan loaded ✓')
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
  }, [])

  const handleNewPlan = useCallback(() => {
    mapRef.current?.wipeAll?.()
    setPropertyAcres(0)
    setFeatureCount(0)
    setTotalPolygonAcres(0)
    setTotalAcresByType([])
    setTerrainInputs({
      terrainNotes: '', hasRidges: false, hasValleys: false, hasCreeks: false,
      hasSaddles: false, hasBenches: false, thermals: 'unknown', coverType: 'mixed',
      elevation: 'rolling', seasonPhase: 'pre-rut', predominantWind: '', accessPoints: '',
      pressureConcerns: '', neighborsFood: '', goals: ''
    })
    setTerrainStatus('Missing')
  }, [])

  const handleExportPlan = useCallback((plan: Plan) => {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${plan.name.replace(/\s+/g, '_')}_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleExportReport = useCallback(() => {
    const layers = mapRef.current?.getLayersWithAcres?.() ?? []
    const totals = mapRef.current?.getTotalAcresByType?.() ?? []
    
    let markdown = `# Habitat Plan Report\n\n`
    markdown += `**Date:** ${new Date().toLocaleDateString()}\n\n`
    markdown += `**Property:** ${propertyAcres} acres\n\n`
    markdown += `## Layers (${featureCount} total)\n\n`
    
    layers.forEach(layer => {
      markdown += `- **${layer.name}** (${layer.type}): ${layer.acres} acres`
      if (layer.note) markdown += ` - ${layer.note}`
      markdown += `\n`
    })
    
    markdown += `\n## Total Acres by Type\n\n`
    totals.forEach(({ type, totalAcres }) => {
      markdown += `- **${type}**: ${totalAcres} acres\n`
    })
    
    markdown += `\n## Terrain Context\n\n`
    markdown += `${JSON.stringify(terrainInputs, null, 2)}\n`
    
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `habitat_report_${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [propertyAcres, featureCount, terrainInputs])

  const handleExportCSV = useCallback(() => {
    const geoJSON = mapRef.current?.getGeoJSON?.() ?? { type: 'FeatureCollection', features: [] }
    
    if (!geoJSON.features || geoJSON.features.length === 0) {
      setToastMessage('Map is empty. Draw something first.')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2000)
      return
    }

    // CSV Headers
    const headers = ['Tool Type', 'Name/Label', 'Size', 'Coordinates', 'Notes']
    
    // Process each feature into CSV rows
    const rows = geoJSON.features.map((feature: any) => {
      const type = feature.geometry.type
      const props = feature.properties || {}
      const toolType = props.toolName || props.toolId || type
      const name = props.name || props.toolName || 'Unnamed'
      const notes = props.note || props.notes || ''
      
      let size = 'N/A'
      let coords = ''

      try {
        if (type === 'Polygon' || type === 'MultiPolygon') {
          // Calculate acres
          const poly = turf.polygon(feature.geometry.coordinates)
          const sqMeters = turf.area(poly)
          const acres = (sqMeters * 0.000247105).toFixed(2)
          size = `${acres} Acres`
          
          // Get centroid coordinates
          const center = turf.centroid(poly)
          const [lng, lat] = center.geometry.coordinates
          coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        } else if (type === 'LineString') {
          // Calculate length in yards
          const km = turf.length(feature, { units: 'kilometers' })
          const yards = (km * 1093.61).toFixed(0)
          size = `${yards} Yards`
          
          // Get midpoint coordinates
          const mid = turf.along(feature, km / 2, { units: 'kilometers' })
          const [lng, lat] = mid.geometry.coordinates
          coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        } else if (type === 'Point') {
          size = '1 Unit'
          const [lng, lat] = feature.geometry.coordinates
          coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        }
      } catch (e) {
        console.warn('CSV calculation error:', e)
      }

      // Escape CSV special characters
      const safeName = `"${String(name).replace(/"/g, '""')}"`
      const safeNotes = `"${String(notes).replace(/"/g, '""')}"`
      const safeCoords = `"${coords}"`
      
      return [toolType, safeName, size, safeCoords, safeNotes].join(',')
    })

    // Build CSV content
    const csvContent = [headers.join(','), ...rows].join('\n')
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dateStr = new Date().toISOString().split('T')[0]
    link.href = url
    link.setAttribute('download', `BuckGrid_Report_${dateStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url) // Prevent memory leak
    
    setToastMessage('CSV Report downloaded ✓')
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
  }, [])

  const updateAcresSummary = useCallback(() => {
    const totals = mapRef.current?.getTotalAcresByType?.() ?? []
    setTotalAcresByType(totals)
    setFeatureCount(mapRef.current?.getFeatureCount?.() ?? 0)
    setTotalPolygonAcres(mapRef.current?.getTotalPolygonAcres?.() ?? 0)
  }, [])

  const updateTerrainStatus = useCallback(() => {
    const hasInputs = mapRef.current?.hasTerrainInputs?.(terrainInputs) ?? false
    setTerrainStatus(hasInputs ? 'OK' : 'Missing')
  }, [terrainInputs])

  const handleFitToBorder = useCallback(() => {
    mapRef.current?.fitToBorder?.()
  }, [])

  const handleAnalyzeTerrain = useCallback(() => {
    // FIX 2: WIRE TERRAIN ANALYZE - Send terrain data + map center to Tony for analysis
    const mapContext = mapRef.current?.getMapContext?.() ?? { center: { lat: 0, lng: 0 }, zoom: 16 }
    const terrainSummary = `Terrain Analysis Request:
- Season: ${terrainInputs.seasonPhase}
- Cover: ${terrainInputs.coverType}
- Elevation: ${terrainInputs.elevation}
- Features: ${[terrainInputs.hasRidges && 'Ridges', terrainInputs.hasValleys && 'Valleys', terrainInputs.hasCreeks && 'Creeks', terrainInputs.hasSaddles && 'Saddles', terrainInputs.hasBenches && 'Benches'].filter(Boolean).join(', ') || 'None'}
- Thermals: ${terrainInputs.thermals}
- Wind: ${terrainInputs.predominantWind || 'Unknown'}
- Access: ${terrainInputs.accessPoints || 'Not specified'}
- Pressure: ${terrainInputs.pressureConcerns || 'None noted'}
- Neighbors Food: ${terrainInputs.neighborsFood || 'Unknown'}
- Goals: ${terrainInputs.goals || 'Not specified'}
- Notes: ${terrainInputs.terrainNotes || 'None'}
- Map Center: [${mapContext.center.lat.toFixed(6)}, ${mapContext.center.lng.toFixed(6)}]

Analyze this terrain for the stated goals.`
    
    chatRef.current?.addUserMessage(terrainSummary)
    setTerrainStatus('Analyzed')
  }, [terrainInputs])

  const handleMergeCrops = useCallback(() => {
    const geoJSON = mapRef.current?.getGeoJSON?.() ?? { type: 'FeatureCollection', features: [] }
    
    if (geoJSON.features.length < 2) {
      setToastMessage('Need at least 2 features to merge')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2000)
      return
    }

    // Group polygons by their tool type
    const featuresByType: Record<string, any[]> = {}
    const nonPolygons: any[] = []

    geoJSON.features.forEach((f: any) => {
      if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
        const toolId = f.properties?.toolId || 'unknown'
        if (!featuresByType[toolId]) featuresByType[toolId] = []
        featuresByType[toolId].push(f)
      } else {
        nonPolygons.push(f)
      }
    })

    let mergedCount = 0
    const mergedFeatures: any[] = []
    const failedMerges: any[] = []

    // Union logic: Merge overlapping shapes of the same type
    Object.keys(featuresByType).forEach(toolId => {
      const group = featuresByType[toolId]
      if (group.length > 1) {
        try {
          let masterShape = group[0]
          for (let i = 1; i < group.length; i++) {
            const unionResult = turf.union(masterShape, group[i])
            if (unionResult) {
              masterShape = unionResult
              masterShape.properties = { ...group[0].properties }
              mergedCount++
            } else {
              // Union returned null, keep original
              failedMerges.push(group[i])
            }
          }
          mergedFeatures.push(masterShape)
        } catch (err) {
          console.warn('Merge failed for', toolId, '- keeping original shapes', err)
          // Keep all original features if merge fails
          failedMerges.push(...group)
        }
      } else {
        mergedFeatures.push(...group)
      }
    })

    if (mergedCount > 0) {
      // Combine non-polygons with successfully merged features
      const allFeatures = [...nonPolygons, ...mergedFeatures]
      
      // Rebuild the map with merged features
      const mergedGeoJSON = {
        type: 'FeatureCollection',
        features: allFeatures
      }
      
      // Clear and reload features (using existing loadPlan infrastructure)
      mapRef.current?.wipeAll?.()
      if (mapRef.current?.loadPlan) {
        mapRef.current.loadPlan({
          layers: allFeatures,
          border: { points: [], locked: false, acres: 0 }
        })
      }
      
      const msg = failedMerges.length > 0 
        ? `Merged ${mergedCount} features (${failedMerges.length} failed - removed)`
        : `Merged ${mergedCount} overlapping features`
      setToastMessage(msg)
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2500)
      
      // Update UI
      updateAcresSummary()
    } else {
      setToastMessage('No overlapping features found')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2000)
    }
  }, [])

  // Update terrain status when inputs change
  useEffect(() => {
    updateTerrainStatus()
  }, [terrainInputs, updateTerrainStatus])

  return (
    <div style={{ height: '100dvh', width: '100vw', background: '#000', overflow: 'hidden', position: 'fixed' }}>
      <MapContainer 
        ref={mapRef} 
        activeTool={activeTool} 
        brushSize={brushSize} 
        isDrawMode={isDrawMode}
        onModeChange={handleModeChange}
        onBlockMessage={handleBlockMessage}
        suggestedMarks={suggestedMarks}
        onFeatureCreated={handleFeatureCreated}
      />
      
      {/* FIX 3: Feature List Sidebar */}
      {!isMobile && <FeatureList layers={layers} />}
      
      {showToast && (
        <div className="glass" style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', padding: '12px 20px', borderRadius: 8, background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 12, zIndex: 9999, animation: 'fadeIn 0.3s' }}>
          ⚠️ {toastMessage}
        </div>
      )}

      {/* Draw Mode Indicator - Always visible */}
      {isDrawMode && (
        <div className="glass" style={{ 
          position: 'absolute', 
          top: isMobile ? 10 : 10, 
          left: isMobile ? 10 : '50%', 
          transform: isMobile ? 'none' : 'translateX(-50%)',
          padding: '8px 16px', 
          borderRadius: 8, 
          background: '#4ade80',  /* FIX 3: Clean green, no red artifacts */
          color: '#000', 
          fontWeight: 900, 
          fontSize: 12, 
          zIndex: 9999, 
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          border: 'none'  /* FIX 3: Remove any border artifacts */
        }}>
          ✏️ DRAW MODE ON
        </div>
      )}

      {/* Mobile Floating Buttons */}
      {isMobile && (
        <>
          <button
            onClick={onLockBorder}
            className="glass"
            style={{
              position: 'absolute',
              right: 10,
              top: 70,
              padding: '12px',
              borderRadius: '50%',
              width: '56px',
              height: '56px',
              background: '#FF6B00',
              color: '#000',
              border: 'none',
              fontWeight: 900,
              fontSize: '20px',
              cursor: 'pointer',
              zIndex: 2500,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}
          >
            🔒
          </button>
          <button
            onClick={handleFitToBorder}
            className="glass"
            style={{
              position: 'absolute',
              right: 10,
              top: 140,
              padding: '12px',
              borderRadius: '50%',
              width: '56px',
              height: '56px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              fontWeight: 900,
              fontSize: '20px',
              cursor: 'pointer',
              zIndex: 2500,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}
          >
            📍
          </button>
        </>
      )}

      {/* Desktop Layout */}
      {!isMobile && (
        <>
          {/* Sidebar Toggle Button */}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="glass"
            style={{
              position: 'absolute',
              left: isSidebarOpen ? 200 : 10,
              top: 10,
              zIndex: 3000,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(0, 0, 0, 0.9)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'left 0.3s ease-in-out',
              pointerEvents: 'auto'
            }}
            title={isSidebarOpen ? 'Hide Menu' : 'Show Menu'}
          >
            {isSidebarOpen ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 16, height: 16 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                HIDE
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 16, height: 16 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                MENU
              </>
            )}
          </button>

          {/* Collapsible Sidebar */}
          <div 
            style={{
              position: 'absolute',
              left: 10,
              top: 10,
              zIndex: 2000,
              transition: 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out',
              transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-220px)',
              opacity: isSidebarOpen ? 1 : 0,
              pointerEvents: isSidebarOpen ? 'auto' : 'none'
            }}
          >
          <div className="glass" style={{ padding: 12, borderRadius: 12, width: 180, maxHeight: 'calc(100vh - 20px)', overflowY: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#FF6B00', letterSpacing: 1 }}>BUCKGRID PRO</div>
            <ToolGrid 
              tools={TOOLS} 
              activeToolId={activeTool.id} 
              brushSize={brushSize}
              isDrawMode={isDrawMode} 
              onToggleDrawMode={() => setIsDrawMode(!isDrawMode)} 
              onSelectTool={(tool) => {
                setActiveTool(tool)
                // FIX 1: Pan tool disables draw mode for panning/zooming
                if (tool.id === 'nav') {
                  setIsDrawMode(false)
                } else {
                  setIsDrawMode(true)
                }
              }} 
              onBrushSize={(val) => {
                setBrushSize(val)
                mapRef.current?.setBrushSize?.(val)
              }}
              onLockBorder={onLockBorder}
              onFitToBorder={handleFitToBorder}
              onDeleteSelected={handleDeleteSelected}
              onUndo={handleUndo}
              onAssessProperty={handleAssessProperty}
              onWipeAll={() => { 
                mapRef.current?.wipeAll(); 
                setPropertyAcres(0);
                setFeatureCount(0);
                setTotalPolygonAcres(0);
                setTotalAcresByType([]);
              }} 
            />
            {/* Merge Overlaps Button */}
            <button 
              onClick={handleMergeCrops}
              style={{ 
                width: '100%', 
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', 
                color: '#fff', 
                padding: '10px', 
                borderRadius: 8, 
                fontWeight: 900, 
                cursor: 'pointer', 
                marginTop: 8,
                border: 'none',
                fontSize: 10
              }}
            >
              🔗 MERGE OVERLAPS
            </button>
          </div>
          </div>
          <PlanManager
            onSave={handleSavePlan}
            onLoad={handleLoadPlan}
            onNewPlan={handleNewPlan}
            onExportPlan={handleExportPlan}
            onExportReport={handleExportReport}
            onExportCSV={handleExportCSV}
          />
          <TerrainPanel 
            inputs={terrainInputs} 
            onChange={setTerrainInputs}
            onAnalyzeTerrain={handleAnalyzeTerrain}
          />
          <TonyChat 
            ref={chatRef} 
            getCaptureTarget={() => mapRef.current?.getCaptureElement() ?? null} 
            getGeoJSON={() => mapRef.current?.getGeoJSON?.() ?? { type: 'FeatureCollection', features: [] }}
            getLockedBordersGeoJSON={() => mapRef.current?.getLockedBordersGeoJSON?.() ?? { type: 'FeatureCollection', features: [] }}
            getMapContext={() => mapRef.current?.getMapContext?.() ?? { center: { lat: 0, lng: 0 }, zoom: 0 }}
            terrainInputs={terrainInputs}
            onApiStatus={setLastApiStatus}
            onSuggestedMarks={setSuggestedMarks}
          />
        </>
      )}

      {/* Mobile Layout - Bottom Drawer */}
      {isMobile && (
        <MobileDrawerMemo
          tools={TOOLS}
          activeToolId={activeTool.id}
          brushSize={brushSize}
          isDrawMode={isDrawMode}
          onToggleDrawMode={() => setIsDrawMode(!isDrawMode)}
          onSelectTool={(tool) => {
            setActiveTool(tool)
            // FIX 1: Pan tool disables draw mode for panning/zooming
            if (tool.id === 'nav') {
              setIsDrawMode(false)
            } else {
              setIsDrawMode(true)
            }
          }}
          onBrushSize={(val) => {
            setBrushSize(val)
            mapRef.current?.setBrushSize?.(val)
          }}
          onLockBorder={onLockBorder}
          onFitToBorder={handleFitToBorder}
          onDeleteSelected={handleDeleteSelected}
          onUndo={handleUndo}
          onAssessProperty={handleAssessProperty}
          onWipeAll={() => {
            mapRef.current?.wipeAll()
            setPropertyAcres(0)
            setFeatureCount(0)
            setTotalPolygonAcres(0)
            setTotalAcresByType([])
          }}
          chatRef={chatRef}
          getCaptureTarget={() => mapRef.current?.getCaptureElement() ?? null}
          getGeoJSON={() => mapRef.current?.getGeoJSON?.() ?? { type: 'FeatureCollection', features: [] }}
          getLockedBordersGeoJSON={() => mapRef.current?.getLockedBordersGeoJSON?.() ?? { type: 'FeatureCollection', features: [] }}
          getMapContext={() => mapRef.current?.getMapContext?.() ?? { center: { lat: 0, lng: 0 }, zoom: 0 }}
          terrainInputs={terrainInputs}
          onApiStatus={setLastApiStatus}
          onSuggestedMarks={setSuggestedMarks}
          onTerrainChange={setTerrainInputs}
          propertyAcres={propertyAcres}
          terrainStatus={terrainStatus}
          featureCount={featureCount}
          totalPolygonAcres={totalPolygonAcres}
          totalAcresByType={totalAcresByType}
        />
      )}

      {/* Debug System Panel */}
      <div style={{ position: 'fixed', bottom: 8, right: 8, zIndex: 9000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        {showDebug && (
          <div className="glass" style={{ 
            background: 'rgba(0, 0, 0, 0.95)', 
            color: '#4ade80', 
            padding: 16, 
            borderRadius: 8, 
            maxWidth: 400, 
            maxHeight: 240, 
            overflowY: 'auto',
            fontSize: 10,
            fontFamily: 'monospace',
            border: '1px solid #10b981',
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)'
          }}>
            <div style={{ fontWeight: 900, marginBottom: 8, color: '#10b981' }}>SYSTEM DEBUG</div>
            <div>Features: {featureCount}</div>
            <div>Property: {propertyAcres} acres</div>
            <div>Total Polygons: {totalPolygonAcres} acres</div>
            <div>Tool: {activeTool.name}</div>
            <div>Draw Mode: {isDrawMode ? 'ON' : 'OFF'}</div>
            <div>Terrain: {terrainStatus}</div>
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #10b981' }}>
              <div style={{ fontWeight: 700 }}>Layers by Type:</div>
              {totalAcresByType.map(({ type, totalAcres }) => (
                <div key={type}>• {type}: {totalAcres.toFixed(1)} ac</div>
              ))}
            </div>
          </div>
        )}
        <button 
          onClick={() => setShowDebug(!showDebug)}
          className="glass"
          style={{ 
            background: '#1f2937', 
            color: showDebug ? '#10b981' : '#6b7280',
            padding: '6px 12px', 
            borderRadius: 16, 
            border: '1px solid #374151',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1.2,
            cursor: 'pointer',
            textTransform: 'uppercase',
            transition: 'all 0.2s'
          }}
        >
          {showDebug ? 'Hide System' : 'System Ready'}
        </button>
      </div>
    </div>
  )
}
