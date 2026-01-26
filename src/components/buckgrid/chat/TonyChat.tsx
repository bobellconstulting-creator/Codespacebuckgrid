'use client'

import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState, useEffect } from 'react'
import html2canvas from 'html2canvas'

export type TonyChatHandle = { addTonyMessage: (text: string) => void }

const TonyChat = forwardRef<TonyChatHandle, { getCaptureTarget: () => HTMLElement | null }>(({ getCaptureTarget }, ref) => {
  const [chat, setChat] = useState([{ role: 'tony', text: "Ready. Lock the border and let's start the audit." }])
  const [input, setInput] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({ addTonyMessage: (text: string) => setChat(p => [...p, { role: 'tony', text }]) }), [])

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
          <div style={{ padding: 10, display: 'flex', gap: 6 }}><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} style={{ flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: 8, borderRadius: 6 }} /><button onClick={send} style={{background: '#FF6B00', border: 'none', borderRadius: 4, cursor: 'pointer'}}>➤</button></div>
        </>
      )}
    </div>
  )
})

export default React.memo(TonyChat)
