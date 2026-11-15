// What the runner (src/app/(app)/test/TestPageClient.jsx) says when a paper cannot open or cannot be sent, 15 Nov 2026
// (bugs-core B3, B5, B6, B8, B10). No raw code (INSUFFICIENT_CREDITS, SESSION_ALREADY_SUBMITTED, "Unauthorized") ever
// reaches a student: every server answer becomes a plain sentence and a way forward. Pure; the runner draws the result with
// NoticeState (title, message, keys) or its submit banner.
//
// A key is { label, href } (a link) or { label, action: 'reload' } (open the paper again), with primary on the one volt key
// and proFeature on a link to /pricing (the signed-in shell's Pro sheet opens from it, src/components/pro/ProNudgeHost.jsx).
import { dailySetFromQuote, DAILY_SET } from '../dailySet.mjs';

/** Practice, set up for this paper: its subject, mode, count and chapters chosen, its price shown before it starts (B3). */
export function practiceHref({ subject, mode, count, chapters, chapter, screen, tonightKey, tonightMinutes } = {}) {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (mode) params.set('mode', mode);
  if (count) params.set('count', String(count));
  // Practice reads both; one chapter keeps its own name whole (a name may hold a comma).
  if (chapters) params.set('chapters', chapters);
  else if (chapter) params.set('chapter', chapter);
  if (screen === 'nta') params.set('interface', 'nta');
  if (tonightKey) params.set('tonightKey', tonightKey);
  if (tonightMinutes) params.set('tonightMinutes', String(tonightMinutes));
  const query = params.toString();
  return query ? `/dashboard?${query}` : '/dashboard';
}

/** The same, read from a /test address's parameters (URLSearchParams or anything with get). */
export function practiceHrefFromTest(search) {
  const get = (name) => search?.get?.(name) || '';
  return practiceHref({
    subject: get('subject'), mode: get('mode'), count: get('count'), chapters: get('chapters'), chapter: get('chapter'),
    screen: get('interface'), tonightKey: get('tonightKey'), tonightMinutes: get('tonightMinutes'),
  });
}

/**
 * A /test address that can open a paper: a paper key from Practice (or the Mob), or a session id. Links from Repair's
 * "Do this next", Saved and Ask Mobi carry neither; they go to Practice instead (practiceHrefFromTest), never to an error.
 */
export function canOpenPaper(search) {
  const key = search?.get?.('generationKey') || '';
  return key.length >= 12 || !!search?.get?.('sessionId');
}

const SERVER_WORDS = /^(Request failed|Network error|Unauthori[sz]ed|Too many requests|Payload too large|Failed to|Internal Server Error)/i;
/** A sentence written for a student (it has words and lower case), not a code or a transport message. */
export function isSentence(text) {
  const said = String(text || '').trim();
  return said.length > 0 && /[a-z]/.test(said) && /\s/.test(said) && !/^[A-Z][A-Z0-9_]{2,}(?![a-z])/.test(said) && !SERVER_WORDS.test(said);
}

const LINK_CHANGED = new Set(['SUBJECT_NOT_SUPPORTED', 'INVALID_CHAPTER', 'INVALID_MODE', 'INVALID_GENERATION_KEY', 'CHAPTERS_NOT_ALLOWED', 'DIFFICULTY_NOT_ALLOWED']);
const NOT_YOURS = new Set(['INVALID_START_RECEIPT', 'SESSION_NOT_FOUND', 'INVALID_PRACTICE_SESSION']);

/**
 * The page for a start the server refused. ctx: { practiceHref, loginHref, modeLabel, isNta, isMob }.
 * INSUFFICIENT_CREDITS is not here: it needs the price read again (creditsProblem).
 */
