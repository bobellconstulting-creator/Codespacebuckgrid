export type ToolCategory = 'nav' | 'boundary' | 'forage' | 'manipulation' | 'structure' | 'consultant'

export type Tool = {
  id: string
  name: string
  color: string
  icon: string
  category: ToolCategory
  drawType: 'none' | 'polygon' | 'polyline' | 'marker'
}

export const TOOLS: Tool[] = [
  // Navigation
  { id: 'nav', name: 'PAN', color: '#ffffff', icon: '✋', category: 'nav', drawType: 'none' },

  // Boundary
  { id: 'boundary', name: 'BORDER', color: '#FF6B00', icon: '🟧', category: 'boundary', drawType: 'polygon' },

  // Forage Plots
  { id: 'clover', name: 'CLOVER', color: '#2D5A1E', icon: '🍀', category: 'forage', drawType: 'polygon' },
  { id: 'brassicas', name: 'BRASSICAS', color: '#7C3AED', icon: '🥬', category: 'forage', drawType: 'polygon' },
  { id: 'corn', name: 'CORN', color: '#D4A017', icon: '🌽', category: 'forage', drawType: 'polygon' },
  { id: 'soybeans', name: 'SOYBEANS', color: '#3B7A1E', icon: '🫘', category: 'forage', drawType: 'polygon' },
  { id: 'milo', name: 'MILO', color: '#B45309', icon: '🌰', category: 'forage', drawType: 'polygon' },
  { id: 'egyptian', name: 'EGYPTIAN', color: '#C2710C', icon: '🌾', category: 'forage', drawType: 'polygon' },

  // Manipulation
  { id: 'switchgrass', name: 'SWITCH', color: '#8B6914', icon: '🌾', category: 'manipulation', drawType: 'polygon' },
  { id: 'bedding', name: 'HINGE CUT', color: '#4A2C0A', icon: '🪚', category: 'manipulation', drawType: 'polygon' },
  { id: 'trail', name: 'ACCESS', color: '#6B7280', icon: '🥾', category: 'manipulation', drawType: 'polyline' },

  // Structure
  { id: 'stand', name: 'STAND', color: '#DC2626', icon: '🏹', category: 'structure', drawType: 'marker' },
  { id: 'camera', name: 'CAMERA', color: '#1D4ED8', icon: '📷', category: 'structure', drawType: 'marker' },
  { id: 'focus', name: 'FOCUS', color: '#FF0000', icon: '⭕', category: 'structure', drawType: 'marker' },

  // Consultant
  { id: 'correction', name: 'CORRECT', color: '#FF0000', icon: '✏️', category: 'consultant', drawType: 'polyline' },
]

export const TOOL_CATEGORIES: { key: ToolCategory; label: string }[] = [
  { key: 'forage', label: 'FORAGE PLOTS' },
  { key: 'manipulation', label: 'HABITAT' },
  { key: 'structure', label: 'STRUCTURE' },
  { key: 'consultant', label: 'CONSULTANT' },
]
