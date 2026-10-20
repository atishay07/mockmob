// The student's name as a screen may show it or say it (release 11 walk: a new student was greeted "walk-r11-web-1019a, what are
// we practising?"). The app's rule, in one place for the website (flutter_app lib/core/auth/display_name.dart, shownName and
// shownFirstName): a fresh account's name is the email's own local part until the student gives one, and a 17-year-old reads it
// as "That's not my name. Did it break?". Such a name, or a handle with a digit, "_" or "@" ("asha_v", "asha07"), is never
// shown or used to greet: the screen greets without a name. Real names with a hyphen or full stop ("Anne-Marie", "R. K. Sharma")
// are kept; a handle without those marks is caught by matching the email's own local part. PURE.
//
// The match is on the local part exactly or in lower case (the app's I11 rule, 20 Oct): the server never stores a capital the email
// did not have, so "Asha" for asha@... is a name the student typed and shows, while "asha" is the prefix and does not.

/** The account's name as it may be shown, or null: never empty, never a handle, never the email's local part. */
export function shownName(name, email = '') {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return null;
  if (/[0-9_@]/.test(trimmed)) return null;
  const local = String(email ?? '').trim().split('@')[0];
  if (local && (trimmed === local || trimmed === local.toLowerCase())) return null;
  return trimmed;
}

/** The first word of shownName, for a greeting ("Hi, Asha."), or null. */
export function shownFirstName(name, email = '') {
  return shownName(name, email)?.split(/\s+/)[0] || null;
}
