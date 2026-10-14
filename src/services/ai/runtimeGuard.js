import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { classifyGuardMessage } from './providerCore';
export async function reserveRuntime({ requestKey, provider, model, messages, maxTokens }) {
  if (!/^[a-zA-Z0-9_:-]{12,180}$/.test(requestKey || '')) throw new Error('stable_request_key_required');
  // UTF-8 bytes plus per-message overhead conservatively bound input tokenization.
  const inputBound = Buffer.byteLength(JSON.stringify(messages),'utf8') + messages.length * 64;
  const { data, error } = await supabaseAdmin().rpc('reserve_runtime_ai', { p_key:requestKey,p_provider:provider,p_model:model,p_input_bound:inputBound,p_output_bound:maxTokens });
  if (error) {
    // The guard raises one exception per rule (monthly cap, paused or unfunded, no fresh price). Keep which one,
    // so a caller can tell "this month's AI budget is used up" from "the service is paused" from a price gap.
    throw Object.assign(new Error('runtime_ai_funding_or_verified_prices_unavailable'), { kind: classifyGuardMessage(`${error.message || ''} ${error.details || ''} ${error.hint || ''}`) });
  }
  return data;
}
export async function receiptRuntime(requestKey, cost, receipt) {
  const { error } = await supabaseAdmin().rpc('receipt_runtime_ai',{ p_key:requestKey,p_cost:cost,p_receipt:receipt });
  if (error) throw new Error('runtime_receipt_failed');
}
