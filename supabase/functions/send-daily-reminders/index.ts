import { createClient } from "npm:@supabase/supabase-js@^2.57.4";
import nodemailer from "npm:nodemailer@6.9.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FROM_ADDRESS = "QueryPing Notifications <no-reply.queryping@gmail.com>";
const SUPPORT_EMAIL = "support.queryping@gmail.com";

interface PendingQuery {
  id: string;
  title: string;
  description: string;
  priority: string;
  age_days: number;
  status: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    if (!gmailUser || !gmailPassword) {
      throw new Error("Gmail credentials not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD environment variables.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const triggered_by: string = body.triggered_by ?? "system";

    // When triggered by an admin manually, validate they are account_owner or super_admin
    let forceAccountId: string | null = null;
    if (triggered_by === "admin" || body.force === true) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Missing or invalid authorization header" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const callerToken = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabase.auth.getUser(callerToken);
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role, account_id")
        .eq("user_id", user.id)
        .in("role", ["account_owner", "super_admin", "support_admin"])
        .maybeSingle();

      if (!userRole) {
        return new Response(JSON.stringify({ error: "Forbidden: account owner access required" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // For account_owner, restrict to their own account
      if (userRole.role === "account_owner" && userRole.account_id) {
        forceAccountId = userRole.account_id;
      }
    }

    // Load all active accounts with their admin_settings
    const { data: allSettings, error: settingsError } = await supabase
      .from("admin_settings")
      .select("account_id, email_schedule_time, email_schedule_enabled, email_timezone, email_schedule_days, digest_blacklist_dates");

    if (settingsError) throw settingsError;
    if (!allSettings || allSettings.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "No admin settings found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPassword },
    });

    const digestBatchId = crypto.randomUUID();
    const emailSummary: { email: string; account_id: string; queriesCount: number; status: string; error?: string }[] = [];
    const now = Date.now();

    // Process each account independently
    for (const settings of allSettings) {
      const accountId: string = settings.account_id;

      // If force-run by a specific account_owner, skip other accounts
      if (forceAccountId && accountId !== forceAccountId) continue;

      // For scheduled runs, check this account's schedule settings
      if (!forceAccountId && triggered_by !== "admin") {
        if (!settings.email_schedule_enabled) continue;

        const scheduledTime: string = settings.email_schedule_time ?? "08:00";
        const timezone: string = settings.email_timezone ?? "GMT+0";
        const scheduleDays: number[] = Array.isArray(settings.email_schedule_days)
          ? settings.email_schedule_days
          : [1, 2, 3, 4, 5];
        const blacklistDates: string[] = Array.isArray(settings.digest_blacklist_dates)
          ? settings.digest_blacklist_dates
          : [];

        const offsetMinutes = parseGmtOffset(timezone);
        const localMs = now + offsetMinutes * 60 * 1000;
        const localDate = new Date(localMs);

        const currentLocalTime = `${localDate.getUTCHours().toString().padStart(2, "0")}:${localDate.getUTCMinutes().toString().padStart(2, "0")}`;
        if (currentLocalTime !== scheduledTime) continue;

        const localDayOfWeek = localDate.getUTCDay();
        if (!scheduleDays.includes(localDayOfWeek)) continue;

        const localDateKey = `${localDate.getUTCFullYear()}-${String(localDate.getUTCMonth() + 1).padStart(2, "0")}-${String(localDate.getUTCDate()).padStart(2, "0")}`;
        if (isDateBlacklisted(localDateKey, blacklistDates)) continue;
      }

      // Get the account owner's email for the admin summary
      const { data: ownerRoles } = await supabase
        .from("user_roles")
        .select("user_id, profiles!user_roles_user_id_fkey(email, full_name)")
        .eq("account_id", accountId)
        .eq("role", "account_owner")
        .limit(1);

      const ownerProfile = (ownerRoles?.[0] as any)?.profiles;

      // Get all active members (role = member or supervisor) in this account
      const { data: memberRoles, error: membersError } = await supabase
        .from("user_roles")
        .select("user_id, profiles!user_roles_user_id_fkey(id, email, full_name, is_active, is_deleted)")
        .eq("account_id", accountId)
        .in("role", ["member", "supervisor"]);

      if (membersError) {
        console.error(`Error fetching members for account ${accountId}:`, membersError);
        continue;
      }

      const members = (memberRoles ?? [])
        .map((r: any) => r.profiles)
        .filter((p: any) => p && p.is_active && !p.is_deleted);

      const memberQueryCounts: { name: string; email: string; openQueries: number }[] = [];

      for (const member of members) {
        const { data: pendingQueries, error: queriesError } = await supabase
          .from("query_assignments")
          .select(`
            query_id,
            queries (
              id,
              title,
              description,
              priority,
              created_at,
              status,
              archived
            )
          `)
          .eq("assigned_to", member.id);

        if (queriesError) {
          console.error(`Error fetching queries for ${member.email}:`, queriesError);
          continue;
        }

        const validQueries: PendingQuery[] = (pendingQueries ?? [])
          .filter((q: any) => {
            if (!q.queries) return false;
            const query = q.queries;
            return ["open", "awaiting_response", "pending"].includes(query.status) && !query.archived;
          })
          .map((q: any) => {
            const query = q.queries;
            const ageDays = Math.floor((now - new Date(query.created_at).getTime()) / (1000 * 60 * 60 * 24));
            return {
              id: query.id,
              title: query.title,
              description: query.description ?? "",
              priority: query.priority ?? "normal",
              age_days: ageDays,
              status: query.status,
            };
          });

        memberQueryCounts.push({ name: member.full_name || member.email, email: member.email, openQueries: validQueries.length });

        if (validQueries.length === 0) continue;

        const emailBody = generateMemberEmailBody(member.full_name, validQueries);
        const subject = `${validQueries.length} Pending ${validQueries.length === 1 ? "Query" : "Queries"} Awaiting Your Response`;

        try {
          const info = await transporter.sendMail({
            from: FROM_ADDRESS,
            to: member.email,
            subject,
            html: emailBody,
          });

          await supabase.from("email_logs").insert({
            recipient_email: member.email,
            recipient: member.email,
            subject,
            status: "sent",
            sent_at: new Date().toISOString(),
            email_type: "digest",
            digest_batch_id: digestBatchId,
            total_queries_count: validQueries.length,
            triggered_by,
            message_id: info.messageId,
          });

          emailSummary.push({ email: member.email, account_id: accountId, queriesCount: validQueries.length, status: "sent" });
        } catch (err: any) {
          const errMsg = err?.message ?? String(err);
          console.error(`Failed to send email to ${member.email}:`, errMsg);

          await supabase.from("email_logs").insert({
            recipient_email: member.email,
            recipient: member.email,
            subject,
            status: "failed",
            error_message: errMsg,
            sent_at: new Date().toISOString(),
            email_type: "digest",
            digest_batch_id: digestBatchId,
            total_queries_count: validQueries.length,
            triggered_by,
          });

          emailSummary.push({ email: member.email, account_id: accountId, queriesCount: validQueries.length, status: "failed", error: errMsg });
        }
      }

      // Send admin summary to account owner
      if (ownerProfile?.email && memberQueryCounts.length > 0) {
        const totalOpen = memberQueryCounts.reduce((s, m) => s + m.openQueries, 0);
        const adminEmailBody = generateOwnerSummaryEmailBody(ownerProfile.full_name, memberQueryCounts, totalOpen);
        const adminSubject = "Daily Query Summary — QueryPing";

        try {
          const info = await transporter.sendMail({
            from: FROM_ADDRESS,
            to: ownerProfile.email,
            subject: adminSubject,
            html: adminEmailBody,
          });

          await supabase.from("email_logs").insert({
            recipient_email: ownerProfile.email,
            recipient: ownerProfile.email,
            subject: adminSubject,
            status: "sent",
            sent_at: new Date().toISOString(),
            email_type: "digest",
            digest_batch_id: digestBatchId,
            triggered_by,
            message_id: info.messageId,
          });

          emailSummary.push({ email: ownerProfile.email, account_id: accountId, queriesCount: totalOpen, status: "sent (owner summary)" });
        } catch (err: any) {
          const errMsg = err?.message ?? String(err);
          console.error(`Failed to send owner summary to ${ownerProfile.email}:`, errMsg);

          await supabase.from("email_logs").insert({
            recipient_email: ownerProfile.email,
            recipient: ownerProfile.email,
            subject: adminSubject,
            status: "failed",
            error_message: errMsg,
            sent_at: new Date().toISOString(),
            email_type: "digest",
            digest_batch_id: digestBatchId,
            triggered_by,
          });
        }

        // Update last digest send info on admin_settings
        await supabase
          .from("admin_settings")
          .update({ digest_batch_id: digestBatchId })
          .eq("account_id", accountId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent: emailSummary.filter((e) => e.status.startsWith("sent")).length,
        emailsFailed: emailSummary.filter((e) => e.status === "failed").length,
        summary: emailSummary,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseGmtOffset(timezone: string): number {
  const match = timezone.match(/^GMT([+-])(\d+)(?::(\d+))?$/);
  if (!match) return 0;
  const sign = match[1] === "+" ? 1 : -1;
  const hours = parseInt(match[2]);
  const minutes = parseInt(match[3] ?? "0");
  return sign * (hours * 60 + minutes);
}

function isDateBlacklisted(dateKey: string, blacklist: string[]): boolean {
  for (const entry of blacklist) {
    if (entry.includes("/")) {
      const [start, end] = entry.split("/");
      if (dateKey >= start && dateKey <= end) return true;
    } else if (entry === dateKey) {
      return true;
    }
  }
  return false;
}

function emailFooter(): string {
  return `
        <tr>
          <td style="background:#f1f5f9;padding:20px 32px;border-top:2px solid #e2e8f0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="text-align:center;padding-bottom:10px;">
                  <p style="margin:0;font-size:13px;font-weight:600;color:#334155;">Need help or have a question?</p>
                  <p style="margin:6px 0 0;font-size:13px;color:#475569;">
                    Reach out to us at
                    <a href="mailto:${SUPPORT_EMAIL}" style="color:#2563eb;font-weight:600;text-decoration:none;">${SUPPORT_EMAIL}</a>
                    — we're happy to help.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="text-align:center;border-top:1px solid #cbd5e1;padding-top:10px;">
                  <p style="margin:0;color:#94a3b8;font-size:11px;">
                    &copy; QueryPing &nbsp;|&nbsp; Never miss a pending query
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

function generateMemberEmailBody(userName: string, queries: PendingQuery[]): string {
  const urgentQueries = queries.filter((q) => q.priority === "urgent" || q.age_days > 3);

  const queryRows = queries.map((q) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;">
        <p style="margin:0;font-weight:600;color:#0f172a;font-size:14px;">${escapeHtml(q.title)}</p>
        ${q.description ? `<p style="margin:4px 0 0 0;color:#64748b;font-size:12px;">${escapeHtml(q.description.substring(0, 80))}${q.description.length > 80 ? "…" : ""}</p>` : ""}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;white-space:nowrap;">
        <span style="display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;${
          q.priority === "urgent" ? "background:#fee2e2;color:#991b1b;" :
          q.priority === "high" ? "background:#fed7aa;color:#9a3412;" :
          "background:#dbeafe;color:#1e40af;"
        }">${q.priority.toUpperCase()}</span>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;white-space:nowrap;color:#64748b;font-size:13px;">${q.age_days}d old</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;max-width:580px;">
        <tr>
          <td style="background:#1e293b;padding:24px 32px;">
            <p style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">QueryPing</p>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">Never miss a pending query</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${urgentQueries.length > 0 ? `
            <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:14px 16px;border-radius:6px;margin-bottom:24px;">
              <p style="margin:0;font-weight:700;color:#991b1b;font-size:14px;">Urgent Action Required</p>
              <p style="margin:6px 0 0;color:#7f1d1d;font-size:13px;">${urgentQueries.length} ${urgentQueries.length === 1 ? "query is" : "queries are"} overdue or marked urgent. Please respond immediately.</p>
            </div>` : ""}
            <p style="margin:0 0 20px;color:#334155;font-size:15px;">Hi <strong>${escapeHtml(userName || "there")}</strong>,</p>
            <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">You have <strong style="color:#0f172a;">${queries.length} pending ${queries.length === 1 ? "query" : "queries"}</strong> waiting for your response:</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;">Query</th>
                  <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;">Priority</th>
                  <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;">Age</th>
                </tr>
              </thead>
              <tbody>${queryRows}</tbody>
            </table>

            <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
              Please log in to QueryPing to view the full details and submit your responses.
            </p>
          </td>
        </tr>
        ${emailFooter()}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function generateOwnerSummaryEmailBody(
  ownerName: string,
  members: { name: string; email: string; openQueries: number }[],
  totalOpen: number
): string {
  const memberRows = members.map((m) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;">
        <p style="margin:0;font-weight:600;color:#0f172a;font-size:14px;">${escapeHtml(m.name)}</p>
        <p style="margin:2px 0 0;color:#94a3b8;font-size:12px;">${escapeHtml(m.email)}</p>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;text-align:center;">
        <span style="display:inline-block;padding:4px 14px;border-radius:99px;font-size:14px;font-weight:700;${
          m.openQueries > 0 ? "background:#fef3c7;color:#92400e;" : "background:#d1fae5;color:#065f46;"
        }">${m.openQueries}</span>
      </td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;max-width:580px;">
        <tr>
          <td style="background:#1e293b;padding:24px 32px;">
            <p style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">QueryPing</p>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">Daily digest summary</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;color:#334155;font-size:15px;">Hi <strong>${escapeHtml(ownerName || "there")}</strong>,</p>
            <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">Here is today's query activity summary across your team.</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:24px;">
              <tr>
                <td style="background:#eff6ff;padding:16px 20px;text-align:center;">
                  <p style="margin:0;font-size:32px;font-weight:800;color:#1d4ed8;">${members.length}</p>
                  <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.5px;">Team Members</p>
                </td>
                <td style="background:#f0fdf4;padding:16px 20px;text-align:center;border-left:1px solid #e2e8f0;">
                  <p style="margin:0;font-size:32px;font-weight:800;color:#15803d;">${totalOpen}</p>
                  <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#16a34a;text-transform:uppercase;letter-spacing:0.5px;">Open Queries</p>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;">Team Member</th>
                  <th style="padding:10px 16px;text-align:center;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;">Open Queries</th>
                </tr>
              </thead>
              <tbody>${memberRows}</tbody>
            </table>
          </td>
        </tr>
        ${emailFooter()}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
