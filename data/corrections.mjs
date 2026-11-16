// The public corrections log (16 Nov 2026): what MockMob found wrong in its questions, when, and what it did.
//
// The entries live in data/corrections.json (its "note" says how to add one). This file is the only way they are read:
// it checks each entry, drops the private `source` field, and orders the log newest first for /corrections
// (src/app/corrections/page.js) and its sitemap date (src/app/sitemap.js). Pure: no React, no database, no '@/' imports,
// so node --test loads it directly. data/tests/corrections.test.mjs fails on any malformed entry in the committed file,
// and the page never draws an entry that fails these checks.

import RAW from './corrections.json' with { type: 'json' };

export const ACTIONS = Object.freeze({ fixed: 'Fixed', pulled: 'Taken out', held: 'Held for a re-check' });
export const FOUND = Object.freeze({ check: 'Found in our own check', report: 'Found from a student’s report' });
export const ALL_SUBJECTS = 'All subjects';

const FIELDS = new Set(['id', 'date', 'subject', 'count', 'bySubject', 'action', 'found', 'wrong', 'did', 'source']);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const IST_OFFSET_MS = 330 * 60 * 1000;
const SENTENCE_MIN = 12;
const SENTENCE_MAX = 220;

/** Today's date in India (IST), as YYYY-MM-DD. */
export function istToday(now = Date.now()) {
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** True for a real calendar day written YYYY-MM-DD (no 31 February). */
export function isRealDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d;
}

/**
 * Words that would print the answer of a question students can still see: "the right answer is C", "key B to C",
 * "from option A to option D". A guard, not a proof: the person adding the entry still reads it.
 */
const KEY_LEAKS = [
  /\b(?:[Rr]ight|[Cc]orrect)\s+(?:answer|option|key)\s+(?:is|was|is now|becomes|became)\s+(?:option\s+)?\(?[A-D]\)?(?![A-Za-z])/,
  /\b(?:[Kk]ey|[Aa]nswer)\s+(?:changed\s+)?(?:from\s+)?\(?[A-D]\)?\s+to\s+\(?[A-D]\)?(?![A-Za-z])/,
  /\bfrom\s+(?:option\s+)?[A-D]\s+to\s+(?:option\s+)?[A-D](?![A-Za-z])/,
];

/** One plain sentence (or two short ones) for the page: the problems with it, [] when it is fine. */
export function sentenceProblems(text, field) {
  if (typeof text !== 'string' || !text.trim()) return [`${field} is missing`];
  const problems = [];
  if (text !== text.trim()) problems.push(`${field} has spaces at an end`);
  if (text.length < SENTENCE_MIN || text.length > SENTENCE_MAX) problems.push(`${field} is ${text.length} characters (keep it ${SENTENCE_MIN} to ${SENTENCE_MAX})`);
  if (!/^[A-Z0-9₹]/.test(text)) problems.push(`${field} does not start with a capital letter or a number`);
  if (!/[.]$/.test(text)) problems.push(`${field} does not end with a full stop`);
  if (/[!]/.test(text)) problems.push(`${field} has an exclamation mark`);
  if (/[\n\r\t]/.test(text)) problems.push(`${field} runs over more than one line`);
  if (/[·•]/.test(text)) problems.push(`${field} uses a middle dot`);
  if (/\p{Extended_Pictographic}/u.test(text)) problems.push(`${field} has an emoji`);
  if (KEY_LEAKS.some((pattern) => pattern.test(text))) problems.push(`${field} names an answer letter`);
  return problems;
}

