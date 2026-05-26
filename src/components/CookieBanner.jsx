import { useState, useEffect } from 'react'

// Minimal PECR/GDPR cookie banner. The site only sets:
//   - strictly-necessary auth/session cookies (no consent needed)
//   - Crisp chat third-party cookies on public pages (consent required)
// So the only thing this banner gates is whether the Crisp script loads.
//
// Choice persists in localStorage as 'dr_cookie_consent' = 'accepted' | 'rejected'.
// Cleared by the user via Settings → "Manage cookie preferences" (TODO).

const KEY = 'dr_cookie_consent'

export default function CookieBanner() {
  const [choice, setChoice] = useState(() => {
    try { return localStorage.getItem(KEY) } catch { return null }
  })

  // Notify the rest of the app (main.jsx) when consent changes so it can
  // load Crisp without requiring a page reload.
  useEffect(() => {
    if (choice === 'accepted') {
      window.dispatchEvent(new CustomEvent('dr_cookie_accepted'))
    }
  }, [choice])

  if (choice === 'accepted' || choice === 'rejected') return null

  function set(v) {
    try { localStorage.setItem(KEY, v) } catch {}
    setChoice(v)
  }

  return (
    <div style={{
      position: 'fixed', bottom: 14, left: 14, right: 14, zIndex: 9000,
      maxWidth: 720, margin: '0 auto',
      background: '#0d1e30', border: '1px solid var(--gold-border)',
      borderRadius: 12, padding: '18px 22px',
      boxShadow: '0 10px 32px rgba(0,0,0,0.55)',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ fontSize: 13, color: 'var(--cream-dim)', lineHeight: 1.6 }}>
        We only use strictly-necessary cookies to keep you signed in and remember your preferences — those are always on. We'd also like to load <strong style={{ color: 'var(--text)' }}>Crisp</strong>, our live-chat support widget, which sets its own cookies. You can accept it now, or decline and reach us by email instead at hello@digitalrelative.co.uk.{' '}
        <a href="/privacy" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>Privacy policy</a>.
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button className="btn-ghost" style={{ fontSize: 12, padding: '8px 18px' }} onClick={() => set('rejected')}>
          Reject non-essential
        </button>
        <button className="btn-primary" style={{ fontSize: 12, padding: '8px 18px' }} onClick={() => set('accepted')}>
          Accept all
        </button>
      </div>
    </div>
  )
}
