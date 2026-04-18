import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type ViolationType = "expired_token" | "permission_denied" | "invalid_credentials" | "rls_violation" | "unknown";

const VIOLATION_LABELS: Record<ViolationType, string> = {
  expired_token: "Expired / Invalid Token",
  permission_denied: "Permission Denied",
  invalid_credentials: "Invalid Credentials",
  rls_violation: "Row-Level Security Violation",
  unknown: "Unknown Unauthorized Access",
};

function buildAlertEmail(params: {
  violation_type: ViolationType;
  service_context: string;
  description: string;
  user_id: string | null;
  user_email: string | null;
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  attempted_at: string;
  log_id: string;
}): string {
  const {
    violation_type,
    service_context,
    description,
    user_id,
    user_email,
    error_code,
    error_message,
    metadata,
    attempted_at,
    log_id,
  } = params;

  const label = VIOLATION_LABELS[violation_type] ?? "Unauthorized Access";
  const dateStr = new Date(attempted_at).toUTCString();

  const violationColor: Record<ViolationType, string> = {
    expired_token: "#d97706",
    permission_denied: "#dc2626",
    invalid_credentials: "#dc2626",
    rls_violation: "#7c3aed",
    unknown: "#374151",
  };

  const color = violationColor[violation_type] ?? "#374151";

  const metaRows = metadata
    ? Object.entries(metadata)
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 8px;color:#6b7280;font-family:monospace;font-size:12px;">${k}</td>
             <td style="padding:4px 8px;color:#111827;font-family:monospace;font-size:12px;">${String(v)}</td></tr>`
        )
        .join("")
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#111827;border-radius:12px 12px 0 0;padding:28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display:inline-block;background:${color};color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:4px 12px;border-radius:20px;">
                      CRITICAL SECURITY ALERT
                    </span>
                    <h1 style="margin:12px 0 4px;color:#fff;font-size:22px;font-weight:700;">${label}</h1>
                    <p style="margin:0;color:#9ca3af;font-size:13px;">${dateStr}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#fff;padding:28px 32px;">

              <!-- Description box -->
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0;color:#991b1b;font-size:14px;line-height:1.6;">${description}</p>
              </div>

              <!-- Details table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th colspan="2" style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;">Event Details</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-top:1px solid #f3f4f6;">
                    <td style="padding:10px 16px;width:40%;color:#6b7280;font-size:13px;">Violation Type</td>
                    <td style="padding:10px 16px;color:#111827;font-size:13px;font-weight:600;">${label}</td>
                  </tr>
                  <tr style="border-top:1px solid #f3f4f6;background:#f9fafb;">
                    <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Service Context</td>
                    <td style="padding:10px 16px;font-family:monospace;color:#111827;font-size:12px;">${service_context}</td>
                  </tr>
                  <tr style="border-top:1px solid #f3f4f6;">
                    <td style="padding:10px 16px;color:#6b7280;font-size:13px;">User ID</td>
                    <td style="padding:10px 16px;font-family:monospace;color:#111827;font-size:12px;">${user_id ?? "anonymous"}</td>
                  </tr>
                  ${user_email ? `<tr style="border-top:1px solid #f3f4f6;background:#f9fafb;">
                    <td style="padding:10px 16px;color:#6b7280;font-size:13px;">User Email</td>
                    <td style="padding:10px 16px;color:#111827;font-size:13px;">${user_email}</td>
                  </tr>` : ""}
                  ${error_code ? `<tr style="border-top:1px solid #f3f4f6;">
                    <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Error Code</td>
                    <td style="padding:10px 16px;font-family:monospace;color:#dc2626;font-size:12px;">${error_code}</td>
                  </tr>` : ""}
                  ${error_message ? `<tr style="border-top:1px solid #f3f4f6;background:#f9fafb;">
                    <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Error Message</td>
                    <td style="padding:10px 16px;font-family:monospace;color:#374151;font-size:12px;">${error_message}</td>
                  </tr>` : ""}
                  <tr style="border-top:1px solid #f3f4f6;">
                    <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Log ID</td>
                    <td style="padding:10px 16px;font-family:monospace;color:#9ca3af;font-size:11px;">${log_id}</td>
                  </tr>
                </tbody>
              </table>

              ${metaRows ? `
              <!-- Metadata table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th colspan="2" style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;">Additional Metadata</th>
                  </tr>
                </thead>
                <tbody>${metaRows}</tbody>
              </table>` : ""}

              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                This is an automated security alert from your Query Manager system.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
                Query Manager &mdash; Platform Security Monitor
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      user_id,
      service_context,
      description,
      error_code,
      error_message,
      metadata,
      violation_type,
    } = body;

    if (!service_context || !description) {
      return new Response(
        JSON.stringify({ error: "service_context and description are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resolvedViolationType: ViolationType =
      ["expired_token", "permission_denied", "invalid_credentials", "rls_violation", "unknown"].includes(violation_type)
        ? violation_type
        : "unknown";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const attemptedAt = new Date().toISOString();

    const { data: inserted, error: insertError } = await supabase
      .from("security_audit_log")
      .insert({
        user_id: user_id ?? null,
        service_context,
        attempted_at: attemptedAt,
        description,
        error_code: error_code ?? null,
        error_message: error_message ?? null,
        metadata: metadata ?? null,
        violation_type: resolvedViolationType,
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const logId = inserted?.id ?? "unknown";

    EdgeRuntime.waitUntil((async () => {
      try {
        const gmailUser = Deno.env.get("GMAIL_USER");
        const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");
        if (!gmailUser || !gmailPassword) return;

        const { data: platformAdmins } = await supabase
          .from("user_roles")
          .select("user_id, profiles!inner(email, full_name, is_active, is_deleted)")
          .eq("role", "super_admin")
          .is("account_id", null);

        if (!platformAdmins || platformAdmins.length === 0) return;

        let userEmail: string | null = null;
        if (user_id) {
          const { data: actorProfile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", user_id)
            .maybeSingle();
          userEmail = actorProfile?.email ?? null;
        } else if (metadata?.email) {
          userEmail = String(metadata.email);
        }

        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: gmailUser, pass: gmailPassword },
        });

        const htmlBody = buildAlertEmail({
          violation_type: resolvedViolationType,
          service_context,
          description,
          user_id: user_id ?? null,
          user_email: userEmail,
          error_code: error_code ?? null,
          error_message: error_message ?? null,
          metadata: metadata ?? null,
          attempted_at: attemptedAt,
          log_id: logId,
        });

        const subject = `[SECURITY ALERT] ${VIOLATION_LABELS[resolvedViolationType]} — ${service_context}`;

        const recipients = (platformAdmins as any[])
          .filter((r) => r.profiles?.is_active && !r.profiles?.is_deleted && r.profiles?.email)
          .map((r) => r.profiles.email as string);

        if (recipients.length === 0) return;

        await Promise.all(
          recipients.map((to) =>
            transporter.sendMail({
              from: gmailUser,
              to,
              subject,
              html: htmlBody,
            }).catch(() => {})
          )
        );

        await supabase.from("email_logs").insert({
          recipient: recipients.join(", "),
          subject,
          status: "sent",
          sent_at: new Date().toISOString(),
          email_type: "security_alert",
        }).catch(() => {});
      } catch (_) {}
    })());

    return new Response(
      JSON.stringify({ success: true, id: logId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
