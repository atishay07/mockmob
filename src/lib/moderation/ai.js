// FIX 6 (Critical): enforce a hard timeout on the LLM call so a
// hanging request never leaves a job stuck in 'processing' forever.
// The AbortController aborts the in-flight HTTP request; the error
// propagates to the worker, which then writes a retry record.

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a strict question quality evaluator for a competitive exam preparation platform (MockMob), specifically focused on the CUET (Common University Entrance Test) for 12th-grade level students.

Your job is to evaluate uploaded practice questions, validate correctness, and return a structured JSON assessment.

CRITICAL VALIDATION LAYER:
1. Correctness: Verify the correct_answer is truly correct given the body and options. If incorrect, mark as "REJECT" or provide "fixed_fields".
2. Ambiguity: If the question or options are ambiguous, provide "fixed_fields" to resolve it.
3. Clarity: Improve wording if it is awkward or unclear.
4. Syllabus Alignment: The question must align with the CUET 12th-grade syllabus.
5. Difficulty Calibration:
   - Easy: foundational but still conceptually relevant. Never trivial one-step recall.
   - Medium: true CUET level with application or multi-step reasoning.
   - Hard: 10-20% above typical CUET PYQ level, with deeper twists, traps, or edge cases.
6. Pattern Alignment: The question should feel like a real CUET PYQ or a strong CUET mock, not workbook filler.

Tiering rules:
- "REJECT": factually incorrect, off-syllabus, trivial, misclassified in difficulty, or not CUET-aligned.
- "C": potentially salvageable but has major clarity/ambiguity issues.
- "B": solid question but needs minor wording/explanation refinement.
- "A": high quality, clear, accurate, CUET-aligned, and correctly calibrated.

Respond ONLY with valid JSON matching this exact shape:
{
  "tier": "A" | "B" | "C" | "REJECT",
  "score": <float 0-10>,
  "difficulty_correct": <boolean>,
  "cuet_alignment": <boolean>,
  "issues": [<string>, ...],
  "ai_score": <float 0-1>,
  "clarity_score": <float 0-1>,
  "syllabus_relevance_score": <float 0-1>,
  "answerability_score": <float 0-1>,
  "explanation_quality_score": <float 0-1>,
  "duplicate_risk_score": <float 0-1>,
  "difficulty_confidence": <float 0-1>,
  "recommended_difficulty": "easy" | "medium" | "hard",
  "reason_codes": [<string>, ...],
  "validation_note": <string>,
  "fixed_fields": {
    "body": <string or null>,
    "options": <array of {key, text} or null>,
    "correct_answer": <string or null>,
    "explanation": <string or null>
  }
}

You MUST set:
- "difficulty_correct" to false if the stated difficulty label is wrong.
- "cuet_alignment" to false if the item does not match CUET phrasing, depth, or style.
- "tier" to "REJECT" when score < 7, difficulty_correct is false, or cuet_alignment is false.

Set "fixed_fields" properties to null unless you are suggesting a specific improvement.
reason_codes are short lowercase_snake_case labels.`

const MOCK_PARSED = {
  tier:                        'B',
  score:                       8.7,
  difficulty_correct:          true,
  cuet_alignment:              true,
  issues:                      ['mocked_response'],
  ai_score:                    0.87,
  clarity_score:               0.90,
  syllabus_relevance_score:    0.85,
  answerability_score:         0.90,
  explanation_quality_score:   0.70,
  duplicate_risk_score:        0.10,
  difficulty_confidence:       0.80,
  recommended_difficulty:      'medium',
  reason_codes:                ['mocked_response'],
  validation_note:             'Mock moderation response.',
  fixed_fields: {
    body: null,
    options: null,
    correct_answer: null,
    explanation: null,
  },
}

export async function callModerationLLM(question, { timeoutMs = 28_000 } = {}) {
  if (process.env.MOCK_AI === 'true') {
    return {
      parsed:       MOCK_PARSED,
      raw:          JSON.stringify(MOCK_PARSED),
      processingMs: 0,
      modelUsed:    'mock',
    }
  }

  const userMessage = buildUserMessage(question)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('LLM call timed out')), timeoutMs)

  const startMs = Date.now()
  try {
    const response = await client.messages.create(
      {
        model:      'claude-sonnet-4-6',
        max_tokens: 700,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userMessage }],
      },
      { signal: controller.signal }
    )

    const raw = response.content[0]?.text ?? ''
    const parsed = parseJsonSafe(raw)

    return { parsed, raw, processingMs: Date.now() - startMs, modelUsed: response.model }
  } finally {
    clearTimeout(timer)
  }
}

function buildUserMessage(q) {
  const optionsText = Array.isArray(q.options)
    ? q.options.map((option) => `  ${option.key}: ${option.text}`).join('\n')
    : '(open-ended, no options)'

  return [
    `Subject: ${q.subject}`,
    `Chapter: ${q.chapter}`,
    `Stated difficulty: ${q.difficulty}`,
    '',
    'Question:',
    q.body,
    '',
    'Options:',
    optionsText,
    '',
    `Correct answer: ${q.correct_answer}`,
    '',
    'Explanation:',
    q.explanation ?? '(none provided)',
  ].join('\n')
}

function parseJsonSafe(text) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null

  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}
