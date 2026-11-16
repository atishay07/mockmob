// The words for a promise kept after sign-up (16 Nov 2026). A sign-up door that names a page (a chapter's Key cards, the Sunday
// Mock, the Pro plans) is kept through onboarding (src/lib/auth-redirect.js firstRunDestination): onboarding's last key names
// that page, and the page says one plain line when the student arrives, once on this device.
// PURE: no imports, so the onboarding page, the destination pages and node --test share one copy.
// Owner's rules: plain, sentence case, no exclamation marks, no emoji, no arrows on keys, no hype. Each line says only what the
// page then does: a Key card goes into Revise when it is rated (CardsView, "Rate a card and it goes into Revise"); the Sunday
// page lists a paper for each of the student's subjects (SundayPage).

/** Onboarding's last key, and the same key while it opens, for each kind of promised page. */
export const FIRST_RUN_KEYS = Object.freeze({
  chapter: Object.freeze({ key: 'Finish and open your Key cards', opening: 'Opening your Key cards…' }),
  cards: Object.freeze({ key: 'Finish and open Key cards', opening: 'Opening Key cards…' }),
  daily: Object.freeze({ key: 'Finish and see your Daily Five', opening: 'Opening the Daily Five…' }),
  sunday: Object.freeze({ key: 'Finish and open the Sunday Mock', opening: 'Opening the Sunday Mock…' }),
  pricing: Object.freeze({ key: 'Finish and see the Pro plans', opening: 'Opening the plans…' }),
  mob: Object.freeze({ key: 'Finish and start your Mob', opening: 'Opening your Mob…' }),
  cutoffs: Object.freeze({ key: 'Finish and open the cutoff calculator', opening: 'Opening the calculator…' }),
  recovery: Object.freeze({ key: 'Finish and find your first gap', opening: 'Opening Score Recovery…' }),
});

/** The last key's words for a promised page, or null when there is none (the key then reads as it always did). */
export function firstRunKey(dest) {
  return (dest && FIRST_RUN_KEYS[dest.kind]) || null;
}

/**
 * The line a page says when a student arrives from its sign-up door. Only the pages that draw one have a line; the Daily Five,
 * the plans, the Mob, the calculator and Score Recovery open on what the student came for already.
 */
export const ARRIVAL_LINES = Object.freeze({
  chapter: 'These are the cards you were turning. Study them, and each card you rate goes into Revise.',
  cards: 'Your Key cards are here, chapter by chapter. Open one, and each card you rate goes into Revise.',
  sunday: 'You’re in for the Sunday Mock. Each subject below has its own paper.',
});

export const arrivalLine = (kind) => ARRIVAL_LINES[kind] || null;
