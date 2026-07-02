// Plain node test for lib/premise-check.ts — run with: npx tsx tests/premise-check.test.ts
import { premiseCheck, _internals, type VerifiedGround } from '../lib/premise-check'

let failed = 0
function test(name: string, fn: () => boolean) {
  let ok = false
  try { ok = fn() } catch (e) { console.log(`  threw: ${e}`) }
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`)
  if (!ok) failed++
}
const empty = (): VerifiedGround => ({ water: [], streams: [], wetland: [], forest: [], scrub: [], buildings: [], roads: [], farmland: [], userDrawn: [] })

test('pond claim with no water → flagged', () => {
  const r = premiseCheck('tell me about the pond in my northeast corner', empty())
  return !!r && r.includes('pond') && r.includes('northeast')
})
test('pond claim with water in right quadrant → pass', () => {
  const g = empty(); g.water = ['northeast']
  return premiseCheck('tell me about the pond in my northeast corner', g) === null
})
test('pond claim with water in OPPOSITE quadrant → flagged', () => {
  const g = empty(); g.water = ['southwest']
  const r = premiseCheck('tell me about the pond in my northeast corner', g)
  return !!r && r.includes('pond')
})
test('adjacent quadrant (north vs northeast) counts as confirmation → pass', () => {
  const g = empty(); g.water = ['north']
  return premiseCheck('tell me about the pond in my northeast corner', g) === null
})
test('"should I add a waterhole" is a proposal → NOT flagged', () => {
  return premiseCheck('should I add a small waterhole somewhere?', empty()) === null
})
test('"cedar thicket" with scrub in south → pass', () => {
  const g = empty(); g.scrub = ['south']
  return premiseCheck('what about the big cedar thicket down in my south draw', g) === null
})
test('thicket absent (scrub only in north, claim in south) → flagged', () => {
  const g = empty(); g.scrub = ['north']
  const r = premiseCheck('what about the thicket in my south end', g)
  return !!r && r.includes('thicket')
})
test('no direction + layer present anywhere → pass', () => {
  const g = empty(); g.water = ['west']
  return premiseCheck('how should I hunt the pond?', g) === null
})
test('user-drawn water trumps missing OSM water → pass', () => {
  const g = empty(); g.userDrawn = ['water']
  return premiseCheck('tell me about the pond in my northeast corner', g) === null
})
test('barn claim with no buildings → flagged', () => {
  const r = premiseCheck('hang it near the old barn in my southwest corner?', empty())
  return !!r && r.includes('barn')
})
test('creek with streams present → pass', () => {
  const g = empty(); g.streams = ['west']
  return premiseCheck('best crossing on the creek on the west side?', g) === null
})
test('plural "ponds" flagged when absent', () => {
  const r = premiseCheck('what about the ponds on my place', empty())
  return !!r && r.includes('pond')
})
test('center-adjacency: water at center confirms any quadrant claim → pass', () => {
  const g = empty(); g.water = ['center']
  return premiseCheck('the pond in my northeast corner', g) === null
})
test('uppercase "NE corner" alias normalizes → flagged with northeast', () => {
  const r = premiseCheck('Tell me about the pond in the NE corner', empty())
  return !!r && r.includes('northeast')
})
test('"cedar thicket" and "thicket" do not double-report', () => {
  const r = premiseCheck('the cedar thicket in my south draw', empty())
  return !!r && (r.match(/thicket/g) ?? []).length <= 2 // once in the line, not two lines
})
test('extractClaims finds direction on longest term', () => {
  const claims = _internals.extractClaims('the cedar thicket in my southwest corner')
  return claims.length === 1 && claims[0].layer === 'scrub' && claims[0].direction === 'southwest'
})

if (failed > 0) { console.log(`${failed} FAILED`); process.exit(1) }
console.log('All tests passed.')
