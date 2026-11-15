// The sample's result, carried into sign-up (10 Nov 2026 conversion pass). Plain module (browser and node tests).
//
// A guest who finishes the home page's five questions is told their score and the chapters they missed, then offered
// "Sign up free". Before this, /signup greeted them like anyone else and the result was gone: the promise on the card
// ("Sign up free, then choose chapters like this one in Practice.") did not survive the click. Now the card leaves a
// small note in this browser's own storage, and /signup opens on it: the score in the headline, the missed chapters in
// the sentence under it.
//
// 15 Nov 2026 (F3, O2): the note travels on into the first run. Onboarding puts the sampled subject first (or ticks it, when it is
// not one of the Commerce four), the first run's last key opens a first set in it, and Practice preselects the missed chapters
// that name a chapter of the bank (sampleChapters; the card's own five through BUILT_IN_CHAPTERS, a live set through the
// syllabus resolver Practice passes in). When unsure, no chapter.
//
// What is kept: the score, the subject's name and its page slug (a live subject set only) and the missed chapters' names.
// Nothing else. Where and how long: in this browser's localStorage only, under one key, for at most 24 hours (SAMPLE_MAX_AGE_MS;
// an older note is never read). It is deleted sooner when the first run ends: by onboarding as its last key opens the first set,
// or by Practice once it has preselected the chapters for a student with no finished set (or finds the student already has
// one). It never leaves the browser: no request carries it, and the server never sees it. What the student then saves (the
// subjects they keep ticked) is their own choice, sent like any other. It is read again and checked on every use.
import { DEMO_SUBJECTS } from '../../lib/demoSample.mjs';

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

const BY_SLUG = new Map(DEMO_SUBJECTS.map((s) => [s.slug, s]));
const BY_NAME = new Map(DEMO_SUBJECTS.map((s) => [s.name, s]));

/**
 * The note for a finished sample, or null when the numbers do not describe one: `score` right of five, `subject` the
 * live subject's name and `slug` its page slug (both null for the card's own mixed five), `misses` the card's missed
 * questions (each with `chapter`). Chapters are named once each, in the order they were missed. A slug the sample card does
 * not offer is dropped; a note with a known name and no slug (saved before 15 Nov 2026) is given the name's slug.
 */
export function packSample({ score, subject = null, slug = null, misses = [] } = {}, now = Date.now()) {
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
  const name = clean(subject) || null;
  const known = BY_SLUG.get(clean(slug)) || (name ? BY_NAME.get(name) : null) || null;
  return { score: right, total: TOTAL, subject: name, slug: known ? known.slug : null, chapters, at: now };
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
  const note = packSample({ score: saved.score, subject: saved.subject, slug: saved.slug, misses: (Array.isArray(saved.chapters) ? saved.chapters : []).map((chapter) => ({ chapter })) }, saved.at);
  // A stored note that names no chapter for a score below five was tampered with or cut short: say nothing from it.
  if (!note || (note.score < TOTAL && note.chapters.length === 0)) return null;
  return note;
}

/** Forgets the note (the first run has ended, or the student asked to start over). */
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
 * The next step is the card's own promise, word for word but for the names: sign up, then choose chapters in Practice
 * (where Practice preselects the ones that name a bank chapter, sampleChapters below). No marks are promised.
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

// ---------------------------------------------------------------------------------------------------------------------
// Into the first run (15 Nov 2026, F3 and O2).

/**
 * The card's own five (DemoDrill.jsx DRILL), each missed chapter's subject and the bank chapter it is, by the card's label. The
 * card's labels are its own words, not the bank's ("Partnership: admission of a partner" is the bank's "Admission of Partner"),
 * so each is mapped by hand and held by a test against the syllabus (data/cuet_syllabus.js resolveChapter). `chapter: null` where
 * no CUET chapter fits cleanly: the accounting equation is Class 11, not in the CUET Accountancy syllabus, so that miss names a
 * subject and no chapter.
 */
export const BUILT_IN_CHAPTERS = Object.freeze({
  'Vocabulary: synonyms': Object.freeze({ subject: 'english', chapter: 'Vocabulary' }),
  'Accounting equation': Object.freeze({ subject: 'accountancy', chapter: null }),
  'Money and banking': Object.freeze({ subject: 'economics', chapter: 'Money & Banking' }),
  'Partnership: admission of a partner': Object.freeze({ subject: 'accountancy', chapter: 'Admission of Partner' }),
  Controlling: Object.freeze({ subject: 'business_studies', chapter: 'Controlling' }),
});

/** A subject page slug ("business-studies") as the app's subject id ("business_studies"), or null for one the card does not offer. */
export function subjectIdForSlug(slug) {
  const known = BY_SLUG.get(clean(slug));
  return known ? known.slug.replace(/-/g, '_') : null;
}

/**
 * The subject the sample points at, as the app's subject id, or null. A live set: its own subject. The card's own five (a mix):
 * the subject of the first missed question, in the order they were missed (five of five names none).
 */
export function sampleSubject(note) {
  if (!note) return null;
  if (note.slug) return subjectIdForSlug(note.slug);
  for (const label of Array.isArray(note.chapters) ? note.chapters : []) {
    const hit = BUILT_IN_CHAPTERS[label];
    if (hit) return hit.subject;
  }
  return null;
}

/**
 * The missed chapters as the bank names them, for one subject, in the order they were missed: only names that map cleanly, so
 * Practice never preselects a chapter it would have to guess. The card's own five use BUILT_IN_CHAPTERS; a live set's labels go
 * through `resolve(label)` (Practice passes the syllabus resolver: the bank chapter's name, or null when it is not one).
 */
export function sampleChapters(note, subjectId, { resolve = () => null } = {}) {
  if (!note || !subjectId || sampleSubject(note) !== subjectId) return [];
  const out = [];
  for (const label of Array.isArray(note.chapters) ? note.chapters : []) {
    let name = null;
    if (note.slug) {
      try { name = resolve(label) || null; } catch { name = null; }
    } else {
      const hit = BUILT_IN_CHAPTERS[label];
      name = hit && hit.subject === subjectId ? hit.chapter : null;
    }
    if (typeof name === 'string' && name && !out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * How the first subjects step uses the sample (onboarding): `first` when the subject is one of the Commerce four (it is put first
 * in the ticked set), `grid` when it is another subject MockMob can practise (the preset steps aside and the grid opens with it
 * ticked, under "From your sample: Physics"), null when there is nothing to use.
 */
export function samplePlan(subject, { preset = [], available = [] } = {}) {
  if (!subject || !available.includes(subject)) return null;
  return { subject, mode: preset.includes(subject) ? 'first' : 'grid' };
}

/** A list with the sampled subject moved to the front, when it is in the list; otherwise the list as it was. */
export function sampleFirst(list = [], subject = null) {
  const items = Array.isArray(list) ? [...list] : [];
  if (!subject || !items.includes(subject)) return items;
  return [subject, ...items.filter((id) => id !== subject)];
}

/** The line over the grid when the sample opened it: "From your sample: Physics". */
export const sampleLine = (name) => `From your sample: ${String(name || '').trim()}`;
