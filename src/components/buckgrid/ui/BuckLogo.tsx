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
      {/* Head — angular, geometric, minimal */}
      <path d="M50 94 L33 86 L26 70 L26 54 L32 44 L40 38 L50 36 L60 38 L68 44 L74 54 L74 70 L67 86 Z" />

      {/* Left ear — sharp angular wedge */}
      <path d="M40 40 L28 26 L22 12 L30 10 L36 24 L42 37 Z" />

      {/* Right ear — mirrored */}
      <path d="M60 40 L72 26 L78 12 L70 10 L64 24 L58 37 Z" />

      {/* Left antler — main beam: hard angles, no curves */}
      <path d="M42 38 L38 24 L32 10 L24 2 L28 1 L36 9 L42 23 L45 36 Z" />

      {/* Left antler — brow tine: acute upward spike */}
      <path d="M38 24 L28 14 L31 11 L40 21 Z" />

      {/* Left antler — G2 tine: short, blade-like */}
      <path d="M34 13 L22 8 L23 5 L34 10 Z" />

      {/* Left antler — G3 tip spike */}
      <path d="M28 5 L18 2 L19 0 L29 3 Z" />

      {/* Right antler — main beam */}
      <path d="M58 38 L62 24 L68 10 L76 2 L72 1 L64 9 L58 23 L55 36 Z" />

      {/* Right antler — brow tine */}
      <path d="M62 24 L72 14 L69 11 L60 21 Z" />

      {/* Right antler — G2 tine */}
      <path d="M66 13 L78 8 L77 5 L66 10 Z" />

      {/* Right antler — G3 tip spike */}
      <path d="M72 5 L82 2 L81 0 L71 3 Z" />
    </svg>
  )
}

export default BuckLogo
