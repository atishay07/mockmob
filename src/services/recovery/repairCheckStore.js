// The database side of the repair check (src/services/recovery/repairCheck.js holds the lifecycle). No 'server-only' and
// no alias imports on purpose: the client is injected, so data/tests/repair_check_store.test.mjs runs every query against a
// fake. src/services/recovery/repairCheckDeps.js wires the real client in.
//
// Tables touched, all existing: questions (read), user_question_progress (read, and the answer written through the
// injected writer), question_interactions (read), attempts and recovery_sessions (read), question_content_disputes
// (read), ai_credit_reservations (the repair's committed receipt gets one `check` key; state, amount and the credit
// split are never touched), revise_cards (insert only; absent in production until slice 4's migration is applied, and
// then skipped without an error).
import { readablePracticeQuestions } from '../../../data/practice_library.js';
import { PRACTICE_LIGHT_SELECT } from '../../../data/practice_pick.js';
import { familyOf } from '../../../data/repair_check.js';

// The same visibility filter practice uses (data/db.js VISIBLE_QUESTION_FILTER).
const VISIBLE = 'status.eq.live,and(verification_state.eq.verified,exploration_state.eq.active)';
const CHUNK = 100;
const ATTEMPT_SCAN = 100;
const SESSION_SCAN = 40;
const MISSING_TABLE = new Set(['42P01', 'PGRST205', 'PGRST204']);
const isMissing = (error) => !!error && (MISSING_TABLE.has(error.code) || /schema cache|does not exist|relation .* does not exist/i.test(String(error.message || '')));
const chunks = (list, size = CHUNK) => { const out = []; for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size)); return out; };

