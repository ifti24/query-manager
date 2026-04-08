import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer@6.9.8";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");

    console.log("Gmail user configured:", gmailUser ? "Yes" : "No");
    console.log("Gmail password configured:", gmailPassword ? "Yes" : "No");

    if (!gmailUser || !gmailPassword) {
      throw new Error("Gmail credentials not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD environment variables.");
    }

    const { to, subject, html, from }: EmailRequest = await req.json();

    console.log("Email request received:", { to, subject, hasHtml: !!html });

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPassword,
      },
    });

    console.log("Attempting to send email...");

    let emailStatus = "failed";
    let errorMessage = null;

    try {
      const info = await transporter.sendMail({
        from: from || gmailUser,
        to: to,
        subject: subject,
        html: html,
      });

      console.log("Email sent successfully:", info.messageId);
      emailStatus = "sent";

      await supabase.from("email_logs").insert({
        recipient: to,
        subject: subject,
        status: emailStatus,
        sent_at: new Date().toISOString(),
        message_id: info.messageId,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Email sent successfully",
          messageId: info.messageId,
          recipientEmail: to,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (sendError) {
      console.error("Failed to send email:", sendError);
      emailStatus = "failed";
      errorMessage = sendError.message || sendError.toString();

      await supabase.from("email_logs").insert({
        recipient: to,
        subject: subject,
        status: emailStatus,
        sent_at: new Date().toISOString(),
        error_message: errorMessage,
      });

      throw sendError;
    }
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        details: error.toString()
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
