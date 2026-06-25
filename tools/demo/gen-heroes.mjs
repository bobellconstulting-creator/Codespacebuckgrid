// Generator → lib/demo/hero-properties.ts
// Terrain (elevationSamples) + wind rose are REAL (USGS/AWS 3DEP + Open-Meteo,
// captured from /api/spatial). Cover is classified from the REAL Esri World
// Imagery by local canopy texture (timber = high-variance bumpy canopy, crop/
// grass = smooth low-variance), then majority-smoothed into coherent blocks.
// Section-line road + pond traced from the same imagery. The deterministic
// placement engine runs on this unmodified — no API keys, no network at runtime.
import fs from 'fs'

const davis = JSON.parse(fs.readFileSync('tools/demo/spatial-davis.json', 'utf8'))
const vanburen = JSON.parse(fs.readFileSync('tools/demo/spatial-vanburen.json', 'utf8'))

const HEROES = [
  {
    id: 'cedar-hollow', name: 'Cedar Hollow', locationLabel: 'Davis County, Iowa',
    season: 'Pre-Rut (Late Oct)',
    bbox: { west: -92.521, south: 40.6885, east: -92.5105, north: 40.6953 },
    spatial: davis,
    blurb: 'A timbered creek bottom forking through row-crop country — the kind of edge a mature buck never leaves in daylight.',
    ring: [[0.07,0.14],[0.34,0.07],[0.58,0.06],[0.80,0.15],[0.93,0.40],[0.90,0.66],[0.74,0.86],[0.50,0.93],[0.27,0.88],[0.12,0.70],[0.05,0.42],[0.07,0.14]],
    road: { name: 'Gravel section road', pts: [[-0.03,0.985],[1.03,0.985]] },
    ponds: [{ name: 'Bottom pond', frac: [[0.07,0.80],[0.15,0.80],[0.15,0.86],[0.07,0.86]] }],
  },
  {
    id: 'timberedge', name: 'Timberedge', locationLabel: 'Van Buren County, Iowa',
    season: 'Rut (Early Nov)',
    bbox: { west: -91.870, south: 40.770, east: -91.8595, north: 40.7768 },
    spatial: vanburen,
    blurb: 'A big-timber block tight against standing crops with a pond on the seam — a classic Des Moines River-hills rut setup.',
    ring: [[0.06,0.12],[0.40,0.07],[0.66,0.09],[0.88,0.22],[0.94,0.50],[0.86,0.78],[0.66,0.92],[0.40,0.93],[0.18,0.82],[0.05,0.52],[0.06,0.12]],
    road: { name: 'Field lane', pts: [[0.08,0.57],[0.22,0.55],[0.34,0.50],[0.46,0.45],[0.57,0.38],[0.66,0.27],[0.74,0.18]] },
    ponds: [{ name: 'Seam pond', frac: [[0.25,0.58],[0.37,0.58],[0.37,0.67],[0.25,0.67]] }],
  },
]

const toLngLat = (b, [x, y]) => [
  +(b.west + x * (b.east - b.west)).toFixed(6),
  +(b.north - y * (b.north - b.south)).toFixed(6),
]
const ringAcres = (ring, latMid) => {
  const mLat = 111320, mLng = 111320 * Math.cos((latMid*Math.PI)/180)
  let a = 0
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) a += ring[j][0]*mLng*(ring[i][1]*mLat) - ring[i][0]*mLng*(ring[j][1]*mLat)
  return Math.abs(a/2)/4046.86
}

async function fetchBMP(b, size=768){
  const url='https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export'+
    `?bbox=${b.west},${b.south},${b.east},${b.north}&bboxSR=4326&imageSR=4326&size=${size},${size}&format=bmp&f=image`
  const r=await fetch(url); if(!r.ok) throw new Error('bmp '+r.status); return new Uint8Array(await r.arrayBuffer())
}
function decodeBMP(data){
  const u32=(o)=>data[o]|(data[o+1]<<8)|(data[o+2]<<16)|(data[o+3]<<24)
  const pixelOffset=u32(10),biWidth=u32(18),biHeightRaw=u32(22)
  const height=Math.abs(biHeightRaw),topDown=biHeightRaw<0
  const bpp=data[28]|(data[29]<<8),bytesPerPx=bpp/8,rowStride=(biWidth*bytesPerPx+3)&~3
  return { w:biWidth,h:height, at(col,rowFromNorth){ const srcY=topDown?rowFromNorth:(height-1-rowFromNorth); const p=pixelOffset+srcY*rowStride+col*bytesPerPx; return {b:data[p],g:data[p+1],r:data[p+2]} } }
}
const lum=(p)=>0.299*p.r+0.587*p.g+0.114*p.b

