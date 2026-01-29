'use client'

import React from 'react'
import type { Tool } from '../constants/tools'
import styles from './toolgrid.module.css'

type Props = { tools: Tool[], activeToolId: string, brushSize: number, onSelectTool: (t: Tool) => void, onBrushSize: (n: number) => void, onLockBorder: () => void, onWipeAll: () => void }

function ToolGrid({ tools, activeToolId, brushSize, onSelectTool, onBrushSize, onLockBorder, onWipeAll }: Props) {
  return (
    <div className={styles.dockWrap}>
      <div className={styles.dockRow}>
        {tools.map(t => (
          <button key={t.id} className={`${styles.dockBtn} ${activeToolId === t.id ? styles.dockBtnActive : ''}`} onClick={() => onSelectTool(t)} title={t.name}>
            <span className={styles.dockIcon}>{t.icon}</span>
          </button>
        ))}
        <div className={styles.dockDivider} />
        <input type="range" min={1} max={45} step={1} value={brushSize} onChange={e => onBrushSize(Number(e.target.value))} className={styles.dockSlider} title={`Brush: ${brushSize}`} />
        <div className={styles.dockDivider} />
        <button onClick={onLockBorder} className={styles.dockLock}>LOCK</button>
        <button onClick={onWipeAll} className={styles.dockWipe}>✕</button>
      </div>
    </div>
  )
}

export default React.memo(ToolGrid)
