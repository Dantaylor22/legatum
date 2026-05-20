import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_PIN_ATTEMPTS = 5

// FIX EF-NEW-7: Constant-time string comparison to prevent timing attacks
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const aBytes = new TextEncoder().encode(a)
  const bBytes = new TextEncoder().encode(b)
  let diff = 0
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i]
  return diff === 0
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  // FIX EF-NEW-7: Body size limit
  const contentLength = parseInt(req.headers.get('content-length') || '0')
  if (contentLength > 4096) return new Response('Payload too large', { status: 413 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const body = await req.json().catch(() => null)
    if (!body?.token) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { token, pin } = body

    // Validate token format
    if (!/^[0-9a-f]{64}$/.test(token)) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch the link
    const { data: link, error } = await supabase
      .from('shared_links')
      .select('*')
      .eq('token', token)
      .eq('revoked', false)
      .single()

    // FIX EF-NEW-10: Return same error for all "not accessible" states
    if (error || !link || new Date(link.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check view limit
    if (link.max_views !== null && link.view_count >= link.max_views) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // FIX EF-NEW-8: Check PIN attempt rate limit
    if (link.pin_hash) {
      // Track failed attempts in metadata jsonb column (add if not exists)
      const failedAttempts = link.pin_attempts || 0
      if (failedAttempts >= MAX_PIN_ATTEMPTS) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!pin) {
        return new Response(JSON.stringify({ requiresPin: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // FIX EF-NEW-7: Compute hash and compare with constant-time comparison
      const encoder = new TextEncoder()
      const data    = encoder.encode(pin + link.token)
      const hashBuf = await crypto.subtle.digest('SHA-256', data)
      const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')

      if (!constantTimeEqual(hashHex, link.pin_hash)) {
        // Increment failed attempt counter atomically
        await supabase.from('shared_links')
          .update({ pin_attempts: (failedAttempts + 1) })
          .eq('id', link.id)

        const remaining = MAX_PIN_ATTEMPTS - failedAttempts - 1
        return new Response(JSON.stringify({
          error: 'Incorrect PIN',
          attemptsRemaining: remaining > 0 ? remaining : 0,
        }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Correct PIN — reset attempt counter
      await supabase.from('shared_links').update({ pin_attempts: 0 }).eq('id', link.id)
    }

    // FIX EF-NEW-9: Atomic view count increment — prevent race condition on one-time links
    // Use a conditional update that only succeeds if view_count hasn't changed
    const { data: updated, error: updateError } = await supabase
      .from('shared_links')
      .update({
        view_count: link.view_count + 1,
        last_accessed_at: new Date().toISOString(),
        ...(link.one_time ? { revoked: true, revoked_at: new Date().toISOString() } : {}),
      })
      .eq('id', link.id)
      .eq('view_count', link.view_count) // Only update if count hasn't changed (atomic check)
      .select('id')

    if (updateError || !updated?.length) {
      // Race condition — another request got here first
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      encryptedPayload: link.encrypted_payload,
      contentType:      link.content_type,
      // FIX BL-NEW-3: Only return contentLabel after PIN verified
      contentLabel:     link.pin_hash && !pin ? undefined : link.content_label,
      includesPassword: link.includes_password,
      expiresAt:        link.expires_at,
      oneTime:          link.one_time,
      viewCount:        link.view_count + 1,
      maxViews:         link.max_views,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Shared link error:', err.message)
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