// Build a GRID×GRID timber mask (1=timber) from imagery texture, row 0 = NORTH.
async function timberMaskNorthTop(bbox, GRID=64){
  const bmp = decodeBMP(await fetchBMP(bbox, 768))
  const cells = []
  for (let r=0;r<GRID;r++){ const row=[]; for(let c=0;c<GRID;c++){
    const x0=Math.floor(c/GRID*bmp.w),x1=Math.floor((c+1)/GRID*bmp.w)
    const y0=Math.floor(r/GRID*bmp.h),y1=Math.floor((r+1)/GRID*bmp.h)
    let s=0,s2=0,n=0,R=0,Gc=0,B=0
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){ const p=bmp.at(x,y); const L=lum(p); s+=L;s2+=L*L;n++;R+=p.r;Gc+=p.g;B+=p.b }
    const mean=s/n, sd=Math.sqrt(Math.max(0,s2/n-mean*mean))
    row.push({sd,mean,R:R/n,G:Gc/n,B:B/n})
  } cells.push(row) }
  const allsd=cells.flat().map(c=>c.sd).sort((a,b)=>a-b)
  const med=allsd[allsd.length>>1]
  const SD_T=Math.max(9, med*0.95)
  let mask=[]
  for(let r=0;r<GRID;r++){ const row=new Uint8Array(GRID); for(let c=0;c<GRID;c++){ const cell=cells[r][c]
    const exg=2*cell.G-cell.R-cell.B
    row[c]=(cell.sd>=SD_T && exg>2)?1:0
  } mask.push(row) }
  // majority smoothing ×3 → coherent blocks, remove speckle
  for(let it=0; it<3; it++){
    const next=mask.map(r=>Uint8Array.from(r))
    for(let r=0;r<GRID;r++)for(let c=0;c<GRID;c++){
      let sum=0,cnt=0
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){ const rr=r+dr,cc=c+dc; if(rr<0||cc<0||rr>=GRID||cc>=GRID)continue; sum+=mask[rr][cc];cnt++ }
      next[r][c] = (sum/cnt) >= 0.5 ? 1 : 0
    }
    mask=next
  }
  return { mask, GRID, timberPct: Math.round(100*mask.flat().reduce((a,b)=>a+b,0)/(GRID*GRID)) }
}

const packBits=(arr)=>{ const bytes=new Uint8Array(Math.ceil(arr.length/8)); for(let i=0;i<arr.length;i++) if(arr[i]) bytes[i>>3]|=1<<(i&7); return Buffer.from(bytes).toString('base64') }

function asciiCheck(name, mask, GRID, ring){
  // render mask (north top) with the ring overlaid
  console.log('\n--- '+name+' timber mask (north top, # timber . open) ---')
  for(let r=0;r<GRID;r+=GRID/40|0){ let line=''; for(let c=0;c<GRID;c+=GRID/48|0){ line += mask[r][c]?'#':'.' } console.log(line) }
}

