'use client'

import { motion, useInView, AnimatePresence } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import BuckLogo from '../src/components/buckgrid/ui/BuckLogo'

// ─── Color tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#1E2122',
  bgAlt: '#1E2122',
  card: '#131710',
  accent: '#6B7A57',
  highlight: '#6B7A57',
  text: '#D8D3C5',
  muted: '#6E6A5C',
  border: 'rgba(107,122,87,0.1)',
  green: '#5A8A5F',
  greenDim: 'rgba(90,138,95,0.15)',
}

// ─── Animation helpers ────────────────────────────────────────────────────────

interface FadeInProps {
  children: React.ReactNode
  delay?: number
  className?: string
  y?: number
}

function FadeIn({ children, delay = 0, className = '', y = 32 }: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
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
        background: scrolled ? 'rgba(10,14,23,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <BuckLogo size={30} color="#6B7A57" />
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontFamily: "'Teko', 'Oswald', sans-serif", fontWeight: 900, fontSize: '18px', letterSpacing: '0.14em', color: '#D8D3C5', textTransform: 'uppercase', display: 'flex', alignItems: 'baseline', gap: '5px' }}>
              <span>BUCK<span style={{ color: C.accent }}>GRID</span></span>
              <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.16em', color: '#6E6A5C' }}>PRO</span>
            </div>
          </div>
        </Link>

        {/* Center links */}
        <div className="hidden md:flex items-center gap-8">
          {['How It Works', 'Features', 'Pricing'].map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
              className="text-sm font-medium transition-colors hover:text-white"
              style={{ color: C.muted }}
            >
              {link}
            </a>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/buckgrid"
          className="px-5 py-2 rounded-lg text-sm font-bold transition-all hover:opacity-90 hover:scale-105 active:scale-100"
          style={{ background: 'linear-gradient(135deg, #6B7A57, #4A543D)', color: '#0C0F0A' }}
        >
          Try Free
        </Link>
      </div>
    </nav>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconSatellite() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 7 9 3 3 9l4 4" /><path d="m13 7 3 3" /><path d="M14 14c-1 2-2 3-3 3s-2-1-3-3 1-2 3-3 3 1 3 3Z" />
      <path d="M20 4a2.828 2.828 0 0 1 0 4L14 14" /><path d="M18 9 9 18" />
    </svg>
  )
}

function IconPencil() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function IconBrain() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-4.14z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-4.14z" />
    </svg>
  )
}

function IconMap() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  )
}

function IconLeaf() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  )
}

function IconTarget() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// ─── Hero mock chat ───────────────────────────────────────────────────────────

