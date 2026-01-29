'use client'

import React, { useCallback, useRef } from 'react'
import { useMapStore } from '@/stores/mapStore'
import { TOOLS, TOOL_CATEGORIES } from '../constants/tools'
import * as turf from '@turf/turf'
import { useChatStore } from '@/stores/chatStore'

// Simple KML coordinate parser
function parseKML(text: string): [number, number][] | null {
  const coordMatch = text.match(/<coordinates>([\s\S]*?)<\/coordinates>/)
  if (!coordMatch) return null
  return coordMatch[1]
    .trim()
    .split(/\s+/)
    .map((c) => {
      const [lng, lat] = c.split(',').map(Number)
      if (isNaN(lng) || isNaN(lat)) return null
      return [lng, lat] as [number, number]
    })
    .filter(Boolean) as [number, number][]
}

export default function TacticalDock() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    activeTool,
    setActiveTool,
    boundaryCoords,
    setBoundaryCoords,
    setBoundaryGeoJSON,
    setPropertyAcres,
    setLocked,
    isLocked,
    propertyAcres,
    showCorrections,
    toggleCorrections,
    fieldRecommendation,
    setFieldRecommendation,
    undo,
    wipeAll,
  } = useMapStore()

  const { addMessage } = useChatStore()

  // Lock hand-drawn boundary
  const lockBoundary = useCallback(() => {
    if (boundaryCoords.length < 3) return
    const ring = [...boundaryCoords, boundaryCoords[0]]
    const poly = turf.polygon([ring])
    const acres = Number((turf.area(poly) * 0.000247105).toFixed(2))
    setPropertyAcres(acres)
    setLocked(true)
    setActiveTool('nav')
    addMessage({ role: 'tony', text: `Locked: ${acres} acres. Now draw your plots and I'll audit the layout.` })
  }, [boundaryCoords, setPropertyAcres, setLocked, setActiveTool, addMessage])

  // Upload KML/GeoJSON boundary
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      if (!text) return

      const isKml = file.name.endsWith('.kml')

      if (isKml) {
        const coords = parseKML(text)
        if (!coords || coords.length < 3) {
          addMessage({ role: 'tony', text: 'Bad KML. Need at least 3 coordinates.' })
          return
        }
        const ring = [...coords, coords[0]]
        const poly = turf.polygon([ring])
        const acres = Number((turf.area(poly) * 0.000247105).toFixed(2))
        const fc: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }],
        }
        setBoundaryGeoJSON(fc)
        setPropertyAcres(acres)
        setLocked(true)
        setActiveTool('nav')
        addMessage({ role: 'tony', text: `Uploaded KML: ${acres} acres. Camera locked. Start drawing.` })
      } else {
        // GeoJSON
        try {
          const geojson = JSON.parse(text)
          const fc: GeoJSON.FeatureCollection = geojson.type === 'FeatureCollection'
            ? geojson
            : { type: 'FeatureCollection', features: [geojson.type === 'Feature' ? geojson : { type: 'Feature', properties: {}, geometry: geojson }] }

          const acres = Number((turf.area(fc) * 0.000247105).toFixed(2))
          setBoundaryGeoJSON(fc)
          setPropertyAcres(acres)
          setLocked(true)
          setActiveTool('nav')
          addMessage({ role: 'tony', text: `Uploaded GeoJSON: ${acres} acres. Camera locked. Start drawing.` })
        } catch {
          addMessage({ role: 'tony', text: 'Invalid GeoJSON file. Check the format.' })
        }
      }
    }
    reader.readAsText(file)
    // Reset so same file can be re-uploaded
    e.target.value = ''
  }, [setBoundaryGeoJSON, setPropertyAcres, setLocked, setActiveTool, addMessage])

  const handleWipe = useCallback(() => {
    wipeAll()
    addMessage({ role: 'tony', text: 'Clean slate. Lock a new boundary when ready.' })
  }, [wipeAll, addMessage])

  const toolName = TOOLS.find((t) => t.id === fieldRecommendation?.toolId)?.name

  return (
    <div className="dock-panel">
      {/* Brand Header */}
      <div className="dock-header">
        <div className="brand-mark">BUCKGRID</div>
        <div className="brand-sub">PRO TACTICAL</div>
      </div>

      {/* Upload Boundary — "Big Green Button" */}
      <div className="dock-section">
        <input
          ref={fileInputRef}
          type="file"
          accept=".geojson,.json,.kml"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
        <button
          className="dock-btn-upload"
          onClick={() => fileInputRef.current?.click()}
        >
          UPLOAD BOUNDARY
        </button>

        {/* Or draw manually */}
        <button
          className={`dock-btn ${activeTool === 'boundary' ? 'dock-btn-active' : ''}`}
          onClick={() => setActiveTool(activeTool === 'boundary' ? 'nav' : 'boundary')}
          style={{ marginTop: 6, borderColor: '#FF6B00' }}
        >
          <span>🟧</span> DRAW BORDER
        </button>

        {boundaryCoords.length >= 3 && !isLocked && (
          <button className="dock-btn-lock" onClick={lockBoundary}>
            LOCK BOUNDARY
          </button>
        )}
      </div>

      {/* Acres Display */}
      {isLocked && (
        <div className="acres-display">
          <span className="acres-num">{propertyAcres}</span>
          <span className="acres-label">ACRES</span>
        </div>
      )}

      {/* Tool Categories */}
      {isLocked && TOOL_CATEGORIES.map((cat) => {
        const categoryTools = TOOLS.filter((t) => t.category === cat.key)
        return (
          <div key={cat.key} className="dock-section">
            <div className="dock-category-label">{cat.label}</div>
            <div className="dock-tool-grid">
              {categoryTools.map((tool) => (
                <button
                  key={tool.id}
                  className={`dock-tool-btn ${activeTool === tool.id ? 'dock-tool-active' : ''}`}
                  onClick={() => setActiveTool(tool.id)}
                  style={{
                    borderColor: activeTool === tool.id ? tool.color : 'transparent',
                    color: activeTool === tool.id ? tool.color : undefined,
                  }}
                >
                  <span className="tool-icon">{tool.icon}</span>
                  <span className="tool-name">{tool.name}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {/* Tony's Correction Toggle */}
      {isLocked && (
        <div className="dock-section">
          <button
            className={`dock-btn ${showCorrections ? 'dock-btn-correction-on' : ''}`}
            onClick={toggleCorrections}
          >
            <span className="corr-dot" />
            {showCorrections ? 'CORRECTIONS ON' : 'CORRECTIONS OFF'}
          </button>
        </div>
      )}

      {/* Field Recommendation Card */}
      {fieldRecommendation && (
        <div className="dock-section field-rec-card">
          <div className="dock-category-label">FIELD RECOMMENDATION</div>
          <div className="field-rec-name">{toolName}</div>
          <div className="field-rec-row">
            <span className="field-rec-label">Area</span>
            <span className="field-rec-value">{fieldRecommendation.acreage} ac</span>
          </div>
          <div className="field-rec-row">
            <span className="field-rec-label">Seed</span>
            <span className="field-rec-value">{fieldRecommendation.seedLbs} lbs</span>
          </div>
          <div className="field-rec-row">
            <span className="field-rec-label">Fertilizer</span>
            <span className="field-rec-value">{fieldRecommendation.fertilizerLbs} lbs</span>
          </div>
          <div className="field-rec-row">
            <span className="field-rec-label">Lime</span>
            <span className="field-rec-value">{fieldRecommendation.limeTons} tons</span>
          </div>
          <button
            className="dock-btn-secondary"
            style={{ marginTop: 8, width: '100%' }}
            onClick={() => setFieldRecommendation(null)}
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Tactical Legend */}
      {isLocked && (
        <div className="dock-section">
          <div className="dock-category-label">LEGEND</div>
          <div className="legend-grid">
            {TOOLS.filter((t) => t.category !== 'nav' && t.category !== 'boundary').map((t) => (
              <div key={t.id} className="legend-item">
                <span className="legend-swatch" style={{ backgroundColor: t.color }} />
                <span className="legend-name">{t.name}</span>
              </div>
            ))}
            <div className="legend-item">
              <span className="legend-swatch legend-swatch-dashed" />
              <span className="legend-name">CORRECTION</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {isLocked && (
        <div className="dock-section dock-actions">
          <button className="dock-btn-secondary" onClick={() => setActiveTool('nav')}>
            ✋ PAN
          </button>
          <button className="dock-btn-secondary" onClick={undo}>
            ↩ UNDO
          </button>
        </div>
      )}

      {/* Wipe */}
      <div className="dock-section">
        <button className="dock-btn-wipe" onClick={handleWipe}>
          WIPE ALL
        </button>
      </div>
    </div>
  )
}
