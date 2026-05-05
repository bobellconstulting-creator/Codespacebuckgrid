// BuckGrid Agri — landing + pilot page for the agriculture pivot.
//
// Not deployed yet. Minimal scaffold so the route exists and can be linked
// from marketing copy / Marcus prospect outreach. Full UI (map, drawing
// tools, PDF export) lands after pilot conversations confirm the pitch.

import Link from 'next/link'

export const metadata = {
  title: 'BuckGrid Agri — AI Land Consultant for Farms and Land Trusts',
  description:
    'The same satellite + soil + terrain AI that powers BuckGrid Pro, reframed for row-crop, hay/grazing, orchard, and conservation planning. Built for farmers, crop consultants, and land trusts.',
}

interface PillarProps {
  title: string
  body: string
}

function Pillar({ title, body }: PillarProps): JSX.Element {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-neutral-300">{body}</p>
    </div>
  )
}

export default function AgriPage(): JSX.Element {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto max-w-4xl px-6 pt-24 pb-16">
        <p className="text-xs uppercase tracking-widest text-cyan-400">BuckGrid Agri — pilot</p>
        <h1 className="mt-3 text-4xl font-bold leading-tight md:text-5xl">
          Your land, analyzed by an AI that actually sees the ground.
        </h1>
        <p className="mt-6 text-lg text-neutral-300">
          We already built the engine. It reads real satellite imagery, SSURGO soils,
          NLCD land cover, wetland maps, and slope/aspect — for a specific parcel, not
          a county average. Hunters use it as Tony AI. Farmers, crop consultants, and
          land trusts use this.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Pillar
            title="Row crop or hay?"
            body="Slope, soil capability, erosion risk, water access, and current land cover scored for row crop, hay/grazing, orchard, and conservation — per parcel."
          />
          <Pillar
            title="Real data, not generic advice"
            body="SSURGO soil series with capability class. NLCD cover percentages. OSM streams and ponds. NWI wetlands. Elevation-derived slope and aspect."
          />
          <Pillar
            title="For consultants, not just farmers"
            body="Crop consultants and land trusts use it to generate a defensible parcel report in under a minute. Wraps as a PDF with the client's name."
          />
          <Pillar
            title="Built on what works"
            body="Same spatial engine already shipping in BuckGrid Pro. Proven on deer-hunting land management since 2026. Agri uses every data layer except the deer model."
          />
        </div>

        <div className="mt-12 rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-6">
          <h2 className="text-xl font-semibold text-white">Pilot program — free for the first 5 consultants</h2>
          <p className="mt-2 text-sm text-neutral-300">
            We&apos;re offering 5 free parcel analyses (up to 500 acres each) to crop
            consultants, land trusts, or ag lenders. In exchange: a 20-minute call to
            tell us what output would actually be useful in your workflow.
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="mailto:bo@neuradexai.com?subject=BuckGrid%20Agri%20pilot"
              className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-black hover:bg-cyan-400"
            >
              Request a pilot
            </Link>
            <Link
              href="/buckgrid"
              className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 hover:border-neutral-500"
            >
              See the hunting version
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
