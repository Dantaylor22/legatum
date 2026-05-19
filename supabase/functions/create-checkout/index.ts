import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    console.log('Request body:', JSON.stringify(body))

    const { priceId, userId, successUrl, cancelUrl } = body

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    console.log('Stripe key present:', !!stripeKey)
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not set')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    console.log('Supabase URL present:', !!supabaseUrl)
    console.log('Supabase key present:', !!supabaseKey)

    // Get user email directly from auth
    const userRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey ?? '',
      },
    })
    const userData = await userRes.json()
    console.log('User fetch status:', userRes.status)
    const email = userData?.email || ''

    // Get profile
    const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=stripe_customer_id,full_name`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey ?? '',
      },
    })
    const profiles = await profileRes.json()
    console.log('Profile fetch status:', profileRes.status)
    const profile = profiles?.[0]
    let customerId = profile?.stripe_customer_id

    // Create Stripe customer if needed
    if (!customerId) {
      console.log('Creating Stripe customer for:', email)
      const customerRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email,
          name: profile?.full_name || '',
          'metadata[supabase_user_id]': userId,
        }),
      })
      const customer = await customerRes.json()
      console.log('Stripe customer result:', JSON.stringify(customer))
      if (customer.error) throw new Error(`Stripe customer error: ${customer.error.message}`)
      customerId = customer.id

      // Save customer ID
      await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey ?? '',
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ stripe_customer_id: customerId }),
      })
    }

    // Create checkout session
    console.log('Creating checkout session with price:', priceId)
    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: customerId,
        'payment_method_types[0]': 'card',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        'metadata[supabase_user_id]': userId,
        'subscription_data[metadata][supabase_user_id]': userId,
      }),
    })
    const session = await sessionRes.json()
    console.log('Checkout session result:', JSON.stringify(session))
    if (session.error) throw new Error(`Stripe session error: ${session.error.message}`)

    return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Function error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
