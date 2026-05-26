// cron-finalize-separations
//
// Nightly cron that finds every partner_links row in 'separation_pending'
// whose deadline has passed and finalises the separation. Mirrors the
// per-link finalize logic in supabase/functions/finalize-separation, but
// without requiring a user JWT — this is called by pg_cron via pg_net
// with a service-role secret.
//
// Without this cron, finalize only runs when one of the partners next
// opens the Couples page after the deadline. If neither logs in, the
// link sits in separation_pending indefinitely.
//
// Authentication: requires header `x-cron-secret` to match the
// CRON_SECRET edge-function env var. Same pattern as checkin-scheduler.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?target=deno'

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const aB = new TextEncoder().encode(a)
  const bB = new TextEncoder().encode(b)
  let diff = 0
  for (let i = 0; i < aB.length; i++) diff |= aB[i] ^ bB[i]
  return diff === 0
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 15_000): Promise<Response> {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { ...opts, signal: ctrl.signal }) }
  finally { clearTimeout(timer) }
}

// ── Core finalize-one logic, mirrors finalize-separation/index.ts ──────────
async function finalizeOne(supabase: any, linkId: string, stripeKey: string): Promise<{ ok: boolean; billingNote?: string; error?: string }> {
  const { data: link } = await supabase
    .from('partner_links')
    .select('*, requester:requester_id(id, full_name, plan, stripe_subscription_id), partner:partner_id(id, full_name, plan, stripe_subscription_id)')
    .eq('id', linkId)
    .single()
  if (!link)                                  return { ok: false, error: 'link not found' }
  if (link.status === 'unlinked')             return { ok: true, billingNote: 'already finalized' }
  if (link.status !== 'separation_pending')   return { ok: false, error: 'not pending' }

  const payer    = link.couples_payer_id
  const nonPayer = payer ? (payer === link.requester_id ? link.partner_id : link.requester_id) : null

  // 1. Apply per-entry choices
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

  // 2. Stripe refund for non-payer's prior Single sub
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
                'metadata[reason]':  'couples_separation_cron',
                'metadata[user_id]': nonPayer,
              }),
            })
            const refund = await refundRes.json()
            if (refund.id) {
              await supabase.from('refunds').insert([{
                user_id:          nonPayer,
                stripe_refund_id: refund.id,
                amount_pence:     refundPence,
                reason:           'couples_separation_cron',
                status:           'issued',
              }])
              billingNote = `£${(refundPence / 100).toFixed(2)} refunded`
            }
          }
        }
      }
    }
  }

  // 3. Downgrade non-payer to free
  if (nonPayer) {
    await supabase.from('profiles').update({
      plan: 'free', plan_renewal: null, stripe_subscription_id: null,
    }).eq('id', nonPayer)
  }

  // 4. Separations record (90-day export window)
  await supabase.from('separations').upsert([{
    partner_link_id:              linkId,
    initiated_by:                 link.requester_id,   // best guess — initiator may not be known via cron
    status:                       'export_period',
    shared_vault_export_deadline: new Date(Date.now() + 90 * 86400000).toISOString(),
  }], { onConflict: 'partner_link_id' }).catch(() => {})

  // 5. Flip link to unlinked
  await supabase.from('partner_links').update({
    status:                  'unlinked',
    separation_billing_note: billingNote || 'Separation finalized by nightly cron.',
  }).eq('id', linkId)

  // 6. Notify both partners
  await supabase.from('notifications').insert([
    {
      user_id:    link.requester_id,
      type:       'partner_unlinked',
      title:      'Couples vault unlinked',
      message:    'The 14-day separation window ended. Shared entries marked Keep are now in your private vault.',
      action_url: '/?page=couples',
    },
    {
      user_id:    link.partner_id,
      type:       'partner_unlinked',
      title:      'Couples vault unlinked',
      message:    'The 14-day separation window ended. Shared entries marked Keep are now in your private vault.',
      action_url: '/?page=couples',
    },
  ]).catch(() => {})

  return { ok: true, billingNote }
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const cronSecret = req.headers.get('x-cron-secret') ?? ''
  const expected   = Deno.env.get('CRON_SECRET') ?? ''
  if (!expected || !timingSafeEqual(cronSecret, expected)) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''

  // Find every link whose grace period has elapsed.
  const { data: pending, error } = await supabase
    .from('partner_links')
    .select('id')
    .eq('status', 'separation_pending')
    .lt('separation_deadline', new Date().toISOString())
  if (error) {
    console.error('cron-finalize-separations query error:', error.message)
    return new Response(JSON.stringify({ error: 'query failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const results: any[] = []
  for (const row of pending ?? []) {
    try {
      const r = await finalizeOne(supabase, row.id, stripeKey)
      results.push({ id: row.id, ...r })
    } catch (e) {
      console.error('finalize failed for', row.id, e.message)
      results.push({ id: row.id, ok: false, error: e.message })
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
