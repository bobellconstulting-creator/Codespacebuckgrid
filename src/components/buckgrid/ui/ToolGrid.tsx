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
      <input type="range" min={10} max={150} value={brushSize} onChange={e => onBrushSize(Number(e.target.value))} className="w-full accent-neural-noir-accent" />
      <button onClick={onLockBorder} className="w-full bg-neural-noir-accent text-neural-noir-primary py-3 px-2 rounded-neural font-bold cursor-pointer hover:bg-neural-noir-highlight transition-colors">LOCK BORDER</button>
      <button onClick={onWipeAll} className="w-full text-neural-noir-text bg-transparent border-none p-2 cursor-pointer hover:text-neural-noir-accent transition-colors">WIPE ALL</button>
    </>
  )
}

export default React.memo(ToolGrid)
