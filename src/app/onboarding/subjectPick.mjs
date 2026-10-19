// The first run's subject picker, as pure rules (the app's subject picker and its five-subject swap,
// flutter_app lib/features/onboarding/widgets/subject_picker.dart and lib/features/practice/copy.dart "swap").
//
//   search    a student finds a subject by the name they know it by ("maths", "bio", "cs", a CUET code)
//   not yet   the CUET papers MockMob has no practice for are LISTED, never hidden, and cannot be picked
//   the cap   a sixth pick is answered with the reason and one tap to swap (never a silent refusal)
//
// Copy rules: sentence case, no "!", no em dash. The five is the CUET UG 2026 rule (src/lib/cuetRules.mjs).
import { CUET_MAX_SUBJECTS, CUET_RULE_CYCLE } from '../../lib/cuetRules.mjs';

export const SEARCH_HINT = 'Search subjects, like maths or biology';
export const NOT_YET_TITLE = 'Not on MockMob yet';
export const NOT_YET_NOTE = 'CUET has these papers. There is no practice for them here yet, so they cannot go on your sheet.';
export const LANGUAGE_PAPERS = 'Language papers';
export const OTHER_PAPERS = 'Other papers';
export const noSubjectMatch = (q) => `Nothing matches "${q}". Try a shorter word.`;
export const subjectCountLine = (n) => (n === 1 ? '1 subject matches.' : `${n} subjects match.`);

const norm = (s) => String(s ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

// Words a student types for a subject that its name does not spell. Kept small, and each one is a plain alias.
const ALIASES = Object.freeze({
  maths: 'mathematics', math: 'mathematics', bio: 'biology', eco: 'economics', econ: 'economics', chem: 'chemistry',
  cs: 'computer science', ip: 'computer science informatics practices', polsci: 'political science', pol: 'political science',
  bst: 'business studies', bs: 'business studies', gat: 'general test', accounts: 'accountancy', psych: 'psychology', socio: 'sociology',
});

/** Whether a subject answers a typed query: every word of the query starts a word of its name, official name or code. */
export function subjectMatches(subject, query) {
  const q = norm(query);
  if (!q) return true;
  const hay = norm([subject.name, subject.officialName, subject.officialCode, subject.id].filter(Boolean).join(' '));
  const words = hay.split(' ');
  return q.split(' ').every((token) => {
    const expanded = norm(ALIASES[token] || token).split(' ');
    return expanded.every((part) => words.some((w) => w.startsWith(part)));
  });
}

/** The practice subjects a student can pick, filtered by the search. Order is the catalogue's. */
export function pickableSubjects(subjects, query = '') {
  return (Array.isArray(subjects) ? subjects : []).filter((s) => s.practice === 'supported' && subjectMatches(s, query));
}

/**
 * The CUET papers MockMob cannot practise yet, split as the app shows them: language papers and the rest. Matched by the same search.
 * A language paper has an NTA code from 101 to 113.
 */
export function notYetSubjects(subjects, query = '') {
  const rows = (Array.isArray(subjects) ? subjects : [])
    .filter((s) => s.practice === 'not_offered' && subjectMatches(s, query))
    .map((s) => ({ id: s.id, name: s.officialName || s.name, language: /^1\d\d$/.test(String(s.officialCode || '')) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { languages: rows.filter((r) => r.language), papers: rows.filter((r) => !r.language), total: rows.length };
}

/** The reason a sixth pick is answered with. */
export function capCopy({ wantedName, lastName, cap = CUET_MAX_SUBJECTS }) {
  const word = ['none', 'one', 'two', 'three', 'four', 'five', 'six'][cap] || String(cap);
  const first = word[0].toUpperCase() + word.slice(1);
  return {
    title: `${first} is the most CUET allows`,
    body: `CUET UG ${CUET_RULE_CYCLE} lets you take ${word} papers in all, and a language or the General Test counts as one. To add ${wantedName}, take one out first.`,
    swap: `Swap ${lastName} for ${wantedName}`,
    keep: `Keep my ${word}`,
  };
}

/** The picks after a swap: the most recent pick makes room for the one asked for. Nothing else moves. */
export function swapLast(selected, wantedId) {
  const list = Array.isArray(selected) ? selected : [];
  if (!wantedId || list.includes(wantedId) || list.length === 0) return list.slice();
  return [...list.slice(0, -1), wantedId];
}

/** A subject's short name for a key or a line: "Mathematics / Applied Mathematics" is "Mathematics". */
export const shortSubjectName = (subject) => String(subject?.name ?? subject?.id ?? '').split(' / ')[0];
