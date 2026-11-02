// Learn v2 on the server: every database read and write of the Learn service (src/lib/server/learn.js), through the injected
// Supabase-shaped client. No handler logic lives here. No 'server-only' and no '@/' imports, so node:test drives it with the
// in-memory client (src/lib/server/keycardsMemoryDb.js).
//
// The rules every read keeps (docs/brain/learn-1031/audit-1101/A6-wiring.md section 3):
//   - questions are never read with every column (star): the answer read is the narrow ANSWER_COLUMNS of one row, content reads the
//     light CONTENT_COLUMNS, and full rows only go through the practice row cache (learnHttp.js, verifyRows);
//   - key_card_states is never read with its schedule JSON: four json-path stubs feed retrievability (toState);
//   - every list read is ordered and paged at 1,000 rows (PostgREST max-rows), and every .in() list is cut into pieces of 100;
//   - "unknown" never shows as zero: a failed read of the plan, the card states, the answered progress or today's allowances
//     throws LEARN_UNAVAILABLE (503). A failed read of the open runs means no Pick up; of Revise's cards, the mistakes are
//     the ones Revise will seed from the progress rows.
import { readAnsweredProgress } from '../../../data/practice_progress.js';

export const PAGE = 1000;
export const MAX_PAGES = 100;
export const IN_CHUNK = 100;
/** The card states without their schedule JSON: four json-path stubs are all retrievability needs. */
export const STATE_COLUMNS = 'card_id,subject,chapter_key,reps,lapses,due_at,last_review_at,last_rating,added_from,suspended,'
  + 'st:schedule->stability,lr:schedule->>last_review,sst:schedule->state,sdue:schedule->>due';
/** The state rows with every schedule field FSRS reads (the keys' words), as json-path stubs. */
export const FULL_STATE_COLUMNS = 'card_id,reps,lapses,due_at,suspended,st:schedule->stability,df:schedule->difficulty,es:schedule->elapsed_days,'
  + 'sd:schedule->scheduled_days,ls:schedule->learning_steps,sst:schedule->state,sdue:schedule->>due,lr:schedule->>last_review,srp:schedule->reps,slp:schedule->lapses';
export const PROGRESS_COLUMNS = 'question_id,subject,chapter,attempt_count,last_correct,last_selected_key,last_attempted_at';
export const ALLOWANCE_KINDS = Object.freeze(['keycard_review', 'keycard_new', 'keycard_line', 'learn_session']);
export const RUN_LIST_COLUMNS = 'id,kind,subject,chapter_key,asked_minutes,minutes,leave_out,item_count,done_count,seconds_left,session_claimed,created_at,ended_at';
export const RUN_COLUMNS = 'id,user_id,request_key,kind,subject,chapter_key,asked_minutes,minutes,leave_out,items,item_count,done_count,'
  + 'seconds_left,reinserted,extra,start_state,added,looks,limit_line,session_claimed,created_at,ended_at';
export const EVENT_COLUMNS = 'item_id,kind,question_id,card_id,choice,correct,fixed,origin,rating,due_at,body,created_at';
/** The one question read at answer time: the live row's key, never every column. */
export const ANSWER_COLUMNS = 'id,subject,chapter,question,body,options,correct_index,correct_answer,explanation,status,is_deleted,verification_state,content_hash,updated_at';
/** A question's served content (a run reloaded after the pool moved on): no key, no explanation. */
export const CONTENT_COLUMNS = 'id,subject,chapter,question,body,options,status,is_deleted,verification_state,content_hash,updated_at';
export const REVISE_COLUMNS = 'question_id,box,due_day,state,right_total,updated_at';

const fail = (cause, what) => Object.assign(new Error('LEARN_UNAVAILABLE'), { code: 'LEARN_UNAVAILABLE', cause, what });
const missingFunction = (error) => /PGRST202|could not find the function|42883/i.test(`${error?.code || ''} ${error?.message || ''}`);

