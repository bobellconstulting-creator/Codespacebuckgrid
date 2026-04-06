// Deer Pressure Intelligence — two-layer system
// Layer 1: Static county-level harvest tier lookup (QDMA/NWTF public data)
// Layer 2: Static season date lookup by state
// Reverse geocoding via Nominatim (free, no key required)

export interface DeerPressureSummary {
  state: string
  county: string
  harvestTier: 'high' | 'moderate' | 'low' | 'unknown'
  annualHarvestPer1000Acres: string  // e.g. "2.1-3.4" or "unknown"
  pressureNotes: string
  archeryDates?: string
  rifleDates?: string
  muzzleloaderDates?: string
  managementNotes: string
}

// ─── State abbreviation normalizer ───────────────────────────────────────────
const STATE_ABBREV: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY',
}

// ─── Season dates by state — current typical dates (verify annually) ─────────
// Format: human-readable strings for Tony's context block
interface StateSeason {
  archery: string
  rifle: string
  muzzleloader: string
}

const STATE_SEASONS: Record<string, StateSeason> = {
  KS: { archery: 'Sep 15 – Dec 31', rifle: 'Nov (dates vary by unit, ~10 days)', muzzleloader: 'Sep 1-15 & Dec (varies)' },
  MO: { archery: 'Sep 15 – Nov 15 & Dec 1-Jan 15', rifle: 'Nov 13-26 (firearms)', muzzleloader: 'Oct 21-29 & Jan (early/late)' },
  IA: { archery: 'Oct 1 – Jan 10', rifle: 'Dec 2-10 (shotgun only)', muzzleloader: 'Oct 14-22 & Dec 16-24' },
  IL: { archery: 'Oct 1 – Jan 15', rifle: 'Nov 17-Dec 3 (firearms)', muzzleloader: 'Oct 13-21 & Dec 26-Jan 8' },
  OH: { archery: 'Sep 28 – Feb 2', rifle: 'Nov 30-Dec 1 (gun)', muzzleloader: 'Jan 4-7' },
  IN: { archery: 'Oct 1 – Jan 5', rifle: 'Nov 16-26', muzzleloader: 'Dec 7-19' },
  MI: { archery: 'Oct 1 – Nov 14 & Dec 1-Jan 1', rifle: 'Nov 15-30', muzzleloader: 'Dec 1-31' },
  WI: { archery: 'Sep 14 – Jan 6', rifle: 'Nov 23-Dec 1', muzzleloader: 'Nov 23-Dec 1 (concurrent)' },
  MN: { archery: 'Sep 14 – Dec 31', rifle: 'Nov 9-24', muzzleloader: 'Nov 30-Dec 8' },
  PA: { archery: 'Sep 21 – Nov 22 & Dec 26-Jan 11', rifle: 'Nov 30-Dec 14', muzzleloader: 'Oct 19-24 & Dec 26-Jan 11' },
  TX: { archery: 'Oct 5 – Nov 1', rifle: 'Nov 2-Jan 5 (varies by county)', muzzleloader: 'Jan 6-19' },
  AL: { archery: 'Oct 15 – Feb 10', rifle: 'Nov 19-Jan 31 (varies by zone)', muzzleloader: 'Oct 15-Nov 15 (black powder zone)' },
  MS: { archery: 'Oct 1 – Jan 20', rifle: 'Nov 18-Dec 30 (varies by zone)', muzzleloader: 'Oct 15-Nov 17' },
  GA: { archery: 'Sep 14 – Jan 15', rifle: 'Oct 19-Jan 15', muzzleloader: 'Oct 12-18' },
  SC: { archery: 'Aug 15 – Jan 1', rifle: 'Aug 15 – Jan 1 (concurrent)', muzzleloader: 'Aug 15 – Jan 1 (concurrent)' },
  AR: { archery: 'Oct 1 – Feb 28', rifle: 'Nov 9-29 & Dec 14 – Jan 2 (modern gun)', muzzleloader: 'Oct 7-22' },
  OK: { archery: 'Oct 1 – Jan 15', rifle: 'Nov 16-Dec 5 (gun season)', muzzleloader: 'Oct 7-22' },
  TN: { archery: 'Sep 28 – Feb 28', rifle: 'Nov 16-29 (gun season)', muzzleloader: 'Oct 19-Nov 1' },
}

