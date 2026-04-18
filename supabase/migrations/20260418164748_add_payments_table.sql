/*
  # Add Payments Table

  ## Purpose
  Supports manual payment collection workflow where the platform admin records
  payments received offline (cash, bank transfer, bKash, etc.) for each account.

  ## New Tables

  ### `payments`
  - `id` (uuid, PK) - Unique payment record
  - `account_id` (uuid, FK) - Which account this payment is for
  - `subscription_id` (uuid, FK) - Which subscription period this payment covers
  - `amount_bdt` (numeric) - Amount paid in Bangladeshi Taka
  - `payment_method` (text) - e.g. 'cash', 'bank_transfer', 'bkash', 'nagad', 'rocket', 'cheque', 'other'
  - `reference_number` (text, nullable) - Transaction ID / cheque number / receipt ref
  - `payment_date` (date) - Date the payment was received
  - `plan_id` (text) - Which plan this payment is for (denormalized for history)
  - `period_start` (date, nullable) - Start of the billing period covered
  - `period_end` (date, nullable) - End of the billing period covered
  - `notes` (text, nullable) - Admin notes (e.g. "paid via bKash, ref: 12345")
  - `recorded_by` (uuid, FK) - Which platform admin recorded the payment
  - `created_at` (timestamptz) - When the record was created

  ## Security
  - RLS enabled
  - Platform admins (super_admin, support_admin) can insert, read, update, delete
  - Account owners can only read their own account's payment records
*/

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount_bdt numeric(10, 2) NOT NULL CHECK (amount_bdt >= 0),
  payment_method text NOT NULL DEFAULT 'cash',
  reference_number text,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  plan_id text NOT NULL,
  period_start date,
  period_end date,
  notes text,
  recorded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS payments_account_id_idx ON payments(account_id);
CREATE INDEX IF NOT EXISTS payments_payment_date_idx ON payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS payments_recorded_by_idx ON payments(recorded_by);

CREATE POLICY "Platform admins can read all payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'support_admin')
    )
  );

CREATE POLICY "Platform admins can insert payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'support_admin')
    )
  );

CREATE POLICY "Platform admins can update payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'support_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'support_admin')
    )
  );

CREATE POLICY "Platform admins can delete payments"
  ON payments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'support_admin')
    )
  );

CREATE POLICY "Account owners can read own payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'account_owner'
        AND ur.account_id = payments.account_id
    )
  );
