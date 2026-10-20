// The Mob explainer on the web (owner decision D166, pass-1020 MOB-EXPLAINER.md, copy as changed by the owner's K9 at
// 2:05 pm on 20 Oct). Pure: no DOM, no React, so node tests hold every rule (data/tests/mob_explainer_1020.test.mjs).
//   - the copy table (7 slides, the setup), with the billing variant of slide 3 chosen by the server's flag;
//   - the seen flag, per account and per device (localStorage `mob.explainer.v1.seen:<user id>`), which never loops;
//   - where Skip and the end keys go in each mode (start, join, invite, replay) and which keys slide 7 shows;
//   - the setup's validation and the body it sends (the same create call and fields as the old D0a sheet);
//   - the timelines: the main beats of each slide in ms, and their reduced-motion times (the same order, half the delay).
import { checkName } from '../../../../lib/mob/model.mjs';
import { MOB_NAMES, validNameKey } from '../../../../lib/mob/names.mjs';

export const EXPLAINER_VERSION = 'v1';
export const SEEN_PREFIX = `mob.explainer.${EXPLAINER_VERSION}.seen`;
export const SLIDE_COUNT = 7;
export const MODES = Object.freeze(['start', 'join', 'invite', 'replay']);

// ---------------------------------------------------------------- copy (final; K9 replaces the approved lines it names)

const S3_BILLING_ON = 'With Pro you can start any game. On Free you get one start in each Mob every week, and a friend with Pro can pass you the mic. Joining and playing are always free.';
const S3_BILLING_OFF = 'Anyone in your Mob can start a game. Joining and playing are always free.';

export const SLIDE_COPY = Object.freeze([
  { id: 's1', title: 'This is your Mob', body: 'You and up to 4 friends. Start a quick game any time. Your friends get 24 hours to play the same questions, and you see who did best.' },
  { id: 's2', title: 'Everyone sits as a Fold', body: "The Folds are paper friends. Each one was a mistake once, until someone fixed it. Mobi came from the very first fix, so he's the eldest. You start as one of these four." },
  { id: 's3', title: 'Four ways to play', body: S3_BILLING_ON, bodyOff: S3_BILLING_OFF, soon: 'Coming soon.', soonLine: 'Live rooms, where everyone starts on one 3, 2, 1.' },
  { id: 's4', title: 'See who did best', body: "After a game, the podium goes by CUET marks: +5 if right, −1 if wrong, 0 if you skip. Kabir skipped the one he wasn't sure of and beat Riya by a mark. Then everyone gets one highlight." },
  { id: 's5', title: 'Fix it together', body: "When a game closes, the question that caught most of you becomes your Mob's to fix. See why, try a fresh one, and on Wednesday one more checks it held. If 2 of you pass, it's fixed." },
  { id: 's6', title: 'Stitch a week together', body: "Answer 15 questions each in Mob games and papers, and the week is stitched onto your Mob's pennant. Nobody can break it alone. Your own chain needs 5 questions a day, and a rest pass covers a missed day." },
  { id: 's7', title: 'Earned, never bought', body: "Your Mob's first weekly quest brings Hop to everyone in it. The rest come from real things you do, and each one goes on your shelf. None can be bought." },
].map(Object.freeze));

/** The seven slides as the student reads them. billingOn is the server's PLAY_BILLING_ENABLED, never a client guess. */
export function slidesFor({ billingOn = false } = {}) {
  return SLIDE_COPY.map((s) => (s.id === 's3' ? { ...s, body: billingOn ? s.body : s.bodyOff } : { ...s }));
}

/** What the polite live region reads when a slide lands: "3 of 7. Four ways to play. <body> Coming soon. ..." */
export function liveLine(slides, i) {
  const s = slides[i];
  if (!s) return '';
  return `${i + 1} of ${slides.length}. ${s.title}. ${s.body}${s.soon ? ` ${s.soon} ${s.soonLine}` : ''}`;
}

