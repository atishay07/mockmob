// The signed-in shell's pure rules (web IA plan 2.1, 2.2, 3 step 10; DOCK.md 3, 5, 6).
//
// No React and no browser globals, so data/tests/shell.test.mjs runs them under node --test. The
// components in this folder (Sidebar, Rail, Dock, StartSheet, CreditsChip, GuideTour) render what
// these functions return; navigation itself (places, titles, Start rows) lives in src/lib/navigation.js.
import { PLACES, START_SHEET_FOOTER, parseVisitorHint, reviewBadge, startActions } from '../../lib/navigation.js';
import { creditLines, creditPopoverLines } from '../../../data/plan_facts.mjs';
import { practiceHref } from '../../../data/next_step_rules.mjs';
import { subjectName } from '../../../data/subject_art.mjs';

export { reviewBadge };

// ---------------------------------------------------------------------------------------------
// Links. Inside the development preview the shell's links stay inside the preview: the preview
// passes previewLinks keyed by a route's first segment ('today', 'dashboard', 'review', 'you').

export function firstSegment(href) {
  return String(href || '').split(/[?#]/)[0].split('/').filter(Boolean)[0] || '';
}

/** The href to render: the preview's own link when one exists for this route, else the real href. */
export function linkFor(href, previewLinks = null) {
  if (!previewLinks) return href;
  return previewLinks[firstSegment(href)] || href;
}

// ---------------------------------------------------------------------------------------------
// The phone bar's lens (DOCK.md 3.1). Five slots: four tabs share the width, Start is fixed.
// The lens is a tab slot wide minus 4 px and slides under the Start key between the two halves.

export const BAR_ORDER = Object.freeze(['today', 'practice', 'start', 'review', 'you']);

/** { index, k, side } for the active place, or null when no tab is current (the lens hides). */
export function lensFor(placeId) {
  const index = BAR_ORDER.indexOf(placeId);
  if (index < 0 || placeId === 'start') return null;
  return index < 2 ? { index, k: index, side: 'left' } : { index, k: index - 1, side: 'right' };
}

// ---------------------------------------------------------------------------------------------
// Credits: two labelled lines on desktop, one labelled chip and a popover on phones (plan 2.1).

/** The sidebar lines, each split into the number and its words so the number can be set in figures. */
export function creditLineParts({ practiceBalance = null, aiRemaining = null, pro = false } = {}) {
  return creditLines({ practiceBalance, aiRemaining, pro }).map((line) => {
    const match = /^(\d+)\s+(.*)$/.exec(line.label);
    return match ? { id: line.id, count: match[1], words: match[2], label: line.label } : { id: line.id, count: null, words: line.label, label: line.label };
  });
}

/** The phone chip: one short labelled number. Practice credits for Free, AI credits for Pro. */
export function chipLabel({ practiceBalance = null, aiRemaining = null, pro = false } = {}) {
  const lines = creditLines({ practiceBalance, aiRemaining, pro });
  const practice = lines.find((l) => l.id === 'practice');
  if (practice) return practice.label.replace(' practice credit', ' credit');
  const ai = lines.find((l) => l.id === 'ai');
  return ai ? ai.label : null;
}

/** The chip's spoken name: every line, then what the button does. */
export function chipSpoken(input = {}) {
  const lines = creditLines(input).map((l) => l.label);
  return lines.length ? `Your credits: ${lines.join(', ')}. Show details` : 'Your credits. Show details';
}

/**
 * The popover lines. Extra (bonus) AI credits sit on their own line so the monthly line never reads
 * "68 of 50". `wallet` is the shape of src/services/credits/aiWalletState.js (known wallets only).
 */
export function popoverLines({ practiceBalance = null, wallet = null, pro = false } = {}) {
  const known = wallet?.known === true;
  const included = known && Number.isFinite(Number(wallet.includedRemaining)) ? Number(wallet.includedRemaining) : known ? Number(wallet.total) : null;
  const lines = creditPopoverLines({
    practiceBalance,
    aiRemaining: included,
    aiAllowance: known ? wallet.includedMonthlyCredits ?? null : null,
    resetAt: known ? wallet.resetAt || null : null,
    pro,
  });
  const bonus = known ? Math.max(0, Math.trunc(Number(wallet.bonusCredits) || 0)) : 0;
  if (bonus > 0) lines.push({ id: 'bonus', text: `Plus ${bonus} extra AI credit${bonus === 1 ? '' : 's'}.` });
  return lines;
}

/** The AI credits a student can spend now: included plus extra, or null when unknown. */
export function aiRemaining(wallet) {
  return wallet?.known === true && Number.isFinite(Number(wallet.total)) ? Math.max(0, Math.trunc(Number(wallet.total))) : null;
}

// ---------------------------------------------------------------------------------------------
// The Start sheet (plan 2.2; DOCK.md 6). Rows come from startActions(); the sheet adds the subject
// chip state, which Quick 10 and Full mock follow, and drops the repair row when the hero is a repair
// or on day one, when there is nothing to repair yet.

/**
 * @param {object} o  startActions() input plus `selectedSubject` (a subject id) and `tonight`
 *                    ({ count, attemptId } of tonight's repair, or null).
 */
export function sheetRows({ move = null, resume = null, plan = 'free', balance = null, aiBalance = null, subjects = [], tonight = null,
  mistakeRepair = undefined, selectedSubject = null } = {}) {
  const rows = startActions({ move, resume, plan, balance, aiBalance, subjects, repairAttemptId: tonight?.attemptId || null,
    ...(mistakeRepair === undefined ? {} : { mistakeRepair }) });
  const subject = subjects.includes(selectedSubject) ? selectedSubject : subjects[0] || null;
  const heroIsRepair = move?.id === 'repair' && rows[0]?.id === 'move';
  // Day one (rule 7, no mock yet) has nothing to repair: the row would open an empty Review.
  const nothingToRepair = move?.id === 'first' && !tonight?.attemptId;
  return rows
    .filter((row) => !(row.id === 'repair' && (heroIsRepair || nothingToRepair)))
    .map((row) => {
      if (row.id === 'quick' && subject) return { ...row, href: practiceHref({ subject, mode: 'quick', count: 10 }), subject };
      if (row.id === 'full' && subject) return { ...row, href: practiceHref({ subject, mode: 'full' }), subject, subjectLabel: subjectName(subject) || null };
      // A locked NTA row says "See Pro": it opens the plans, not a setup that cannot start.
      if (row.id === 'nta' && row.tag === 'Pro') return { ...row, href: '/pricing' };
      return row;
    });
}

/** The row a /start?row= link opens. A resume link falls back to the hero when the hero is the resume move. */
export function initialRowFor(requested, rows = []) {
  const ids = rows.map((r) => r.id);
  if (!requested) return rows[0]?.hero ? rows[0].id : null;
  if (ids.includes(requested)) return requested;
  if (requested === 'resume' && rows[0]?.hero) return rows[0].id;
  return rows[0]?.hero ? rows[0].id : null;
}

export const SHEET_FOOTER = START_SHEET_FOOTER;

/**
 * The morph from the Start key into the sheet (plan 7: about 280 ms, ease-out). Returns the
 * transform that places the sheet over the key, or null when either box is missing or empty.
 */
export function morphFrom(keyRect, panelRect) {
  if (!keyRect || !panelRect || !(panelRect.width > 0) || !(panelRect.height > 0) || !(keyRect.width > 0) || !(keyRect.height > 0)) return null;
  const dx = (keyRect.left + keyRect.width / 2) - (panelRect.left + panelRect.width / 2);
  const dy = (keyRect.top + keyRect.height / 2) - (panelRect.top + panelRect.height / 2);
  const sx = Math.max(0.05, Math.min(1, keyRect.width / panelRect.width));
  const sy = Math.max(0.05, Math.min(1, keyRect.height / panelRect.height));
  const r = (v) => Math.round(v * 1000) / 1000;
  return { dx: r(dx), dy: r(dy), sx: r(sx), sy: r(sy), transform: `translate(${r(dx)}px, ${r(dy)}px) scale(${r(sx)}, ${r(sy)})` };
}

/** /start (mirrors the app's /start) opens the sheet; ?row= picks the row. */
export function startRequestFromLocation(pathname, search = '') {
  const path = String(pathname || '').replace(/\/+$/, '') || '/';
  if (path !== '/start') return null;
  const row = new URLSearchParams(search).get('row');
  return { row: ['resume', 'quick', 'repair', 'full', 'nta'].includes(row) ? row : null };
}

// ---------------------------------------------------------------------------------------------
// The guide (plan 3 step 10, D16): 4 stops, skippable, opens by itself once at the first repair's
// ending (Today with ?guide=first, or the mm:guide event), replays from You > Help. Never before the
// first question, so nothing else opens it by itself.

export const GUIDE_STOPS = Object.freeze([
  Object.freeze({ id: 'today', target: 'nav-today', title: 'Today', body: 'Your next step lives here. After every mock, Today picks the one thing worth doing tonight.' }),
  Object.freeze({ id: 'start', target: 'nav-start', title: 'Start', body: 'Start a session in two taps. Nothing is spent until you press Start on the confirm line.' }),
  Object.freeze({ id: 'practice', target: 'nav-practice', title: 'Practice', body: 'Choose your own session here: subject, chapter, mode and how many questions.' }),
  Object.freeze({ id: 'review', target: 'nav-review', title: 'Review', body: 'Mistakes to repair, your past results and your record. The number shows tonight’s mistakes.' }),
]);

export const GUIDE_SEEN_PREFIX = 'mm:guide-seen:v1:';
export function guideSeenKey(userId) {
  return `${GUIDE_SEEN_PREFIX}${userId || 'anon'}`;
}

/** Should a guide request open it? 'replay' always does; 'first' (auto) only once per account. */
export function guideShouldOpen({ mode = 'replay', seen = false } = {}) {
  if (mode === 'replay') return true;
  if (mode === 'first') return !seen;
  return false;
}

/** The guide request in a URL (?guide=first|replay), or null. */
export function guideRequestFromSearch(search = '') {
  const value = new URLSearchParams(search).get('guide');
  return value === 'first' || value === 'replay' ? value : null;
}

/** Where the guide card sits next to its target, kept inside the viewport (16 px gutter). */
export function guideCardPlacement(rect, viewport, card = { width: 360, height: 220 }) {
  const gutter = 16;
  const width = Math.min(card.width, viewport.width - gutter * 2);
  if (!rect) return { left: gutter, top: Math.max(gutter, viewport.height - card.height - gutter), width };
  const roomRight = viewport.width - rect.right - gutter;
  // A tall rail or sidebar item: put the card beside it. A bar item at the bottom: above it.
  if (roomRight >= width + 12 && rect.left < viewport.width / 3) {
    const top = Math.min(Math.max(gutter, rect.top + rect.height / 2 - card.height / 2), viewport.height - card.height - gutter);
    return { left: Math.round(rect.right + 12), top: Math.round(top), width };
  }
  const left = Math.min(Math.max(gutter, rect.left + rect.width / 2 - width / 2), viewport.width - width - gutter);
  const above = rect.top - card.height - 12;
  const top = above >= gutter ? above : Math.min(rect.bottom + 12, viewport.height - card.height - gutter);
  return { left: Math.round(left), top: Math.round(Math.max(gutter, top)), width };
}

// ---------------------------------------------------------------------------------------------
// The stored hint (navigation.js VISITOR_KEY): the shell paints from it before the session is
// confirmed, and the public header reads it. It holds no personal data.

/** The hint to store for a confirmed member. `started` stays as it was unless the caller knows. */
export function memberHint(user, previous = null, started = null) {
  const prev = parseVisitorHint(previous);
  return { kind: 'member', plan: user?.isPremium ? 'pro' : 'free', started: started === true || started === false ? started : prev.kind === 'member' ? prev.started : null };
}

/** The <html> data attributes for a hint (the theme init script in src/app/layout.js sets the same). */
export function visitorDataset(hint) {
  const h = parseVisitorHint(hint);
  return { visitor: h.kind, plan: h.kind === 'member' ? h.plan : null, started: h.started === true ? 'yes' : h.started === false ? 'no' : null };
}

// ---------------------------------------------------------------------------------------------
// Labels the shell speaks.

/** "Review, 4 mistakes to repair tonight" (the badge's words, so colour never carries it alone). */
export function placeSpoken(placeId, badgeCount = null) {
  const label = PLACES[placeId]?.label || '';
  const n = Math.trunc(Number(badgeCount) || 0);
  if (placeId !== 'review' || n <= 0) return label;
  return `${label}, ${n} mistake${n === 1 ? '' : 's'} to repair tonight`;
}

/** The You tab's initial (DOCK.md icons: the student's initial, or a plain person glyph). */
export function initialOf(name) {
  const letter = String(name || '').trim().match(/\p{L}/u)?.[0];
  return letter ? letter.toUpperCase() : '';
}
