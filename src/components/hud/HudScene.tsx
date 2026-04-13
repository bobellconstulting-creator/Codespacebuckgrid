'use client'

import { useRef, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, MeshDistortMaterial } from '@react-three/drei'
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { BrainParticles, BRAIN_REGIONS } from './BrainParticles'
import { AgentNodes } from './AgentNodes'
import { HudOverlay } from './HudOverlay'
import { NodeDetailPanel } from './NodeDetailPanel'
import { useVaultGraph } from './useVaultGraph'
import type { VaultNode, VaultGraph, AgentActivity } from './useVaultGraph'
import { Html } from '@react-three/drei'

// Floor grid — Iron Man hologram table effect
function FloorGrid() {
  const gridRef = useRef<THREE.LineSegments>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const mat = gridRef.current?.material as THREE.LineBasicMaterial
    if (mat) mat.opacity = 0.08 + Math.sin(t * 0.8) * 0.02
  })

  const geo = useMemo(() => {
    const lines: number[] = []
    const size = 12
    const step = 0.8
    for (let i = -size; i <= size; i += step) {
      lines.push(-size, 0, i, size, 0, i)
      lines.push(i, 0, -size, i, 0, size)
    }
    const buf = new Float32Array(lines)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(buf, 3))
    return g
  }, [])

  return (
    <lineSegments ref={gridRef} geometry={geo} position={[0, -2.8, 0]}>
      <lineBasicMaterial
        color="#00d4ff"
        transparent
        opacity={0.07}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        depthWrite={false}
      />
    </lineSegments>
  )
}

// Ambient horizon ring around the brain
function HorizonRing() {
  return (
    <group position={[0, -2.8, 0]}>
      {[5.5, 7.0, 8.8].map((r, i) => (
        <mesh key={i} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r, 0.004, 4, 128]} />
          <meshBasicMaterial
            color="#00d4ff"
            transparent
            opacity={0.06 - i * 0.015}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

// Outer shell — the "ghost" enclosure around the brain
function BrainShell() {
  const outerRef = useRef<THREE.Mesh>(null!)
  const innerRef = useRef<THREE.Mesh>(null!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matRef = useRef<any>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (outerRef.current) outerRef.current.rotation.y = t * 0.04
    if (innerRef.current) innerRef.current.rotation.y = -t * 0.06
    if (matRef.current) {
      matRef.current.emissiveIntensity = 0.4 + Math.sin(t * Math.PI) * 0.2
    }
  })

  return (
    <group>
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[2.55, 3]} />
        <MeshDistortMaterial
          ref={matRef}
          color="#000d1a"
          emissive="#00d4ff"
          emissiveIntensity={0.5}
          distort={0.12}
          speed={0.8}
          toneMapped={false}
          wireframe
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={innerRef} scale={0.82}>
        <icosahedronGeometry args={[2.55, 2]} />
        <meshBasicMaterial
          color="#0066aa"
          transparent
          opacity={0.04}
          wireframe
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

// Region labels around the brain
function BrainRegionLabels() {
  return (
    <>
      {BRAIN_REGIONS.map((region) => (
        <Html
          key={region.label}
          position={region.pos.toArray()}
          center
          distanceFactor={10}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              position: 'relative',
              padding: '3px 8px',
              border: '1px solid rgba(0,212,255,0.3)',
              background: 'rgba(0,8,20,0.7)',
              clipPath: 'polygon(4px 0%, calc(100% - 4px) 0%, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0% calc(100% - 4px), 0% 4px)',
              backdropFilter: 'blur(2px)',
            }}
          >
            <div style={{ position: 'absolute', top: 1, left: 1, width: 5, height: 5, borderTop: '1px solid rgba(0,212,255,0.6)', borderLeft: '1px solid rgba(0,212,255,0.6)' }} />
            <div style={{ position: 'absolute', bottom: 1, right: 1, width: 5, height: 5, borderBottom: '1px solid rgba(0,212,255,0.6)', borderRight: '1px solid rgba(0,212,255,0.6)' }} />
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '8px',
                color: '#00d4ff',
                letterSpacing: '0.18em',
                textShadow: '0 0 6px #00d4ff',
                display: 'block',
                whiteSpace: 'nowrap',
              }}
            >
              {region.label}
            </span>
          </div>
        </Html>
      ))}
    </>
  )
}

// ── Scene props — all data flows in through Canvas boundary ───────────────────
interface SceneProps {
  nodes: VaultNode[]
  edges: import('./useVaultGraph').VaultEdge[]
  firingNodeIds: string[]
  agentActivity: AgentActivity[]
  onNodeClick: (node: VaultNode) => void
}

// The entire 3D scene — no SSR concerns, dynamic-imported
function Scene({ nodes, edges, firingNodeIds, agentActivity, onNodeClick }: SceneProps) {
  return (
    <>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.05} />
      <pointLight position={[0, 4, 0]} intensity={0.3} color="#00d4ff" />

      <Stars radius={80} depth={60} count={800} factor={2} fade speed={0.4} />

      <BrainShell />
      <BrainParticles
        nodes={nodes}
        edges={edges}
        firingNodeIds={firingNodeIds}
        onNodeClick={onNodeClick}
      />
      <BrainRegionLabels />

      <AgentNodes agentActivity={agentActivity} />

      <FloorGrid />
      <HorizonRing />

      <EffectComposer>
        <Bloom
          intensity={1.8}
          luminanceThreshold={0.1}
          luminanceSmoothing={0.85}
          height={512}
        />
        <ChromaticAberration
          offset={new THREE.Vector2(0.0008, 0.0008) as never}
          blendFunction={BlendFunction.NORMAL}
          radialModulation={false}
          modulationOffset={0}
        />
        <Vignette
          eskil={false}
          offset={0.3}
          darkness={0.7}
          blendFunction={BlendFunction.NORMAL}
        />
      </EffectComposer>

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={3}
        maxDistance={14}
        autoRotate={false}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  )
}

// ── HudScene — hook lives here, outside Canvas ────────────────────────────────
export function HudScene() {
  // useVaultGraph MUST be called outside <Canvas>
  const { graph } = useVaultGraph()

  const [selectedNode, setSelectedNode] = useState<VaultNode | null>(null)

  // Derive edge count for selected node (links in + out)
  const selectedNodeLinkCount = useMemo(() => {
    if (!selectedNode || !graph) return 0
    return graph.edges.filter(
      (e) => e.source === selectedNode.id || e.target === selectedNode.id
    ).length
  }, [selectedNode, graph])

  const nodes = graph?.nodes ?? []
  const edges = graph?.edges ?? []
  const firingNodeIds = graph?.firingNodeIds ?? []
  const agentActivity = graph?.agentActivity ?? []

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 1.5, 9], fov: 52 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Scene
          nodes={nodes}
          edges={edges}
          firingNodeIds={firingNodeIds}
          agentActivity={agentActivity}
          onNodeClick={setSelectedNode}
        />
      </Canvas>

      {/* 2D overlays — outside Canvas */}
      <HudOverlay graph={graph} />

      <NodeDetailPanel
        node={selectedNode}
        onDismiss={() => setSelectedNode(null)}
        linkCount={selectedNodeLinkCount}
      />
    </div>
  )
}
