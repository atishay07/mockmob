// The Help door (N17, 17 Oct night): one place, labelled Help, that a student finds when they are stuck. It sits at the
// foot of the desktop sidebar and under More on a phone, and opens three ways to get help, in the order a stuck student
// needs them: see the arena once, read the common answers, reach a person. Ask Mobi is not here any more (ASK-MOBI-1018,
// D6, D12): it is the ordinary "Ask Mobi" row in Planning and opens from the work itself. Pure, so a test can hold every
// word (sentence case, no "!", no arrows, no build talk).
import { SUPPORT_ROW } from './helpFaq.mjs';

export const HELP_DOOR = Object.freeze({
  label: 'Help',
  hint: 'A tour, answers and a person',
  title: 'How can we help?',
});

export const HELP_DOOR_ROWS = Object.freeze([
  Object.freeze({ id: 'tour', label: 'Show me around', note: 'Five stops, about a minute', action: 'tour' }),
  Object.freeze({ id: 'faq', label: 'Common questions', note: 'Credits, NTA mode, signing in', href: '/help' }),
  Object.freeze({ id: 'write', label: SUPPORT_ROW.label, note: SUPPORT_ROW.note, href: SUPPORT_ROW.href }),
]);
