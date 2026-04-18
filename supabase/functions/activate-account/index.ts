import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { action, token, newPassword } = body;

    if (!token) {
      return new Response(JSON.stringify({ error: "Token is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up token
    const { data: invite, error: tokenError } = await serviceClient
      .from("invitation_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (tokenError || !invite) {
      return new Response(JSON.stringify({ error: "Invalid or expired activation link." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invite.is_used) {
      return new Response(JSON.stringify({ error: "This activation link has already been used." }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "This activation link has expired. Please contact your administrator." }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET action: validate token and return metadata
    if (action === "validate") {
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("full_name, email, role")
        .eq("id", invite.user_id)
        .maybeSingle();

      const { data: account } = await serviceClient
        .from("accounts")
        .select("name")
        .eq("id", invite.account_id)
        .maybeSingle();

      return new Response(JSON.stringify({
        valid: true,
        fullName: profile?.full_name,
        email: profile?.email,
        role: invite.role,
        supervisorName: invite.supervisor_name,
        accountName: account?.name,
        tempPassword: invite.temp_password,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTIVATE action: set new password and mark token used
    if (action === "activate") {
      if (!newPassword) {
        return new Response(JSON.stringify({ error: "New password is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update the user's password
      const { error: pwError } = await serviceClient.auth.admin.updateUserById(invite.user_id, {
        password: newPassword,
      });

      if (pwError) throw pwError;

      // Mark token as used
      await serviceClient
        .from("invitation_tokens")
        .update({ is_used: true })
        .eq("id", invite.id);

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