// ─── County-level harvest tier data ──────────────────────────────────────────
// Based on QDMA Whitetail Reports + state DNR harvest summaries
// Tiers: 'high' = >2 deer/1000 acres/yr, 'moderate' = 1-2, 'low' = <1
// This is a structured representative sample — expands over time via agent memory

interface CountyData {
  tier: 'high' | 'moderate' | 'low'
  harvestRange: string
  notes: string
}

// State-level defaults applied when county not found
const STATE_DEFAULTS: Record<string, { tier: 'high' | 'moderate' | 'low'; harvestRange: string; notes: string }> = {
  KS: { tier: 'moderate', harvestRange: '1.5-3.0', notes: 'Kansas averages ~90k deer harvested/yr across ~52M acres. Northwest KS is low; east-central and SE KS (Morris, Chase, Lyon counties) are top producers. CWD-free status drives trophy quality.' },
  MO: { tier: 'high', harvestRange: '2.5-4.5', notes: 'Missouri is a top-5 whitetail state. ~300k harvest/yr. North-central and NE Missouri have highest densities. Boone & Crockett entries per square mile among the highest nationally.' },
  IA: { tier: 'high', harvestRange: '3.0-5.5', notes: 'Iowa is the premier trophy whitetail state. Extremely strict nonresident tags. High corn/soy agriculture creates exceptional body condition. Mature bucks are common but pressure is intense.' },
  IL: { tier: 'high', harvestRange: '2.5-4.0', notes: 'Illinois produces world-class bucks. Pike, Adams, and western counties are elite. Antler point restrictions rare — high harvest pressure. Ag-heavy landscape means food is not limiting.' },
  OH: { tier: 'high', harvestRange: '2.0-3.5', notes: 'Ohio has increased dramatically in 20 years. Southeast hill country (Noble, Morgan, Guernsey counties) has highest mature buck density. Gun pressure very high Nov 30-Dec 1.' },
  IN: { tier: 'high', harvestRange: '2.0-3.5', notes: 'Southern Indiana hill counties (Jackson, Lawrence, Monroe) produce trophy bucks. North-central Indiana has high density but smaller-bodied deer from flat terrain.' },
  MI: { tier: 'moderate', harvestRange: '1.5-3.0', notes: 'Michigan UP has low density but exceptional trophy potential. Lower Peninsula (especially SW counties) has moderate-high density. November firearms season is the most intense 2 weeks in Midwestern deer hunting.' },
  WI: { tier: 'moderate', harvestRange: '1.5-2.5', notes: 'CWD has reduced densities in SW Wisconsin. Buffalo and Pepin counties still produce excellent bucks. Firearm season (Thanksgiving week) drives significant nocturnal movement.' },
  MN: { tier: 'moderate', harvestRange: '1.0-2.0', notes: 'SE Minnesota bluff country has highest density and trophy potential. Western MN farm country has good numbers but high pressure. CWD concern in SE corner.' },
  PA: { tier: 'high', harvestRange: '2.0-4.0', notes: 'Pennsylvania has the highest deer harvest volume in the eastern US (>400k/yr). DMAP zones have created localized trophy pockets. Potter and Tioga counties produce PA\'s largest bucks.' },
  TX: { tier: 'moderate', harvestRange: '1.0-3.5', notes: 'Texas harvest varies enormously by region. South Texas brush country has highest density and trophy quality. Hill Country is moderate. West Texas is low density. Lease hunting culture means significant portions are low-pressure.' },
  AL: { tier: 'moderate', harvestRange: '1.5-2.5', notes: 'Alabama Black Belt region (Marengo, Perry, Hale counties) is world-class for trophy bucks. Long season and liberal bag limits. CWD-free as of last survey.' },
  MS: { tier: 'moderate', harvestRange: '1.5-2.5', notes: 'Mississippi Delta counties (Humphreys, Sharkey, Issaquena) have exceptional deer populations from agriculture. Long season with liberal limits. Club hunting culture.' },
  GA: { tier: 'moderate', harvestRange: '1.0-2.0', notes: 'Georgia has recovered well from overharvest. SW Georgia ag country produces large-bodied deer. Long season but can be hard to pattern nocturnal mature bucks.' },
  SC: { tier: 'moderate', harvestRange: '1.5-3.0', notes: 'South Carolina has no antler restrictions and a long season. Concurrent archery/gun season means maximum pressure. Edgefield and McCormick counties produce top bucks.' },
  AR: { tier: 'moderate', harvestRange: '1.5-2.5', notes: 'Arkansas Delta counties (Mississippi, Crittenden, Cross) have the best deer numbers. Ozark counties have lower density but quality habitat. Growing trophy reputation.' },
  OK: { tier: 'moderate', harvestRange: '1.0-2.5', notes: 'Eastern Oklahoma (Mayes, Cherokee, Delaware counties) has excellent trophy potential. Western OK is lower density. Significant private land hunting culture.' },
  TN: { tier: 'moderate', harvestRange: '1.5-2.5', notes: 'Middle Tennessee (Hickman, Lewis, Perry counties) has the best deer habitat. Western TN ag country has high numbers. Antler restrictions are rare — bucks typically harvested young.' },
}

