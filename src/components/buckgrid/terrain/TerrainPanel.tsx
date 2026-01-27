'use client'

import React, { useState } from 'react'

export type TerrainInputs = {
  terrainNotes: string
  hasRidges: boolean
  hasValleys: boolean
  hasCreeks: boolean
  hasSaddles: boolean
  hasBenches: boolean
  thermals: 'morning-up' | 'evening-down' | 'both' | 'unknown'
  coverType: 'timber' | 'cedar' | 'crp' | 'crop' | 'mixed'
  elevation: 'flat' | 'rolling' | 'steep'
  seasonPhase: 'pre-rut' | 'rut' | 'post-rut' | 'summer' | 'late-season'
  predominantWind: string
  accessPoints: string
  pressureConcerns: string
  neighborsFood: string
  goals: string
}

type Props = {
  inputs: TerrainInputs
  onChange: (inputs: TerrainInputs) => void
  onAnalyzeTerrain?: () => void
}

export default function TerrainPanel({ inputs, onChange, onAnalyzeTerrain }: Props) {
  const [expanded, setExpanded] = useState(false)

  const update = (partial: Partial<TerrainInputs>) => {
    onChange({ ...inputs, ...partial })
  }

  return (
    <div className="glass" style={{ 
      position: 'absolute', 
      left: '50%',
      transform: 'translateX(-50%)',
      bottom: 10, 
      padding: 12, 
      borderRadius: 12, 
      width: 320, 
      maxWidth: 'calc(100vw - 20px)',
      maxHeight: expanded ? 'calc(100vh - 40px)' : '50px', 
      overflow: expanded ? 'auto' : 'hidden', 
      transition: 'max-height 0.3s, opacity 0.2s',
      pointerEvents: expanded ? 'auto' : 'none',
      zIndex: 2000,
      WebkitOverflowScrolling: 'touch'
    }}>
      <div 
        onClick={() => setExpanded(!expanded)} 
        style={{ 
          cursor: 'pointer', 
          fontWeight: 900, 
          fontSize: 11, 
          color: '#4ade80', 
          marginBottom: expanded ? 12 : 0,
          padding: '8px 0',
          minHeight: '30px',
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'auto'
        }}
      >
        {expanded ? '▼' : '▶'} TERRAIN & CONTEXT
      </div>
      
      {expanded && (
        <div style={{ fontSize: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, color: '#888', fontSize: '10px' }}>Season Phase</label>
            <select value={inputs.seasonPhase} onChange={e => update({ seasonPhase: e.target.value as any })} style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px 8px', borderRadius: 4, fontSize: '14px', minHeight: '40px' }}>
              <option value="summer">Summer</option>
              <option value="pre-rut">Pre-Rut</option>
              <option value="rut">Rut</option>
              <option value="post-rut">Post-Rut</option>
              <option value="late-season">Late Season</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, color: '#888', fontSize: '10px' }}>Cover Type</label>
            <select value={inputs.coverType} onChange={e => update({ coverType: e.target.value as any })} style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px 8px', borderRadius: 4, fontSize: '14px', minHeight: '40px' }}>
              <option value="timber">Timber</option>
              <option value="cedar">Cedar</option>
              <option value="crp">CRP</option>
              <option value="crop">Crop Fields</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, color: '#888', fontSize: '10px' }}>Elevation</label>
            <select value={inputs.elevation} onChange={e => update({ elevation: e.target.value as any })} style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px 8px', borderRadius: 4, fontSize: '14px', minHeight: '40px' }}>
              <option value="flat">Flat</option>
              <option value="rolling">Rolling</option>
              <option value="steep">Steep</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 4, color: '#888' }}>Terrain Features</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 0', minHeight: '32px' }}>
                <input type="checkbox" checked={inputs.hasRidges} onChange={e => update({ hasRidges: e.target.checked })} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <span style={{ userSelect: 'none' }}>Ridges</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 0', minHeight: '32px' }}>
                <input type="checkbox" checked={inputs.hasValleys} onChange={e => update({ hasValleys: e.target.checked })} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <span style={{ userSelect: 'none' }}>Valleys</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 0', minHeight: '32px' }}>
                <input type="checkbox" checked={inputs.hasCreeks} onChange={e => update({ hasCreeks: e.target.checked })} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <span style={{ userSelect: 'none' }}>Creeks</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 0', minHeight: '32px' }}>
                <input type="checkbox" checked={inputs.hasSaddles} onChange={e => update({ hasSaddles: e.target.checked })} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <span style={{ userSelect: 'none' }}>Saddles</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 0', minHeight: '32px' }}>
                <input type="checkbox" checked={inputs.hasBenches} onChange={e => update({ hasBenches: e.target.checked })} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <span style={{ userSelect: 'none' }}>Benches</span>
              </label>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, color: '#888', fontSize: '10px' }}>Thermals</label>
            <select value={inputs.thermals} onChange={e => update({ thermals: e.target.value as any })} style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px 8px', borderRadius: 4, fontSize: '14px', minHeight: '40px' }}>
              <option value="unknown">Unknown</option>
              <option value="morning-up">Morning Up</option>
              <option value="evening-down">Evening Down</option>
              <option value="both">Both</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, color: '#888', fontSize: '10px' }}>Predominant Wind</label>
            <input type="text" value={inputs.predominantWind} onChange={e => update({ predominantWind: e.target.value })} placeholder="e.g., SW" style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px 8px', borderRadius: 4, fontSize: '14px', minHeight: '40px' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, color: '#888', fontSize: '10px' }}>Access Points</label>
            <input type="text" value={inputs.accessPoints} onChange={e => update({ accessPoints: e.target.value })} placeholder="e.g., North trail" style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px 8px', borderRadius: 4, fontSize: '14px', minHeight: '40px' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, color: '#888', fontSize: '10px' }}>Pressure Concerns</label>
            <input type="text" value={inputs.pressureConcerns} onChange={e => update({ pressureConcerns: e.target.value })} placeholder="e.g., road noise" style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px 8px', borderRadius: 4, fontSize: '14px', minHeight: '40px' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, color: '#888', fontSize: '10px' }}>Neighbors' Food</label>
            <input type="text" value={inputs.neighborsFood} onChange={e => update({ neighborsFood: e.target.value })} placeholder="e.g., corn, soybeans" style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px 8px', borderRadius: 4, fontSize: '14px', minHeight: '40px' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, color: '#888', fontSize: '10px' }}>Goals</label>
            <textarea value={inputs.goals} onChange={e => update({ goals: e.target.value })} placeholder="e.g., kill mature buck, low pressure" style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px 8px', borderRadius: 4, minHeight: 60, resize: 'vertical', fontSize: '14px' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, color: '#888', fontSize: '10px' }}>Terrain Notes</label>
            <textarea value={inputs.terrainNotes} onChange={e => update({ terrainNotes: e.target.value })} placeholder="Additional terrain details..." style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px 8px', borderRadius: 4, minHeight: 60, resize: 'vertical', fontSize: '14px' }} />
          </div>

          {/* TASK 4: Analyze Terrain Button */}
          <button
            onClick={() => {
              if (onAnalyzeTerrain) {
                onAnalyzeTerrain()
                setExpanded(false)
              }
            }}
            style={{
              width: '100%',
              background: '#4ade80',
              color: '#000',
              border: 'none',
              padding: '14px',
              borderRadius: 8,
              fontWeight: 900,
              fontSize: 12,
              cursor: 'pointer',
              marginTop: 12,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#22c55e'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#4ade80'}
          >
            🌄 ANALYZE TERRAIN
          </button>
        </div>
      )}
    </div>
  )
}
