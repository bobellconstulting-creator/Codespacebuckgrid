'use client'

import { useRef, useMemo } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { VaultNode, VaultEdge } from './useVaultGraph'

const PARTICLE_COUNT = 2200
const CONNECTION_COUNT = 5000
const BRAIN_RADIUS = 2.2
const FIRE_DURATION = 0.8  // seconds a neuron stays hot
const FIRE_RATE = 0.04     // probability per frame per particle of spontaneous firing

// ── Region color map ──────────────────────────────────────────────────────────
const REGION_COLORS: Record<string, string> = {
  PREFRONTAL:  '#00d4ff',
  MOTOR:       '#00ffaa',
  MEMORY:      '#a855f7',
  ASSOCIATION: '#f97316',
  SENSORY:     '#3b82f6',
  CONCEPT:     '#ec4899',
  INTEL:       '#fbbf24',
  SYSTEM:      '#6b7280',
}

function regionColorVec3(region: string): [number, number, number] {
  const hex = REGION_COLORS[region.toUpperCase()] ?? '#6b7280'
  const c = new THREE.Color(hex)
  return [c.r, c.g, c.b]
}

// ── Hardcoded INTEL nodes (AI creators Bo follows) ────────────────────────────
interface IntelNode {
  id: string
  label: string
  region: 'INTEL'
  x: number
  y: number
  z: number
}

const INTEL_NODES: IntelNode[] = [
  { id: 'intel-jai',    label: 'JAI',           region: 'INTEL', x: -2.4, y: 1.8, z: 1.2 },
  { id: 'intel-ethan',  label: 'ETHANPLUSAI',   region: 'INTEL', x: -2.0, y: 2.1, z: 0.8 },
  { id: 'intel-bougie', label: 'BOUGIE HIPPIE',  region: 'INTEL', x: -2.6, y: 1.5, z: 1.5 },
  { id: 'intel-robby',  label: 'ROBBY·BOSS',     region: 'INTEL', x: -2.2, y: 2.4, z: 0.5 },
]

const INTEL_BASE_FIRE = 0.3  // always slightly hot

// Generate rough brain-shaped point cloud
function generateBrainPoints(count: number): Float32Array {
  const positions = new Float32Array(count * 3)
  let i = 0
  while (i < count) {
    const u = Math.random() * 2 - 1
    const v = Math.random() * 2 - 1
    const w = Math.random() * 2 - 1
    const len = Math.sqrt(u * u + v * v + w * w)
    if (len > 1) continue

    let x = u * BRAIN_RADIUS * 1.25
    let y = v * BRAIN_RADIUS * 0.9
    let z = w * BRAIN_RADIUS * 0.85

    if (x > 0) x *= 1.08

    const surfaceBias = 0.4 + Math.random() * 0.6
    x *= surfaceBias
    y *= surfaceBias
    z *= surfaceBias

    positions[i * 3 + 0] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z
    i++
  }
  return positions
}

// Build synapse connection pairs — only connect nearby particles
function buildConnections(positions: Float32Array, count: number, maxDist: number, maxConnections: number) {
  const pairs: [number, number][] = []
  const neighborMap: Map<number, number[]> = new Map()

  for (let i = 0; i < count && pairs.length < maxConnections; i++) {
    const ax = positions[i * 3]
    const ay = positions[i * 3 + 1]
    const az = positions[i * 3 + 2]
    const neighbors: number[] = []

    for (let j = i + 1; j < count && pairs.length < maxConnections; j++) {
      const dx = ax - positions[j * 3]
      const dy = ay - positions[j * 3 + 1]
      const dz = az - positions[j * 3 + 2]
      const dist2 = dx * dx + dy * dy + dz * dz
      if (dist2 < maxDist * maxDist) {
        pairs.push([i, j])
        neighbors.push(j)
      }
    }
    neighborMap.set(i, neighbors)
  }

  return { pairs, neighborMap }
}

// Region labels around the brain
const BRAIN_REGIONS = [
  { label: 'PREFRONTAL',  pos: new THREE.Vector3(-2.8, 1.2, 1.4) },
  { label: 'MOTOR',       pos: new THREE.Vector3(0, 2.6, 0.6)   },
  { label: 'SENSORY',     pos: new THREE.Vector3(2.6, 1.2, 0.8)  },
  { label: 'MEMORY',      pos: new THREE.Vector3(-3.0, -0.4, 0.5) },
  { label: 'ASSOCIATION', pos: new THREE.Vector3(2.8, -0.6, 0.8)  },
  { label: 'CONCEPT',     pos: new THREE.Vector3(0, -2.4, 1.2)   },
]

