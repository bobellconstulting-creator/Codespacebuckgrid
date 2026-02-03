'use client'

import { create } from 'zustand'
import type { H3Index } from 'h3-js'
import type { HabitatState, CellData } from '@/types/grid'

interface GridStore extends HabitatState {
  // Actions
  updateCell: (index: H3Index, data: Partial<CellData>) => void
  setGrid: (grid: Record<H3Index, CellData>) => void
  setProject: (project: Partial<HabitatState['project']>) => void
  reset: () => void
}

const initialState: HabitatState = {
  project: {
    bounds: [],
    baseResolution: 10,
    totalAcres: 0,
  },
  grid: {},
}

export const useGridStore = create<GridStore>((set) => ({
  ...initialState,

  // Update a single cell in the Hot Store
  updateCell: (index: H3Index, data: Partial<CellData>) =>
    set((state) => ({
      grid: {
        ...state.grid,
        [index]: {
          ...state.grid[index],
          ...data,
        },
      },
    })),

  // Replace entire grid (useful for initial load or reset)
  setGrid: (grid: Record<H3Index, CellData>) =>
    set({ grid }),

  // Update project metadata
  setProject: (project: Partial<HabitatState['project']>) =>
    set((state) => ({
      project: {
        ...state.project,
        ...project,
      },
    })),

  // Reset to initial state
  reset: () => set(initialState),
}))
