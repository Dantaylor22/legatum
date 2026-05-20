import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { deriveKey, decrypt, getSessionKey, setSessionKey } from '../lib/crypto'
import { formatPin } from '../lib/vaultPin'
import toast from 'react-hot-toast'

const CLIPBOARD_CLEAR_SECONDS = 60

// Securely copies a stored password to clipboard
// Password is NEVER displayed on screen
// Clipboard is automatically cleared after 60 seconds
export default function PasswordReveal({ encryptedPassword, entryTitle, onClose }) {
  const { user, profile } = useAuth()
  const [step, setStep]       = useState('pin')   // pin | mfa | done
  const [pin, setPin]         = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(CLIPBOARD_CLEAR_SECONDS)
  const [cleared, setCleared] = useState(false)
  const timerRef              = useRef(null)
  const hasMfa = profile?.vault_pin_set // if PIN is set, check for MFA too

  useEffect(() => () => clearInterval(timerRef.current), [])

  // Countdown after copy
  useEffect(() => {
    if (step !== 'done') return
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current)
          clearClipboard()
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [step])

  async function clearClipboard() {
    try {
      const current = await navigator.clipboard.readText()
      // Only clear if we put something there (we can't know exactly what, so clear anyway)
      await navigator.clipboard.writeText('')
      setCleared(true)
    } catch {}
  }

  async function handlePin(e) {
    e.preventDefault()
    if (pin.length < 6) { toast.error('Enter your vault PIN'); return }
    setLoading(true)
    try {
      // Check for MFA factors
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const hasVerifiedMfa = factors?.totp?.some(f => f.status === 'verified')

      if (hasVerifiedMfa) {
        setStep('mfa')
      } else {
        await copyPassword(pin)
      }
    } catch (err) {
      toast.error(err.message || 'Incorrect PIN')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  async function handleMfa(e) {
    e.preventDefault()
    if (mfaCode.length !== 6) { toast.error('Enter your 6-digit code'); return }
    setLoading(true)
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totp = factors?.totp?.find(f => f.status === 'verified')
      if (!totp) throw new Error('No MFA factor found')

      const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: totp.id })
      const { error } = await supabase.auth.mfa.verify({
        factorId: totp.id,
        challengeId: challenge.id,
        code: mfaCode,
      })
      if (error) throw new Error('Invalid code')
      await copyPassword(pin)
    } catch (err) {
      toast.error(err.message || 'Verification failed')
      setMfaCode('')
    } finally {
      setLoading(false)
    }
  }

  async function copyPassword(enteredPin) {
    // Re-derive key from PIN
    const salt = profile?.encryption_salt
    if (!salt) throw new Error('Vault configuration error')

    const key = await deriveKey(enteredPin, user.id, salt)

    // Temporarily use this key to decrypt
    const prevKey = getSessionKey()
    setSessionKey(key)

    let plaintext
    try {
      plaintext = await decrypt(encryptedPassword)
    } catch {
      setSessionKey(prevKey)
      throw new Error('Incorrect PIN')
    }
    setSessionKey(prevKey)

    // Copy to clipboard — never store in state
    await navigator.clipboard.writeText(plaintext)

    // Immediately overwrite the plaintext variable
    plaintext = null

    setStep('done')
  }

  return (
    <div className="modal-overlay" onClick={step === 'done' ? onClose : undefined}>
      <div className="modal" style={{ width: 380 }} onClick={e => e.stopPropagation()}>

        {step === 'pin' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🔐</div>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 21, color: 'var(--cream)', marginBottom: 6 }}>
                Copy password
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>
                Enter your vault PIN to copy <strong style={{ color: 'var(--text)' }}>{entryTitle}</strong>'s password to your clipboard. It will never be shown on screen.
              </p>
            </div>
            <form onSubmit={handlePin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input className="input" type="password" inputMode="numeric"
                placeholder="Vault PIN"
                value={pin} onChange={e => setPin(formatPin(e.target.value))}
                maxLength={12} autoFocus
                style={{ textAlign: 'center', fontSize: 22, letterSpacing: '0.4em', padding: '14px' }} />
              <button className="btn-primary" type="submit" disabled={loading || pin.length < 6} style={{ padding: 12, width: '100%' }}>
                {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Copy to clipboard'}
              </button>
              <button type="button" className="btn-ghost" onClick={onClose} style={{ width: '100%' }}>Cancel</button>
            </form>
          </>
        )}

        {step === 'mfa' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📱</div>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 21, color: 'var(--cream)', marginBottom: 6 }}>
                Two-factor verification
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                Enter the 6-digit code from your authenticator app.
              </p>
            </div>
            <form onSubmit={handleMfa} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input className="input" placeholder="000000"
                value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6} autoFocus
                style={{ textAlign: 'center', fontSize: 24, letterSpacing: '0.3em', padding: '14px' }} />
              <button className="btn-primary" type="submit" disabled={loading || mfaCode.length !== 6} style={{ padding: 12, width: '100%' }}>
                {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Copy to clipboard'}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setStep('pin')} style={{ width: '100%' }}>← Back</button>
            </form>
          </>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>{cleared ? '✓' : '📋'}</div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--success)', marginBottom: 8 }}>
              {cleared ? 'Clipboard cleared' : 'Copied to clipboard'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 20, lineHeight: 1.6 }}>
              {cleared
                ? 'The clipboard has been automatically cleared for your security.'
                : `The password was copied without being shown on screen. Clipboard clears automatically in ${countdown} seconds.`}
            </p>

            {!cleared && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${(countdown / CLIPBOARD_CLEAR_SECONDS) * 100}%`,
                    background: countdown <= 15 ? 'var(--danger)' : 'var(--success)',
                    transition: 'width 1s linear, background 0.3s',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 6 }}>
                  Clearing in {countdown}s
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {!cleared && (
                <button className="btn-danger" onClick={() => { clearClipboard(); onClose() }}
                  style={{ fontSize: 13 }}>
                  Clear now
                </button>
              )}
              <button className="btn-primary" onClick={onClose} style={{ fontSize: 13, padding: '10px 24px' }}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
