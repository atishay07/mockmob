const OPTION_KEYS = ['A', 'B', 'C', 'D'];

export function normalizeGenerationPayload(payload, context = {}) {
  const requiresPassage = context.requires_passage === true || context.requiresPassage === true;
  const stats = {
    raw_questions: 0,
    raw_passage_groups: 0,
    raw_passages: 0,
    raw_questions_rejected_requires_passage: 0,
    passage_groups_below_min_children: 0,
    flattened_questions: 0,
    structural_rejected: 0,
    normalized_count_before_selfcheck: 0,
  };

  const questions = [];
  const groups = [];

  const addStandalone = (entries) => {
    const list = Array.isArray(entries) ? entries : [];
    stats.raw_questions += list.length;
    if (requiresPassage) {
      stats.raw_questions_rejected_requires_passage += list.length;
      stats.structural_rejected += list.length;
      return;
    }
    for (const entry of list) {
      if (entry && typeof entry === 'object') questions.push(entry);
      else stats.structural_rejected += 1;
    }
  };

  if (Array.isArray(payload)) {
    addStandalone(payload);
  } else if (payload && typeof payload === 'object') {
    addStandalone(payload.questions);
    if (payload.passage_group) {
      stats.raw_passage_groups += 1;
      const normalized = flattenPassageGroup(payload.passage_group, context, 1);
      groups.push(...normalized.groups);
      questions.push(...normalized.questions);
      stats.structural_rejected += normalized.rejected;
      stats.passage_groups_below_min_children += normalized.belowMinChildren ? 1 : 0;
    }
    const passages = Array.isArray(payload.passages) ? payload.passages : [];
    stats.raw_passages += passages.length;
    passages.forEach((passage, index) => {
      const normalized = flattenPassageGroup(passage, context, index + 1);
      groups.push(...normalized.groups);
      questions.push(...normalized.questions);
      stats.structural_rejected += normalized.rejected;
      stats.passage_groups_below_min_children += normalized.belowMinChildren ? 1 : 0;
    });
  }

  stats.flattened_questions = questions.length;
  stats.normalized_count_before_selfcheck = questions.length;
  for (const group of groups) {
    const linkedQuestionCount = questions.filter((question) => question.temporary_group_key === group.temporary_group_key).length;
    console.log('[passage_group] normalized', {
      passage_id: group.passage_id,
      temporary_group_key: group.temporary_group_key,
      linked_question_count: linkedQuestionCount,
      has_passage_text: Boolean(group.passage_text),
      has_group_id: Boolean(group.passage_group_id),
    });
  }
  console.log('[normalizer]', stats);
  return { questions, passageGroups: groups, stats };
}

export function flattenPassageGroup(group, context = {}, groupIndex = 1) {
  const requiresPassage = context.requires_passage === true || context.requiresPassage === true;
  const minLinkedQuestionCount = requiresPassage ? 5 : 1;
  const rejected = { count: 0 };
  if (!group || typeof group !== 'object') return { questions: [], groups: [], rejected: 1, belowMinChildren: false };

  const passageText = String(group.passage_text || group.passage || group.text || '').trim();
  const passageId = String(group.passage_id || `passage_${groupIndex}`).trim();
  const temporaryGroupKey = String(group.temporary_group_key || group.temp_group_key || group.passage_group_id || group.group_id || `tmp_${passageId}_${groupIndex}`).trim();
  const children = Array.isArray(group.questions) ? group.questions : [];
  if (!passageText || !passageId || children.length === 0) {
    return { questions: [], groups: [], rejected: Math.max(1, children.length), belowMinChildren: false };
  }

  const flattened = children
    .map((question, index) => flattenPassageQuestion(question, {
      context,
      group,
      passageText,
      passageId,
      temporaryGroupKey,
      index,
      rejected,
    }))
    .filter(Boolean);

  if (flattened.length < minLinkedQuestionCount) {
    return {
      questions: [],
      groups: [],
      rejected: Math.max(children.length, minLinkedQuestionCount),
      belowMinChildren: true,
    };
  }

  return {
    questions: flattened,
    groups: [{
      temporary_group_key: temporaryGroupKey,
      passage_group_id: group.passage_group_id || group.group_id || '',
      passage_id: passageId,
      title: String(group.title || '').trim(),
      passage_type: String(group.passage_type || context.passage_type || 'factual').trim().toLowerCase(),
      passage_text: passageText,
      subject: context.subject || 'english',
      chapter: context.chapter || group.chapter || '',
      question_count: flattened.length,
      linked_question_count: flattened.length,
    }],
    rejected: rejected.count,
    belowMinChildren: false,
  };
}

function flattenPassageQuestion(question, meta) {
  if (!question || typeof question !== 'object') {
    meta.rejected.count += 1;
    return null;
  }

  const options = Array.isArray(question.o || question.options) ? (question.o || question.options) : [];
  const answer = normalizeAnswer(question.a || question.answer || question.correct_answer);
  const body = String(question.q || question.body || question.question || '').trim();
  if (!body || options.length !== 4 || !answer) {
    meta.rejected.count += 1;
    return null;
  }

  return {
    ...question,
    q: body,
    o: options,
    a: answer,
    subject: question.subject || meta.context.subject || 'english',
    chapter: question.chapter || meta.context.chapter || meta.group.chapter || '',
    passage_id: question.passage_id || meta.passageId,
    passage_group_id: question.passage_group_id || question.group_id || '',
    temporary_group_key: question.temporary_group_key || meta.temporaryGroupKey,
    group_id: question.group_id || question.passage_group_id || '',
    passage_text: question.passage_text || meta.passageText,
    passage_title: question.passage_title || meta.group.title || '',
    passage_type: question.passage_type || meta.group.passage_type || meta.context.passage_type || 'factual',
    order_index: Number(question.order_index || meta.index + 1),
    is_passage_linked: true,
  };
}

function normalizeAnswer(value) {
  const key = String(value || '').trim().toUpperCase();
  return OPTION_KEYS.includes(key) ? key : '';
}

export function canPublishPassageGroup(validLinkedQuestions, group = {}, options = {}) {
  const count = Array.isArray(validLinkedQuestions) ? validLinkedQuestions.length : 0;
  const minChildren = Number(options.minChildren || 2);
  const hasPassage = String(group?.passage_text || validLinkedQuestions?.[0]?.passage_text || '').trim().length > 0;
  return hasPassage && count >= minChildren;
}
