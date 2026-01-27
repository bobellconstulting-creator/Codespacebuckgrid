'use client'

import React, { useState } from 'react'
import ToolGrid from '../ui/ToolGrid'
import TonyChat, { type TonyChatHandle } from '../chat/TonyChat'
import TerrainPanel, { type TerrainInputs } from '../terrain/TerrainPanel'
import type { Tool } from '../constants/tools'

type Tab = 'tools' | 'layers' | 'tony' | 'terrain'

type Props = {
  // Tools tab
  tools: Tool[]
  activeToolId: string
  brushSize: number
  isDrawMode: boolean
  onToggleDrawMode: () => void
  onSelectTool: (t: Tool) => void
  onBrushSize: (n: number) => void
  onLockBorder: () => void
  onFitToBorder: () => void
  onDeleteSelected: () => void
  onUndo: () => void
  onWipeAll: () => void
  onAssessProperty: () => void
  
  // Tony tab
  chatRef: React.RefObject<TonyChatHandle>
  getCaptureTarget: () => HTMLElement | null
  getGeoJSON: () => any
  getLockedBordersGeoJSON: () => any
  getMapContext: () => { center: { lat: number, lng: number }, zoom: number }
  terrainInputs: TerrainInputs
  onApiStatus: (status: string) => void
  onSuggestedMarks?: (marks: any[]) => void
  
  // Terrain tab
  onTerrainChange: (inputs: TerrainInputs) => void
  
  // Layers tab + Status display
  propertyAcres: number
  terrainStatus: string
  featureCount: number
  totalPolygonAcres: number
  totalAcresByType: Array<{ type: string, totalAcres: number }>
}

export default function MobileDrawer(props: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('tools')

  const tabs: Array<{ id: Tab, label: string, icon: string }> = [
    { id: 'tools', label: 'Tools', icon: '🛠️' },
    { id: 'layers', label: 'Layers', icon: '📊' },
    { id: 'tony', label: 'Tony', icon: '🦌' },
    { id: 'terrain', label: 'Terrain', icon: '🌲' }
  ]

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 3000,
      pointerEvents: 'auto'
    }}>
      {/* Drawer Handle */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'rgba(15, 15, 15, 0.98)',
          borderTop: '2px solid #FF6B00',
          padding: '12px',
          textAlign: 'center',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ 
          width: '40px', 
          height: '4px', 
          background: '#666', 
          borderRadius: '2px', 
          margin: '0 auto 8px',
          transition: 'all 0.2s'
        }} />
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#FF6B00' }}>
          {isOpen ? '▼ CLOSE' : '▲ OPEN CONTROLS'}
        </div>
      </div>

      {/* Drawer Content */}
      {isOpen && (
        <div style={{
          background: 'rgba(15, 15, 15, 0.98)',
          backdropFilter: 'blur(15px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          maxHeight: '70vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(0,0,0,0.5)'
          }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  background: activeTab === tab.id ? '#FF6B00' : 'transparent',
                  color: activeTab === tab.id ? '#000' : '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div>{tab.icon}</div>
                <div style={{ marginTop: '4px' }}>{tab.label}</div>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{
            padding: '16px',
            overflowY: 'auto',
            maxHeight: 'calc(70vh - 100px)',
            WebkitOverflowScrolling: 'touch'
          }}>
            {activeTab === 'tools' && (
              <ToolGrid
                tools={props.tools}
                activeToolId={props.activeToolId}
                brushSize={props.brushSize}
                isDrawMode={props.isDrawMode}
                onToggleDrawMode={props.onToggleDrawMode}
                onSelectTool={props.onSelectTool}
                onBrushSize={props.onBrushSize}
                onLockBorder={props.onLockBorder}
                onFitToBorder={props.onFitToBorder}
                onDeleteSelected={props.onDeleteSelected}
                onUndo={props.onUndo}
                onWipeAll={props.onWipeAll}
                onAssessProperty={props.onAssessProperty}
              />
            )}

            {activeTab === 'layers' && (
              <div style={{ color: '#fff' }}>
                {/* Status Card */}
                <div style={{
                  padding: '12px',
                  background: 'rgba(255,107,0,0.1)',
                  borderRadius: '8px',
                  borderLeft: '4px solid #FF6B00',
                  marginBottom: '16px'
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#FF6B00', marginBottom: '8px' }}>
                    {props.propertyAcres} <span style={{ fontSize: '10px', color: '#888' }}>ACRES</span>
                  </div>
                  <div style={{ display: 'grid', gap: '4px', fontSize: '11px' }}>
                    <div style={{ fontWeight: 700, color: props.propertyAcres > 0 ? '#4ade80' : '#dc2626' }}>
                      Border: {props.propertyAcres > 0 ? 'Locked ✓' : 'Not Locked'}
                    </div>
                    <div style={{ fontWeight: 700, color: props.terrainStatus === 'OK' ? '#4ade80' : '#facc15' }}>
                      Terrain: {props.terrainStatus}
                    </div>
                    <div style={{ fontWeight: 700, color: '#3b82f6' }}>
                      Features: {props.featureCount}
                    </div>
                    <div style={{ fontWeight: 700, color: '#c084fc' }}>
                      Polygon Acres: {props.totalPolygonAcres}
                    </div>
                  </div>
                </div>

                {/* Layer List */}
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#888' }}>
                  LAYERS ({props.featureCount})
                </div>
                {props.totalAcresByType.length === 0 ? (
                  <div style={{ color: '#888', fontSize: '12px', padding: '20px', textAlign: 'center' }}>
                    No layers drawn yet
                  </div>
                ) : (
                  props.totalAcresByType.map(({ type, totalAcres }) => (
                    <div key={type} style={{
                      padding: '10px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '6px',
                      marginBottom: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      fontWeight: 600
                    }}>
                      <span style={{ textTransform: 'uppercase' }}>{type}</span>
                      <span style={{ fontWeight: 900, color: '#4ade80' }}>{totalAcres} ac</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'tony' && (
              <div style={{ minHeight: '300px' }}>
                <TonyChat
                  ref={props.chatRef}
                  getCaptureTarget={props.getCaptureTarget}
                  getGeoJSON={props.getGeoJSON}
                  getLockedBordersGeoJSON={props.getLockedBordersGeoJSON}
                  getMapContext={props.getMapContext}
                  terrainInputs={props.terrainInputs}
                  onApiStatus={props.onApiStatus}
                  onSuggestedMarks={props.onSuggestedMarks}
                />
              </div>
            )}

            {activeTab === 'terrain' && (
              <TerrainPanel
                inputs={props.terrainInputs}
                onChange={props.onTerrainChange}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Memoize to prevent unnecessary re-renders
export const MobileDrawerMemo = React.memo(MobileDrawer)
