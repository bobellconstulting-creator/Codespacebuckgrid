import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

// ─── Types ───────────────────────────────────────────────────────────────────

export type BrainRegion =
  | 'PREFRONTAL'
  | 'MOTOR'
  | 'MEMORY'
  | 'ASSOCIATION'
  | 'SENSORY'
  | 'CONCEPT'
  | 'INTEL'
  | 'SYSTEM'

export interface VaultNode {
  id: string
  label: string
  path: string
  folder: string
  region: BrainRegion
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

// ─── Constants ───────────────────────────────────────────────────────────────

const EXCLUDED_DIRS = ['.claude', '.gemini', '.kiro', '.github', '.obsidian', 'node_modules', '.git']

const REGION_MAP: Record<string, BrainRegion> = {
  '00-inbox': 'PREFRONTAL',
  '01-daily': 'MOTOR',
  '02-personal': 'MEMORY',
  '03-professional': 'ASSOCIATION',
  '04-projects': 'SENSORY',
  '05-knowledge': 'CONCEPT',
  '06-templates': 'CONCEPT',
  'Agents Brain': 'SYSTEM',
}

// 8 evenly-distributed directions on a unit sphere
const REGION_HOMES: Record<BrainRegion, [number, number, number]> = {
  PREFRONTAL:  [ 0.577,  0.577,  0.577],
  MOTOR:       [-0.577,  0.577,  0.577],
  MEMORY:      [ 0.577, -0.577,  0.577],
  ASSOCIATION: [-0.577, -0.577,  0.577],
  SENSORY:     [ 0.577,  0.577, -0.577],
  CONCEPT:     [-0.577,  0.577, -0.577],
  INTEL:       [ 0.577, -0.577, -0.577],
  SYSTEM:      [-0.577, -0.577, -0.577],
}

const WIKILINK_RE = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g
const FLEET_ENTRY_RE = /^##\s+\[(.+?)\]\s+(\w+)\s*\n([\s\S]*?)(?=^##\s+\[|$)/gm
const FIRING_WINDOW = 24 * 60 * 60 * 1000

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashId(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

function collectMarkdownFiles(dir: string, results: string[] = []): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }
  for (const entry of entries) {
    if (EXCLUDED_DIRS.includes(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectMarkdownFiles(fullPath, results)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath)
    }
  }
  return results
}

function topFolder(relativePath: string): string {
  const parts = relativePath.split(path.sep)
  return parts.length > 1 ? parts[0] : ''
}

function regionFor(folder: string): BrainRegion {
  return REGION_MAP[folder] ?? 'SYSTEM'
}

// Deterministic pseudo-random spread from a seed value
function seededSpread(seed: number, range: number): number {
  const x = Math.sin(seed) * 43758.5453123
  return (x - Math.floor(x)) * 2 * range - range
}

// ─── Layout ──────────────────────────────────────────────────────────────────

interface Vec3 { x: number; y: number; z: number }

