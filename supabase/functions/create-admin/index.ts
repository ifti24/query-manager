import { createClient } from "npm:@supabase/supabase-js@^2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email, password, fullName, adminToken, role = "account_owner", accountName } = await req.json();

    const expectedToken = Deno.env.get("ADMIN_CREATION_TOKEN");
    if (!expectedToken || adminToken !== expectedToken) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing admin token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const validRoles = ["account_owner", "super_admin", "support_admin"];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: "Invalid role. Must be account_owner, super_admin, or support_admin" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError) throw authError;

    const userId = authData.user?.id;
    if (!userId) throw new Error("User creation failed");

    const { error: profileError } = await supabase.from("profiles").update({
      role,
      full_name: fullName,
    }).eq("id", userId);

    if (profileError) throw profileError;

    if (role === "account_owner") {
      const resolvedAccountName = accountName || `${fullName}'s Account`;

      const { data: accountData, error: accountError } = await supabase
        .from("accounts")
        .insert({
          owner_id: userId,
          name: resolvedAccountName,
          is_active: true,
        })
        .select("id")
        .single();

      if (accountError) throw accountError;

      const accountId = accountData.id;

      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: userId,
        account_id: accountId,
        role: "account_owner",
        created_by: userId,
      });

      if (roleError) throw roleError;

      const { error: profileAccountError } = await supabase
        .from("profiles")
        .update({ account_id: accountId })
        .eq("id", userId);

      if (profileAccountError) throw profileAccountError;

      const { data: trialPlan } = await supabase
        .from("subscription_plans")
        .select("id")
        .eq("is_trial", true)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (trialPlan) {
        const trialDays = 14;
        const now = new Date();
        const trialEnds = new Date(now.getTime() + trialDays * 86400000);

        await supabase.from("subscriptions").insert({
          account_id: accountId,
          plan_id: trialPlan.id,
          status: "trial",
          queries_used: 0,
          queries_reset_at: now.toISOString(),
          trial_started_at: now.toISOString(),
          trial_ends_at: trialEnds.toISOString(),
          started_at: now.toISOString(),
        });
      }

      await supabase.from("admin_settings").insert({
        account_id: accountId,
        email_schedule_time: "09:00",
        email_schedule_enabled: false,
        email_timezone: "UTC",
        email_schedule_days: [1, 2, 3, 4, 5],
        digest_blacklist_dates: [],
        email_send_on_create: true,
        max_file_size_mb: 10,
        allowed_file_types: ["image/jpeg", "image/png", "application/pdf"],
        blacklisted_file_types: [],
        session_idle_timeout_minutes: 30,
        session_warning_seconds: 60,
        password_reset_link_validity_hours: 24,
        password_min_length: 8,
        password_max_length: 128,
        password_require_uppercase: false,
        password_min_uppercase: 0,
        password_require_lowercase: false,
        password_min_lowercase: 0,
        password_require_numbers: false,
        password_min_numbers: 0,
        password_require_special: false,
        password_min_special: 0,
        password_allowed_special_chars: "!@#$%^&*",
        password_policy_applies_to: [],
      });

      return new Response(
        JSON.stringify({ success: true, userId, accountId }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: platformRoleError } = await supabase.from("user_roles").insert({
      user_id: userId,
      account_id: null,
      role,
      created_by: userId,
    });

    if (platformRoleError) throw platformRoleError;

    return new Response(
      JSON.stringify({ success: true, userId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
