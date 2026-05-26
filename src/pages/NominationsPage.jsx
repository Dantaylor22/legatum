import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

// In-app page showing every account that has nominated the current user as
// a beneficiary. Same data source as BeneficiaryDashboard (which is the
// standalone post-signup view for beneficiary-only accounts) but rendered
// inside the sidebar layout for accounts that have their own vault.

const STATUS_CONFIG = {
  invited:         { label: 'Invited — action needed', color: 'var(--text-sub)', badge: 'badge-muted',  icon: '📧' },
  email_confirmed: { label: 'You accepted',            color: '#e8a44c',         badge: 'badge-muted',  icon: '✉️' },
  id_verified:     { label: 'ID verified',             color: 'var(--success)',  badge: 'badge-green',  icon: '✓' },
  access_granted:  { label: 'Access granted',          color: 'var(--gold)',     badge: 'badge-gold',   icon: '🔓' },
  declined:        { label: 'You declined',            color: 'var(--danger)',   badge: 'badge-danger', icon: '✗' },
}

export default function NominationsPage() {
  const { user } = useAuth()
  const [nominations, setNominations] = useState([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('beneficiaries')
      .select(`
        id, user_id, name, relation, email, access_level, access_requirement,
        status, invite_token, emergency_access_token, is_executor, linked_user_id,
        created_at,
        owner:user_id (id, full_name)
      `)
      .eq('linked_user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setNominations(data || [])
        setLoading(false)
      })
  }, [user])

  async function handleDecline(benId) {
    if (!confirm('Decline this nomination? The vault owner will be notified and you will be removed from their beneficiary list.')) return
    const { error } = await supabase.from('beneficiaries')
      .update({ status: 'declined' })
      .eq('id', benId)
      .eq('linked_user_id', user.id)
    if (error) { toast.error('Could not decline'); return }
    setNominations(prev => prev.map(n => n.id === benId ? { ...n, status: 'declined' } : n))
    toast.success('Nomination declined')
  }

  async function handleAccept(benId) {
    const nomination = nominations.find(n => n.id === benId)
    const isTrustOnly = nomination?.access_requirement === 'trust_only'

    if (isTrustOnly) {
      // trust_only: edge function grants access (RLS forbids direct update to access_granted)
      const { error } = await supabase.functions.invoke('send-beneficiary-invite', {
        body: { beneficiaryId: benId, action: 'accept_trust_only' },
      })
      if (error) { toast.error('Could not accept nomination'); return }
      setNominations(prev => prev.map(n => n.id === benId ? { ...n, status: 'access_granted' } : n))
      toast.success('Accepted — vault access granted')
    } else {
      const { error } = await supabase.from('beneficiaries')
        .update({ status: 'email_confirmed' })
        .eq('id', benId)
        .eq('linked_user_id', user.id)
      if (error) { toast.error('Could not accept'); return }
      setNominations(prev => prev.map(n => n.id === benId ? { ...n, status: 'email_confirmed' } : n))
      toast.success('Nomination accepted')
    }
  }

  return (
    <div>
      <div className="fade-up page-header">
        <h1 className="page-title">I am a beneficiary for</h1>
        <p className="page-sub">Accounts that have nominated you as a beneficiary. You can accept or decline each one.</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}><span className="spinner" /></div>
      ) : nominations.length === 0 ? (
        <div className="fade-up-2 empty">
          <div className="empty-icon">🛡</div>
          <div className="empty-text">No-one has nominated you yet</div>
          <div>When another Digital Relative account adds you as a beneficiary, they'll show up here.</div>
        </div>
      ) : (
        <div className="fade-up-2" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {nominations.map(n => {
            const config = STATUS_CONFIG[n.status] || STATUS_CONFIG.invited
            return (
              <div key={n.id} className="card-static">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--gold-dim)', border: '1px solid var(--gold-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--gold)',
                  }}>
                    {(n.owner?.full_name || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 3 }}>
                      {n.owner?.full_name || 'Unknown account'}
                      {n.is_executor && <span className="badge badge-gold" style={{ marginLeft: 8, fontSize: 10 }}>Executor</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 10, lineHeight: 1.6 }}>
                      {n.relation ? `${n.relation} · ` : ''}
                      Access level: <strong style={{ color: 'var(--text)' }}>{n.access_level}</strong> ·{' '}
                      Verification required: <strong style={{ color: 'var(--text)' }}>{(n.access_requirement || 'death_certificate').replace(/_/g, ' ')}</strong> ·{' '}
                      Added {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className={`badge ${config.badge}`}>{config.icon} {config.label}</span>

                      {n.status === 'invited' && (
                        <>
                          <button className="btn-primary" style={{ fontSize: 11, padding: '4px 12px' }}
                            onClick={() => handleAccept(n.id)}>Accept</button>
                          <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 12px' }}
                            onClick={() => handleDecline(n.id)}>Decline</button>
                        </>
                      )}

                      {n.status === 'email_confirmed' && (
                        <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                          Identity verification will be required when access is needed.
                        </span>
                      )}

                      {n.status === 'id_verified' && (
                        <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                          You are fully verified — access will be granted when the conditions on this nomination are met.
                        </span>
                      )}

                      {n.status === 'access_granted' && (
                        <a href={`/beneficiary?token=${n.emergency_access_token || n.invite_token}`}
                          style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none', padding: '4px 12px', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', borderRadius: 6 }}>
                          Open vault →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="fade-up-3 card-static" style={{ marginTop: 24, background: 'rgba(255,255,255,0.03)' }}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--cream)', marginBottom: 8 }}>How nominations work</h3>
        <p style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.7 }}>
          Anyone with a Digital Relative account can nominate you as a beneficiary using your email address. You can accept or decline each nomination. If you accept, you will only be granted access to that person's vault if the conditions they have set are met — for example, after their check-in fails or a death certificate is provided and verified. You can revoke your acceptance at any time by signing out and revisiting this page.
        </p>
      </div>
    </div>
  )
}
