'use client'

import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ShareReportButton from '../report/ShareReportButton'
import type { ReportZone } from '../report/reportRenderer'
import TonightsSit, { type SitInputs } from '../wind/TonightsSit'
import { GamePlanLabel, ReadingPill, ZoneCard } from '../hud/Hud'
import { FONT, HUD, rgba } from '../hud/tokens'

export type TonyChatHandle = {
  addTonyMessage: (text: string) => void
  triggerScan: (prompt: string) => void
  isLoading: () => boolean
  open: () => void
}

type MapData = {
  bounds: { north: number; south: number; east: number; west: number }
  zoom: number
  features: any[]
}

type TonyChatProps = {
  getBoundsAndFeatures: () => MapData | null
  drawAnnotations?: (annotations: any[]) => void
  flyTo?: (lat: number, lng: number, zoom?: number) => void
  getMapElement?: () => HTMLElement | null
  propertyAcres?: number
  propertyName?: string
  seasonBanner?: { label: string; tip: string; color: string }
  isMobile?: boolean
  topOffset?: number
  panelWidth?: number
  onScanComplete?: () => void
}

type AnnotationSummary = { type: string; label: string; why: string; confidence?: number; priority?: number; conflictWarning?: string; centroid?: [number, number] }

type AnalysisSource = {
  id: string
  label: string
  status: 'locked' | 'partial' | 'missing'
  detail: string
}

type AnalysisReceipt = {
  grounded?: boolean
  engineOnly?: boolean
  retryable?: boolean
  engine?: {
    candidates: number
    grid: string
    cellMeters: number
    acres: number
    windFromDeg: number | null
  }
  sources?: AnalysisSource[]
  warnings?: string[]
  windLabel?: string
}

type AnalysisDeck = {
  id: number
  phase: 'scanning' | 'revealing' | 'done' | 'retryable'
  prompt: string
  annotations: AnnotationSummary[]
  shown: number
  drawableCount: number
  receipt?: AnalysisReceipt
}

function computeCentroid(geojson: any): [number, number] | undefined {
  const geom = geojson?.geometry
  if (!geom) return undefined
  if (geom.type === 'Point') {
    const [lng, lat] = geom.coordinates
    return [lat, lng]
  }
  if (geom.type === 'Polygon') {
    const ring: [number, number][] = geom.coordinates[0]
    if (!ring || ring.length === 0) return undefined
    const lngAvg = ring.reduce((s, c) => s + c[0], 0) / ring.length
    const latAvg = ring.reduce((s, c) => s + c[1], 0) / ring.length
    return [latAvg, lngAvg]
  }
  if (geom.type === 'LineString') {
    const coords: [number, number][] = geom.coordinates
    if (!coords || coords.length === 0) return undefined
    const mid = coords[Math.floor(coords.length / 2)]
    return [mid[1], mid[0]]
  }
  return undefined
}

type ChatMessage = {
  role: 'tony' | 'user'
  text: string
  annotations?: AnnotationSummary[]
}

const ONBOARDING_MESSAGE = `I'm Tony — your AI habitat consultant.

1. **Navigate** to your land on the satellite map
2. **Draw your property boundary** with the Boundary tool
3. Hit **Analyze** — I'll read the terrain and identify key habitat features
4. Hit **Get Advice** — I'll draw stand locations, food plots, and trails directly on your map

Then ask me anything: "Where should my food plots go?" or "What's the best entry trail to that stand?"`

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n')
  return lines.map((line, lineIdx) => {
    const isBullet = /^[-*]\s+/.test(line)
    const content = isBullet ? line.replace(/^[-*]\s+/, '') : line
    const parts = content.split(/(\*\*[^*]+\*\*)/)
    const rendered = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold" style={{ color: '#6B7A57' }}>{part.slice(2, -2)}</strong>
      }
      return <span key={i}>{part}</span>
    })
    return (
      <React.Fragment key={lineIdx}>
        {isBullet ? (
          <span className="flex gap-1.5 items-start">
            <span className="mt-0.5 shrink-0" style={{ color: '#6B7A57' }}>•</span>
            <span>{rendered}</span>
          </span>
        ) : rendered}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    )
  })
}

function isErrorMessage(text: string): boolean {
  return text.includes('unavailable') || text.includes("Couldn't reach")
}

