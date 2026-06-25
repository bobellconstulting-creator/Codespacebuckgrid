'use client'

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
  useCallback,
} from 'react'
import { useWildLogicStore } from '@/store/wildlogicStore'
import type { ChatMessage, TonyZone } from '@/store/wildlogicStore'

// ─── Handle interface ──────────────────────────────────────────────────────────

export interface TonyPanelHandle {
  sendMessage(text: string): void
  addTonyMessage(text: string, zoneIds?: string[]): void
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface TonyPanelProps {
  onAskTony: (message: string) => Promise<void>
  onFlyToZone?: (zoneId: string) => void
  isMobile?: boolean
  topOffset?: number
}

// ─── Zone type color map ───────────────────────────────────────────────────────

const ZONE_TYPE_COLORS: Record<TonyZone['type'], string> = {
  food_plot: 'text-moss-400 border-moss-700',
  kill_plot: 'text-brass-500 border-brass-800',
  access_route: 'text-bone-700 border-ink-600',
  bedding: 'text-terra border-terra/40',
  stand_site: 'text-brass-600 border-brass-900',
  water: 'text-moss-500 border-moss-800',
  staging_area: 'text-moss-400 border-moss-800',
  sanctuary: 'text-terra border-terra/30',
}

const ZONE_TYPE_LABELS: Record<TonyZone['type'], string> = {
  food_plot: 'FOOD PLOT',
  kill_plot: 'HARVEST PLOT',
  access_route: 'ACCESS',
  bedding: 'BEDDING',
  stand_site: 'STAND',
  water: 'WATER',
  staging_area: 'STAGING',
  sanctuary: 'SANCTUARY',
}

const CONFIDENCE_COLORS: Record<TonyZone['confidence'], string> = {
  high: 'text-moss-400 bg-moss-900/30',
  medium: 'text-brass-500 bg-brass-900/20',
  low: 'text-bone-700 bg-ink-700',
}

const CONFIDENCE_LABELS: Record<TonyZone['confidence'], string> = {
  high: 'High priority',
  medium: 'Monitor',
  low: 'Low priority',
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="font-mono text-xs tracking-widest text-moss-600 uppercase">
        Analyzing
      </span>
      <span className="flex items-end gap-1 h-4">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-moss-500 animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-moss-500 animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-moss-500 animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </span>
    </div>
  )
}

interface ZoneCardProps {
  zone: TonyZone
  onFlyTo?: (zoneId: string) => void
}

function ZoneCard({ zone, onFlyTo }: ZoneCardProps) {
  const typeColors = ZONE_TYPE_COLORS[zone.type] ?? 'text-bone-700 border-ink-600'
  const typeLabel = ZONE_TYPE_LABELS[zone.type] ?? zone.type.toUpperCase()
  const confColor = CONFIDENCE_COLORS[zone.confidence] ?? 'text-bone-700 bg-ink-700'

  return (
    <button
      type="button"
      onClick={() => onFlyTo?.(zone.id)}
      className="flex items-center justify-between w-full px-2 py-1.5 mt-1 rounded bg-ink-800 border border-ink-600 hover:border-moss-700 transition-colors cursor-pointer group"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`font-mono text-[10px] tracking-widest shrink-0 border-b ${typeColors}`}
        >
          {typeLabel}
        </span>
        <span className="font-display text-sm text-bone-800 truncate group-hover:text-bone-900 transition-colors">
          {zone.name}
        </span>
      </div>
      <span
        className={`ml-2 shrink-0 font-mono text-[10px] tracking-wider px-1.5 py-0.5 rounded uppercase ${confColor}`}
      >
        {CONFIDENCE_LABELS[zone.confidence] ?? zone.confidence}
      </span>
    </button>
  )
}

interface MessageBubbleProps {
  message: ChatMessage
  zones: TonyZone[]
  onFlyToZone?: (zoneId: string) => void
}

