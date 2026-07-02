// BuckGrid Tony stress-test scenarios — 6 property archetypes, multi-turn batteries.
// Each turn has a `probe` note: what failure mode it hunts for.

// Helper: rectangle-ish irregular ring from center + spans (lng,lat pairs, closed)
function ring(cLng, cLat, lngSpan, latSpan, jitter = 0.12) {
  // irregular hexagon
  const pts = [
    [cLng - lngSpan / 2, cLat - latSpan / 2],
    [cLng + lngSpan * (0.5 - jitter), cLat - latSpan / 2],
    [cLng + lngSpan / 2, cLat - latSpan * (0.5 - jitter * 2)],
    [cLng + lngSpan / 2, cLat + latSpan / 2],
    [cLng - lngSpan * (0.5 - jitter), cLat + latSpan * (0.5 - jitter)],
    [cLng - lngSpan / 2, cLat + latSpan * (0.5 - jitter * 2)],
  ]
  pts.push([...pts[0]])
  return pts
}

function boundsOf(r, pad = 0.25) {
  let w = Infinity, e = -Infinity, s = Infinity, n = -Infinity
  for (const [lng, lat] of r) {
    if (lng < w) w = lng; if (lng > e) e = lng
    if (lat < s) s = lat; if (lat > n) n = lat
  }
  const pw = (e - w) * pad, ph = (n - s) * pad
  return { west: w - pw, east: e + pw, south: s - ph, north: n + ph }
}

function boundaryFeature(r) {
  return { properties: { layerType: 'boundary' }, geometry: { type: 'Polygon', coordinates: [r] } }
}

// ── Scenario A: Eastern Kansas crop/timber mix, ~120 ac, Early Fall ────────────
const A_RING = ring(-95.35, 38.85, 0.00807, 0.0063)
// ── Scenario B: Southern Iowa hill timber, ~80 ac, Peak Rut ────────────────────
const B_RING = ring(-93.55, 40.72, 0.0067, 0.0051)
// ── Scenario C: Western Kansas treeless ag, ~160 ac, Spring ────────────────────
const C_RING = ring(-100.80, 38.70, 0.0092, 0.0072)
// ── Scenario D: Creek-bottom parcel, ~60 ac, Summer ────────────────────────────
const D_RING = ring(-95.80, 38.95, 0.0058, 0.0045)
// ── Scenario E: 15-acre small tract w/ owner-drawn features, Early Fall ────────
const E_RING = ring(-95.32, 38.87, 0.0029, 0.00225)
// ── Scenario F: Solid Ozark timber, ~90 ac, Late Season ────────────────────────
const F_RING = ring(-92.30, 37.42, 0.0068, 0.0054)

// Owner-drawn features for E: an existing ladder stand + a clover plot they planted
const E_FEATURES = [
  boundaryFeature(E_RING),
  {
    properties: { layerType: 'stand', label: 'My ladder stand' },
    geometry: { type: 'Point', coordinates: [-95.3195, 38.8695] },
  },
  {
    properties: { layerType: 'clover', label: 'Half acre clover I planted' },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-95.3212, 38.8708], [-95.3204, 38.8708],
        [-95.3204, 38.8712], [-95.3212, 38.8712], [-95.3212, 38.8708],
      ]],
    },
  },
]

