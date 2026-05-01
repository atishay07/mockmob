function splitList(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeSubject(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function normalizeChapter(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function parseCliArgs(argv = process.argv.slice(2)) {
  const parsed = {};
  for (const arg of argv || []) {
    if (!String(arg).startsWith('--')) continue;
    const [rawKey, ...rest] = String(arg).slice(2).split('=');
    const key = rawKey.trim();
    const value = rest.length > 0 ? rest.join('=') : 'true';
    if (key === 'subjects') parsed.subjects = value;
    else if (key === 'chapters') parsed.chapters = value;
    else if (key === 'exclude-subjects') parsed.excludeSubjects = value;
    else if (key === 'exclude-chapters') parsed.excludeChapters = value;
    else if (key === 'target-count') parsed.targetCount = value;
    else if (key === 'max-jobs') parsed.maxJobs = value;
    else if (key === 'mode') parsed.mode = value;
    else if (key === 'quality') parsed.quality = value;
  }
  return parsed;
}

export function getCuetOverrideConfig({ env = process.env, argv = process.argv.slice(2) } = {}) {
  const cli = parseCliArgs(argv);
  const subjectSource = cli.subjects ?? env.CUET_SUBJECT_OVERRIDE ?? env.CUET_ONLY_SUBJECTS ?? '';
  const chapterSource = cli.chapters ?? env.CUET_CHAPTER_OVERRIDE ?? env.CUET_ONLY_CHAPTERS ?? '';
  const excludeSubjectSource = cli.excludeSubjects ?? env.CUET_EXCLUDE_SUBJECTS ?? '';
  const excludeChapterSource = cli.excludeChapters ?? env.CUET_EXCLUDE_CHAPTERS ?? '';
  const mode = String(cli.mode ?? env.CUET_OVERRIDE_MODE ?? '').trim().toLowerCase();
  const quality = String(cli.quality ?? env.CUET_QUALITY_MODE ?? 'speed').trim().toLowerCase() || 'speed';
  const targetCount = Number(cli.targetCount ?? env.CUET_OVERRIDE_TARGET_COUNT ?? 0);
  const maxJobs = Number(cli.maxJobs ?? env.CUET_OVERRIDE_MAX_JOBS ?? 0);

  const subjects = splitList(subjectSource).map(normalizeSubject);
  const chapters = splitList(chapterSource).map(normalizeChapter);
  const excludeSubjects = splitList(excludeSubjectSource).map(normalizeSubject);
  const excludeChapters = splitList(excludeChapterSource).map(normalizeChapter);

  return {
    active: subjects.length > 0 || chapters.length > 0 || excludeSubjects.length > 0 || excludeChapters.length > 0 || Boolean(mode),
    subjects,
    chapters,
    exclude_subjects: excludeSubjects,
    exclude_chapters: excludeChapters,
    mode,
    quality_mode: ['speed', 'balanced', 'premium'].includes(quality) ? quality : 'speed',
    target_count: Number.isFinite(targetCount) && targetCount > 0 ? targetCount : null,
    max_jobs: Number.isFinite(maxJobs) && maxJobs > 0 ? maxJobs : null,
  };
}

export function isJobAllowedByOverride(job, override = getCuetOverrideConfig()) {
  const subject = normalizeSubject(job?.subject_id || job?.subject || '');
  const chapter = normalizeChapter(job?.chapter || '');
  if (override.subjects?.length > 0 && !override.subjects.includes(subject)) {
    return { allowed: false, reason: 'subject_not_in_override' };
  }
  if (override.chapters?.length > 0 && !override.chapters.includes(chapter)) {
    return { allowed: false, reason: 'chapter_not_in_override' };
  }
  if (override.exclude_subjects?.includes(subject)) {
    return { allowed: false, reason: 'subject_excluded' };
  }
  if (override.exclude_chapters?.includes(chapter)) {
    return { allowed: false, reason: 'chapter_excluded' };
  }
  return { allowed: true, reason: null };
}

export function filterJobsByOverride(jobs = [], override = getCuetOverrideConfig()) {
  return (jobs || []).filter((job) => isJobAllowedByOverride(job, override).allowed);
}

export function logOverrideConfig(override = getCuetOverrideConfig()) {
  if (!override.active && override.quality_mode === 'speed') return;
  console.log('[override] active', {
    subjects: override.subjects,
    chapters: override.chapters,
    exclude_subjects: override.exclude_subjects,
    exclude_chapters: override.exclude_chapters,
    mode: override.mode,
    quality: override.quality_mode,
    target_count: override.target_count,
    max_jobs: override.max_jobs,
  });
}

export function getEnglishNtaChapterPlan() {
  return [
    { chapter: 'Narrative Passage', share: Number(process.env.ENGLISH_NTA_PASSAGE_GROUP_SHARE || 0.4), requires_passage: true },
    { chapter: 'Reading Comprehension', share: Number(process.env.ENGLISH_NTA_PASSAGE_GROUP_SHARE || 0.4), requires_passage: true },
    { chapter: 'Para Jumbles', share: Number(process.env.ENGLISH_NTA_PARA_JUMBLE_SHARE || 0.2), requires_passage: false },
    { chapter: 'Vocabulary', share: Number(process.env.ENGLISH_NTA_VOCAB_SHARE || 0.2), requires_passage: false },
    { chapter: 'Grammar', share: Number(process.env.ENGLISH_NTA_GRAMMAR_SHARE || 0.2), requires_passage: false },
  ];
}
