'use client'

import React from 'react'
import type { Tool } from '../constants/tools'
import styles from './toolgrid.module.css'

type Props = { tools: Tool[], activeToolId: string, brushSize: number, onSelectTool: (t: Tool) => void, onBrushSize: (n: number) => void, onLockBorder: () => void, onWipeAll: () => void }

function ToolGrid({ tools, activeToolId, brushSize, onSelectTool, onBrushSize, onLockBorder, onWipeAll }: Props) {
  return (
    <>
      <div className={styles.gridTools}>
        {tools.map(t => (
          <button key={t.id} className={`${styles.btnTool} ${activeToolId === t.id ? styles.btnToolActive : ''}`} onClick={() => onSelectTool(t)}>
            <span>{t.icon}</span> <span>{t.name}</span>
          </button>
        ))}
      </div>
      <input type="range" min={1} max={45} step={1} value={brushSize} onChange={e => onBrushSize(Number(e.target.value))} style={{ width: '100%', accentColor: '#FF6B00' }} />
      <button onClick={onLockBorder} style={{ width: '100%', background: '#FF6B00', color: '#000', padding: 12, borderRadius: 8, fontWeight: 900, cursor: 'pointer' }}>LOCK BORDER</button>
      <button onClick={onWipeAll} style={{ width: '100%', color: '#555', background: 'none', border: 'none', padding: 8, cursor: 'pointer' }}>WIPE ALL</button>
    </>
  )
}

export default React.memo(ToolGrid)
