// The Guide ("Show me around"; W-064, F18, rebuilt 10 Nov 2026 on the owner's word that it was "so, so, so bad" and should start by
// itself for a first-time student). One stop per place on the map a student uses every day, each with one line of 16 words at most
// that is true of the product. The long per-feature paragraphs left the tour (each feature explains itself on its own page, and
// the Guide page keeps the common questions); nothing else left the product.
//
// The steps live here, not in the shell, so that the Guide page can say how many stops the tour has by counting these (W-093):
// the number in "Show me around" is read from the tour that will run, never typed into a sentence. Pure data and pure rules,
// so tests can hold them.
// The map is the five places (WEB-NAV-1019 option A, owner D114): Today, Practice, the Start key, the Mob and You, plus Ask Mobi's
// door (the rail's door under Start from 1024 px, the top bar's key below it; owner LK143). `target` lists the data-tour ids a stop
// may stand on, the first one on screen wins: the sidebar's own row on a desktop, the dock's or the top bar's key on a phone. The
// dock's You keeps the id nav-more. `group` puts the ring round the whole sidebar group the row heads (You and the pages under it).
export const TOUR_STEPS_ALL = Object.freeze([
  { title: 'Today', target: 'nav-today', body: 'Your next step and the reason for it. Start here each day.' },
  { title: 'Practice', target: 'nav-dashboard', body: 'Pick a subject and a way to practise. Every set is timed and marked like CUET.' },
  { title: 'Start', target: 'nav-start', body: 'Tap Start on any page to begin a session.' },
  { title: 'Ask Mobi', target: ['nav-mentor', 'nav-mentor-top'], body: 'Ask any CUET doubt, or ask what your papers say.' },
  { title: 'Your Mob', target: 'nav-mob', body: 'You and up to four friends sit the same paper each week.', mob: true },
  { title: 'You', target: ['nav-profile', 'nav-more'], group: true, body: 'Progress, Colleges, Wallet and this guide are here.' },
]);

/** A stop's line never runs past this many words. */
export const TOUR_LINE_WORDS = 16;

/** The stops this session runs: the Mob only while the Mob is on (and any stop marked `study` only while the lessons are on). */
export function tourSteps({ mob = false, study = false } = {}) {
  return TOUR_STEPS_ALL.filter((step) => (!step.mob || mob) && (!step.study || study));
}

// ---------------------------------------------------------------------------------------------------------------------
// A student with no finished set (15 Nov 2026, F2): the same stops, none dropped, but the tour ends on Start, and its last key
// starts the first set ("Start your first set") instead of "Done" on You. On Practice the stop stands on the page's own Start key
// (data-tour="first-set" on a phone, "practice-start" on the session card from 1024 px); elsewhere on the Start key every page
// has. Everyone else gets the tour as it was.
export const FIRST_SET_STOP = Object.freeze({
  title: 'Start',
  target: Object.freeze(['first-set', 'practice-start', 'nav-start']),
  body: 'Your first set: 10 questions, about 10 minutes. Start it now, or any time later.',
  firstSet: true,
});

/** The stops for a student with no finished set: Start moves to the end and becomes the first set's stop. Same count. */
export function firstSetTour(steps = []) {
  const list = Array.isArray(steps) ? steps : [];
  const start = list.findIndex((step) => step.title === 'Start');
  if (start < 0) return [...list, FIRST_SET_STOP];
  return [...list.slice(0, start), ...list.slice(start + 1), FIRST_SET_STOP];
}

/**
 * Whether a guide that is open may still take the first-set order: only while the two orders show the same stops, so the
 * student never sees a stop move under them. Both orders start with Today and Practice; they part at the Start stop.
 */
export function firstSetOrderOpen(steps = [], index = 0) {
  const start = (Array.isArray(steps) ? steps : []).findIndex((step) => step.title === 'Start');
  return start < 0 ? index < (Array.isArray(steps) ? steps.length - 1 : 0) : index < start;
}

// ---------------------------------------------------------------------------------------------------------------------
// Starting by itself, once (owner, 10 Nov 2026: "It should automatically start when someone is first-time entering the platform").
//
// The guide starts on its own only for a student who finished onboarding on this device in the last 24 hours (the record
// src/lib/proNudge.mjs keeps: onboardedRecently), who has never seen it, on the first page of the product they reach: Today, or
// Practice, where the first run ends (src/app/onboarding/firstRun.js DONE_PATH). Never over a paper or onboarding, and never over
// an open dialog or sheet (the Pro sheet included): it waits for that to close. A returning student and a second device never get
// it by itself; "Show me around" starts it by hand anywhere.
// When the first run ends on a question (15 Nov 2026, O1: the last key opens today's free set), the paper (/test) and its result
// (/result/<id>) are not pages it starts on, so it first starts on the Practice or Today visit after that first result.

/** How long after onboarding the guide may still start by itself. */
export const GUIDE_AUTO_WINDOW_MS = 24 * 3_600_000;
/** How long after the page has drawn it starts. */
export const GUIDE_AUTO_DELAY_MS = 900;
/** The pages it may start on by itself. */
export const GUIDE_AUTO_PAGES = Object.freeze(['/today', '/dashboard']);
// A paper being sat (the runner, a Mob game), a focus player and onboarding: nothing starts unprompted there.
const GUIDE_QUIET = Object.freeze(['/test', '/onboarding', '/mob/game', '/learn/run', '/explore/run']);

/**
 * Whether the guide starts by itself now: 'start', 'wait' (everything holds but a dialog or sheet is open, so ask again
 * shortly) or 'no'. `onboarded` is proNudge.mjs onboardedRecently for this student on this device (GUIDE_AUTO_WINDOW_MS); `seen` is the guide's own seen mark;
 * `open` is the guide already running; `sheetOpen` is any dialog, sheet or the Pro sheet on screen.
 */
export function guideAutoStart({ onboarded = false, seen = true, path = '', open = false, sheetOpen = false } = {}) {
  const route = String(path || '').split(/[?#]/)[0];
  if (!onboarded || seen || open) return 'no';
  if (GUIDE_QUIET.some((p) => route === p || route.startsWith(`${p}/`))) return 'no';
  if (!GUIDE_AUTO_PAGES.includes(route)) return 'no';
  return sheetOpen ? 'wait' : 'start';
}
