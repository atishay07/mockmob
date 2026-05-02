export const PREPOS_SECTIONS = [
  { id: 'ai', label: 'PrepOS' },
  { id: 'mission', label: 'Missions' },
  { id: 'guide', label: 'Tools' },
];

export const FEATURE_GUIDE = [
  {
    key: 'mocks',
    name: 'Mock Tests',
    route: '/dashboard',
    description: 'Start timed CUET practice from your selected subjects, chapters, count, and test mode.',
    whenToUse: 'Use this for diagnostics, daily practice, and pressure simulation.',
    actionLabel: 'Open Arena',
  },
  {
    key: 'radar',
    name: 'AI Radar',
    route: '/analytics',
    description: 'Shows weak chapters, accuracy trend, pace, and repeated score leaks from your attempts.',
    whenToUse: 'Use this after every mock to decide the next recovery move.',
    actionLabel: 'Open Radar',
  },
  {
    key: 'du_compass',
    name: 'DU Compass',
    route: '/admission-compass',
    description: 'Turns mock performance, subjects, and category into DU college and course direction when data exists.',
    whenToUse: 'Use this when you want prep tied to a target, not generic grinding.',
    actionLabel: 'Open Compass',
  },
  {
    key: 'saved',
    name: 'Saved Questions',
    route: '/saved',
    description: 'Keeps questions worth replaying before a new mock.',
    whenToUse: 'Use this for short revision blocks and mistake memory.',
    actionLabel: 'Open Saved',
  },
  {
    key: 'benchmark',
    name: 'Shadow Benchmark',
    route: '/rival',
    description: 'A timed pressure check against a benchmark student for speed, accuracy, and recovery signals.',
    whenToUse: 'Use this when you need a habit-forming challenge without taking a full mock.',
    actionLabel: 'Start Benchmark',
  },
  {
    key: 'pricing',
    name: 'Premium and Credits',
    route: '/pricing',
    description: 'Every account gets a small PrepOS monthly allowance. Premium expands it; AI credits stay separate from normal mock-generation credits.',
    whenToUse: 'Use this when PrepOS is out of credits or you need deeper AI usage.',
    actionLabel: 'View Plans',
  },
];

export const BENCHMARK_OPTIONS = [
  {
    id: 'NORTH_CAMPUS_RIVAL',
    key: 'daily',
    name: 'Daily Benchmark',
    shortName: 'Daily',
    description: 'One short daily pressure check. Free users get this once per day.',
    purpose: 'Prove you can execute today, not someday.',
    availability: 'Free daily',
    cost: 0,
    tier: 'free',
  },
  {
    id: 'SPEED_DEMON',
    key: 'speed',
    name: 'Speed Benchmark',
    shortName: 'Speed',
    description: 'Checks whether pace is the thing costing marks.',
    purpose: 'Useful when you know the material but finish late.',
    availability: 'Premium basic',
    cost: 0,
    tier: 'paid_basic',
  },
  {
    id: 'ACCURACY_MONSTER',
    key: 'accuracy',
    name: 'Accuracy Benchmark',
    shortName: 'Accuracy',
    description: 'Checks whether careless or trap errors are dragging your score.',
    purpose: 'Useful when your speed is fine but marks leak anyway.',
    availability: 'Premium basic',
    cost: 0,
    tier: 'paid_basic',
  },
  {
    id: 'WEAKNESS_RIVAL',
    key: 'weakness',
    name: 'Weakness Benchmark',
    shortName: 'Weakness',
    description: 'Targets weak chapters from your MockMob history.',
    purpose: 'Best after Radar has repeated weak-chapter evidence.',
    availability: 'AI credits',
    cost: 1,
    tier: 'premium',
  },
  {
    id: 'SRCC_DREAM',
    key: 'target',
    name: 'DU Target Benchmark',
    shortName: 'DU Target',
    description: 'A tougher benchmark for your college or course target.',
    purpose: 'Useful only when Compass and mock history have enough data.',
    availability: 'AI credits',
    cost: 2,
    tier: 'premium',
  },
  {
    id: 'BOSS_RIVAL',
    key: 'composite',
    name: 'Composite Benchmark',
    shortName: 'Composite',
    description: 'The hardest mixed pressure check.',
    purpose: 'Use after daily and speed benchmarks feel easy.',
    availability: 'AI credits',
    cost: 3,
    tier: 'premium',
  },
];