// High-quality county overrides (documented outlier counties — elite or notably low)
const COUNTY_OVERRIDES: Record<string, Record<string, CountyData>> = {
  IA: {
    'allamakee': { tier: 'high', harvestRange: '4.0-6.0', notes: 'Allamakee County consistently ranks among the top B&C producing counties nationally. Steep bluffs, diverse timber, limited ag disturbance create ideal sanctuary.' },
    'clayton': { tier: 'high', harvestRange: '4.0-6.0', notes: 'Clayton County: river bluff terrain, excellent mast production, heavy cover. Trophy caliber bucks common.' },
    'fayette': { tier: 'high', harvestRange: '3.5-5.0', notes: 'Fayette County NE Iowa: exceptional mixed timber/ag interface. High pressure but deer density supports it.' },
  },
  IL: {
    'pike': { tier: 'high', harvestRange: '4.0-6.5', notes: 'Pike County IL: arguably the most famous whitetail county in North America. Extreme B&C density. Enormous hunting pressure — mature bucks go almost entirely nocturnal by Oct 20.' },
    'adams': { tier: 'high', harvestRange: '3.5-5.5', notes: 'Adams County: borders Pike. Similar genetics and habitat. Very high pressure. Food source hunting most productive.' },
    'brown': { tier: 'high', harvestRange: '3.0-5.0', notes: 'Brown County IL: Mississippi River bluffs, heavy timber. Lower profile than Pike but equivalent quality.' },
  },
  MO: {
    'boone': { tier: 'high', harvestRange: '3.5-5.0', notes: 'Boone County MO: some of the highest per-square-mile B&C entries in Missouri. Suburban edge creates sanctuary pockets.' },
    'clark': { tier: 'high', harvestRange: '4.0-5.5', notes: 'Clark County: NE Missouri corner. Ag-heavy, excellent genetics.' },
  },
  KS: {
    'morris': { tier: 'high', harvestRange: '2.5-4.0', notes: 'Morris County KS: Flint Hills transition zone. Council Grove area. Timber along creeks creates excellent habitat in otherwise open range.' },
    'chase': { tier: 'high', harvestRange: '2.0-3.5', notes: 'Chase County: true Flint Hills. Limited timber but exceptional genetics from low hunting pressure.' },
    'lyon': { tier: 'moderate', harvestRange: '1.8-3.0', notes: 'Lyon County: diverse habitat, Emporia area, mixed ag and timber.' },
    'osage': { tier: 'moderate', harvestRange: '1.8-2.8', notes: 'Osage County: eastern KS rolling terrain, good timber/ag mix.' },
  },
  OH: {
    'noble': { tier: 'high', harvestRange: '3.0-5.0', notes: 'Noble County OH: SE hill country. Produces some of Ohio\'s largest bucks. Dense second-growth timber. Low human pressure relative to state average.' },
    'morgan': { tier: 'high', harvestRange: '2.8-4.5', notes: 'Morgan County: similar to Noble. Excellent timber and low population density.' },
  },
  TX: {
    'webb': { tier: 'high', harvestRange: '3.5-6.0', notes: 'Webb County TX (Laredo area): South Texas brush country. World-class genetics, intense hunting pressure on leases but managed for trophy quality.' },
    'dimmit': { tier: 'high', harvestRange: '3.5-5.5', notes: 'Dimmit County: core South Texas. Intense managed hunting pressure but trophy caliber.' },
  },
  AL: {
    'marengo': { tier: 'high', harvestRange: '3.0-5.0', notes: 'Marengo County AL: Black Belt region. Limestone prairie soils produce exceptional mineral content — world-class body weights and antler mass.' },
    'perry': { tier: 'high', harvestRange: '3.0-4.5', notes: 'Perry County: core Black Belt. Club hunting, managed properties, trophy caliber.' },
  },
  PA: {
    'potter': { tier: 'high', harvestRange: '3.0-4.5', notes: 'Potter County PA: "God\'s Country." Remote, large blocks of state forest, lower human density than most PA counties. Produces the largest-bodied deer in the state.' },
    'tioga': { tier: 'high', harvestRange: '2.5-4.0', notes: 'Tioga County: similar to Potter. Pine Creek gorge area, excellent habitat.' },
  },
}

