'use client'

import React from 'react'
import MapEngine from './map/MapEngine'
import TacticalDock from './ui/TacticalDock'
import TonyChat from './chat/TonyChat'

type EBState = { error: string | null }

class MapErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  state: EBState = { error: null }
  static getDerivedStateFromError(err: Error) { return { error: err.message } }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 999, background: '#0A0F0A',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#FF6B00', letterSpacing: 3 }}>BUCKGRID PRO</div>
          <div style={{ padding: '14px 20px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, maxWidth: 400, textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', marginBottom: 6 }}>RENDER CRASH</div>
            <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.6, fontFamily: 'monospace', wordBreak: 'break-all' }}>{this.state.error}</div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function BuckGridProPage() {
  console.log('[BuckGrid] BuckGridProPage mounting')
  return (
    <div className="cockpit">
      <MapErrorBoundary>
        <MapEngine />
      </MapErrorBoundary>
      <TacticalDock />
      <TonyChat />
    </div>
  )
}
