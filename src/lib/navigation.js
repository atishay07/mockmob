// The one navigation source for the website (web IA plan sections 2 and 6, 15 Oct 2026).
//
// The signed-in website has the app's places, in the app's order: Today, Practice, Start, Review,
// You (phone bar), with Start as an action that opens the Start sheet, never a page. The public
// header, footer and phone dock read from here too. Labels follow the glossary (data/glossary.mjs):
// where the app already has a name, the website adopts it.
//
// Logic ported from mockmob-web2 feat/web-redesign-p2 at ea69c5d5 (audience classes, shellGate,
// startActions), relabelled. Its sidebar and styling were not ported.
//
// Pure data and functions (no React, no browser), unit tested in data/tests/navigation.test.mjs.
// Keep ids stable: they are data-tour targets and the keys the development previews use.
import { CAPABILITIES, mistakeRepairReleased } from '../../data/capabilities.js';
import { confirmLine, repairCostLine, creditLines, creditPopoverLines, PLAN_FACTS } from '../../data/plan_facts.mjs';
import { PUBLIC_SUBJECTS, subjectName } from '../../data/subject_art.mjs';
import { practiceHref } from '../../data/next_step_rules.mjs';
import { placeForPath as movePlaceForPath, moveForPath } from '../../data/route_moves.mjs';

export { creditLines, creditPopoverLines };

export const TODAY_HREF = '/today';
export const PRACTICE_HREF = CAPABILITIES.practice.href; // '/dashboard' (/practice rewrites to it in IA9)
export const REVIEW_HREF = CAPABILITIES.review.href; // '/review'
export const YOU_HREF = '/you';
export const RECORD_HREF = '/analytics';
// /ask rewrites here once IA9 wires it; the app's ActionRouter already maps this form to Ask.
export const ASK_HREF = '/mentor?tab=ask';
export const SUBJECTS_EDIT_HREF = '/onboarding?edit=true';
export const ACCOUNT_HREF = '/profile';
export const PLAN_HREF = '/profile#plan';
export const START_ON_HREF = '/profile#start-on';
export const HELP_HREF = '/contact';
export const NON_AFFILIATION_LINE = 'Not affiliated with NTA or DU.';

// ---------------------------------------------------------------------------------------------
// Who is looking (ported). `kind` is new | returning | member, `plan` is free | pro, `stage` is
// 'first' while a member has no scored session yet. <html data-visitor> carries the kind before
// first paint (set by the theme init script in src/app/layout.js, IA1), so every variant can be
// rendered on the server and CSS picks one without a flash.

export const VISITOR_KEY = 'mm:visitor:v1';

/** Reads the stored hint. Anything unexpected is treated as no hint. Holds no personal data. */
export function parseVisitorHint(raw) {
  try {
    const hint = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (hint?.kind === 'member') {
      const started = hint.started === true ? true : hint.started === false ? false : null;
      return { kind: 'member', plan: hint.plan === 'pro' ? 'pro' : 'free', started };
    }
    if (hint?.kind === 'returning') return { kind: 'returning', plan: null, started: null };
  } catch { /* corrupt value */ }
  return { kind: 'new', plan: null, started: null };
}

/** S1 first-time, S2 returning, S3 new member, S4 free member, S5 Pro member. */
export function visitorStateId({ kind, plan, stage } = {}) {
  if (kind === 'member') {
    if (stage === 'first') return 'S3';
    return plan === 'pro' ? 'S5' : 'S4';
  }
  return kind === 'returning' ? 'S2' : 'S1';
}

export const AUDIENCE_CLASS = Object.freeze({
  all: '',
  guest: 'vs-guest-only',
  member: 'vs-member-only',
  notPro: 'vs-hide-pro',
  memberFirst: 'vs-member-only vs-first-only',
  memberStarted: 'vs-member-only vs-started-only',
  newGuest: 'vs-new-only',
  returningGuest: 'vs-returning-only',
});

export function audienceClass(show = 'all') {
  return AUDIENCE_CLASS[show] ?? '';
}

/** Does someone in this state see an item meant for `show`? Mirrors the audience CSS. */
export function audienceIncludes(show = 'all', visitor = {}) {
  const member = visitor.kind === 'member';
  const first = member && visitor.stage === 'first';
  switch (show) {
    case 'guest': return !member;
    case 'member': return member;
    case 'notPro': return !(member && visitor.plan === 'pro');
    case 'memberFirst': return first;
    case 'memberStarted': return member && !first;
    case 'newGuest': return !member && visitor.kind !== 'returning';
    case 'returningGuest': return visitor.kind === 'returning';
    default: return true;
  }
}

