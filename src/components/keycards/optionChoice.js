// The decisions of Key cards' "Your part" picker, pure so a test can walk them (data/tests/keycards_option_choice.test.mjs).
//
// A tap runs three steps: save the choice (PUT), read the home again (GET), land the new chapter list. The tapped option
// stays the selected one the whole way, so the picker never shows the old part while the new list is still on its way.
//
//   idle         nothing in flight; the saved option (from the page's data) is the one shown
//   saving       the PUT is out; the tapped option is shown
//   refreshing   saved; the read of the new chapter list is out; the tapped option is still shown
//   stale        saved, but the read failed: the page keeps the list it had, the tapped option stays shown, Try again is offered
//   save-failed  the PUT failed: the saved option is shown again, and one line says so
//
// Taps are ignored while saving or refreshing (one PUT in flight, never a second for the option already chosen).

export const INITIAL_CHOICE = Object.freeze({ choice: null, phase: 'idle' });

/** The option the picker shows as selected: the tapped one while it is in flight or stale, else the saved one. */
export const shownOption = (state, saved) => (state.choice !== null ? state.choice : (saved ?? null));

/** True while a save or a re-read is in flight: the picker ignores taps and the chapter list is busy. */
export const isBusy = (state) => state.phase === 'saving' || state.phase === 'refreshing';

/** Whether a tap on `id` should do anything: not while busy, and never for the option already shown. */
export const canChoose = (state, id, saved) => Boolean(id) && !isBusy(state) && id !== shownOption(state, saved);

/** The next state for one event: { type: 'tap', id } | 'saved' | 'save-failed' | 'refreshed' | 'refresh-failed' | 'retry'. */
export function choiceReducer(state, action) {
  switch (action.type) {
    case 'tap': return isBusy(state) ? state : { choice: action.id, phase: 'saving' };
    case 'saved': return state.phase === 'saving' ? { choice: state.choice, phase: 'refreshing' } : state;
    case 'save-failed': return state.phase === 'saving' ? { choice: null, phase: 'save-failed' } : state;
    case 'refreshed': return state.phase === 'refreshing' ? { choice: null, phase: 'idle' } : state;
    case 'refresh-failed': return state.phase === 'refreshing' ? { choice: state.choice, phase: 'stale' } : state;
    case 'retry': return state.phase === 'stale' ? { choice: state.choice, phase: 'refreshing' } : state;
    default: return state;
  }
}

/**
 * The one line under the picker. { kind, text } where kind is 'status' (quiet), 'error' or 'stale' (a Try again key follows).
 * `word` is the lowercase option label ('part'), `all` the "until then" phrase ('both parts').
 */
export function finePrint({ phase, saved, word, all }) {
  if (phase === 'saving') return { kind: 'status', text: 'Saving your choice' };
  if (phase === 'refreshing') return { kind: 'status', text: 'Updating the chapter list' };
  if (phase === 'stale') return { kind: 'stale', text: 'Saved. The chapter list did not refresh.' };
  if (phase === 'save-failed') return { kind: 'error', text: 'Your choice was not saved. Try again.' };
  return saved
    ? { kind: 'plain', text: `Only that ${word}’s chapters show here and in your practice. You can change it at any time.` }
    : { kind: 'plain', text: `Choose your ${word} and only its chapters show here and in your practice. Until then, ${all} show.` };
}

/** Whether a chapter row that mounts now enters with the staggered rise (the list's first draw) or only a fade (a later arrival). */
export const rowEntrance = (listSettled) => (listSettled ? 'fade' : 'rise');
