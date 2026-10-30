// CUET 2026 canonical unit/chapter map.
// The 15 TOP_SUBJECTS are built from data/cuet_syllabus.js (Syllabus v2, 31 Oct 2026): units are the exact CUET 2026
// unit titles, chapters are the stored names questions carry, retired chapters are gone (stored, never served).
// The other subjects keep their hand-written lists (data/CUET 2026 PDFs) unchanged.
import { CHAPTER_ALIASES, chaptersFor, resolveChapter, unitsFor } from './cuet_syllabus.js';

export { CHAPTER_ALIASES, resolveChapter };

export const TOP_SUBJECTS = Object.freeze([
  'english',
  'gat',
  'accountancy',
  'economics',
  'business_studies',
  'mathematics',
  'physics',
  'chemistry',
  'biology',
  'history',
  'political_science',
  'geography',
  'psychology',
  'sociology',
  'computer_science',
]);

export const CANONICAL_SYLLABUS = [
  topSubject('english', 'English'),
  lang('hindi', 'Hindi', ['Apathit Gadyansh', 'Apathit Padyansh'], ['Vyakaran', 'Anuvad'], ['Kavya Khand', 'Gadya Khand', 'Rachnatmak Lekhan']),
  ...['assamese', 'bengali', 'gujarati', 'kannada', 'malayalam', 'marathi', 'odia', 'punjabi', 'tamil', 'telugu', 'urdu'].map((id) =>
    lang(id, title(id), ['Reading Comprehension'], ['Grammar', 'Vocabulary'], ['Literature — Prose', 'Literature — Poetry', 'Composition'])
  ),
  topSubject('accountancy', 'Accountancy'),
  {
    subject_id: 'agriculture',
    subject_name: 'Agriculture',
    units: [
      unit('Agrometeorology, Genetics and Plant Breeding, Biochemistry and Microbiology', ['Agricultural Meteorology', 'Genetics & Plant Breeding', 'Biochemistry & Microbiology', 'Seed Science']),
      unit('Livestock Production', ['Livestock Production']),
      unit('Crop Production', ['Crop Production']),
      unit('Horticulture', ['Horticulture']),
      unit('Existing Agriculture Coverage', ['Agricultural Economics', 'Basic Agricultural Engineering', 'Extension Education']),
    ],
  },
  {
    subject_id: 'anthropology',
    subject_name: 'Anthropology',
    units: [
      unit('Physical/Biological Anthropology', ['Introducing Anthropology', 'Human Evolution', 'Human Genetics']),
      unit('Archaeological Anthropology', ['Archaeological Anthropology', 'Fieldwork Methods']),
      unit('Socio-Cultural Anthropology', ['Human Ecology', 'Demographic Anthropology']),
      unit('Linguistic and Tribal Anthropology', ['Indian Anthropology', 'Tribal India']),
      unit('Social Change and Applied Anthropology', ['Applied Anthropology']),
    ],
  },
  topSubject('biology', 'Biology'),
  topSubject('business_studies', 'Business Studies'),
  topSubject('chemistry', 'Chemistry'),
  topSubject('computer_science', 'Computer Science / Informatics Practices'),
  topSubject('economics', 'Economics / Business Economics'),
  simple('engineering_graphics', 'Engineering Graphics', 'Existing Engineering Graphics Coverage', ['Isometric Projection of Solids', 'Machine Drawing', 'Building Drawing', 'Engineering Curves', 'Projection of Points & Lines', 'Projection of Planes', 'Projection of Solids', 'Sectional Views', 'Orthographic Projections', 'Computer-Aided Drawing']),
  simple('entrepreneurship', 'Entrepreneurship', 'Existing Entrepreneurship Coverage', ['Entrepreneurial Opportunity', 'Entrepreneurial Planning', 'Enterprise Marketing', 'Enterprise Growth Strategies', 'Business Arithmetic', 'Resource Mobilization', 'Entrepreneurial Ethics', 'Concept & Functions of Entrepreneurship']),
  {
    subject_id: 'environmental_studies',
    subject_name: 'Environmental Studies',
    units: [
      unit('CUET 2026 Environmental Science Topics', ['Human Beings and Nature', 'Population and Conservation Ecology', 'Environmental Pollution', 'Development and Environment', 'Sustainable Agriculture in India', 'Environmental and Natural Resource Economics', 'International Relations and the Environment']),
      unit('Existing Environmental Studies Coverage', ['Natural Resources', 'Ecosystems', 'Biodiversity', 'Social Issues & Environment', 'Human Population', 'Environmental Policies', 'Case Studies']),
    ],
  },
  {
    subject_id: 'fine_arts',
    subject_name: 'Fine Arts / Visual Arts',
    units: [
      unit('The Rajasthani and Pahari Schools of Miniature Painting', ['The Rajasthani School', 'The Pahari School']),
      unit('The Mughal and Deccan Schools of Miniature Painting', ['The Mughal School', 'The Deccan School']),
      unit('The Bengal School and Cultural Nationalism', ['The Bengal School']),
      unit('The Modern Trends in Indian Art', ['Modern Indian Art', 'Graphic Prints', 'Sculpture Post-Independence', 'Modern Trends in Indian Art']),
    ],
  },
  topSubject('geography', 'Geography / Geology'),
  topSubject('history', 'History'),
  {
    subject_id: 'home_science',
    subject_name: 'Home Science',
    units: [
      unit('Work, livelihood and career', ['Work, Livelihood and Career']),
      unit('Nutrition, Food Science and Technology', ['Nutrition for Self, Family & Community', 'Food Safety & Quality']),
      unit('Human Development and Family Studies', ['Human Development', 'Child Care & Development']),
      unit('Fabric and Apparel', ['Apparel Designing & Care']),
      unit('Resource Management', ['Money Management & Consumer Education', 'Household Management']),
      unit('Communication and Extension', ['Community Development', 'Communication and Extension']),
    ],
  },
  {
    subject_id: 'knowledge_tradition_india',
    subject_name: 'Knowledge Tradition & Practices of India',
    units: [
      unit('CUET 2026 Knowledge Traditions Topics', ['Agriculture: A Survey', 'Architecture: A Survey', 'Dance: A Survey', 'Education Systems and Practices', 'Indian Ethics', 'Martial Arts Traditions', 'Language and Grammar', 'Other Technologies']),
      unit('Existing Knowledge Traditions Coverage', ['Indian Languages, Literature & Scriptures', 'Indian Philosophy', 'Religion & Spirituality', 'Indian Arts', 'Indian Architecture', 'Science & Technology in India', 'Polity & Economy', 'Education System', 'Agriculture & Crafts']),
    ],
  },
  simple('legal_studies', 'Legal Studies', 'Existing Legal Studies Coverage', ['Judiciary', 'Topics of Law', 'Arbitration, Tribunal Adjudication & ADR', 'Human Rights', 'Legal Profession in India', 'Legal Services', 'International Context', 'Constitutional Law', 'Criminal Law', 'Family Law']),
  {
    subject_id: 'mass_media',
    subject_name: 'Mass Media / Mass Communication',
    units: [
      unit('CUET 2026 Mass Media Topics', ['Communication', 'Journalism', 'Advertising and Public Relations', 'TV Production Process and Programmes', 'Radio', 'Cinema', 'Social Media', 'New Media']),
      unit('Existing Mass Media Coverage', ['Introduction to Mass Communication', 'Print Media', 'Television', 'Advertising', 'Public Relations', 'Media Ethics']),
    ],
  },
  topSubject('mathematics', 'Mathematics / Applied Mathematics'),
  {
    subject_id: 'applied_mathematics',
    subject_name: 'Applied Mathematics',
    units: [
      unit('Applied Mathematics', ['Numbers, Quantification and Numerical Applications', 'Probability Distributions', 'Time Based Data', 'Inferential Statistics', 'Financial Mathematics']),
    ],
  },
  {
    subject_id: 'performing_arts',
    subject_name: 'Performing Arts',
    units: [
      unit('Music', ['Hindustani Music', 'Carnatic Music', 'Laya & Tala', 'Musical Forms', 'Musical Instruments']),
      unit('Dance', ['Indian Classical Dance', 'Folk Dances of India', 'Regional Dance Forms', 'Rasa Theory']),
      unit('Theatre', ['Theatre Traditions']),
      unit('Existing Performing Arts Coverage', ['Notable Performers']),
    ],
  },
  {
    subject_id: 'physical_education',
    subject_name: 'Physical Education',
    units: [
      unit('Health Status and Programmes in India', ['Health Status and Programmes in India']),
      unit('Existing Physical Education Coverage', ['Planning in Sports', 'Sports & Nutrition', 'Yoga & Lifestyle', 'Physical Education & Sports for CWSN', 'Children & Women in Sports', 'Test, Measurement & Evaluation', 'Physiology & Injuries in Sports', 'Biomechanics & Sports', 'Psychology & Sports', 'Training in Sports']),
    ],
  },
  topSubject('physics', 'Physics'),
  topSubject('political_science', 'Political Science'),
  topSubject('psychology', 'Psychology'),
  {
    subject_id: 'sanskrit',
    subject_name: 'Sanskrit',
    units: [
      unit('Sanskrit Grammar and Language', ['Apathit Avabodhanam', 'Vyakaranam', 'Racnanatmakam Karya', 'Shabda Roopani', 'Dhatu Roopani', 'Sandhi', 'Samasa', 'Pratyaya']),
      unit('Sanskrit Literature', ['Padyam', 'Gadyam', 'Natyam', 'Sanskrit Literature']),
    ],
  },
  topSubject('sociology', 'Sociology'),
  simple('teaching_aptitude', 'Teaching Aptitude', 'Existing Teaching Aptitude Coverage', ['Teaching Methodology', 'Learning & Learner', 'Teaching Aids', 'Classroom Management', 'Assessment & Evaluation', 'Educational Psychology', 'Communication Skills', 'Research Aptitude', 'Information & Communication Technology']),
  topSubject('gat', 'General Test'),
];