export const CREDIT_PACKS = [
  { key: 'prepos_10_50', name: '₹10 PrepOS top-up', amount: 10, credits: 50, description: 'A quick refill for another focused PrepOS sprint.' },
  { key: 'prepos_20_150', name: '₹20 PrepOS focus pack', amount: 20, credits: 150, description: 'A deeper refill for missions, replay, and planning.' },
  { key: 'prepos_50_400', name: '₹50 PrepOS sprint pack', amount: 50, credits: 400, description: 'Best value for heavy PrepOS usage without interrupting your CUET flow.' },
];

export function pageHelpForPath(pathname = '/') {
  if (pathname.startsWith('/dashboard')) {
    return pageHelp({
      title: 'Arena',
      body: 'This is where mocks start. Pick a subject, mode, count, and optional chapters. After the test, come back and I will help you turn the result into a recovery loop.',
      action: { label: 'Start a mock', type: 'navigate', route: '/dashboard' },
      context: 'mock_setup',
    });
  }
  if (pathname.startsWith('/test')) {
    return pageHelp({
      title: 'Active test',
      body: 'Stay focused while solving. I will stay out of the way until submission, then help with review and recovery.',
      action: { label: 'Review after test', type: 'section', section: 'review' },
      context: 'active_test',
    });
  }
  if (pathname.startsWith('/rival')) {
    return pageHelp({
      title: 'Shadow Benchmark',
      body: 'This is a timed benchmark. It is different from a mock because the result says whether you lost on pace, accuracy, skips, or pressure.',
      action: { label: 'Explain benchmark', type: 'section', section: 'benchmark' },
      context: 'benchmark',
    });
  }
  if (pathname.startsWith('/admission-compass')) {
    return pageHelp({
      title: 'DU Compass',
      body: 'Compass connects your mock performance to target direction. I will keep it honest and avoid guessing college chances without enough score and subject data.',
      action: { label: 'Review prep data', type: 'section', section: 'review' },
      context: 'admission',
    });
  }
  if (pathname.startsWith('/analytics')) {
    return pageHelp({
      title: 'AI Radar',
      body: 'Radar shows where marks leak. After a mock, I will help you choose between Mistake Replay and a Benchmark instead of broad practice.',
      action: { label: 'Open Mistake Replay', type: 'section', section: 'replay' },
      context: 'radar',
    });
  }
  if (pathname.startsWith('/saved')) {
    return pageHelp({
      title: 'Saved Questions',
      body: 'Saved questions are your memory bank. Replay these before a full mock when you need fast revision.',
      action: { label: 'Build revision mission', type: 'section', section: 'mission' },
      context: 'saved',
    });
  }
  if (pathname.startsWith('/pricing')) {
    return pageHelp({
      title: 'Plans and credits',
      body: 'You get a small monthly PrepOS allowance first. Premium expands it, and top-ups are separate from normal MockMob mock-generation credits.',
      action: { label: 'Explain credits', type: 'section', section: 'guide' },
      context: 'pricing',
    });
  }
  if (pathname === '/' || pathname.startsWith('/features')) {
    return pageHelp({
      title: 'MockMob guide',
      body: 'Ask me what MockMob does, compare plans, or find the fastest way to start CUET practice.',
      action: { label: 'How MockMob works', type: 'ask', prompt: 'How does MockMob help CUET prep?' },
      context: 'public',
    });
  }
  return pageHelp({
    title: 'MockMob',
    body: 'I can explain this page, open the right tool, or turn your latest prep data into one next action.',
    action: { label: 'Explain this page', type: 'ask', prompt: 'Explain this page' },
    context: 'generic',
  });
}

