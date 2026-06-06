'use client'

import { useWildLogicStore } from '@/store/wildlogicStore'
import type { UIState } from '@/store/wildlogicStore'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = UIState['activeTab']

// ─── Icons ────────────────────────────────────────────────────────────────────

const MapIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 5l5.5-2 5 2 5.5-2v14l-5.5 2-5-2-5.5 2V5Z" strokeLinejoin="round" />
    <path d="M8.5 3v14M13.5 5v14" />
  </svg>
)

const TonyIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 4h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H7l-4 3V5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
    <circle cx="8" cy="9.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="11" cy="9.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="14" cy="9.5" r="1" fill="currentColor" stroke="none" />
  </svg>
)

const ToolsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M14.5 3a3.5 3.5 0 0 1 0 7H3" strokeLinecap="round" />
    <path d="M7.5 12a3.5 3.5 0 0 0 0 7H19" strokeLinecap="round" />
    <circle cx="7.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="14.5" cy="15.5" r="1.5" fill="currentColor" stroke="none" />
  </svg>
)

const PropertyIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 19V9l8-6 8 6v10" strokeLinejoin="round" />
    <rect x="8" y="13" width="6" height="6" />
    <path d="M11 13v6" />
    <path d="M8 16h6" />
  </svg>
)

// ─── Tab definitions ──────────────────────────────────────────────────────────

interface TabDef {
  id: TabId
  label: string
  icon: React.ReactNode
}

const TABS: TabDef[] = [
  { id: 'map', label: 'Map', icon: <MapIcon /> },
  { id: 'tony', label: 'Tony', icon: <TonyIcon /> },
  { id: 'tools', label: 'Tools', icon: <ToolsIcon /> },
  { id: 'property', label: 'Property', icon: <PropertyIcon /> },
]

// ─── Unread indicator ─────────────────────────────────────────────────────────

function UnreadDot() {
  return (
    <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-brass-600 border border-ink-800" />
  )
}

// ─── MobileBottomNav component ────────────────────────────────────────────────

export default function MobileBottomNav() {
  const activeTab = useWildLogicStore((s) => s.activeTab)
  const setActiveTab = useWildLogicStore((s) => s.setActiveTab)
  const messages = useWildLogicStore((s) => s.messages)

  // Unread Tony indicator: any unread tony message (last message is from tony and tab is not 'tony')
  const hasUnreadTony =
    messages.length > 0 &&
    messages[messages.length - 1].role === 'tony' &&
    activeTab !== 'tony'

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-ink-800 border-t border-moss-700/20">
      <div className="flex items-stretch h-14">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          const showUnread = tab.id === 'tony' && hasUnreadTony

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors duration-150',
                isActive
                  ? 'text-moss-400'
                  : 'text-bone-600 hover:text-bone-700 active:text-bone-800',
              ].join(' ')}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute top-0 left-2 right-2 h-0.5 rounded-b bg-moss-500" />
              )}

              {/* Icon with optional unread dot */}
              <span className="relative">
                {tab.icon}
                {showUnread && <UnreadDot />}
              </span>

              {/* Label */}
              <span className="font-display text-[9px] tracking-widest uppercase leading-none">
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Safe area spacer for devices with home indicator */}
      <div className="h-safe-area-inset-bottom bg-ink-800" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
    </nav>
  )
}
