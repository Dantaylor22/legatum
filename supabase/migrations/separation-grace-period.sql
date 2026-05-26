-- ══════════════════════════════════════════════════════════════
-- Separation 14-day grace period
-- ──────────────────────────────────────────────────────────────
-- Currently handle-separation transitions partner_links.status
-- straight from 'accepted' → 'unlinked' and detaches everything
-- in the same call. There's no review period for partner B.
--
-- This migration introduces a 'separation_pending' state. During
-- the grace window each partner can mark their own shared vault
-- entries with separation_choice = 'keep' (lands in private vault
-- after finalize) or 'discard' (deleted). Entries with no choice
-- default to 'keep' — never delete user data silently.
--
-- finalize-separation (separate edge function) reads these choices,
-- detaches entries, refunds the non-payer's prepaid time pro-rata,
-- downgrades non-payer to free, and transitions status to
-- 'unlinked'. Client triggers it on the next app load after the
-- deadline passes.
--
-- Safe to re-run.
-- ══════════════════════════════════════════════════════════════

-- Extend status check constraint.
alter table public.partner_links
  drop constraint if exists partner_links_status_check;
alter table public.partner_links
  add constraint partner_links_status_check
  check (status in ('pending','accepted','declined','unlinked','separation_pending'));

-- Deadline for finalize.
alter table public.partner_links
  add column if not exists separation_deadline timestamptz default null;

-- Per-entry choice on shared vault entries.
alter table public.vault_entries
  add column if not exists separation_choice text default null;

-- Drop and recreate the check so re-runs work cleanly.
alter table public.vault_entries
  drop constraint if exists vault_entries_separation_choice_check;
alter table public.vault_entries
  add constraint vault_entries_separation_choice_check
  check (separation_choice is null or separation_choice in ('keep', 'discard'));

-- Index — finalize-separation queries by partner_link_id during cleanup,
-- already covered by an existing FK index. No new index needed.

-- The existing vault_entries UPDATE policy (auth.uid() = user_id) already
-- lets a user set separation_choice on their own rows. No policy change.
