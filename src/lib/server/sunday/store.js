// The Sunday Mock's reads and writes (src/lib/sundayMock.mjs has the rules; ./service.js decides). Two tables production already
// has, so nothing here needs a migration:
//   learning_allowances  one row per student, Sunday and subject (kind 'sunday_mock', period '<sunday>:<subject>', reference
//                        'v1:<first start ms>:<question ids>'). Its primary key (user_id, kind, period) is the one-sitting lock,
//                        as it already is for the free first full mock and the practice start (firstFullMock.js, practiceStart.js).
//                        The week's paper is the question list of the earliest row for the period: the first start froze it and
//                        every later start copies it into its own row, so the paper outlives any one account.
//   attempts             a sent Sunday paper carries selection_meta.mobPaper = { mobId: SUNDAY_TAG, weekStart: <sunday> }.
// No 'server-only' and no alias imports: node:test runs it on the in-memory Supabase client (data/tests/sunday_mock.test.mjs).
import { SUNDAY_KIND, SUNDAY_TAG, parseClaim, sundayWindow } from '../../sundayMock.mjs';
import { toPublicSubjectId } from '../../../../data/cuet_controls.js';

const UNIQUE_VIOLATION = '23505';
const PAGE = 1000;
const iso = (ms) => new Date(ms).toISOString();

/** Every spelling a saved attempt may carry for one subject (General Test was saved as 'general_test' before 'gat'). */
export const subjectSpellings = (subject) => [...new Set([subject, toPublicSubjectId(subject)].filter((s) => typeof s === 'string' && s))];

const tagOf = (week) => ({ mobPaper: { mobId: SUNDAY_TAG, ...(week ? { weekStart: week } : {}) } });
const ms = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? t : null; };

