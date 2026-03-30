'use client'

import { useState, useEffect, useCallback } from 'react'

export interface PropertyMemory {
  name: string
  acres: number
  lastAnalysis: string
  date: string
}

const STORAGE_KEY = 'buckgrid_property_memory'

function loadFromStorage(): PropertyMemory | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PropertyMemory
  } catch {
    return null
  }
}

function saveToStorage(data: PropertyMemory): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // storage unavailable — fail silently
  }
}

export function usePropertyMemory() {
  const [memory, setMemory] = useState<PropertyMemory | null>(null)
  const [savedIndicator, setSavedIndicator] = useState(false)
  const [hasRestorable, setHasRestorable] = useState(false)

  useEffect(() => {
    const stored = loadFromStorage()
    if (stored) setHasRestorable(true)
  }, [])

  const save = useCallback((data: PropertyMemory) => {
    saveToStorage(data)
    setMemory(data)
    setSavedIndicator(true)
    const timer = setTimeout(() => setSavedIndicator(false), 2500)
    return () => clearTimeout(timer)
  }, [])

  const restore = useCallback((): PropertyMemory | null => {
    const stored = loadFromStorage()
    if (stored) {
      setMemory(stored)
      setHasRestorable(false)
    }
    return stored
  }, [])

  const clear = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY)
    }
    setMemory(null)
    setHasRestorable(false)
  }, [])

  return { memory, save, restore, clear, savedIndicator, hasRestorable }
}
