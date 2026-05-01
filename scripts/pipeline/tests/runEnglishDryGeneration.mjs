import { getEnglishGenerationMode } from '../lib/englishGenerationMode.mjs';
import { normalizeGenerationPayload } from '../lib/passageNormalizer.mjs';
import { runSelfCheck, summarizeSelfCheckResults } from '../lib/selfCheck.mjs';

const passageText = `Cities rarely fail because people ignore every warning; they often fail because warnings arrive in a form that ordinary residents cannot use. A drainage map placed on a municipal website may satisfy a rule of disclosure, but it does not help a shopkeeper decide whether to move goods from a low shelf before the first heavy rain. This gap between information and usable guidance has become sharper as urban life has grown more dependent on digital notices. The problem is not that people lack intelligence or concern. It is that public communication often assumes that access to data is the same as understanding.

Some cities have begun to address this by pairing technical alerts with neighbourhood-level explanations. Instead of announcing a general flood advisory, they identify the lanes most likely to be affected, the likely time window, and the simple actions households can take. Such messages are not less scientific; they are science translated into decisions. The translation also builds trust, because residents can compare a warning with what they observe around them.

Still, communication cannot replace planning. If roads are poorly designed or drains remain blocked, even the clearest warning becomes a repeated apology. The strongest civic systems therefore combine long-term maintenance with timely, locally meaningful information. In that combination, citizens are treated not as passive receivers of orders but as partners who can act when guidance is clear.`;

const paraPayload = {
  questions: [
    {
      q: 'Rearrange the following sentences to form a coherent paragraph:\nA. This shift has made access easier, but it has also made sustained attention harder to protect.\nB. Schools therefore need to teach students how to pause, verify, and connect information before using it.\nC. Digital platforms now place large amounts of reading material before students at very low cost.\nD. Without such habits, abundance of information can become a reason for shallow understanding.',
      o: ['CABD', 'CADB', 'ACBD', 'CBAD'],
      a: 'A',
      difficulty: 'medium',
      question_type: 'para_jumble',
      subject: 'english',
      chapter: 'Para Jumbles',
      concept_id: 'english::para_jumbles',
      trap_option: 'B',
      strong_distractors: ['B', 'D'],
      ordering_logic: 'C introduces access, A qualifies it, B gives the institutional response, and D states the consequence.',
      distractor_rationale: { A: 'Correct because...', B: 'Trap because...', C: 'Wrong because...', D: 'Wrong but plausible because...' },
    },
  ],
};

const passagePayload = {
  passage_group: {
    passage_id: 'passage_1',
    title: 'Warnings That Can Be Used',
    passage_type: 'factual',
    passage_text: passageText,
    questions: [1, 2, 3, 4].map((index) => ({
      q: index === 1
        ? 'Which option best captures the central idea of the passage?'
        : index === 2
          ? 'What can be inferred about data-heavy public notices from the passage?'
          : index === 3
            ? 'As used in the passage, "translated" most nearly means:'
            : 'Which option best describes the author attitude toward public communication?',
      o: [
        'Useful civic information must connect technical knowledge with decisions residents can take.',
        'Useful civic information mainly means placing technical knowledge online for residents to find.',
        'Civic information is useful when residents receive more frequent technical warnings.',
        'Useful civic information works best when planning is replaced by resident-level decisions.',
      ],
      a: 'A',
      difficulty: 'medium',
      question_type: index === 1 ? 'central_idea' : index === 2 ? 'inference' : index === 3 ? 'vocabulary_in_context' : 'tone',
      subject: 'english',
      chapter: 'Narrative Passage',
      concept_id: 'english::narrative_passage',
      passage_id: 'passage_1',
      order_index: index,
      trap_option: 'B',
      strong_distractors: ['B', 'D'],
      distractor_rationale: { A: 'Correct because...', B: 'Trap because...', C: 'Wrong because...', D: 'Wrong but plausible because...' },
    })),
  },
};

function dryRun(chapter, payload) {
  const started = Date.now();
  const mode = getEnglishGenerationMode(chapter);
  const normalized = normalizeGenerationPayload(payload, { subject: 'english', chapter, passage_type: mode.passage_type });
  const checks = normalized.questions.map((question) => runSelfCheck(question, { subject: 'english', chapter, batchSize: normalized.questions.length }));
  const summary = summarizeSelfCheckResults(checks);
  const invalidPermutationCount = checks.filter((result) => result.reasons.includes('invalid_para_jumble_permutation')).length;
  const validatorSent = summary.passed;
  const miniAccepted = summary.passed;
  const durationMinutes = Math.max((Date.now() - started) / 60000, 1 / 60);
  const generatedPerMinute = normalized.questions.length / durationMinutes;
  return {
    chapter,
    generation_mode: mode.mode,
    raw_count: normalized.stats.raw_questions,
    passage_group_count: normalized.passageGroups.length,
    linked_questions: normalized.questions.filter((question) => question.passage_id || question.passage_group_id || question.temporary_group_key).length,
    normalized_count: normalized.questions.length,
    selfcheck_passed: summary.passed,
    validator_sent: validatorSent,
    invalid_permutation_count: invalidPermutationCount,
    mini_accepted: miniAccepted,
    mini_borderline: 0,
    strict_sent: 0,
    final_publish_count: mode.requires_passage ? (miniAccepted >= 3 ? miniAccepted : 0) : miniAccepted,
    publishable_group_if_3_plus: mode.requires_passage ? miniAccepted >= 3 : null,
    draft_count: normalized.questions.length - miniAccepted,
    generated_per_minute: Number(generatedPerMinute.toFixed(1)),
    projected_candidates_per_hour: Number((generatedPerMinute * 60).toFixed(0)),
  };
}

console.log(JSON.stringify([
  dryRun('Para Jumbles', paraPayload),
  dryRun('Narrative Passage', passagePayload),
], null, 2));
