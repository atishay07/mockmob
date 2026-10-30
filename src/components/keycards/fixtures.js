// Key cards fixtures, matching KEYCARDS-BUILD-SPEC.md section 2e exactly, so the screens are built and checked before the
// server lands (web/1031-kc-server builds the real routes in parallel). Development and tests only: the preview harness
// (/preview/arena?view=cards|deck) answers the Key cards routes from here; production never imports this file.
//
// The card text is NCERT's own wording from the Class 12 books on disk (Reprint 2026-27), copied for the preview; page numbers
// are the printed pages. `asked` is 0 unless a past-paper match is certain, so the fixture leaves most at 0.
//
// fixtureKeycards(url, method, body, opts) answers one request: { status, body } or null when the path is not a Key cards
// route. opts: { isPro, variant } where variant is one of
//   ready (default)  the design student: four subjects, Business Studies rich, Accountancy with its Part picker
//   off              KEY_CARDS_ENABLED is off: every route says 404 KEY_CARDS_OFF
//   empty            the chapter deck has no cards yet
//   sparse           one subject, two chapters, nothing added
//   limit            Free has used today's 10 reviews: POST review answers 402
//   line-none        "The line you needed" finds nothing (the block hides)

const BS = 'business_studies';
const CH1 = `${BS}.nature-and-significance-of-management`;
const CH1_TITLE = 'Nature and Significance of Management';
const BOOK1 = 'Business Studies Part 1';
const src = (page, section) => ({ kind: 'ncert', book: BOOK1, code: 'lebs101', chapterNo: 1, page, section });

let order = 0;
function card(slug, kind, front, quote, { back = quote, blanks = [], page, section, importance = 'must', asked = 0, note = null, tags = [] }) {
  order += 10;
  return {
    id: `kc.${BS}.nature-and-significance-of-management.${slug}`, v: 1, subject: BS, chapterKey: CH1, chapter: CH1_TITLE, unit: CH1_TITLE,
    kind, front, back, quote, blanks, source: src(page, section), importance, asked, tags, order, ...(note ? { note } : {}),
  };
}

