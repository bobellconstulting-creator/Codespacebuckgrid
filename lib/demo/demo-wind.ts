// lib/demo/demo-wind.ts
// Deterministic wind forecast for /demo so "Tonight's Sit" always has a crisp,
// reliable answer with no spinner or dead air — even if the live /api/wind
// (Open-Meteo) is slow or blocked. Models a textbook rut cold front: a light SW
// flow ahead of the front today, swinging hard to a building NW behind it for
// the next two days (the wind hunters live and die by during the rut).
//
// Shape matches the live /api/wind payload, so the same windCall.ts geometry
// (rankStands / bestWindows) runs unchanged.

import { compassLabel, type HourlyWind, type WindInfo } from '../../src/components/buckgrid/wind/windCall'

export type DemoWindPayload = WindInfo & { hourly: HourlyWind[] }

// Smooth interpolation of (hour-since-start → direction°, speed mph) control
// points describing the frontal passage. Deterministic; no randomness.
const KEYS: Array<{ h: number; dir: number; spd: number }> = [
  { h: 0, dir: 205, spd: 6 }, // warm SW flow ahead of the front
  { h: 10, dir: 215, spd: 8 },
  { h: 16, dir: 250, spd: 11 }, // front arrives, wind veers
  { h: 22, dir: 300, spd: 14 }, // cold NW behind the front
  { h: 34, dir: 320, spd: 16 }, // peak NW post-frontal
  { h: 48, dir: 315, spd: 13 },
  { h: 60, dir: 325, spd: 10 },
  { h: 71, dir: 330, spd: 8 },
]

function lerpAngle(a: number, b: number, t: number): number {
  let d = ((b - a + 540) % 360) - 180
  return (a + d * t + 360) % 360
}

function sample(hour: number): { dir: number; spd: number } {
  let lo = KEYS[0]
  let hi = KEYS[KEYS.length - 1]
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (hour >= KEYS[i].h && hour <= KEYS[i + 1].h) {
      lo = KEYS[i]
      hi = KEYS[i + 1]
      break
    }
  }
  const span = hi.h - lo.h || 1
  const t = Math.max(0, Math.min(1, (hour - lo.h) / span))
  return { dir: Math.round(lerpAngle(lo.dir, hi.dir, t)), spd: Math.round(lo.spd + (hi.spd - lo.spd) * t) }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Build a 72-hour deterministic forecast anchored to local midnight today. */
export function demoWindForecast(now: Date = new Date()): DemoWindPayload {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const hourly: HourlyWind[] = []
  for (let i = 0; i < 72; i++) {
    const t = new Date(start.getTime() + i * 3600_000)
    const { dir, spd } = sample(i)
    const time = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:00`
    hourly.push({ time, speedMph: spd, directionDeg: dir })
  }
  // "Current" = the hour nearest now (post-frontal NW in the canned scenario)
  const cur = sample(Math.min(71, now.getHours() + 18))
  return {
    speedMph: cur.spd,
    directionDeg: cur.dir,
    compass: compassLabel(cur.dir),
    hourly,
  }
}
