'use client'

import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react'
import html2canvas from 'html2canvas'
import type { BlueprintFeature, DrawnShape, TonySuggestedShape } from '../hooks/useMapDrawing'

export type TonyChatHandle = {
  addTonyMessage: (text: string) => void
  updateAcres: (acres: number) => void
}

type TonyChatProps = {
  getCaptureTarget: () => HTMLElement | null
  getBoundaryGeoJSON: () => object | null
  getDrawnShapes: () => DrawnShape[]
  onBlueprintReceived: (features: BlueprintFeature[]) => void
  onSuggestionsReceived: (shapes: TonySuggestedShape[]) => void
  onApplySuggestions: () => number
  onClearSuggestions: () => void
  propertyAcres: number
}

const STORAGE_KEY = 'buckgrid_user_name'

const TonyChat = forwardRef<TonyChatHandle, TonyChatProps>(({ getCaptureTarget, getBoundaryGeoJSON, getDrawnShapes, onBlueprintReceived, onSuggestionsReceived, onApplySuggestions, onClearSuggestions, propertyAcres }, ref) => {
  const [chat, setChat] = useState<{ role: string; text: string }[]>([])
  const [input, setInput] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const [askingName, setAskingName] = useState(false)
  const [hasPendingSuggestions, setHasPendingSuggestions] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const acresRef = useRef(propertyAcres)

  useEffect(() => { acresRef.current = propertyAcres }, [propertyAcres])

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      setUserName(stored)
      setChat([{ role: 'tony', text: `${stored}. Good to see you back. Drop a border so I know what we're working with.` }])
    } else {
      setAskingName(true)
      setChat([{ role: 'tony', text: "Hey — before we get into it, what do I call you?" }])
    }
  }, [])

  useImperativeHandle(ref, () => ({
    addTonyMessage: (text: string) => setChat(p => [...p, { role: 'tony', text }]),
    updateAcres: (acres: number) => {
      acresRef.current = acres
      const name = userName || 'boss'
      setChat(p => [...p, { role: 'tony', text: `${acres} acres locked. Alright ${name}, I can see the whole property now. Tell me what you're thinking or ask me what I'd do with it.` }])
    }
  }), [userName])

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight
  }, [chat])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = input
    setInput('')

    if (askingName) {
      const name = userMsg.trim()
      localStorage.setItem(STORAGE_KEY, name)
      setUserName(name)
      setAskingName(false)
      setChat(p => [
        ...p,
        { role: 'user', text: userMsg },
        { role: 'tony', text: `${name}. Got it. Lock a border on the map and we'll get to work.` }
      ])
      return
    }

    setLoading(true)
    setChat(p => [...p, { role: 'user', text: userMsg }])

    try {
      const target = getCaptureTarget()
      const canvas = await html2canvas(target!, { useCORS: true, scale: 1 })
      const boundaryGeoJSON = getBoundaryGeoJSON()
      const drawnShapes = getDrawnShapes()

      const spatialContext = {
        boundaryPolygon: boundaryGeoJSON,
        propertyAcres: acresRef.current,
        activeFeatures: drawnShapes.map(s => ({
          type: s.toolName,
          toolId: s.toolId,
          color: s.color,
          pointCount: s.coords.length,
          centroid: s.coords.length > 0
            ? [
                s.coords.reduce((sum, c) => sum + c[0], 0) / s.coords.length,
                s.coords.reduce((sum, c) => sum + c[1], 0) / s.coords.length
              ]
            : null,
          bounds: s.coords.length > 0
            ? {
                minLat: Math.min(...s.coords.map(c => c[0])),
                maxLat: Math.max(...s.coords.map(c => c[0])),
                minLng: Math.min(...s.coords.map(c => c[1])),
                maxLng: Math.max(...s.coords.map(c => c[1]))
              }
            : null
        }))
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          imageDataUrl: canvas.toDataURL('image/jpeg', 0.6),
          spatialContext,
          userName: userName || undefined
        })
      })
      const data = await res.json()
      setChat(p => [...p, { role: 'tony', text: data.reply }])

      if (data.map_update && Array.isArray(data.map_update)) {
        onBlueprintReceived(data.map_update)
      }

      if (data.tonySuggestedShapes && Array.isArray(data.tonySuggestedShapes) && data.tonySuggestedShapes.length > 0) {
        onSuggestionsReceived(data.tonySuggestedShapes)
        setHasPendingSuggestions(true)
      }
    } catch { setChat(p => [...p, { role: 'tony', text: 'Signal dropped. Try again.' }]) }
    setLoading(false)
  }

  const handleApply = () => {
    const count = onApplySuggestions()
    setHasPendingSuggestions(false)
    if (count > 0) {
      setChat(p => [...p, { role: 'tony', text: `Done. ${count} suggestion${count > 1 ? 's' : ''} locked into the plan.` }])
    }
  }

  const handleDismiss = () => {
    onClearSuggestions()
    setHasPendingSuggestions(false)
    setChat(p => [...p, { role: 'tony', text: "Scrapped. Your call — tell me what you want instead." }])
  }

  return (
    <div className="glass" style={{ position: 'absolute', right: 10, top: 10, width: isOpen ? 300 : 50, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
      <div onClick={() => setIsOpen(!isOpen)} style={{ padding: 12, background: '#1a1a1a', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 10 }}>
        <span>{isOpen ? 'TONY ARCHITECT' : '🦌'}</span>
        <span>{isOpen ? '—' : '+'}</span>
      </div>
      {isOpen && (
        <>
          <div ref={containerRef} className="chatArea">
            {chat.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? '#FF6B00' : '#222', padding: '8px 12px', borderRadius: '10px', fontSize: '11px', maxWidth: '85%' }}>{m.text}</div>
            ))}
          </div>
          {hasPendingSuggestions && (
            <div style={{ padding: '8px 10px', display: 'flex', gap: 6, borderTop: '1px solid #333' }}>
              <button onClick={handleApply} style={{ flex: 1, background: '#2D5A1E', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 0', fontSize: 10, fontWeight: 900, cursor: 'pointer', letterSpacing: 0.5 }}>
                APPLY TONY'S SUGGESTION
              </button>
              <button onClick={handleDismiss} style={{ background: '#333', color: '#888', border: 'none', borderRadius: 6, padding: '8px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                X
              </button>
            </div>
          )}
          <div style={{ padding: 10, display: 'flex', gap: 6 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder={askingName ? "Your name..." : "Ask Tony..."} style={{ flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: 8, borderRadius: 6 }} />
            <button onClick={send} disabled={loading} style={{ background: '#FF6B00', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>➤</button>
          </div>
        </>
      )}
    </div>
  )
})

export default React.memo(TonyChat)
