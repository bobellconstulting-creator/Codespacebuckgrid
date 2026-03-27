'use client'

import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react'
import html2canvas from 'html2canvas'

export type TonyChatHandle = { 
  addTonyMessage: (text: string) => void;
  triggerScan: (prompt: string) => void; 
}

type TonyChatProps = {
  getCaptureTarget: () => HTMLElement | null
  drawOnMap?: (geojson: any, type: string, label: string) => void
}

const TonyChat = forwardRef<TonyChatHandle, TonyChatProps>(({ getCaptureTarget, drawOnMap }, ref) => {
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

            // 4. DRAW ANNOTATIONS ON MAP
            if (drawOnMap && Array.isArray(data.annotations)) {
                for (const a of data.annotations) {
                    drawOnMap(a.geojson, a.type, a.label)
                }
            }
        } catch (e) {
            setChat(p => [...p, { role: 'tony', text: "I couldn't get a clear visual. Try again." }])
        }
        setLoading(false)
    }
  }), [loading, getCaptureTarget, drawOnMap])

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
      setChat(p => [...p, { role: 'tony', text: data.reply || 'No response.' }])
      if (drawOnMap && Array.isArray(data.annotations)) {
        for (const a of data.annotations) {
          drawOnMap(a.geojson, a.type, a.label)
        }
      }
    } catch { setChat(p => [...p, { role: 'tony', text: 'Capture failed.' }]) }
    setLoading(false)
  }

  return (
    <div className={`bg-neural-noir-secondary bg-opacity-80 backdrop-blur-lg rounded-neural overflow-hidden flex flex-col max-h-[80vh] transition-all duration-300 absolute right-3 top-3 ${isOpen ? 'w-72' : 'w-12'}`}>
      <div onClick={() => setIsOpen(!isOpen)} className="p-3 bg-neural-noir-primary cursor-pointer flex justify-between font-bold text-xs text-neural-noir-accent uppercase tracking-wide">
        <span>{isOpen ? 'Tony Partner' : '🦌'}</span>
        <span>{isOpen ? '—' : '+'}</span>
      </div>
      {isOpen && (
        <>
          <div ref={containerRef} className="chatArea overflow-y-auto flex-1 flex flex-col gap-2 p-3">
            {chat.map((m, i) => (
              <div key={i} className={`self-${m.role === 'user' ? 'end' : 'start'} bg-${m.role === 'user' ? 'neural-noir-accent' : 'neural-noir-secondary/50'} text-neural-noir-text p-2 rounded-lg text-sm max-w-[85%] leading-relaxed`}>{m.text}</div>
            ))}
            {loading && <div className="self-start text-neural-noir-text text-xs opacity-70 pl-1">Tony is looking...</div>}
          </div>
          <div className="p-3 flex gap-2 bg-neural-noir-primary/90"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask Tony..." className="flex-1 bg-neural-noir-secondary/50 border-none text-neural-noir-text p-2 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-neural-noir-accent" /><button onClick={send} className="bg-neural-noir-accent border-none rounded-sm cursor-pointer text-neural-noir-primary font-bold px-3 hover:bg-neural-noir-highlight transition-colors">➤</button></div>
        </>
      )}
    </div>
  )
})

export default React.memo(TonyChat)
