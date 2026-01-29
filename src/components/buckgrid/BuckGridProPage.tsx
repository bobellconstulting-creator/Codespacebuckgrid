'use client'

import React from 'react'
import MapEngine from './map/MapEngine'
import TacticalDock from './ui/TacticalDock'
import TonyChat from './chat/TonyChat'

export default function BuckGridProPage() {
  return (
    <div className="cockpit">
      <MapEngine />
      <TacticalDock />
      <TonyChat />
    </div>
  )
}
