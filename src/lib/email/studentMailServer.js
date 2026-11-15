import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { resend } from '@/lib/resend';
import { getSiteOrigin } from '@/lib/server/emailLoginPolicy';
import { createStudentMailStore } from './studentMailStore.js';
import { runDayTwo, sendWelcome } from './studentMail.mjs';

// Production wiring of the welcome and day-2 emails: the service-role database, Resend, the site's own origin. The rules are
// in ./studentMailModel.mjs and ./studentMail.mjs; nothing is sent unless EMAILS_ENABLED is "true".

function hasEmailProvider() {
  const key = process.env.RESEND_API_KEY?.trim();
  return Boolean(key && key !== 're_xxxxxxxxx');
}

function deps() {
  return {
    store: createStudentMailStore(supabaseAdmin()),
    mail: {
      configured: hasEmailProvider,
      send: (message, options) => resend.emails.send(message, options),
    },
    // In production only www.mockmob.in or mockmob.in (emailLoginPolicy); the fallback below is for development.
    origin: getSiteOrigin({ url: 'http://127.0.0.1:3000/' }),
    from: process.env.AUTH_EMAIL_FROM || undefined,
  };
}

/** The welcome email to a newly created account. Never throws; returns { sent, reason }. */
export async function sendWelcomeEmail(user) {
  try {
    const result = await sendWelcome({ user, deps: deps() });
    if (!result.sent && !['off', 'already_sent', 'unsubscribed', 'cap', 'sign_in_busy'].includes(result.reason)) {
      console.warn(`[email] the welcome email was not sent: ${result.reason}`);
    }
    return result;
  } catch {
    console.warn('[email] the welcome email was not sent: failed');
    return { sent: false, reason: 'failed' };
  }
}

/** The day-2 job (the cron route). Counts only. */
export async function runDayTwoJob() {
  const result = await runDayTwo({ deps: deps() });
  if (result.skipped === 'store_error' || result.skipped === 'not_set_up') console.warn(`[email] the day-2 job did not run: ${result.skipped}`);
  return result;
}

/** Turns both emails off for one student (the unsubscribe route, after the signature check). */
export function optOutStudent(userId) {
  return createStudentMailStore(supabaseAdmin()).optOut(userId);
}
