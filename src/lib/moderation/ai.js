// FIX 6 (Critical): enforce a hard timeout on the LLM call so a
// hanging request never leaves a job stuck in 'processing' forever.
// The AbortController aborts the in-flight HTTP request; the error
// propagates to the worker, which then writes a retry record.

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a strict question quality evaluator for a competitive exam preparation platform (MockMob), specifically focused on the CUET (Common University Entrance Test) for 12th-grade level students.

Your job is to evaluate uploaded practice questions, VALIDATE their correctness, and return a structured JSON assessment.

CRITICAL VALIDATION LAYER:
1. Correctness: Verify the correct_answer is truly correct given the body and options. If incorrect, mark as "REJECT" or provide "fixed_fields".
2. Ambiguity: If the question or options are ambiguous, provide a "fixed_fields" object to resolve it.
3. Clarity: Improve the wording of the body or explanation if it is awkward or unclear.
4. Syllabus Alignment: The question MUST perfectly align with the CUET 12th-grade curriculum. It must NOT be a generic 10th-grade or 11th-grade question unless it is explicitly part of the CUET syllabus.
5. Difficulty Threshold: The question can be easy, but it MUST meet the minimum difficulty threshold of the easiest actual CUET exam question.

Tiering rules (apply strictly):
- "REJECT": Factually incorrect, totally off-syllabus (e.g. 10th-grade), or nonsensical.
- "C": Potentially salvageable but has major clarity/ambiguity issues.
- "B": Solid question but needs minor wording/explanation refinement.
- "A": High quality — perfectly accurate, clear, and syllabus-aligned.

Respond ONLY with a valid JSON object matching this exact shape:
{
  "tier": "A" | "B" | "C" | "REJECT",
  "ai_score": <float 0-1>,
  "clarity_score": <float 0-1>,
  "syllabus_relevance_score": <float 0-1>,
  "answerability_score": <float 0-1>,
  "explanation_quality_score": <float 0-1>,
  "duplicate_risk_score": <float 0-1>,
  "difficulty_confidence": <float 0-1>,
  "recommended_difficulty": "easy" | "medium" | "hard",
  "reason_codes": [<string>, ...],
  "validation_note": <string explaining any fixes or issues>,
  "fixed_fields": {
    "body": <string or null>,
    "options": <array of {key, text} or null>,
    "correct_answer": <string or null>,
    "explanation": <string or null>
  }
}

Set "fixed_fields" properties to null unless you are suggesting a specific improvement.
reason_codes are short lowercase_snake_case labels, e.g. ["clear_question","fixed_ambiguity","factually_incorrect"]`

// Fixed mock parsed object — field names match what process/route.js and
// tiering.js read (flat, not nested). Values taken from the spec example.
const MOCK_PARSED = {
  tier:                        'B',
  ai_score:                    0.87,
  clarity_score:               0.90,
  syllabus_relevance_score:    0.85,
  answerability_score:         0.90,
  explanation_quality_score:   0.70,
  duplicate_risk_score:        0.10,
  difficulty_confidence:       0.80,
  recommended_difficulty:      'medium',
  reason_codes:                ['mocked_response'],
}

/**
 * @param {object} question
 * @param {{ timeoutMs?: number }} options
 * timeoutMs defaults to 28 000 ms — below the 35 s job-level timeout
 * so the worker always has time to write the retry record before the
 * outer job timeout fires.
 *
 * Set MOCK_AI=true to skip the real API call and return a fixed response.
 */
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
        max_tokens: 512,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userMessage }],
      },
      { signal: controller.signal }
    )

    const raw    = response.content[0]?.text ?? ''
    const parsed = parseJsonSafe(raw)

    return { parsed, raw, processingMs: Date.now() - startMs, modelUsed: response.model }
  } finally {
    clearTimeout(timer)
  }
}

function buildUserMessage(q) {
  const optionsText = Array.isArray(q.options)
    ? q.options.map(o => `  ${o.key}: ${o.text}`).join('\n')
    : '(open-ended, no options)'

  return [
    `Subject: ${q.subject}`,
    `Chapter: ${q.chapter}`,
    `Stated difficulty: ${q.difficulty}`,
    ``,
    `Question:`,
    q.body,
    ``,
    `Options:`,
    optionsText,
    ``,
    `Correct answer: ${q.correct_answer}`,
    ``,
    `Explanation:`,
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
