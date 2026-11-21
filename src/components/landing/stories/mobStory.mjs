// The Mob row's story for the home page's one-place frame (owner LK365, 21 Nov 2026: the Mob row's animation "is extremely
// lackluster"; show the feature working, not a paragraph). Pure data, so node --test holds it
// (data/tests/story_mob_1121.test.mjs); MobStory.jsx draws the screen, demo/CursorDemo.jsx plays MOB_STORY.steps on it.
//
// What the film shows (the real rules, held by the test against their sources):
//   1. Start a Mob and share its code: the den with its 8-character code (src/lib/mob/model.mjs CODE_RE); the cursor presses
//      Copy the code; three friends take seats one by one, each as a starter Fold (src/lib/mob/folds.mjs STARTERS).
//   2. Everyone gets the same five for 24 hours: the sprint card (a sprint is 5 questions, games.mjs COUNTS.sprint; "Everyone
//      gets the same questions for 24 hours", denCopy.mjs asyncLineStart); the cursor presses Start the sprint; the runs land
//      one after another while the 24 hours run down, then the game closes.
//   3. See who got what: See the podium; the rows settle by marks (+5 right, -1 wrong, 0 skipped: games.mjs MARK_RIGHT,
//      MARK_WRONG) and the question that caught most of the Mob is flagged (model.mjs computeTrap: 3 or more runs, one wrong
//      option picked by 2 or more and by at least half; the trap is "most of you", never a count, games.mjs F3). The trap is
//      known only once the game has closed (games.mjs F1), so the card closes first.
//   4. Then fix the one that caught you, together: Fix question 3 together opens one fresh question like it, only for you
//      (playModel.mjs COPY.freshTitle); the question is the home page's own public Economics sample (sampleFive.mjs
//      publicSample), the same one the old tour's Mob screen opened, and the cursor answers it right.
// The people, their picks and the Mob's code are a plain sample (the screen reads as one); they obey the rules above.
import { publicSample } from '../sampleFive.mjs';

// The tour slide's own words (homeCopy.mjs buildTour, id mob; the test holds them equal).
export const MOB_TITLE = 'Bring your friends. Race the same questions.';
export const MOB_CHIP = 'Playing every game your Mob starts is free on every plan.';

// The rules this screen shows, mirrored here so the client bundle does not pull the Mob's server-side model in.
export const MOB_RULES = Object.freeze({
  markRight: 5, // games.mjs MARK_RIGHT
  markWrong: -1, // games.mjs MARK_WRONG
  count: 5, // games.mjs COUNTS.sprint[0]
  hours: 24, // denCopy.mjs asyncLineStart, "for 24 hours"
  seats: 5, // model.mjs MAX_MEMBERS
});

// The Mob: a name from the kind list (src/lib/mob/names.mjs MOB_NAMES[0]), Economics (the subject of the fresh question),
// and a sample code in the real alphabet and length (model.mjs CODE_ALPHABET, CODE_RE: 8 characters).
export const MOB_DEN = Object.freeze({ name: 'Chai Circle', subject: 'Economics', code: 'K7MQ4R2X' });

// The sprint's answer key and everyone's picks (option index; -1 is a skip). Seat order is the order they joined.
// You: right, right, B on Q3 (wrong), right, right = 4 right, 1 wrong = 19. The old tour's screen gave you 19 as well.
export const MOB_KEYS = Object.freeze([0, 2, 3, 1, 2]);
export const MOB_MEMBERS = Object.freeze([
  Object.freeze({ id: 'you', name: 'You', fold: 'dart', picks: Object.freeze([0, 2, 1, 1, 2]) }),
  Object.freeze({ id: 'riya', name: 'Riya', fold: 'hexa', picks: Object.freeze([0, -1, 1, 1, 2]) }),
  Object.freeze({ id: 'aman', name: 'Aman', fold: 'kandil', picks: Object.freeze([0, 2, 3, 1, -1]) }),
  Object.freeze({ id: 'zoya', name: 'Zoya', fold: 'dogear', picks: Object.freeze([3, 2, 1, 1, -1]) }),
]);

/** One pick against its key: 'right' | 'wrong' | 'skip'. */
export const pickState = (pick, key) => (!Number.isInteger(pick) || pick < 0 ? 'skip' : pick === key ? 'right' : 'wrong');

/** A run's marks, CUET style. */
export function marksOf(picks, keys = MOB_KEYS) {
  let marks = 0;
  picks.forEach((p, q) => {
    const s = pickState(p, keys[q]);
    if (s === 'right') marks += MOB_RULES.markRight;
    else if (s === 'wrong') marks += MOB_RULES.markWrong;
  });
  return marks;
}

/** The trap as model.mjs computeTrap finds it (3+ runs; one wrong option by 2+ and by at least half): its 1-based number. */
export function trapNumber(members = MOB_MEMBERS, keys = MOB_KEYS) {
  if (members.length < 3) return null;
  let best = null;
  keys.forEach((key, q) => {
    const counts = new Map();
    for (const m of members) {
      const p = m.picks[q];
      if (Number.isInteger(p) && p >= 0 && p !== key) counts.set(p, (counts.get(p) || 0) + 1);
    }
    for (const [, count] of [...counts].sort((a, b) => a[0] - b[0])) {
      if (count < 2 || count * 2 < members.length) continue;
      if (!best || count > best.count) best = { number: q + 1, count };
    }
  });
  return best ? best.number : null;
}

