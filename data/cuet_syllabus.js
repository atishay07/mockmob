// Syllabus v2 (31 Oct 2026): the single source for the 15 TOP_SUBJECTS' units and chapters.
// Pure (no I/O, no imports), so the website, the pipeline scripts and the app fixtures can all read it.
//
// The frame (docs/brain/intel-1031/syllabus-verified.md, owner D200/D201): subject, then the exact CUET 2026
// unit, then the NCERT chapter (the unit of study) in NCERT order inside that unit. One reference: the real CUET
// syllabus. No "older syllabus" shelf: retired chapters are stored, never served.
//
// `name` is the stored chapter string that questions carry today. It changes only where a section 5 merge folds
// an empty twin into it, and then the surviving name is the one that already holds the live questions, so the
// released app (version 16) keeps working. `title` is what a student reads (the NCERT title; the CUET title where
// the rulings say CUET leads). `ncert` is the book reference: { book, code, chapter, title }.
//
// Chapter key rule, shared by every part of the Key cards build: subject + '.' + slug(name), where slug lowercases,
// turns "&" into "and", replaces every run of non-alphanumerics with "-" and trims "-".

export const SYLLABUS_YEAR = 2026; // CUET 2027 not published yet; re-run the audit when NTA publishes it.

export const SUBJECT_OPTIONS = {
  mathematics: { label: 'Section', choices: [{ id: 'B1', label: 'B1 Mathematics' }, { id: 'B2', label: 'B2 Applied Mathematics' }], default: 'B1' },
  computer_science: { label: 'Section', choices: [{ id: 'B1', label: 'B1 Computer Science' }, { id: 'B2', label: 'B2 Informatics Practices' }], default: 'B1' },
  accountancy: { label: 'Part', choices: [{ id: 'AFS', label: 'Analysis of Financial Statements' }, { id: 'CAS', label: 'Computerised Accounting' }], default: 'AFS' },
};

// The section every student of the subject sits, whatever option they chose.
export const COMMON_SECTIONS = Object.freeze({ mathematics: 'A1', computer_science: 'A' });

// The NTA blueprint variant (data/nta_blueprints/<subject>.json) each option maps to.
export const OPTION_VARIANTS = Object.freeze({
  mathematics: Object.freeze({ B1: 'core', B2: 'applied' }),
  computer_science: Object.freeze({ B1: 'cs', B2: 'ip' }),
});

// NCERT books (Reprint 2026-27). `first` is the chapter number the book starts at (Part 2 books often continue the
// numbering); a chapter's file code is the book code plus its two-digit position in the book (lebs201 = Ch 9).
const BOOKS = {
  leac1: { book: 'Accountancy Part 1', first: 1 },
  leac2: { book: 'Accountancy Part 2', first: 1 },
  leec1: { book: 'Introductory Macroeconomics', first: 1 },
  leec2: { book: 'Introductory Microeconomics', first: 1 },
  keec1: { book: 'Indian Economic Development', first: 1 },
  lebs1: { book: 'Business Studies Part 1', first: 1 },
  lebs2: { book: 'Business Studies Part 2', first: 9 },
  lemh1: { book: 'Mathematics Part 1', first: 1 },
  lemh2: { book: 'Mathematics Part 2', first: 7 },
  leph1: { book: 'Physics Part 1', first: 1 },
  leph2: { book: 'Physics Part 2', first: 9 },
  lech1: { book: 'Chemistry Part 1', first: 1 },
  lech2: { book: 'Chemistry Part 2', first: 6 },
  lebo1: { book: 'Biology', first: 1 },
  lehs1: { book: 'Themes in Indian History Part 1', first: 1 },
  lehs2: { book: 'Themes in Indian History Part 2', first: 5 },
  lehs3: { book: 'Themes in Indian History Part 3', first: 9 },
  leps1: { book: 'Contemporary World Politics', first: 1 },
  leps2: { book: 'Politics in India since Independence', first: 1 },
  legy1: { book: 'Fundamentals of Human Geography', first: 1 },
  legy2: { book: 'India: People and Economy', first: 1 },
  lepy1: { book: 'Psychology', first: 1 },
  lesy1: { book: 'Indian Society', first: 1 },
  lesy2: { book: 'Social Change and Development in India', first: 1 },
  lecs1: { book: 'Computer Science', first: 1 },
  leip1: { book: 'Informatics Practices', first: 1 },
};

function nc(code, chapter, title, extra = {}) {
  const entry = BOOKS[code];
  return { book: entry.book, code: `${code}${String(chapter - entry.first + 1).padStart(2, '0')}`, chapter, title, ...extra };
}

// A unit: [CUET unit title, section of every chapter in it (or null), chapters].
// A chapter: [stored name, display title, ncert reference or null, flags].
const U = (unit, section, chapters) => ({ unit, section, chapters });
const C = (name, title, ncert = null, flags = {}) => ({ name, title, ncert, ...flags });

