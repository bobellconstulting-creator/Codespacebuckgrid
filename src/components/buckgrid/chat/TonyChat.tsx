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

  // Auto-scroll to latest message
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [chat])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMessage = input.trim()
    setLoading(true)
    setChat(p => [...p, { role: 'user', text: userMessage }])
    setInput('')
    
    try {
      const target = getCaptureTarget()
      if (!target) {
        setChat(p => [...p, { role: 'tony', text: 'No map to capture.' }])
        setLoading(false)
        return
      }

      const canvas = await html2canvas(target, { useCORS: true, scale: 1 })
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.6)
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, imageDataUrl })
      })
      
      // Handle non-JSON response
      const contentType = res.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Non-JSON response from server:', await res.text())
        setChat(p => [...p, { role: 'tony', text: 'Server error. Try again.' }])
        setLoading(false)
        return
      }

      const data = await res.json()
      
      if (!res.ok) {
        console.error('API error:', data.error)
        const friendlyMessage = res.status === 413 
          ? 'Image too large. Try a smaller area.'
          : res.status === 502
          ? 'Upstream service unavailable.'
          : 'Request failed. Try again.'
        setChat(p => [...p, { role: 'tony', text: friendlyMessage }])
      } else {
        setChat(p => [...p, { role: 'tony', text: data.reply || 'No reply.' }])
      }
    } catch (err) {
      console.error('Chat error:', err)
      setChat(p => [...p, { role: 'tony', text: 'Capture or network error.' }])
    }
    
    setLoading(false)
  }

  return (
    <div className="glass" style={{ position: 'absolute', right: 10, top: 10, width: isOpen ? 300 : 50, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
      <div onClick={() => setIsOpen(!isOpen)} style={{ padding: 12, background: '#1a1a1a', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 10 }} aria-label={isOpen ? 'Collapse chat' : 'Expand chat'}>
        <span>{isOpen ? 'TONY PARTNER' : '🦌'}</span>
        <span>{isOpen ? '—' : '+'}</span>
      </div>
      {isOpen && (
        <>
          <div ref={containerRef} className="chatArea" role="log" aria-live="polite" aria-atomic="false">
            {chat.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? '#FF6B00' : '#222', padding: '8px 12px', borderRadius: '10px', fontSize: '11px', maxWidth: '85%' }} role="article" aria-label={m.role === 'user' ? 'Your message' : 'Tony message'}>{m.text}</div>
            ))}
            {loading && <div style={{ alignSelf: 'flex-start', background: '#222', padding: '8px 12px', borderRadius: '10px', fontSize: '11px', color: '#888' }}>Thinking...</div>}
          </div>
          <div style={{ padding: 10, display: 'flex', gap: 6 }}>
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && !loading && send()} 
              disabled={loading}
              placeholder="Ask Tony..."
              aria-label="Message input"
              style={{ flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: 8, borderRadius: 6 }} 
            />
            <button 
              onClick={send} 
              disabled={loading || !input.trim()}
              aria-label="Send message"
              style={{background: loading ? '#555' : '#FF6B00', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer', padding: '8px 12px', color: '#fff'}}
            >➤</button>
          </div>
        </>
      )}
    </div>
  )
})

TonyChat.displayName = 'TonyChat'

export default React.memo(TonyChat)
