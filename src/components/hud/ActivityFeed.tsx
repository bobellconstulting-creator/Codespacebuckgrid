'use client'

import { useEffect, useRef, useState } from 'react'

interface LogEntry {
  id: number
  time: string
  agent: string
  agentColor: string
  msg: string
}

const AGENT_COLORS: Record<string, string> = {
  CLAUDE:   '#c084fc',
  ATLAS:    '#fb923c',
  MARCUS:   '#60a5fa',
  VAULT:    '#4ade80',
  ARIA:     '#f472b6',
  SYSTEM:   '#00d4ff',
}

const MESSAGES = [
  ['CLAUDE',  'Semantic embedding complete — 847 vectors indexed'],
  ['SYSTEM',  'Synaptic pathway reinforced: CONCEPT → MEMORY'],
  ['MARCUS',  'Retrieval query executed — 23ms latency'],
  ['VAULT',   'Memory node compressed: 128 tokens → 12 tokens'],
  ['ARIA',    'Pattern recognition: anomaly flagged in sector 7'],
  ['ATLAS',   'Knowledge graph traversal: depth 4 complete'],
  ['CLAUDE',  'Reasoning chain: 6 steps — confidence 94.2%'],
  ['SYSTEM',  'Neural cascade fired: PREFRONTAL → MOTOR'],
  ['MARCUS',  'Context window optimized — 3,200 tokens freed'],
  ['VAULT',   'Long-term recall activated: node #2,847'],
  ['ARIA',    'Cross-modal synthesis: language + spatial merged'],
  ['ATLAS',   'External query resolved — API latency 41ms'],
  ['CLAUDE',  'Hypothesis generated — awaiting validation'],
  ['SYSTEM',  'Synaptic load nominal: 73% utilization'],
  ['MARCUS',  'Index rebuild complete — 2,847 nodes active'],
  ['VAULT',   'Episodic memory trace stored — priority: HIGH'],
  ['ARIA',    'Signal clarity: 99.1% — noise floor suppressed'],
  ['CLAUDE',  'Meta-reasoning loop closed — no contradictions'],
  ['ATLAS',   'Tool invocation: web_search — 0.3s response'],
  ['SYSTEM',  'Agent handoff: CLAUDE → MARCUS — task: retrieval'],
]

let globalId = 0

function makeEntry(): LogEntry {
  const now = new Date()
  const hh = now.getHours().toString().padStart(2, '0')
  const mm = now.getMinutes().toString().padStart(2, '0')
  const ss = now.getSeconds().toString().padStart(2, '0')
  const ms = now.getMilliseconds().toString().padStart(3, '0')
  const [agent, msg] = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
  return {
    id: globalId++,
    time: `${hh}:${mm}:${ss}.${ms}`,
    agent,
    agentColor: AGENT_COLORS[agent] ?? '#00d4ff',
    msg,
  }
}

// Seed initial entries
function seedEntries(count: number): LogEntry[] {
  return Array.from({ length: count }, makeEntry)
}

export function ActivityFeed() {
  const [entries, setEntries] = useState<LogEntry[]>(() => seedEntries(8))
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // New log lines every 1.2–2.8 seconds
    const schedule = () => {
      const delay = 1200 + Math.random() * 1600
      return setTimeout(() => {
        setEntries((prev) => {
          const next = [...prev, makeEntry()]
          return next.slice(-10)  // keep last 10
        })
        timerRef.current = schedule()
      }, delay)
    }
    const timerRef = { current: schedule() }
    return () => clearTimeout(timerRef.current)
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [entries])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
          paddingBottom: 5,
          borderBottom: '1px solid rgba(0,212,255,0.15)',
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#00d4ff',
            boxShadow: '0 0 6px #00d4ff',
            animation: 'hud-blink 1.2s infinite',
          }}
        />
        <span
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '9px',
            letterSpacing: '0.15em',
            color: '#00d4ff',
            opacity: 0.7,
          }}
        >
          ACTIVITY LOG
        </span>
      </div>

      <div
        ref={feedRef}
        style={{
          flex: 1,
          overflowY: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {entries.map((entry, idx) => (
          <div
            key={entry.id}
            style={{
              display: 'flex',
              gap: 6,
              alignItems: 'flex-start',
              opacity: 0.4 + (idx / entries.length) * 0.6,
              animation: idx === entries.length - 1 ? 'hud-fadein 0.4s ease-out' : undefined,
            }}
          >
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '8px',
                color: 'rgba(0,212,255,0.4)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                lineHeight: '1.4',
              }}
            >
              {entry.time}
            </span>
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '8px',
                color: entry.agentColor,
                textShadow: `0 0 4px ${entry.agentColor}`,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                lineHeight: '1.4',
              }}
            >
              [{entry.agent}]
            </span>
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '8px',
                color: 'rgba(184,244,255,0.65)',
                lineHeight: '1.4',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.msg}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