const SOURCE = {
  english: [
    U('Reading Comprehension', null, [
      C('Factual Passage', 'Factual Passage'),
      C('Narrative Passage', 'Narrative Passage'),
      C('Literary Passage', 'Literary Passage'),
    ]),
    U('Verbal Ability', null, [
      C('Para Jumbles', 'Rearranging the Parts'),
      C('Match the Following', 'Match the Following'),
      C('Correct Word Usage', 'Choosing the Correct Word'),
      C('Vocabulary', 'Synonyms and Antonyms'),
    ]),
  ],
  gat: [
    U('General Knowledge and Current Affairs', null, [
      C('General Knowledge', 'General Knowledge'),
      C('Current Affairs', 'Current Affairs'),
    ]),
    U('General Mental Ability', null, [C('General Mental Ability', 'General Mental Ability')]),
    U('Numerical Ability', null, [C('Numerical Ability', 'Numerical Ability')]),
    U('Quantitative Reasoning', null, [
      C('Quantitative Reasoning', 'Quantitative Reasoning'),
      C('Basic Mathematical Concepts', 'Basic Mathematical Concepts'),
      C('Statistical Data Analysis', 'Statistical Data Analysis'),
    ]),
    U('Logical and Analytical Reasoning', null, [C('Logical & Analytical Reasoning', 'Logical and Analytical Reasoning')]),
    U('General Science and Environment Literacy', null, [C('General Science and Environment Literacy', 'General Science and Environment Literacy')]),
  ],
  accountancy: [
    U('Accounting for Partnership', null, [
      C('Partnership Fundamentals', 'Accounting for Partnership: Basic Concepts', nc('leac1', 1, 'Accounting for Partnership: Basic Concepts')),
      C('Profit & Loss Appropriation Account', 'Profit and Loss Appropriation Account', nc('leac1', 1, 'Accounting for Partnership: Basic Concepts')),
    ]),
    U('Reconstitution of a Partnership Firm', null, [
      C('Change in Profit Sharing Ratio', 'Change in Profit Sharing Ratio', nc('leac1', 2, 'Reconstitution of a Partnership Firm – Admission of a Partner')),
      C('Goodwill Valuation', 'Goodwill: Nature and Valuation', nc('leac1', 2, 'Reconstitution of a Partnership Firm – Admission of a Partner')),
      C('Admission of Partner', 'Admission of a Partner', nc('leac1', 2, 'Reconstitution of a Partnership Firm – Admission of a Partner')),
      C('Retirement & Death of Partner', 'Retirement/Death of a Partner', nc('leac1', 3, 'Reconstitution of a Partnership Firm – Retirement/Death of a Partner')),
    ]),
    U('Dissolution of Partnership Firm', null, [
      C('Dissolution of Partnership Firm', 'Dissolution of Partnership Firm', nc('leac1', 4, 'Dissolution of Partnership Firm')),
    ]),
    U('Company Accounts: Accounting for Share and Debenture Capital', null, [
      C('Share Capital', 'Accounting for Share Capital', nc('leac2', 1, 'Accounting for Share Capital')),
      C('Debentures', 'Issue and Redemption of Debentures', nc('leac2', 2, 'Issue and Redemption of Debentures')),
    ]),
    U('Analysis of Financial Statements', 'AFS', [
      C('Financial Statements of Company', 'Financial Statements of a Company', nc('leac2', 3, 'Financial Statements of a Company')),
      C('Analysis of Financial Statements', 'Analysis of Financial Statements', nc('leac2', 4, 'Analysis of Financial Statements')),
      C('Comparative & Common Size Statements', 'Comparative and Common Size Statements', nc('leac2', 4, 'Analysis of Financial Statements')),
      C('Accounting Ratios', 'Accounting Ratios', nc('leac2', 5, 'Accounting Ratios')),
      C('Cash Flow Statement', 'Cash Flow Statement', nc('leac2', 6, 'Cash Flow Statement')),
    ]),
    // CUET "Optional to Unit V": the separate NCERT book (its file codes are not on record yet).
    U('Computerised Accounting System', 'CAS', [
      C('Computerized Accounting System', 'Computerised Accounting System', { book: 'Computerised Accounting System', code: null, chapter: null, title: 'Computerised Accounting System' }),
    ]),
  ],
  economics: [
    // Course I, Introductory Microeconomics: examined by CBSE in Class 11 (NCERT prints the book as Class XII).
    U('Introduction, Theory of Consumer Behaviour', null, [
      C('Introduction & Theory of Consumer Behaviour', 'Introduction, Theory of Consumer Behaviour', nc('leec2', 2, 'Theory of Consumer Behaviour', { span: [1, 2] }), { cbseClass11: true }),
    ]),
    U('Production and Costs', null, [
      C('Production & Costs', 'Production and Costs', nc('leec2', 3, 'Production and Costs'), { cbseClass11: true }),
    ]),
    U('The Theory of the Firm under Perfect Competition', null, [
      C('Theory of Firms under Perfect Competition', 'The Theory of the Firm under Perfect Competition', nc('leec2', 4, 'The Theory of the Firm under Perfect Competition'), { cbseClass11: true }),
    ]),
    U('Market Equilibrium and Simple Applications', null, [
      C('Market Equilibrium & Simple Applications', 'Market Equilibrium and Simple Applications', nc('leec2', 5, 'Market Equilibrium'), { cbseClass11: true }),
    ]),
    // Course II, Introductory Macroeconomics.
    U('Introduction and National Income Accounting', null, [
      C('National Income & Related Aggregates', 'Introduction and National Income Accounting', nc('leec1', 2, 'National Income Accounting', { span: [1, 2] })),
    ]),
    U('Money and Banking', null, [C('Money & Banking', 'Money and Banking', nc('leec1', 3, 'Money and Banking'))]),
    U('Determination of Income and Employment', null, [
      C('Income Determination', 'Determination of Income and Employment', nc('leec1', 4, 'Determination of Income and Employment')),
    ]),
    U('Government Budget and the Economy', null, [
      C('Government Budget & the Economy', 'Government Budget and the Economy', nc('leec1', 5, 'Government Budget and the Economy')),
    ]),
    U('Open Economy Macroeconomics', null, [C('Balance of Payments', 'Open Economy Macroeconomics', nc('leec1', 6, 'Open Economy Macroeconomics'))]),
    // Course III, Indian Economic Development.
    U('Development Policies and Experience (1947-90)', null, [
      C('Indian Economy on the Eve of Independence', 'Indian Economy on the Eve of Independence', nc('keec1', 1, 'Indian Economy on the Eve of Independence'), { lightWeight: true }),
      C('Indian Economic Development 1950–1990', 'Indian Economy 1950–1990', nc('keec1', 2, 'Indian Economy 1950–1990')),
    ]),
    U('Economic Reforms since 1991', null, [
      C('Economic Reforms Since 1991', 'Economic Reforms since 1991', nc('keec1', 3, 'Liberalisation, Privatisation and Globalisation: An Appraisal')),
    ]),
    U('Current Challenges facing the Indian Economy', null, [
      C('Human Capital Formation', 'Human Capital Formation in India', nc('keec1', 4, 'Human Capital Formation in India')),
      C('Rural Development', 'Rural Development', nc('keec1', 5, 'Rural Development')),
      C('Employment', 'Employment: Growth, Informalisation and Other Issues', nc('keec1', 6, 'Employment: Growth, Informalisation and Other Issues')),
      C('Environment & Sustainable Development', 'Environment and Sustainable Development', nc('keec1', 7, 'Environment and Sustainable Development')),
    ]),
    U('Development Experiences of India: A Comparison with Neighbours', null, [
      C('Development Experiences of India', 'Development Experiences of India: A Comparison with Neighbours', nc('keec1', 8, 'Comparative Development Experiences of India and its Neighbours')),
    ]),
  ],
  business_studies: [
    U('Nature and Significance of Management', null, [C('Nature & Significance of Management', 'Nature and Significance of Management', nc('lebs1', 1, 'Nature and Significance of Management'))]),
    U('Principles of Management', null, [C('Principles of Management', 'Principles of Management', nc('lebs1', 2, 'Principles of Management'))]),
    U('Business Environment', null, [C('Business Environment', 'Business Environment', nc('lebs1', 3, 'Business Environment'))]),
    U('Planning', null, [C('Planning', 'Planning', nc('lebs1', 4, 'Planning'))]),
    U('Organising', null, [C('Organising', 'Organising', nc('lebs1', 5, 'Organising'))]),
    U('Staffing', null, [C('Staffing', 'Staffing', nc('lebs1', 6, 'Staffing'))]),
    U('Directing', null, [C('Directing', 'Directing', nc('lebs1', 7, 'Directing'))]),
    U('Controlling', null, [C('Controlling', 'Controlling', nc('lebs1', 8, 'Controlling'))]),
    U('Business Finance', null, [C('Financial Management', 'Financial Management', nc('lebs2', 9, 'Financial Management'))]),
    // CUET 2026 Unit X. The NCERT Reprint 2026-27 Part 2 runs Ch 9 Financial Management, Ch 10 Marketing,
    // Ch 11 Consumer Protection, so this unit has no NCERT chapter on record.
    U('Financial Markets', null, [C('Financial Markets', 'Financial Markets')]),
    U('Marketing', null, [C('Marketing Management', 'Marketing', nc('lebs2', 10, 'Marketing'))]),
    U('Consumer Protection', null, [C('Consumer Protection', 'Consumer Protection', nc('lebs2', 11, 'Consumer Protection'))]),
  ],
  mathematics: [
    U('Relations and Functions', 'B1', [
      C('Relations & Functions', 'Relations and Functions', nc('lemh1', 1, 'Relations and Functions')),
      C('Inverse Trigonometric Functions', 'Inverse Trigonometric Functions', nc('lemh1', 2, 'Inverse Trigonometric Functions')),
    ]),
    U('Algebra', 'A1', [
      C('Matrices', 'Matrices', nc('lemh1', 3, 'Matrices')),
      C('Determinants', 'Determinants', nc('lemh1', 4, 'Determinants')),
    ]),
    U('Calculus', 'A1', [
      C('Continuity & Differentiability', 'Continuity and Differentiability', nc('lemh1', 5, 'Continuity and Differentiability'), { section: 'B1' }),
      C('Application of Derivatives', 'Application of Derivatives', nc('lemh1', 6, 'Application of Derivatives')),
      C('Integrals', 'Integrals', nc('lemh2', 7, 'Integrals')),
      C('Application of Integrals', 'Application of Integrals', nc('lemh2', 8, 'Application of Integrals')),
      C('Differential Equations', 'Differential Equations', nc('lemh2', 9, 'Differential Equations')),
    ]),
    U('Vectors and Three-Dimensional Geometry', 'B1', [
      C('Vector Algebra', 'Vector Algebra', nc('lemh2', 10, 'Vector Algebra')),
      C('Three Dimensional Geometry', 'Three Dimensional Geometry', nc('lemh2', 11, 'Three Dimensional Geometry')),
    ]),
    U('Linear Programming', 'A1', [C('Linear Programming', 'Linear Programming', nc('lemh2', 12, 'Linear Programming'))]),
    U('Probability', 'B1', [C('Probability', 'Probability', nc('lemh2', 13, 'Probability'))]),
    // Section B2 Applied Mathematics follows CBSE 241, which has no NCERT book: the chapter is the CUET unit itself.
    U('Numbers, Quantification and Numerical Applications', 'B2', [C('Numbers, Quantification and Numerical Applications', 'Numbers, Quantification and Numerical Applications')]),
    // As the CUET PDF places it: Section A1 (common) item 5, and B2 Unit IV.
    U('Probability Distributions', 'A1', [C('Probability Distributions', 'Probability Distributions')]),
    U('Time Based Data', 'B2', [C('Time Based Data', 'Time Based Data')]),
    U('Inferential Statistics', 'B2', [C('Inferential Statistics', 'Inferential Statistics')]),
    U('Financial Mathematics', 'B2', [C('Financial Mathematics', 'Financial Mathematics')]),
  ],
  physics: [
    U('Electrostatics', null, [
      C('Electric Charges & Fields', 'Electric Charges and Fields', nc('leph1', 1, 'Electric Charges and Fields')),
      C('Electrostatic Potential & Capacitance', 'Electrostatic Potential and Capacitance', nc('leph1', 2, 'Electrostatic Potential and Capacitance')),
    ]),
    U('Current Electricity', null, [C('Current Electricity', 'Current Electricity', nc('leph1', 3, 'Current Electricity'))]),
    U('Magnetic Effects of Current and Magnetism', null, [
      C('Moving Charges & Magnetism', 'Moving Charges and Magnetism', nc('leph1', 4, 'Moving Charges and Magnetism')),
      C('Magnetism & Matter', 'Magnetism and Matter', nc('leph1', 5, 'Magnetism and Matter')),
    ]),
    U('Electromagnetic Induction and Alternating Currents', null, [
      C('Electromagnetic Induction', 'Electromagnetic Induction', nc('leph1', 6, 'Electromagnetic Induction')),
      C('Alternating Current', 'Alternating Current', nc('leph1', 7, 'Alternating Current')),
    ]),
    U('Electromagnetic Waves', null, [C('Electromagnetic Waves', 'Electromagnetic Waves', nc('leph1', 8, 'Electromagnetic Waves'))]),
    U('Optics', null, [
      C('Ray Optics & Optical Instruments', 'Ray Optics and Optical Instruments', nc('leph2', 9, 'Ray Optics and Optical Instruments')),
      C('Wave Optics', 'Wave Optics', nc('leph2', 10, 'Wave Optics')),
    ]),
    U('Dual Nature of Matter and Radiation', null, [C('Dual Nature of Radiation & Matter', 'Dual Nature of Radiation and Matter', nc('leph2', 11, 'Dual Nature of Radiation and Matter'))]),
    U('Atoms and Nuclei', null, [
      C('Atoms', 'Atoms', nc('leph2', 12, 'Atoms')),
      C('Nuclei', 'Nuclei', nc('leph2', 13, 'Nuclei')),
    ]),
    U('Electronic Devices', null, [
      C('Semiconductor Electronics', 'Semiconductor Electronics: Materials, Devices and Simple Circuits', nc('leph2', 14, 'Semiconductor Electronics: Materials, Devices and Simple Circuits')),
    ]),
  ],
  chemistry: [
    U('Solutions', null, [C('Solutions', 'Solutions', nc('lech1', 1, 'Solutions'))]),
    U('Electrochemistry', null, [C('Electrochemistry', 'Electrochemistry', nc('lech1', 2, 'Electrochemistry'))]),
    U('Chemical Kinetics', null, [C('Chemical Kinetics', 'Chemical Kinetics', nc('lech1', 3, 'Chemical Kinetics'))]),
    U('d and f Block Elements', null, [C('d- and f-Block Elements', 'The d- and f-Block Elements', nc('lech1', 4, 'The d- and f-Block Elements'))]),
    U('Coordination Compounds', null, [C('Coordination Compounds', 'Coordination Compounds', nc('lech1', 5, 'Coordination Compounds'))]),
    U('Haloalkanes and Haloarenes', null, [C('Haloalkanes & Haloarenes', 'Haloalkanes and Haloarenes', nc('lech2', 6, 'Haloalkanes and Haloarenes'))]),
    U('Alcohols, Phenols and Ethers', null, [C('Alcohols, Phenols & Ethers', 'Alcohols, Phenols and Ethers', nc('lech2', 7, 'Alcohols, Phenols and Ethers'))]),
    U('Aldehydes, Ketones and Carboxylic Acids', null, [C('Aldehydes, Ketones & Carboxylic Acids', 'Aldehydes, Ketones and Carboxylic Acids', nc('lech2', 8, 'Aldehydes, Ketones and Carboxylic Acids'))]),
    U('Amines', null, [C('Amines', 'Amines', nc('lech2', 9, 'Amines'))]),
    U('Biomolecules', null, [C('Biomolecules', 'Biomolecules', nc('lech2', 10, 'Biomolecules'))]),
  ],
  biology: [
    U('Reproduction', null, [
      C('Sexual Reproduction in Flowering Plants', 'Sexual Reproduction in Flowering Plants', nc('lebo1', 1, 'Sexual Reproduction in Flowering Plants')),
      C('Human Reproduction', 'Human Reproduction', nc('lebo1', 2, 'Human Reproduction')),
      C('Reproductive Health', 'Reproductive Health', nc('lebo1', 3, 'Reproductive Health')),
    ]),
    U('Genetics and Evolution', null, [
      C('Principles of Inheritance & Variation', 'Principles of Inheritance and Variation', nc('lebo1', 4, 'Principles of Inheritance and Variation')),
      C('Molecular Basis of Inheritance', 'Molecular Basis of Inheritance', nc('lebo1', 5, 'Molecular Basis of Inheritance')),
      C('Evolution', 'Evolution', nc('lebo1', 6, 'Evolution')),
    ]),
    U('Biology and Human Welfare', null, [
      C('Human Health & Disease', 'Human Health and Disease', nc('lebo1', 7, 'Human Health and Disease')),
      C('Microbes in Human Welfare', 'Microbes in Human Welfare', nc('lebo1', 8, 'Microbes in Human Welfare')),
    ]),
    U('Biotechnology and its Applications', null, [
      C('Biotechnology Principles & Processes', 'Biotechnology: Principles and Processes', nc('lebo1', 9, 'Biotechnology: Principles and Processes')),
      C('Biotechnology & its Applications', 'Biotechnology and its Applications', nc('lebo1', 10, 'Biotechnology and its Applications')),
    ]),
    U('Ecology and Environment', null, [
      C('Organisms & Populations', 'Organisms and Populations', nc('lebo1', 11, 'Organisms and Populations')),
      C('Ecosystem', 'Ecosystem', nc('lebo1', 12, 'Ecosystem')),
      C('Biodiversity & Conservation', 'Biodiversity and Conservation', nc('lebo1', 13, 'Biodiversity and Conservation')),
    ]),
  ],
  history: [
    U('Themes in Indian History Part I', null, [
      C('Bricks, Beads & Bones', 'Bricks, Beads and Bones: The Harappan Civilisation', nc('lehs1', 1, 'Bricks, Beads and Bones: The Harappan Civilisation')),
      C('Kings, Farmers & Towns', 'Kings, Farmers and Towns: Early States and Economies', nc('lehs1', 2, 'Kings, Farmers and Towns: Early States and Economies')),
      C('Kinship, Caste & Class', 'Kinship, Caste and Class: Early Societies', nc('lehs1', 3, 'Kinship, Caste and Class: Early Societies')),
      C('Thinkers, Beliefs & Buildings', 'Thinkers, Beliefs and Buildings: Cultural Developments', nc('lehs1', 4, 'Thinkers, Beliefs and Buildings: Cultural Developments')),
    ]),
    U('Themes in Indian History Part II', null, [
      C('Through the Eyes of Travellers', 'Through the Eyes of Travellers: Perceptions of Society', nc('lehs2', 5, 'Through the Eyes of Travellers: Perceptions of Society')),
      C('Bhakti-Sufi Traditions', 'Bhakti-Sufi Traditions: Changes in Religious Beliefs and Devotional Texts', nc('lehs2', 6, 'Bhakti-Sufi Traditions: Changes in Religious Beliefs and Devotional Texts')),
      C('An Imperial Capital — Vijayanagara', 'An Imperial Capital: Vijayanagara', nc('lehs2', 7, 'An Imperial Capital: Vijayanagara')),
      C('Peasants, Zamindars & the State', 'Peasants, Zamindars and the State: Agrarian Society and the Mughal Empire', nc('lehs2', 8, 'Peasants, Zamindars and the State: Agrarian Society and the Mughal Empire')),
    ]),
    U('Themes in Indian History Part III', null, [
      C('Colonialism & the Countryside', 'Colonialism and the Countryside: Exploring Official Archives', nc('lehs3', 9, 'Colonialism and the Countryside: Exploring Official Archives')),
      C('Rebels & the Raj', 'Rebels and the Raj: The Revolt of 1857 and its Representations', nc('lehs3', 10, 'Rebels and the Raj: The Revolt of 1857 and its Representations')),
      C('Mahatma Gandhi & the Nationalist Movement', 'Mahatma Gandhi and the Nationalist Movement: Civil Disobedience and Beyond', nc('lehs3', 11, 'Mahatma Gandhi and the Nationalist Movement: Civil Disobedience and Beyond')),
      C('Framing the Constitution', 'Framing the Constitution: The Beginning of a New Era', nc('lehs3', 12, 'Framing the Constitution: The Beginning of a New Era')),
    ]),
  ],
  political_science: [
    U('Politics in India Since Independence', null, [
      C('Challenges of Nation Building', 'Challenges of Nation Building', nc('leps2', 1, 'Challenges of Nation Building')),
      C('Era of One-Party Dominance', 'Era of One-Party Dominance', nc('leps2', 2, 'Era of One-Party Dominance')),
      C('Politics of Planned Development', 'Politics of Planned Development', nc('leps2', 3, 'Politics of Planned Development')),
      C("India's External Relations", "India's External Relations", nc('leps2', 4, "India's External Relations")),
      C('Challenges to & Restoration of the Congress System', 'Challenges to and Restoration of the Congress System', nc('leps2', 5, 'Challenges to and Restoration of the Congress System')),
      C('Crisis of the Democratic Order', 'The Crisis of Democratic Order', nc('leps2', 6, 'The Crisis of Democratic Order')),
      C('Regional Aspirations', 'Regional Aspirations', nc('leps2', 7, 'Regional Aspirations')),
      // CUET lists these two separately; both read from NCERT Ch 8 (CUET leads, NCERT is the book reference).
      C('Democratic Upsurge and Coalition Politics', 'Democratic Upsurge and Coalition Politics', nc('leps2', 8, 'Recent Developments in Indian Politics')),
      C('Recent Issues and Challenges', 'Recent Issues and Challenges', nc('leps2', 8, 'Recent Developments in Indian Politics')),
    ]),
    U('Contemporary World Politics', null, [
      C('End of Bipolarity', 'The End of Bipolarity', nc('leps1', 1, 'The End of Bipolarity')),
      C('Alternative Centres of Power', 'Alternative Centres of Power', nc('leps1', 2, 'Contemporary Centres of Power')),
      C('Contemporary South Asia', 'Contemporary South Asia', nc('leps1', 3, 'Contemporary South Asia')),
      C('International Organisations', 'International Organisations', nc('leps1', 4, 'International Organisations')),
      C('Security in the Contemporary World', 'Security in the Contemporary World', nc('leps1', 5, 'Security in the Contemporary World')),
      C('Environment & Natural Resources', 'Environment and Natural Resources', nc('leps1', 6, 'Environment and Natural Resources')),
      C('Globalisation', 'Globalisation', nc('leps1', 7, 'Globalisation')),
    ]),
  ],
  geography: [
    // A. Fundamentals of Human Geography
    U('Human Geography - Nature and Scope', null, [
      C('Human Geography — Nature & Scope', 'Human Geography: Nature and Scope', nc('legy1', 1, 'Human Geography: Nature and Scope')),
    ]),
    U('People', null, [
      C('Population — Distribution, Density, Growth', 'The World Population: Distribution, Density and Growth', nc('legy1', 2, 'The World Population: Distribution, Density and Growth')),
      C('Human Development', 'Human Development', nc('legy1', 3, 'Human Development')),
    ]),
    U('Human Activities', null, [
      C('Primary Activities', 'Primary Activities', nc('legy1', 4, 'Primary Activities')),
      C('Secondary Activities', 'Secondary Activities', nc('legy1', 5, 'Secondary Activities')),
      C('Tertiary & Quaternary Activities', 'Tertiary and Quaternary Activities', nc('legy1', 6, 'Tertiary and Quaternary Activities')),
    ]),
    U('Transport, Communication and Trade', null, [
      C('Transport & Communication', 'Transport and Communication', nc('legy1', 7, 'Transport and Communication')),
      C('International Trade', 'International Trade', nc('legy1', 8, 'International Trade')),
    ]),
    // B. India: People and Economy. CUET calls both books' Unit "People"; unit titles must differ per subject.
    U('People (India)', null, [
      C('India — People & Economy', 'Population: Distribution, Density, Growth and Composition', nc('legy2', 1, 'Population: Distribution, Density, Growth and Composition')),
    ]),
    U('Human Settlements', null, [C('Human Settlements', 'Human Settlements', nc('legy2', 2, 'Human Settlements'))]),
    U('Resources and Development', null, [
      C('Land Resources and Agriculture', 'Land Resources and Agriculture', nc('legy2', 3, 'Land Resources and Agriculture')),
      C('Water Resources', 'Water Resources', nc('legy2', 4, 'Water Resources')),
      C('Mineral and Energy Resources', 'Mineral and Energy Resources', nc('legy2', 5, 'Mineral and Energy Resources')),
      C('Planning & Sustainable Development', 'Planning and Sustainable Development in Indian Context', nc('legy2', 6, 'Planning and Sustainable Development in Indian Context')),
    ]),
    U('Transport, Communication and International Trade', null, [
      C('Transport and Communication (India)', 'Transport and Communication', nc('legy2', 7, 'Transport and Communication')),
      C('International Trade (India)', 'International Trade', nc('legy2', 8, 'International Trade')),
    ]),
    U('Geographical Perspective on Selected Issues and Problems', null, [
      C('Geographical Perspective on Selected Issues and Problems', 'Geographical Perspective on Selected Issues and Problems', nc('legy2', 9, 'Geographical Perspective on Selected Issues and Problems')),
    ]),
  ],
  psychology: [
    U('Variations in Psychological Attributes', null, [C('Variations in Psychological Attributes', 'Variations in Psychological Attributes', nc('lepy1', 1, 'Variations in Psychological Attributes'))]),
    U('Self and Personality', null, [C('Self & Personality', 'Self and Personality', nc('lepy1', 2, 'Self and Personality'))]),
    U('Meeting Life Challenges', null, [C('Meeting Life Challenges', 'Meeting Life Challenges', nc('lepy1', 3, 'Meeting Life Challenges'))]),
    U('Psychological Disorders', null, [C('Psychological Disorders', 'Psychological Disorders', nc('lepy1', 4, 'Psychological Disorders'))]),
    U('Therapeutic Approaches', null, [C('Therapeutic Approaches', 'Therapeutic Approaches', nc('lepy1', 5, 'Therapeutic Approaches'))]),
    U('Attitude and Social Cognition', null, [C('Attitude & Social Cognition', 'Attitude and Social Cognition', nc('lepy1', 6, 'Attitude and Social Cognition'))]),
    U('Social Influence and Group Processes', null, [C('Social Influence & Group Processes', 'Social Influence and Group Processes', nc('lepy1', 7, 'Social Influence and Group Processes'))]),
  ],
  sociology: [
    // Indian Society
    U('Structure of Indian Society', null, [
      C('Introducing Indian Society', 'Introducing Indian Society', nc('lesy1', 1, 'Introducing Indian Society')),
      C('Demographic Structure', 'The Demographic Structure of the Indian Society', nc('lesy1', 2, 'The Demographic Structure of the Indian Society')),
    ]),
    U('Social Institutions: Continuity and Change', null, [
      C('Social Institutions', 'Social Institutions: Continuity and Change', nc('lesy1', 3, 'Social Institutions: Continuity and Change')),
      C('Market as a Social Institution', 'The Market as a Social Institution', nc('lesy1', 4, 'The Market as a Social Institution'), { cuetOnly: true }),
    ]),
    U('Social Inequality and Exclusion', null, [
      C('Patterns of Social Inequality', 'Patterns of Social Inequality and Exclusion', nc('lesy1', 5, 'Patterns of Social Inequality and Exclusion')),
    ]),
    U('The Challenges of Unity in Diversity', null, [
      C('Challenges of Cultural Diversity', 'The Challenges of Cultural Diversity', nc('lesy1', 6, 'The Challenges of Cultural Diversity')),
    ]),
    // Change and Development in India
    U('Process of Social Change in India', null, [
      C('Structural Change', 'Structural Change', nc('lesy2', 1, 'Structural Change')),
      C('Cultural Change', 'Cultural Change', nc('lesy2', 2, 'Cultural Change')),
    ]),
    U('Social Change and the Polity', null, [
      C('Story of Indian Democracy', 'The Constitution and Social Change', nc('lesy2', 3, 'The Constitution and Social Change'), { cuetOnly: true }),
    ]),
    U('Social Change and the Economy', null, [
      C('Change & Development in Rural Society', 'Change and Development in Rural Society', nc('lesy2', 4, 'Change and Development in Rural Society')),
      C('Change & Development in Industrial Society', 'Change and Development in Industrial Society', nc('lesy2', 5, 'Change and Development in Industrial Society')),
    ]),
    U('New Arenas of Social Change', null, [
      C('Globalisation & Social Change', 'Globalisation and Social Change', nc('lesy2', 6, 'Globalisation and Social Change'), { cuetOnly: true }),
      // Under the CUET topic "Media and Social Change".
      C('Mass Media & Communications', 'Mass Media and Communications', nc('lesy2', 7, 'Mass Media and Communications'), { cuetOnly: true }),
    ]),
    U('Social Movements', null, [C('Social Movements', 'Social Movements', nc('lesy2', 8, 'Social Movements'))]),
  ],
  computer_science: [
    U('Section A', 'A', [
      C('Database Concepts', 'Database Concepts', nc('lecs1', 8, 'Database Concepts')),
      C('Structured Query Language', 'Structured Query Language (SQL)', nc('lecs1', 9, 'Structured Query Language (SQL)')),
      C('Computer Networks', 'Computer Networks', nc('lecs1', 10, 'Computer Networks')),
    ]),
    // "Pick B1 if you study Computer Science, B2 if Informatics Practices." NCERT CS XII titles (rulings section 5).
    U('Section B1: Computer Science', 'B1', [
      C('Exception and File Handling in Python', 'Exception Handling in Python', nc('lecs1', 1, 'Exception Handling in Python')),
      C('File Handling', 'File Handling in Python', nc('lecs1', 2, 'File Handling in Python')),
      C('Stack', 'Stack', nc('lecs1', 3, 'Stack')),
      C('Queue', 'Queue', nc('lecs1', 4, 'Queue'), { cuetOnly: true }),
      C('Sorting', 'Sorting', nc('lecs1', 5, 'Sorting'), { cuetOnly: true }),
      C('Searching', 'Searching', nc('lecs1', 6, 'Searching'), { cuetOnly: true }),
      C('Understanding Data', 'Understanding Data', nc('lecs1', 7, 'Understanding Data'), { cuetOnly: true }),
      C('Data Communication', 'Data Communication', nc('lecs1', 11, 'Data Communication')),
      C('Security Aspects', 'Security Aspects', nc('lecs1', 12, 'Security Aspects'), { cuetOnly: true }),
    ]),
    U('Section B2: Informatics Practices', 'B2', [
      C('Database Query using SQL', 'Database Query using SQL', nc('leip1', 1, 'Querying and SQL Functions')),
      C('Data Handling using Pandas', 'Data Handling using Pandas', nc('leip1', 2, 'Data Handling using Pandas – I', { span: [2, 3] })),
      C('Plotting Data using Matplotlib', 'Plotting Data using Matplotlib', nc('leip1', 4, 'Plotting Data using Matplotlib')),
      C('Introduction to Computer Networks', 'Introduction to Computer Networks', nc('leip1', 5, 'Introduction to Computer Networks')),
      C('Societal Impacts', 'Societal Impacts', nc('leip1', 6, 'Societal Impacts')),
      C('Project Based Learning', 'Project Based Learning', nc('leip1', 7, 'Project Based Learning')),
    ]),
  ],
};