/** The four game cards on slide 3 (K9). Every fact is the server's: COUNTS, the 24-hour window, rematch, the paper. */
export const PLAY_CARDS = Object.freeze([
  Object.freeze({ id: 'sprint', label: 'Sprint', figure: '5', line: 'questions', foot: 'Open for 24 hours' }),
  Object.freeze({ id: 'round', label: 'Your own round', chips: Object.freeze(['10', '15', '20']), line: 'Pick a chapter and a length', foot: 'Open for 24 hours' }),
  Object.freeze({ id: 'rematch', label: 'Rematch', line: 'The same chapter and length, one more go', foot: 'Open for 24 hours' }),
  Object.freeze({ id: 'paper', label: "This week's Mob paper", figure: '10', line: 'questions in 10 minutes', foot: 'The same paper for everyone. Until Sunday 11:59 PM' }),
]);

/** Slide 4's fixture (the spec's Chai Circle): marks per question and, after the podium, each run's one highlight. */
export const PODIUM_FIXTURE = Object.freeze({
  trapQ: 3,
  rows: Object.freeze([
    Object.freeze({ who: 'kabir', name: 'Kabir', fold: 'hexa', cells: Object.freeze(['r', 'r', 'r', 's', 'r']), arrivals: Object.freeze([52, 88, 121, 170, 214]), picks: Object.freeze([0, 1, 2, -1, 3]) }),
    Object.freeze({ who: 'riya', name: 'Riya', fold: 'dogear', cells: Object.freeze(['r', 'r', 'r', 'w', 'r']), arrivals: Object.freeze([41, 79, 130, 151, 190]), picks: Object.freeze([0, 1, 2, 1, 3]) }),
    Object.freeze({ who: 'you', name: 'You', fold: 'dart', cells: Object.freeze(['r', 'r', 's', 's', 'r']), arrivals: Object.freeze([37, 88, 118, 149, 186]), picks: Object.freeze([0, 1, -1, -1, 3]) }),
  ]),
  // From games.mjs assignMoments over the rows above (the test recomputes it): the short form of each moment's line.
  highlights: Object.freeze({ kabir: 'Fastest right answer', riya: 'Quickest finish', you: 'No minus marks' }),
});
export const MARK_FOR = Object.freeze({ r: 5, w: -1, s: 0 });
export const marksOf = (cells) => cells.reduce((m, c) => m + MARK_FOR[c], 0);

export const EXPLAINER_COPY = Object.freeze({
  label: 'How the Mob works',
  skip: 'Skip',
  next: 'Next',
  startYourMob: 'Start your Mob',
  joinWithCode: 'Join with a code',
  backToMob: 'Back to your Mob',
  replayRow: 'How the Mob works',
  replayLine: 'Watch the 7 slides again',
  link: 'How the Mob works',
});

/** The invite's lead key: the Mob's name only when the join preview really carries it. */
export const inviteKeyLabel = (mobName) => {
  const n = typeof mobName === 'string' ? mobName.trim() : '';
  return n ? `Join ${n}` : "Join your friend's Mob";
};

/**
 * Slide 7's keys. The first is the volt key and is the one the student came from (start: Start your Mob; join: Join with a
 * code; invite: Join <Mob name>, then Start your Mob). A replay shows one key, Back to your Mob.
 * Each key: { id: destination, label, primary }.
 */
export function endKeys(mode, { mobName = null } = {}) {
  const start = { id: 'setup', label: EXPLAINER_COPY.startYourMob };
  const join = { id: 'join', label: EXPLAINER_COPY.joinWithCode };
  if (mode === 'replay') return [{ id: 'den', label: EXPLAINER_COPY.backToMob, primary: true }];
  if (mode === 'invite') return [{ id: 'invite', label: inviteKeyLabel(mobName), primary: true }, { ...start, primary: false }];
  if (mode === 'join') return [{ ...join, primary: true }, { ...start, primary: false }];
  return [{ ...start, primary: true }, { ...join, primary: false }];
}

/** Where Skip goes: where the student was heading. start: the setup; join: the code screen; invite: the code screen with the
 *  code filled (the invite page itself); replay: back to the den. */
export function skipTo(mode) {
  return { start: 'setup', join: 'join', invite: 'invite', replay: 'den' }[mode] || 'setup';
}

