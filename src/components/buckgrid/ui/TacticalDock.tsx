'use client'

import React, { useCallback } from 'react'
import { useMapStore } from '@/stores/mapStore'
import { TOOLS, TOOL_CATEGORIES, type Tool } from '../constants/tools'
import * as turf from '@turf/turf'
import { useChatStore } from '@/stores/chatStore'

export default function TacticalDock() {
  const {
    activeTool,
    setActiveTool,
    brushSize,
    setBrushSize,
    boundaryCoords,
    setBoundaryCoords,
    setPropertyAcres,
    setLocked,
    isLocked,
    propertyAcres,
    undo,
    wipeAll,
  } = useMapStore()

  const { addMessage } = useChatStore()

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

  const handleWipe = useCallback(() => {
    wipeAll()
    addMessage({ role: 'tony', text: 'Clean slate. Lock a new boundary when ready.' })
  }, [wipeAll, addMessage])

  return (
    <div className="dock-panel">
      {/* Header */}
      <div className="dock-header">
        <div className="brand-mark">BUCKGRID</div>
        <div className="brand-sub">PRO TACTICAL</div>
      </div>

      {/* Boundary Controls */}
      <div className="dock-section">
        <button
          className={`dock-btn ${activeTool === 'boundary' ? 'dock-btn-active' : ''}`}
          onClick={() => setActiveTool(activeTool === 'boundary' ? 'nav' : 'boundary')}
          style={{ borderColor: '#FF6B00' }}
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
