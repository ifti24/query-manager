import { createClient } from "npm:@supabase/supabase-js@^2.57.4";
import nodemailer from "npm:nodemailer@6.9.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
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
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPassword,
      },
    });

    const { triggered_by = 'system' } = await req.json().catch(() => ({ triggered_by: 'system' }));
    const digestBatchId = crypto.randomUUID();

    const { data: teamMembers, error: membersError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', 'team_member')
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (membersError) throw membersError;

    console.log('Team members found:', teamMembers?.length || 0);
    console.log('Team members:', JSON.stringify(teamMembers));

    const emailSummary = [];

    for (const member of teamMembers) {
      console.log(`\n=== Processing member: ${member.email} (${member.id}) ===`);
      const { data: pendingQueries, error: queriesError } = await supabase
        .from('query_assignments')
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
        .eq('assigned_to', member.id);

      if (queriesError) {
        console.error(`Error fetching queries for ${member.email}:`, queriesError);
        continue;
      }

      console.log(`Pending queries raw data (${pendingQueries?.length || 0}):`, JSON.stringify(pendingQueries));

      if (!pendingQueries || pendingQueries.length === 0) {
        console.log('No pending queries found for this member');
        continue;
      }

      const validQueries = pendingQueries
        .filter(q => {
          if (!q.queries) {
            console.log('Filtered out: no queries object');
            return false;
          }
          const query = q.queries as any;
          const validStatuses = ['open', 'awaiting_response', 'pending'];
          const isValid = validStatuses.includes(query.status) && query.archived === false;
          console.log(`Query ${query.id} (${query.title}): status=${query.status}, archived=${query.archived}, valid=${isValid}`);
          return isValid;
        })
        .map(q => {
          const query = q.queries as any;
          const createdAt = new Date(query.created_at);
          const ageDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

          return {
            id: query.id,
            title: query.title,
            description: query.description,
            priority: query.priority,
            age_days: ageDays,
            status: query.status,
          };
        });

      console.log(`Valid queries after filtering: ${validQueries.length}`);

      if (validQueries.length === 0) {
        console.log('No valid queries, skipping email');
        continue;
      }

      const emailBody = generateUserEmailBody(member.full_name, validQueries, supabaseUrl);
      const subject = `${validQueries.length} Pending ${validQueries.length === 1 ? 'Query' : 'Queries'} Awaiting Your Response`;

      console.log(`Preparing to send email to ${member.email} via Gmail`);

      try {
        console.log('Sending email via Gmail nodemailer...');
        const info = await transporter.sendMail({
          from: gmailUser,
          to: member.email,
          subject: subject,
          html: emailBody,
        });

        console.log('Email sent successfully:', info.messageId);

        await supabase.from('email_logs').insert({
          recipient_email: member.email,
          subject: subject,
          status: 'sent',
          sent_at: new Date().toISOString(),
          email_type: 'digest',
          digest_batch_id: digestBatchId,
          total_queries_count: validQueries.length,
          triggered_by: triggered_by,
          message_id: info.messageId,
        });

        emailSummary.push({
          email: member.email,
          queriesCount: validQueries.length,
          status: 'sent',
        });
      } catch (error) {
        console.error(`Failed to send email to ${member.email}:`, error);

        await supabase.from('email_logs').insert({
          recipient_email: member.email,
          subject: subject,
          status: 'failed',
          error_message: error.message,
          sent_at: new Date().toISOString(),
          email_type: 'digest',
          digest_batch_id: digestBatchId,
          total_queries_count: validQueries.length,
          triggered_by: triggered_by,
        });

        emailSummary.push({
          email: member.email,
          queriesCount: validQueries.length,
          status: 'failed',
          error: error.message,
        });
      }
    }

    const { data: admins, error: adminsError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('role', 'admin')
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (!adminsError && admins && admins.length > 0) {
      const memberQueryCounts = await getMemberQueryCounts(supabase);
      const adminEmailBody = generateAdminEmailBody(memberQueryCounts);
      const adminSubject = 'Daily Query Reminder Summary';

      for (const admin of admins) {
        try {
          console.log(`Sending admin summary email to ${admin.email}`);
          const info = await transporter.sendMail({
            from: gmailUser,
            to: admin.email,
            subject: adminSubject,
            html: adminEmailBody,
          });

          console.log(`Admin summary email sent successfully to ${admin.email}:`, info.messageId);

          await supabase.from('email_logs').insert({
            recipient_email: admin.email,
            subject: adminSubject,
            status: 'sent',
            sent_at: new Date().toISOString(),
            email_type: 'digest',
            digest_batch_id: digestBatchId,
            triggered_by: triggered_by,
            message_id: info.messageId,
          });

          emailSummary.push({
            email: admin.email,
            queriesCount: 0,
            status: 'sent (admin summary)',
          });
        } catch (error) {
          console.error(`Failed to send admin summary to ${admin.email}:`, error);

          await supabase.from('email_logs').insert({
            recipient_email: admin.email,
            subject: adminSubject,
            status: 'failed',
            error_message: error.message,
            sent_at: new Date().toISOString(),
            email_type: 'digest',
            digest_batch_id: digestBatchId,
            triggered_by: triggered_by,
          });

          emailSummary.push({
            email: admin.email,
            queriesCount: 0,
            status: 'failed (admin summary)',
            error: error.message,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent: emailSummary.filter(e => e.status === 'sent').length,
        emailsFailed: emailSummary.filter(e => e.status === 'failed').length,
        summary: emailSummary,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
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

function generateUserEmailBody(userName: string, queries: PendingQuery[], supabaseUrl: string): string {
  const urgentQueries = queries.filter(q => q.priority === 'urgent' || q.age_days > 3);

  const queryRows = queries.map(q => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; font-weight: 500;">${q.title}</td>
      <td style="padding: 12px;">${q.description.substring(0, 50)}${q.description.length > 50 ? '...' : ''}</td>
      <td style="padding: 12px;">
        <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; ${
          q.priority === 'urgent' ? 'background-color: #fee2e2; color: #991b1b;' :
          q.priority === 'high' ? 'background-color: #fed7aa; color: #9a3412;' :
          'background-color: #dbeafe; color: #1e40af;'
        }">
          ${q.priority.toUpperCase()}
        </span>
      </td>
      <td style="padding: 12px;">${q.age_days} days</td>
      <td style="padding: 12px;">
        <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; background-color: #fef3c7; color: #92400e;">
          ${q.status.replace('_', ' ').toUpperCase()}
        </span>
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; background-color: #f9fafb; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="padding: 32px; border-bottom: 1px solid #e5e7eb;">
          <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #111827;">Pending Queries Awaiting Your Response</h1>
          <p style="margin: 0; color: #6b7280;">Hello ${userName},</p>
        </div>

        <div style="padding: 32px;">
          ${urgentQueries.length > 0 ? `
            <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
              <p style="margin: 0; font-weight: 600; color: #991b1b;">⚠️ Urgent Action Required</p>
              <p style="margin: 8px 0 0 0; color: #7f1d1d;">Your manager is waiting for responses on ${urgentQueries.length} urgent ${urgentQueries.length === 1 ? 'query' : 'queries'}. Please respond as soon as possible.</p>
            </div>
          ` : ''}

          <p style="margin: 0 0 24px 0; color: #4b5563;">You have <strong>${queries.length}</strong> pending ${queries.length === 1 ? 'query' : 'queries'} that require your attention:</p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
              <tr style="background-color: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Title</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Description</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Priority</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Age</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${queryRows}
            </tbody>
          </table>
        </div>

        <div style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
          <a href="${supabaseUrl.replace('.supabase.co', '')}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">View Pending Queries</a>
          <p style="margin: 16px 0 0 0; font-size: 14px; color: #6b7280;">Click the link above to access your pending queries directly.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function getMemberQueryCounts(supabase: any) {
  const { data: teamMembers, error: membersError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('role', 'team_member')
    .eq('is_active', true)
    .eq('is_deleted', false);

  if (membersError || !teamMembers) {
    return { members: [], totalMembers: 0, totalQueries: 0 };
  }

  const memberData = [];
  let totalQueries = 0;

  for (const member of teamMembers) {
    const { data: assignments, error: queriesError } = await supabase
      .from('query_assignments')
      .select(`
        query_id,
        queries (
          id,
          status,
          archived
        )
      `)
      .eq('assigned_to', member.id);

    if (queriesError || !assignments) {
      memberData.push({
        name: member.full_name || member.email,
        email: member.email,
        openQueries: 0,
      });
      continue;
    }

    const openQueriesCount = assignments.filter(a => {
      if (!a.queries) return false;
      const query = a.queries as any;
      const validStatuses = ['open', 'awaiting_response', 'pending'];
      return validStatuses.includes(query.status) && query.archived === false;
    }).length;

    totalQueries += openQueriesCount;

    memberData.push({
      name: member.full_name || member.email,
      email: member.email,
      openQueries: openQueriesCount,
    });
  }

  return {
    members: memberData,
    totalMembers: teamMembers.length,
    totalQueries: totalQueries,
  };
}

function generateAdminEmailBody(data: { members: any[], totalMembers: number, totalQueries: number }): string {
  const summaryRows = data.members.map(m => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px;">
        <div style="font-weight: 600; color: #111827;">${m.name}</div>
        <div style="font-size: 14px; color: #6b7280;">${m.email}</div>
      </td>
      <td style="padding: 12px; text-align: center;">
        <span style="display: inline-block; padding: 6px 16px; border-radius: 12px; font-size: 16px; font-weight: 700; ${
          m.openQueries > 0 ? 'background-color: #fef3c7; color: #92400e;' : 'background-color: #d1fae5; color: #065f46;'
        }">
          ${m.openQueries}
        </span>
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; background-color: #f9fafb; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="padding: 32px; border-bottom: 1px solid #e5e7eb;">
          <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #111827;">Daily Query Reminder Summary</h1>
          <p style="margin: 0; color: #6b7280;">Overview of open queries across all team members.</p>
        </div>

        <div style="padding: 32px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
            <div style="background-color: #eff6ff; padding: 16px; border-radius: 8px;">
              <div style="font-size: 32px; font-weight: 700; color: #1e40af;">${data.totalMembers}</div>
              <div style="color: #1e40af; font-weight: 500;">Total Team Members</div>
            </div>
            <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px;">
              <div style="font-size: 32px; font-weight: 700; color: #15803d;">${data.totalQueries}</div>
              <div style="color: #15803d; font-weight: 500;">Total Open Queries</div>
            </div>
          </div>

          <h2 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">Open Queries by Team Member</h2>

          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Team Member</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Open Queries</th>
              </tr>
            </thead>
            <tbody>
              ${summaryRows}
            </tbody>
          </table>
        </div>
      </div>
    </body>
    </html>
  `;
}
