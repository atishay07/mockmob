// Today 1018 mock: the fixture. Illustrative data for one student (Asha, Commerce), chosen so every number agrees with
// every other number on the page. The real page reads these from the APIs named in TODAY-1018.md section 3.
// "Now" is Sunday 18 October 2026, 7:40 PM IST.
window.TODAY_FIXTURE = (() => {
  const subjects = { acc: 'Accountancy', eco: 'Economics', bst: 'Business Studies', eng: 'English' };

  // Papers, newest first (GET /api/attempts/summary). marks = right x 5 - wrong x 1.
  const papers = [
    { id: 'p9', subject: 'acc', mode: 'Full mock', right: 27, wrong: 11, blank: 12, max: 250, at: 'Sat 17 Oct, 9:12 PM', day: 'sat' },
    { id: 'p8', subject: 'eco', mode: 'Practice', right: 9, wrong: 4, blank: 2, max: 75, at: 'Thu 15 Oct, 6:20 PM', day: 'thu' },
    { id: 'p7', subject: 'acc', mode: 'Practice', right: 7, wrong: 3, blank: 0, max: 50, at: 'Mon 12 Oct, 7:05 PM', day: 'mon' },
  ];
  papers.forEach((p) => { p.marks = p.right * 5 - p.wrong; p.name = `${subjects[p.subject]} ${p.mode.toLowerCase()}`; });

  // The moves (src/lib/today/move.mjs buildMove + alternatives). `stake` is the record's own arithmetic: what these
  // questions cost when they were missed (+5 not gained, -1 taken), never a prediction of marks to gain.
  const moves = {
    repair: {
      id: 'repair', subject: 'acc', art: 'accountancy', kind: 'Repair',
      title: 'Repair your last paper', number: 4, label: 'mistakes to repair',
      stake: 24, stakeWord: 'marks they cost you',
      lengths: { 10: 3, 20: 6, 30: 9 }, minutes: 12, lengthUnit: (n) => `${n} mistakes`,
      why: 'Four of the 11 mistakes on Saturday’s Accountancy full mock are from Admission of a partner, your biggest leak. Repair finds the reason behind each one.',
      key: 'Start repair', price: 'Each repair uses 1 AI credit. You have 38.',
      choice: { title: 'Repair a mistake', value: '11 open from Saturday' },
    },
    revise: {
      id: 'revise', subject: null, art: null, kind: 'Revise',
      title: 'Revise what came back', number: 6, label: 'mistakes come back today',
      stake: 36, stakeWord: 'marks they cost you then',
      minutes: 8,
      why: 'Revise brings back what you got wrong after 1, 3, 7 and 21 days. These six are due today, so the fix holds.',
      key: 'Start Revise', price: 'Free. No credits.',
      choice: { title: 'Revise what is due', value: '6 due, about 8 min' },
    },
    practise: {
      id: 'practise', subject: 'acc', art: 'accountancy', kind: 'Practice',
      title: 'Practise your weakest chapter', number: 15, label: 'questions on Admission of a partner',
      stake: 45, stakeWord: 'marks open there, over 4 papers',
      lengths: { 10: 10, 20: 20, 30: 30 }, minutes: 15, lengthUnit: (n) => `${n} questions`,
      why: 'Admission of a partner has 45 marks open in your record: 9 of 21 questions missed. Marked +5 and −1, the CUET way.',
      key: 'Start practice', price: 'Uses 10 credits. You have 120.',
      choice: { title: 'Practise your weakest', value: 'Admission of a partner' },
    },
    dayOne: {
      id: 'dayOne', subject: 'acc', art: 'accountancy', kind: 'First move',
      title: 'Find your starting point', number: 10, label: 'questions to your starting point',
      stake: null, minutes: 10,
      why: 'Ten CUET-style Accountancy questions, marked +5 and −1. The result shows where your marks go, chapter by chapter.',
      key: 'Start', price: 'Free. Your first set uses no credits.',
      choice: { title: 'Your starting point', value: '10 Accountancy questions' },
    },
    fullMock: {
      id: 'fullMock', subject: 'acc', art: 'accountancy', kind: 'Full mock',
      title: 'A full mock instead', number: 50, label: 'questions in 60 minutes',
      stake: null, minutes: 60,
      why: 'Timed like the real paper, a fresh paper from the bank each time. It gives every chapter a mark at once.',
      key: 'Start full mock', price: 'Uses 50 credits. You have 120.',
      choice: { title: 'Full mock instead', value: '50 questions, 60 min' },
    },
    another: {
      id: 'another', subject: 'bst', art: 'business', kind: 'Another subject',
      title: 'Start with another subject', number: 10, label: 'Business Studies questions',
      stake: null, minutes: 10,
      why: 'Your starting point works on any subject you study. Business Studies, Economics and English are open.',
      key: 'Start', price: 'Free. Your first set uses no credits.',
      choice: { title: 'Another subject', value: 'Business Studies, Economics, English' },
    },
    warmUp: {
      id: 'warmUp', subject: 'acc', art: 'accountancy', kind: 'Warm up',
      title: 'Find your footing again', number: 10, label: 'questions to warm up',
      stake: null, minutes: 10, lengths: { 10: 10, 20: 20, 30: 30 }, lengthUnit: (n) => `${n} questions`,
      why: 'Your last session was 15 days ago. Ten Accountancy questions find your footing again, marked the CUET way.',
      key: 'Start', price: 'Uses 10 credits. You have 120.',
      choice: { title: 'Warm up', value: '10 questions, 10 min' },
    },
    reviseBack: {
      id: 'reviseBack', subject: null, art: null, kind: 'Revise',
      title: 'Revise what came back', number: 10, label: 'mistakes come back today',
      stake: 60, stakeWord: 'marks they cost you then', minutes: 12,
      why: 'While you were away, 14 wrong answers came due. Revise brings back 10 a day, oldest first, so none is lost.',
      key: 'Start Revise', price: 'Free. No credits.',
      choice: { title: 'Revise what is due', value: '10 of 14 due today' },
    },
    repairBack: {
      id: 'repairBack', subject: 'acc', art: 'accountancy', kind: 'Repair',
      title: 'Repair your last paper', number: 11, label: 'mistakes still open',
      stake: 66, stakeWord: 'marks they cost you', minutes: 25, lengths: { 10: 4, 20: 8, 30: 11 }, lengthUnit: (n) => `${n} mistakes`,
      why: 'Your last paper was the Accountancy full mock on Sat 3 Oct. All 11 of its mistakes are still open.',
      key: 'Start repair', price: 'Each repair uses 1 AI credit. You have 38.',
      choice: { title: 'Repair a mistake', value: '11 open from 3 Oct' },
    },
  };

  // This week (GET /api/me/rhythm studyDayDates + GET /api/me/goal weekdays; what was done comes from the papers and
  // the repair record of that day, both already read).
  const week = [
    { key: 'mon', name: 'Mon', date: 'Monday 12 Oct', planned: true, done: [{ what: 'Accountancy practice', detail: '10 questions, 32 of 50', at: '7:05 PM' }] },
    { key: 'tue', name: 'Tue', date: 'Tuesday 13 Oct', planned: false, done: [] },
    { key: 'wed', name: 'Wed', date: 'Wednesday 14 Oct', planned: true, done: [] },
    { key: 'thu', name: 'Thu', date: 'Thursday 15 Oct', planned: false, done: [{ what: 'Economics practice', detail: '15 questions, 41 of 75', at: '6:20 PM' }, { what: 'Revise', detail: '5 questions, 4 held', at: '9:48 PM' }] },
    { key: 'fri', name: 'Fri', date: 'Friday 16 Oct', planned: false, done: [] },
    { key: 'sat', name: 'Sat', date: 'Saturday 17 Oct', planned: true, done: [{ what: 'Accountancy full mock', detail: '50 questions, 124 of 250', at: '9:12 PM' }] },
    { key: 'sun', name: 'Sun', date: 'Today, Sunday 18 Oct', planned: true, today: true, done: [] },
  ];

  // Weak chapters (GET /api/prepos/insights chapters.ranked, top 3). open = (wrong + blank) x 5.
  const chapters = [
    { id: 'c1', chapter: 'Admission of a partner', subject: 'Accountancy', right: 12, wrong: 6, blank: 3, papers: 4,
      mistakes: [
        { q: 'Q14', paper: 'Accountancy full mock', at: 'Sat 17 Oct, 9:12 PM', stem: 'A and B share profits 3:2. C is admitted for 1/5th. Find the sacrificing ratio.', state: 'open', cost: 6 },
        { q: 'Q22', paper: 'Accountancy full mock', at: 'Sat 17 Oct, 9:12 PM', stem: 'Goodwill brought in cash by the new partner is credited to which account?', state: 'open', cost: 6 },
        { q: 'Q31', paper: 'Accountancy full mock', at: 'Sat 17 Oct, 9:12 PM', stem: 'Revaluation profit on admission is shared among which partners, and in what ratio?', state: 'open', cost: 6 },
      ] },
    { id: 'c2', chapter: 'Elasticity of demand', subject: 'Economics', right: 9, wrong: 5, blank: 1, papers: 3,
      mistakes: [
        { q: 'Q9', paper: 'Economics practice', at: 'Thu 15 Oct, 6:20 PM', stem: 'Price falls 10% and quantity demanded rises 20%. What is the price elasticity of demand?', state: 'open', cost: 6 },
        { q: 'Q3', paper: 'Economics practice', at: 'Thu 15 Oct, 6:20 PM', stem: 'A vertical demand curve shows demand of what kind?', state: 'repaired', cost: 6 },
      ] },
    { id: 'c3', chapter: 'Principles of management', subject: 'Business Studies', right: 10, wrong: 3, blank: 2, papers: 3,
      mistakes: [
        { q: 'Q11', paper: 'Business Studies practice', at: 'Fri 9 Oct, 8:30 PM', stem: '“Unity of direction” means one head and one plan for what?', state: 'open', cost: 6 },
      ] },
  ];
  chapters.forEach((c) => { c.n = c.right + c.wrong + c.blank; c.missed = c.wrong + c.blank; c.open = c.missed * 5; });

  return {
    subjects, papers, moves, week, chapters,
    name: 'Asha', dateLine: 'Sunday, 18 October', clock: '7:40 PM',
    goal: 4, studyDays: 3,
    road: { exam: '2027-05-01', expected: true, taken: 3, target: 14, targetSet: true, days: [0, 2, 5, 6] },
    repairs: { open: 11, toCheck: 2 },
    revise: { due: 6 },
    leak: { chapter: 'Admission of a partner', of: 23, here: 6, wrong: 4, blank: 2 },
    colleges: { first: 'Shri Ram College of Commerce', programme: 'B.Com (Hons)', cutoff: '903.5', more: 2, fit: 'Your subjects meet its DU subject rules.' },
  };
})();
