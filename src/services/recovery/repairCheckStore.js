// The database side of the repair check (src/services/recovery/repairCheck.js holds the lifecycle). No 'server-only' and
// no alias imports on purpose: the client is injected, so data/tests/repair_check_store.test.mjs runs every query against a
// fake. src/services/recovery/repairCheckDeps.js wires the real client in.
//
// Tables touched, all existing: questions (read), user_question_progress (read, and the answer written through the
// injected writer), question_interactions (read; one `seen` row written when a check question is offered), attempts and recovery_sessions (read), question_content_disputes
// (read), ai_credit_reservations (the repair's committed receipt gets an `offered` and a `check` key; state, amount and the credit
// split are never touched), revise_cards (insert only; absent in production until slice 4's migration is applied, and
// then skipped without an error).
import { readablePracticeQuestions } from '../../../data/practice_library.js';
import { PRACTICE_LIGHT_SELECT } from '../../../data/practice_pick.js';
import { familyOf } from '../../../data/repair_check.js';

// The same visibility filter practice uses (data/db.js VISIBLE_QUESTION_FILTER).
const VISIBLE = 'status.eq.live,and(verification_state.eq.verified,exploration_state.eq.active)';
const CHUNK = 100;
const ATTEMPT_SCAN = 100;
const SNAPSHOT_SCAN = 5;
const SESSION_SCAN = 40;
const INTERACTION_PAGE = 500;
const MISSING_TABLE = new Set(['42P01', 'PGRST205', 'PGRST204']);
const isMissing = (error) => !!error && (MISSING_TABLE.has(error.code) || /schema cache|does not exist|relation .* does not exist/i.test(String(error.message || '')));
const chunks = (list, size = CHUNK) => { const out = []; for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size)); return out; };

/**
 * The question ids of one chunk that have any interaction of this student. Interactions are append-only (one row per view),
 * so they are keyset paged by question id: after a full page, the rows past its last id are more rows of that same question
 * (already known to be seen), so the next page starts after it. Cost follows the chunk (at most one page per question), never
 * the student's view history.
 */
