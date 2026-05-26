import { useState, useRef, useEffect, useCallback } from 'react'

// Royal Mail AddressNow Capture integration
// Type any part of an address or postcode - autocompletes against full PAF database
// Falls back to structured manual entry if key not configured

const ADDRESSNOW_KEY = import.meta.env.VITE_ADDRESSNOW_KEY || ''

const EMPTY_FIELDS = { company: '', street: '', line2: '', town: '', county: '', postcode: '' }

// Stored format: `{company}\n{street}, {line2}, {town}, {county}, {postcode}` (blanks dropped).
// The \n is the only reliable delimiter for company vs postal address; everything else is
// comma-separated. Renders as a space in summary <div>s but parses unambiguously.
function parseAddress(str) {
  if (!str) return { ...EMPTY_FIELDS }
  let company = ''
  let rest = str
  const nlIdx = str.indexOf('\n')
  if (nlIdx !== -1) {
    company = str.slice(0, nlIdx).trim()
    rest = str.slice(nlIdx + 1).trim()
  }
  const parts = rest.split(',').map(s => s.trim()).filter(Boolean)

  // Pop trailing UK postcode if present.
  const ukPostcode = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}$/i
  let postcode = ''
  if (parts.length && ukPostcode.test(parts[parts.length - 1])) {
    postcode = parts.pop().toUpperCase()
  }

  // Best-effort placement for the remaining parts. Old saved addresses don't have an
  // explicit company line, so 1–4 surviving parts get mapped into street/line2/town/county.
  let street = '', line2 = '', town = '', county = ''
  if (parts.length === 1) { street = parts[0] }
  else if (parts.length === 2) { street = parts[0]; town = parts[1] }
  else if (parts.length === 3) { street = parts[0]; line2 = parts[1]; town = parts[2] }
  else if (parts.length >= 4) {
    street = parts[0]; line2 = parts[1]
    town = parts[parts.length - 2]
    county = parts[parts.length - 1]
  }
  return { company, street, line2, town, county, postcode }
}

function joinAddress(f) {
  const rest = [f.street, f.line2, f.town, f.county, f.postcode]
    .map(s => (s || '').trim())
    .filter(Boolean)
    .join(', ')
  const company = (f.company || '').trim()
  if (company && rest) return `${company}\n${rest}`
  return company || rest
}

// AddressNow find + retrieve API calls
async function addressNowFind(query, lastId = '') {
  const params = new URLSearchParams({
    Key: ADDRESSNOW_KEY,
    Text: query,
    IsMiddleware: 'false',
    Container: lastId,
    Origin: '',
    Countries: 'GBR',
    Limit: '7',
    Language: 'en-gb',
  })
  const res = await fetch(`https://api.addressnow.co.uk/capture/interactive/find/v1.10/json3.ws?${params}`)
  const data = await res.json()
  return data.Items || []
}

async function addressNowRetrieve(id) {
  const params = new URLSearchParams({
    Key: ADDRESSNOW_KEY,
    Id: id,
    Field1Format: '{Company}',
    Field2Format: '{Line1}',
    Field3Format: '{Line2}',
    Field4Format: '{City}',
    Field5Format: '{ProvinceName}',
    Field6Format: '{PostalCode}',
  })
  const res = await fetch(`https://api.addressnow.co.uk/capture/interactive/retrieve/v1.20/json3.ws?${params}`)
  const data = await res.json()
  return data.Items?.[0] || null
}