export const SYLLABUS_MAP = new Map(
  CANONICAL_SYLLABUS.map((subject) => [
    subject.subject_id,
    new Set(subject.units.flatMap((unitEntry) => unitEntry.chapters)),
  ])
);

export function isTopSubject(subjectId) {
  return TOP_SUBJECTS.includes(String(subjectId || ''));
}

// Aliases and other spellings of a live chapter are accepted (resolved first); retired chapters, splits waiting for
// their re-tag and unknown names are not. Writers store canonicalChapterName(subject, chapter).
export function isValidTopSyllabusPair(subjectId, chapter) {
  const subject = String(subjectId || '');
  if (!isTopSubject(subject) || !SYLLABUS_MAP.has(subject)) return false;
  const resolved = resolveChapter(subject, chapter);
  return Boolean(resolved && !resolved.retired);
}

/** The stored name to write for a chapter of a top subject (an alias becomes its chapter); other input unchanged. */
export function canonicalChapterName(subjectId, chapter) {
  const subject = String(subjectId || '');
  if (!isTopSubject(subject)) return chapter;
  const resolved = resolveChapter(subject, chapter);
  return resolved && !resolved.retired ? resolved.name : chapter;
}

export function getCanonicalSubject(subjectId) {
  return CANONICAL_SYLLABUS.find((subject) => subject.subject_id === subjectId);
}

