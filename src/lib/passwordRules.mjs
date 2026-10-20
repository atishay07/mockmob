// Set a password (Account > Password): the rules and the words, shared by the page and the server route so they can never
// disagree. Plain module: no React, no browser, no server-only imports, so node tests load it directly.
//
// The rule matches the app (flutter_app access_gateway.dart minPasswordLength = 8, and Supabase's own minimum set to 8 in
// the dashboard). The upper bound is Supabase's: it refuses a password over 72 bytes. Nothing here ever logs or echoes a
// password; a problem is a code, and the words for it live in PASSWORD_PROBLEMS.
//
// Copy rules: sentence case, no "!", no em dash, no middle dots.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_RULE = 'At least 8 characters.';

const utf8Length = (text) => new TextEncoder().encode(text).length;

/** { ok: true } or { ok: false, code }. Spaces are allowed; an all-spaces password is not a password. */
export function checkPassword(value) {
  if (typeof value !== 'string') return { ok: false, code: 'invalid' };
  if ([...value].length < PASSWORD_MIN) return { ok: false, code: 'too_short' };
  if (utf8Length(value) > PASSWORD_MAX_BYTES) return { ok: false, code: 'too_long' };
  if (value.trim() === '') return { ok: false, code: 'too_short' };
  return { ok: true };
}

export const PASSWORD_PROBLEMS = Object.freeze({
  too_short: 'Choose a longer password, at least 8 characters, that is not easy to guess.',
  weak_password: 'Choose a longer password, at least 8 characters, that is not easy to guess.',
  too_long: 'That password is too long. Use 72 characters or fewer.',
  invalid: 'Type the password you want to use, at least 8 characters.',
  same_password: 'That is already your password. Choose a different one.',
  reauth_required: 'For safety, sign out, sign in with an email code again, then set your password.',
  signed_out: 'Your session here has ended. Sign in again, then set your password.',
  rate_limited: 'Too many tries. Wait a few minutes, then try again.',
  unavailable: 'MockMob is busy right now. Nothing was changed. Try again in a minute.',
  offline: 'We could not reach MockMob, so we cannot tell if it saved. Check your connection, then save again.',
  unknown: 'Something went wrong on our side. Nothing was changed. Try again.',
});

/** The line a student reads for a problem code; an unknown code reads as the generic one. */
export function passwordProblem(code) {
  return PASSWORD_PROBLEMS[code] || PASSWORD_PROBLEMS.unknown;
}

export const PASSWORD_COPY = Object.freeze({
  title: 'Password',
  lead: 'Add a password to sign in on the MockMob app with your email and this password, with no code to wait for. The website still uses an email code or Google.',
  label: 'New password',
  show: 'Show',
  hide: 'Hide',
  save: 'Save password',
  saving: 'Saving',
  idle: 'It is stored scrambled, so we never see it.',
  saved: 'Password saved.',
  savedFor: (email) => (email
    ? `Password saved. In the app, sign in with ${email} and this password.`
    : 'Password saved. In the app, sign in with your email and this password.'),
  othersLead: 'Signed in on a shared phone?',
  othersLink: 'Sign out of other devices',
});
