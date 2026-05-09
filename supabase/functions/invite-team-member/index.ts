import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer@6.9.8";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FROM_ADDRESS = "QueryPing Notifications <no-reply.queryping@gmail.com>";
const SUPPORT_EMAIL = "support.queryping@gmail.com";

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

function generateCompliantPassword(policy: any): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = policy?.password_allowed_special_chars || "!@#$%^&*";

  let password = "";

  if (policy?.password_require_uppercase) {
    for (let i = 0; i < (policy.password_min_uppercase || 1); i++) {
      password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    }
  } else {
    password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  }

  if (policy?.password_require_lowercase) {
    for (let i = 0; i < (policy.password_min_lowercase || 1); i++) {
      password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    }
  } else {
    password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  }

  if (policy?.password_require_numbers) {
    for (let i = 0; i < (policy.password_min_numbers || 1); i++) {
      password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
  } else {
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  if (policy?.password_require_special) {
    for (let i = 0; i < (policy.password_min_special || 1); i++) {
      password += special.charAt(Math.floor(Math.random() * special.length));
    }
  } else {
    password += special.charAt(Math.floor(Math.random() * special.length));
  }

  const allChars = uppercase + lowercase + numbers + special;
  const minLength = policy?.password_min_length || 8;
  const maxLength = policy?.password_max_length || 64;

  while (password.length < minLength) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }

  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("")
    .slice(0, maxLength);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!gmailUser || !gmailPassword) {
      throw new Error("Email credentials not configured.");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerToken = authHeader.replace("Bearer ", "");

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${callerToken}` } },
    });

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const {
      email,
      fullName,
      designation,
      gender,
      employeeId,
      unitDepartment,
      division,
      role,
      mobileNumber,
      supervisorId,
      supervisorName,
      accountId,
      appUrl,
      isResend,
      invitationTokenId,
    } = body;

    if (!email || !fullName || !role || !accountId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is account owner or supervisor for this account
    const { data: callerRole } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("account_id", accountId)
      .in("role", ["account_owner", "supervisor"])
      .limit(1)
      .maybeSingle();

    if (!callerRole) {
      return new Response(
        JSON.stringify({ error: "Forbidden: only account owners and supervisors can invite members" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get account settings for password policy and invite link validity
    const { data: settings } = await serviceClient
      .from("admin_settings")
      .select(
        "password_min_length, password_max_length, password_require_uppercase, password_min_uppercase, password_require_lowercase, password_min_lowercase, password_require_numbers, password_min_numbers, password_require_special, password_min_special, password_allowed_special_chars, invite_link_validity_hours"
      )
      .eq("account_id", accountId)
      .maybeSingle();

    const inviteValidityHours = settings?.invite_link_validity_hours ?? 24;
    const expiresAt = new Date(Date.now() + inviteValidityHours * 60 * 60 * 1000).toISOString();

    let tempPassword: string;
    let token: string;
    let userId: string;

    if (isResend && invitationTokenId) {
      // Resend: look up the existing invitation token row
      const { data: tokenRow } = await serviceClient
        .from("invitation_tokens")
        .select("user_id, temp_password")
        .eq("id", invitationTokenId)
        .maybeSingle();

      if (!tokenRow) {
        return new Response(JSON.stringify({ error: "Invitation token not found." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = tokenRow.user_id;
      // Keep the same temp password so the user's auth password stays in sync
      tempPassword = tokenRow.temp_password || generateCompliantPassword(settings);
      // Always issue a fresh token and expiry on resend
      token = generateToken();

      await serviceClient
        .from("invitation_tokens")
        .update({
          token,
          temp_password: tempPassword,
          is_used: false,
          expires_at: expiresAt,
        })
        .eq("id", invitationTokenId);

      // Reset the auth password to match temp_password (in case it changed)
      await serviceClient.auth.admin.updateUserById(userId, { password: tempPassword });

    } else {
      // New invite: check for duplicate email in this account
      const { data: existingRoles } = await serviceClient
        .from("user_roles")
        .select("user_id, profiles!user_roles_user_id_fkey(email)")
        .eq("account_id", accountId)
        .in("role", ["supervisor", "member"]);

      const duplicate = (existingRoles || []).some(
        (r: any) => r.profiles?.email?.toLowerCase() === email.toLowerCase()
      );

      if (duplicate) {
        return new Response(
          JSON.stringify({ error: "A user with this email already exists under this account." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      tempPassword = generateCompliantPassword(settings);

      const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
        email,
        password: tempPassword,
        user_metadata: { full_name: fullName },
        email_confirm: true,
      });

      if (createError) throw createError;

      userId = newUser.user?.id;
      if (!userId) throw new Error("User creation failed");

      // Update the profile created by the trigger
      await serviceClient.from("profiles").update({
        full_name: fullName,
        role,
        account_id: accountId,
        account_owner_id: caller.id,
        designation: designation || "",
        gender: gender || "",
        employee_id: employeeId || "",
        unit_department: unitDepartment || "",
        division: division || "",
        mobile_number: mobileNumber || null,
        supervisor_id: supervisorId || null,
      }).eq("id", userId);

      await serviceClient.from("user_roles").insert({
        user_id: userId,
        account_id: accountId,
        role,
        created_by: caller.id,
      });

      token = generateToken();

      await serviceClient.from("invitation_tokens").insert({
        token,
        user_id: userId,
        account_id: accountId,
        invited_by: caller.id,
        temp_password: tempPassword,
        role,
        supervisor_id: supervisorId || null,
        supervisor_name: supervisorName || "",
        expires_at: expiresAt,
      });
    }

    // Get account name for the email
    const { data: account } = await serviceClient
      .from("accounts")
      .select("name")
      .eq("id", accountId)
      .maybeSingle();

    const accountName = account?.name || "your organisation";
    const activationUrl = `${appUrl || "https://app.querying.io"}/activate?token=${token}`;
    const roleLabel = role === "supervisor" ? "Supervisor" : "Member";
    const supervisorLine =
      role === "member" && supervisorName
        ? `<p style="color:#4b5563;font-size:14px;margin:0 0 8px 0;">Reporting to: <strong>${supervisorName}</strong></p>`
        : "";

    const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;max-width:560px;">
        <tr>
          <td style="background:#1e293b;padding:28px 36px;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.3px;">QueryPing</h1>
            <p style="color:#94a3b8;margin:4px 0 0 0;font-size:12px;letter-spacing:0.5px;">Never miss a pending query</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px;">
            <h2 style="color:#0f172a;font-size:20px;margin:0 0 16px 0;font-weight:700;">${isResend ? "Your invitation has been resent" : `You've been invited to join ${accountName}`}</h2>
            <p style="color:#4b5563;font-size:14px;margin:0 0 24px 0;line-height:1.6;">
              Hi <strong>${fullName}</strong>, ${isResend ? "a new activation link has been generated for your account on QueryPing" : `an account has been created for you on QueryPing as a <strong>${roleLabel}</strong> under <strong>${accountName}</strong>`}.
            </p>

            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;">
              <p style="color:#374151;font-size:13px;font-weight:600;margin:0 0 12px 0;text-transform:uppercase;letter-spacing:0.5px;">Your Account Details</p>
              <p style="color:#4b5563;font-size:14px;margin:0 0 8px 0;">Organisation: <strong>${accountName}</strong></p>
              <p style="color:#4b5563;font-size:14px;margin:0 0 8px 0;">Role: <strong>${roleLabel}</strong></p>
              ${supervisorLine}
              <p style="color:#4b5563;font-size:14px;margin:0 0 8px 0;">Email: <strong>${email}</strong></p>
              <p style="color:#4b5563;font-size:14px;margin:0;">Temporary Password: <strong style="font-family:monospace;background:#e2e8f0;padding:2px 6px;border-radius:4px;">${tempPassword}</strong></p>
            </div>

            <p style="color:#4b5563;font-size:14px;margin:0 0 24px 0;line-height:1.6;">
              Click the button below to activate your account and set a new password. This link will expire in <strong>${inviteValidityHours} hours</strong>.
            </p>

            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
              <tr>
                <td style="background:#1e293b;border-radius:8px;">
                  <a href="${activationUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">Activate My Account</a>
                </td>
              </tr>
            </table>

            <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.6;">
              If the button doesn't work, copy and paste this URL into your browser:<br>
              <span style="color:#3b82f6;word-break:break-all;">${activationUrl}</span>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f1f5f9;padding:20px 36px;border-top:2px solid #e2e8f0;">
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
                    This invitation was sent by ${accountName} via QueryPing. If you did not expect this email, you can safely ignore it.
                  </p>
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

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPassword },
    });

    const subject = isResend
      ? `Your QueryPing activation link has been resent — ${accountName}`
      : `You've been invited to join ${accountName} on QueryPing`;

    await transporter.sendMail({
      from: FROM_ADDRESS,
      to: email,
      subject,
      html: htmlBody,
    });

    await serviceClient.from("email_logs").insert({
      recipient: email,
      recipient_email: email,
      subject,
      status: "sent",
      sent_at: new Date().toISOString(),
      email_type: "invitation",
    });

    return new Response(JSON.stringify({ success: true, userId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    // Log the failure if we have enough context
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const sc = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        await sc.from("email_logs").insert({
          status: "failed",
          error_message: error?.message ?? String(error),
          sent_at: new Date().toISOString(),
          email_type: "invitation",
        });
      } catch { /* swallow logging error */ }
    }

    return new Response(
      JSON.stringify({ error: error?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