export function getCanonicalChapters(subjectId) {
  const subject = getCanonicalSubject(subjectId);
  if (!subject) return [];
  return unique(subject.units.flatMap((entry) => entry.chapters));
}

export function getCanonicalUnitForChapter(subjectId, chapter) {
  const subject = getCanonicalSubject(subjectId);
  if (!subject) return null;
  const name = isTopSubject(subjectId) ? canonicalChapterName(subjectId, chapter) : chapter;
  return subject.units.find((entry) => entry.chapters.includes(name)) || null;
}

export function isValidCanonicalChapter(subjectId, chapter) {
  return Boolean(getCanonicalUnitForChapter(subjectId, chapter));
}

function unit(unit_name, chapters) {
  return { unit_name, chapters: unique(chapters) };
}

function topSubject(subject_id, subject_name) {
  return { subject_id, subject_name, units: unitsFor(subject_id).map((entry) => unit(entry.unit, entry.chapters.map((chapter) => chapter.name))) };
}

// Kept for callers that list a top subject's live chapters with their display titles.
export function getCanonicalChapterEntries(subjectId) {
  return isTopSubject(subjectId) ? chaptersFor(subjectId) : [];
}

function simple(subject_id, subject_name, unitName, chapters) {
  return { subject_id, subject_name, units: [unit(unitName, chapters)] };
}

function lang(subject_id, subject_name, comprehension, verbal, preserved) {
  return {
    subject_id,
    subject_name,
    units: [
      unit('Reading Comprehension', comprehension),
      unit('Verbal Ability', verbal),
      unit('Existing Language Coverage', preserved),
    ],
  };
}

function title(value) {
  return String(value).split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
