// Extract meaningful habitat metrics from GeoJSON polygons

export type SpatialMetrics = {
  label: string
  acreage: number
  perimeter: number // feet  
  shape: 'compact' | 'elongated' | 'irregular'
  orientation: string // N, NE, E, SE, S, SW, W, NW
  relativePosition: string // "North edge", "Central", "South-West corner", etc.
  distanceToAccess: number | null // feet from nearest entry point
  proximityToFeatures: Array<{ type: string, distance: number }> // nearby food plots, trails, etc.
  windExposure: string // "Exposed to NW", "Sheltered", "Leeward", etc.
  notes: string
}

/**
 * Analyze a single polygon and return habitat-focused metrics
 */
export function analyzePolygon(
  feat: any,
  boundary: any,
  allFeatures: any[],
  terrainInputs?: any
): SpatialMetrics {
  const props = feat.properties || {}
  const label = props.toolName || props.name || 'Unknown Feature'
  const acres = props.acres || 0
  
  // For now, use simplified calculations
  const perimeter = Math.round(acres * 835) // Rough estimate: sqrt(acres) * 4 * 208
  const shape = 'compact' // Default
  
  // Calculate orientation
  const orientation = calculateOrientation(feat)
  
  // Calculate position relative to boundary
  const relativePosition = calculateRelativePosition(feat, boundary)
  
  // Calculate distances to other features
  const proximityToFeatures = calculateProximity(feat, allFeatures)
  
  // Determine wind exposure based on orientation and terrain
  const windExposure = calculateWindExposure(orientation, terrainInputs)
  
  // Distance to access (if entry points defined in terrain)
  const distanceToAccess = null // TODO: calculate from terrainInputs.accessPoints
  
  return {
    label,
    acreage: acres,
    perimeter,
    shape,
    orientation,
    relativePosition,
    distanceToAccess,
    proximityToFeatures,
    windExposure,
    notes: props.note || ''
  }
}

/**
 * Calculate primary orientation (N, NE, E, etc.) of polygon's longest axis
 */
function calculateOrientation(feat: any): string {
  try {
    const coords = feat.geometry?.coordinates?.[0]
    if (!coords || coords.length < 3) return 'Unknown'
    
    // Find longest edge
    let maxDist = 0
    let bearingVal = 0
    for (let i = 0; i < coords.length - 1; i++) {
      const [lng1, lat1] = coords[i]
      const [lng2, lat2] = coords[i + 1]
      
      // Simple distance calculation
      const dist = Math.sqrt(Math.pow(lng2 - lng1, 2) + Math.pow(lat2 - lat1, 2))
      if (dist > maxDist) {
        maxDist = dist
        // Calculate bearing
        bearingVal = Math.atan2(lng2 - lng1, lat2 - lat1) * 180 / Math.PI
      }
    }
    
    // Convert bearing to compass direction
    const normalized = (bearingVal + 360) % 360
    if (normalized >= 337.5 || normalized < 22.5) return 'N'
    if (normalized >= 22.5 && normalized < 67.5) return 'NE'
    if (normalized >= 67.5 && normalized < 112.5) return 'E'
    if (normalized >= 112.5 && normalized < 157.5) return 'SE'
    if (normalized >= 157.5 && normalized < 202.5) return 'S'
    if (normalized >= 202.5 && normalized < 247.5) return 'SW'
    if (normalized >= 247.5 && normalized < 292.5) return 'W'
    return 'NW'
  } catch (e) {
    return 'Unknown'
  }
}

/**
 * Determine position within boundary (e.g., "North edge", "Central", "SE corner")
 */
function calculateRelativePosition(feat: any, boundary: any): string {
  if (!boundary || !boundary.geometry) return 'Unknown'
  
  try {
    // Calculate centroid of feature
    const coords = feat.geometry?.coordinates?.[0]
    if (!coords || coords.length === 0) return 'Unknown'
    
    let sumLng = 0, sumLat = 0
    for (const [lng, lat] of coords) {
      sumLng += lng
      sumLat += lat
    }
    const pLng = sumLng / coords.length
    const pLat = sumLat / coords.length
    
    // Get boundary bounds
    const boundaryCoords = boundary.geometry.coordinates[0]
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
    for (const [lng, lat] of boundaryCoords) {
      minLng = Math.min(minLng, lng)
      minLat = Math.min(minLat, lat)
      maxLng = Math.max(maxLng, lng)
      maxLat = Math.max(maxLat, lat)
    }
    
    const latRange = maxLat - minLat
    const lngRange = maxLng - minLng
    
    // Determine N/S/Central
    const latPos = (pLat - minLat) / latRange
    let ns = 'Central'
    if (latPos < 0.3) ns = 'South'
    else if (latPos > 0.7) ns = 'North'
    
    // Determine E/W/Central
    const lngPos = (pLng - minLng) / lngRange
    let ew = ''
    if (lngPos < 0.3) ew = '-West'
    else if (lngPos > 0.7) ew = '-East'
    
    return ns === 'Central' && ew === '' ? 'Central' : `${ns}${ew}`.replace('-', ' ').trim()
  } catch (e) {
    return 'Unknown'
  }
}

