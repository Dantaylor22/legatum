import { useState, useRef, useEffect } from 'react'

// UK Postcode lookup using postcodes.io - free, open data, no API key required
// Data sourced from ONS/OS Open Data - legally clean, no Royal Mail licensing issues
// https://postcodes.io

function isValidPostcode(pc) {
  return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(pc.trim())
}

export default function AddressLookup({ value, onChange, placeholder = 'Start typing a postcode...' }) {
  const [postcode, setPostcode]         = useState('')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [mode, setMode]                 = useState('lookup') // lookup | manual
  const [postcodeFound, setPostcodeFound] = useState(false)
  const dropdownRef                     = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setPostcodeFound(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLookup() {
    const pc = postcode.trim().toUpperCase().replace(/\s+/g, '')
    if (!isValidPostcode(pc)) {
      setError('Please enter a valid UK postcode')
      return
    }
    setLoading(true)
    setError('')
    setPostcodeFound(false)
    try {
      const res = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (res.status === 404) {
        setError('Postcode not found - please enter address manually')
        setLoading(false)
        return
      }
      if (!res.ok) {
        setError('Lookup failed - please enter address manually')
        setLoading(false)
        return
      }
      const data = await res.json()
      const result = data.result
      if (!result) { setError('No result found'); setLoading(false); return }

      // Build a partial address from postcode data
      // postcodes.io gives us: admin_district (council), parish, region, postcode
      // Not full street addresses - those require paid data. We fill postcode + area.
      const area = [result.parish !== result.admin_district ? result.parish : null,
                    result.admin_district, result.region]
        .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ')

      const formattedPostcode = result.postcode
      onChange(formattedPostcode + (area ? ', ' + area : ''))
      setPostcodeFound(true)
      setPostcode('')
    } catch {
      setError('Could not reach postcode lookup - please enter address manually')
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'manual') {
    return (
      <div>
        <textarea className="input" style={{ minHeight: 72, resize: 'vertical' }}
          placeholder="Enter full address (e.g. 42 Example Road, London, SW1A 1AA)"
          value={value}
          onChange={e => onChange(e.target.value)} />
        <button type="button" onClick={() => { setMode('lookup'); setError('') }} style={{
          marginTop: 4, background: 'transparent', border: 'none',
          color: 'var(--gold)', fontSize: 12, cursor: 'pointer',
          fontFamily: 'var(--sans)', padding: 0,
        }}>
          Use postcode lookup instead
        </button>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Current value display */}
      {value && (
        <div style={{
          padding: '10px 12px', background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border-md)', borderRadius: 'var(--r)',
          fontSize: 13, color: 'var(--cream-dim)', marginBottom: 8,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
        }}>
          <span style={{ lineHeight: 1.5 }}>{value}</span>
          <button type="button" onClick={() => { onChange(''); setPostcodeFound(false) }} style={{
            flexShrink: 0, background: 'transparent', border: 'none',
            color: 'var(--text-sub)', fontSize: 16, cursor: 'pointer',
            lineHeight: 1, padding: '0 2px',
          }}>x</button>
        </div>
      )}

      {/* Postcode input + lookup button */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          placeholder={placeholder}
          value={postcode}
          onChange={e => { setPostcode(e.target.value); setError(''); setPostcodeFound(false) }}
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

      {postcodeFound && (
        <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4 }}>
          Postcode found. To add a full street address, click "Enter address manually".
        </div>
      )}

      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-sub)', lineHeight: 1.5 }}>
        Postcode lookup fills the area automatically.{' '}
        <button type="button" onClick={() => { setMode('manual'); setError('') }} style={{
          background: 'transparent', border: 'none',
          color: 'var(--text-sub)', fontSize: 11, cursor: 'pointer',
          fontFamily: 'var(--sans)', padding: 0, textDecoration: 'underline',
        }}>
          Enter full address manually instead
        </button>
      </div>
    </div>
  )
}
