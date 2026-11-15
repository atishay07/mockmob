import { after } from 'next/server';

// The one call sign-in makes (src/lib/auth.ts, when a new account row was just created). It never waits for the email, never
// throws and does nothing unless EMAILS_ENABLED is "true": the send runs after the response (Next's after()), and the email
// module is loaded only then, so sign-in loads nothing more than this file.

/**
 * Schedules the welcome email for a new account { id, email }. Returns true when it was scheduled.
 * `schedule` and `load` are for tests.
 */
export function scheduleWelcomeEmail(identity, { env = process.env, schedule = after, load = () => import('./studentMailServer.js') } = {}) {
  try {
    if (env.EMAILS_ENABLED !== 'true') return false;
    const id = typeof identity?.id === 'string' ? identity.id : '';
    const email = typeof identity?.email === 'string' ? identity.email.trim().toLowerCase() : '';
    if (!id || !email) return false;
    const task = async () => {
      try {
        const mail = await load();
        await mail.sendWelcomeEmail({ id, email });
      } catch {
        console.warn('[email] the welcome email was not sent: failed');
      }
    };
    try {
      schedule(task);
    } catch {
      // Outside a request (after() refuses): run it detached; it still never reaches the caller.
      task().catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}