function normalizeReceipt(raw: unknown, fallback: { grounded?: boolean; engineOnly?: boolean; retryable?: boolean }): AnalysisReceipt | undefined {
  if (!raw || typeof raw !== 'object') {
    if (fallback.grounded === undefined && fallback.engineOnly === undefined && fallback.retryable === undefined) return undefined
    return fallback
  }
  const r = raw as Record<string, unknown>
  const sources = Array.isArray(r.sources)
    ? r.sources.map((s): AnalysisSource | null => {
        const src = s as Record<string, unknown>
        const status = src.status === 'locked' || src.status === 'partial' || src.status === 'missing' ? src.status : 'missing'
        if (typeof src.label !== 'string') return null
        return {
          id: typeof src.id === 'string' ? src.id : src.label,
          label: src.label,
          status,
          detail: typeof src.detail === 'string' ? src.detail : '',
        }
      }).filter((s): s is AnalysisSource => !!s)
    : undefined
  const engineRaw = r.engine as Record<string, unknown> | undefined
  const engine = engineRaw && typeof engineRaw === 'object'
    ? {
        candidates: typeof engineRaw.candidates === 'number' ? engineRaw.candidates : 0,
        grid: typeof engineRaw.grid === 'string' ? engineRaw.grid : '',
        cellMeters: typeof engineRaw.cellMeters === 'number' ? engineRaw.cellMeters : 0,
        acres: typeof engineRaw.acres === 'number' ? engineRaw.acres : 0,
        windFromDeg: typeof engineRaw.windFromDeg === 'number' ? engineRaw.windFromDeg : null,
      }
    : undefined
  return {
    grounded: typeof r.grounded === 'boolean' ? r.grounded : fallback.grounded,
    engineOnly: typeof r.engineOnly === 'boolean' ? r.engineOnly : fallback.engineOnly,
    retryable: typeof r.retryable === 'boolean' ? r.retryable : fallback.retryable,
    engine,
    sources,
    warnings: Array.isArray(r.warnings) ? r.warnings.filter((w): w is string => typeof w === 'string') : undefined,
    windLabel: typeof r.windLabel === 'string' ? r.windLabel : undefined,
  }
}

function sourceStyle(status: AnalysisSource['status']) {
  if (status === 'locked') return { color: HUD.success, border: rgba(HUD.success, 0.5), fill: rgba(HUD.success, 0.12), label: 'LOCK' }
  if (status === 'partial') return { color: HUD.ember, border: rgba(HUD.ember, 0.5), fill: rgba(HUD.ember, 0.12), label: 'PART' }
  return { color: '#D96B5B', border: 'rgba(217,107,91,0.45)', fill: 'rgba(217,107,91,0.1)', label: 'MISS' }
}

function receiptStatus(receipt?: AnalysisReceipt): string {
  if (!receipt) return 'SCANNING DATA SOURCES'
  if (receipt.retryable) return 'DATA INCOMPLETE - RETRY'
  if (receipt.engineOnly) return 'ENGINE PLAN - COMMENTARY OFFLINE'
  if (receipt.grounded) return 'GROUNDED ENGINE PLAN'
  return 'UNLOCKED CHAT MODE'
}

// Panel dimensions
const PANEL_W = 310

