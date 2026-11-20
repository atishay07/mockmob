// The words of /home-next's one frame (OnePlace.jsx; owner LK363, 20 Nov 2026). Sentence case, no em dash, no "!", no
// figure the code does not hold. The rows' tools are the landing's own real screens; their lines say what each one does.
// The "Also inside" line names only tools that are live, from the same switches the feature tour reads (homeCopy.mjs
// buildTour): Learn while study content is on, Benchmarks always, the Mob while it is live.
// Two lines came over from the first /home-next (20 Nov 2026, Revision 2 of its spec; the owner asked for its good parts on
// 21 Nov): the creators' sub with the sign-up floor, and the FAQ's "What do I get free?" answered from the code's constants.
import { freePlan } from './homeCopy.mjs';

export const ONE_PLACE = Object.freeze({
  h2: 'Your whole CUET prep, in one place.',
  mark: 'one place.',
  sub: 'Watch each screen work, then try it yourself.',
  rowsLabel: 'Tools inside MockMob',
  rows: Object.freeze([
    Object.freeze({ id: 'practise', icon: 'papers', name: 'Practise', line: 'Unlimited mocks on the real exam screen.' }),
    // `path`: where the tool really lives in the app, shown in its window's address bar (Key cards at /cards; Bring a mistake
    // is a way into Ask Mobi, at /mentor: bringMistakeCopy.mjs BRING_MISTAKE_PATH).
    Object.freeze({ id: 'cards', icon: 'keycards', name: 'Key cards', line: 'Turn a card, rate it, it comes back on time.', path: '/cards' }),
    Object.freeze({ id: 'mobi', icon: 'mobi', name: 'Ask Mobi', line: 'Bring any question you got wrong.', path: '/mentor' }),
  ]),
  alsoHref: '/features',
});

/** "Also inside: Learn, Benchmarks and the Mob." from the live switches; null when nothing else is live. */
export function alsoInside({ studyLive = false, mobLive = false } = {}) {
  const names = [...(studyLive ? ['Learn'] : []), 'Benchmarks', ...(mobLive ? ['the Mob'] : [])];
  if (!names.length) return null;
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return { lead: 'Also inside:', list, text: `Also inside: ${list}.` };
}

// Sign-ups (owner LK362, 20 Nov 2026: "You can write 1,500+"). True as a floor: 1,493 students signed up last season and 61
// more since June 2026 (a production read recorded in the ledger at LK188), 1,554 in all. A floor, never a live count; raise
// it only from a new production read.
export const SIGNUPS_FLOOR = '1,500+';
export const CREATORS_SUB = `${SIGNUPS_FLOOR} students have signed up, and CUET creators show MockMob to their followers.`;

const lc = (text) => text.charAt(0).toLowerCase() + text.slice(1);
/** The FAQ's "What do I get free?", answered from the code's constants: the wallet's free credits and the free plan. */
export function freeFaq({ freeCredits, dailySize }) {
  const items = freePlan({ newOffer: false, firstFullMockItem: null }).map(lc);
  const list = `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
  return Object.freeze({
    question: 'What do I get free?',
    answer: `${freeCredits} credits a month, with no card needed. Free covers ${list}. The Daily Five, ${dailySize} questions a day, is free with no sign-up.`,
  });
}
