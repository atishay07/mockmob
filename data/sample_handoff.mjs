// The landing sample hands its answers to the new account (web IA plan section 3, steps 2 and 4).
//
// The landing (IA4) writes the five answers to sessionStorage under SAMPLE_HANDOFF_KEY when the
// guest finishes the sample. After sign-up, onboarding (IA3) posts them once to
// /api/me/sample-import, silently: it is not a mock and uses no credits. A 409 (key already used)
// counts as done. The import runs once, even after a reload, because the stored record is marked
// imported before the page can post it again.
//
// Pure: storage is injected and every read and write is wrapped, so a private window, blocked
// storage or a corrupt value never breaks a page. No personal data is stored: the subject name and
// five option letters only.

export const SAMPLE_HANDOFF_KEY = 'mm:sample:v1';
// Must equal SAMPLE_VERSION in src/lib/server/sampleImport.js (a test keeps them in step).
export const SAMPLE_VERSION = 'landing-v1';
export const SAMPLE_IMPORT_PATH = '/api/me/sample-import';
export const SAMPLE_QUESTION_IDS = Object.freeze(['q1', 'q2', 'q3', 'q4', 'q5']);
/** A handoff older than this is ignored (a guest who comes back next week starts afresh). */
export const SAMPLE_HANDOFF_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const KEY_RE = /^[A-Za-z0-9_-]{12,100}$/;
const OPTION_KEYS = new Set(['A', 'B', 'C', 'D']);
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** A fresh import key (the server accepts 12 to 100 of [A-Za-z0-9_-]). `random` returns 0..1. */
export function newImportKey(random = null) {
  const pick = () => {
    if (random) return Math.floor(random() * ALPHABET.length) % ALPHABET.length;
    const c = globalThis.crypto;
    if (c?.getRandomValues) return c.getRandomValues(new Uint8Array(1))[0] % ALPHABET.length;
    return Math.floor(Math.random() * ALPHABET.length);
  };
  let key = 'smp_';
  for (let i = 0; i < 20; i += 1) key += ALPHABET[pick()];
  return key;
}

function cleanAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== SAMPLE_QUESTION_IDS.length) return null;
  const seen = new Set();
  const out = [];
  for (const a of answers) {
    const id = a?.sampleQuestionId;
    if (!SAMPLE_QUESTION_IDS.includes(id) || seen.has(id) || !OPTION_KEYS.has(a?.optionKey)) return null;
    seen.add(id);
    out.push({ sampleQuestionId: id, optionKey: a.optionKey });
  }
  return out;
}

/**
 * The record the landing stores when the sample is finished. `answers` is five
 * { sampleQuestionId: 'q1'..'q5', optionKey: 'A'..'D' } in any order; `subject` is the sample's
 * subject line (for example "Accountancy"). Returns null when the answers are incomplete.
 */
export function buildSampleHandoff({ answers, subject = 'CUET sample', importKey = null, now = Date.now(), random = null } = {}) {
  const clean = cleanAnswers(answers);
  if (!clean) return null;
  const name = String(subject || '').trim().slice(0, 60) || 'CUET sample';
  return { v: 1, sampleVersion: SAMPLE_VERSION, importKey: KEY_RE.test(importKey || '') ? importKey : newImportKey(random), subject: name, answers: clean, savedAt: now, imported: false };
}

/** Parses a stored value. Anything unexpected, expired or of another version is null. */
export function parseSampleHandoff(raw, { now = Date.now() } = {}) {
  try {
    const h = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!h || typeof h !== 'object' || h.v !== 1 || h.sampleVersion !== SAMPLE_VERSION) return null;
    if (!KEY_RE.test(h.importKey || '') || !Number.isFinite(h.savedAt) || now - h.savedAt > SAMPLE_HANDOFF_TTL_MS || h.savedAt - now > 60_000) return null;
    const answers = cleanAnswers(h.answers);
    if (!answers) return null;
    return { v: 1, sampleVersion: SAMPLE_VERSION, importKey: h.importKey, subject: String(h.subject || 'CUET sample').slice(0, 60), answers, savedAt: h.savedAt, imported: h.imported === true };
  } catch {
    return null;
  }
}

/** Reads the handoff from storage (sessionStorage in the browser). Never throws. */
export function readSampleHandoff(storage, { now = Date.now() } = {}) {
  try {
    return parseSampleHandoff(storage?.getItem(SAMPLE_HANDOFF_KEY), { now });
  } catch {
    return null;
  }
}

/** Stores the handoff. Returns false when storage is unavailable. Never throws. */
export function writeSampleHandoff(storage, handoff) {
  if (!handoff) return false;
  try {
    storage?.setItem(SAMPLE_HANDOFF_KEY, JSON.stringify(handoff));
    return Boolean(storage);
  } catch {
    return false;
  }
}

/** Removes the handoff. Never throws. */
export function clearSampleHandoff(storage) {
  try { storage?.removeItem(SAMPLE_HANDOFF_KEY); } catch { /* storage blocked */ }
}

/** Should onboarding post this handoff? Only a valid, not yet imported one. */
export function shouldImport(handoff) {
  return Boolean(handoff && !handoff.imported);
}

/** The POST body for /api/me/sample-import. */
export function sampleImportBody(handoff) {
  return { importKey: handoff.importKey, sampleVersion: handoff.sampleVersion, subject: handoff.subject, answers: handoff.answers };
}

/**
 * What to do after the POST: 'done' (saved, or 409 already saved), 'later' (not signed in yet, or a
 * network or server failure: keep it for the next page load) or 'drop' (the server refused the body).
 */
export function importOutcome(status) {
  if (status === 200 || status === 201 || status === 409) return 'done';
  if (status === 400 || status === 422) return 'drop';
  return 'later';
}

/**
 * Marks the handoff imported before the request is sent, so a reload never posts it twice; on
 * 'later' the caller restores imported:false with writeSampleHandoff(storage, handoff).
 */
export function markImported(storage, handoff) {
  if (!handoff) return null;
  const next = { ...handoff, imported: true };
  writeSampleHandoff(storage, next);
  return next;
}

/** "3 of 5" for the in-place sample result. */
export function sampleScore(answers, correctKeys) {
  const keys = correctKeys || {};
  const clean = cleanAnswers(answers) || [];
  const right = clean.filter((a) => keys[a.sampleQuestionId] === a.optionKey).length;
  return { right, total: SAMPLE_QUESTION_IDS.length, line: `${right} of ${SAMPLE_QUESTION_IDS.length}` };
}
