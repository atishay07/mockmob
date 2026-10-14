// Subject choice for onboarding and Account (web redesign W2.3). Plain module: the browser
// and `node --test` both load it. No React, no fetch.
//
// Truth rules: only subjects the catalog marks `practice === 'supported'` can be picked.
// Saved subjects practice cannot open stay listed with a Remove action; they are never offered
// as new picks. Five at most, like the exam; at least one when editing an existing account.

export const MAX_SUBJECTS = 5;

/**
 * The app's subject light fields (flutter_app/lib/core/theme/light_fields.dart): a
 * low-saturation colour behind the subject's art only, never behind text that is read.
 */
const LIGHTS = Object.freeze({
  accountancy: ['#3B2A10', '#F6E8CF'],
  businessStudies: ['#14213F', '#DCE3F7'],
  economics: ['#0F3330', '#D3EEEA'],
  english: ['#3A1626', '#F4DDE6'],
  generalTest: ['#22300F', '#E2EDCF'],
  mathematics: ['#1C2638', '#DEE4EE'],
  physics: ['#241C3A', '#E4DEF2'],
  chemistry: ['#0E2F2A', '#D2ECE6'],
  biology: ['#1C2E12', '#DDEBD0'],
  history: ['#3A2414', '#F3E2D2'],
  politicalScience: ['#38171A', '#F2DADB'],
  geography: ['#102A3A', '#D4E6F0'],
  psychology: ['#301A33', '#EDDCEF'],
  sociology: ['#34280E', '#F1E6CC'],
  computerScience: ['#14291C', '#D6EADC'],
  language: ['#2E2418', '#EFE5D6'],
});

const LIGHT_BY_ID = Object.freeze({
  accountancy: 'accountancy',
  business_studies: 'businessStudies',
  business: 'businessStudies',
  economics: 'economics',
  english: 'english',
  general_test: 'generalTest',
  gat: 'generalTest',
  mathematics: 'mathematics',
  applied_mathematics: 'mathematics',
  maths: 'mathematics',
  physics: 'physics',
  chemistry: 'chemistry',
  biology: 'biology',
  history: 'history',
  political_science: 'politicalScience',
  geography: 'geography',
  psychology: 'psychology',
  sociology: 'sociology',
  computer_science: 'computerScience',
});

/** { night, day } colours of a subject's light field; languages and the rest share sepia. */
export function subjectLight(id) {
  const key = LIGHT_BY_ID[String(id || '').trim().toLowerCase()] || 'language';
  const [night, day] = LIGHTS[key];
  return { night, day };
}

/** Catalog rows a student may pick. A row without a `practice` value is not offered. */
export function pickableSubjects(catalog) {
  return (Array.isArray(catalog) ? catalog : []).filter((subject) => subject && subject.practice === 'supported');
}

function humanize(id) {
  const words = String(id || '').replace(/[_-]+/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : '';
}

/** The subject's display name from the catalog, or a readable form of its id (never a raw id). */
export function subjectName(catalog, id) {
  const row = (Array.isArray(catalog) ? catalog : []).find((subject) => subject?.id === id || subject?.internalId === id);
  return row?.name || humanize(id);
}

/**
 * Saved subjects that practice cannot open (not offered, merged, or no longer on the list).
 * A row that does not say either way is not flagged: unknown is not "cannot".
 * Returns [{ id, name, reason }], in the saved order.
 */
export function staleSubjects(selected, catalog) {
  const rows = Array.isArray(catalog) ? catalog : [];
  return (Array.isArray(selected) ? selected : [])
    .map((id) => {
      const row = rows.find((subject) => subject?.id === id);
      if (row && (row.practice === 'supported' || row.practice === undefined || row.practice === null)) return null;
      return {
        id,
        name: row?.name || humanize(id),
        reason: row?.practiceReason || (row ? 'Practice is not open for this subject.' : 'This saved subject is no longer on the CUET list.'),
      };
    })
    .filter(Boolean);
}

/**
 * Adds or removes one subject. At the cap, adding is refused and `capped` is true so the
 * screen can say why (never a silent no). Removing always works.
 * @returns {{ selected: string[], capped: boolean }}
 */
export function toggleSubject(selected, id, { max = MAX_SUBJECTS } = {}) {
  const current = Array.isArray(selected) ? selected : [];
  if (current.includes(id)) return { selected: current.filter((value) => value !== id), capped: false };
  if (current.length >= max) return { selected: current, capped: true };
  return { selected: [...current, id], capped: false };
}

/** Same subjects, in any order. */
export function sameSubjects(a, b) {
  const left = new Set(Array.isArray(a) ? a : []);
  const right = new Set(Array.isArray(b) ? b : []);
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

/** "2 of 5 chosen". */
export function chosenCount(n, max = MAX_SUBJECTS) {
  return `${n} of ${max} chosen`;
}

/**
 * Whether the current choice can be saved, and the reason when it cannot.
 * `requireOne`: an existing account keeps at least one subject.
 */
export function saveState(selected, saved, { requireOne = false } = {}) {
  const count = Array.isArray(selected) ? selected.length : 0;
  if (count === 0) return { canSave: false, reason: requireOne ? 'Keep at least one subject.' : 'Pick at least one subject.' };
  if (count > MAX_SUBJECTS) return { canSave: false, reason: 'Five is the most. Remove one to add another.' };
  if (saved && sameSubjects(selected, saved)) return { canSave: false, reason: 'Pick or remove a subject to save.' };
  return { canSave: true, reason: '' };
}

/** Practice, prefilled with the first check: 10 quick questions in one subject. */
export function firstCheckHref(subjectId) {
  const params = new URLSearchParams({ subject: String(subjectId || ''), mode: 'quick', count: '10' });
  return `/dashboard?${params.toString()}`;
}

/** "11:42 PM" (12-hour, as everywhere in MockMob). */
export function formatTime12(date) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  const hours = value.getHours();
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** True when a thrown fetch error means the browser could not reach the server. */
export function isOffline(error) {
  if (error && error.kind === 'network') return true;
  if (error instanceof TypeError) return true;
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