const TonyChat = forwardRef<TonyChatHandle, TonyChatProps>(
  ({ getBoundsAndFeatures, drawAnnotations, flyTo, getMapElement, propertyAcres, propertyName, seasonBanner, isMobile, topOffset = 12, panelWidth = 310, onScanComplete }, ref) => {
    const [chat, setChat] = useState<ChatMessage[]>([{ role: 'tony', text: ONBOARDING_MESSAGE }])
    const [input, setInput] = useState('')
    const [isOpen, setIsOpen] = useState(true)
    const [loading, setLoading] = useState(false)
    const [legendOpen, setLegendOpen] = useState(false)
    const [hasUnread, setHasUnread] = useState(false)
    const [lastUserMessage, setLastUserMessage] = useState<string | null>(null)
    const [analysisDeck, setAnalysisDeck] = useState<AnalysisDeck | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const revealTimers = useRef<ReturnType<typeof setTimeout>[]>([])
    const deckSeq = useRef(0)

    const clearRevealTimers = useCallback(() => {
      revealTimers.current.forEach(t => clearTimeout(t))
      revealTimers.current = []
    }, [])

    useEffect(() => () => clearRevealTimers(), [clearRevealTimers])

    // On mobile, start with Tony CLOSED so the user sees and can use the MAP first
    // (the chat sheet otherwise covers the whole map on load). Desktop keeps the
    // side panel open. The floating button + unread badge handle re-opening.
    const didMobileInit = useRef(false)
    useEffect(() => {
      if (isMobile && !didMobileInit.current) {
        didMobileInit.current = true
        setIsOpen(false)
      }
    }, [isMobile])

    useEffect(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight
      }
    }, [chat, loading])

    // Track unread messages when bottom sheet is closed on mobile
    useEffect(() => {
      if (isMobile && !isOpen && chat.length > 1) {
        const lastMsg = chat[chat.length - 1]
        if (lastMsg.role === 'tony' && lastMsg.text !== '__thinking__') {
          setHasUnread(true)
        }
      }
    }, [chat, isMobile, isOpen])

    const askTony = useCallback(async (message: string, mode: 'scan' | 'chat' = 'chat') => {
      const mapData = getBoundsAndFeatures()
      if (!mapData) {
        setChat(p => [...p, { role: 'tony', text: 'Map not ready yet.' }])
        return
      }
      const startedDeckId = ++deckSeq.current
      if (mode === 'scan') {
        clearRevealTimers()
        setAnalysisDeck({
          id: startedDeckId,
          phase: 'scanning',
          prompt: message,
          annotations: [],
          shown: 0,
          drawableCount: 0,
        })
      }

      // Spatial context is now fetched server-side in /api/chat (parallel with satellite image).
      // Client sends bounds + features only — no pre-flight /api/spatial call needed.
      try {
        const chatAbort = new AbortController()
        const chatTimeout = setTimeout(() => chatAbort.abort(), 110_000)
        let res: Response
        // Send last 6 messages (excluding __thinking__) as history context
        const historyToSend = chat
          .filter(m => m.text !== '__thinking__' && m.text !== ONBOARDING_MESSAGE)
          .slice(-6)
          .map(m => ({ role: m.role, text: m.text.slice(0, 400) }))
        try {
          res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, ...mapData, propertyName: propertyName || '', propertyAcres: propertyAcres || 0, season: seasonBanner?.label ?? '', chatHistory: historyToSend }),
            signal: chatAbort.signal,
          })
        } finally {
          clearTimeout(chatTimeout)
        }
        const data = await res.json()
        const annotationSummaries: AnnotationSummary[] = Array.isArray(data.annotations)
          ? data.annotations.filter((a: unknown) => {
              const ann = a as Record<string, unknown>
              return ann.label || ann.why
            }).map((a: unknown) => {
              const ann = a as Record<string, unknown>
              return {
                type: typeof ann.type === 'string' ? ann.type : 'feature',
                label: typeof ann.label === 'string' ? ann.label : '',
                why: typeof ann.why === 'string' ? ann.why : '',
                confidence: typeof ann.confidence === 'number' ? ann.confidence : undefined,
                priority: typeof ann.priority === 'number' ? ann.priority : undefined,
                conflictWarning: typeof ann.conflictWarning === 'string' ? ann.conflictWarning : undefined,
                centroid: computeCentroid(ann.geojson),
              }
            })
          : []
        // Guard against raw JSON leaking into chat when Gemini response is truncated mid-object
        const replyText = typeof data.reply === 'string' ? data.reply : 'No response.'
        const looksLikeJson = replyText.trimStart().startsWith('{') || replyText.trimStart().startsWith('[')
        const safeReply = looksLikeJson
          ? 'Response was too large — zoom in to a smaller area and try again.'
          : replyText
        const receipt = normalizeReceipt(data.analysis, {
          grounded: typeof data.grounded === 'boolean' ? data.grounded : undefined,
          engineOnly: typeof data.engineOnly === 'boolean' ? data.engineOnly : undefined,
          retryable: typeof data.retryable === 'boolean' ? data.retryable : undefined,
        })
        const drawable: any[] = Array.isArray(data.annotations)
          ? data.annotations.filter((a: any) => a?.geojson?.geometry && a.label !== undefined)
          : []
        const shouldShowDeck = mode === 'scan' || annotationSummaries.length > 0 || Boolean(data.retryable) || Boolean(data.grounded)
        const deckId = mode === 'scan' ? startedDeckId : ++deckSeq.current
        setChat(p => {
          const updated = p.filter(m => m.text !== '__thinking__')
          return [...updated, { role: 'tony', text: safeReply, annotations: annotationSummaries.length > 0 ? annotationSummaries : undefined }]
        })
        if (shouldShowDeck) {
          setAnalysisDeck({
            id: deckId,
            phase: data.retryable ? 'retryable' : drawable.length > 0 ? 'revealing' : 'done',
            prompt: message,
            annotations: annotationSummaries,
            shown: 0,
            drawableCount: drawable.length,
            receipt,
          })
        }
        if (drawAnnotations && Array.isArray(data.annotations)) {
          if (drawable.length > 0) {
            clearRevealTimers()
            drawAnnotations([])
            drawable.forEach((_, i) => {
              const timer = setTimeout(() => {
                drawAnnotations(drawable.slice(0, i + 1))
                setAnalysisDeck(current => current?.id === deckId
                  ? { ...current, shown: i + 1, phase: i === drawable.length - 1 ? 'done' : 'revealing' }
                  : current
                )
                if (i === drawable.length - 1) {
                  setChat(p => [...p, { role: 'tony', text: `Map replay complete: ${drawable.length} call${drawable.length !== 1 ? 's' : ''} placed from the grounded engine.` }])
                }
              }, 420 * (i + 1))
              revealTimers.current.push(timer)
            })
          } else if (data.annotations.length > 0) {
            setChat(p => [...p, { role: 'tony', text: `Coordinates landed outside the current view. Zoom in closer to your property and tap Get Advice again.` }])
          }
        }
      } catch {
        if (mode === 'scan') {
          setAnalysisDeck(current => current?.id === startedDeckId
            ? { ...current, phase: 'retryable', receipt: { retryable: true, warnings: ["Tony couldn't be reached."] } }
            : current
          )
        }
        setChat(p => {
          const updated = p.filter(m => m.text !== '__thinking__')
          return [...updated, { role: 'tony', text: "Couldn't reach Tony. Check your connection and try again." }]
        })
      }
    }, [getBoundsAndFeatures, drawAnnotations, propertyName, propertyAcres, seasonBanner, clearRevealTimers, chat])

    useImperativeHandle(ref, () => ({
      addTonyMessage: (text: string) => setChat(p => [...p, { role: 'tony', text }]),
      open: () => setIsOpen(true),
      triggerScan: async (contextPrompt: string) => {
        if (loading) return
        setLoading(true)
        setIsOpen(true)
        setChat(p => [...p, { role: 'tony', text: '__thinking__' }])
        await askTony(contextPrompt, 'scan')
        setLoading(false)
        onScanComplete?.()
      },
      isLoading: () => loading,
    }), [loading, askTony, onScanComplete])

    const send = useCallback(async () => {
      if (!input.trim() || loading) return
      const msg = input
      setLoading(true)
      setLastUserMessage(msg)
      setChat(p => [...p, { role: 'user', text: msg }])
      setInput('')
      setChat(p => [...p, { role: 'tony', text: '__thinking__' }])
      await askTony(msg, 'chat')
      setLoading(false)
    }, [input, loading, askTony])

    const clearChat = useCallback(() => {
      clearRevealTimers()
      setAnalysisDeck(null)
      setChat([{ role: 'tony', text: ONBOARDING_MESSAGE }])
    }, [clearRevealTimers])

    // The branded report exports whatever Tony last drew on the map —
    // drawAnnotations clears previous layers, so the newest annotated
    // message is exactly what the satellite capture shows.
    const reportSource = useMemo(() => {
      for (let i = chat.length - 1; i >= 0; i--) {
        const m = chat[i]
        if (m.role === 'tony' && m.annotations && m.annotations.length > 0) return m
      }
      return null
    }, [chat])

    const reportZones = useMemo<ReportZone[]>(
      () =>
        (reportSource?.annotations ?? []).map(a => ({
          type: a.type,
          label: a.label,
          why: a.conflictWarning ? `${a.why} Terrain conflict: ${a.conflictWarning}`.trim() : a.why,
          confidence: a.confidence,
          priority: a.priority,
        })),
      [reportSource]
    )

    const reportNotes = useMemo(() => {
      if (!reportSource || isErrorMessage(reportSource.text)) return undefined
      const plain = reportSource.text.replace(/\*\*/g, '').trim()
      return plain.length > 0 ? plain.slice(0, 420) : undefined
    }, [reportSource])

    const [windLabel, setWindLabel] = useState<string | null>(null)

    // Stands + bedding cover for the wind call: Tony's annotations (centroids
    // already computed) merged with hand-drawn stand/bedding layers.
    const getSitInputs = useCallback((): SitInputs | null => {
      const mapData = getBoundsAndFeatures()
      if (!mapData) return null
      const stands: SitInputs['stands'] = []
      const cover: SitInputs['cover'] = []
      const COVER_TYPES = new Set(['bedding', 'sanctuary', 'tall_standing_cover'])
      for (const a of reportSource?.annotations ?? []) {
        if (!a.centroid) continue
        const [lat, lng] = a.centroid
        if (a.type === 'stand') stands.push({ name: a.label || 'Tony stand', lat, lng })
        else if (COVER_TYPES.has(a.type)) cover.push({ name: a.label || a.type.replace(/_/g, ' '), lat, lng })
      }
      let drawnN = 0
      for (const f of mapData.features) {
        const t = f?.properties?.layerType
        if (t !== 'stand' && t !== 'bedding') continue
        const c = computeCentroid(f)
        if (!c) continue
        if (t === 'stand') stands.push({ name: `Drawn stand ${++drawnN}`, lat: c[0], lng: c[1] })
        else cover.push({ name: 'Drawn bedding', lat: c[0], lng: c[1] })
      }
      const { bounds } = mapData
      return {
        stands,
        cover,
        center: { lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 },
      }
    }, [getBoundsAndFeatures, reportSource])

    const openSheet = useCallback(() => {
      setIsOpen(true)
      setHasUnread(false)
    }, [])

    const analysisDeckCard = analysisDeck ? (() => {
      const receipt = analysisDeck.receipt
      const totalCalls = analysisDeck.drawableCount || analysisDeck.annotations.length
      const shown = analysisDeck.phase === 'done' || analysisDeck.phase === 'retryable'
        ? analysisDeck.annotations.length
        : analysisDeck.shown
      const progress = totalCalls > 0
        ? Math.min(100, Math.max(8, Math.round(((analysisDeck.phase === 'done' ? totalCalls : shown) / totalCalls) * 100)))
        : analysisDeck.phase === 'scanning' ? 38 : 100
      const visibleCalls = analysisDeck.phase === 'scanning'
        ? []
        : analysisDeck.annotations.slice(0, Math.max(shown, analysisDeck.phase === 'done' ? analysisDeck.annotations.length : 1))
      const metaFields: string[] = []
      if (receipt?.engine) metaFields.push(`${receipt.engine.candidates} candidates`)
      if (receipt?.engine?.grid) metaFields.push(`grid ${receipt.engine.grid}`)
      if (receipt?.windLabel) metaFields.push(`wind ${receipt.windLabel}`)

      return (
        <motion.div
          key={analysisDeck.id}
          initial={{ opacity: 0, y: -10, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.99 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 7,
            border: `1px solid ${rgba(HUD.ember, analysisDeck.phase === 'retryable' ? 0.55 : 0.34)}`,
            background: `linear-gradient(160deg, ${rgba(HUD.panel, 0.96)} 0%, ${rgba(HUD.spruce, 0.88)} 100%)`,
            boxShadow: `0 14px 34px rgba(0,0,0,0.34), inset 0 1px 0 ${rgba(HUD.bone, 0.06)}`,
            padding: '12px',
          }}
        >
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent 0%, ${rgba(HUD.ember, 0.12)} 46%, transparent 72%)`, transform: `translateX(${Math.min(100, progress + 12)}%)`, transition: 'transform 0.6s ease', opacity: analysisDeck.phase === 'done' ? 0.25 : 0.55 }} />
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
              <GamePlanLabel count={totalCalls > 0 ? shown : undefined} title={analysisDeck.phase === 'retryable' ? 'DATA CHECK' : "TONY'S LIVE READ"} />
              <span style={{
                fontFamily: FONT.mono,
                fontSize: 9,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: analysisDeck.phase === 'retryable' ? '#D96B5B' : HUD.ember,
                border: `1px solid ${analysisDeck.phase === 'retryable' ? 'rgba(217,107,91,0.45)' : rgba(HUD.ember, 0.45)}`,
                borderRadius: 4,
                padding: '4px 6px',
                whiteSpace: 'nowrap',
                background: analysisDeck.phase === 'retryable' ? 'rgba(217,107,91,0.1)' : rgba(HUD.ember, 0.09),
              }}>
                {receiptStatus(receipt)}
              </span>
            </div>

            {analysisDeck.phase === 'scanning' ? (
              <ReadingPill name={propertyName || 'PROPERTY'} />
            ) : (
              <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: '.09em', color: HUD.sage, textTransform: 'uppercase', display: 'flex', flexWrap: 'wrap', gap: '6px 10px' }}>
                {metaFields.length > 0 ? metaFields.map(f => <span key={f}>{f}</span>) : <span>analysis complete</span>}
              </div>
            )}

            <div style={{ height: 4, borderRadius: 999, overflow: 'hidden', background: rgba(HUD.field, 0.35), border: `1px solid ${rgba(HUD.field, 0.32)}` }}>
              <div style={{ width: `${progress}%`, height: '100%', background: analysisDeck.phase === 'retryable' ? '#D96B5B' : HUD.ember, transition: 'width 0.45s cubic-bezier(0.16,1,0.3,1)' }} />
            </div>

            {receipt?.sources && receipt.sources.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 5 }}>
                {receipt.sources.slice(0, 8).map(src => {
                  const s = sourceStyle(src.status)
                  return (
                    <div key={src.id} title={src.detail} style={{ minWidth: 0, border: `1px solid ${s.border}`, background: s.fill, borderRadius: 5, padding: '5px 6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, flexShrink: 0, boxShadow: `0 0 10px ${s.color}` }} />
                        <span style={{ fontFamily: FONT.mono, fontSize: 8.5, letterSpacing: '.06em', color: HUD.bone, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase' }}>
                          {src.label}
                        </span>
                        <span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontSize: 7.5, color: s.color, letterSpacing: '.06em' }}>{s.label}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {visibleCalls.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {visibleCalls.slice(0, 5).map((ann, idx) => (
                  <motion.div
                    key={`${analysisDeck.id}-${ann.label}-${idx}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                    onClick={() => { if (ann.centroid && flyTo) flyTo(ann.centroid[0], ann.centroid[1], 17) }}
                    style={{ cursor: ann.centroid && flyTo ? 'pointer' : 'default' }}
                  >
                    <ZoneCard
                      type={ann.type}
                      title={ann.label || ann.type.replace(/_/g, ' ').toUpperCase()}
                      sub={ann.why ? ann.why.slice(0, 96) : undefined}
                      score={ann.confidence}
                    />
                  </motion.div>
                ))}
              </div>
            )}

            {receipt?.warnings && receipt.warnings.length > 0 && (
              <div style={{ fontFamily: FONT.mono, fontSize: 9, lineHeight: 1.45, color: '#D9A06E', borderTop: `1px solid ${rgba(HUD.field, 0.32)}`, paddingTop: 8 }}>
                {receipt.warnings.slice(0, 2).join(' ')}
              </div>
            )}
          </div>
        </motion.div>
      )
    })() : null

    const chatBody = (
      <>
        {/* Messages */}
        <div
          ref={containerRef}
          style={{
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '12px',
            minHeight: 0,
            background: '#3A4042',
          }}
        >
          <AnimatePresence mode="popLayout">
            {analysisDeckCard}
          </AnimatePresence>
          {chat.map((m, i) => {
            if (m.text === '__thinking__') {
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#1E2122', border: '1px solid rgba(107,122,87,0.12)', borderRadius: '3px', alignSelf: 'flex-start' }}>
                  <span style={{ fontFamily: "'Teko', 'Oswald', sans-serif", fontWeight: 700, fontSize: '13px', color: '#6B7A57', letterSpacing: '0.06em' }}>ANALYZING</span>
                  <span style={{ display: 'flex', gap: '3px' }}>
                    {[0, 150, 300].map(d => (
                      <span key={d} style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#6B7A57', animation: 'bounce 1s infinite', animationDelay: `${d}ms`, display: 'inline-block' }} />
                    ))}
                  </span>
                </div>
              )
            }
            const isUser = m.role === 'user'
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: isUser ? 'flex-end' : 'flex-start', animation: 'fadeSlideIn 0.22s ease-out both' }}>
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '3px',
                    fontSize: '15px',
                    lineHeight: '1.55',
                    maxWidth: '92%',
                    background: isUser ? '#1e2a18' : '#1E2122',
                    color: isUser ? '#D8D3C5' : '#D8D3C5',
                    fontWeight: isUser ? 600 : 400,
                    fontFamily: isUser ? "'Teko', 'Oswald', sans-serif" : 'inherit',
                    letterSpacing: isUser ? '0.02em' : 'normal',
                    border: isUser ? 'none' : '1px solid rgba(90,138,95,0.4)',
                    boxShadow: isUser ? 'none' : '0 0 16px rgba(90,138,95,0.25), inset 0 0 12px rgba(90,138,95,0.12)',
                    position: 'relative' as const,
                  }}
                >
                  {renderMarkdown(m.text)}
                </div>
                {!isUser && isErrorMessage(m.text) && lastUserMessage && (
                  <button
                    onClick={() => {
                      if (loading) return
                      const msg = lastUserMessage
                      setLoading(true)
                      setChat(p => [...p, { role: 'tony', text: '__thinking__' }])
                      askTony(msg).finally(() => setLoading(false))
                    }}
                    disabled={loading}
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: '9px',
                      letterSpacing: '0.12em',
                      color: '#5A8A5F',
                      background: 'rgba(90,138,95,0.08)',
                      border: '1px solid rgba(90,138,95,0.25)',
                      borderRadius: '2px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      padding: '3px 8px',
                      marginTop: '2px',
                      textTransform: 'uppercase' as const,
                      opacity: loading ? 0.4 : 1,
                    }}
                  >
                    ↺ Retry
                  </button>
                )}
                {m.annotations && m.annotations.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%', maxWidth: '92%' }}>
                    {m.annotations.map((ann, ai) => (
                      <div
                        key={ai}
                        onClick={() => { if (ann.centroid && flyTo) flyTo(ann.centroid[0], ann.centroid[1], 17) }}
                        style={{
                          background: '#1E2122',
                          border: `1px solid ${ann.conflictWarning ? 'rgba(239,68,68,0.35)' : 'rgba(107,122,87,0.12)'}`,
                          borderLeft: `2px solid ${ann.conflictWarning ? '#ef4444' : '#6B7A57'}`,
                          borderRadius: '2px',
                          padding: '5px 9px',
                          fontSize: '11px',
                          cursor: ann.centroid && flyTo ? 'pointer' : 'default',
                          animation: `fadeSlideIn 0.2s ease-out ${ai * 55}ms both`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' as const }}>
                          <span style={{ fontFamily: "'Teko', 'Oswald', sans-serif", color: ann.conflictWarning ? '#ef4444' : '#6B7A57', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', fontSize: '10px' }}>{ann.type.replace(/_/g, ' ')}</span>
                          {ann.centroid && flyTo && (
                            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#4A7A50', letterSpacing: '0.06em' }}>↗ MAP</span>
                          )}
                          {ann.priority !== undefined && (
                            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', letterSpacing: '0.06em', background: 'rgba(107,122,87,0.15)', color: '#6B7A57', border: '1px solid rgba(107,122,87,0.3)', borderRadius: '2px', padding: '1px 4px' }}>P{ann.priority}</span>
                          )}
                          {ann.confidence !== undefined && (
                            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', letterSpacing: '0.04em', color: ann.confidence >= 75 ? '#4ade80' : ann.confidence >= 50 ? '#facc15' : '#ef4444', marginLeft: 'auto' }}>
                              score {Math.round(ann.confidence)}
                            </span>
                          )}
                        </div>
                        {ann.confidence !== undefined && (
                          <div style={{ height: '2px', background: 'rgba(107,122,87,0.15)', borderRadius: '1px', margin: '3px 0', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${ann.confidence}%`, background: ann.confidence >= 75 ? '#4ade80' : ann.confidence >= 50 ? '#facc15' : '#ef4444', borderRadius: '1px', transition: 'width 0.4s ease' }} />
                          </div>
                        )}
                        {ann.label && <span style={{ color: '#D8D3C5', opacity: 0.75 }}>{ann.label}</span>}
                        {ann.why && <div style={{ color: '#6E6A5C', marginTop: '2px', lineHeight: '1.3', fontSize: '10.5px' }}>{ann.why}</div>}
                        {ann.conflictWarning && (
                          <div style={{ color: '#ef4444', marginTop: '4px', lineHeight: '1.3', fontSize: '10px', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.04em' }}>
                            TERRAIN CONFLICT: {ann.conflictWarning}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Map Legend */}
        <div style={{ padding: '6px 12px', background: '#3A4042', borderTop: '1px solid rgba(107,122,87,0.12)' }}>
          <button
            onClick={() => setLegendOpen(v => !v)}
            style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '0.14em', color: '#5A8A5F', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' as const, padding: 0, textTransform: 'uppercase' as const }}
          >
            {legendOpen ? '▲ HIDE LEGEND' : '▼ MAP LEGEND'}
          </button>
          {legendOpen && (
            <div style={{ marginTop: '6px', marginBottom: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', background: 'rgba(10,15,9,0.7)', border: '1px solid rgba(90,138,95,0.2)', borderRadius: '2px', padding: '8px', fontFamily: "'Teko', 'Oswald', sans-serif", fontSize: '10px', letterSpacing: '0.06em', color: '#6E6A5C' }}>
              <span><span style={{ color: '#FF6B00' }}>■</span> Boundary</span>
              <span><span style={{ color: '#9B7A2A' }}>■</span> Bedding</span>
              <span><span style={{ color: '#C8650A' }}>■</span> Clover</span>
              <span><span style={{ color: '#facc15' }}>■</span> Corn</span>
              <span><span style={{ color: '#c084fc' }}>■</span> Brassicas</span>
              <span><span style={{ color: '#86efac' }}>■</span> Soybeans</span>
              <span><span style={{ color: '#ef4444' }}>●</span> Stand</span>
              <span><span style={{ color: '#3B82F6' }}>●</span> Water</span>
              <span><span style={{ color: '#CD853F' }}>✦</span> Mineral</span>
              <span><span style={{ color: '#8B0000' }}>⟿</span> Scrape Line</span>
              <span><span style={{ color: '#B8860B' }}>⇌</span> Travel Corridor</span>
              <span><span style={{ color: '#7B9E5A' }}>■</span> Tall Cover</span>
              <span><span style={{ color: '#6B7A57' }}>▲</span> Tony rec</span>
            </div>
          )}
        </div>

        {/* Tonight's sit — live wind vs Tony's stands, pure geometry */}
        <TonightsSit getInputs={getSitInputs} onWind={setWindLabel} />

        {/* Share / Export — branded PNG + PDF field report */}
        {getMapElement && (
          <ShareReportButton
            getMapElement={getMapElement}
            propertyName={propertyName}
            acres={propertyAcres}
            season={seasonBanner?.label}
            zones={reportZones}
            fieldNotes={reportNotes}
            wind={windLabel ?? undefined}
          />
        )}

        {/* Input */}
        <div style={{ padding: '8px 12px', paddingBottom: 'env(safe-area-inset-bottom, 16px)', borderTop: '1px solid rgba(107,122,87,0.15)', background: '#3A4042', display: 'flex', gap: '8px', flexShrink: 0 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            onFocus={e => { e.currentTarget.style.borderColor = '#6B7A57' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(107,122,87,0.2)' }}
            placeholder="Ask Tony..."
            disabled={loading}
            style={{
              flex: 1,
              background: '#1E2122',
              border: '1px solid rgba(107,122,87,0.2)',
              color: '#D8D3C5',
              padding: '7px 10px',
              borderRadius: '2px',
              fontSize: '16px',
              fontFamily: "'Teko', 'Oswald', sans-serif",
              outline: 'none',
              opacity: loading ? 0.5 : 1,
              minHeight: '44px',
            }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            onMouseDown={e => { if (!loading && input.trim()) e.currentTarget.style.transform = 'scale(0.91)' }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
            style={{
              background: loading || !input.trim() ? '#1A2018' : '#6B7A57',
              color: '#fff',
              fontWeight: 700,
              padding: '0 12px',
              borderRadius: '2px',
              border: 'none',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              flexShrink: 0,
              minHeight: '44px',
              transition: 'transform 0.1s ease, background 0.15s ease',
            }}
          >
            ➤
          </button>
          <button
            onClick={clearChat}
            title="Clear chat"
            style={{ color: '#333', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '10px 8px', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>
      </>
    )

    // ── MOBILE LAYOUT: floating button + bottom sheet ──
    if (isMobile) {
      return (
        <>
          {/* Backdrop */}
          {isOpen && (
            <div
              onClick={() => setIsOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1900,
                background: 'rgba(0,0,0,0.6)',
              }}
            />
          )}

          {/* Bottom sheet */}
          <div
            aria-hidden={!isOpen}
            inert={!isOpen || undefined}
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 2000,
              height: '85dvh',
              display: 'flex',
              flexDirection: 'column',
              background: '#1E2122',
              border: '1px solid rgba(107,122,87,0.12)',
              borderBottom: 'none',
              borderRadius: '12px 12px 0 0',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.8)',
              fontFamily: "'Barlow Condensed', 'Inter', sans-serif",
              transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
              transition: isOpen ? 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)' : 'transform 0.24s cubic-bezier(0.4, 0, 1, 1)',
              overflow: 'hidden',
            }}
          >
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px', flexShrink: 0 }}>
              <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#3A3A3A' }} />
            </div>

            {/* Sheet header */}
            <div
              style={{
                padding: '8px 12px 12px',
                background: 'linear-gradient(135deg, #3A4042 0%, #0F1A14 100%)',
                borderBottom: '1px solid rgba(90,138,95,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(90,138,95,0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src="/buckgrid-logo.png" width="22" height="22" alt="" style={{ display: 'block' }} />
                <div>
                  <div style={{ fontFamily: "'Teko', 'Oswald', sans-serif", fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#6B7A57', lineHeight: 1 }}>
                    Tony — Field AI
                  </div>
                  {loading && (
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#6B7A57', marginTop: '2px', letterSpacing: '0.08em' }}>ANALYZING TERRAIN...</div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px' }}
              >
                ✕
              </button>
            </div>

            {chatBody}
          </div>

          {/* Floating trigger button — bottom-right, above Leaflet zoom controls */}
          {!isOpen && (
            <button
              onClick={openSheet}
              aria-label="Ask Tony"
              style={{
                position: 'fixed',
                bottom: '90px',
                right: '12px',
                zIndex: 1800,
                height: '50px',
                padding: '0 18px 0 14px',
                borderRadius: '25px',
                background: '#6B7A57',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 20px rgba(107,122,87,0.45)',
              }}
            >
              <img src="/buckgrid-logo.png" width="24" height="24" alt="" style={{ display: 'block' }} />
              <span style={{ color: '#0D1A0B', fontWeight: 800, fontSize: '13px', letterSpacing: '0.04em', whiteSpace: 'nowrap', fontFamily: "'Teko','Oswald',sans-serif", textTransform: 'uppercase' }}>Ask Tony</span>
              {hasUnread && (
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: '#fff',
                    border: '2px solid #6B7A57',
                    animation: 'pulse 1.5s infinite',
                  }}
                />
              )}
            </button>
          )}
        </>
      )
    }

    // ── DESKTOP LAYOUT: right sidebar panel ──
    return (
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: `${topOffset}px`,
          bottom: 0,
          zIndex: 1000,
          width: isOpen ? `${panelWidth}px` : '48px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 0,
          background: '#3A4042',
          borderLeft: '1px solid rgba(107,122,87,0.15)',
          boxShadow: 'inset 0 0 20px rgba(90,138,95,0.05)',
          transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
          fontFamily: "'Barlow Condensed', 'Inter', sans-serif",
        }}
      >
        {/* Header */}
        <div
          onClick={() => setIsOpen(v => !v)}
          style={{
            padding: '0 14px',
            height: '56px',
            background: 'linear-gradient(135deg, #3A4042 0%, #0F1A14 50%, #3A4042 100%)',
            borderBottom: '1px solid rgba(90,138,95,0.2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            userSelect: 'none' as const,
            flexShrink: 0,
            boxShadow: '0 2px 12px rgba(90,138,95,0.15), inset 0 1px 0 rgba(90,138,95,0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/buckgrid-logo.png" width="20" height="20" alt="" style={{ display: 'block' }} />
            {isOpen && (
              <div>
                <div style={{ fontFamily: "'Teko', 'Oswald', sans-serif", fontSize: '14px', fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.14em', color: '#D8D3C5', lineHeight: 1 }}>
                  TONY<span style={{ color: '#6B7A57', marginLeft: '5px' }}>·</span><span style={{ color: '#6B7A57' }}>AI</span>
                </div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: loading ? '#6B7A57' : '#5A8A5F', marginTop: '3px', letterSpacing: '0.12em', transition: 'color 0.2s' }}>
                  {loading ? 'ANALYZING TERRAIN...' : 'FIELD CONSULTANT'}
                </div>
              </div>
            )}
          </div>
          {isOpen ? (
            <span style={{ color: '#6E6A5C', fontSize: '16px', fontWeight: 300, lineHeight: 1 }}>‹</span>
          ) : (
            <span style={{ color: '#2A2A2A', fontSize: '16px', fontWeight: 300, lineHeight: 1, transform: 'rotate(180deg)', display: 'block' }}>‹</span>
          )}
        </div>

        {isOpen && chatBody}
      </div>
    )
  }
)

TonyChat.displayName = 'TonyChat'
export default React.memo(TonyChat)
