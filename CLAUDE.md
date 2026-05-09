# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
npm run build        # Production build (run this to verify no TypeScript/compile errors)
npm run typecheck    # TypeScript check only (no emit)
npm run lint         # ESLint
npm run dev          # Dev server (do NOT start this — handled by the system)
```

**Always run `npm run build` after making changes to verify the project compiles.**

Deploy edge functions:
```
mcp__supabase__deploy_edge_function(slug="<function-name>", verify_jwt=false)
```

Apply DB migrations:
```
mcp__supabase__apply_migration(filename="...", content="...")
```

---

## What This App Is

**QueryPing** — a B2B SaaS query management platform for organizations. Teams submit queries; members respond. Features: role-based access, subscriptions/trial plans, daily email digests, team invitations, and a platform super-admin dashboard.

---

## Tech Stack

- Vite + React 18 + TypeScript
- TailwindCSS + Lucide React icons
- Supabase (anon key on frontend, service role key in edge functions)
- Nodemailer + Gmail SMTP for all emails
- Supabase Edge Functions (Deno)

---

## Role System

Five roles stored in `user_roles` table (junction: `user_id`, `account_id`, `role`):

| Role | Scope | Notes |
|------|-------|-------|
| `super_admin` | Platform | `account_id IS NULL` in user_roles |
| `support_admin` | Platform | `account_id IS NULL` |
| `account_owner` | Single account | Owns an `accounts` row |
| `supervisor` | Single account | Can create queries and manage members |
| `member` | Single account | Can only view/respond to assigned queries |

**Key flags in `AuthContext`**: `isPlatformAdmin`, `isAccountOwner`, `isSupervisor`, `isMember`, `isManagerRole`.

A user can have multiple roles (multiple accounts). `allRoles` holds all; `activeRole` is the selected one. `activeRole.type === 'platform'` = platform admin; `activeRole.type === 'account'` = account-scoped role.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Supabase client, all TS type definitions, `buildActiveRole()` |
| `src/lib/auth.ts` | `getUserProfile()`, `getUserRoles()`, sign-in/out helpers |
| `src/contexts/AuthContext.tsx` | Auth state, role resolution, session config, subscription bridge |
| `src/hooks/useSubscription.ts` | Fetches subscription/plan, computes feature flags (query limits, member limits) |
| `src/lib/securityAudit.ts` | Detects RLS/401/403 errors, logs to `security_audit_log` via edge function |
| `src/lib/passwordPolicy.ts` | Validates passwords against admin_settings policy |
| `src/hooks/useSessionTimeout.ts` | Idle session timer — fires logout after configured inactivity |

### Pages
- `LoginPage` — auth entry point
- `AdminDashboard` — platform admins, account owners, supervisors
- `TeamMemberPortal` — regular members
- `AccountActivationPage` — token-based invite activation (`/activate?token=...`)
- `LandingPage` — public marketing page at `/team-pulse`
- `PricingPage`, `BkashPaymentPage` — subscription/payment

---

## Database — Key Tables

**`profiles`** — one row per auth user. Key columns: `id`, `email`, `full_name`, `role` (legacy), `account_id`, `account_owner_id`, `is_active`, `is_deleted`, `last_login_at`, `supervisor_id`, `designation`, `employee_id`, `unit_department`, `division`.

**`user_roles`** — authoritative role store. `(user_id, account_id, role)` unique. Platform roles have `account_id IS NULL`.

**`accounts`** — one per account owner. `owner_id` FK to profiles.

**`queries`** — `created_by`, `title`, `description`, `priority` (normal/high/urgent), `status`, `archived`.

**`query_assignments`** — `(query_id, assigned_to)` unique. `response_status` (pending/answered).

**`subscriptions`** — `account_id`, `plan_id`, `status` (active/trial/expired/cancelled), `queries_used`, `queries_reset_at`.

**`subscription_plans`** — `queries_per_month`, `max_supervisors`, `max_members`, `price_bdt`, `features` JSONB.

**`admin_settings`** — per-account. Email schedule (`email_schedule_time`, `email_schedule_enabled`, `email_timezone`, `email_schedule_days`, `digest_blacklist_dates`), file upload config, session timeout, password policy columns.

**`invitation_tokens`** — `token`, `user_id`, `temp_password`, `is_used`, `expires_at`. Created on invite, consumed on activation.

**`email_logs`** — Every email attempt. Columns: `recipient`, `recipient_email`, `subject`, `status` (sent/failed), `email_type`, `message_id`, `error_message`, `digest_batch_id`, `triggered_by`.

**`security_audit_log`** — Unauthorized access attempts with `violation_type`, `service_context`, `metadata`.

---

## RLS Architecture

All tables have RLS enabled. Key SECURITY DEFINER helper functions (bypass RLS safely):

- `is_platform_admin()` — checks caller has super_admin/support_admin in user_roles (account_id IS NULL)
- `is_account_manager(p_account_id)` — caller is account_owner or supervisor for that account
- `is_admin()` — either of the above
- `current_user_account_id()` — caller's account_id from profiles
- `current_user_is_admin_of_account(p_account_id)` — reads caller's own profile row safely (avoids recursion)
- `check_query_limit(p_account_id)` — validates subscription query quota
- `has_role(p_role, p_account_id)` — generic role check

**Critical pattern**: NEVER write RLS policies that join profiles to itself or user_roles to itself — this causes infinite recursion. Use the SECURITY DEFINER functions above instead.

**Platform admin RPC pattern**: For platform-admin-only data views (cross-account queries), use SECURITY DEFINER RPCs that check `is_platform_admin()` internally. Examples: `get_unverified_signups()`, `get_orphaned_users()`.

---

## Edge Functions

All in `supabase/functions/`. All use `SUPABASE_SERVICE_ROLE_KEY` for backend ops.

| Function | Purpose |
|----------|---------|
| `create-query` | Create query + assignments + optional assignment email notification |
| `invite-team-member` | Create user, profile, role, invitation_token → send invite email. Handles new + resend flows |
| `activate-account` | Validate/consume invitation token, set permanent password |
| `send-email` | Manual email sending for admins |
| `send-daily-reminders` | Scheduled per-account digest emails (cron triggers every minute; function self-checks schedule) |
| `log-security-event` | Insert to security_audit_log + alert super admins |
| `create-admin` | Create super_admin/account_owner users (gated by ADMIN_CREATION_TOKEN) |
| `delete-all-users` | Dev/test only — bulk user deletion |
| `signup-profile` | Legacy signup hook |

---

## Email System

- **Sender**: `QueryPing Notifications <no-reply.queryping@gmail.com>`
- **Support contact** (in all footers): `support.queryping@gmail.com`
- **Credentials**: `GMAIL_USER`, `GMAIL_APP_PASSWORD` Supabase secrets
- **Transport**: `npm:nodemailer@6.9.8` with `service: "gmail"`
- **Always log** every send attempt to `email_logs` with both `recipient` and `recipient_email` columns

Email types: `invitation`, `digest`, `query_assignment`, `manual`, `security_alert`

**Digest scheduling**: Cron runs every minute → `send-daily-reminders` checks each account's `email_schedule_time` + `email_timezone` + `email_schedule_days` + `digest_blacklist_dates`. Blacklist format: `"2026-01-01"` (single) or `"2026-01-01/2026-01-31"` (range).

---

## Authentication Behaviour

- `AuthContext.tsx` initializes once on mount via `supabase.auth.getSession()`
- `onAuthStateChange` listener handles SIGNED_IN / SIGNED_OUT only — **ignores `TOKEN_REFRESHED` and `INITIAL_SESSION`** (both fire when a minimized/background tab regains focus and must never trigger a reload or re-render)
- On each init, writes a `login_audit` row and updates `profiles.last_login_at`
- Session timeout enforced client-side by `useSessionTimeout` hook (configured from `admin_settings`)

---

## Subscription / Feature Flags

`useSubscription(accountId)` returns `features` object:
- `canCreateQuery` — false if queries_used >= limit or subscription expired
- `queriesUsed` / `queriesLimit`
- `canInviteMembers` — false if at member/supervisor cap
- `isTrial` / `isExpired` / `trialDaysLeft`
- `hasReports`, `hasAnalytics`, `hasAdvancedAnalytics`, `hasWhatsApp`, `hasPrioritySupport`

Plan IDs: `basic`, `standard`, `premium` (plus `trial` variant).

---

## Platform Admin Dashboard

`src/components/admin/platform/` — only visible to `super_admin`/`support_admin`.

- `PlatformDashboard` — stats + three tabs: Active Accounts / Unverified Signups / Others
- `AccountsTable` — all accounts with subscription status, query counts
- `UnverifiedSignupsTable` — users who registered but never logged in (not team members, not super_admin)
- `OtherUsersTable` — users who logged in but have no account setup (with reason column)
- `usePlatformStats.ts` — data hook, calls RPCs `get_unverified_signups()` and `get_orphaned_users()`
- `AccountOwnerDetailModal` — org tree with status badges per member (active/invited/expired/inactive)

---

## Common Gotchas

1. **`email_logs` columns**: Always insert both `recipient` (text) AND `recipient_email` (text). Also include `subject`, `email_type`, `message_id` (SMTP), `error_message` on failure.

0. **Edge function auth token**: When calling edge functions from the frontend that require user identity, always use the live session token — `const { data: { session } } = await supabase.auth.getSession()` then `Authorization: Bearer ${session.access_token}`. Never use `VITE_SUPABASE_ANON_KEY` as the auth token — the anon key is not a user JWT and `auth.getUser()` will return null, causing 401 errors. In the edge function, validate the token with `supabase.auth.getUser(callerToken)` on the service-role client — never create a new client with the user JWT as the API key.

0. **Edge function role checks**: Always check roles via the `user_roles` table, not the legacy `role` column on `profiles`. Query `user_roles` with `.eq("user_id", user.id).in("role", [...])` to verify permissions.

2. **Resend invite**: Must UPDATE the `invitation_tokens` row (new token + reset `is_used=false` + new `expires_at`) AND call `auth.admin.updateUserById(userId, { password: tempPassword })` to keep auth in sync.

3. **Profile `account_owner_id`**: Set this when creating invited team members — it links them to the owner for org queries.

4. **RLS recursion**: Never query `profiles` or `user_roles` inside a policy on those same tables. Use SECURITY DEFINER helper functions.

5. **`maybeSingle()` not `single()`**: Use `maybeSingle()` for queries that may return 0 rows.

6. **Tab focus events**: Supabase fires `TOKEN_REFRESHED` and `INITIAL_SESSION` when a minimized or backgrounded tab regains focus. Both are ignored in `onAuthStateChange`. `SIGNED_IN` is also guarded — it only reloads data if the user ID changed from the currently loaded user (prevents re-render when the same session is restored). Do NOT add handling for `TOKEN_REFRESHED` or `INITIAL_SESSION`.

7. **Edge function imports**: Use `npm:` or `jsr:` prefixes. Never `deno.land/x`, `esm.sh`, or `unpkg.com`.

8. **Platform admin settings**: `admin_settings` table for platform admin has `account_id` matching their account. Account owners each have their own row keyed by `account_id`.
