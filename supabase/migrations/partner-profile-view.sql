-- ══════════════════════════════════════════════════════════════
-- Restricted-column view for partner profile reads
-- ──────────────────────────────────────────────────────────────
-- Previously: "Partners can view each other's profile" was a SELECT
-- policy on the profiles table that allowed each partner to read
-- the WHOLE row, including stripe_*, mfa_*, plan_renewal, etc.
-- The client only reads id/full_name/plan, but the RLS itself
-- didn't enforce column restriction. A malicious or compromised
-- client could SELECT * and lift sensitive fields.
--
-- This migration narrows the surface to a view exposing just the
-- three safe columns. The view is created in public, owned by
-- postgres (so it bypasses RLS on profiles via owner privilege),
-- and its own WHERE clause performs the partner-link visibility
-- check. SELECT on the view is granted to authenticated.
--
-- Client switches from joining profiles to fetching from this view.
-- See src/hooks/usePartner.js.
--
-- Safe to re-run.
-- ══════════════════════════════════════════════════════════════

drop policy if exists "Partners can view each other's profile" on public.profiles;

create or replace view public.partner_summary
with (security_invoker = false) as
  select p.id, p.full_name, p.plan
  from public.profiles p
  where exists (
    select 1 from public.partner_links pl
    where pl.status in ('accepted', 'separation_pending')
      and (
        (pl.requester_id = auth.uid() and pl.partner_id = p.id)
        or (pl.partner_id = auth.uid() and pl.requester_id = p.id)
      )
  );

grant select on public.partner_summary to authenticated;
revoke all  on public.partner_summary from anon;
