import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { bodyCandidateId } from './scopedAccounting.mjs';
import { createKeyedCost } from './cuetPilotV75Run.mjs';
import { assertCampaignBudget, maximumRequestMicro, requestNeedsReservation } from './campaignExecutionV7.mjs';
import { BatchPending } from './factoryTransportV713.mjs';

export function createCampaignGuardV713({ ledger, native, campaignId, candidateIds, capUsd, prices,
  keys, onKey = () => {}, stopRequested = () => false }) {
  if (!(capUsd > 0 && capUsd <= 3)) throw Error('v713_campaign_cap_at_most_3');
  const scoped = new Set(candidateIds), prefix = `${campaignId}:`, cost = createKeyedCost(ledger.db, keys);
  const remember = key => { if (!keys.has(key)) { keys.add(key); onKey(key); } };
  return { cost, async generate(provider, body, options = {}) {
    if (!['openai', 'gemini'].includes(provider) || !options.key || (body.tools || []).length || options.toolCalls) throw Error('v713_unbounded_call');
    const id = bodyCandidateId(provider, body);
    if (!scoped.has(id)) throw Error('v713_candidate_outside_registration');
    const key = hashJSON({ campaign: campaignId, parent: options.key }), batch = provider === 'gemini';
    const pending = ledger.db.prepare('SELECT state,provider_id FROM provider_batches WHERE id=?').get(key);
    if (pending && ['queued', 'submitted'].includes(pending.state)) {
      if (!pending.provider_id && pending.state !== 'queued') throw Error('v713_accepted_batch_id_missing');
      remember(key); throw new BatchPending(key, options.stage);
    }
    const accepted = ledger.db.prepare('SELECT state FROM provider_requests WHERE id=?').get(key);
    if ((pending && ['dispatching', 'unresolved'].includes(pending.state)) ||
        (accepted && ['dispatching', 'unresolved'].includes(accepted.state))) throw Error('v713_uncertain_request_never_resubmit');
    if (requestNeedsReservation(ledger, key)) {
      if (stopRequested()) throw Error('study_draining_stop');
      // Reserve at standard full bounds for cap planning; native batch/flex settlement may be lower.
      assertCampaignBudget(cost.committedMicro(), maximumRequestMicro(provider, body, prices()), capUsd);
    }
    remember(key);
    return native.generate(provider, body, { ...options, key, batch, purpose: 'candidate', candidate_id: prefix + id });
  } };
}
