import 'reflect-metadata';
import dotenv from 'dotenv';
import { sendEmail } from '../services/emailService';

// Load .env exactly as the app does, so this tests the real configuration.
dotenv.config();

/**
 * One-off Resend delivery check.
 *
 * Usage:
 *   npx tsx src/scripts/testEmail.ts you@gmail.com
 *   npm run test:email -- you@gmail.com
 *
 * With the shared onboarding@resend.dev sender, Resend only delivers to the
 * email address your Resend account is registered under — send there to
 * confirm delivery works end to end.
 */
async function main() {
  const to = process.argv[2]?.trim();

  if (!to) {
    console.error('Usage: npm run test:email -- <recipient@example.com>');
    process.exit(1);
  }

  const keyConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  const from = process.env.RESEND_FROM_EMAIL?.trim() || 'DVTech <onboarding@resend.dev>';

  console.log('--- Resend test ---');
  console.log(`API key configured: ${keyConfigured ? 'yes' : 'NO (RESEND_API_KEY is blank)'}`);
  console.log(`From: ${from}`);
  console.log(`To:   ${to}`);
  console.log('Sending...');

  const result = await sendEmail({
    to,
    subject: 'DVTech test email',
    html: '<p>This is a test email from your DVTech backend. If you can read this, Resend delivery is working.</p>',
    text: 'This is a test email from your DVTech backend. If you can read this, Resend delivery is working.',
  });

  if (result.delivered) {
    console.log('\nDelivered. Check the inbox (and Spam folder) for the address above.');
    process.exit(0);
  }

  console.error(`\nNot delivered. Reason: ${result.reason ?? 'unknown'}`);
  if (result.reason?.includes('not verified') || result.reason?.includes('domain')) {
    console.error(
      'Tip: with onboarding@resend.dev you can only send TO your own Resend account email. ' +
        'To email other addresses, verify a domain at https://resend.com/domains.'
    );
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('Test failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
