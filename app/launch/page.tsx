import type { Metadata } from 'next'
import { HUD, FONT, rgba } from '@/components/buckgrid/hud/tokens'
import { CornerFrame, Wordmark, PhaseChip, AcrePill, GamePlanLabel, ZoneCard, ReadingPill } from '@/components/buckgrid/hud/Hud'

export const metadata: Metadata = {
  title: 'BuckGrid Pro — Decisions, Not Maps',
  description: 'You know your land. Tony knows deer. Draw your property, talk to Tony, get the whole game plan drawn on your map — terrain-math backed, not an LLM guess.',
}

// Server component — uses the shared HUD chrome ('use client' children compose fine).
export default function Launch() {
  const BG = `radial-gradient(1200px 700px at 50% -10%, ${rgba(HUD.spruce, 1)}, ${rgba(HUD.bark, 1)} 60%, #07120C 100%)`
  return (
    <main style={{ minHeight: '100vh', background: BG, color: HUD.bone, fontFamily: FONT.body, position: 'relative', overflow: 'hidden' }}>
      {/* faint topo grid */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${rgba(HUD.antler, 0.05)} 1px, transparent 1px), linear-gradient(90deg, ${rgba(HUD.antler, 0.05)} 1px, transparent 1px)`, backgroundSize: '64px 64px', pointerEvents: 'none' }} />
      <CornerFrame inset={16} len={42} weight={2} />

      <div style={{ position: 'relative', zIndex: 10, maxWidth: 1180, margin: '0 auto', padding: 'clamp(20px,4vw,40px)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: `1px solid ${rgba(HUD.field, 0.7)}`, paddingBottom: 16 }}>
          <Wordmark size={30} />
          <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: '.18em', color: HUD.sage }}>FIELD INTELLIGENCE SYSTEM</div>
          <PhaseChip text="RUT // PEAK" />
        </div>

        {/* HERO */}
        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,0.9fr)', gap: 'clamp(20px,4vw,48px)', alignItems: 'center', padding: 'clamp(28px,5vw,64px) 0' }} className="bg-hero-grid">
          <div>
            <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: '.3em', color: HUD.ember, marginBottom: 18 }}>THE TRUTH NOBODY TELLS YOU</div>
            <h1 style={{ fontFamily: FONT.display, fontWeight: 900, fontSize: 'clamp(40px,7vw,92px)', lineHeight: 0.95, letterSpacing: '.01em', margin: 0, textTransform: 'uppercase' }}>
              Maps show you the land.<br />
              <span style={{ color: HUD.sage }}>Forecasts show you when.</span><br />
              Nobody shows you <span style={{ color: HUD.blaze }}>where to sit.</span>
            </h1>
            <p style={{ fontFamily: FONT.body, fontSize: 'clamp(16px,2vw,20px)', color: rgba(HUD.bone, 0.78), maxWidth: 540, marginTop: 22, lineHeight: 1.5 }}>
              You know your land — every ridge, every trail, every honey hole. BuckGrid Pro draws the whole plan
              on your map: sanctuary, bedding, food, and the stand to hunt on tonight&apos;s wind.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 30, alignItems: 'center' }}>
              <a href="/buckgrid" style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 15, letterSpacing: '.06em', color: HUD.bone, background: HUD.blaze, borderRadius: 10, padding: '15px 28px', textDecoration: 'none', boxShadow: `0 6px 28px ${rgba(HUD.blaze, 0.35)}` }}>
                FIRST MAP FREE · NO CARD
              </a>
              <a href="#how" style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 13, letterSpacing: '.1em', color: HUD.bone, border: `1.5px solid ${rgba(HUD.bone, 0.3)}`, borderRadius: 10, padding: '14px 22px', textDecoration: 'none' }}>
                SEE HOW IT WORKS
              </a>
            </div>
          </div>

          {/* HUD map card (SVG parcel evoking the ad) */}
          <HeroMapCard />
        </section>

        {/* 3 STEPS */}
        <section id="how" style={{ padding: 'clamp(24px,4vw,48px) 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
            {[
              ['①', 'DRAW YOUR LAND', 'Trace your property line. Thirty seconds, no account.'],
              ['②', 'TALK TO TONY', 'Your AI habitat consultant reads cover, water, wind, and terrain.'],
              ['③', 'GET THE GAME PLAN', 'Sanctuary, bedding, food, and stands — drawn right on your map.'],
            ].map(([n, t, s]) => (
              <div key={t} style={{ background: HUD.panelGlass, border: `1.4px solid ${rgba(HUD.field, 0.9)}`, borderRadius: 14, padding: '20px 22px' }}>
                <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 28, color: HUD.ember }}>{n}</div>
                <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 22, letterSpacing: '.04em', marginTop: 8 }}>{t}</div>
                <div style={{ fontFamily: FONT.body, fontSize: 15, color: rgba(HUD.bone, 0.7), marginTop: 8, lineHeight: 1.5 }}>{s}</div>
              </div>
            ))}
          </div>
        </section>

        {/* PROOF CARD */}
        <section style={{ padding: 'clamp(20px,4vw,40px) 0' }}>
          <div style={{ position: 'relative', background: rgba(HUD.panel, 0.95), border: `2px solid ${rgba(HUD.blaze, 0.9)}`, borderRadius: 18, padding: 'clamp(20px,3vw,34px)', overflow: 'hidden', maxWidth: 720 }}>
            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, background: HUD.blaze }} />
            <div style={{ fontFamily: FONT.display, fontWeight: 900, fontSize: 'clamp(30px,4vw,52px)', letterSpacing: '.02em' }}>STAND · NE</div>
            <div style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 13, letterSpacing: '.2em', color: HUD.sage, marginTop: 10 }}>CONFIDENCE</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <div style={{ flex: 1, height: 16, borderRadius: 8, background: rgba(HUD.field, 0.85), overflow: 'hidden' }}>
                <div style={{ width: '87%', height: '100%', background: HUD.blaze, borderRadius: 8 }} />
              </div>
              <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 18 }}>0.87</span>
            </div>
            {['High ground, downwind of the bedding.', 'Covers the timber-to-plot funnel.', 'Clean entry from the south road.'].map(l => (
              <div key={l} style={{ fontFamily: FONT.body, fontWeight: 600, fontSize: 16, color: rgba(HUD.bone, 0.92), marginTop: 12 }}>{l}</div>
            ))}
            <div style={{ borderTop: `1px solid ${rgba(HUD.field, 0.8)}`, marginTop: 20, paddingTop: 14, fontFamily: FONT.mono, fontWeight: 700, fontSize: 12, letterSpacing: '.1em', color: HUD.ember }}>
              TERRAIN-MATH BACKED · BOUNDARY-GUARANTEED · NOT AN LLM GUESS
            </div>
          </div>
        </section>

        {/* PAYOFF */}
        <section style={{ textAlign: 'center', padding: 'clamp(40px,7vw,90px) 0 40px' }}>
          <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 'clamp(22px,3vw,40px)', letterSpacing: '.04em', color: rgba(HUD.bone, 0.92) }}>
            YOU KNOW YOUR LAND. <span style={{ color: HUD.ember }}>TONY KNOWS DEER.</span>
          </div>
          <div style={{ fontFamily: FONT.display, fontWeight: 900, fontSize: 'clamp(48px,10vw,150px)', lineHeight: 0.92, letterSpacing: '.01em', marginTop: 18, textTransform: 'uppercase' }}>
            Decisions,<br /><span style={{ color: HUD.blaze }}>not maps.</span>
          </div>
          <a href="/buckgrid" style={{ display: 'inline-block', marginTop: 34, fontFamily: FONT.mono, fontWeight: 700, fontSize: 16, letterSpacing: '.06em', color: HUD.bone, background: HUD.blaze, borderRadius: 12, padding: '17px 34px', textDecoration: 'none', boxShadow: `0 6px 28px ${rgba(HUD.blaze, 0.35)}` }}>
            DRAW YOUR FIRST MAP — FREE
          </a>
        </section>
      </div>

      {/* mobile: stack hero */}
      <style>{`@media (max-width: 860px){ .bg-hero-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </main>
  )
}

// SVG parcel hero card — stylized to evoke the ad without the real map engine.
function HeroMapCard() {
  const parcel = '120,90 230,72 330,84 360,180 330,300 200,330 96,270 78,160'
  return (
    <div style={{ position: 'relative', background: `linear-gradient(160deg, ${HUD.spruce}, ${HUD.bark})`, border: `1px solid ${rgba(HUD.field, 0.9)}`, borderRadius: 18, padding: 18, minHeight: 380, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <GamePlanLabel count={5} />
        <AcrePill acres={247.3} size={18} />
      </div>
      <div style={{ position: 'relative', marginTop: 10 }}>
        <svg viewBox="0 0 440 360" style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* terrain mottle */}
          <defs>
            <radialGradient id="terr" cx="45%" cy="40%"><stop offset="0%" stopColor="#3a5a40" /><stop offset="100%" stopColor="#1d3326" /></radialGradient>
            <filter id="glow"><feGaussianBlur stdDeviation="4" /></filter>
          </defs>
          <polygon points={parcel} fill="url(#terr)" opacity="0.95" />
          {/* creek */}
          <path d="M150,300 C170,250 150,210 190,180 C220,158 210,120 250,96" fill="none" stroke={rgba(HUD.steel, 0.8)} strokeWidth="5" strokeLinecap="round" />
          {/* sanctuary */}
          <polygon points="96,210 170,196 210,250 196,300 130,316 100,270" fill={rgba(HUD.sanctuary, 0.32)} stroke={HUD.sanctuary} strokeWidth="2" />
          {/* food plot */}
          <rect x="250" y="120" width="70" height="48" rx="8" fill={rgba(HUD.foodPlot, 0.45)} stroke={HUD.foodPlot} strokeWidth="2.5" />
          {/* boundary glow + line */}
          <polygon points={parcel} fill="none" stroke={rgba(HUD.ember, 0.5)} strokeWidth="9" filter="url(#glow)" />
          <polygon points={parcel} fill="none" stroke={HUD.bone} strokeWidth="2.5" />
          {parcel.split(' ').map((p, i) => { const [x, y] = p.split(',').map(Number); return <circle key={i} cx={x} cy={y} r="3.4" fill={HUD.bone} /> })}
          {/* stand pins */}
          <g><circle cx="300" cy="150" r="9" fill={HUD.stand} stroke={HUD.bone} strokeWidth="2" /><polygon points="293,156 307,156 300,172" fill={HUD.stand} /></g>
          <g><circle cx="250" cy="250" r="9" fill={HUD.stand} stroke={HUD.bone} strokeWidth="2" /><polygon points="243,256 257,256 250,272" fill={HUD.stand} /></g>
        </svg>
        <div style={{ position: 'absolute', left: 6, bottom: 6, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 200 }}>
          <ZoneCard type="sanctuary" sub="52 AC · NO ENTRY" />
          <ZoneCard type="stand_site" title="STAND · NE" sub="CONF 0.87" score={87} />
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
        <ReadingPill name="CEDAR HOLLOW" />
      </div>
    </div>
  )
}
