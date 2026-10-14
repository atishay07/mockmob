// The one navigation source for the website (web redesign W1.1, plan sections 5.2 and 5.3).
//
// Every menu reads from here: the public header and its mobile sheet, the mobile dock, the footer,
// the signed-in sidebar, the signed-in bottom bar, the More sheet, the Start sheet and the account
// menu. Labels follow the owner's decisions of 14 Oct 2026:
//   D1  the signed-in area has no brand name. It is Practice; the logo is Home.
//   D3  Practice first, Today second.
//   D10 plain names first, the brand name as a descriptor ("Weak chapters", Radar).
//   D11 Leaderboard, Contribute, My uploads and the practice rival stay, under More.
//   D12 Pricing stays in the header for everyone except Pro members.
//
// Pure data and functions (no React, no browser), so it is unit tested in data/tests.
// Keep ids stable: they are the data-tour targets and the keys the development previews use.
import { CAPABILITIES } from '../../data/capabilities.js';

export const PRACTICE_HREF = CAPABILITIES.practice.href; // '/dashboard'
export const REVIEW_HREF = CAPABILITIES.review.href; // '/review'
// The first scored session for a new member (state S3): ten questions, set up in Practice.
export const FIRST_CHECK_HREF = `${PRACTICE_HREF}?count=10`;
export const PLAN_HREF = '/profile#plan';
export const START_ON_HREF = '/profile#start-on';
export const HELP_HREF = '/contact';

// ---------------------------------------------------------------------------------------------
// Who is looking. `kind` is the visitor kind from data/visitor_state.mjs (new | returning | member),
// `plan` is free | pro, and `stage` is 'first' while a member has no scored session yet (state S3;
// the hint flag is defined by W1.2 and read here, absent means "started").

/**
 * Which visitor state (plan section 4) a kind, plan and stage describe.
 * S1 first-time, S2 returning, S3 new member, S4 free member, S5 Pro member.
 */
export function visitorStateId({ kind, plan, stage } = {}) {
  if (kind === 'member') {
    if (stage === 'first') return 'S3';
    return plan === 'pro' ? 'S5' : 'S4';
  }
  return kind === 'returning' ? 'S2' : 'S1';
}

// `show` says who sees an item. The pages render every variant and <html data-visitor> picks one
// before first paint, so the class for each audience lives here too (styles in src/app/visitor.css).
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

/** Does someone in this state see an item meant for `show`? Mirrors the CSS in visitor.css. */
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
// Public header (marketing, SEO pages, pricing, tools). At most five top-level items per state.

export const DU_PLANNING_LINKS = Object.freeze([
  { id: 'cutoff', label: 'Cutoff calculator', href: '/cuet-cutoff-calculator' },
  { id: 'combinations', label: 'Subject combination planner', href: '/cuet-subject-combination' },
  { id: 'guide-2027', label: 'CUET 2027 guide', href: '/cuet-2027' },
]);

export const RESOURCE_LINKS = Object.freeze([
  { id: 'pyq', label: 'Previous year questions', href: '/cuet-previous-year-questions' },
  { id: 'online-tests', label: 'Online practice tests', href: '/cuet-practice-tests-online' },
  { id: 'english', label: 'English guide', href: '/cuet/english' },
  { id: 'accountancy', label: 'Accountancy guide', href: '/cuet/accountancy' },
  { id: 'economics', label: 'Economics guide', href: '/cuet/economics' },
  { id: 'business-studies', label: 'Business Studies guide', href: '/cuet/business-studies' },
  { id: 'about', label: 'About', href: '/about' },
  { id: 'contact', label: 'Contact', href: '/contact' },
]);

export const PUBLIC_NAV = Object.freeze([
  { id: 'free-test', label: 'Free mock test', href: '/cuet-mock-test-free', show: 'guest' },
  { id: 'practice', label: 'Practice', href: PRACTICE_HREF, show: 'member' },
  { id: 'du', label: 'DU cutoffs and eligibility', items: DU_PLANNING_LINKS, show: 'all' },
  { id: 'what-you-get', label: 'What you get', href: '/#your-prep', show: 'guest' },
  { id: 'review', label: 'Review', href: REVIEW_HREF, show: 'member' },
  { id: 'pricing', label: 'Pricing', href: '/pricing', show: 'notPro' },
  { id: 'resources', label: 'Resources', items: RESOURCE_LINKS, show: 'all' },
]);

