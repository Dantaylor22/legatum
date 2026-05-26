import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function usePartner() {
  const { user } = useAuth()
  const [link, setLink]       = useState(null)   // active partner link
  const [partner, setPartner] = useState(null)   // partner profile
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    // Two-step fetch: link row from partner_links (no FK joins into profiles
    // because partners no longer have broad SELECT on each other's profile —
    // see supabase/migrations/partner-profile-view.sql). Partner identity
    // comes from partner_summary, which exposes only id/full_name/plan.
    const { data: linkRow } = await supabase
      .from('partner_links')
      .select('*')
      .or(`requester_id.eq.${user.id},partner_id.eq.${user.id}`)
      .in('status', ['pending', 'accepted', 'separation_pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (linkRow) {
      const partnerId = linkRow.requester_id === user.id ? linkRow.partner_id : linkRow.requester_id
      let partnerProfile = null
      if (partnerId) {
        const { data: p } = await supabase
          .from('partner_summary')
          .select('id, full_name, plan')
          .eq('id', partnerId)
          .maybeSingle()
        partnerProfile = p
      }
      setLink(linkRow)
      setPartner(partnerProfile)
    } else {
      setLink(null)
      setPartner(null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  async function sendInvite(email) {
    // Find if user exists
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', (await supabase.auth.admin?.getUserByEmail?.(email))?.data?.user?.id)
      .single()

    // Create the link request
    const { data, error } = await supabase
      .from('partner_links')
      .insert([{ requester_id: user.id, partner_id: profileData?.id || user.id }])
      .select()
      .single()
    if (error) throw error

    // Notification will be sent via edge function / email
    return data
  }

  async function acceptLink(linkId) {
    // Goes through the couples-accept edge function (service role) so it can
    // set couples_payer_id, upgrade the partner's plan, and refund their
    // existing Single sub if any. Direct partner_links.update only handles
    // status — partner would then be left on free/single and get bounced to
    // Stripe again as if they needed to pay.
    const { data, error } = await supabase.functions.invoke('couples-accept', {
      body: { linkId },
    })
    if (error) throw new Error(error.message || 'Could not accept invite')
    if (data?.error) throw new Error(data.error)
    await fetch()
    return data
  }

  async function declineLink(linkId) {
    const { error } = await supabase
      .from('partner_links')
      .update({ status: 'declined' })
      .eq('id', linkId)
    if (error) throw error
    setLink(null)
    setPartner(null)
  }

  async function unlink(linkId) {
    const { error } = await supabase
      .from('partner_links')
      .update({ status: 'unlinked' })
      .eq('id', linkId)
    if (error) throw error
    setLink(null)
    setPartner(null)
  }

  return { link, partner, loading, sendInvite, acceptLink, declineLink, unlink, refresh: fetch }
}
