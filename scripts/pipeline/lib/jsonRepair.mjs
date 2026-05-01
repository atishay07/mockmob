import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import OpenAI from 'openai';
import { loadEnvFile } from 'node:process';

try {
  loadEnvFile('.env.local');
} catch {
  // Production and npm scripts may provide env vars directly.
}

const OPTION_KEYS = ['A', 'B', 'C', 'D'];
const META_COMMENTARY_PATTERNS = [
  /\bActually\b/i,
  /\bLet's fix\b/i,
  /\bI'll adjust\b/i,
  /\bWait\b/i,
  /\breconsider\b/i,
  /\bthe intended correct answer\b/i,
  /\bwe need to change\b/i,
  /\bthis question is wrong\b/i,
  /\bLet's replace\b/i,
  /\bI will correct\b/i,
  /\bBut wait\b/i,
  /\bHowever,\s+the answer should be\b/i,
];

const JSON_REPAIR_PROVIDER = String(process.env.JSON_REPAIR_PROVIDER || 'gemini').trim().toLowerCase();
const JSON_REPAIR_MODEL = process.env.JSON_REPAIR_MODEL || 'gemini-2.5-flash-lite';
const JSON_REPAIR_FALLBACK_MODEL = process.env.JSON_REPAIR_FALLBACK_MODEL || 'gpt-4o-mini';
const JSON_REPAIR_SECOND_FALLBACK_MODEL = process.env.JSON_REPAIR_SECOND_FALLBACK_MODEL || 'deepseek-chat';
const JSON_REPAIR_MAX_OUTPUT_TOKENS = Number(process.env.JSON_REPAIR_MAX_OUTPUT_TOKENS || 4000);
const JSON_REPAIR_TIMEOUT_MS = Number(process.env.JSON_REPAIR_TIMEOUT_MS || 30000);

const gemini = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const deepseek = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    })
  : null;

export async function repairGeneratedJson(rawOutput, context = {}) {
  const raw = String(rawOutput || '');
  const reasons = [];
  const codeRecovery = extractJsonCandidates(raw, context);
  const codeResult = normalizeRecoveredPayload(codeRecovery.payload, context, codeRecovery);

  console.log('[json_recovery]', {
    direct_parse_ok: codeRecovery.direct_parse_ok,
    extracted_objects: codeRecovery.extracted_objects,
    dropped_incomplete: codeResult.dropped_incomplete,
    dropped_meta_commentary: codeResult.dropped_meta_commentary,
    used_model_repair: false,
  });

  if (codeResult.questions.length > 0 || codeResult.passage_group) {
    return {
      ok: true,
      questions: codeResult.questions,
      passage_group: codeResult.passage_group,
      dropped_count: codeResult.dropped_count,
      repaired_count: codeResult.repaired_count,
      reasons: [...new Set([...reasons, ...codeRecovery.reasons, ...codeResult.reasons])],
      provider: 'code',
      model: 'deterministic',
      recovery: codeRecovery,
    };
  }

  const shouldRepair = context.allowModelRepair !== false && shouldCallModelRepair(raw, codeRecovery, context);
  if (!shouldRepair) {
    return {
      ok: false,
      questions: [],
      passage_group: null,
      dropped_count: codeResult.dropped_count,
      repaired_count: 0,
      reasons: [...new Set([...codeRecovery.reasons, ...codeResult.reasons, 'no_valid_complete_questions'])],
      provider: 'code',
      model: 'deterministic',
      recovery: codeRecovery,
    };
  }

  const repairOrder = buildRepairOrder();
  let lastError = null;
  for (let i = 0; i < repairOrder.length; i += 1) {
    const entry = repairOrder[i];
    if (i > 0) {
      console.warn('[json_repair_fallback]', {
        from_provider: repairOrder[i - 1].provider,
        to_provider: entry.provider,
        reason: lastError?.message || 'repair_failed',
      });
    }
    try {
      const repaired = await callRepairModel(entry, raw, context);
      const normalized = normalizeRecoveredPayload(repaired, context, { reasons: [] });
      console.log('[json_repair]', {
        provider: entry.provider,
        model: entry.model,
        input_chars: raw.length,
        repaired_count: normalized.repaired_count,
        dropped_count: normalized.dropped_count,
        ok: normalized.questions.length > 0 || Boolean(normalized.passage_group),
        reasons: normalized.reasons,
      });
      return {
        ok: normalized.questions.length > 0 || Boolean(normalized.passage_group),
        questions: normalized.questions,
        passage_group: normalized.passage_group,
        dropped_count: Number(repaired?.dropped_count || 0) + normalized.dropped_count,
        repaired_count: normalized.repaired_count,
        reasons: [...new Set([...(repaired?.repair_notes || []), ...normalized.reasons])],
        provider: entry.provider,
        model: entry.model,
        recovery: { ...codeRecovery, used_model_repair: true },
      };
    } catch (error) {
      lastError = error;
      console.warn('[json_repair]', {
        provider: entry.provider,
        model: entry.model,
        input_chars: raw.length,
        repaired_count: 0,
        dropped_count: 0,
        ok: false,
        reasons: [error.message],
      });
    }
  }

  return {
    ok: false,
    questions: [],
    passage_group: null,
    dropped_count: codeResult.dropped_count,
    repaired_count: 0,
    reasons: [...new Set([...codeRecovery.reasons, lastError?.message || 'repair_failed'])],
    provider: 'none',
    model: '',
    recovery: { ...codeRecovery, used_model_repair: true },
  };
}

