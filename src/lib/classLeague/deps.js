import 'server-only';
// Production wiring for class leagues (./service.js, ./http.js, ./store.js): Supabase with the service role, the Sunday Mock's
// own store for the counted sittings, the Mob's name screen and Resend for a report. The routes under src/app/api/class import
// classDeps() and nothing else; nothing here runs while CLASS_LEAGUES_ENABLED is off (the handler answers 404 first).
import { randomBytes } from 'node:crypto';
import { after } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPersistentRateLimit, giveBackRateLimit, rateLimitWait } from '@/lib/server/rateLimit';
import { mobileOptions } from '@/lib/server/mobileCors';
import { Database } from '@/../data/db';
import { resolveSubject } from '@/../data/subject_registry';
import { normalizeSubjectSelection, toPublicSubjectId } from '@/../data/cuet_controls';
import blocklist from '@/../data/mob_name_blocklist.json';
import { createSundayStore } from '@/lib/server/sunday/store';
import { createClassService } from './service';
import { createClassStore } from './store';
import { createClassReportAlert } from './reportAlert';
import { classLeaguesEnabled } from './flag.mjs';

export { classLeaguesEnabled };

/** A launchable CUET subject: the Sunday Mock's rule (src/lib/server/sunday/deps.js), so a class follows only papers that run. */
function subjectInfo(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 60) return { ok: false };
  const resolved = resolveSubject(raw);
  const selection = normalizeSubjectSelection({ subject: raw });
  if (!resolved?.launch || !selection.valid) return { ok: false };
  return { ok: true, id: selection.internalSubject, publicId: toPublicSubjectId(selection.internalSubject), name: resolved.officialName };
}

const resendReady = () => { const k = process.env.RESEND_API_KEY?.trim(); return Boolean(k && k !== 're_xxxxxxxxx'); };
const alertClassReport = createClassReportAlert({
  enabled: resendReady,
  take: async (bucket, limit, windowMs) => {
    const { data, error } = await supabaseAdmin().rpc('take_rate_limit', { p_bucket: bucket, p_limit: limit, p_window_ms: windowMs });
    if (error) throw error;
    return data === true;
  },
  send: async (msg) => {
    const { resend } = await import('@/lib/resend');
    return resend.emails.send({ from: process.env.AUTH_EMAIL_FROM || 'MockMob <support@mockmob.in>', ...msg });
  },
});
// After the response (next/server after), so the student's report never waits for the email.
function onClassReport(info) {
  const job = () => alertClassReport(info);
  try { after(job); } catch { job(); }
}

let cached = null;
export function classService() {
  if (cached) return cached;
  cached = createClassService({
    store: createClassStore(() => supabaseAdmin()),
    sunday: createSundayStore(() => supabaseAdmin()),
    loadUser: (id) => Database.getUserById(id),
    subjectInfo,
    randomBytes: (n) => randomBytes(n),
    blocklist,
    onReport: onClassReport,
  });
  return cached;
}

export function classDeps() {
  return {
    enabled: classLeaguesEnabled, auth: (request) => auth(request), rateLimit: checkPersistentRateLimit, giveBack: giveBackRateLimit, waitFor: rateLimitWait,
    cors: mobileOptions, service: classService(),
  };
}
