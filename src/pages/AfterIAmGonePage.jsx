import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DEFAULT_GUIDE_SECTIONS } from '../lib/afterIamGone'
import toast from 'react-hot-toast'

function StepCard({ step, sectionId, onToggleRequired, onEditDetail, isOwner }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(step.detail)

  return (
    <div style={{
      padding: '16px 0', borderBottom: '1px solid var(--border)',
      display: 'flex', gap: 14,
    }}>
      {/* Number / check */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: step.required ? 'var(--gold-dim)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${step.required ? 'var(--gold-border)' : 'var(--border)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--serif)', fontSize: 13,
        color: step.required ? 'var(--gold)' : 'var(--text-sub)',
      }}>✓</div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ fontWeight: 500, fontSize: 14, flex: 1 }}>{step.title}</div>
          {isOwner && (
            <div style={{ display: 'flex', gap: 6, marginLeft: 12, flexShrink: 0 }}>
              <button onClick={() => onToggleRequired(sectionId, step.id)} style={{
                background: 'transparent', border: `1px solid ${step.required ? 'var(--gold-border)' : 'var(--border)'}`,
                borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer',
                color: step.required ? 'var(--gold)' : 'var(--text-sub)', fontFamily: 'var(--sans)',
              }}>{step.required ? '✓ Included' : '○ Excluded'}</button>
              {!editing && (
                <button onClick={() => { setEditing(true); setDraft(step.detail) }} style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer',
                  color: 'var(--text-sub)', fontFamily: 'var(--sans)',
                }}>Edit</button>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <div>
            <textarea value={draft} onChange={e => setDraft(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--gold-border)',
                borderRadius: 'var(--r)', color: 'var(--text)', padding: '10px 12px', fontSize: 13,
                fontFamily: 'var(--sans)', resize: 'vertical', minHeight: 80, outline: 'none' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => { onEditDetail(sectionId, step.id, draft); setEditing(false) }}
                className="btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}>Save</button>
              <button onClick={() => setEditing(false)}
                className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: 'var(--cream-dim)', lineHeight: 1.7 }}>{step.detail}</p>
            {step.link && (
              <a href={step.link} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: 'var(--gold)', marginTop: 6, display: 'inline-block' }}>
                Official guidance →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Beneficiary view — clean checklist mode
