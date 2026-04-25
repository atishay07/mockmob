import { getCanonicalSubject } from './canonical_syllabus.js';

// CUET Subject Definitions — Complete mapping
// Source of truth for subject metadata (id, name, short code, glyph, chapters).
// Chapters here are mirrored into the `chapters` DB table by scripts/seed.mjs
// and recorded in supabase/migrations/0004_cuet_seed.sql for version control.
//
// Chapter lists follow the CUET (UG) syllabus released by NTA — largely aligned
// with the NCERT Class XII curriculum for each subject.
export const SUBJECTS = [
  // ---------- Section IA — Languages ----------
  {
    id: 'english', name: 'English', short: 'ENG', glyph: '✦',
    chapters: ['Reading Comprehension', 'Grammar & Usage', 'Vocabulary', 'Literature — Prose', 'Literature — Poetry', 'Note Making', 'Composition', 'Figures of Speech'],
  },
  {
    id: 'hindi', name: 'Hindi', short: 'HIN', glyph: '❦',
    chapters: ['Apathit Gadyansh', 'Apathit Padyansh', 'Vyakaran', 'Kavya Khand', 'Gadya Khand', 'Anuvad', 'Rachnatmak Lekhan'],
  },
  {
    id: 'assamese', name: 'Assamese', short: 'ASM', glyph: '✧',
    chapters: ['Reading Comprehension', 'Grammar', 'Vocabulary', 'Literature — Prose', 'Literature — Poetry', 'Composition'],
  },
  {
    id: 'bengali', name: 'Bengali', short: 'BEN', glyph: '❉',
    chapters: ['Reading Comprehension', 'Grammar', 'Vocabulary', 'Literature — Prose', 'Literature — Poetry', 'Composition'],
  },
  {
    id: 'gujarati', name: 'Gujarati', short: 'GUJ', glyph: '❈',
    chapters: ['Reading Comprehension', 'Grammar', 'Vocabulary', 'Literature — Prose', 'Literature — Poetry', 'Composition'],
  },
  {
    id: 'kannada', name: 'Kannada', short: 'KAN', glyph: '❊',
    chapters: ['Reading Comprehension', 'Grammar', 'Vocabulary', 'Literature — Prose', 'Literature — Poetry', 'Composition'],
  },
  {
    id: 'malayalam', name: 'Malayalam', short: 'MAL', glyph: '✿',
    chapters: ['Reading Comprehension', 'Grammar', 'Vocabulary', 'Literature — Prose', 'Literature — Poetry', 'Composition'],
  },
  {
    id: 'marathi', name: 'Marathi', short: 'MAR', glyph: '❀',
    chapters: ['Reading Comprehension', 'Grammar', 'Vocabulary', 'Literature — Prose', 'Literature — Poetry', 'Composition'],
  },
  {
    id: 'odia', name: 'Odia', short: 'ODI', glyph: '✢',
    chapters: ['Reading Comprehension', 'Grammar', 'Vocabulary', 'Literature — Prose', 'Literature — Poetry', 'Composition'],
  },
  {
    id: 'punjabi', name: 'Punjabi', short: 'PUN', glyph: '✣',
    chapters: ['Reading Comprehension', 'Grammar', 'Vocabulary', 'Literature — Prose', 'Literature — Poetry', 'Composition'],
  },
  {
    id: 'tamil', name: 'Tamil', short: 'TAM', glyph: '✤',
    chapters: ['Reading Comprehension', 'Grammar', 'Vocabulary', 'Literature — Prose', 'Literature — Poetry', 'Composition'],
  },
  {
    id: 'telugu', name: 'Telugu', short: 'TEL', glyph: '✥',
    chapters: ['Reading Comprehension', 'Grammar', 'Vocabulary', 'Literature — Prose', 'Literature — Poetry', 'Composition'],
  },
  {
    id: 'urdu', name: 'Urdu', short: 'URD', glyph: '✪',
    chapters: ['Reading Comprehension', 'Grammar', 'Vocabulary', 'Literature — Prose', 'Literature — Poetry', 'Composition'],
  },

  // ---------- Section II — Domain Subjects ----------
  {
    id: 'accountancy', name: 'Accountancy', short: 'ACC', glyph: '◈',
    chapters: [
      'Partnership Fundamentals', 'Change in Profit Sharing Ratio', 'Admission of Partner',
      'Retirement & Death of Partner', 'Dissolution of Partnership', 'Share Capital',
      'Debentures', 'Financial Statements of Company', 'Analysis of Financial Statements',
      'Cash Flow Statement', 'Computerized Accounting System',
    ],
  },
  {
    id: 'agriculture', name: 'Agriculture', short: 'AGR', glyph: '❋',
    chapters: [
      'Agricultural Meteorology', 'Genetics & Plant Breeding', 'Biochemistry & Microbiology',
      'Livestock Production', 'Crop Production', 'Horticulture', 'Agricultural Economics',
      'Basic Agricultural Engineering', 'Extension Education',
    ],
  },
  {
    id: 'anthropology', name: 'Anthropology', short: 'ANT', glyph: '☥',
    chapters: [
      'Introducing Anthropology', 'Human Evolution', 'Human Genetics', 'Human Ecology',
      'Demographic Anthropology', 'Archaeological Anthropology', 'Indian Anthropology',
      'Tribal India', 'Applied Anthropology', 'Fieldwork Methods',
    ],
  },
  {
    id: 'biology', name: 'Biology', short: 'BIO', glyph: '⚘',
    chapters: [
      'Reproduction in Organisms', 'Sexual Reproduction in Flowering Plants',
      'Human Reproduction', 'Reproductive Health', 'Principles of Inheritance & Variation',
      'Molecular Basis of Inheritance', 'Evolution', 'Human Health & Disease',
      'Microbes in Human Welfare', 'Biotechnology Principles & Processes',
      'Biotechnology & its Applications', 'Organisms & Populations', 'Ecosystem',
      'Biodiversity & Conservation', 'Environmental Issues',
    ],
  },
  {
    id: 'business_studies', name: 'Business Studies', short: 'BST', glyph: '▲',
    chapters: [
      'Nature & Significance of Management', 'Principles of Management', 'Business Environment',
      'Planning', 'Organising', 'Staffing', 'Directing', 'Controlling',
      'Financial Management', 'Financial Markets', 'Marketing Management', 'Consumer Protection',
      'Entrepreneurship Development',
    ],
  },
  {
    id: 'chemistry', name: 'Chemistry', short: 'CHE', glyph: '⚗',
    chapters: [
      'Solid State', 'Solutions', 'Electrochemistry', 'Chemical Kinetics', 'Surface Chemistry',
      'Isolation of Elements', 'p-Block Elements', 'd- and f-Block Elements',
      'Coordination Compounds', 'Haloalkanes & Haloarenes', 'Alcohols, Phenols & Ethers',
      'Aldehydes, Ketones & Carboxylic Acids', 'Amines', 'Biomolecules', 'Polymers',
      'Chemistry in Everyday Life',
    ],
  },
  {
    id: 'computer_science', name: 'Computer Science / Informatics Practices', short: 'CS', glyph: '❇',
    chapters: [
      'Python Revision', 'Functions', 'File Handling', 'Data Structures',
      'Computer Networks', 'Database Concepts', 'MySQL', 'Interface Python with MySQL',
      'Boolean Algebra', 'Communication Technologies',
    ],
  },
  {
    id: 'economics', name: 'Economics / Business Economics', short: 'ECO', glyph: '◆',
    chapters: [
      'National Income & Related Aggregates', 'Money & Banking', 'Income Determination',
      'Government Budget & the Economy', 'Balance of Payments',
      'Indian Economy on the Eve of Independence', 'Indian Economic Development 1950–1990',
      'Economic Reforms Since 1991', 'Human Capital Formation', 'Rural Development',
      'Employment', 'Infrastructure', 'Environment & Sustainable Development',
    ],
  },
  {
    id: 'engineering_graphics', name: 'Engineering Graphics', short: 'EG', glyph: '◰',
    chapters: [
      'Isometric Projection of Solids', 'Machine Drawing', 'Building Drawing',
      'Engineering Curves', 'Projection of Points & Lines', 'Projection of Planes',
      'Projection of Solids', 'Sectional Views', 'Orthographic Projections',
      'Computer-Aided Drawing',
    ],
  },
  {
    id: 'entrepreneurship', name: 'Entrepreneurship', short: 'ENT', glyph: '◎',
    chapters: [
      'Entrepreneurial Opportunity', 'Entrepreneurial Planning', 'Enterprise Marketing',
      'Enterprise Growth Strategies', 'Business Arithmetic', 'Resource Mobilization',
      'Entrepreneurial Ethics', 'Concept & Functions of Entrepreneurship',
    ],
  },
  {
    id: 'environmental_studies', name: 'Environmental Studies', short: 'ENV', glyph: '♁',
    chapters: [
      'Natural Resources', 'Ecosystems', 'Biodiversity', 'Environmental Pollution',
      'Social Issues & Environment', 'Human Population', 'Environmental Policies', 'Case Studies',
    ],
  },
  {
    id: 'fine_arts', name: 'Fine Arts / Visual Arts', short: 'ART', glyph: '✎',
    chapters: [
      'The Rajasthani School', 'The Pahari School', 'The Mughal School', 'The Deccan School',
      'The Bengal School', 'Modern Indian Art', 'Graphic Prints', 'Sculpture Post-Independence',
    ],
  },
  {
    id: 'geography', name: 'Geography / Geology', short: 'GEO', glyph: '◉',
    chapters: [
      'Human Geography — Nature & Scope', 'Population — Distribution, Density, Growth',
      'Migration', 'Human Development', 'Human Settlements', 'Primary Activities',
      'Secondary Activities', 'Tertiary & Quaternary Activities', 'Transport & Communication',
      'International Trade', 'India — People & Economy', 'Resources & Development',
      'Manufacturing Industries', 'Planning & Sustainable Development',
    ],
  },
  {
    id: 'history', name: 'History', short: 'HIS', glyph: '⚑',
    chapters: [
      'Bricks, Beads & Bones', 'Kings, Farmers & Towns', 'Kinship, Caste & Class',
      'Thinkers, Beliefs & Buildings', 'Through the Eyes of Travellers', 'Bhakti-Sufi Traditions',
      'An Imperial Capital — Vijayanagara', 'Peasants, Zamindars & the State',
      'Kings & Chronicles', 'Colonialism & the Countryside', 'Rebels & the Raj',
      'Mahatma Gandhi & the Nationalist Movement', 'Partition', 'Framing the Constitution',
    ],
  },
  {
    id: 'home_science', name: 'Home Science', short: 'HSC', glyph: '⌂',
    chapters: [
      'Human Development', 'Nutrition for Self, Family & Community',
      'Money Management & Consumer Education', 'Apparel Designing & Care',
      'Community Development', 'Food Safety & Quality', 'Child Care & Development',
      'Household Management',
    ],
  },
  {
    id: 'knowledge_tradition_india', name: 'Knowledge Tradition & Practices of India', short: 'KTP', glyph: '☸',
    chapters: [
      'Indian Languages, Literature & Scriptures', 'Indian Philosophy',
      'Religion & Spirituality', 'Indian Arts', 'Indian Architecture',
      'Science & Technology in India', 'Polity & Economy', 'Education System',
      'Agriculture & Crafts',
    ],
  },
  {
    id: 'legal_studies', name: 'Legal Studies', short: 'LAW', glyph: '⚖',
    chapters: [
      'Judiciary', 'Topics of Law', 'Arbitration, Tribunal Adjudication & ADR',
      'Human Rights', 'Legal Profession in India', 'Legal Services',
      'International Context', 'Constitutional Law', 'Criminal Law', 'Family Law',
    ],
  },
  {
    id: 'mass_media', name: 'Mass Media / Mass Communication', short: 'MM', glyph: '✉',
    chapters: [
      'Introduction to Mass Communication', 'Print Media', 'Radio', 'Television',
      'Cinema', 'New Media', 'Advertising', 'Public Relations', 'Media Ethics',
    ],
  },
  {
    id: 'mathematics', name: 'Mathematics / Applied Mathematics', short: 'MATH', glyph: '∑',
    chapters: [
      'Relations & Functions', 'Inverse Trigonometric Functions', 'Matrices', 'Determinants',
      'Continuity & Differentiability', 'Application of Derivatives', 'Integrals',
      'Application of Integrals', 'Differential Equations', 'Vector Algebra',
      'Three Dimensional Geometry', 'Linear Programming', 'Probability',
    ],
  },
  {
    id: 'performing_arts', name: 'Performing Arts', short: 'PA', glyph: '♫',
    chapters: [
      'Indian Classical Dance', 'Folk Dances of India', 'Hindustani Music',
      'Carnatic Music', 'Theatre Traditions', 'Rasa Theory', 'Notable Performers',
      'Regional Dance Forms',
    ],
  },
  {
    id: 'physical_education', name: 'Physical Education', short: 'PE', glyph: '⚽',
    chapters: [
      'Planning in Sports', 'Sports & Nutrition', 'Yoga & Lifestyle',
      'Physical Education & Sports for CWSN', 'Children & Women in Sports',
      'Test, Measurement & Evaluation', 'Physiology & Injuries in Sports',
      'Biomechanics & Sports', 'Psychology & Sports', 'Training in Sports',
    ],
  },
  {
    id: 'physics', name: 'Physics', short: 'PHY', glyph: '⚛',
    chapters: [
      'Electric Charges & Fields', 'Electrostatic Potential & Capacitance', 'Current Electricity',
      'Moving Charges & Magnetism', 'Magnetism & Matter', 'Electromagnetic Induction',
      'Alternating Current', 'Electromagnetic Waves', 'Ray Optics & Optical Instruments',
      'Wave Optics', 'Dual Nature of Radiation & Matter', 'Atoms', 'Nuclei',
      'Semiconductor Electronics', 'Communication Systems',
    ],
  },
  {
    id: 'political_science', name: 'Political Science', short: 'POL', glyph: '⚔',
    chapters: [
      'Cold War Era', 'End of Bipolarity', 'US Hegemony in World Politics',
      'Alternative Centres of Power', 'Contemporary South Asia',
      'International Organisations', 'Security in the Contemporary World',
      'Environment & Natural Resources', 'Globalisation',
      'Challenges of Nation Building', 'Era of One-Party Dominance',
      'Politics of Planned Development', "India's External Relations",
      'Challenges to & Restoration of the Congress System',
      'Crisis of the Democratic Order', 'Rise of Popular Movements', 'Regional Aspirations',
    ],
  },
  {
    id: 'psychology', name: 'Psychology', short: 'PSY', glyph: '☯',
    chapters: [
      'Variations in Psychological Attributes', 'Self & Personality',
      'Meeting Life Challenges', 'Psychological Disorders', 'Therapeutic Approaches',
      'Attitude & Social Cognition', 'Social Influence & Group Processes',
      'Psychology & Life', 'Developing Psychological Skills',
    ],
  },
  {
    id: 'sanskrit', name: 'Sanskrit', short: 'SKT', glyph: 'ॐ',
    chapters: [
      'Apathit Avabodhanam', 'Vyakaranam', 'Racnanatmakam Karya',
      'Padyam', 'Gadyam', 'Natyam', 'Sanskrit Literature',
    ],
  },
  {
    id: 'sociology', name: 'Sociology', short: 'SOC', glyph: '◍',
    chapters: [
      'Introducing Indian Society', 'Demographic Structure', 'Social Institutions',
      'Market as a Social Institution', 'Patterns of Social Inequality',
      'Challenges of Cultural Diversity', 'Structural Change', 'Cultural Change',
      'Story of Indian Democracy', 'Change & Development in Rural Society',
      'Change & Development in Industrial Society', 'Globalisation & Social Change',
      'Mass Media & Communications', 'Social Movements',
    ],
  },
  {
    id: 'teaching_aptitude', name: 'Teaching Aptitude', short: 'TCH', glyph: '✐',
    chapters: [
      'Teaching Methodology', 'Learning & Learner', 'Teaching Aids',
      'Classroom Management', 'Assessment & Evaluation', 'Educational Psychology',
      'Communication Skills', 'Research Aptitude', 'Information & Communication Technology',
    ],
  },

  // ---------- Section III — General Test ----------
  {
    id: 'gat', name: 'General Test', short: 'GAT', glyph: '⬢',
    chapters: [
      'General Knowledge', 'Current Affairs', 'General Mental Ability',
      'Numerical Ability', 'Quantitative Reasoning', 'Logical & Analytical Reasoning',
      'Basic Mathematical Concepts', 'Statistical Data Analysis',
    ],
  },
];

for (const subject of SUBJECTS) {
  const canonical = getCanonicalSubject(subject.id);
  if (!canonical) continue;

  subject.units = canonical.units;
  subject.chapters = Array.from(new Set(canonical.units.flatMap((unit) => unit.chapters)));
}

export function getSubjectById(id) {
  return SUBJECTS.find((s) => s.id === id);
}
