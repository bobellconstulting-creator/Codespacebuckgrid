// BuckGrid Pro field report renderer — pure canvas, zero dependencies.
// Composes the shareable PNG card and the paginated PDF pages from the same
// layout blocks so both outputs stay visually identical.

export type ReportZone = {
  type: string
  label: string
  why: string
  confidence?: number
  priority?: number
}

export type ReportData = {
  propertyName: string
  acres: number
  season: string
  dateLabel: string
  zones: ReportZone[]
  fieldNotes?: string
}

export type ReportAssets = {
  mapImage?: HTMLCanvasElement | HTMLImageElement
  logo?: HTMLImageElement
}

// Confirmed brand palette
const INK = '#1E2122'
const MOSS = '#6B7A57'
const BONE = '#D8D3C5'
const CARD = '#131710'
const BONE_DIM = '#8A8578'
const RULE = 'rgba(107,122,87,0.28)'

const DISPLAY = "'Teko','Oswald','Barlow Condensed',sans-serif"
const MONO = "'Share Tech Mono','JetBrains Mono',monospace"
const BODY = "'Barlow Condensed','Inter',sans-serif"

// Mirrors ANNOTATION_COLORS in hooks/useMapDrawing.ts — keep in sync
const ZONE_COLORS: Record<string, string> = {
  food: '#32CD32',
  food_plot: '#32CD32',
  bedding: '#8B4513',
  stand: '#ef4444',
  water: '#00BFFF',
  path: '#FFD700',
  trail: '#FFD700',
  sneak_trail: '#8B8678',
  access_trail: '#D4AC4A',
  access_point: '#B8923A',
  sanctuary: '#5F7A52',
  staging_area: '#6B7A4F',
  pinch_point: '#C84A4A',
  structure: '#FF6B00',
  mineral: '#CD853F',
  scrape_line: '#B03030',
  travel_corridor: '#B8860B',
  tall_standing_cover: '#7B9E5A',
}

export function zoneColor(type: string): string {
  return ZONE_COLORS[type] ?? MOSS
}

type Block = {
  h: number
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number) => void
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, font: string, maxW: number): string[] {
  ctx.font = font
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word
    if (ctx.measureText(probe).width > maxW && line) {
      lines.push(line)
      line = word
    } else {
      line = probe
    }
  }
  if (line) lines.push(line)
  return lines
}

function imgSize(img: HTMLCanvasElement | HTMLImageElement): { w: number; h: number } {
  if (img instanceof HTMLImageElement) return { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height }
  return { w: img.width, h: img.height }
}

function chip(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: 'left' | 'right') {
  ctx.font = `13px ${MONO}`
  const tw = ctx.measureText(text).width
  const w = tw + 22
  const h = 28
  const cx = align === 'right' ? x - w : x
  roundRect(ctx, cx, y, w, h, 3)
  ctx.fillStyle = 'rgba(19,23,16,0.88)'
  ctx.fill()
  ctx.strokeStyle = RULE
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = BONE
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, cx + 11, y + h / 2 + 1)
  ctx.textBaseline = 'alphabetic'
}

function headerBlock(data: ReportData, assets: ReportAssets, w: number): Block {
  const h = 172
  return {
    h,
    draw(ctx, x, y) {
      roundRect(ctx, x, y, w, h, 6)
      ctx.fillStyle = CARD
      ctx.fill()
      ctx.strokeStyle = RULE
      ctx.lineWidth = 1
      ctx.stroke()
      // Moss top bar
      ctx.fillStyle = MOSS
      ctx.fillRect(x, y, w, 3)

      let tx = x + 26
      if (assets.logo) {
        const lw = 58
        const { w: nw, h: nh } = imgSize(assets.logo)
        const lh = nw > 0 ? (lw * nh) / nw : lw
        ctx.drawImage(assets.logo, x + 22, y + 24, lw, Math.min(lh, 58))
        tx = x + 96
      }
      ctx.textAlign = 'left'
      ctx.fillStyle = BONE
      ctx.font = `700 44px ${DISPLAY}`
      ctx.fillText('BUCKGRID', tx, y + 60)
      const bw = ctx.measureText('BUCKGRID').width
      ctx.fillStyle = MOSS
      ctx.fillText(' PRO', tx + bw, y + 60)
      ctx.font = `13px ${MONO}`
      ctx.fillStyle = MOSS
      ctx.fillText('TONY AI FIELD REPORT', tx + 2, y + 84)

      ctx.textAlign = 'right'
      ctx.fillStyle = BONE_DIM
      ctx.font = `13px ${MONO}`
      ctx.fillText(data.dateLabel, x + w - 24, y + 44)
      ctx.textAlign = 'left'

      const name = (data.propertyName || 'UNNAMED PROPERTY').toUpperCase()
      ctx.fillStyle = BONE
      ctx.font = `600 31px ${DISPLAY}`
      ctx.fillText(name, x + 26, y + 130, w - 52)

      const meta: string[] = []
      if (data.acres > 0) meta.push(`${data.acres.toLocaleString()} ACRES`)
      if (data.season) meta.push(data.season.toUpperCase())
      meta.push(`${data.zones.length} TONY CALL${data.zones.length === 1 ? '' : 'S'}`)
      ctx.fillStyle = MOSS
      ctx.font = `13px ${MONO}`
      ctx.fillText(meta.join('   ·   '), x + 26, y + 154)
    },
  }
}

