'use client'

import React, { useState } from 'react'

type Feature = {
  type: string
  name: string
  acres: number
  note?: string
}

type Props = {
  layers: Feature[]
  onLayerClick?: (layer: Feature) => void
}

export default function FeatureList({ layers, onLayerClick }: Props) {
  const [isOpen, setIsOpen] = useState(true)

  // Group layers by category
  const groupedLayers = layers.reduce((acc, layer) => {
    const category = getCategoryName(layer.type)
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(layer)
    return acc
  }, {} as Record<string, Feature[]>)

  return (
    <div 
      className="glass" 
      style={{ 
        position: 'absolute', 
        left: 10, 
        top: 10, 
        width: isOpen ? 280 : 50, 
        borderRadius: 12, 
        overflow: 'hidden',
        maxHeight: isOpen ? 'calc(100vh - 180px)' : '50px',
        transition: 'all 0.3s',
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'auto',
        zIndex: 2000
      }}
    >
      {/* Header */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          padding: 12, 
          background: '#1a1a1a', 
          cursor: 'pointer', 
          display: 'flex', 
          justifyContent: 'space-between', 
          fontWeight: 900, 
          fontSize: 10,
          borderBottom: isOpen ? '1px solid #333' : 'none'
        }}
      >
        <span>{isOpen ? '📋 LAYERS' : '📋'}</span>
        <span>{isOpen ? '—' : '+'}</span>
      </div>

      {/* Layer List */}
      {isOpen && (
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '8px 0',
          fontSize: 11
        }}>
          {Object.keys(groupedLayers).length === 0 ? (
            <div style={{ padding: '12px', color: '#666', textAlign: 'center', fontSize: 10 }}>
              No features drawn yet
            </div>
          ) : (
            Object.entries(groupedLayers).map(([category, categoryLayers]) => (
              <div key={category} style={{ marginBottom: 12 }}>
                {/* Category Header */}
                <div style={{ 
                  padding: '6px 12px', 
                  background: '#1a1a1a', 
                  fontWeight: 700, 
                  fontSize: 9, 
                  color: '#4ade80',
                  borderTop: '1px solid #333',
                  borderBottom: '1px solid #333'
                }}>
                  {category} ({categoryLayers.length})
                </div>

                {/* Category Items */}
                {categoryLayers.map((layer, idx) => (
                  <div
                    key={`${layer.type}-${idx}`}
                    onClick={() => onLayerClick?.(layer)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #222',
                      transition: 'background 0.2s',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#2a2a2a'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: 11 }}>
                        {layer.name}
                      </span>
                      {layer.note && (
                        <span style={{ fontSize: 9, color: '#888', fontStyle: 'italic' }}>
                          "{layer.note}"
                        </span>
                      )}
                    </div>
                    <span style={{ 
                      fontWeight: 700, 
                      fontSize: 10, 
                      color: '#4ade80',
                      minWidth: '50px',
                      textAlign: 'right'
                    }}>
                      {layer.acres.toFixed(1)}ac
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* Footer Stats */}
      {isOpen && layers.length > 0 && (
        <div style={{ 
          padding: '10px 12px', 
          borderTop: '1px solid #333', 
          background: '#1a1a1a',
          fontSize: 10,
          display: 'flex',
          justifyContent: 'space-between',
          fontWeight: 700
        }}>
          <span>TOTAL</span>
          <span style={{ color: '#4ade80' }}>
            {layers.reduce((sum, l) => sum + l.acres, 0).toFixed(1)}ac
          </span>
        </div>
      )}
    </div>
  )
}

// Helper to categorize layers
function getCategoryName(type: string): string {
  if (type.includes('food_plot')) return '🌾 Food Plots'
  if (type === 'bedding') return '🛏️ Bedding Areas'
  if (type === 'screen') return '🌲 Screening'
  if (type === 'switchgrass') return '🌾 Cover'
  if (type === 'stand') return '🏹 Stands'
  if (type === 'access_trail') return '🥾 Trails'
  if (type === 'pinch_point') return '🎯 Pinch Points'
  if (type === 'pressure_zone') return '⚠️ Pressure Zones'
  if (type === 'conversation_zone') return '💬 Blue Notes'
  if (type === 'boundary') return '🟧 Boundaries'
  return '📍 Other'
}