/**
 * Calculate distances to nearby features
 */
function calculateProximity(feat: any, allFeatures: any[]): Array<{ type: string, distance: number }> {
  try {
    // Get center of this feature
    const coords = feat.geometry?.coordinates?.[0]
    if (!coords || coords.length === 0) return []
    
    let sumLng = 0, sumLat = 0
    for (const [lng, lat] of coords) {
      sumLng += lng
      sumLat += lat
    }
    const centerLng = sumLng / coords.length
    const centerLat = sumLat / coords.length
    
    const proximity: Array<{ type: string, distance: number }> = []
    
    for (const other of allFeatures) {
      if (other === feat) continue // skip self
      
      // Get center of other feature
      const otherCoords = other.geometry?.coordinates?.[0]
      if (!otherCoords || otherCoords.length === 0) continue
      
      let sumLng2 = 0, sumLat2 = 0
      for (const [lng, lat] of otherCoords) {
        sumLng2 += lng
        sumLat2 += lat
      }
      const otherLng = sumLng2 / otherCoords.length
      const otherLat = sumLat2 / otherCoords.length
      
      // Simple Euclidean distance (rough approximation)
      const distDeg = Math.sqrt(Math.pow(otherLng - centerLng, 2) + Math.pow(otherLat - centerLat, 2))
      const distFeet = Math.round(distDeg * 364000) // Rough conversion: ~364000 feet per degree
      
      const type = other.properties?.toolName || other.properties?.toolId || 'feature'
      
      // Only report features within 1000 feet
      if (distFeet < 1000) {
        proximity.push({ type, distance: distFeet })
      }
    }
    
    return proximity.sort((a, b) => a.distance - b.distance).slice(0, 5) // top 5 nearest
  } catch (e) {
    return []
  }
}

/**
 * Determine wind exposure based on orientation and terrain
 */
function calculateWindExposure(orientation: string, terrainInputs?: any): string {
  const predominantWind = terrainInputs?.predominantWind || terrainInputs?.wind || 'NW'
  
  // Check if orientation faces into wind (exposed) or away (sheltered)
  const windDirections: { [key: string]: number } = {
    'N': 0, 'NE': 45, 'E': 90, 'SE': 135,
    'S': 180, 'SW': 225, 'W': 270, 'NW': 315
  }
  
  const windBearing = windDirections[predominantWind] || 315
  const orientBearing = windDirections[orientation] || 0
  
  const diff = Math.abs(windBearing - orientBearing)
  const normalizedDiff = diff > 180 ? 360 - diff : diff
  
  if (normalizedDiff < 45) {
    return `Exposed to ${predominantWind} wind`
  } else if (normalizedDiff > 135) {
    return `Sheltered from ${predominantWind} wind (Leeward)`
  } else {
    return `Partial ${predominantWind} wind exposure`
  }
}

/**
 * Format spatial metrics as readable analysis text for Tony
 */
export function formatAnalysisData(metrics: SpatialMetrics): string {
  const proximity = metrics.proximityToFeatures.length > 0
    ? `\n    - Nearby Features: ${metrics.proximityToFeatures.map(p => `${p.type} (${p.distance}ft)`).join(', ')}`
    : ''
  
  const access = metrics.distanceToAccess !== null
    ? `\n    - Distance to Access: ${metrics.distanceToAccess}ft`
    : ''
  
  return `
ANALYSIS DATA:
    - User Label: "${metrics.label}"
    - Acreage: ${metrics.acreage.toFixed(2)} acres
    - Perimeter: ${metrics.perimeter}ft
    - Shape: ${metrics.shape}
    - Orientation: ${metrics.orientation}
    - Position: ${metrics.relativePosition}
    - Wind Relationship: ${metrics.windExposure}${proximity}${access}${metrics.notes ? `\n    - User Notes: ${metrics.notes}` : ''}
  `.trim()
}
