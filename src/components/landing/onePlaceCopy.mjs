// The words of /home-next's one frame (OnePlace.jsx; owner LK363, 20 Nov 2026). Sentence case, no em dash, no "!", no
// figure the code does not hold. The rows' tools are the landing's own real screens; their lines say what each one does.
// The "Also inside" chips name only tools that are live, from the same switches the feature tour reads (homeCopy.mjs
// buildTour): Learn while study content is on, Benchmarks always, the Mob while it is live.
// Two lines came over from the first /home-next (20 Nov 2026, Revision 2 of its spec; the owner asked for its good parts on
// 21 Nov): the creators' sub with the sign-up floor, and the FAQ's "What do I get free?" answered from the code's constants.
// 21 Nov, after a critic's walk: each row carries the proof line its live section had, in that section's own words and from
// the same constants (the exam section's NTA line, the Key cards bank line, Bring a mistake's credit line).
import { EXAM_HEAD, INSTAGRAM_HEAD, TOUR_ICON, freePlan } from './homeCopy.mjs';
import { BANK_WORDS, KEY_CARDS_WORDS } from './keyCardsCopy.mjs';
import { bringMistakeWords } from './bringMistakeCopy.mjs';

const firstSentence = (text) => `${String(text).split(/(?<=\.) /)[0]}`;
const lastSentence = (text) => `${String(text).split(/(?<=\.) /).at(-1)}`;

export const ONE_PLACE = Object.freeze({
  h2: 'Your whole CUET prep, in one place.',
  mark: 'one place.',
  sub: 'Watch each screen work, then try it yourself.',
  rowsLabel: 'Tools inside MockMob',
  rows: Object.freeze([
    // "Unlimited" is said only where the hero strip says it (on Pro); this line says what the screen is.
    Object.freeze({ id: 'practise', icon: 'papers', name: 'Practise', line: 'The exam screen, in MockMob or NTA style.' }),
    // `path`: where the tool really lives in the app, shown in its window's address bar (Key cards at /cards; Bring a mistake
    // is a way into Ask Mobi, at /mentor: bringMistakeCopy.mjs BRING_MISTAKE_PATH).
    Object.freeze({ id: 'cards', icon: 'keycards', name: 'Key cards', line: 'Turn a card, rate it, it comes back on time.', path: '/cards' }),
    Object.freeze({ id: 'mobi', icon: 'mobi', name: 'Ask Mobi', line: 'Bring any question you got wrong.', path: '/mentor' }),
  ]),
  // Rows 4 to 6 (owner LK364, 21 Nov 2026: "some features are not depicted, like mob ... add those back, somewhat
  // incorporating that older theme"): the tools the old tour deck showed, each with its deck screen (TourScreens.jsx) on the
  // deck's card. Their name and line are the tour's own (homeCopy.mjs buildTour: label, line); a row is drawn only while its
  // tool is live, so OnePlace takes them from the tour the server built with the live switches (tourRows below).
  tourIds: Object.freeze(['learn', 'rival', 'mob']),
  // The exam section's own first sentence (homeCopy.mjs EXAM_HEAD.sub).
  practiseProof: firstSentence(EXAM_HEAD.sub),
  // The Key cards section's way to the public decks (KeyCardsDemo.jsx: /key-cards, "See a chapter's cards").
  decksHref: '/key-cards',
  decksLink: KEY_CARDS_WORDS.seeChapter,
});

const n = (value) => Number(value).toLocaleString('en-IN');
/** The Key cards bank line, in the live section's words: "<cards> Key cards across <subjects> subjects." (null without a bank). */
export function bankLine(bank) {
  if (!bank || !(bank.cards > 0) || !(bank.subjects > 0)) return null;
  return `${n(bank.cards)}${BANK_WORDS.across}${n(bank.subjects)}${BANK_WORDS.subjects}`;
}

/** Bring a mistake's credit line, as the live block prints it (photos promised only while Mobi reads them). */
export const mobiPrice = ({ photo, credits, photoCredits, free }) => bringMistakeWords({ photo, credits, photoCredits, free }).price;

// Sign-ups (owner LK362, 20 Nov 2026: "You can write 1,500+"). True as a floor: 1,493 students signed up last season and 61
// more since June 2026 (a production read recorded in the ledger at LK188), 1,554 in all. A floor, never a live count; raise
// it only from a new production read. Then the live line's own last sentence ("Tap a reel to watch it here.").
export const SIGNUPS_FLOOR = '1,500+';
export const CREATORS_SUB = `${SIGNUPS_FLOOR} students have signed up, and CUET creators show MockMob to their followers. ${lastSentence(INSTAGRAM_HEAD.sub)}`;

// The free plan's items read inside a sentence: lower case, and the credit-paid mocks said in plain words (the plan card's
// "Quick practice and Full mock on credits" read like a slip mid-sentence).
const inSentence = (item) => {
  const lower = item.charAt(0).toLowerCase() + item.slice(1);
  return /^quick practice and full mock on credits$/i.test(item) ? 'quick practice and full mocks, paid with credits' : lower;
};
/** The FAQ's "What do I get free?", answered from the code's constants: the wallet's free credits and the free plan. */
export function freeFaq({ freeCredits, dailySize }) {
  const items = freePlan({ newOffer: false, firstFullMockItem: null }).map(inSentence);
  const list = `${items.slice(0, -1).join('; ')} and ${items.at(-1)}`;
  return Object.freeze({
    question: 'What do I get free?',
    answer: `${freeCredits} credits a month, with no card needed. Free covers ${list}. The Daily Five, ${dailySize} questions a day, is free with no sign-up.`,
  });
}

/**
 * The tour's tools as the frame's rows 4 to 6, from the tour the server built (buildTour: only live tools are in it), in the
 * tour's order: { id, icon, name, line, title, lede, href, cta }. The icon is the tour's own desk object (TOUR_ICON).
 */
export function tourRows(tour = []) {
  return tour.filter((slide) => ONE_PLACE.tourIds.includes(slide.id)).map((slide) => Object.freeze({
    id: slide.id, icon: TOUR_ICON[slide.id], name: slide.tab || slide.label, line: `${slide.line}.`, title: slide.title, lede: slide.lede, chip: slide.chip, href: slide.href, cta: slide.cta, tour: true,
  }));
}