const BS_CH1 = [
  card('def-management-koontz', 'definition', 'Define management (Harold Koontz and Heinz Weihrich).',
    'Management is the process of designing and maintaining an environment in which individuals, working together in groups, efficiently accomplish selected aims.',
    { page: 3, section: 'Concept of Management', asked: 1, note: 'Management means setting up the conditions in which a group gets its aims done well.' }),
  card('term-effectiveness', 'term', '____ in management is concerned with doing the right task, completing activities and achieving goals.',
    'Effectiveness in management is concerned with doing the right task, completing activities and achieving goals.',
    { blanks: ['Effectiveness'], page: 4, section: 'Effectiveness', note: 'Effectiveness is about the end result: was the job done?' }),
  card('term-efficiency', 'term', '____ means doing the task correctly and with minimum cost.',
    'Efficiency means doing the task correctly and with minimum cost.',
    { blanks: ['Efficiency'], page: 4, section: 'Efficiency', note: 'Efficiency is about cost: the same output from fewer inputs.' }),
  card('key-poor-management', 'key_line', 'Poor management is due to both ____ and ____.',
    'Poor management is due to both inefficiency and ineffectiveness.',
    { blanks: ['inefficiency', 'ineffectiveness'], page: 5, section: 'Effectiveness versus Efficiency', importance: 'good' }),
  card('list-characteristics', 'list', 'Name the seven characteristics of management.',
    'Management is a goal-oriented process\nManagement is all pervasive\nManagement is multidimensional\nManagement is a continuous process\nManagement is a group activity\nManagement is a dynamic function\nManagement is an intangible force',
    { page: 6, section: 'Characteristics of Management', asked: 2 }),
  card('key-all-pervasive', 'key_line', 'Management is all ____: The activities involved in managing an enterprise are common to all organisations whether economic, social or political.',
    'Management is all pervasive: The activities involved in managing an enterprise are common to all organisations whether economic, social or political.',
    { blanks: ['pervasive'], page: 6, section: 'Characteristics of Management', note: 'A petrol pump, a hospital and a school all need managing.' }),
  card('list-dimensions', 'list', 'Name the three dimensions of management.',
    '(a) Management of work\n(b) Management of people\n(c) Management of operations',
    { page: 7, section: 'Management is multidimensional' }),
  card('key-continuous-process', 'key_line', 'The process of management is a series of ____, composite, but separate functions (planning, organising, directing, staffing and controlling).',
    'The process of management is a series of continuous, composite, but separate functions (planning, organising, directing, staffing and controlling).',
    { blanks: ['continuous'], page: 8, section: 'Management is a continuous process', importance: 'good' }),
  card('key-dynamic-function', 'key_line', 'Management is a ____ function and has to adapt itself to the changing environment.',
    'Management is a dynamic function and has to adapt itself to the changing environment.',
    { blanks: ['dynamic'], page: 9, section: 'Management is a dynamic function', importance: 'good', note: 'NCERT example: McDonalds changed its menu to survive in the Indian market.' }),
  card('key-intangible-force', 'key_line', 'Management is an ____ force that cannot be seen but its presence can be felt in the way the organisation functions.',
    'Management is an intangible force that cannot be seen but its presence can be felt in the way the organisation functions.',
    { blanks: ['intangible'], page: 9, section: 'Management is an intangible force' }),
  card('types-objectives', 'types', 'Types of objectives that management fulfils.',
    'Management fulfills three basic objectives: organisational, social and personal.',
    { page: 26, section: 'Summary' }),
  card('list-economic-objectives', 'list', 'Name the three economic objectives of a business.',
    'These are survival, profit and growth.',
    { back: 'These are survival, profit and growth.', page: 9, section: 'Organisational Objectives', asked: 1 }),
  card('list-importance', 'list', 'Why is management important? Name the five reasons.',
    'Management is important because it helps in achieving group goals, increases efficiency, creates a dynamic organisation, helps achieve personal objectives and contributes to the development of society.',
    { page: 27, section: 'Summary' }),
  card('key-art-and-science', 'key_line', 'Management as an art and a science are therefore not mutually ____, but complement each other.',
    'Management as an art and a science are therefore not mutually exclusive, but complement each other.',
    { blanks: ['exclusive'], page: 15, section: 'Management as both Science and Art', importance: 'good' }),
  card('key-profession', 'key_line', 'Although it does not satisfy all the requirements of a profession, it is to a large extent ____ in character.',
    'Although it does not satisfy all the requirements of a profession, it is to a large extent professional in character.',
    { blanks: ['professional'], page: 27, section: 'Summary', importance: 'good' }),
  card('types-levels', 'types', 'Levels of management, and what each one does.',
    'The top management focuses on determination of objectives and policies, middle management attempts to achieve these objectives through the effort of other managers and supervisory or operational management directly oversees the efforts of the workforce.',
    { page: 27, section: 'Summary', asked: 1, note: 'Three tiers: top sets the aims, middle gets them done through managers, supervisory oversees the workforce.' }),
  card('fact-top-management-task', 'fact', 'What is the basic task of top management?',
    'Their basic task is to integrate diverse elements and coordinate the activities of different departments according to the overall objectives of the organisation.',
    { page: 17, section: 'Top Management', importance: 'good' }),
  card('key-middle-management', 'key_line', 'Middle management is responsible for ____ and controlling plans and strategies developed by top management.',
    'Middle management is responsible for implementing and controlling plans and strategies developed by top management.',
    { blanks: ['implementing'], page: 18, section: 'Middle Management' }),
  card('def-planning', 'definition', 'What is planning?',
    'Planning is the function of determining in advance what is to be done and who is to do it.',
    { page: 20, section: 'Functions of Management', asked: 1 }),
  card('def-organising', 'definition', 'What is organising?',
    'Organising is the management function of assigning duties, grouping tasks, establishing authority and allocating resources required to carry out a specific plan.',
    { page: 20, section: 'Functions of Management' }),
  card('def-staffing', 'definition', 'What is staffing, simply stated?',
    'Staffing simply stated, is finding the right people for the right job.',
    { page: 20, section: 'Functions of Management' }),
  card('term-coordination-binds', 'term', '____ is the force that binds all the other functions of management.',
    'Coordination is the force that binds all the other functions of management.',
    { blanks: ['Coordination'], page: 21, section: 'Coordination: The Essence of Management', asked: 3 }),
  card('key-coordination-continuous', 'key_line', 'Coordination is not a one-time function but a ____ process.',
    'Coordination is not a one-time function but a continuous process.',
    { blanks: ['continuous'], page: 22, section: 'Characteristics of Coordination' }),
  card('key-garland', 'key_line', 'Like a thread in a ____, coordination is a part of all management functions.',
    'Like a thread in a garland, coordination is a part of all management functions.',
    { blanks: ['garland'], page: 23, section: 'Characteristics of Coordination', importance: 'good' }),
  card('key-cooperation', 'key_line', 'Cooperation in the absence of coordination may lead to ____ effort and coordination without cooperation may lead to dissatisfaction among employees.',
    'Cooperation in the absence of coordination may lead to wasted effort and coordination without cooperation may lead to dissatisfaction among employees.',
    { blanks: ['wasted'], page: 23, section: 'Characteristics of Coordination', importance: 'good' }),
  card('def-coordination-summary', 'definition', 'What is coordination?',
    'It is the process of achieving unity of action among interdependent activities and departments of an organisation.',
    { page: 27, section: 'Summary', asked: 1 }),
];