// Old or alternative names read as the stored chapter they now belong to (section 5 merges, the empty twins,
// and the legacy names the PYQ anchors and the factory used). Titles and "&"/"and" spellings resolve on their own.
export const CHAPTER_ALIASES = Object.freeze({
  english: Object.freeze({ Grammar: 'Correct Word Usage' }),
  gat: Object.freeze({ GK: 'General Knowledge' }),
  accountancy: Object.freeze({
    Partnership: 'Partnership Fundamentals',
    'Dissolution of Partnership': 'Dissolution of Partnership Firm',
    Dissolution: 'Dissolution of Partnership Firm',
    'Computerised Accounting System': 'Computerized Accounting System',
  }),
  economics: Object.freeze({
    'National Income Accounting': 'National Income & Related Aggregates',
    'National Income': 'National Income & Related Aggregates',
    'National Income and Related Aggregates': 'National Income & Related Aggregates',
    'Determination of Income and Employment': 'Income Determination',
  }),
  business_studies: Object.freeze({
    Management: 'Nature & Significance of Management',
    'Business Finance': 'Financial Management',
    Marketing: 'Marketing Management',
  }),
  mathematics: Object.freeze({ Vectors: 'Vector Algebra' }),
  physics: Object.freeze({ 'Electronic Devices': 'Semiconductor Electronics' }),
  chemistry: Object.freeze({ 'd and f Block Elements': 'd- and f-Block Elements' }),
  political_science: Object.freeze({ 'Contemporary Centres of Power': 'Alternative Centres of Power' }),
  sociology: Object.freeze({ 'The Story of Indian Democracy': 'Story of Indian Democracy' }),
  computer_science: Object.freeze({
    MySQL: 'Structured Query Language',
    'Communication Technologies': 'Data Communication', // merged after review: the re-tag pass rewrites the rows
    'File Handling in Python': 'File Handling',
  }),
});