export function buildTodayMission({ context, user, pathname }) {
  const firstName = (user?.name || context?.displayName || 'there').split(' ')[0];
  const subject = context?.selectedSubjects?.[0] || user?.subjects?.[0] || null;
  const weak = context?.weaknessSummary?.weakChapters?.[0] || null;
  const savedCount = context?.savedQuestionSummary?.count || 0;
  const attempts = context?.recentMockSummary?.attemptCount || 0;
  const timePressure = context?.mistakeDNA?.timePressureErrors?.score || 0;
  const trapScore = context?.mistakeDNA?.trapErrors?.score || 0;

  if (!user?.id) {
    return {
      title: 'Find your starting point',
      line: 'I can show you around MockMob first. When you are ready, create an account and take one diagnostic so I can personalize the plan.',
      why: 'I can guide you right now, but I need your first attempt before I can understand your prep pattern.',
      time: '3 minutes',
      success: 'Know which MockMob tool to open first.',
      source: 'Public guide mode',
      confidence: 100,
      reward: 'Unlock personal missions after your first mock.',
      action: { label: 'Create free account', type: 'navigate', route: '/signup?source=prepos' },
      secondary: { label: 'Explain MockMob', type: 'ask', prompt: 'How does MockMob help CUET prep?' },
    };
  }

  if (!subject) {
    return {
      title: 'Set your CUET subjects',
      line: `First, tell me your CUET subjects. Then I can choose a real mission for ${firstName}.`,
      why: 'Without subjects, I would only be guessing, and that is not useful.',
      time: '4 minutes',
      success: 'At least one CUET subject selected.',
      source: 'Profile data missing',
      confidence: 92,
      reward: 'Your first diagnostic mission unlocks after setup.',
      action: { label: 'Set subjects', type: 'navigate', route: '/onboarding?edit=true' },
      secondary: { label: 'Open Arena', type: 'navigate', route: '/dashboard' },
    };
  }

  if (attempts === 0) {
    return {
      title: `Take a ${display(subject)} diagnostic`,
      line: 'Start with 10 questions. Keep it light; the first attempt is just to give us a clean signal.',
      why: 'One attempt helps me separate concept gaps from speed and trap mistakes.',
      time: '12 minutes',
      success: 'Finish one quick mock and return for review.',
      source: 'No completed mock yet',
      confidence: 88,
      reward: 'Unlock Mistake Replay after the first result.',
      action: { label: 'Start diagnostic', type: 'navigate', route: `/dashboard?mission=diagnostic&subject=${encodeURIComponent(subject)}` },
      secondary: { label: 'Daily Benchmark', type: 'benchmark', rivalType: 'NORTH_CAMPUS_RIVAL' },
    };
  }

  if (weak) {
    return {
      title: `Recover ${display(weak.subject)}: ${weak.chapter}`,
      line: `Your next move is focused recovery, not another broad mock. Replay this leak first, then benchmark it.`,
      why: `${weak.chapter} is showing ${weak.accuracy}% accuracy across ${weak.attempts || 'recent'} attempts.`,
      time: '18 minutes',
      success: 'Score 7/8 in Mistake Replay or move to Daily Benchmark.',
      source: 'AI Radar weak-chapter history',
      confidence: context?.aiConfidence?.score || 72,
      reward: 'Recovery streak +1 when completed today.',
      action: { label: 'Fix this leak', type: 'section', section: 'replay' },
      secondary: { label: 'Start Benchmark', type: 'benchmark', rivalType: 'WEAKNESS_RIVAL' },
    };
  }

  if (timePressure >= 35) {
    return {
      title: 'Run a speed sprint',
      line: 'This looks like pace pressure. Let us use a short benchmark before a full mock.',
      why: 'Skipped or late questions are showing up more than concept weakness.',
      time: '8 minutes',
      success: 'Keep average time inside the benchmark target.',
      source: 'Attempt timing summary',
      confidence: context?.aiConfidence?.score || 64,
      reward: 'Speed streak +1 if you finish under time.',
      action: { label: 'Start Speed Benchmark', type: 'benchmark', rivalType: 'SPEED_DEMON' },
      secondary: { label: 'Open Radar', type: 'navigate', route: '/analytics' },
    };
  }

  if (trapScore >= 30 || savedCount > 0) {
    return {
      title: 'Replay saved mistakes',
      line: `Let us use your saved question bank before adding new questions.`,
      why: savedCount ? `${savedCount} saved question${savedCount === 1 ? '' : 's'} can become a tight revision loop.` : 'Your mistake DNA suggests trap or careless errors.',
      time: '10 minutes',
      success: 'Clear the saved set with no repeated miss.',
      source: 'Saved questions and mistake DNA',
      confidence: context?.aiConfidence?.score || 58,
      reward: 'Memory lock +1 after replay.',
      action: { label: 'Open Saved', type: 'navigate', route: '/saved?intent=replay' },
      secondary: { label: 'Accuracy Benchmark', type: 'benchmark', rivalType: 'ACCURACY_MONSTER' },
    };
  }

  return {
    title: 'Daily Benchmark',
    line: 'Take one short pressure check, then we will decide whether today is a mock day or a recovery day.',
    why: 'Your current data does not show one severe leak, so a benchmark gives the cleanest next signal.',
    time: '8 minutes',
    success: 'Beat the benchmark or get one precise recovery mission.',
    source: 'Balanced prep state',
    confidence: context?.aiConfidence?.score || 52,
    reward: 'Daily streak +1.',
    action: { label: 'Start Daily Benchmark', type: 'benchmark', rivalType: 'NORTH_CAMPUS_RIVAL' },
    secondary: { label: 'Take a mock instead', type: 'navigate', route: '/dashboard' },
  };
}

