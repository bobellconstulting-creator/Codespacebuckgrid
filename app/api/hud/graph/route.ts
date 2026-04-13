import { NextResponse } from 'next/server'
import { parseVault } from '../../../../lib/vault-parser'
import type { VaultGraph } from '../../../../lib/vault-parser'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── In-Memory Cache ─────────────────────────────────────────────────────────

interface GraphCache {
  graph: VaultGraph
  cachedAt: number
}

let cache: GraphCache | null = null

const TTL_MS = process.env.NODE_ENV === 'development' ? 30_000 : 300_000

function isCacheFresh(): boolean {
  if (cache === null) return false
  return Date.now() - cache.cachedAt < TTL_MS
}

// ─── Empty Graph Fallback ─────────────────────────────────────────────────────

function emptyGraph(): VaultGraph {
  return {
    nodes: [],
    edges: [],
    agentActivity: [],
    firingNodeIds: [],
    parsedAt: Date.now(),
    totalNodes: 0,
    totalEdges: 0,
    totalWords: 0,
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  if (isCacheFresh()) {
    return NextResponse.json(cache!.graph, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  let graph: VaultGraph
  try {
    graph = await parseVault()
  } catch {
    graph = emptyGraph()
  }

  cache = { graph, cachedAt: Date.now() }

  return NextResponse.json(graph, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
