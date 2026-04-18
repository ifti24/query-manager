/*
  # Update daily digest cron job with correct Supabase URL

  ## Summary
  Updates the existing cron job to use the actual Supabase project URL directly,
  since app.settings config vars are not configured. The edge function is called
  every minute and self-checks whether the current UTC time matches the admin's
  configured email_schedule_time before sending any emails.

  ## Changes
  - Drops the previous cron job (which used unset config vars)
  - Re-creates the cron job with the hardcoded project URL and anon key
  - The edge function handles all scheduling logic internally
*/

SELECT cron.unschedule('daily-digest-email-check');

SELECT cron.schedule(
  'daily-digest-email-check',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := 'https://pmopdinsvwuhdoyxpcyz.supabase.co/functions/v1/send-daily-reminders',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtb3BkaW5zdnd1aGRveXhwY3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjE0MTgsImV4cCI6MjA5MDE5NzQxOH0.3q16oxLfm2g9WFDspXN9LYyquFsCbtoPT8nA6S1RjAQ"}'::jsonb,
      body := '{"triggered_by":"system"}'::jsonb
    );
  $$
);
