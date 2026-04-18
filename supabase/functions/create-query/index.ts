import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

  const sendPromises = (memberProfiles || []).map(async (member) => {
    try {
      const info = await transporter.sendMail({
        from: gmailUser,
        to: member.email,
        subject: `New Query Assigned: ${title}`,
        html: `
          <h2>You have been assigned a new query</h2>
          <p><strong>Title:</strong> ${title}</p>
          <p><strong>Description:</strong> ${description || "No description provided"}</p>
          <p><strong>Priority:</strong> ${priority || "normal"}</p>
          <p><strong>Status:</strong> Pending</p>
          <p>Please log in to the system to view and respond to this query.</p>
        `,
      });
      await serviceClient.from("email_logs").insert({
        recipient: member.email,
        subject: `New Query Assigned: ${title}`,
        status: "sent",
        sent_at: new Date().toISOString(),
        message_id: info.messageId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await serviceClient.from("email_logs").insert({
        recipient: member.email,
        subject: `New Query Assigned: ${title}`,
        status: "failed",
        sent_at: new Date().toISOString(),
        error_message: msg,
      });
    }
  });

  await Promise.all(sendPromises);
}

const serviceClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
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
      const payload = JSON.parse(atob(callerToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
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
      },
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
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
