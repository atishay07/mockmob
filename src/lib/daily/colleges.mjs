// The colleges a student can play the Daily Five for (17 Nov 2026, lane daily; owner LK293): the 67 University of Delhi
// colleges and departments in DU's own CSAS UG 2026-27 lists (public/du/2026), by the same address the cutoff pages give them
// (src/lib/du/cutoffPages.mjs collegeSlug) and the same title (DU's "(W)" mark dropped, collegeTitle). Written out here so a
// phone does not load 68 offerings files to draw a list; colleges.test.mjs builds the list from the files and fails if this
// one parts from it.
//
// Names only, as "aiming for": no crest, no college colour, nothing that reads as DU's or a college's endorsement.
import { duSearch } from '../du/collegeSearch.mjs';

/** [slug, title], A to Z as the cutoff pages sort them. */
const ROWS = [
  ['acharya-narendra-dev-college', 'Acharya Narendra Dev College'],
  ['aditi-mahavidyalaya', 'Aditi Mahavidyalaya'],
  ['aryabhatta-college', 'Aryabhatta College'],
  ['atma-ram-sanatan-dharma-college', 'Atma Ram Sanatan Dharma College'],
  ['bhagini-nivedita-college', 'Bhagini Nivedita College'],
  ['bharati-college', 'Bharati College'],
  ['bhaskaracharya-college-of-applied-sciences', 'Bhaskaracharya College of Applied Sciences'],
  ['cluster-innovation-centre', 'Cluster Innovation Centre'],
  ['college-of-vocational-studies', 'College of Vocational Studies'],
  ['daulat-ram-college', 'Daulat Ram College'],
  ['deen-dayal-upadhyaya-college', 'Deen Dayal Upadhyaya College'],
  ['delhi-college-of-arts-and-commerce', 'Delhi College of Arts and Commerce'],
  ['delhi-school-of-journalism', 'Delhi School of Journalism'],
  ['department-of-germanic-and-romance-studies', 'Department of Germanic and Romance Studies'],
  ['department-of-slavonic-and-finno-ugrian-studies', 'Department of Slavonic and Finno Ugrian Studies'],
  ['deshbandhu-college', 'Deshbandhu College'],
  ['dr-bhim-rao-ambedkar-college', 'Dr. Bhim Rao Ambedkar College'],
  ['dyal-singh-college', 'Dyal Singh College'],
  ['dyal-singh-college-evening', 'Dyal Singh College (Evening)'],
  ['gargi-college', 'Gargi College'],
  ['hansraj-college', 'Hansraj College'],
  ['hindu-college', 'Hindu College'],
  ['indraprastha-college-for-women', 'Indraprastha College for Women'],
  ['institute-of-home-economics', 'Institute of Home Economics'],
  ['janki-devi-memorial-college', 'Janki Devi Memorial College'],
  ['jesus-and-mary-college', 'Jesus & Mary College'],
  ['kalindi-college', 'Kalindi College'],
  ['kamala-nehru-college', 'Kamala Nehru College'],
  ['keshav-mahavidyalaya', 'Keshav Mahavidyalaya'],
  ['kirori-mal-college', 'Kirori Mal College'],
  ['lady-irwin-college', 'Lady Irwin College'],
  ['lady-shri-ram-college-for-women', 'Lady Shri Ram College for Women'],
  ['lakshmibai-college', 'Lakshmibai College'],
  ['maharaja-agrasen-college', 'Maharaja Agrasen College'],
  ['maitreyi-college', 'Maitreyi College'],
  ['mata-sundri-college-for-women', 'Mata Sundri College for Women'],
  ['miranda-house', 'Miranda House'],
  ['motilal-nehru-college', 'Motilal Nehru College'],
  ['motilal-nehru-college-evening', 'Motilal Nehru College (Evening)'],
  ['pgdav-college', 'P.G.D.A.V. College'],
  ['pgdav-college-evening', 'P.G.D.A.V. College (Evening)'],
  ['rajdhani-college', 'Rajdhani College'],
  ['ram-lal-anand-college', 'Ram Lal Anand College'],
  ['ramanujan-college', 'Ramanujan College'],
  ['ramjas-college', 'Ramjas College'],
  ['satyawati-college', 'Satyawati College'],
  ['satyawati-college-evening', 'Satyawati College (Evening)'],
  ['shaheed-bhagat-singh-college', 'Shaheed Bhagat Singh College'],
  ['shaheed-bhagat-singh-college-evening', 'Shaheed Bhagat Singh College (Evening)'],
  ['shaheed-rajguru-college-of-applied-sciences-for-women', 'Shaheed Rajguru College of Applied Sciences for Women'],
  ['shaheed-sukhdev-college-business-studies', 'Shaheed Sukhdev College Business Studies'],
  ['shivaji-college', 'Shivaji College'],
  ['shri-ram-college-of-commerce', 'Shri Ram College of Commerce'],
  ['shyam-lal-college', 'Shyam Lal College'],
  ['shyam-lal-college-evening', 'Shyam Lal College (Evening)'],
  ['shyama-prasad-mukherji-college-for-women', 'Shyama Prasad Mukherji College For Women'],
  ['sri-aurobindo-college-day', 'Sri Aurobindo College (Day)'],
  ['sri-aurobindo-college-evening', 'Sri Aurobindo College (Evening)'],
  ['sri-guru-gobind-singh-college-of-commerce', 'Sri Guru Gobind Singh College of Commerce'],
  ['sri-guru-nanak-dev-khalsa-college', 'Sri Guru Nanak Dev Khalsa College'],
  ['sri-guru-tegh-bahadur-khalsa-college', 'Sri Guru Tegh Bahadur Khalsa College'],
  ['sri-venketeswara-college', 'Sri Venketeswara College'],
  ['st-stephens-college', "St. Stephen's College"],
  ['swami-shardhanand-college', 'Swami Shardhanand College'],
  ['vivekananda-college', 'Vivekananda College'],
  ['zakir-husain-delhi-college', 'Zakir Husain Delhi College'],
  ['zakir-husain-delhi-college-evening', 'Zakir Husain Delhi College (Evening)'],
];

