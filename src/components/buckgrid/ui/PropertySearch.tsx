'use client'

import React, { useCallback, useRef, useState } from 'react'

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

interface Props {
  onResult: (lat: number, lng: number, label: string) => void
}

export default function PropertySearch({ onResult }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=1&countrycodes=us`
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json', 'User-Agent': 'BuckGridPro/1.0' },
      })
      if (!res.ok) throw new Error('Search failed')
      const results: NominatimResult[] = await res.json()
      if (results.length === 0) {
        setError('No results — try a city, county, or coordinates')
        return
      }
      const { lat, lon, display_name } = results[0]
      onResult(parseFloat(lat), parseFloat(lon), display_name)
      setQuery('')
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError('Search unavailable — try coordinates (lat, lng)')
    } finally {
      setLoading(false)
    }
  }, [onResult])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') search(query)
  }, [query, search])

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      return
    }
    setLoading(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onResult(coords.latitude, coords.longitude, 'My Location')
        setLoading(false)
      },
      () => {
        setError('Location access denied')
        setLoading(false)
      },
      { timeout: 8000 }
    )
  }, [onResult])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Search row */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Address or coordinates..."
          disabled={loading}
          style={{
            flex: 1,
            minWidth: 0,
            background: '#0D1A0B',
            border: '1px solid #243020',
            borderRadius: '4px',
            color: '#D4C9A8',
            fontSize: '11px',
            padding: '7px 9px',
            outline: 'none',
            opacity: loading ? 0.5 : 1,
            transition: 'border-color 0.12s ease, box-shadow 0.12s ease',
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = '#E8840A'
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(232,132,10,0.15), inset 0 0 8px rgba(232,132,10,0.04)'
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = '#243020'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
        <button
          onClick={() => search(query)}
          disabled={loading || !query.trim()}
          style={{
            background: loading || !query.trim() ? '#1E2E1A' : '#E8840A',
            border: '1px solid transparent',
            borderRadius: '4px',
            color: loading || !query.trim() ? '#4A5A3A' : '#080F07',
            fontSize: '11px',
            fontWeight: 700,
            padding: '7px 10px',
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
            transition: 'background 0.12s ease, color 0.12s ease',
            flexShrink: 0,
            letterSpacing: '0.04em',
          }}
          aria-label="Search"
        >
          {loading ? '...' : 'GO'}
        </button>
      </div>

      {/* Use my location */}
      <button
        onClick={useMyLocation}
        disabled={loading}
        style={{
          background: 'transparent',
          border: '1px solid #1E2E1A',
          borderRadius: '4px',
          color: '#7A8A68',
          fontSize: '9px',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
          padding: '5px 8px',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.4 : 1,
          transition: 'color 0.12s ease, border-color 0.12s ease',
          textAlign: 'left' as const,
          width: '100%',
        }}
        onMouseEnter={e => {
          if (!loading) {
            e.currentTarget.style.color = '#E8840A'
            e.currentTarget.style.borderColor = '#E8840A50'
          }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = '#7A8A68'
          e.currentTarget.style.borderColor = '#1E2E1A'
        }}
      >
        + Use my location
      </button>

      {/* Error */}
      {error && (
        <div style={{
          fontSize: '9.5px',
          color: '#C49020',
          lineHeight: '1.4',
          padding: '4px 6px',
          background: 'rgba(196, 144, 32, 0.08)',
          border: '1px solid rgba(196, 144, 32, 0.2)',
          borderRadius: '3px',
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
