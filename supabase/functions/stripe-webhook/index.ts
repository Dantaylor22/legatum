import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno&pin=v135'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?target=deno&pin=v135'

const stripe   = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' })
const secret   = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const PRICE_TO_PLAN: Record<string, string> = {
  [Deno.env.get('STRIPE_PRICE_SINGLE_ANNUAL')   || '']: 'single',
  [Deno.env.get('STRIPE_PRICE_COUPLES_MONTHLY') || '']: 'couples',
  [Deno.env.get('STRIPE_PRICE_COUPLES_ANNUAL')  || '']: 'couples',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

serve(async (req) => {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  // Verify signature FIRST — reject anything that isn't from Stripe
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret)
  } catch {
    // Never reveal why verification failed
    return new Response('Forbidden', { status: 403 })
  }

  // Idempotency — skip already-processed events
  try {
    const { data: existing } = await supabase
      .from('stripe_events')
      .select('id')
      .eq('id', event.id)
      .maybeSingle()
    // FIX TP-2: existing IS the row (maybeSingle returns data:row|null), not data:{data:row}
    if (existing) return new Response('OK', { status: 200 })
  } catch { /* not found = proceed */ }

  try {
    await handleEvent(event)
    await supabase.from('stripe_events').insert({
      id: event.id, type: event.type, payload: event.data,
    })
  } catch (err) {
    // Log internally, never expose to Stripe
    console.error('Webhook handler error:', err.message)
    return new Response('Internal error', { status: 500 })
  }

  return new Response('OK', { status: 200 })
})

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub    = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id ?? ''

      // Validate userId is a real UUID before touching DB
      if (!UUID_RE.test(userId)) {
        console.error('Invalid userId in subscription metadata:', userId)
        return
      }

      const priceId = sub.items.data[0]?.price.id ?? ''
      const plan    = PRICE_TO_PLAN[priceId]

      // Only allow known plans — never set to unknown value
      if (!plan) {
        console.error('Unknown price ID in subscription:', priceId)
        return
      }

      const renewal = new Date(sub.current_period_end * 1000).toISOString()

      // Verify user exists before updating
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single()
      if (!profile) {
        console.error('User not found for subscription update:', userId)
        return
      }

      await supabase.from('profiles').update({
        plan,
        plan_renewal:           renewal,
        stripe_subscription_id: sub.id,
      }).eq('id', userId)
      break
    }

    case 'customer.subscription.deleted': {
      const sub    = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id ?? ''
      if (!UUID_RE.test(userId)) return

      await supabase.from('profiles').update({
        plan:                   'free',
        plan_renewal:           null,
        stripe_subscription_id: null,
      }).eq('id', userId)
      break
    }

    case 'invoice.payment_failed': {
      // Log payment failures for monitoring — don't change plan yet
      const invoice = event.data.object as Stripe.Invoice
      console.error('Payment failed for customer:', invoice.customer)
      break
    }
  }
}
