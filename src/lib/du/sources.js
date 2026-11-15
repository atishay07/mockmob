// Official University of Delhi documents the calculator is built from. These must match
// public/du/2026/index.json meta.sources (checked in data/tests/du_eligibility.test.mjs).
//
// `title` and `use` are the words the pages show. The rest records what each document is and
// when we checked our numbers against it (owner ask M-007). None of the four PDFs prints a date
// on its pages, so `documentDate` is null; `releasedOn` is the date in DU's own file name, which
// the PDF's creation date agrees with. The check itself is data/du-csas-2026/verification/
// (verify.py re-runs it from the PDFs, REPORT.md has the method and counts).

export const DU_CHECKED_ON = '2026-11-15';

export const DU_SOURCES = [
  {
    id: 'boi',
    title: 'UG Bulletin of Information 2026-27',
    use: 'Programme-specific eligibility',
    url: 'https://www.du.ac.in/uploads/2026/06012026_BOI_UG_2026_27_compressed.pdf',
    printedTitle: 'Bulletin of Information for admission to undergraduate programmes, academic session 2026-27',
    issuer: 'University of Delhi',
    round: null,
    documentDate: null,
    releasedOn: '2026-01-06',
    pages: 71,
    checkedOn: DU_CHECKED_ON,
    checked:
      'Same file the data was built from (SHA-256), all 71 pages; every programme in the three cutoff lists maps to a Bulletin programme. The eligibility rules were not re-read in this check.',
  },
  {
    id: 'round-1',
    title: 'First round of allocation: minimum allocation scores',
    use: 'Round 1 cutoffs',
    url: 'https://admission.uod.ac.in/userfiles/17072026-CutOff_UG_Round_One_compressed.pdf',
    printedTitle: 'Undergraduate admissions 2026-27: first round of allocation and admissions, minimum allocation score',
    issuer: 'University of Delhi, Admission Branch',
    round: 1,
    documentDate: null,
    releasedOn: '2026-07-17',
    pages: 58,
    checkedOn: DU_CHECKED_ON,
    checked:
      'Every row (S.NO 1 to 1,393), college and programme name and all 8,209 printed scores, read with two PDF engines, match the served data exactly.',
  },
  {
    id: 'round-2',
    title: 'Second round of allocation: minimum allocation scores',
    use: 'Round 2 cutoffs',
    url: 'https://admission.uod.ac.in/userfiles/downloads/2026/25072026_CutOff_UG_Round_Two_compressed.pdf',
    printedTitle: 'Undergraduate admissions 2026-27: second round of allocation and admissions, minimum allocation score',
    issuer: 'University of Delhi, Admission Branch',
    round: 2,
    documentDate: null,
    releasedOn: '2026-07-25',
    pages: 48,
    checkedOn: DU_CHECKED_ON,
    checked:
      'Every row (S.NO 1 to 1,393), college and programme name and all 6,953 printed scores, read with two PDF engines, match the served data exactly.',
  },
  {
    id: 'round-3',
    title: 'Third round of allocation: minimum allocation scores',
    use: 'Round 3 cutoffs',
    url: 'https://admission.uod.ac.in/userfiles/downloads/2026/09082026_Minimum_Allocation_Score_RoundThree.pdf',
    printedTitle: 'Undergraduate admissions 2026-27: third round of allocation and admissions, minimum allocation score',
    issuer: 'University of Delhi, Admission Branch',
    round: 3,
    documentDate: null,
    releasedOn: '2026-08-09',
    pages: 38,
    checkedOn: DU_CHECKED_ON,
    checked:
      'Every row (S.NO 1 to 956), college and programme name and all 2,154 printed scores, read with two PDF engines, match the served data exactly.',
  },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-11-15' -> '15 Nov 2026'. */
export function formatDuDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

function roundNumber(round) {
  if (typeof round === 'number') return round;
  const m = /^round-(\d)$/.exec(String(round || ''));
  return m ? Number(m[1]) : null;
}

/**
 * The one line a cutoff view prints under its numbers.
 *   duSourceLine(1)         -> 'Source: Delhi University CSAS (UG) 2026, round 1. Checked 15 Nov 2026.'
 *   duSourceLine('round-2') -> same, round 2
 *   duSourceLine()          -> 'Source: Delhi University CSAS (UG) 2026, rounds 1 to 3. Checked 15 Nov 2026.'
 * Takes the checked date from the round's own source, so a later re-check of one round shows its own date.
 */
export function duSourceLine(round) {
  const n = roundNumber(round);
  const rounds = DU_SOURCES.filter((s) => s.round !== null);
  if (n !== null) {
    const s = rounds.find((r) => r.round === n);
    if (!s) return '';
    return `Source: Delhi University CSAS (UG) 2026, round ${n}. Checked ${formatDuDate(s.checkedOn)}.`;
  }
  const oldest = rounds.map((s) => s.checkedOn).sort()[0];
  const first = rounds[0].round;
  const last = rounds[rounds.length - 1].round;
  return `Source: Delhi University CSAS (UG) 2026, rounds ${first} to ${last}. Checked ${formatDuDate(oldest)}.`;
}