function lookupCountyData(stateAbbrev: string, countyName: string): CountyData | null {
  const normalizedCounty = countyName.toLowerCase().replace(/\s+county$/i, '').trim()
  const stateCounties = COUNTY_OVERRIDES[stateAbbrev]
  if (stateCounties) {
    const match = stateCounties[normalizedCounty]
    if (match) return match
  }
  const stateDef = STATE_DEFAULTS[stateAbbrev]
  if (stateDef) {
    return { tier: stateDef.tier, harvestRange: stateDef.harvestRange, notes: stateDef.notes }
  }
  return null
}

function buildManagementNotes(tier: 'high' | 'moderate' | 'low' | 'unknown', state: string): string {
  const stateNotes: Record<string, string> = {
    KS: 'Kansas allows 1 antlered buck/yr on standard license. Extended archery season creates 4+ month hunting window. DMAP tags available in some counties.',
    MO: 'Missouri allows 1 antlered deer total across all seasons. Conservation order allows additional antlerless. Consider food plots of 1-2 acres minimum to hold deer against hunting pressure.',
    IA: 'Iowa nonresident tags are limited and lottery. Resident hunting is high pressure. Late October–mid November rut window is critical. Morning thermals especially important in Iowa creek bottoms.',
    IL: 'Illinois allows 2 antlered deer/season. No antler point restrictions statewide. High pressure Oct 15–Nov 30. Expect mature bucks to be almost entirely nocturnal in heavily hunted areas.',
    OH: 'Ohio gun season (Nov 30–Dec 1) creates mass hunter influx. Pre-gun archery season best for mature bucks. January firearms season (bonus tags) produces excellent rutting activity.',
    IN: 'Indiana firearms week (Nov 16-26) is the highest-pressure period. Pre-rut archery (Nov 1-15) is the elite mature buck window.',
    MI: 'Michigan firearms opener (Nov 15) is a cultural event — pressure is extreme. Post-rut December archery can be excellent on smart bucks that survived gun season.',
    WI: 'Wisconsin gun deer season (Thanksgiving week) is one of the most intense in North America. 600,000+ hunters afield. Mature buck hunting is archery-only strategy.',
    MN: 'Minnesota November gun season drives significant nocturnal activity in mature bucks. SE bluff country has highest trophy potential. CWD monitoring ongoing.',
    PA: 'Pennsylvania has some of the highest hunter density in North America. Trophy bucks survive by going nocturnal or using remote terrain. Sunday hunting now legal — more pressure than historical norms.',
    TX: 'Texas lease hunting culture means significant private land management. South Texas genetics/management produce world-class bucks. Hill Country properties benefit from deer management cooperatives.',
    AL: 'Alabama has one of the longest seasons in the country. High hunter days. Black Belt soil properties produce elite bucks. QDM clubs are common and effective.',
    MS: 'Mississippi allows high bag limits. Club hunting dominates the Delta. QDM adoption growing. Long season means pressure is distributed throughout.',
    GA: 'Georgia\'s long season with concurrent weapons means very high total pressure. QDM cooperatives in SW Georgia produce excellent results. Focus on sanctuary designation.',
    SC: 'South Carolina\'s concurrent season (archery + gun simultaneously) creates the highest combined pressure in the nation. True sanctuary blocks (no-entry zones) are essential for mature buck success.',
    AR: 'Arkansas has a growing trophy reputation. Delta counties are high-density. Ozark properties benefit from lower access but require ATV/terrain management.',
    OK: 'Oklahoma\'s eastern counties are underrated. Significant private land with low pressure exists. Outfitter leases dominate the best ground.',
    TN: 'Tennessee\'s Middle Tennessee counties are the state\'s premier habitat. Limestone soils produce excellent body condition. QDM adoption is moderate but growing.',
  }

  let notes = stateNotes[state] ?? `Standard whitetail management principles apply. Refer to state DNR for current regulations and harvest limits.`

  if (tier === 'high') {
    notes += ' HIGH PRESSURE COUNTY: Mature bucks (3.5+ years) will be largely nocturnal by mid-October. Stand entry/exit routes are as important as stand placement. Scent control is non-negotiable. Focus hunting effort on the first 3 days of pressure and during active rut phases.'
  } else if (tier === 'moderate') {
    notes += ' MODERATE PRESSURE: Food source stands can produce daylight activity into November. Bucks respond to calling and decoys during rut. Good properties can hold deer year-round with proper sanctuary designation.'
  } else if (tier === 'low') {
    notes += ' LOW PRESSURE: Food source stands produce consistent daylight activity. Bucks may travel in daylight through December. Standard hunting techniques effective. Focus on habitat improvement for long-term population increase.'
  }

  return notes
}

