// Five original CUET-style questions per subject for the landing sample, written to the NCERT Class 12
// syllabus each paper follows. They are not previous-year questions and are not drawn from the practice bank.
// Loaded on demand (DemoDrill imports this file only when a subject is picked or the browser is idle), so the
// hero's first paint carries none of it. correct is the index into options; chapter is what the readout
// flags when the answer is missed. dealSet shuffles each question's options for every run (keep: true, or
// options that are all numbers, stay in their natural order), so the key is never one letter. sampleBank.test.mjs checks the shape and the copy rules.
//
// The first English, Accountancy (two), Economics and Business Studies questions are the original landing
// sample (src/lib/server/sampleImport.js lists them as q1 to q5 of 'landing-v1').
export const SAMPLE_BANK = Object.freeze({
  english: [
    { q: 'Choose the option nearest in meaning to CANDID:', options: ['Hidden', 'Frank', 'Careful', 'Sweet'], correct: 1,
      why: 'Candid means frank or honest. Frank is the closest synonym among these options.', chapter: 'Vocabulary: synonyms' },
    { q: 'Choose the option opposite in meaning to BENEVOLENT:', options: ['Generous', 'Malevolent', 'Gentle', 'Kind'], correct: 1,
      why: 'Benevolent means wishing others well. Malevolent means wishing them harm, so it is the antonym.', chapter: 'Vocabulary: antonyms' },
    { q: 'Neither the teacher nor the students ___ ready for the test.', options: ['is', 'was', 'were', 'has'], correct: 2,
      why: 'With neither ... nor, the verb agrees with the nearer subject. "Students" is plural, so the verb is "were".', chapter: 'Grammar: subject-verb agreement' },
    { q: 'Choose the correctly spelt word:', options: ['Acommodate', 'Accomodate', 'Accommodate', 'Acomodate'], correct: 2,
      why: 'Accommodate has a double c and a double m.', chapter: 'Spelling' },
    { q: 'To burn the midnight oil means to:', options: ['Waste money', 'Work late into the night', 'Start a quarrel', 'Cook a late dinner'], correct: 1,
      why: 'The idiom means staying up late to study or work.', chapter: 'Idioms and phrases' },
  ],
  accountancy: [
    { q: 'Assets are ₹80,000 and liabilities are ₹30,000. What is the owner’s equity?', options: ['₹30,000', '₹50,000', '₹80,000', '₹1,10,000'], correct: 1,
      why: 'Equity = assets − liabilities = ₹80,000 − ₹30,000 = ₹50,000.', chapter: 'Accounting equation' },
    { q: 'Goodwill brought in by an incoming partner is shared by old partners in:', options: ['New ratio', 'Old ratio', 'Sacrificing ratio', 'Equal ratio'], correct: 2,
      why: 'Old partners are compensated for their sacrifice, so it is split in the sacrificing ratio.', chapter: 'Partnership: admission of a partner' },
    { q: 'If there is no partnership deed, interest on partners’ capital is:', options: ['Allowed at 6% a year', 'Allowed at 12% a year', 'Not allowed', 'Allowed at the bank rate'], correct: 2,
      why: 'Without a deed, the Indian Partnership Act, 1932 allows no interest on capital. The 6% rule is for a partner’s loan to the firm.', chapter: 'Partnership: fundamentals' },
    { q: 'A and B share profits 3:2. C joins for a 1/5 share, taken from A and B in their old ratio. What is the new ratio?', options: ['3:2:1', '12:8:5', '9:6:5', '2:2:1'], correct: 1,
      why: 'The other 4/5 is shared 3:2, so A gets 12/25, B gets 8/25 and C gets 5/25: 12:8:5.', chapter: 'Partnership: new profit-sharing ratio' },
    { q: 'In a cash flow statement, buying new machinery is shown under:', options: ['Operating activities', 'Investing activities', 'Financing activities', 'Cash equivalents'], correct: 1,
      why: 'Buying or selling long-term assets is an investing activity.', chapter: 'Cash flow statement' },
  ],
  business_studies: [
    { q: 'Comparing actual performance with a planned standard is part of which management function?', options: ['Staffing', 'Controlling', 'Organising', 'Directing'], correct: 1,
      why: 'Controlling compares actual performance with standards so deviations can be identified and corrected.', chapter: 'Controlling' },
    { q: 'Unity of command is a principle of management given by:', options: ['F. W. Taylor', 'Henri Fayol', 'Peter Drucker', 'Elton Mayo'], correct: 1,
      why: 'Unity of command is one of Fayol’s 14 principles: each employee takes orders from one superior.', chapter: 'Principles of management' },
    { q: 'Which of these is NOT a feature of planning?', options: ['It is goal-oriented', 'It is pervasive', 'It is a one-time activity', 'It looks ahead'], correct: 2,
      why: 'Planning is continuous: plans are made, carried out and revised again and again.', chapter: 'Planning' },
    { q: 'In Maslow’s hierarchy, which need comes right after physiological needs?', options: ['Esteem needs', 'Safety needs', 'Belonging needs', 'Self-actualisation'], correct: 1,
      why: 'The order is physiological, safety, belonging, esteem and then self-actualisation.', chapter: 'Directing: motivation' },
    { q: 'Choosing the channels through which a product reaches buyers is part of which element of the marketing mix?', options: ['Product', 'Price', 'Place', 'Promotion'], correct: 2,
      why: 'Place, or physical distribution, covers channels of distribution and getting goods to buyers.', chapter: 'Marketing management' },
  ],
  economics: [
    { q: 'Which of these is NOT a function of the Reserve Bank of India?', options: ['Banker to the government', 'Issuing currency', 'Accepting public deposits', 'Controlling credit'], correct: 2,
      why: 'Commercial banks accept public deposits. The RBI does not.', chapter: 'Money and banking' },
    { q: 'If the marginal propensity to consume is 0.8, the investment multiplier is:', options: ['0.8', '1.25', '4', '5'], correct: 3,
      why: 'Multiplier = 1 / (1 − MPC) = 1 / 0.2 = 5.', chapter: 'Income determination' },
    { q: 'NNP at factor cost equals NDP at factor cost plus:', options: ['Depreciation', 'Net indirect taxes', 'Net factor income from abroad', 'Subsidies'], correct: 2,
      why: 'Moving from domestic to national product adds net factor income from abroad.', chapter: 'National income accounting' },
    { q: 'Export of services is recorded in the:', options: ['Capital account', 'Current account', 'Reserve account', 'Budget account'], correct: 1,
      why: 'Trade in goods and services is recorded in the current account of the balance of payments.', chapter: 'Balance of payments' },
    { q: 'India’s economic reforms of 1991 are known for:', options: ['Nationalising banks', 'Liberalisation, privatisation and globalisation', 'The Green Revolution', 'Starting the Five Year Plans'], correct: 1,
      why: 'The New Economic Policy of 1991 opened the economy through liberalisation, privatisation and globalisation.', chapter: 'Liberalisation, privatisation and globalisation' },
  ],
  general_test: [
    { q: 'What comes next: 2, 6, 12, 20, 30, ?', options: ['36', '40', '42', '44'], correct: 2,
      why: 'The gaps grow by 2 each time (4, 6, 8, 10), so the next gap is 12: 30 + 12 = 42.', chapter: 'Number series' },
    { q: 'If 20% of a number is 45, the number is:', options: ['90', '180', '225', '250'], correct: 2,
      why: '45 is one fifth of the number, so the number is 45 × 5 = 225.', chapter: 'Percentages' },
    { q: 'A 120 m long train passes a pole in 6 seconds. Its speed is:', options: ['20 km/h', '60 km/h', '72 km/h', '80 km/h'], correct: 2,
      why: '120 m in 6 s is 20 m/s, and 20 × 18/5 = 72 km/h.', chapter: 'Speed, time and distance' },
    { q: 'Find the odd one out:', options: ['Mercury', 'Venus', 'Moon', 'Mars'], correct: 2,
      why: 'The Moon is a natural satellite. The others are planets.', chapter: 'Classification' },
    { q: 'Which Article of the Indian Constitution abolishes untouchability?', options: ['Article 14', 'Article 17', 'Article 21', 'Article 32'], correct: 1,
      why: 'Article 17 abolishes untouchability and forbids its practice in any form.', chapter: 'General awareness: polity' },
  ],
  mathematics: [
    { q: 'A is a 3 × 3 matrix with |A| = 4. What is |2A|?', options: ['8', '16', '32', '64'], correct: 2,
      why: 'For an n × n matrix, |kA| = kⁿ|A|. Here 2³ × 4 = 32.', chapter: 'Determinants' },
    { q: 'The derivative of sin(x²) with respect to x is:', options: ['cos(x²)', '2x cos(x²)', '2 sin x cos x', '−2x cos(x²)'], correct: 1,
      why: 'By the chain rule, the derivative is cos(x²) × 2x.', chapter: 'Continuity and differentiability' },
    { q: 'The value of ∫ sin x dx from 0 to π/2 is:', options: ['0', '1', 'π/2', '−1'], correct: 1,
      why: '[−cos x] from 0 to π/2 is −cos(π/2) + cos 0 = 0 + 1 = 1.', chapter: 'Integrals' },
    { q: 'Two fair coins are tossed. The probability of at least one head is:', options: ['1/4', '1/2', '3/4', '1'], correct: 2,
      why: 'Only TT has no head, with probability 1/4, so the answer is 1 − 1/4 = 3/4.', chapter: 'Probability' },
    { q: 'The order of the differential equation y″ + (y′)³ + y = 0 is:', options: ['1', '2', '3', 'Not defined'], correct: 1, keep: true,
      why: 'The order is the highest derivative present, here the second derivative.', chapter: 'Differential equations' },
  ],
  physics: [
    { q: 'The SI unit of electric field is:', options: ['N/C', 'C/N', 'N m', 'J/C'], correct: 0,
      why: 'Electric field is force per unit charge, so its unit is newton per coulomb (equal to V/m).', chapter: 'Electric charges and fields' },
    { q: 'A wire is stretched to twice its length, its volume unchanged. Its resistance becomes:', options: ['R/2', '2R', '4R', 'R/4'], correct: 2,
      why: 'R = ρL/A. Doubling L halves A, so R grows by 2 × 2 = 4 times.', chapter: 'Current electricity' },
    { q: 'The power of a convex lens of focal length 50 cm is:', options: ['+0.5 D', '+2 D', '−2 D', '+50 D'], correct: 1,
      why: 'P = 1/f in metres = 1/0.5 = +2 dioptre. A convex lens has positive power.', chapter: 'Ray optics' },
    { q: 'The maximum kinetic energy of photoelectrons depends on the:', options: ['Intensity of light', 'Frequency of light', 'Time of exposure', 'Area of the plate'], correct: 1,
      why: 'By Einstein’s equation, K max = hν − φ, so it rises with frequency. Intensity changes only how many electrons leave.', chapter: 'Dual nature of radiation and matter' },
    { q: 'Which of these has the shortest wavelength?', options: ['Radio waves', 'Microwaves', 'X-rays', 'Gamma rays'], correct: 3,
      why: 'Gamma rays sit at the high-frequency end of the spectrum, so their wavelength is the shortest.', chapter: 'Electromagnetic waves' },
  ],
  chemistry: [
    { q: 'Molality is the number of moles of solute per:', options: ['Litre of solution', 'Kilogram of solvent', 'Kilogram of solution', 'Litre of solvent'], correct: 1,
      why: 'Molality (m) is moles of solute per kilogram of solvent, so it does not change with temperature.', chapter: 'Solutions' },
    { q: 'A rate constant with the unit s⁻¹ belongs to a reaction of order:', options: ['Zero', 'One', 'Two', 'Three'], correct: 1, keep: true,
      why: 'The unit of k is (mol L⁻¹)¹⁻ⁿ s⁻¹, which is s⁻¹ when n = 1.', chapter: 'Chemical kinetics' },
    { q: 'Which alcohol turns cloudy at once with the Lucas reagent?', options: ['Methanol', 'Ethanol', 'Propan-2-ol', '2-Methylpropan-2-ol'], correct: 3,
      why: 'Tertiary alcohols react at once with the Lucas reagent. 2-Methylpropan-2-ol is tertiary.', chapter: 'Alcohols, phenols and ethers' },
    { q: 'Which of these ions is colourless in solution?', options: ['Sc³⁺', 'Ti³⁺', 'V³⁺', 'Cu²⁺'], correct: 0,
      why: 'Sc³⁺ has no d electrons (3d⁰), so no d-d transition can absorb visible light.', chapter: 'd- and f-block elements' },
    { q: 'On long heating with HI, glucose gives:', options: ['n-Hexane', 'Gluconic acid', 'Sorbitol', 'Saccharic acid'], correct: 0,
      why: 'Forming n-hexane shows that glucose’s six carbons lie in one straight chain.', chapter: 'Biomolecules' },
  ],
  biology: [
    { q: 'In human females, fertilisation usually takes place in the:', options: ['Uterus', 'Ovary', 'Ampullary region of the fallopian tube', 'Cervix'], correct: 2,
      why: 'The ovum and sperm usually meet in the ampullary region of the fallopian tube.', chapter: 'Human reproduction' },
    { q: 'Which enzyme joins DNA fragments together?', options: ['DNA ligase', 'Restriction endonuclease', 'DNA polymerase', 'Helicase'], correct: 0,
      why: 'DNA ligase seals the sugar-phosphate backbone, joining the fragments. Restriction enzymes cut DNA.', chapter: 'Biotechnology: principles and processes' },
    { q: 'A 9:3:3:1 ratio in the F2 generation comes from a:', options: ['Monohybrid cross', 'Dihybrid cross', 'Test cross', 'Back cross'], correct: 1,
      why: 'Two genes assorting independently in a dihybrid cross give the 9:3:3:1 ratio.', chapter: 'Principles of inheritance and variation' },
    { q: 'Which sexually transmitted infection is caused by a bacterium?', options: ['Syphilis', 'Hepatitis B', 'Genital herpes', 'HIV infection'], correct: 0,
      why: 'Syphilis is caused by the bacterium Treponema pallidum. The others are caused by viruses.', chapter: 'Reproductive health' },
    { q: 'About how much energy passes from one trophic level to the next?', options: ['1%', '10%', '50%', '90%'], correct: 1,
      why: 'By Lindeman’s ten per cent law, only about 10% of the energy moves up each level.', chapter: 'Ecosystem' },
  ],
  computer_science: [
    { q: 'Which SQL clause filters the groups made by GROUP BY?', options: ['WHERE', 'HAVING', 'ORDER BY', 'LIKE'], correct: 1,
      why: 'WHERE filters rows before grouping. HAVING filters the groups after it.', chapter: 'Structured Query Language' },
    { q: 'What does print(len([1, [2, 3], 4])) display in Python?', options: ['2', '3', '4', 'An error'], correct: 1,
      why: 'The list has three items: 1, the inner list [2, 3] and 4.', chapter: 'Python: lists' },
    { q: 'A stack works on the principle of:', options: ['First in, first out', 'Last in, first out', 'Random access', 'Priority order'], correct: 1,
      why: 'Push and pop happen at the same end, the top, so the last item in is the first out.', chapter: 'Stack' },
    { q: 'Which device forwards data between different networks using IP addresses?', options: ['Hub', 'Switch', 'Router', 'Repeater'], correct: 2,
      why: 'A router reads the IP address and forwards packets from one network to another.', chapter: 'Computer networks' },
    { q: 'An attribute that uniquely identifies each row of a table is called a:', options: ['Foreign key', 'Primary key', 'Degree', 'Cardinality'], correct: 1,
      why: 'A primary key is unique for every row and cannot be empty.', chapter: 'Database concepts' },
  ],
  history: [
    { q: 'The Great Bath was found at:', options: ['Harappa', 'Mohenjodaro', 'Lothal', 'Kalibangan'], correct: 1,
      why: 'The Great Bath is in the citadel of Mohenjodaro.', chapter: 'Bricks, beads and bones' },
    { q: 'Who wrote the Ain-i Akbari?', options: ['Abul Fazl', 'Badauni', 'Babur', 'Faizi'], correct: 0,
      why: 'Abul Fazl wrote the Ain-i Akbari as part of the Akbar Nama.', chapter: 'Kings and chronicles' },
    { q: 'The revolt of 1857 began on 10 May at:', options: ['Delhi', 'Meerut', 'Lucknow', 'Kanpur'], correct: 1,
      why: 'Sepoys at the Meerut cantonment rose on 10 May 1857 and marched to Delhi.', chapter: 'Rebels and the Raj' },
    { q: 'The Dandi March of 1930 protested against the tax on:', options: ['Land', 'Salt', 'Cotton', 'Indigo'], correct: 1,
      why: 'Gandhiji marched to Dandi to break the salt law.', chapter: 'Mahatma Gandhi and the nationalist movement' },
    { q: 'Who chaired the Drafting Committee of the Constituent Assembly?', options: ['Rajendra Prasad', 'B. R. Ambedkar', 'Jawaharlal Nehru', 'Vallabhbhai Patel'], correct: 1,
      why: 'B. R. Ambedkar chaired the Drafting Committee. Rajendra Prasad was President of the Assembly.', chapter: 'Framing the Constitution' },
  ],
  political_science: [
    { q: 'The Panchsheel agreement of 1954 was signed between India and:', options: ['China', 'Pakistan', 'Nepal', 'The USSR'], correct: 0,
      why: 'Nehru and Zhou Enlai signed Panchsheel, the five principles of peaceful coexistence.', chapter: 'India’s external relations' },
    { q: 'The States Reorganisation Commission was set up in:', options: ['1947', '1953', '1962', '1971'], correct: 1,
      why: 'It was set up in 1953. Its report led to the States Reorganisation Act of 1956.', chapter: 'Challenges of nation building' },
    { q: 'The United Nations has its headquarters in:', options: ['Geneva', 'New York', 'Paris', 'The Hague'], correct: 1,
      why: 'The UN headquarters is in New York.', chapter: 'International organisations' },
    { q: 'Which of these was NOT a founding member of SAARC?', options: ['Afghanistan', 'Bhutan', 'Maldives', 'Sri Lanka'], correct: 0,
      why: 'SAARC began in 1985 with seven members. Afghanistan joined in 2007.', chapter: 'Contemporary South Asia' },
    { q: 'A national emergency was declared in India in June of:', options: ['1971', '1975', '1977', '1984'], correct: 1,
      why: 'The Emergency was declared on 25 June 1975 and lasted until 1977.', chapter: 'The crisis of democratic order' },
  ],
  geography: [
    { q: 'The Golden Quadrilateral links Delhi, Mumbai, Chennai and:', options: ['Kolkata', 'Bengaluru', 'Hyderabad', 'Ahmedabad'], correct: 0,
      why: 'The Golden Quadrilateral connects the four metro cities: Delhi, Mumbai, Chennai and Kolkata.', chapter: 'Transport and communication' },
    { q: 'Which of these is a kharif crop?', options: ['Rice', 'Wheat', 'Mustard', 'Barley'], correct: 0,
      why: 'Rice is sown with the monsoon and harvested in autumn. The others are rabi crops.', chapter: 'Agriculture' },
    { q: 'Population density is the number of people per:', options: ['Household', 'Unit of area', 'Village', 'Thousand women'], correct: 1,
      why: 'Density is population divided by area, usually given per square kilometre.', chapter: 'Population' },
    { q: 'The Suez Canal links the Mediterranean Sea with the:', options: ['Red Sea', 'Black Sea', 'Caspian Sea', 'Arabian Sea'], correct: 0,
      why: 'The Suez Canal joins the Mediterranean to the Red Sea, shortening the route from Europe to Asia.', chapter: 'Water transport' },
    { q: 'Which of these is a conventional source of energy?', options: ['Coal', 'Solar', 'Wind', 'Tidal'], correct: 0,
      why: 'Coal is a conventional fossil fuel. Solar, wind and tidal are non-conventional sources.', chapter: 'Mineral and energy resources' },
  ],
  psychology: [
    { q: 'Who proposed the theory of multiple intelligences?', options: ['Howard Gardner', 'Robert Sternberg', 'Alfred Binet', 'Charles Spearman'], correct: 0,
      why: 'Howard Gardner described several independent kinds of intelligence.', chapter: 'Variations in psychological attributes' },
    { q: 'Intelligence quotient (IQ) is calculated as:', options: ['CA ÷ MA × 100', 'MA ÷ CA × 100', 'MA × CA', '(MA − CA) × 100'], correct: 1,
      why: 'IQ is mental age divided by chronological age, times 100.', chapter: 'Intelligence' },
    { q: 'The General Adaptation Syndrome was proposed by:', options: ['Hans Selye', 'Sigmund Freud', 'Carl Rogers', 'Abraham Maslow'], correct: 0,
      why: 'Selye described the body’s response to stress in three stages: alarm, resistance and exhaustion.', chapter: 'Meeting life challenges' },
    { q: 'Putting your own unacceptable feelings onto someone else is called:', options: ['Repression', 'Projection', 'Denial', 'Rationalisation'], correct: 1,
      why: 'In projection, a person attributes their own feelings or traits to others.', chapter: 'Self and personality' },
    { q: 'Systematic desensitisation is a technique of:', options: ['Psychoanalysis', 'Behaviour therapy', 'Humanistic therapy', 'Group therapy'], correct: 1,
      why: 'Introduced by Wolpe, it pairs relaxation with steps of a feared situation, a behaviour therapy method.', chapter: 'Therapeutic approaches' },
  ],
  sociology: [
    { q: 'Who coined the term Sanskritisation?', options: ['M. N. Srinivas', 'G. S. Ghurye', 'B. R. Ambedkar', 'André Béteille'], correct: 0,
      why: 'M. N. Srinivas used the term for groups taking up the customs of higher castes.', chapter: 'Cultural change' },
    { q: 'Demography is the study of:', options: ['Population', 'Democracy', 'Folk culture', 'Markets'], correct: 0,
      why: 'Demography studies population: its size, growth, births, deaths and migration.', chapter: 'The demographic structure of Indian society' },
    { q: 'A family of parents and their unmarried children is a:', options: ['Joint family', 'Nuclear family', 'Extended family', 'Matrilineal family'], correct: 1,
      why: 'A nuclear family has one couple and their unmarried children.', chapter: 'Family and kinship' },
    { q: 'Which of these is a social movement?', options: ['The Chipko movement', 'A cricket league', 'A general election', 'The census'], correct: 0,
      why: 'Chipko was a sustained, collective effort to protect forests, which makes it a social movement.', chapter: 'Social movements' },
    { q: 'The 73rd Amendment to the Constitution deals with:', options: ['Panchayati Raj', 'The right to education', 'GST', 'Anti-defection'], correct: 0,
      why: 'The 73rd Amendment (1992) gave Panchayati Raj institutions constitutional status.', chapter: 'Panchayati Raj' },
  ],
});

// Options that read as an ordered scale (numbers, amounts, years) keep their order when dealt.
const ORDERED = /^[\d₹+−(.-]/;

/** The subject's five questions with each one's options shuffled (unless ordered), and the key moved to match. */
export function dealSet(id, random = Math.random) {
  const set = SAMPLE_BANK[id];
  if (!set) return [];
  return set.map((item) => {
    if (item.keep || item.options.every((option) => ORDERED.test(option))) return item;
    const order = item.options.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return { ...item, options: order.map((k) => item.options[k]), correct: order.indexOf(item.correct) };
  });
}