export function buildMistakeReplayPlan(context) {
  const weak = context?.weaknessSummary?.weakChapters?.[0] || null;
  const dna = context?.mistakeDNA || null;
  const savedCount = context?.savedQuestionSummary?.count || 0;
  const skipped = context?.skippedQuestionSummary?.questionsSkipped || 0;
  const attempts = context?.recentMockSummary?.attemptCount || 0;
  const dominant = dna?.dominantPattern?.[0] || null;

  if (!context || attempts === 0 || (!weak && savedCount === 0 && skipped === 0 && !dominant)) {
    return {
      ready: false,
      title: 'Mistake Replay needs a signal',
      pattern: 'Not enough attempt data yet.',
      cost: 'No AI credits',
      reason: 'Take one diagnostic mock or Daily Benchmark first. A replay without mistakes would be fake practice.',
      pass: 'Finish one diagnostic attempt.',
      action: { label: 'Take diagnostic', type: 'navigate', route: '/dashboard?mission=diagnostic' },
    };
  }

  const pattern = weak
    ? `${display(weak.subject)} leak in ${weak.chapter}`
    : dominant
      ? displayPattern(dominant.key)
      : savedCount
        ? 'saved-question memory gap'
        : 'skipped-question pressure';

  const replayCount = savedCount > 0 ? Math.min(8, savedCount) : 8;
  return {
    ready: true,
    title: 'Mistake Replay',
    pattern,
    cost: 'Premium action when personalized',
    reason: weak
      ? `${weak.chapter} is costing marks repeatedly. Replay it before a broad mock.`
      : 'Your recent history has enough mistakes to create a focused recovery loop.',
    replay: `Replay ${replayCount} questions from wrong, skipped, saved, or weak-topic history.`,
    pass: `Pass condition: ${Math.min(7, replayCount)}/${replayCount} correct under 10 minutes.`,
    action: weak
      ? { label: 'Start focused practice', type: 'navigate', route: `/dashboard?mission=mistake_replay&subject=${encodeURIComponent(weak.subject)}&chapter=${encodeURIComponent(weak.chapter)}` }
      : { label: 'Open Saved', type: 'navigate', route: '/saved?intent=replay' },
  };
}

