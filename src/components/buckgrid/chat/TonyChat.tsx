'use client'

import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from 'react'

export type TonyChatHandle = {
  addTonyMessage: (text: string) => void
  triggerScan: (prompt: string) => void
}

type MapData = {
  bounds: { north: number; south: number; east: number; west: number }
  zoom: number
  features: any[]
}

type TonyChatProps = {
  getBoundsAndFeatures: () => MapData | null
  drawAnnotations?: (annotations: any[]) => void
  propertyName?: string
  seasonBanner?: { label: string; tip: string; color: string }
  isMobile?: boolean
  topOffset?: number
  panelWidth?: number
}

type AnnotationSummary = { type: string; label: string; why: string; conflictWarning?: string }

type ChatMessage = {
  role: 'tony' | 'user'
  text: string
  annotations?: AnnotationSummary[]
}

const ONBOARDING_MESSAGE = `I'm Tony — your AI habitat consultant. Here's how to use me:

1. **Navigate** the satellite map to your land
2. **Draw your boundary** with the Boundary tool
3. **Mark habitat** — food plots, bedding, stands
4. Hit **Lock Border** and I'll analyze your terrain

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

// Panel dimensions
const PANEL_W = 310

const TonyChat = forwardRef<TonyChatHandle, TonyChatProps>(
  ({ getBoundsAndFeatures, drawAnnotations, propertyName, seasonBanner, isMobile, topOffset = 12, panelWidth = 310 }, ref) => {
    const [chat, setChat] = useState<ChatMessage[]>([{ role: 'tony', text: ONBOARDING_MESSAGE }])
    const [input, setInput] = useState('')
    const [isOpen, setIsOpen] = useState(true)
    const [loading, setLoading] = useState(false)
    const [legendOpen, setLegendOpen] = useState(false)
    const [hasUnread, setHasUnread] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

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

    const askTony = useCallback(async (message: string) => {
      const mapData = getBoundsAndFeatures()
      if (!mapData) {
        setChat(p => [...p, { role: 'tony', text: 'Map not ready yet.' }])
        return
      }

      // Fetch spatial context (OSM + elevation) in parallel with the chat request.
      // Use a tight timeout — Tony fires regardless of whether this completes.
      // Bounds area guard: skip if area > 0.25 deg^2 (matches server-side limit).
      const boundsAreaDegSq = (mapData.bounds.north - mapData.bounds.south) * Math.abs(mapData.bounds.east - mapData.bounds.west)
      let spatialContext: unknown = undefined
      if (boundsAreaDegSq <= 0.25) {
        try {
          const spatialRes = await Promise.race([
            fetch('/api/spatial', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bounds: mapData.bounds }),
            }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SpatialTimeout')), 18_000)),
          ])
          if (spatialRes.ok) spatialContext = await spatialRes.json()
        } catch {
          // Spatial data unavailable — Tony proceeds without it
        }
      }

      try {
        const chatAbort = new AbortController()
        const chatTimeout = setTimeout(() => chatAbort.abort(), 65_000)
        let res: Response
        try {
          res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, ...mapData, propertyName: propertyName || '', season: seasonBanner?.label ?? '', spatialContext }),
            signal: chatAbort.signal,
          })
        } finally {
          clearTimeout(chatTimeout)
        }
        const data = await res.json()
        const annotationSummaries: AnnotationSummary[] = Array.isArray(data.annotations)
          ? data.annotations.filter((a: any) => a.label || a.why).map((a: any) => ({ type: a.type ?? 'feature', label: a.label ?? '', why: a.why ?? '', conflictWarning: a.conflictWarning }))
          : []
        setChat(p => {
          const updated = p.filter(m => m.text !== '__thinking__')
          return [...updated, { role: 'tony', text: data.reply || 'No response.', annotations: annotationSummaries.length > 0 ? annotationSummaries : undefined }]
        })
        if (drawAnnotations && Array.isArray(data.annotations)) {
          drawAnnotations(data.annotations)
        }
      } catch {
        setChat(p => {
          const updated = p.filter(m => m.text !== '__thinking__')
          return [...updated, { role: 'tony', text: "Couldn't reach Tony. Check your connection and try again." }]
        })
      }
    }, [getBoundsAndFeatures, drawAnnotations, propertyName, seasonBanner])

    useImperativeHandle(ref, () => ({
      addTonyMessage: (text: string) => setChat(p => [...p, { role: 'tony', text }]),
      triggerScan: async (contextPrompt: string) => {
        if (loading) return
        setLoading(true)
        setIsOpen(true)
        setChat(p => [...p, { role: 'tony', text: '__thinking__' }])
        await askTony(contextPrompt)
        setLoading(false)
      }
    }), [loading, askTony])

    const send = useCallback(async () => {
      if (!input.trim() || loading) return
      const msg = input
      setLoading(true)
      setChat(p => [...p, { role: 'user', text: msg }])
      setInput('')
      setChat(p => [...p, { role: 'tony', text: '__thinking__' }])
      await askTony(msg)
      setLoading(false)
    }, [input, loading, askTony])

    const clearChat = useCallback(() => {
      setChat([{ role: 'tony', text: ONBOARDING_MESSAGE }])
    }, [])

    const openSheet = useCallback(() => {
      setIsOpen(true)
      setHasUnread(false)
    }, [])

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
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
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
                {m.annotations && m.annotations.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%', maxWidth: '92%' }}>
                    {m.annotations.map((ann, ai) => (
                      <div key={ai} style={{ background: '#1E2122', border: `1px solid ${ann.conflictWarning ? 'rgba(239,68,68,0.35)' : 'rgba(107,122,87,0.12)'}`, borderLeft: `2px solid ${ann.conflictWarning ? '#ef4444' : '#6B7A57'}`, borderRadius: '2px', padding: '5px 9px', fontSize: '11px' }}>
                        <span style={{ fontFamily: "'Teko', 'Oswald', sans-serif", color: ann.conflictWarning ? '#ef4444' : '#6B7A57', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', fontSize: '10px' }}>{ann.type.replace('_', ' ')}</span>
                        {ann.label && <span style={{ color: '#D8D3C5', opacity: 0.75 }}> — {ann.label}</span>}
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
              <span><span style={{ color: '#6B7A57' }}>▲</span> Tony rec</span>
            </div>
          )}
        </div>

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
              transition: 'transform 0.3s ease',
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
              style={{
                position: 'fixed',
                bottom: '90px',
                right: '12px',
                zIndex: 1800,
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: '#6B7A57',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(107,122,87,0.4)',
              }}
            >
              <img src="/buckgrid-logo.png" width="26" height="26" alt="" style={{ display: 'block' }} />
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
