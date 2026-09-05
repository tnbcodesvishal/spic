import { BrevoClient } from "@getbrevo/brevo";
import nodemailer from "nodemailer";

export interface TicketEmailData {
  to: string;
  participantName: string;
  rollNumber?: string;
  branch?: string;
  year?: string;
  phone?: string;
  eventName: string;
  eventDate: string;
  eventTime?: string;
  eventVenue: string;
  // Payload for QR generation
  registrationId: string;
  eventId: string;
  verificationToken: string;
}

export interface ContactEmailData {
  name: string;
  email: string;
  concern: string;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build the HTML content for the ticket email (BharatSetu Style)
 */
function buildHtml(data: TicketEmailData): string {
  const rawDate = new Date(data.eventDate);
  const formattedDate = isNaN(rawDate.getTime()) 
    ? data.eventDate 
    : rawDate.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

  const escapedName = escapeHtml(data.participantName);
  const escapedRollNumber = escapeHtml(data.rollNumber || "N/A");
  const escapedEmail = escapeHtml(data.to);
  const escapedBranch = escapeHtml(data.branch || "N/A");
  const escapedYear = escapeHtml(data.year || "");
  const escapedEvent = escapeHtml(data.eventName);
  const escapedTime = escapeHtml(data.eventTime || "10:00 AM onwards");
  const escapedVenue = escapeHtml(data.eventVenue || "Seminar Hall, RKGIT");

  // Create the QR content (same as stored in DB)
  const qrContent = JSON.stringify({
    registrationId: data.registrationId,
    eventId: data.eventId,
    verificationToken: data.verificationToken
  });

  // Use a reliable external QR generator API (solves broken image issue)
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrContent)}`;
  const defaultBaseUrl = "https://spic-8iibw8t1o-vishals-projects-3da3f30c.vercel.app";
  const rawBase = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : defaultBaseUrl);
  const baseUrl = rawBase.replace(/\/+$/, "");
  const logoUrl = `${baseUrl}/spic-logo.png`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your SPIC Event Ticket Pass</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.05);border:1px solid #e2e8f0;">
          
          <!-- Premium Header (BharatSetu Style) -->
          <tr>
            <td align="center" style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 36px 20px; border-bottom: 4px solid #fbbf24;">
              <div style="margin-bottom: 16px;">
                <img src="${logoUrl}" alt="SPIC Logo" width="80" height="80" style="border-radius:50%; display: inline-block; object-fit: cover; background:#fff; padding:4px;">
              </div>
              <h1 style="margin:0; color:#ffffff; font-size:28px; font-weight:800; letter-spacing: -0.02em;">SPIC</h1>
              <p style="margin:6px 0 0; color:rgba(255,255,255,0.9); font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:0.1em;">Society for Promotion of Innovation and Creativity — RKGIT</p>
              <div style="margin-top:16px; display:inline-block; background-color:#fbbf24; color:#0f172a; padding:6px 16px; border-radius:20px; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em;">
                Official Hall Ticket Pass
              </div>
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 12px; color: #1e293b; font-size: 22px; font-weight: 700;">Registration Confirmed!</h2>
              <p style="margin: 0 0 24px; color: #475569; font-size: 15px; line-height: 1.6;">
                Dear <strong>${escapedName}</strong>,<br>
                Your registration for <strong>${escapedEvent}</strong> has been successfully confirmed. Below is your official Event Hall Ticket containing your QR entry code and registration details. Please present this ticket at the entry gate.
              </p>

              <!-- Ticket Pass Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border-radius: 12px; padding: 24px; border: 1px solid #cbd5e1;">
                <tr>
                  <td>
                    <!-- Participant Info -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 16px;">
                      <tr>
                        <td width="50%" style="vertical-align: top; padding-bottom: 12px;">
                          <p style="margin: 0 0 4px; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase;">Participant Name</p>
                          <p style="margin: 0; color: #0f172a; font-size: 16px; font-weight: 700;">${escapedName}</p>
                        </td>
                        <td width="50%" style="vertical-align: top; padding-bottom: 12px;">
                          <p style="margin: 0 0 4px; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase;">Roll Number</p>
                          <p style="margin: 0; color: #0f172a; font-size: 15px; font-weight: 700; font-family: monospace;">${escapedRollNumber}</p>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="vertical-align: top;">
                          <p style="margin: 0 0 4px; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase;">Registered Mail ID</p>
                          <p style="margin: 0; color: #0f172a; font-size: 14px; font-weight: 600;">${escapedEmail}</p>
                        </td>
                        <td width="50%" style="vertical-align: top;">
                          <p style="margin: 0 0 4px; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase;">Branch & Year</p>
                          <p style="margin: 0; color: #0f172a; font-size: 14px; font-weight: 600;">${escapedBranch} ${escapedYear ? `(${escapedYear})` : ""}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Event Info -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td colspan="2" style="padding-bottom: 12px;">
                          <p style="margin: 0 0 4px; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase;">Event Name</p>
                          <p style="margin: 0; color: #1e40af; font-size: 18px; font-weight: 800;">${escapedEvent}</p>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="vertical-align: top; padding-bottom: 12px;">
                          <p style="margin: 0 0 4px; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase;">Event Date</p>
                          <p style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 600;">${formattedDate}</p>
                        </td>
                        <td width="50%" style="vertical-align: top; padding-bottom: 12px;">
                          <p style="margin: 0 0 4px; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase;">Event Timing</p>
                          <p style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 600;">${escapedTime}</p>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="vertical-align: top;">
                          <p style="margin: 0 0 4px; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase;">Venue</p>
                          <p style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 600;">${escapedVenue}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- QR Code Section -->
              <div style="text-align: center; margin-top: 36px; padding-top: 28px; border-top: 1px dashed #cbd5e1;">
                <p style="margin: 0 0 12px; color: #1e293b; font-size: 16px; font-weight: 700;">Your Entry QR Code</p>
                <div style="display:inline-block; padding: 12px; background: #ffffff; border: 2px solid #e2e8f0; border-radius: 16px;">
                  <img src="${qrImageUrl}" alt="Event Ticket QR" width="220" height="220" style="display: block;">
                </div>
                <p style="margin: 14px 0 0; color: #64748b; font-size: 13px;">Ticket Pass ID: <span style="font-family: monospace; color: #1e293b; font-weight:700;">${data.registrationId.slice(0, 8).toUpperCase()}</span></p>
                <p style="margin: 6px 0 0; color: #3b82f6; font-size: 12px; font-weight: 600;">Show this QR code at the entry desk to check in.</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px; color: #64748b; font-size: 13px;">Looking forward to seeing you at the event!</p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                &copy; ${new Date().getFullYear()} SPIC — Society for Promotion of Innovation and Creativity, RKGIT
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

let testAccountTransporter: nodemailer.Transporter | null = null;

async function getEtherealTransporter() {
  if (!testAccountTransporter) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      testAccountTransporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`[email] Ethereal test mailer initialized (${testAccount.user})`);
    } catch (err: any) {
      console.error("[email] Could not create Ethereal test account:", err.message);
    }
  }
  return testAccountTransporter;
}

let cachedGmailTransporter: nodemailer.Transporter | null = null;

function getGmailTransporter(smtpUser: string, smtpPass: string): nodemailer.Transporter {
  if (!cachedGmailTransporter) {
    cachedGmailTransporter = nodemailer.createTransport({
      service: "gmail",
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 8000,
      auth: { user: smtpUser, pass: smtpPass },
    });
  }
  return cachedGmailTransporter;
}

export async function sendTicketEmail(
  data: TicketEmailData
): Promise<{ success: boolean; error?: string }> {
  const htmlContent = buildHtml(data);
  const subject = `Official Event Hall Ticket Pass \u2013 ${data.eventName}`;
  const WEBHOOK_URL =
    process.env.GOOGLE_SHEET_WEBHOOK_URL ||
    "https://script.google.com/macros/s/AKfycbxvOswFrS4wNLjRdlYaCAQ-2btQcXH8dQLBa6gPGD0nqHJmlNawsDNFrk2cDrzfy2nk0A/exec";
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || "mr.vishalsingh987@gmail.com";
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_PASS || "ewficvtigzzypbrt";

  // 1. Try Gmail SMTP Primary (Pooled connection with 5s connection timeout)
  try {
    const transporter = getGmailTransporter(smtpUser, smtpPass);

    await transporter.sendMail({
      from: `"SPIC Events" <${smtpUser}>`,
      to: data.to,
      subject,
      html: htmlContent,
    });

    console.log(`[email] \u2705 Ticket sent via Gmail SMTP to ${data.to}`);
    return { success: true };
  } catch (smtpErr: any) {
    console.warn(`[email] Gmail SMTP attempt failed for ${data.to}:`, smtpErr.message);
  }

  // 2. Fallback: Google Apps Script Webhook (with 5s timeout)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send_email",
        email: data.to,
        subject,
        emailHtml: htmlContent,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const text = await res.text();
    if (res.ok && (text.includes("email_sent") || text.includes("success"))) {
      console.log(`[email] \u2705 Ticket sent via Google Webhook fallback to ${data.to}`);
      return { success: true };
    } else {
      console.warn(`[email] Google Webhook response for ${data.to}:`, text.slice(0, 200));
    }
  } catch (webhookErr: any) {
    console.warn(`[email] Google Webhook fallback failed for ${data.to}:`, webhookErr.message);
  }

  return { success: false, error: "Both Gmail SMTP and Webhook delivery failed" };
}


export interface TeamTicketEmailData {
  teamName: string;
  members: any[];
  eventName: string;
  eventDate: string;
  eventVenue: string;
  registrationId: string;
  eventId: string;
}

function buildTeamHtml(data: TeamTicketEmailData, memberIndex: number): string {
  const rawDate = new Date(data.eventDate);
  const formattedDate = isNaN(rawDate.getTime()) 
    ? `Saturday, ${data.eventDate}` 
    : rawDate.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

  const escapedTeamName = escapeHtml(data.teamName);
  const escapedEvent = escapeHtml(data.eventName);

  const m = data.members[memberIndex];
  
  const qrContent = JSON.stringify({
    registrationId: data.registrationId,
    eventId: data.eventId,
    verificationToken: m.verificationToken,
    isTeam: true,
    memberIndex: memberIndex
  });

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrContent)}`;
  const defaultBaseUrl = "https://spic-8iibw8t1o-vishals-projects-3da3f30c.vercel.app";
  const rawBase = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : defaultBaseUrl);
  const baseUrl = rawBase.replace(/\/+$/, "");
  const logoUrl = `${baseUrl}/spic-logo.png`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your SPIC Team Event Ticket</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.05);border:1px solid #e2e8f0;">
          
          <!-- Premium Header -->
          <tr>
            <td align="center" style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 40px 20px; border-bottom: 4px solid #fbbf24;">
              <div style="margin-bottom: 24px;">
                <img src="${logoUrl}" alt="SPIC Logo" width="100" height="100" style="border-radius:50%; display: inline-block; object-fit: cover;">
              </div>
              <h1 style="margin:0; color:#ffffff; font-size:32px; font-weight:800; letter-spacing: -0.02em;">SPIC</h1>
              <p style="margin:8px 0 0; color:rgba(255,255,255,0.9); font-size:14px; font-weight:500; text-transform:uppercase; letter-spacing:0.1em;">The Entrepreneur Cell of RKGIT</p>
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 24px; font-weight: 700;">Team Registration Confirmed!</h2>
              <p style="margin: 0 0 24px; color: #475569; font-size: 16px; line-height: 1.6;">
                Dear <strong>${escapeHtml(m.name)} (Team ${escapedTeamName})</strong>,<br><br>
                Thank you for registering for <strong>${escapedEvent}</strong>. Your INDIVIDUAL team ticket is ready! Please keep this email handy for your personal entry.
              </p>

              <!-- Event Detail Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">Event Name</p>
                    <p style="margin: 0 0 16px; color: #0f172a; font-size: 18px; font-weight: 700;">${escapedEvent}</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50%" style="vertical-align: top;">
                          <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">Date</p>
                          <p style="margin: 0; color: #1e293b; font-size: 15px; font-weight: 600;">${formattedDate}</p>
                        </td>
                        <td width="50%" style="vertical-align: top;">
                          <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">Venue</p>
                          <p style="margin: 0; color: #1e293b; font-size: 15px; font-weight: 600;">Seminar Hall, D Block</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Member Greeting -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
                <p style="margin: 0; font-size: 16px; color: #1e293b; text-align: center;">Team: <strong>${escapedTeamName}</strong></p>
                <p style="margin: 8px 0 0; font-size: 14px; color: #475569; text-align: center;">This is your personal entry pass for the team registration.</p>
              </div>

              <!-- QR Code Section -->
              <div style="text-align: center; margin-top: 40px; padding-top: 32px; border-top: 1px dashed #cbd5e1;">
                <p style="margin: 0 0 16px; color: #1e293b; font-size: 16px; font-weight: 700;">Your Personal Entry QR Code</p>
                <div style="display:inline-block; padding: 12px; background: #ffffff; border: 2px solid #e2e8f0; border-radius: 16px;">
                  <img src="${qrImageUrl}" alt="Event Ticket QR" width="220" height="220" style="display: block;">
                </div>
                <p style="margin: 16px 0 0; color: #64748b; font-size: 13px;">Personal Ticket ID: <span style="font-family: monospace; color: #1e293b;">${data.registrationId.slice(0, 8).toUpperCase()}-${memberIndex}</span></p>
                <p style="margin: 8px 0 0; color: #ef4444; font-size: 11px; font-weight: bold; text-transform: uppercase;">Each member must scan their own unique QR code</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 8px; color: #64748b; font-size: 14px;">Looking forward to seeing you there!</p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                &copy; ${new Date().getFullYear()} SPIC — The Entrepreneur Cell of RKGIT
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

