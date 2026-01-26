'use client'

import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState, useEffect } from 'react'
import html2canvas from 'html2canvas'

export type TonyChatHandle = { 
  addTonyMessage: (text: string) => void 
}

const TonyChat = forwardRef<TonyChatHandle, { getCaptureTarget: () => HTMLElement | null, getGeoJSON: () => any }>(({ getCaptureTarget, getGeoJSON }, ref) => {
  const [chat, setChat] = useState([{ role: 'tony', text: "Ready. Lock the border and let's start the audit." }])
  const [input, setInput] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({ addTonyMessage: (text: string) => setChat(p => [...p, { role: 'tony', text }]) }), [])

  const analyze = async () => {
    if (loading) return
    setLoading(true)
    setChat(p => [...p, { role: 'user', text: '🔍 Analyze Plan' }])
    try {
      const geoJSON = getGeoJSON()
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planJson: { layers: geoJSON.features } })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setChat(p => [...p, { role: 'tony', text: data.analysis }])
    } catch (err) {
      console.error(err)
      setChat(p => [...p, { role: 'tony', text: 'Analysis failed. Check your API key and connection.' }])
    }
    setLoading(false)
  }

  const send = async () => {
    if (!input.trim() || loading) return
    setLoading(true); setChat(p => [...p, { role: 'user', text: input }]); setInput('')
    try {
      const target = getCaptureTarget()
      const canvas = await html2canvas(target!, { useCORS: true, scale: 1 })
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, imageDataUrl: canvas.toDataURL('image/jpeg', 0.6) })
      })
      const data = await res.json()
      setChat(p => [...p, { role: 'tony', text: data.reply }])
    } catch { setChat(p => [...p, { role: 'tony', text: 'Capture failed.' }]) }
    setLoading(false)
  }

  return (
    <div className="glass" style={{ position: 'absolute', right: 10, top: 10, width: isOpen ? 300 : 50, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
      <div onClick={() => setIsOpen(!isOpen)} style={{ padding: 12, background: '#1a1a1a', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 10 }}>
        <span>{isOpen ? 'TONY PARTNER' : '🦌'}</span>
        <span>{isOpen ? '—' : '+'}</span>
      </div>
      {isOpen && (
        <>
          <div ref={containerRef} className="chatArea">
            {chat.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? '#FF6B00' : '#222', padding: '8px 12px', borderRadius: '10px', fontSize: '11px', maxWidth: '85%' }}>{m.text}</div>
            ))}
          </div>
          <div style={{ padding: 10, borderTop: '1px solid #222' }}>
            <button onClick={analyze} disabled={loading} style={{ width: '100%', background: '#4ade80', color: '#000', border: 'none', padding: 12, borderRadius: 6, fontWeight: 900, cursor: 'pointer', marginBottom: 8, opacity: loading ? 0.5 : 1 }}>
              🔍 ANALYZE PLAN
            </button>
            <div style={{ display: 'flex', gap: 6 }}><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} style={{ flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: 8, borderRadius: 6 }} placeholder="Message..." /><button onClick={send} disabled={loading} style={{background: '#FF6B00', color: '#000', border: 'none', padding: '0 12px', borderRadius: 6, cursor: 'pointer', opacity: loading ? 0.5 : 1}}>➤</button></div>
          </div>
        </>
      )}
    </div>
  )
})

export default React.memo(TonyChat)