function mapBlock(data: ReportData, assets: ReportAssets, w: number, maxMapH: number): Block | null {
  const img = assets.mapImage
  if (!img) return null
  const { w: iw, h: ih } = imgSize(img)
  if (iw <= 0 || ih <= 0) return null
  const scale = w / iw
  let dh = Math.round(ih * scale)
  let sy = 0
  let sh = ih
  if (dh > maxMapH) {
    dh = maxMapH
    sh = Math.round(maxMapH / scale)
    sy = Math.round((ih - sh) / 2)
  }
  const h = dh
  return {
    h,
    draw(ctx, x, y) {
      ctx.save()
      roundRect(ctx, x, y, w, h, 6)
      ctx.clip()
      ctx.drawImage(img, 0, sy, iw, sh, x, y, w, h)
      ctx.restore()
      roundRect(ctx, x, y, w, h, 6)
      ctx.strokeStyle = 'rgba(107,122,87,0.6)'
      ctx.lineWidth = 2
      ctx.stroke()
      // Property chip bottom-left, brand chip bottom-right
      const left = `${(data.propertyName || 'MY LAND').toUpperCase()}${data.acres > 0 ? ` · ${data.acres.toLocaleString()} AC` : ''}`
      chip(ctx, left, x + 14, y + h - 42, 'left')
      chip(ctx, 'BUCKGRID PRO', x + w - 14, y + h - 42, 'right')
    },
  }
}

function legendBlock(zones: ReportZone[], w: number, mctx: CanvasRenderingContext2D): Block | null {
  const seen = new Set<string>()
  const types: string[] = []
  for (const z of zones) {
    if (!seen.has(z.type)) {
      seen.add(z.type)
      types.push(z.type)
    }
  }
  if (types.length === 0) return null

  const font = `13px ${MONO}`
  mctx.font = font
  const items = types.map(t => ({
    label: t.replace(/_/g, ' ').toUpperCase(),
    color: zoneColor(t),
  }))
  // Layout chips: swatch 12 + gap 8 + text, 26px apart horizontally
  type Pos = { ix: number; px: number; row: number }
  const positions: Pos[] = []
  let px = 0
  let row = 0
  items.forEach((it, ix) => {
    const itemW = 12 + 8 + mctx.measureText(it.label).width
    if (px + itemW > w && px > 0) {
      row++
      px = 0
    }
    positions.push({ ix, px, row })
    px += itemW + 26
  })
  const rows = row + 1
  const h = rows * 28 + 4
  return {
    h,
    draw(ctx, x, y) {
      ctx.font = font
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      for (const p of positions) {
        const it = items[p.ix]
        const cy = y + p.row * 28 + 14
        ctx.fillStyle = it.color
        roundRect(ctx, x + p.px, cy - 6, 12, 12, 2)
        ctx.fill()
        ctx.fillStyle = BONE_DIM
        ctx.fillText(it.label, x + p.px + 20, cy + 1)
      }
      ctx.textBaseline = 'alphabetic'
    },
  }
}

function sectionTitleBlock(title: string, w: number): Block {
  const h = 36
  return {
    h,
    draw(ctx, x, y) {
      ctx.textAlign = 'left'
      ctx.fillStyle = MOSS
      ctx.font = `13px ${MONO}`
      ctx.fillText(title, x, y + 18)
      const tw = ctx.measureText(title).width
      ctx.strokeStyle = RULE
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x + tw + 16, y + 13)
      ctx.lineTo(x + w, y + 13)
      ctx.stroke()
    },
  }
}

