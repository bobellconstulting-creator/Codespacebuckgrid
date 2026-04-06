// USDA Soil Data Access (SDA) — capability class, drainage, soil series
// Free, no API key required. https://sdmdataaccess.nrcs.usda.gov/

export interface SoilMapUnit {
  mukey: string
  muname: string
  compname: string
  comppct: number
  taxorder: string
  drainagecl: string
  nirrcapcl: string  // capability class I-VIII
  nirrcapscl: string // subclass: e=erosion, w=wetness, s=soil, c=climate
  farmlndcl: string
  muacres: number
}

export async function fetchSoilData(bounds: {
  north: number; south: number; east: number; west: number
}): Promise<SoilMapUnit[]> {
  const { north, south, east, west } = bounds
  const wkt = `polygon((${west} ${south}, ${east} ${south}, ${east} ${north}, ${west} ${north}, ${west} ${south}))`
  const sql = `
    SELECT mu.mukey, mu.muname, mu.muacres, mu.farmlndcl,
      co.compname, co.comppct_r AS comppct, co.taxorder,
      co.drainagecl, co.nirrcapcl, co.nirrcapscl
    FROM mapunit mu
    INNER JOIN (SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('${wkt}')) AS keys ON mu.mukey = keys.mukey
    INNER JOIN component co ON co.mukey = mu.mukey
    WHERE co.majcompflag = 'Yes'
    ORDER BY mu.mukey, co.comppct_r DESC
  `
  try {
    const res = await fetch('https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `query=${encodeURIComponent(sql)}&format=JSON+COLUMNNAME`,
      signal: AbortSignal.timeout(18_000),
    })
    if (!res.ok) return []
    const json = await res.json()
    const rows: unknown[][] = json.Table ?? []
    if (rows.length < 2) return []
    const headers = rows[0] as string[]
    const idx = (name: string) => headers.indexOf(name)
    const seen = new Set<string>()
    const results: SoilMapUnit[] = []
    for (const row of rows.slice(1)) {
      const mukey = String(row[idx('mukey')])
      if (seen.has(mukey)) continue
      seen.add(mukey)
      results.push({
        mukey,
        muname: String(row[idx('muname')] ?? ''),
        muacres: Number(row[idx('muacres')] ?? 0),
        farmlndcl: String(row[idx('farmlndcl')] ?? ''),
        compname: String(row[idx('compname')] ?? ''),
        comppct: Number(row[idx('comppct')] ?? 0),
        taxorder: String(row[idx('taxorder')] ?? ''),
        drainagecl: String(row[idx('drainagecl')] ?? ''),
        nirrcapcl: String(row[idx('nirrcapcl')] ?? ''),
        nirrcapscl: String(row[idx('nirrcapscl')] ?? ''),
      })
    }
    return results
  } catch {
    return []
  }
}

export function summarizeSoilForTony(soils: SoilMapUnit[]): string {
  if (!soils.length) return ''
  const lines: string[] = ['SOIL DATA (USDA verified):']
  for (const s of soils.slice(0, 4)) {
    const cap = s.nirrcapcl ? ` Cap.Class ${s.nirrcapcl}${s.nirrcapscl || ''}` : ''
    const drain = s.drainagecl ? `, ${s.drainagecl}` : ''
    const foodPotential = ['I', 'II'].includes(s.nirrcapcl)
      ? ' → PRIME food plot ground'
      : ['VI', 'VII', 'VIII'].includes(s.nirrcapcl)
        ? ' → marginal/non-farmland, do not plant'
        : s.drainagecl?.includes('poorly') ? ' → wet/poorly drained, avoid food plots' : ''
    lines.push(`- ${s.muname}: ${s.compname}${drain}${cap}${foodPotential}`)
  }
  return lines.join('\n')
}
