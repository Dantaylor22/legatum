import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { user, profile, updateProfile, signOut } = useAuth()
  const [name, setName]               = useState(profile?.full_name || '')
  const [saving, setSaving]           = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState('')
  const [mfaFactors, setMfaFactors]   = useState([])
  const [showMfaSetup, setShowMfaSetup] = useState(false)
  const [qrCode, setQrCode]           = useState(null)
  const [mfaSecret, setMfaSecret]     = useState(null)
  const [mfaFactorId, setMfaFactorId] = useState(null)
  const [mfaCode, setMfaCode]         = useState('')
  const [verifying, setVerifying]     = useState(false)
  const isOAuth = user?.app_metadata?.provider === 'google' || user?.app_metadata?.provider === 'apple'

  useEffect(() => {
    loadMfaFactors()
  }, [])

  async function loadMfaFactors() {
    const { data } = await supabase.auth.mfa.listFactors()
    setMfaFactors(data?.totp || [])
  }

  async function startMfaSetup() {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Digital Relative' })
    if (error) { toast.error(error.message); return }
    setQrCode(data.totp.qr_code)
    setMfaSecret(data.totp.secret)
    setMfaFactorId(data.id)
    setShowMfaSetup(true)
  }

  async function verifyMfa() {
    setVerifying(true)
    try {
      const { error: challengeError, data: challengeData } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
      if (challengeError) throw challengeError
      const { error } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challengeData.id, code: mfaCode })
      if (error) throw error
      toast.success('Two-factor authentication enabled')
      setShowMfaSetup(false)
      setMfaCode('')
      loadMfaFactors()
    } catch (err) {
      toast.error(err.message || 'Invalid code')
    } finally {
      setVerifying(false)
    }
  }

  async function removeMfa(factorId) {
    if (!confirm('Remove two-factor authentication? This will make your account less secure.')) return
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    if (error) { toast.error(error.message); return }
    toast.success('2FA removed')
    loadMfaFactors()
  }

  async function handleSaveName() {
    setSaving(true)
    try { await updateProfile({ full_name: name }); toast.success('Name updated') }
    catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function handleExportData() {
    const id = toast.loading('Preparing export…')
    try {
      const [{ data: entries }, { data: bens }, { data: prof }] = await Promise.all([
        supabase.from('vault_entries').select('*').eq('user_id', user.id),
        supabase.from('beneficiaries').select('*').eq('user_id', user.id),
        supabase.from('profiles').select('*').eq('id', user.id).single(),
      ])
      const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), profile: prof, vault_entries: entries, beneficiaries: bens }, null, 2)], { type: 'application/json' })
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `digital-relative-export-${Date.now()}.json` })
      a.click()
      toast.dismiss(id); toast.success('Data exported')
    } catch (e) { toast.dismiss(id); toast.error(e.message) }
  }

  async function handleDeleteAccount() {
    if (confirmDelete !== 'DELETE') { toast.error('Type DELETE to confirm'); return }
    setDeleting(true)
    try {
      await supabase.functions.invoke('delete-account', { body: { userId: user.id } })
      await signOut()
    } catch (e) { toast.error(e.message); setDeleting(false) }
  }

  const hasMfa = mfaFactors.some(f => f.status === 'verified')

  return (
    <div>
      <div className="fade-up page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Manage your account, security, and data.</p>
      </div>

      {/* Profile */}
      <div className="fade-up-2 card-static" style={{ marginBottom: 18 }}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--cream)', marginBottom: 16 }}>Profile</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          <div>
            <label className="label">Full name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <label className="label">Email address</label>
            <input className="input" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
          </div>
        </div>
        {isOAuth && (
          <div style={{ fontSize: 12, color: 'var(--text-sub)', padding: '8px 12px', background: 'var(--gold-dim)', borderRadius: 'var(--r)', border: '1px solid var(--gold-border)', marginBottom: 14 }}>
            Signed in with {user?.app_metadata?.provider === 'google' ? 'Google' : 'Apple'} — security managed by your provider
          </div>
        )}
        <button className="btn-primary" onClick={handleSaveName} disabled={saving}>
          {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Save changes'}
        </button>
      </div>

      {/* MFA — only show for email users */}
      {!isOAuth && (
        <div className="fade-up-3 card-static" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <h3 style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--cream)' }}>Two-factor authentication</h3>
            <span className={`badge badge-${hasMfa ? 'green' : 'danger'}`}>{hasMfa ? 'Enabled' : 'Not enabled'}</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.7, marginBottom: 14 }}>
            {hasMfa
              ? 'Your account is protected with an authenticator app. We strongly recommend keeping this enabled.'
              : 'Your account is not protected with two-factor authentication. As this vault contains sensitive data, we strongly recommend enabling it.'}
          </p>

          {!hasMfa && !showMfaSetup && (
            <button className="btn-primary" onClick={startMfaSetup}>Enable 2FA</button>
          )}

          {hasMfa && mfaFactors.filter(f => f.status === 'verified').map(f => (
            <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>Authenticator app active</span>
              <button className="btn-danger" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => removeMfa(f.id)}>Remove</button>
            </div>
          ))}

          {showMfaSetup && (
            <div style={{ marginTop: 16, padding: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 500, marginBottom: 10 }}>Set up authenticator app</div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 14, lineHeight: 1.7 }}>
                Scan this QR code with Google Authenticator, Authy, or 1Password, then enter the 6-digit code to confirm.
              </div>
              {qrCode && <img src={qrCode} alt="MFA QR Code" style={{ width: 160, height: 160, marginBottom: 14, borderRadius: 8 }} />}
              {mfaSecret && (
                <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 14 }}>
                  Manual key: <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>{mfaSecret}</code>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input className="input" placeholder="000000" value={mfaCode} onChange={e => setMfaCode(e.target.value)}
                  maxLength={6} style={{ width: 140, textAlign: 'center', fontSize: 18, letterSpacing: '0.2em' }} />
                <button className="btn-primary" onClick={verifyMfa} disabled={verifying || mfaCode.length !== 6}>
                  {verifying ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Verify & enable'}
                </button>
                <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowMfaSetup(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Security */}
      {!isOAuth && (
        <div className="fade-up-3 card-static" style={{ marginBottom: 18 }}>
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--cream)', marginBottom: 8 }}>Password</h3>
          <p style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 14 }}>
            Your vault is encrypted with AES-256-GCM using a key derived from your password. Even Digital Relative cannot read your data.
          </p>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={async () => {
            await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: window.location.origin })
            toast.success('Password reset email sent')
          }}>Send password reset email</button>
        </div>
      )}

      {/* GDPR */}
      <div className="fade-up-4 card-static" style={{ marginBottom: 18 }}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--cream)', marginBottom: 8 }}>Your data (GDPR)</h3>
        <p style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.7, marginBottom: 14 }}>
          Under GDPR Article 20 you have the right to a copy of all data we hold. Your data is stored in the EU and never sold.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={handleExportData}>Export all my data (JSON)</button>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => toast('Contact privacy@digitalrelative.co.uk', { icon: '✉️' })}>Contact data controller</button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="fade-up-4 card-static" style={{ borderColor: 'rgba(224,82,82,0.25)' }}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--danger)', marginBottom: 8 }}>Delete account</h3>
        <p style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.7, marginBottom: 14 }}>
          Permanently deletes your account, all vault entries, beneficiaries, and uploaded files. Cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input" placeholder='Type "DELETE" to confirm' value={confirmDelete}
            onChange={e => setConfirmDelete(e.target.value)} style={{ width: 240, borderColor: 'rgba(224,82,82,0.3)' }} />
          <button className="btn-danger" onClick={handleDeleteAccount} disabled={deleting}>
            {deleting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Delete my account'}
          </button>
        </div>
      </div>
    </div>
  )
}
