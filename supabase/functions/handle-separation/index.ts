import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?target=deno'

const ALLOWED_ORIGINS = new Set([
  'https://digitalrelative.co.uk',
  'https://www.digitalrelative.co.uk',
  'https://legatum-chi.vercel.app',
  'https://digital-relative.vercel.app',
])

function corsHeaders(origin: string) {
  if (!ALLOWED_ORIGINS.has(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 15_000): Promise<Response> {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { ...opts, signal: ctrl.signal }) }
  finally { clearTimeout(timer) }
}



serve(async (req) => {
  const origin = req.headers.get('origin') || ''
  const hdrs   = corsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: hdrs })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), { status: 401, headers: hdrs })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const body = await req.json().catch(() => null)
    if (!body?.linkId || !body?.initiatorId) throw new Error('Missing required fields')

    const { linkId, initiatorId } = body
    if (!UUID_RE.test(linkId) || !UUID_RE.test(initiatorId)) throw new Error('Invalid IDs')

    // Verify JWT belongs to initiatorId
    const jwt = authHeader.slice(7)
    const meRes = await fetchWithTimeout(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${jwt}`, 'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! },
    })
    // FIX EF-4/BL-2: verify response OK before parsing
    if (!meRes.ok) throw new Error('Unauthorised')
    const me = await meRes.json()
    if (!me?.id || me.id !== initiatorId) throw new Error('Unauthorised')

    // Get the partner link
    const { data: link, error: linkError } = await supabase
      .from('partner_links')
      .select('*, requester:requester_id(id, full_name, plan, stripe_subscription_id), partner:partner_id(id, full_name, plan, stripe_subscription_id)')
      .eq('id', linkId)
      .in('status', ['pending', 'accepted'])
      .single()

    if (linkError || !link) throw new Error('Partner link not found')

    // Verify initiator is part of this link
    if (link.requester_id !== initiatorId && link.partner_id !== initiatorId) {
      throw new Error('Unauthorised')
    }

    // Grace-period mode: don't finalize on the spot. Set status to
    // 'separation_pending' with a 14-day deadline, notify the other
    // partner, and let both review their shared vault entries. The
    // actual detachment / refund / plan downgrade happens in
    // finalize-separation (triggered after the deadline, or
    // optionally early once both have completed review — not yet).
    if (link.status === 'separation_pending') {
      return new Response(JSON.stringify({ error: 'Separation already in progress' }), {
        status: 400, headers: { ...hdrs, 'Content-Type': 'application/json' },
      })
    }
    if (link.status !== 'accepted') {
      return new Response(JSON.stringify({ error: 'Partner link is not active' }), {
        status: 400, headers: { ...hdrs, 'Content-Type': 'application/json' },
      })
    }

    const otherUserId = link.requester_id === initiatorId ? link.partner_id : link.requester_id
    const initiatorName = (link.requester_id === initiatorId ? link.requester : link.partner)?.full_name || 'Your partner'
    const deadline = new Date(Date.now() + 14 * 86400000)

    await supabase.from('partner_links').update({
      status:              'separation_pending',
      separation_deadline: deadline.toISOString(),
      separated_at:        new Date().toISOString(),
    }).eq('id', linkId)

    await supabase.from('notifications').insert([{
      user_id:    otherUserId,
      type:       'separation_pending',
      title:      'Your Couples plan is ending',
      message:    `${initiatorName} has ended your Couples link. You have 14 days to review the shared vault and choose which entries you created should move to your private vault. After ${deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}, the shared vault will be detached and you'll be moved to the Free plan.`,
      action_url: '/?page=couples',
    }]).catch(() => {})

    return new Response(JSON.stringify({
      success:             true,
      separationDeadline:  deadline.toISOString(),
      message:             'Separation started. You and your partner have 14 days to review shared entries.',
    }), { headers: { ...hdrs, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Separation error:', err.message)
    // FIX HI-3: whitelist safe error messages — never expose internal details
    const safeMessages = ['Missing required fields', 'Invalid IDs', 'Unauthorised', 'Partner link not found']
    const msg = safeMessages.some(s => err.message.includes(s)) ? err.message : 'Separation could not be completed. Please contact support.'
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { ...hdrs, 'Content-Type': 'application/json' },
    })
  }
})