// ---------------------------------------------------------------------------------------------
// "Start on": where a signed-in student lands on mockmob.in (N1: Today by default).

export const START_ON_KEY = 'mm:start-on:v1';
export const START_ON_OPTIONS = Object.freeze([
  Object.freeze({ id: 'today', label: 'Today', href: TODAY_HREF }),
  Object.freeze({ id: 'practice', label: 'Practice', href: PRACTICE_HREF }),
]);
export const DEFAULT_START_ON = 'today';

export function startOnHref(id) {
  return (START_ON_OPTIONS.find((o) => o.id === id) || START_ON_OPTIONS[0]).href;
}

// ---------------------------------------------------------------------------------------------
// The signed-in shell: four places and the Start key (plan 2.1).

const place = (id, label, icon, href) => Object.freeze({ id, label, icon, href });
export const PLACES = Object.freeze({
  today: place('today', 'Today', 'today', TODAY_HREF),
  practice: place('practice', 'Practice', 'practice', PRACTICE_HREF),
  review: place('review', 'Review', 'review', REVIEW_HREF),
  you: place('you', 'You', 'you', YOU_HREF),
});
export const START_KEY = Object.freeze({ id: 'start', label: 'Start', icon: 'start', action: 'start-sheet' });

// Phone under 768 px: the app's bottom bar, Start raised in the middle. Tablet and desktop: Start first.
export const SHELL_ORDER = Object.freeze({
  phone: Object.freeze(['today', 'practice', 'start', 'review', 'you']),
  rail: Object.freeze(['start', 'today', 'practice', 'review', 'you']),
  sidebar: Object.freeze(['start', 'today', 'practice', 'review', 'you']),
});
export const SHELL_BREAKPOINTS = Object.freeze({ rail: 768, sidebar: 1024 });
export const SHELL_WIDTHS = Object.freeze({ rail: 76, sidebar: 232 });

/** The shell layout for a viewport width. */
export function shellLayout(width) {
  if (width >= SHELL_BREAKPOINTS.sidebar) return 'sidebar';
  if (width >= SHELL_BREAKPOINTS.rail) return 'rail';
  return 'phone';
}

/** The shell's items for a layout, in order: the four places and the Start key. */
export function shellItems(layout = 'phone') {
  return (SHELL_ORDER[layout] || SHELL_ORDER.phone).map((id) => (id === 'start' ? START_KEY : PLACES[id]));
}

// What each place holds (plan 2.2). `kind`: page (a link), section (an anchor on the place's own
// page) or action (handled by the shell). `show`: studyOnly, moderator, pro, notPro.
const dest = (id, label, href, extra = {}) => Object.freeze({ id, label, href, kind: href ? 'page' : 'action', ...extra });

