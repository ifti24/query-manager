/*
  # Set up pg_cron job for daily digest emails

  ## Summary
  Enables the pg_cron and pg_net extensions and creates a cron job that calls
  the send-daily-reminders edge function every minute. The edge function itself
  reads the admin's email_schedule_time and email_schedule_enabled settings and
  only proceeds when the current UTC time matches the configured schedule.

  ## Changes
  - Enables pg_cron extension for scheduled jobs
  - Enables pg_net extension for HTTP calls from the database
  - Creates a cron job that fires every minute and calls the edge function
  - The edge function handles the time-matching logic internally

  ## Notes
  - The schedule time stored in admin_settings is compared in UTC
  - Admins should set their desired schedule time in UTC in the settings panel
  - The "Send Digest Email Now" button bypasses the schedule check (force=true)
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'daily-digest-email-check',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT current_setting('app.settings.supabase_url', true) || '/functions/v1/send-daily-reminders'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{"triggered_by":"system"}'::jsonb
    );
  $$
);