interface NominatimResponse {
  address?: {
    state?: string
    county?: string
    state_district?: string
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<{ state: string; county: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}&format=json&zoom=10`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      headers: { 'User-Agent': 'BuckGridPro/1.0 (habitat management platform)' },
    })
    if (!res.ok) return null
    const json: NominatimResponse = await res.json()
    const rawState = json.address?.state ?? ''
    const rawCounty = json.address?.county ?? json.address?.state_district ?? ''
    if (!rawState) return null
    const stateAbbrev = STATE_ABBREV[rawState.toLowerCase()] ?? rawState.toUpperCase().slice(0, 2)
    return { state: stateAbbrev, county: rawCounty }
  } catch {
    return null
  }
}

export async function fetchDeerPressure(lat: number, lng: number): Promise<DeerPressureSummary | null> {
  try {
    const geo = await reverseGeocode(lat, lng)
    if (!geo) return null

    const { state, county } = geo
    const countyData = lookupCountyData(state, county)

    if (!countyData) {
      // State not in our whitetail database — return minimal response
      return {
        state,
        county,
        harvestTier: 'unknown',
        annualHarvestPer1000Acres: 'unknown',
        pressureNotes: `${state} harvest data not in current database. Check state DNR for county-level harvest reports.`,
        managementNotes: 'Standard whitetail management principles apply. Refer to state DNR for current regulations.',
      }
    }

    const seasons = STATE_SEASONS[state]
    const managementNotes = buildManagementNotes(countyData.tier, state)

    return {
      state,
      county,
      harvestTier: countyData.tier,
      annualHarvestPer1000Acres: countyData.harvestRange,
      pressureNotes: countyData.notes,
      archeryDates: seasons?.archery,
      rifleDates: seasons?.rifle,
      muzzleloaderDates: seasons?.muzzleloader,
      managementNotes,
    }
  } catch {
    return null
  }
}
