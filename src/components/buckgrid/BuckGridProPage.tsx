'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import MapContainer, { type MapContainerHandle } from './map/MapContainer'
import ToolGrid from './ui/ToolGrid'
import TonyChat, { type TonyChatHandle } from './chat/TonyChat'
import BuckGridLogo from './ui/BuckGridLogo'
import { TOOLS, type Tool } from './constants/tools'
import { useTonyLogic } from './hooks/useTonyLogic'
import { useTonyEyes } from './hooks/useTonyEyes'
import html2canvas from 'html2canvas'

export default function BuckGridProPage() {
  const mapRef = useRef<MapContainerHandle>(null)
  const chatRef = useRef<TonyChatHandle>(null)
  const [activeTool, setActiveTool] = useState<Tool>(TOOLS[0])
  const [brushSize, setBrushSize] = useState(15)
  const [propertyAcres, setPropertyAcres] = useState(0)
  const [toolTab, setToolTab] = useState<'habitat' | 'food'>('habitat')
  const [isCapturing, setIsCapturing] = useState(false)
  
  // Tony's Brain - H3 Grid Logic
  const { h3Grid, generateGrid, getGridStats } = useTonyLogic()
  
  // Tony's Eyes - Vision Analysis
  const { analyzeMap, isAnalyzing, analysisResult } = useTonyEyes()

  // Automatically render H3 grid when it changes
  // DISABLED: Grid is internal logic only, not visible to user
  // useEffect(() => {
  //   if (h3Grid && h3Grid.size > 0 && mapRef.current?.renderH3Grid) {
  //     console.log('[BuckGridPro] Rendering H3 grid overlay...')
  //     mapRef.current.renderH3Grid(h3Grid)
  //   }
  // }, [h3Grid])

  // Process vision analysis results and draw features on map
  useEffect(() => {
    if (analysisResult && analysisResult.features && analysisResult.features.length > 0) {
      console.log('[BuckGridPro] Jim sees:', analysisResult)
      
      // Get map bounds to translate box_2d coordinates to lat/lng
      const mapContext = mapRef.current?.getMapContext()
      if (!mapContext?.bounds) {
        console.warn('[BuckGridPro] No map bounds available for vision translation')
        chatRef.current?.addTonyMessage(
          `Vision analysis complete, but map bounds unavailable. Please lock boundary first.`
        )
        return
      }

      // Translate vision features to map features
      const translatedFeatures = analysisResult.features.map((visionFeature, idx) => {
        const [ymin, xmin, ymax, xmax] = visionFeature.box_2d
        
        // Convert 0-1000 scale to lat/lng using map bounds
        const latRange = mapContext.bounds.north - mapContext.bounds.south
        const lngRange = mapContext.bounds.east - mapContext.bounds.west
        
        const south = mapContext.bounds.south + (ymin / 1000) * latRange
        const north = mapContext.bounds.south + (ymax / 1000) * latRange
        const west = mapContext.bounds.west + (xmin / 1000) * lngRange
        const east = mapContext.bounds.west + (xmax / 1000) * lngRange

        return {
          id: `vision_${visionFeature.label}_${idx}`,
          type: visionFeature.label,
          bounds: { north, south, east, west },
          confidence: visionFeature.confidence,
        }
      })

      console.log('[BuckGridPro] Translated features:', translatedFeatures)
      
      // Draw features on map
      mapRef.current?.drawAISuggestions(translatedFeatures)
      
      chatRef.current?.addTonyMessage(
        `Vision Analysis Complete: Found ${analysisResult.features.length} habitat zones (${translatedFeatures.map(f => f.type).join(', ')}). Features drawn on map.`
      )
    }
  }, [analysisResult])

  // Prevent duplicate lock actions (React Strict Mode guard)
  const lockOnceRef = useRef(false)
  const onLockBorder = useCallback(() => {
    if (lockOnceRef.current) return
    lockOnceRef.current = true
    const acres = mapRef.current?.lockBoundary()
    if (!acres) return
    setPropertyAcres(acres)
    
    // Get boundary GeoJSON and generate H3 grid
    const mapContext = mapRef.current?.getMapContext()
    if (mapContext?.boundary) {
      console.log('[BuckGridPro] Generating H3 grid from locked boundary...')
      generateGrid(mapContext.boundary)
    }
    
    chatRef.current?.addTonyMessage(`Locked: ${acres} acres. Send your notes.`)
    setActiveTool(TOOLS[0])
    // Reset ref after short delay to allow future locks if needed
    setTimeout(() => { lockOnceRef.current = false }, 500)
  }, [generateGrid])

  // Handle Evaluate Property - Capture map and analyze with Vision AI
  const handleEvaluateProperty = useCallback(async () => {
    try {
      setIsCapturing(true)
      console.log('[BuckGridPro] Capturing map screenshot...')

      // Get map container element
      const mapElement = mapRef.current?.getCaptureElement()
      if (!mapElement) {
        throw new Error('Map container not found')
      }

      // Capture screenshot using html2canvas
      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#000',
        scale: 1, // Lower scale for faster processing
        logging: false,
      })

      // Convert to base64 JPEG
      const imageData = canvas.toDataURL('image/jpeg', 0.8)
      console.log('[BuckGridPro] Screenshot captured, sending to Vision API...')

      // Send to Tony's Eyes (Gemini Vision) and draw immediately
      const result = await analyzeMap(imageData)
      if (result && result.features) {
        mapRef.current?.drawAISuggestions(result.features)
        console.log('[BuckGridPro] Features drawn on map:', result.features)
      }

      console.log('[BuckGridPro] Vision analysis complete')
    } catch (error) {
      console.error('[BuckGridPro] Evaluate failed:', error)
      chatRef.current?.addTonyMessage(
        `Vision analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setIsCapturing(false)
    }
  }, [analyzeMap])

  return (
    <div style={{ height: '100dvh', width: '100vw', background: '#0A0A08', overflow: 'hidden', position: 'fixed' }}>
      {/* Full-bleed satellite map */}
      <MapContainer ref={mapRef} activeTool={activeTool} brushSize={brushSize} />

      {/* ─── Top Brand Bar ─── */}
      <div className="brandBar">
        <div className="brandMark">
          <BuckGridLogo size={42} />
          <div>
            <h1>BUCKGRID <span>PRO</span></h1>
            <div className="brandTagline">Elite Whitetail Habitat Intelligence</div>
          </div>
        </div>
      </div>

      {/* ─── Left Panel: Tools ─── */}
      <div
        className="glass textureOverlay"
        style={{
          position: 'absolute',
          left: 14,
          top: 70,
          padding: '16px 14px',
          borderRadius: 8,
          width: 200,
          borderTop: '2px solid rgba(200, 165, 92, 0.3)',
        }}
      >
        <div style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 14,
          letterSpacing: 3,
          color: 'var(--gold)',
          marginBottom: 4,
        }}>
          MAPPING TOOLS
        </div>
        <div className="dividerGold" />
        {/* Tabs for Habitat / Food */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            style={{
              flex: 1,
              padding: '6px 0',
              background: toolTab === 'habitat' ? 'var(--gold)' : 'none',
              color: toolTab === 'habitat' ? '#222' : 'var(--gold)',
              border: 'none',
              borderRadius: 6,
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 13,
              letterSpacing: 2,
              transition: 'background 0.15s',
            }}
            onClick={() => setToolTab('habitat')}
          >HABITAT</button>
          <button
            style={{
              flex: 1,
              padding: '6px 0',
              background: toolTab === 'food' ? 'var(--gold)' : 'none',
              color: toolTab === 'food' ? '#222' : 'var(--gold)',
              border: 'none',
              borderRadius: 6,
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 13,
              letterSpacing: 2,
              transition: 'background 0.15s',
            }}
            onClick={() => setToolTab('food')}
          >FOOD</button>
        </div>
        {/* Filter tools for tab, always show PAN/BOUNDARY */}
        {(() => {
          const alwaysVisible = TOOLS.filter(t => t.id === 'nav' || t.id === 'boundary');
          let tabTools: Tool[] = [];
          if (toolTab === 'habitat') {
            tabTools = TOOLS.filter(t => [
              'bedding',
              'sanctuary',
              'focus',
              'food',
              'egyptian_wheat',
              'switchgrass'
            ].includes(t.id));
          } else {
            tabTools = TOOLS.filter(t => [
              'clover',
              'corn',
              'milo',
              'alfalfa',
              'brassicas',
              'winter_wheat'
            ].includes(t.id));
          }
          // Hide eraser for now
          const filtered = [...alwaysVisible, ...tabTools];
          return (
            <ToolGrid
              tools={filtered}
              activeToolId={activeTool.id}
              brushSize={brushSize}
              onSelectTool={setActiveTool}
              onBrushSize={setBrushSize}
              onLockBorder={onLockBorder}
              onWipeAll={() => { mapRef.current?.wipeAll(); setPropertyAcres(0) }}
            />
          );
        })()}
        
        {/* Temporary: Log Grid Stats Button */}
        <button
          style={{
            marginTop: 12,
            width: '100%',
            padding: '8px 0',
            background: 'rgba(200, 165, 92, 0.2)',
            color: 'var(--gold)',
            fontWeight: 700,
            borderRadius: 6,
            border: '1px solid var(--gold)',
            cursor: 'pointer',
            fontSize: 13
          }}
          onClick={() => {
            const stats = getGridStats()
            console.log('[H3 Grid Stats]', {
              totalCells: h3Grid.size,
              stats,
              sampleCells: Array.from(h3Grid.values()).slice(0, 3)
            })
            chatRef.current?.addTonyMessage(
              `H3 Grid: ${h3Grid.size} cells generated. Check console for details.`
            )
          }}
        >
          Log Grid Stats
        </button>
        
        {/* Dedicated Audit button for Tony */}
        <button
          style={{
            marginTop: 12,
            width: '100%',
            padding: '8px 0',
            background: 'var(--gold)',
            color: '#222',
            fontWeight: 700,
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            fontSize: 15
          }}
          onClick={() => {
            // Build AuditContext
            const mapContext = mapRef.current?.getMapContext() ?? null;
            let boundaryLocked = false, boundaryAcres = 0;
            let features: Array<{id: string; type: string; acres?: number; label: string}> = [];
            let totalsByType: Record<string, { count: number; acres?: number }> = {};
            if (mapContext?.sceneGraphLite) {
              boundaryLocked = !!mapContext.sceneGraphLite.boundary.locked;
              boundaryAcres = mapContext.sceneGraphLite.boundary.acres || 0;
              // Build human-readable feature labels
              const typeCounts: Record<string, number> = {};
              features = (mapContext.sceneGraphLite.features ?? []).map(f => {
                const type = f.type || 'feature';
                typeCounts[type] = (typeCounts[type] || 0) + 1;
                const idx = typeCounts[type];
                // Find display name for type
                let display = type.replace(/_/g, ' ');
                const tool = TOOLS.find(t => t.type === type || t.id === type);
                if (tool && tool.name) display = tool.name;
                const labelBase = `${display} ${idx}`;
                const acres = f.acres ? Number(f.acres) : undefined;
                const label = acres ? `${labelBase} (${acres.toFixed(2)} ac)` : labelBase;
                return {
                  id: labelBase,
                  type: f.type,
                  acres,
                  label
                };
              });
              totalsByType = mapContext.sceneGraphLite.totalsByType ?? {};
            }
            const auditContext = {
              boundaryLocked,
              boundaryAcres,
              features,
              totalsByType
            };
            // Compose structured prompt
            const prompt = `AUDIT_PROPERTY: Run a full habitat audit using the provided AuditContext.`;
            // Send to Tony
            chatRef.current?.addTonyMessage(`${prompt}\n\nAuditContext: ${JSON.stringify(auditContext)}`);
          }}
        >Audit Property</button>
        
        {/* Evaluate Property - Vision AI Analysis */}
        <button
          style={{
            marginTop: 12,
            width: '100%',
            padding: '8px 0',
            background: isAnalyzing || isCapturing ? 'rgba(200, 165, 92, 0.3)' : '#22c55e',
            color: isAnalyzing || isCapturing ? 'var(--gold)' : '#000',
            fontWeight: 700,
            borderRadius: 6,
            border: isAnalyzing || isCapturing ? '1px solid var(--gold)' : 'none',
            cursor: isAnalyzing || isCapturing ? 'not-allowed' : 'pointer',
            fontSize: 15,
            opacity: isAnalyzing || isCapturing ? 0.6 : 1,
          }}
          onClick={handleEvaluateProperty}
          disabled={isAnalyzing || isCapturing}
        >
          {isCapturing ? 'Capturing...' : isAnalyzing ? 'Analyzing...' : 'Evaluate Property'}
        </button>
      </div>

      {/* ─── Tony Chat Panel ─── */}
      <TonyChat 
        ref={chatRef} 
        getCaptureTarget={() => mapRef.current?.getCaptureElement() ?? null} 
        acres={propertyAcres}
        activeTool={activeTool}
        getMapContext={() => mapRef.current?.getMapContext() ?? null}
        onDrawFeatures={(features) => mapRef.current?.drawAISuggestions(features)}
      />

      {/* ─── Bottom Status Bar ─── */}
      <div
        className="glass"
        style={{
          position: 'absolute',
          left: 14,
          bottom: 14,
          borderRadius: 6,
          borderLeft: '3px solid var(--gold)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div className="statusBadge">
          <span className="value">{propertyAcres}</span>
          <span className="unit">Acres Locked</span>
        </div>
      </div>

      {/* ─── Bottom-right brand footer ─── */}
      <div style={{
        position: 'absolute',
        right: 14,
        bottom: 14,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        opacity: 0.4,
      }}>
        <BuckGridLogo size={20} />
        <span style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 11,
          letterSpacing: 3,
          color: 'var(--gold-dark)',
        }}>
          BUCKGRID PRO
        </span>
      </div>
    </div>
  )
}
