// How many subjects a CUET UG candidate may take. One number for every picker, server check and line of copy.
//
// The rule, read from the NTA information bulletins themselves (checked 17 Oct 2026):
//   CUET (UG) 2026 bulletin (cuet.nta.nic.in/information-bulletin, 3 Jan 2026), "Choice of subject":
//   "Candidates may choose upto a maximum of five (05) subjects including languages and General
//   Aptitude Test." The 2025 bulletin says the same. (The 2024 cycle allowed six; that was cut in 2025.)
// So the cap is five papers in all, and a language or the General Test uses one of the five. It is not
// "five domain subjects plus extras".
//
// CUET UG 2027: NTA has not published its bulletin. Education press of 9 Oct 2026 reports that UGC, the
// Ministry of Education and NTA are discussing a cap of four. Nothing is confirmed, so the site keeps
// five, tells students five is the 2026 rule, and the combination planner already lets them test four.
// When the 2027 bulletin is out, change CUET_MAX_SUBJECTS here and nothing else.

export const CUET_MAX_SUBJECTS = 5;
export const CUET_MIN_SUBJECTS = 1;
export const CUET_RULE_CYCLE = 2026;
export const CUET_RULE_SOURCE = 'https://cuet.nta.nic.in/information-bulletin/';

/** "Pick up to 5." */
export const pickUpToLine = (cap = CUET_MAX_SUBJECTS) => `Pick up to ${cap}.`;

/** The plain rule, for the line under a picker: languages and the General Test count. */
export const SUBJECT_RULE_NOTE = 'That is the CUET limit, five papers in all. A language or the General Test uses one of the five.';

/** Cap a list of subject ids at the rule, keeping order. */
export function capSubjects(list, cap = CUET_MAX_SUBJECTS) {
  return Array.isArray(list) ? list.slice(0, cap) : [];
}
