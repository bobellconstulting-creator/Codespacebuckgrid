'use client'

import { useState, useCallback } from 'react'
import { polygonToCells, cellToLatLng } from 'h3-js'

/**
 * GridCell represents a single H3 hexagon with habitat metadata
 */
export interface GridCell {
  h3Index: string
  lat: number
  lng: number
  habitatType: 'Unclassified' | 'heavy_timber' | 'scrub_brush' | 'open_pasture' | 'bedding' | 'food_plot' | 'water'
  permeability?: number // 0-1 scale for deer movement
  confidence?: number // 0-1 scale from vision AI
  userModified?: boolean
}

/**
 * Tony's Brain - Core H3 Grid Logic Hook
 * Manages spatial intelligence grid for habitat analysis
 */
export function useTonyLogic() {
  const [h3Grid, setH3Grid] = useState<Map<string, GridCell>>(new Map())
  const [gridResolution, setGridResolution] = useState<number>(10) // ~0.1 acre hexes

  /**
   * Generate H3 grid from locked boundary polygon
   * @param boundaryGeoJSON - GeoJSON Polygon feature representing property boundary
   */
  const generateGrid = useCallback((boundaryGeoJSON: any) => {
    if (!boundaryGeoJSON || boundaryGeoJSON.type !== 'Feature') {
      console.error('[TonyLogic] Invalid GeoJSON provided to generateGrid')
      return
    }

    const geometry = boundaryGeoJSON.geometry
    if (!geometry || geometry.type !== 'Polygon') {
      console.error('[TonyLogic] GeoJSON must contain a Polygon geometry')
      return
    }

    try {
      // Extract coordinates array (h3-js expects [lng, lat] format)
      const coordinates = geometry.coordinates[0] // Outer ring

      // Generate H3 cells covering the polygon
      // polygonToCells expects coordinates as [[lng, lat], ...] and resolution
      const hexIndices = polygonToCells(coordinates, gridResolution, true)

      console.log(`[TonyLogic] Generated ${hexIndices.length} H3 cells at resolution ${gridResolution}`)

      // Build new grid map
      const newGrid = new Map<string, GridCell>()

      hexIndices.forEach((h3Index) => {
        // Get center coordinates of this hex
        const centerLatLng = cellToLatLng(h3Index)

        newGrid.set(h3Index, {
          h3Index,
          lat: centerLatLng[0],
          lng: centerLatLng[1],
          habitatType: 'Unclassified',
          permeability: 0.5, // Default neutral permeability
          confidence: 0,
          userModified: false,
        })
      })

      setH3Grid(newGrid)
      console.log(`[TonyLogic] H3 Grid initialized with ${newGrid.size} cells`)
    } catch (error) {
      console.error('[TonyLogic] Error generating H3 grid:', error)
    }
  }, [gridResolution])

  /**
   * Update specific cell with new data
   * @param h3Index - H3 cell index to update
   * @param data - Partial GridCell data to merge
   */
  const updateCell = useCallback((h3Index: string, data: Partial<GridCell>) => {
    setH3Grid((prevGrid) => {
      const newGrid = new Map(prevGrid)
      const existingCell = newGrid.get(h3Index)

      if (!existingCell) {
        console.warn(`[TonyLogic] Cell ${h3Index} not found in grid`)
        return prevGrid
      }

      // Merge new data with existing cell
      newGrid.set(h3Index, {
        ...existingCell,
        ...data,
        userModified: true, // Flag that this cell was manually updated
      })

      return newGrid
    })
  }, [])

  /**
   * Update multiple cells at once (batch operation)
   * @param updates - Array of {h3Index, data} objects
   */
  const updateCells = useCallback((updates: Array<{ h3Index: string; data: Partial<GridCell> }>) => {
    setH3Grid((prevGrid) => {
      const newGrid = new Map(prevGrid)

      updates.forEach(({ h3Index, data }) => {
        const existingCell = newGrid.get(h3Index)
        if (existingCell) {
          newGrid.set(h3Index, {
            ...existingCell,
            ...data,
            userModified: true,
          })
        }
      })

      return newGrid
    })
  }, [])

  /**
   * Clear the entire grid
   */
  const clearGrid = useCallback(() => {
    setH3Grid(new Map())
    console.log('[TonyLogic] H3 Grid cleared')
  }, [])

  /**
   * Get cells by habitat type (filtering utility)
   */
  const getCellsByHabitat = useCallback((habitatType: GridCell['habitatType']) => {
    const cells: GridCell[] = []
    h3Grid.forEach((cell) => {
      if (cell.habitatType === habitatType) {
        cells.push(cell)
      }
    })
    return cells
  }, [h3Grid])

  /**
   * Get grid statistics (analytics utility)
   */
  const getGridStats = useCallback(() => {
    const stats = {
      totalCells: h3Grid.size,
      cellsPerHabitat: new Map<string, number>(),
      avgPermeability: 0,
      classifiedCells: 0,
    }

    let totalPermeability = 0

    h3Grid.forEach((cell) => {
      // Count habitat types
      const count = stats.cellsPerHabitat.get(cell.habitatType) || 0
      stats.cellsPerHabitat.set(cell.habitatType, count + 1)

      // Sum permeability
      totalPermeability += cell.permeability || 0

      // Count classified cells
      if (cell.habitatType !== 'Unclassified') {
        stats.classifiedCells++
      }
    })

    stats.avgPermeability = h3Grid.size > 0 ? totalPermeability / h3Grid.size : 0

    return stats
  }, [h3Grid])

  return {
    // State
    h3Grid,
    gridResolution,
    
    // Grid Management
    generateGrid,
    clearGrid,
    setGridResolution,
    
    // Cell Operations
    updateCell,
    updateCells,
    
    // Query Utilities
    getCellsByHabitat,
    getGridStats,
  }
}
