'use client'

import { useWildLogicStore } from '@/store/wildlogicStore'
import WildLogicMark from '@/components/WildLogicMark'

export default function WildLogicHeader() {
  const propertyName = useWildLogicStore((s) => s.name)
  const setPropertyName = useWildLogicStore((s) => s.setPropertyName)
  const propertyAcres = useWildLogicStore((s) => s.acres)
  const season = useWildLogicStore((s) => s.season)
  const isAnalyzing = useWildLogicStore((s) => s.isAnalyzing)
  const messages = useWildLogicStore((s) => s.messages)
  const toggleTonyPanel = useWildLogicStore((s) => s.toggleTonyPanel)
  const setTonyPanelOpen = useWildLogicStore((s) => s.setTonyPanelOpen)
  const setActiveTab = useWildLogicStore((s) => s.setActiveTab)

  const hasAnalysis = messages.some((m) => m.role === 'tony' && m.tonyZoneIds.length > 0)

  const seasonDotColor: Record<typeof season, string> = {
    Spring: 'bg-moss-400',
    Summer: 'bg-moss-500',
    'Early Fall': 'bg-brass-600',
    Rut: 'bg-terra',
    'Late Season': 'bg-bone-700',
  }

  function handleAskTony() {
    setTonyPanelOpen(true)
  }

  function handleHowItWorks() {
    setTonyPanelOpen(true)
    // Tony will receive guidance context via the panel's default open state
  }

  function handleOpenTools() {
    setActiveTab('tools')
  }

  return (
    <header
      className={[
        'fixed top-0 left-0 right-0 z-50',
        'h-16',
        'bg-ink-800/95 backdrop-blur-sm',
        'border-b border-moss-700/20',
        'shadow-[0_1px_12px_0_rgba(107,122,87,0.12)]',
        'flex items-center px-4 gap-3',
      ].join(' ')}
    >
      {/* ── Left section ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Desktop: full wordmark */}
        <div className="hidden md:block">
          <WildLogicMark size={36} variant="full" />
        </div>
        {/* Mobile: mark only */}
        <div className="block md:hidden">
          <WildLogicMark size={36} variant="mark" />
        </div>

        {/* Vertical divider — desktop only */}
        <div className="hidden md:block w-px h-8 bg-moss-700/30" />
      </div>

      {/* ── Center section — desktop only ────────────────────────────── */}
      <div className="hidden md:flex flex-1 items-center gap-3 min-w-0">
        {/* Editable property name */}
        <input
          type="text"
          value={propertyName}
          onChange={(e) => setPropertyName(e.target.value)}
          placeholder="Property Name"
          className={[
            'bg-transparent',
            'text-bone-900 placeholder-bone-600',
            'font-display text-xl uppercase tracking-wide',
            'border-b border-transparent',
            'focus:border-b focus:border-moss-600',
            'outline-none',
            'px-0 py-0.5',
            'min-w-0 max-w-xs',
            'transition-colors duration-150',
          ].join(' ')}
        />

        {/* Acreage badge */}
        {propertyAcres > 0 && (
          <span
            className={[
              'shrink-0',
              'inline-flex items-center',
              'px-2 py-0.5',
              'rounded',
              'bg-brass-900/40 border border-brass-700/50',
              'text-brass-500 font-display text-sm uppercase tracking-wider',
            ].join(' ')}
          >
            {Math.round(propertyAcres).toLocaleString()} AC
          </span>
        )}
      </div>

      {/* Spacer — pushes right section to the end on desktop */}
      <div className="flex-1 md:flex-none" />

      {/* ── Right section ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Season chip — desktop only */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink-700/60 border border-moss-700/25">
          <span className={`w-2 h-2 rounded-full shrink-0 ${seasonDotColor[season]}`} />
          <span className="text-moss-500 font-body text-xs font-medium tracking-wide">
            {season}
          </span>
        </div>

        {/* "How It Works" ghost button — desktop only */}
        <button
          type="button"
          onClick={handleHowItWorks}
          className={[
            'hidden md:inline-flex items-center',
            'px-3 py-1.5 rounded',
            'border border-moss-700/40',
            'text-moss-500 hover:text-moss-400',
            'hover:border-moss-600/60',
            'font-body text-xs font-medium',
            'transition-colors duration-150',
            'whitespace-nowrap',
          ].join(' ')}
        >
          How It Works
        </button>

        {/* Ask Tony button — shared desktop + mobile */}
        {isAnalyzing ? (
          <button
            type="button"
            disabled
            className={[
              'inline-flex items-center gap-2',
              'px-4 py-2 rounded',
              'bg-ink-700 border border-moss-700/30',
              'text-moss-500 font-display text-sm uppercase tracking-wider',
              'cursor-not-allowed',
            ].join(' ')}
          >
            {/* Spinner */}
            <span
              className={[
                'w-3.5 h-3.5 rounded-full',
                'border-2 border-moss-700/40 border-t-moss-500',
                'animate-spin',
              ].join(' ')}
            />
            Analyzing...
          </button>
        ) : (
          <button
            type="button"
            onClick={handleAskTony}
            className={[
              'inline-flex items-center',
              'px-4 py-2 rounded',
              'bg-gradient-to-r from-brass-800 to-brass-600',
              'text-ink-900 font-display text-sm uppercase tracking-wider',
              'hover:from-brass-700 hover:to-brass-500',
              'transition-all duration-150',
              !hasAnalysis
                ? 'shadow-[0_0_12px_0_rgba(184,146,58,0.45)] hover:shadow-[0_0_18px_0_rgba(184,146,58,0.6)]'
                : 'shadow-none',
            ].join(' ')}
          >
            Ask Tony &rarr;
          </button>
        )}

        {/* Hamburger / tools — mobile only */}
        <button
          type="button"
          onClick={handleOpenTools}
          aria-label="Open tools"
          className={[
            'flex md:hidden',
            'items-center justify-center',
            'w-9 h-9 rounded',
            'border border-moss-700/30',
            'text-bone-700 hover:text-bone-900',
            'hover:border-moss-600/50',
            'transition-colors duration-150',
          ].join(' ')}
        >
          {/* Three-line hamburger icon */}
          <svg
            width="18"
            height="14"
            viewBox="0 0 18 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M1 1H17M1 7H17M1 13H17"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </header>
  )
}