export async function sendTeamTicketEmail(
  data: TeamTicketEmailData
): Promise<{ success: boolean; error?: string }> {
  const subject = `Team Registration Confirmed \u2013 Your Personal QR Ticket for ${data.eventName}`;
  const WEBHOOK_URL =
    process.env.GOOGLE_SHEET_WEBHOOK_URL ||
    "https://script.google.com/macros/s/AKfycbxvOswFrS4wNLjRdlYaCAQ-2btQcXH8dQLBa6gPGD0nqHJmlNawsDNFrk2cDrzfy2nk0A/exec";
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || "mr.vishalsingh987@gmail.com";
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_PASS || "ewficvtigzzypbrt";

  // Dispatch all team member emails simultaneously in parallel
  const sendPromises = data.members.map(async (m, i) => {
    if (!m.email) return false;
    const memberHtml = buildTeamHtml(data, i);

    // 1. Try Gmail SMTP
    try {
      const transporter = getGmailTransporter(smtpUser, smtpPass);
      await transporter.sendMail({
        from: `"SPIC Events" <${smtpUser}>`,
        to: m.email,
        subject,
        html: memberHtml,
      });
      console.log(`[email] \u2705 Team ticket sent via Gmail SMTP to ${m.email}`);
      return true;
    } catch (smtpErr: any) {
      console.warn(`[email] Gmail SMTP failed for team member ${m.email}:`, smtpErr.message);
    }

    // 2. Fallback: Google Webhook with 5s timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_email",
          email: m.email,
          subject,
          emailHtml: memberHtml,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const text = await res.text();
      if (res.ok && (text.includes("email_sent") || text.includes("success"))) {
        console.log(`[email] \u2705 Team ticket sent via Google Webhook fallback to ${m.email}`);
        return true;
      }
    } catch (webhookErr: any) {
      console.warn(`[email] Webhook fallback failed for team member ${m.email}:`, webhookErr.message);
    }

    return false;
  });

  const results = await Promise.all(sendPromises);
  const sentCount = results.filter(Boolean).length;

  return { success: sentCount > 0 };
}