export function extractJsonCandidates(rawOutput, context = {}) {
  const raw = String(rawOutput || '');
  const reasons = [];
  const direct = tryParseJson(raw);
  if (direct) {
    return {
      payload: direct,
      direct_parse_ok: true,
      extracted_objects: Array.isArray(direct?.questions) ? direct.questions.length : (Array.isArray(direct) ? direct.length : 1),
      dropped_incomplete: 0,
      dropped_meta_commentary: 0,
      reasons,
    };
  }

  const cleaned = sanitizeJsonText(raw);
  const directCleaned = tryParseJson(cleaned);
  if (directCleaned) {
    reasons.push('cleaned_json_parse');
    return {
      payload: directCleaned,
      direct_parse_ok: false,
      extracted_objects: Array.isArray(directCleaned?.questions) ? directCleaned.questions.length : (Array.isArray(directCleaned) ? directCleaned.length : 1),
      dropped_incomplete: 0,
      dropped_meta_commentary: 0,
      reasons,
    };
  }

  const objectCandidate = extractFirstCompleteJsonObject(cleaned);
  const parsedObject = tryParseJson(objectCandidate);
  if (parsedObject) {
    reasons.push('first_complete_json_object');
    return {
      payload: parsedObject,
      direct_parse_ok: false,
      extracted_objects: Array.isArray(parsedObject?.questions) ? parsedObject.questions.length : 1,
      dropped_incomplete: 0,
      dropped_meta_commentary: 0,
      reasons,
    };
  }

  const questionsBlock = extractQuestionsArrayBlock(cleaned);
  const parsedQuestionsBlock = tryParseJson(questionsBlock ? `{"questions":${questionsBlock}}` : '');
  if (parsedQuestionsBlock) {
    reasons.push('questions_array_block');
    return {
      payload: parsedQuestionsBlock,
      direct_parse_ok: false,
      extracted_objects: parsedQuestionsBlock.questions.length,
      dropped_incomplete: 0,
      dropped_meta_commentary: 0,
      reasons,
    };
  }

  const objects = extractTopLevelObjects(cleaned)
    .map((entry) => tryParseJson(entry))
    .filter(Boolean);
  if (objects.length > 0) {
    reasons.push('complete_object_stream');
    return {
      payload: { questions: objects },
      direct_parse_ok: false,
      extracted_objects: objects.length,
      dropped_incomplete: 0,
      dropped_meta_commentary: 0,
      reasons,
    };
  }

  return {
    payload: null,
    direct_parse_ok: false,
    extracted_objects: 0,
    dropped_incomplete: raw.includes('{') || raw.includes('[') ? 1 : 0,
    dropped_meta_commentary: 0,
    reasons: [...reasons, context.finish_reason === 'length' ? 'truncated_no_complete_objects' : 'parse_failed'],
  };
}

