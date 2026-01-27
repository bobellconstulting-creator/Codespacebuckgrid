'use client'

import { useState, useEffect } from 'react'

export type Plan = {
  id: string
  name: string
  createdAt: number
  mapCenter: { lat: number; lng: number }
  zoom: number
  layers: any[]
  terrainInputs: any
  analysisHistory: Array<{ timestamp: number; result: string }>
  border?: {
    points: Array<{ lat: number; lng: number }>
    locked: boolean
    acres: number
  }
}

type PlanManagerProps = {
  onSave: () => Plan
  onLoad: (plan: Plan) => void
  onNewPlan: () => void
  onExportPlan: (plan: Plan) => void
  onExportReport: () => void
  onExportCSV: () => void
}

export function PlanManager({ onSave, onLoad, onNewPlan, onExportPlan, onExportReport, onExportCSV }: PlanManagerProps) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [showNameDialog, setShowNameDialog] = useState(false)
  const [planName, setPlanName] = useState('')

  useEffect(() => {
    // Load plans index from localStorage
    const indexJson = localStorage.getItem('buckgrid_plans_index')
    if (indexJson) {
      try {
        const index = JSON.parse(indexJson)
        const loadedPlans: Plan[] = []
        for (const item of index) {
          const planJson = localStorage.getItem(`buckgrid_plan_${item.id}`)
          if (planJson) {
            loadedPlans.push(JSON.parse(planJson))
          }
        }
        setPlans(loadedPlans)
      } catch (e) {
        console.error('Failed to load plans:', e)
      }
    }
  }, [])

  const savePlans = (newPlans: Plan[]) => {
    setPlans(newPlans)
    // Save index
    const index = newPlans.map(p => ({ id: p.id, name: p.name, updatedAt: Date.now() }))
    localStorage.setItem('buckgrid_plans_index', JSON.stringify(index))
    // Save individual plans
    for (const plan of newPlans) {
      localStorage.setItem(`buckgrid_plan_${plan.id}`, JSON.stringify(plan))
    }
  }

  const handleSave = () => {
    setShowNameDialog(true)
  }

  const confirmSave = () => {
    if (!planName.trim()) return
    const plan = onSave()
    plan.name = planName.trim()
    const existing = plans.findIndex(p => p.id === plan.id)
    if (existing >= 0) {
      const updated = [...plans]
      updated[existing] = plan
      savePlans(updated)
    } else {
      savePlans([...plans, plan])
    }
    setPlanName('')
    setShowNameDialog(false)
  }

  const handleLoad = (plan: Plan) => {
    if (confirm(`Load plan "${plan.name}"? Current work will be replaced.`)) {
      onLoad(plan)
      setIsExpanded(false)
    }
  }

  const handleDuplicate = (plan: Plan) => {
    const copy = { ...plan, id: Date.now().toString(), name: `${plan.name} (copy)`, createdAt: Date.now() }
    savePlans([...plans, copy])
  }

  const handleDelete = (id: string) => {
    if (confirm('Delete this plan?')) {
      savePlans(plans.filter(p => p.id !== id))
    }
  }

  const handleNewPlan = () => {
    if (confirm('Start new plan? Current work will be cleared.')) {
      onNewPlan()
      setIsExpanded(false)
    }
  }

  return (
    <div className="glass" style={{ position: 'absolute', right: 10, top: 10, padding: 12, borderRadius: 12, minWidth: 200, maxWidth: 300 }}>
      {/* FIX 3: Prominent GREEN Save Project Button */}
      <button onClick={handleSave} style={{ width: '100%', background: '#10b981', color: '#000', padding: '12px 16px', borderRadius: 8, fontWeight: 900, cursor: 'pointer', marginBottom: 12, border: 'none', fontSize: 13 }}>
        💾 SAVE PROJECT
      </button>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: '#3b82f6', letterSpacing: 1 }}>PLANS</div>
        <button onClick={() => setIsExpanded(!isExpanded)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14 }}>
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: isExpanded ? 12 : 0 }}>
        <button onClick={handleNewPlan} className="glass" style={{ flex: 1, padding: '6px 10px', border: 'none', borderRadius: 6, color: '#facc15', fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>
          ✨ NEW
        </button>
        <button onClick={onExportReport} className="glass" style={{ flex: 1, padding: '6px 10px', border: 'none', borderRadius: 6, color: '#c084fc', fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>
          📄 REPORT
        <button onClick={onExportCSV} className="glass" style={{ flex: 1, padding: '6px 10px', border: 'none', borderRadius: 6, color: '#10b981', fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>
          📊 CSV
        </button>
        </button>
      </div>

      {isExpanded && (
        <>
          <div style={{ maxHeight: 300, overflowY: 'auto', marginTop: 12 }}>
            {plans.length === 0 ? (
              <div style={{ color: '#666', fontSize: 10, textAlign: 'center', padding: 20 }}>No saved plans</div>
            ) : (
              plans.map(plan => (
                <div key={plan.id} className="glass" style={{ padding: 8, marginBottom: 6, borderRadius: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{plan.name}</div>
                  <div style={{ fontSize: 9, color: '#999', marginBottom: 6 }}>
                    {new Date(plan.createdAt).toLocaleDateString()} {new Date(plan.createdAt).toLocaleTimeString()}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleLoad(plan)} style={{ flex: 1, background: '#3b82f6', border: 'none', borderRadius: 4, color: '#fff', fontSize: 9, padding: 4, cursor: 'pointer' }}>
                      LOAD
                    </button>
                    <button onClick={() => handleDuplicate(plan)} style={{ flex: 1, background: '#64748b', border: 'none', borderRadius: 4, color: '#fff', fontSize: 9, padding: 4, cursor: 'pointer' }}>
                      COPY
                    </button>
                    <button onClick={() => onExportPlan(plan)} style={{ flex: 1, background: '#10b981', border: 'none', borderRadius: 4, color: '#fff', fontSize: 9, padding: 4, cursor: 'pointer' }}>
                      JSON
                    </button>
                    <button onClick={() => handleDelete(plan.id)} style={{ flex: 1, background: '#dc2626', border: 'none', borderRadius: 4, color: '#fff', fontSize: 9, padding: 4, cursor: 'pointer' }}>
                      DEL
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {showNameDialog && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div className="glass" style={{ padding: 20, borderRadius: 12, minWidth: 300 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Save Plan</div>
            <input
              type="text"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="Plan name..."
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && confirmSave()}
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #444', background: '#222', color: '#fff', marginBottom: 12 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setPlanName(''); setShowNameDialog(false); }} style={{ flex: 1, background: '#64748b', border: 'none', borderRadius: 6, color: '#fff', padding: 8, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmSave} style={{ flex: 1, background: '#4ade80', border: 'none', borderRadius: 6, color: '#000', fontWeight: 700, padding: 8, cursor: 'pointer' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
