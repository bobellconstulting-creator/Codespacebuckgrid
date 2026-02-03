'use client'

import { useState, useCallback } from 'react'

/**
 * VisionPacket structure returned from Gemini Vision API
 */
export interface VisionPacket {
  features: Array<{
    label: 'heavy_timber' | 'scrub_brush' | 'open_pasture'
    box_2d: [number, number, number, number] // [ymin, xmin, ymax, xmax] in 0-1000 scale
    confidence: number // 0.0 - 1.0
  }>
  notes?: string[]
}

/**
 * Tony's Eyes - Vision Analysis Hook
 * Handles "Jim and I" Vision logic - sending map screenshots to Gemini Vision API
 */
export function useTonyEyes() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<VisionPacket | null>(null)
  const [error, setError] = useState<string | null>(null)

  /**
   * Analyze map screenshot using Gemini Vision
   * @param mapScreenshot - Base64 encoded image string (with or without data URL prefix)
   */
  const analyzeMap = useCallback(async (mapScreenshot: string) => {
    setIsAnalyzing(true)
    setError(null)

    try {
      console.log('[TonyEyes] Starting vision analysis...')
      
      // Prepare payload for vision API
      const payload = {
        imageBase64: mapScreenshot,
        mimeType: 'image/jpeg',
      }

      // Send to Gemini Vision endpoint
      const response = await fetch('/api/analyze-map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Vision API error: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.visionPacket) {
        throw new Error('Vision API returned no data')
      }

      console.log('[TonyEyes] Vision analysis complete:', data.visionPacket)
      setAnalysisResult(data.visionPacket)
      
      return data.visionPacket

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Vision analysis failed'
      console.error('[TonyEyes] Analysis error:', errorMessage)
      setError(errorMessage)
      setAnalysisResult(null)
      throw err
    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  /**
   * Clear previous analysis results
   */
  const clearAnalysis = useCallback(() => {
    setAnalysisResult(null)
    setError(null)
  }, [])

  return {
    // State
    isAnalyzing,
    analysisResult,
    error,
    
    // Actions
    analyzeMap,
    clearAnalysis,
  }
}
