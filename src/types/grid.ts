import type { H3Index } from 'h3-js'

export type CellData = {
  terrain: 'timber' | 'ag' | 'water' | 'scrub' | 'unclassified'
  elevation?: number
  label?: 'bedding' | 'food_plot' | 'stand'
  pressureScore?: number
  windRisk?: string[]
}

export type HabitatState = {
  project: {
    bounds: number[][] // [lat, lng][]
    baseResolution: number // e.g., 10 or 12
    totalAcres: number
  }
  grid: Record<H3Index, CellData> // The "Hot Store"
}
