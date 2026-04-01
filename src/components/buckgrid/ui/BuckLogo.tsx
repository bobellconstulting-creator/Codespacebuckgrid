'use client'

import React from 'react'

type BuckLogoProps = {
  size?: number
  color?: string
  className?: string
}

/**
 * BuckGrid Pro — Buck head, frontal silhouette + 3-point rack.
 * Single continuous form. Reads clean at 16px and up.
 * Inspired by: KUIU, OnX Maps, Garmin — heritage + precision.
 */
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
      {/* ── HEAD silhouette — frontal, slightly tapered jaw ── */}
      <path d="M50 98 L30 91 L20 76 L20 62 L26 52 L36 46 L50 44 L64 46 L74 52 L80 62 L80 76 L70 91 Z" />

      {/* ── LEFT ANTLER — 3 points: brow, G2, main tip ── */}
      {/*   Traces outer edge of beam + two tine bumps, closes at base   */}
      <path d="
        M 44 46
        L 36 28
        L 16 18  L 16 13  L 37 22
        L 38 14
        L 24 2   L 30 0   L 42 12
        L 48 44
        Z
      " />

      {/* ── RIGHT ANTLER — mirrored ── */}
      <path d="
        M 56 46
        L 64 28
        L 84 18  L 84 13  L 63 22
        L 62 14
        L 76 2   L 70 0   L 58 12
        L 52 44
        Z
      " />

      {/* ── GRID ACCENT — 3 horizontal lines across antler zone ── */}
      {/*   Subtle nod to "Grid" — precision, intelligence            */}
      <rect x="30" y="15" width="40" height="2.5" rx="1" opacity="0.22" />
      <rect x="26" y="23" width="48" height="2.5" rx="1" opacity="0.18" />
      <rect x="22" y="31" width="56" height="2.5" rx="1" opacity="0.14" />
    </svg>
  )
}

export default BuckLogo
