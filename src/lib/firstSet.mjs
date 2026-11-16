// The first set (15 Nov 2026, the first-run pass, findings F2 and O1 of tmp/1115-prod/flow-first-run.md). Of the students who
// signed up, about half never finished a first set, and the first run ended a scroll and a guide away from its Start key. So
// the first run now ends on a question when today's included set is free, and Practice shows a student with no finished set
// the way to start on its first screen.
//
// One launch path for every door: the server quote for a Quick set (GET /api/practice/quote) and the runner's address with the
// quote's own key, exactly as Practice builds them (src/app/(app)/dashboard/DashboardPageClient.jsx uses these two builders, so
// onboarding and the guide open the very paper Practice would). Nothing here charges: the quote is read-only, and the runner
// starts the session (and takes today's included set) only once it opens. Pure, plus one fetch helper that takes its fetch.
import { DAILY_SET, DAILY_SET_QUESTIONS, dailySetFromQuote } from './dailySet.mjs';

export const QUOTE_PATH = '/api/practice/quote';
/** The first set is today's included one: a Quick set of 10 (data/practice_quote.js allowanceKindFor 'daily_practice'). */
export const FIRST_SET_MODE = 'quick';
export const FIRST_SET_COUNT = DAILY_SET_QUESTIONS;
/** How long the first run waits for the quote before its key stays "Finish and open Practice". Never blocks the key. */
export const FIRST_SET_QUOTE_MS = 2500;

/** The quote's address for a session: the same parameters, in the same order, as Practice asks with. */
export function quotePath({ subject, mode = FIRST_SET_MODE, count = FIRST_SET_COUNT } = {}) {
  return `${QUOTE_PATH}?${new URLSearchParams({ subject: String(subject ?? ''), mode: String(mode), count: String(count) })}`;
}

/**
 * The runner's address for a session, before its key (Practice's launchHref): subject, count and mode, then the chapters (only
 * for a mode that takes them; the caller decides), a level (Pro only; the caller decides) and NTA's exam screen.
 */
// ntaScreen: true or 'nta' for NTA style; 'mockmob' for MockMob's screen (an NTA paper opens in NTA style unless it says so).
export function launchPath({ subject, count = FIRST_SET_COUNT, mode = FIRST_SET_MODE, chapters = [], difficulty = '', ntaScreen = false } = {}) {
  const list = Array.isArray(chapters) ? chapters.filter(Boolean) : [];
  const chapterParam = list.length > 0 ? `&chapters=${encodeURIComponent(list.join(','))}` : '';
  const difficultyParam = difficulty ? `&difficulty=${encodeURIComponent(difficulty)}` : '';
  const interfaceParam = ntaScreen === 'mockmob' ? '&interface=mockmob' : ntaScreen ? '&interface=nta' : '';
  return `/test?subject=${subject}&count=${count}&mode=${encodeURIComponent(mode)}${chapterParam}${difficultyParam}${interfaceParam}`;
}

/** The address the runner opens: the session's address with the quote's key, then any hand-over fields (Today's tonight, firstFree). */
export function startPath(href, generationKey, extra = null) {
  const tail = extra && typeof extra.toString === 'function' && String(extra) ? `&${extra}` : '';
  return `${href}&generationKey=${encodeURIComponent(generationKey)}${tail}`;
}

/** True when a quote's time is up (its key would be refused): ask again. A quote with no readable time counts as expired. */
export function quoteExpired(quote, now = Date.now()) {
  const at = Date.parse(quote?.expiresAt);
  return !Number.isFinite(at) || at <= now;
}

/**
 * The free first set a quote proves, or null. Free means: launchable, nothing charged, and the allowance it uses is today's
 * included set ('free' in src/lib/dailySet.mjs). Anything else (priced, blocked, a Pro quote with no allowance, an unread
 * allowance, a quote for another set) is not offered: the first run then opens Practice, which shows the price before it starts.
 * -> { subject, count, minutes, href, path, expiresAt }
 */
export function firstSetOffer(quote, { subject, now = Date.now() } = {}) {
  if (!quote || typeof quote !== 'object' || quote.launchable !== true || quote.creditCost !== 0) return null;
  if (dailySetFromQuote(quote) !== DAILY_SET.free) return null;
  if (quote.mode?.id !== FIRST_SET_MODE || Number(quote.count) !== FIRST_SET_COUNT) return null;
  if (subject && quote.subject?.storedId && quote.subject.storedId !== subject) return null;
  if (typeof quote.idempotencyToken !== 'string' || !quote.idempotencyToken || quoteExpired(quote, now)) return null;
  const stored = subject || quote.subject?.storedId;
  if (!stored) return null;
  const href = launchPath({ subject: stored, count: FIRST_SET_COUNT, mode: FIRST_SET_MODE });
  const seconds = Number(quote.durationSec);
  return {
    subject: stored,
    count: FIRST_SET_COUNT,
    minutes: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds / 60) : FIRST_SET_COUNT,
    href,
    path: startPath(href, quote.idempotencyToken),
    expiresAt: quote.expiresAt,
  };
}

/**
 * Reads the Quick 10 quote for a subject within `timeoutMs`. Resolves the quote, or null when it failed, was not a quote or took
 * too long. Never rejects. `fetcher` is window.fetch in the browser and a stub in the tests.
 */