async function buildHero(h){
  const b=h.bbox, latMid=(b.north+b.south)/2
  const ring=h.ring.map(p=>toLngLat(b,p))
  const acres=ringAcres(ring,latMid)
  const center={lat:latMid,lng:(b.west+b.east)/2}

  const osm=[]
  if(h.road){ const geom=h.road.pts.map(p=>toLngLat(b,p)); let mw=Infinity,ms=Infinity,me=-Infinity,mn=-Infinity; for(const[x,y]of geom){mw=Math.min(mw,x);me=Math.max(me,x);ms=Math.min(ms,y);mn=Math.max(mn,y)} osm.push({kind:'road',name:h.road.name,point:[(mw+me)/2,(ms+mn)/2],bbox:[mw,ms,me,mn],geometry:geom,closed:false}) }
  for(const pond of h.ponds||[]){ const g=pond.frac.map(p=>toLngLat(b,p)); g.push(g[0]); let mw=Infinity,ms=Infinity,me=-Infinity,mn=-Infinity; for(const[x,y]of g){mw=Math.min(mw,x);me=Math.max(me,x);ms=Math.min(ms,y);mn=Math.max(mn,y)} osm.push({kind:'water',name:pond.name,point:[(mw+me)/2,(ms+mn)/2],bbox:[mw,ms,me,mn],geometry:g,closed:true}) }

  const sp=h.spatial
  const elevationSamples=sp.elevationSamples.map(s=>({lat:+s.lat.toFixed(6),lng:+s.lng.toFixed(6),elevationM:+s.elevationM.toFixed(1)}))

  const { mask, GRID, timberPct } = await timberMaskNorthTop(b, 64)
  asciiCheck(h.name, mask, GRID, ring)
  // canopy row 0 must be SOUTH (engine contract) → flip vertically
  const canopy=new Uint8Array(GRID*GRID)
  for(let r=0;r<GRID;r++)for(let c=0;c<GRID;c++){ canopy[(GRID-1-r)*GRID+c]=mask[r][c] }
  const canopyB64=packBits(canopy)

  return {
    id:h.id,name:h.name,locationLabel:h.locationLabel,season:h.season,blurb:h.blurb,
    acres:Math.round(acres),timberPct,center,boundaryRing:ring,osm,
    elevationSummary:sp.elevationSummary,elevationSamples,
    highGroundPoints:sp.highGroundPoints||[],lowGroundPoints:sp.lowGroundPoints||[],
    windDirection:sp.windDirection,windRose:sp.windRose,
    canopy:{west:b.west,south:b.south,east:b.east,north:b.north,rows:GRID,cols:GRID,b64:canopyB64},
  }
}

const heroes=[]
for(const h of HEROES) heroes.push(await buildHero(h))
console.log('')
for(const h of heroes) console.log(`${h.name}: ${h.acres}ac · timber ${h.timberPct}% · ${h.elevationSamples.length} elev · wind ${h.windDirection} · osm ${h.osm.length}`)

const ts=`// lib/demo/hero-properties.ts
// AUTO-GENERATED by tools/gen-heroes (do not hand-edit).
//
// Each hero is a REAL Midwest whitetail parcel. elevationSamples are real
// USGS/AWS 3DEP elevation and windRose is the real Open-Meteo climatology for
// the location (both captured from the live /api/spatial pipeline). Cover is
// classified from the real Esri World Imagery by canopy texture (timber =
// high-variance bumpy canopy vs smooth crop/grass), majority-smoothed into
// coherent blocks. The section-line road + pond are traced from the same
// imagery. The deterministic placement engine runs on this unmodified.

import type { SpatialContext, OsmFeature } from '../spatial'

export interface HeroProperty {
  id: string
  name: string
  locationLabel: string
  acresLabel: string
  season: string
  blurb: string
  center: { lat: number; lng: number }
  boundaryRing: [number, number][]
  spatial: SpatialContext
}

function unpackCanopy(b64: string, n: number): Uint8Array {
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary')
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) out[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RAW: any[] = ${JSON.stringify(heroes)}

export const HERO_PROPERTIES: HeroProperty[] = RAW.map((h) => {
  const cg = h.canopy
  const spatial: SpatialContext = {
    osmFeatures: h.osm as unknown as OsmFeature[],
    elevationSummary: h.elevationSummary,
    elevationSamples: h.elevationSamples as { lat: number; lng: number; elevationM: number }[],
    highGroundPoints: h.highGroundPoints as { lat: number; lng: number; elevationM: number }[],
    lowGroundPoints: h.lowGroundPoints as { lat: number; lng: number; elevationM: number }[],
    windDirection: h.windDirection,
    fetchedAt: 0,
    windRose: h.windRose as SpatialContext['windRose'],
    canopyGrid: {
      west: cg.west, south: cg.south, east: cg.east, north: cg.north,
      rows: cg.rows, cols: cg.cols,
      canopy: unpackCanopy(cg.b64, cg.rows * cg.cols),
    },
  }
  return {
    id: h.id, name: h.name, locationLabel: h.locationLabel,
    acresLabel: \`~\${h.acres} ac\`, season: h.season, blurb: h.blurb,
    center: h.center, boundaryRing: h.boundaryRing as [number, number][], spatial,
  }
})

export const DEFAULT_HERO_ID = HERO_PROPERTIES[0].id
`
fs.writeFileSync('lib/demo/hero-properties.ts', ts)
console.log('\nwrote lib/demo/hero-properties.ts ('+(ts.length/1024).toFixed(0)+' KB)')