export async function sendContactEmail(
  data: ContactEmailData
): Promise<{ success: boolean; error?: string }> {
  const subject = `New Website Inquiry from ${data.name}`;
  const htmlContent = `
    <h3>New Website Inquiry</h3>
    <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
    <p><strong>Concern:</strong></p>
    <p>${escapeHtml(data.concern).replace(/\n/g, "<br>")}</p>
  `;

  const brevoKey = process.env.BREVO_SMTP_KEY;
  if (brevoKey) {
    try {
      const client = new BrevoClient({ apiKey: brevoKey });
      const senderEmail = process.env.BREVO_SENDER_EMAIL || "spic@rkgit.edu.in";
      const officialEmail = "spic@rkgit.edu.in";

      await client.transactionalEmails.sendTransacEmail({
        subject,
        htmlContent,
        sender: { name: "SPIC Website", email: senderEmail },
        to: [{ email: officialEmail, name: "SPIC Team" }],
        replyTo: { email: data.email, name: data.name }
      });

      console.log(`[contact] Email sent via Brevo for ${data.email}`);
      return { success: true };
    } catch (err: any) {
      console.error("[contact] Brevo error:", err.message);
    }
  }

  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_PASS;
  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: process.env.SMTP_HOST ? undefined : "gmail",
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: `"SPIC Website" <${smtpUser}>`,
        to: smtpUser,
        subject,
        html: htmlContent,
        replyTo: data.email,
      });

      console.log(`[contact] Email sent via Gmail SMTP for ${data.email}`);
      return { success: true };
    } catch (err: any) {
      console.error("[contact] SMTP error:", err.message);
    }
  }

  console.log(`[contact] Inquiry logged for ${data.email}`);
  return { success: true };
}
