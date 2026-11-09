// The sample's result, carried into sign-up (10 Nov 2026 conversion pass). Plain module (browser and node tests).
//
// A guest who finishes the home page's five questions is told their score and the chapters they missed, then offered
// "Sign up free". Before this, /signup greeted them like anyone else and the result was gone: the promise on the card
// ("Sign up free, then choose chapters like this one in Practice.") did not survive the click. Now the card leaves a
// small note in this browser's own storage, and /signup opens on it: the score in the headline, the missed chapters in
// the sentence under it.
//
// What is kept: the score, the subject's name (a live subject set only) and the missed chapters' names. Nothing else,
// and nothing leaves the device: no request carries it, and the server never sees it. It is read again and checked on
// every use, it expires after a day, and /signup clears it once the account exists.

const STORAGE_KEY = 'mm:sample-result:v1';
/** A day: long enough for an email code or a Google round trip later the same evening, short enough to stay true. */
export const SAMPLE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const TOTAL = 5;
const MAX_CHAPTERS = 5;
const MAX_TEXT = 80;

const clean = (value) => (typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT) : '');

function storage(store) {
  if (store) return store;
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * The note for a finished sample, or null when the numbers do not describe one: `score` right of five, `subject` the
 * live subject's name (null for the card's own mixed five), `misses` the card's missed questions (each with `chapter`).
 * Chapters are named once each, in the order they were missed.
 */
export function packSample({ score, subject = null, misses = [] } = {}, now = Date.now()) {
  const right = Math.trunc(Number(score));
  if (!Number.isInteger(right) || right < 0 || right > TOTAL) return null;
  const chapters = [];
  for (const miss of Array.isArray(misses) ? misses : []) {
    const name = clean(miss?.chapter);
    if (name && !chapters.includes(name)) chapters.push(name);
    if (chapters.length >= MAX_CHAPTERS) break;
  }
  // A score below five missed something; a five missed nothing. A note that says otherwise is not a finished sample.
  if (right === TOTAL && chapters.length > 0) return null;
  return { score: right, total: TOTAL, subject: clean(subject) || null, chapters, at: now };
}

/** Saves a finished sample's note. Returns the note, or null when it could not be kept (the page works without it). */
export function saveSample(result, { store, now = Date.now() } = {}) {
  const target = storage(store);
  const note = packSample(result, now);
  if (!target || !note) return null;
  try {
    target.setItem(STORAGE_KEY, JSON.stringify(note));
    return note;
  } catch {
    return null; // storage full or blocked: sign-up greets the visitor the usual way
  }
}

/** The saved note, checked again, or null (none, expired, from the future, or not a finished sample). */
export function readSample({ store, now = Date.now() } = {}) {
  const target = storage(store);
  if (!target) return null;
  let saved = null;
  try {
    saved = JSON.parse(target.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
  if (!saved || typeof saved.at !== 'number' || now - saved.at > SAMPLE_MAX_AGE_MS || now < saved.at - 60_000) return null;
  const note = packSample({ score: saved.score, subject: saved.subject, misses: (Array.isArray(saved.chapters) ? saved.chapters : []).map((chapter) => ({ chapter })) }, saved.at);
  // A stored note that names no chapter for a score below five was tampered with or cut short: say nothing from it.
  if (!note || (note.score < TOTAL && note.chapters.length === 0)) return null;
  return note;
}

/** Forgets the note (the account exists now, or the student asked to start over). */
export function clearSample({ store } = {}) {
  try {
    storage(store)?.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to forget */
  }
}

/** The raw stored text, for a store subscription's snapshot (a string compares by value, so the snapshot is stable). */
export function rawSample({ store } = {}) {
  try {
    return storage(store)?.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

const named = (chapters) => (chapters.length === 1 ? chapters[0] : `${chapters[0]} and ${chapters[1]}`);

/**
 * /signup's headline and sentence for a visitor who has just finished the sample, or null for anyone else.
 *   five of five   the card asked "Ready for 50 of these in 60 minutes?": the page answers with the full mock.
 *   two to four    the score, then the card's own next step with the chapters named (at most two; "like" covers the rest).
 *   none or one    no score in the headline (the card said "Tough five. Here’s where to start."), the same next step.
 * The next step is the card's own promise, word for word but for the names: sign up, then choose chapters in Practice,
 * which is where the first run ends (src/app/onboarding/firstRun.js DONE_PATH). No marks are promised.
 */
export function signupWords(note) {
  if (!note) return null;
  if (note.score >= note.total) {
    return {
      // The second sentence holds together, so where the headline wraps it wraps between the sentences.
      title: 'All five right. Now a full mock.',
      lead: 'Sign up free to sit 50 questions in 60 minutes, marked +5 / −1, the way CUET marks it.',
    };
  }
  if (!Array.isArray(note.chapters) || note.chapters.length === 0) return null;
  const lead = `Sign up free, then choose chapters like ${named(note.chapters)} in Practice.`;
  if (note.score <= 1) return { title: 'Your five are done. Here’s where to start.', lead };
  return { title: `You got ${note.score} of 5. Keep going.`, lead };
}
