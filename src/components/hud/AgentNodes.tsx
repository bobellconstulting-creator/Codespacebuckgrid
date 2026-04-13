'use client'

import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { AgentActivity } from './useVaultGraph'

interface Agent {
  id: string
  label: string
  color: string
  emissive: string
  orbitRadius: number
  orbitSpeed: number
  orbitPhaseOffset: number
  orbitTilt: number
}

const AGENTS: Agent[] = [
  { id: 'claude',  label: 'CLAUDE',  color: '#a855f7', emissive: '#c084fc', orbitRadius: 4.2, orbitSpeed: 0.22, orbitPhaseOffset: 0,             orbitTilt: 0.18  },
  { id: 'jarvis',  label: 'JARVIS',  color: '#f97316', emissive: '#fb923c', orbitRadius: 4.6, orbitSpeed: 0.17, orbitPhaseOffset: Math.PI * 0.5,  orbitTilt: -0.12 },
  { id: 'marcus',  label: 'MARCUS',  color: '#3b82f6', emissive: '#60a5fa', orbitRadius: 4.0, orbitSpeed: 0.28, orbitPhaseOffset: Math.PI,        orbitTilt: 0.22  },
  { id: 'vault',   label: 'VAULT',   color: '#22c55e', emissive: '#4ade80', orbitRadius: 4.8, orbitSpeed: 0.14, orbitPhaseOffset: Math.PI * 1.4,  orbitTilt: -0.08 },
  { id: 'linda',   label: 'LINDA',   color: '#ec4899', emissive: '#f472b6', orbitRadius: 4.3, orbitSpeed: 0.20, orbitPhaseOffset: Math.PI * 0.8,  orbitTilt: 0.15  },
]

// Hexagon shape geometry (flat 2D hex)
function makeHexShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape()
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    const x = radius * Math.cos(angle)
    const y = radius * Math.sin(angle)
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return shape
}

interface AgentNodeMeshProps {
  agent: Agent
  isActive: boolean
  brainCenter: THREE.Vector3
}

