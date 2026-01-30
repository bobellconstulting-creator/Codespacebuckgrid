
export type Tool = {
  id: string
  name: string
  color: string
  icon: string
  type?: string
  allowGlobal?: boolean
}

export const TOOLS: Tool[] = [
  { id: 'boundary', name: 'BOUNDARY', color: '#FFEB3B', icon: '🟨', type: 'boundary' },
  { id: 'bedding', name: 'BEDDING', color: '#92400e', icon: '🟫', type: 'bedding' },
  { id: 'sanctuary', name: 'SANCTUARY', color: '#3b82f6', icon: '🔵', type: 'sanctuary' },
  { id: 'food', name: 'FOOD PLOT', color: '#22c55e', icon: '🟢', type: 'food' },
  { id: 'alfalfa', name: 'ALFALFA', color: '#14b8a6', icon: '🟦', type: 'crop_alfalfa' },
  { id: 'milo', name: 'MILO', color: '#ff6b35', icon: '🟠', type: 'crop_milo' },
  { id: 'corn', name: 'CORN', color: '#fbbf24', icon: '🟡', type: 'crop_corn' },
  { id: 'clover', name: 'CLOVER', color: '#86efac', icon: '🟩', type: 'crop_clover' },
  { id: 'focus', name: 'FOCUS', color: '#ef4444', icon: '🔴', type: 'focus', allowGlobal: true },
  { id: 'eraser', name: 'ERASER', color: '#ffffff', icon: '🧹', type: 'eraser' },
]
