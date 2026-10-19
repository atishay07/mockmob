// The one-time "What should Mobi call you?" card (the app's TodayNameAsk, flutter_app lib/features/today/widgets/name_ask.dart,
// I11, 20 Oct). An account made by email code has no name the student gave, so no screen greets by one and the email's own
// prefix is never shown (src/lib/displayName.mjs). The card asks once, on Today, while there is no shown name; a saved name or
// "Not now" puts it away on this browser. PURE rules here, the card is src/components/profile/NameAsk.jsx.
import { shownName } from './displayName.mjs';

export const NAME_ASK_KEY = 'mm:name-ask-done:v1';
export const NAME_MAX = 80; // the profile route's limit (src/lib/server/profilePatch.js)

export const NAME_ASK = Object.freeze({
  title: 'What should Mobi call you?',
  note: 'Your first name is enough. It shows on Today and in Account, and you can change it in Account.',
  label: 'Your first name',
  save: 'Save name',
  saving: 'Saving',
  notNow: 'Not now',
  empty: 'Write a name first.',
  tooLong: `Keep it to ${NAME_MAX} characters.`,
  failed: 'We could not save your name. Nothing was changed. Try again.',
  saved: 'Saved. Mobi will use it.',
});

/** Whether the card shows: a signed-in student with no name worth showing, who has not saved or put it away here. */
export function shouldAskName({ user, done = false, status = 'authenticated' } = {}) {
  if (done || status !== 'authenticated' || !user?.id) return false;
  return shownName(user.name, user.email) === null;
}

/** The name to send, or the line that says what is wrong with it. */
export function checkName(raw) {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, error: NAME_ASK.empty };
  if (name.length > NAME_MAX) return { ok: false, error: NAME_ASK.tooLong };
  return { ok: true, name };
}

/** What the Account name field starts with: the name the student gave, never the email's prefix or a handle. */
export function nameFieldValue(user) {
  return shownName(user?.name, user?.email) || '';
}