export function startProblem(error, ctx = {}) {
  const code = String(error?.message || '');
  const status = Number(error?.status) || 0;
  const practice = ctx.practiceHref || '/dashboard';
  const back = ctx.isMob ? { label: 'Back to your Mob', href: '/mob' } : { label: 'Back to Practice', href: practice };
  const again = { label: 'Try again', action: 'reload' };
  const primary = (key) => ({ ...key, primary: true });

  if (code === 'SESSION_ALREADY_SUBMITTED') {
    return { kind: 'sent', title: 'You already sent this paper', message: 'Its result is saved in Your papers.', keys: [primary({ label: 'Go to Your papers', href: '/review' })] };
  }
  if (status === 401 || /^unauthori[sz]ed$/i.test(code)) {
    return { kind: 'signedOut', title: 'You are signed out', message: 'Sign in again to open this paper.', keys: [primary({ label: 'Sign in', href: ctx.loginHref || '/login' })] };
  }
  if (code === 'PREMIUM_REQUIRED') {
    return { kind: 'pro', title: `${ctx.modeLabel || 'This mode'} is part of Pro`, message: 'Pick another mode on Practice, or see what Pro adds.',
      keys: [primary(back), { label: 'See Pro', href: '/pricing?reason=premium_mode', proFeature: 'premium_mode' }] };
  }
  if (code === 'INSUFFICIENT_VERIFIED_CONTENT') {
    return { kind: 'content', title: 'This paper is not ready yet', message: 'Checked questions are not ready for this selection yet. Nothing was charged.', keys: [primary(back)] };
  }
  if (code === 'INSUFFICIENT_PRACTICE_CONTENT') {
    return { kind: 'content', title: 'Not enough questions for this paper', keys: [primary(back)],
      message: ctx.isNta
        ? 'An NTA mode paper needs 50 checked questions laid out like the real CUET paper, and this subject does not have enough yet. Try a full mock instead. Nothing was charged.'
        : 'There are not enough questions for this selection. Try fewer questions or another chapter. Nothing was charged.' };
  }
  if (code === 'SESSION_EXPIRED') {
    return { kind: 'expired', title: 'This paper’s time is over', message: 'A paper opens only while its timer runs. Set up a new one on Practice.', keys: [primary({ label: 'Go to Practice', href: practice })] };
  }
  if (NOT_YOURS.has(code) || status === 404) {
    return { kind: 'foreign', title: 'This paper belongs to another account', message: 'It may have come from someone else’s link. Set up your own paper on Practice.', keys: [primary({ label: 'Go to Practice', href: practice })] };
  }
  if (LINK_CHANGED.has(code)) {
    return { kind: 'changed', title: 'This paper link no longer works', message: 'Its subject, chapter or mode has changed since it was made. Set the paper up again on Practice.', keys: [primary({ label: 'Go to Practice', href: practice })] };
  }
  if (code === 'RECOVERY_MIGRATION_REQUIRED' || code === 'LEARNING_MIGRATION_REQUIRED') {
    return { kind: 'unavailable', title: 'This kind of paper is not ready yet', message: 'Set up a paper on Practice instead. Nothing was charged.', keys: [primary(back)] };
  }
  if (status === 429 || /^too many requests$/i.test(code)) {
    return { kind: 'busy', title: 'Too many tries at once', message: 'Wait a minute, then try again. A paper is never charged twice.', keys: [primary(again), back] };
  }
  if (error?.kind === 'network') {
    return { kind: 'offline', title: 'You are offline', message: 'Connect to the internet, then try again. A paper is never charged twice.', keys: [primary(again), back] };
  }
  if (isSentence(code)) {
    return { kind: 'said', title: 'This paper did not open', message: code, keys: [primary(again), back] };
  }
  return { kind: 'server', title: 'This paper did not open', message: 'Something went wrong on our side. Try again: a paper is never charged twice.', keys: [primary(again), back] };
}

/**
 * Credits ran out between the price on Practice and the start (B6): what the set costs against the balance, in Practice's
 * own words when the price could be read again, then the two ways forward the product has: today's or tomorrow's included
 * 10-question set, and Pro (the Pro sheet). Nothing was charged.
 *   quote  GET /api/practice/quote for this set, read again (or null)
 *   daily  the same for today's included set, Quick practice 10 (or null)
 *   ctx    { subject, modeLabel, cost, balance, practiceHref }
 */
export function creditsProblem({ quote = null, daily = null, ctx = {} } = {}) {
  const practice = ctx.practiceHref || '/dashboard';
  const back = { label: 'Back to Practice', href: practice };
  const pro = { label: 'See Pro', href: '/pricing?reason=credits', proFeature: 'credits' };
  if (quote && quote.launchable === true) {
    return { kind: 'credits', title: 'Your credits changed', message: 'Your balance changed since this set was priced. Practice shows the price again before it starts.', keys: [{ ...back, primary: true }] };
  }
  const read = quote && quote.reasonCode === 'insufficient_credits' && typeof quote.reason === 'string' ? quote.reason.trim() : '';
  const cost = Number(ctx.cost); const balance = Number(ctx.balance);
  const priced = read || (Number.isFinite(cost) && cost > 0 && Number.isFinite(balance)
    ? `${ctx.modeLabel || 'This set'} costs ${cost} credits and you have ${Math.max(0, balance)}.`
    : 'This set costs more credits than you have now.');
  const lines = [`${priced.replace(/\s+$/, '')} Nothing was charged.`];
  const keys = [];
  const state = dailySetFromQuote(daily);
  if (state === DAILY_SET.free) {
    lines.push('Today’s included 10-question set is still free.');
    keys.push({ label: 'Set up the free set', href: practiceHref({ subject: ctx.subject, mode: 'quick', count: 10 }), primary: true });
  } else if (daily?.allowance?.state === 'used') {
    lines.push('Tomorrow’s included 10-question set is free.');
  }
  keys.push(keys.length ? back : { ...back, primary: true }, pro);
  return { kind: 'credits', title: 'Not enough credits for this set', message: lines.join(' '), keys };
}

/** "on this phone" on a touch screen, "in this browser" elsewhere: where a device-held paper's answers are. */
export const placeWords = (coarse) => (coarse ? 'on this phone' : 'in this browser');

