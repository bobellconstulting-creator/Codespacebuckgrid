/**
 * TONY'S BRAIN: The Physics of Deer Movement
 * These functions calculate habitat value based on Topography.
 */

// 1. THE WEISS RULE (Landform Classification)
// Identifies if a spot is a Ridge (Bedding), Draw (Travel), or Flat (Feed).
export function classifyLandform(elevation: number, meanNeighborhood: number, stdDev: number): 'RIDGE' | 'DRAW' | 'FLAT' | 'SLOPE' {
  const tpi = elevation - meanNeighborhood; // Topographic Position Index
  
  // If significantly higher than surroundings -> RIDGE (Buck Bedding)
  if (tpi > (1 * stdDev)) return 'RIDGE'; 
  
  // If significantly lower -> DRAW (Thermal Tunnel / Travel)
  if (tpi < (-1 * stdDev)) return 'DRAW'; 
  
  // If flat -> FEEDING/STAGING
  if (Math.abs(tpi) < 0.5 * stdDev) return 'FLAT'; 
  
  return 'SLOPE';
}

// 2. THE MILITARY CREST (Bedding Score)
// Finds the "Leeward Bench" - the perfect spot 1/3 down from the top.
export function scoreBedding(
  elevation: number, 
  maxRidgeElev: number, 
  slope: number, 
  aspect: string, 
  windDirection: string
): number {
  let score = 0;

  // RULE A: The "Military Crest" (Top 25-33% of the ridge)
  // Bucks want to see danger below but smell danger from above.
  const relativeHeight = elevation / maxRidgeElev;
  if (relativeHeight > 0.65 && relativeHeight < 0.85) {
      score += 50; // GOLDEN ZONE
  }

  // RULE B: The "Bench" (Flat shelf on steep terrain)
  // Deer hate lying on steep slopes. They want a flat shelf.
  if (slope < 8 && slope > 2) { 
      score += 30; // Perfect sleeping angle
  }

  // RULE C: Wind Advantage (Leeward side)
  // If wind is West, they bed on East facing slopes.
  if (aspect !== windDirection) {
      score += 20;
  }

  return score;
}

// 3. MOVEMENT COST (The "Lazy Buck" Theory)
// Calculates how "expensive" it is to walk here. Bucks take the path of least resistance.
export function calculateMovementCost(slope: number, landCover: string): number {
  let cost = 1; 

  // Slope Penalty: They avoid steep climbs unless pressured.
  if (slope > 20) cost += 50; 
  if (slope > 10) cost += 10;
  
  // Exposure Penalty: They avoid open fields in daylight.
  if (landCover === 'Open Field') cost += 20; 
  if (landCover === 'Thicket') cost -= 5; // Safety bonus
  
  return cost;
}

// 4. THERMAL TUNNEL CHECK
// Returns true if this is a low-lying drainage suitable for evening thermal travel.
export function isThermalTunnel(landform: string, slope: number): boolean {
    return landform === 'DRAW' && slope < 5;
}
