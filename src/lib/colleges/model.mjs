// My colleges: the one ordered list a student keeps, shared by Today's ladder, the Compass college
// rows and the Account page, and by the app (data/tests/fixtures/colleges/contract_colleges_v1.json is
// the contract). Pure rules only: the route validates with these and the pages read the list with them.
// An entry is a college in a programme: { programmeId, programme, college }. programmeId is the DU
// catalog id, college is the name as the offerings file spells it, programme is the name to show.

export const MAX_COLLEGES = 8;
export const LADDER_SIZE = 3;
export const COLLEGES_PATH = '/api/me/colleges';

const ID = /^[a-z0-9][a-z0-9-]{0,119}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/** The same college in the same programme, as one string. */
export const entryKey = (e) => `${e.programmeId}::${e.college}`;

/** One entry made safe, or null when it cannot be one. Extra fields are dropped. */
export function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const programmeId = typeof raw.programmeId === 'string' ? raw.programmeId.trim() : '';
  const college = clean(raw.college);
  const programme = raw.programme == null ? '' : clean(raw.programme);
  if (!ID.test(programmeId)) return null;
  if (college.length < 2 || college.length > 160 || CONTROL.test(college)) return null;
  if (programme.length > 160 || CONTROL.test(programme)) return null;
  return { programmeId, programme, college };
}

const bad = (message) => ({ ok: false, message });

/** A whole ordered list from a PUT body: { colleges: [...] }. At most 8, no repeats, every entry valid. */
export function parseList(body) {
  const rows = body && typeof body === 'object' ? body.colleges : null;
  if (!Array.isArray(rows)) return bad('Send your colleges as a list.');
  if (rows.length > MAX_COLLEGES) return bad(`Keep up to ${MAX_COLLEGES} colleges.`);
  const list = [];
  const seen = new Set();
  for (const raw of rows) {
    const entry = normalizeEntry(raw);
    if (!entry) return bad('One of the colleges is missing its programme or name.');
    const key = entryKey(entry);
    if (seen.has(key)) return bad('A college can be on the list once for each programme.');
    seen.add(key);
    list.push(entry);
  }
  return { ok: true, list };
}

/** One entry from a POST body or a DELETE query. */
export function parseEntry(raw) {
  const entry = normalizeEntry(raw);
  return entry ? { ok: true, entry } : bad('Send the programme and the college.');
}

/** The response every route sends: positions from 1, the count and the cap. */
export function listBody(rows) {
  const colleges = (rows || []).slice(0, MAX_COLLEGES).map((r, i) => ({
    position: i + 1,
    programmeId: r.programmeId,
    programme: r.programme || '',
    college: r.college,
    addedAt: r.addedAt || null,
  }));
  return { colleges, count: colleges.length, max: MAX_COLLEGES };
}

/** The rows a DB read returns, in the route's shape. */
export const fromRows = (rows) => (rows || []).map((r) => ({
  programmeId: r.programme_id,
  programme: r.programme,
  college: r.college,
  addedAt: r.added_at ? new Date(r.added_at).toISOString() : null,
}));

/** The list as the page reads it: the first `size` entries and how many more there are. */
export function ladderView(colleges, size = LADDER_SIZE) {
  const all = Array.isArray(colleges) ? colleges : [];
  return { shown: all.slice(0, size), more: Math.max(0, all.length - size), total: all.length };
}

export const hasEntry = (colleges, entry) => !!entry && (colleges || []).some((c) => entryKey(c) === entryKey(entry));

// ---- the list changed in the page, before the server confirms ----------------------------------------------------

const renumber = (list) => list.map((c, i) => ({ ...c, position: i + 1 }));

export function withAdded(colleges, entry) {
  const list = colleges || [];
  if (hasEntry(list, entry) || list.length >= MAX_COLLEGES) return list;
  return renumber([...list, entry]);
}
export const withRemoved = (colleges, entry) => renumber((colleges || []).filter((c) => entryKey(c) !== entryKey(entry)));
export function withMoved(colleges, from, to) {
  const list = [...(colleges || [])];
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return colleges || list;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  return renumber(list);
}

/** The server's answer, if it is a list body; otherwise null. */
export function fromServer(body) {
  if (!body || !Array.isArray(body.colleges)) return null;
  const colleges = [];
  for (const raw of body.colleges) {
    const entry = normalizeEntry(raw);
    if (!entry) return null;
    colleges.push({ ...entry, position: colleges.length + 1, addedAt: raw.addedAt || null });
  }
  return colleges;
}

// ---- words ------------------------------------------------------------------------------------------------------

export const countLine = (n) => `${n} of ${MAX_COLLEGES} colleges`;
export const moreLine = (n) => `${n} more on My colleges`;
export const FULL_LINE = `My colleges is full at ${MAX_COLLEGES}. Remove one to add another.`;
export const EMPTY_LINE = 'No colleges yet. Add one from Admission Compass and it shows here and in the app.';
export function errorLine(error) {
  if (error?.status === 409) return FULL_LINE;
  if (error?.kind === 'network') return 'Could not reach MockMob. Check your connection and try again.';
  return 'Could not save your colleges just now. Try again.';
}
