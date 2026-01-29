'use client'

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import html2canvas from 'html2canvas'

export type SpatialContext = { propertyAcres: number; activeTool: string; brushSize: number }
export type TonyChatHandle = { addTonyMessage: (text: string) => void }

const glassPanel: React.CSSProperties = {
  background: 'rgba(17, 24, 39, 0.8)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 20,
}

const TonyChat = forwardRef<TonyChatHandle, { getCaptureTarget: () => HTMLElement | null; spatialContext: SpatialContext }>(({ getCaptureTarget, spatialContext }, ref) => {
  const [chat, setChat] = useState([{ role: 'tony', text: "Ready. Lock the border and let's start the audit." }])
  const [input, setInput] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

  useImperativeHandle(ref, () => ({ addTonyMessage: (text: string) => setChat(p => [...p, { role: 'tony', text }]) }), [])

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setInput(prev => (prev ? prev + ' ' : '') + transcript)
      setListening(false)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
  }, [])

  const toggleMic = () => {
    if (!recognitionRef.current) return
    if (listening) {
      recognitionRef.current.stop()
      setListening(false)
    } else {
      recognitionRef.current.start()
      setListening(true)
    }
  }

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight
  }, [chat])

  const send = async () => {
    if (!input.trim() || loading) return
    const msg = input.trim()
    setLoading(true); setChat(p => [...p, { role: 'user', text: msg }]); setInput('')
    try {
      const target = getCaptureTarget()
      const canvas = await html2canvas(target!, { useCORS: true, scale: 1 })
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, imageDataUrl: canvas.toDataURL('image/jpeg', 0.6), spatialContext: JSON.stringify(spatialContext) })
      })
      const data = await res.json()
      setChat(p => [...p, { role: 'tony', text: data.reply }])
    } catch { setChat(p => [...p, { role: 'tony', text: 'Capture failed.' }]) }
    setLoading(false)
  }

  return (
    <div style={{ ...glassPanel, position: 'absolute', right: 12, top: 12, width: isOpen ? 320 : 54, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '75vh', transition: 'width 0.2s ease' }}>
      <div onClick={() => setIsOpen(!isOpen)} style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 900, fontSize: 11, letterSpacing: 1, color: '#fff', borderBottom: isOpen ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
        <span>{isOpen ? 'TONY PARTNER' : '🦌'}</span>
        <span style={{ color: '#666', fontSize: 14 }}>{isOpen ? '−' : '+'}</span>
      </div>
      {isOpen && (
        <>
          <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chat.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? '#FF6B00' : 'rgba(255,255,255,0.06)', color: m.role === 'user' ? '#000' : '#ddd', padding: '8px 14px', borderRadius: 14, fontSize: 12, maxWidth: '85%', lineHeight: 1.4 }}>{m.text}</div>
            ))}
            {loading && <div style={{ color: '#666', fontSize: 11, padding: '4px 8px' }}>Tony is thinking...</div>}
          </div>
          <div style={{ padding: 10, display: 'flex', gap: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask Tony..." style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 12px', borderRadius: 12, fontSize: 12, outline: 'none' }} />
            <button onClick={toggleMic} title="Voice input" style={{ background: listening ? '#FF6B00' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 12, width: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, transition: 'background 0.2s' }}>{listening ? '⏹' : '🎙'}</button>
            <button onClick={send} style={{ background: '#FF6B00', border: 'none', borderRadius: 12, width: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>➤</button>
          </div>
        </>
      )}
    </div>
  )
})

TonyChat.displayName = 'TonyChat'
export default React.memo(TonyChat)
