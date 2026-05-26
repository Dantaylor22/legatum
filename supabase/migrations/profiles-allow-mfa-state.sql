-- ══════════════════════════════════════════════════════════════
-- Profiles UPDATE — allow self-update of MFA denormalised state
-- ──────────────────────────────────────────────────────────────
-- Symptom: TOTP setup loop. User scans QR, enters 6-digit code,
-- toast shows "set up", but on next sign-in the user is sent back
-- to MfaSetup. Picking Authenticator again toasts "Could not start
-- setup" because a verified TOTP factor already exists in Supabase
-- Auth.
--
-- Cause: MfaSetup.jsx:88 does
--     supabase.from('profiles').update({ mfa_enrolled: true,
--                                        mfa_email_fallback: false })
-- but the previous UPDATE policy pinned mfa_enrolled and
-- mfa_email_fallback to their current values via WITH CHECK,
-- silently denying the change. profile.mfa_enrolled stays false,
-- App.jsx keeps routing the user to MfaSetup, and the second
-- enrolment attempt collides with the existing factor.
--
-- Fix: drop the pins on mfa_enrolled / mfa_email_fallback /
-- mfa_backup_email. Billing columns (plan, stripe_*, plan_renewal,
-- switch_triggered_at) remain pinned. The real MFA security
-- boundary is the Supabase Auth factor list, not this flag — a
-- client that lied and set mfa_enrolled = false in the profile
-- still has to defeat the actual MFA challenge to sign in.
--
-- Safe to re-run.
-- ══════════════════════════════════════════════════════════════

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and plan                                 = (select plan                     from public.profiles where id = auth.uid())
    and coalesce(stripe_customer_id, '')     = coalesce((select stripe_customer_id     from public.profiles where id = auth.uid()), '')
    and coalesce(stripe_subscription_id, '') = coalesce((select stripe_subscription_id from public.profiles where id = auth.uid()), '')
    and coalesce(plan_renewal::text, '')     = coalesce((select plan_renewal::text     from public.profiles where id = auth.uid()), '')
    and coalesce(switch_triggered_at::text, '') = coalesce((select switch_triggered_at::text from public.profiles where id = auth.uid()), '')
  );
