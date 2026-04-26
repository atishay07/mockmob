const REQUIRED_SUBJECTS = 5;
const REQUIRED_MOCKS_PER_SUBJECT = 5;
const MAX_SUBJECT_SCORE = 200;
const MAX_CUET_SCORE = 1000;

const CATEGORY_ADJUSTMENTS = {
  general: 0,
  ews: -18,
  obc: -35,
  sc: -70,
  st: -90,
  pwd: -120,
};

const SCORE_BANDS = [
  { id: 'high', label: 'High chance', range: '850-1000', min: 850, color: '#d2f000' },
  { id: 'strong', label: 'Strong chance', range: '750-849', min: 750, color: '#86efac' },
  { id: 'moderate', label: 'Moderate chance', range: '650-749', min: 650, color: '#fbbf24' },
  { id: 'aspirational', label: 'Aspirational', range: '500-649', min: 500, color: '#fb923c' },
  { id: 'unlikely', label: 'Unlikely right now', range: 'Below 500', min: 0, color: '#f87171' },
];

const COLLEGE_COURSES = [
  {
    college: 'Shri Ram College of Commerce',
    short: 'SRCC',
    tier: 'Top commerce tier',
    courses: [
      { name: 'B.Com (Hons)', stream: 'Commerce', target: 940, subjects: ['accountancy', 'business studies', 'economics', 'mathematics'] },
      { name: 'B.A. Economics (Hons)', stream: 'Commerce', target: 925, subjects: ['mathematics', 'economics'] },
    ],
  },
  {
    college: 'Hindu College',
    short: 'Hindu',
    tier: 'North campus elite',
    courses: [
      { name: 'B.A. Economics (Hons)', stream: 'Commerce', target: 910, subjects: ['mathematics', 'economics'] },
      { name: 'B.A. Political Science (Hons)', stream: 'Humanities', target: 895, subjects: ['political science', 'history', 'english'] },
      { name: 'B.Sc Physics (Hons)', stream: 'Science', target: 885, subjects: ['physics', 'chemistry', 'mathematics'] },
    ],
  },
  {
    college: 'Hansraj College',
    short: 'Hansraj',
    tier: 'North campus elite',
    courses: [
      { name: 'B.Com (Hons)', stream: 'Commerce', target: 900, subjects: ['accountancy', 'business studies', 'economics', 'mathematics'] },
      { name: 'B.A. Economics (Hons)', stream: 'Commerce', target: 890, subjects: ['mathematics', 'economics'] },
      { name: 'B.Sc Chemistry (Hons)', stream: 'Science', target: 870, subjects: ['physics', 'chemistry', 'mathematics', 'biology'] },
    ],
  },
  {
    college: 'Miranda House',
    short: 'Miranda',
    tier: 'Top women college',
    courses: [
      { name: 'B.A. English (Hons)', stream: 'Humanities', target: 890, subjects: ['english', 'history', 'political science'] },
      { name: 'B.A. Political Science (Hons)', stream: 'Humanities', target: 905, subjects: ['political science', 'history', 'english'] },
      { name: 'B.Sc Mathematics (Hons)', stream: 'Science', target: 865, subjects: ['mathematics', 'physics'] },
    ],
  },
  {
    college: "St. Stephen's College",
    short: "Stephen's",
    tier: 'Elite selectivity',
    courses: [
      { name: 'B.A. Economics (Hons)', stream: 'Commerce', target: 925, subjects: ['mathematics', 'economics'] },
      { name: 'B.A. English (Hons)', stream: 'Humanities', target: 900, subjects: ['english', 'history', 'political science'] },
      { name: 'B.Sc Mathematics (Hons)', stream: 'Science', target: 880, subjects: ['mathematics', 'physics'] },
    ],
  },
  {
    college: 'Lady Shri Ram College',
    short: 'LSR',
    tier: 'Top women college',
    courses: [
      { name: 'B.A. Economics (Hons)', stream: 'Commerce', target: 910, subjects: ['mathematics', 'economics'] },
      { name: 'B.A. Psychology (Hons)', stream: 'Humanities', target: 885, subjects: ['psychology', 'english', 'biology'] },
      { name: 'B.Com (Hons)', stream: 'Commerce', target: 895, subjects: ['accountancy', 'business studies', 'economics'] },
    ],
  },
  {
    college: 'Kirori Mal College',
    short: 'KMC',
    tier: 'North campus strong',
    courses: [
      { name: 'B.Com (Hons)', stream: 'Commerce', target: 875, subjects: ['accountancy', 'business studies', 'economics'] },
      { name: 'B.A. Political Science (Hons)', stream: 'Humanities', target: 865, subjects: ['political science', 'history'] },
      { name: 'B.Sc Physics (Hons)', stream: 'Science', target: 850, subjects: ['physics', 'chemistry', 'mathematics'] },
    ],
  },
  {
    college: 'Ramjas College',
    short: 'Ramjas',
    tier: 'North campus strong',
    courses: [
      { name: 'B.Com (Hons)', stream: 'Commerce', target: 860, subjects: ['accountancy', 'business studies', 'economics'] },
      { name: 'B.A. History (Hons)', stream: 'Humanities', target: 835, subjects: ['history', 'political science', 'english'] },
      { name: 'B.Sc Life Sciences', stream: 'Science', target: 805, subjects: ['biology', 'chemistry', 'physics'] },
    ],
  },
  {
    college: 'Sri Venkateswara College',
    short: 'Venky',
    tier: 'South campus elite',
    courses: [
      { name: 'B.Com (Hons)', stream: 'Commerce', target: 850, subjects: ['accountancy', 'business studies', 'economics'] },
      { name: 'B.A. Economics (Hons)', stream: 'Commerce', target: 845, subjects: ['mathematics', 'economics'] },
      { name: 'B.Sc Biological Sciences', stream: 'Science', target: 800, subjects: ['biology', 'chemistry', 'physics'] },
    ],
  },
  {
    college: 'Gargi College',
    short: 'Gargi',
    tier: 'South campus strong',
    courses: [
      { name: 'B.Com (Hons)', stream: 'Commerce', target: 830, subjects: ['accountancy', 'business studies', 'economics'] },
      { name: 'B.A. English (Hons)', stream: 'Humanities', target: 810, subjects: ['english', 'history', 'political science'] },
      { name: 'B.Sc Microbiology (Hons)', stream: 'Science', target: 790, subjects: ['biology', 'chemistry', 'physics'] },
    ],
  },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function getBand(score) {
  return SCORE_BANDS.find((band) => score >= band.min) || SCORE_BANDS[SCORE_BANDS.length - 1];
}

function getChance(score, adjustedTarget) {
  const gap = score - adjustedTarget;
  if (gap >= 35) return { label: 'High chance', tone: 'high', range: '850-1000' };
  if (gap >= 0) return { label: 'Strong chance', tone: 'strong', range: '750-849' };
  if (gap >= -55) return { label: 'Moderate chance', tone: 'moderate', range: '650-749' };
  if (gap >= -140) return { label: 'Aspirational', tone: 'reach', range: '500-649' };
  return { label: 'Unlikely right now', tone: 'unlikely', range: 'Below 500' };
}

function subjectMatchesCourse(subjectNames, requiredSubjects) {
  const normalizedSubjects = subjectNames.map(normalize);
  const matched = requiredSubjects.filter((required) => (
    normalizedSubjects.some((subject) => subject.includes(required) || required.includes(subject))
  ));
  return {
    count: matched.length,
    matched,
    fit: requiredSubjects.length ? matched.length / requiredSubjects.length : 1,
  };
}

export function buildAdmissionCompass({ user, subjects = [], attempts = [], category = 'general' }) {
  const selectedSubjectIds = Array.isArray(user?.subjects) ? user.subjects.slice(0, REQUIRED_SUBJECTS) : [];
  const selectedSubjects = selectedSubjectIds
    .map((id) => subjects.find((subject) => subject.id === id) || { id, name: id, short: id })
    .filter(Boolean);

  const bySubject = selectedSubjects.map((subject) => {
    const subjectAttempts = attempts.filter((attempt) => attempt.subject === subject.id);
    const totalQuestions = subjectAttempts.reduce((sum, attempt) => sum + (attempt.total || 0), 0);
    const avgScore = subjectAttempts.length
      ? Math.round(subjectAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / subjectAttempts.length)
      : 0;
    const correct = subjectAttempts.reduce((sum, attempt) => sum + (attempt.correct || 0), 0);
    const wrong = subjectAttempts.reduce((sum, attempt) => sum + (attempt.wrong || 0), 0);
    const answered = correct + wrong;
    const accuracy = answered ? Math.round((correct / answered) * 100) : avgScore;
    const scores = subjectAttempts.map((attempt) => attempt.score || 0);
    const volatility = scores.length > 1 ? Math.max(...scores) - Math.min(...scores) : 0;
    const trend = scores.length > 1 ? scores[0] - scores[scores.length - 1] : 0;
    const consistencyPenalty = Math.round(volatility * 0.18);
    const trendBonus = clamp(Math.round(trend * 0.12), -8, 8);
    const subjectScore = clamp(Math.round((avgScore / 100) * MAX_SUBJECT_SCORE) - consistencyPenalty + trendBonus, 0, MAX_SUBJECT_SCORE);

    return {
      id: subject.id,
      name: subject.name || subject.id,
      short: subject.short || subject.id,
      tests: subjectAttempts.length,
      completedMocks: subjectAttempts.length,
      requiredMocks: REQUIRED_MOCKS_PER_SUBJECT,
      complete: subjectAttempts.length >= REQUIRED_MOCKS_PER_SUBJECT,
      totalQuestions,
      avgScore,
      accuracy,
      volatility,
      trend,
      subjectScore,
      mocksToUnlock: Math.max(0, REQUIRED_MOCKS_PER_SUBJECT - subjectAttempts.length),
    };
  });

  const completedSubjects = bySubject.filter((subject) => subject.complete).length;
  const isPremium = Boolean(user?.isPremium || user?.subscriptionStatus === 'active' || user?.role === 'moderator');
  const eligible = isPremium && selectedSubjects.length >= REQUIRED_SUBJECTS && completedSubjects >= REQUIRED_SUBJECTS;
  const estimatedScore = clamp(bySubject.reduce((sum, subject) => sum + subject.subjectScore, 0), 0, MAX_CUET_SCORE);
  const scoreBand = getBand(estimatedScore);
  const categoryAdjustment = CATEGORY_ADJUSTMENTS[category] ?? 0;
  const subjectNames = selectedSubjects.map((subject) => subject.name || subject.id);
  const readiness = Math.round((completedSubjects / REQUIRED_SUBJECTS) * 100);

  const recommendations = COLLEGE_COURSES.flatMap((college) => (
    college.courses.map((course) => {
      const match = subjectMatchesCourse(subjectNames, course.subjects);
      const adjustedTarget = clamp(course.target + categoryAdjustment, 450, 970);
      const chance = getChance(estimatedScore, adjustedTarget);
      const scoreGap = adjustedTarget - estimatedScore;
      const subjectFitBonus = Math.round(match.fit * 40);
      const rankScore = (estimatedScore - adjustedTarget) + subjectFitBonus + (match.count * 8);
      return {
        college: college.college,
        short: college.short,
        tier: college.tier,
        course: course.name,
        stream: course.stream,
        target: adjustedTarget,
        baseTarget: course.target,
        subjectFit: Math.round(match.fit * 100),
        matchedSubjects: match.matched,
        missingSubjects: course.subjects.filter((subject) => !match.matched.includes(subject)),
        chance,
        scoreGap,
        rankScore,
      };
    })
  ))
    .filter((item) => item.subjectFit >= 45)
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 10);

  const weakestSubject = [...bySubject].sort((a, b) => a.subjectScore - b.subjectScore)[0];
  const nearestOpportunity = recommendations.find((item) => item.scoreGap > 0 && item.scoreGap <= 90) || recommendations[0];
  const improvementMoves = [
    weakestSubject
      ? `Push ${weakestSubject.name} by ${Math.min(35, Math.max(10, 200 - weakestSubject.subjectScore))} marks to lift the total predictor fastest.`
      : 'Complete five selected subjects to unlock score guidance.',
    nearestOpportunity
      ? `${nearestOpportunity.short} ${nearestOpportunity.course} is ${Math.max(0, nearestOpportunity.scoreGap)} marks away from the next confidence tier.`
      : 'Add more mocks so course matching can rank colleges with better confidence.',
    'Keep the subject combination aligned with the course rules before chasing college names.',
  ];

  return {
    eligible,
    isPremium,
    readiness,
    requiredSubjects: REQUIRED_SUBJECTS,
    completedSubjects,
    requiredMocksPerSubject: REQUIRED_MOCKS_PER_SUBJECT,
    maxScore: MAX_CUET_SCORE,
    estimatedScore,
    scoreBand,
    category,
    categoryAdjustment,
    selectedSubjects,
    subjects: bySubject,
    recommendations,
    improvementMoves,
    scoreBands: SCORE_BANDS,
  };
}
