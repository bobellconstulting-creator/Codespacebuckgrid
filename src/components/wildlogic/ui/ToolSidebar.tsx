'use client'

import { useEffect } from 'react'
import * as Select from '@radix-ui/react-select'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useWildLogicStore } from '@/store/wildlogicStore'
import type { MapState, UIState } from '@/store/wildlogicStore'

// ─── Types ────────────────────────────────────────────────────────────────────

type ToolId = MapState['activeTool']
type Season = UIState['season']

interface ToolDef {
  id: ToolId
  label: string
  icon: React.ReactNode
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const BoundaryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <polygon points="10,2 18,7 18,13 10,18 2,13 2,7" />
    <circle cx="10" cy="2" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="18" cy="7" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="18" cy="13" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="10" cy="18" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="2" cy="13" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="2" cy="7" r="1.5" fill="currentColor" stroke="none" />
  </svg>
)

const FoodPlotIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="8" width="14" height="9" rx="1" />
    <path d="M10 8V5" />
    <path d="M10 5C10 5 7 3 7 1" />
    <path d="M10 5C10 5 13 3 13 1" />
    <path d="M6 11h8M6 14h8" strokeDasharray="2 2" />
  </svg>
)

const BeddingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 14C3 14 5 9 10 9C15 9 17 14 17 14" strokeLinejoin="round" />
    <path d="M2 14h16" strokeLinecap="round" />
    <path d="M7 9C7 7 8.5 5 10 5C11.5 5 13 7 13 9" />
    <circle cx="10" cy="4" r="1.5" fill="currentColor" stroke="none" />
  </svg>
)

const TrailIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 17C5 14 4 12 6 10C8 8 8 6 10 4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" />
    <path d="M17 17C15 14 16 12 14 10C12 8 12 6 10 4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" />
    <circle cx="10" cy="4" r="1.5" fill="currentColor" stroke="none" />
  </svg>
)

const StandIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="10" cy="3.5" r="2" />
    <path d="M10 5.5V10" strokeLinecap="round" />
    <path d="M7 8h6" strokeLinecap="round" />
    <path d="M8.5 10L7 15" strokeLinecap="round" />
    <path d="M11.5 10L13 15" strokeLinecap="round" />
    <rect x="5" y="15" width="10" height="3" rx="0.5" fill="currentColor" stroke="none" opacity="0.4" />
  </svg>
)

const WaterIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M10 3C10 3 5 9 5 13C5 15.76 7.24 18 10 18C12.76 18 15 15.76 15 13C15 9 10 3 10 3Z" strokeLinejoin="round" />
    <path d="M7.5 14.5C7.5 13.12 8.3 12 9.5 11.5" strokeLinecap="round" opacity="0.6" />
  </svg>
)

const MineralIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polygon points="10,3 14,8 12,15 8,15 6,8" strokeLinejoin="round" />
    <path d="M6 8l4 3 4-3M8 15l2-7 2 7" opacity="0.5" />
  </svg>
)

const UndoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 5h6a4 4 0 0 1 0 8H5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 5L5 2M2 5l3 3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 3.5h10M5 3.5V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1M5.5 6v4M8.5 6v4M3 3.5l.75 8a.5.5 0 0 0 .5.5h5.5a.5.5 0 0 0 .5-.5L11 3.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const SaveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 12V3.5L4.5 1h6.5a.5.5 0 0 1 .5.5V12a.5.5 0 0 1-.5.5H2.5A.5.5 0 0 1 2 12Z" strokeLinejoin="round" />
    <path d="M5 1v3.5h5V1M4.5 12V8.5h5V12" strokeLinejoin="round" />
  </svg>
)

const LockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="5.5" width="8" height="5.5" rx="1" />
    <path d="M4 5.5V4a2 2 0 1 1 4 0v1.5" />
  </svg>
)

const ChevronDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2.5 4.5L6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ChevronUpIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2.5 7.5L6 4l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// ─── Tool definitions ─────────────────────────────────────────────────────────

const NavIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M10 3L13 17L10 13.5L7 17L10 3Z" strokeLinejoin="round" />
  </svg>
)

const TOOLS: ToolDef[] = [
  { id: 'nav', label: 'Pan', icon: <NavIcon /> },
  { id: 'boundary', label: 'Boundary', icon: <BoundaryIcon /> },
  { id: 'food_plot', label: 'Food Plot', icon: <FoodPlotIcon /> },
  { id: 'bedding', label: 'Bedding', icon: <BeddingIcon /> },
  { id: 'trail', label: 'Trail', icon: <TrailIcon /> },
  { id: 'stand', label: 'Stand', icon: <StandIcon /> },
  { id: 'water', label: 'Water', icon: <WaterIcon /> },
  { id: 'mineral', label: 'Mineral', icon: <MineralIcon /> },
]

