'use client'

import { motion, useInView, AnimatePresence } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import WaypointMark from '../components/WaypointMark'

// ─── BuckGrid Pro brand tokens (confirmed brief) ─────────────────────────────
// Ink bg / Card / Moss accent / Bone text, with the Gunmetal + Amber tactical
// push. Amber is the signal color — reserved for the freemium CTA.
const B = {
  ink: '#1E2122', // page canvas
  card: '#131710', // deepest surface
  gunmetal: '#2C2F33', // raised chrome / secondary surfaces
  moss: '#6B7A57', // brand accent
  mossLight: '#8BAA72', // accent on dark text sizes
  bone: '#D8D3C5', // primary text
  muted: '#8A877B', // secondary text
  amber: '#C8882A', // the one loud thing: First Map Free
  amberLight: '#E0A84C',
  steel: '#7C8B96', // cool data (wind, water)
  tan: '#B89A6A', // bedding / warm zone
  hairline: 'rgba(216,211,197,0.12)',
  hairlineSoft: 'rgba(216,211,197,0.07)',
  boneDim: 'rgba(216,211,197,0.68)',
  boneFaint: 'rgba(216,211,197,0.45)',
}

const FONT = {
  display: "'Big Shoulders Display','Oswald',sans-serif",
  mono: "'JetBrains Mono','Roboto Mono',ui-monospace,monospace",
  body: "'Inter',system-ui,sans-serif",
}

// ─── Animation helpers ────────────────────────────────────────────────────────

interface FadeInProps {
  children: React.ReactNode
  delay?: number
  className?: string
  y?: number
}

function FadeIn({ children, delay = 0, className = '', y = 28 }: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Shared brand atoms ───────────────────────────────────────────────────────

/** BUCKGRID wordmark + amber PRO badge */
function Wordmark({ size = 22, withMark = true, markSize = 34 }: { size?: number; withMark?: boolean; markSize?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {withMark && <WaypointMark size={markSize} />}
      <span className="inline-flex items-baseline gap-1.5" style={{ fontFamily: FONT.display }}>
        <span style={{ fontSize: size, fontWeight: 800, color: B.bone, letterSpacing: '0.02em', lineHeight: 1 }}>
          BUCKGRID
        </span>
        <span
          className="rounded-sm"
          style={{
            fontSize: size * 0.52,
            fontWeight: 800,
            letterSpacing: '0.08em',
            background: B.amber,
            color: B.card,
            padding: '2px 5px',
            lineHeight: 1,
          }}
        >
          PRO
        </span>
      </span>
    </span>
  )
}

/** JetBrains Mono uppercase label — the data texture */
function MonoLabel({
  children,
  color = B.mossLight,
  className = '',
  size = 11,
}: {
  children: React.ReactNode
  color?: string
  className?: string
  size?: number
}) {
  return (
    <span
      className={`uppercase ${className}`}
      style={{ fontFamily: FONT.mono, fontSize: size, letterSpacing: '0.12em', color }}
    >
      {children}
    </span>
  )
}

/** Section eyebrow: index number + label, mono */
function SectionEyebrow({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-4">
      <span className="h-px w-8" style={{ background: B.hairline }} />
      <MonoLabel>
        {index} / {label}
      </MonoLabel>
      <span className="h-px w-8" style={{ background: B.hairline }} />
    </div>
  )
}

const topoBg = {
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'><g fill='none' stroke='%236B7A57' stroke-width='1' opacity='0.16'><path d='M -50 120 Q 150 60 320 130 T 700 110'/><path d='M -50 170 Q 180 100 350 180 T 700 160'/><path d='M -50 220 Q 150 150 320 230 T 700 210'/><path d='M -50 270 Q 180 200 350 280 T 700 260'/><path d='M -50 320 Q 150 250 320 330 T 700 310'/><path d='M -50 370 Q 180 300 350 380 T 700 360'/><path d='M -50 420 Q 150 350 320 430 T 700 410'/><path d='M -50 470 Q 180 400 350 480 T 700 460'/><path d='M -50 520 Q 150 450 320 530 T 700 510'/></g></svg>\")",
  backgroundSize: '720px 720px',
}

const gridBg = {
  backgroundImage: `linear-gradient(rgba(107,122,87,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(107,122,87,0.04) 1px, transparent 1px)`,
  backgroundSize: '72px 72px',
}

// ─── Buttons ──────────────────────────────────────────────────────────────────

// Amber is reserved for one job: the freemium CTA. Loudest element on the page.
const amberBtnStyle = {
  background: `linear-gradient(135deg, ${B.amberLight} 0%, ${B.amber} 100%)`,
  color: B.card,
  fontFamily: FONT.display,
  fontWeight: 800,
  letterSpacing: '0.07em',
  boxShadow: '0 12px 36px -10px rgba(200,136,42,0.5)',
} as const

const ghostBtnStyle = {
  color: B.boneDim,
  border: `1px solid ${B.hairline}`,
  fontFamily: FONT.display,
  fontWeight: 600,
  letterSpacing: '0.08em',
} as const

// ─── Icons — 2px line, squared terminals ─────────────────────────────────────

function iconProps(size = 22) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'square' as const,
    strokeLinejoin: 'miter' as const,
  }
}

function IconCrosshair() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="1.5" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22.5" />
      <line x1="1.5" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22.5" y2="12" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconWind() {
  return (
    <svg {...iconProps()}>
      <path d="M3 8h11a3 3 0 1 0-3-3" />
      <path d="M3 13h15a3 3 0 1 1-3 3" />
      <path d="M3 18h7" />
    </svg>
  )
}

function IconFunnel() {
  return (
    <svg {...iconProps()}>
      <path d="M3 4h18l-7 8v7l-4 2v-9L3 4Z" />
    </svg>
  )
}

