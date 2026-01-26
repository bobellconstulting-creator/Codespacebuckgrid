cat << 'EOF' > src/components/buckgrid/chat/TonyChat.tsx
'use client'

import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState, useEffect } from 'react'
import html2canvas from 'html2canvas'

export type TonyChatHandle = {
  addTonyMessage: (text: string) => void
}

const TonyChat = forwardRef<TonyChatHandle, { getCaptureTarget: () => HTMLElement | null }>(({ getCaptureTarget }, ref) => {
  const [chat, setChat] = useState([{ role: 'tony' as const, text: "Ready. Lock the border and let's start the audit." }])
  const [input, setInput] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    addTonyMessage: (text: string) => setChat(prev => [...prev, { role: 'tony', text }])
  }), [])

  useEffect(() => {
    containerRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  const send = async () => {
    if (!input.trim() || loading) return
    const msg = input.trim()
    setLoading(true)
    setInput('')
    setChat(prev => [...prev, { role: 'user', text: msg }])

    try {
      const target = getCaptureTarget()
      if (!target) throw new Error('Map target missing')

      const canvas = await html2canvas(target, {
        useCORS: true,
        scale: 1,
        logging: false,
        backgroundColor: null
      })

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          imageDataUrl: canvas.toDataURL('image/jpeg', 0.6)
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'API Error')
      
      setChat(prev => [...prev, { role: 'tony', text: data.reply }])
    } catch (err) {
      console.error(err)
      setChat(prev => [...prev, { role: 'tony', text: 'Audit failed. Check your connection or API key.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass" style={{ position: 'absolute', right: 10, top: 10, width: isOpen ? 300 : 50, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh', transition: 'width 0.2s' }}>
      <div onClick={() => setIsOpen(!isOpen)} style={{ padding: 12, background: '#1a1a1a', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 10 }}>
        <span>{isOpen ? 'TONY PARTNER' : '🦌'}</span>
        <span>{isOpen ? '—' : '+'}</span>
      </div>
      {isOpen && (
        <>
          <div ref={containerRef} className="chatArea" style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {chat.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? '#FF6B00' : '#222', color: m.role === 'user' ? '#000' : '#fff', padding: '8px 12px', borderRadius: '10px', fontSize: '11px', maxWidth: '85%', marginBottom: 8 }}>
                {m.text}
              </div>
            ))}
          </div>
          <div style={{ padding: 10, borderTop: '1px solid #222', display: 'flex', gap: 6 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} style={{ flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: 8, borderRadius: 6, fontSize: 12 }} placeholder="Message..." />
            <button onClick={send} disabled={loading} style={{ background: '#FF6B00', color: '#000', border: 'none', padding: '0 12px', borderRadius: 6, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>➤</button>
          </div>
        </>
      )}
    </div>
  )
})

export default TonyChat
EOF
