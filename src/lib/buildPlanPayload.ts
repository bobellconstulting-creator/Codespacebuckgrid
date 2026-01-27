// Comprehensive plan payload builder for Tony analysis
export type PlanPayload = {
  plan: {
    id: string
    name: string
    createdAt: number
    mapCenter: { lat: number, lng: number }
    zoom: number
    boundary: any | null
    layers: Array<{
      id: string
      type: string
      name: string
      notes: string
      acres: number
      geojson: any
    }>
    inputs: {
      seasonPhase?: string
      wind?: string
      entryPoints?: string
      pressureNotes?: string
      goals?: string
      terrainContext: {
        terrainNotes?: string
        hasRidges?: boolean
        hasValleys?: boolean
        hasCreeks?: boolean
        hasSaddles?: boolean
        hasBenches?: boolean
        thermals?: string
        coverType?: string
        elevation?: string
        predominantWind?: string
        accessPoints?: string
        pressureConcerns?: string
        neighborsFood?: string
      }
    }
    stats: {
      totalAcreage: number
      boundaryAcreage: number
      foodAcreage: number
      beddingAcreage: number
      screenAcreage: number
      trailCount: number
      standCount: number
      noteCount: number
    }
  }
}

export function buildPlanPayload(params: {
  geoJSON: any
  lockedBordersGeoJSON?: any
  terrainInputs?: any
  mapContext?: { center: { lat: number, lng: number }, zoom: number }
}): PlanPayload {
  const { geoJSON, lockedBordersGeoJSON, terrainInputs = {}, mapContext } = params
  
  // Extract boundary
  const boundary = lockedBordersGeoJSON?.features?.[0] || null
  const boundaryAcres = boundary?.properties?.acres || 0
  
  // Build layers with full metadata
  const layers = (geoJSON.features || []).map((feature: any, idx: number) => {
    const props = feature.properties || {}
    return {
      id: props.id || `layer-${idx}`,
      type: props.toolId || 'unknown',
      name: props.toolName || 'Unknown',
      notes: props.note || '',
      acres: props.acres || 0,
      geojson: feature
    }
  })
  
  // Calculate stats
  const stats = {
    totalAcreage: boundaryAcres,
    boundaryAcreage: boundaryAcres,
    foodAcreage: layers.filter((l: any) => l.type === 'food').reduce((sum: number, l: any) => sum + l.acres, 0),
    beddingAcreage: layers.filter((l: any) => l.type === 'bedding').reduce((sum: number, l: any) => sum + l.acres, 0),
    screenAcreage: layers.filter((l: any) => l.type === 'screen').reduce((sum: number, l: any) => sum + l.acres, 0),
    trailCount: layers.filter((l: any) => l.type === 'trail').length,
    standCount: layers.filter((l: any) => l.type === 'stand').length,
    noteCount: layers.filter((l: any) => l.type === 'annotation').length
  }
  
  return {
    plan: {
      id: Date.now().toString(),
      name: 'Current Plan',
      createdAt: Date.now(),
      mapCenter: mapContext?.center || { lat: 0, lng: 0 },
      zoom: mapContext?.zoom || 16,
      boundary: boundary,
      layers,
      inputs: {
        seasonPhase: terrainInputs.seasonPhase,
        wind: terrainInputs.predominantWind,
        entryPoints: terrainInputs.accessPoints,
        pressureNotes: terrainInputs.pressureConcerns,
        goals: terrainInputs.goals,
        terrainContext: {
          terrainNotes: terrainInputs.terrainNotes,
          hasRidges: terrainInputs.hasRidges,
          hasValleys: terrainInputs.hasValleys,
          hasCreeks: terrainInputs.hasCreeks,
          hasSaddles: terrainInputs.hasSaddles,
          hasBenches: terrainInputs.hasBenches,
          thermals: terrainInputs.thermals,
          coverType: terrainInputs.coverType,
          elevation: terrainInputs.elevation,
          predominantWind: terrainInputs.predominantWind,
          accessPoints: terrainInputs.accessPoints,
          pressureConcerns: terrainInputs.pressureConcerns,
          neighborsFood: terrainInputs.neighborsFood
        }
      },
      stats
    }
  }
}
