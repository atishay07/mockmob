// Ask Mobi as a chat (16 Nov 2026, the owner's words that evening: "It should feel like a proper AI agent ... but even better
// than that"). This file holds the chat surface's own words and the small rules behind them. PURE: no I/O, no clock, no React,
// so a test holds every line (chatCopy.test.mjs).
//
// What it keeps true:
//  * Every price is read from the constants the product charges by (MOBI_JOB_CREDITS, mistakeCredits). No number is typed here.
//  * The line under the composer says, before a send, what that send uses and what is left, in the product's one spend
//    wording (creditCopy.mjs usesLine). After a reply, what it used is the amount the server said, never an assumed one.
//  * A refusal or a failure is a turn in the thread: what happened, what it used (0 or more: the words follow the amount) and
//    the way forward.
//  * No provider is named on any screen. The photo line says only what is true of MockMob: it does not keep the photo.
import { MOBI_JOB_CREDITS, creditCount, usedLine, usesLine } from '../../lib/creditCopy.mjs';
import { MISTAKE_PHOTO_ON, MISTAKE_TIMEOUT_MS, mistakeCredits } from '../../services/mobi/bringMistake.mjs';
import { shortDate } from './askSuggestions.mjs';

export const CHAT_COPY = Object.freeze({
  title: 'Ask Mobi',
  tabChat: 'Chat',
  tabRecord: 'Your record',
  views: 'Ask Mobi views',
  newChat: 'New chat',
  history: 'History',
  // The composer
  field: 'Ask a doubt, or add a photo of a question',
  fieldPhoto: 'Add what you marked, if you like',
  fieldMistake: 'Paste the question and its options',
  fieldFollowUp: 'Ask your follow-up',
  fieldLabel: 'Your message to Mobi',
  kindLabel: 'What you are asking',
  kindDoubt: 'A doubt',
  kindMistake: 'A question I got wrong',
  photoKey: 'Photo',
  photoKeyLong: 'Add a photo of a question',
  photoTake: 'Take a photo',
  photoChoose: 'Choose a photo',
  photoDrop: 'Drop the photo here',
  photoRemove: 'Remove the photo',
  photoPreparing: 'Getting the photo ready',
  photoAlt: 'Your photo of the question',
  // True of MockMob: the server never stores the photo (only Mobi's reading of it is kept).
  photoPrivacy: 'Keep your name and roll number out of the photo. MockMob does not keep it.',
  marked: 'What I marked',
  key: 'Right answer, if known',
  subject: 'Subject',
  moreOpen: 'Add what you marked and the right answer',
  moreOpenPhoto: 'Add the right answer, if you know it',
  moreClose: 'Hide these two',
  moreClosePhoto: 'Hide this',
  send: 'Send to Mobi',
  aiNote: 'Mobi is AI and can be wrong.',
  followUpIncluded: 'One follow-up is included',
  // The empty state
  headline: 'What do you want to work on?',
  practiceTitle: 'From your practice',
  practiceTitleFresh: 'Doubts to start with',
  recordAll: 'All questions about your record',
  recordAllClose: 'Show fewer questions',
  seeRecord: 'See your record',
  // The thread
  mobi: 'Mobi',
  you: 'You',
  log: 'Your conversation with Mobi',
  copy: 'Copy',
  copied: 'Copied',
  copyFailed: 'Could not copy',
  report: 'Report',
  reportTitle: 'What is wrong with this answer?',
  reportSent: 'Reported. Thank you.',
  reportFailed: 'The report could not be sent. Try again.',
  reportCancel: 'Cancel',
  readTitle: 'What Mobi read from your photo',
  readOpen: 'Show all of it',
  readClose: 'Show less',
  chapterIs: (chapter, subject) => (subject ? `Chapter: ${chapter}, ${subject}` : `Chapter: ${chapter}`),
  youChose: (text) => `You marked ${text}`,
  photoOpen: 'Open your photo',
  photoClose: 'Close the photo',
  askNext: 'Ask next',
  retakePhoto: 'Take the photo again',
  typeInstead: 'Type it instead',
  tryAgain: 'Try again',
  seeCredits: 'See your credits',
  noCreditsUsed: 'No credits used.',
  free: 'Free',
  fromRecord: 'Free, from your record.',
  // History
  historyTitle: 'History',
  historyEmpty: 'Questions you ask Mobi are kept here.',
  historyReading: 'Reading your history.',
  historyClose: 'Close history',
  savedNote: 'A saved exchange, as it was.',
  savedNoReply: 'No reply was saved for this question.',
  askNew: 'Ask something new',
  // The record view
  recordTitle: 'Your record',
  recordAsk: 'Ask about your record',
  recordAskLine: 'Tap a question and Mobi answers it in the chat.',
});

