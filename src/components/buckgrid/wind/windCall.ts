// Wind-aware stand ranking — pure geometry, zero AI tokens per call.
// Scent travels downwind from the stand; any bedding/sanctuary zone inside
// that cone gets the sit penalized hard. Shared by the API-fed client card
// and anything else that needs a "tonight's sit" verdict.

export type WindInfo = {
  speedMph: number
  directionDeg: number // meteorological: direction the wind blows FROM
  compass: string
}

export type SitTarget = { name: string; lat: number; lng: number }
export type CoverZone = { name: string; lat: number; lng: number }

export type SitCall = {
  name: string
  score: number // 0-95, higher = cleaner sit
  reason: string
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

export function compassLabel(deg: number): string {
  return COMPASS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]
}

function toRad(d: number): number {
  return (d * Math.PI) / 180
}

export function distanceYards(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h)) * 1.09361
}

export function bearingDeg(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const y = Math.sin(toRad(bLng - aLng)) * Math.cos(toRad(bLat))
  const x =
    Math.cos(toRad(aLat)) * Math.sin(toRad(bLat)) -
    Math.sin(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(toRad(bLng - aLng))
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

// Scent cone half-angle and the range past which a plume stops mattering
const CONE_DEG = 55
const RANGE_YDS = 900

export function rankStands(stands: SitTarget[], cover: CoverZone[], wind: WindInfo): SitCall[] {
  const scentTo = (wind.directionDeg + 180) % 360
  return stands
    .map(stand => {
      let score = 84
      let worst: { zone: CoverZone; yds: number; sev: number } | null = null
      for (const zone of cover) {
        const yds = distanceYards(stand.lat, stand.lng, zone.lat, zone.lng)
        if (yds > RANGE_YDS || yds < 1) continue
        const diff = angleDiff(bearingDeg(stand.lat, stand.lng, zone.lat, zone.lng), scentTo)
        if (diff >= CONE_DEG) continue
        const sev = (1 - yds / RANGE_YDS) * (1 - diff / CONE_DEG)
        score -= Math.round(18 + 48 * sev)
        if (!worst || sev > worst.sev) worst = { zone, yds: Math.round(yds / 10) * 10, sev }
      }
      score = Math.max(8, Math.min(95, score))
      const reason = worst
        ? `${wind.compass} wind pushes your scent toward ${worst.zone.name} (~${worst.yds} yds downwind). Sit it anyway and you educate every deer bedded there.`
        : `${wind.compass} at ${wind.speedMph} mph keeps your scent clear of every bedding zone on the map. Clean sit.`
      return { name: stand.name, score, reason }
    })
    .sort((a, b) => b.score - a.score)
}
