// The Guide (N17, 17 Oct night; renamed from Help on 18 Oct, D11: "Help is not the correct word"): one place, labelled
// Guide, that a student finds when they are stuck. It is a row in the sidebar's Account group and in the phone's More sheet,
// and its page, "Guide and questions", opens three ways to get help, in the order a stuck student
// needs them: see the arena once, read the common answers, reach a person. Ask Mobi is not here any more (ASK-MOBI-1018,
// D6, D12): it is the ordinary "Ask Mobi" row in Planning and opens from the work itself. Pure, so a test can hold every
// word (sentence case, no "!", no arrows, no build talk).
import { SUPPORT_ROW } from './helpFaq.mjs';
import { tourSteps } from './appTour.mjs';

/** The first row everywhere the Guide appears (the More sheet, the sidebar's Account group, the Guide page): the 8-stop tour. */
export const TOUR_LABEL = 'Show me around';
/** The page's own title. The route stays /help. */
export const GUIDE_PAGE_TITLE = 'Guide and questions';

export const HELP_DOOR = Object.freeze({
  label: 'Guide',
  hint: 'Tour, answers, contact',
  title: 'How can we help?',
});

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

/** The tour row's note, from the number of stops the tour will run (src/lib/appTour.mjs), never a typed number (W-093). */
export function tourNote(count) {
  const n = Number.isInteger(count) && count > 0 ? count : 0;
  if (!n) return 'A short walk, about a minute';
  return `${NUMBER_WORDS[n] || n} ${n === 1 ? 'stop' : 'stops'}, about a minute`;
}

export const HELP_DOOR_ROWS = Object.freeze([
  Object.freeze({ id: 'tour', label: TOUR_LABEL, note: tourNote(tourSteps().length), action: 'tour' }),
  Object.freeze({ id: 'faq', label: 'Common questions', note: 'Credits, NTA mode, signing in', href: '/help' }),
  Object.freeze({ id: 'write', label: SUPPORT_ROW.label, note: SUPPORT_ROW.note, href: SUPPORT_ROW.href }),
]);