/** Which way out marks the explainer seen: reaching slide 7, Skip, or an end key. Escape, the back of the browser or a
 *  click outside the panel return to where the student was and leave it unseen, so the next Start shows it again. */
export const marksSeen = (how) => how === 'last' || how === 'skip' || how === 'key';

// ---------------------------------------------------------------- the seen flag (per account, per device)

export const seenKey = (userId) => `${SEEN_PREFIX}:${String(userId)}`;

/**
 * The gate. storage: localStorage-like (may be missing or throw). Every read and write is wrapped: a store that fails
 * reads as unseen, but what was marked in this page session is remembered in memory, so the explainer never loops
 * (Skip from it never opens it again). Accounts are kept apart by the key.
 */
export function createSeenGate(storage) {
  const memory = new Set();
  const get = () => { try { return typeof storage === 'function' ? storage() : storage; } catch { return null; } };
  return {
    seen(userId) {
      if (!userId) return false;
      if (memory.has(String(userId))) return true;
      try { return get()?.getItem(seenKey(userId)) === '1'; } catch { return false; }
    },
    mark(userId) {
      if (!userId) return false;
      memory.add(String(userId));
      try { get()?.setItem(seenKey(userId), '1'); return true; } catch { return false; }
    },
  };
}

// ---------------------------------------------------------------- the setup (one question per screen)

// D168/D169 (owner, 2:20 pm): clean and minimal, no step a student does not need. A student who already sits as a Fold
// (their seat, from the shelf read) skips "Who will you be?" and sees "You play as <Fold>" with Change on the last step;
// a student with exactly one CUET subject skips the subject step (it is preselected and on the pennant). The step dots
// show only the steps that student gets.
export const SETUP_STEP_IDS = Object.freeze(['fold', 'name', 'subject', 'you']);
export const SETUP_STEPS = SETUP_STEP_IDS.length;
export const SETUP_COPY = Object.freeze({
  foldTitle: 'Who will you be?',
  foldLine: 'Pick your Fold. You sit as it in every Mob, and you can earn more.',
  pickFoldKey: 'Pick your Fold',
  nameTitle: 'Name your Mob',
  nameLine: 'Names come from our list, so every Mob name is kind.',
  pickNameKey: "Pick your Mob's name",
  showSixMore: 'Show six more',
  showFirstSix: 'Back to the first six',
  subjectTitle: "Pick the subject you'll play",
  subjectLine: 'A Mob plays in one of your CUET subjects. Every game in it uses that subject.',
  youTitle: 'What should your Mob call you?',
  youLabel: 'Your name in the Mob',
  youNote: 'Only your Mob sees it. 2 to 18 letters.',
  youRule: 'Use 2 to 18 letters. Spaces, dots, apostrophes and hyphens are fine.',
  typeNameKey: 'Type your first name',
  colour: 'Colour',
  marks: 'Your Mob sees your marks in games. One switch in Mob settings keeps them private.',
  under: 'Next, you can invite up to 4 friends.',
  next: 'Next',
  back: 'Back',
  change: 'Change',
  playAs: (foldName) => `You play as ${foldName}`,
  starting: 'Starting your Mob',
  previewName: 'Your Mob',
  pickAFold: 'Pick a Fold',
  you: 'You',
});
export const COLOUR_NAMES = Object.freeze(['Teal', 'Sky', 'Violet', 'Rose', 'Amber', 'Green', 'Coral', 'Slate']);

/** The steps this student gets, in order. */
export function setupSteps({ seatFold = null, subjects = [] } = {}) {
  return SETUP_STEP_IDS.filter((id) => (id === 'fold' ? !seatFold : id === 'subject' ? subjects.length !== 1 : true));
}

/** The answers a setup starts from: the seat Fold if the student has one, else none picked; no name picked; the first of
 *  the student's subjects and their first name, both visible and editable (T001); the first colour. */
export function initialSetup({ subjects = [], suggestedName = '', seatFold = null } = {}) {
  const steps = setupSteps({ seatFold, subjects });
  return { steps, at: 0, seatFold: seatFold || null, returnTo: null, fold: seatFold || null, nameKey: null, subject: subjects[0]?.id || '', name: suggestedName || '', colour: 0 };
}