// Accountancy, Analysis of Financial Statements, chapter 5 (Accounting Ratios): a short deck with a formula card.
const AC = 'accountancy';
const AC_CH = `${AC}.accounting-ratios`;
const acSrc = (page, section) => ({ kind: 'ncert', book: 'Accountancy Part 2', code: 'leac205', chapterNo: 5, page, section });
const ac = (slug, kind, front, quote, extra) => ({
  id: `kc.${AC}.accounting-ratios.${slug}`, v: 1, subject: AC, chapterKey: AC_CH, chapter: 'Accounting Ratios', unit: 'Analysis of Financial Statements',
  kind, front, back: extra.back || quote, quote, blanks: extra.blanks || [], source: acSrc(extra.page, extra.section), importance: extra.importance || 'must', asked: extra.asked || 0, tags: [], order: extra.order,
  ...(extra.note ? { note: extra.note } : {}),
});
const AC_RATIOS = [
  ac('types-functional', 'types', 'Types of ratios in the functional classification.', 'Liquidity Ratios\nSolvency Ratios\nActivity (or Turnover) Ratios\nProfitability Ratios', { page: 199, section: 'Types of Ratios', order: 10, asked: 1 }),
  ac('def-current-ratio', 'definition', 'What is current ratio?', 'Current ratio is the proportion of current assets to current liabilities.', { page: 200, section: 'Current Ratio', order: 20 }),
  ac('formula-current-ratio', 'formula', 'Formula: current ratio.', 'Current Ratio = Current Assets : Current Liabilities', { page: 200, section: 'Current Ratio', order: 30, asked: 2, note: 'Read it as current assets divided by current liabilities.' }),
  ac('formula-quick-ratio', 'formula', 'Formula: quick ratio.', 'Quick ratio = Quick Assets : Current Liabilities', { page: 201, section: 'Quick or Liquid Ratio', order: 40, asked: 1 }),
  ac('def-quick-assets', 'definition', 'What are quick assets?', 'The quick assets are defined as those assets which are quickly convertible into cash.', { page: 201, section: 'Quick or Liquid Ratio', order: 50, note: 'Leave out inventories and prepaid items: they are not quickly cash.' }),
  ac('term-liquidity', 'term', 'The ability of the business to pay the amount due to stakeholders as and when it is due is known as ____.', 'The ability of the business to pay the amount due to stakeholders as and when it is due is known as liquidity.', { blanks: ['liquidity'], page: 199, section: 'Types of Ratios', order: 15, importance: 'good' }),
];