// ── Props ─────────────────────────────────────────────────────────────────────
interface BrainParticlesProps {
  nodes?: VaultNode[]
  edges?: VaultEdge[]
  firingNodeIds?: string[]
  onNodeClick?: (node: VaultNode) => void
}

export function BrainParticles({
  nodes = [],
  edges = [],
  firingNodeIds = [],
  onNodeClick,
}: BrainParticlesProps) {
  const particleRef = useRef<THREE.Points>(null!)
  const lineRef = useRef<THREE.LineSegments>(null!)
  const realNodesRef = useRef<THREE.Points>(null!)
  const realEdgesRef = useRef<THREE.LineSegments | null>(null)
  const groupRef = useRef<THREE.Group>(null!)

  // ── Ghost particle geometry (built once) ────────────────────────────────────
  const { positions, colors, sizes, connections, neighborMap } = useMemo(() => {
    const positions = generateBrainPoints(PARTICLE_COUNT)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    const sizes = new Float32Array(PARTICLE_COUNT)

    const baseCyan = new THREE.Color('#00d4ff')
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      colors[i * 3 + 0] = baseCyan.r
      colors[i * 3 + 1] = baseCyan.g
      colors[i * 3 + 2] = baseCyan.b
      sizes[i] = 0.018 + Math.random() * 0.022
    }

    const { pairs, neighborMap } = buildConnections(positions, PARTICLE_COUNT, 0.55, CONNECTION_COUNT)

    const linePositions = new Float32Array(pairs.length * 2 * 3)
    const lineColors = new Float32Array(pairs.length * 2 * 3)
    for (let i = 0; i < pairs.length; i++) {
      const [a, b] = pairs[i]
      linePositions[i * 6 + 0] = positions[a * 3 + 0]
      linePositions[i * 6 + 1] = positions[a * 3 + 1]
      linePositions[i * 6 + 2] = positions[a * 3 + 2]
      linePositions[i * 6 + 3] = positions[b * 3 + 0]
      linePositions[i * 6 + 4] = positions[b * 3 + 1]
      linePositions[i * 6 + 5] = positions[b * 3 + 2]
      lineColors[i * 6 + 0] = 0.0
      lineColors[i * 6 + 1] = 0.25
      lineColors[i * 6 + 2] = 0.35
      lineColors[i * 6 + 3] = 0.0
      lineColors[i * 6 + 4] = 0.25
      lineColors[i * 6 + 5] = 0.35
    }

    return { positions, colors, sizes, connections: { pairs, linePositions, lineColors }, neighborMap }
  }, [])

  // ── Real vault node geometry (rebuilt when nodes prop changes) ───────────────
  const allRealNodes: Array<VaultNode | IntelNode> = useMemo(() => {
    return [...nodes, ...INTEL_NODES]
  }, [nodes])

  const realNodeCount = allRealNodes.length

  const realNodeGeo = useMemo(() => {
    if (realNodeCount === 0) return null
    const pos = new Float32Array(realNodeCount * 3)
    const col = new Float32Array(realNodeCount * 3)

    for (let i = 0; i < realNodeCount; i++) {
      const n = allRealNodes[i]
      pos[i * 3 + 0] = n.x
      pos[i * 3 + 1] = n.y
      pos[i * 3 + 2] = n.z
      const [r, g, b] = regionColorVec3(n.region)
      col[i * 3 + 0] = r
      col[i * 3 + 1] = g
      col[i * 3 + 2] = b
    }

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [allRealNodes, realNodeCount])

  // ── Real vault edge geometry ────────────────────────────────────────────────
  // Build an index for quick node lookup by id
  const nodeIndex = useMemo(() => {
    const map = new Map<string, VaultNode | IntelNode>()
    for (const n of allRealNodes) map.set(n.id, n)
    return map
  }, [allRealNodes])

  const realEdgeGeo = useMemo(() => {
    if (edges.length === 0) return null
    const verts: number[] = []
    const cols: number[] = []

    for (const e of edges) {
      const src = nodeIndex.get(e.source)
      const tgt = nodeIndex.get(e.target)
      if (!src || !tgt) continue

      verts.push(src.x, src.y, src.z)
      verts.push(tgt.x, tgt.y, tgt.z)

      // Use source node region color, slightly desaturated
      const [r, g, b] = regionColorVec3(src.region)
      const dim = 0.35
      cols.push(r * dim, g * dim, b * dim)
      cols.push(r * dim, g * dim, b * dim)
    }

    if (verts.length === 0) return null

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cols), 3))
    return geo
  }, [edges, nodeIndex])

  // ── Fire state (ghost particles) ────────────────────────────────────────────
  const fireState = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT))
  const fireTime = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT))

  // ── Fire state (real vault nodes) ───────────────────────────────────────────
  // Maps node id → heat 0..1
  const realFireMap = useRef<Map<string, number>>(new Map())

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const geo = particleRef.current?.geometry
    const lineGeo = lineRef.current?.geometry
    if (!geo || !lineGeo) return

    // Rotate brain
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.12
      groupRef.current.rotation.x = Math.sin(t * 0.5) * 0.03
    }

    const colAttr = geo.attributes.color as THREE.BufferAttribute
    const colArr = colAttr.array as Float32Array
    const lineColAttr = lineGeo.attributes.color as THREE.BufferAttribute
    const lineColArr = lineColAttr.array as Float32Array

    const fire = fireState.current
    const fireT = fireTime.current

    // Spontaneous ghost firing
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (fire[i] < 0.05 && Math.random() < FIRE_RATE * dt * 60) {
        fire[i] = 1.0
        fireT[i] = t
        const neighbors = neighborMap.get(i)
        if (neighbors) {
          for (const n of neighbors) {
            if (fire[n] < 0.1 && Math.random() < 0.4) {
              fire[n] = Math.max(fire[n], 0.15)
            }
          }
        }
      }
    }

    const breathe = 0.5 + Math.sin(t * Math.PI) * 0.5

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (fire[i] > 0.05) {
        const age = t - fireT[i]
        fire[i] = Math.max(0, 1.0 - age / FIRE_DURATION)
        const heat = fire[i]
        colArr[i * 3 + 0] = 0.0 + heat * 1.0
        colArr[i * 3 + 1] = 0.83 + heat * 0.17
        colArr[i * 3 + 2] = 1.0
      } else {
        const b = 0.55 + breathe * 0.2 + Math.sin(t * 3.1 + i * 0.7) * 0.08
        colArr[i * 3 + 0] = 0.0
        colArr[i * 3 + 1] = b * 0.83
        colArr[i * 3 + 2] = b
      }
    }
    colAttr.needsUpdate = true

    const { pairs } = connections
    for (let i = 0; i < pairs.length; i++) {
      const [a, b] = pairs[i]
      const heat = Math.max(fire[a], fire[b])
      if (heat > 0.1) {
        const hc = heat * 0.9
        lineColArr[i * 6 + 0] = hc * 0.2
        lineColArr[i * 6 + 1] = hc * 0.9
        lineColArr[i * 6 + 2] = hc
        lineColArr[i * 6 + 3] = hc * 0.2
        lineColArr[i * 6 + 4] = hc * 0.9
        lineColArr[i * 6 + 5] = hc
      } else {
        lineColArr[i * 6 + 0] = 0.0
        lineColArr[i * 6 + 1] = 0.12
        lineColArr[i * 6 + 2] = 0.18
        lineColArr[i * 6 + 3] = 0.0
        lineColArr[i * 6 + 4] = 0.12
        lineColArr[i * 6 + 5] = 0.18
      }
    }
    lineColAttr.needsUpdate = true

    // ── Animate real vault node colors ───────────────────────────────────────
    const rng = realNodesRef.current
    if (rng && rng.geometry.attributes.color && realNodeCount > 0) {
      const rColAttr = rng.geometry.attributes.color as THREE.BufferAttribute
      const rColArr = rColAttr.array as Float32Array
      const firingSet = new Set(firingNodeIds)

      for (let i = 0; i < realNodeCount; i++) {
        const n = allRealNodes[i]
        const isIntel = n.region === 'INTEL'
        const isFiring = firingSet.has(n.id)

        // Get or set heat
        let heat = realFireMap.current.get(n.id) ?? (isIntel ? INTEL_BASE_FIRE : 0)

        if (isFiring && heat < 0.9) {
          heat = Math.min(1.0, heat + dt * 3)
        } else if (!isFiring) {
          const floor = isIntel ? INTEL_BASE_FIRE : 0
          heat = Math.max(floor, heat - dt * 1.2)
        }
        realFireMap.current.set(n.id, heat)

        const [br, bg, bb] = regionColorVec3(n.region)
        // At heat=0 use region color at 0.7 brightness; at heat=1 blow out to white
        const boost = 1.0 + heat * 1.8
        rColArr[i * 3 + 0] = Math.min(1, br * boost + heat * 0.4)
        rColArr[i * 3 + 1] = Math.min(1, bg * boost + heat * 0.3)
        rColArr[i * 3 + 2] = Math.min(1, bb * boost + heat * 0.2)
      }
      rColAttr.needsUpdate = true
    }
  })

  // ── Ghost geometry objects ───────────────────────────────────────────────────
  const pointGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors.slice(), 3))
    return g
  }, [positions, colors])

  const lineGeoMemo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(connections.linePositions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(connections.lineColors.slice(), 3))
    return g
  }, [connections])

  // ── Click handler on real nodes ─────────────────────────────────────────────
  function handleRealNodeClick(e: ThreeEvent<MouseEvent>) {
    if (!onNodeClick || realNodeCount === 0) return
    e.stopPropagation()
    const idx = e.index
    if (idx === undefined) return
    const n = allRealNodes[idx]
    // INTEL nodes are not VaultNodes — only fire callback for vault nodes
    if ('path' in n) {
      onNodeClick(n as VaultNode)
    }
  }

  return (
    <group ref={groupRef}>
      {/* ── Ghost synapse connections ── */}
      <lineSegments ref={lineRef} geometry={lineGeoMemo} frustumCulled={false}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          depthWrite={false}
        />
      </lineSegments>

      {/* ── Ghost neuron particles ── */}
      <points ref={particleRef} geometry={pointGeo} frustumCulled={false}>
        <pointsMaterial
          vertexColors
          size={0.055}
          sizeAttenuation
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          depthWrite={false}
        />
      </points>

      {/* ── Real vault edge lines ── */}
      {realEdgeGeo && (
        <lineSegments ref={realEdgesRef} geometry={realEdgeGeo} frustumCulled={false}>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={0.65}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            depthWrite={false}
          />
        </lineSegments>
      )}

      {/* ── Real vault nodes + INTEL nodes ── */}
      {realNodeGeo && (
        <points
          ref={realNodesRef}
          geometry={realNodeGeo}
          frustumCulled={false}
          onClick={handleRealNodeClick}
        >
          <pointsMaterial
            vertexColors
            size={0.08}
            sizeAttenuation
            transparent
            opacity={1.0}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            depthWrite={false}
          />
        </points>
      )}

      {/* ── INTEL node Html labels (always present) ── */}
      {INTEL_NODES.map((n) => (
        <Html
          key={n.id}
          position={[n.x, n.y, n.z]}
          center
          distanceFactor={10}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              position: 'relative',
              padding: '2px 6px',
              border: '1px solid rgba(251,191,36,0.35)',
              background: 'rgba(0,8,20,0.7)',
              clipPath: 'polygon(4px 0%, calc(100% - 4px) 0%, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0% calc(100% - 4px), 0% 4px)',
              backdropFilter: 'blur(2px)',
            }}
          >
            <div style={{ position: 'absolute', top: 1, left: 1, width: 4, height: 4, borderTop: '1px solid rgba(251,191,36,0.7)', borderLeft: '1px solid rgba(251,191,36,0.7)' }} />
            <div style={{ position: 'absolute', bottom: 1, right: 1, width: 4, height: 4, borderBottom: '1px solid rgba(251,191,36,0.7)', borderRight: '1px solid rgba(251,191,36,0.7)' }} />
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '7px',
                color: '#fbbf24',
                letterSpacing: '0.14em',
                textShadow: '0 0 6px #fbbf24',
                display: 'block',
                whiteSpace: 'nowrap',
              }}
            >
              {n.label}
            </span>
          </div>
        </Html>
      ))}
    </group>
  )
}

export { BRAIN_REGIONS }
