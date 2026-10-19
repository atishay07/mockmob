// The student's name as a screen may show it or say it (release 11 walk: a new student was greeted "walk-r11-web-1019a, what are
// we practising?"). The app's rule, in one place for the website (flutter_app lib/core/auth/display_name.dart, shownName and
// shownFirstName): a fresh account's name is the email's own local part until the student gives one, and a 17-year-old reads it
// as "That's not my name. Did it break?". Such a name, or any handle ("app-e2e-student", "asha_v", "asha.v", "asha07"), is never
// shown or used to greet: the screen greets without a name. PURE.

/** The account's name as it may be shown, or null: never empty, never a handle, never the email's local part. */
export function shownName(name, email = '') {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return null;
  if (/[0-9_.\-@]/.test(trimmed)) return null;
  const local = String(email ?? '').split('@')[0].toLowerCase();
  if (local && trimmed.toLowerCase() === local) return null;
  return trimmed;
}

/** The first word of shownName, for a greeting ("Hi, Asha."), or null. */
export function shownFirstName(name, email = '') {
  return shownName(name, email)?.split(/\s+/)[0] || null;
}