function IconPlot() {
  return (
    <svg {...iconProps()}>
      <path d="M4 4h7v7H4z" />
      <path d="M11 11l9 9" />
      <path d="M14 20h6v-6" />
    </svg>
  )
}

function IconRoute() {
  return (
    <svg {...iconProps()}>
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="5" r="2.5" />
      <path d="M8.5 19H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" />
    </svg>
  )
}

function IconChat() {
  return (
    <svg {...iconProps()}>
      <path d="M21 14a2 2 0 0 1-2 2H8l-5 5V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9Z" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="13" y2="12" />
    </svg>
  )
}

function IconDraw() {
  return (
    <svg {...iconProps()}>
      <path d="M4 20 14.5 9.5" />
      <path d="M14.5 9.5 18 6l-1-1-3.5 3.5" />
      <path d="M18 6l1 1" />
      <circle cx="4" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <path d="M3 4h5v5" />
      <path d="M21 15v5h-5" />
    </svg>
  )
}

function IconCheck({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(30,33,34,0.9)' : 'transparent',
        backdropFilter: scrolled ? 'blur(18px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(18px)' : 'none',
        borderBottom: scrolled ? `1px solid ${B.hairlineSoft}` : '1px solid transparent',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
        <Link href="/" aria-label="BuckGrid Pro home">
          <Wordmark size={21} markSize={32} />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {[
            ['How It Works', '#how-it-works'],
            ['Features', '#features'],
            ['Pricing', '#pricing'],
            ['FAQ', '#faq'],
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="text-sm font-medium transition-colors"
              style={{ color: B.muted, fontFamily: FONT.body }}
              onMouseEnter={e => (e.currentTarget.style.color = B.bone)}
              onMouseLeave={e => (e.currentTarget.style.color = B.muted)}
            >
              {label}
            </a>
          ))}
        </div>

        <Link
          href="/buckgrid"
          className="px-5 py-2 rounded-lg text-sm uppercase transition-all hover:opacity-90"
          style={{
            color: B.bone,
            border: `1px solid ${B.gunmetal}`,
            background: 'rgba(44,47,51,0.6)',
            fontFamily: FONT.display,
            fontWeight: 700,
            letterSpacing: '0.07em',
          }}
        >
          Open the Map
        </Link>
      </div>
    </nav>
  )
}

// ─── Hero map instrument panel ────────────────────────────────────────────────