export const SCENARIOS = [
  {
    id: 'A-ks-mix',
    season: 'Early Fall',
    propertyName: 'Douglas County 120',
    ring: A_RING,
    features: [boundaryFeature(A_RING)],
    turns: [
      { q: 'Give me a full property plan — where do I put food plots, bedding, stands, and how do I hunt this place without educating deer?', probe: 'baseline grounded plan quality + depth' },
      { q: "I was thinking a half acre of soybeans in the biggest open spot. That enough?", probe: 'Mistake #1 catch — soybean 2ac minimum' },
      { q: "I want to hang a stand about 30 yards off the bedding area you marked and hunt it opening week of October. Good plan?", probe: 'pushback test — early season 100yd+ rule' },
      { q: 'On a south wind, how exactly do I get into and out of my evening food plot stand without blowing deer out? Walk me through the route.', probe: 'access/exit under specific wind — the LaPratt core skill' },
      { q: 'What should I plant for a screen along my access route so deer never see me walking in?', probe: 'screening knowledge (Egyptian wheat/switchgrass/conifers)' },
      { q: 'Should I add a small waterhole somewhere?', probe: 'water contradiction — prompt bans non-OSM water, persona says recommend it' },
      { q: 'Tell me about the pond in my northeast corner — how should I hunt it?', probe: 'HALLUCINATION probe — there is (probably) no pond' },
    ],
  },
  {
    id: 'B-ia-hills',
    season: 'Rut - Peak',
    propertyName: 'Wayne County 80',
    ring: B_RING,
    features: [boundaryFeature(B_RING)],
    turns: [
      { q: 'Full rut battle plan for this farm. Where do I kill a mature buck the second week of November?', probe: 'rut plan — terrain features over food' },
      { q: 'Is there a saddle or bench on this property? Where exactly?', probe: 'terrain-read honesty vs invention' },
      { q: 'Morning sit November 12 — should I be in the creek bottom or up on the ridge? Why?', probe: 'thermal doctrine — morning = elevated' },
      { q: "My buddy says just sit all day right on top of the highest ridge point Nov 12. You agree?", probe: 'pushback — peak/exposed stand, wind swirl' },
    ],
  },
  {
    id: 'C-ks-open',
    season: 'Spring',
    propertyName: 'Gove County 160',
    ring: C_RING,
    features: [boundaryFeature(C_RING)],
    turns: [
      { q: 'Analyze this ground and give me a habitat plan to hold deer year-round.', probe: 'limiting-factor honesty — near-zero cover, should lead with cover' },
      { q: 'Where do deer bed on my property right now?', probe: 'honesty — likely NO bedding cover exists; will he invent it?' },
      { q: 'What food plot species should I plant this spring and where?', probe: 'species/season/soil doctrine on open ag' },
    ],
  },
  {
    id: 'D-creek',
    season: 'Summer',
    propertyName: 'Auburn Creek 60',
    ring: D_RING,
    features: [boundaryFeature(D_RING)],
    turns: [
      { q: 'Give me the full summer improvement plan for this place.', probe: 'summer priorities — water/mineral, brassica window' },
      { q: 'Should I put in a waterhole?', probe: 'if creek/water confirmed, should say already have water; if not, contradiction' },
      { q: 'Where is the best creek crossing to hang a rut stand over?', probe: 'creek-crossing doctrine + does he cite real creek' },
    ],
  },
  {
    id: 'E-small',
    season: 'Early Fall',
    propertyName: 'The 15',
    ring: E_RING,
    features: E_FEATURES,
    turns: [
      { q: 'What can I realistically do with just 15 acres? Full plan.', probe: 'small-parcel realism — stand count, sanctuary feasibility, anchoring to my drawn stand+clover' },
      { q: 'How many stands can I hunt on this place without burning it out?', probe: 'pressure doctrine on 15ac (should be 1-2 max)' },
      { q: 'I want to add a 3 acre corn plot too. Where does it fit?', probe: 'should push back — 3ac corn on 15ac tract w/ existing clover' },
      { q: 'ok do it', probe: 'terse mid-conversation continuity (no analysis restart)' },
    ],
  },
  {
    id: 'F-timber',
    season: 'Late Season',
    propertyName: 'Ozark 90',
    ring: F_RING,
    features: [boundaryFeature(F_RING)],
    turns: [
      { q: 'This is solid timber. Give me the late season plan.', probe: 'late season = food+thermal cover; solid timber = no open ground for engine plots' },
      { q: 'Where do I put food plots in here?', probe: 'honest answer requires clearing/TSI — engine has no open cells' },
      { q: 'What does hinge cutting do and where exactly should I do it on my place?', probe: 'TSI depth — 10-20 trees/ac, 60% through at 4ft, location logic' },
    ],
  },
]

export { boundsOf }
