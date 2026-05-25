import { useState, useRef, useEffect } from 'react'

// UK Postcode lookup using postcodes.io - free, open data, no API key required
// Data sourced from ONS/OS Open Data - legally clean, no Royal Mail licensing issues
// After postcode lookup, user can edit the address freely to add house number/name

function isValidPostcode(pc) {
  return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(pc.trim())
}

export default function AddressLookup({ value, onChange, placeholder = 'Start typing a postcode...' }) {
  const [postcode, setPostcode] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [mode, setMode]         = useState('lookup') // lookup | edit
  const dropdownRef             = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {}
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLookup() {
    const pc = postcode.trim().toUpperCase().replace(/\s+/g, '')
    if (!isValidPostcode(pc)) { setError('Please enter a valid UK postcode'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (res.status === 404) { setError('Postcode not found'); setLoading(false); return }
      if (!res.ok) { setError('Lookup failed - enter manually'); setLoading(false); return }
      const data = await res.json()
      const r = data.result
      if (!r) { setError('No result found'); setLoading(false); return }

      // Build area string from postcode data
      const parts = [r.parish !== r.admin_district ? r.parish : null, r.admin_district, r.region]
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
      const area = parts.join(', ')
      const formatted = r.postcode + (area ? ', ' + area : '')

      // Set value and switch to edit mode so user can add house number
      onChange(formatted)
      setMode('edit')
      setPostcode('')
    } catch {
      setError('Could not reach postcode lookup - enter manually')
    } finally {
      setLoading(false)
    }
  }

  // Edit mode - show a textarea with the current value so user can refine it
  if (mode === 'edit' || value) {
    return (
      <div ref={dropdownRef}>
        <textarea
          className="input"
          style={{ minHeight: 72, resize: 'vertical', fontSize: 13 }}
          placeholder="e.g. 42 High Street, London, SW1A 1AA"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <button type="button" onClick={() => { setMode('lookup'); setError('') }} style={{
            background: 'transparent', border: 'none', color: 'var(--gold)',
            fontSize: 12, cursor: 'pointer', fontFamily: 'var(--sans)', padding: 0,
          }}>
            Search another postcode
          </button>
          {value && (
            <button type="button" onClick={() => { onChange(''); setMode('lookup') }} style={{
              background: 'transparent', border: 'none', color: 'var(--text-sub)',
              fontSize: 12, cursor: 'pointer', fontFamily: 'var(--sans)', padding: 0,
            }}>
              Clear
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          placeholder={placeholder}
          value={postcode}
          onChange={e => { setPostcode(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleLookup())}
          style={{ flex: 1, textTransform: 'uppercase' }}
          maxLength={8}
        />
        <button type="button" onClick={handleLookup} disabled={loading || !postcode.trim()} style={{
          background: 'var(--gold)', border: 'none', borderRadius: 'var(--r)',
          color: '#0d1b2a', fontWeight: 600, fontSize: 13, padding: '0 16px',
          cursor: loading || !postcode.trim() ? 'not-allowed' : 'pointer',
          opacity: loading || !postcode.trim() ? 0.6 : 1,
          fontFamily: 'var(--sans)', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {loading ? '...' : 'Find'}
        </button>
      </div>

      {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{error}</div>}

      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-sub)' }}>
        Postcode lookup fills area automatically. You can then edit to add house number or name.{' '}
        <button type="button" onClick={() => setMode('edit')} style={{
          background: 'transparent', border: 'none', color: 'var(--text-sub)',
          fontSize: 11, cursor: 'pointer', fontFamily: 'var(--sans)', padding: 0, textDecoration: 'underline',
        }}>
          Enter full address manually
        </button>
      </div>
    </div>
  )
}