export const PLACE_CONTENTS = Object.freeze({
  today: Object.freeze([
    dest('move', "Tonight's move", '/today#move', { kind: 'section' }),
    dest('week', 'Your week', '/today#week', { kind: 'section' }),
    dest('finding', 'Where your marks go', '/today#finding', { kind: 'section' }),
    dest('sheet', 'Finish your sheet', SUBJECTS_EDIT_HREF),
    dest('road', 'The road to May', '/today#road', { kind: 'section' }),
  ]),
  practice: Object.freeze([
    dest('quick', 'Quick practice', practiceHref({ mode: 'quick', count: 10 })),
    dest('full', 'Full mock', practiceHref({ mode: 'full' })),
    dest('nta', 'NTA mode', `${PRACTICE_HREF}?mode=nta&interface=nta`, { tag: 'Pro' }),
    dest('smart', 'Smart practice', practiceHref({ mode: 'smart' }), { tag: 'Pro' }),
    dest('subjects', 'Edit subjects', SUBJECTS_EDIT_HREF),
    dest('explore', 'Question stream', '/explore'),
    dest('learn', 'Concepts', '/learn', { show: 'studyOnly' }),
  ]),
  review: Object.freeze([
    dest('ask', 'Ask Mobi', ASK_HREF),
    dest('mistakes', 'Mistakes to repair', '/review#mistakes', { kind: 'section' }),
    dest('analytics', 'Your record', RECORD_HREF),
    dest('results', 'Past results', '/review#results', { kind: 'section' }),
    dest('saved', 'Saved questions', '/saved'),
    dest('repair-record', 'Repair record', '/review#repair-record', { kind: 'section' }),
  ]),
  you: Object.freeze([
    dest('sheet', 'Your sheet', SUBJECTS_EDIT_HREF),
    dest('week', 'Your week and goal', '/you#week', { kind: 'section' }),
    dest('plan', 'Plan and credits', PLAN_HREF),
    dest('progress', 'Milestones and personal bests', '/you#progress', { kind: 'section' }),
    dest('admission-compass', 'Cutoff calculator', '/admission-compass', { group: 'CUET tools' }),
    dest('combinations', 'Combo planner', '/cuet-subject-combination', { group: 'CUET tools' }),
    dest('guide-2027', 'CUET 2027 guide', '/cuet-2027', { group: 'CUET tools' }),
    dest('appearance', 'Appearance', '/profile#appearance', { group: 'Settings' }),
    dest('start-on', 'Start on', START_ON_HREF, { group: 'Settings' }),
    dest('privacy', 'Privacy', '/profile#privacy', { group: 'Settings' }),
    dest('account', 'Account', ACCOUNT_HREF, { group: 'Settings' }),
    dest('sign-out', 'Sign out', null, { group: 'Settings', action: 'sign-out' }),
    dest('delete', 'Delete account', '/account-deletion', { group: 'Settings' }),
    dest('leaderboard', 'Leaderboard', '/leaderboard', { group: 'Community', webOnly: true }),
    dest('upload', 'Contribute questions', '/upload', { group: 'Community', webOnly: true }),
    dest('my-uploads', 'Your submissions', '/upload?tab=mine', { group: 'Community', webOnly: true }),
    dest('guide', 'Replay the guide', null, { group: 'Help', action: 'guide' }),
    dest('contact', 'Contact', HELP_HREF, { group: 'Help' }),
    dest('moderation', 'Moderation', '/moderation', { show: 'moderator' }),
  ]),
});

/** A place's contents for this student. */
export function placeContents(placeId, { studyEnabled = false, moderator = false } = {}) {
  return (PLACE_CONTENTS[placeId] || []).filter((item) => (item.show !== 'studyOnly' || studyEnabled) && (item.show !== 'moderator' || moderator));
}

