// CUET 2026 canonical unit/chapter map.
// Source of truth: PDFs in data/CUET 2026, with a stability bias toward
// preserving existing chapter names already used by questions and UI filters.

export const CANONICAL_SYLLABUS = [
  lang('english', 'English', ['Reading Comprehension'], ['Grammar & Usage', 'Vocabulary', 'Figures of Speech'], ['Literature — Prose', 'Literature — Poetry', 'Note Making', 'Composition']),
  lang('hindi', 'Hindi', ['Apathit Gadyansh', 'Apathit Padyansh'], ['Vyakaran', 'Anuvad'], ['Kavya Khand', 'Gadya Khand', 'Rachnatmak Lekhan']),
  ...['assamese', 'bengali', 'gujarati', 'kannada', 'malayalam', 'marathi', 'odia', 'punjabi', 'tamil', 'telugu', 'urdu'].map((id) =>
    lang(id, title(id), ['Reading Comprehension'], ['Grammar', 'Vocabulary'], ['Literature — Prose', 'Literature — Poetry', 'Composition'])
  ),
  {
    subject_id: 'accountancy',
    subject_name: 'Accountancy',
    units: [
      unit('Accounting for Partnership', ['Partnership Fundamentals', 'Profit & Loss Appropriation Account']),
      unit('Reconstitution of a Partnership firm', ['Change in Profit Sharing Ratio', 'Goodwill Valuation', 'Admission of Partner', 'Retirement & Death of Partner']),
      unit('Dissolution of Partnership Firm', ['Dissolution of Partnership', 'Dissolution of Partnership Firm']),
      unit('Company Accounts: Accounting for Share and Debenture Capital', ['Share Capital', 'Debentures']),
      unit('Analysis of Financial Statements', ['Financial Statements of Company', 'Analysis of Financial Statements', 'Comparative & Common Size Statements', 'Accounting Ratios', 'Cash Flow Statement']),
      unit('Computerized Accounting System', ['Computerized Accounting System']),
    ],
  },
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
  {
    subject_id: 'biology',
    subject_name: 'Biology',
    units: [
      unit('Reproduction', ['Reproduction in Organisms', 'Sexual Reproduction in Flowering Plants', 'Human Reproduction', 'Reproductive Health']),
      unit('Genetics and Evolution', ['Principles of Inheritance & Variation', 'Molecular Basis of Inheritance', 'Evolution']),
      unit('Biology and Human Welfare', ['Human Health & Disease', 'Microbes in Human Welfare']),
      unit('Biotechnology and its Applications', ['Biotechnology Principles & Processes', 'Biotechnology & its Applications']),
      unit('Ecology and Environment', ['Organisms & Populations', 'Ecosystem', 'Biodiversity & Conservation', 'Environmental Issues']),
    ],
  },
  {
    subject_id: 'business_studies',
    subject_name: 'Business Studies',
    units: [
      unit('Nature and Significance of Management', ['Nature & Significance of Management']),
      unit('Principles of Management', ['Principles of Management']),
      unit('Business Environment', ['Business Environment']),
      unit('Planning', ['Planning']),
      unit('Organising', ['Organising']),
      unit('Staffing', ['Staffing']),
      unit('Directing', ['Directing']),
      unit('Controlling', ['Controlling']),
      unit('Business Finance', ['Financial Management']),
      unit('Financial Markets', ['Financial Markets']),
      unit('Marketing', ['Marketing Management']),
      unit('Consumer Protection', ['Consumer Protection']),
      unit('Existing Business Studies Coverage', ['Entrepreneurship Development']),
    ],
  },
  {
    subject_id: 'chemistry',
    subject_name: 'Chemistry',
    units: [
      unit('Solutions', ['Solutions']),
      unit('Electrochemistry', ['Electrochemistry']),
      unit('Chemical Kinetics', ['Chemical Kinetics']),
      unit('d and f Block Elements', ['d- and f-Block Elements']),
      unit('Coordination Compounds', ['Coordination Compounds']),
      unit('Haloalkanes and Haloarenes', ['Haloalkanes & Haloarenes']),
      unit('Alcohols, Phenols and Ethers', ['Alcohols, Phenols & Ethers']),
      unit('Aldehydes, Ketones and Carboxylic Acids', ['Aldehydes, Ketones & Carboxylic Acids']),
      unit('Amines', ['Amines']),
      unit('Biomolecules', ['Biomolecules']),
      unit('Existing Chemistry Coverage', ['Solid State', 'Surface Chemistry', 'Isolation of Elements', 'p-Block Elements', 'Polymers', 'Chemistry in Everyday Life']),
    ],
  },
  {
    subject_id: 'computer_science',
    subject_name: 'Computer Science / Informatics Practices',
    units: [
      unit('Section A: Database and Networks', ['Database Concepts', 'MySQL', 'Structured Query Language', 'Computer Networks']),
      unit('Section B1: Computer Science', ['Python Revision', 'Functions', 'File Handling', 'Exception and File Handling in Python', 'Data Structures', 'Stack', 'Queue', 'Searching', 'Sorting', 'Understanding Data', 'Interface Python with MySQL', 'Data Communication', 'Security Aspects', 'Communication Technologies', 'Boolean Algebra']),
      unit('Section B2: Informatics Practices', ['Data Handling using Pandas', 'Plotting Data using Matplotlib', 'Societal Impacts', 'Project Based Learning']),
    ],
  },
  {
    subject_id: 'economics',
    subject_name: 'Economics / Business Economics',
    units: [
      unit('Introductory Microeconomics', ['Introduction & Theory of Consumer Behaviour', 'Production & Costs', 'Theory of Firms under Perfect Competition', 'Market Equilibrium & Simple Applications']),
      unit('Introductory Macroeconomics', ['National Income & Related Aggregates', 'Money & Banking', 'Income Determination', 'Government Budget & the Economy', 'Balance of Payments']),
      unit('Indian Economic Development', ['Indian Economy on the Eve of Independence', 'Indian Economic Development 1950–1990', 'Economic Reforms Since 1991', 'Human Capital Formation', 'Rural Development', 'Employment', 'Infrastructure', 'Environment & Sustainable Development', 'Development Experiences of India']),
    ],
  },
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
  {
    subject_id: 'geography',
    subject_name: 'Geography / Geology',
    units: [
      unit('Human Geography - Nature and Scope', ['Human Geography — Nature & Scope']),
      unit('People', ['Population — Distribution, Density, Growth', 'Migration', 'Human Development', 'India — People & Economy']),
      unit('Human Activities', ['Primary Activities', 'Secondary Activities', 'Tertiary & Quaternary Activities']),
      unit('Transport, Communication and Trade', ['Transport & Communication', 'International Trade']),
      unit('Human Settlements', ['Human Settlements']),
      unit('Resources and Development', ['Resources & Development', 'Manufacturing Industries', 'Planning & Sustainable Development']),
      unit('Geographical Perspective on Selected Issues and Problems', ['Geographical Perspective on Selected Issues and Problems']),
    ],
  },
  {
    subject_id: 'history',
    subject_name: 'History',
    units: [
      unit('Themes in Indian History Part I', ['Bricks, Beads & Bones', 'Kings, Farmers & Towns', 'Kinship, Caste & Class', 'Thinkers, Beliefs & Buildings']),
      unit('Themes in Indian History Part II', ['Through the Eyes of Travellers', 'Bhakti-Sufi Traditions', 'An Imperial Capital — Vijayanagara', 'Peasants, Zamindars & the State', 'Kings & Chronicles']),
      unit('Themes in Indian History Part III', ['Colonialism & the Countryside', 'Rebels & the Raj', 'Mahatma Gandhi & the Nationalist Movement', 'Partition', 'Framing the Constitution']),
    ],
  },
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
  {
    subject_id: 'mathematics',
    subject_name: 'Mathematics / Applied Mathematics',
    units: [
      unit('Relations and Functions', ['Relations & Functions', 'Inverse Trigonometric Functions']),
      unit('Algebra', ['Matrices', 'Determinants']),
      unit('Calculus', ['Continuity & Differentiability', 'Application of Derivatives', 'Integrals', 'Application of Integrals', 'Differential Equations']),
      unit('Vectors and Three-Dimensional Geometry', ['Vector Algebra', 'Three Dimensional Geometry']),
      unit('Linear Programming', ['Linear Programming']),
      unit('Probability', ['Probability']),
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
  {
    subject_id: 'physics',
    subject_name: 'Physics',
    units: [
      unit('Electrostatics', ['Electric Charges & Fields', 'Electrostatic Potential & Capacitance']),
      unit('Current Electricity', ['Current Electricity']),
      unit('Magnetic Effects of Current and Magnetism', ['Moving Charges & Magnetism', 'Magnetism & Matter']),
      unit('Electromagnetic Induction and Alternating Currents', ['Electromagnetic Induction', 'Alternating Current']),
      unit('Electromagnetic Waves', ['Electromagnetic Waves']),
      unit('Optics', ['Ray Optics & Optical Instruments', 'Wave Optics']),
      unit('Dual Nature of Matter and Radiation', ['Dual Nature of Radiation & Matter']),
      unit('Atoms and Nuclei', ['Atoms', 'Nuclei']),
      unit('Electronic Devices', ['Semiconductor Electronics']),
      unit('Existing Physics Coverage', ['Communication Systems']),
    ],
  },
  {
    subject_id: 'political_science',
    subject_name: 'Political Science',
    units: [
      unit('Politics in India Since Independence', ['Challenges of Nation Building', 'Era of One-Party Dominance', 'Politics of Planned Development', "India's External Relations", 'Challenges to & Restoration of the Congress System', 'Crisis of the Democratic Order', 'Rise of Popular Movements', 'Regional Aspirations', 'Democratic Upsurge and Coalition Politics', 'Recent Issues and Challenges']),
      unit('Contemporary World Politics', ['Cold War Era', 'End of Bipolarity', 'US Hegemony in World Politics', 'Alternative Centres of Power', 'Contemporary South Asia', 'International Organisations', 'Security in the Contemporary World', 'Environment & Natural Resources', 'Globalisation']),
    ],
  },
  {
    subject_id: 'psychology',
    subject_name: 'Psychology',
    units: [
      unit('Variations in Psychological Attributes', ['Variations in Psychological Attributes']),
      unit('Self and Personality', ['Self & Personality']),
      unit('Meeting Life Challenges', ['Meeting Life Challenges']),
      unit('Psychological Disorders', ['Psychological Disorders']),
      unit('Therapeutic Approaches', ['Therapeutic Approaches']),
      unit('Attitude and Social Cognition', ['Attitude & Social Cognition']),
      unit('Social Influence and Group Processes', ['Social Influence & Group Processes']),
      unit('Existing Psychology Coverage', ['Psychology & Life', 'Developing Psychological Skills']),
    ],
  },
  {
    subject_id: 'sanskrit',
    subject_name: 'Sanskrit',
    units: [
      unit('Sanskrit Grammar and Language', ['Apathit Avabodhanam', 'Vyakaranam', 'Racnanatmakam Karya', 'Shabda Roopani', 'Dhatu Roopani', 'Sandhi', 'Samasa', 'Pratyaya']),
      unit('Sanskrit Literature', ['Padyam', 'Gadyam', 'Natyam', 'Sanskrit Literature']),
    ],
  },
  {
    subject_id: 'sociology',
    subject_name: 'Sociology',
    units: [
      unit('Indian Society', ['Introducing Indian Society', 'Demographic Structure', 'Social Institutions', 'Patterns of Social Inequality', 'Challenges of Cultural Diversity']),
      unit('Social Change and Development in India', ['Structural Change', 'Cultural Change', 'Story of Indian Democracy', 'Change & Development in Rural Society', 'Change & Development in Industrial Society', 'Market as a Social Institution', 'Globalisation & Social Change', 'Mass Media & Communications', 'Social Movements']),
    ],
  },
  simple('teaching_aptitude', 'Teaching Aptitude', 'Existing Teaching Aptitude Coverage', ['Teaching Methodology', 'Learning & Learner', 'Teaching Aids', 'Classroom Management', 'Assessment & Evaluation', 'Educational Psychology', 'Communication Skills', 'Research Aptitude', 'Information & Communication Technology']),
  {
    subject_id: 'gat',
    subject_name: 'General Test',
    units: [
      unit('General Knowledge and Current Affairs', ['General Knowledge', 'Current Affairs']),
      unit('General Mental Ability', ['General Mental Ability']),
      unit('Numerical Ability', ['Numerical Ability']),
      unit('Quantitative Reasoning', ['Quantitative Reasoning', 'Basic Mathematical Concepts', 'Statistical Data Analysis']),
      unit('Logical and Analytical Reasoning', ['Logical & Analytical Reasoning']),
      unit('General Science and Environment Literacy', ['General Science and Environment Literacy']),
    ],
  },
];

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
  return subject.units.find((entry) => entry.chapters.includes(chapter)) || null;
}

export function isValidCanonicalChapter(subjectId, chapter) {
  return Boolean(getCanonicalUnitForChapter(subjectId, chapter));
}

function unit(unit_name, chapters) {
  return { unit_name, chapters: unique(chapters) };
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
