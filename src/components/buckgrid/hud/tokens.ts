// src/components/buckgrid/hud/tokens.ts
// HUD design tokens — extracted verbatim from the 90s demo render engine
// (~/Desktop/buckgrid-pro-demo/pipeline/render.py) so the live product matches
// the ad pixel-for-pixel. Single source of truth for the BuckGrid Pro HUD skin.

/** Core palette (hex), from render.py RGB tuples. */
export const HUD = {
  // backgrounds (near-black forest green)
  bark: '#0F2218', // (15,34,24) darkest
  spruce: '#16291E', // (22,41,30)
  field: '#2C4A37', // (44,74,55) rules / hairlines
  panel: '#0A1411', // (10,20,14) panel fill base
  panelGlass: 'rgba(10,24,17,0.82)', // chip/card glass
  // accents
  blaze: '#E45A24', // (228,90,36) primary orange — PRO chip, stands, CTA
  ember: '#F2A14B', // (242,161,75) amber — outlines, data accents
  // text
  bone: '#F4EFE3', // (244,239,227) primary text
  sage: '#7FB08F', // (127,176,143) secondary / mono sub
  antler: '#C2AE8A', // (194,174,138) HUD brackets, bedding
  moss: '#5E7464', // (94,116,100)
  steel: '#5E7C8A', // (94,124,138) water
  // zone colors
  sanctuary: '#5E7464', // SANCT
  bedding: '#C2AE8A', // ANTLER
  water: '#5E7C8A', // STEEL
  foodPlot: '#3E7152', // FOODPLOT (62,113,82)
  killPlot: '#7FB08F', // KILLPLOT
  staging: '#E0A23B', // STAGING (224,162,59)
  stand: '#E45A24', // BLAZE
  access: '#F2A14B', // EMBER
  success: '#50AA6E', // (80,170,110)
} as const

/** Per-zone HUD color + display label, matching the demo's PLAN_LABELS. */
export const ZONE_HUD: Record<string, { color: string; label: string }> = {
  sanctuary: { color: HUD.sanctuary, label: 'SANCTUARY' },
  bedding: { color: HUD.bedding, label: 'BEDDING' },
  water: { color: HUD.water, label: 'WATER' },
  food_plot: { color: HUD.foodPlot, label: 'FOOD PLOT' },
  food: { color: HUD.foodPlot, label: 'FOOD PLOT' },
  kill_plot: { color: HUD.killPlot, label: 'KILL PLOT' },
  staging_area: { color: HUD.staging, label: 'STAGING' },
  stand: { color: HUD.stand, label: 'STAND' },
  stand_site: { color: HUD.stand, label: 'STAND' },
  access_route: { color: HUD.access, label: 'ACCESS' },
  access_trail: { color: HUD.access, label: 'ACCESS' },
}

/** Font stacks. Display = Big Shoulders Display, data = JetBrains Mono, body = Inter. */
export const FONT = {
  display: "'Big Shoulders Display','Oswald','Teko',sans-serif",
  mono: "'JetBrains Mono','Share Tech Mono',ui-monospace,monospace",
  body: "'Inter','Barlow Condensed',system-ui,sans-serif",
} as const

/** Convert hex → rgba() string. */
export function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