// Accountancy Part 1, chapter 2 (Admission of a Partner): the two cards "The line you needed" shows under the preview paper's
// partnership questions.
const AD_CH = `${AC}.reconstitution-of-a-partnership-firm-admission-of-a-partner`;
const ad = (slug, kind, front, quote, extra) => ({
  id: `kc.${AC}.reconstitution-of-a-partnership-firm-admission-of-a-partner.${slug}`, v: 1, subject: AC, chapterKey: AD_CH, chapter: 'Reconstitution of a Partnership Firm: Admission of a Partner', unit: 'Accounting for Partnership Firms',
  kind, front, back: extra.back || quote, quote, blanks: extra.blanks || [], source: { kind: 'ncert', book: 'Accountancy Part 1', code: 'leac102', chapterNo: 2, page: extra.page, section: 'Sacrificing Ratio' }, importance: 'must', asked: extra.asked || 0, tags: [], order: extra.order,
});
const AC_ADMISSION = [
  ad('def-sacrificing-ratio', 'definition', 'What is sacrificing ratio?', 'The ratio in which the old partners agree to sacrifice their share of profit in favour of the incoming partner is called sacrificing ratio.', { page: 54, order: 10, asked: 2 }),
  ad('formula-sacrifice', 'formula', 'Formula: the sacrifice by a partner.', 'Old Share of Profit – New Share of Profit', { page: 54, order: 20 }),
];

export const FIXTURE_DECKS = Object.freeze({ [CH1]: BS_CH1, [AC_CH]: AC_RATIOS, [AD_CH]: AC_ADMISSION });

const KEYCARD_FREE = { tastePerChapter: 5, reviewsPerDay: 10, newPerDay: 5, lineNeededPerDay: 3 };

/** deckView as data/keycards.js defines it: Free gets the first 5 of each chapter (Must-know first among ties) whole, the rest as stubs. */
export function fixtureDeckView(cards, isPro) {
  const sorted = [...cards].sort((a, b) => a.order - b.order);
  if (isPro) return sorted;
  const taste = new Set([...sorted].sort((a, b) => (a.order - b.order) || ((a.importance === 'must' ? 0 : 1) - (b.importance === 'must' ? 0 : 1))).slice(0, KEYCARD_FREE.tastePerChapter).map((c) => c.id));
  return sorted.map((c) => (taste.has(c.id) ? c : { id: c.id, kind: c.kind, label: KIND_LABEL[c.kind] || 'Card', locked: true }));
}
const KIND_LABEL = { definition: 'Definition', term: 'Term', key_line: 'Key line', list: 'List', types: 'Types', fact: 'Fact', formula: 'Formula' };

// ---------------------------------------------------------------- GET /api/keycards

const st = (state, fading = false) => ({ state, label: { none: 'Not started', thin: 'Too few answers', weak: 'Needs work', mid: 'Getting there', strong: 'Holding' }[state], fading });
const ch = (subject, slug, title, book, chapter, extra = {}) => ({
  key: `${subject}.${slug}`, title, ncert: { book, chapter }, chip: null, cards: 0, mustKnow: 0, unlocked: 0, added: 0, due: 0, state: st('none'), ...extra,
});

