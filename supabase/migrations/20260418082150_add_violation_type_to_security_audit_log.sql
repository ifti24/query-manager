/*
  # Add violation_type to security_audit_log

  ## Changes
  - Adds a `violation_type` column to `security_audit_log` to categorize unauthorized access events
  - Values: 'expired_token' | 'permission_denied' | 'invalid_credentials' | 'rls_violation' | 'unknown'
  - Defaults to 'unknown' for backwards compatibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'security_audit_log' AND column_name = 'violation_type'
  ) THEN
    ALTER TABLE security_audit_log
      ADD COLUMN violation_type text NOT NULL DEFAULT 'unknown'
      CHECK (violation_type IN ('expired_token', 'permission_denied', 'invalid_credentials', 'rls_violation', 'unknown'));
  END IF;
END $$;
