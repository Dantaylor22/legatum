-- ══════════════════════════════════════════════════════════════
-- profiles — partners can view each other's row
-- ──────────────────────────────────────────────────────────────
-- The existing "Users can view own profile" policy restricts SELECT
-- to auth.uid() = id. That means Postgrest's automatic FK join in
-- usePartner.js:
--
--     .select('*, partner:partner_id(id, full_name, plan)')
--
-- returns null for the partner field — Postgrest respects RLS on
-- joined rows, and the calling user can't read the partner's
-- profile row.
--
-- Effect: CouplesPage receives link != null but partner == null,
-- fails every render branch, and shows a blank page.
--
-- Fix: a permissive SELECT policy that grants visibility of one
-- profile row to the linked partner. Scoped to accepted +
-- separation_pending links only (not pending, declined, unlinked)
-- so that mere unaccepted invites don't leak profile data.
--
-- Tradeoff: this exposes the full profiles row — including
-- stripe_*, plan_renewal, mfa_* — to the partner. Acceptable
-- because (a) the two users have already agreed to share vaults
-- and a paid plan, (b) the client-side code only ever uses
-- id / full_name / plan, and (c) column-level RLS would require
-- a view, which is more machinery than this warrants. Move to a
-- restricted view if a future feature needs to hide payment data
-- from the partner.
--
-- Safe to re-run.
-- ══════════════════════════════════════════════════════════════

drop policy if exists "Partners can view each other's profile" on public.profiles;
create policy "Partners can view each other's profile" on public.profiles
  for select using (
    exists (
      select 1 from public.partner_links
      where status in ('accepted', 'separation_pending')
        and (
          (requester_id = auth.uid() and partner_id = profiles.id)
          or (partner_id = auth.uid() and requester_id = profiles.id)
        )
    )
  );
