import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FROM_ADDRESS = "QueryPing Notifications <no-reply.queryping@gmail.com>";
const SUPPORT_EMAIL = "support.queryping@gmail.com";

async function sendEmailNotifications(
  serviceClient: ReturnType<typeof createClient>,
  selectedMembers: string[],
  title: string,
  description: string,
  priority: string,
) {
  const gmailUser = Deno.env.get("GMAIL_USER");
  const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");

  if (!gmailUser || !gmailPassword) return;

  const { default: nodemailer } = await import("npm:nodemailer@6.9.8");

  const { data: memberProfiles } = await serviceClient
    .from("profiles")
    .select("id, full_name, email")
    .in("id", selectedMembers);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPassword },
  });

  const subject = `New Query Assigned: ${title}`;

  const sendPromises = (memberProfiles || []).map(async (member: any) => {
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;max-width:560px;">
        <tr>
          <td style="background:#1e293b;padding:24px 32px;">
            <p style="margin:0;color:#fff;font-size:20px;font-weight:700;">QueryPing</p>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">Never miss a pending query</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 16px;color:#0f172a;font-size:18px;font-weight:700;">A new query has been assigned to you</h2>
            <p style="margin:0 0 20px;color:#475569;font-size:14px;">Hi <strong>${member.full_name || member.email}</strong>, you have been assigned a new query that requires your response.</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:20px;">
              <p style="margin:0 0 8px;color:#374151;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Query Details</p>
              <p style="margin:0 0 6px;color:#0f172a;font-size:15px;font-weight:700;">${title}</p>
              ${description ? `<p style="margin:6px 0 8px;color:#64748b;font-size:13px;line-height:1.6;">${description}</p>` : ""}
              <p style="margin:0;font-size:13px;color:#4b5563;">Priority: <strong style="color:${priority === "urgent" ? "#dc2626" : priority === "high" ? "#ea580c" : "#2563eb"};">${(priority || "normal").toUpperCase()}</strong></p>
            </div>
            <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">Please log in to QueryPing to view the full details and submit your response.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f1f5f9;padding:20px 32px;border-top:2px solid #e2e8f0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="text-align:center;padding-bottom:10px;">
                  <p style="margin:0;font-size:13px;font-weight:600;color:#334155;">Need help or have a question?</p>
                  <p style="margin:6px 0 0;font-size:13px;color:#475569;">Reach out to us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#2563eb;font-weight:600;text-decoration:none;">${SUPPORT_EMAIL}</a> — we're happy to help.</p>
                </td>
              </tr>
              <tr>
                <td style="text-align:center;border-top:1px solid #cbd5e1;padding-top:10px;">
                  <p style="margin:0;color:#94a3b8;font-size:11px;">You received this because a query was assigned to you on QueryPing.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      const info = await transporter.sendMail({
        from: FROM_ADDRESS,
        to: member.email,
        subject,
        html,
      });

      await serviceClient.from("email_logs").insert({
        recipient: member.email,
        recipient_email: member.email,
        subject,
        status: "sent",
        sent_at: new Date().toISOString(),
        email_type: "query_assignment",
        message_id: info.messageId,
      });
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      await serviceClient.from("email_logs").insert({
        recipient: member.email,
        recipient_email: member.email,
        subject,
        status: "failed",
        sent_at: new Date().toISOString(),
        email_type: "query_assignment",
        error_message: msg,
      });
    }
  });

  await Promise.all(sendPromises);
}

const serviceClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerToken = authHeader.replace("Bearer ", "");

    let userId: string;
    try {
      const payload = JSON.parse(
        atob(callerToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
      );
      userId = payload.sub;
      if (!userId) throw new Error("missing sub");
    } catch {
      return new Response(
        JSON.stringify({ error: "Unauthorized: invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { title, description, priority, showPriority, selectedMembers, sendEmail } = body;

    if (!title || !selectedMembers?.length) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: title, selectedMembers" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: queryId, error: rpcError } = await serviceClient.rpc(
      "create_query_with_assignments",
      {
        p_user_id: userId,
        p_title: title,
        p_description: description || null,
        p_priority: priority || "normal",
        p_show_priority: showPriority !== false,
        p_members: selectedMembers,
      }
    );

    if (rpcError) {
      const isForbidden = rpcError.code === "42501" || /Forbidden/i.test(rpcError.message);
      return new Response(
        JSON.stringify({ error: rpcError.message }),
        { status: isForbidden ? 403 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (sendEmail && selectedMembers.length > 0) {
      EdgeRuntime.waitUntil(
        sendEmailNotifications(serviceClient, selectedMembers, title, description, priority)
      );
    }

    return new Response(
      JSON.stringify({ success: true, queryId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