function zoneCardBlock(z: ReportZone, index: number, w: number, mctx: CanvasRenderingContext2D): Block {
  const padX = 22
  const textW = w - padX * 2 - 6
  const labelFont = `600 23px ${DISPLAY}`
  const whyFont = `18px ${BODY}`
  const labelLines = z.label ? wrapText(mctx, z.label.toUpperCase(), labelFont, textW) : []
  const whyLines = z.why ? wrapText(mctx, z.why, whyFont, textW) : []
  const hasMeta = z.confidence !== undefined || z.priority !== undefined

  let h = 16 // top pad
  h += 20 // type row
  h += labelLines.length * 27
  h += whyLines.length > 0 ? 6 + whyLines.length * 24 : 0
  h += hasMeta ? 26 : 8
  h += 8 // bottom pad
  h = Math.max(h, 64)

  const color = zoneColor(z.type)
  return {
    h,
    draw(ctx, x, y) {
      roundRect(ctx, x, y, w, h, 5)
      ctx.fillStyle = CARD
      ctx.fill()
      ctx.strokeStyle = RULE
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = color
      ctx.fillRect(x, y + 6, 4, h - 12)

      ctx.textAlign = 'left'
      let ty = y + 16
      ctx.font = `13px ${MONO}`
      ctx.fillStyle = MOSS
      const num = String(index + 1).padStart(2, '0')
      ctx.fillText(num, x + padX, ty + 12)
      ctx.fillStyle = color
      ctx.fillText(z.type.replace(/_/g, ' ').toUpperCase(), x + padX + 34, ty + 12)
      ty += 20

      ctx.font = labelFont
      ctx.fillStyle = BONE
      for (const line of labelLines) {
        ty += 27
        ctx.fillText(line, x + padX, ty - 5)
      }

      if (whyLines.length > 0) {
        ty += 6
        ctx.font = whyFont
        ctx.fillStyle = 'rgba(216,211,197,0.82)'
        for (const line of whyLines) {
          ty += 24
          ctx.fillText(line, x + padX, ty - 5)
        }
      }

      if (hasMeta) {
        const parts: string[] = []
        if (z.priority !== undefined) parts.push(`PRIORITY ${z.priority}`)
        if (z.confidence !== undefined) parts.push(`CONFIDENCE ${z.confidence}%`)
        ctx.font = `12px ${MONO}`
        ctx.fillStyle = BONE_DIM
        ctx.fillText(parts.join('   ·   '), x + padX, ty + 20)
      }
    },
  }
}

function notesBlock(notes: string, w: number, mctx: CanvasRenderingContext2D): Block {
  const padX = 22
  const font = `18px ${BODY}`
  const lines = wrapText(mctx, notes, font, w - padX * 2)
  const h = 16 + lines.length * 24 + 16
  return {
    h,
    draw(ctx, x, y) {
      roundRect(ctx, x, y, w, h, 5)
      ctx.fillStyle = 'rgba(19,23,16,0.6)'
      ctx.fill()
      ctx.strokeStyle = RULE
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.textAlign = 'left'
      ctx.font = font
      ctx.fillStyle = 'rgba(216,211,197,0.85)'
      let ty = y + 16
      for (const line of lines) {
        ty += 24
        ctx.fillText(line, x + padX, ty - 5)
      }
    },
  }
}

function emptyZonesBlock(w: number): Block {
  const h = 64
  return {
    h,
    draw(ctx, x, y) {
      roundRect(ctx, x, y, w, h, 5)
      ctx.fillStyle = CARD
      ctx.fill()
      ctx.strokeStyle = RULE
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.textAlign = 'left'
      ctx.font = `15px ${MONO}`
      ctx.fillStyle = BONE_DIM
      ctx.fillText('NO TONY CALLS ON THIS MAP YET — HIT GET ADVICE TO PLACE ZONES.', x + 22, y + 38)
    },
  }
}

function footerBlock(data: ReportData, w: number): Block {
  const h = 92
  return {
    h,
    draw(ctx, x, y) {
      ctx.strokeStyle = RULE
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, y + 8)
      ctx.lineTo(x + w, y + 8)
      ctx.stroke()
      ctx.textAlign = 'left'
      ctx.fillStyle = BONE
      ctx.font = `600 23px ${DISPLAY}`
      ctx.fillText('DRAW YOUR LAND. TALK TO TONY. KILL BIGGER BUCKS.', x, y + 48)
      ctx.font = `13px ${MONO}`
      ctx.fillStyle = MOSS
      ctx.fillText('BUCKGRID PRO · codespacebuckgrid.vercel.app', x, y + 76)
      ctx.textAlign = 'right'
      ctx.fillStyle = BONE_DIM
      ctx.fillText(`GENERATED ${data.dateLabel.toUpperCase()}`, x + w, y + 76)
      ctx.textAlign = 'left'
    },
  }
}

