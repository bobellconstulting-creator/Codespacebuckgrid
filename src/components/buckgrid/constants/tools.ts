
export type Tool = {
  id: string
  name: string
  color: string
  icon: string
  layerType: 'polygon' | 'line' | 'point'
  category: 'nav' | 'boundary' | 'food_plot' | 'structure' | 'zone'
}

export const TOOLS: Tool[] = [
  { id: 'nav', name: 'PAN', color: '#fff', icon: '✋', layerType: 'point', category: 'nav' },
  { id: 'boundary', name: 'BORDER', color: '#FF6B00', icon: '🟧', layerType: 'polygon', category: 'boundary' },
  { id: 'food_plot_clover', name: 'CLOVER', color: '#4ade80', icon: '🍀', layerType: 'polygon', category: 'food_plot' },
  { id: 'food_plot_brassicas', name: 'BRASSICAS', color: '#c084fc', icon: '🥬', layerType: 'polygon', category: 'food_plot' },
  { id: 'food_plot_corn', name: 'CORN', color: '#facc15', icon: '🌽', layerType: 'polygon', category: 'food_plot' },
  { id: 'food_plot_soybeans', name: 'SOYBEANS', color: '#86efac', icon: '🫘', layerType: 'polygon', category: 'food_plot' },
  { id: 'food_plot_milo', name: 'MILO', color: '#d97706', icon: '🌰', layerType: 'polygon', category: 'food_plot' },
  { id: 'screen_egyptian', name: 'EGYPTIAN', color: '#fb923c', icon: '🌾', layerType: 'polygon', category: 'structure' },
  { id: 'screen_switchgrass', name: 'SWITCHGRASS', color: '#fdba74', icon: '🌾', layerType: 'polygon', category: 'structure' },
  { id: 'screen_miscanthus', name: 'MISCANTHUS', color: '#f97316', icon: '🌾', layerType: 'polygon', category: 'structure' },
  { id: 'bedding', name: 'BEDDING', color: '#713f12', icon: '🛏️', layerType: 'polygon', category: 'zone' },
  { id: 'stand', name: 'STAND', color: '#ef4444', icon: '🏹', layerType: 'point', category: 'structure' },
  { id: 'pinch_point', name: 'PINCH', color: '#ec4899', icon: '🎯', layerType: 'polygon', category: 'zone' },
  { id: 'screen', name: 'SCREEN', color: '#059669', icon: '🌲', layerType: 'polygon', category: 'structure' },
  { id: 'access_trail', name: 'TRAIL', color: '#78716c', icon: '🥾', layerType: 'line', category: 'structure' },
  { id: 'pressure_zone', name: 'PRESSURE', color: '#dc2626', icon: '⚠️', layerType: 'polygon', category: 'zone' },
  { id: 'conversation_zone', name: 'BLUE NOTE', color: '#007AFF', icon: '💬', layerType: 'polygon', category: 'zone' },
]
