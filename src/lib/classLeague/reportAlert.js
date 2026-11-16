// A class report emails the support inbox, as a Mob report does (src/lib/server/mob/reportAlert.js, S2 15 Nov 2026), with the
// class's own name and code so support can find and close it. No '@/' imports, so node:test drives it with an injected sender
// (data/tests/class_league_model.test.mjs); ./deps.js wires Resend and the database limiter.
//   - What the email holds: the class's name and code, how many are in it, the reason and the time. Never the reporter.
//   - "Something here is not safe" is marked Urgent in the subject.
//   - It never fails or slows the report: every error is swallowed here and logged in one line.
//   - Site-wide database limits (3 an hour urgent, 3 an hour routine), so a script cannot flood the inbox.
//   - Off when RESEND_API_KEY is not set (deps.js).
import { istDateTime } from '../mob/model.mjs';

export const CLASS_ALERT_TO = 'support@mockmob.in';
export const CLASS_ALERT_LIMITS = Object.freeze({
  urgent: { bucket: 'class_report_alert:urgent', limit: 3, windowMs: 3_600_000 },
  routine: { bucket: 'class_report_alert:routine', limit: 3, windowMs: 3_600_000 },
});
const REASON_TEXT = Object.freeze({ name: 'The class name is not okay', safety: 'Something here is not safe' });

/** The email for one class report: { to, subject, text }. Pure. */
export function classReportEmail({ code, name, members = null, reason, at }) {
  const urgent = reason === 'safety';
  const when = new Date(at);
  const stamp = Number.isFinite(when.getTime()) ? when.toISOString() : '';
  const subject = urgent ? `Urgent: class ${code} reported, a student says something is not safe` : `Class ${code} reported: ${REASON_TEXT[reason] || reason}`;
  const text = [
    urgent ? 'A student reported that something in their class league is not safe. Please review it today.' : 'A student reported a class league.',
    '',
    `Class: ${name}`,
    `Code: ${code} (its public page is https://www.mockmob.in/class/${code})`,
    `Members now: ${Number.isInteger(members) ? members : 'not read'}`,
    `Reason: ${REASON_TEXT[reason] || reason} (${reason})`,
    `Time: ${stamp ? `${istDateTime(stamp)} IST (${stamp})` : 'unknown'}`,
    '',
    `To close it for everyone: set closed_at to now() on its class_leagues row (code ${code}) and left_at to now() on that class's open class_league_members rows.`,
  ].join('\n');
  return { to: CLASS_ALERT_TO, subject, text };
}

/**
 * deps: { enabled() -> boolean, take(bucket, limit, windowMs) -> boolean, send({ to, subject, text }) -> { error? }, log(line) }
 * Returns alert(info) -> 'off' | 'limited' | 'sent' | 'failed'. Never throws.
 */
export function createClassReportAlert(deps) {
  const log = deps.log || ((line) => console.warn(line));
  return async function alert(info) {
    try {
      if (!deps.enabled()) return 'off';
      const l = info.reason === 'safety' ? CLASS_ALERT_LIMITS.urgent : CLASS_ALERT_LIMITS.routine;
      if ((await deps.take(l.bucket, l.limit, l.windowMs)) !== true) {
        log(`[class] report alert not sent: the hourly email limit is reached (${info.reason})`);
        return 'limited';
      }
      const r = await deps.send(classReportEmail(info));
      if (r?.error) throw new Error(r.error.message || r.error.name || 'send refused');
      return 'sent';
    } catch (error) {
      log(`[class] report alert failed: ${String(error?.message || error || 'unknown').slice(0, 160)}`);
      return 'failed';
    }
  };
}
