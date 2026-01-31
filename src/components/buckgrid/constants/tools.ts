
export type Tool = {
  id: string
  name: string
  color: string
  icon: string
  type?: string
  allowGlobal?: boolean
}

export const TOOLS: Tool[] = [
  { id: 'nav', name: 'PAN', color: '#e0e0e0', icon: '🤚', type: 'nav' },
  { id: 'boundary', name: 'BOUNDARY', color: '#FFEB3B', icon: '🟨', type: 'boundary' },
  { id: 'bedding', name: 'BEDDING', color: '#92400e', icon: '🟫', type: 'bedding' },
  { id: 'sanctuary', name: 'SANCTUARY', color: '#3b82f6', icon: '🔵', type: 'sanctuary' },
  { id: 'food', name: 'FOOD PLOT', color: '#22c55e', icon: '🟢', type: 'food' },
  { id: 'alfalfa', name: 'ALFALFA', color: '#14b8a6', icon: '🟦', type: 'crop_alfalfa' },
  { id: 'milo', name: 'MILO', color: '#ff6b35', icon: '🟠', type: 'crop_milo' },
  { id: 'corn', name: 'CORN', color: '#fbbf24', icon: '🟡', type: 'crop_corn' },
  { id: 'clover', name: 'CLOVER', color: '#86efac', icon: '🟩', type: 'crop_clover' },
  { id: 'focus', name: 'FOCUS', color: '#ef4444', icon: '🔴', type: 'focus', allowGlobal: true },
  // New Habitat tools
  { id: 'egyptian_wheat', name: 'EGYPTIAN WHEAT', color: '#b5a642', icon: '🌾', type: 'crop_egyptian_wheat' },
  { id: 'switchgrass', name: 'SWITCHGRASS', color: '#7bb661', icon: '🌱', type: 'crop_switchgrass' },
  // New Food tools
  { id: 'brassicas', name: 'BRASSICAS', color: '#6ee7b7', icon: '🥦', type: 'crop_brassicas' },
  { id: 'winter_wheat', name: 'WINTER WHEAT', color: '#f5e7b2', icon: '🌿', type: 'crop_winter_wheat' },
  { id: 'eraser', name: 'ERASER', color: '#ffffff', icon: '🧹', type: 'eraser' },
]
