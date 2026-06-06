'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useWildLogicStore } from '@/store/wildlogicStore'
import WildLogicMark from '@/components/WildLogicMark'
import PaywallModal from './PaywallModal'

// ─── Boundary tool icon (inline SVG, no external deps) ────────────────────────

function BoundaryIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <polygon
        points="10,2 18,7 18,13 10,18 2,13 2,7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="10" cy="2" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="18" cy="7" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="18" cy="13" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="10" cy="18" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="2" cy="13" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="2" cy="7" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  )
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface WildLogicOnboardingProps {
  onAnalyze: () => void
  onUpgrade: () => void
  hasDrawnBoundary: boolean
  propertyAcres: number
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function WildLogicOnboarding({
  onAnalyze,
  onUpgrade,
  hasDrawnBoundary,
  propertyAcres,
}: WildLogicOnboardingProps) {
  const paywallHit = useWildLogicStore((s) => s.paywallHit)
  const setPaywallHit = useWildLogicStore((s) => s.setPaywallHit)

  const handleUpgrade = () => {
    setPaywallHit(false)
    onUpgrade()
  }

  const handleDismissPaywall = () => {
    setPaywallHit(false)
  }

  return (
    <>
      {/* ── Floating instruction card — bottom-left ────────────────────────── */}
      <div className="fixed bottom-6 left-6 z-50 pointer-events-none">
        <AnimatePresence mode="wait">
          {!hasDrawnBoundary ? (
            /* Step 1 — draw boundary */
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto w-72 rounded-xl bg-ink-800/95 backdrop-blur-sm border-t-2 border-moss-600 shadow-2xl overflow-hidden"
            >
              {/* Moss top gradient accent under border */}
              <div className="h-px w-full bg-gradient-to-r from-moss-800/50 via-moss-500/30 to-transparent" />

              <div className="px-5 py-4 flex items-start gap-4">
                {/* WildLogic mark */}
                <WildLogicMark className="w-7 h-7 flex-shrink-0 mt-0.5 text-moss-500" />

                <div className="flex flex-col gap-2 min-w-0">
                  <p className="font-display text-sm uppercase tracking-widest text-moss-500 leading-none">
                    Step 1
                  </p>
                  <p className="font-body text-sm text-bone-900 leading-snug">
                    Draw your property boundary to start.
                  </p>
                  {/* Boundary tool callout */}
                  <div className="flex items-center gap-2 mt-1">
                    <BoundaryIcon className="w-4 h-4 text-brass-600 flex-shrink-0" />
                    <span className="font-body text-xs text-bone-700 uppercase tracking-wider">
                      Boundary tool
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Step 2 — boundary drawn, prompt analyze */
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto w-72 rounded-xl bg-ink-800/95 backdrop-blur-sm border-t-2 border-moss-600 shadow-2xl overflow-hidden"
            >
              <div className="h-px w-full bg-gradient-to-r from-moss-800/50 via-moss-500/30 to-transparent" />

              <div className="px-5 py-4 flex items-start gap-4">
                <WildLogicMark className="w-7 h-7 flex-shrink-0 mt-0.5 text-moss-500" />

                <div className="flex flex-col gap-2 min-w-0">
                  <p className="font-display text-sm uppercase tracking-widest text-moss-500 leading-none">
                    Step 2
                  </p>
                  <p className="font-body text-sm text-bone-900 leading-snug">
                    Tony is ready. Tap &ldquo;Analyze with Tony&rdquo;&nbsp;&rarr;
                  </p>

                  {/* Acreage badge */}
                  {propertyAcres > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.15, duration: 0.25 }}
                      className="mt-1 self-start"
                    >
                      <span className="font-display text-2xl uppercase tracking-widest text-brass-600 leading-none">
                        {propertyAcres.toLocaleString()} ACRES
                      </span>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Analyze FAB — bottom-center ────────────────────────────────────── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center">
        <AnimatePresence>
          {hasDrawnBoundary && (
            <motion.div
              key="analyze-fab"
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.9 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto relative"
            >
              {/* Pulsing glow ring */}
              <motion.span
                aria-hidden
                animate={{
                  scale: [1, 1.45, 1],
                  opacity: [0.55, 0, 0.55],
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="absolute inset-0 rounded-2xl bg-brass-600/40 pointer-events-none"
              />

              {/* Second, offset ring for depth */}
              <motion.span
                aria-hidden
                animate={{
                  scale: [1, 1.7, 1],
                  opacity: [0.3, 0, 0.3],
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 0.4,
                }}
                className="absolute inset-0 rounded-2xl bg-brass-700/30 pointer-events-none"
              />

              <button
                onClick={onAnalyze}
                className="relative px-8 py-4 rounded-2xl font-display text-xl uppercase tracking-widest text-ink-900 bg-gradient-to-r from-brass-700 to-brass-500 hover:from-brass-600 hover:to-brass-400 active:scale-[0.97] transition-all duration-150 shadow-xl shadow-brass-900/40 whitespace-nowrap"
              >
                Analyze with Tony &rarr;
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Paywall modal overlay ──────────────────────────────────────────── */}
      <PaywallModal
        isOpen={paywallHit}
        onUpgrade={handleUpgrade}
        onDismiss={handleDismissPaywall}
      />
    </>
  )
}
