/// How many subjects a CUET UG candidate may take: ONE number for every picker, check and line of copy
/// (owner, 17 Oct night, N6). The website keeps the same rule in `src/lib/cuetRules.mjs`.
///
/// The rule, from the NTA information bulletins (read 17 Oct 2026, https://cuet.nta.nic.in/information-bulletin/):
/// the CUET (UG) 2026 bulletin, "Choice of subject", lets a candidate choose up to a maximum of five
/// subjects including languages and the General Aptitude Test; the 2025 bulletin says the same. So the
/// cap is five papers in all, and a language or the General Test uses one of the five.
///
/// CUET UG 2027: NTA has not published its bulletin, and press reports say a lower limit of four is
/// being discussed. Nothing is confirmed, so the app keeps five and says it is the 2026 rule. When the
/// 2027 bulletin is out, change [kCuetMaxSubjects] here and nothing else.
library;

/// The most subjects a student can pick, languages and the General Test included.
const int kCuetMaxSubjects = 5;

/// The cap in words ("five"), for copy.
const String kCuetMaxWord = 'five';

/// The plain rule, for the line under a picker: a language or the General Test uses one of the five.
const String kCuetRuleNote = 'That is the CUET limit, $kCuetMaxWord papers in all. A language or the General Test uses one of the $kCuetMaxWord.';
