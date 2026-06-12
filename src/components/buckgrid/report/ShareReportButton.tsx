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
    minHeight: '38px',
    background: '#1E2122',
    border: '1px solid rgba(107,122,87,0.35)',
    borderRadius: '2px',
    color: '#D8D3C5',
    fontFamily: MONO,
    fontSize: '10px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: disabled ? 'wait' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    padding: '6px 8px',
  })

  return (
    <div style={{ padding: '8px 12px 0', background: '#3A4042' }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          minHeight: '40px',
          background: open ? '#7A8A66' : '#6B7A57',
          border: '1px solid rgba(107,122,87,0.6)',
          borderRadius: '3px',
          color: '#fff',
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: '14px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          boxShadow: '0 0 14px rgba(107,122,87,0.35)',
          transition: 'background 0.15s ease',
        }}
      >
        ⇪ Share / Export Report
      </button>
      {open && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
          <button onClick={() => run('png')} disabled={busy !== null} style={optionStyle(busy === 'png')}>
            {busy === 'png' ? 'Building…' : 'PNG — text it'}
          </button>
          <button onClick={() => run('pdf')} disabled={busy !== null} style={optionStyle(busy === 'pdf')}>
            {busy === 'pdf' ? 'Building…' : 'PDF — full report'}
          </button>
        </div>
      )}
      {error && (
        <div style={{ marginTop: '5px', fontFamily: MONO, fontSize: '9px', letterSpacing: '0.08em', color: '#ef4444' }}>
          {error}
        </div>
      )}
    </div>
  )
}