/** The top-level public items someone in this state sees, in order. */
export function publicNavFor(visitor = {}) {
  return PUBLIC_NAV.filter((item) => audienceIncludes(item.show, visitor));
}

// The header's action buttons. All variants are rendered; CSS picks one set.
export const HEADER_ACTIONS = Object.freeze([
  { id: 'login', label: 'Log in', href: '/login', variant: 'text', show: 'newGuest' },
  { id: 'signup', label: 'Start free', href: '/signup', variant: 'primary', show: 'newGuest' },
  { id: 'signup-returning', label: 'Start free', href: '/signup', variant: 'text', show: 'returningGuest' },
  { id: 'login-returning', label: 'Log in', href: '/login', variant: 'primary', show: 'returningGuest' },
  { id: 'first-check', label: 'Start your 10-question check', href: FIRST_CHECK_HREF, variant: 'primary', show: 'memberFirst' },
  { id: 'continue', label: 'Continue practice', href: PRACTICE_HREF, variant: 'primary', show: 'memberStarted' },
]);

/**
 * Every header action the page renders, with a saved test applied. `resume` is a saved test
 * (findResumableTest): it replaces Continue practice for every member and takes the place of Start
 * your 10-question check too, so a member with a saved test and no scored session sees Resume (S3 plus
 * resume), the same as the mobile dock. The header renders this list and <html data-visitor>
 * (visitor.css) picks the visible ones.
 */
export function renderedHeaderActions(resume = null) {
  if (!resume) return HEADER_ACTIONS;
  return HEADER_ACTIONS
    .filter((action) => action.id !== 'first-check')
    .map((action) => (action.id === 'continue'
      ? { ...action, id: 'resume', label: 'Resume your test', href: resume.href, show: 'member' }
      : action));
}

/** The header actions one visitor state sees, with the one primary action last. */
export function headerActionsFor(visitor = {}, resume = null) {
  return renderedHeaderActions(resume).filter((action) => audienceIncludes(action.show, visitor));
}

/**
 * The dock actions for a member, all variants (the dock renders them and CSS picks one): Resume
 * your test while a saved test exists, else Start your 10-question check before the first scored
 * session (the label the day-one hero, closing line and header use), else Continue practice.
 */
export function memberDockActions(resume = null) {
  if (resume) return [{ id: 'resume', label: 'Resume your test', href: resume.href, show: 'member' }];
  return [
    { id: 'first-check', label: 'Start your 10-question check', href: FIRST_CHECK_HREF, show: 'memberFirst' },
    { id: 'continue', label: 'Continue practice', href: PRACTICE_HREF, show: 'memberStarted' },
  ];
}

/** The one action the mobile dock carries for a member in a given stage. */
export function memberPrimaryAction({ stage, resume } = {}) {
  const visitor = { kind: 'member', stage };
  return memberDockActions(resume).find((action) => audienceIncludes(action.show, visitor));
}

// ---------------------------------------------------------------------------------------------
// Footer. Guests see the columns they always had; members get their own column first.

export const FOOTER_MEMBER_LINKS = Object.freeze([
  { id: 'dashboard', label: 'Practice', href: PRACTICE_HREF },
  { id: 'today', label: 'Today', href: '/today' },
  { id: 'review', label: 'Review', href: REVIEW_HREF },
  { id: 'profile', label: 'Account', href: '/profile' },
]);

