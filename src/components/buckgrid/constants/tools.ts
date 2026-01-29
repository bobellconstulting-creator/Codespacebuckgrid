
export type Tool = {
  id: string
  name: string
  color: string
  icon: string
}

export const TOOLS: Tool[] = [
  { id: 'nav',         name: 'PAN',           color: '#ffffff', icon: '✋' },
  { id: 'boundary',    name: 'BOUNDARY',      color: '#facc15', icon: '🟨' },
  { id: 'bedding',     name: 'BEDDING',       color: '#92400e', icon: '🛏️' },
  { id: 'sanctuary',   name: 'SANCTUARY',     color: '#3b82f6', icon: '🔵' },
  { id: 'foodplot',    name: 'FOOD PLOT',     color: '#22c55e', icon: '🌱' },
  { id: 'egyptian',    name: 'EGYPTIAN WHEAT', color: '#f97316', icon: '🌾' },
  { id: 'switchgrass', name: 'SWITCHGRASS',   color: '#d2b48c', icon: '🌿' },
  { id: 'brassicas',   name: 'BRASSICAS',     color: '#166534', icon: '🥬' },
  { id: 'alfalfa',     name: 'ALFALFA',       color: '#14b8a6', icon: '🌿' },
  { id: 'clover',      name: 'CLOVER',        color: '#4ade80', icon: '🍀' },
  { id: 'corn',        name: 'CORN',          color: '#facc15', icon: '🌽' },
  { id: 'milo',        name: 'MILO',          color: '#ef4444', icon: '🌰' },
  { id: 'wheat',       name: 'WHEAT',         color: '#ca8a04', icon: '🌾' },
  { id: 'focus',       name: 'FOCUS',         color: '#FF0000', icon: '⭕' },
  { id: 'eraser',      name: 'ERASER',        color: '#ffffff', icon: '🧹' },
]