export default function AddressLookup({ value, onChange }) {
  const [fields, setFields]         = useState(() => parseAddress(value))
  const [query, setQuery]           = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading]       = useState(false)
  const [open, setOpen]             = useState(false)
  const [useManual, setUseManual]   = useState(!ADDRESSNOW_KEY)
  const dropdownRef                 = useRef(null)
  const debounceRef                 = useRef(null)

  // Sync incoming value changes
  const prevValue = useRef(value)
  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value
      setFields(parseAddress(value))
    }
  }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback(async (text, containerId = '') => {
    if (!text || text.length < 2) { setSuggestions([]); setOpen(false); return }
    setLoading(true)
    try {
      const items = await addressNowFind(text, containerId)
      setSuggestions(items)
      setOpen(items.length > 0)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  function handleQueryChange(e) {
    const v = e.target.value
    setQuery(v)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(v), 200)
  }

  async function handleSelect(item) {
    if (item.Type === 'Container') {
      // Drill into this container (e.g. a building with multiple flats)
      await search(query, item.Id)
      return
    }
    // Retrieve full address
    setLoading(true)
    try {
      const addr = await addressNowRetrieve(item.Id)
      if (addr) {
        const next = {
          company:  addr.Field1 || '',
          street:   addr.Field2 || '',
          line2:    addr.Field3 || '',
          town:     addr.Field4 || '',
          county:   addr.Field5 || '',
          postcode: addr.Field6 || '',
        }
        setFields(next)
        const joined = joinAddress(next)
        prevValue.current = joined
        onChange(joined)
        setQuery(joined)
        setOpen(false)
        setSuggestions([])
        setUseManual(true)  // show fields for any tweaks
      }
    } catch {
      // fallback - use description
      setQuery(item.Description || item.Text || '')
    } finally {
      setLoading(false)
    }
  }

  function setField(k, v) {
    const next = { ...fields, [k]: v }
    setFields(next)
    const joined = joinAddress(next)
    prevValue.current = joined
    onChange(joined)
  }

  const hasValue = !!(fields.company || fields.street || fields.town || fields.postcode)

  return (
    <div>
      {/* Search box */}
      {!useManual && (
        <div style={{ position: 'relative', marginBottom: hasValue ? 10 : 0 }} ref={dropdownRef}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="Start typing an address, street or postcode..."
              value={query}
              onChange={handleQueryChange}
              onFocus={() => suggestions.length > 0 && setOpen(true)}
              autoComplete="off"
              style={{ flex: 1 }}
            />
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px',
                color: 'var(--text-sub)', fontSize: 12 }}>...</div>
            )}
          </div>

          {open && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
              background: 'var(--navy-lt)', border: '1px solid var(--border-md)',
              borderRadius: 'var(--r)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              maxHeight: 260, overflowY: 'auto', marginTop: 4,
            }}>
              {suggestions.map((item, i) => (
                <button key={i} type="button"
                  onClick={() => handleSelect(item)}
                  style={{
                    display: 'flex', width: '100%', textAlign: 'left', alignItems: 'center',
                    justifyContent: 'space-between', gap: 8,
                    padding: '10px 14px', background: 'transparent', border: 'none',
                    borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                    color: 'var(--cream-dim)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--sans)',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <span style={{ fontWeight: 500 }}>{item.Text}</span>
                    {item.Description && (
                      <span style={{ color: 'var(--text-sub)', marginLeft: 6, fontSize: 12 }}>
                        {item.Description}
                      </span>
                    )}
                  </div>
                  {item.Type === 'Container' && (
                    <span style={{ fontSize: 11, color: 'var(--text-sub)', flexShrink: 0 }}>
                      {item.Count} addresses ›
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 5, fontSize: 11, color: 'var(--text-sub)' }}>
            Search by house name, street, business name or postcode.{' '}
            <button type="button" onClick={() => setUseManual(true)} style={{
              background: 'transparent', border: 'none', color: 'var(--text-sub)',
              fontSize: 11, cursor: 'pointer', fontFamily: 'var(--sans)', padding: 0, textDecoration: 'underline',
            }}>Enter manually instead</button>
          </div>
        </div>
      )}

      {/* Structured fields - shown after selection or in manual mode */}
      {(useManual || hasValue) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-sub)', display: 'block', marginBottom: 3 }}>
              Business name / care of (optional)
            </label>
            <input className="input" placeholder="e.g. Grant McGregor Ltd" value={fields.company}
              onChange={e => setField('company', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-sub)', display: 'block', marginBottom: 3 }}>
              Street address
            </label>
            <input className="input" placeholder="e.g. 22 Hanover Street" value={fields.street}
              onChange={e => setField('street', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-sub)', display: 'block', marginBottom: 3 }}>
              Address line 2 (optional)
            </label>
            <input className="input" placeholder="e.g. Thornton Business Park" value={fields.line2}
              onChange={e => setField('line2', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--text-sub)', display: 'block', marginBottom: 3 }}>Town / City</label>
              <input className="input" placeholder="e.g. London" value={fields.town}
                onChange={e => setField('town', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--text-sub)', display: 'block', marginBottom: 3 }}>County (optional)</label>
              <input className="input" placeholder="e.g. Surrey" value={fields.county}
                onChange={e => setField('county', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-sub)', display: 'block', marginBottom: 3 }}>Postcode</label>
            <input className="input" placeholder="e.g. SW1A 1AA" value={fields.postcode}
              onChange={e => setField('postcode', e.target.value)}
              style={{ maxWidth: 140, textTransform: 'uppercase' }} />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
            {ADDRESSNOW_KEY && (
              <button type="button" onClick={() => {
                setUseManual(false)
                setQuery('')
                setSuggestions([])
              }} style={{
                background: 'transparent', border: 'none', color: 'var(--gold)',
                fontSize: 11, cursor: 'pointer', fontFamily: 'var(--sans)', padding: 0,
              }}>
                Search again
              </button>
            )}
            {hasValue && (
              <button type="button" onClick={() => {
                setFields({ ...EMPTY_FIELDS })
                prevValue.current = ''
                onChange('')
                setQuery('')
                setUseManual(!ADDRESSNOW_KEY)
              }} style={{
                background: 'transparent', border: 'none', color: 'var(--text-sub)',
                fontSize: 11, cursor: 'pointer', fontFamily: 'var(--sans)', padding: 0,
              }}>
                Clear address
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