export const FOOTER_COLUMNS = Object.freeze([
  {
    id: 'practice',
    label: 'Practice',
    links: [
      { label: 'DU eligibility and cutoff calculator', href: '/cuet-cutoff-calculator' },
      { label: 'CUET subject combination planner', href: '/cuet-subject-combination' },
      { label: 'Free CUET mock test', href: '/cuet-mock-test-free' },
      { label: 'Previous year questions', href: '/cuet-previous-year-questions' },
      { label: 'Online practice tests', href: '/cuet-practice-tests-online' },
      { label: 'Features', href: '/features' },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  {
    id: 'subjects',
    label: 'Subjects',
    links: [
      { label: 'English', href: '/cuet/english' },
      { label: 'Accountancy', href: '/cuet/accountancy' },
      { label: 'Economics', href: '/cuet/economics' },
      { label: 'Business Studies', href: '/cuet/business-studies' },
      { label: 'CUET 2027 guide', href: '/cuet-2027' },
    ],
  },
  {
    id: 'company',
    label: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Refunds', href: '/refunds' },
    ],
  },
]);

// ---------------------------------------------------------------------------------------------
// Signed-in navigation. One list for every member; it never changes with state (principle 4).

const app = (id, label, icon, href = `/${id}`, extra = {}) => Object.freeze({ id, label, icon, href, ...extra });

// Primary tabs: the bottom bar on phones, the top of the sidebar on desktop. Learn only while the
// study content is switched on.
export const APP_PRIMARY = Object.freeze([
  app('dashboard', 'Practice', 'practice', PRACTICE_HREF),
  app('today', 'Today', 'today'),
  app('review', 'Review', 'review', REVIEW_HREF),
  app('learn', 'Learn', 'learn', '/learn', { studyOnly: true }),
]);

export const APP_GROUPS = Object.freeze([
  {
    id: 'plan',
    label: 'Plan',
    items: [
      app('analytics', 'Weak chapters', 'radar', '/analytics', { descriptor: 'Radar' }),
      app('admission-compass', 'DU Compass', 'compass'),
      app('combinations', 'Subject combinations', 'combinations', '/cuet-subject-combination'),
      app('mentor', 'Ask about your record', 'prepos', '/mentor', { descriptor: 'PrepOS', hideInTest: true }),
    ],
  },
  {
    id: 'tools',
    label: 'Study tools',
    collapsed: true,
    items: [
      app('explore', 'Explore questions', 'explore'),
      app('saved', 'Saved', 'saved'),
      app('progress', 'Progress', 'progress'),
    ],
  },
  {
    id: 'more',
    label: 'More',
    collapsed: true,
    items: [
      app('leaderboard', 'Leaderboard', 'ranks'),
      app('upload', 'Contribute', 'contribute'),
      app('my-uploads', 'My uploads', 'uploads'),
      app('rival', 'Practice rival', 'rival'),
    ],
  },
]);

export const MODERATION_GROUP = Object.freeze({ id: 'moderation', label: 'Moderation', items: [app('moderation', 'Mod queue', 'moderation')] });

/**
 * The signed-in menu for this member. `studyEnabled` shows Learn; `moderator` adds the moderation
 * group; `testRoute` hides the assistant (it must not open during a timed test).
 */
export function appNavigation({ studyEnabled = false, moderator = false, testRoute = false } = {}) {
  const keep = (item) => (studyEnabled || !item.studyOnly) && !(testRoute && item.hideInTest);
  return {
    primary: APP_PRIMARY.filter(keep),
    groups: [
      ...(moderator ? [MODERATION_GROUP] : []),
      ...APP_GROUPS.map((group) => ({ ...group, items: group.items.filter(keep) })),
    ],
  };
}

/** Every destination in a navigation, primary first. */
export const allDestinations = (nav) => [...nav.primary, ...nav.groups.flatMap((group) => group.items)];

/** Is this item the page at `path`? Matches the route and anything below it, never a prefix of a word. */
export function isActivePath(path, item) {
  const href = String(item?.href || '').split(/[?#]/)[0];
  if (!path || !href || href === '/') return false;
  return path === href || path.startsWith(`${href}/`);
}

/** The heading the top bar shows for a path, or '' when the page has no menu entry. */
export function titleForPath(path, nav) {
  const hit = allDestinations(nav).find((item) => isActivePath(path, item));
  if (hit) return hit.label;
  if (String(path || '').startsWith('/result')) return 'Result';
  return '';
}

/** A label with its brand descriptor, for places that have one line only (aria labels, titles). */
export const fullLabel = (item) => (item?.descriptor ? `${item.label} (${item.descriptor})` : item?.label || '');

// ---------------------------------------------------------------------------------------------
// The Start sheet: the quick ways into a session. Each goes to Practice set up for it, where the
// cost and time are shown on the confirm line before anything is spent.

export function startActions({ resume = null, plan = 'free', recoveryAvailable = CAPABILITIES.recovery.state === 'available' } = {}) {
  const pro = plan === 'pro';
  return [
    ...(resume ? [{ id: 'resume', label: 'Resume your test', detail: `${resume.minutesLeft} min left. Your answers are saved on this device.`, href: resume.href }] : []),
    { id: 'quick', label: 'Quick 10', detail: '10 questions, about 10 minutes', href: `${PRACTICE_HREF}?mode=quick&count=10` },
    { id: 'full', label: 'Full mock', detail: '50 questions, 60 minutes', href: `${PRACTICE_HREF}?mode=full` },
    { id: 'repair', label: 'Repair the next mistake', detail: 'Go back to a question you missed', href: recoveryAvailable ? CAPABILITIES.recovery.href : REVIEW_HREF },
    { id: 'nta', label: 'NTA mode', detail: '50 questions, 60 minutes, exam-style screen', href: `${PRACTICE_HREF}?mode=nta&interface=nta`, tag: pro ? null : 'Pro' },
  ];
}

// ---------------------------------------------------------------------------------------------
// The account menu: the one home of account things (Profile and Sign out leave the main lists).

export function accountMenu({ plan = 'free', guide = false } = {}) {
  const pro = plan === 'pro';
  return [
    { id: 'account', label: 'Account', href: '/profile' },
    { id: 'plan', label: pro ? 'Plan status' : 'Plan and credits', href: PLAN_HREF },
    ...(pro ? [] : [{ id: 'upgrade', label: 'Go Pro', href: '/pricing' }]),
    { id: 'start-on', label: 'Start on', href: START_ON_HREF },
    ...(guide ? [{ id: 'guide', label: 'Guide', action: 'guide' }] : []),
    { id: 'help', label: 'Help', href: HELP_HREF },
  ];
}

const money = (n) => (Number.isFinite(Number(n)) ? Math.max(0, Math.trunc(Number(n))) : 0);

/** The plain plan line under the name in the account menu. Nothing is guessed before the session is confirmed. */
export function planLine(user, { locale = 'en-IN' } = {}) {
  if (!user) return '';
  if (user.isPremium) {
    const until = user.premiumUntil ? new Date(user.premiumUntil) : null;
    if (until && !Number.isNaN(until.getTime())) {
      return `Pro until ${until.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}`;
    }
    return 'Pro';
  }
  if (!('creditBalance' in user)) return 'Free plan';
  const credits = money(user.creditBalance);
  return `Free plan, ${credits} practice credit${credits === 1 ? '' : 's'} left`;
}

// ---------------------------------------------------------------------------------------------
// The auth gate for the signed-in shell (plan section 6, fix 1).
//
//   ready        the session is confirmed: render the page
//   pending      the first check is still running: render the real shell with a page skeleton.
//                Members (by the stored hint) see it straight away; anyone else sees the session
//                screen, picked by CSS from <html data-visitor> so the server HTML is the same
//   checking     confirmed, but this page needs a role the account lacks; it is being redirected
//   unavailable  signed in, but MockMob could not be reached: the shell with "Can't reach MockMob"
//   signedOut    confirmed signed out: send them to log in. Nothing private ever renders before ready.

export function shellGate({ status, path = '', moderator = false } = {}) {
  if (status === 'authenticated') {
    return String(path).startsWith('/moderation') && !moderator ? 'checking' : 'ready';
  }
  if (status === 'unauthenticated') return 'signedOut';
  if (status === 'unavailable') return 'unavailable';
  return 'pending';
}
