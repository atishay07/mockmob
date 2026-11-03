// Versioned CUET subject registry. One place maps stored/internal subject IDs to the
// official NTA subject code, and says whether MockMob can launch practice for it.
//
// Source: NTA "CUET(UG)-2026 Syllabus" subject list, https://cuet.nta.nic.in/cuetug-2026-syllabus/
// (page footer "Last Updated: Sep 02, 2026"), checked 2 October 2026. This is the 2026
// baseline. The 2027 specification has not been published/verified, so 2027 use is
// provisional. Keep old IDs in the crosswalk; never silently relabel stored attempts.
import { CUET_PUBLIC_ALLOWED_SUBJECT_SET, toPublicSubjectId } from './cuet_controls.js';
import { LAUNCH_SUBJECT_IDS } from './capabilities.js';

export const SUBJECT_REGISTRY_VERSION = 'nta-cuet-ug-2026@2026-09-02';
export const SUBJECT_REGISTRY_SOURCE = Object.freeze({
  publisher: 'National Testing Agency',
  title: 'CUET(UG)-2026 Syllabus subject list',
  url: 'https://cuet.nta.nic.in/cuetug-2026-syllabus/',
  lastUpdated: '2026-09-02',
  checkedAt: '2026-10-02',
  appliesTo: 'CUET UG 2026; provisional for 2027 until a 2027 publication is verified',
});

// Official code and NTA label, keyed by MockMob's public subject ID.
const OFFICIAL = Object.freeze({
  english: ['101', 'English'], hindi: ['102', 'Hindi'], assamese: ['103', 'Assamese'],
  bengali: ['104', 'Bengali'], gujarati: ['105', 'Gujarati'], kannada: ['106', 'Kannada'],
  malayalam: ['107', 'Malayalam'], marathi: ['108', 'Marathi'], odia: ['109', 'Odia'],
  punjabi: ['110', 'Punjabi'], tamil: ['111', 'Tamil'], telugu: ['112', 'Telugu'], urdu: ['113', 'Urdu'],
  accountancy: ['301', 'Accountancy / Book-Keeping'], agriculture: ['302', 'Agriculture'],
  anthropology: ['303', 'Anthropology'],
  biology: ['304', 'Biology / Biological Science / Biotechnology / Biochemistry'],
  business_studies: ['305', 'Business Studies'], chemistry: ['306', 'Chemistry'],
  environmental_studies: ['307', 'Environmental Science'],
  computer_science: ['308', 'Computer Science / Informatics Practices'],
  economics: ['309', 'Economics / Business Economics'],
  fine_arts: ['312', 'Fine Arts / Visual Arts / Commercial Arts'],
  geography: ['313', 'Geography / Geology'], history: ['314', 'History'], home_science: ['315', 'Home Science'],
  knowledge_tradition_india: ['316', 'Knowledge Tradition – Practices in India'],
  mass_media: ['318', 'Mass Media / Mass Communication'],
  mathematics: ['319', 'Mathematics / Applied Mathematics'],
  performing_arts: ['320', 'Performing Arts (Dance, Drama and Music)'],
  physical_education: ['321', 'Physical Education (Yoga, Sports)'], physics: ['322', 'Physics'],
  political_science: ['323', 'Political Science'], psychology: ['324', 'Psychology'],
  sanskrit: ['325', 'Sanskrit'], sociology: ['326', 'Sociology'],
  general_test: ['501', 'General Aptitude Test'],
});

// Older stored IDs that are not separate rows in the 2026 list.
export const SUBJECT_CROSSWALK = Object.freeze({
  gat: { to: 'general_test', note: 'Internal ID for the General Aptitude Test (501).' },
  applied_mathematics: { to: 'mathematics', note: 'Applied Mathematics is examined under 319 in 2026.' },
  engineering_graphics: { to: null, note: 'Not listed in the CUET UG 2026 subject list.' },
  entrepreneurship: { to: null, note: 'Not listed in the CUET UG 2026 subject list.' },
  legal_studies: { to: null, note: 'Not listed in the CUET UG 2026 subject list.' },
  teaching_aptitude: { to: null, note: 'Not listed in the CUET UG 2026 subject list.' },
});

function canonicalId(raw) {
  const id = String(raw || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!id) return { id: '', crosswalk: null };
  const crosswalk = SUBJECT_CROSSWALK[id] || null;
  if (crosswalk) return { id: crosswalk.to, from: id, crosswalk };
  return { id: toPublicSubjectId(id), crosswalk: null };
}

/**
 * Resolve any stored subject ID.
 * practice: 'supported' (can launch), 'not_offered' (official subject, no MockMob practice),
 *           'retired' (not in the current official list), 'unknown'.
 */
export function resolveSubject(raw) {
  const { id, from, crosswalk } = canonicalId(raw);
  const stored = String(raw || '');
  if (crosswalk && !id) {
    return { storedId: stored, id: null, code: null, officialName: null, practice: 'retired', launch: false,
      reason: `${crosswalk.note} Edit your subjects to choose a current CUET subject.` };
  }
  const official = OFFICIAL[id];
  if (!official) {
    return { storedId: stored, id: id || null, code: null, officialName: null, practice: 'unknown', launch: false,
      reason: 'This subject is not recognised. Edit your subjects to choose a current CUET subject.' };
  }
  const [code, officialName] = official;
  const supported = CUET_PUBLIC_ALLOWED_SUBJECT_SET.has(id);
  return {
    storedId: stored, id, code, officialName,
    renamedFrom: from || null,
    practice: supported ? 'supported' : 'not_offered',
    launch: supported,
    launchSubject: LAUNCH_SUBJECT_IDS.includes(id),
    reason: supported
      ? null
      : `CUET subject ${code}, but MockMob does not offer practice for it yet. Your saved choice is kept; pick a supported subject to practise.`,
  };
}

export function partitionStoredSubjects(stored = []) {
  const seen = new Set();
  const supported = [];
  const unavailable = [];
  for (const raw of Array.isArray(stored) ? stored : []) {
    const entry = resolveSubject(raw);
    const key = entry.id || entry.storedId;
    if (seen.has(key)) continue;
    seen.add(key);
    (entry.launch ? supported : unavailable).push(entry);
  }
  return { supported, unavailable };
}

export function officialSubjectCode(raw) {
  return resolveSubject(raw).code;
}
