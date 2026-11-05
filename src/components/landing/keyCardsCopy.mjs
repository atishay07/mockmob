// Key cards on the home page (R3-D10, owner LK112, 5 Nov 2026): the section's words. Pure: no React, no browser, no file
// reads, so the client card (KeyCardsDemo.jsx), the server reader (keyCardsPicks.mjs) and node --test share one copy.
// Rules (homeCopy.mjs budgets): the sub at most 20 words, sentence case, no middle dots, no exclamation marks, no arrows,
// no hype. Every number on screen comes from the decks or the scheduler (keyCardsPicks.mjs), never typed in here.
// The section stamp is the product's name in the brand word colour (R3-D2: stamps above h2s, product names only).
import { WORDS } from '../../../data/learn/words.js';

export const KEY_CARDS_HEAD = Object.freeze({
  stamp: 'Key cards',
  h2: 'Turn it. Rate it. It comes back on time.',
  sub: 'Say the answer in your head, turn the card, then rate it. Your rating sets when it comes back.',
});

/** The card's own words, the app's (data/learn/words.js WORDS) where the app has one. */
export const KEY_CARDS_WORDS = Object.freeze({
  turnOver: WORDS.turnOver, // 'Turn over'
  turnCue: WORDS.turnCue, // 'Tap the card to turn it over'
  ratingsLabel: 'How well did you know it?',
  again: 'Go through the five again',
  doneTitle: 'That’s the five.',
  doneGuest: 'With an account, each card you rate goes into Revise:',
  doneStudent: 'In Key cards, each card you rate goes into Revise:',
  keepGoing: 'Sign up free to keep going',
  openCards: 'Open Key cards',
  mustKnow: 'Must-know',
});

/** "Card 2 of 5": what a screen reader hears where the eye reads "2 / 5". */
export const cardOf = (n, of) => `Card ${n} of ${of}`;

/** "1 card back tomorrow", "3 cards back in 3 days": one row of the end card. */
export const backRow = (count, when) => `${count} ${count === 1 ? 'card' : 'cards'} ${when}`;

/**
 * The bank line under the demo: "<cards> Key cards across <subjects> subjects." and what Free opens. The numbers are
 * React nodes (the count-up) or plain numbers; the words around them live here.
 */
export const BANK_WORDS = Object.freeze({
  across: ' Key cards across ',
  subjects: ' subjects.',
  free: (taste) => `Free gives you ${taste} Must-know cards in every chapter, Pro every card.`,
});