function homeSubjects(isPro) {
  const open = (n) => (isPro ? n : Math.min(5, n));
  const BS1 = 'Business Studies Part 1';
  const BS2 = 'Business Studies Part 2';
  const ch1Must = BS_CH1.filter((c) => c.importance === 'must').length;
  return [
    {
      subject: BS, title: 'Business Studies', option: null,
      units: [
        { unit: 'Nature and Significance of Management', chapters: [ch(BS, 'nature-and-significance-of-management', CH1_TITLE, BS1, 1, { cards: BS_CH1.length, mustKnow: ch1Must, unlocked: open(BS_CH1.length), added: isPro ? ch1Must : 5, due: isPro ? 6 : 3, state: st('mid') })] },
        { unit: 'Principles of Management', chapters: [ch(BS, 'principles-of-management', 'Principles of Management', BS1, 2, { cards: 38, mustKnow: 23, unlocked: open(38), added: isPro ? 23 : 5, due: isPro ? 4 : 2, state: st('weak') })] },
        { unit: 'Business Environment', chapters: [ch(BS, 'business-environment', 'Business Environment', BS1, 3, { cards: 24, mustKnow: 15, unlocked: open(24), added: isPro ? 15 : 0, due: isPro ? 2 : 0, state: st('strong', true) })] },
        { unit: 'Planning', chapters: [ch(BS, 'planning', 'Planning', BS1, 4, { cards: 29, mustKnow: 18, unlocked: open(29), state: st('thin') })] },
        { unit: 'Organising', chapters: [ch(BS, 'organising', 'Organising', BS1, 5, { cards: 41, mustKnow: 25, unlocked: open(41), state: st('none') })] },
        { unit: 'Staffing', chapters: [ch(BS, 'staffing', 'Staffing', BS1, 6, { cards: 33, mustKnow: 20, unlocked: open(33), added: isPro ? 20 : 0, due: isPro ? 2 : 0, state: st('strong') })] },
        { unit: 'Directing', chapters: [ch(BS, 'directing', 'Directing', BS1, 7, { cards: 44, mustKnow: 27, unlocked: open(44), state: st('none') })] },
        { unit: 'Controlling', chapters: [ch(BS, 'controlling', 'Controlling', BS1, 8, { cards: 21, mustKnow: 13, unlocked: open(21), state: st('thin') })] },
        { unit: 'Financial Management', chapters: [ch(BS, 'financial-management', 'Financial Management', BS2, 9, { cards: 0, state: st('mid') })] },
        { unit: 'Financial Markets', chapters: [ch(BS, 'financial-markets', 'Financial Markets', BS2, 10, { chip: 'CUET only', cards: 31, mustKnow: 19, unlocked: open(31), state: st('none') })] },
        { unit: 'Marketing Management', chapters: [ch(BS, 'marketing', 'Marketing', BS2, 11, { cards: 36, mustKnow: 22, unlocked: open(36), state: st('none') })] },
        { unit: 'Consumer Protection', chapters: [ch(BS, 'consumer-protection', 'Consumer Protection', BS2, 12, { cards: 18, mustKnow: 11, unlocked: open(18), state: st('none') })] },
      ],
    },
    {
      subject: AC, title: 'Accountancy', option: 'AFS',
      options: { label: 'Part', choices: [{ id: 'AFS', label: 'Analysis of Financial Statements' }, { id: 'CAS', label: 'Computerised Accounting' }], default: 'AFS' },
      units: [
        { unit: 'Accounting for Partnership Firms', chapters: [
          ch(AC, 'accounting-for-partnership-firms-fundamentals', 'Accounting for Partnership Firms: Fundamentals', 'Accountancy Part 1', 1, { cards: 0, state: st('weak') }),
          ch(AC, 'reconstitution-of-a-partnership-firm-admission-of-a-partner', 'Reconstitution of a Partnership Firm: Admission of a Partner', 'Accountancy Part 1', 2, { cards: AC_ADMISSION.length, mustKnow: 2, unlocked: AC_ADMISSION.length, added: 0, due: 0, state: st('weak') }),
        ] },
        { unit: 'Analysis of Financial Statements', chapters: [
          ch(AC, 'financial-statements-of-a-company', 'Financial Statements of a Company', 'Accountancy Part 2', 3, { cards: 0 }),
          ch(AC, 'accounting-ratios', 'Accounting Ratios', 'Accountancy Part 2', 5, { cards: AC_RATIOS.length, mustKnow: 5, unlocked: open(AC_RATIOS.length), added: isPro ? 5 : 0, due: isPro ? 2 : 0, state: st('thin') }),
          ch(AC, 'cash-flow-statement', 'Cash Flow Statement', 'Accountancy Part 2', 6, { cards: 0, state: st('none') }),
        ] },
      ],
    },
    {
      subject: 'economics', title: 'Economics', option: null,
      units: [
        { unit: 'Introduction to Microeconomics', chapters: [ch('economics', 'introduction', 'Introduction', 'Introductory Microeconomics', 1, { chip: 'CBSE teaches this in Class 11', cards: 0 })] },
        { unit: 'National Income and Related Aggregates', chapters: [ch('economics', 'national-income-accounting', 'National Income Accounting', 'Introductory Macroeconomics', 2, { cards: 0, state: st('weak') })] },
      ],
    },
  ];
}