/** Everything wrong with one entry, [] when it may be shown. `today` is YYYY-MM-DD (IST). */
export function entryProblems(entry, { today = istToday() } = {}) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return ['the entry is not an object'];
  const problems = [];
  for (const key of Object.keys(entry)) if (!FIELDS.has(key)) problems.push(`unknown field "${key}"`);

  if (!isRealDate(entry.date)) problems.push('date is not a real day written YYYY-MM-DD');
  else if (entry.date > today) problems.push(`date ${entry.date} is after today (${today})`);

  if (typeof entry.id !== 'string' || !/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) problems.push('id is not a slug like 2026-10-31-few-words');
  else if (isRealDate(entry.date) && !entry.id.startsWith(`${entry.date}-`)) problems.push('id does not start with its date');

  const subject = typeof entry.subject === 'string' ? entry.subject.trim() : '';
  if (!subject || subject.length > 40) problems.push('subject is missing or longer than 40 characters');

  const hasCount = entry.count !== undefined;
  if (hasCount && !(Number.isInteger(entry.count) && entry.count > 0)) problems.push('count is not a whole number above 0');
  if (!hasCount && subject !== ALL_SUBJECTS) problems.push(`count is missing (only "${ALL_SUBJECTS}" may leave it out)`);

  const many = /^(\d+) subjects$/.exec(subject);
  if (many && Number(many[1]) < 2) problems.push('"N subjects" needs N of 2 or more');
  if (entry.bySubject !== undefined) {
    const pairs = entry.bySubject && typeof entry.bySubject === 'object' && !Array.isArray(entry.bySubject) ? Object.entries(entry.bySubject) : null;
    if (!pairs || !pairs.length) problems.push('bySubject is not an object of subject counts');
    else {
      if (pairs.some(([name, n]) => !name.trim() || !(Number.isInteger(n) && n > 0))) problems.push('bySubject has a blank name or a count that is not a whole number above 0');
      const sum = pairs.reduce((total, [, n]) => total + (Number.isInteger(n) ? n : 0), 0);
      if (hasCount && sum !== entry.count) problems.push(`bySubject adds up to ${sum}, not count ${entry.count}`);
      if (!many || Number(many[1]) !== pairs.length) problems.push(`subject should read "${pairs.length} subjects" to match bySubject`);
    }
  }

  if (!Object.hasOwn(ACTIONS, entry.action)) problems.push(`action is not one of ${Object.keys(ACTIONS).join(', ')}`);
  if (!Object.hasOwn(FOUND, entry.found)) problems.push(`found is not one of ${Object.keys(FOUND).join(', ')}`);
  problems.push(...sentenceProblems(entry.wrong, 'wrong'), ...sentenceProblems(entry.did, 'did'));
  if (typeof entry.source !== 'string' || entry.source.trim().length < 10) problems.push('source is missing (name the commit, migration or file that proves it)');
  return problems;
}

/** Every problem in a whole log file, each led by its entry's id or place: [] when the file is good. */
export function correctionsProblems(raw = RAW, { today = istToday() } = {}) {
  if (!raw || !Array.isArray(raw.entries)) return ['the file has no "entries" list'];
  const problems = [];
  const seen = new Set();
  raw.entries.forEach((entry, i) => {
    const label = typeof entry?.id === 'string' && entry.id ? entry.id : `entry ${i + 1}`;
    if (typeof entry?.id === 'string') {
      if (seen.has(entry.id)) problems.push(`${label}: id used twice`);
      seen.add(entry.id);
    }
    for (const problem of entryProblems(entry, { today })) problems.push(`${label}: ${problem}`);
  });
  return problems;
}

/** "31 October 2026" and its parts, for a YYYY-MM-DD day. */
export function dateParts(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const month = MONTHS[m - 1];
  return { day: String(d), month, monthShort: month.slice(0, 3), year: String(y), label: `${d} ${month} ${y}` };
}

/** "1 question", "218 questions", or null when the entry touched every question. */
export function countLine(entry) {
  if (!Number.isInteger(entry?.count)) return null;
  return `${entry.count.toLocaleString('en-IN')} ${entry.count === 1 ? 'question' : 'questions'}`;
}

/** What the page may show of an entry: everything but `source`, with its words ready. */
export function publicEntry(entry) {
  return {
    id: entry.id,
    date: entry.date,
    subject: entry.subject.trim(),
    count: Number.isInteger(entry.count) ? entry.count : null,
    countLine: countLine(entry),
    bySubject: entry.bySubject ? Object.entries(entry.bySubject).map(([name, n]) => ({ name, count: n })) : [],
    action: entry.action,
    actionLabel: ACTIONS[entry.action],
    found: entry.found,
    foundLabel: FOUND[entry.found],
    wrong: entry.wrong,
    did: entry.did,
  };
}

/**
 * The log as the page draws it: entries that pass every check, newest day first (the file's order within a day), grouped by
 * day. `skipped` counts entries left out because they fail a check (the test keeps it at 0 for the committed file).
 */
export function loadCorrections(raw = RAW, { today = istToday() } = {}) {
  const list = Array.isArray(raw?.entries) ? raw.entries : [];
  const ids = new Set();
  const shown = [];
  let skipped = 0;
  list.forEach((entry, order) => {
    if (entryProblems(entry, { today }).length || ids.has(entry.id)) { skipped += 1; return; }
    ids.add(entry.id);
    shown.push({ order, entry: publicEntry(entry) });
  });
  shown.sort((a, b) => (a.entry.date === b.entry.date ? a.order - b.order : a.entry.date < b.entry.date ? 1 : -1));
  const entries = shown.map((item) => item.entry);
  const days = [];
  for (const entry of entries) {
    const last = days[days.length - 1];
    if (last && last.date === entry.date) last.entries.push(entry);
    else days.push({ date: entry.date, parts: dateParts(entry.date), entries: [entry] });
  }
  return {
    entries,
    days,
    skipped,
    latest: entries.length ? entries[0].date : null,
    first: entries.length ? entries[entries.length - 1].date : null,
  };
}
