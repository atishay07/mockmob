// The runner's keys (18 Nov 2026, lane runner): MockMob style only. Pure: the runner (src/app/(app)/test/TestPageClient.jsx)
// passes the key event and what is on screen, and gets back the one thing to do, or null. The runner only dispatches what this
// returns, so every rule a key keeps is here and in runnerKeys.test.mjs.
//
// The rules: a key does nothing with Ctrl, Alt or Meta held, while typing in a field, while any dialog or sheet is open (the
// submit sheet, the leave sheet, an integrity warning, the palette sheet: only Esc, which closes the palette), before the paper
// has started, while it is loading, submitting or held for a connection, and after it has ended. A held key does not repeat.
// No action here submits the paper, ends it, leaves it or confirms a dialog: there is no such action name, and Next on the last
// page is no action at all (the Next key there opens the submit sheet; a key never does). Enter and Space are never taken, so
// they keep their native meaning on the focused control. NTA style gets no action at all: it is the exam hall's twin.
//
// An option key is answered only for an option the question has (an index the server would refuse would poison the paper's
// record), and Shift with an option key crosses it out (as Shift+click does), as Shift with 1 to 5 did before.

export const ACTIONS = Object.freeze(['choose', 'cross', 'next', 'previous', 'mark', 'tool', 'keys', 'close-keys', 'close-palette']);

const LETTERS = Object.freeze(['a', 'b', 'c', 'd']);
const DIGITS = Object.freeze(['1', '2', '3', '4']);

/** The keys panel's rows, in order: the key caps (groups joined by "or") and the words beside them. */
export const KEY_ROWS = Object.freeze([
  Object.freeze({ caps: Object.freeze([Object.freeze(['A', 'B', 'C', 'D']), Object.freeze(['1', '2', '3', '4'])]), words: 'Choose an option' }),
  Object.freeze({ caps: Object.freeze([Object.freeze(['→']), Object.freeze(['N'])]), words: 'Next question' }),
  Object.freeze({ caps: Object.freeze([Object.freeze(['←']), Object.freeze(['P'])]), words: 'Previous question' }),
  Object.freeze({ caps: Object.freeze([Object.freeze(['M'])]), words: 'Mark for review' }),
  Object.freeze({ caps: Object.freeze([Object.freeze(['X'])]), words: 'Cross out options' }),
  Object.freeze({ caps: Object.freeze([Object.freeze(['?'])]), words: 'Show or hide this list' }),
]);
/** What a screen reader says for a key cap that is a glyph. */
export const CAP_NAMES = Object.freeze({ '→': 'Right arrow', '←': 'Left arrow', '?': 'Question mark' });

/** A field the student types in: a key there is the field's own. */
export function isTypingTarget(target) {
  if (!target || typeof target !== 'object') return false;
  if (target.isContentEditable === true) return true;
  const tag = String(target.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

const option = (name, index, count) => (Number.isInteger(index) && index >= 0 && index < count ? Object.freeze({ name, option: index }) : null);
const act = (name) => Object.freeze({ name });

/**
 * The action for one keydown, or null.
 * state: {
 *   style: 'mockmob' | 'nta',
 *   started: the paper's clock is running (it has questions and a deadline),
 *   loading, submitting (sending, or held for a connection), ended (sent, or the time is over),
 *   dialogOpen: a modal over the paper (the submit or leave sheet, NTA's summary or paper view, an integrity warning),
 *   paletteOpen: the phone's palette sheet,
 *   keysOpen: the keys panel, keysUi: this device shows the Keys key (a hover pointer),
 *   crossTool: the cross-out tool is on for the question in focus,
 *   optionCount: how many options the question in focus has,
 *   canMark: this screen has Mark, atFirst / atLast: the page in focus is the paper's first / last,
 * }
 * Returns { name } or, for 'choose' and 'cross', { name, option } (the option's index).
 */
export function keyAction(event, state) {
  if (!event || !state || state.style !== 'mockmob') return null;
  if (event.repeat === true) return null;
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  if (event.defaultPrevented) return null;
  if (isTypingTarget(event.target)) return null;
  if (state.dialogOpen) return null;
  if (!state.started || state.loading || state.submitting || state.ended) return null;
  const key = typeof event.key === 'string' ? event.key : '';
  if (key === 'Escape') {
    if (state.keysOpen) return act('close-keys');
    if (state.paletteOpen) return act('close-palette');
    return null;
  }
  if (state.paletteOpen) return null;
  const count = Number.isInteger(state.optionCount) ? state.optionCount : 0;
  // Shift with 1 to 5 (read from the key's place, as Shift turns 1 into !) crosses that option out.
  if (event.shiftKey && /^Digit[1-5]$/.test(String(event.code || ''))) return option('cross', Number(String(event.code).slice(5)) - 1, count);
  const lower = key.length === 1 ? key.toLowerCase() : key;
  const letter = LETTERS.indexOf(lower);
  if (letter >= 0) return option(event.shiftKey || state.crossTool ? 'cross' : 'choose', letter, count);
  const digit = DIGITS.indexOf(key);
  if (digit >= 0) return option(state.crossTool ? 'cross' : 'choose', digit, count);
  if (key === 'ArrowRight' || lower === 'n') return state.atLast ? null : act('next');
  if (key === 'ArrowLeft' || lower === 'p') return state.atFirst ? null : act('previous');
  if (lower === 'm') return state.canMark ? act('mark') : null;
  if (lower === 'x') return act('tool');
  if (key === '?') return state.keysUi ? act('keys') : null;
  return null;
}
