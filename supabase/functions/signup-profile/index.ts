import { createClient } from "npm:@supabase/supabase-js@^2.57.4";
import nodemailer from "npm:nodemailer@6.9.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FROM_ADDRESS = "QueryPing Notifications <no-reply.queryping@gmail.com>";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const {
      userId,
      email,
      fullName,
      mobileNumber,
      accountType,
      accountDisplayName,
      expectedSupervisorCount,
      expectedMemberCount,
      appUrl,
    } = await req.json();

    if (!userId || !email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Create account
    const resolvedAccountName = accountDisplayName || `${fullName}'s Account`;
    const { data: accountData, error: accountError } = await supabase
      .from("accounts")
      .insert({
        owner_id: userId,
        name: resolvedAccountName,
        is_active: true,
        account_type: accountType ?? "business",
        mobile_number: mobileNumber ?? null,
        account_display_name: accountDisplayName ?? null,
        expected_supervisor_count: expectedSupervisorCount ?? null,
        expected_member_count: expectedMemberCount ?? null,
      })
      .select("id")
      .single();

    if (accountError) throw accountError;
    const accountId = accountData.id;

    // 2. Assign account_owner role
    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: userId,
      account_id: accountId,
      role: "account_owner",
      created_by: userId,
    });
    if (roleError) throw roleError;

    // 3. Update profile: link account, set role, account_type
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        role: "account_owner",
        account_id: accountId,
        account_type: accountType ?? "business",
        full_name: fullName ?? null,
        mobile_number: mobileNumber ?? null,
        account_display_name: accountDisplayName ?? null,
      })
      .eq("id", userId);
    if (profileError) throw profileError;

    // 4. Provision trial subscription
    const { data: trialPlan } = await supabase
      .from("subscription_plans")
      .select("id")
      .eq("is_trial", true)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (trialPlan) {
      const now = new Date();
      const trialEnds = new Date(now.getTime() + 14 * 86400000);
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

    // 5. Create default admin_settings
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

    // 6. Generate email verification link via Supabase Admin API (24h lifetime)
    const verifyRedirectTo = "https://queryping.org/verify-email";
    let verifyUrl = "https://queryping.org";
    try {
      const { data: linkData } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: verifyRedirectTo },
      });
      if (linkData?.properties?.action_link) {
        verifyUrl = linkData.properties.action_link;
      }
    } catch (_) {
      // Fall back to login page if link generation fails
      verifyUrl = "https://queryping.org";
    }

    // 7. Send welcome email with verification link
    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");

    if (gmailUser && gmailPassword) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPassword },
      });

      const subject = "Verify your QueryPing account";
      const typeLabel = accountType === "individual" ? "Individual" : "Business";
      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 32px 16px;">
          <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">

            <!-- Header -->
            <div style="background: #0f172a; padding: 28px 32px;">
              <p style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">QueryPing</p>
              <p style="margin: 5px 0 0; font-size: 13px; color: #94a3b8;">Query Management Platform</p>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
              <h2 style="margin: 0 0 6px; font-size: 20px; font-weight: 700; color: #0f172a;">Welcome, ${fullName || "there"}!</h2>
              <p style="margin: 0 0 24px; font-size: 14px; color: #64748b; line-height: 1.6;">
                Your QueryPing account has been created. To complete your signup and access your dashboard, you must verify your email address by clicking the button below.
              </p>

              <!-- CTA button -->
              <div style="text-align: center; margin: 0 0 24px;">
                <a href="${verifyUrl}"
                  style="display: inline-block; background: #0f172a; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 10px; letter-spacing: -0.1px;">
                  Verify My Account
                </a>
              </div>

              <!-- Expiry warning -->
              <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 16px; margin-bottom: 24px; display: flex; align-items: flex-start; gap: 10px;">
                <span style="font-size: 16px; flex-shrink: 0;">⏰</span>
                <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                  <strong>This link expires in 24 hours.</strong> If it expires, you can request a new one from the sign-in page using "Forgot password".
                </p>
              </div>

              <!-- Account details -->
              <div style="background: #f8fafc; border-radius: 10px; padding: 16px 18px; margin-bottom: 24px;">
                <p style="margin: 0 0 10px; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.6px;">Your Account</p>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="font-size: 13px; color: #64748b; padding: 3px 0; width: 90px;">Account</td>
                    <td style="font-size: 13px; color: #0f172a; font-weight: 600; padding: 3px 0;">${resolvedAccountName}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 13px; color: #64748b; padding: 3px 0;">Email</td>
                    <td style="font-size: 13px; color: #0f172a; font-weight: 600; padding: 3px 0;">${email}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 13px; color: #64748b; padding: 3px 0;">Type</td>
                    <td style="font-size: 13px; color: #0f172a; font-weight: 600; padding: 3px 0;">${typeLabel}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 13px; color: #64748b; padding: 3px 0;">Trial</td>
                    <td style="font-size: 13px; color: #059669; font-weight: 600; padding: 3px 0;">15 days free — no card required</td>
                  </tr>
                </table>
              </div>

              <p style="margin: 0 0 6px; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                If you did not create this account, you can safely ignore this email.
              </p>
            </div>

            <!-- Footer -->
            <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 32px;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.6;">
                Need help? Contact us at
                <a href="mailto:support.queryping@gmail.com" style="color: #64748b; text-decoration: none;">support.queryping@gmail.com</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        const info = await transporter.sendMail({ from: FROM_ADDRESS, to: email, subject, html });
        await supabase.from("email_logs").insert({
          recipient: fullName || email,
          recipient_email: email,
          subject,
          status: "sent",
          email_type: "invitation",
          message_id: info.messageId,
          triggered_by: userId,
        });
      } catch (emailErr: any) {
        await supabase.from("email_logs").insert({
          recipient: fullName || email,
          recipient_email: email,
          subject,
          status: "failed",
          email_type: "invitation",
          error_message: emailErr?.message ?? String(emailErr),
          triggered_by: userId,
        });
        // Don't throw — account was created successfully even if email failed
      }
    }

    return new Response(
      JSON.stringify({ success: true, userId, accountId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