/** A state row with its schedule rebuilt from the json-path stubs (or kept, when a full row was read). */
export function toState(row) {
  if (!row) return row;
  if (row.schedule && typeof row.schedule === 'object') return row;
  const { st, lr, sst, sdue, ...rest } = row;
  const schedule = st === undefined && lr === undefined && sst === undefined && sdue === undefined
    ? null
    : { stability: st == null ? null : Number(st), last_review: lr ?? null, state: sst == null ? null : Number(sst), due: sdue ?? rest.due_at ?? null };
  return { ...rest, schedule };
}

/** A full state row with its schedule rebuilt from FULL_STATE_COLUMNS' stubs (or kept, when a full row was read). */
export function toFullState(row) {
  if (!row || (row.schedule && typeof row.schedule === 'object')) return row;
  const { st, df, es, sd, ls, sst, sdue, lr, srp, slp, ...rest } = row;
  const has = [st, df, sst, sdue, lr].some((v) => v !== undefined && v !== null);
  const schedule = has ? {
    due: sdue ?? rest.due_at ?? null, stability: st == null ? null : Number(st), difficulty: df == null ? null : Number(df), elapsed_days: Number(es) || 0,
    scheduled_days: Number(sd) || 0, reps: Number(srp) || Number(rest.reps) || 0, lapses: Number(slp) || Number(rest.lapses) || 0, learning_steps: Number(ls) || 0,
    state: sst == null ? null : Number(sst), last_review: lr ?? null,
  } : null;
  return { ...rest, schedule };
}

/** Cut a list into pieces of `size`. */
export const chunks = (list, size = IN_CHUNK) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

/**
 * The store over one client. `now()` is the service clock (ms).
 */
