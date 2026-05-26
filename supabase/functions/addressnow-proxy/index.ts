import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?target=deno'

const ALLOWED_ORIGINS = new Set([
  'https://digitalrelative.co.uk',
  'https://www.digitalrelative.co.uk',
  'https://legatum-chi.vercel.app',
  'https://digital-relative.vercel.app',
  'http://localhost:5173',
])

function getCorsHeaders(origin: string): Record<string, string> {
  if (!ALLOWED_ORIGINS.has(origin)) return {}
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary':                         'Origin',
  }
}

async function fetchWithTimeout(url: string, ms = 5_000): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { signal: ctrl.signal }) }
  finally { clearTimeout(timer) }
}

serve(async (req) => {
  const origin = req.headers.get('origin') || ''
  const hdrs   = getCorsHeaders(origin)
  const json   = (body: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(body), { ...init, headers: { ...hdrs, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: hdrs })
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405 })

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!jwt) return json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
  if (authError || !user) return json({ error: 'Unauthorised' }, { status: 401 })

  const key = Deno.env.get('ADDRESSNOW_KEY')
  if (!key) return json({ error: 'AddressNow not configured' }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  const { action, text, container, id } = body || {}

  try {
    if (action === 'find') {
      if (typeof text !== 'string' || !text) return json({ error: 'Missing text' }, { status: 400 })
      const params = new URLSearchParams({
        Key:          key,
        Text:         text,
        IsMiddleware: 'false',
        Container:    typeof container === 'string' ? container : '',
        Origin:       '',
        Countries:    'GBR',
        Limit:        '7',
        Language:     'en-gb',
      })
      const res  = await fetchWithTimeout(`https://api.addressnow.co.uk/capture/interactive/find/v1.10/json3.ws?${params}`)
      const data = await res.json()
      return json({ Items: data.Items || [] })
    }
    if (action === 'retrieve') {
      if (typeof id !== 'string' || !id) return json({ error: 'Missing id' }, { status: 400 })
      const params = new URLSearchParams({
        Key:          key,
        Id:           id,
        Field1Format: '{Company}',
        Field2Format: '{Line1}',
        Field3Format: '{Line2}',
        Field4Format: '{City}',
        Field5Format: '{ProvinceName}',
        Field6Format: '{PostalCode}',
      })
      const res  = await fetchWithTimeout(`https://api.addressnow.co.uk/capture/interactive/retrieve/v1.20/json3.ws?${params}`)
      const data = await res.json()
      return json({ Item: data.Items?.[0] || null })
    }
    return json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('[addressnow-proxy] upstream error:', e)
    return json({ error: 'Upstream error' }, { status: 502 })
  }
})