export function deterministicReplyFor({ text, pathname, context, user }) {
  const q = normalize(text);
  if (!q) return null;
  const current = pageHelpForPath(pathname);

  if (q.includes('current page') || q.includes('this page') || q.includes('where am i') || q.includes('explain page')) {
    return makeReply({
      reply: `Here is the quick read: ${current.title}. ${current.body}`,
      reason: 'I am using the page you are on, so this guidance is instant.',
      action: current.primary,
      confidence: 98,
    });
  }

  if (q.includes('today') || q.includes('next move') || q.includes('mission') || q.includes('replan') || q.includes('daily target')) {
    const mission = buildTodayMission({ context, user, pathname });
    return makeReply({
      reply: `Good, let us make today simple. ${mission.title}: ${mission.line}`,
      reason: mission.why,
      action: mission.action,
      confidence: mission.confidence,
      cards: [{ type: 'mission', title: mission.success, body: `${mission.time}. ${mission.reward}`, metadata: mission }],
    });
  }

  if (q.includes('trap') || q.includes('drill') || q.includes('mistake replay') || q.includes('fix my leak')) {
    const replay = buildMistakeReplayPlan(context);
    return makeReply({
      reply: `Yes. This is a good place for focused recovery. ${replay.title}: ${replay.pattern}`,
      reason: replay.reason,
      action: replay.action,
      confidence: replay.ready ? 82 : 96,
      cards: [{ type: 'replay', title: replay.pass, body: replay.replay || 'Diagnostic needed first.', metadata: replay }],
    });
  }

  if (q.includes('credit') || q.includes('pricing') || q.includes('buy ai')) {
    return makeReply({
      reply: 'PrepOS credits are separate from normal MockMob credits. Free users get 10 PrepOS credits each month; Pro gets 50. Standard chat costs 1 credit, while deeper GPT-4.1 mini work costs 3.',
      reason: 'The free allowance is intentionally small so you can feel the value without burning the product budget.',
      action: { label: 'Open plans', type: 'navigate', route: '/pricing?reason=prepos' },
      confidence: 98,
    });
  }

  if (q.includes('rival') || q.includes('benchmark') || q.includes('duel')) {
    return makeReply({
      reply: 'Shadow Benchmark is a timed pressure check against a target student level. It helps us see whether the leak is pace, accuracy, skips, or traps.',
      reason: 'Use it when you want a repeatable daily loop without committing to a full mock.',
      action: { label: 'Start Daily Benchmark', type: 'benchmark', rivalType: 'NORTH_CAMPUS_RIVAL' },
      confidence: 98,
    });
  }

  const feature = FEATURE_GUIDE.find((item) => {
    const haystack = normalize(`${item.key} ${item.name}`);
    return haystack.split(' ').some((token) => token.length > 3 && q.includes(token));
  });
  if (feature) {
    return makeReply({
      reply: `${feature.name}: ${feature.description}`,
      reason: feature.whenToUse,
      action: { label: feature.actionLabel, type: 'navigate', route: feature.route },
      confidence: 98,
    });
  }

  if (q.includes('how') && (q.includes('mock') || q.includes('test'))) {
    return makeReply({
      reply: 'Open Arena, choose a subject, pick Quick or Smart mode, set count, then start the timed test. After submission, I can turn the result into a recovery mission.',
      reason: 'MockMob works best as a simple loop: solve, review, recover, benchmark. I can help you keep that loop moving.',
      action: { label: 'Open Arena', type: 'navigate', route: '/dashboard' },
      confidence: 98,
    });
  }

  if (!user?.id && (q.includes('signup') || q.includes('start') || q.includes('free'))) {
    return makeReply({
      reply: 'Start free, take one diagnostic, then I will help choose the first real mission from your result.',
      reason: 'A personalized plan needs at least one attempt, and that first signal matters.',
      action: { label: 'Create account', type: 'navigate', route: '/signup?source=prepos' },
      confidence: 98,
    });
  }

  return null;
}

function pageHelp({ title, body, action, context }) {
  return {
    title,
    body,
    context,
    primary: action,
  };
}

function makeReply({ reply, reason, action, confidence, cards = [] }) {
  return {
    reply,
    confidence,
    cards,
    reason,
    actions: action ? [action] : [],
    deterministic: true,
  };
}

function display(value) {
  return String(value || 'Subject')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function displayPattern(key) {
  return String(key || 'mistake pattern')
    .replace(/Errors$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase();
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
