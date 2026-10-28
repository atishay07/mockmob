import { hashJSON } from '../../../data/question_factory_policy.mjs';
// Preserve hash-bound prices and request ceiling. Compact the actual full body rather than raising the guard.
export function costProfileV713(prices) {
  if (!prices?.models?.['gpt-6-luna']?.flex || !prices.models['gemini-3.8-flash']?.batch) throw Error('v713_verified_discount_rates_required');
  return { version: 'v713-luna-flex-gemini-native-batch', pricing_hash: hashJSON(prices),
    stages: { authoring: 'openai_flex', blind_solution: 'openai_flex', independent_evaluation: 'gemini_batch',
      explanation_support: 'openai_flex', repair: 'openai_flex' },
    target_per_publishable_usd: 0.01, target_per_10000_usd: 100,
    rates_are_estimates_until_receipts: true, lifetime_limit_usd: 50,
    input_byte_bounds: Object.fromEntries(['gpt-6-luna', 'gemini-3.8-flash'].map(m => [m, prices.models[m].max_input_tokens])) };
}
