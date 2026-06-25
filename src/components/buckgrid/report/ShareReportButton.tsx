'use client'

// The one obvious Share / Export button. Captures the live map (Leaflet pane,
// CORS-safe Esri tiles), composes the branded report, and hands the hunter a
// PNG built for group chats or a full PDF. Falls back from the native share
// sheet to a plain download.

import React, { useCallback, useState } from 'react'
import {
  composeShareCanvas,
  composePdfPages,
  canvasToPngBlob,
  type ReportData,
  type ReportZone,
  type ReportAssets,
} from './reportRenderer'
import { canvasesToPdfBlob } from './pdf'

export type ShareReportButtonProps = {
  getMapElement: () => HTMLElement | null
  propertyName?: string
  acres?: number
  season?: string
  zones: ReportZone[]
  fieldNotes?: string
  wind?: string
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function loadLogo(): Promise<HTMLImageElement | undefined> {
  try {
    const img = new Image()
    img.src = '/buckgrid-logo.png'
    await img.decode()
    return img
  } catch {
    return undefined
  }
}

async function captureMap(el: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas')
  return html2canvas(el, {
    useCORS: true,
    backgroundColor: '#101312',
    logging: false,
    scale: Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
    // Zoom buttons don't belong on a report
    ignoreElements: node => node.classList?.contains('leaflet-control-container') ?? false,
  })
}

const MONO = "'Share Tech Mono', monospace"
const DISPLAY = "'Teko', 'Oswald', sans-serif"
const GOLD = '#C9A227'
const GOLD_HI = '#E0B43A'
const BONE = '#E8E4D8'
const HAIRLINE = 'rgba(255,255,255,0.08)'
const INNER_HI = 'inset 0 1px 0 rgba(255,255,255,0.07)'

export default function ShareReportButton({
  getMapElement,
  propertyName,
  acres,
  season,
  zones,
  fieldNotes,
  wind,
}: ShareReportButtonProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (kind: 'png' | 'pdf') => {
      if (busy) return
      const el = getMapElement()
      if (!el) {
        setError('Map not ready yet.')
        return
      }
      setBusy(kind)
      setError(null)
      try {
        await document.fonts.ready
        const [mapImage, logo] = await Promise.all([captureMap(el), loadLogo()])
        const data: ReportData = {
          propertyName: propertyName || '',
          acres: acres ?? 0,
          season: season || '',
          dateLabel: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
          zones,
          fieldNotes,
          wind,
        }
        const assets: ReportAssets = { mapImage, logo }
        const slug =
          (propertyName || 'property')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'property'
        const stamp = new Date().toISOString().slice(0, 10)

        if (kind === 'png') {
          const blob = await canvasToPngBlob(composeShareCanvas(data, assets))
          const filename = `buckgrid-report-${slug}-${stamp}.png`
          const file = typeof File !== 'undefined' ? new File([blob], filename, { type: 'image/png' }) : null
          if (file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({ files: [file], title: 'BuckGrid Pro — Tony AI Field Report' })
              setOpen(false)
              return
            } catch (e) {
              // AbortError = user closed the share sheet on purpose — stop there.
              if (e instanceof DOMException && e.name === 'AbortError') {
                return
              }
              // Anything else (lost gesture, unsupported) → plain download.
            }
          }
          downloadBlob(blob, filename)
        } else {
          const blob = canvasesToPdfBlob(composePdfPages(data, assets))
          downloadBlob(blob, `buckgrid-report-${slug}-${stamp}.pdf`)
        }
        setOpen(false)
      } catch {
        setError('Export failed — try again.')
      } finally {
        setBusy(null)
      }
    },
    [busy, getMapElement, propertyName, acres, season, zones, fieldNotes]
  )

  const optionStyle = (disabled: boolean): React.CSSProperties => ({
    flex: 1,
    minHeight: '40px',
    background: 'rgba(10,20,14,0.55)',
    border: `1px solid ${HAIRLINE}`,
    borderRadius: '10px',
    color: BONE,
    fontFamily: MONO,
    fontSize: '10px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    cursor: disabled ? 'wait' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    padding: '7px 9px',
    boxShadow: INNER_HI,
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    transition: 'background 0.3s ease, border-color 0.3s ease',
  })

  return (
    <div style={{ padding: '10px 14px 4px' }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="bg-share-btn"
        style={{
          width: '100%',
          minHeight: '46px',
          background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
          border: '1px solid rgba(255,235,170,0.5)',
          borderRadius: '12px',
          color: '#1B1405',
          fontFamily: DISPLAY,
          fontWeight: 600,
          fontSize: '16px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          textShadow: '0 1px 0 rgba(255,255,255,0.25)',
          boxShadow: open
            ? '0 10px 30px rgba(0,0,0,0.5), 0 0 28px rgba(201,162,39,0.45), ' + INNER_HI
            : '0 8px 24px rgba(0,0,0,0.45), 0 0 18px rgba(201,162,39,0.28), ' + INNER_HI,
        }}
      >
        ⇪ Share / Export Report
      </button>
      {open && (
        <div style={{ display: 'flex', gap: '7px', marginTop: '8px' }}>
          <button onClick={() => run('png')} disabled={busy !== null} style={optionStyle(busy === 'png')}>
            {busy === 'png' ? 'Building…' : 'PNG — text it'}
          </button>
          <button onClick={() => run('pdf')} disabled={busy !== null} style={optionStyle(busy === 'pdf')}>
            {busy === 'pdf' ? 'Building…' : 'PDF — full report'}
          </button>
        </div>
      )}
      {error && (
        <div style={{ marginTop: '6px', fontFamily: MONO, fontSize: '9px', letterSpacing: '0.1em', color: '#ef4444' }}>
          {error}
        </div>
      )}
    </div>
  )
}
