// What the feature tour's screens do when a reader taps them, and when the tour holds the page (16 Nov 2026, owner on his
// phone: "It needs to be interactive"; the tour "is doing weird movements" from its second tool on). Pure, so the rules are
// tested without React (tourTaps.test.mjs); TourScreens.jsx draws them.
//
// For a mouse or a trackpad every screen still plays its short scripted demo (tourSequence.mjs); on a touch screen it
// rests on its finished frame (FeatureTour.jsx `still`). A tap takes over at once: the demo stops, the
// screen shows its finished frame with the reader's state on it, and from then on the screen is the reader's for the life
// of the page (the demo never plays on it again, so nothing the reader did is undone by a restart). Every value here is
// sample data on the page itself: no network, no storage.

// A mouse or a trackpad: the main pointer is fine and hovers. Every device that storyGesture.mjs FLOW_QUERY calls
// touch-first fails this query. Since 16 Nov 2026 night every device gets the one held stage (FeatureTour.jsx; for a few
// hours that evening a finger got a stack of the five screens instead); this query now only picks the section's sub
// (r16-tour-stack.css). On a touch screen no demo plays: each screen rests on its finished frame and waits for a tap.
export const TOUR_HOLD = '(hover: hover) and (pointer: fine)';

const LETTERS = 'ABCD';
export const letter = (i) => LETTERS[i] ?? '';

// ---------- Practice: a mock's question. A tap picks; another tap moves the pick. It never says right or wrong.
// The demo picks A at step 5 and saves at step 6 (TourScreens PRACTICE_T); the reader's pick shows saved at once.
export const PRACTICE_SAVED_AT = 6;
export function practiceView({ step, mine = null }) {
  const reader = Number.isInteger(mine);
  const picked = reader ? mine : step >= PRACTICE_SAVED_AT - 1 ? 0 : null;
  const saved = reader || step >= PRACTICE_SAVED_AT;
  return { picked, saved, answered: saved ? 22 : 21, said: reader ? `Picked ${letter(mine)}. 22 of 50 answered. Saved.` : '' };
}

// ---------- Learn: a recall card. The right meaning is B.
// A right answer: "Correct", and the card comes back in a few days (a card on its first review after it graduates is
// due 2 days on: data/study_scheduler.mjs, FSRS at 0.9 retention). A missed card is rated 1 by the study engine
// (data/study_engine.js) and FSRS makes it due again in 1 to 10 minutes, which the app itself words "comes back in under
// an hour" (src/components/study/studyCopy.js whenDue, StudyRun's "Saved" line). tourTaps.test.mjs runs both.
export const LEARN_RIGHT = 1;
export const LEARN_LINES = Object.freeze({ right: 'Correct', rightNext: 'Comes back in a few days', missNext: 'Comes back in under an hour' });
export function learnView({ step, mine = null }) {
  const reader = Number.isInteger(mine);
  const picked = reader ? mine : step >= 4 ? LEARN_RIGHT : null;
  const verdict = reader ? (mine === LEARN_RIGHT ? 'right' : 'miss') : step >= 5 ? 'right' : null;
  const lead = verdict === 'right' ? LEARN_LINES.right : verdict === 'miss' ? `The meaning here is ${letter(LEARN_RIGHT)}.` : '';
  const next = verdict === 'right' ? (reader || step >= 6 ? LEARN_LINES.rightNext : '') : verdict === 'miss' ? LEARN_LINES.missNext : '';
  const state = (i) => {
    if (verdict === 'miss') return i === mine ? 'miss' : i === LEARN_RIGHT ? 'answer' : null;
    return i === picked ? 'picked' : null;
  };
  return { picked, verdict, lead, next, state, then: reader || step >= 6, said: reader ? `${lead}${lead.endsWith('.') ? '' : '.'} ${next}.` : '' };
}

// ---------- Ask Mobi: the two quick replies. Both answers are the sample record's own (labStory.mjs), never typed twice.
export const START_REPLY = '10 Partnership questions are set. They open in Practice.';
const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];
const series = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')}, then ${items.at(-1)}` : String(items[0] ?? ''));
/** "Why this?": Partnership's lost marks in each of the latest mocks, oldest first, and that it cost the most in the latest. */
export function whyReply(story) {
  const lost = story.swot.partnershipLost;
  const worst = story.chapters[0]?.chapter;
  const tail = worst === 'Partnership' ? ' It cost the most in your latest, so tonight starts there.' : '';
  return `Partnership cost you marks in each of your last ${COUNT_WORDS[lost.length] ?? lost.length} mocks: ${series(lost)}.${tail}`;
}
export function askView({ mine = null, story }) {
  const reply = mine === 'why' ? whyReply(story) : mine === 'start' ? START_REPLY : '';
  return { reply, said: reply };
}

// ---------- Benchmarks: the three levels of the ladder. A tap makes that level the day's target.
export const BENCH_RUN = 72;
export const BENCH_LEVELS = Object.freeze([
  Object.freeze({ id: 'du', name: 'DU level', pct: 88 }),
  Object.freeze({ id: 'college', name: 'College level', pct: 82 }),
  Object.freeze({ id: 'daily', name: 'Daily', pct: 78 }),
]);
export const BENCH_DEFAULT = 'daily';
export function benchView({ target = BENCH_DEFAULT, mine = null } = {}) {
  const id = mine ?? target;
  const level = BENCH_LEVELS.find((l) => l.id === id) ?? BENCH_LEVELS.find((l) => l.id === BENCH_DEFAULT);
  const short = Math.max(0, level.pct - BENCH_RUN);
  return {
    target: level.id,
    pct: level.pct,
    short,
    line: `25 questions. Hold ${level.pct}% accuracy at 55 seconds a question.`,
    said: mine ? `${level.name} is today’s target, ${level.pct}%. You are ${short} points short.` : '',
  };
}

// ---------- The Mob: Fix it together opens one public sample question (sampleFive.mjs, read on the server by page.js).
// The first pick stands, as in a real question; the right option is ticked and the reason shows, in the words the home
// sample's own card uses for the same question (DemoDrill: "Correct." or "Not quite.", then the reason).
export function mobView({ sample, open = false, mine = null }) {
  if (!sample) return { open: false, answered: false, right: false, state: () => null, mark: '', verdict: '', said: '' };
  const answered = Number.isInteger(mine);
  const right = answered && mine === sample.correct;
  const mark = !answered ? '' : right ? 'Correct.' : 'Not quite.';
  const state = (i) => (!answered ? null : i === sample.correct ? 'right' : i === mine ? 'wrong' : null);
  const said = !answered ? '' : right
    ? `Correct. ${sample.why}`
    : `Not quite. The answer is ${letter(sample.correct)}, ${sample.options[sample.correct]}. ${sample.why}`;
  return { open, answered, right, state, mark, verdict: answered ? sample.why : '', said };
}
