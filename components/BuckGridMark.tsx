/**
 * BuckGridMark — the hex-badge buck logo.
 *
 * Tactical Heritage. Hex patch silhouette, topographic contour fill,
 * geometric buck head with antlers. Designed to read at 16px favicon
 * and 400px hero. Two-color silkscreen safe.
 *
 * Colors come from currentColor + a `accent` prop so the same SVG
 * renders olive-on-bone, brass-on-ink, single-color stencil, etc.
 */

interface BuckGridMarkProps {
  size?: number | string
  /** main stroke / buck color */
  color?: string
  /** topo contour + hex border accent */
  accent?: string
  /** background fill of the hex (null = transparent) */
  fill?: string | null
  className?: string
  title?: string
}

export function BuckGridMark({
  size = 64,
  color = '#B8923A',
  accent = '#6B7A4F',
  fill = '#0E1410',
  className,
  title = 'BuckGrid Pro',
}: BuckGridMarkProps) {
  return (
    <svg
      viewBox="0 0 200 220"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>

      {/* Hex badge — pointy-top hexagon */}
      <defs>
        <clipPath id="bgm-hex-clip">
          <polygon points="100,8 188,56 188,164 100,212 12,164 12,56" />
        </clipPath>
      </defs>

      {/* Outer hex border */}
      <polygon
        points="100,8 188,56 188,164 100,212 12,164 12,56"
        fill={fill ?? 'none'}
        stroke={accent}
        strokeWidth="6"
        strokeLinejoin="miter"
      />
      {/* Inner hex border (double-line patch feel) */}
      <polygon
        points="100,20 178,62 178,158 100,200 22,158 22,62"
        fill="none"
        stroke={accent}
        strokeWidth="2"
        strokeLinejoin="miter"
        opacity="0.55"
      />

      {/* Topographic contour fill, clipped to hex */}
      <g clipPath="url(#bgm-hex-clip)" opacity="0.32" stroke={accent} strokeWidth="1.25" fill="none">
        <path d="M -10 70 Q 50 50 100 72 T 220 68" />
        <path d="M -10 90 Q 60 68 110 92 T 220 86" />
        <path d="M -10 112 Q 50 92 100 116 T 220 108" />
        <path d="M -10 134 Q 70 116 120 140 T 220 132" />
        <path d="M -10 156 Q 50 138 100 160 T 220 154" />
        <path d="M -10 178 Q 60 162 110 182 T 220 178" />
        <path d="M -10 200 Q 50 184 100 204 T 220 200" />
      </g>

      {/* Geometric buck — antlers + head, faceted, no curves */}
      <g
        stroke={color}
        strokeWidth="5"
        strokeLinejoin="miter"
        strokeLinecap="square"
        fill="none"
      >
        {/* Left antler */}
        <polyline points="78,82 70,60 60,66 56,46 46,54 40,38" />
        <polyline points="70,60 58,52" />
        <polyline points="60,66 50,72" />
        {/* Right antler */}
        <polyline points="122,82 130,60 140,66 144,46 154,54 160,38" />
        <polyline points="130,60 142,52" />
        <polyline points="140,66 150,72" />
        {/* Head — angular shield */}
        <polygon points="78,82 122,82 134,108 122,150 100,164 78,150 66,108" />
        {/* Snout/nose ridge */}
        <polyline points="88,128 100,138 112,128" />
        {/* Eye marks */}
        <line x1="84" y1="110" x2="92" y2="110" />
        <line x1="108" y1="110" x2="116" y2="110" />
      </g>
    </svg>
  )
}

export default BuckGridMark