const SEASONS: Season[] = ['Spring', 'Summer', 'Early Fall', 'Rut', 'Late Season']

const SEASON_TIPS: Record<Season, string> = {
  Spring: 'Deer shed & recover.\nScouting sheds & browse.',
  Summer: 'Bachelor groups form.\nMineral & water critical.',
  'Early Fall': 'Patterns predictable.\nFood plots most active.',
  Rut: 'Bucks cover ground.\nStand near travel routes.',
  'Late Season': 'Deer focus on food.\nCaloric intake is key.',
}

const SEASON_BADGE_COLORS: Record<Season, string> = {
  Spring: 'bg-moss-500/20 text-moss-400 border-moss-600/30',
  Summer: 'bg-brass-700/20 text-brass-600 border-brass-700/30',
  'Early Fall': 'bg-terra/20 text-terra border-terra/30',
  Rut: 'bg-red-900/30 text-red-400 border-red-800/40',
  'Late Season': 'bg-ink-600 text-bone-700 border-ink-600',
}

// ─── ToolSidebar component ────────────────────────────────────────────────────

export default function ToolSidebar() {
  const activeTool = useWildLogicStore((s) => s.activeTool)
  const setActiveTool = useWildLogicStore((s) => s.setActiveTool)
  const season = useWildLogicStore((s) => s.season)
  const setSeason = useWildLogicStore((s) => s.setSeason)
  const paywallHit = useWildLogicStore((s) => s.paywallHit)
  const clearUserFeatures = useWildLogicStore((s) => s.clearUserFeatures)
  const removeUserFeature = useWildLogicStore((s) => s.removeUserFeature)
  const userFeatures = useWildLogicStore((s) => s.userFeatures)
  const tonyZones = useWildLogicStore((s) => s.tonyZones)
  const boundary = useWildLogicStore((s) => s.boundary)
  const acres = useWildLogicStore((s) => s.acres)
  const name = useWildLogicStore((s) => s.name)


  // Start on boundary tool (not nav) by default
  useEffect(() => {
    if (activeTool === 'nav') setActiveTool('boundary')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const featureCount = userFeatures.length + tonyZones.length + (boundary ? 1 : 0)

  const handleUndo = () => {
    if (userFeatures.length > 0) {
      removeUserFeature(userFeatures.length - 1)
    }
  }

  const handleClearAll = () => {
    clearUserFeatures()
  }

  return (
    <Tooltip.Provider delayDuration={500}>
    <aside className="hidden md:flex flex-col w-[220px] h-full bg-ink-700 border-r border-moss-700/15 overflow-y-auto overflow-x-hidden">

      {/* DRAW SECTION */}
      <div className="px-3 pt-4 pb-2">
        <p className="font-display text-[11px] tracking-widest uppercase text-bone-600 mb-2 px-1">
          Draw
        </p>
        <div className="flex flex-col gap-0.5">
          {TOOLS.map((tool) => {
            const isActive = activeTool === tool.id
            const tips: Record<ToolId, string> = {
              nav: 'Pan and zoom the map',
              boundary: 'Draw your property boundary',
              food_plot: 'Mark food plot areas',
              bedding: 'Mark bedding / sanctuary areas',
              trail: 'Draw travel corridors & trails',
              stand: 'Place stand or blind sites',
              water: 'Mark water sources',
              mineral: 'Mark mineral / lick sites',
            }
            return (
              <Tooltip.Root key={tool.id}>
                <Tooltip.Trigger asChild>
                  <button
                    onClick={() => setActiveTool(tool.id)}
                    aria-label={tips[tool.id]}
                    className={[
                      'flex items-center gap-2.5 w-full px-2.5 py-2 rounded transition-all duration-150',
                      isActive
                        ? 'bg-moss-700/30 border border-moss-600/50 text-moss-400'
                        : 'border border-transparent text-bone-700 hover:text-bone-800 hover:bg-ink-600/40',
                    ].join(' ')}
                  >
                    <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                      {tool.icon}
                    </span>
                    <span className="font-display text-xs tracking-widest uppercase leading-none">
                      {tool.label}
                    </span>
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="right"
                    sideOffset={8}
                    className="z-[100] px-2.5 py-1.5 rounded bg-ink-900 border border-moss-700/20 shadow-xl font-body text-xs text-bone-800 max-w-[160px]"
                  >
                    {tips[tool.id]}
                    <Tooltip.Arrow className="fill-ink-900" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            )
          })}
        </div>
      </div>

      <div className="mx-3 my-1 border-t border-moss-700/15" />

      {/* SEASON SECTION — Radix Select */}
      <div className="px-3 py-3">
        <p className="font-display text-[11px] tracking-widest uppercase text-bone-600 mb-2">
          Season
        </p>
        <Select.Root value={season} onValueChange={(v) => setSeason(v as Season)}>
          <Select.Trigger
            className={[
              'flex items-center justify-between w-full px-2.5 py-2 rounded border transition-colors outline-none',
              'focus-visible:ring-1 focus-visible:ring-moss-500',
              SEASON_BADGE_COLORS[season],
            ].join(' ')}
            aria-label="Select season"
          >
            <Select.Value>
              <span className="font-display text-xs tracking-widest uppercase">{season}</span>
            </Select.Value>
            <Select.Icon className="opacity-60">
              <ChevronDownIcon />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content
              position="popper"
              sideOffset={4}
              className="z-[100] w-[188px] rounded bg-ink-800 border border-ink-600 shadow-xl overflow-hidden"
            >
              <Select.Viewport>
                {SEASONS.map((s) => (
                  <Select.Item
                    key={s}
                    value={s}
                    className={[
                      'flex items-center w-full px-2.5 py-2 cursor-pointer outline-none transition-colors select-none',
                      s === season
                        ? 'bg-moss-700/30 text-moss-400'
                        : 'text-bone-700 hover:bg-ink-600/60 hover:text-bone-800 data-[highlighted]:bg-ink-600/60 data-[highlighted]:text-bone-800',
                    ].join(' ')}
                  >
                    <Select.ItemText>
                      <span className="font-display text-xs tracking-widest uppercase">{s}</span>
                    </Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
        <p className="font-mono text-[10px] text-bone-600 leading-relaxed mt-2 whitespace-pre-line px-0.5">
          {SEASON_TIPS[season]}
        </p>
      </div>

      <div className="mx-3 my-1 border-t border-moss-700/15" />

      {/* ACTIONS SECTION */}
      <div className="px-3 py-2">
        <p className="font-display text-[11px] tracking-widest uppercase text-bone-600 mb-2">
          Actions
        </p>
        <div className="flex flex-col gap-1">
          <button
            onClick={handleUndo}
            disabled={userFeatures.length === 0}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded text-bone-700 hover:text-bone-800 hover:bg-ink-600/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <span className="shrink-0"><UndoIcon /></span>
            <span className="font-display text-xs tracking-widest uppercase">Undo Last</span>
          </button>

          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded text-bone-700 hover:text-red-400/80 hover:bg-red-900/10 transition-all"
          >
            <span className="shrink-0"><TrashIcon /></span>
            <span className="font-display text-xs tracking-widest uppercase">Clear All</span>
          </button>

          {paywallHit ? (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded text-bone-600 cursor-not-allowed opacity-60"
                  disabled
                  aria-label="Save property — Pro required"
                >
                  <span className="shrink-0"><SaveIcon /></span>
                  <span className="font-display text-xs tracking-widest uppercase">Save Property</span>
                  <span className="ml-auto text-brass-700"><LockIcon /></span>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content side="right" sideOffset={8} className="z-[100] px-2.5 py-1.5 rounded bg-ink-900 border border-moss-700/20 shadow-xl font-body text-xs text-bone-800">
                  Upgrade to Pro to save properties
                  <Tooltip.Arrow className="fill-ink-900" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          ) : (
            <button className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded text-moss-400 hover:text-moss-400 hover:bg-moss-700/20 transition-all">
              <span className="shrink-0"><SaveIcon /></span>
              <span className="font-display text-xs tracking-widest uppercase">Save Property</span>
            </button>
          )}
        </div>
      </div>

      <div className="mx-3 my-1 border-t border-moss-700/15" />

      {/* PROPERTY INFO */}
      <div className="px-3 py-2 mt-auto">
        <p className="font-display text-[11px] tracking-widest uppercase text-bone-600 mb-2">
          Property
        </p>
        <div className="flex flex-col gap-2 px-0.5">
          <div>
            <p className="font-mono text-[10px] text-bone-600 uppercase tracking-widest">Name</p>
            <p className="font-display text-xs tracking-wide text-bone-800 truncate mt-0.5">
              {name || <span className="text-bone-600 italic normal-case font-body text-[11px]">Unnamed</span>}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-bone-600 uppercase tracking-widest">Acreage</p>
            <p className="font-display text-xs tracking-wide text-bone-800 mt-0.5">
              {acres > 0 ? (
                <>{acres.toFixed(1)} <span className="text-bone-600 font-mono text-[10px] normal-case">ac</span></>
              ) : (
                <span className="text-bone-600 italic normal-case font-body text-[11px]">Not drawn</span>
              )}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-bone-600 uppercase tracking-widest">Features</p>
            <p className="font-display text-xs tracking-wide text-bone-800 mt-0.5">
              {featureCount > 0 ? (
                <>{featureCount} <span className="text-bone-600 font-mono text-[10px] normal-case">on map</span></>
              ) : (
                <span className="text-bone-600 italic normal-case font-body text-[11px]">None yet</span>
              )}
            </p>
          </div>
        </div>
      </div>

    </aside>
    </Tooltip.Provider>
  )
}