export function fixtureHome({ isPro = false, variant = 'ready' } = {}) {
  let subjects = homeSubjects(isPro);
  if (variant === 'sparse') subjects = [{ ...subjects[0], units: subjects[0].units.slice(0, 2).map((u) => ({ ...u, chapters: u.chapters.map((c) => ({ ...c, added: 0, due: 0, state: st('none') })) })) }];
  const due = variant === 'sparse' ? 0 : isPro ? 14 : 5;
  return {
    enabled: true, isPro, subjects,
    today: { due, newLeft: isPro ? 15 : 5, reviewsLeft: isPro ? null : 10, minutes: Math.ceil(due * 0.25) },
  };
}

// ---------------------------------------------------------------- the deck, due, line

function chapterOf(key) {
  for (const s of homeSubjects(true)) for (const u of s.units) for (const c of u.chapters) if (c.key === key) return { key: c.key, title: c.title, unit: u.unit, ncert: c.ncert, chip: c.chip, subject: s.subject, subjectTitle: s.title };
  return null;
}

export function fixtureDeck(key, { isPro = false, variant = 'ready', added = null } = {}) {
  const chapter = chapterOf(key);
  if (!chapter) return null;
  const all = variant === 'empty' ? [] : FIXTURE_DECKS[key] || [];
  const cards = fixtureDeckView(all, isPro);
  const mustIds = all.filter((c) => c.importance === 'must').map((c) => c.id);
  const addedIds = added || (variant === 'sparse' ? [] : isPro ? mustIds : cards.filter((c) => !c.locked).map((c) => c.id));
  const { subject: _s, subjectTitle: _t, ...head } = chapter;
  return { chapter: head, cards, counts: { total: all.length, mustKnow: mustIds.length, locked: cards.filter((c) => c.locked).length }, added: addedIds.filter((id) => all.some((c) => c.id === id)) };
}

const withState = (c, i) => ({ ...c, state: { reps: i % 3 + 1, lapses: i % 4 === 0 ? 1 : 0, due: '2026-10-31T03:30:00.000Z' } });

export function fixtureDue({ isPro = false, limit = 20 } = {}) {
  const pool = [BS_CH1[0], BS_CH1[4], BS_CH1[21], BS_CH1[18], AC_RATIOS[2], BS_CH1[1]];
  const cards = pool.slice(0, isPro ? limit : Math.min(limit, 5)).map(withState);
  return { cards, today: fixtureHome({ isPro }).today };
}

/** The Revise queue's Key card items, as composeQueue adds them (a third source after the questions and the study cards). */
export function fixtureReviseKeycards({ isPro = false } = {}) {
  return fixtureDue({ isPro, limit: 3 }).cards.slice(0, 3).map((c) => ({ kind: 'keycard', cardId: c.id, subject: c.subject, chapter: c.chapter, card: c }));
}

export function fixtureLine(questionId, { isPro = false, variant = 'ready' } = {}) {
  if (variant === 'line-none' || /none/.test(String(questionId))) return { cards: [], source: 'none', ...(isPro ? {} : { left: 3 }) };
  // Odd and even questions show the two sources the block can carry.
  const n = [...String(questionId)].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const linked = n % 2 === 0;
  return { cards: linked ? [AC_ADMISSION[0]] : [AC_ADMISSION[0], AC_ADMISSION[1]], source: linked ? 'linked' : 'matched', ...(isPro ? {} : { left: 2 }) };
}

export function fixtureChapters(subject, { isPro = false } = {}) {
  const s = homeSubjects(isPro).find((x) => x.subject === subject);
  if (!s) return { subject, option: null, units: [] };
  return {
    subject, option: s.option,
    units: s.units.map((u) => ({
      unit: u.unit,
      chapters: u.chapters.map((c) => ({
        key: c.key, title: c.title, state: c.state.state, label: c.state.label, fading: c.state.fading, marksLost: c.key === CH1 ? 12 : 0, available: { questions: 140, cards: c.cards },
        ...(isPro && c.key === CH1 ? { n: 12, right: 7, reason: 'Got 7 of 12 right on the latest try at each question. Cards: 14 of 20 holding.', memory: { holding: 14, added: 20, mustKnow: 17 } } : {}),
      })),
    })),
  };
}

// ---------------------------------------------------------------- the router the preview uses

const OFF = { status: 404, body: { error: 'KEY_CARDS_OFF' } };

