'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import WildLogicMark from '@/components/WildLogicMark'

interface PaywallModalProps {
  isOpen: boolean
  onUpgrade: () => void
  onDismiss: () => void
}

const features = [
  'Unlimited Tony analysis sessions',
  'Save & revisit unlimited properties',
  'Full season-by-season breakdown',
  'Mobile access — field-ready maps',
]

function CheckIcon() {
  return (
    <svg
      className="w-2.5 h-2.5 text-moss-400"
      fill="none"
      viewBox="0 0 10 8"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M1 4l2.5 2.5L9 1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function PaywallModal({ isOpen, onUpgrade, onDismiss }: PaywallModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onDismiss()}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            {/* Backdrop */}
            <Dialog.Overlay asChild>
              <motion.div
                key="paywall-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[200] bg-ink-900/80 backdrop-blur-md"
              />
            </Dialog.Overlay>

            {/* Content */}
            <Dialog.Content asChild>
              <motion.div
                key="paywall-card"
                initial={{ opacity: 0, scale: 0.92, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 24 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-0 z-[201] flex items-center justify-center pointer-events-none"
              >
                <div className="relative w-full max-w-sm mx-4 rounded-2xl bg-ink-800 border border-ink-600 shadow-2xl overflow-hidden pointer-events-auto">
                  {/* Moss accent bar */}
                  <div className="h-1 w-full bg-gradient-to-r from-moss-800 via-moss-500 to-moss-700" />

                  <div className="px-8 pt-8 pb-10 flex flex-col items-center gap-6">
                    {/* Logo */}
                    <WildLogicMark size={40} variant="mark" />

                    {/* Heading */}
                    <Dialog.Title asChild>
                      <div className="text-center">
                        <h2 className="font-display text-3xl uppercase tracking-widest text-bone-900 leading-tight">
                          Upgrade to
                        </h2>
                        <h2 className="font-display text-3xl uppercase tracking-widest text-brass-600 leading-tight">
                          WildLogic Pro
                        </h2>
                      </div>
                    </Dialog.Title>

                    <Dialog.Description className="sr-only">
                      Upgrade to WildLogic Pro for unlimited Tony analyses, property saves, and more.
                    </Dialog.Description>

                    {/* Feature list */}
                    <ul className="w-full flex flex-col gap-3">
                      {features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-moss-800 flex items-center justify-center">
                            <CheckIcon />
                          </span>
                          <span className="font-body text-sm text-bone-800 leading-snug">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* Price block */}
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-display text-5xl uppercase text-brass-600 leading-none tracking-wide">
                        $79
                      </span>
                      <span className="font-body text-xs text-bone-700 uppercase tracking-widest">
                        per year — less than $7/month
                      </span>
                    </div>

                    {/* Upgrade CTA */}
                    <button
                      onClick={onUpgrade}
                      className="w-full py-4 rounded-xl font-display text-xl uppercase tracking-widest text-ink-900 bg-gradient-to-r from-brass-700 to-brass-500 hover:from-brass-600 hover:to-brass-400 active:scale-[0.98] transition-all duration-150 shadow-lg shadow-brass-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-800"
                    >
                      Upgrade Now
                    </button>

                    {/* Dismiss */}
                    <Dialog.Close asChild>
                      <button className="font-body text-xs text-bone-700 hover:text-bone-900 transition-colors underline underline-offset-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-moss-600 rounded">
                        Not right now
                      </button>
                    </Dialog.Close>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