export function sanitizeQuestionCandidate(candidate, context = {}) {
  if (!candidate || typeof candidate !== 'object') {
    return { ok: false, reason: 'invalid_question_object', question: null };
  }
  if (hasInternalContradiction(candidate)) {
    return { ok: false, reason: 'answer_check_conflict', question: null };
  }
  if (containsMetaCommentary(candidate)) {
    return { ok: false, reason: 'meta_commentary_detected', question: null };
  }

  const options = normalizeOptions(candidate.o || candidate.options);
  const answer = normalizeAnswer(candidate.a || candidate.answer || candidate.correct_answer);
  const trapOption = normalizeAnswer(candidate.trap_option || candidate.trapOption);
  const strongDistractors = normalizeAnswerArray(candidate.strong_distractors || candidate.strongDistractors)
    .filter((key) => key !== answer)
    .slice(0, 2);
  const questionText = String(candidate.q || candidate.question || candidate.body || '').trim();

  if (!questionText || options.length !== 4 || !answer) {
    return { ok: false, reason: 'repaired_but_incomplete', question: null };
  }
  if (!trapOption || trapOption === answer || !OPTION_KEYS.includes(trapOption)) {
    return { ok: false, reason: 'invalid_trap_option', question: null };
  }
  if (strongDistractors.length < 2) {
    return { ok: false, reason: 'strong_distractors_invalid', question: null };
  }
  if (new Set(options.map((option) => option.trim().toLowerCase())).size !== 4) {
    return { ok: false, reason: 'duplicate_options', question: null };
  }

  const subject = String(candidate.subject || context.subject || '').trim();
  const chapter = String(candidate.chapter || context.chapter || '').trim();
  const conceptId = String(candidate.concept_id || context.concept_id || '').trim();
  const sanitized = {
    ...candidate,
    q: questionText,
    o: options,
    a: answer,
    question_type: String(candidate.question_type || context.question_type || 'statement_based').trim(),
    subject,
    chapter,
    concept_id: conceptId,
    trap_option: trapOption,
    strong_distractors: strongDistractors,
    answer_check: String(candidate.answer_check || candidate.explanation || '').trim(),
    json_repaired: context.json_repaired === true,
    repair_provider: context.repair_provider || candidate.repair_provider || '',
    repair_model: context.repair_model || candidate.repair_model || '',
  };

  if (!sanitized.q || !sanitized.subject || !sanitized.chapter || !sanitized.concept_id || !sanitized.answer_check) {
    return { ok: false, reason: 'generated_schema_minimal_missing_field', question: null };
  }

  return { ok: true, reason: '', question: sanitized };
}

export function containsMetaCommentary(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value || {});
  return META_COMMENTARY_PATTERNS.some((pattern) => pattern.test(text));
}

export function hasInternalContradiction(value) {
  const text = typeof value === 'string'
    ? value
    : [
        value?.answer_check,
        value?.explanation,
        ...(value?.distractor_rationale && typeof value.distractor_rationale === 'object'
          ? Object.values(value.distractor_rationale)
          : []),
      ].join(' ');
  return /\b(answer should be|correct answer should be|intended answer is|key should be|but the answer)\b/i.test(String(text || ''));
}

export function isStructurallyCompleteQuestion(q) {
  return sanitizeQuestionCandidate(q).ok;
}

export function isValidStandaloneGenerationShape(obj) {
  if (Array.isArray(obj)) return obj.every(isStructurallyCompleteQuestion);
  return Array.isArray(obj?.questions) && obj.questions.every(isStructurallyCompleteQuestion);
}