/**
 * One Key cards request answered from the fixtures, or null when `url` is not a Key cards route. `memory` is the tab's own
 * state ({ added: Map, reviews: n, reported: Set, options: {} }) so adding and rating behave within a preview visit.
 */
export function fixtureKeycards(url, method, body, { isPro = false, variant = 'ready', memory = {} } = {}) {
  const path = url.pathname;
  const isRoute = path.startsWith('/api/keycards') || path === '/api/me/chapters' || path === '/api/me/subject-options';
  if (!isRoute) return null;
  if (variant === 'off') return OFF;
  if (variant === 'error' && method === 'GET') return { status: 503, body: { error: 'unavailable' } };
  const added = (memory.added ||= new Map());
  if (path === '/api/keycards' && method === 'GET') {
    const home = fixtureHome({ isPro, variant });
    for (const s of home.subjects) {
      if (memory.options?.[s.subject]) s.option = memory.options[s.subject];
      for (const u of s.units) for (const c of u.chapters) if (added.has(c.key)) c.added = Math.max(c.added, added.get(c.key).length);
    }
    return { status: 200, body: home };
  }
  if (path === '/api/keycards/deck' && method === 'GET') {
    const key = url.searchParams.get('chapter');
    const extra = added.get(key);
    const deck = fixtureDeck(key, { isPro, variant, added: extra ? [...new Set([...(fixtureDeck(key, { isPro, variant })?.added || []), ...extra])] : null });
    return deck ? { status: 200, body: deck } : { status: 404, body: { error: 'NOT_FOUND' } };
  }
  if (path === '/api/keycards/add' && method === 'POST') {
    const today = fixtureHome({ isPro }).today;
    if (body?.chapter) {
      const all = FIXTURE_DECKS[body.chapter] || [];
      const ids = all.filter((c) => (isPro ? c.importance === 'must' : !fixtureDeckView(all, false).find((x) => x.id === c.id)?.locked)).map((c) => c.id);
      added.set(body.chapter, ids);
      return { status: 200, body: { added: ids.length, today } };
    }
    const ids = Array.isArray(body?.cardIds) ? body.cardIds : [];
    for (const id of ids) {
      const key = id.split('.').slice(1, 3).join('.');
      added.set(key, [...new Set([...(added.get(key) || []), id])]);
    }
    return { status: 200, body: { added: ids.length, today } };
  }
  if (path === '/api/keycards/due' && method === 'GET') return { status: 200, body: fixtureDue({ isPro, limit: Number(url.searchParams.get('limit')) || 20 }) };
  if (path === '/api/keycards/review' && method === 'POST') {
    memory.reviews = (memory.reviews || 0) + 1;
    if (!isPro && (variant === 'limit' || memory.reviews > KEYCARD_FREE.reviewsPerDay)) return { status: 402, body: { error: 'PRO_REQUIRED', reason: 'keycard_reviews' } };
    const days = body?.rating === 1 ? 0.01 : body?.rating === 4 ? 9 : 3;
    const today = fixtureHome({ isPro }).today;
    return { status: 200, body: { ok: true, next: { due_at: new Date(Date.now() + days * 86_400_000).toISOString(), interval_days: days }, today: { ...today, reviewsLeft: isPro ? null : Math.max(0, KEYCARD_FREE.reviewsPerDay - memory.reviews) } } };
  }
  if (path === '/api/keycards/line' && method === 'GET') return { status: 200, body: fixtureLine(url.searchParams.get('questionId'), { isPro, variant }) };
  if (path === '/api/keycards/report' && method === 'POST') {
    (memory.reported ||= new Set()).add(body?.cardId);
    return { status: 200, body: { ok: true } };
  }
  if (path === '/api/me/chapters' && method === 'GET') return { status: 200, body: fixtureChapters(url.searchParams.get('subject'), { isPro }) };
  if (path === '/api/me/subject-options' && method === 'PUT') {
    (memory.options ||= {})[body?.subject] = body?.option;
    return { status: 200, body: { subject: body?.subject, option: body?.option } };
  }
  return { status: 405, body: { error: 'METHOD_NOT_ALLOWED' } };
}
