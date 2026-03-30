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

// Tool groupings — ids must match constants/tools.ts
const NAV_IDS = ['nav']
const BOUNDARY_IDS = ['boundary']
const FOOD_PLOT_IDS = ['clover', 'brassicas', 'corn', 'soybeans', 'milo', 'egyptian', 'switchgrass']
const STRUCTURE_IDS = ['bedding', 'stand', 'focus']

function SectionHeader({ label }: { label: string }) {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.sectionLabel}>{label}</span>
      <span className={styles.sectionLine} />
    </div>
  )
}

function ToolButton({ tool, isActive, onSelect }: { tool: Tool; isActive: boolean; onSelect: () => void }) {
  const activeStyle: React.CSSProperties = isActive
    ? {
        borderLeftColor: tool.color,
        borderColor: `${tool.color}40`,
        background: `${tool.color}22`,
        color: tool.color,
      }
    : {}

  const hoverProps = !isActive
    ? {
        onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
          e.currentTarget.style.borderLeftColor = `${tool.color}80`
          e.currentTarget.style.background = `${tool.color}0A`
        },
        onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
          e.currentTarget.style.borderLeftColor = 'transparent'
          e.currentTarget.style.background = '#0D0D0D'
        },
      }
    : {}

  return (
    <button
      className={`${styles.btnTool} ${isActive ? styles.btnToolActive : ''}`}
      style={activeStyle}
      onClick={onSelect}
      title={tool.name}
      {...hoverProps}
    >
      <span className={styles.toolIcon}>{tool.icon}</span>
      <span className={styles.toolName}>{tool.name}</span>
    </button>
  )
}

function ToolSection({
  label,
  tools,
  activeToolId,
  onSelectTool,
  fullWidth = false,
}: {
  label: string
  tools: Tool[]
  activeToolId: string
  onSelectTool: (t: Tool) => void
  fullWidth?: boolean
}) {
  if (tools.length === 0) return null
  return (
    <>
      <SectionHeader label={label} />
      <div className={fullWidth ? styles.gridToolsFull : styles.gridTools}>
        {tools.map(t => (
          <ToolButton
            key={t.id}
            tool={t}
            isActive={activeToolId === t.id}
            onSelect={() => onSelectTool(t)}
          />
        ))}
      </div>
    </>
  )
}

function ToolGrid({ tools, activeToolId, brushSize, onSelectTool, onBrushSize, onLockBorder, onWipeAll }: Props) {
  const byId = (ids: string[]) => tools.filter(t => ids.includes(t.id))

  const navTools = byId(NAV_IDS)
  const boundaryTools = byId(BOUNDARY_IDS)
  const foodPlotTools = byId(FOOD_PLOT_IDS)
  const structureTools = byId(STRUCTURE_IDS)

  return (
    <div className={styles.panel}>
      <ToolSection label="Navigation" tools={navTools} activeToolId={activeToolId} onSelectTool={onSelectTool} fullWidth />
      <ToolSection label="Boundary" tools={boundaryTools} activeToolId={activeToolId} onSelectTool={onSelectTool} fullWidth />
      <ToolSection label="Food Plots" tools={foodPlotTools} activeToolId={activeToolId} onSelectTool={onSelectTool} />
      <ToolSection label="Structure" tools={structureTools} activeToolId={activeToolId} onSelectTool={onSelectTool} />

      <div className={styles.brushControl}>
        <div className={styles.brushLabel}>
          <span className={styles.brushLabelText}>Brush Size</span>
          <span className={styles.brushLabelValue}>{brushSize}px</span>
        </div>
        <input
          type="range"
          min={10}
          max={150}
          value={brushSize}
          onChange={e => onBrushSize(Number(e.target.value))}
          className={styles.brushSlider}
        />
      </div>

      <div className={styles.actionArea}>
        <button className={styles.btnLock} onClick={onLockBorder}>
          Lock Border
        </button>
        <button className={styles.btnWipe} onClick={onWipeAll}>
          Wipe All
        </button>
      </div>
    </div>
  )
}

export default React.memo(ToolGrid)