export function createCheckStore({ db, recordProgress, readable = readablePracticeQuestions }) {
  return {
    now: () => Date.now(),

    /** The committed repair for one mistake, newest first: { operation_key, receipt } or null. A read failure throws. */
    async findRepairReservation(userId, mistakeKey) {
      const { data, error } = await db.from('ai_credit_reservations').select('operation_key,receipt').eq('user_id', userId).eq('state', 'committed')
        .eq('action', 'score_recovery_repair').like('operation_key', `repair:${mistakeKey}:%`).order('created_at', { ascending: false }).limit(1);
      if (error) throw new Error('reservation_unavailable');
      return data?.[0] || null;
    },

    /** Every published-looking question of the chapter, without the heavy evidence columns. */
    async loadChapterCandidates({ subject, chapter }) {
      const rows = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await db.from('questions').select(PRACTICE_LIGHT_SELECT).eq('subject', subject).eq('chapter', chapter)
          .eq('is_deleted', false).or(VISIBLE).gte('score', -2).order('created_at', { ascending: false }).order('id').range(offset, offset + 999);
        if (error) throw new Error('candidates_unavailable');
        rows.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      return rows;
    },

    /**
     * Every question id this student has met, from every record that holds one: the progress table (any row, answered or
     * skipped), question interactions (every type), saved questions (bookmarks), questions shown in a learning episode, their
     * newest attempts' snapshots and their practice sessions (a session that was opened but never submitted still showed its
     * questions). The same rule the learning episodes use for fresh content (the start_learning_episode function): a family
     * the student has met counts as met for its other members, and a question they wrote is one they have seen.
     * A lookup that fails throws, so the caller offers nothing rather than a question that may have been seen. A table that
     * does not exist in this environment contributes nothing. `candidates` are the chapter's rows (for authors and families).
     */
    async loadSeen({ userId, subject, candidateIds, attempt, candidates = [] }) {
      const seen = new Set();
      for (const q of attempt?.questionsSnapshot || []) if (q?.id) seen.add(q.id);
      for (const part of chunks(candidateIds)) {
        const progress = await db.from('user_question_progress').select('question_id').eq('user_id', userId).in('question_id', part);
        if (progress.error && !isMissing(progress.error)) throw new Error('progress_unavailable');
        for (const row of progress.data || []) seen.add(row.question_id);
        // Any interaction at all (seen, attempted, skipped, liked, reported) means the student has met the question.
        // Interactions are append-only (one row per view), so read every page: a cap here would let a seen question through.
        for (let offset = 0; ; offset += 1000) {
          const interactions = await db.from('question_interactions').select('question_id').eq('user_id', userId).in('question_id', part).order('id').range(offset, offset + 999);
          if (interactions.error) { if (isMissing(interactions.error)) break; throw new Error('interactions_unavailable'); }
          for (const row of interactions.data || []) seen.add(row.question_id);
          if ((interactions.data || []).length < 1000) break;
        }
        const saved = await db.from('question_bookmarks').select('question_id').eq('user_id', userId).in('question_id', part);
        if (saved.error && !isMissing(saved.error)) throw new Error('bookmarks_unavailable');
        for (const row of saved.data || []) seen.add(row.question_id);
        const shown = await db.from('learning_question_exposure').select('question_id').eq('user_id', userId).in('question_id', part);
        if (shown.error && !isMissing(shown.error)) throw new Error('exposure_unavailable');
        for (const row of shown.data || []) seen.add(row.question_id);
      }
      const families = new Set();
      for (const q of attempt?.questionsSnapshot || []) { const f = q?.familyId || q?.family_id; if (f) families.add(f); }
      const attempts = await db.from('attempts').select('questions_snapshot').eq('user_id', userId).eq('subject', attempt?.subject ?? subject)
        .order('completed_at', { ascending: false }).limit(ATTEMPT_SCAN);
      if (attempts.error) throw new Error('attempts_unavailable');
      for (const row of attempts.data || []) for (const q of row.questions_snapshot || []) { if (q?.id) seen.add(q.id); const f = q?.familyId || q?.family_id; if (f) families.add(f); }
      const sessions = await db.from('recovery_sessions').select('questions').eq('user_id', userId).eq('subject', subject)
        .order('created_at', { ascending: false }).limit(SESSION_SCAN);
      if (sessions.error && !isMissing(sessions.error)) throw new Error('sessions_unavailable');
      for (const row of sessions.data || []) for (const q of row.questions || []) { if (q?.id) seen.add(q.id); const f = q?.familyId || q?.family_id; if (f) families.add(f); }
      const exposed = await db.from('learning_family_exposure').select('family_id').eq('user_id', userId).limit(5000);
      if (exposed.error && !isMissing(exposed.error)) throw new Error('family_exposure_unavailable');
      for (const row of exposed.data || []) if (row.family_id) families.add(row.family_id);
      // A family the student has met (a question of it seen, or taught) is met for every member of it.
      const rows = Array.isArray(candidates) ? candidates : [];
      for (const row of rows) { const f = familyOf(row); if (f && seen.has(row.id)) families.add(f); }
      for (const row of rows) { const f = familyOf(row); if (f && families.has(f)) seen.add(row.id); }
      return seen;
    },

    /** Questions with an open content dispute. Any failure but a missing table throws: a disputed question must never reach a student. */
    async loadExcluded(ids) {
      const held = new Set();
      for (const part of chunks(ids)) {
        const { data, error } = await db.from('question_content_disputes').select('question_id').eq('state', 'open').in('question_id', part);
        if (error) { if (isMissing(error)) return held; throw new Error('disputes_unavailable'); }
        for (const row of data || []) held.add(row.question_id);
      }
      return held;
    },

    /** The full rows of these ids that pass the publication gate (evidence, answer integrity, family holds): Map id -> row. */
    async verifyPublished(ids) {
      const out = new Map();
      for (const part of chunks(ids)) {
        const { data, error } = await db.from('questions').select('*').in('id', part);
        if (error) throw new Error('verify_unavailable');
        const ok = await readable((data || []).filter((row) => !row.is_deleted), db);
        for (const row of ok) out.set(row.id, row);
      }
      return out;
    },

    /**
     * Stores the answer on the repair's committed receipt, once. The update only matches while receipt.check is absent, so
     * two requests racing for the same repair cannot both win: the loser reads the winner's answer back.
     * Returns { ok:true } | { ok:false, existing } | throws.
     */
    async claimCheck({ operationKey, userId, check }) {
      const row = await db.from('ai_credit_reservations').select('receipt').eq('operation_key', operationKey).eq('user_id', userId).eq('state', 'committed').maybeSingle();
      if (row.error || !row.data?.receipt) throw new Error('receipt_unavailable');
      if (row.data.receipt.check) return { ok: false, existing: row.data.receipt.check };
      const res = await db.from('ai_credit_reservations').update({ receipt: { ...row.data.receipt, check } })
        .eq('operation_key', operationKey).eq('user_id', userId).eq('state', 'committed').is('receipt->check', null).select('operation_key');
      if (res.error) throw new Error('receipt_write_failed');
      if (res.data?.length) return { ok: true };
      const again = await db.from('ai_credit_reservations').select('receipt').eq('operation_key', operationKey).eq('user_id', userId).maybeSingle();
      if (again.data?.receipt?.check) return { ok: false, existing: again.data.receipt.check };
      throw new Error('receipt_write_failed');
    },

    /** Adds the extras (progress flag, Revise result, final line) to the stored answer. Best effort. */
    async patchCheck({ operationKey, userId, patch }) {
      const row = await db.from('ai_credit_reservations').select('receipt').eq('operation_key', operationKey).eq('user_id', userId).eq('state', 'committed').maybeSingle();
      if (row.error || !row.data?.receipt?.check) throw new Error('receipt_unavailable');
      const receipt = { ...row.data.receipt, check: { ...row.data.receipt.check, ...patch } };
      const res = await db.from('ai_credit_reservations').update({ receipt }).eq('operation_key', operationKey).eq('user_id', userId).eq('state', 'committed');
      if (res.error) throw new Error('receipt_write_failed');
    },

    /** The student's progress for the check question: attempt count, correctness and the key letter picked. */
    recordProgress: ({ userId, row, pickedStored, right }) => recordProgress({
      userId,
      subject: row.subject,
      details: [{ qid: row.id, givenIndex: pickedStored, isCorrect: right }],
      questionsSnapshot: [{ id: row.id, internalSubject: row.subject, subject: row.subject, chapter: row.chapter, options: row.options }],
    }),

    /**
     * Puts the rows into revise_cards without touching a card that exists. Returns { count, dueDay } (the day the relevant
     * card is due) or null when the table does not exist yet. Any other failure throws.
     */
    async scheduleRevise({ userId, rows, dueRowId }) {
      const payload = rows.map((r) => ({ user_id: userId, ...r }));
      const res = await db.from('revise_cards').upsert(payload, { onConflict: 'user_id,question_id', ignoreDuplicates: true });
      if (res.error) { if (isMissing(res.error)) return null; throw new Error('revise_write_failed'); }
      const card = await db.from('revise_cards').select('question_id,due_day').eq('user_id', userId).in('question_id', rows.map((r) => r.question_id));
      if (card.error) return { count: rows.length, dueDay: null };
      const due = (card.data || []).find((c) => c.question_id === dueRowId) || (card.data || [])[0];
      return { count: rows.length, dueDay: due?.due_day || null };
    },
  };
}