const fmt = (n) => Math.max(0, Math.trunc(Number(n) || 0)).toLocaleString('en-IN');
const known = (wallet) => Boolean(wallet?.known) && Number.isFinite(wallet?.total);

/** "Hi Riya." with a real first name, "Hi." without one. */
export const hello = (name) => (name ? `Hi ${name}.` : 'Hi.');

// ---- Prices, from the product's own constants ---------------------------------------------------------------------------------

/** What one send costs in credits: a doubt is one Mobi job; a question brought from another test is 1 typed, 2 with a photo. */
export function sendCost({ kind = 'doubt', photo = false } = {}) {
  return kind === 'mistake' ? mistakeCredits(photo ? { photo: true } : {}) : MOBI_JOB_CREDITS;
}

/** The price tag of the "A question I got wrong" tile: "1 or 2 credits" (typed, or with a photo), or one price while photos are off. */
export function mistakePriceTag({ photoOn = MISTAKE_PHOTO_ON } = {}) {
  const typed = sendCost({ kind: 'mistake' });
  const photo = sendCost({ kind: 'mistake', photo: true });
  return !photoOn || typed === photo ? creditCount(typed) : `${fmt(typed)} or ${creditCount(photo)}`;
}

/** What a credit buys when it settles a doubt, in the page's words, with the price read from the constant. */
export const doubtBuys = () => `${creditCount(MOBI_JOB_CREDITS)} settles a doubt: Mobi’s answer, one follow-up, and 2 new CUET-style questions to test it.`;

/**
 * The four starters of the empty state, in order: [{ id, icon, title, sub, price, tone }]. `price` is the tag's words;
 * `tone` 'free' draws it in the good-text role. `when` is "tonight" or "today" (askDoors.mjs tonightOrToday).
 */
export function starterTiles({ when = 'tonight', photoOn = MISTAKE_PHOTO_ON } = {}) {
  return [
    { id: 'doubt', icon: 'lesson', title: 'Explain a doubt', sub: null, price: creditCount(MOBI_JOB_CREDITS), tone: 'credit' },
    { id: 'mistake', icon: 'mistakes', title: 'A question I got wrong', sub: photoOn ? 'Typed, or a photo' : 'Typed or pasted', price: mistakePriceTag({ photoOn }), tone: 'credit' },
    { id: 'losing', icon: 'papers', title: 'Where am I losing marks?', sub: null, price: CHAT_COPY.free, tone: 'free' },
    { id: 'tonight', icon: 'revise', title: `What should I revise ${when}?`, sub: null, price: CHAT_COPY.free, tone: 'free' },
  ];
}

/**
 * The one line of real context under the greeting, from the record's own figures: the papers Mobi has read and, where the
 * record gives one, the range the student's practice puts them at (mobiJobs.mjs standingView's `range`: its words, never worked
 * out a second way). `sessions` is the record's own count.
 */
export function contextLine({ sessions = 0, range = null } = {}) {
  const papers = sessions === 1 ? 'your first paper' : `your ${fmt(sessions)} papers`;
  if (range?.low && range?.high && range?.max) return `Mobi has ${papers}: ${range.low} to ${range.high} out of ${range.max} from your practice.`;
  return `Mobi has ${papers} and answers from ${sessions === 1 ? 'it' : 'them'}.`;
}

