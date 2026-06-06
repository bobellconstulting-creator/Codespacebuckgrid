/**
 * WildLogicMark — premium hex-badge logo for WildLogic hunting AI SaaS.
 *
 * Three variants:
 *   "mark"     — hexagonal badge with topographic contour fill + "WL" monogram
 *   "wordmark" — "WILD" / "LOGIC" two-tone logotype
 *   "full"     — mark + wordmark side by side
 *
 * Palette: ink #1E2122 · bone #D8D3C5 · moss #7A8F62 · brass #B8923A
 * No external dependencies — pure inline SVG.
 */

interface WildLogicMarkProps {
  size?: number
  variant?: 'mark' | 'wordmark' | 'full'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Flat-top hexagon badge with topo contours and WL monogram */
function HexMark({ size }: { size: number }) {
  // Flat-top hex: center (50,50), radius 46
  // Vertices at angles 0°, 60°, 120°, 180°, 240°, 300°
  const cx = 50
  const cy = 50
  const R = 46   // outer hex radius
  const r = 38   // inner hex radius (double-line detail)

  const hexPoints = (radius: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 180) * (60 * i - 30) // flat-top: start at -30°
      return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`
    }).join(' ')

  const outerHex = hexPoints(R)
  const innerHex = hexPoints(r)
  const clipHex  = hexPoints(R - 0.5)

  const clipId    = 'wl-hex-clip'
  const glowId    = 'wl-brass-glow'
  const bgGradId  = 'wl-bg-grad'

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="WildLogic mark"
    >
      <title>WildLogic</title>

      <defs>
        {/* Clip topo lines to hex interior */}
        <clipPath id={clipId}>
          <polygon points={clipHex} />
        </clipPath>

        {/* Subtle radial depth gradient for the hex background */}
        <radialGradient id={bgGradId} cx="50%" cy="45%" r="55%">
          <stop offset="0%"   stopColor="#252B2C" />
          <stop offset="100%" stopColor="#1E2122" />
        </radialGradient>

        {/* Brass glow filter for WL letters */}
        <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feFlood floodColor="#B8923A" floodOpacity="0.55" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Hex background fill */}
      <polygon
        points={outerHex}
        fill={`url(#${bgGradId})`}
      />

      {/* Topographic contour lines clipped inside hex */}
      <g
        clipPath={`url(#${clipId})`}
        stroke="#7A8F62"
        strokeWidth="0.55"
        fill="none"
        opacity="0.38"
        strokeLinecap="round"
      >
        {/* Concentric ellipse-like topo curves — hand-tuned for organic terrain feel */}
        <ellipse cx="52" cy="54" rx="38" ry="26" />
        <ellipse cx="52" cy="54" rx="30" ry="20" />
        <ellipse cx="52" cy="54" rx="22" ry="14" />
        <ellipse cx="52" cy="54" rx="14" ry="9"  />
        <ellipse cx="52" cy="54" rx="7"  ry="4.5" />
        {/* Ridge spur lines for authentic topo character */}
        <path d="M 52,28 Q 60,34 62,44" />
        <path d="M 52,28 Q 44,34 42,44" />
        <path d="M 82,52 Q 76,48 66,50" />
        <path d="M 22,52 Q 28,48 38,50" />
      </g>

      {/* Outer hex border */}
      <polygon
        points={outerHex}
        fill="none"
        stroke="#B8923A"
        strokeWidth="1.4"
        strokeLinejoin="miter"
      />

      {/* Inner hex border — double-line precision detail */}
      <polygon
        points={innerHex}
        fill="none"
        stroke="#7A8F62"
        strokeWidth="0.6"
        strokeLinejoin="miter"
        opacity="0.5"
      />

      {/* Tiny corner tick marks at each outer hex vertex — premium badge detail */}
      {Array.from({ length: 6 }, (_, i) => {
        const angle  = (Math.PI / 180) * (60 * i - 30)
        const vx     = cx + R * Math.cos(angle)
        const vy     = cy + R * Math.sin(angle)
        // short inward tick
        const tx     = cx + (R - 6) * Math.cos(angle)
        const ty     = cy + (R - 6) * Math.sin(angle)
        return (
          <line
            key={i}
            x1={vx} y1={vy}
            x2={tx} y2={ty}
            stroke="#B8923A"
            strokeWidth="0.9"
            opacity="0.7"
          />
        )
      })}

      {/* WL monogram — bold condensed letterforms */}
      <g filter={`url(#${glowId})`}>
        {/*
          "W" — constructed from strokes for precision at all sizes.
          Baseline at y=58, cap at y=34.  Left edge x=20, right edge x=48.
        */}
        <polyline
          points="20,34 25,58 31,44 37,58 42,34"
          stroke="#D8D3C5"
          strokeWidth="3.8"
          strokeLinejoin="miter"
          strokeLinecap="butt"
          fill="none"
        />

        {/*
          "L" — x range 50–80, same baseline.
        */}
        <polyline
          points="51,34 51,58 73,58"
          stroke="#D8D3C5"
          strokeWidth="3.8"
          strokeLinejoin="miter"
          strokeLinecap="butt"
          fill="none"
        />
      </g>

      {/* Brass dot accent above the WL — single precision point */}
      <circle cx="50" cy="27" r="1.4" fill="#B8923A" opacity="0.9" />

      {/* Hairline separator below the WL — grounds the monogram */}
      <line
        x1="22" y1="63"
        x2="78" y2="63"
        stroke="#7A8F62"
        strokeWidth="0.5"
        opacity="0.45"
      />
    </svg>
  )
}

/** Two-tone logotype: WILD in bone, LOGIC in moss */
function Wordmark({ size }: { size: number }) {
  // viewBox sized for a pure wordmark strip: 220 wide, 48 tall
  // Scale height to match the requested size (treating size as height)
  const vbW = 220
  const vbH = 48
  const w   = Math.round((size / vbH) * vbW)

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      width={w}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="WildLogic wordmark"
    >
      <title>WildLogic</title>

      {/*
        Teko-style condensed sans — we approximate with system fonts that
        are closest to Teko's proportions: Impact → Arial Narrow → sans-serif.
        The letter-spacing (tracking) and fontWeight carry the premium feel.
      */}

      {/* "WILD" — bone */}
      <text
        x="0"
        y="38"
        fontFamily="'Teko', 'Impact', 'Arial Narrow', sans-serif"
        fontSize="42"
        fontWeight="600"
        fill="#D8D3C5"
        letterSpacing="6"
        textAnchor="start"
        dominantBaseline="auto"
      >
        WILD
      </text>

      {/* "LOGIC" — moss green */}
      <text
        x="108"
        y="38"
        fontFamily="'Teko', 'Impact', 'Arial Narrow', sans-serif"
        fontSize="42"
        fontWeight="600"
        fill="#7A8F62"
        letterSpacing="6"
        textAnchor="start"
        dominantBaseline="auto"
      >
        LOGIC
      </text>

      {/* Brass underline accent beneath the full logotype */}
      <line
        x1="0" y1="44"
        x2="216" y2="44"
        stroke="#B8923A"
        strokeWidth="1.2"
        opacity="0.6"
      />

      {/* Brass midpoint dot separating WILD / LOGIC */}
      <circle cx="105" cy="20" r="2" fill="#B8923A" opacity="0.85" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function WildLogicMark({
  size = 40,
  variant = 'full',
}: WildLogicMarkProps) {
  if (variant === 'mark') {
    return <HexMark size={size} />
  }

  if (variant === 'wordmark') {
    return <Wordmark size={size} />
  }

  // "full" — hex mark + wordmark side by side
  // The mark occupies a square; the wordmark height matches.
  // Total viewBox: mark width + gap + wordmark width, height = size.
  const markSize     = size
  const wordmarkSize = size
  // wordmark intrinsic ratio: 220 / 48 ≈ 4.583
  const wmW          = Math.round((wordmarkSize / 48) * 220)
  const gap          = Math.round(size * 0.18)
  const totalW       = markSize + gap + wmW

  return (
    <svg
      viewBox={`0 0 ${totalW} ${size}`}
      width={totalW}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="WildLogic"
    >
      <title>WildLogic</title>

      {/* Mark — scaled to fill a size×size square at origin */}
      <g transform={`translate(0, 0)`}>
        <svg
          viewBox="0 0 100 100"
          x={0}
          y={0}
          width={markSize}
          height={markSize}
          overflow="visible"
        >
          {/* Inline the HexMark SVG contents directly for compositing */}
          <HexMarkContents cx={50} cy={50} R={46} r={38} />
        </svg>
      </g>

      {/* Wordmark — vertically centered to match mark height */}
      <g transform={`translate(${markSize + gap}, ${Math.round(size * 0.04)})`}>
        <svg
          viewBox="0 0 220 48"
          x={0}
          y={0}
          width={wmW}
          height={Math.round(size * 0.92)}
        >
          <WordmarkContents />
        </svg>
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Headless content helpers used by the "full" composite
// (avoids duplicating JSX; these render the raw SVG children with no <svg> wrapper)
// ---------------------------------------------------------------------------

function HexMarkContents({
  cx,
  cy,
  R,
  r,
}: {
  cx: number
  cy: number
  R: number
  r: number
}) {
  const hexPoints = (radius: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 180) * (60 * i - 30)
      return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`
    }).join(' ')

  const outerHex = hexPoints(R)
  const innerHex = hexPoints(r)
  const clipHex  = hexPoints(R - 0.5)

  const clipId   = 'wl-full-hex-clip'
  const glowId   = 'wl-full-brass-glow'
  const bgGradId = 'wl-full-bg-grad'

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <polygon points={clipHex} />
        </clipPath>
        <radialGradient id={bgGradId} cx="50%" cy="45%" r="55%">
          <stop offset="0%"   stopColor="#252B2C" />
          <stop offset="100%" stopColor="#1E2122" />
        </radialGradient>
        <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feFlood floodColor="#B8923A" floodOpacity="0.55" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <polygon points={outerHex} fill={`url(#${bgGradId})`} />

      <g
        clipPath={`url(#${clipId})`}
        stroke="#7A8F62"
        strokeWidth="0.55"
        fill="none"
        opacity="0.38"
        strokeLinecap="round"
      >
        <ellipse cx="52" cy="54" rx="38" ry="26" />
        <ellipse cx="52" cy="54" rx="30" ry="20" />
        <ellipse cx="52" cy="54" rx="22" ry="14" />
        <ellipse cx="52" cy="54" rx="14" ry="9"  />
        <ellipse cx="52" cy="54" rx="7"  ry="4.5" />
        <path d="M 52,28 Q 60,34 62,44" />
        <path d="M 52,28 Q 44,34 42,44" />
        <path d="M 82,52 Q 76,48 66,50" />
        <path d="M 22,52 Q 28,48 38,50" />
      </g>

      <polygon
        points={outerHex}
        fill="none"
        stroke="#B8923A"
        strokeWidth="1.4"
        strokeLinejoin="miter"
      />
      <polygon
        points={innerHex}
        fill="none"
        stroke="#7A8F62"
        strokeWidth="0.6"
        strokeLinejoin="miter"
        opacity="0.5"
      />

      {Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 180) * (60 * i - 30)
        const vx    = cx + R * Math.cos(angle)
        const vy    = cy + R * Math.sin(angle)
        const tx    = cx + (R - 6) * Math.cos(angle)
        const ty    = cy + (R - 6) * Math.sin(angle)
        return (
          <line
            key={i}
            x1={vx} y1={vy}
            x2={tx} y2={ty}
            stroke="#B8923A"
            strokeWidth="0.9"
            opacity="0.7"
          />
        )
      })}

      <g filter={`url(#${glowId})`}>
        <polyline
          points="20,34 25,58 31,44 37,58 42,34"
          stroke="#D8D3C5"
          strokeWidth="3.8"
          strokeLinejoin="miter"
          strokeLinecap="butt"
          fill="none"
        />
        <polyline
          points="51,34 51,58 73,58"
          stroke="#D8D3C5"
          strokeWidth="3.8"
          strokeLinejoin="miter"
          strokeLinecap="butt"
          fill="none"
        />
      </g>

      <circle cx="50" cy="27" r="1.4" fill="#B8923A" opacity="0.9" />
      <line
        x1="22" y1="63"
        x2="78" y2="63"
        stroke="#7A8F62"
        strokeWidth="0.5"
        opacity="0.45"
      />
    </>
  )
}

function WordmarkContents() {
  return (
    <>
      <text
        x="0"
        y="38"
        fontFamily="'Teko', 'Impact', 'Arial Narrow', sans-serif"
        fontSize="42"
        fontWeight="600"
        fill="#D8D3C5"
        letterSpacing="6"
        textAnchor="start"
        dominantBaseline="auto"
      >
        WILD
      </text>
      <text
        x="108"
        y="38"
        fontFamily="'Teko', 'Impact', 'Arial Narrow', sans-serif"
        fontSize="42"
        fontWeight="600"
        fill="#7A8F62"
        letterSpacing="6"
        textAnchor="start"
        dominantBaseline="auto"
      >
        LOGIC
      </text>
      <line
        x1="0" y1="44"
        x2="216" y2="44"
        stroke="#B8923A"
        strokeWidth="1.2"
        opacity="0.6"
      />
      <circle cx="105" cy="20" r="2" fill="#B8923A" opacity="0.85" />
    </>
  )
}
