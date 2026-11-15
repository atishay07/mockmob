// The first step for a student with no finished set (owner's decision U2, 15 Nov 2026): one name and one door on every screen
// that invites it (Today, Your papers, Revise, Progress, Marks trend, Your standing, Colleges, the Ask Mobi page and sheet).
// The key opens Practice with a 10-question quick set chosen; Practice shows the subject and the price ("Free: today's included
// set") before anything starts. PURE: no I/O. Practice's own start key and onboarding's key say the set with its subject
// ("Start 10 questions in Accountancy"), so they read as the same step.

export const FIRST_SET_COUNT = 10;
export const FIRST_SET_LABEL = `Start ${FIRST_SET_COUNT} questions`;
export const FIRST_SET_HREF = `/dashboard?mode=quick&count=${FIRST_SET_COUNT}`;

/** Practice with the first set chosen, and the subject when the screen knows one (an unknown id is left out). */
export function firstSetHref(subject = null) {
  const id = typeof subject === 'string' && /^[a-z_]{2,40}$/.test(subject) ? subject : null;
  return id ? `/dashboard?${new URLSearchParams({ subject: id, mode: 'quick', count: String(FIRST_SET_COUNT) })}` : FIRST_SET_HREF;
}