function computeLayout(nodes: VaultNode[], edges: VaultEdge[]): void {
  const RADIUS = 2.2
  const ITERATIONS = 120
  const SPRING_REST = 0.8
  const SPRING_K = 0.08
  const REPEL_K = 0.15
  const COHESION_K = 0.05
  const ELLIPSOID = [1.25, 0.9, 0.85] as const

  // Initial placement on sphere clustered by region
  const pos: Vec3[] = nodes.map((n, i) => {
    const home = REGION_HOMES[n.region]
    const spread = 0.4
    const ox = seededSpread(i * 3 + 1, spread)
    const oy = seededSpread(i * 3 + 2, spread)
    const oz = seededSpread(i * 3 + 3, spread)
    const raw = { x: home[0] + ox, y: home[1] + oy, z: home[2] + oz }
    const len = Math.sqrt(raw.x ** 2 + raw.y ** 2 + raw.z ** 2) || 1
    return { x: (raw.x / len) * RADIUS, y: (raw.y / len) * RADIUS, z: (raw.z / len) * RADIUS }
  })

  // Build adjacency for spring forces
  const adj: Map<number, number[]> = new Map()
  const nodeIdx = new Map(nodes.map((n, i) => [n.id, i]))
  for (const e of edges) {
    const si = nodeIdx.get(e.source)
    const ti = nodeIdx.get(e.target)
    if (si === undefined || ti === undefined) continue
    if (!adj.has(si)) adj.set(si, [])
    if (!adj.has(ti)) adj.set(ti, [])
    adj.get(si)!.push(ti)
    adj.get(ti)!.push(si)
  }

  // Region centers for cohesion
  const regionCenters = new Map<BrainRegion, Vec3>()
  for (const region of Object.keys(REGION_HOMES) as BrainRegion[]) {
    const h = REGION_HOMES[region]
    regionCenters.set(region, { x: h[0] * RADIUS * 0.6, y: h[1] * RADIUS * 0.6, z: h[2] * RADIUS * 0.6 })
  }

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces: Vec3[] = nodes.map(() => ({ x: 0, y: 0, z: 0 }))

    // Repulsion between all pairs (O(n²) — fine for ~100 nodes)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = pos[i].x - pos[j].x
        const dy = pos[i].y - pos[j].y
        const dz = pos[i].z - pos[j].z
        const dist2 = dx ** 2 + dy ** 2 + dz ** 2 || 0.001
        const f = REPEL_K / dist2
        forces[i].x += f * dx; forces[i].y += f * dy; forces[i].z += f * dz
        forces[j].x -= f * dx; forces[j].y -= f * dy; forces[j].z -= f * dz
      }
    }

    // Spring attraction along edges
    for (let i = 0; i < nodes.length; i++) {
      for (const j of (adj.get(i) ?? [])) {
        if (j <= i) continue
        const dx = pos[j].x - pos[i].x
        const dy = pos[j].y - pos[i].y
        const dz = pos[j].z - pos[i].z
        const dist = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2) || 0.001
        const f = SPRING_K * (dist - SPRING_REST)
        forces[i].x += f * (dx / dist); forces[i].y += f * (dy / dist); forces[i].z += f * (dz / dist)
        forces[j].x -= f * (dx / dist); forces[j].y -= f * (dy / dist); forces[j].z -= f * (dz / dist)
      }
    }

    // Region cohesion
    for (let i = 0; i < nodes.length; i++) {
      const center = regionCenters.get(nodes[i].region)!
      forces[i].x += COHESION_K * (center.x - pos[i].x)
      forces[i].y += COHESION_K * (center.y - pos[i].y)
      forces[i].z += COHESION_K * (center.z - pos[i].z)
    }

    // Damped integration + ellipsoid clamp
    for (let i = 0; i < nodes.length; i++) {
      const damping = 0.85
      pos[i].x += forces[i].x * damping
      pos[i].y += forces[i].y * damping
      pos[i].z += forces[i].z * damping

      // Clamp inside ellipsoid: |(x/ex)²+(y/ey)²+(z/ez)²| ≤ 1
      const [ex, ey, ez] = ELLIPSOID
      const ellipNorm = Math.sqrt((pos[i].x / (ex * RADIUS)) ** 2 + (pos[i].y / (ey * RADIUS)) ** 2 + (pos[i].z / (ez * RADIUS)) ** 2)
      if (ellipNorm > 1) {
        pos[i].x /= ellipNorm
        pos[i].y /= ellipNorm
        pos[i].z /= ellipNorm
      }
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    nodes[i].x = pos[i].x
    nodes[i].y = pos[i].y
    nodes[i].z = pos[i].z
  }
}

// ─── Fleet Feed Parser ────────────────────────────────────────────────────────