function BeneficiaryView({ sections }) {
  const [checked, setChecked] = useState({})
  const requiredSteps = sections.flatMap(s => s.steps.filter(st => st.required))

  function toggle(id) {
    setChecked(p => ({ ...p, [id]: !p[id] }))
  }

  const done  = Object.values(checked).filter(Boolean).length
  const total = requiredSteps.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div>
      {/* Progress */}
      <div className="card-static" style={{ marginBottom: 24, textAlign: 'center', padding: '28px 24px' }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 28, color: 'var(--gold)', marginBottom: 6 }}>{pct}%</div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 14 }}>{done} of {total} tasks complete</div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)', borderRadius: 3, transition: 'width 0.4s' }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 12, lineHeight: 1.6 }}>
          We know this is an incredibly difficult time. Take each step at your own pace.<br />
          You don't need to do everything at once.
        </div>
      </div>

      {sections.map(section => {
        const required = section.steps.filter(s => s.required)
        if (required.length === 0) return null
        return (
          <div key={section.id} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 20 }}>{section.icon}</span>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--cream)' }}>{section.title}</h2>
            </div>
            <div className="card-static" style={{ padding: 0, overflow: 'hidden' }}>
              {required.map((step, idx) => (
                <div key={step.id} onClick={() => toggle(step.id)} style={{
                  padding: '16px 20px', cursor: 'pointer', transition: 'background 0.15s',
                  background: checked[step.id] ? 'rgba(76,175,130,0.06)' : 'transparent',
                  borderBottom: idx < required.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                    background: checked[step.id] ? 'var(--success)' : 'transparent',
                    border: `2px solid ${checked[step.id] ? 'var(--success)' : 'var(--border-md)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}>
                    {checked[step.id] && <span style={{ color: '#0d1b2a', fontSize: 12, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: 500, fontSize: 14, marginBottom: 4,
                      textDecoration: checked[step.id] ? 'line-through' : 'none',
                      color: checked[step.id] ? 'var(--text-sub)' : 'var(--text)',
                    }}>{step.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--cream-dim)', lineHeight: 1.7 }}>{step.detail}</div>
                    {step.link && !checked[step.id] && (
                      <a href={step.link} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: 12, color: 'var(--gold)', marginTop: 6, display: 'inline-block' }}>
                        Official guidance →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AfterIAmGonePage({ isBeneficiaryView = false, overrideSections = null }) {
  const { user } = useAuth()
  const [sections, setSections] = useState(DEFAULT_GUIDE_SECTIONS)
  const [saving, setSaving]     = useState(false)
  const [loaded, setLoaded]     = useState(false)
  const [activeSection, setActiveSection] = useState(DEFAULT_GUIDE_SECTIONS[0].id)

  useEffect(() => {
    async function loadGuide() {
      if (!user) return
      const { data } = await supabase
        .from('after_i_am_gone')
        .select('guide_data')
        .eq('user_id', user.id)
        .single()

      if (overrideSections) {
        setSections(overrideSections)
      } else if (data?.guide_data?.sections) {
        setSections(data.guide_data.sections)
      }
      setLoaded(true)
    }
    loadGuide()
  }, [user])

  async function save(newSections) {
    setSaving(true)
    try {
      await supabase.from('after_i_am_gone').upsert({
        user_id: user.id,
        guide_data: { sections: newSections, updated_at: new Date().toISOString() },
      }, { onConflict: 'user_id' })
      toast.success('Guide saved')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  function toggleRequired(sectionId, stepId) {
    const updated = sections.map(s => s.id !== sectionId ? s : {
      ...s,
      steps: s.steps.map(st => st.id !== stepId ? st : { ...st, required: !st.required }),
    })
    setSections(updated)
    save(updated)
  }

  function editDetail(sectionId, stepId, detail) {
    const updated = sections.map(s => s.id !== sectionId ? s : {
      ...s,
      steps: s.steps.map(st => st.id !== stepId ? st : { ...st, detail }),
    })
    setSections(updated)
    save(updated)
  }

  if (isBeneficiaryView) {
    return (
      <div>
        <div className="fade-up page-header">
          <h1 className="page-title" style={{ fontSize: 28 }}>What to do now</h1>
          <p className="page-sub">A step-by-step guide prepared for you</p>
        </div>
        <BeneficiaryView sections={sections} />
      </div>
    )
  }

  const currentSection = sections.find(s => s.id === activeSection)
  const includedCount  = sections.flatMap(s => s.steps.filter(st => st.required)).length

  return (
    <div>
      <div className="fade-up page-header">
        <h1 className="page-title">After I'm Gone</h1>
        <p className="page-sub">A guide your family will see when they access your vault</p>
      </div>

      {/* Intro card */}
      <div className="fade-up-2 card-static" style={{ borderColor: 'var(--gold-border)', background: 'var(--gold-dim)', marginBottom: 24 }}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 17, color: 'var(--gold)', marginBottom: 8 }}>How this works</h3>
        <p style={{ fontSize: 13, color: 'var(--cream-dim)', lineHeight: 1.7 }}>
          We've prepared a complete step-by-step guide covering everything your family will need to do — from registering the death to cancelling subscriptions. Review each section, mark steps as included or excluded, and personalise the details. Your beneficiaries will see this as a clean, easy-to-follow checklist when they unlock the vault.
        </p>
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--gold)' }}>
          {includedCount} steps currently included
        </div>
      </div>

      <div className="fade-up-3" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
        {/* Section nav */}
        <div>
          {sections.map(s => {
            const included = s.steps.filter(st => st.required).length
            return (
              <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
                width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 4,
                borderRadius: 'var(--r)', border: activeSection === s.id ? '1px solid var(--gold-border)' : '1px solid transparent',
                background: activeSection === s.id ? 'var(--gold-dim)' : 'transparent',
                color: activeSection === s.id ? 'var(--gold)' : 'var(--text-sub)',
                cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 16 }}>{s.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: activeSection === s.id ? 500 : 400 }}>{s.title}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{included} steps</div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Section content */}
        <div className="card-static">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <span style={{ fontSize: 24 }}>{currentSection?.icon}</span>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--cream)' }}>{currentSection?.title}</h2>
          </div>
          {currentSection?.steps.map(step => (
            <StepCard key={step.id}
              step={step}
              sectionId={currentSection.id}
              onToggleRequired={toggleRequired}
              onEditDetail={editDetail}
              isOwner={true}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