function HeroMockPanel() {
  return (
    <div
      className="relative w-full max-w-2xl mx-auto rounded-2xl overflow-hidden"
      style={{
        border: `1px solid ${C.border}`,
        boxShadow: '0 40px 80px -20px rgba(0,0,0,0.8), 0 0 60px -10px rgba(107,122,87,0.1)',
      }}
    >
      {/* Simulated satellite map bg */}
      <div
        className="relative w-full"
        style={{
          height: 240,
          background: 'linear-gradient(145deg, #0a1a08 0%, #0f2409 25%, #142d0c 45%, #0c1e08 65%, #091608 80%, #0e2110 100%)',
        }}
      >
        {/* Terrain texture overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(ellipse at 30% 60%, rgba(34,120,34,0.2) 0%, transparent 50%), radial-gradient(ellipse at 70% 30%, rgba(60,40,20,0.3) 0%, transparent 40%), radial-gradient(ellipse at 20% 20%, rgba(20,80,20,0.15) 0%, transparent 35%)',
          }}
        />
        {/* Creek/water line */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 640 240" preserveAspectRatio="none">
          <path d="M 80 60 Q 160 90 220 110 Q 300 130 360 120 Q 420 110 500 140 Q 560 158 620 150" stroke="rgba(59,130,246,0.4)" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
        {/* Drawn feature overlays */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 640 240" preserveAspectRatio="none">
          {/* Food plot polygon */}
          <polygon points="80,40 160,35 170,90 85,95" fill="rgba(34,197,94,0.25)" stroke="rgba(34,197,94,0.8)" strokeWidth="1.5" strokeDasharray="4 2" />
          {/* Bedding area */}
          <ellipse cx="400" cy="100" rx="55" ry="38" fill="rgba(180,120,60,0.2)" stroke="rgba(180,120,60,0.7)" strokeWidth="1.5" strokeDasharray="4 2" />
          {/* Trail line */}
          <path d="M 230 150 Q 310 140 370 125 Q 420 115 460 95" stroke="rgba(251,191,36,0.8)" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="6 3" />
          {/* Stand marker — brass crosshair */}
          <circle cx="340" cy="75" r="9" fill="rgba(107,122,87,0.9)" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" />
          <line x1="340" y1="68" x2="340" y2="82" stroke="rgba(0,0,0,0.65)" strokeWidth="1.2" />
          <line x1="333" y1="75" x2="347" y2="75" stroke="rgba(0,0,0,0.65)" strokeWidth="1.2" />
          <circle cx="340" cy="75" r="2" fill="rgba(0,0,0,0.55)" />
        </svg>
        {/* Feature label badges on map */}
        <div className="absolute" style={{ top: 28, left: 68 }}>
          <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.85)', color: '#000' }}>Food Plot</span>
        </div>
        <div className="absolute" style={{ top: 105, left: 360 }}>
          <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(180,120,60,0.9)', color: '#fff' }}>Bedding</span>
        </div>
        {/* Coordinates HUD */}
        <div className="absolute bottom-2 left-3 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>38.8951° N · 96.3047° W</div>
        <div className="absolute bottom-2 right-3 flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>LIVE</span>
        </div>
      </div>

      {/* Tony chat response */}
      <div style={{ background: C.card, borderTop: `1px solid ${C.border}` }} className="p-5">
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5"
            style={{
              background: 'linear-gradient(135deg, #1e2a18, #2a3820)',
              border: `1px solid rgba(107,122,87,0.4)`,
              color: '#6B7A57',
            }}
          >
            T
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-white">Tony AI</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(34,197,94,0.15)', color: C.green }}>Wildlife Consultant</span>
            </div>
            <p className="text-sm leading-relaxed mb-3" style={{ color: C.text }}>
              I see 247 acres with creek bottoms running northeast. Your best stand location is on the ridge above the timber edge — 80 yards downwind of the bedding area. I&apos;ve drawn 4 features on your map.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Food Plot', color: C.green, bg: 'rgba(34,197,94,0.12)' },
                { label: 'Bedding', color: '#c47830', bg: 'rgba(180,120,60,0.12)' },
                { label: 'Trail', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
                { label: 'Stand', color: C.accent, bg: 'rgba(107,122,87,0.12)' },
              ].map(({ label, color, bg }) => (
                <span
                  key={label}
                  className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ color, background: bg, border: `1px solid ${color}30` }}
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
    <section
      className="relative min-h-screen flex flex-col justify-center pt-24 pb-20 px-6 overflow-hidden"
      style={{ background: C.bg }}
    >
      {/* Background: topographic grid + brass glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(107,122,87,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(107,122,87,0.025) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 900, height: 900,
            top: -280, left: '50%', transform: 'translateX(-50%)',
            background: 'radial-gradient(circle, rgba(107,122,87,0.055) 0%, transparent 65%)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 500, height: 500,
            bottom: 0, right: -80,
            background: 'radial-gradient(circle, rgba(90,138,95,0.04) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto w-full">
        <div className="max-w-3xl mx-auto text-center mb-12">
          {/* Eyebrow badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-8"
            style={{ background: 'rgba(107,122,87,0.1)', color: C.accent, border: `1px solid rgba(107,122,87,0.2)` }}
          >
            {/* Topo line icon */}
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <path d="M1 9 C3 9 3 7 5 7 C7 7 7 5 9 5 C11 5 11 3 13 3" stroke="#6B7A57" strokeWidth="1.2" strokeLinecap="round" fill="none" />
              <path d="M1 6 C3 6 3 4 5 4 C7 4 7 2 9 2 C11 2 11 1 13 1" stroke="#6B7A57" strokeWidth="0.7" strokeLinecap="round" fill="none" opacity="0.5" />
            </svg>
            Satellite-Grade Habitat Intelligence
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-7xl md:text-8xl lg:text-9xl leading-none mb-6 tracking-tight uppercase"
            style={{ color: '#fff' }}
          >
            Draw Your Land.
            <br />
            Talk To{' '}
            <span
              style={{
                backgroundImage: `linear-gradient(135deg, ${C.accent} 0%, #6B7A57 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Tony.
            </span>
            <br />
            Kill Bigger Bucks.
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg md:text-xl leading-relaxed mb-10 max-w-xl mx-auto"
            style={{ color: C.muted }}
          >
            Other apps show you a map. Tony reads your terrain — bedding zones, funnels, thermals — and tells you exactly where to hang your stand.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6"
          >
            <Link
              href="/buckgrid"
              className="group flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-base transition-all hover:scale-105 hover:-translate-y-0.5 active:scale-100"
              style={{
                background: 'linear-gradient(135deg, #6B7A57, #4A543D)',
                color: '#0C0F0A',
                boxShadow: `0 8px 30px -8px rgba(107,122,87,0.5)`,
              }}
            >
              Analyze My Land Free
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-base transition-all hover:text-white"
              style={{ color: C.muted, border: `1px solid ${C.border}` }}
            >
              See How It Works
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="text-xs"
            style={{ color: C.muted }}
          >
            No account required · Free to start · No credit card
          </motion.p>
        </div>

        {/* Mock panel */}
        <FadeIn delay={0.4} className="w-full max-w-2xl mx-auto">
          <HeroMockPanel />
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Trust bar ────────────────────────────────────────────────────────────────

const STATS = [
  { val: 'Day 1',    label: 'Founder Build' },
  { val: '6 Layers', label: 'Terrain Analysis' },
  { val: '<60s',     label: 'Time to First Plan' },
  { val: 'Free',     label: 'Your First Map' },
]

function TrustBar() {
  return (
    <section style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, background: C.card }}>
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          {STATS.map((s, i) => (
            <div
              key={s.val}
              className="flex flex-col items-center py-4 text-center"
              style={{
                borderRight: i < STATS.length - 1 ? `1px solid rgba(107,122,87,0.15)` : 'none',
              }}
            >
              <div className="text-3xl font-bold font-display tracking-wide" style={{ color: C.accent }}>{s.val}</div>
              <div className="text-xs mt-1.5 font-semibold uppercase tracking-widest" style={{ color: C.muted }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How It Works ─────────────────────────────────────────────────────────────

const HOW_STEPS = [
  {
    num: '01',
    icon: <IconSatellite />,
    title: 'Open Your Satellite Map',
    desc: 'Pull up your property on a real-time satellite view. Every creek bottom, timber edge, and field comes into focus instantly.',
    color: C.green,
  },
  {
    num: '02',
    icon: <IconPencil />,
    title: 'Draw Your Features',
    desc: 'Use the drawing tools to mark terrain features — food plots, timber blocks, travel corridors, water sources.',
    color: '#fbbf24',
  },
  {
    num: '03',
    icon: <IconBrain />,
    title: 'Get Tony\'s Expert Plan',
    desc: 'Tony AI analyzes your map with the eye of a wildlife biologist and delivers a specific, actionable habitat strategy — drawn directly on your property.',
    color: C.accent,
  },
]

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-28 px-6" style={{ background: C.bg }}>
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-16">
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.accent }}>Simple Process</div>
          <h2 className="font-display text-6xl md:text-7xl text-white uppercase tracking-tight">
            From satellite to strategy
            <br />
            <span style={{ color: C.muted, fontSize: '0.85em' }}>in three steps</span>
          </h2>
          <div
            className="inline-flex items-center gap-2 mt-6 px-4 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: C.greenDim, color: C.green, border: `1px solid rgba(34,197,94,0.2)` }}
          >
            Takes under 5 minutes
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {HOW_STEPS.map((step, i) => (
            <FadeIn key={step.num} delay={i * 0.1}>
              <div
                className="relative p-8 rounded-2xl h-full"
                style={{ background: C.card, border: `1px solid ${C.border}` }}
              >
                {/* Big background number */}
                <div
                  className="absolute top-6 right-6 font-display text-7xl leading-none select-none pointer-events-none"
                  style={{ color: `${step.color}10` }}
                >
                  {step.num}
                </div>
                {/* Brass step number circle */}
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, #6B7A57, #4A543D)',
                      color: '#0C0F0A',
                      boxShadow: '0 0 12px -4px rgba(107,122,87,0.5)',
                    }}
                  >
                    {parseInt(step.num, 10)}
                  </div>
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: `${step.color}15`, color: step.color }}
                  >
                    {step.icon}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{step.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Founder's Note (replaces fake testimonials) ──────────────────────────────

function Testimonials() {
  return (
    <section id="testimonials" className="py-28 px-6" style={{ background: '#1E2122' }}>
      <div className="max-w-4xl mx-auto">
        <FadeIn className="text-center mb-12">
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.accent }}>Founder's Note</div>
          <h2 className="font-display text-5xl md:text-6xl text-white uppercase tracking-tight">
            Built by one guy.
            <br />
            <span style={{ color: C.muted }}>No paid reviews yet.</span>
          </h2>
        </FadeIn>

        <FadeIn>
          <div
            className="relative p-10 rounded-2xl"
            style={{
              background: `linear-gradient(135deg, ${C.card} 0%, rgba(30,34,50,1) 100%)`,
              border: `1px solid rgba(107,122,87,0.2)`,
              boxShadow: `0 0 60px -20px rgba(107,122,87,0.15)`,
            }}
          >
            <div
              className="font-display text-8xl leading-none mb-4 select-none"
              style={{ color: `${C.accent}20` }}
            >
              &quot;
            </div>
            <p
              className="text-xl md:text-2xl leading-relaxed mb-6 max-w-3xl"
              style={{ color: '#fff' }}
            >
              I'm Bo. I hunt Kansas. I got tired of guessing where to put stands and
              food plots, so I built BuckGrid Pro to do what a $300/hr wildlife biologist
              does — except on demand, on your land, from a satellite.
            </p>
            <p
              className="text-base md:text-lg leading-relaxed mb-8 max-w-3xl"
              style={{ color: C.text }}
            >
              It's day one. I haven't paid anyone to say nice things. I'd rather earn it.
              Your first analysis is free — no account, no card. If Tony gets your land
              wrong, tell me. I'll fix it. If he nails it, tell a buddy.
            </p>

            <div className="flex items-center gap-4 pt-6" style={{ borderTop: `1px solid ${C.border}` }}>
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm"
                style={{
                  background: 'linear-gradient(135deg, #1e2a18, #2a3820)',
                  border: '1px solid rgba(107,122,87,0.4)',
                  color: C.accent,
                }}
              >
                BB
              </div>
              <div>
                <div className="font-bold text-white">Bo Bell</div>
                <div className="text-xs" style={{ color: C.muted }}>Founder · Neuradex AI · Council Grove, KS</div>
              </div>
              <Link
                href="/buckgrid"
                className="ml-auto px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #6B7A57, #4A543D)',
                  color: '#0C0F0A',
                  boxShadow: `0 8px 30px -8px rgba(107,122,87,0.5)`,
                }}
              >
                Try Tony →
              </Link>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: <IconSatellite />,
    title: 'Satellite Habitat Mapping',
    desc: 'Real-time satellite imagery of your exact property. Every timber edge, field, and creek visible at a glance.',
    color: C.green,
  },
  {
    icon: <IconPencil />,
    title: 'Draw Your Land Features',
    desc: 'Polygon, line, and point tools to mark food plots, bedding areas, water sources, and stand locations.',
    color: '#60a5fa',
  },
  {
    icon: <IconBrain />,
    title: 'Tony AI Vision Analysis',
    desc: 'Gemini Vision reads your satellite map like a trained wildlife biologist and generates a specific, drawn habitat plan.',
    color: C.accent,
  },
  {
    icon: <IconMap />,
    title: 'Annotated Output Maps',
    desc: 'Tony draws recommendations directly on your map — not a generic PDF, your actual property.',
    color: '#fbbf24',
  },
  {
    icon: <IconLeaf />,
    title: 'Food Plot Optimization',
    desc: 'Soil type, sun exposure, and deer movement paths combine to find your highest-yield planting locations.',
    color: C.green,
  },
  {
    icon: <IconTarget />,
    title: 'Stand & Blind Placement',
    desc: 'Wind analysis, funnel identification, and bedding proximity — Tony finds stands that produce season after season.',
    color: C.accent,
  },
]

function Features() {
  return (
    <section id="features" className="py-28 px-6" style={{ background: C.bg }}>
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-16">
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.accent }}>Tony&apos;s Toolkit</div>
          <h2 className="font-display text-6xl md:text-7xl text-white uppercase tracking-tight">
            Everything a wildlife biologist
            <br />
            would tell you
          </h2>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feat, i) => (
            <FadeIn key={feat.title} delay={i * 0.07}>
              <div
                className="group p-7 rounded-2xl h-full transition-all hover:-translate-y-1"
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                }}
              >
                <div className="flex items-start justify-between mb-5">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{
                      background: `${feat.color}12`,
                      color: feat.color,
                      border: `1px solid ${feat.color}30`,
                      boxShadow: '0 2px 8px -4px rgba(0,0,0,0.5)',
                    }}
                  >
                    {feat.icon}
                  </div>
                  <span
                    className="text-xs font-semibold px-2 py-1 rounded-full"
                    style={{ background: 'rgba(107,122,87,0.08)', color: C.accent, border: `1px solid rgba(107,122,87,0.15)` }}
                  >
                    AI-powered
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mb-2">{feat.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{feat.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Comparison Table ─────────────────────────────────────────────────────────

const COMPARE_ROWS = [
  { label: 'Cost', vals: ['$100/yr', '$79.99/yr', 'Free to start'] },
  { label: 'Satellite layers + topo', vals: [true, true, true] },
  { label: 'AI terrain analysis', vals: [false, false, true] },
  { label: 'Tells you WHERE to hang your stand', vals: [false, false, true] },
  { label: 'Explains the reasoning', vals: [false, false, true] },
  { label: 'Conversational — asks it anything', vals: [false, false, true] },
  { label: 'No account required to try', vals: [false, false, true] },
]

function ComparisonTable() {
  return (
    <section id="comparison" className="py-28 px-6" style={{ background: '#1E2122' }}>
      <div className="max-w-4xl mx-auto">
        <FadeIn className="text-center mb-16">
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.accent }}>Head to Head</div>
          <h2 className="font-display text-6xl md:text-7xl text-white uppercase tracking-tight">
            Maps are not enough.
            <br />
            <span style={{ color: C.muted, fontSize: '0.85em' }}>You need answers.</span>
          </h2>
        </FadeIn>

        <FadeIn>
          <div className="overflow-x-auto">
          <div className="rounded-2xl overflow-hidden min-w-[520px]" style={{ border: `1px solid ${C.border}` }}>
            {/* Header */}
            <div className="grid grid-cols-4" style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}>
              <div className="p-5" />
              {['onX Hunt', 'Spartan Forge', 'BuckGrid Pro'].map((col, i) => (
                <div
                  key={col}
                  className="p-5 text-center"
                  style={{
                    borderLeft: `1px solid ${C.border}`,
                    background: i === 2 ? 'rgba(107,122,87,0.05)' : 'transparent',
                    borderTop: i === 2 ? `2px solid ${C.accent}` : 'none',
                  }}
                >
                  <div
                    className="text-sm font-bold"
                    style={{ color: i === 2 ? C.accent : '#fff' }}
                  >
                    {col}
                  </div>
                  {i === 2 && (
                    <div className="text-xs mt-1 font-semibold" style={{ color: C.green }}>Recommended</div>
                  )}
                </div>
              ))}
            </div>
            {/* Rows */}
            {COMPARE_ROWS.map((row, ri) => (
              <div
                key={row.label}
                className="grid grid-cols-4"
                style={{
                  borderBottom: ri < COMPARE_ROWS.length - 1 ? `1px solid ${C.border}` : 'none',
                  background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}
              >
                <div className="p-4 pl-5 text-sm font-medium" style={{ color: C.text }}>{row.label}</div>
                {row.vals.map((val, vi) => (
                  <div
                    key={vi}
                    className="p-4 flex items-center justify-center text-sm text-center"
                    style={{
                      borderLeft: `1px solid ${C.border}`,
                      background: vi === 2 ? 'rgba(107,122,87,0.03)' : 'transparent',
                    }}
                  >
                    {typeof val === 'boolean' ? (
                      val ? (
                        <span style={{ color: vi === 2 ? C.accent : C.green }}><IconCheck /></span>
                      ) : (
                        <span style={{ color: '#3a3a3a' }}><IconX /></span>
                      )
                    ) : (
                      <span style={{ color: vi === 2 ? C.accent : C.muted, fontWeight: vi === 2 ? 700 : 400 }}>
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

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    sub: 'forever',
    features: ['1 property analysis', 'Satellite map view', 'Basic drawing tools', 'Tony AI response'],
    cta: 'Start Free',
    highlight: false,
    href: '/buckgrid',
  },
  {
    name: 'Pro',
    price: '$29',
    sub: 'per month',
    features: ['Unlimited analyses', 'All drawing tools', 'Seasonal strategy updates', 'Save & export maps', 'Priority Tony AI', 'Email support'],
    cta: 'Join Pro Waitlist →',
    highlight: true,
    href: 'mailto:bo@neuradexai.com?subject=BuckGrid Pro Waitlist&body=I want to join the Pro waitlist.',
  },
  {
    name: 'Elite',
    price: '$249',
    sub: 'per year',
    features: ['Everything in Pro', '2 months free vs monthly', 'Early feature access', 'Dedicated onboarding call', 'White-label reports'],
    cta: 'Join Elite Waitlist →',
    highlight: false,
    href: 'mailto:bo@neuradexai.com?subject=BuckGrid Elite Waitlist&body=I want to join the Elite waitlist.',
  },
]

function Pricing() {
  return (
    <section id="pricing" className="py-28 px-6" style={{ background: C.bg }}>
      <div className="max-w-5xl mx-auto">
        <FadeIn className="text-center mb-16">
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.accent }}>Pricing</div>
          <h2 className="font-display text-5xl md:text-6xl text-white uppercase tracking-tight">
            Less than a bag of seed.
            <br />
            <span style={{ color: C.muted, fontSize: '0.85em' }}>More valuable than a consultant.</span>
          </h2>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {PLANS.map((plan, i) => (
            <FadeIn key={plan.name} delay={i * 0.1}>
              <div
                className="relative p-8 rounded-2xl flex flex-col h-full transition-all"
                style={{
                  background: plan.highlight ? `linear-gradient(160deg, rgba(107,122,87,0.08) 0%, ${C.card} 100%)` : C.card,
                  border: plan.highlight ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
                  boxShadow: plan.highlight ? `0 0 50px -15px rgba(107,122,87,0.25)` : 'none',
                }}
              >
                {plan.highlight && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white"
                    style={{ background: C.accent }}
                  >
                    Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: plan.highlight ? C.accent : C.muted }}>
                    {plan.name}
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="font-display text-5xl text-white">{plan.price}</span>
                    <span className="text-sm mb-2" style={{ color: C.muted }}>/{plan.sub}</span>
                  </div>
                </div>
                <ul className="flex-1 space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm" style={{ color: C.text }}>
                      <span className="mt-0.5 flex-shrink-0" style={{ color: C.green }}><IconCheck /></span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className="block text-center py-3.5 px-6 rounded-xl font-bold text-sm transition-all hover:opacity-90 hover:scale-105 active:scale-100"
                  style={{
                    background: plan.highlight ? 'linear-gradient(135deg, #6B7A57, #4A543D)' : 'transparent',
                    color: plan.highlight ? '#0C0F0A' : C.text,
                    border: plan.highlight ? 'none' : `1px solid ${C.border}`,
                  }}
                >
                  {plan.cta}
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn>
          <p className="text-center text-sm" style={{ color: C.muted }}>
            Free tier available forever. Pro & Elite on early-access waitlist — join now.
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
    a: 'Tony uses Gemini Vision AI to actually read your satellite map — the same way a consultant would look at your property from the air. The more features you draw, the more specific his recommendations become.',
  },
  {
    q: 'Does Tony replace a real habitat consultant?',
    a: 'For most hunters on properties under 500 acres, Tony is genuinely better — he\'s available 24/7, costs a fraction of the price, and improves every season. For multi-thousand-acre commercial operations, Tony is an excellent complement.',
  },
  {
    q: 'What\'s the difference between Free and Pro?',
    a: 'Free gives you one complete analysis so you can see exactly what Tony does. Pro unlocks unlimited analyses, seasonal updates, the ability to save and export your maps, and priority Tony AI responses.',
  },
  {
    q: 'Is my property data private?',
    a: 'Yes. Your maps and property data are stored securely and never shared with third parties. Your land layout is not used to train any AI models.',
  },
  {
    q: 'What if I don\'t know what I\'m doing with habitat?',
    a: 'That\'s exactly who Tony is built for. You don\'t need any habitat knowledge — just draw what you see on your map and Tony explains everything in plain English with clear, specific steps.',
  },
]

function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  return (
    <section id="faq" className="py-28 px-6" style={{ background: '#1E2122' }}>
      <div className="max-w-2xl mx-auto">
        <FadeIn className="text-center mb-14">
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.accent }}>FAQ</div>
          <h2 className="font-display text-5xl md:text-6xl text-white uppercase tracking-tight">
            Questions answered
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
                  background: openIdx === i ? C.card : 'rgba(26,30,41,0.5)',
                  border: `1px solid ${openIdx === i ? 'rgba(107,122,87,0.2)' : C.border}`,
                  borderLeft: openIdx === i ? '3px solid #6B7A57' : `1px solid ${C.border}`,
                }}
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenIdx(openIdx === i ? null : i) } }}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-base font-semibold text-white">{faq.q}</span>
                  <span style={{ color: C.muted, flexShrink: 0 }}>
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
                      <p className="text-sm leading-relaxed pt-4" style={{ color: C.muted }}>
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
    <section className="py-32 px-6 relative overflow-hidden" style={{ background: C.bg }}>
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(107,122,87,0.07) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(107,122,87,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(107,122,87,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>
      <div className="relative max-w-3xl mx-auto text-center">
        <FadeIn>
          <div className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: C.accent }}>Ready?</div>
          <h2 className="font-display text-6xl md:text-8xl text-white uppercase tracking-tight leading-none mb-6">
            Your best hunting spots are on your map
            <br />
            <span style={{ color: C.accent }}>right now.</span>
          </h2>
          <p className="text-lg mb-10" style={{ color: C.muted }}>
            Tony will find them in under 60 seconds. Start free — no credit card required.
          </p>
          <Link
            href="/buckgrid"
            className="inline-flex items-center gap-3 px-10 py-5 rounded-xl font-bold text-white text-lg transition-all hover:scale-105 hover:-translate-y-1 active:scale-100"
            style={{
              background: 'linear-gradient(135deg, #6B7A57, #4A543D)',
              color: '#0C0F0A',
              boxShadow: `0 16px 40px -8px rgba(107,122,87,0.45)`,
            }}
          >
            Analyze My Land Free
            <span>→</span>
          </Link>
          <p className="text-xs mt-6" style={{ color: C.muted }}>
            No credit card required · 30-day money-back guarantee
          </p>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ background: C.card, borderTop: `1px solid ${C.border}` }}>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #1e2a18, #2a3820)',
                  border: `1px solid rgba(107,122,87,0.35)`,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="5" stroke="#6B7A57" strokeWidth="1.2" />
                  <circle cx="8" cy="8" r="1.5" fill="#6B7A57" />
                  <line x1="8" y1="1" x2="8" y2="4.5" stroke="#6B7A57" strokeWidth="1.2" />
                  <line x1="8" y1="11.5" x2="8" y2="15" stroke="#6B7A57" strokeWidth="1.2" />
                  <line x1="1" y1="8" x2="4.5" y2="8" stroke="#6B7A57" strokeWidth="1.2" />
                  <line x1="11.5" y1="8" x2="15" y2="8" stroke="#6B7A57" strokeWidth="1.2" />
                </svg>
              </div>
              <span className="font-bold text-white">
                BuckGrid <span style={{ color: C.accent }}>Pro</span>
              </span>
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: C.muted }}>
              Precision habitat intelligence for serious hunters.
            </p>
            <p className="text-sm max-w-xs" style={{ color: C.muted }}>
              Expert AI advice 24/7 for less than a tank of gas.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {[
              { label: 'App', href: '/buckgrid' },
              { label: 'Pricing', href: '#pricing' },
              { label: 'How It Works', href: '#how-it-works' },
              { label: 'Privacy', href: '#' },
              { label: 'Terms', href: '#' },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm transition-colors hover:text-white"
                style={{ color: C.muted }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${C.border}` }} className="mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs" style={{ color: C.muted }}>
            &copy; {new Date().getFullYear()} BuckGrid Pro. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: C.muted }}>
            Powered by <span style={{ color: C.accent }}>Tony AI</span> · Built by Neuradex AI
          </p>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="min-h-screen font-sans" style={{ background: C.bg, color: C.text }}>
      <Nav />
      <Hero />
      <TrustBar />
      <HowItWorks />
      <Testimonials />
      <Features />
      <ComparisonTable />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  )
}
