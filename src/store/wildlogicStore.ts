import { create } from 'zustand'

// GeoJSON types
interface GeoJSONGeometryPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

interface GeoJSONFeaturePolygon {
  type: 'Feature'
  geometry: GeoJSONGeometryPolygon
  properties: Record<string, unknown> | null
}

// ─── Domain interfaces ────────────────────────────────────────────────────────

export interface TonyZone {
  id: string
  name: string
  type:
    | 'food_plot'
    | 'kill_plot'
    | 'access_route'
    | 'bedding'
    | 'stand_site'
    | 'water'
    | 'staging_area'
    | 'sanctuary'
  relative_position:
    | 'north'
    | 'northeast'
    | 'east'
    | 'southeast'
    | 'south'
    | 'southwest'
    | 'west'
    | 'northwest'
    | 'center'
  relative_size: 'tiny' | 'small' | 'medium' | 'large'
  description: string
  confidence: 'high' | 'medium' | 'low'
  season: 'all' | 'spring' | 'summer' | 'fall' | 'winter'
  /** Which Tony message triggered this zone */
  messageId: string
  /** Computed GeoJSON after property boundary is known */
  geoJSON: GeoJSONFeaturePolygon | null
}

export interface ChatMessage {
  id: string
  role: 'tony' | 'user'
  text: string
  /** Which TonyZone ids this message created */
  tonyZoneIds: string[]
}

// ─── Slice state interfaces ───────────────────────────────────────────────────

export interface PropertyState {
  boundary: GeoJSONFeaturePolygon | null
  acres: number
  name: string
  /** Supabase property id once saved */
  id: string | null
}

export interface MapState {
  activeTool:
    | 'nav'
    | 'boundary'
    | 'food_plot'
    | 'bedding'
    | 'stand'
    | 'trail'
    | 'water'
    | 'mineral'
  brushSize: number
  isDrawing: boolean
  tonyZones: TonyZone[]
  userFeatures: GeoJSONFeaturePolygon[]
}

export interface UIState {
  showOnboarding: boolean
  isMobile: boolean
  tonyPanelOpen: boolean
  isAnalyzing: boolean
  season: 'Spring' | 'Summer' | 'Early Fall' | 'Rut' | 'Late Season'
  paywallHit: boolean
  /** Active tab for mobile bottom nav */
  activeTab: 'map' | 'tony' | 'tools' | 'property'
}

export interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  lastUserMessage: string | null
}

// ─── Slice action interfaces ──────────────────────────────────────────────────

interface PropertyActions {
  setPropertyBoundary: (boundary: GeoJSONFeaturePolygon | null) => void
  setPropertyAcres: (acres: number) => void
  setPropertyName: (name: string) => void
  setPropertyId: (id: string | null) => void
  resetProperty: () => void
}

interface MapActions {
  setActiveTool: (tool: MapState['activeTool']) => void
  setBrushSize: (size: number) => void
  setIsDrawing: (isDrawing: boolean) => void
  addTonyZone: (zone: TonyZone) => void
  updateTonyZone: (id: string, updates: Partial<TonyZone>) => void
  removeTonyZone: (id: string) => void
  setTonyZones: (zones: TonyZone[]) => void
  clearTonyZones: () => void
  addUserFeature: (feature: GeoJSONFeaturePolygon) => void
  removeUserFeature: (index: number) => void
  clearUserFeatures: () => void
}

interface UIActions {
  setShowOnboarding: (show: boolean) => void
  setIsMobile: (isMobile: boolean) => void
  setTonyPanelOpen: (open: boolean) => void
  toggleTonyPanel: () => void
  setIsAnalyzing: (analyzing: boolean) => void
  setSeason: (season: UIState['season']) => void
  setPaywallHit: (hit: boolean) => void
  setActiveTab: (tab: UIState['activeTab']) => void
}

interface ChatActions {
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  removeMessage: (id: string) => void
  setMessages: (messages: ChatMessage[]) => void
  clearMessages: () => void
  setIsLoading: (loading: boolean) => void
  setLastUserMessage: (message: string | null) => void
}

// ─── Combined store type ──────────────────────────────────────────────────────

export type WildLogicStore = PropertyState &
  PropertyActions &
  MapState &
  MapActions &
  UIState &
  UIActions &
  ChatState &
  ChatActions

// ─── Initial state values ─────────────────────────────────────────────────────

const initialPropertyState: PropertyState = {
  boundary: null,
  acres: 0,
  name: '',
  id: null,
}

const initialMapState: MapState = {
  activeTool: 'nav',
  brushSize: 20,
  isDrawing: false,
  tonyZones: [],
  userFeatures: [],
}

const initialUIState: UIState = {
  showOnboarding: true,
  isMobile: false,
  tonyPanelOpen: false,
  isAnalyzing: false,
  season: 'Early Fall',
  paywallHit: false,
  activeTab: 'map',
}

const initialChatState: ChatState = {
  messages: [],
  isLoading: false,
  lastUserMessage: null,
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWildLogicStore = create<WildLogicStore>((set) => ({
  // ── Property state ──────────────────────────────────────────────────────────
  ...initialPropertyState,

  setPropertyBoundary: (boundary) => set({ boundary }),
  setPropertyAcres: (acres) => set({ acres }),
  setPropertyName: (name) => set({ name }),
  setPropertyId: (id) => set({ id }),
  resetProperty: () => set({ ...initialPropertyState }),

  // ── Map state ───────────────────────────────────────────────────────────────
  ...initialMapState,

  setActiveTool: (activeTool) => set({ activeTool }),
  setBrushSize: (brushSize) => set({ brushSize }),
  setIsDrawing: (isDrawing) => set({ isDrawing }),

  addTonyZone: (zone) =>
    set((state) => ({ tonyZones: [...state.tonyZones, zone] })),

  updateTonyZone: (id, updates) =>
    set((state) => ({
      tonyZones: state.tonyZones.map((z) =>
        z.id === id ? { ...z, ...updates } : z
      ),
    })),

  removeTonyZone: (id) =>
    set((state) => ({
      tonyZones: state.tonyZones.filter((z) => z.id !== id),
    })),

  setTonyZones: (tonyZones) => set({ tonyZones }),
  clearTonyZones: () => set({ tonyZones: [] }),

  addUserFeature: (feature) =>
    set((state) => ({ userFeatures: [...state.userFeatures, feature] })),

  removeUserFeature: (index) =>
    set((state) => ({
      userFeatures: state.userFeatures.filter((_, i) => i !== index),
    })),

  clearUserFeatures: () => set({ userFeatures: [] }),

  // ── UI state ────────────────────────────────────────────────────────────────
  ...initialUIState,

  setShowOnboarding: (showOnboarding) => set({ showOnboarding }),
  setIsMobile: (isMobile) => set({ isMobile }),
  setTonyPanelOpen: (tonyPanelOpen) => set({ tonyPanelOpen }),
  toggleTonyPanel: () =>
    set((state) => ({ tonyPanelOpen: !state.tonyPanelOpen })),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setSeason: (season) => set({ season }),
  setPaywallHit: (paywallHit) => set({ paywallHit }),
  setActiveTab: (activeTab) => set({ activeTab }),

  // ── Chat state ──────────────────────────────────────────────────────────────
  ...initialChatState,

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),

  removeMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    })),

  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [] }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setLastUserMessage: (lastUserMessage) => set({ lastUserMessage }),
}))
