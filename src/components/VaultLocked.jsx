import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

// Shown when the vault is locked due to inactivity
// User must re-enter password to re-derive the encryption key
export default function VaultLocked() {
  const { user, signIn, signOut } = useAuth()
  const [password, setPassword]   = useState('')
  const [loading, setLoading]     = useState(false)

  async function handleUnlock(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await signIn({ email: user.email, password })
      toast.success('Vault unlocked')
      setPassword('')
    } catch (err) {
      toast.error('Incorrect password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(5,12,20,0.97)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0d1e30', border: '1px solid rgba(201,168,76,0.3)',
        borderRadius: 16, padding: '40px 36px', width: 380, maxWidth: '92vw',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 26, color: 'var(--cream)', marginBottom: 8 }}>
          Vault locked
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 24, lineHeight: 1.6 }}>
          Your vault was locked after 30 minutes of inactivity. Re-enter your password to continue.
        </div>
        <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            className="input"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            style={{ textAlign: 'center' }}
          />
          <button className="btn-primary" type="submit" disabled={loading || !password} style={{ padding: 12 }}>
            {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Unlock vault'}
          </button>
          <button type="button" onClick={signOut} style={{
            background: 'transparent', border: 'none', color: 'var(--text-sub)',
            fontSize: 12, cursor: 'pointer', marginTop: 4,
          }}>
            Sign out instead
          </button>
        </form>
      </div>
    </div>
  )
}
