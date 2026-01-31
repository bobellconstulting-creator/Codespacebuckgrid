'use client'

import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react'
import html2canvas from 'html2canvas'

export type TonyChatHandle = { 
  addTonyMessage: (text: string) => void;
  triggerScan: (prompt: string) => void; 
}

const TonyChat = forwardRef<TonyChatHandle, { getCaptureTarget: () => HTMLElement | null }>(({ getCaptureTarget }, ref) => {
  const [chat, setChat] = useState([{ role: 'tony', text: "Ready. Lock the border and let's start the audit." }])
  const [input, setInput] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight
  }, [chat])

  useImperativeHandle(ref, () => ({ 
    addTonyMessage: (text: string) => setChat(p => [...p, { role: 'tony', text }]),
    // THIS IS THE NEW FUNCTION THAT GIVES TONY SIGHT
    triggerScan: async (contextPrompt: string) => {
        if (loading) return
        setLoading(true)
        // We add a temporary "Thinking..." message
        setChat(p => [...p, { role: 'tony', text: "Analyzing terrain & cover..." }])
        
        try {
            const target = getCaptureTarget()
            if (!target) throw new Error("No map found")
            
            // 1. SNAP THE PICTURE
            const canvas = await html2canvas(target, { useCORS: true, scale: 1 })
            const image = canvas.toDataURL('image/jpeg', 0.6)

            // 2. SEND TO API
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: contextPrompt, imageDataUrl: image })
            })
            const data = await res.json()
            
            // 3. SHOW REPLY
            setChat(p => {
                const newChat = [...p]
                newChat.pop() // Remove "Analyzing..."
                newChat.push({ role: 'tony', text: data.reply || "Connection error." })
                return newChat
            })
        } catch (e) {
            setChat(p => [...p, { role: 'tony', text: "I couldn't get a clear visual. Try again." }])
        }
        setLoading(false)
    }
  }), [loading, getCaptureTarget])

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
    <div className="glass" style={{ position: 'absolute', right: 10, top: 10, width: isOpen ? 300 : 50, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh', transition: 'width 0.3s' }}>
      <div onClick={() => setIsOpen(!isOpen)} style={{ padding: 12, background: '#1a1a1a', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 10, color: '#FF6B00' }}>
        <span>{isOpen ? 'TONY PARTNER' : '🦌'}</span>
        <span>{isOpen ? '—' : '+'}</span>
      </div>
      {isOpen && (
        <>
          <div ref={containerRef} className="chatArea" style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: 10 }}>
            {chat.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? '#FF6B00' : '#333', color: '#fff', padding: '8px 12px', borderRadius: '10px', fontSize: '12px', maxWidth: '85%', lineHeight: '1.4' }}>{m.text}</div>
            ))}
            {loading && <div style={{ alignSelf: 'flex-start', color: '#888', fontSize: 10, paddingLeft: 4 }}>Tony is looking...</div>}
          </div>
          <div style={{ padding: 10, display: 'flex', gap: 6, background: '#111' }}><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask Tony..." style={{ flex: 1, background: '#222', border: 'none', color: '#fff', padding: 8, borderRadius: 6, fontSize: 12 }} /><button onClick={send} style={{background: '#FF6B00', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#000', fontWeight: 'bold', padding: '0 10px'}}>➤</button></div>
        </>
      )}
    </div>
  )
})

export default React.memo(TonyChat)
