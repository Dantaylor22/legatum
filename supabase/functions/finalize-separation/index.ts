// finalize-separation edge function
//
// Called once the 14-day separation_pending grace period has elapsed (the
// client invokes this from usePartner when it sees a passed deadline).
// Does what the old handle-separation used to do in one shot:
//
//   1. Apply each user's per-entry separation_choice on vault_entries:
//        - 'keep'     → is_shared=false, partner_link_id=null  (lands in
//                       owner's private vault; owner_id unchanged)
//        - 'discard'  → DELETE
//        - null       → treated as 'keep' — never delete user data without
//                       an explicit choice.
//   2. Refund the non-payer's prepaid Single subscription pro-rata if any.
//   3. Downgrade the non-payer to 'free'.
//   4. Set partner_links.status='unlinked'.
//   5. Notify both partners.
//
// Idempotent: re-running on an already-unlinked link is a no-op.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?target=deno'

const ALLOWED_ORIGINS = new Set([
  'https://digitalrelative.co.uk',
  'https://www.digitalrelative.co.uk',
  'https://legatum-chi.vercel.app',
  'https://digital-relative.vercel.app',
])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function corsHeaders(origin: string) {
  if (!ALLOWED_ORIGINS.has(origin)) return {}
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary':                         'Origin',
  }
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 15_000): Promise<Response> {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { ...opts, signal: ctrl.signal }) }
  finally { clearTimeout(timer) }
}