export function isValidPassageGroupShape(obj) {
  const group = obj?.passage_group || obj;
  if (!group || typeof group !== 'object') return false;
  const passageText = String(group.passage_text || '').trim();
  const questions = Array.isArray(group.questions) ? group.questions : [];
  return passageText.length > 0 && questions.length > 0 && questions.every(isStructurallyCompleteQuestion);
}

function normalizeRecoveredPayload(payload, context, recovery) {
  const reasons = [];
  let droppedCount = 0;
  let droppedIncomplete = recovery.dropped_incomplete || 0;
  let droppedMeta = recovery.dropped_meta_commentary || 0;
  const questions = [];
  let passageGroup = null;

  const addQuestion = (entry, extraContext = {}) => {
    const result = sanitizeQuestionCandidate(entry, { ...context, ...extraContext });
    if (result.ok) {
      questions.push(result.question);
      return;
    }
    droppedCount += 1;
    reasons.push(result.reason);
    if (result.reason === 'meta_commentary_detected') droppedMeta += 1;
    if (result.reason === 'repaired_but_incomplete') droppedIncomplete += 1;
  };

  const standalone = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.questions) ? payload.questions
    : payload && typeof payload === 'object' && (payload.q || payload.question || payload.body) ? [payload]
    : [];
  for (const entry of standalone) addQuestion(entry);

  if (payload?.passage_group) {
    const group = payload.passage_group;
    const passageText = String(group.passage_text || group.passage || group.text || '').trim();
    const children = Array.isArray(group.questions) ? group.questions : [];
    if (!passageText || children.length === 0) {
      droppedCount += Math.max(1, children.length);
      reasons.push('passage_group_missing_parent');
    } else {
      const childQuestions = [];
      for (const child of children) {
        const result = sanitizeQuestionCandidate({
          ...child,
          passage_id: child.passage_id || group.passage_id || 'passage_1',
          passage_text: child.passage_text || passageText,
          passage_type: child.passage_type || group.passage_type || context.passage_type || 'factual',
          passage_title: child.passage_title || group.title || '',
          temporary_group_key: child.temporary_group_key || group.temporary_group_key || group.passage_group_id || 'tmp_passage_1',
          is_passage_linked: true,
        }, context);
        if (result.ok) {
          childQuestions.push(result.question);
          questions.push(result.question);
        } else {
          droppedCount += 1;
          reasons.push(result.reason === 'repaired_but_incomplete' ? 'passage_child_missing_group' : result.reason);
        }
      }
      passageGroup = {
        ...group,
        passage_id: String(group.passage_id || 'passage_1'),
        passage_text: passageText,
        questions: childQuestions,
      };
    }
  }

  return {
    questions,
    passage_group: passageGroup,
    dropped_count: droppedCount,
    repaired_count: questions.length,
    dropped_incomplete: droppedIncomplete,
    dropped_meta_commentary: droppedMeta,
    reasons: [...new Set(reasons)],
  };
}

function shouldCallModelRepair(raw, recovery) {
  if (!raw.trim()) return false;
  if (recovery.extracted_objects > 0) return true;
  if (/"questions"\s*:/.test(raw)) return true;
  if (/"q"\s*:|question_type|trap_option|strong_distractors|passage_group/.test(raw)) return true;
  if (/```json|```/.test(raw)) return true;
  return false;
}

function buildRepairOrder() {
  const entries = [];
  if (JSON_REPAIR_PROVIDER === 'gemini') {
    entries.push({ provider: 'gemini', model: JSON_REPAIR_MODEL });
  }
  entries.push({ provider: 'openai', model: JSON_REPAIR_FALLBACK_MODEL });
  entries.push({ provider: 'deepseek', model: JSON_REPAIR_SECOND_FALLBACK_MODEL });
  return entries.filter((entry, index, array) => (
    entry.model && array.findIndex((candidate) => candidate.provider === entry.provider && candidate.model === entry.model) === index
  ));
}