export function readFirstSetQuote(subject, { timeoutMs = FIRST_SET_QUOTE_MS, fetcher = (...args) => fetch(...args), setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  if (!subject) return Promise.resolve(null);
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  const late = new Promise((resolve) => { timer = setTimer(() => { controller?.abort(); resolve(null); }, timeoutMs); });
  const read = Promise.resolve()
    .then(() => fetcher(quotePath({ subject }), { cache: 'no-store', credentials: 'same-origin', ...(controller ? { signal: controller.signal } : {}) }))
    .then((response) => (response && response.ok ? response.json() : null))
    .then((body) => (body && typeof body.state === 'string' ? body : null))
    .catch(() => null);
  return Promise.race([read, late]).then((quote) => { clearTimer(timer); return quote; });
}

// ---------------------------------------------------------------------------------------------------------------------
// The words. Each claim is the code's: "free today" only on a quote whose allowance is today's included set; "about N minutes"
// from the quote's own clock (a Quick set is timed at 60 s a question, data/test_modes.js); "you can stop any time" because
// the runner's Leave is on every question and keeps every answer (TestPageClient: the answers stay until the timer ends), and Submit test sits in
// the palette at every question. Sentence case, no exclamation mark, no arrow.

/** The first run's last key when the first set is free: "Finish and start 10 Accountancy questions". */
export function firstSetKey(subjectName, count = FIRST_SET_COUNT) {
  const name = String(subjectName || '').trim();
  return name ? `Finish and start ${count} ${name} questions` : `Finish and start ${count} questions`;
}

/** The one quiet line under that key. */
export function firstSetNote(minutes = FIRST_SET_COUNT) {
  const m = Math.max(1, Math.round(Number(minutes) || FIRST_SET_COUNT));
  return `Free today. About ${m} ${m === 1 ? 'minute' : 'minutes'}. You can stop any time.`;
}

/** The key's words while it opens the paper, and the plain key when no free set is on offer. */
export const FIRST_SET_OPENING = 'Opening your first set…';
export const FINISH_TO_PRACTICE = 'Finish and open Practice';

/**
 * Practice's line for a student with no finished set (F2), above the subject shelf: "Your first set: 10 Accountancy questions,
 * free today. About 10 minutes." It follows the set on the Start key beside it, so it stays true when the student changes the
 * mode or the count: the price part only once the quote has said it (free today, or the credits), never guessed.
 *   price: 'free' (today's included set) | 'first-full' (a subject's first full mock, free) | number (credits) | null (unknown)
 *   chapters: the chapters the set is narrowed to (Quick practice only): one is named, more are counted.
 */
export function firstSetLine({ mode = FIRST_SET_MODE, count = FIRST_SET_COUNT, subjectName = '', minutes = null, price = null, chapters = [] } = {}) {
  const name = String(subjectName || '').trim();
  const narrowed = mode === FIRST_SET_MODE && Array.isArray(chapters) ? chapters.filter(Boolean) : [];
  const from = narrowed.length === 1 ? ` from ${narrowed[0]}` : narrowed.length > 1 ? ` from ${narrowed.length} chapters` : '';
  const what = mode === 'full' ? (name ? `the ${name} full mock` : 'a full mock')
    : mode === 'nta' ? (name ? `the ${name} NTA paper` : 'an NTA paper')
      : mode === 'smart' ? `${count} ${count === 1 ? 'question' : 'questions'} of Smart practice${name ? ` in ${name}` : ''}`
        : `${count} ${name ? `${name} ` : ''}${count === 1 ? 'question' : 'questions'}${from}`;
  const cost = price === 'free' ? ', free today' : price === 'first-full' ? ', free' : Number.isFinite(price) && price > 0 ? `, ${price} ${price === 1 ? 'credit' : 'credits'}` : '';
  const m = Math.round(Number(minutes));
  const time = Number.isFinite(m) && m > 0 ? ` About ${m} ${m === 1 ? 'minute' : 'minutes'}.` : '';
  return `Your first set: ${what}${cost}.${time}`;
}

// The guide's last stop for a student with no finished set (src/lib/appTour.mjs firstSetTour) ends on this key.
export const FIRST_SET_GUIDE_KEY = 'Start your first set';
export const FIRST_SET_GUIDE_BUSY = 'Starting…';

// The first step's one name and one door on every other screen that invites it (owner's decision U2, 15 Nov 2026: Today, Your
// papers, Revise, Progress, Marks trend, Your standing, Colleges, the Ask Mobi page and sheet). The key opens Practice with a
// 10-question quick set chosen; Practice shows the subject and the price ("Free: today's included set") before anything
// starts. Practice's own start key and onboarding's key say the set with its subject, so they read as the same step.
export const FIRST_SET_LABEL = `Start ${FIRST_SET_COUNT} questions`;
export const FIRST_SET_HREF = `/dashboard?mode=quick&count=${FIRST_SET_COUNT}`;

/** Practice with the first set chosen, and the subject when the screen knows one (an unknown id is left out). */
export function firstSetHref(subject = null) {
  const id = typeof subject === 'string' && /^[a-z_]{2,40}$/.test(subject) ? subject : null;
  return id ? `/dashboard?${new URLSearchParams({ subject: id, mode: 'quick', count: String(FIRST_SET_COUNT) })}` : FIRST_SET_HREF;
}
