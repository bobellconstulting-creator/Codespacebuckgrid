'use client'

import { create } from 'zustand'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapboxMap = any

export type DrawnShape = {
  id: string
  toolId: string
  color: string
  coordinates: [number, number][]
  type: 'polygon' | 'polyline' | 'marker'
  acreage?: number
}

export type ConsultantCorrection = {
  id: string
  coordinates: [number, number][]
  label: string
}

export type FieldRecommendation = {
  shapeId: string
  toolId: string
  acreage: number
  seedLbs: number
  fertilizerLbs: number
  limeTons: number
}

type MapState = {
  map: MapboxMap | null
  isLocked: boolean
  propertyAcres: number
  boundaryCoords: [number, number][]
  boundaryGeoJSON: GeoJSON.FeatureCollection | null
  shapes: DrawnShape[]
  corrections: ConsultantCorrection[]
  undoStack: DrawnShape[][]
  activeTool: string
  brushSize: number
  showCorrections: boolean
  selectedShapeId: string | null
  fieldRecommendation: FieldRecommendation | null

  setMap: (map: MapboxMap | null) => void
  setLocked: (locked: boolean) => void
  setPropertyAcres: (acres: number) => void
  setBoundaryCoords: (coords: [number, number][]) => void
  setBoundaryGeoJSON: (geojson: GeoJSON.FeatureCollection | null) => void
  addShape: (shape: DrawnShape) => void
  removeShape: (id: string) => void
  undo: () => void
  clearShapes: () => void
  addCorrection: (c: ConsultantCorrection) => void
  clearCorrections: () => void
  setActiveTool: (tool: string) => void
  setBrushSize: (size: number) => void
  toggleCorrections: () => void
  setSelectedShape: (id: string | null) => void
  setFieldRecommendation: (rec: FieldRecommendation | null) => void
  wipeAll: () => void
}

const SEED_RATES: Record<string, { seedPerAcre: number; fertPerAcre: number; limePerAcre: number }> = {
  clover:      { seedPerAcre: 8,  fertPerAcre: 300, limePerAcre: 1.0 },
  brassicas:   { seedPerAcre: 5,  fertPerAcre: 250, limePerAcre: 0.5 },
  corn:        { seedPerAcre: 30, fertPerAcre: 400, limePerAcre: 1.0 },
  soybeans:    { seedPerAcre: 50, fertPerAcre: 200, limePerAcre: 0.5 },
  milo:        { seedPerAcre: 8,  fertPerAcre: 300, limePerAcre: 0.5 },
  egyptian:    { seedPerAcre: 25, fertPerAcre: 200, limePerAcre: 0.5 },
  switchgrass: { seedPerAcre: 6,  fertPerAcre: 150, limePerAcre: 0   },
  bedding:     { seedPerAcre: 0,  fertPerAcre: 0,   limePerAcre: 0   },
}

export function computeFieldRec(toolId: string, acreage: number): FieldRecommendation | null {
  const rate = SEED_RATES[toolId]
  if (!rate || rate.seedPerAcre === 0) return null
  return {
    shapeId: '',
    toolId,
    acreage,
    seedLbs: Math.round(rate.seedPerAcre * acreage),
    fertilizerLbs: Math.round(rate.fertPerAcre * acreage),
    limeTons: Number((rate.limePerAcre * acreage).toFixed(1)),
  }
}

export const useMapStore = create<MapState>((set) => ({
  map: null,
  isLocked: false,
  propertyAcres: 0,
  boundaryCoords: [],
  boundaryGeoJSON: null,
  shapes: [],
  corrections: [],
  undoStack: [],
  activeTool: 'nav',
  brushSize: 30,
  showCorrections: true,
  selectedShapeId: null,
  fieldRecommendation: null,

  setMap: (map) => set({ map }),
  setLocked: (isLocked) => set({ isLocked }),
  setPropertyAcres: (propertyAcres) => set({ propertyAcres }),
  setBoundaryCoords: (boundaryCoords) => set({ boundaryCoords }),
  setBoundaryGeoJSON: (boundaryGeoJSON) => set({ boundaryGeoJSON }),

  addShape: (shape) => set((s) => ({
    undoStack: [...s.undoStack, s.shapes],
    shapes: [...s.shapes, shape],
  })),

  removeShape: (id) => set((s) => ({
    undoStack: [...s.undoStack, s.shapes],
    shapes: s.shapes.filter((sh) => sh.id !== id),
  })),

  undo: () => set((s) => {
    if (s.undoStack.length === 0) return s
    const prev = s.undoStack[s.undoStack.length - 1]
    return { shapes: prev, undoStack: s.undoStack.slice(0, -1) }
  }),

  clearShapes: () => set((s) => ({
    undoStack: [...s.undoStack, s.shapes],
    shapes: [],
  })),

  addCorrection: (c) => set((s) => ({
    corrections: [...s.corrections, c],
  })),

  clearCorrections: () => set({ corrections: [] }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setBrushSize: (brushSize) => set({ brushSize }),
  toggleCorrections: () => set((s) => ({ showCorrections: !s.showCorrections })),
  setSelectedShape: (selectedShapeId) => set({ selectedShapeId }),
  setFieldRecommendation: (fieldRecommendation) => set({ fieldRecommendation }),

  wipeAll: () => set({
    shapes: [],
    corrections: [],
    undoStack: [],
    boundaryCoords: [],
    boundaryGeoJSON: null,
    propertyAcres: 0,
    isLocked: false,
    selectedShapeId: null,
    fieldRecommendation: null,
  }),
}))