async function callRepairModel(entry, raw, context) {
  if (entry.provider === 'gemini') return callGeminiRepair(entry.model, raw, context);
  if (entry.provider === 'openai') return callOpenAIRepair(entry.model, raw, context);
  if (entry.provider === 'deepseek') return callDeepSeekRepair(entry.model, raw, context);
  throw new Error(`unsupported_repair_provider:${entry.provider}`);
}

async function callGeminiRepair(modelName, raw, context) {
  if (!gemini) throw new Error('missing_gemini_api_key');
  const model = gemini.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0,
      maxOutputTokens: JSON_REPAIR_MAX_OUTPUT_TOKENS,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_REPAIR_SCHEMA,
    },
  });
  const result = await withTimeout(
    model.generateContent(buildRepairPrompt(raw, context)),
    JSON_REPAIR_TIMEOUT_MS,
    `gemini json repair timeout after ${JSON_REPAIR_TIMEOUT_MS}ms`,
  );
  const text = result?.response?.text?.() || '';
  const parsed = tryParseJson(text);
  if (!parsed) throw new Error('gemini_repair_invalid_json');
  return parsed;
}

async function callOpenAIRepair(modelName, raw, context) {
  if (!openai) throw new Error('missing_openai_api_key');
  const result = await withTimeout(
    openai.chat.completions.create({
      model: modelName,
      temperature: 0,
      max_tokens: JSON_REPAIR_MAX_OUTPUT_TOKENS,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'cuet_generation_json_repair',
          strict: true,
          schema: OPENAI_REPAIR_SCHEMA,
        },
      },
      messages: [
        { role: 'system', content: 'You are a strict JSON repair engine. Return JSON only. Do not create new questions.' },
        { role: 'user', content: buildRepairPrompt(raw, context) },
      ],
    }),
    JSON_REPAIR_TIMEOUT_MS,
    `openai json repair timeout after ${JSON_REPAIR_TIMEOUT_MS}ms`,
  );
  const text = result?.choices?.[0]?.message?.content || '';
  const parsed = tryParseJson(text);
  if (!parsed) throw new Error('openai_repair_invalid_json');
  return parsed;
}

async function callDeepSeekRepair(modelName, raw, context) {
  if (!deepseek) throw new Error('missing_deepseek_api_key');
  const result = await withTimeout(
    deepseek.chat.completions.create({
      model: modelName,
      temperature: 0,
      max_tokens: JSON_REPAIR_MAX_OUTPUT_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a strict JSON repair engine. Return json only. Do not create new questions.' },
        { role: 'user', content: buildRepairPrompt(raw, context) },
      ],
    }),
    JSON_REPAIR_TIMEOUT_MS,
    `deepseek json repair timeout after ${JSON_REPAIR_TIMEOUT_MS}ms`,
  );
  const text = result?.choices?.[0]?.message?.content || '';
  const parsed = tryParseJson(text);
  if (!parsed) throw new Error('deepseek_repair_invalid_json');
  return parsed;
}

function buildRepairPrompt(raw, context) {
  return `You are a strict JSON repair engine.

Your job is to convert raw model output into valid JSON matching the schema.

Rules:
1. Return JSON only.
2. Do not create new questions.
3. Do not improve quality.
4. Do not solve or re-answer questions.
5. Do not change the intended answer.
6. Do not fix factual errors.
7. Do not complete truncated questions.
8. Drop incomplete questions.
9. Drop contradictory questions.
10. Drop questions containing self-correction or meta-commentary.
11. Drop questions where answer key and explanation conflict.
12. Drop questions with missing options, duplicate options, invalid answer key, invalid trap option, or fewer than 2 strong distractors.
13. If no valid complete questions remain, return:
{"questions":[],"passage_group":null,"dropped_count":0,"repair_notes":["no_valid_complete_questions"]}

Raw output:
${raw.slice(0, 24000)}

Context:
subject=${context.subject || ''}
chapter=${context.chapter || ''}
generation_mode=${context.generation_mode || ''}
requires_passage=${context.requires_passage === true}`;
}

