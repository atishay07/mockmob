import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Generates 3-5 original variants from a base PYQ.
 */
export async function generateVariants(baseQuestion, count = 3) {
  const prompt = `
    You are a creative CUET content developer. 
    Take the following Previous Year Question (PYQ) and generate ${count} ORIGINAL variants.

    BASE QUESTION:
    ${JSON.stringify(baseQuestion, null, 2)}

    RULES for Variants:
    1. Change the numerical values or specific scenarios.
    2. Maintain the same conceptual difficulty and CUET level.
    3. Ensure each variant has a unique body and correct answer.
    4. Provide explanations for each.
    5. The variants must be different enough to not be caught by deduplication (change wording/numbers).

    OUTPUT FORMAT (JSON ARRAY ONLY):
    [
      {
        "subject": "...",
        "chapter": "...",
        "body": "...",
        "options": [...],
        "correct_answer": "...",
        "explanation": "...",
        "difficulty": "...",
        "tags": ["variant", "topic"]
      },
      ...
    ]
  `;

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].text;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found in LLM response');
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Variant generation error:', error);
    return [];
  }
}
