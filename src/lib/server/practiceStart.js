// L8 (15 Nov 2026): the first start of a device-held practice session, kept on the server so starting the same session again
// (same student, generation key and selection, so the same id) gets its original clock and paper, never a new paper or a new
// hour. A network retry with the same key still gets its session: that is what the key is for.
//
// No migration: one learning_allowances row per session (kind 'practice_start', period = the session id, reference
// 'v1:<first start ms>:<paper hash>'), the table's primary key is the lock, as the first free full mock already does
// (firstFullMock.js). Takes the Supabase client, so data/tests/practice_start.test.mjs runs it on the in-memory client.
import { createHash } from 'node:crypto';

export const PRACTICE_START_KIND = 'practice_start';
const UNIQUE_VIOLATION = '23505';
const failed = (cause) => Object.assign(new Error('SESSION_CREATE_FAILED'), { cause });
const settle = (query) => Promise.resolve(query).catch((error) => ({ error }));

/** The paper's fingerprint: its question ids in served order. */
export const paperOf = (questions) => createHash('sha256').update((questions || []).map((q) => String(q?.id ?? '')).join('\n')).digest('hex').slice(0, 32);

function parse(reference) {
  const m = /^v1:(\d{1,16}):([0-9a-f]{32})$/.exec(String(reference || ''));
  return m ? { at: Number(m[1]), paper: m[2] } : null;
}

/**
 * Records this start unless the session has one: { at, paper, inserted }. `at` and `paper` are the first start's.
 * Throws SESSION_CREATE_FAILED when the row can be neither written nor read (nothing is charged; the student can try again).
 */
export async function claimPracticeStart(db, { userId, id, at, paper }) {
  const row = { user_id: userId, kind: PRACTICE_START_KIND, period: String(id), reference: `v1:${Math.trunc(at)}:${paper}` };
  const inserted = await settle(db.from('learning_allowances').insert(row));
  if (!inserted?.error) return { at: Math.trunc(at), paper, inserted: true };
  if (String(inserted.error.code) !== UNIQUE_VIOLATION) throw failed(inserted.error);
  const held = await settle(db.from('learning_allowances').select('reference').eq('user_id', userId).eq('kind', PRACTICE_START_KIND).eq('period', String(id)).maybeSingle());
  const first = held?.error ? null : parse(held?.data?.reference);
  if (!first) throw failed(held?.error || new Error('practice_start_unreadable'));
  return { ...first, inserted: false };
}

/** Removes the record this start made, when the start then failed (a refused charge): a later start is a first start. */
// Best effort: a record left behind only means a later start keeps this start's clock.
export async function releasePracticeStart(db, { userId, id }) {
  try {
    await settle(db.from('learning_allowances').delete().eq('user_id', userId).eq('kind', PRACTICE_START_KIND).eq('period', String(id)));
  } catch { /* the original error is what the student needs to see */ }
}
