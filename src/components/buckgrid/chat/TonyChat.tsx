'use client'

import React, { useCallback, useRef, useEffect } from 'react'
import { useChatStore } from '@/stores/chatStore'

export default function TonyChat() {
  const { messages, loading, isOpen, addMessage, setLoading, toggleOpen } = useChatStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const send = useCallback(async () => {
    const text = inputRef.current?.value.trim()
    if (!text || loading) return
    inputRef.current!.value = ''

    addMessage({ role: 'user', text })
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      addMessage({ role: 'tony', text: data.reply || 'No response.' })
    } catch {
      addMessage({ role: 'tony', text: 'Connection failed. Try again.' })
    }

    setLoading(false)
  }, [loading, addMessage, setLoading])

  return (
    <div className={`chat-panel ${isOpen ? 'chat-open' : 'chat-closed'}`}>
      <div className="chat-header" onClick={toggleOpen}>
        <span className="chat-title">{isOpen ? 'TONY PARTNER' : ''}</span>
        <span className="chat-toggle">{isOpen ? '—' : '+'}</span>
      </div>

      {isOpen && (
        <>
          <div ref={scrollRef} className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.role === 'user' ? 'chat-user' : 'chat-tony'}`}>
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="chat-bubble chat-tony chat-loading">...</div>
            )}
          </div>

          <div className="chat-input-bar">
            <input
              ref={inputRef}
              className="chat-input"
              placeholder="Ask Tony..."
              onKeyDown={(e) => e.key === 'Enter' && send()}
              disabled={loading}
            />
            <button className="chat-send" onClick={send} disabled={loading}>
              &#10148;
            </button>
          </div>
        </>
      )}
    </div>
  )
}
