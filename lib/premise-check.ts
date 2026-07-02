// lib/premise-check.ts
// Deterministic guard against feature hallucination. Users mention terrain
// features in chat ("the pond in my northeast corner") and the LLM tends to
// confirm them whether or not they exist. Before building the prompt we
// cross-check every feature claim against verified GIS layers and inject a
// warning block for anything the data cannot confirm.
//
// Drafted by qwen3-coder:30b, reviewed and corrected (direction ordering,
// alias normalization, claim dedup) before integration.

export interface VerifiedGround {
  /** compass labels ('north','northeast',…,'center') where each layer is confirmed present */
  water: string[]
  streams: string[]
  wetland: string[]
  forest: string[]
  scrub: string[]
  buildings: string[]
  roads: string[]
  farmland: string[]
  /** layerTypes of features the user drew themselves (always trusted) */
  userDrawn: string[]
}

const LEXICON: Record<string, string> = {
  water: 'pond,lake,waterhole,water hole,tank,slough,pool',
  streams: 'creek,stream,river,ditch,spring',
  wetland: 'swamp,marsh,bog,wetland',
  forest: 'timber,woods,woodlot,forest,oaks,hardwoods,pines',
  scrub: 'thicket,brush,cedars,cedar thicket,briars,plum thicket,crp,switchgrass',
  buildings: 'barn,house,cabin,shed,outbuilding',
  farmland: 'crop field,bean field,corn field,wheat field,alfalfa,food plot',
}

// term → layer, longest terms first so "cedar thicket" wins over "thicket"
const TERMS: Array<{ term: string; layer: string }> = []
for (const [layer, list] of Object.entries(LEXICON)) {
  for (const term of list.split(',')) TERMS.push({ term: term.trim(), layer })
}
TERMS.sort((a, b) => b.term.length - a.term.length)

// Longest-first so "northeast" is found before "north" inside the same context.
const DIRECTION_ALIASES: Array<{ re: RegExp; dir: string }> = [
  { re: /\bnorth[- ]?east(ern)?\b|\bne\b/i, dir: 'northeast' },
  { re: /\bnorth[- ]?west(ern)?\b|\bnw\b/i, dir: 'northwest' },
  { re: /\bsouth[- ]?east(ern)?\b|\bse\b/i, dir: 'southeast' },
  { re: /\bsouth[- ]?west(ern)?\b|\bsw\b/i, dir: 'southwest' },
  { re: /\bnorth(ern)?\b/i, dir: 'north' },
  { re: /\bsouth(ern)?\b/i, dir: 'south' },
  { re: /\beast(ern)?\b/i, dir: 'east' },
  { re: /\bwest(ern)?\b/i, dir: 'west' },
  { re: /\bcenter\b|\bmiddle\b/i, dir: 'center' },
]

const PROPOSAL_PREFIXES = [
  'should i', 'could i', 'can i', 'want to', 'thinking about', 'add a', 'add another',
  'put in', 'build', 'plant', 'install', 'create', 'where would', 'if i', 'dig',
]

function extractDirection(text: string, pos: number, len: number): string | null {
  const context = text.substring(Math.max(0, pos - 40), Math.min(text.length, pos + len + 40))
  for (const { re, dir } of DIRECTION_ALIASES) {
    if (re.test(context)) return dir
  }
  return null
}

function isProposalIntent(message: string, termStart: number): boolean {
  const prefix = message.substring(Math.max(0, termStart - 30), termStart).toLowerCase()
  return PROPOSAL_PREFIXES.some((p) => prefix.includes(p))
}

function extractClaims(message: string): Array<{ term: string; layer: string; direction: string | null }> {
  const claims: Array<{ term: string; layer: string; direction: string | null }> = []
  const claimed = new Set<string>() // layer|direction dedup — longest term wins (TERMS is sorted)
  const covered: Array<[number, number]> = [] // spans already matched by a longer term

  for (const { term, layer } of TERMS) {
    const re = new RegExp(`\\b${term.replace(/ /g, '\\s+')}(s|es)?\\b`, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(message)) !== null) {
      const start = m.index
      const end = start + m[0].length
      if (covered.some(([s, e]) => start < e && end > s)) continue
      covered.push([start, end])
      if (isProposalIntent(message, start)) continue
      const direction = extractDirection(message, start, m[0].length)
      const key = `${layer}|${direction ?? ''}`
      if (claimed.has(key)) continue
      claimed.add(key)
      claims.push({ term: m[0].toLowerCase(), layer, direction })
    }
  }
  return claims
}

const ADJACENT: Record<string, string[]> = {
  north: ['north', 'northeast', 'northwest'],
  south: ['south', 'southeast', 'southwest'],
  east: ['east', 'northeast', 'southeast'],
  west: ['west', 'northwest', 'southwest'],
  northeast: ['north', 'northeast', 'east'],
  northwest: ['north', 'northwest', 'west'],
  southeast: ['south', 'southeast', 'east'],
  southwest: ['south', 'southwest', 'west'],
}

function isAdjacent(a: string, b: string): boolean {
  if (a === 'center' || b === 'center') return true
  if (a === b) return true
  return (ADJACENT[a]?.includes(b) ?? false) || (ADJACENT[b]?.includes(a) ?? false)
}

const FOOD_LAYER_TYPES = ['clover', 'brassicas', 'corn', 'soybeans', 'milo', 'egyptian', 'food_plot', 'kill_plot']

function checkClaim(claim: { term: string; layer: string; direction: string | null }, ground: VerifiedGround): boolean {
  // Features the owner drew themselves are always trusted
  if (claim.layer === 'water' || claim.layer === 'streams') {
    if (ground.userDrawn.includes('water')) return true
  }
  if (claim.layer === 'scrub' || claim.layer === 'forest') {
    if (ground.userDrawn.includes('bedding')) return true
  }
  if (claim.layer === 'farmland' && ground.userDrawn.some((d) => FOOD_LAYER_TYPES.includes(d))) return true

  const lists: Record<string, string[]> = {
    water: ground.water,
    streams: ground.streams,
    wetland: ground.wetland,
    forest: ground.forest,
    scrub: ground.scrub,
    buildings: ground.buildings,
    farmland: ground.farmland,
  }
  const layerList = lists[claim.layer] ?? []
  if (!claim.direction) return layerList.length > 0
  return layerList.some((dir) => isAdjacent(dir, claim.direction as string))
}

/**
 * Scan the user's message for claims about terrain features. Returns a prompt
 * block listing every claim the verified data can NOT confirm, or null when
 * everything checks out / nothing was claimed.
 */
export function premiseCheck(message: string, ground: VerifiedGround): string | null {
  const claims = extractClaims(message)
  if (claims.length === 0) return null

  const unverified = claims.filter((c) => !checkClaim(c, ground))
  if (unverified.length === 0) return null

  const lines = [
    '=== PREMISE CHECK — UNVERIFIED FEATURES IN USER MESSAGE ===',
    'The user referred to features that verified land data does NOT confirm on this property:',
  ]
  for (const c of unverified) {
    lines.push(`- "${c.term}"${c.direction ? ` (${c.direction})` : ''}: not found ${c.direction ? `in the ${c.direction} area` : 'anywhere on the property'} in any verified layer.`)
  }
  lines.push(
    "RULE: Do NOT confirm, describe, or build advice around any feature listed above. Tell the owner plainly you can't see it in the verified data, and ask them to drop a marker on it if it's really there — once marked, you'll treat it as ground truth.",
    '=== END PREMISE CHECK ===',
  )
  return lines.join('\n')
}

export const _internals = { extractClaims }