function HeroMapPanel() {
  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden"
      style={{
        border: `1px solid ${B.hairline}`,
        boxShadow: '0 48px 100px -24px rgba(0,0,0,0.85), 0 0 80px -30px rgba(107,122,87,0.16)',
        background: B.card,
      }}
    >
      {/* Instrument header bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: B.card, borderBottom: `1px solid ${B.hairlineSoft}` }}
      >
        <MonoLabel color={B.muted} size={10}>
          BUCKGRID PRO / PARCEL VIEW
        </MonoLabel>
        <div className="flex items-center gap-4">
          <MonoLabel color={B.steel} size={10} className="hidden sm:inline">
            WIND NW · 8 MPH
          </MonoLabel>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: B.mossLight }} />
            <MonoLabel size={10}>LIVE</MonoLabel>
          </span>
        </div>
      </div>

      {/* Satellite map area */}
      <div
        className="relative w-full"
        style={{
          height: 280,
          background:
            'linear-gradient(150deg, #141a10 0%, #1a2414 22%, #1f2c17 40%, #172112 58%, #10180c 76%, #182013 100%)',
        }}
      >
        {/* terrain shading */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at 28% 64%, rgba(107,122,87,0.18) 0%, transparent 48%), radial-gradient(ellipse at 72% 28%, rgba(110,106,92,0.2) 0%, transparent 42%), radial-gradient(ellipse at 14% 18%, rgba(44,47,51,0.5) 0%, transparent 38%)',
          }}
        />
        {/* topo contours */}
        <div className="absolute inset-0 opacity-70" style={topoBg} />

        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 640 280" preserveAspectRatio="none">
          {/* creek — cool data */}
          <path
            d="M 60 76 Q 150 104 220 124 Q 300 146 370 136 Q 430 126 510 156 Q 570 176 640 168"
            stroke="rgba(124,139,150,0.6)"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          {/* parcel boundary */}
          <polygon
            points="36,36 600,28 612,242 60,252"
            fill="none"
            stroke="rgba(216,211,197,0.35)"
            strokeWidth="1.5"
            strokeDasharray="8 5"
          />
          {/* food plot — moss */}
          <polygon
            points="92,52 196,46 206,116 100,122"
            fill="rgba(139,170,114,0.16)"
            stroke="rgba(139,170,114,0.8)"
            strokeWidth="1.5"
            strokeDasharray="5 3"
          />
          {/* bedding — tan */}
          <ellipse
            cx="430"
            cy="118"
            rx="62"
            ry="40"
            fill="rgba(184,154,106,0.12)"
            stroke="rgba(184,154,106,0.65)"
            strokeWidth="1.5"
            strokeDasharray="5 3"
          />
          {/* travel corridor / funnel — bone dashed */}
          <path
            d="M 226 178 Q 300 162 352 142 Q 392 128 418 108"
            stroke="rgba(216,211,197,0.55)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="7 4"
          />
          {/* stand marker — the decision, Amber crosshair */}
          <circle cx="330" cy="92" r="13" fill="none" stroke="#E0A84C" strokeWidth="2" />
          <circle cx="330" cy="92" r="3" fill="#E0A84C" />
          <line x1="330" y1="74" x2="330" y2="83" stroke="#E0A84C" strokeWidth="2" />
          <line x1="330" y1="101" x2="330" y2="110" stroke="#E0A84C" strokeWidth="2" />
          <line x1="312" y1="92" x2="321" y2="92" stroke="#E0A84C" strokeWidth="2" />
          <line x1="339" y1="92" x2="348" y2="92" stroke="#E0A84C" strokeWidth="2" />
        </svg>

        {/* zone labels — mono chips */}
        <div className="absolute" style={{ top: 26, left: 88 }}>
          <span
            className="px-1.5 py-0.5 rounded"
            style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: '0.1em', background: 'rgba(19,23,16,0.88)', color: B.mossLight, border: '1px solid rgba(139,170,114,0.4)' }}
          >
            FOOD PLOT · 1.8 AC
          </span>
        </div>
        <div className="absolute" style={{ top: 128, left: 396 }}>
          <span
            className="px-1.5 py-0.5 rounded"
            style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: '0.1em', background: 'rgba(19,23,16,0.88)', color: B.tan, border: '1px solid rgba(184,154,106,0.4)' }}
          >
            BEDDING
          </span>
        </div>
        <div className="absolute" style={{ top: 44, left: 348 }}>
          <span
            className="px-1.5 py-0.5 rounded"
            style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: '0.1em', background: 'rgba(19,23,16,0.92)', color: B.amberLight, border: '1px solid rgba(200,136,42,0.5)' }}
          >
            STAND 01 · NW WIND
          </span>
        </div>
        <div className="absolute" style={{ top: 168, left: 240 }}>
          <span
            className="px-1.5 py-0.5 rounded"
            style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: '0.1em', background: 'rgba(19,23,16,0.88)', color: B.boneDim, border: `1px solid ${B.hairline}` }}
          >
            TRAVEL CORRIDOR
          </span>
        </div>

        {/* coordinates HUD */}
        <div className="absolute bottom-2.5 left-3.5">
          <MonoLabel color="rgba(216,211,197,0.45)" size={10}>
            38.8951 N · 96.3047 W
          </MonoLabel>
        </div>
        <div className="absolute bottom-2.5 right-3.5">
          <MonoLabel color="rgba(216,211,197,0.45)" size={10}>
            247.3 AC
          </MonoLabel>
        </div>
      </div>

      {/* Tony recommendation card */}
      <div className="p-5" style={{ background: B.card, borderTop: `1px solid ${B.hairlineSoft}` }}>
        <div className="flex items-start gap-3.5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{
              background: B.ink,
              border: '1px solid rgba(139,170,114,0.45)',
              color: B.mossLight,
              fontFamily: FONT.display,
              fontWeight: 800,
              fontSize: 17,
            }}
          >
            T
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2">
              <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 16, letterSpacing: '0.04em', color: B.bone }}>
                TONY
              </span>
              <MonoLabel size={9.5} color={B.muted}>
                HABITAT CONSULTANT
              </MonoLabel>
            </div>
            <p className="text-sm leading-relaxed mb-3.5" style={{ color: B.boneDim, fontFamily: FONT.body }}>
              I&apos;d hang Stand 01 on the bench, 40 yards off the bedding edge — it only hunts on a
              northwest. Enter up the creek bottom so your scent stays out of the bedding. The plot
              goes in the northwest opening: 6+ hours of sun, and the travel corridor feeds it from
              the east. Your ground, your call — tell me what you&apos;re seeing and I&apos;ll adjust.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'STAND 01 · CONF 0.87', color: B.mossLight },
                { label: 'WIND NW–N', color: B.steel },
                { label: 'PLOT 1.8 AC', color: B.mossLight },
                { label: 'ENTRY: CREEK S', color: B.tan },
              ].map(({ label, color }) => (
                <span
                  key={label}
                  className="px-2 py-1 rounded"
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 9.5,
                    letterSpacing: '0.1em',
                    color,
                    background: 'rgba(30,33,34,0.7)',
                    border: `1px solid ${B.hairlineSoft}`,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center pt-28 pb-20 px-6 overflow-hidden" style={{ background: B.ink }}>
      {/* topo + grid texture, moss glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-60" style={topoBg} />
        <div className="absolute inset-0" style={gridBg} />
        <div
          className="absolute rounded-full"
          style={{
            width: 1000,
            height: 1000,
            top: -340,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'radial-gradient(circle, rgba(107,122,87,0.07) 0%, transparent 62%)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 520,
            height: 520,
            bottom: -120,
            right: -100,
            background: 'radial-gradient(circle, rgba(200,136,42,0.04) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto w-full">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full mb-8"
            style={{ background: 'rgba(44,47,51,0.5)', border: `1px solid ${B.hairlineSoft}` }}
          >
            <span style={{ color: B.mossLight }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                <circle cx="12" cy="12" r="7" />
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
              </svg>
            </span>
            <MonoLabel size={10.5}>DECISIONS, NOT MAPS</MonoLabel>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="text-6xl md:text-8xl lg:text-9xl leading-[0.92] mb-7 uppercase"
            style={{ fontFamily: FONT.display, fontWeight: 800, letterSpacing: '0.015em', color: B.bone }}
          >
            You Know Your Land.
            <br />
            <span
              style={{
                backgroundImage: `linear-gradient(120deg, ${B.mossLight} 0%, ${B.moss} 80%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Tony Knows Deer.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg md:text-xl leading-relaxed mb-9 max-w-2xl mx-auto"
            style={{ color: B.boneDim, fontFamily: FONT.body }}
          >
            Every hunting app sells you another map. BuckGrid Pro sells the decision: Tony analyzes
            your exact acreage from satellite imagery and tells you precisely where to hang a stand —
            before the season opens. Tony suggests. You decide.
          </motion.p>

          {/* Freemium CTA — the loudest element above the fold */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-4 mb-7"
          >
            <Link
              href="/buckgrid"
              className="px-10 py-5 rounded-xl text-xl md:text-2xl uppercase transition-all hover:scale-[1.03] hover:-translate-y-0.5 active:scale-100"
              style={amberBtnStyle}
            >
              Draw Your Land — First Map Free
            </Link>
            <span
              className="px-3.5 py-1.5 rounded-full"
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: '0.14em',
                color: B.amberLight,
                border: '1px solid rgba(200,136,42,0.4)',
                background: 'rgba(200,136,42,0.07)',
              }}
            >
              FIRST MAP FREE / NO CARD REQUIRED
            </span>
            <a href="#how-it-works" className="px-7 py-3 rounded-xl text-base uppercase transition-all hover:text-white" style={ghostBtnStyle}>
              See How It Works
            </a>
          </motion.div>
        </div>

        <FadeIn delay={0.35} className="w-full max-w-3xl mx-auto">
          <HeroMapPanel />
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Data strip ───────────────────────────────────────────────────────────────

const DATA_STRIP = [
  { val: 'FREE', label: 'FIRST MAP — NO CARD REQUIRED', accent: true },
  { val: '06', label: 'TERRAIN DATA LAYERS', accent: false },
  { val: '<90s', label: 'SATELLITE TO DECISION', accent: false },
  { val: '100%', label: 'TERRAIN-GROUNDED PLACEMENTS', accent: false },
]

function DataStrip() {
  return (
    <section style={{ borderTop: `1px solid ${B.hairlineSoft}`, borderBottom: `1px solid ${B.hairlineSoft}`, background: B.card }}>
      <div className="max-w-5xl mx-auto px-6 py-7">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {DATA_STRIP.map((s, i) => (
            <div
              key={s.label}
              className="flex flex-col items-center py-4 text-center"
              style={{ borderRight: i < DATA_STRIP.length - 1 ? `1px solid ${B.hairlineSoft}` : 'none' }}
            >
              <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 34, lineHeight: 1, color: s.accent ? B.amberLight : B.bone }}>
                {s.val}
              </div>
              <div className="mt-2 px-2">
                <MonoLabel color={B.muted} size={9.5}>
                  {s.label}
                </MonoLabel>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How It Works — Draw Your Land. Talk To Tony. Kill Bigger Bucks. ─────────

const HOW_STEPS = [
  {
    num: '01',
    icon: <IconDraw />,
    title: 'Draw Your Land',
    desc: 'Pull your property up on satellite and trace the boundary. The pinch points, saddles, and transition edges inside it are already in the data.',
    tag: 'SATELLITE · BOUNDARY',
  },
  {
    num: '02',
    icon: <IconChat />,
    title: 'Talk to Tony',
    desc: 'Tony analyzes your exact acreage — elevation, cover, wind, water — and places stands, plots, bedding, and travel corridors on real ground, with the reasoning behind every call.',
    tag: 'TERRAIN · WIND · COVER',
  },
  {
    num: '03',
    icon: <IconCrosshair />,
    title: 'Kill Bigger Bucks',
    desc: 'Walk out with coordinates, the wind each stand hunts on, and an entry route that doesn’t blow out the bedding. Tony suggests. You decide. You hang the stand.',
    tag: 'COORDS · WIND WINDOW',
  },
]

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-28 px-6 relative" style={{ background: B.ink }}>
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-16">
          <SectionEyebrow index="01" label="HOW IT WORKS" />
          <h2 className="text-5xl md:text-7xl uppercase" style={{ fontFamily: FONT.display, fontWeight: 800, letterSpacing: '0.015em', color: B.bone, lineHeight: 0.95 }}>
            Draw Your Land. Talk to Tony.
            <br />
            <span style={{ color: B.mossLight }}>Kill Bigger Bucks.</span>
          </h2>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {HOW_STEPS.map((step, i) => (
            <FadeIn key={step.num} delay={i * 0.1}>
              <div
                className="relative p-8 rounded-2xl h-full transition-transform hover:-translate-y-1"
                style={{ background: B.card, border: `1px solid ${B.hairlineSoft}` }}
              >
                <div
                  className="absolute top-6 right-7 select-none pointer-events-none"
                  style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 72, lineHeight: 1, color: 'rgba(107,122,87,0.12)' }}
                >
                  {step.num}
                </div>
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-6"
                  style={{ background: 'rgba(107,122,87,0.12)', color: B.mossLight, border: '1px solid rgba(107,122,87,0.3)' }}
                >
                  {step.icon}
                </div>
                <div className="mb-2">
                  <MonoLabel size={9.5} color={B.muted}>
                    STEP {step.num} — {step.tag}
                  </MonoLabel>
                </div>
                <h3 className="text-2xl uppercase mb-3" style={{ fontFamily: FONT.display, fontWeight: 700, letterSpacing: '0.03em', color: B.bone }}>
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: B.boneFaint, fontFamily: FONT.body }}>
                  {step.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: <IconCrosshair />,
    title: 'Grounded Placement Engine',
    desc: 'Stands, plots, and bedding snap to actual terrain. The engine computes candidate sites inside your boundary; Tony ranks them and shows his work. No pins in the middle of a pond.',
    tag: 'ENGINE',
  },
  {
    icon: <IconWind />,
    title: 'Wind-Aware Stand Sites',
    desc: 'Every stand comes with the wind it hunts on. Approach, thermal drift, and scent cone are factored before the pin drops — so you don’t burn a sit on the wrong wind.',
    tag: 'WIND',
  },
  {
    icon: <IconFunnel />,
    title: 'Funnels & Pinch Points',
    desc: 'Tony reads the travel corridors built into your terrain — saddles, transition edges, inside corners, creek crossings — and tells you which ones are actually huntable.',
    tag: 'TERRAIN',
  },
  {
    icon: <IconPlot />,
    title: 'Food Plot Placement',
    desc: 'Plot sites graded on sun hours, soil, and access — sized in acres and placed where they grow, draw, and stay huntable on your prevailing winds.',
    tag: 'PLOTS',
  },
  {
    icon: <IconRoute />,
    title: 'Entry & Exit Routes',
    desc: 'An invisible entry is worth more than a perfect stand. Tony routes you in and out using terrain and wind so the spot stays cold until you need it.',
    tag: 'ACCESS',
  },
  {
    icon: <IconChat />,
    title: 'Talk to Tony',
    desc: 'Ask why. Tony answers in plain hunter language — staging areas, pinch points, wind windows — and sharpens the plan when you tell him what you’re seeing on the ground.',
    tag: 'CONSULTANT',
  },
]

function Features() {
  return (
    <section id="features" className="py-28 px-6" style={{ background: B.card }}>
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-16">
          <SectionEyebrow index="02" label="CAPABILITIES" />
          <h2 className="text-5xl md:text-7xl uppercase" style={{ fontFamily: FONT.display, fontWeight: 800, letterSpacing: '0.015em', color: B.bone, lineHeight: 0.95 }}>
            Every Acre Analyzed.
            <br />
            <span style={{ color: B.mossLight }}>Every Stand Earned.</span>
          </h2>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feat, i) => (
            <FadeIn key={feat.title} delay={i * 0.06}>
              <div
                className="group p-7 rounded-2xl h-full transition-all hover:-translate-y-1"
                style={{ background: B.ink, border: `1px solid ${B.hairlineSoft}` }}
              >
                <div className="flex items-start justify-between mb-5">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(107,122,87,0.1)', color: B.mossLight, border: '1px solid rgba(107,122,87,0.28)' }}
                  >
                    {feat.icon}
                  </div>
                  <MonoLabel size={9} color={B.muted}>
                    {feat.tag}
                  </MonoLabel>
                </div>
                <h3 className="text-base font-bold mb-2" style={{ color: B.bone, fontFamily: FONT.body }}>
                  {feat.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: B.boneFaint, fontFamily: FONT.body }}>
                  {feat.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Field notes — example analyses + founder note ────────────────────────────

const FIELD_NOTES = [
  {
    state: 'KANSAS',
    meta: '160 AC · CRP + SOYBEANS',
    finding:
      'On ground like this, Tony flags a staging-area stand 140 yards off the CRP edge, downwind of the neighbor’s corn — set on a bench where evening thermals rise. The plot goes in the NE timber opening: 2 acres of clover, 6+ hours of sun confirmed from satellite.',
    tags: ['STAND', 'FOOD PLOT', 'STAGING AREA'],
  },
  {
    state: 'MISSOURI',
    meta: '80 AC · OZARK TIMBER, HIGH PRESSURE',
    finding:
      'Tight timber with no sanctuary — no block of 5+ acres off the two-track. Tony prescribes hinge-cut TSI on the south section first, then a stand on the funnel connecting the two timber blocks. Entry runs the creek bottom and only hunts a northwest.',
    tags: ['SANCTUARY', 'TSI', 'FUNNEL'],
  },
  {
    state: 'ILLINOIS',
    meta: '220 AC · ROW CROP + TIMBER',
    finding:
      'With adjacent corn confirmed by crop data, staging-area stands beat destination plots — the deer are feeding off-property. Tony places a 0.4-acre brassica plot at the timber fringe, 80 yards off the transition edge, and marks the bedding block in the NW woodlot.',
    tags: ['STAGING AREA', 'BRASSICA', 'BEDDING'],
  },
]

function FieldNotes() {
  return (
    <section id="field-notes" className="py-28 px-6" style={{ background: B.ink }}>
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-16">
          <SectionEyebrow index="03" label="FIELD NOTES" />
          <h2 className="text-5xl md:text-7xl uppercase" style={{ fontFamily: FONT.display, fontWeight: 800, letterSpacing: '0.015em', color: B.bone, lineHeight: 0.95 }}>
            This Is What Tony Finds
            <br />
            <span style={{ color: B.mossLight }}>on Ground Like Yours</span>
          </h2>
          <p className="mt-5 text-sm max-w-xl mx-auto leading-relaxed" style={{ color: B.boneFaint, fontFamily: FONT.body }}>
            Not generic tips — specific terrain reads with stand sites, entry routes, and plot specs
            drawn on the satellite map. Example analyses of the kind Tony produces on every run.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {FIELD_NOTES.map((r, i) => (
            <FadeIn key={r.state} delay={i * 0.1}>
              <div className="p-7 rounded-2xl flex flex-col h-full" style={{ background: B.card, border: `1px solid ${B.hairlineSoft}` }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 20, letterSpacing: '0.04em', color: B.bone }}>{r.state}</div>
                    <div className="mt-1">
                      <MonoLabel size={9} color={B.muted}>
                        {r.meta}
                      </MonoLabel>
                    </div>
                  </div>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: B.ink, color: B.mossLight, border: '1px solid rgba(107,122,87,0.3)', fontFamily: FONT.display, fontWeight: 800, fontSize: 14 }}
                  >
                    T
                  </div>
                </div>
                <p className="text-sm leading-relaxed flex-1" style={{ color: B.boneDim, fontFamily: FONT.body }}>
                  {r.finding}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-5 pt-4" style={{ borderTop: `1px solid ${B.hairlineSoft}` }}>
                  {r.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded"
                      style={{ fontFamily: FONT.mono, fontSize: 9, letterSpacing: '0.1em', color: B.mossLight, background: 'rgba(107,122,87,0.08)', border: '1px solid rgba(107,122,87,0.25)' }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Founder note — honest social proof */}
        <FadeIn>
          <div
            className="p-8 md:p-10 rounded-2xl flex flex-col md:flex-row items-start gap-6"
            style={{ background: B.card, border: `1px solid ${B.hairline}` }}
          >
            <div className="flex-shrink-0">
              <WaypointMark size={52} />
            </div>
            <div>
              <div className="mb-3">
                <MonoLabel size={10}>FOUNDER NOTE — DAY ONE BUILD</MonoLabel>
              </div>
              <p className="text-base leading-relaxed max-w-3xl" style={{ color: B.boneDim, fontFamily: FONT.body }}>
                You won&apos;t find fake testimonials or &ldquo;trusted by 10,000 hunters&rdquo; on this page —
                hunters smell that a mile off, and BuckGrid Pro is a founder build on day one. What you&apos;ll
                find is the map, the engine, and Tony. Your first map is free: judge the output on your own
                ground. Season-one field reports will land here this fall.
              </p>
              <div className="mt-4">
                <MonoLabel size={10} color={B.tan}>
                  — BO, FOUNDER
                </MonoLabel>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Comparison — they sell maps, we sell decisions ───────────────────────────

const COMPARE_ROWS = [
  { label: 'What you’re buying', vals: ['Maps', 'Maps', 'Decisions'] },
  { label: 'Cost', vals: ['$36–108/yr', '$30–100/yr', 'Free to start'] },
  { label: 'Satellite layers + topo', vals: [true, true, true] },
  { label: 'Analyzes your exact acreage', vals: [false, false, true] },
  { label: 'Tells you where to hang the stand', vals: [false, false, true] },
  { label: 'Wind factored into every placement', vals: [false, false, true] },
  { label: 'Explains the reasoning', vals: [false, false, true] },
  { label: 'No account required to try', vals: [false, false, true] },
]

function ComparisonTable() {
  return (
    <section id="comparison" className="py-28 px-6" style={{ background: B.card }}>
      <div className="max-w-4xl mx-auto">
        <FadeIn className="text-center mb-16">
          <SectionEyebrow index="04" label="HEAD TO HEAD" />
          <h2 className="text-5xl md:text-7xl uppercase" style={{ fontFamily: FONT.display, fontWeight: 800, letterSpacing: '0.015em', color: B.bone, lineHeight: 0.95 }}>
            They Sell Maps.
            <br />
            <span style={{ color: B.mossLight }}>We Sell Decisions.</span>
          </h2>
          <p className="mt-5 text-sm max-w-lg mx-auto" style={{ color: B.boneFaint, fontFamily: FONT.body }}>
            HuntStand, onX, BaseMap, Spartan Forge — good maps, all of them. None of them analyze
            your acreage and hand you a placement with the reasoning attached.
          </p>
        </FadeIn>

        <FadeIn>
          <div className="overflow-x-auto">
            <div className="rounded-2xl overflow-hidden min-w-[560px]" style={{ border: `1px solid ${B.hairlineSoft}` }}>
              <div className="grid grid-cols-4" style={{ background: B.ink, borderBottom: `1px solid ${B.hairlineSoft}` }}>
                <div className="p-5" />
                {['HuntStand', 'onX Hunt', 'BuckGrid Pro'].map((col, i) => (
                  <div
                    key={col}
                    className="p-5 text-center"
                    style={{
                      borderLeft: `1px solid ${B.hairlineSoft}`,
                      background: i === 2 ? 'rgba(200,136,42,0.06)' : 'transparent',
                      borderTop: i === 2 ? `2px solid ${B.amber}` : '2px solid transparent',
                    }}
                  >
                    <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 17, letterSpacing: '0.04em', color: i === 2 ? B.amberLight : B.bone, textTransform: 'uppercase' }}>
                      {col}
                    </div>
                    {i === 2 && (
                      <div className="mt-1">
                        <MonoLabel size={8.5} color={B.amberLight}>
                          THIS ONE
                        </MonoLabel>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {COMPARE_ROWS.map((row, ri) => (
                <div
                  key={row.label}
                  className="grid grid-cols-4"
                  style={{
                    borderBottom: ri < COMPARE_ROWS.length - 1 ? `1px solid ${B.hairlineSoft}` : 'none',
                    background: ri % 2 === 0 ? 'transparent' : 'rgba(216,211,197,0.015)',
                  }}
                >
                  <div className="p-4 pl-5 text-sm font-medium flex items-center" style={{ color: B.boneDim, fontFamily: FONT.body }}>
                    {row.label}
                  </div>
                  {row.vals.map((val, vi) => (
                    <div
                      key={vi}
                      className="p-4 flex items-center justify-center text-sm text-center"
                      style={{
                        borderLeft: `1px solid ${B.hairlineSoft}`,
                        background: vi === 2 ? 'rgba(200,136,42,0.03)' : 'transparent',
                      }}
                    >
                      {typeof val === 'boolean' ? (
                        val ? (
                          <span style={{ color: B.mossLight }}>
                            <IconCheck />
                          </span>
                        ) : (
                          <span style={{ color: 'rgba(216,211,197,0.18)' }}>
                            <IconX />
                          </span>
                        )
                      ) : (
                        <span style={{ fontFamily: FONT.mono, fontSize: 12, color: vi === 2 ? B.amberLight : B.muted, fontWeight: vi === 2 ? 700 : 400 }}>
                          {val}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

async function startCheckout(endpoint: string) {
  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else alert('Checkout unavailable — try again or email bo@neuradexai.com')
  } catch {
    alert('Checkout unavailable — try again or email bo@neuradexai.com')
  }
}

function Pricing() {
  return (
    <section id="pricing" className="py-28 px-6" style={{ background: B.ink }}>
      <div className="max-w-5xl mx-auto">
        <FadeIn className="text-center mb-16">
          <SectionEyebrow index="05" label="PRICING" />
          <h2 className="text-5xl md:text-7xl uppercase" style={{ fontFamily: FONT.display, fontWeight: 800, letterSpacing: '0.015em', color: B.bone, lineHeight: 0.95 }}>
            Less Than a Bag of Seed.
          </h2>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Free */}
          <FadeIn delay={0}>
            <div className="relative p-8 rounded-2xl flex flex-col h-full" style={{ background: B.card, border: `1px solid ${B.hairlineSoft}` }}>
              <div className="mb-6">
                <MonoLabel size={10} color={B.muted}>
                  SCOUT — FREE
                </MonoLabel>
                <div className="flex items-end gap-1.5 mt-2">
                  <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 52, lineHeight: 1, color: B.bone }}>$0</span>
                  <span className="text-sm mb-1.5" style={{ color: B.muted }}>forever</span>
                </div>
              </div>
              <ul className="flex-1 space-y-3 mb-8">
                {['1 full property analysis', 'Satellite map + drawing tools', 'Tony’s placements & reasoning', 'No account, no card'].map(f => (
                  <li key={f} className="flex items-start gap-3 text-sm" style={{ color: B.boneDim, fontFamily: FONT.body }}>
                    <span className="mt-0.5 flex-shrink-0" style={{ color: B.mossLight }}>
                      <IconCheck />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/buckgrid"
                className="block text-center py-3.5 px-6 rounded-xl text-sm uppercase transition-all hover:opacity-90"
                style={{ ...ghostBtnStyle, fontSize: 14 }}
              >
                Draw Your Land Free
              </Link>
            </div>
          </FadeIn>

          {/* Pro Annual */}
          <FadeIn delay={0.1}>
            <div
              className="relative p-8 rounded-2xl flex flex-col h-full"
              style={{
                background: `linear-gradient(165deg, rgba(200,136,42,0.07) 0%, ${B.card} 45%)`,
                border: '1px solid rgba(200,136,42,0.45)',
                boxShadow: '0 0 60px -18px rgba(200,136,42,0.25)',
              }}
            >
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full"
                style={{ background: B.amber, fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: '0.12em', color: B.card }}
              >
                BEST VALUE
              </div>
              <div className="mb-6">
                <MonoLabel size={10} color={B.amberLight}>
                  PRO — ANNUAL
                </MonoLabel>
                <div className="flex items-end gap-1.5 mt-2">
                  <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 52, lineHeight: 1, color: B.bone }}>$79</span>
                  <span className="text-sm mb-1.5" style={{ color: B.muted }}>/year</span>
                </div>
                <div className="mt-1.5">
                  <MonoLabel size={9} color={B.muted}>
                    FLAT RATE · NO ACREAGE LIMITS
                  </MonoLabel>
                </div>
              </div>
              <ul className="flex-1 space-y-3 mb-8">
                {['Unlimited analyses', 'All drawing tools', 'Seasonal strategy updates', 'Save & export maps', 'Priority Tony responses', 'Email support'].map(f => (
                  <li key={f} className="flex items-start gap-3 text-sm" style={{ color: B.boneDim, fontFamily: FONT.body }}>
                    <span className="mt-0.5 flex-shrink-0" style={{ color: B.mossLight }}>
                      <IconCheck />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => startCheckout('/api/checkout/pro')}
                className="block w-full text-center py-3.5 px-6 rounded-xl text-sm uppercase transition-all hover:scale-[1.02] active:scale-100 cursor-pointer"
                style={{ ...amberBtnStyle, fontSize: 15, border: 'none' }}
              >
                Get Pro — $79/yr
              </button>
            </div>
          </FadeIn>

          {/* Field Report */}
          <FadeIn delay={0.2}>
            <div className="relative p-8 rounded-2xl flex flex-col h-full" style={{ background: B.card, border: `1px solid ${B.hairlineSoft}` }}>
              <div className="mb-6">
                <MonoLabel size={10} color={B.muted}>
                  FIELD REPORT — ONE-TIME
                </MonoLabel>
                <div className="flex items-end gap-1.5 mt-2">
                  <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 52, lineHeight: 1, color: B.bone }}>$97</span>
                  <span className="text-sm mb-1.5" style={{ color: B.muted }}>once</span>
                </div>
                <div className="mt-1.5">
                  <MonoLabel size={9} color={B.muted}>
                    NO SUBSCRIPTION
                  </MonoLabel>
                </div>
              </div>
              <ul className="flex-1 space-y-3 mb-8">
                {['Full analysis of your parcel', 'Top 3–5 stand priorities', 'Plot specs + sizing', 'Entry/exit route recommendations', 'Bedding corridor mapping', 'Drawn on your actual land'].map(f => (
                  <li key={f} className="flex items-start gap-3 text-sm" style={{ color: B.boneDim, fontFamily: FONT.body }}>
                    <span className="mt-0.5 flex-shrink-0" style={{ color: B.mossLight }}>
                      <IconCheck />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => startCheckout('/api/checkout/report')}
                className="block w-full text-center py-3.5 px-6 rounded-xl text-sm uppercase transition-all hover:opacity-90 cursor-pointer"
                style={{ ...ghostBtnStyle, fontSize: 14, background: 'transparent' }}
              >
                Order Your Report
              </button>
            </div>
          </FadeIn>
        </div>

        <FadeIn>
          <p className="text-center">
            <MonoLabel size={10} color={B.muted}>
              FREE TIER FOREVER · FLAT RATE · ANALYSIS IN SECONDS
            </MonoLabel>
          </p>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'How does Tony know about my specific land?',
    a: 'Tony analyzes your exact acreage — elevation, land cover, soil, water, wind — inside the boundary you draw. The placement engine computes candidate sites on real terrain; Tony ranks them and explains why. The more you tell him about what you’re seeing in the field, the sharper the plan gets.',
  },
  {
    q: 'Does Tony replace a habitat consultant?',
    a: 'Tony gives you a consultant’s reasoning — stand priorities, wind strategy, seasonal timing — available 24/7 at a fraction of the cost. Tony suggests; you decide. Your eyes on the ground plus his terrain analysis is a hard combo to beat.',
  },
  {
    q: 'What’s the difference between Free and Pro?',
    a: 'Free gives you one complete analysis so you can judge the output on your own ground. Pro unlocks unlimited analyses, seasonal updates, saving and exporting maps, and priority Tony responses.',
  },
  {
    q: 'Is my property data private?',
    a: 'Yes. Your maps and property data are stored securely and never shared with third parties. Your land layout is not used to train any AI models.',
  },
  {
    q: 'What if I don’t know anything about habitat work?',
    a: 'That’s exactly who Tony is built for. Draw your boundary and talk to Tony — he explains everything in plain hunter language: what to do, where, and why, with clear, specific steps.',
  },
]

function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  return (
    <section id="faq" className="py-28 px-6" style={{ background: B.card }}>
      <div className="max-w-2xl mx-auto">
        <FadeIn className="text-center mb-14">
          <SectionEyebrow index="06" label="FAQ" />
          <h2 className="text-5xl md:text-7xl uppercase" style={{ fontFamily: FONT.display, fontWeight: 800, letterSpacing: '0.015em', color: B.bone, lineHeight: 0.95 }}>
            Straight Answers
          </h2>
        </FadeIn>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <FadeIn key={faq.q} delay={i * 0.05}>
              <div
                role="button"
                tabIndex={0}
                aria-expanded={openIdx === i}
                className="w-full text-left p-6 rounded-2xl transition-all cursor-pointer"
                style={{
                  background: openIdx === i ? B.ink : 'rgba(30,33,34,0.5)',
                  border: `1px solid ${openIdx === i ? 'rgba(107,122,87,0.35)' : B.hairlineSoft}`,
                  borderLeft: openIdx === i ? `3px solid ${B.moss}` : `1px solid ${B.hairlineSoft}`,
                }}
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setOpenIdx(openIdx === i ? null : i)
                  }
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-baseline gap-3">
                    <MonoLabel size={10} color={B.muted}>
                      {String(i + 1).padStart(2, '0')}
                    </MonoLabel>
                    <span className="text-base font-semibold" style={{ color: B.bone, fontFamily: FONT.body }}>
                      {faq.q}
                    </span>
                  </span>
                  <span style={{ color: B.muted, flexShrink: 0 }}>
                    <IconChevron open={openIdx === i} />
                  </span>
                </div>
                <AnimatePresence initial={false}>
                  {openIdx === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <p className="text-sm leading-relaxed pt-4" style={{ color: B.boneFaint, fontFamily: FONT.body }}>
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="py-32 px-6 relative overflow-hidden" style={{ background: B.ink }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-70" style={topoBg} />
        <div className="absolute inset-0" style={gridBg} />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, rgba(200,136,42,0.05) 0%, transparent 65%)' }}
        />
      </div>
      <div className="relative max-w-4xl mx-auto text-center">
        <FadeIn>
          <div className="mb-6 flex justify-center">
            <WaypointMark size={64} />
          </div>
          <h2 className="text-6xl md:text-8xl uppercase mb-7" style={{ fontFamily: FONT.display, fontWeight: 800, letterSpacing: '0.015em', color: B.bone, lineHeight: 0.92 }}>
            Stop Guessing.
            <br />
            <span
              style={{
                backgroundImage: `linear-gradient(120deg, ${B.amberLight} 0%, ${B.amber} 70%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Start Placing.
            </span>
          </h2>
          <p className="text-lg mb-10 max-w-xl mx-auto" style={{ color: B.boneDim, fontFamily: FONT.body }}>
            Draw your land and talk to Tony before the season opens. Tony suggests. You decide.
          </p>
          <Link
            href="/buckgrid"
            className="inline-flex items-center gap-3 px-11 py-5 rounded-xl text-xl uppercase transition-all hover:scale-[1.03] hover:-translate-y-1 active:scale-100"
            style={amberBtnStyle}
          >
            Draw Your Land — First Map Free
          </Link>
          <div className="mt-7">
            <MonoLabel size={10} color={B.amberLight}>
              FIRST MAP FREE / NO CARD REQUIRED
            </MonoLabel>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ background: B.card, borderTop: `1px solid ${B.hairlineSoft}` }}>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
          <div>
            <div className="mb-3">
              <Wordmark size={19} markSize={30} />
            </div>
            <MonoLabel size={9.5} color={B.muted}>
              DECISIONS, NOT MAPS
            </MonoLabel>
            <p className="text-sm max-w-xs mt-3" style={{ color: B.boneFaint, fontFamily: FONT.body }}>
              You know your land. Tony knows deer.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {[
              { label: 'Open the Map', href: '/buckgrid' },
              { label: 'How It Works', href: '#how-it-works' },
              { label: 'Features', href: '#features' },
              { label: 'Pricing', href: '#pricing' },
              { label: 'FAQ', href: '#faq' },
            ].map(link => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm transition-colors hover:text-white"
                style={{ color: B.muted, fontFamily: FONT.body }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${B.hairlineSoft}` }} className="mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <MonoLabel size={9.5} color={B.muted}>
            © {new Date().getFullYear()} BUCKGRID PRO
          </MonoLabel>
          <MonoLabel size={9.5} color={B.muted}>
            POWERED BY <span style={{ color: B.mossLight }}>TONY</span> · BUILT BY NEURADEX AI
          </MonoLabel>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: B.ink, color: B.bone, fontFamily: FONT.body }}>
      <Nav />
      <Hero />
      <DataStrip />
      <HowItWorks />
      <Features />
      <FieldNotes />
      <ComparisonTable />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  )
}