// Off-syllabus (syllabus-verified.md section 3): stored, never served, is_cuet_syllabus=false after the migration.
export const RETIRED_CHAPTERS = Object.freeze({
  economics: Object.freeze({ Infrastructure: 'not_in_cuet_2026' }),
  business_studies: Object.freeze({ 'Entrepreneurship Development': 'not_in_cuet_2026' }),
  physics: Object.freeze({ 'Communication Systems': 'not_in_cuet_2026' }),
  chemistry: Object.freeze({
    'Solid State': 'not_in_cuet_2026',
    'Surface Chemistry': 'not_in_cuet_2026',
    'Isolation of Elements': 'not_in_cuet_2026',
    'p-Block Elements': 'not_in_cuet_2026',
    Polymers: 'not_in_cuet_2026',
    'Chemistry in Everyday Life': 'not_in_cuet_2026',
  }),
  biology: Object.freeze({ 'Reproduction in Organisms': 'not_in_cuet_2026', 'Environmental Issues': 'not_in_cuet_2026' }),
  history: Object.freeze({ 'Kings & Chronicles': 'not_in_cuet_2026', Partition: 'not_in_cuet_2026' }),
  political_science: Object.freeze({
    'Cold War Era': 'not_in_cuet_2026',
    'US Hegemony in World Politics': 'not_in_cuet_2026',
    'Rise of Popular Movements': 'not_in_cuet_2026',
  }),
  geography: Object.freeze({ 'Manufacturing Industries': 'not_in_cuet_2026', Migration: 'not_in_cuet_2026' }),
  psychology: Object.freeze({ 'Psychology & Life': 'not_in_cuet_2026', 'Developing Psychological Skills': 'not_in_cuet_2026' }),
  computer_science: Object.freeze({
    'Boolean Algebra': 'not_in_cuet_2026',
    'Python Revision': 'not_in_cuet_2026',
    Functions: 'not_in_cuet_2026',
    'Interface Python with MySQL': 'not_in_cuet_2026',
  }),
});

