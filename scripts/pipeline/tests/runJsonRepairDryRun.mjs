import { repairGeneratedJson } from '../lib/jsonRepair.mjs';
import { runSelfCheck, summarizeSelfCheckResults } from '../lib/selfCheck.mjs';
import { generateQuestions } from '../lib/llm.mjs';

function validQuestion(overrides = {}) {
  return {
    q: 'Read the statements about Boolean algebra. Statement I: The complement of a sum becomes the product of complements. Statement II: The complement of a product becomes the sum of complements. Statement III: De Morgan laws mainly apply to decimal arithmetic. Choose the correct option.',
    o: [
      'I and II only',
      'II and III only',
      'I and III only',
      'I, II and III',
    ],
    a: 'A',
    question_type: 'statement_based',
    subject: 'computer_science',
    chapter: 'Boolean Algebra',
    concept_id: 'computer_science::boolean_algebra',
    trap_option: 'B',
    strong_distractors: ['B', 'C'],
    answer_check: 'A is correct because Statements I and II follow De Morgan logic while III misuses arithmetic.',
    ...overrides,
  };
}

const passageText = `Cities rarely fail because people ignore every warning; they often fail because warnings arrive in a form that ordinary residents cannot use. A drainage map placed on a municipal website may satisfy a rule of disclosure, but it does not help a shopkeeper decide whether to move goods from a low shelf before the first heavy rain. This gap between information and usable guidance has become sharper as urban life has grown more dependent on digital notices. The problem is not that people lack intelligence or concern. It is that public communication often assumes that access to data is the same as understanding.

Some cities have begun to address this by pairing technical alerts with neighbourhood-level explanations. Instead of announcing a general flood advisory, they identify the lanes most likely to be affected, the likely time window, and the simple actions households can take. Such messages are not less scientific; they are science translated into decisions. The translation also builds trust, because residents can compare a warning with what they observe around them.

Still, communication cannot replace planning. If roads are poorly designed or drains remain blocked, even the clearest warning becomes a repeated apology. The strongest civic systems therefore combine long-term maintenance with timely, locally meaningful information. In that combination, citizens are treated not as passive receivers of orders but as partners who can act when guidance is clear.`;

async function runRepairCase(caseName, raw, context = {}) {
  const result = await repairGeneratedJson(raw, {
    subject: 'computer_science',
    chapter: 'Boolean Algebra',
    concept_id: 'computer_science::boolean_algebra',
    generation_mode: null,
    allowModelRepair: false,
    ...context,
  });
  const checks = result.questions.map((question) => runSelfCheck(question, {
    subject: question.subject,
    chapter: question.chapter,
  }));
  const summary = summarizeSelfCheckResults(checks);
  return {
    case_name: caseName,
    direct_parse_ok: result.recovery?.direct_parse_ok === true,
    repair_used: result.provider !== 'code',
    repaired_count: result.repaired_count,
    dropped_count: result.dropped_count,
    selfcheck_passed: summary.passed,
    validator_sent: summary.passed,
    reasons: result.reasons,
  };
}

const rawCases = [
  ['flash_valid_json', JSON.stringify({ questions: [validQuestion()] })],
  ['flash_commentary_before_json', `Here is the JSON:\n${JSON.stringify({ questions: [validQuestion()] })}`],
  ['flash_commentary_inside_question', JSON.stringify({ questions: [validQuestion({ q: 'Actually, let us fix this before final output.' })] })],
  ['flash_truncated_output', `{"questions":[${JSON.stringify(validQuestion())},{"q":"unfinished","o":["A"`],
  ['pro_reasoning_content_only', JSON.stringify({ questions: [validQuestion()] })],
  ['passage_group_response', JSON.stringify({
    passage_group: {
      passage_id: 'passage_1',
      title: 'Warnings That Can Be Used',
      passage_type: 'factual',
      passage_text: passageText,
      questions: [1, 2, 3, 4].map((index) => validQuestion({
        q: index === 1 ? 'Which option best captures the central idea of the passage?' : `Which inference follows from the passage detail ${index}?`,
        subject: 'english',
        chapter: 'Narrative Passage',
        concept_id: 'english::narrative_passage',
        question_type: index === 1 ? 'central_idea' : 'inference',
        passage_id: 'passage_1',
        order_index: index,
        answer_check: 'The answer is supported by the passage and cannot be chosen without reading it.',
      })),
    },
  })],
];

const repairResults = [];
for (const [caseName, raw] of rawCases) {
  repairResults.push(await runRepairCase(caseName, raw, caseName.includes('passage')
    ? { subject: 'english', chapter: 'Narrative Passage', concept_id: 'english::narrative_passage', generation_mode: 'passage_rc', requires_passage: true }
    : {}));
}

async function runGenerationDryRun(subject, chapter, count = 3) {
  const startedAt = Date.now();
  const result = await generateQuestions(subject, chapter, count, {});
  const questions = Array.isArray(result) ? result : [];
  const checks = questions.map((question) => runSelfCheck(question, { subject: subject.id, chapter, batchSize: questions.length }));
  const summary = summarizeSelfCheckResults(checks);
  return {
    subject: subject.id,
    chapter,
    ok: Array.isArray(result),
    error: Array.isArray(result) ? null : result?.reason || result?.error || 'generation_failed',
    normalized_count: questions.length,
    selfcheck_passed: summary.passed,
    validator_sent: summary.passed,
    duration_ms: Date.now() - startedAt,
  };
}

const generationSubjects = [
  [{ id: 'computer_science', name: 'Computer Science' }, 'Boolean Algebra'],
  [{ id: 'english', name: 'English' }, 'Para Jumbles'],
  [{ id: 'english', name: 'English' }, 'Narrative Passage'],
  [{ id: 'physics', name: 'Physics' }, 'Electromagnetic Induction'],
];

const generationResults = [];
if (process.env.SKIP_LIVE_GENERATION_DRY_RUN !== 'true') {
  for (const [subject, chapter] of generationSubjects) {
    generationResults.push(await runGenerationDryRun(subject, chapter, 3));
  }
}

console.log(JSON.stringify({
  repair_cases: repairResults,
  generation_dry_run: generationResults,
}, null, 2));
