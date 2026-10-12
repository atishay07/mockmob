// Guest sample import. Validation and scoring are PURE; saving goes through the
// save_sample_import SQL function (supabase/migrations/20261013093000_sample_imports.sql).
//
// This never creates an attempt, session, credit movement, rhythm activity or mock. It only
// stores the guest's five landing-page answers so the app can say "Saved to your account".

export const SAMPLE_VERSION = 'landing-v1';

// SOURCE: src/components/landing/DemoDrill.jsx, the DRILL array (five questions, lines 12-58).
// DemoDrill has no stable ids, so ids are q1..q5 in array order and keys are A..D by option
// index (the same KEYS the component uses). correctKey is the key of DRILL[i].correct.
// If DemoDrill's questions change order or content, bump SAMPLE_VERSION and update this list.
export const SAMPLE_QUESTIONS = [
  { id: 'q1', subject: 'English', correctKey: 'B' },
  { id: 'q2', subject: 'Accountancy', correctKey: 'B' },
  { id: 'q3', subject: 'Economics', correctKey: 'C' },
  { id: 'q4', subject: 'Accountancy', correctKey: 'C' },
  { id: 'q5', subject: 'Business Studies', correctKey: 'B' },
];
const OPTION_KEYS = ['A', 'B', 'C', 'D'];
const KEY_RE = /^[A-Za-z0-9_-]{12,100}$/;

/** Returns { ok:true, value } or { ok:false, error, message }. */
export function validateSampleImport(body) {
  const bad = message => ({ ok: false, error: 'invalid_request', message });
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bad('Send a JSON body.');
  const { importKey, sampleVersion, subject, answers } = body;
  if (typeof importKey !== 'string' || !KEY_RE.test(importKey)) return bad('importKey must be 12 to 100 letters, digits, dash or underscore.');
  if (sampleVersion !== SAMPLE_VERSION) return { ok: false, error: 'unknown_sample_version', message: 'This sample version is not recognised.' };
  if (typeof subject !== 'string' || !subject.trim() || subject.trim().length > 60) return bad('subject is required (up to 60 characters).');
  if (!Array.isArray(answers) || answers.length !== SAMPLE_QUESTIONS.length) return bad(`answers must hold exactly ${SAMPLE_QUESTIONS.length} items.`);
  const byId = new Map(SAMPLE_QUESTIONS.map(q => [q.id, q]));
  const seen = new Set();
  const clean = [];
  let correct = 0;
  for (const a of answers) {
    const id = a?.sampleQuestionId;
    const q = typeof id === 'string' ? byId.get(id) : undefined;
    if (!q) return bad('Unknown sampleQuestionId.');
    if (seen.has(id)) return bad('Each sample question can be answered once.');
    if (typeof a.optionKey !== 'string' || !OPTION_KEYS.includes(a.optionKey)) return bad('optionKey must be A, B, C or D.');
    seen.add(id);
    if (a.optionKey === q.correctKey) correct += 1;
    clean.push({ sampleQuestionId: id, optionKey: a.optionKey });
  }
  return { ok: true, value: { importKey, sampleVersion, subject: subject.trim(), answers: clean, correct, total: SAMPLE_QUESTIONS.length } };
}

/** Saves once per user. `db` is a Supabase-style client (rpc); the route passes supabaseAdmin(). */
export async function saveSampleImport(db, userId, value) {
  const { data, error } = await db.rpc('save_sample_import', {
    p_user_id: userId, p_import_key: value.importKey, p_sample_version: value.sampleVersion,
    p_subject: value.subject, p_answers: value.answers, p_correct: value.correct, p_total: value.total,
  });
  if (error) {
    if (/import_key_taken/.test(error.message || '')) throw Object.assign(new Error('KEY_TAKEN'), { code: 'KEY_TAKEN' });
    throw Object.assign(new Error('SAMPLE_UNAVAILABLE'), { cause: error });
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { status: 'saved', savedAt: new Date(row.created_at).toISOString(), correct: Number(row.correct), total: Number(row.total) };
}
