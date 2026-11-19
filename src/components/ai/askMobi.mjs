// Ask Mobi, opened in place (N9, 17 Oct night; ASK-MOBI-1018). Any control in the arena opens the one Ask Mobi panel over
// the page it is on, already about what is in front of the student: a question, a mock, Today's step, Practice, or the page.
// The arena shell mounts the host (AskMobiHost.jsx), which answers this event; where no host is mounted (a public page, the
// timed runner) nothing answers, and the caller follows its plain link instead. Pure, so a test can hold the contract.
//
// The one call other screens make:
//   openAskMobi({ context: { kind: 'question', ref: '<attemptId>:<questionId>', number: 7, chapter: 'Partnership' }, from: button })
//   openAskMobi({ context: { kind: 'mock', ref: attemptId, label: 'Mock 3', lines: ['Partnership: 36 of 78 marks lost'] } })
//   openAskMobi({ context: { kind: 'today', label: 'Today', reason, lines: plan.primary.facts.map((f) => f.text) } })
//   openAskMobi({ context: { kind: 'practice' } })   openAskMobi()   (the page the student is on)
// The opener sends what the screen is about, never a transcript. `tab` and `questionRef` are the R4 names, still accepted.

export const ASK_MOBI_EVENT = 'mockmob:ask-mobi';
export const ASK_MOBI_TABS = Object.freeze(['plan', 'record', 'ask', 'tools']);
export const ASK_MOBI_KINDS = Object.freeze(['question', 'mock', 'today', 'practice', 'page']);

const QUESTION_REF = /^[A-Za-z0-9_-]{1,80}:[A-Za-z0-9_-]{1,80}$/;
const PLAIN_REF = /^[A-Za-z0-9_-]{1,80}$/;
const LINE_CAP = 160;
const LABEL_CAP = 48;

/** A short display string from an opener, or null: no markup, no control characters, capped. */
function text(value, cap = LABEL_CAP) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const clean = String(value).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.length > cap ? `${clean.slice(0, cap - 1).trimEnd()}…` : clean;
}

/**
 * What the panel is asked about, cleaned. Unknown kinds fall back to the page; a question without a valid reference
 * falls back to the page too (a malformed reference is never forwarded to the context route).
 */
export function normalizeContext(input = {}) {
  const raw = input && typeof input === 'object' ? input : {};
  let kind = ASK_MOBI_KINDS.includes(raw.kind) ? raw.kind : 'page';
  let ref = null;
  if (kind === 'question') {
    ref = typeof raw.ref === 'string' && QUESTION_REF.test(raw.ref) ? raw.ref : null;
    if (!ref) kind = 'page';
  } else if (kind === 'mock') {
    ref = typeof raw.ref === 'string' && PLAIN_REF.test(raw.ref) ? raw.ref : null;
  }
  const number = Number.isInteger(raw.number) && raw.number > 0 && raw.number < 1000 ? raw.number : null;
  const lines = Array.isArray(raw.lines) ? raw.lines.map((line) => text(line, LINE_CAP)).filter(Boolean).slice(0, 4) : [];
  const out = { kind, ref, label: text(raw.label), number, chapter: text(raw.chapter, 64), lines };
  if (kind === 'question') { out.pickLabel = text(raw.pickLabel); out.keyLabel = text(raw.keyLabel); if (raw.blank === true) out.blank = true; }
  if (kind === 'today') out.reason = text(raw.reason, LINE_CAP);
  // Today's Revise card answers "why now" first and names the weakest chapter only as what comes next (release 10).
  if (kind === 'today' && raw.focus === 'revise') out.focus = 'revise';
  if (raw.record === true) out.record = true;
  return out;
}

/** The R4 request names ({ tab, questionRef }) as a context, so older call sites open the scoped panel too. */
export function contextFromLegacy({ tab = 'plan', questionRef = null } = {}) {
  if (questionRef && QUESTION_REF.test(questionRef)) return normalizeContext({ kind: 'question', ref: questionRef });
  return normalizeContext({ kind: 'page', record: tab === 'record' });
}

/** "/mentor?tab=ask&q=<attempt>:<question>" (the repair's link) to what the panel opens on. Anything else is ignored. */
export function askRequestFromHref(href) {
  if (typeof href !== 'string' || !href.startsWith('/mentor')) return null;
  let url;
  try { url = new URL(href, 'https://mockmob.invalid'); } catch { return null; }
  if (url.pathname !== '/mentor') return null;
  const tab = ASK_MOBI_TABS.includes(url.searchParams.get('tab')) ? url.searchParams.get('tab') : 'plan';
  const q = url.searchParams.get('q');
  const questionRef = q && QUESTION_REF.test(q) ? q : null;
  return { tab: questionRef ? 'ask' : tab, questionRef };
}

