"use client"
function stripForSpeech(text: string) {
  // remove code blocks
  let t = text.replace(/```[\s\S]*?```/g, "");
  // remove inline code ticks
  t = t.replace(/`[^`]*`/g, "");
  // collapse whitespace
  t = t.replace(/\s+/g, " ").trim();
  // cap length to avoid runaway speech
  if (t.length > 900) t = t.slice(0, 900) + "…";
  return t;
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function useTonyTTS() {
  const [enabled, setEnabled] = React.useState<boolean>(false);
  const [speaking, setSpeaking] = React.useState<boolean>(false);
  const [supported, setSupported] = React.useState<boolean>(false);
  const [needsUserAction, setNeedsUserAction] = React.useState<boolean>(false);
  const [lastTonyIndex, setLastTonyIndex] = React.useState<number>(-1);

  React.useEffect(() => {
    const ok = typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
    setSupported(ok);
    // iOS often blocks autoplay speech unless initiated by a tap
    setNeedsUserAction(isIOS());
    try {
      const saved = typeof window !== "undefined" ? window.localStorage.getItem("tony_voice_enabled") : null;
      if (saved === "true") setEnabled(true);
    } catch {}
  }, []);

  const stop = React.useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.speechSynthesis.cancel();
    } catch {}
    setSpeaking(false);
  }, []);

  const toggle = React.useCallback(() => {
    setEnabled((v) => {
      const next = !v;
      try {
        if (typeof window !== "undefined") window.localStorage.setItem("tony_voice_enabled", String(next));
      } catch {}
      if (!next) {
        // if turning off, stop any active speech
        try {
          if (typeof window !== "undefined") window.speechSynthesis.cancel();
        } catch {}
        setSpeaking(false);
      }
      return next;
    });
  }, []);

  const speakText = React.useCallback((text: string) => {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;
    const cleaned = stripForSpeech(text);
    if (!cleaned) return;

    // cancel any current speech
    try {
      window.speechSynthesis.cancel();
    } catch {}

    const u = new SpeechSynthesisUtterance(cleaned);
    u.lang = "en-US";
    u.rate = 1.05;
    u.pitch = 0.95;

    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);

    try {
      window.speechSynthesis.speak(u);
    } catch {
      setSpeaking(false);
    }
  }, []);

  // Called by UI to play last Tony message manually (iOS fallback)
  const manualPlay = React.useCallback(() => {
    // This will be wired by the component by calling setLastTonyIndex + calling speakText
    // We leave it as a no-op default; TonyChat should call `ttsPlay(text, index)` instead.
  }, []);

  // Provide a helper TonyChat can call when a new Tony message arrives
  const ttsPlay = React.useCallback((text: string, index: number) => {
    setLastTonyIndex(index);
    speakText(text);
  }, [speakText]);

  return { enabled, toggle, speaking, stop, supported, needsUserAction, manualPlay, lastTonyIndex, ttsPlay };
}
"use client"
// --- Tony voice output hook ---
function useTonyVoice({ chat }: { chat: { role: string, text: string }[] }) {
  const [enabled, setEnabled] = React.useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('tony_voice_enabled') === 'true'
  })
  const [supported, setSupported] = React.useState(true)
  const [speaking, setSpeaking] = React.useState(false)
  const [needsUserAction, setNeedsUserAction] = React.useState(false)
  const utterRef = React.useRef<SpeechSynthesisUtterance | null>(null)
  const lastTonyIndex = React.useMemo(() => {
    for (let i = chat.length - 1; i >= 0; --i) if (chat[i].role === 'tony') return i
    return -1
  }, [chat])
  const lastTonyText = lastTonyIndex >= 0 ? chat[lastTonyIndex].text : ''

  React.useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSupported(false)
      return
    }
    setSupported(true)
  }, [])

  // Speak on new Tony message if enabled
  React.useEffect(() => {
    if (!enabled || !supported || !lastTonyText) return
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    // iOS Safari blocks auto-speak unless user interacted
    let spoken = false
    const speak = () => {
      window.speechSynthesis.cancel()
      const utter = new window.SpeechSynthesisUtterance()
      // Strip code blocks and JSON
      let txt = lastTonyText.replace(/```[\s\S]*?```/g, '').replace(/\{[\s\S]*?\}/g, '')
      txt = txt.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
      utter.text = txt.slice(0, 900)
      utter.rate = 1.1
      utter.pitch = 0.95
      // Pick English voice
      const voices = window.speechSynthesis.getVoices()
      const en = voices.find(v => v.lang && v.lang.startsWith('en'))
      if (en) utter.voice = en
      utter.onstart = () => setSpeaking(true)
      utter.onend = () => setSpeaking(false)
      utter.onerror = () => setSpeaking(false)
      utterRef.current = utter
      try {
        window.speechSynthesis.speak(utter)
        spoken = true
        setNeedsUserAction(false)
      } catch {
        setNeedsUserAction(true)
      }
    }
    // Try to speak, fallback to user action if blocked
    setTimeout(() => {
      try {
        speak()
      } catch {
        setNeedsUserAction(true)
      }
    }, 200)
    // Cleanup: stop on unmount
    return () => window.speechSynthesis.cancel()
    // eslint-disable-next-line
  }, [lastTonyText, enabled, supported])

  // Stop speaking
  const stop = () => {
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  // Toggle voice
  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    window.localStorage.setItem('tony_voice_enabled', next ? 'true' : 'false')
    if (!next) stop()
  }

  // Manual play (for iOS fallback)
  const manualPlay = () => {
    if (!supported || !lastTonyText) return
    window.speechSynthesis.cancel()
    const utter = new window.SpeechSynthesisUtterance()
    let txt = lastTonyText.replace(/```[\s\S]*?```/g, '').replace(/\{[\s\S]*?\}/g, '')
    txt = txt.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
    utter.text = txt.slice(0, 900)
    utter.rate = 1.1
    utter.pitch = 0.95
    const voices = window.speechSynthesis.getVoices()
    const en = voices.find(v => v.lang && v.lang.startsWith('en'))
    if (en) utter.voice = en
    utter.onstart = () => setSpeaking(true)
    utter.onend = () => setSpeaking(false)
    utter.onerror = () => setSpeaking(false)
    utterRef.current = utter
    try {
      window.speechSynthesis.speak(utter)
      setNeedsUserAction(false)
    } catch {
      setNeedsUserAction(true)
    }
  }

  return { enabled, toggle, speaking, stop, supported, needsUserAction, manualPlay, lastTonyIndex }
}

import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react'
// --- Voice input hook ---
function useVoiceInput({ setInput }: { setInput: (s: string) => void }) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
      return
    }
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          setInput((prev: string) => prev + transcript)
        } else {
          interim += transcript
        }
      }
      if (interim) setInput((prev: string) => prev + interim)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    return () => {
      recognition.stop && recognition.stop()
    }
  }, [setInput])

  const toggle = () => {
    if (!recognitionRef.current) return
    if (listening) {
      recognitionRef.current.stop()
      setListening(false)
    } else {
      try {
        recognitionRef.current.start()
        setListening(true)
      } catch {}
    }
  }
  return { listening, supported, toggle }
}
import html2canvas from 'html2canvas'
import type { Feature } from 'geojson'
import type { Tool } from '../constants/tools'
import type { MapContext } from '../hooks/useMapDrawing'

export type TonyChatHandle = { addTonyMessage: (text: string) => void }

const TonyChat = forwardRef<TonyChatHandle, { 
  getCaptureTarget: () => HTMLElement | null
  acres: number
  activeTool: Tool
  getMapContext: () => MapContext | null
  onDrawFeatures?: (features: Feature[]) => void
}>(({ getCaptureTarget, acres, activeTool, getMapContext, onDrawFeatures }, ref) => {
  const [chat, setChat] = useState([{ role: 'tony', text: "Ready. Lock the border and let's start the audit." }])
  const [input, setInput] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const { listening, supported: voiceInputSupported, toggle: toggleMic } = useVoiceInput({ setInput })
  const tts = useTonyTTS();
  const containerRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const describeFocusFeature = (feature: MapContext['focusFeatures'][number]) => {
    const coords = feature.geometry?.type === 'LineString' ? feature.geometry.coordinates : []
    if (!coords.length) return 'Focus path (no coords)'
    const [startLng, startLat] = coords[0] as [number, number]
    const [endLng, endLat] = coords[coords.length - 1] as [number, number]
    return `${feature.properties?.label || 'Focus track'} (${startLat.toFixed(4)}, ${startLng.toFixed(4)}) → (${endLat.toFixed(4)}, ${endLng.toFixed(4)})`
  }

  TonyChat.displayName = 'TonyChat'

  const buildContextText = (ctx: MapContext | null) => {
    if (!ctx) return ''
    const lines: string[] = []
    if (ctx.bounds) {
      lines.push(`Viewport lat ${ctx.bounds.south.toFixed(4)}→${ctx.bounds.north.toFixed(4)}, lng ${ctx.bounds.west.toFixed(4)}→${ctx.bounds.east.toFixed(4)} @ zoom ${ctx.zoom ?? 'n/a'}`)
    }
    if (ctx.boundary) {
      lines.push('Property boundary locked — treat as HARD EDGE. All coordinates must live inside this polygon.')
      lines.push(`Boundary vertices: ${ctx.boundary.geometry.coordinates?.[0]?.length || 0}`)
    } else {
      lines.push('Boundary not locked yet. Warn user before suggesting across property lines.')
    }
    if (ctx.focusFeatures?.length) {
      lines.push(`User Focus Highlights (${ctx.focusFeatures.length}): ${ctx.focusFeatures.map(describeFocusFeature).join(' | ')}`)
      const preview = JSON.stringify(ctx.focusFeatures.slice(0, 2))
      lines.push(`Focus GeoJSON Preview: ${preview}`)
    }
    if (ctx.userDrawn?.features?.length) {
      lines.push(`User drawn layers count: ${ctx.userDrawn.features.length}`)
    }
    return `MAP CONTEXT\n${lines.join('\n')}\n`
  }

  useImperativeHandle(ref, () => ({ addTonyMessage: (text: string) => setChat(p => [...p, { role: 'tony', text }]) }), [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  const send = async () => {
    if (!input.trim() || loading) return
      const spatialContext = `[Property: ${acres ? acres + ' acres' : 'not set'} | Tool: ${activeTool.name}]\n`
    const baseMessage = spatialContext + input
    setLoading(true)
    setChat(p => [...p, { role: 'user', text: input }])
    setInput('')
    
    let imageDataUrl: string | undefined
    try {
      const target = getCaptureTarget()
      if (target) {
        const canvas = await html2canvas(target, { useCORS: true, scale: 1 })
        imageDataUrl = canvas.toDataURL('image/jpeg', 0.6)
      }
    } catch (err) {
      console.warn('Map capture failed, sending text-only:', err)
    }
    
    // Get map context (bounds, drawn features)
    const mapContext = getMapContext()
    const contextText = buildContextText(mapContext)
    const fullMessage = `${contextText}${baseMessage}`

    // SceneGraphLite injection
    const sceneGraphLite = mapContext?.sceneGraphLite || null
    if (sceneGraphLite) {
      // TEMP LOG: boundary acres, feature count, totalsByType keys
      // eslint-disable-next-line no-console
      console.log('[SceneGraphLite]', {
        boundaryAcres: sceneGraphLite.boundary.acres,
        featureCount: sceneGraphLite.features.length,
        totalsByTypeKeys: Object.keys(sceneGraphLite.totalsByType)
      })
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: fullMessage, imageDataUrl, mapContext, sceneGraphLite })
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()

      // Handle structured response
      const reply = data.reply || data.error || 'No response'
      setChat(p => [...p, { role: 'tony', text: reply }])

      // Draw AI-suggested features on map
      if (data.drawing && data.drawing.features && data.drawing.features.length > 0 && onDrawFeatures) {
        onDrawFeatures(data.drawing.features)
      }
    } catch (err) {
      setChat(p => [...p, { role: 'tony', text: `Error: ${err instanceof Error ? err.message : 'Request failed'}` }])
    }

    setLoading(false)
  }

  return (
    <div
      className="glass textureOverlay"
      style={{
        position: 'absolute',
        right: 14,
        top: 70,
        width: isOpen ? 320 : 52,
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '75vh',
        borderTop: '2px solid rgba(200, 165, 92, 0.3)',
        transition: 'width 0.25s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 14px',
          background: 'rgba(15, 26, 15, 0.6)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(200, 165, 92, 0.1)',
          gap: 8,
        }}
      >
        <span
          onClick={() => setIsOpen(!isOpen)}
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 13,
            letterSpacing: 3,
            color: 'var(--gold)',
            cursor: 'pointer',
            flex: 1,
          }}
        >
          {isOpen ? 'TONY PARTNER' : 'T'}
        </span>
        {/* Voice toggle button */}
        <button
          onClick={toggleVoice}
          aria-label={voiceEnabled ? 'Disable Tony voice' : 'Enable Tony voice'}
          style={{
            background: voiceEnabled ? 'var(--gold-dark)' : 'rgba(200, 165, 92, 0.12)',
            color: voiceEnabled ? '#fff' : 'var(--gold)',
            border: 'none',
            borderRadius: '50%',
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            cursor: 'pointer',
            marginRight: 2,
            boxShadow: voiceEnabled ? '0 0 0 2px var(--gold)' : 'none',
            outline: voiceEnabled ? '2px solid var(--gold)' : 'none',
            transition: 'background 0.2s, color 0.2s, box-shadow 0.2s',
          }}
        >
          {/* Speaker SVG */}
          <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" style={{ verticalAlign: 'middle' }}>
            <path d="M3 8v4h4l5 5V3L7 8H3z"/>
            <path d="M14.5 8.5a3.5 3.5 0 0 1 0 3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          </svg>
        </button>
        {/* Stop button if speaking */}
        {speaking && voiceEnabled && (
          <button onClick={stop} aria-label="Stop voice" style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 13, cursor: 'pointer' }}>Stop</button>
        )}
      </div>

      {isOpen && (
        <>
          {/* Messages */}
          <div ref={containerRef} className="chatArea">
            {chat.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  background: m.role === 'user'
                    ? 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dark) 100%)'
                    : 'rgba(200, 165, 92, 0.08)',
                  color: m.role === 'user' ? '#0A0A08' : 'var(--bone)',
                  padding: '9px 13px',
                  borderRadius: m.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                  fontSize: 11,
                  fontWeight: m.role === 'user' ? 600 : 400,
                  maxWidth: '88%',
                  lineHeight: 1.5,
                  border: m.role === 'user' ? 'none' : '1px solid rgba(200, 165, 92, 0.08)',
                  position: 'relative',
                }}
              >
                {m.text}
                {/* iOS fallback: play button for latest Tony message if needed */}
                {tts.enabled && tts.needsUserAction && m.role === 'tony' && i === tts.lastTonyIndex && (
                  <button onClick={tts.manualPlay} aria-label="Play voice" style={{ position: 'absolute', right: 6, bottom: 6, background: 'none', border: 'none', color: 'var(--gold)', fontSize: 15, cursor: 'pointer' }}>
                    <svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor"><polygon points="6,4 16,10 6,16"/></svg>
                  </button>
                )}
              </div>
            ))}
            {loading && (
              <div style={{
                fontSize: 11,
                color: 'var(--gold-dark)',
                fontStyle: 'italic',
                padding: '4px 0',
              }}>
                Tony is analyzing...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px',
            display: 'flex',
            gap: 8,
            borderTop: '1px solid rgba(200, 165, 92, 0.08)',
            alignItems: 'center',
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Message Tony..."
              style={{
                flex: 1,
                background: 'rgba(10, 10, 8, 0.8)',
                border: '1px solid rgba(200, 165, 92, 0.15)',
                color: 'var(--bone)',
                padding: '9px 12px',
                borderRadius: 4,
                fontSize: 11,
                fontFamily: 'var(--font-body)',
                outline: 'none',
              }}
            />
            <button
              onClick={toggleMic}
              type="button"
              aria-label={listening ? 'Stop voice input' : 'Start voice input'}
              style={{
                background: listening ? 'var(--gold-dark)' : 'rgba(200, 165, 92, 0.12)',
                color: listening ? '#fff' : 'var(--gold)',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                cursor: 'pointer',
                boxShadow: listening ? '0 0 0 2px var(--gold)' : 'none',
                transition: 'background 0.2s, color 0.2s, box-shadow 0.2s',
                outline: listening ? '2px solid var(--gold)' : 'none',
              }}
            >
              <span style={{
                display: 'inline-block',
                width: 18,
                height: 18,
                lineHeight: 0,
              }}>
                {/* Simple mic SVG */}
                <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" style={{ verticalAlign: 'middle' }}>
                  <rect x="8" y="4" width="4" height="8" rx="2"/>
                  <rect x="9" y="13" width="2" height="3" rx="1"/>
                  <path d="M5 10a5 5 0 0 0 10 0" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </span>
            </button>
            <button
              onClick={send}
              disabled={loading}
              style={{
                background: 'linear-gradient(180deg, var(--gold) 0%, var(--gold-dark) 100%)',
                border: 'none',
                borderRadius: 4,
                cursor: loading ? 'wait' : 'pointer',
                padding: '0 12px',
                color: '#0A0A08',
                fontWeight: 900,
                fontSize: 13,
                opacity: loading ? 0.5 : 1,
              }}
            >
              &rsaquo;
            </button>
          </div>
          {/* Voice input support message */}
          {!voiceInputSupported && (
            <div style={{ color: 'var(--gold-dark)', fontSize: 11, margin: '4px 0 0 12px' }}>
              Voice input not supported on this browser.
            </div>
          )}
          {listening && voiceInputSupported && (
            <div style={{ color: 'var(--gold)', fontSize: 11, margin: '4px 0 0 12px' }}>
              Listening...
            </div>
          )}
          {!tts.supported && (
            <div style={{ color: 'var(--gold-dark)', fontSize: 11, margin: '4px 0 0 12px' }}>
              Tony voice not supported on this browser.
            </div>
          )}
        </>
      )}
    </div>
  )
})

export default React.memo(TonyChat)
