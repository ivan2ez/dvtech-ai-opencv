import { Resend } from 'resend';

/**
 * Outbound email delivery via Resend.
 *
 * The client is created lazily so the app still boots when RESEND_API_KEY is
 * absent (local development, tests). When no key is configured, sends are
 * skipped and reported as not-delivered rather than throwing — callers decide
 * whether that is fatal. Nothing here ever logs a recipient's full address or
 * an OTP code.
 */

const DEFAULT_FROM = 'DVTech <onboarding@resend.dev>';

let cachedClient: Resend | null = null;
let cachedKey: string | null = null;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;

  // Rebuild if the key changed (matters for tests that swap env vars).
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new Resend(apiKey);
    cachedKey = apiKey;
  }
  return cachedClient;
}

function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;
}

/** Base URL of the customer-facing app, used to build action links. */
export function getAppBaseUrl(): string {
  return (
    process.env.APP_BASE_URL?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    'http://localhost:5173'
  );
}

export interface SendResult {
  /** True only when Resend accepted the message. */
  delivered: boolean;
  /** Populated when delivery was skipped or rejected. */
  reason?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Escapes user-supplied values before interpolating them into an HTML body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const client = getClient();
  if (!client) {
    console.warn('[email] RESEND_API_KEY is not configured; skipping send.');
    return { delivered: false, reason: 'email_not_configured' };
  }

  try {
    const { error } = await client.emails.send({
      from: getFromAddress(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (error) {
      console.error('[email] Resend rejected the message:', error.message);
      return { delivered: false, reason: error.message };
    }
    return { delivered: true };
  } catch (err) {
    console.error('[email] Failed to send message:', err instanceof Error ? err.message : err);
    return { delivered: false, reason: 'send_failed' };
  }
}

// ─── Templates ─────────────────────────────────────────────────────────────────

const BRAND_HEADER = `
  <div style="background:#1d4ed8;padding:20px 24px;">
    <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">DVTech</span>
    <span style="color:#c7d7fe;font-size:12px;display:block;margin-top:2px;">
      Supplies and Services Incorporated
    </span>
  </div>`;

function wrapLayout(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      ${BRAND_HEADER}
      <div style="padding:24px;">${bodyHtml}</div>
      <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;">
        This is an automated message from DVTech. Please do not reply to this email.
      </div>
    </div>
  </body>
</html>`;
}

/**
 * Sends the 6-digit OTP that verifies ownership of a Gmail address.
 * `code` is never logged.
 */
export async function sendGmailVerificationCode(
  gmail: string,
  code: string,
  expiresInMinutes: number
): Promise<SendResult> {
  const subject = `${code} is your DVTech verification code`;

  const html = wrapLayout(`
    <h1 style="margin:0 0 8px;font-size:20px;">Verify your email</h1>
    <p style="margin:0 0 20px;color:#475569;font-size:14px;">
      Enter this 6-digit code on the DVTech website to confirm this Gmail address.
    </p>
    <div style="text-align:center;margin:0 0 20px;">
      <span style="display:inline-block;padding:14px 24px;background:#eef2ff;border:1px solid #c7d7fe;border-radius:10px;
                   font-size:30px;font-weight:700;letter-spacing:8px;color:#1d4ed8;">
        ${escapeHtml(code)}
      </span>
    </div>
    <p style="margin:0 0 8px;color:#475569;font-size:14px;">
      The code expires in ${expiresInMinutes} minutes.
    </p>
    <p style="margin:0;color:#64748b;font-size:13px;">
      If you didn't request this, you can safely ignore this email.
    </p>`);

  const text = [
    'Verify your email',
    '',
    `Your DVTech verification code is ${code}.`,
    `It expires in ${expiresInMinutes} minutes.`,
    '',
    "If you didn't request this, you can ignore this email.",
  ].join('\n');

  return sendEmail({ to: gmail, subject, html, text });
}

export interface RescheduleNotificationInput {
  gmail: string;
  customerName: string;
  requestReference: string;
  serviceType: string;
  originalSchedule: string;
  proposedSchedule: string;
  reason: string | null;
  /** Deadline shown to the customer, already formatted for display. */
  respondByLabel: string;
  actionUrl: string;
}

/**
 * Notifies a customer that the admin proposed a new schedule, with a link that
 * opens their service record so they can accept or decline within 48 hours.
 */
export async function sendRescheduleProposalEmail(
  input: RescheduleNotificationInput
): Promise<SendResult> {
  const subject = `Action needed: new schedule proposed for ${input.requestReference}`;

  const reasonBlock = input.reason
    ? `<div style="margin:0 0 20px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
         <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.4px;color:#64748b;">
           Reason for reschedule
         </p>
         <p style="margin:0;font-size:14px;color:#0f172a;">${escapeHtml(input.reason)}</p>
       </div>`
    : '';

  const html = wrapLayout(`
    <h1 style="margin:0 0 8px;font-size:20px;">Your service needs rescheduling</h1>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;">
      Hi ${escapeHtml(input.customerName)}, no technician is available on your chosen schedule for
      <strong>${escapeHtml(input.requestReference)}</strong> (${escapeHtml(input.serviceType)}).
      We've proposed a new one below.
    </p>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px;">
      <tr>
        <td style="padding:12px;border:1px solid #e2e8f0;border-radius:8px 0 0 8px;background:#f8fafc;">
          <p style="margin:0 0 4px;font-size:12px;color:#64748b;">Original schedule</p>
          <p style="margin:0;font-size:14px;color:#94a3b8;text-decoration:line-through;">
            ${escapeHtml(input.originalSchedule)}
          </p>
        </td>
        <td style="padding:12px;border:1px solid #e2e8f0;border-left:0;border-radius:0 8px 8px 0;">
          <p style="margin:0 0 4px;font-size:12px;color:#64748b;">Proposed schedule</p>
          <p style="margin:0;font-size:14px;font-weight:600;color:#15803d;">
            ${escapeHtml(input.proposedSchedule)}
          </p>
        </td>
      </tr>
    </table>
    ${reasonBlock}
    <p style="margin:0 0 20px;padding:12px 14px;background:#fef3c7;border:1px solid #fcd44f;border-radius:8px;font-size:14px;color:#78350f;">
      Please accept or decline by <strong>${escapeHtml(input.respondByLabel)}</strong>.
      If we don't hear from you within 48 hours, this request will expire.
    </p>
    <div style="text-align:center;margin:0 0 16px;">
      <a href="${encodeURI(input.actionUrl)}"
         style="display:inline-block;padding:12px 22px;background:#1d4ed8;color:#ffffff;border-radius:8px;
                font-size:15px;font-weight:600;text-decoration:none;">
        Review proposed schedule
      </a>
    </div>
    <p style="margin:0;color:#64748b;font-size:12px;word-break:break-all;">
      Or paste this link into your browser:<br />${escapeHtml(input.actionUrl)}
    </p>`);

  const text = [
    'Your service needs rescheduling',
    '',
    `Hi ${input.customerName},`,
    `No technician is available on your chosen schedule for ${input.requestReference} (${input.serviceType}).`,
    '',
    `Original schedule: ${input.originalSchedule}`,
    `Proposed schedule: ${input.proposedSchedule}`,
    ...(input.reason ? ['', `Reason: ${input.reason}`] : []),
    '',
    `Please accept or decline by ${input.respondByLabel}.`,
    'If we do not hear from you within 48 hours, this request will expire.',
    '',
    `Review the proposal here: ${input.actionUrl}`,
  ].join('\n');

  return sendEmail({ to: input.gmail, subject, html, text });
}
