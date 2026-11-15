// S2 (security audit 15 Nov 2026): a Mob report, "I do not feel safe" included, was a row only the /moderation page
// shows, so it reached nobody unless a moderator happened to look. Now each new report sends one email to the support
// inbox. No '@/' imports, so node:test drives it with an injected sender (data/tests/mob_sec_1115.test.mjs); deps.js
// wires Resend, the report id read and the database limiter.
//   - What the email holds: the report id, the Mob id, the reason, the time, and where to review it. Never a student's
//     name, email address or anything they wrote.
//   - "I do not feel safe" (reason 'safety') is marked Urgent in the subject.
//   - It never fails or slows the report: the service hands it over after the write and returns; every error is
//     swallowed here and logged in one line.
//   - A script cannot flood the inbox: site-wide database limits, 3 an hour for urgent reports and 3 an hour for the
//     others, so routine reports never use up the urgent ones.
//   - Off when RESEND_API_KEY is not set (deps.js).
import { istDateTime } from '../../mob/model.mjs';

export const ALERT_TO = 'support@mockmob.in';
export const ALERT_LIMITS = Object.freeze({
  urgent: { bucket: 'mob_report_alert:urgent', limit: 3, windowMs: 3_600_000 },
  routine: { bucket: 'mob_report_alert:routine', limit: 3, windowMs: 3_600_000 },
});
const REASON_TEXT = Object.freeze({
  name: 'Their name is not okay',
  nudge: 'Unwanted nudges',
  safety: 'I do not feel safe',
});
const REVIEW_AT = 'https://www.mockmob.in/moderation';

/** The email for one report: { to, subject, text }. Pure. */
export function reportAlertEmail({ reportId = null, mobId, reason, at }) {
  const urgent = reason === 'safety';
  const when = new Date(at);
  const iso = Number.isFinite(when.getTime()) ? when.toISOString() : '';
  const ref = reportId === null || reportId === undefined ? 'a new report' : `report ${reportId}`;
  const subject = urgent ? `Urgent: Mob ${ref}, a student does not feel safe` : `Mob ${ref}: ${REASON_TEXT[reason] || reason}`;
  const text = [
    urgent ? 'A student reported that they do not feel safe in their Mob. Please review it today.' : 'A student reported another member of their Mob.',
    '',
    `Report: ${reportId ?? 'not read yet (the newest open report for this Mob)'}`,
    `Mob: ${mobId}`,
    `Reason: ${REASON_TEXT[reason] || reason} (${reason})`,
    `Time: ${iso ? `${istDateTime(iso)} IST (${iso})` : 'unknown'}`,
    '',
    `Review it at ${REVIEW_AT}`,
  ].join('\n');
  return { to: ALERT_TO, subject, text };
}

/**
 * deps: {
 *   enabled() -> boolean                          RESEND_API_KEY is set
 *   take(bucket, limit, windowMs) -> boolean      the database limiter (take_rate_limit); true means allowed
 *   findId({ mobId, reporterId, reason }) -> id   the report row's id (read on the server, never sent to anyone else)
 *   send({ to, subject, text }) -> { error? }     Resend
 *   log(line)                                      one line per skipped or failed alert
 * }
 * Returns alert(info) -> 'off' | 'limited' | 'sent' | 'failed'. Never throws.
 */
export function createReportAlert(deps) {
  const log = deps.log || ((line) => console.warn(line));
  return async function alert({ mobId, reporterId, reason, at }) {
    try {
      if (!deps.enabled()) return 'off';
      const l = reason === 'safety' ? ALERT_LIMITS.urgent : ALERT_LIMITS.routine;
      if ((await deps.take(l.bucket, l.limit, l.windowMs)) !== true) {
        log(`[mob] report alert not sent: the hourly email limit is reached (${reason})`);
        return 'limited';
      }
      const reportId = await Promise.resolve(deps.findId({ mobId, reporterId, reason })).catch(() => null);
      const r = await deps.send(reportAlertEmail({ reportId, mobId, reason, at }));
      if (r?.error) throw new Error(r.error.message || r.error.name || 'send refused');
      return 'sent';
    } catch (error) {
      log(`[mob] report alert failed: ${String(error?.message || error || 'unknown').slice(0, 160)}`);
      return 'failed';
    }
  };
}
