import { StrictMode } from 'react'

// Global error catcher - log everything before ErrorBoundary swallows it
window.addEventListener('error', e => {
  console.error('GLOBAL ERROR:', e.message, e.filename, e.lineno)
})
window.addEventListener('unhandledrejection', e => {
  console.error('UNHANDLED PROMISE:', e.reason)
})
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
