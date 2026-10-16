// The sample contract shared by the hero and the dock (useSampleState.js reads it):
//   localStorage "mm:sample:v1" = {"answered":n,"done":bool,"subject":"<id>","at":"ISO"[,"focus":"<chapter>"]}
//   focus: the finished run's one next move, the chapter with the most misses (absent when nothing was missed).
//   window event "mm:sample-progress" after any answer, "mm:sample-done" when a run of five is finished.
// A finished sample stays finished: a second run (another subject) keeps done true and never lowers the count,
// so the dock never steps back from "sign up" to "try a question". Storage can be blocked (private mode, a
// thumbnail capture): every access is wrapped and the event still carries the record as its detail.
export const SAMPLE_RECORD_KEY = 'mm:sample:v1';

export function nextRecord(previous, { answered, done, subject, at, focus }) {
  const wasDone = Boolean(previous && previous.done === true);
  const before = previous && Number.isFinite(Number(previous.answered)) ? Number(previous.answered) : 0;
  // A finished run names its own next move; a run still under way keeps the last finished one's.
  const kept = done ? focus : wasDone && typeof previous.focus === 'string' ? previous.focus : null;
  return {
    answered: wasDone ? Math.max(answered, before) : answered,
    done: Boolean(done) || wasDone,
    subject,
    at,
    ...(typeof kept === 'string' && kept ? { focus: kept } : {}),
  };
}

function readStored(storage) {
  try {
    const raw = storage?.getItem(SAMPLE_RECORD_KEY);
    const value = raw ? JSON.parse(raw) : null;
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

/** Writes the record and announces it. Returns the record written (or announced, when storage is blocked). */
export function recordSample({ answered, done, subject, focus }, env = typeof window === 'undefined' ? null : window) {
  if (!env) return null;
  let storage = null;
  try { storage = env.localStorage; } catch { storage = null; }
  const record = nextRecord(readStored(storage), { answered, done, subject, focus, at: new Date().toISOString() });
  try { storage?.setItem(SAMPLE_RECORD_KEY, JSON.stringify(record)); } catch { /* blocked storage: the event still tells the page */ }
  try {
    env.dispatchEvent(new env.CustomEvent(done ? 'mm:sample-done' : 'mm:sample-progress', { detail: record }));
  } catch { /* no event support: nothing else to do */ }
  return record;
}
