// Slim, paged list of a student's own attempts for the app (module B4).
// Reads only the columns it needs: never details, answer keys or question snapshots.

export const MARKS_PER_CORRECT = 5;
export const MARKS_PER_WRONG = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

const slug = v => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/**
 * Stable format id for comparing like with like. Formula:
 *   `${mode}:${subject}:q${total}:${scoringVersion}`
 * every part lower-cased and reduced to [a-z0-9_]. mode comes from selection_meta.mode
 * ('unknown' if absent), total is the question count, scoringVersion comes from
 * selection_meta.scoringVersion ('historical_device' if absent, as in /api/recovery).
 * Accepts a raw DB row (selection_meta), an attemptOut object (selectionMeta) or a summary
 * query row (flat `mode` / `scoringVersion` aliases). Time and score never enter it.
 */
export function formatIdFor(row) {
  const r = row || {};
  const meta = r.selection_meta || r.selectionMeta || {};
  const mode = slug(r.mode ?? meta.mode) || 'unknown';
  const subject = slug(r.subject) || 'unknown';
  const total = Math.max(0, Math.trunc(Number(r.total) || 0));
  const sv = slug(r.scoringVersion ?? meta.scoringVersion) || 'historical_device';
  return `${mode}:${subject}:q${total}:${sv}`;
}

export function summaryItem(row) {
  const correct = Number(row.correct) || 0;
  const wrong = Number(row.wrong) || 0;
  const total = Number(row.total) || 0;
  return {
    id: row.id,
    subject: row.subject,
    mode: slug(row.mode) || null,
    correct,
    wrong,
    unattempted: Number(row.unattempted) || 0,
    total,
    marks: correct * MARKS_PER_CORRECT - wrong * MARKS_PER_WRONG,
    maxMarks: total * MARKS_PER_CORRECT,
    completedAt: new Date(row.completed_at).getTime(),
    formatId: formatIdFor(row),
  };
}

export function parseLimit(raw) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
const ID = /^[A-Za-z0-9_-]{1,128}$/;

// Opaque cursor: base64url of JSON [completed_at exactly as stored, id].
export function encodeCursor(completedAt, id) {
  return Buffer.from(JSON.stringify([completedAt, id]), 'utf8').toString('base64url');
}

// null = no cursor, undefined = invalid cursor.
export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const [at, id] = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
    if (typeof at !== 'string' || typeof id !== 'string' || !ISO.test(at) || !ID.test(id)) return undefined;
    return { at, id };
  } catch { return undefined; }
}

/**
 * Newest first; ties on completed_at break by id ascending (same as Database.getAttempts).
 * db is a supabase client. Returns {items, nextCursor} or {error:'bad_cursor'}.
 */
export async function listAttemptSummaries(db, userId, { cursor, limit } = {}) {
  if (!userId) throw new Error('attempt_owner_required');
  const pageSize = parseLimit(limit);
  const c = decodeCursor(cursor);
  if (c === undefined) return { error: 'bad_cursor' };
  let q = db.from('attempts')
    .select('id,subject,correct,wrong,unattempted,total,completed_at,mode:selection_meta->>mode,scoringVersion:selection_meta->>scoringVersion')
    .eq('user_id', userId);
  if (c) q = q.or(`completed_at.lt."${c.at}",and(completed_at.eq."${c.at}",id.gt."${c.id}")`);
  const { data, error } = await q
    .order('completed_at', { ascending: false }).order('id', { ascending: true })
    .limit(pageSize + 1);
  if (error) throw error;
  const rows = data || [];
  const page = rows.slice(0, pageSize);
  const last = page[page.length - 1];
  return {
    items: page.map(summaryItem),
    nextCursor: rows.length > pageSize && last ? encodeCursor(last.completed_at, last.id) : null,
  };
}