/** The point the panel grows from: the centre of the control that opened it. */
export function originOf(element) {
  const rect = element?.getBoundingClientRect?.();
  if (!rect || !rect.width) return null;
  return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
}

/**
 * Asks the arena shell to open Ask Mobi. Returns true when a host took it (the caller then stays put), false when
 * none is mounted (the caller navigates as before). `launcher` marks an open from the desktop launcher (AskMobiLauncher.jsx),
 * whose panel overlays below DOCK_MIN_WIDTH instead of docking.
 */
export function openAskMobi({ context = null, tab = 'plan', questionRef = null, from = null, launcher = false } = {}, target = globalThis.window) {
  if (!target?.dispatchEvent || typeof CustomEvent !== 'function') return false;
  const cleanTab = ASK_MOBI_TABS.includes(tab) ? tab : 'plan';
  const cleanRef = questionRef && QUESTION_REF.test(questionRef) ? questionRef : null;
  const scoped = context ? normalizeContext(context) : contextFromLegacy({ tab: cleanTab, questionRef: cleanRef });
  const event = new CustomEvent(ASK_MOBI_EVENT, {
    cancelable: true,
    detail: {
      tab: scoped.kind === 'question' ? 'ask' : cleanTab,
      questionRef: scoped.kind === 'question' ? scoped.ref : null,
      origin: originOf(from),
      context: scoped,
      launcher: launcher === true,
    },
  });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

/** Asks the host to close the panel (the launcher's second press). */
export const ASK_MOBI_CLOSE_EVENT = 'mockmob:ask-mobi-close';
export function closeAskMobi(target = globalThis.window) {
  if (!target?.dispatchEvent || typeof CustomEvent !== 'function') return;
  target.dispatchEvent(new CustomEvent(ASK_MOBI_CLOSE_EVENT));
}

// ---------------------------------------------------------------------------------------------------------------------
// The desktop launcher and the wide dock (19 Nov 2026, owner: "On desktop, we have a lot of space, so even the Ask Mobi, we can set
// as a quick-to-access chatbot on the right-hand side of the screen").

/** From this width the panel docks beside the page whoever opened it; the launcher's open overlays below it. */
export const DOCK_MIN_WIDTH = 1680;
/** The in-page asks (a repair, a result, Today, Practice) keep their own dock from here, as before 19 Nov. */
export const PAGE_DOCK_MIN_WIDTH = 1280;
/** The docked panel's width; the shell narrows its main area by it (--mobi-dock-w). */
export const DOCK_WIDTH = 400;
/** Where the launcher is drawn: a mouse window this wide (AskMobiLauncher's CSS repeats it). */
export const LAUNCHER_MEDIA = '(min-width: 1100px) and (hover: hover) and (pointer: fine)';

/**
 * The panel's form for a window width: 'dock' (beside the page, no scrim), 'overlay' (over the page with a scrim) or 'sheet' (a
 * phone's bottom sheet). From DOCK_MIN_WIDTH everything docks. Below it, the launcher's open overlays; an in-page ask keeps its
 * own rule (dock from PAGE_DOCK_MIN_WIDTH, overlay from 768 px, a sheet below).
 */
export function drawerForm(width, { launcher = false } = {}) {
  const w = Number(width) || 0;
  if (w >= DOCK_MIN_WIDTH) return 'dock';
  if (w >= PAGE_DOCK_MIN_WIDTH && !launcher) return 'dock';
  if (w >= 768) return 'overlay';
  return 'sheet';
}

/**
 * What the launcher asks about: the page the student is on when that page has a page-level ask of its own that needs no data the
 * shell lacks (Practice: what to practise), else a general open, the way /mentor starts. Today's "Why this?" and a result's asks
 * need their page's own figures, so their pages keep offering them in place.
 */
export function launcherContext(path = '') {
  const p = String(path || '').split(/[?#]/)[0];
  if (p === '/dashboard' || p.startsWith('/dashboard/')) return normalizeContext({ kind: 'practice' });
  return normalizeContext({ kind: 'page' });
}

/** Routes where the launcher is never drawn: the paper, a Mob game, onboarding, and Ask Mobi's own page. */
export function launcherBlockedOn(path = '') {
  return /^\/(test|onboarding|mob\/game|mentor)(\/|$|\?)/.test(String(path || ''));
}

/** A plain click on a link (no new tab, no modifier) may be taken over; anything else keeps the browser's behaviour. */
export const isPlainClick = (event) => !(event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);

/**
 * The navigation's own "Ask Mobi" link points to /mentor. In the arena a plain click
 * opens the panel about the page instead; a modifier-click still opens /mentor. True for that row's href only.
 */
export function isAskMobiNavHref(href) {
  if (typeof href !== 'string') return false;
  try {
    const url = new URL(href, 'https://mockmob.invalid');
    return url.origin === 'https://mockmob.invalid' && url.pathname === '/mentor' && !url.search;
  } catch { return false; }
}