/**
 * What a failed submit means. kind:
 *   'offline'    no connection: the runner holds the paper and sends it when the connection is back
 *   'late'       refused as too late: more than 7 days after the timer (B8), the full-page notice, never "try again"
 *   'foreign'    the paper belongs to another account (B10): the full-page notice
 *   'signedOut'  401: sign in, then come back; link holds the sign-in key
 *   'retry'      anything else: the banner's message and its "Try sending again" key
 */
export function submitProblem(error, ctx = {}) {
  const code = String(error?.message || '');
  const status = Number(error?.status) || 0;
  const place = ctx.place || 'on this device';
  if (error?.kind === 'network' || ctx.offline) return { kind: 'offline' };
  if (code === 'SESSION_EXPIRED') return { kind: 'late' };
  if (NOT_YOURS.has(code) || status === 404) return { kind: 'foreign' };
  if (status === 401 || /^unauthori[sz]ed$/i.test(code)) {
    return { kind: 'signedOut', message: `You are signed out, so this paper was not sent. Your answers are kept ${place}. Sign in, then come back to send it.`, link: { label: 'Sign in', href: ctx.loginHref || '/login' } };
  }
  if (status === 429 || /^too many requests$/i.test(code)) {
    return { kind: 'retry', message: `Too many tries at once. Wait a minute, then send it again. Your answers are kept ${place}.` };
  }
  if (isSentence(code)) return { kind: 'retry', message: `${code.replace(/[.\s]+$/, '')}. Your answers are kept ${place}.` };
  return { kind: 'retry', message: `Sending did not go through. Your answers are kept ${place}.` };
}

/**
 * The banner while a sent paper waits for a connection. ctx: { ticket (device-held), msLeft (to the deadline),
 * msToLateEnd (to the end of the 7 days the server takes a late paper, B8), place }. It changes only between these states,
 * never every second, so a screen reader is not read a clock. While a send can still succeed the runner keeps trying.
 */
export function waitingCopy({ ticket = true, msLeft = 0, msToLateEnd = 0, place = 'on this device' } = {}) {
  if (!ticket) return 'Waiting for connection. After the deadline, only answers already saved to your account can be scored. Reconnect before time runs out.';
  if (msLeft > 0) return `You are offline, so the paper was not sent yet. Your answers are kept ${place} and it sends itself when you are back online.`;
  if (msToLateEnd > 0) return `Time is up and you are offline. Your paper is saved ${place} and sends itself when you are back online, up to 7 days after its timer ended.`;
  return 'This paper could not be saved. It was not sent within 7 days of its timer ending, so it has no result. Start a new paper on Practice.';
}

/**
 * A device-held paper opened after its time with no draft of it on this device (another phone, cleared storage): there is
 * nothing here to send, and sending an empty paper would replace the answers wherever they are, so nothing is sent (B1).
 */
export function timeUpNotice({ place = 'on this device', practiceHref: practice = '/dashboard' } = {}) {
  return {
    kind: 'timeUp',
    title: 'Time is up on this paper',
    message: `Its answers are not saved ${place}, so there is nothing to send from here. If you answered it somewhere else, open it there to send it.`,
    keys: [{ label: 'Go to Practice', href: practice, primary: true }],
  };
}

/**
 * The same paper in two tabs (B12). The newest tab owns it; the older one stops and says so, with one key that takes the
 * paper back by reopening it from the newest draft. A paper sent from the other tab leads to its result.
 */
export function elsewhereNotice({ sentId = null } = {}) {
  if (sentId) {
    return { kind: 'sentElsewhere', title: 'This paper was sent from another tab', message: 'Its result is ready.', keys: [{ label: 'See your result', href: `/result/${encodeURIComponent(sentId)}`, primary: true }] };
  }
  return { kind: 'openElsewhere', title: 'This paper is open in another tab', message: 'Your answers from that tab are kept. Use one tab at a time so none are lost.', keys: [{ label: 'Use this tab', action: 'reload', primary: true }] };
}

/** A submit refused because the paper was started on another account (B10). */
export function foreignNotice({ practiceHref: practice = '/dashboard' } = {}) {
  return { kind: 'foreign', title: 'This paper belongs to another account', message: 'It was started on a different account from the one signed in now, so it cannot be sent from here.', keys: [{ label: 'Go to Practice', href: practice, primary: true }] };
}

/** The full-page notice for a paper the server refused as too late: more than 7 days after its timer ended (B8). */
export function lateNotice({ answered = 0, place = 'on this device', practiceHref: practice = '/dashboard' } = {}) {
  const kept = answered > 0 ? ` Your ${answered} ${answered === 1 ? 'answer is' : 'answers are'} still ${place}, but they cannot be scored.` : '';
  return {
    kind: 'late',
    title: 'This paper could not be saved',
    message: `A paper has to be sent within 7 days of its timer ending, and this one was not, so it has no result.${kept}`,
    keys: [{ label: 'Start a new paper', href: practice, primary: true }],
  };
}