/** Each member's marks and place (ties share a place), and where their row stands once the rows settle. */
export function mobBoard(members = MOB_MEMBERS, keys = MOB_KEYS) {
  const rows = members.map((m, seat) => ({ ...m, seat, marks: marksOf(m.picks, keys), states: m.picks.map((p, q) => pickState(p, keys[q])) }));
  const order = [...rows].sort((a, b) => b.marks - a.marks || a.seat - b.seat);
  return rows.map((r) => ({ ...r, rank: order.indexOf(r), place: 1 + rows.filter((o) => o.marks > r.marks).length }));
}

export const MOB_TRAP = trapNumber();

// The screen's words: each is the real screen's string (the test holds every one to its source).
export const MOB_WORDS = Object.freeze({
  you: 'You', // DenCopy.you
  openSeat: 'Open seat', // DenCopy.openSeat
  copyCode: 'Copy the code', // DenCopy.copyCode
  codeCopied: 'The code is copied.', // DenCopy.codeCopied
  subtitle: (n) => (n <= 1 ? `${MOB_DEN.subject}, just you` : `${MOB_DEN.subject}, ${n} of you`), // DenCopy.denSubtitle
  gameTitle: 'Your sprint', // DenCopy.gameTitle (your own sprint)
  openLine: `${MOB_RULES.count} ${MOB_DEN.subject} questions. Be the first to set a run.`, // DenCopy.openLine, no run yet
  openLineRuns: `${MOB_RULES.count} ${MOB_DEN.subject} questions. Race the runs so far.`, // DenCopy.openLine, once a run is in
  startKey: 'Start the sprint', // DenCopy.startTheSprint
  runsSoFar: 'Runs so far:', // DenCopy.runsSoFar's lead
  seePodium: 'See the podium', // COPY.seePodium (playModel.mjs)
  trapCaught: (n) => `Question ${n} caught most of you.`, // COPY.trapCaught
  fixKey: (n) => `Fix question ${n} together`, // COPY.fixTogether
  fixTitle: 'Fix it together', // COPY.fixTitle
  fixSub: `${MOB_DEN.name}, one trap`, // COPY.fixSub
  freshTitle: 'One fresh question, only for you', // COPY.freshTitle
  fixRight: 'Right. That one is fixed for you.', // COPY.fixRight
  fixWrong: 'Not this one. Here is why.', // COPY.fixWrong
  backToDen: 'Back to the den', // COPY.backToDen
  closed: 'Closed',
  // The game's clock as the runs land: it opens with the full 24 hours and closes when they are up (sample hours between).
  hoursLeft: Object.freeze([`${MOB_RULES.hours} h left`, '17 h left', '9 h left', '2 h left']),
});

// When things land after a click, in ms (MobStory.jsx; the script's dwells wait for them, the test holds that).
export const MOB_TIMING = Object.freeze({
  arrive: Object.freeze([380, 860, 1340]), // the three friends take their seats after Copy the code
  runs: Object.freeze([120, 700, 1250, 1800]), // each run starts landing after Start the sprint, in seat order
  pip: 85, // one question's mark after the one before it, within a run
  closed: 2450, // the 24 hours are up: the card closes and See the podium appears
});

// The fresh question's right option (the frame passes publicSample('Economics') as the `sample` prop).
export const MOB_SAMPLE = publicSample(MOB_DEN.subject);
const RIGHT = (MOB_SAMPLE?.correct ?? 0) + 1;

const click = (target, move, dwell, at, more = {}) => Object.freeze({ target, move, dwell, click: true, ...(at ? { at } : {}), ...more });

export const MOB_STORY = Object.freeze({
  id: 'mob',
  title: MOB_TITLE,
  chip: MOB_CHIP,
  steps: Object.freeze([
    Object.freeze({ say: 'Start a Mob and share its code.', focus: '.stm-den', wait: 600 }),
    click('[data-demo="mob-share"]', 500, 1740),
    Object.freeze({ say: 'Everyone gets the same five, for 24 hours.', focus: '.stm-game', wait: 550 }),
    click('[data-demo="mob-start"]', 480, 2150),
    // "See who got what." (critic round, 21 Nov 2026 evening: the whole card was its subject): the key that reveals it, then
    // the marks table alone, the rows in podium order, question 3's column marked as the trap.
    Object.freeze({ say: 'See who got what.', focus: '.stm-foot', wait: 550 }),
    click('[data-demo="mob-podium"]', 450, 0),
    Object.freeze({ focus: '.stm-rows', wait: 1500 }),
    Object.freeze({ say: 'Then fix the one that caught you, together.', focus: '.stm-foot', wait: 550 }),
    click('[data-demo="mob-fix"]', 450, 700, null, { focus: '.stm-sheet' }),
    click(`[data-demo="mob-choice"]:nth-child(${RIGHT})`, 480, 1170, [0.3, 0.5]),
  ]),
});