function AgentNodeMesh({ agent, isActive, brainCenter }: AgentNodeMeshProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const ringRef = useRef<THREE.Mesh>(null!)
  const hexOuterRef = useRef<THREE.Mesh>(null!)
  const beamRef = useRef<THREE.Mesh>(null!)
  const pulseRingRef = useRef<THREE.Mesh>(null!)

  const hexShape = useMemo(() => makeHexShape(0.22), [])
  const hexPoints = useMemo(() => makeHexShape(0.28), [])

  const color = new THREE.Color(agent.color)
  const emissive = new THREE.Color(agent.emissive)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const phase = t * agent.orbitSpeed + agent.orbitPhaseOffset

    // Orbit position — elliptical arc (x-z plane with tilt)
    const x = Math.cos(phase) * agent.orbitRadius
    const z = Math.sin(phase) * agent.orbitRadius * 0.65
    const y = Math.sin(phase + agent.orbitTilt * Math.PI) * 0.8

    if (groupRef.current) {
      groupRef.current.position.set(x, y, z)
      // Face camera-ish — billboard on Y
      groupRef.current.rotation.y = -phase + Math.PI * 0.5
    }

    // Pulsing ring
    if (pulseRingRef.current) {
      const pulse = isActive
        ? 1.0 + Math.sin(t * 4 + agent.orbitPhaseOffset) * 0.25
        : 1.0 + Math.sin(t * 1.5 + agent.orbitPhaseOffset) * 0.08
      pulseRingRef.current.scale.setScalar(pulse)
      const mat = pulseRingRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = isActive ? 0.7 + Math.sin(t * 4) * 0.3 : 0.2
    }

    // Beam toward brain — only when active
    if (beamRef.current) {
      const visible = isActive
      beamRef.current.visible = visible
      if (visible) {
        // Dash pattern via opacity animation
        const dashPhase = (t * 2.5) % 1
        const mat = beamRef.current.material as THREE.MeshBasicMaterial
        mat.opacity = 0.3 + dashPhase * 0.5
      }
    }
  })

  // Build beam geometry pointing from node toward brain center
  const beamGeo = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.006, 0.006, 1, 4)
    geo.translate(0, -0.5, 0)  // pivot from top
    return geo
  }, [])

  return (
    <group ref={groupRef}>
      {/* Pulse ring */}
      <mesh ref={pulseRingRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.32, 0.012, 4, 32]} />
        <meshBasicMaterial
          color={agent.emissive}
          transparent
          opacity={0.4}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer hex wire */}
      <mesh ref={hexOuterRef}>
        <shapeGeometry args={[hexPoints]} />
        <meshBasicMaterial
          color={agent.emissive}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          wireframe={false}
        />
      </mesh>

      {/* Inner hex fill */}
      <mesh>
        <shapeGeometry args={[hexShape]} />
        <meshBasicMaterial
          color={agent.color}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Hex border line */}
      <lineLoop>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[
              new Float32Array(
                Array.from({ length: 6 }, (_, i) => {
                  const a = (Math.PI / 3) * i - Math.PI / 6
                  return [0.28 * Math.cos(a), 0.28 * Math.sin(a), 0.001]
                }).flat()
              ),
              3,
            ]}
            count={6}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={agent.emissive}
          transparent
          opacity={0.85}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </lineLoop>

      {/* Label */}
      <Html
        position={[0, -0.52, 0]}
        center
        style={{ pointerEvents: 'none' }}
        distanceFactor={8}
      >
        <div
          style={{
            color: agent.emissive,
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '9px',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textShadow: `0 0 6px ${agent.color}, 0 0 12px ${agent.color}`,
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          {agent.label}
        </div>
      </Html>

      {/* Beam mesh — cylinder aimed at brain, scaled dynamically */}
      <mesh
        ref={beamRef}
        geometry={beamGeo}
        visible={false}
        rotation={[0, 0, 0]}
      >
        <meshBasicMaterial
          color={agent.emissive}
          transparent
          opacity={0.4}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

// BeamLine draws a line from an orbiting agent toward the brain
function AgentBeams() {
  const linesRef = useRef<THREE.Group>(null!)

  // Active state cycling
  const activeStates = useRef<boolean[]>(AGENTS.map(() => false))
  const activeTimes = useRef<number[]>(AGENTS.map(() => 0))

  useFrame((state) => {
    const t = state.clock.elapsedTime

    // Cycle active states with offsets
    AGENTS.forEach((agent, i) => {
      const cycleT = (t + agent.orbitPhaseOffset) % 7.0
      activeStates.current[i] = cycleT < 2.5
    })

    // Update each beam line
    const group = linesRef.current
    if (!group) return

    AGENTS.forEach((agent, i) => {
      const phase = t * agent.orbitSpeed + agent.orbitPhaseOffset
      const x = Math.cos(phase) * agent.orbitRadius
      const z = Math.sin(phase) * agent.orbitRadius * 0.65
      const y = Math.sin(phase + agent.orbitTilt * Math.PI) * 0.8

      const line = group.children[i] as THREE.Line
      if (!line) return

      const isActive = activeStates.current[i]
      line.visible = isActive

      if (isActive) {
        const positions = line.geometry.attributes.position.array as Float32Array
        positions[0] = x
        positions[1] = y
        positions[2] = z
        // Target: slightly inside brain
        positions[3] = x * 0.08
        positions[4] = y * 0.08
        positions[5] = z * 0.08
        line.geometry.attributes.position.needsUpdate = true

        // Animated dash opacity
        const mat = line.material as THREE.LineBasicMaterial
        const dash = ((t * 3 + i * 1.5) % 1)
        mat.opacity = 0.15 + dash * 0.55
      }
    })
  })

  // Build THREE.Line objects imperatively to avoid JSX <line> SVG conflict
  const lineObjects = useMemo(() => {
    return AGENTS.map((agent) => {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 0, 0]), 3))
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(agent.emissive),
        transparent: true,
        opacity: 0.4,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const line = new THREE.Line(geo, mat)
      line.visible = false
      return line
    })
  }, [])

  return (
    <group ref={linesRef}>
      {lineObjects.map((lineObj, i) => (
        <primitive key={AGENTS[i].id} object={lineObj} />
      ))}
    </group>
  )
}

interface AgentNodesProps {
  agentActivity?: AgentActivity[]
}

const ACTIVITY_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

function getActivityDrivenActive(agentActivity: AgentActivity[]): Set<string> {
  const now = Date.now()
  const active = new Set<string>()
  for (const entry of agentActivity) {
    if (now - entry.timestamp <= ACTIVITY_WINDOW_MS) {
      // Match agentName (case-insensitive) to AGENTS id
      const id = entry.agentName.toLowerCase()
      if (AGENTS.some((a) => a.id === id)) {
        active.add(id)
      }
    }
  }
  return active
}

export function AgentNodes({ agentActivity }: AgentNodesProps = {}) {
  const [randomActiveSet, setRandomActiveSet] = useState<Set<string>>(
    new Set(['claude', 'marcus'])
  )

  // Random cycling — only used when no agentActivity is provided
  useEffect(() => {
    if (agentActivity !== undefined) return

    const interval = setInterval(() => {
      setRandomActiveSet(() => {
        const all = AGENTS.map((a) => a.id)
        const next = new Set<string>()
        const count = 2 + Math.floor(Math.random() * 3)
        const shuffled = [...all].sort(() => Math.random() - 0.5)
        shuffled.slice(0, count).forEach((id) => next.add(id))
        return next
      })
    }, 3200)
    return () => clearInterval(interval)
  }, [agentActivity])

  const activeSet =
    agentActivity !== undefined
      ? getActivityDrivenActive(agentActivity)
      : randomActiveSet

  const brainCenter = new THREE.Vector3(0, 0, 0)

  return (
    <group>
      {AGENTS.map((agent) => (
        <AgentNodeMesh
          key={agent.id}
          agent={agent}
          isActive={activeSet.has(agent.id)}
          brainCenter={brainCenter}
        />
      ))}
      <AgentBeams />
    </group>
  )
}
