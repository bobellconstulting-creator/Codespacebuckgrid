// Wind Rose — Seasonal prevailing wind direction via Open-Meteo hourly archive
// Free, no API key. https://open-meteo.com/en/docs/historical-weather-api
// Returns hunter-relevant wind summaries: prevailing direction per season,
// dominant thermals, and stand placement rules.

export interface WindRoseSummary {
  prevailingByMonth: Record<string, { direction: string; degrees: number; label: string }>
  huntingSeasonPrevailing: string  // Oct–Nov composite
  morningThermalDirection: string  // uphill or downhill based on terrain
  standRules: string[]
  dataSource: string
}

const COMPASS_DIRS = [
  'N','NNE','NE','ENE','E','ESE','SE','SSE',
  'S','SSW','SW','WSW','W','WNW','NW','NNW'
]

function degreesToCompass(deg: number): string {
  const idx = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16
  return COMPASS_DIRS[idx]
}

function circularMean(angles: number[]): number {
  const valid = angles.filter(a => a >= 0 && a <= 360)
  if (valid.length === 0) return 0
  const sinSum = valid.reduce((s, a) => s + Math.sin(a * Math.PI / 180), 0)
  const cosSum = valid.reduce((s, a) => s + Math.cos(a * Math.PI / 180), 0)
  const mean = Math.atan2(sinSum / valid.length, cosSum / valid.length) * 180 / Math.PI
  return ((mean % 360) + 360) % 360
}

// Month ranges for hunting seasons
const HUNT_MONTHS = [9, 10, 11]  // Oct, Nov, Dec (0-indexed: 9=Oct)
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export async function fetchWindRose(
  lat: number,
  lng: number
): Promise<WindRoseSummary | null> {
  try {
    // Use current year-1 to get a full year of historical hourly wind data
    const year = new Date().getFullYear() - 1
    const url = [
      `https://archive-api.open-meteo.com/v1/archive`,
      `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}`,
      `&start_date=${year}-01-01&end_date=${year}-12-31`,
      `&hourly=wind_direction_10m,wind_speed_10m`,
      `&wind_speed_unit=mph&timezone=auto`
    ].join('')

    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return null
    const json = await res.json()

    const times: string[] = json.hourly?.time ?? []
    const dirs: number[] = json.hourly?.wind_direction_10m ?? []
    const speeds: number[] = json.hourly?.wind_speed_10m ?? []
    if (times.length === 0) return null

    // Bucket by month
    const byMonth: Record<number, { dirs: number[]; speeds: number[] }> = {}
    for (let i = 0; i < times.length; i++) {
      const month = new Date(times[i]).getMonth()  // 0-11
      const dir = dirs[i]
      const spd = speeds[i]
      if (typeof dir !== 'number' || typeof spd !== 'number') continue
      if (!byMonth[month]) byMonth[month] = { dirs: [], speeds: [] }
      // Only include observations with meaningful wind (>3 mph) to filter calm noise
      if (spd > 3) {
        byMonth[month].dirs.push(dir)
        byMonth[month].speeds.push(spd)
      }
    }

    // Compute prevailing direction per month
    const prevailingByMonth: WindRoseSummary['prevailingByMonth'] = {}
    for (const [m, data] of Object.entries(byMonth)) {
      const monthIdx = parseInt(m)
      if (data.dirs.length < 20) continue
      const meanDeg = circularMean(data.dirs)
      const label = degreesToCompass(meanDeg)
      prevailingByMonth[MONTH_NAMES[monthIdx]] = {
        direction: label,
        degrees: Math.round(meanDeg),
        label: `${label} (${Math.round(meanDeg)}°)`
      }
    }

    // Hunting season composite: Oct + Nov
    const huntDirs: number[] = []
    for (const m of HUNT_MONTHS) {
      if (byMonth[m]) huntDirs.push(...byMonth[m].dirs)
    }
    const huntPrevailing = huntDirs.length > 0
      ? degreesToCompass(circularMean(huntDirs))
      : 'unknown'

    // Stand placement rules derived from prevailing direction
    const standRules = buildStandRules(huntPrevailing, prevailingByMonth)

    return {
      prevailingByMonth,
      huntingSeasonPrevailing: huntPrevailing,
      morningThermalDirection: 'downhill (thermals descend at dawn, rise at dusk — universal)',
      standRules,
      dataSource: `Open-Meteo archive ${year}, hourly wind ≥3 mph`
    }
  } catch {
    return null
  }
}

function buildStandRules(prevailing: string, byMonth: WindRoseSummary['prevailingByMonth']): string[] {
  const rules: string[] = []

  const oppDir = getOppositeDirection(prevailing)
  rules.push(`PREVAILING WIND (Oct-Nov): ${prevailing} — place stands on the ${oppDir} side of feeding areas so wind carries scent away from approach routes`)
  rules.push(`STAND ENTRY: always approach from the downwind side — enter into the wind, not with it at your back`)

  const octWind = byMonth['Oct']?.direction
  const novWind = byMonth['Nov']?.direction
  if (octWind && novWind && octWind !== novWind) {
    rules.push(`WIND SHIFT WARNING: October prevails ${octWind}, November shifts to ${novWind} — have stands sited for both directions. Cold fronts in November can rotate wind 90-180° within hours.`)
  }

  const morningWind = byMonth['Oct']?.direction ?? prevailing
  rules.push(`MORNING THERMALS (dawn-10am): air cools and sinks downhill. Site morning stands on ridges or benches, NOT in drainages — cold air pools scent in low areas. Wind direction matters less at first light; thermal direction matters more.`)
  rules.push(`EVENING THERMALS (3pm-dark): air warms and rises uphill. Evening stands in drainages and low points get thermal lift carrying scent uphill toward bedding. Use prevailing ${morningWind} wind direction for evening stand selection.`)

  return rules
}

function getOppositeDirection(dir: string): string {
  const map: Record<string, string> = {
    'N':'S','NNE':'SSW','NE':'SW','ENE':'WSW',
    'E':'W','ESE':'WNW','SE':'NW','SSE':'NNW',
    'S':'N','SSW':'NNE','SW':'NE','WSW':'ENE',
    'W':'E','WNW':'ESE','NW':'SE','NNW':'SSE'
  }
  return map[dir] ?? 'opposite'
}
