// Fixtures and a real-Postgres fake for the lean attempt reads (egress items A1, A3, A4, A5; 20 Oct 2026).
// Attempts are built through the real scorer (data/recovery.js scoreSession), so details and recovery have the production shape,
// and every snapshot question carries all 41 keys of a bank row with non-null values: a builder that reads a key a lean profile
// dropped would give a different answer on the lean rows and fail the parity tests. The database functions run for real in
// PGlite (the migrations, unedited). Nothing here establishes academic reliability.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { scoreSession } from '../../recovery.js';
import { rng } from './egress_fixtures.mjs';

export const SNAPSHOT_KEYS = ['aiScore', 'aiTier', 'anchorTier', 'authorId', 'body', 'chapter', 'concept', 'conceptId', 'correctAnswer', 'correctIndex', 'createdAt', 'difficulty', 'difficultyWeight', 'downvotes', 'explanation', 'familyId', 'id', 'internalSubject', 'options', 'orderIndex', 'passageGroupId', 'passageId', 'passageText', 'passageTitle', 'passageType', 'pyqAnchorId', 'qualityBand', 'qualityScore', 'question', 'questionType', 'score', 'source', 'sourceKind', 'status', 'subject', 'topic', 'uploadedBy', 'upvotes', 'userVote', 'verificationEvidence', 'verificationState'];
const CHAPTERS = { accountancy: ['Partnership', 'Ratios', 'Cash Flow', 'Goodwill'], economics: ['National Income', 'Money', 'Budget'] };
const DIFFICULTY = ['easy', 'medium', 'hard'];

export function richQuestion(id, subject, k, seed) {
  const chapters = CHAPTERS[subject];
  const chapter = chapters[(k + seed) % chapters.length];
  const stem = `Which statement about ${chapter} (${id}) is correct?`;
  return {
    aiScore: 7.5, aiTier: 'A', anchorTier: 'B', authorId: 'author-1', body: k % 3 === 0 ? stem : `${stem} Read the passage. `, chapter, concept: `Concept ${k % 7}`, conceptId: `c-${subject}-${k % 7}`,
    correctAnswer: ['one', 'two', 'three', 'four'][k % 4], correctIndex: k % 4, createdAt: '2026-09-01T00:00:00Z', difficulty: DIFFICULTY[(k + seed) % 3], difficultyWeight: 1.2, downvotes: 1, explanation: `Because ${id}. `.repeat(20),
    familyId: `fam-${id}`, id, internalSubject: subject, options: ['one', 'two', 'three', 'four'], orderIndex: k, passageGroupId: `pg-${k}`, passageId: `p-${k}`, passageText: 'A long passage. '.repeat(40), passageTitle: 'Passage',
    passageType: 'text', pyqAnchorId: `pyq-${k}`, qualityBand: 'high', qualityScore: 88, question: stem, questionType: 'mcq', score: 3, source: 'authored', sourceKind: 'authored', status: 'live', subject, topic: `Topic ${k}`,
    uploadedBy: 'uploader-1', upvotes: 4, userVote: 1, verificationEvidence: { content_hash: `hash-${id}`, family_id: `fam-${id}`, record: { padding: 'x'.repeat(3000), signature: 's'.repeat(64) } }, verificationState: 'verified',
  };
}

/** `count` attempts of one user, oldest first by index (completed_at rises with i). All twelve table columns. */
export function richAttemptRows(seed, userId, count, { today = Date.UTC(2026, 9, 20, 6, 0, 0), mobPaperOn = [] } = {}) {
  const rand = rng(seed);
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const subject = ['accountancy', 'economics'][i % 2];
    const total = 5 + Math.floor(rand() * 10);
    const questions = Array.from({ length: total }, (_, k) => richQuestion(`q-${seed}-${i}-${k}`, subject, k, i));
    const answers = {}; const events = []; let seq = 1; let at = 1000;
    questions.forEach((q) => {
      events.push({ seq: seq++, qid: q.id, at, type: 'visit' });
      const roll = rand();
      if (roll >= 0.15) {
        const first = roll < 0.55 ? q.correctIndex : (q.correctIndex + 1) % 4;
        events.push({ seq: seq++, qid: q.id, at: at + 800, type: 'answer', answer: first });
        let final = first;
        if (roll > 0.9) { final = q.correctIndex; events.push({ seq: seq++, qid: q.id, at: at + 2500, type: 'answer', answer: final }); }
        answers[q.id] = final;
      }
      at += 3000 + Math.floor(rand() * 60000);
    });
    events.push({ seq: seq++, qid: questions.at(-1).id, at: at + 10, type: 'visit' });
    const result = scoreSession(questions, answers, events, at + 1000);
    const completed = new Date(today - (count - i) * 3_600_000 * 7);
    const meta = {
      mode: i % 3 === 0 ? 'full' : 'quick', scoringVersion: i % 5 === 4 ? 'historical_device' : 'server_snapshot_v1', durationMinutes: 30, sessionId: `s-${seed}-${i}`, recovery: result.recovery,
      poolStats: { pool: 400, seen: 12, padding: 'y'.repeat(600) }, usage: { picks: total }, answerIntegrity: { ok: true }, validation: { v: 1 }, contentEvidence: { policy: 'p1' }, learningPurpose: 'ordinary_practice',
    };
    if (i === count - 1) meta.tonight = { day: '2026-10-20', key: 'tonight-key-abcdef123456', minutes: 10 };
    if (mobPaperOn.includes(i)) meta.mobPaper = { mobId: 'mob-1', weekStart: '2026-10-19', holdUntil: '2026-10-26T00:00:00.000Z' };
    rows.push({ id: `a-${seed}-${String(i).padStart(3, '0')}`, user_id: userId, subject, score: result.score, correct: result.correct, wrong: result.wrong, unattempted: result.unattempted, total: result.total,
      details: result.details, questions_snapshot: questions, completed_at: completed.toISOString(), selection_meta: meta });
  }
  return rows;
}

