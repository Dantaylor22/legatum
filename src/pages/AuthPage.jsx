import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

function TreeLogo({ size = 60 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <g transform="translate(50,58)">
        <rect x="-4" y="6" width="8" height="24" rx="2" fill="#c9a84c"/>
        <path d="M-4,30 Q-11,36 -18,32 M4,30 Q11,36 18,32 M0,30 L0,36" fill="none" stroke="#c9a84c" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M0,6 L0,-5 M0,0 L-16,-14 M0,0 L16,-14 M-16,-14 L-26,-26 M-16,-14 L-10,-28 M16,-14 L26,-26 M16,-14 L10,-28 M0,-5 L-6,-21 M0,-5 L6,-21" fill="none" stroke="#c9a84c" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="-26" cy="-30" r="6" fill="#c9a84c"/>
        <circle cx="-10" cy="-32" r="5" fill="#c9a84c" opacity="0.85"/>
        <circle cx="26" cy="-30" r="6" fill="#c9a84c"/>
        <circle cx="10" cy="-32" r="5" fill="#c9a84c" opacity="0.85"/>
        <circle cx="-6" cy="-25" r="4" fill="#c9a84c" opacity="0.9"/>
        <circle cx="6" cy="-25" r="4" fill="#c9a84c" opacity="0.9"/>
        <circle cx="0" cy="-38" r="7" fill="#c9a84c"/>
      </g>
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
      <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
      <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 814 1000" fill="currentColor">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.3-161-39.3c-73.8 0-98.8 40.2-163.2 40.2s-108.3-57.6-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.3 269-317.3 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.6-49.1 192.5-49.1 31 0 110.7 2.6 173.4 66.5zm-165.4-100.7c-3.9-22.5-16.8-50.7-36.3-73.7-23.8-27.1-62.2-48.4-100.8-48.4-1.3 0-2.6 0-3.9.1 1.3 24.4 12.3 48.7 30.5 68.5 19.5 21.3 56.6 43.6 110.5 53.5z"/>
    </svg>
  )
}

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode]         = useState('signin')
  const [loading, setLoading]   = useState(false)
  const [oauthLoading, setOauthLoading] = useState(null)
  const [mfaRequired, setMfaRequired]   = useState(false)
  const [mfaCode, setMfaCode]           = useState('')
  const [factorId, setFactorId]         = useState(null)
  const [form, setForm] = useState({ email: '', password: '', fullName: '', confirmPassword: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleOAuth(provider) {
    setOauthLoading(provider)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
          scopes: provider === 'apple' ? 'email name' : 'email profile',
        },
      })
      if (error) throw error
    } catch (err) {
      toast.error(err.message || `${provider} sign in failed`)
      setOauthLoading(null)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (mode === 'signup' && form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return }
    if (form.password.length < 10) { toast.error('Password must be at least 10 characters'); return }
    setLoading(true)
    try {
      if (mode === 'signin') {
        const result = await signIn({ email: form.email, password: form.password })
        // Check if MFA is required
        if (result?.nextStep === 'mfa') {
          setFactorId(result.factorId)
          setMfaRequired(true)
          toast('Please enter your authenticator code')
        } else {
          toast.success('Welcome back')
        }
      } else {
        await signUp({ email: form.email, password: form.password, fullName: form.fullName })
        toast.success('Account created — check your email to confirm, then set up 2FA in Settings')
      }
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleMFA(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: mfaCode,
      })
      if (error) throw error
      toast.success('Welcome back')
    } catch (err) {
      toast.error(err.message || 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  const btnStyle = {
    width: '100%', padding: '11px', borderRadius: 'var(--r)',
    fontSize: 13, fontFamily: 'var(--sans)', fontWeight: 500,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    cursor: 'pointer', transition: 'all 0.15s', border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.05)', color: 'var(--text)',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--navy)',
      backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(201,168,76,0.04) 0%, transparent 60%)',
    }}>
      <div style={{ width: 420, maxWidth: '92vw' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <TreeLogo size={64} />
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 34, fontWeight: 600, color: 'var(--gold)', lineHeight: 1 }}>Digital Relative</div>
          <div style={{ fontSize: 11, color: 'var(--text-sub)', letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 6 }}>Secure Legacy Vault</div>
        </div>

        {mfaRequired ? (
          <div className="card-static fade-up" style={{ padding: 32 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--cream)', marginBottom: 8 }}>Two-factor authentication</div>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 20 }}>Enter the 6-digit code from your authenticator app.</div>
            <form onSubmit={handleMFA} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input className="input" placeholder="000000" value={mfaCode} onChange={e => setMfaCode(e.target.value)}
                maxLength={6} style={{ textAlign: 'center', fontSize: 22, letterSpacing: '0.3em' }} autoFocus />
              <button className="btn-primary" type="submit" disabled={loading || mfaCode.length !== 6} style={{ width: '100%', padding: 12 }}>
                {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Verify'}
              </button>
            </form>
          </div>
        ) : (
          <div className="card-static fade-up" style={{ padding: 32 }}>
            {/* OAuth buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <button style={btnStyle} onClick={() => handleOAuth('google')} disabled={!!oauthLoading}>
                {oauthLoading === 'google' ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <GoogleIcon />}
                Continue with Google
              </button>
              <button style={btnStyle} onClick={() => handleOAuth('apple')} disabled={!!oauthLoading}>
                {oauthLoading === 'apple' ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <AppleIcon />}
                Continue with Apple
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* Email/password tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--r)', padding: 4 }}>
              {['signin', 'signup'].map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  flex: 1, padding: '8px', borderRadius: 6, border: 'none',
                  background: mode === m ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: mode === m ? 'var(--text)' : 'var(--text-sub)',
                  fontSize: 13, fontWeight: mode === m ? 500 : 400, transition: 'all 0.15s', cursor: 'pointer',
                }}>
                  {m === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {mode === 'signup' && (
                <div>
                  <label className="label">Full name</label>
                  <input className="input" type="text" placeholder="Jane Smith" value={form.fullName} onChange={e => set('fullName', e.target.value)} required />
                </div>
              )}
              <div>
                <label className="label">Email address</label>
                <input className="input" type="email" placeholder="you@email.com" value={form.email} onChange={e => set('email', e.target.value)} required />
              </div>
              <div>
                <label className="label">Password {mode === 'signup' && '(min. 10 characters)'}</label>
                <input className="input" type="password" placeholder="••••••••••" value={form.password} onChange={e => set('password', e.target.value)} required />
              </div>
              {mode === 'signup' && (
                <div>
                  <label className="label">Confirm password</label>
                  <input className="input" type="password" placeholder="••••••••••" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} required />
                </div>
              )}
              {mode === 'signup' && (
                <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6, padding: '10px 12px', background: 'var(--gold-dim)', borderRadius: 'var(--r)', border: '1px solid var(--gold-border)' }}>
                  🔒 AES-256 encrypted · MFA required · EU data storage
                </div>
              )}
              <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 4, width: '100%', padding: 12 }}>
                {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            {mode === 'signup' && (
              <p style={{ fontSize: 11, color: 'var(--text-sub)', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
                By creating an account you agree to our{' '}
                <a href="/privacy.html" target="_blank">Privacy Policy</a> and{' '}
                <a href="/terms.html" target="_blank">Terms of Service</a>.
              </p>
            )}
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-sub)', marginTop: 20 }}>
          AES-256 encrypted · MFA enforced · GDPR compliant · EU storage
        </p>
      </div>
    </div>
  )
}
