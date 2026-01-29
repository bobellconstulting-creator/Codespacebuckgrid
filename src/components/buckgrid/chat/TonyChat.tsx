'use client'

import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import type { DrawnFeature } from '../hooks/useMapDrawing'
import { useTonyAnalysis } from '../hooks/useTonyAnalysis'

export type TonyChatHandle = { addTonyMessage: (text: string) => void }

type TonyChatProps = {
  getCaptureTarget: () => HTMLElement | null
  getDrawnFeatures: () => DrawnFeature[]
  propertyAcres: number
}

const TonyChat = forwardRef<TonyChatHandle, TonyChatProps>(({ getCaptureTarget, getDrawnFeatures, propertyAcres }, ref) => {
  const [chat, setChat] = useState([{ role: 'tony', text: "Ready. Lock the border and let's start the audit." }])
  const [input, setInput] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { sendMessage } = useTonyAnalysis({ getDrawnFeatures, propertyAcres, getCaptureTarget })

  useImperativeHandle(ref, () => ({ addTonyMessage: (text: string) => setChat(p => [...p, { role: 'tony', text }]) }), [])

  const send = useCallback(async () => {
    if (!input.trim() || loading) return
    const msg = input.trim()
    setLoading(true)
    setChat(p => [...p, { role: 'user', text: msg }])
    setInput('')
    try {
      const { reply } = await sendMessage(msg)
      setChat(p => [...p, { role: 'tony', text: reply }])
    } catch {
      setChat(p => [...p, { role: 'tony', text: 'I am having trouble connecting. Please try again.' }])
    }
    setLoading(false)
  }, [input, loading, sendMessage])

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
          <div style={{ padding: 10, display: 'flex', gap: 6 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} style={{ flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: 8, borderRadius: 6 }} />
            <button onClick={send} style={{ background: '#FF6B00', border: 'none', borderRadius: 4, cursor: 'pointer' }}>➤</button>
          </div>
        </>
      )}
    </div>
  )
})

export default React.memo(TonyChat)
