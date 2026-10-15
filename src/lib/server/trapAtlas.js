// Server reads and writes for the trap atlas (data/trap_atlas.js; spec tmp/mistake-lab-v4/SPEC.md 4.7, 4.11).
// No 'server-only' on purpose, so node:test can load it with a fake client; it imports the Supabase client lazily.
//   readAtlas     the atlas rows for a set of questions, read in small batches
//   recordTrap    fills the atlas from one committed v3 repair (the record_trap_atlas function: atomic, idempotent
//                 per call, never throws into the repair: a failure is only a log line)
// Rows are aggregates about a question's option: no user id is in the table.
import { indexAtlas } from '../../../data/trap_atlas.js';

const BATCH = 120; // question ids per read; keeps the request URL short
const MAX_QUESTIONS = 3000;

/** A missing table or function (a database where the migration has not run) is "no atlas", not an error. */
export const atlasMissing = (error) => /trap_atlas|record_trap_atlas|schema cache|does not exist|PGRST20[25]|42P01|42883/i.test(`${error?.code || ''} ${error?.message || ''}`);

/** trap_atlas rows for these question ids ([] when the table is not there yet). Throws on any other failure. */
export async function readAtlasRows(qids, { db } = {}) {
  const ids = [...new Set((qids || []).filter((q) => typeof q === 'string' && q))].slice(0, MAX_QUESTIONS);
  if (!ids.length) return [];
  const client = db || (await import('../supabase')).supabaseAdmin();
  const batches = [];
  for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));
  const out = [];
  for (let i = 0; i < batches.length; i += 4) {
    const results = await Promise.all(batches.slice(i, i + 4).map((part) => client.from('trap_atlas')
      .select('qid,option_hash,trap_type,repairs_agreeing,repairs_disagreeing,source').in('qid', part)));
    for (const r of results) {
      if (r.error) { if (atlasMissing(r.error)) return []; throw Object.assign(new Error('ATLAS_UNAVAILABLE'), { cause: r.error }); }
      out.push(...(r.data || []));
    }
  }
  return out;
}

/** indexAtlas over the rows of the questions of one paper. */
export async function atlasForAttempt(attempt, opts) {
  const qids = (attempt?.questionsSnapshot || []).map((q) => q?.id);
  return indexAtlas(await readAtlasRows(qids, opts));
}

/** indexAtlas over the rows of every question the student has answered. */
export async function atlasForAttempts(attempts, opts) {
  const qids = [];
  for (const a of attempts || []) for (const q of a?.questionsSnapshot || []) qids.push(q?.id);
  return indexAtlas(await readAtlasRows(qids, opts));
}

/**
 * Fill the atlas from one committed v3 repair: record = { qid, optionHash, trapType } (data/trap_atlas.js atlasRecordFor).
 * Returns { ok, row? }. Never throws.
 */
export async function recordTrap(record, { db } = {}) {
  if (!record?.qid || !record?.optionHash || !record?.trapType) return { ok: false, reason: 'no_record' };
  try {
    const client = db || (await import('../supabase')).supabaseAdmin();
    const { data, error } = await client.rpc('record_trap_atlas', { p_qid: record.qid, p_option_hash: record.optionHash, p_trap_type: record.trapType });
    if (error) return { ok: false, reason: atlasMissing(error) ? 'missing' : 'failed' };
    return { ok: true, row: data ?? null };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