async function readInteractions(db, userId, part) {
  const found = [];
  let after = null;
  for (let guard = 0; guard <= part.length; guard += 1) {
    let query = db.from('question_interactions').select('question_id').eq('user_id', userId).in('question_id', part);
    if (after !== null) query = query.gt('question_id', after);
    const { data, error } = await query.order('question_id').limit(INTERACTION_PAGE);
    if (error) { if (isMissing(error)) return found; throw new Error('interactions_unavailable'); }
    const page = data || [];
    for (const row of page) found.push(row.question_id);
    if (page.length < INTERACTION_PAGE) return found;
    after = page[page.length - 1].question_id;
  }
  throw new Error('interactions_unavailable');
}

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
     * skipped), question interactions (every type, including the `seen` row written when a check question is offered), saved
     * questions (bookmarks), questions shown in a learning episode, their newest attempts and their practice sessions (a
     * session that was opened but never submitted still showed its questions). The same rule the learning episodes use for
     * fresh content (the start_learning_episode function): a family the student has met counts as met for its other members,
     * and a question they wrote is one they have seen.
     * A lookup that fails throws, so the caller offers nothing rather than a question that may have been seen. A table that
     * does not exist in this environment contributes nothing. `candidates` are the chapter's rows (for authors and families).
     *
     * What it reads is bounded by the chapter, never by the student's history: ids are read in chunks of 100 through the
     * (user, question) keys; interactions are read last and only for the questions nothing else has shown to be seen, keyset
     * paged by question id (a question viewed 5,000 times costs one page, not ten);
     * attempts give their question ids through the small `details` column and their heavy snapshots (for families) only for
     * the newest few; family exposure is read for the chapter's own families, not "the first 5,000 rows". The reads of one
     * lookup run in parallel.
     */
    async loadSeen({ userId, subject, candidateIds, attempt, candidates = [] }) {
      const seen = new Set();
      const rows = Array.isArray(candidates) ? candidates : [];
      for (const q of attempt?.questionsSnapshot || []) if (q?.id) seen.add(q.id);
      const families = new Set();
      for (const q of attempt?.questionsSnapshot || []) { const f = q?.familyId || q?.family_id; if (f) families.add(f); }
      const chapterFamilies = [...new Set(rows.map(familyOf).filter(Boolean))];

      const idChunk = async (part) => {
        const [progress, saved, shown] = await Promise.all([
          db.from('user_question_progress').select('question_id').eq('user_id', userId).in('question_id', part),
          db.from('question_bookmarks').select('question_id').eq('user_id', userId).in('question_id', part),
          db.from('learning_question_exposure').select('question_id').eq('user_id', userId).in('question_id', part),
        ]);
        if (progress.error && !isMissing(progress.error)) throw new Error('progress_unavailable');
        for (const row of progress.data || []) seen.add(row.question_id);
        if (saved.error && !isMissing(saved.error)) throw new Error('bookmarks_unavailable');
        for (const row of saved.data || []) seen.add(row.question_id);
        if (shown.error && !isMissing(shown.error)) throw new Error('exposure_unavailable');
        for (const row of shown.data || []) seen.add(row.question_id);
      };
      const familyChunk = async (part) => {
        const exposed = await db.from('learning_family_exposure').select('family_id').eq('user_id', userId).in('family_id', part);
        if (exposed.error && !isMissing(exposed.error)) throw new Error('family_exposure_unavailable');
        for (const row of exposed.data || []) if (row.family_id) families.add(row.family_id);
      };
      const attemptSubject = attempt?.subject ?? subject;
      const recentAttempts = async () => {
        // The ids of the newest attempts come from `details` (a few dozen bytes a question). The snapshots (full text and
        // options) are read only for the newest few, for their families: older attempts are in the progress table.
        const [ids, snapshots] = await Promise.all([
          db.from('attempts').select('details').eq('user_id', userId).eq('subject', attemptSubject).order('completed_at', { ascending: false }).limit(ATTEMPT_SCAN),
          db.from('attempts').select('questions_snapshot').eq('user_id', userId).eq('subject', attemptSubject).order('completed_at', { ascending: false }).limit(SNAPSHOT_SCAN),
        ]);
        if (ids.error || snapshots.error) throw new Error('attempts_unavailable');
        for (const row of ids.data || []) for (const d of Array.isArray(row.details) ? row.details : []) if (d?.qid) seen.add(d.qid);
        for (const row of snapshots.data || []) for (const q of row.questions_snapshot || []) { if (q?.id) seen.add(q.id); const f = q?.familyId || q?.family_id; if (f) families.add(f); }
      };
      const openSessions = async () => {
        const sessions = await db.from('recovery_sessions').select('questions').eq('user_id', userId).eq('subject', subject)
          .order('created_at', { ascending: false }).limit(SESSION_SCAN);
        if (sessions.error && !isMissing(sessions.error)) throw new Error('sessions_unavailable');
        for (const row of sessions.data || []) for (const q of row.questions || []) { if (q?.id) seen.add(q.id); const f = q?.familyId || q?.family_id; if (f) families.add(f); }
      };

      const parts = chunks(candidateIds);
      const jobs = [recentAttempts(), openSessions()];
      for (const part of parts) jobs.push(idChunk(part));
      for (const part of chunks(chapterFamilies)) jobs.push(familyChunk(part));
      await Promise.all(jobs);
      // Interactions last, and only for the questions no other record has shown to be seen: any interaction at all (seen,
      // attempted, skipped, liked, reported) means the student has met a question, but the questions a student has viewed
      // the most are the ones the progress table, an attempt or a saved list already knows, so their append-only history is
      // not read. A question known only from its interactions (a progress write that was skipped) is still found.
      await Promise.all(parts.map(async (part) => {
        const rest = part.filter((id) => !seen.has(id));
        if (rest.length) for (const id of await readInteractions(db, userId, rest)) seen.add(id);
      }));
      // A family the student has met (a question of it seen, or taught) is met for every member of it.
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

    /**
     * Records which question this repair offered, on the committed receipt (receipt.offered), once. The update only matches
     * while no answer is stored and the offer is still the one that was read (none, or \`replaces\`), so two requests racing
     * to offer cannot both win and an answer is never overwritten: the loser gets the winner's offer back.
     * Returns { ok:true } | { ok:false, existing } (the offer that is there now, or null when an answer was stored) | throws.
     */
    async claimOffer({ operationKey, userId, offer, replaces = null }) {
      const read = async () => db.from('ai_credit_reservations').select('receipt').eq('operation_key', operationKey).eq('user_id', userId).eq('state', 'committed').maybeSingle();
      const row = await read();
      if (row.error || !row.data?.receipt) throw new Error('receipt_unavailable');
      const current = row.data.receipt.offered || null;
      if (row.data.receipt.check) return { ok: false, existing: null };
      if ((current?.checkQuestionId ?? null) !== replaces) return { ok: false, existing: current };
      let update = db.from('ai_credit_reservations').update({ receipt: { ...row.data.receipt, offered: offer } })
        .eq('operation_key', operationKey).eq('user_id', userId).eq('state', 'committed').is('receipt->check', null);
      update = replaces === null ? update.is('receipt->offered', null) : update.eq('receipt->offered->>checkQuestionId', replaces);
      const res = await update.select('operation_key');
      if (res.error) throw new Error('receipt_write_failed');
      if (res.data?.length) return { ok: true };
      const again = await read();
      if (again.error || !again.data?.receipt) throw new Error('receipt_write_failed');
      return { ok: false, existing: again.data.receipt.check ? null : again.data.receipt.offered || null };
    },

    /** Marks the offer as recorded (the \`seen\` row is written). Matches only while no answer is stored. Best effort for the caller. */
    async patchOffer({ operationKey, userId, checkQuestionId, patch }) {
      const row = await db.from('ai_credit_reservations').select('receipt').eq('operation_key', operationKey).eq('user_id', userId).eq('state', 'committed').maybeSingle();
      if (row.error || row.data?.receipt?.offered?.checkQuestionId !== checkQuestionId) throw new Error('receipt_unavailable');
      const res = await db.from('ai_credit_reservations').update({ receipt: { ...row.data.receipt, offered: { ...row.data.receipt.offered, ...patch } } })
        .eq('operation_key', operationKey).eq('user_id', userId).eq('state', 'committed').is('receipt->check', null);
      if (res.error) throw new Error('receipt_write_failed');
    },

    /**
     * A question that was shown as a check counts as seen from that moment, answered or not: one \`seen\` interaction, which
     * every "never seen" lookup (this one, practice, learning) already reads. A table missing in this environment records
     * nothing; any other failure throws, and the caller then does not show the question.
     */
    async recordSeen({ userId, questionId, mistakeKey }) {
      const res = await db.from('question_interactions').insert({
        question_id: questionId, user_id: userId, interaction_type: 'seen', flow_context: 'review', session_id: mistakeKey,
        metadata: { source: 'repair_check_offer' },
      });
      if (res.error && !isMissing(res.error)) throw new Error('seen_write_failed');
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