function sanitizeJsonText(text) {
  return String(text || '')
    .replace(/```json|```/gi, '')
    .replace(/\u0000/g, '')
    .trim();
}

function tryParseJson(text) {
  if (!String(text || '').trim()) return null;
  try {
    return JSON.parse(sanitizeJsonText(text));
  } catch {
    return null;
  }
}

function extractFirstCompleteJsonObject(text) {
  return extractBalanced(text, '{', '}');
}

function extractQuestionsArrayBlock(text) {
  const match = String(text || '').match(/"questions"\s*:\s*\[/);
  if (!match) return '';
  const start = match.index + match[0].lastIndexOf('[');
  return extractBalancedFromIndex(text, start, '[', ']');
}

function extractBalanced(text, open, close) {
  const start = String(text || '').indexOf(open);
  if (start === -1) return '';
  return extractBalancedFromIndex(text, start, open, close);
}

function extractBalancedFromIndex(text, start, open, close) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === open) depth += 1;
    if (ch === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return '';
}

function extractTopLevelObjects(text) {
  const objects = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== '{') continue;
    const objectText = extractBalancedFromIndex(text, i, '{', '}');
    if (!objectText) continue;
    if (/"q"\s*:|question_type|trap_option|strong_distractors|passage_text/.test(objectText)) {
      objects.push(objectText);
    }
    i += objectText.length - 1;
  }
  return objects;
}

function normalizeOptions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((option) => {
      if (typeof option === 'string') return stripOptionLabel(option);
      if (option && typeof option === 'object') return stripOptionLabel(option.text || option.value || option.option);
      return '';
    })
    .filter(Boolean)
    .slice(0, 4);
}

function stripOptionLabel(value) {
  return String(value || '').trim().replace(/^[A-D][).:\-\s]+/i, '').trim();
}

function normalizeAnswer(value) {
  const key = String(value || '').trim().toUpperCase();
  return OPTION_KEYS.includes(key) ? key : '';
}

function normalizeAnswerArray(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,/ ]+/);
  return [...new Set(raw.map(normalizeAnswer).filter(Boolean))];
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

const OPENAI_REPAIR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['questions', 'passage_group', 'dropped_count', 'repair_notes'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        required: ['q', 'o', 'a', 'question_type', 'subject', 'chapter', 'concept_id', 'trap_option', 'strong_distractors', 'answer_check'],
        properties: {
          q: { type: 'string' },
          o: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
          a: { type: 'string', enum: OPTION_KEYS },
          question_type: { type: 'string' },
          subject: { type: 'string' },
          chapter: { type: 'string' },
          concept_id: { type: 'string' },
          trap_option: { type: 'string', enum: OPTION_KEYS },
          strong_distractors: { type: 'array', items: { type: 'string', enum: OPTION_KEYS }, minItems: 2, maxItems: 2 },
          answer_check: { type: 'string' },
        },
      },
    },
    passage_group: { anyOf: [{ type: 'object' }, { type: 'null' }] },
    dropped_count: { type: 'integer' },
    repair_notes: { type: 'array', items: { type: 'string' } },
  },
};

const GEMINI_REPAIR_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    questions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          q: { type: SchemaType.STRING },
          o: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          a: { type: SchemaType.STRING, enum: OPTION_KEYS },
          question_type: { type: SchemaType.STRING },
          subject: { type: SchemaType.STRING },
          chapter: { type: SchemaType.STRING },
          concept_id: { type: SchemaType.STRING },
          trap_option: { type: SchemaType.STRING, enum: OPTION_KEYS },
          strong_distractors: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING, enum: OPTION_KEYS } },
          answer_check: { type: SchemaType.STRING },
        },
        required: ['q', 'o', 'a', 'question_type', 'subject', 'chapter', 'concept_id', 'trap_option', 'strong_distractors', 'answer_check'],
      },
    },
    passage_group: { type: SchemaType.OBJECT, nullable: true },
    dropped_count: { type: SchemaType.INTEGER },
    repair_notes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ['questions', 'passage_group', 'dropped_count', 'repair_notes'],
};