const migration = (name) => readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), 'utf8');

/** PGlite with the attempts table, the existing summary function and the lean function, loaded from the real migrations. */
export async function leanDatabase(rows) {
  const pg = new PGlite();
  await pg.exec(`create role anon; create role authenticated; create role service_role;
    create table public.attempts(id text primary key, user_id text, subject text, score integer, correct integer, wrong integer, unattempted integer, total integer, details jsonb, questions_snapshot jsonb, completed_at timestamptz, selection_meta jsonb);`);
  await pg.exec(migration('20261018230100_attempts_list_summary_fn.sql'));
  await pg.exec(migration('20261020150000_attempts_lean_fn.sql'));
  for (const r of rows) {
    await pg.query('insert into public.attempts values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [r.id, r.user_id, r.subject, r.score, r.correct, r.wrong, r.unattempted, r.total, JSON.stringify(r.details), JSON.stringify(r.questions_snapshot), r.completed_at, JSON.stringify(r.selection_meta)]);
  }
  return pg;
}

const wire = (row) => ({ ...row, completed_at: row.completed_at instanceof Date ? row.completed_at.toISOString() : row.completed_at });

/** What PostgREST returns for the function: the rows, in the function's own order, timestamps as strings. */
export async function callFunction(pg, fn, args) {
  const names = Object.keys(args);
  const { rows } = await pg.query(`select * from public.${fn}(${names.map((_, i) => `$${i + 1}`).join(',')})`, names.map((n) => args[n]));
  return rows.map(wire);
}

/** The table rows as PostgREST returns them (newest first), the "before" of every parity test. */
export async function tableRows(pg, userId) {
  const { rows } = await pg.query('select * from public.attempts where user_id = $1 order by completed_at desc, id', [userId]);
  return rows.map(wire);
}

/** A supabase-shaped client over PGlite: from('attempts') (the table) and rpc(fn, args).order().order().range(). Counts calls. */
export function pgSupabase(pg, { failFn = {} } = {}) {
  const calls = [];
  return {
    calls,
    from(name) {
      const state = { select: '*', user: null, range: null };
      const q = {
        select(c) { state.select = c; return q; },
        eq(_c, v) { state.user = v; return q; },
        order() { return q; },
        range(a, b) { state.range = [a, b]; return q; },
        then(resolve, reject) {
          return (async () => {
            const { rows } = await pg.query(`select ${state.select} from public.${name} where user_id = $1 order by completed_at desc, id`, [state.user]);
            const data = rows.map(wire).slice(state.range[0], state.range[1] + 1);
            calls.push({ kind: 'table', select: state.select, rows: data.length, bytes: JSON.stringify(data).length });
            return { data, error: null };
          })().then(resolve, reject);
        },
      };
      return q;
    },
    rpc(fn, args) {
      const state = { range: [0, 999], ids: null };
      const q = {
        order() { return q; },
        in(_column, ids) { state.ids = ids; return q; },
        range(a, b) { state.range = [a, b]; return q; },
        then(resolve, reject) {
          return (async () => {
            if (failFn[fn]) { calls.push({ kind: 'rpc', fn, args, error: failFn[fn].code }); return { data: null, error: failFn[fn] }; }
            let all = await callFunction(pg, fn, args);
            if (state.ids) all = all.filter((r) => state.ids.includes(r.id));
            const data = all.slice(state.range[0], state.range[1] + 1);
            calls.push({ kind: 'rpc', fn, args, rows: data.length, bytes: JSON.stringify(data).length });
            return { data, error: null };
          })().then(resolve, reject);
        },
      };
      return q;
    },
  };
}

/**
 * A client for src/lib/server/review.js over PGlite: the attempts reads Review makes (the slim list, the heavy ids read) run as
 * SQL on the real table; every other table is empty. `withRpc: false` is a database where no function is applied.
 */
export function reviewDb(pg, { withRpc = true, failFn = {} } = {}) {
  const base = pgSupabase(pg, { failFn });
  const calls = base.calls;
  const empty = () => { const b = { select: () => b, eq: () => b, in: () => b, not: () => b, order: () => b, limit: () => b, range: () => b, then: (res, rej) => Promise.resolve({ data: [], error: null }).then(res, rej) }; return b; };
  const db = {
    calls,
    from(table) {
      if (table !== 'attempts') return empty();
      const state = { select: '', user: null, ids: null };
      const q = {
        select(c) { state.select = c; return q; },
        eq(_c, v) { state.user = v; return q; },
        in(_c, ids) { state.ids = ids; return q; },
        order() { return q; },
        range() { return q; },
        then(resolve, reject) {
          return (async () => {
            const slimList = state.select.includes('mode:selection_meta');
            const sql = slimList
              ? `select id, subject, correct, wrong, unattempted, total, completed_at, selection_meta->>'mode' as mode, selection_meta->'mobPaper' as "mobPaper" from public.attempts where user_id = $1 order by completed_at desc, id limit 1000`
              : 'select id, details, questions_snapshot from public.attempts where user_id = $1 and id = any ($2) order by completed_at desc, id';
            const { rows } = await pg.query(sql, slimList ? [state.user] : [state.user, state.ids]);
            const data = rows.map(wire);
            calls.push({ kind: 'table', select: state.select, rows: data.length, bytes: JSON.stringify(data).length });
            return { data, error: null };
          })().then(resolve, reject);
        },
      };
      return q;
    },
  };
  if (withRpc) db.rpc = base.rpc.bind(base);
  return db;
}
