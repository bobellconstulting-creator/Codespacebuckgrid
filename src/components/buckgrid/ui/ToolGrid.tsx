'use client'

import React from 'react'
import type { Tool } from '../constants/tools'
import styles from './toolgrid.module.css'

type Props = { tools: Tool[], activeToolId: string, brushSize: number, isDrawMode: boolean, onToggleDrawMode: () => void, onSelectTool: (t: Tool) => void, onBrushSize: (n: number) => void, onLockBorder: () => void, onFitToBorder: () => void, onDeleteSelected: () => void, onUndo: () => void, onWipeAll: () => void, onAssessProperty: () => void }

function ToolGrid({ tools, activeToolId, brushSize, isDrawMode, onToggleDrawMode, onSelectTool, onBrushSize, onLockBorder, onFitToBorder, onDeleteSelected, onUndo, onWipeAll, onAssessProperty }: Props) {
  return (
    <>
      <button onClick={onToggleDrawMode} style={{ width: '100%', background: isDrawMode ? '#4ade80' : '#666', color: '#000', padding: 10, borderRadius: 8, fontWeight: 900, cursor: 'pointer', marginBottom: 8, border: 'none' }}>
        {isDrawMode ? '✏️ DRAW MODE' : '✋ PAN MODE'}
      </button>
      <div className={styles.gridTools}>
        {tools.map(t => (
          <button key={t.id} className={`${styles.btnTool} ${activeToolId === t.id ? styles.btnToolActive : ''}`} onClick={() => onSelectTool(t)}>
            <span>{t.icon}</span> <span>{t.name}</span>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 10, color: '#FF6B00', marginBottom: 4, fontWeight: 700 }}>BRUSH WIDTH: {brushSize}px</div>
      <input type="range" min={2} max={50} value={brushSize} onChange={e => onBrushSize(Number(e.target.value))} style={{ width: '100%', height: '24px', accentColor: '#FF6B00', marginBottom: 8, cursor: 'pointer' }} />
      <button onClick={onLockBorder} style={{ width: '100%', background: '#FF6B00', color: '#000', padding: 12, borderRadius: 8, fontWeight: 900, cursor: 'pointer', marginBottom: 4 }}>LOCK BORDER</button>
      <button onClick={onFitToBorder} style={{ width: '100%', background: '#3b82f6', color: '#fff', padding: 10, borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 10, marginBottom: 4 }}>FIT TO BORDER</button>
      <button onClick={onDeleteSelected} style={{ width: '100%', background: '#dc2626', color: '#fff', padding: 10, borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 10, marginBottom: 4 }}>DELETE SELECTED</button>
      <button onClick={onUndo} style={{ width: '100%', background: '#f59e0b', color: '#000', padding: 10, borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 10, marginBottom: 4 }}>⟲ UNDO</button>
      <button onClick={onAssessProperty} style={{ width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', padding: 12, borderRadius: 8, fontWeight: 900, cursor: 'pointer', fontSize: 11, marginBottom: 4, border: 'none', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)' }}>🎯 ASSESS PROPERTY</button>
      <button onClick={onWipeAll} style={{ width: '100%', color: '#555', background: 'none', border: 'none', padding: 8, cursor: 'pointer' }}>WIPE ALL</button>
    </>
  )
}

export default React.memo(ToolGrid)