function MessageBubble({ message, zones, onFlyToZone }: MessageBubbleProps) {
  const isTony = message.role === 'tony'

  if (isTony) {
    return (
      <div className="flex flex-col items-start max-w-[92%] mb-3">
        <div className="relative pl-3 pr-3 py-2 bg-ink-900 rounded-r-lg rounded-bl-lg border-l-2 border-moss-700">
          <p className="font-display text-[15px] leading-snug text-bone-900 whitespace-pre-wrap">
            {message.text}
          </p>
        </div>
        {zones.length > 0 && (
          <div className="w-full mt-1 space-y-0.5">
            {zones.map((zone) => (
              <ZoneCard key={zone.id} zone={zone} onFlyTo={onFlyToZone} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex justify-end mb-3">
      <div className="max-w-[85%] px-3 py-2 bg-moss-900/20 rounded-l-lg rounded-br-lg">
        <p className="font-body text-sm leading-snug text-bone-900 whitespace-pre-wrap">
          {message.text}
        </p>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4">
      {/* Tony logo mark */}
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-ink-900 border border-moss-700/30">
        <svg
          viewBox="0 0 40 40"
          className="w-9 h-9"
          fill="none"
          aria-hidden="true"
        >
          {/* Stylized antler / AI mark */}
          <path
            d="M20 34 L20 20 M20 20 L12 10 M20 20 L28 10 M12 10 L10 6 M12 10 L16 8 M28 10 L30 6 M28 10 L24 8"
            stroke="#7A8F62"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="20" cy="34" r="2" fill="#7A8F62" opacity="0.6" />
        </svg>
      </div>

      <div className="space-y-2">
        <p className="font-display text-sm text-bone-800 leading-snug">
          Tell me what you&apos;re seeing.
        </p>
        <p className="font-body text-xs text-bone-700 leading-relaxed">
          Where are deer bedding? What&apos;s working? What&apos;s not?
          <br />
          I&apos;ll build the game plan.
        </p>
        <p className="font-mono text-[10px] tracking-widest text-bone-700/50 uppercase pt-1">
          or draw your property boundary to get started &rarr;
        </p>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

const TonyPanel = forwardRef<TonyPanelHandle, TonyPanelProps>(
  function TonyPanel(
    { onAskTony, onFlyToZone, isMobile = false, topOffset = 64 },
    ref
  ) {
    const messages = useWildLogicStore((s) => s.messages)
    const isLoading = useWildLogicStore((s) => s.isLoading)
    const isAnalyzing = useWildLogicStore((s) => s.isAnalyzing)
    const tonyZones = useWildLogicStore((s) => s.tonyZones)
    const addMessage = useWildLogicStore((s) => s.addMessage)
    const clearMessages = useWildLogicStore((s) => s.clearMessages)

    const [inputText, setInputText] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Scroll to bottom on new messages
    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isLoading])

    const handleSend = useCallback(
      async (text: string) => {
        const trimmed = text.trim()
        if (!trimmed) return

        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          text: trimmed,
          tonyZoneIds: [],
        }
        addMessage(userMsg)
        setInputText('')
        await onAskTony(trimmed)
      },
      [addMessage, onAskTony]
    )

    // Imperative handle
    useImperativeHandle(ref, () => ({
      sendMessage(text: string) {
        handleSend(text)
      },
      addTonyMessage(text: string, zoneIds: string[] = []) {
        const tonyMsg: ChatMessage = {
          id: `tony-${Date.now()}`,
          role: 'tony',
          text,
          tonyZoneIds: zoneIds,
        }
        addMessage(tonyMsg)
      },
    }))

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend(inputText)
      }
    }

    const showThinking = isLoading || isAnalyzing
    const hasMessages = messages.length > 0

    // ── Desktop layout ─────────────────────────────────────────────────────────
    if (!isMobile) {
      return (
        <div
          className="fixed right-0 bottom-0 w-[300px] flex flex-col bg-ink-800 border-l border-moss-700/15 z-30"
          style={{ top: `${topOffset}px` }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-14 shrink-0 border-b border-moss-700/15">
            <div className="flex flex-col leading-none">
              <span className="font-display text-xl tracking-widest text-bone-900 uppercase">
                Tony &middot; AI
              </span>
              <span className="font-mono text-[10px] tracking-widest text-moss-600 uppercase">
                {showThinking ? 'Analyzing...' : 'Field Consultant'}
              </span>
            </div>
            {showThinking && (
              <span className="flex gap-0.5 items-end h-4">
                <span className="inline-block w-1 h-1 rounded-full bg-moss-500 animate-pulse" />
                <span
                  className="inline-block w-1 h-1 rounded-full bg-moss-500 animate-pulse"
                  style={{ animationDelay: '200ms' }}
                />
                <span
                  className="inline-block w-1 h-1 rounded-full bg-moss-500 animate-pulse"
                  style={{ animationDelay: '400ms' }}
                />
              </span>
            )}
          </div>

          {/* Chat body */}
          <div className="flex-1 overflow-y-auto px-3 pt-3 pb-2 min-h-0">
            {!hasMessages && !showThinking ? (
              <EmptyState />
            ) : (
              <>
                {messages.map((msg: ChatMessage) => {
                  const zones = tonyZones.filter((z: TonyZone) =>
                    msg.tonyZoneIds.includes(z.id)
                  )
                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      zones={zones}
                      onFlyToZone={onFlyToZone}
                    />
                  )
                })}
                {showThinking && <ThinkingIndicator />}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input bar */}
          <InputBar
            inputText={inputText}
            setInputText={setInputText}
            onSend={() => handleSend(inputText)}
            onClear={clearMessages}
            onKeyDown={handleKeyDown}
            inputRef={inputRef}
            disabled={showThinking}
          />
        </div>
      )
    }

    // ── Mobile bottom sheet ────────────────────────────────────────────────────
    return (
      <div className="fixed inset-x-0 bottom-0 h-[85dvh] flex flex-col bg-ink-800 rounded-t-xl z-40 shadow-2xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-ink-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 shrink-0 border-b border-moss-700/15">
          <div className="flex flex-col leading-none">
            <span className="font-display text-xl tracking-widest text-bone-900 uppercase">
              Tony &middot; AI
            </span>
            <span className="font-mono text-[10px] tracking-widest text-moss-600 uppercase">
              {showThinking ? 'Analyzing...' : 'Field Consultant'}
            </span>
          </div>
          {showThinking && (
            <span className="flex gap-0.5 items-end h-4">
              <span className="inline-block w-1 h-1 rounded-full bg-moss-500 animate-pulse" />
              <span
                className="inline-block w-1 h-1 rounded-full bg-moss-500 animate-pulse"
                style={{ animationDelay: '200ms' }}
              />
              <span
                className="inline-block w-1 h-1 rounded-full bg-moss-500 animate-pulse"
                style={{ animationDelay: '400ms' }}
              />
            </span>
          )}
        </div>

        {/* Chat body */}
        <div className="flex-1 overflow-y-auto px-3 pt-3 pb-2 min-h-0">
          {!hasMessages && !showThinking ? (
            <EmptyState />
          ) : (
            <>
              {messages.map((msg: ChatMessage) => {
                const zones = tonyZones.filter((z: TonyZone) =>
                  msg.tonyZoneIds.includes(z.id)
                )
                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    zones={zones}
                    onFlyToZone={onFlyToZone}
                  />
                )
              })}
              {showThinking && <ThinkingIndicator />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input bar */}
        <InputBar
          inputText={inputText}
          setInputText={setInputText}
          onSend={() => handleSend(inputText)}
          onClear={clearMessages}
          onKeyDown={handleKeyDown}
          inputRef={inputRef}
          disabled={showThinking}
        />
      </div>
    )
  }
)

// ─── Input bar sub-component ───────────────────────────────────────────────────

interface InputBarProps {
  inputText: string
  setInputText: (v: string) => void
  onSend: () => void
  onClear: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  inputRef: React.RefObject<HTMLTextAreaElement>
  disabled: boolean
}

function InputBar({
  inputText,
  setInputText,
  onSend,
  onClear,
  onKeyDown,
  inputRef,
  disabled,
}: InputBarProps) {
  const hasText = inputText.trim().length > 0

  return (
    <div className="shrink-0 flex items-end gap-2 px-3 py-3 border-t border-moss-700/15 bg-ink-800">
      {/* Textarea */}
      <textarea
        ref={inputRef}
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask Tony..."
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none overflow-hidden bg-ink-900 border border-moss-700/40 focus:border-moss-600 rounded-lg px-3 py-2.5 font-body text-sm text-bone-900 placeholder-bone-700/40 outline-none transition-colors min-h-[44px] max-h-32 disabled:opacity-40"
      />

      {/* Send button */}
      <button
        type="button"
        onClick={onSend}
        disabled={!hasText || disabled}
        aria-label="Send message"
        className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
          hasText && !disabled
            ? 'bg-moss-700 hover:bg-moss-600 text-bone-900'
            : 'bg-ink-700 text-bone-700/30 cursor-not-allowed'
        }`}
      >
        <svg
          viewBox="0 0 20 20"
          className="w-4 h-4"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 10L17 3L10 17L9 11L3 10Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Clear button */}
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear chat"
        className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-ink-700 hover:bg-ink-600 text-bone-700/50 hover:text-bone-700 transition-colors"
      >
        <svg
          viewBox="0 0 20 20"
          className="w-4 h-4"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 5h12M8 5V3h4v2M6 5l1 11h6l1-11"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}

export default TonyPanel