export function createLearnStore(db, { now = () => Date.now(), warn = console.warn } = {}) {
  async function must(promise, what) {
    let res;
    try { res = await promise; } catch (error) { throw fail(error, what); }
    if (res?.error) throw fail(res.error, what);
    return res.data;
  }
  /** Every row `build()` selects (ordered by the caller), a page of 1,000 at a time until a short page. */
  async function pages(build, what) {
    const out = [];
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const rows = (await must(build().range(page * PAGE, (page + 1) * PAGE - 1), what)) || [];
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
    return out;
  }

  return {
    // ---------------------------------------------------------------- the snapshot reads (A6 section 3)

    /** S2: the saved section option per subject. No table yet: the no-option default. */
    async options(userId) {
      try {
        const res = await db.from('student_subject_options').select('subject,option').eq('user_id', userId);
        if (res.error) return new Map();
        return new Map((res.data || []).map((r) => [r.subject, r.option]));
      } catch { return new Map(); }
    },

    /** S3: the student's card states of one subject (or one chapter), stubs instead of the schedule JSON. */
    async states(userId, { subject = null, chapterKey = null } = {}) {
      const rows = await pages(() => {
        let q = db.from('key_card_states').select(STATE_COLUMNS).eq('user_id', userId);
        if (subject) q = q.eq('subject', subject);
        if (chapterKey) q = q.eq('chapter_key', chapterKey);
        return q.order('card_id');
      }, 'card states');
      return rows.map(toState);
    },

    /** S4: the answered progress rows of a subject, paged and ordered. A page that failed is unknown: 503, never zero. */
    async progress(userId, subject = null) {
      const out = await readAnsweredProgress(db, userId, { subject, columns: PROGRESS_COLUMNS, what: 'Learn progress', warn });
      if (out.incomplete) throw fail(out.error, 'progress');
      return out.rows;
    },

    /** S5: today's allowance rows of the Key cards kinds and Learn's session (at most 16). */
    async allowances(userId, day) {
      const rows = await must(db.from('learning_allowances').select('kind,period,reference').eq('user_id', userId)
        .in('kind', [...ALLOWANCE_KINDS]).like('period', `${day}:%`), 'allowances');
      return rows || [];
    },

    /** S6: the student's runs not ended, of the last `hours` (default 24), newest first. A failed read: no Pick up. */
    async openRuns(userId, { hours = 24, limit = 5 } = {}) {
      const since = new Date(now() - hours * 3_600_000).toISOString();
      try {
        const res = await db.from('learn_runs').select(RUN_LIST_COLUMNS).eq('user_id', userId).is('ended_at', null)
          .gte('created_at', since).order('created_at', { ascending: false }).limit(limit);
        if (res.error) return [];
        return (res.data || []).filter((r) => !r.ended_at && Date.parse(r.created_at) >= Date.parse(since))
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, limit);
      } catch { return []; }
    },

    /** The student's feed runs of the last `days` with their items (the feed's "shown lately", BUILD-1101 1.2). */
    async recentFeeds(userId, { days = 3, limit = 30 } = {}) {
      const since = new Date(now() - days * 86_400_000).toISOString();
      try {
        const res = await db.from('learn_runs').select('id,chapter_key,items,created_at,ended_at').eq('user_id', userId).eq('kind', 'feed')
          .gte('created_at', since).order('created_at', { ascending: false }).limit(limit);
        if (res.error) return [];
        return (res.data || []).filter((r) => Date.parse(r.created_at) >= Date.parse(since));
      } catch { return []; }
    },

    /**
     * R5 LK38: the card states of the given cards with every field FSRS reads, for the words on a run's Missed it, Got it and
     * Easy keys (schedule() over the stored state). Json-path stubs, never the bare schedule column (learn_egress.test.mjs);
     * `schedule` is rebuilt from them. A failed read is unknown (503); the caller shows no words rather than guess.
     */
    async fullStates(userId, cardIds) {
      const out = [];
      for (const part of chunks([...new Set(cardIds || [])])) {
        const rows = await must(db.from('key_card_states').select(FULL_STATE_COLUMNS).eq('user_id', userId).in('card_id', part), 'card schedules');
        out.push(...(rows || []).map(toFullState));
      }
      return out;
    },

    /** One card's state row (Keep), or null. */
    async cardState(userId, cardId) {
      const rows = await must(db.from('key_card_states').select(STATE_COLUMNS).eq('user_id', userId).eq('card_id', cardId).limit(1), 'card state');
      return rows?.[0] ? toState(rows[0]) : null;
    },

    /** One question's progress row of this student (an answer's mistake check), or null. */
    async progressRow(userId, questionId) {
      const rows = await must(db.from('user_question_progress').select(PROGRESS_COLUMNS).eq('user_id', userId).eq('question_id', questionId).limit(1), 'progress row');
      return rows?.[0] || null;
    },

    /** One question's Revise card, or null (also when the table cannot be read: the card Revise would seed is used). */
    async reviseCard(userId, questionId) {
      try {
        const res = await db.from('revise_cards').select(REVISE_COLUMNS).eq('user_id', userId).eq('question_id', questionId).limit(1);
        return res.error ? null : res.data?.[0] || null;
      } catch { return null; }
    },

    /** Revise's question cards of the student (Learn's open mistakes in production, A5 R10.2). null when unread. */
    async reviseCards(userId) {
      try {
        return await pages(() => db.from('revise_cards').select(REVISE_COLUMNS).eq('user_id', userId).order('question_id'), 'revise cards');
      } catch { return null; }
    },

    // ---------------------------------------------------------------- runs and events

    /** One run of this student (any other student's id reads as missing). */
    async run(userId, id) {
      if (typeof id !== 'string' || !id || id.length > 60) return null;
      const rows = await must(db.from('learn_runs').select(RUN_COLUMNS).eq('id', id).eq('user_id', userId).limit(1), 'run');
      return rows?.[0] || null;
    },

    /** The student's run of one request key (a retried start), or null. */
    async runByKey(userId, requestKey) {
      const rows = await must(db.from('learn_runs').select(RUN_COLUMNS).eq('user_id', userId).eq('request_key', requestKey).limit(1), 'run by key');
      return rows?.[0] || null;
    },

    /** The events of one run (at most a run's items, one page). */
    async events(runId) {
      return pages(() => db.from('learn_run_events').select(EVENT_COLUMNS).eq('run_id', runId).order('item_id'), 'run events');
    },

    /** One item's event (the replay probe). */
    async event(runId, itemId) {
      const rows = await must(db.from('learn_run_events').select(EVENT_COLUMNS).eq('run_id', runId).eq('item_id', itemId).limit(1), 'event');
      return rows?.[0] || null;
    },

    /** The events of several runs (the feed's shown cards): .in() in pieces of 100. */
    async eventsOf(runIds) {
      const out = [];
      for (const part of chunks([...new Set(runIds)])) {
        const rows = await pages(() => db.from('learn_run_events').select('run_id,item_id,kind,created_at').in('run_id', part).order('run_id'), 'feed events');
        out.push(...rows);
      }
      return out;
    },

    /** The newest Learn answers of some questions (where a mistake was made: "Learn"). */
    async learnAnswers(userId, questionIds) {
      const out = [];
      try {
        for (const part of chunks([...new Set(questionIds)])) {
          const res = await db.from('learn_run_events').select('question_id,correct,created_at').eq('user_id', userId).in('question_id', part)
            .order('question_id').limit(PAGE);
          if (res.error) return [];
          out.push(...(res.data || []));
        }
      } catch { return []; }
      return out;
    },

    /** learn_start_run (BUILD-1101 2.1): { status: 'ok' | 'replay' | 'key_conflict', id }. */
    async startRun(row, questionIds) {
      return must(db.rpc('learn_start_run', { p_row: row, p_question_ids: questionIds }), 'start run');
    },

    /** learn_record_event (BUILD-1101 2.1). */
    async recordEvent({ userId, runId, itemId, event, progress = null, interaction = null, reinsert = null, limitLine = null, quota = null }) {
      return must(db.rpc('learn_record_event', {
        p_user: userId, p_run: runId, p_item: itemId, p_event: event, p_progress: progress, p_interaction: interaction,
        p_reinsert: reinsert, p_limit_line: limitLine, p_quota: quota,
      }), 'record event');
    },

    /** End a run once: a second end changes nothing. */
    async endRun(userId, id) {
      await must(db.from('learn_runs').update({ ended_at: new Date(now()).toISOString(), updated_at: new Date(now()).toISOString() })
        .eq('id', id).eq('user_id', userId).is('ended_at', null), 'end run');
    },

    // ---------------------------------------------------------------- questions

    /** The live row of one question, narrow (the key is read only here, at answer time). */
    async question(id) {
      const rows = await must(db.from('questions').select(ANSWER_COLUMNS).eq('id', id).limit(1), 'question');
      return rows?.[0] || null;
    },

    /** Served content of some questions (no key), .in() in pieces of 100. */
    async questionContent(ids) {
      const out = [];
      for (const part of chunks([...new Set(ids)])) out.push(...((await must(db.from('questions').select(CONTENT_COLUMNS).in('id', part), 'question content')) || []));
      return out;
    },

    // ---------------------------------------------------------------- small writes

    /** Take Free's next "line you needed" slot today (Key cards' own rule and kind). True when taken. */
    async claimLine(userId, day, taken, limit, questionId) {
      for (let slot = taken + 1; slot <= limit; slot += 1) {
        const res = await db.from('learning_allowances').insert({ user_id: userId, kind: 'keycard_line', period: `${day}:${slot}`, reference: String(questionId).slice(0, 200), created_at: new Date(now()).toISOString() });
        if (!res.error) return true;
        if (!/23505|duplicate|unique/i.test(`${res.error.code || ''} ${res.error.message || ''}`)) throw fail(res.error, 'line allowance');
      }
      return false;
    },

    /** A Revise card graded by a Learn retry: update the stored card (guarded by what was read) or write the seeded one. */
    async gradeRevise(userId, questionId, before, next, today) {
      const stamp = new Date(now()).toISOString();
      const fields = { box: next.box, due_day: next.due_day, state: next.state, right_total: next.right_total, last_recalled_day: today, updated_at: stamp };
      try {
        if (before?.stored) {
          await db.from('revise_cards').update(fields).eq('user_id', userId).eq('question_id', questionId).eq('box', before.box).eq('due_day', before.due_day);
        } else {
          // A card Revise had not seeded yet: written as Revise would seed it, then graded. A seed that raced in first wins
          // (the insert's conflict is ignored; Revise grades it next time).
          await db.from('revise_cards').insert({ user_id: userId, question_id: questionId, key_hash: before?.key_hash ?? null, wrong_at: before?.wrong_at ?? null, created_at: stamp, ...fields });
        }
        return true;
      } catch (error) {
        warn('[learn] revise card not moved:', error?.message || error);
        return false;
      }
    },

    missingFunction,
  };
}