/** What a saved reply cost, for the exchange opened from History: the credits it really used, or that it was free. */
export function savedCost(row) {
  if (row?.origin === 'model') return Number(row.charged) > 0 ? usedWords(row.charged) : 'A written answer.';
  if (row?.origin === 'record') return CHAT_COPY.fromRecord;
  return null;
}

// ---- The line under the composer ----------------------------------------------------------------------------------------------

/** What the thing being sent is called in the spend line: "This doubt uses 1 credit. You have 108." */
function whatFor({ kind, photo, question }) {
  if (kind === 'mistake') return photo ? 'This photo' : 'This question';
  return question ? 'This reply' : 'This doubt';
}

/**
 * The one quiet line under the composer, always true before a send: what this send uses and what is left.
 * -> { text, tone: 'cost' | 'free' | 'wait' | 'stop', credits: boolean (offer the link to the credits page) }
 *
 * `price`: what the typed words cost ('free' when the record or the help answers answer them, otherwise the paid price; null
 * with nothing typed). `followUp`: the words are the included follow-up of an open doubt. `support`: words that sound like
 * distress, always free. `question`: a question of a MockMob paper is attached (a written reply about it). `stopped`: this
 * month's limit was met in this conversation, so only record questions go.
 */
export function sendLine({ kind = 'doubt', photo = false, price = null, wallet = null, offline = false, followUp = false, support = false, question = false, stopped = false, needsNet = false } = {}) {
  if (support) return { text: 'This one is free.', tone: 'free', credits: false };
  const record = kind === 'doubt' && price === 'free';
  if (record && !(offline && needsNet)) return { text: CHAT_COPY.fromRecord, tone: 'free', credits: false };
  if (offline) return { text: 'You are offline. Nothing is sent and nothing is used. Questions about your record still work.', tone: 'stop', credits: false };
  if (kind === 'doubt' && followUp) return { text: 'Free. This follow-up comes with your doubt.', tone: 'free', credits: false };
  if (stopped) return { text: 'This month’s limit is reached. Questions about your record stay free.', tone: 'stop', credits: false };
  if (!wallet) return { text: 'Reading your credits.', tone: 'wait', credits: false };
  if (wallet.state === 'paused') return { text: 'Written answers are paused just now. Questions about your record still work.', tone: 'stop', credits: false };
  if (!known(wallet)) return { text: 'Your credits could not be read, so written answers wait. Questions about your record still work.', tone: 'stop', credits: true };
  const cost = sendCost({ kind, photo });
  if (wallet.total <= 0) {
    const day = shortDate(wallet.resetAt);
    return { text: `You have no credits left.${day ? ` Your free credits refill on ${day}.` : ''} Questions about your record stay free.`, tone: 'stop', credits: true };
  }
  if (wallet.total < cost) return { text: `${usesLine({ what: whatFor({ kind, photo, question }), cost, pool: 'ai', balance: wallet.total })} That is not enough.`, tone: 'stop', credits: true };
  return { text: usesLine({ what: whatFor({ kind, photo, question }), cost, pool: 'ai', balance: wallet.total }), tone: 'cost', credits: false };
}

/** Whether the wallet can pay for this send (the server decides again; this only keeps a send that cannot go from leaving). */
export function canAfford({ kind = 'doubt', photo = false, wallet = null } = {}) {
  return known(wallet) && wallet.state !== 'paused' && wallet.total >= sendCost({ kind, photo });
}

// ---- Waiting ------------------------------------------------------------------------------------------------------------------

/** The longest a question brought from another test can take, in whole seconds, from the route's own timeout. */
export const MISTAKE_WAIT_SECONDS = Math.round(MISTAKE_TIMEOUT_MS / 1000);
/** After this long a second line says the true ceiling. */
export const WAIT_NOTE_AFTER_MS = 10_000;

/**
 * The honest line while a reply is on its way: it names the one real step, and nothing is shown as progress.
 * `pending` is the engine's { kind, question, photo }; `qName` is "Q7" or "this question".
 */
export function waitLine(pending, { qName = 'this question' } = {}) {
  if (!pending) return null;
  if (pending.kind === 'mistake') return pending.photo ? 'Reading your photo' : 'Reading your question';
  if (pending.question) return `Reading ${qName}, your pick and the key`;
  if (pending.kind === 'tonight') return 'Reading your record for tonight';
  return 'Working it out';
}

