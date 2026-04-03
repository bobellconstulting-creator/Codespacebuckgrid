'use client'

import React from 'react'

type BuckLogoProps = {
  size?: number
  color?: string
  className?: string
}

/**
 * BuckGrid Pro mark — directly from the reference SVG provided by Bo.
 * Uses the exact hexagon + topo lines + geometric deer face structure.
 * color prop maps to the olive stroke/fill color (#6B7A57 by default).
 */
export default function BuckLogo({ size = 48, color = '#6B7A57', className }: BuckLogoProps) {
  const bg = '#36393b'
  const w  = size
  const h  = size   // badge portion is roughly square

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      // Crop to just the badge area (hex: x120–480, y50–450)
      viewBox="110 40 380 420"
      width={w}
      height={h}
      role="img"
      aria-label="BuckGrid Pro"
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* ── HEXAGON BADGE ─────────────────────────────────────────── */}
      <polygon
        points="300,50 480,150 480,350 300,450 120,350 120,150"
        fill={bg}
        stroke={color}
        strokeWidth="12"
        strokeLinejoin="round"
      />

      {/* ── TOPO CONTOUR LINES (clipped to hex) ───────────────────── */}
      <g clipPath="url(#bgHexClip)" fill="none" stroke={color} strokeWidth="2" opacity="0.4">
        <defs>
          <clipPath id="bgHexClip">
            <polygon points="300,50 480,150 480,350 300,450 120,350 120,150" />
          </clipPath>
        </defs>
        <path d="M100,100 Q200,150 250,80 T400,120 T500,80" />
        <path d="M80,150 Q180,200 300,150 T520,180" />
        <path d="M100,220 Q200,280 280,210 T450,250 T550,220" />
        <path d="M120,300 Q250,350 350,280 T500,340" />
        <path d="M150,380 Q300,400 400,360 T550,420" />
        <path d="M250,150 Q300,200 350,150 T400,200" />
        <path d="M220,250 Q300,300 380,250" />
      </g>

      {/* ── GEOMETRIC DEER FACE ────────────────────────────────────── */}
      <g
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {/* Muzzle / chin */}
        <polygon points="300,400 270,330 330,330" />
        {/* Jaw / lower face */}
        <polygon points="270,330 230,250 300,280 370,250 330,330" />
        {/* Center face / nose bridge */}
        <polygon points="230,250 300,180 370,250 300,280" />
        {/* Left ear / cheek */}
        <polygon points="230,250 160,230 210,180" />
        {/* Right ear / cheek */}
        <polygon points="370,250 440,230 390,180" />

        {/* Left antler beams + tines */}
        <path d="M260,210 L230,120 L200,90 M230,120 L270,80 L250,50 M250,160 L180,140" />
        {/* Right antler beams + tines */}
        <path d="M340,210 L370,120 L400,90 M370,120 L330,80 L350,50 M350,160 L420,140" />
      </g>
    </svg>
  )
}
