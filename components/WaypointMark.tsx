/**
 * WaypointMark — BuckGrid Pro primary mark (Waypoint concept).
 *
 * A buck rack inside a map pin, dropping onto a crosshair target over
 * topographic ground. Colors follow the confirmed brand palette:
 * Ink / Card tile, Moss target, Amber pin, Bone buck.
 */

import { useId } from 'react'

interface WaypointMarkProps {
  size?: number | string
  className?: string
  title?: string
}

export function WaypointMark({ size = 40, className, title = 'BuckGrid Pro' }: WaypointMarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const tileId = `wp-tile-${uid}`
  const bgId = `wp-bg-${uid}`
  const pinId = `wp-pin-${uid}`
  const antlerId = `wp-antler-${uid}`

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 240"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        <clipPath id={tileId}>
          <rect x="8" y="8" width="224" height="224" rx="48" />
        </clipPath>
        <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#262B22" />
          <stop offset="1" stopColor="#131710" />
        </linearGradient>
        <linearGradient id={pinId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E0A84C" />
          <stop offset="1" stopColor="#C8882A" />
        </linearGradient>
      </defs>

      <rect x="8" y="8" width="224" height="224" rx="48" fill={`url(#${bgId})`} />

      <g clipPath={`url(#${tileId})`}>
        <g fill="none" stroke="#343B2C" strokeWidth="2">
          <path d="M-10,196 C40,176 96,196 130,182 C168,166 210,182 250,168" />
          <path d="M-10,214 C46,196 100,214 138,200 C176,186 214,200 250,188" />
          <path d="M-10,178 C40,160 92,178 126,166 C162,153 206,166 250,150" />
        </g>
      </g>

      {/* ground crosshair / target where the pin lands */}
      <g stroke="#6B7A57" strokeWidth="2.4" fill="none" opacity="0.95">
        <ellipse cx="120" cy="210" rx="34" ry="11" />
        <line x1="120" y1="194" x2="120" y2="226" />
        <line x1="80" y1="210" x2="160" y2="210" />
      </g>

      {/* map pin */}
      <path
        d="M120,30 C156,30 184,57 184,92 C184,131 146,160 120,212 C94,160 56,131 56,92 C56,57 84,30 120,30 Z"
        fill={`url(#${pinId})`}
        stroke="#7A5418"
        strokeWidth="2"
      />

      {/* inner lens */}
      <circle cx="120" cy="92" r="42" fill="#131710" />
      <circle cx="120" cy="92" r="42" fill="none" stroke="#D8D3C5" strokeWidth="2" opacity="0.45" />

      {/* buck rack inside lens (right half + mirror across x=120) */}
      <g fill="none" stroke="#D8D3C5" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round">
        <g id={antlerId}>
          <path d="M124,108 C135,96 147,84 150,68 C151,58 150,50 147,44" />
          <path d="M128,102 C131,92 132,86 130,78" />
          <path d="M140,86 C146,78 148,72 148,64" />
          <path d="M147,44 C148,39 150,37 154,36" />
        </g>
        <use href={`#${antlerId}`} transform="translate(240,0) scale(-1,1)" />
      </g>
      {/* head */}
      <path
        d="M120,108 C112,108 108,114 110,122 C112,128 116,132 120,134 C124,132 128,128 130,122 C132,114 128,108 120,108 Z"
        fill="#D8D3C5"
      />
      {/* rack tip amber dots */}
      <g fill="#E0A84C">
        <circle cx="154" cy="35" r="2.6" />
        <circle cx="86" cy="35" r="2.6" />
      </g>
    </svg>
  )
}

export default WaypointMark
