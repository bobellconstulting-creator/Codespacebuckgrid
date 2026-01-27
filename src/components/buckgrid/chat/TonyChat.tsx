'use client'

import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState, useEffect } from 'react'
import html2canvas from 'html2canvas'
import type { TerrainInputs } from '../terrain/TerrainPanel'
import { buildPlanPayload } from '@/lib/buildPlanPayload'

export type TonyChatHandle = { 
  addTonyMessage: (text: string) => void,
  addUserMessage: (text: string) => void,
  addSystemMessage: (text: string) => void,
  quickCheck: (feature: { type: string, name: string, acres: number, note?: string }) => void,
  assessProperty: () => void
}

const TonyChat = forwardRef<TonyChatHandle, { 
  getCaptureTarget: () => HTMLElement | null, 
  getGeoJSON: () => any,
  getLockedBordersGeoJSON?: () => any,
  getMapContext?: () => { center: { lat: number, lng: number }, zoom: number },
  terrainInputs?: TerrainInputs,
  onApiStatus?: (status: string) => void,
  onSuggestedMarks?: (marks: any[]) => void
}>(({ getCaptureTarget, getGeoJSON, getLockedBordersGeoJSON, getMapContext, terrainInputs, onApiStatus, onSuggestedMarks }, ref) => {
  const [chat, setChat] = useState([{ role: 'tony', text: "System initialized. Awaiting property boundary data. Lock border to begin analysis." }])
  const [input, setInput] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<any>(null)
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set())
  const scrollDummyRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollDummyRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  useEffect(() => {
    // Initialize Web Speech API
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = false
        recognitionRef.current.interimResults = false
        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript
          setInput(prev => prev + ' ' + transcript)
          setIsRecording(false)
        }
        recognitionRef.current.onerror = () => setIsRecording(false)
        recognitionRef.current.onend = () => setIsRecording(false)
      }
    }
  }, [])

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition not supported in this browser')
      return
    }
    if (isRecording) {
      recognitionRef.current.stop()
      setIsRecording(false)
    } else {
      recognitionRef.current.start()
      setIsRecording(true)
    }
  }

  useImperativeHandle(ref, () => ({ 
    addTonyMessage: (text: string) => setChat(p => [...p, { role: 'tony', text }]),
    addUserMessage: (text: string) => setChat(p => [...p, { role: 'user', text }]),
    addSystemMessage: (text: string) => setChat(p => [...p, { role: 'system', text }]),
    quickCheck: (feature: { type: string, name: string, acres: number, note?: string }) => {
      // Auto-trigger quick acreage check for this feature
      quickCheckFeature(feature)
    },
    assessProperty: () => {
      // Trigger comprehensive property assessment
      assessFullProperty()
    }
  }), [])

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const renderMessage = (text: string, index: number) => {
    console.log('[renderMessage] Rendering message:', { index, textLength: text.length, preview: text.substring(0, 100) })
    
    // Check if this is a Site Audit (new format)
    const hasGood = text.includes('**THE GOOD')
    const hasRisk = text.includes('**THE RISK')
    const hasFix = text.includes('**THE FIX')
    const hasViolations = text.includes('**ACREAGE VIOLATIONS')
    const hasWind = text.includes('**WIND ANALYSIS')
    
    // Check if this is old analysis/evaluation format
    const hasSummary = text.includes('**SUMMARY') || text.includes('**ANALYSIS SUMMARY')
    const hasOverview = text.includes('**OVERVIEW')
    const hasActions = text.includes('**TOP ACTIONS') || text.includes('**PRIORITY ACTIONS')
    const hasWarnings = text.includes('**WARNINGS') || text.includes('**CRITICAL WARNINGS')
    
    const isStructured = hasGood || hasRisk || hasFix || hasViolations || hasWind || hasSummary || hasOverview || hasActions || hasWarnings
    
    if (!isStructured) {
      // Regular message - display as-is
      console.log('[renderMessage] Rendering as plain text')
      return <div key={index} style={{ alignSelf: 'flex-start', background: '#222', padding: '8px 12px', borderRadius: '10px', fontSize: '11px', maxWidth: '85%', whiteSpace: 'pre-wrap' }}>{text}</div>
    }
    
    console.log('[renderMessage] Rendering as structured analysis')
    
    // Parse sections
    const sections: Array<{title: string, content: string}> = []
    
    // Site Audit sections (priority)
    const goodMatch = text.match(/\*\*THE GOOD[^\*]*\*\*:(.*?)(?=\*\*|$)/s)
    const riskMatch = text.match(/\*\*THE RISK[^\*]*\*\*:(.*?)(?=\*\*|$)/s)
    const fixMatch = text.match(/\*\*THE FIX[^\*]*\*\*:(.*?)(?=\*\*|$)/s)
    const violationsMatch = text.match(/\*\*ACREAGE VIOLATIONS[^\*]*\*\*:(.*?)(?=\*\*|$)/s)
    const windMatch = text.match(/\*\*WIND ANALYSIS[^\*]*\*\*:(.*?)(?=\*\*|$)/s)
    
    // Old format sections (fallback)
    const summaryMatch = text.match(/\*\*(ANALYSIS )?SUMMARY[^\*]*\*\*:(.*?)(?=\*\*|$)/s)
    const overviewMatch = text.match(/\*\*OVERVIEW[^\*]*\*\*:(.*?)(?=\*\*|$)/s)
    const actionsMatch = text.match(/\*\*(PRIORITY ACTIONS|TOP ACTIONS)[^\*]*\*\*:(.*?)(?=\*\*|$)/s)
    const warningsMatch = text.match(/\*\*(CRITICAL )?WARNINGS[^\*]*\*\*:(.*?)(?=\*\*|$)/s)
    
    if (goodMatch) sections.push({ title: 'THE GOOD ✓', content: goodMatch[1].trim() })
    if (riskMatch) sections.push({ title: 'THE RISK ⚠', content: riskMatch[1].trim() })
    if (fixMatch) sections.push({ title: 'THE FIX 🔧', content: fixMatch[1].trim() })
    if (violationsMatch) sections.push({ title: 'ACREAGE VIOLATIONS ❌', content: violationsMatch[1].trim() })
    if (windMatch) sections.push({ title: 'WIND ANALYSIS 💨', content: windMatch[1].trim() })
    
    // Fallback to old format
    if (summaryMatch) sections.push({ title: 'SUMMARY', content: summaryMatch[2].trim() })
    if (overviewMatch) sections.push({ title: 'OVERVIEW', content: overviewMatch[1].trim() })
    if (actionsMatch) sections.push({ title: actionsMatch[1], content: actionsMatch[2].trim() })
    if (warningsMatch) sections.push({ title: 'WARNINGS', content: warningsMatch[2].trim() })
    
    console.log('[renderMessage] Parsed sections:', sections.length)
    
    return (
      <div key={index} style={{ alignSelf: 'flex-start', background: '#222', padding: '8px 12px', borderRadius: '10px', fontSize: '11px', maxWidth: '85%', width: '100%' }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: '#4ade80', marginBottom: 8 }}>TONY ANALYSIS</div>
        {sections.map((section, sIdx) => {
          const sectionKey = index * 100 + sIdx
          // Auto-expand first section by default
          const isExpanded = expandedSections.has(sectionKey) || (sIdx === 0 && !expandedSections.has(-(index * 100)))
          return (
            <div key={sIdx} style={{ marginBottom: 6, borderTop: sIdx > 0 ? '1px solid #333' : 'none', paddingTop: sIdx > 0 ? 6 : 0 }}>
              <div 
                onClick={() => toggleSection(sectionKey)} 
                style={{ cursor: 'pointer', fontWeight: 700, fontSize: 10, color: '#FF6B00', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}
              >
                <span>{section.title}</span>
                <span>{isExpanded ? '▼' : '▶'}</span>
              </div>
              {isExpanded && (
                <div style={{ fontSize: 10, color: '#ccc', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{section.content}</div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const analyze = async () => {
    if (loading) return
    setLoading(true)
    setChat(p => [...p, { role: 'user', text: '🔍 Analyze Plan' }, { role: 'tony', text: '⏳ Analyzing...' }])
    try {
      const geoJSON = getGeoJSON()
      const lockedBorders = getLockedBordersGeoJSON ? getLockedBordersGeoJSON() : { type: 'FeatureCollection', features: [] }
      const mapContext = getMapContext ? getMapContext() : { center: { lat: 0, lng: 0 }, zoom: 0 }
      
      // Build comprehensive plan payload
      const payload = buildPlanPayload({
        geoJSON,
        lockedBordersGeoJSON: lockedBorders,
        terrainInputs: terrainInputs || {},
        mapContext
      })
      
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          plan: payload.plan,
          planJson: { 
            layers: geoJSON.features,
            layersWithDetails: payload.plan.layers
          },
          lockedBordersGeoJSON: lockedBorders,
          terrainInputs: terrainInputs || {},
          mapContext
        })
      })
      const data = await res.json()
      console.log('[ANALYZE] Response:', { status: res.status, data })
      
      // Remove loading message
      setChat(p => p.slice(0, -1))
      
      if (!res.ok) {
        onApiStatus?.('Error')
        const errorMsg = data.error || `Analysis failed (HTTP ${res.status})`
        console.error('[ANALYZE] Error:', { status: res.status, error: errorMsg, data })
        if (errorMsg.includes('OPENROUTER_API_KEY')) {
          setChat(p => [...p, { role: 'tony', text: '❌ OPENROUTER_API_KEY missing. Check server .env.local file.' }])
        } else if (errorMsg.includes('locked border')) {
          setChat(p => [...p, { role: 'tony', text: '❌ Lock a property border first, then draw some features.' }])
        } else if (errorMsg.includes('No features')) {
          setChat(p => [...p, { role: 'tony', text: '❌ Draw some features first (food plots, bedding, etc.)' }])
        } else {
          setChat(p => [...p, { role: 'tony', text: `❌ ${errorMsg}` }])
        }
      } else {
        onApiStatus?.('OK')
        const analysisText = data.analysis || data.evaluation || 'No analysis returned'
        const suggestedMarks = data.suggestedMarks || []
        console.log('[ANALYZE] ✅ SUCCESS!')
        console.log('[ANALYZE] Analysis text:', analysisText)
        console.log('[ANALYZE] Suggested marks:', suggestedMarks)
        console.log('[ANALYZE] Full response data:', data)
        
        // Notify parent component with suggested marks
        if (suggestedMarks.length > 0) {
          onSuggestedMarks?.(suggestedMarks)
        }
        
        // Display analysis with mark count if any
        let displayText = analysisText
        if (suggestedMarks.length > 0) {
          displayText += `\n\n---\n\n✨ **${suggestedMarks.length} SUGGESTED MARKS** added to map (toggle "Tony Suggestions" layer)`
        }
        
        console.log('[ANALYZE] Adding to chat:', displayText)
        setChat(p => [...p, { role: 'tony', text: displayText }])
      }
    } catch (err) {
      console.error(err)
      onApiStatus?.('Error')
      setChat(p => p.slice(0, -1))
      setChat(p => [...p, { role: 'tony', text: '❌ Analysis failed. Check your API key and connection.' }])
    }
    setLoading(false)
  }

  const assessFullProperty = async () => {
    console.log('[assessFullProperty] Starting comprehensive assessment')
    
    setLoading(true)
    setChat(p => [...p, { role: 'tony', text: '⏳ Analyzing entire property layout...' }])
    
    try {
      onApiStatus?.('Analyzing Property')
      
      const geoJSON = getGeoJSON()
      const mapContext = getMapContext?.()
      const borders = getLockedBordersGeoJSON?.()
      
      // Build comprehensive property summary
      const featureSummary = geoJSON.features.map((f: any) => {
        const props = f.properties || {}
        return `- ${props.toolName || 'Unknown'}: ${props.acres?.toFixed(1) || 'N/A'} acres${props.note ? ` (${props.note})` : ''}`
      }).join('\n')
      
      const totalAcres = geoJSON.features.reduce((sum: number, f: any) => sum + (f.properties?.acres || 0), 0)
      
      const prompt = `You are Tony, an elite Whitetail Habitat Consultant. A user has finished laying out their property and wants your COMPLETE tactical assessment.

**PROPERTY LAYOUT:**
${featureSummary || 'No features drawn yet'}

**TOTAL ACREAGE IN FEATURES:** ${totalAcres.toFixed(1)} acres

${terrainInputs ? `**TERRAIN CONTEXT:**
- Season: ${terrainInputs.seasonPhase}
- Cover Type: ${terrainInputs.coverType}
- Elevation: ${terrainInputs.elevation}
- Wind: ${terrainInputs.predominantWind || 'Unknown'}
- Access Points: ${terrainInputs.accessPoints || 'Not specified'}
- Pressure Concerns: ${terrainInputs.pressureConcerns || 'None noted'}
- Goals: ${terrainInputs.goals || 'Not specified'}
- Additional Notes: ${terrainInputs.terrainNotes || 'None'}
` : '**TERRAIN CONTEXT:** Not yet provided - analyze based on layout only\n'}

${mapContext ? `**MAP CENTER:** ${mapContext.center.lat.toFixed(6)}, ${mapContext.center.lng.toFixed(6)}` : ''}

**YOUR MISSION - PROVIDE A COMPLETE ASSESSMENT NOW:**

Deliver a comprehensive property analysis that covers:

## 1. LAYOUT CRITIQUE
Analyze the spatial arrangement. Food plot positioning, screen placement, stand locations. What's working and what needs adjustment?

## 2. PRESSURE & ACCESS
Entry/exit strategies. Where will human scent betray you? How to minimize pressure on bedding areas?

## 3. DEER MOVEMENT & FUNNELS
How will deer flow through this property? Natural pinch points, staging areas, travel corridors. Morning vs evening patterns.

## 4. GAPS & MISSING ELEMENTS
What critical features are missing? Where to invest next? Quick wins vs long-term projects?

## 5. TACTICAL GAME PLAN
Specific hunting strategies for this layout. Stand setups for different wind directions. Season-specific tactics (early, rut, late). Concrete recommendations.

## 6. PRIORITY ACTION LIST
Numbered list of immediate next steps in order of importance.

**CRITICAL INSTRUCTIONS:**
- Provide COMPLETE analysis in this single response
- Don't ask clarifying questions - work with what you haveCOMPLETE tactical property assessments in a single comprehensive response. Do NOT ask clarifying questions - analyze what you have and deliver actionable strategies. Use markdown formatting with clear sections.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 4000ic with coordinates/locations when possible
- Use markdown formatting (## headers, bullet points, **bold**)
- Be honest but constructive
- Focus on ACTIONABLE tactics, not theory

This is your comprehensive assessment - make it count.`

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [
            { role: 'system', content: 'You are Tony, an elite Whitetail Habitat Consultant. Provide tactical, actionable property assessments with specific hunting strategies.' },
            { role: 'user', content: prompt }
          ]
        })
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      const assessment = data.choices?.[0]?.message?.content || 'No assessment generated'
      
      console.log('[assessFullProperty] Assessment received')
      onApiStatus?.('Ready')
      
      // Replace loading message with full assessment
      setChat(p => {
        const updated = [...p]
        updated[updated.length - 1] = { role: 'tony', text: assessment }
        return updated
      })
    } catch (err) {
      console.error('[assessFullProperty] Error:', err)
      onApiStatus?.('Error')
      setChat(p => {
        const updated = [...p]
        updated[updated.length - 1] = { role: 'tony', text: '❌ Property assessment failed. Check API connection.' }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }

  const quickCheckFeature = async (feature: { type: string, name: string, acres: number, note?: string }) => {
    console.log('[quickCheckFeature] Checking:', feature)
    
    setLoading(true)
    setChat(p => [...p, { role: 'tony', text: '⏳ Quick check...' }])
    
    try {
      onApiStatus?.('Checking')
      
      // Determine if this is a screen/cover type
      const isScreen = feature.type.includes('screen') || 
                       feature.name === 'EGYPTIAN' || 
                       feature.name === 'SWITCHGRASS' || 
                       feature.name === 'MISCANTHUS' ||
                       feature.name === 'SCREEN'
      
      // Build quick assessment prompt with updated logic
      const prompt = `You are Tony, an elite Whitetail Habitat Partner (NOT a judge). A user just drew this feature:

**FEATURE:**
- Type: ${feature.name} (${feature.type})
- Acreage: ${feature.acres} acres
${feature.note ? `- Notes: ${feature.note}` : ''}

**CRITICAL LOGIC - SCREENS vs FOOD:**

**SCREENS/COVER (No minimum acreage):**
- Egyptian Wheat, Switchgrass, Miscanthus, Generic Screen
- Purpose: Visual barrier, thermal cover, access concealment
- Even 0.1 acres can work as a strip screen
- NO acreage requirement - it's about placement, not size

**FOOD PLOTS (Strict minimums):**
- **Grain (Milo/Corn/Beans):** Minimum 3 acres. <3 acres = browse pressure destroys it
- **Clover/Brassicas:** Minimum 0.5 acres (handles pressure better)
- **Bedding:** Minimum 1 acre for sanctuary. <1 acre = loafing area

**PARTNER MODE - ASK BEFORE JUDGING:**
- If ambiguous (small plot, narrow strip), ASK CLARIFYING QUESTIONS instead of failing it
- Example: "That's a tight spot. Are you using this as a screen, or trying to squeeze a kill plot in there?"
- Example: "Narrow strip detected. Is this a visual barrier along the trail, or actual feeding area?"

**OUTPUT FORMAT:**
- If PASS: "✅ ${feature.name}: ${feature.acres} acres - [why it works]"
- If SCREEN/COVER: "✅ ${feature.name}: ${feature.acres} acres - Screen/cover placement matters more than size. [tactical tip]"
- If AMBIGUOUS: "🤔 ${feature.name}: ${feature.acres} acres - [Ask clarifying question about intent]"
- If CLEAR FAIL: "❌ ${feature.name}: ${feature.acres} acres - [specific reason]. Minimum: [X] acres for feeding."

Be a partner, not a judge. Ask questions when unsure.`

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [
            { role: 'system', content: 'You are Tony, an elite Whitetail Habitat Partner. ASK QUESTIONS before judging ambiguous features. Understand screens vs food.' },
            { role: 'user', content: prompt }
          ]
        })
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      const feedback = data.choices?.[0]?.message?.content || 'No response'
      
      console.log('[quickCheckFeature] Feedback:', feedback)
      onApiStatus?.('Ready')
      
      // Replace loading message with feedback
      setChat(p => {
        const updated = [...p]
        updated[updated.length - 1] = { role: 'tony', text: feedback }
        return updated
      })
    } catch (err) {
      console.error('[quickCheckFeature] Error:', err)
      onApiStatus?.('Error')
      setChat(p => {
        const updated = [...p]
        updated[updated.length - 1] = { role: 'tony', text: '❌ Quick check failed. Continue drawing and run full analysis.' }
        return updated
      })
    }
    
    setLoading(false)
  }

  const send = async () => {
    if (!input.trim() || loading) return
    const userMessage = input
    setLoading(true); setChat(p => [...p, { role: 'user', text: userMessage }]); setInput('')
    try {
      const target = getCaptureTarget()
      const canvas = await html2canvas(target!, { useCORS: true, scale: 1 })
      
      // Build conversation history including system messages (feature metadata injections)
      const conversationHistory = chat.map(msg => ({
        role: msg.role === 'tony' ? 'assistant' : msg.role,
        text: msg.text
      }))
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage, 
          imageDataUrl: canvas.toDataURL('image/jpeg', 0.6),
          history: conversationHistory
        })
      })
      const data = await res.json()
      setChat(p => [...p, { role: 'tony', text: data.reply }])
    } catch { setChat(p => [...p, { role: 'tony', text: 'Capture failed.' }]) }
    setLoading(false)
  }

  const evaluate = async () => {
    if (loading) return
    setLoading(true)
    setChat(p => [...p, { role: 'user', text: '🏞️ Evaluate Property' }, { role: 'tony', text: '⏳ Evaluating...' }])
    try {
      const geoJSON = getGeoJSON()
      const lockedBorders = getLockedBordersGeoJSON ? getLockedBordersGeoJSON() : { type: 'FeatureCollection', features: [] }
      const mapContext = getMapContext ? getMapContext() : { center: { lat: 0, lng: 0 }, zoom: 0 }
      
      // Build comprehensive plan payload
      const payload = buildPlanPayload({
        geoJSON,
        lockedBordersGeoJSON: lockedBorders,
        terrainInputs: terrainInputs || {},
        mapContext
      })
      
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          plan: payload.plan,
          lockedBordersGeoJSON: lockedBorders,
          terrainInputs: terrainInputs || {},
          mapContext,
          features: geoJSON.features,
          layersWithDetails: payload.plan.layers
        })
      })
      const data = await res.json()
      console.log('[EVALUATE] Response:', { status: res.status, data })
      
      // Remove loading message
      setChat(p => p.slice(0, -1))
      
      if (!res.ok) {
        onApiStatus?.('Error')
        const errorMsg = data.error || `Evaluation failed (HTTP ${res.status})`
        console.error('[EVALUATE] Error:', { status: res.status, error: errorMsg, data })
        if (errorMsg.includes('OPENROUTER_API_KEY')) {
          setChat(p => [...p, { role: 'tony', text: '❌ OPENROUTER_API_KEY missing. Check server .env.local file.' }])
        } else if (errorMsg.includes('Lock a border')) {
          setChat(p => [...p, { role: 'tony', text: '❌ Lock a property border first to evaluate.' }])
        } else {
          setChat(p => [...p, { role: 'tony', text: `❌ ${errorMsg}` }])
        }
      } else {
        onApiStatus?.('OK')
        const evaluationText = data.evaluation || data.analysis || 'No evaluation returned'
        console.log('[EVALUATE] ✅ SUCCESS!')
        console.log('[EVALUATE] Evaluation text:', evaluationText)
        console.log('[EVALUATE] Full response data:', data)
        console.log('[EVALUATE] Adding to chat:', evaluationText)
        setChat(p => [...p, { role: 'tony', text: evaluationText }])
      }
    } catch (err) {
      console.error(err)
      onApiStatus?.('Error')
      setChat(p => p.slice(0, -1))
      setChat(p => [...p, { role: 'tony', text: '❌ Property evaluation failed. Check your API key and connection.' }])
    }
    setLoading(false)
  }

  return (
    <div className="glass" style={{ position: 'absolute', right: 10, top: 10, width: isOpen ? 300 : 50, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh', pointerEvents: 'auto' }}>
      <div onClick={() => setIsOpen(!isOpen)} style={{ padding: 12, background: loading ? '#4ade80' : '#1a1a1a', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 10, transition: 'background 0.3s' }}>
        <span>{isOpen ? (loading ? '⏳ TONY WORKING...' : 'TONY PARTNER') : '🦌'}</span>
        <span>{isOpen ? '—' : '+'}</span>
      </div>
      {isOpen && (
        <>
          <div ref={containerRef} className="chatArea">
            {chat.map((m, i) => {
              // Hide system messages from user (they're metadata for AI only)
              if (m.role === 'system') {
                return null
              }
              if (m.role === 'user') {
                return <div key={i} style={{ alignSelf: 'flex-end', background: '#FF6B00', padding: '8px 12px', borderRadius: '10px', fontSize: '11px', maxWidth: '85%' }}>{m.text}</div>
              } else {
                return renderMessage(m.text, i)
              }
            })}
            <div ref={scrollDummyRef} />
          </div>
          <div style={{ padding: 10, borderTop: '1px solid #222' }}>
            <div style={{ fontSize: 9, color: '#666', marginBottom: 8, textAlign: 'center' }}>
              {chat.length} messages • Last: {loading ? 'Processing...' : 'Ready'}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button onClick={evaluate} disabled={loading} style={{ flex: 1, background: '#3b82f6', color: '#fff', border: 'none', padding: 10, borderRadius: 6, fontWeight: 900, cursor: 'pointer', fontSize: 10, opacity: loading ? 0.5 : 1 }}>
                🏞️ EVALUATE PROPERTY
              </button>
              <button onClick={analyze} disabled={loading} style={{ flex: 1, background: '#4ade80', color: '#000', border: 'none', padding: 10, borderRadius: 6, fontWeight: 900, cursor: 'pointer', fontSize: 10, opacity: loading ? 0.5 : 1 }}>
                🔍 ANALYZE PLAN
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} style={{ flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: 8, borderRadius: 6 }} placeholder="Message..." />
              <button onClick={toggleRecording} disabled={loading} style={{ background: isRecording ? '#dc2626' : '#64748b', color: '#fff', border: 'none', padding: '0 12px', borderRadius: 6, cursor: 'pointer', fontSize: 16 }}>
                {isRecording ? '⏹' : '🎤'}
              </button>
              <button onClick={send} disabled={loading} style={{background: '#FF6B00', color: '#000', border: 'none', padding: '0 12px', borderRadius: 6, cursor: 'pointer', opacity: loading ? 0.5 : 1}}>➤</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
})

export default React.memo(TonyChat)
