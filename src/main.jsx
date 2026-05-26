import { StrictMode } from 'react'

import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)

// ── Crisp live chat — gated on cookie consent ───────────────────────────────
// Crisp sets third-party cookies, so under PECR / UK GDPR we can only load it
// after the user accepts non-essential cookies. The CookieBanner component
// stores consent in localStorage as 'dr_cookie_consent' = 'accepted'.
// We also defer to the post-React-mount tick so the banner can render first.
const CRISP_ID = import.meta.env.VITE_CRISP_WEBSITE_ID

function loadCrisp() {
  if (!CRISP_ID || window.$crisp) return
  window.$crisp = []
  window.CRISP_WEBSITE_ID = CRISP_ID
  const s = document.createElement('script')
  s.src   = 'https://client.crisp.chat/l.js'
  s.async = true
  document.head.appendChild(s)

  // Hide Crisp widget while vault is unlocked (belt-and-suspenders against
  // third-party JS touching memory adjacent to the decrypted vault state).
  const observer = new MutationObserver(() => {
    const vaultOpen = document.body?.dataset?.vaultOpen === 'true'
    if (window.$crisp?.push) {
      window.$crisp.push(vaultOpen ? ['do', 'chat:hide'] : ['do', 'chat:show'])
    }
  })
  observer.observe(document.body || document.documentElement, { attributes: true, attributeFilter: ['data-vault-open'] })
}

if (CRISP_ID) {
  let consent = null
  try { consent = localStorage.getItem('dr_cookie_consent') } catch {}
  if (consent === 'accepted') {
    loadCrisp()
  } else {
    // Listen for the cookie banner accepting consent later in the session.
    window.addEventListener('dr_cookie_accepted', loadCrisp, { once: true })
  }
}

// ── Service worker registration ──────────────────────────────────────────────
// Registered after React mounts so it doesn't block the first render
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch(() => {}) // SW is enhancement only - never block the app
  })
}