const pathOnly = (path) => String(path || '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';

/** Focus mode: the runner hides all chrome. Everything else shows the shell. */
export function chromeFor(path) {
  return pathOnly(path) === '/test' || pathOnly(path).startsWith('/test/') ? 'focus' : 'full';
}

/** The place a signed-in path belongs to (today | practice | review | you), or null. /result opens over Review. */
export function placeForPath(path) {
  const p = pathOnly(path);
  if (p === '/test' || p.startsWith('/test/')) return null;
  const hit = movePlaceForPath(p);
  return ['today', 'practice', 'review', 'you'].includes(hit) ? hit : null;
}

/** Is `placeId` the active place for this path? */
export function isActivePlace(path, placeId) {
  return placeForPath(path) === placeId;
}

/** The phone header title for a path: the page's own name where the plan gives one, else its place. */
export function titleForPath(path) {
  const p = pathOnly(path);
  if (p.startsWith('/result/')) return 'Result';
  const move = moveForPath(p);
  if (move?.title) return move.title;
  const id = placeForPath(p);
  return id ? PLACES[id].label : '';
}

/** Paths that need a signed-in session. The landing and public pages never link to these (plan 3). */
export function isSignedInPath(href) {
  const p = pathOnly(href);
  if (p === '/test' || p.startsWith('/result/')) return true;
  if (['/admission-compass', '/onboarding', '/moderation', '/rival', '/upload', '/my-uploads', '/leaderboard', '/profile', '/progress'].includes(p)) return true;
  const hit = moveForPath(p)?.place;
  return ['today', 'practice', 'review', 'you', 'start'].includes(hit) && !['/cuet-subject-combination', '/cuet-2027'].includes(p);
}

/** The Review badge: real count of mistakes in tonight's repair only. null for 0, "9+" above 9. */
export function reviewBadge(count) {
  const n = Math.trunc(Number(count) || 0);
  if (n <= 0) return null;
  return n > 9 ? '9+' : String(n);
}

// ---------------------------------------------------------------------------------------------
// The auth gate for the signed-in shell (ported).
//   ready        the session is confirmed: render the page
//   pending      the first check is still running: paint the shell from the stored hint with a
//                skeleton. Nothing private renders before the session is confirmed
//   checking     confirmed, but this page needs a role the account lacks; it is being redirected
//   unavailable  signed in, but MockMob could not be reached: the shell with "Can't reach MockMob"
//   signedOut    confirmed signed out: send them to log in

export function shellGate({ status, path = '', moderator = false } = {}) {
  if (status === 'authenticated') {
    return String(path).startsWith('/moderation') && !moderator ? 'checking' : 'ready';
  }
  if (status === 'unauthenticated') return 'signedOut';
  if (status === 'unavailable') return 'unavailable';
  return 'pending';
}

// ---------------------------------------------------------------------------------------------
// The Start sheet (plan 2.2, DOCK.md 6): at most 5 rows. A row opens a confirm line with a Start
// button; nothing is spent on the first tap. The hero row is Resume, or Tonight's move.

/**
 * @param {object} o
 * @param {object|null} o.move     nextMove() from data/next_step_rules.mjs (the hero), or null
 * @param {object|null} o.resume   { href, label, minutesLeft } of an open session, or null
 * @param {'free'|'pro'} o.plan
 * @param {number|null} o.balance  practice credits, null when unknown
 * @param {number|null} o.aiBalance AI credits, null when unknown
 * @param {string[]} o.subjects    the student's subject ids, in sheet order (chips for Quick 10)
 * @param {string|null} o.repairAttemptId the attempt holding the next mistake to repair, or null
 * @param {boolean} o.mistakeRepair the capability (defaults to CAPABILITIES.mistakeRepair)
 */
export function startActions({ move = null, resume = null, plan = 'free', balance = null, aiBalance = null, subjects = [], repairAttemptId = null,
  mistakeRepair = CAPABILITIES.mistakeRepair?.state === 'available' } = {}) {
  const pro = plan === 'pro';
  const rows = [];
  if (resume?.href) {
    rows.push({ id: 'resume', label: resume.label || 'Resume your session', detail: Number.isFinite(resume.minutesLeft) ? `${resume.minutesLeft} min left. Your answers are saved on this device.` : 'Your answers are saved on this device.',
      href: resume.href, cta: 'Resume', confirm: null, hero: true });
  } else if (move?.primary?.href) {
    rows.push({ id: 'move', label: move.title, detail: move.label, href: move.primary.href, cta: move.primary.label, confirm: move.cost || null, hero: true });
  }
  const chips = subjects.slice(0, 5).map((id) => ({ id, label: subjectName(id), href: practiceHref({ subject: id, mode: 'quick', count: 10 }) }));
  rows.push({ id: 'quick', label: 'Quick 10', detail: `10 questions, about 10 minutes`, chips,
    href: chips[0]?.href || practiceHref({ mode: 'quick', count: 10 }), cta: 'Start', confirm: confirmLine({ mode: 'quick', count: 10, pro, balance }) });
  rows.push({ id: 'full', label: 'Full mock', detail: `${PLAN_FACTS.sessions.fullQuestions.value} questions, ${PLAN_FACTS.sessions.fullMinutes.value} minutes`,
    href: practiceHref({ subject: subjects[0] || null, mode: 'full' }), cta: 'Start', confirm: confirmLine({ mode: 'full', pro, balance }) });
  rows.push({ id: 'nta', label: 'NTA mode', detail: `${PLAN_FACTS.sessions.ntaQuestions.value} questions, ${PLAN_FACTS.sessions.ntaMinutes.value} minutes, exam-style screen`,
    href: `${PRACTICE_HREF}?mode=nta&interface=nta`, tag: pro ? null : 'Pro', cta: pro ? 'Start' : 'See Pro', confirm: pro ? 'Included with Pro.' : 'Comes with Pro.' });
  if (mistakeRepair) {
    rows.push({ id: 'repair', label: 'Repair the next mistake', detail: 'Why it was wrong, and the rule to remember',
      href: repairAttemptId ? `/result/${encodeURIComponent(repairAttemptId)}` : REVIEW_HREF, cta: 'Start', confirm: repairCostLine({ aiBalance }) });
  }
  return rows.slice(0, 5);
}

export const START_SHEET_FOOTER = Object.freeze({ label: 'Choose your own in Practice', href: PRACTICE_HREF });

/** /start?row=resume|quick|repair opens the sheet with that row's confirm line (mirrors the app's /start). */
export function startRowFromQuery(row) {
  const value = String(row || '');
  if (value === 'resume') return 'resume';
  if (value === 'quick' || value === 'repair' || value === 'full' || value === 'nta') return value;
  return null;
}

// ---------------------------------------------------------------------------------------------
// Public header, phone dock and footer (plan 2.3).

export const FREE_TOOLS = Object.freeze([
  Object.freeze({ id: 'cutoff', label: 'Cutoff calculator', href: '/cuet-cutoff-calculator', detail: 'Which DU courses your subjects open, with last year’s cutoffs' }),
  Object.freeze({ id: 'combinations', label: 'Combo planner', href: '/cuet-subject-combination', detail: 'Which CUET subjects to take' }),
  Object.freeze({ id: 'guide-2027', label: 'CUET 2027 guide', href: '/cuet-2027' }),
]);

export const PUBLIC_NAV = Object.freeze([
  Object.freeze({ id: 'how', label: 'How it works', href: '/#how-it-works', show: 'guest' }),
  Object.freeze({ id: 'subjects', label: 'Subjects', href: '/#subjects', show: 'guest' }),
  Object.freeze({ id: 'tools', label: 'Free tools', items: FREE_TOOLS, show: 'all' }),
  Object.freeze({ id: 'pricing', label: 'Pricing', href: '/pricing', show: 'notPro' }),
]);

export function publicNavFor(visitor = {}) {
  return PUBLIC_NAV.filter((item) => audienceIncludes(item.show, visitor));
}

// Every variant is rendered; <html data-visitor> picks one before first paint.
export const HEADER_ACTIONS = Object.freeze([
  Object.freeze({ id: 'login', label: 'Log in', href: '/login', variant: 'text', show: 'newGuest' }),
  Object.freeze({ id: 'signup', label: 'Start free', href: '/signup', variant: 'primary', show: 'newGuest' }),
  Object.freeze({ id: 'signup-returning', label: 'Start free', href: '/signup', variant: 'text', show: 'returningGuest' }),
  Object.freeze({ id: 'login-returning', label: 'Log in', href: '/login', variant: 'primary', show: 'returningGuest' }),
  Object.freeze({ id: 'open', label: 'Open MockMob', href: TODAY_HREF, variant: 'primary', show: 'member' }),
]);

/** The header actions one visitor state sees, primary last. */
export function headerActionsFor(visitor = {}) {
  return HEADER_ACTIONS.filter((action) => audienceIncludes(action.show, visitor));
}

/** The sticky public dock on phones. On article pages it goes to the sample on the landing. */
export const PUBLIC_DOCK = Object.freeze({ id: 'try', label: `Try ${PLAN_FACTS.sessions.sampleQuestions.value} questions`, href: '/#try' });

export const FOOTER_COLUMNS = Object.freeze([
  Object.freeze({ id: 'tools', label: 'Free tools', links: FREE_TOOLS.map(({ label, href }) => Object.freeze({ label, href })) }),
  Object.freeze({ id: 'guides', label: 'Guides', links: Object.freeze([
    Object.freeze({ label: 'Free CUET mock test', href: '/cuet-mock-test-free' }),
    Object.freeze({ label: 'CUET previous year paper pattern', href: '/cuet-previous-year-questions' }),
    Object.freeze({ label: 'Online practice tests', href: '/cuet-practice-tests-online' }),
  ]) }),
  // All 15 subjects; a subject links only where its hub exists.
  Object.freeze({ id: 'subjects', label: 'Subjects', links: PUBLIC_SUBJECTS.map((s) => Object.freeze({ label: s.name, href: s.hub })) }),
  Object.freeze({ id: 'company', label: 'Company', links: Object.freeze([
    Object.freeze({ label: 'About', href: '/about' }),
    Object.freeze({ label: 'Contact', href: '/contact' }),
    Object.freeze({ label: 'Pricing', href: '/pricing' }),
    Object.freeze({ label: 'Privacy', href: '/privacy' }),
    Object.freeze({ label: 'Terms', href: '/terms' }),
    Object.freeze({ label: 'Refunds', href: '/refunds' }),
    Object.freeze({ label: 'Account deletion', href: '/account-deletion' }),
  ]) }),
]);

// ---------------------------------------------------------------------------------------------
// Legacy shape for the current shell (src/app/(app)/AppLayoutClient.jsx) until IA1 replaces it:
// grouped by place, same item ids, relabelled. src/lib/arenaNavigation.js re-exports these.

const legacy = (id, label, icon = id, href = `/${id}`) => Object.freeze({ id, label, icon, href });
export const LEGACY_STUDY_NAV = Object.freeze([
  legacy('today', 'Today'),
  legacy('dashboard', 'Practice', 'practice', PRACTICE_HREF),
  legacy('learn', 'Concepts', 'learn'),
  legacy('review', 'Review', 'review', REVIEW_HREF),
  legacy('explore', 'Question stream', 'explore'),
  legacy('saved', 'Saved questions', 'saved'),
  legacy('progress', 'Your week', 'progress'),
]);

export function legacyArenaNavigation(moderator = false) {
  const pick = (ids) => ids.map((id) => LEGACY_STUDY_NAV.find((tab) => tab.id === id));
  return [
    ...(moderator ? [{ label: 'Moderation', items: [legacy('moderation', 'Moderation', 'moderation')] }] : []),
    { label: 'Today', items: pick(['today']) },
    { label: 'Practice', items: pick(['dashboard', 'explore', 'learn']) },
    { label: 'Review', items: [...pick(['review']), legacy('analytics', 'Your record', 'radar'), ...pick(['saved']), legacy('mentor', 'Ask Mobi', 'prepos')] },
    { label: 'You', items: [legacy('profile', 'Account', 'account'), ...pick(['progress']), legacy('admission-compass', 'Cutoff calculator', 'compass'),
      legacy('leaderboard', 'Leaderboard', 'ranks'), legacy('upload', 'Contribute questions', 'contribute'), legacy('my-uploads', 'Your submissions', 'uploads')] },
  ];
}

export const LEGACY_MOBILE_STUDY_NAV = Object.freeze(LEGACY_STUDY_NAV.filter((tab) => ['today', 'dashboard', 'learn', 'review'].includes(tab.id)));

/** Every href the navigation emits, for the "resolves to a page or a move" test. */
export function allNavigationHrefs({ studyEnabled = true, moderator = true } = {}) {
  const hrefs = new Set();
  for (const p of Object.values(PLACES)) hrefs.add(p.href);
  for (const id of Object.keys(PLACE_CONTENTS)) for (const item of placeContents(id, { studyEnabled, moderator })) if (item.href) hrefs.add(item.href);
  for (const item of PUBLIC_NAV) { if (item.href) hrefs.add(item.href); for (const sub of item.items || []) hrefs.add(sub.href); }
  for (const a of HEADER_ACTIONS) hrefs.add(a.href);
  for (const col of FOOTER_COLUMNS) for (const link of col.links) if (link.href) hrefs.add(link.href);
  for (const o of START_ON_OPTIONS) hrefs.add(o.href);
  hrefs.add(PUBLIC_DOCK.href);
  hrefs.add(START_SHEET_FOOTER.href);
  for (const tab of LEGACY_STUDY_NAV) hrefs.add(tab.href);
  for (const group of legacyArenaNavigation(true)) for (const tab of group.items) hrefs.add(tab.href);
  return [...hrefs];
}

/** Every user-visible label the navigation holds, for the glossary and copy tests. */
export function allNavigationLabels() {
  const out = [];
  const push = (v) => { if (typeof v === 'string' && v) out.push(v); };
  for (const p of Object.values(PLACES)) push(p.label);
  push(START_KEY.label);
  for (const list of Object.values(PLACE_CONTENTS)) for (const item of list) { push(item.label); push(item.group); push(item.tag); }
  for (const item of PUBLIC_NAV) { push(item.label); for (const sub of item.items || []) { push(sub.label); push(sub.detail); } }
  for (const a of HEADER_ACTIONS) push(a.label);
  for (const col of FOOTER_COLUMNS) { push(col.label); for (const link of col.links) push(link.label); }
  for (const o of START_ON_OPTIONS) push(o.label);
  push(PUBLIC_DOCK.label); push(START_SHEET_FOOTER.label); push(NON_AFFILIATION_LINE);
  for (const tab of LEGACY_STUDY_NAV) push(tab.label);
  for (const group of legacyArenaNavigation(true)) { push(group.label); for (const tab of group.items) push(tab.label); }
  return out;
}

/** Is Mistake Repair offered on this deployment? (capability; the server stays the real gate). */
export function mistakeRepairOn() {
  return mistakeRepairReleased();
}