/** The 67: [{ id, name }]. `id` is the cutoff pages' address for the college, `name` its title. */
export const TEAM_COLLEGES = Object.freeze(ROWS.map(([id, name]) => Object.freeze({ id, name })));
const BY_ID = new Map(TEAM_COLLEGES.map((c) => [c.id, c]));
const ID = /^[a-z0-9][a-z0-9-]{1,79}$/;

/** True for one of the 67 addresses. */
export const isTeamCollege = (id) => typeof id === 'string' && ID.test(id) && BY_ID.has(id);
/** { id, name } of a college, or null. */
export const teamCollege = (id) => (isTeamCollege(id) ? BY_ID.get(id) : null);
/** A college's name, or '' for anything that is not one. */
export const teamName = (id) => teamCollege(id)?.name || '';

/**
 * The short list under the search box when the student has no colleges of their own yet: the Delhi University colleges of
 * the home page's college strip (src/components/landing/CollegeStrip.jsx COLLEGES), in the owner's order ("show the top
 * colleges ... first", 7 Nov 2026). Names only here: the strip's emblems stay on the strip.
 */
export const SHORT_LIST = Object.freeze([
  'shri-ram-college-of-commerce',
  'st-stephens-college',
  'hindu-college',
  'lady-shri-ram-college-for-women',
  'miranda-house',
  'hansraj-college',
  'kirori-mal-college',
  'ramjas-college',
]);

/** A college as My colleges stores it (DU's name, "(W)" and all) to its id here, or null. */
export function teamIdOfName(name) {
  const title = String(name ?? '').replace(/\s*\(W\)\s*/g, ' ').replace(/\s+/g, ' ').trim().replace(/’/g, "'");
  if (!title) return null;
  const hit = TEAM_COLLEGES.find((c) => c.name.toLowerCase() === title.toLowerCase());
  return hit ? hit.id : null;
}

/**
 * The list the pick step shows for a query: every match, best first (the cutoff tools' own matcher, so "srcc", "kmc" and a
 * slip like "hansrj" find their college). An empty query gives `first` (the student's own colleges, then the short list),
 * without repeats.
 */
export function searchTeams(query, first = []) {
  if (!String(query ?? '').trim()) {
    const ids = [...new Set([...(Array.isArray(first) ? first : []), ...SHORT_LIST])].filter(isTeamCollege);
    return ids.map((id) => BY_ID.get(id));
  }
  return duSearch(query, TEAM_COLLEGES, (c) => c.name);
}