/** The step on screen: fold | name | subject | you. */
export const stepOf = (st) => st.steps[st.at];
export const isLastStep = (st) => st.at === st.steps.length - 1;

/** The key under the step: its words and whether it can be pressed. */
export function setupKey(st) {
  const id = stepOf(st);
  if (id === 'fold') return st.fold ? { label: SETUP_COPY.next, enabled: true } : { label: SETUP_COPY.pickFoldKey, enabled: false };
  if (id === 'name') return validNameKey(st.nameKey) ? { label: SETUP_COPY.next, enabled: true } : { label: SETUP_COPY.pickNameKey, enabled: false };
  if (id === 'subject') return { label: SETUP_COPY.next, enabled: Boolean(st.subject) };
  const ok = checkName(st.name).ok && validNameKey(st.nameKey) && Boolean(st.fold);
  return ok ? { label: `Start ${MOB_NAMES[st.nameKey]}`, enabled: true } : { label: SETUP_COPY.typeNameKey, enabled: false };
}

/** The name field's note: the rule in place of the note once what is typed cannot be a name (2 or more characters typed). */
export function nameNote(name) {
  const v = String(name || '').trim();
  if (v.length >= 2 && !checkName(v).ok) return { text: SETUP_COPY.youRule, bad: true };
  return { text: SETUP_COPY.youNote, bad: false };
}

/** The create body: the same call and fields as the D0a sheet (POST /api/mob { subject, name, colour, nameKey, fold }), or
 *  null while an answer is missing. */
export function setupBody(st) {
  const checked = checkName(st.name);
  if (!st.fold || !validNameKey(st.nameKey) || !st.subject || !checked.ok) return null;
  const colour = Number.isInteger(st.colour) && st.colour >= 0 && st.colour < COLOUR_NAMES.length ? st.colour : 0;
  return { subject: st.subject, name: checked.name, colour, nameKey: st.nameKey, fold: st.fold };
}

/** Back steps back; Back on the first step leaves to D0 ('exit'); Back from a Fold change returns to the step it came from. */
export function setupBack(st) {
  if (st.returnTo && stepOf(st) === 'fold') return { ...st, at: st.steps.indexOf(st.returnTo), returnTo: null };
  return st.at > 0 ? { ...st, at: st.at - 1 } : 'exit';
}
/** Forward, only when the key allows it (a Fold change goes straight back to where it was opened). */
export function setupNext(st) {
  if (!setupKey(st).enabled || isLastStep(st)) return st;
  if (st.returnTo && stepOf(st) === 'fold') return { ...st, at: st.steps.indexOf(st.returnTo), returnTo: null };
  return { ...st, at: st.at + 1 };
}
/** "Change" beside "You play as <Fold>": the Fold step, which comes back to this step when done. */
export function changeFold(st) {
  const steps = st.steps.includes('fold') ? st.steps : ['fold', ...st.steps];
  const from = stepOf(st);
  return { ...st, steps, at: steps.indexOf('fold'), returnTo: from };
}
/** The subject shows on the pennant once it is chosen: from its step on, or from the start when there is no subject step. */
export const pennantShowsSubject = (st) => !st.steps.includes('subject') || st.at >= st.steps.indexOf('subject');

/** Six names at a time, wrapping (the den's own namePage rule). */
export function namesOnPage(page, size = 6) {
  const pages = Math.ceil(MOB_NAMES.length / size);
  const p = ((page % pages) + pages) % pages;
  return { names: MOB_NAMES.slice(p * size, p * size + size).map((text, i) => ({ key: p * size + i, text })), page: p, pages };
}

// ---------------------------------------------------------------- timelines

/**
 * The main beats of each slide, ms from the moment the slide lands: [beat, full, reduced]. Reduced defaults to half the
 * delay (brand kit 7: fewer and gentler, order kept); null means the beat does not play under reduced motion (squash,
 * particles, sheen, loops, hops). The slide builders read their times from here.
 */
