'use client'

import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from 'react'
import BuckLogo from '../ui/BuckLogo'

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
}

type AnnotationSummary = { type: string; label: string; why: string }

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
        return <strong key={i} className="font-semibold" style={{ color: '#C8650A' }}>{part.slice(2, -2)}</strong>
      }
      return <span key={i}>{part}</span>
    })
    return (
      <React.Fragment key={lineIdx}>
        {isBullet ? (
          <span className="flex gap-1.5 items-start">
            <span className="mt-0.5 shrink-0" style={{ color: '#C8650A' }}>•</span>
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
  ({ getBoundsAndFeatures, drawAnnotations, propertyName, seasonBanner, isMobile }, ref) => {
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
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, ...mapData, propertyName: propertyName || '', season: seasonBanner?.label ?? '' })
        })
        const data = await res.json()
        const annotationSummaries: AnnotationSummary[] = Array.isArray(data.annotations)
          ? data.annotations.filter((a: any) => a.label || a.why).map((a: any) => ({ type: a.type ?? 'feature', label: a.label ?? '', why: a.why ?? '' }))
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
          }}
        >
          {chat.map((m, i) => {
            if (m.text === '__thinking__') {
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#111', border: '1px solid #2A2A2A', borderRadius: '3px', alignSelf: 'flex-start' }}>
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: '#C8650A', letterSpacing: '0.08em' }}>SCANNING TERRAIN</span>
                  <span style={{ display: 'flex', gap: '3px' }}>
                    {[0, 150, 300].map(d => (
                      <span key={d} style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#C8650A', animation: 'bounce 1s infinite', animationDelay: `${d}ms`, display: 'inline-block' }} />
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
                    fontSize: '13px',
                    lineHeight: '1.55',
                    maxWidth: '92%',
                    background: isUser ? '#C8650A' : '#242424',
                    color: isUser ? '#fff' : '#E0E0E0',
                    fontWeight: isUser ? 600 : 400,
                    fontFamily: isUser ? "'Barlow Condensed', sans-serif" : 'inherit',
                    letterSpacing: isUser ? '0.02em' : 'normal',
                  }}
                >
                  {renderMarkdown(m.text)}
                </div>
                {m.annotations && m.annotations.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%', maxWidth: '92%' }}>
                    {m.annotations.map((ann, ai) => (
                      <div key={ai} style={{ background: '#111', border: '1px solid #2A2A2A', borderLeft: '2px solid #C8650A', borderRadius: '2px', padding: '5px 9px', fontSize: '11px' }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C8650A', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', fontSize: '10px' }}>{ann.type.replace('_', ' ')}</span>
                        {ann.label && <span style={{ color: '#E0E0E0', opacity: 0.75 }}> — {ann.label}</span>}
                        {ann.why && <div style={{ color: '#666', marginTop: '2px', lineHeight: '1.3', fontSize: '10.5px' }}>{ann.why}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Map Legend */}
        <div style={{ padding: '0 12px 6px' }}>
          <button
            onClick={() => setLegendOpen(v => !v)}
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '9px', letterSpacing: '0.12em', color: '#444', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' as const, padding: 0, textTransform: 'uppercase' as const }}
          >
            {legendOpen ? '▲ HIDE LEGEND' : '▼ MAP LEGEND'}
          </button>
          {legendOpen && (
            <div style={{ marginTop: '6px', marginBottom: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', background: '#111', border: '1px solid #2A2A2A', borderRadius: '2px', padding: '8px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '10px', letterSpacing: '0.06em', color: '#666' }}>
              <span><span style={{ color: '#FF6B00' }}>■</span> Boundary</span>
              <span><span style={{ color: '#8B4513' }}>■</span> Bedding</span>
              <span><span style={{ color: '#C8650A' }}>■</span> Clover</span>
              <span><span style={{ color: '#facc15' }}>■</span> Corn</span>
              <span><span style={{ color: '#c084fc' }}>■</span> Brassicas</span>
              <span><span style={{ color: '#86efac' }}>■</span> Soybeans</span>
              <span><span style={{ color: '#ef4444' }}>●</span> Stand</span>
              <span><span style={{ color: '#C8650A' }}>▲</span> Tony rec</span>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: '8px 12px', paddingBottom: 'env(safe-area-inset-bottom, 16px)', borderTop: '1px solid #2A2A2A', background: '#141414', display: 'flex', gap: '8px', flexShrink: 0 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(200,101,10,0.6)' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#2E2E2E' }}
            placeholder="Intel request..."
            disabled={loading}
            style={{
              flex: 1,
              background: '#111',
              border: '1px solid #2E2E2E',
              color: '#E0E0E0',
              padding: '7px 10px',
              borderRadius: '2px',
              fontSize: '13px',
              fontFamily: "'Barlow Condensed', sans-serif",
              outline: 'none',
              opacity: loading ? 0.5 : 1,
            }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() ? '#2A2A2A' : '#C8650A',
              color: '#fff',
              fontWeight: 700,
              padding: '0 12px',
              borderRadius: '2px',
              border: 'none',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              flexShrink: 0,
            }}
          >
            ➤
          </button>
          <button
            onClick={clearChat}
            title="Clear chat"
            style={{ color: '#333', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '0 4px', flexShrink: 0 }}
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
              height: '85vh',
              display: 'flex',
              flexDirection: 'column',
              background: '#1A1A1A',
              border: '1px solid #2E2E2E',
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
                padding: '6px 12px 10px',
                background: '#141414',
                borderBottom: '1px solid #2A2A2A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BuckLogo size={22} color="#C8650A" />
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#C8650A', lineHeight: 1 }}>
                    Tony — Field AI
                  </div>
                  {loading && (
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#C8650A', marginTop: '2px', letterSpacing: '0.08em' }}>ANALYZING TERRAIN...</div>
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
                background: '#C8650A',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(200,101,10,0.5)',
              }}
            >
              <BuckLogo size={26} color="#fff" />
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
                    border: '2px solid #C8650A',
                    animation: 'pulse 1.5s infinite',
                  }}
                />
              )}
            </button>
          )}
        </>
      )
    }

    // ── DESKTOP LAYOUT: original panel ──
    return (
      <div
        style={{
          position: 'absolute',
          right: '12px',
          top: '12px',
          zIndex: 1000,
          width: isOpen ? `${PANEL_W}px` : '48px',
          maxHeight: isOpen ? 'calc(100vh - 24px)' : '48px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: '4px',
          background: '#1A1A1A',
          border: '1px solid #2E2E2E',
          boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
          transition: 'width 0.25s ease, max-height 0.25s ease',
          fontFamily: "'Barlow Condensed', 'Inter', sans-serif",
        }}
      >
        {/* Header */}
        <div
          onClick={() => setIsOpen(v => !v)}
          style={{
            padding: '10px 12px',
            background: '#141414',
            borderBottom: isOpen ? '1px solid #2A2A2A' : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            userSelect: 'none' as const,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BuckLogo size={22} color="#C8650A" />
            {isOpen && (
              <div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#C8650A', lineHeight: 1 }}>
                  Tony — Field AI
                </div>
                {loading && (
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#C8650A', marginTop: '2px', letterSpacing: '0.08em' }}>ANALYZING TERRAIN...</div>
                )}
              </div>
            )}
          </div>
          {isOpen && (
            <span style={{ color: '#444', fontSize: '12px', fontWeight: 700 }}>—</span>
          )}
        </div>

        {isOpen && chatBody}
      </div>
    )
  }
)

TonyChat.displayName = 'TonyChat'
export default React.memo(TonyChat)