function parseFleetFeed(feedPath: string, nodes: VaultNode[]): AgentActivity[] {
  const resolved = path.normalize(feedPath)
  if (!fs.existsSync(resolved)) return []

  let raw: string
  try {
    raw = fs.readFileSync(resolved, 'utf-8')
  } catch {
    return []
  }

  const results: AgentActivity[] = []
  let match: RegExpExecArray | null
  FLEET_ENTRY_RE.lastIndex = 0

  while ((match = FLEET_ENTRY_RE.exec(raw)) !== null) {
    const [, tsRaw, agentName, message] = match
    const timestamp = Date.parse(tsRaw.trim())
    if (isNaN(timestamp)) continue

    const trimmedMsg = message.trim()
    let nodeId: string | undefined

    // Try to match message against node labels (case-insensitive substring)
    const lowerMsg = trimmedMsg.toLowerCase()
    for (const node of nodes) {
      if (node.label.length > 2 && lowerMsg.includes(node.label.toLowerCase())) {
        nodeId = node.id
        break
      }
    }

    results.push({ agentName: agentName.trim(), message: trimmedMsg, timestamp, nodeId })
  }

  // Return last 30 entries sorted descending
  return results.sort((a, b) => b.timestamp - a.timestamp).slice(0, 30)
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export async function parseVault(): Promise<VaultGraph> {
  const vaultPath = path.normalize(process.env.COG_VAULT_PATH ?? 'C:/Users/bobel/COG')
  const feedPath = path.normalize(process.env.FLEET_FEED_PATH ?? 'C:/Users/bobel/.openclaw/FLEET-FEED.md')

  const emptyGraph: VaultGraph = {
    nodes: [], edges: [], agentActivity: [], firingNodeIds: [],
    parsedAt: Date.now(), totalNodes: 0, totalEdges: 0, totalWords: 0,
  }

  if (!fs.existsSync(vaultPath)) return emptyGraph

  // Collect all .md files
  const filePaths = collectMarkdownFiles(vaultPath)
  const now = Date.now()
  const nodes: VaultNode[] = []
  const contentMap = new Map<string, string>() // id → raw content for wikilink pass

  for (const absPath of filePaths) {
    const relPath = path.relative(vaultPath, absPath)
    const folder = topFolder(relPath)
    const region = regionFor(folder)
    const isAgentGenerated = folder === 'Agents Brain' || relPath.startsWith('Agents Brain' + path.sep)

    let stat: fs.Stats
    try { stat = fs.statSync(absPath) } catch { continue }

    let raw: string
    try { raw = fs.readFileSync(absPath, 'utf-8') } catch { continue }

    const parsed = matter(raw)
    const wordCount = parsed.content.split(/\s+/).filter(Boolean).length
    const modifiedAt = stat.mtimeMs
    const label = path.basename(absPath, '.md')
    const id = hashId(relPath.replace(/\\/g, '/'))

    nodes.push({
      id, label, path: relPath.replace(/\\/g, '/'), folder,
      region, wordCount, modifiedAt,
      isFiring: (now - modifiedAt) < FIRING_WINDOW,
      isAgentGenerated,
      x: 0, y: 0, z: 0,
    })
    contentMap.set(id, raw)
  }

  // Build label → id lookup for wikilink resolution
  const labelToId = new Map<string, string>()
  for (const node of nodes) {
    labelToId.set(node.label.toLowerCase(), node.id)
  }

  // Extract wikilinks → edges
  const edgeSet = new Map<string, VaultEdge>()
  for (const node of nodes) {
    const content = contentMap.get(node.id) ?? ''
    WIKILINK_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = WIKILINK_RE.exec(content)) !== null) {
      const targetLabel = m[1].trim().toLowerCase()
      const targetId = labelToId.get(targetLabel)
      if (!targetId || targetId === node.id) continue
      const key = [node.id, targetId].sort().join('|')
      if (!edgeSet.has(key)) {
        edgeSet.set(key, { source: node.id, target: targetId, weight: 1 })
      }
    }
  }

  const edges = Array.from(edgeSet.values())
  computeLayout(nodes, edges)

  const agentActivity = parseFleetFeed(feedPath, nodes)
  const firingNodeIds = nodes.filter(n => n.isFiring).map(n => n.id)
  const totalWords = nodes.reduce((sum, n) => sum + n.wordCount, 0)

  return {
    nodes, edges, agentActivity, firingNodeIds,
    parsedAt: now,
    totalNodes: nodes.length,
    totalEdges: edges.length,
    totalWords,
  }
}
