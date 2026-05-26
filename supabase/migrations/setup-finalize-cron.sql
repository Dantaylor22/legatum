-- ══════════════════════════════════════════════════════════════
-- pg_cron schedule for cron-finalize-separations
-- ──────────────────────────────────────────────────────────────
-- Runs every day at 02:00 UTC. Calls the edge function which
-- finds every partner_links row past its separation_deadline and
-- finalises them (detach entries, refund, downgrade non-payer,
-- set status='unlinked').
--
-- Prerequisites — set these manually in the Supabase Dashboard
-- *before* running this migration:
--
--   1. Settings → Database → Extensions:
--        - Enable pg_cron (schema: extensions)
--        - Enable pg_net  (schema: extensions)
--
--   2. Settings → Edge Functions → Secrets:
--        - CRON_SECRET = <a long random string>
--      (Generate one with `openssl rand -hex 32` or similar.)
--
--   3. Replace the YOUR_CRON_SECRET placeholder below with the
--      same value before running this SQL. The secret never
--      leaves the database — pg_net sends it as a header in the
--      cron HTTP call.
--
-- Safe to re-run; cron.schedule replaces existing jobs of the
-- same name.
-- ══════════════════════════════════════════════════════════════

select cron.schedule(
  'finalize-separations-nightly',
  '0 2 * * *',
  $$
    select net.http_post(
      url     := 'https://xqmgfyfqeehjvjxbezgx.supabase.co/functions/v1/cron-finalize-separations',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'x-cron-secret',  'YOUR_CRON_SECRET'
      ),
      body    := '{}'::jsonb
    ) as request_id;
  $$
);

-- To verify it's scheduled:
--   select * from cron.job where jobname = 'finalize-separations-nightly';
--
-- To see recent runs:
--   select * from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'finalize-separations-nightly')
--     order by start_time desc limit 10;
--
-- To remove (e.g. if migrating to a different scheduler):
--   select cron.unschedule('finalize-separations-nightly');
