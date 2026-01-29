'use client'

import { useCallback } from 'react'
import type { DrawnFeature } from './useMapDrawing'

type AnalysisPayload = {
  message: string
  imageDataUrl?: string
  features: DrawnFeature[]
  propertyAcres: number
}

/**
 * Bundles current map state (drawn features, acres) into the chat request
 * so Tony has full context about what the user has drawn.
 */
export function useTonyAnalysis(args: {
  getDrawnFeatures: () => DrawnFeature[]
  propertyAcres: number
  getCaptureTarget: () => HTMLElement | null
}) {
  const { getDrawnFeatures, propertyAcres, getCaptureTarget } = args

  const sendMessage = useCallback(async (message: string): Promise<{ reply: string; features: unknown[] }> => {
    let imageDataUrl: string | undefined
    try {
      const target = getCaptureTarget()
      if (target) {
        const html2canvas = (await import('html2canvas')).default
        const canvas = await html2canvas(target, { useCORS: true, scale: 1 })
        imageDataUrl = canvas.toDataURL('image/jpeg', 0.6)
      }
    } catch {
      // Screenshot capture failed; send without image
    }

    const payload: AnalysisPayload = {
      message,
      imageDataUrl,
      features: getDrawnFeatures(),
      propertyAcres,
    }

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    return { reply: data.reply ?? 'No reply.', features: data.features ?? [] }
  }, [getDrawnFeatures, propertyAcres, getCaptureTarget])

  return { sendMessage }
}