export function createSundayStore(db) {
  const c = () => (typeof db === 'function' ? db() : db);
  const fail = (error) => { throw Object.assign(new Error('SUNDAY_STORE_FAILED'), { cause: error }); };

  return {
    /** This student's row for one period: { startedAt, ids, reference } or null. Throws on a failed read. */
    async readClaim(userId, period) {
      const { data, error } = await c().from('learning_allowances').select('reference').eq('user_id', userId).eq('kind', SUNDAY_KIND).eq('period', period).maybeSingle();
      if (error) fail(error);
      const parsed = data ? parseClaim(data.reference) : null;
      return parsed ? { ...parsed, reference: data.reference } : null;
    },

    /** This student's rows for several periods: Map(period -> { startedAt, ids }). */
    async readClaims(userId, periods) {
      const out = new Map();
      if (!periods.length) return out;
      const { data, error } = await c().from('learning_allowances').select('period,reference').eq('user_id', userId).eq('kind', SUNDAY_KIND).in('period', periods);
      if (error) fail(error);
      for (const row of data || []) { const p = parseClaim(row.reference); if (p) out.set(row.period, p); }
      return out;
    },

    /** The week's paper: the question ids of the earliest row for the period (ties by user id), or null when nobody started. */
    async readPaper(period) {
      const { data, error } = await c().from('learning_allowances').select('user_id,reference,created_at').eq('kind', SUNDAY_KIND).eq('period', period)
        .order('created_at', { ascending: true }).order('user_id', { ascending: true }).limit(1);
      if (error) fail(error);
      const first = (data || [])[0];
      return first ? parseClaim(first.reference)?.ids || null : null;
    },

    /** 'inserted', or 'exists' when this student already has the row (a double tap or a second device). */
    async insertClaim(userId, period, reference) {
      const { error } = await c().from('learning_allowances').insert({ user_id: userId, kind: SUNDAY_KIND, period, reference });
      if (!error) return 'inserted';
      if (String(error.code) === UNIQUE_VIOLATION) return 'exists';
      return fail(error);
    },

    async updateClaim(userId, period, reference) {
      const { error } = await c().from('learning_allowances').update({ reference }).eq('user_id', userId).eq('kind', SUNDAY_KIND).eq('period', period);
      if (error) fail(error);
    },

    /** Best effort: a start that failed before any paper was served leaves no row, so the next start is a first start. */
    async deleteClaim(userId, period) {
      try { await c().from('learning_allowances').delete().eq('user_id', userId).eq('kind', SUNDAY_KIND).eq('period', period); } catch { /* the start's own error is what matters */ }
    },

    /** This student's sent Sunday papers since `sinceMs`: [{ id, subject, week, correct, wrong, unattempted, total, completedAt }]. */
    async findMine(userId, sinceMs) {
      const { data, error } = await c().from('attempts').select('id,subject,correct,wrong,unattempted,total,completed_at,mobPaper:selection_meta->mobPaper')
        .eq('user_id', userId).contains('selection_meta', tagOf(null)).gte('completed_at', iso(sinceMs)).limit(60);
      if (error) fail(error);
      return (data || []).map((r) => ({
        id: r.id, subject: r.subject, week: r.mobPaper?.weekStart || null,
        correct: r.correct, wrong: r.wrong, unattempted: r.unattempted, total: r.total, completedAt: ms(r.completed_at),
      }));
    },

    /** How many sent the week's paper in a subject inside its window (one attempt a student: the attempt id is per student). */
    async countSat(week, subject) {
      const win = sundayWindow(week);
      const { count, error } = await c().from('attempts').select('id', { count: 'exact', head: true })
        .in('subject', subjectSpellings(subject)).contains('selection_meta', tagOf(week))
        .gte('completed_at', iso(win.opensAt)).lte('completed_at', iso(win.lastFinishAt));
      if (error) fail(error);
      return Number.isInteger(count) ? count : 0;
    },

    /** Every sitting of the week's paper in a subject, for the counts after the close: [{ userId, completedAt, details }]. */
    async findSittings(week, subject) {
      const win = sundayWindow(week);
      const rows = [];
      for (let from = 0; from < 200 * PAGE; from += PAGE) {
        const { data, error } = await c().from('attempts').select('id,user_id,completed_at,details')
          .in('subject', subjectSpellings(subject)).contains('selection_meta', tagOf(week))
          .gte('completed_at', iso(win.opensAt)).lte('completed_at', iso(win.lastFinishAt))
          .order('id', { ascending: true }).range(from, from + PAGE - 1);
        if (error) fail(error);
        for (const r of data || []) rows.push({ userId: r.user_id, completedAt: ms(r.completed_at), details: Array.isArray(r.details) ? r.details : [] });
        if (!data || data.length < PAGE) break;
      }
      return rows;
    },

    /** A Mob's subject and members in join order, or null: { subject, members: [{ userId, name, colour, showScore }] }. */
    async mobMembers(mobId) {
      const [mob, members] = await Promise.all([
        c().from('mobs').select('id,subject').eq('id', mobId).maybeSingle(),
        c().from('mob_members').select('user_id,display_name,colour,show_score,joined_at').eq('mob_id', mobId).order('joined_at', { ascending: true }).limit(12),
      ]);
      if (mob.error) fail(mob.error);
      if (members.error) fail(members.error);
      if (!mob.data) return null;
      return {
        subject: mob.data.subject,
        members: (members.data || []).map((m) => ({ userId: m.user_id, name: m.display_name, colour: Number(m.colour) || 0, showScore: m.show_score === true })),
      };
    },

    /** Members' sent papers for the week in a subject: [{ userId, id, correct, wrong, total, completedAt }]. */
    async membersSittings(userIds, week, subject) {
      if (!userIds.length) return [];
      const { data, error } = await c().from('attempts').select('id,user_id,correct,wrong,unattempted,total,completed_at')
        .in('user_id', userIds).in('subject', subjectSpellings(subject)).contains('selection_meta', tagOf(week)).limit(40);
      if (error) fail(error);
      return (data || []).map((r) => ({ userId: r.user_id, id: r.id, correct: r.correct, wrong: r.wrong, unattempted: r.unattempted, total: r.total, completedAt: ms(r.completed_at) }));
    },
  };
}