// Stored names that split into several live chapters. Their questions wait for the re-tag pass
// (data/syllabus/retag-2026-10-31.json); until then resolveChapter returns null and they count toward no chapter.
export const SPLIT_CHAPTERS = Object.freeze({
  geography: Object.freeze({
    'Resources & Development': Object.freeze(['Land Resources and Agriculture', 'Water Resources', 'Mineral and Energy Resources', 'Planning & Sustainable Development']),
  }),
  computer_science: Object.freeze({ 'Data Structures': Object.freeze(['Stack', 'Queue']) }),
});

// What the re-tag agent may move before a chapter is hidden (rulings section 3 "Re-tag first", section 5 splits).
// Only questions that fit the target go; the rest stay where they are.
export const RETAG_RULES = Object.freeze([
  { subject: 'economics', from: 'Infrastructure', to: ['Indian Economy on the Eve of Independence'], why: 'colonial infrastructure items' },
  { subject: 'biology', from: 'Reproduction in Organisms', to: ['Sexual Reproduction in Flowering Plants'], why: 'flowering-plant items (the agent decides each item)' },
  { subject: 'political_science', from: 'Cold War Era', to: ['End of Bipolarity'], why: 'Soviet-collapse items' },
  { subject: 'political_science', from: 'US Hegemony in World Politics', to: ['End of Bipolarity'], why: 'Soviet-collapse items' },
  { subject: 'geography', from: 'Manufacturing Industries', to: ['Secondary Activities'], why: 'world manufacturing items' },
  { subject: 'geography', from: 'Migration', to: ['Geographical Perspective on Selected Issues and Problems'], why: 'rural-urban migration items' },
  { subject: 'geography', from: 'Resources & Development', to: ['Land Resources and Agriculture', 'Water Resources', 'Mineral and Energy Resources', 'Planning & Sustainable Development'], why: 'split into the four NCERT chapters; unsure items stay untagged' },
  { subject: 'geography', from: 'Transport & Communication', to: ['Transport and Communication (India)'], why: 'India-specific items (India: People and Economy Ch 7)' },
  { subject: 'geography', from: 'International Trade', to: ['International Trade (India)'], why: "India's trade pattern, seaports and hinterland (India: People and Economy Ch 8)" },
  { subject: 'computer_science', from: 'Data Structures', to: ['Stack', 'Queue'], why: 'split: re-tag each item' },
  { subject: 'computer_science', from: 'Communication Technologies', to: ['Data Communication'], why: 'merge after review' },
  { subject: 'computer_science', from: 'Exception and File Handling in Python', to: ['File Handling'], why: 'file-handling items belong to NCERT Ch 2' },
  { subject: 'computer_science', from: 'Python Revision', to: ['Exception and File Handling in Python', 'File Handling'], why: 'items on exceptions or file handling that also fit a B1 chapter' },
  { subject: 'computer_science', from: 'Functions', to: ['Exception and File Handling in Python', 'File Handling'], why: 'items on functions or file handling that also fit a B1 chapter' },
  { subject: 'computer_science', from: 'Interface Python with MySQL', to: ['Structured Query Language'], why: 'items that are plain SQL' },
]);

