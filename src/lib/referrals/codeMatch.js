// Exact, case-insensitive creator-code matching (security hotfix, 17 Oct 2026).
//
// Codes were looked up with PostgREST `ilike`, and CODE_PATTERN allows '_', which ILIKE reads as
// "any one character": the code '_____' matched any 5-character creator, so anyone could take
// a creator's discount and attribution without knowing the code. PostgREST also reads '*' as '%'.
// A code is now valid only from [a-z0-9._-], must contain at least one letter or digit, and
// the ILIKE pattern escapes every LIKE metacharacter so it can only match the code itself.
// (creators has a unique index on lower(btrim(code)), so an exact match finds at most one row.)

export const CODE_PATTERN = /^[a-z0-9._-]{1,64}$/;
const HAS_ALNUM = /[a-z0-9]/;

/** Lower-cased, trimmed, whitespace-free code, or null when it is not a valid creator code. */
export function cleanCreatorCode(raw) {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toLowerCase().replace(/\s+/g, '');
  if (!code || !CODE_PATTERN.test(code) || !HAS_ALNUM.test(code)) return null;
  return code;
}

export function isValidCreatorCode(raw) {
  return typeof raw === 'string' && cleanCreatorCode(raw) === raw;
}

/** Escape LIKE/ILIKE metacharacters (backslash first) and PostgREST's '*' alias for '%'. */
export function escapeLikePattern(value) {
  return String(value).replace(/[\\%_*]/g, (ch) => `\\${ch}`);
}

/** The ILIKE pattern that matches exactly this code, case-insensitively, or null if invalid. */
export function exactCodePattern(raw) {
  const code = cleanCreatorCode(raw);
  return code ? escapeLikePattern(code) : null;
}
