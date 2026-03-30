
export type Tool = {
  id: string
  name: string
  color: string
  icon: string
}

export const TOOLS: Tool[] = [
  { id: 'nav', name: 'Navigate', color: '#fff', icon: '✋' },
  { id: 'boundary', name: 'Boundary', color: '#FF6B00', icon: '🟧' },
  { id: 'clover', name: 'Clover Plot', color: '#4ade80', icon: '🍀' },
  { id: 'brassicas', name: 'Brassicas', color: '#c084fc', icon: '🥬' },
  { id: 'corn', name: 'Corn Plot', color: '#facc15', icon: '🌽' },
  { id: 'soybeans', name: 'Soybeans', color: '#86efac', icon: '🫘' },
  { id: 'milo', name: 'Milo Plot', color: '#d97706', icon: '🌰' },
  { id: 'egyptian', name: 'E. Wheat', color: '#fb923c', icon: '🌾' },
  { id: 'switchgrass', name: 'Switchgrass', color: '#fdba74', icon: '🌾' },
  { id: 'bedding', name: 'Bedding Area', color: '#713f12', icon: '🪵' },
  { id: 'stand', name: 'Stand Location', color: '#ef4444', icon: '🏹' },
  { id: 'focus', name: 'Pinch Point', color: '#FF0000', icon: '⭕' },
]
