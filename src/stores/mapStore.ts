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

type MapState = {
  map: MapboxMap | null
  isLocked: boolean
  propertyAcres: number
  boundaryCoords: [number, number][]
  shapes: DrawnShape[]
  corrections: ConsultantCorrection[]
  undoStack: DrawnShape[][]
  activeTool: string
  brushSize: number

  setMap: (map: MapboxMap | null) => void
  setLocked: (locked: boolean) => void
  setPropertyAcres: (acres: number) => void
  setBoundaryCoords: (coords: [number, number][]) => void
  addShape: (shape: DrawnShape) => void
  removeShape: (id: string) => void
  undo: () => void
  clearShapes: () => void
  addCorrection: (c: ConsultantCorrection) => void
  clearCorrections: () => void
  setActiveTool: (tool: string) => void
  setBrushSize: (size: number) => void
  wipeAll: () => void
}

export const useMapStore = create<MapState>((set, get) => ({
  map: null,
  isLocked: false,
  propertyAcres: 0,
  boundaryCoords: [],
  shapes: [],
  corrections: [],
  undoStack: [],
  activeTool: 'nav',
  brushSize: 30,

  setMap: (map) => set({ map }),
  setLocked: (isLocked) => set({ isLocked }),
  setPropertyAcres: (propertyAcres) => set({ propertyAcres }),
  setBoundaryCoords: (boundaryCoords) => set({ boundaryCoords }),

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

  wipeAll: () => set({
    shapes: [],
    corrections: [],
    undoStack: [],
    boundaryCoords: [],
    propertyAcres: 0,
    isLocked: false,
  }),
}))