function buildBlocks(
  data: ReportData,
  assets: ReportAssets,
  contentW: number,
  maxMapH: number,
  mctx: CanvasRenderingContext2D
): Block[] {
  const blocks: Block[] = []
  blocks.push(headerBlock(data, assets, contentW))
  const map = mapBlock(data, assets, contentW, maxMapH)
  if (map) blocks.push(map)
  const legend = legendBlock(data.zones, contentW, mctx)
  if (legend) blocks.push(legend)
  blocks.push(sectionTitleBlock("TONY'S CALLS — WHY EACH ZONE", contentW))
  if (data.zones.length === 0) {
    blocks.push(emptyZonesBlock(contentW))
  } else {
    data.zones.forEach((z, i) => blocks.push(zoneCardBlock(z, i, contentW, mctx)))
  }
  if (data.fieldNotes) {
    blocks.push(sectionTitleBlock("TONY'S READ", contentW))
    blocks.push(notesBlock(data.fieldNotes, contentW, mctx))
  }
  blocks.push(footerBlock(data, contentW))
  return blocks
}

function makeMeasureCtx(): CanvasRenderingContext2D {
  const c = document.createElement('canvas')
  c.width = 1
  c.height = 1
  return c.getContext('2d')!
}

/** Single tall PNG card — the asset a hunter texts to his buddy. */
export function composeShareCanvas(data: ReportData, assets: ReportAssets): HTMLCanvasElement {
  const W = 1200
  const P = 40
  const GAP = 14
  const contentW = W - P * 2
  const mctx = makeMeasureCtx()
  const blocks = buildBlocks(data, assets, contentW, 780, mctx)
  const H = P * 2 + blocks.reduce((s, b) => s + b.h, 0) + GAP * (blocks.length - 1)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, W, H)
  let y = P
  for (const b of blocks) {
    b.draw(ctx, P, y)
    y += b.h + GAP
  }
  return canvas
}

/** US-Letter-proportioned page canvases (150 dpi) for the PDF. */
export function composePdfPages(data: ReportData, assets: ReportAssets): HTMLCanvasElement[] {
  const PW = 1275
  const PH = 1650
  const M = 64
  const GAP = 14
  const STRIP_H = 40 // continuation header on pages 2+
  const FOOT_H = 44
  const contentW = PW - M * 2
  const mctx = makeMeasureCtx()
  const blocks = buildBlocks(data, assets, contentW, PH - M * 2 - FOOT_H - 220, mctx)

  // Paginate
  const pages: Block[][] = [[]]
  const limit = PH - M - FOOT_H
  let y = M
  for (const b of blocks) {
    if (y + b.h > limit && pages[pages.length - 1].length > 0) {
      pages.push([])
      y = M + STRIP_H + GAP
    }
    pages[pages.length - 1].push(b)
    y += b.h + GAP
  }

  const name = (data.propertyName || 'UNNAMED PROPERTY').toUpperCase()
  return pages.map((pageBlocks, pi) => {
    const canvas = document.createElement('canvas')
    canvas.width = PW
    canvas.height = PH
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = INK
    ctx.fillRect(0, 0, PW, PH)

    let py = M
    if (pi > 0) {
      ctx.textAlign = 'left'
      ctx.font = `13px ${MONO}`
      ctx.fillStyle = MOSS
      ctx.fillText('BUCKGRID PRO — TONY AI FIELD REPORT', M, py + 16)
      ctx.textAlign = 'right'
      ctx.fillStyle = BONE_DIM
      ctx.fillText(name, PW - M, py + 16)
      ctx.textAlign = 'left'
      ctx.strokeStyle = RULE
      ctx.beginPath()
      ctx.moveTo(M, py + 28)
      ctx.lineTo(PW - M, py + 28)
      ctx.stroke()
      py += STRIP_H + GAP
    }
    for (const b of pageBlocks) {
      b.draw(ctx, M, py)
      py += b.h + GAP
    }

    ctx.textAlign = 'center'
    ctx.font = `12px ${MONO}`
    ctx.fillStyle = BONE_DIM
    ctx.fillText(`PAGE ${pi + 1} OF ${pages.length} · BUCKGRID PRO · codespacebuckgrid.vercel.app`, PW / 2, PH - 28)
    ctx.textAlign = 'left'
    return canvas
  })
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('PNG encode failed'))), 'image/png')
  })
}
