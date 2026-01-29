'use client'

import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react'
import html2canvas from 'html2canvas'
import type { Tool } from '../constants/tools'

export type TonyChatHandle = { addTonyMessage: (text: string) => void }

const TonyChat = forwardRef<TonyChatHandle, { 
  getCaptureTarget: () => HTMLElement | null
  acres: number
  activeTool: Tool
  getMapContext: () => any
  onDrawFeatures?: (features: any[]) => void
}>(({ getCaptureTarget, acres, activeTool, getMapContext, onDrawFeatures }, ref) => {
  const [chat, setChat] = useState([{ role: 'tony', text: "Ready. Lock the border and let's start the audit." }])
  const [input, setInput] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({ addTonyMessage: (text: string) => setChat(p => [...p, { role: 'tony', text }]) }), [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  const send = async () => {
    if (!input.trim() || loading) return
    const spatialContext = `[Property: ${acres ? acres + ' acres' : 'not set'} | Tool: ${activeTool.label}]\\n`
    const fullMessage = spatialContext + input
    setLoading(true)
    setChat(p => [...p, { role: 'user', text: input }])
    setInput('')
    
    let imageDataUrl: string | undefined
    try {
      const target = getCaptureTarget()
      if (target) {
        const canvas = await html2canvas(target, { useCORS: true, scale: 1 })
        imageDataUrl = canvas.toDataURL('image/jpeg', 0.6)
      }
    } catch (err) {
      console.warn('Map capture failed, sending text-only:', err)
    }
    
    // Get map context (bounds, drawn features)
    const mapContext = getMapContext()
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: fullMessage, imageDataUrl, mapContext })
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      
      // Handle structured response
      const reply = data.reply || data.error || 'No response'
      setChat(p => [...p, { role: 'tony', text: reply }])
      
      // Draw AI-suggested features on map
      if (data.drawing && data.drawing.features && data.drawing.features.length > 0 && onDrawFeatures) {
        onDrawFeatures(data.drawing.features)
      }
    } catch (err) {
      setChat(p => [...p, { role: 'tony', text: `Error: ${err instanceof Error ? err.message : 'Request failed'}` }])
    }
    
    setLoading(false)
  }

  return (
    <div
      className="glass textureOverlay"
      style={{
        position: 'absolute',
        right: 14,
        top: 70,
        width: isOpen ? 320 : 52,
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '75vh',
        borderTop: '2px solid rgba(200, 165, 92, 0.3)',
        transition: 'width 0.25s ease',
      }}
    >
      {/* Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '12px 14px',
          background: 'rgba(15, 26, 15, 0.6)',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(200, 165, 92, 0.1)',
        }}
      >
        <span style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 13,
          letterSpacing: 3,
          color: 'var(--gold)',
        }}>
          {isOpen ? 'TONY PARTNER' : 'T'}
        </span>
        <span style={{
          color: 'var(--gold-dark)',
          fontSize: 14,
          fontWeight: 300,
        }}>
          {isOpen ? '\u2014' : '+'}
        </span>
      </div>

      {isOpen && (
        <>
          {/* Messages */}
          <div ref={containerRef} className="chatArea">
            {chat.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  background: m.role === 'user'
                    ? 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dark) 100%)'
                    : 'rgba(200, 165, 92, 0.08)',
                  color: m.role === 'user' ? '#0A0A08' : 'var(--bone)',
                  padding: '9px 13px',
                  borderRadius: m.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                  fontSize: 11,
                  fontWeight: m.role === 'user' ? 600 : 400,
                  maxWidth: '88%',
                  lineHeight: 1.5,
                  border: m.role === 'user' ? 'none' : '1px solid rgba(200, 165, 92, 0.08)',
                }}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div style={{
                fontSize: 11,
                color: 'var(--gold-dark)',
                fontStyle: 'italic',
                padding: '4px 0',
              }}>
                Tony is analyzing...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px',
            display: 'flex',
            gap: 8,
            borderTop: '1px solid rgba(200, 165, 92, 0.08)',
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Message Tony..."
              style={{
                flex: 1,
                background: 'rgba(10, 10, 8, 0.8)',
                border: '1px solid rgba(200, 165, 92, 0.15)',
                color: 'var(--bone)',
                padding: '9px 12px',
                borderRadius: 4,
                fontSize: 11,
                fontFamily: 'var(--font-body)',
                outline: 'none',
              }}
            />
            <button
              onClick={send}
              disabled={loading}
              style={{
                background: 'linear-gradient(180deg, var(--gold) 0%, var(--gold-dark) 100%)',
                border: 'none',
                borderRadius: 4,
                cursor: loading ? 'wait' : 'pointer',
                padding: '0 12px',
                color: '#0A0A08',
                fontWeight: 900,
                fontSize: 13,
                opacity: loading ? 0.5 : 1,
              }}
            >
              &rsaquo;
            </button>
          </div>
        </>
      )}
    </div>
  )
})

export default React.memo(TonyChat)