// ---------------------------------------------------------------------------------------------------------------
// Keys and names
// ---------------------------------------------------------------------------------------------------------------

/** slug(name): lowercase, "&" to "and", every run of non-alphanumerics to "-", "-" trimmed. */
export function slugChapter(name) {
  return String(name ?? '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** The chapter key shared by questions, Key cards and chapter state: subject + "." + slug(name). */
export function chapterKey(subject, name) {
  return `${subject}.${slugChapter(name)}`;
}

// Loose match for names typed by people and models: case, "&"/"and", dashes and punctuation are forgiven.
function looseName(value) {
  return String(value ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

const SUBJECT_ALIASES = Object.freeze({ general_test: 'gat' });
const subjectId = (value) => {
  const id = String(value ?? '').trim();
  return SUBJECT_ALIASES[id] || id;
};

// ---------------------------------------------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------------------------------------------

function buildChapters() {
  const out = [];
  for (const [subject, units] of Object.entries(SOURCE)) {
    units.forEach((unitEntry, u) => {
      unitEntry.chapters.forEach((chapter, c) => {
        out.push(Object.freeze({
          key: chapterKey(subject, chapter.name),
          subject,
          name: chapter.name,
          title: chapter.title,
          unit: unitEntry.unit,
          unitOrder: u + 1,
          order: c + 1,
          ncert: chapter.ncert ? Object.freeze({ ...chapter.ncert }) : null,
          section: chapter.section !== undefined ? chapter.section : unitEntry.section,
          cuetOnly: chapter.cuetOnly === true,
          cbseClass11: chapter.cbseClass11 === true,
          lightWeight: chapter.lightWeight === true,
        }));
      });
    });
  }
  return Object.freeze(out);
}

/** One entry per live chapter, in NCERT order within each CUET unit, units in CUET order. */
export const CHAPTERS = buildChapters();

export const SYLLABUS_SUBJECTS = Object.freeze(Object.keys(SOURCE));

const BY_SUBJECT = new Map();
for (const chapter of CHAPTERS) {
  if (!BY_SUBJECT.has(chapter.subject)) BY_SUBJECT.set(chapter.subject, []);
  BY_SUBJECT.get(chapter.subject).push(chapter);
}

// Per subject: exact and loose indexes. Stored names first, then retired names, explicit aliases, titles and NCERT
// titles. A title or NCERT title two chapters share (Recent Developments in Indian Politics) resolves to neither.
const INDEX = new Map();
for (const subject of SYLLABUS_SUBJECTS) {
  const chapters = BY_SUBJECT.get(subject) || [];
  const exact = new Map();
  const loose = new Map();
  const put = (map, k, value) => { if (k && !map.has(k)) map.set(k, value); };
  const byName = new Map(chapters.map((chapter) => [chapter.name, chapter]));
  for (const chapter of chapters) { put(exact, chapter.name, { chapter }); put(loose, looseName(chapter.name), { chapter }); }
  for (const [name, reason] of Object.entries(RETIRED_CHAPTERS[subject] || {})) {
    put(exact, name, { retired: reason, name });
    put(loose, looseName(name), { retired: reason, name });
  }
  for (const name of Object.keys(SPLIT_CHAPTERS[subject] || {})) { put(exact, name, { split: name }); put(loose, looseName(name), { split: name }); }
  for (const [alias, target] of Object.entries(CHAPTER_ALIASES[subject] || {})) {
    const chapter = byName.get(target);
    if (!chapter) continue;
    put(exact, alias, { chapter });
    put(loose, looseName(alias), { chapter });
  }
  const counts = new Map();
  const titleKeys = (chapter) => [...new Set([looseName(chapter.title), chapter.ncert?.title ? looseName(chapter.ncert.title) : null].filter(Boolean))];
  for (const chapter of chapters) for (const k of titleKeys(chapter)) counts.set(k, (counts.get(k) || 0) + 1);
  for (const chapter of chapters) for (const k of titleKeys(chapter)) if (counts.get(k) === 1) put(loose, k, { chapter });
  INDEX.set(subject, { exact, loose });
}

function lookup(subject, name) {
  const index = INDEX.get(subjectId(subject));
  const raw = String(name ?? '').trim();
  if (!index || !raw) return null;
  return index.exact.get(raw) || index.loose.get(looseName(raw)) || null;
}

/**
 * The live chapter a stored or typed name belongs to.
 * -> { key, name, title, unit, section, retired: false } | { retired: true, reason, name } | null (unknown, or a
 * split still waiting for its re-tag).
 */
export function resolveChapter(subject, name) {
  const hit = lookup(subject, name);
  if (!hit || hit.split) return null;
  if (hit.retired) return { retired: true, reason: hit.retired, name: hit.name };
  const { chapter } = hit;
  return { key: chapter.key, name: chapter.name, title: chapter.title, unit: chapter.unit, section: chapter.section, retired: false };
}

/** The full CHAPTERS entry for a stored or typed name, or null. */
export function chapterEntry(subject, name) {
  const hit = lookup(subject, name);
  return hit?.chapter || null;
}

/** The CHAPTERS entry for a chapter key, or null. */
export function chapterByKey(key) {
  const text = String(key ?? '');
  return CHAPTERS.find((chapter) => chapter.key === text) || null;
}

/** True when the name is a retired chapter of the subject. */
export function isRetiredChapter(subject, name) {
  return Boolean(lookup(subject, name)?.retired);
}

/** A split chapter's live targets ([] when the name is not a split). */
export function splitTargets(subject, name) {
  const hit = lookup(subject, name);
  return hit?.split ? [...(SPLIT_CHAPTERS[subjectId(subject)]?.[hit.split] || [])] : [];
}

/**
 * Every stored string whose questions belong to this live chapter: the name plus the aliases that may still be on
 * rows (until the migration renames them). For `.in('chapter', ...)` reads. [] for a name that does not resolve.
 */
export function storedNamesFor(subject, name) {
  const resolved = resolveChapter(subject, name);
  if (!resolved || resolved.retired) return [];
  const id = subjectId(subject);
  const aliases = Object.entries(CHAPTER_ALIASES[id] || {}).filter(([, target]) => target === resolved.name).map(([alias]) => alias);
  return [resolved.name, ...aliases];
}

// ---------------------------------------------------------------------------------------------------------------
// Options (sections)
// ---------------------------------------------------------------------------------------------------------------

/** The option a student gets when they have not chosen one (null for subjects without options). */
export function defaultOption(subject) {
  return SUBJECT_OPTIONS[subjectId(subject)]?.default || null;
}

/** A saved option checked against the subject's choices; anything else is null. */
export function normalizeOption(subject, option) {
  const choices = SUBJECT_OPTIONS[subjectId(subject)]?.choices || [];
  const value = String(option ?? '').trim().toUpperCase();
  return choices.some((choice) => choice.id === value) ? value : null;
}

/** Whether a chapter section is open to a student with this option: null, the common section, or the option. */
export function sectionAllowed(subject, section, option) {
  const chosen = normalizeOption(subject, option);
  if (!chosen || !section) return true;
  return section === COMMON_SECTIONS[subjectId(subject)] || section === chosen;
}

/** The NTA blueprint variant for a saved option (null when the subject has no such variant). */
export function variantForOption(subject, option) {
  const chosen = normalizeOption(subject, option);
  return (chosen && OPTION_VARIANTS[subjectId(subject)]?.[chosen]) || null;
}

/** Live chapters of a subject in syllabus order; with an option, only the sections that option sits. */
export function chaptersFor(subject, { option } = {}) {
  const id = subjectId(subject);
  return (BY_SUBJECT.get(id) || []).filter((chapter) => sectionAllowed(id, chapter.section, option));
}

/** [{ unit, unitOrder, section, chapters: [...] }] in syllabus order, option-filtered like chaptersFor. */
export function unitsFor(subject, { option } = {}) {
  const units = [];
  for (const chapter of chaptersFor(subject, { option })) {
    let entry = units[units.length - 1];
    if (!entry || entry.unit !== chapter.unit) {
      entry = { unit: chapter.unit, unitOrder: chapter.unitOrder, chapters: [] };
      units.push(entry);
    }
    entry.chapters.push(chapter);
  }
  for (const entry of units) {
    const sections = new Set(entry.chapters.map((chapter) => chapter.section));
    entry.section = sections.size === 1 ? [...sections][0] : null;
  }
  return units;
}

/** The at-most-one chip a chapter shows (syllabus-verified.md section 6). */
export function chapterChip(chapter) {
  if (chapter?.cuetOnly) return 'CUET only';
  if (chapter?.cbseClass11) return 'CBSE teaches this in Class 11';
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Serving
// ---------------------------------------------------------------------------------------------------------------

/**
 * Whether a question may reach a student: never when is_cuet_syllabus is false, never from a retired chapter, and,
 * when the student has an option saved for the subject, only from the sections that option sits. Unknown chapters and
 * subjects outside the 15 are left as they were.
 */
export function isServableQuestion(row, { subject, option } = {}) {
  if (!row) return false;
  if (row.is_cuet_syllabus === false || row.isCuetSyllabus === false) return false;
  const id = subjectId(row.subject || row.subjectId || subject);
  const hit = lookup(id, row.chapter);
  if (hit?.retired) return false;
  if (option && hit?.chapter && !sectionAllowed(id, hit.chapter.section, option)) return false;
  return true;
}

/** The rows isServableQuestion keeps, in order. */
export function filterServable(rows, opts = {}) {
  return (Array.isArray(rows) ? rows : []).filter((row) => isServableQuestion(row, opts));
}