const TL_SPEC = [
  // 1. This is your Mob
  [['room', 0], ['pool', 80], ['pennant', 160], ['fold0', 300], ['fold1', 390], ['fold2', 480], ['fold3', 570], ['seat', 700],
    ['tag0', 720], ['tag1', 810], ['tag2', 900], ['tag3', 990], ['seatTag', 1060], ['wave', 1250], ['idle', 1300, null]],
  // 2. Everyone sits as a Fold
  [['cone', 0], ['sheet', 120], ['pick', 420], ['crease', 560], ['fill', 900], ['tick', 980], ['glints', 1180, null],
    ['corners', 1560, null], ['shrink', 2220, null], ['tint', 2300, null], ['visor', 2440, null], ['mobi', 2640, 750], ['bits', 2660, null],
    ['eldest', 2950, 900], ['starter0', 3000, 1000], ['starter1', 3090, 1045], ['starter2', 3180, 1090], ['starter3', 3270, 1135],
    ['starterTag0', 3400, 1200], ['sway', 3400, null], ['starterTag3', 3670, 1335]],
  // 3. Four ways to play (K9)
  [['cone', 0], ['stack', 160], ['deal0', 520], ['deal1', 630], ['deal2', 740], ['deal3', 850],
    ['cells', 1300], ['chips', 1500], ['loop', 1600], ['clock', 1700]],
  // 4. See who did best
  [['cone', 0], ['sheet', 120], ['cells', 400], ['ringSkip', 1420], ['ringWrong', 1480], ['third', 2000, 1000], ['second', 2420, 1300],
    ['first', 2840, 1600], ['sheen', 3480, null], ['hl0', 3700], ['hl1', 3790], ['hl2', 3880]],
  // 5. Fix it together
  [['sheet', 80], ['pick', 380], ['strike', 640], ['fill', 700], ['why', 900], ['mobi', 1100], ['path', 1300], ['now', 1550],
    ['nowTick', 1650], ['leaf', 2050], ['heads', 2450], ['seal', 2900], ['fixed', 3150], ['progress', 3300], ['crane', 3350], ['wiggle', 3700, null]],
  // 6. Stitch a week together
  [['glow', 0], ['pennant', 60], ['quest', 160], ['count', 500], ['pulse', 1180, null], ['fold', 1620], ['seal', 1700], ['done', 1900],
    ['lamp', 2050, null], ['stitch', 2350], ['roll', 2530], ['heads', 3000], ['days', 3250], ['moon', 3800]],
  // 7. Earned, never bought
  [['cone', 0], ['pull', 420, null], ['leak', 880, null], ['pop', 1000], ['open', 1100], ['hop', 1180, 600], ['name', 1600], ['line', 1760],
    ['shelf', 2100], ['sil0', 2200], ['cap0', 2300], ['sil3', 2470], ['cap3', 2570]],
];
export const TEXT_BEATS = Object.freeze({ title: 140, body: 220, soon: 320 });

/** { beat: ms } for slide i (0-based); reduced: the reduced-motion times, with the beats that do not play left out. */
export function timeline(i, { reduced = false } = {}) {
  const out = {};
  for (const [k, full, rm] of TL_SPEC[i] || []) {
    if (!reduced) out[k] = full;
    else if (rm !== null) out[k] = rm === undefined ? full * 0.5 : rm;
  }
  return out;
}

/**
 * The times a slide builder passes to the motion kit, whose reduced form halves every delay it is given: the full time,
 * or under reduced motion twice the reduced time (so the kit lands each beat on its reduced time above).
 */
export function buildTimes(i, { reduced = false } = {}) {
  const out = {};
  for (const [k, full, rm] of TL_SPEC[i] || []) out[k] = !reduced || rm === null || rm === undefined ? full : rm * 2;
  return out;
}

/** The beats in the order they play, for the order test: full and reduced must list the same beats in the same order. */
export function beatOrder(i, { reduced = false } = {}) {
  const t = timeline(i, { reduced });
  return Object.keys(t).map((k, idx) => ({ k, t: t[k], idx })).sort((a, b) => a.t - b.t || a.idx - b.idx).map((x) => x.k);
}
