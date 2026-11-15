// The public Key card decks' words (/key-cards and /key-cards/<subject>/<chapter>). PURE: no React, no imports, so the page
// (server), the deck (client) and node --test share one copy. Owner's rules: plain, sentence case, no exclamation marks, no
// emoji, no arrows on keys, no hype; every number is passed in from the decks, never typed here; a count always carries its unit.

/** A count as India writes it: 1,127. */
export const fmt = (n) => Number(n).toLocaleString('en-IN');
/** "1 card", "38 cards". */
export const cardsWord = (n) => `${fmt(n)} ${n === 1 ? 'card' : 'cards'}`;
/** "1 chapter", "15 chapters". */
export const chaptersWord = (n) => `${fmt(n)} ${n === 1 ? 'chapter' : 'chapters'}`;

/** A subject on the index: "15 chapters, 75 of their 1,127 cards free". */
export const subjectLine = ({ chapters, open, total }) => `${chaptersWord(chapters.length)}, ${fmt(open)} of their ${cardsWord(total)} free`;

/** "5 of 38 cards free" (a chapter row on the index); "All 3 cards free" when the free cards are the whole chapter. */
export function freeCount(open, total) {
  return open >= total ? `All ${cardsWord(total)} free` : `${fmt(open)} of ${cardsWord(total)} free`;
}

/** The chapter page's line under its title: whose cards these are and what is free here, counted from the deck. */
export function freeLine(open, total, subject) {
  const lead = `CUET ${subject} Key cards: `;
  if (open >= total) return total === 1 ? `${lead}this chapter’s one card is free to read, with no account.` : `${lead}all ${fmt(total)} in this chapter are free to read, with no account.`;
  return `${lead}${fmt(open)} of this chapter’s ${fmt(total)} are free to read, with no account.`;
}

/** "Card 2 of 5": what a screen reader hears where the eye reads "2 of 5". */
export const cardOf = (n, of) => `Card ${n} of ${of}`;

export const DECK_WORDS = Object.freeze({
  // The app's own words for the turn (data/learn/words.js WORDS.turnOver, WORDS.turnCue).
  turnOver: 'Turn over',
  cue: 'Say the answer in your head, then turn the card over.',
  next: 'Next card',
  finish: 'Finish',
  previous: 'Previous',
  again: 'Go through them again',
  keepFree: 'Sign up free to keep these cards',
  openApp: 'Open this chapter in Key cards',
  turned: 'Turned over',
});

/** The end's title: "That’s the five." for five, "That’s all 3 free cards." for fewer, "That’s the free card." for one. */
export function endTitle(n) {
  if (n === 5) return 'That’s the five.';
  if (n === 1) return 'That’s the free card.';
  return `That’s all ${n} free cards.`;
}

/** "33 more cards in this chapter" over the locked kinds' tally; null when nothing is locked. */
export const lockedHead = (n) => (n > 0 ? `${n} more ${n === 1 ? 'card' : 'cards'} in this chapter` : null);

/**
 * What an account does with these cards (the app's rules: Free adds a chapter's taste cards to Revise, data/keycards.js
 * chapterAddSet; a rating sets when a card comes back; Pro opens every card, deckView). A signed-in student is not sold Pro here.
 */
export function endLead({ open, total, signedIn = false }) {
  const these = open === 1 ? 'this card goes' : `these ${open} go`;
  if (signedIn) return `In Key cards, ${these} into Revise, and your rating sets when each comes back.`;
  const pro = total > open ? ` Pro opens all ${cardsWord(total)} in this chapter.` : '';
  // "these 5", never "these five" next to a counted 38: one way of writing numbers on the card.
  return `A free account keeps ${open === 1 ? 'this card' : `these ${open}`} in Revise, and your rating sets when ${open === 1 ? 'it comes' : 'each comes'} back.${pro}`;
}

/** The index's opening facts: "911 free cards from 183 chapters in 14 subjects." */
export function indexFacts({ cards, chapters, subjects }) {
  return `${cardsWord(cards)} free to read, from ${chaptersWord(chapters)} in ${fmt(subjects)} ${subjects === 1 ? 'subject' : 'subjects'}.`;
}
