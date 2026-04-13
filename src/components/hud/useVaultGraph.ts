'use client'

import { useState, useEffect, useRef } from 'react'

export interface VaultNode {
  id: string
  label: string
  path: string
  folder: string
  region: string
  wordCount: number
  modifiedAt: number
  isFiring: boolean
  isAgentGenerated: boolean
  x: number
  y: number
  z: number
}

export interface VaultEdge {
  source: string
  target: string
  weight: number
}

export interface AgentActivity {
  agentName: string
  message: string
  timestamp: number
  nodeId?: string
}

export interface VaultGraph {
  nodes: VaultNode[]
  edges: VaultEdge[]
  agentActivity: AgentActivity[]
  firingNodeIds: string[]
  parsedAt: number
  totalNodes: number
  totalEdges: number
  totalWords: number
}

const EMPTY_GRAPH: VaultGraph = {
  nodes: [],
  edges: [],
  agentActivity: [],
  firingNodeIds: [],
  parsedAt: 0,
  totalNodes: 0,
  totalEdges: 0,
  totalWords: 0,
}

const POLL_INTERVAL_MS = 60_000

export function useVaultGraph(): {
  graph: VaultGraph | null
  loading: boolean
  error: string | null
} {
  const [graph, setGraph] = useState<VaultGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchGraph() {
    try {
      const res = await fetch('/api/hud/graph')
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      const data: VaultGraph = await res.json()
      setGraph(data)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown fetch error'
      setError(message)
      // On first load failure, give back empty graph so UI doesn't stall
      setGraph((prev) => prev ?? EMPTY_GRAPH)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGraph()

    intervalRef.current = setInterval(fetchGraph, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])

  return { graph, loading, error }
}
