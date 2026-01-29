'use client'

import React from 'react'
import type { Tool } from '../constants/tools'
import styles from './toolgrid.module.css'

type Props = {
  tools: Tool[]
  activeToolId: string
  brushSize: number
  onSelectTool: (t: Tool) => void
  onBrushSize: (n: number) => void
  onLockBorder: () => void
  onWipeAll: () => void
}

function ToolGrid({ tools, activeToolId, brushSize, onSelectTool, onBrushSize, onLockBorder, onWipeAll }: Props) {
  return (
    <>
      <div className={styles.gridTools}>
        {tools.map(t => (
          <button
            key={t.id}
            className={`${styles.btnTool} ${activeToolId === t.id ? styles.btnToolActive : ''}`}
            onClick={() => onSelectTool(t)}
          >
            <span>{t.icon}</span>
            <span>{t.name}</span>
          </button>
        ))}
      </div>

      {/* Brush size */}
      <div style={{ margin: '8px 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: 2, color: 'var(--gold-dark)', fontWeight: 600 }}>BRUSH</span>
        <input
          type="range"
          min={10}
          max={150}
          value={brushSize}
          onChange={e => onBrushSize(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--gold)' }}
        />
      </div>

      <div className="dividerGold" />

      {/* Lock Border — primary action */}
      <button className="btnAction" onClick={onLockBorder}>
        Lock Border
      </button>

      {/* Wipe */}
      <button
        onClick={onWipeAll}
        style={{
          width: '100%',
          color: 'var(--gold-dark)',
          background: 'none',
          border: 'none',
          padding: 8,
          cursor: 'pointer',
          fontSize: 10,
          letterSpacing: 2,
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--gold-dark)')}
      >
        WIPE ALL
      </button>
    </>
  )
}

export default React.memo(ToolGrid)