/** The second line of a long wait: only where the product has a real ceiling to state. */
export function waitCeiling(pending) {
  return pending?.kind === 'mistake' ? `This can take up to ${MISTAKE_WAIT_SECONDS} seconds.` : null;
}

// ---- What a turn used ---------------------------------------------------------------------------------------------------------

const amount = (n) => Math.max(0, Math.trunc(Number(n) || 0));

/** What a turn used, from the amount the server said: "2 credits used." or "No credits used." */
export function usedWords(charged) {
  const n = amount(charged);
  return n > 0 ? usedLine({ cost: n, pool: 'ai' }) : CHAT_COPY.noCreditsUsed;
}

/** The charged amount of a server body, wherever the route put it (`charge.amount`, or `charged`). Never assumed. */
export function chargedOf(body) {
  if (!body || typeof body !== 'object') return 0;
  return amount(body.charge?.amount ?? body.response?.charge?.amount ?? body.charged);
}

// A sentence that only states that nothing was taken. The turn says what it used on its own line, from the amount, so a
// server line that carries one of these is shown without it (and can never disagree with the amount).
const NOTHING_USED = /nothing (?:extra |more )?(?:was|is|will be) charged|no credits? (?:was |were |is )?used|\bnot charged\b|credits? (?:have|has) not been used|uses none|you will not be charged twice/i;
// A sentence that says credits are held and come back is information, not a zero: it stays.
const HELD = /held|returns? automatically|restored/i;

/**
 * A refusal or a failure as a turn: { said, used }. `said` is what happened and what to do (the server's or the page's words,
 * without any "nothing was charged" sentence); `used` is what it used, written from the amount: 0, 1 or more.
 */
export function refusalParts(message, charged = 0) {
  const text = String(message || '').trim();
  const sentences = text.match(/[^.?!]+[.?!]*\s*/g) || [];
  const kept = sentences.filter((s) => HELD.test(s) || !NOTHING_USED.test(s)).join('').trim();
  return { said: kept || text, used: usedWords(charged) };
}

/**
 * The ways forward under a refusal or a failure, as keys: [{ id, label }] with id 'retake' | 'type' | 'retry' | 'retry-same' |
 * 'credits'. `state` is mistakeOutcome's state; `photo` whether the ask carried a photo.
 */
export function waysForward({ state, photo = false, noCredits = false } = {}) {
  if (state === 'unknown') return [{ id: 'retry-same', label: CHAT_COPY.tryAgain }];
  if (state === 'failed') return [{ id: 'retry', label: CHAT_COPY.tryAgain }];
  if (state === 'blocked') return noCredits ? [{ id: 'credits', label: CHAT_COPY.seeCredits }] : [];
  if (state === 'photo_over') return [{ id: 'type', label: CHAT_COPY.typeInstead }];
  if (state === 'refused' && photo) return [{ id: 'retake', label: CHAT_COPY.retakePhoto }, { id: 'type', label: CHAT_COPY.typeInstead }];
  return [];
}

// ---- Copying an answer --------------------------------------------------------------------------------------------------------

/** A question brought from another test, answered, as plain text for the clipboard. `copy` is MISTAKE_COPY (the answer's labels). */
export function mistakeAsText(mistake, copy) {
  if (!mistake) return '';
  const parts = [
    `${copy.tests}\n${mistake.tests}`,
    `${copy.why}\n${mistake.answer?.sure ? `${copy.answerIs(mistake.answer.text)}\n` : `${copy.notSure}\n`}${mistake.why}`,
    mistake.slip ? `${copy.slip}\n${mistake.slip}` : null,
  ];
  return parts.filter(Boolean).join('\n\n');
}

/** One of Mobi's turns as plain text for the clipboard. */
export function turnAsText(turn, copy = null) {
  if (turn?.mistake) return mistakeAsText(turn.mistake.mistake, copy);
  return String(turn?.response?.reply || '').trim();
}