serve(async (req) => {
  const origin = req.headers.get('origin') || ''
  const hdrs   = corsHeaders(origin)
  const json   = (b: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(b), { ...init, headers: { ...hdrs, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: hdrs })
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405 })

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') || ''

  try {
    const body = await req.json().catch(() => null)
    if (!body?.linkId || !UUID_RE.test(body.linkId)) throw new Error('Invalid request')
    const { linkId } = body

    // Verify caller is part of this link
    const { data: { user: me }, error: authErr } = await supabase.auth.getUser(authHeader.slice(7))
    if (authErr || !me) throw new Error('Unauthorised')

    // Load link + profiles
    const { data: link } = await supabase
      .from('partner_links')
      .select('*, requester:requester_id(id, full_name, plan, stripe_subscription_id), partner:partner_id(id, full_name, plan, stripe_subscription_id)')
      .eq('id', linkId)
      .single()
    if (!link) throw new Error('Partner link not found')
    if (link.requester_id !== me.id && link.partner_id !== me.id) throw new Error('Unauthorised')

    // Idempotency: already finalized.
    if (link.status === 'unlinked') return json({ success: true, alreadyFinalized: true })

    if (link.status !== 'separation_pending') {
      return json({ error: 'Separation has not been started' }, { status: 400 })
    }

    // Refuse to finalize before the deadline. Anyone who needs to short-circuit
    // can do so by updating separation_deadline manually via service role.
    if (link.separation_deadline && new Date(link.separation_deadline).getTime() > Date.now()) {
      return json({ error: 'Separation deadline not yet reached', deadline: link.separation_deadline }, { status: 400 })
    }

    const payer    = link.couples_payer_id
    const nonPayer = payer
      ? (payer === link.requester_id ? link.partner_id : link.requester_id)
      : null

    // ── Step 1: apply per-entry choices ───────────────────────────────────
    // Discarded entries get deleted, kept entries (and null choices) get
    // detached from the shared vault but remain private property of their
    // owner. Done in two passes to keep the SQL simple.
    await supabase
      .from('vault_entries')
      .delete()
      .eq('partner_link_id', linkId)
      .eq('separation_choice', 'discard')

    await supabase
      .from('vault_entries')
      .update({ is_shared: false, partner_link_id: null, separation_choice: null })
      .eq('partner_link_id', linkId)
      .eq('is_shared', true)

    // ── Step 2: Stripe refund for non-payer's prior Single sub ────────────
    let billingNote = ''
    if (nonPayer && stripeKey) {
      const nonPayerProfile: any = nonPayer === link.requester_id ? link.requester : link.partner
      if (nonPayerProfile?.stripe_subscription_id && nonPayerProfile?.plan === 'single') {
        const subRes = await fetchWithTimeout(
          `https://api.stripe.com/v1/subscriptions/${nonPayerProfile.stripe_subscription_id}`,
          { headers: { 'Authorization': `Bearer ${stripeKey}` } }
        )
        const sub = await subRes.json()
        if (sub.current_period_end) {
          const remainingMs = Math.max(0, (sub.current_period_end * 1000) - Date.now())
          const periodMs    = (sub.current_period_end - sub.current_period_start) * 1000
          const refundPence = link.partner_paid_pence
            ? Math.round((remainingMs / periodMs) * link.partner_paid_pence)
            : (periodMs > 0 ? Math.round((remainingMs / periodMs) * 1800) : 0)
          if (refundPence > 0) {
            const invoicesRes = await fetchWithTimeout(
              `https://api.stripe.com/v1/invoices?customer=${sub.customer}&subscription=${sub.id}&limit=1&status=paid`,
              { headers: { 'Authorization': `Bearer ${stripeKey}` } }
            )
            const invoices = await invoicesRes.json()
            const chargeId = invoices.data?.[0]?.charge
            if (chargeId) {
              const refundRes = await fetchWithTimeout('https://api.stripe.com/v1/refunds', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  charge:              chargeId,
                  amount:              String(refundPence),
                  reason:              'requested_by_customer',
                  'metadata[reason]':  'couples_separation',
                  'metadata[user_id]': nonPayerProfile.id,
                }),
              })
              const refund = await refundRes.json()
              if (refund.id) {
                await supabase.from('refunds').insert([{
                  user_id:          nonPayerProfile.id,
                  stripe_refund_id: refund.id,
                  amount_pence:     refundPence,
                  reason:           'couples_separation',
                  status:           'issued',
                }])
                billingNote = `£${(refundPence / 100).toFixed(2)} refunded to ${nonPayerProfile.full_name || 'partner'} for unused subscription.`
              }
            }
          }
        }
      }
    }

    // ── Step 3: downgrade non-payer to free ───────────────────────────────
    if (nonPayer) {
      await supabase.from('profiles').update({
        plan:                   'free',
        plan_renewal:           null,
        stripe_subscription_id: null,
      }).eq('id', nonPayer)
    }

    // ── Step 4: separations record (90-day export window) ────────────────
    await supabase.from('separations').upsert([{
      partner_link_id:              linkId,
      initiated_by:                 me.id,
      status:                       'export_period',
      shared_vault_export_deadline: new Date(Date.now() + 90 * 86400000).toISOString(),
    }], { onConflict: 'partner_link_id' }).catch(() => {})

    // ── Step 5: flip link to unlinked ─────────────────────────────────────
    await supabase.from('partner_links').update({
      status:                  'unlinked',
      separation_billing_note: billingNote || 'Separation finalized.',
    }).eq('id', linkId)

    // ── Step 6: notify both partners ──────────────────────────────────────
    await supabase.from('notifications').insert([
      {
        user_id:    link.requester_id,
        type:       'partner_unlinked',
        title:      'Couples vault unlinked',
        message:    'Your Couples link has ended. Shared vault entries you chose to keep are now in your private vault. You have 90 days to export anything else.',
        action_url: '/?page=couples',
      },
      {
        user_id:    link.partner_id,
        type:       'partner_unlinked',
        title:      'Couples vault unlinked',
        message:    'Your Couples link has ended. Shared vault entries you chose to keep are now in your private vault. You have 90 days to export anything else.',
        action_url: '/?page=couples',
      },
    ]).catch(() => {})

    return json({ success: true, billingNote })
  } catch (err) {
    console.error('finalize-separation error:', err.message)
    const userFacing = ['Invalid request', 'Unauthorised', 'Partner link not found', 'Separation has not been started', 'Separation deadline not yet reached']
    const msg = userFacing.includes(err.message) ? err.message : 'Could not finalize separation'
    return json({ error: msg }, { status: 400 })
  }
})
