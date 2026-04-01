'use client'

import React from 'react'

type BuckLogoProps = {
  size?: number
  color?: string
  className?: string
}

function BuckLogo({ size = 32, color = '#C8963C', className }: BuckLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill={color}
      role="img"
      aria-label="BuckGrid"
      className={className}
    >
      {/* Left antler — main beam sweeps up-left */}
      <polygon points="40,94 50,94 30,8 20,8" />
      {/* Left brow tine */}
      <polygon points="4,72 6,63 40,63 40,72" />
      {/* Left G2 tine */}
      <polygon points="4,48 6,39 33,39 33,48" />

      {/* Right antler — main beam sweeps up-right */}
      <polygon points="50,94 60,94 80,8 70,8" />
      {/* Right brow tine */}
      <polygon points="60,63 60,72 96,72 94,63" />
      {/* Right G2 tine */}
      <polygon points="67,39 67,48 96,48 94,39" />

      {/* Skull base */}
      <rect x="44" y="88" width="12" height="8" rx="2" />
    </svg>
  )
}

export default BuckLogo
