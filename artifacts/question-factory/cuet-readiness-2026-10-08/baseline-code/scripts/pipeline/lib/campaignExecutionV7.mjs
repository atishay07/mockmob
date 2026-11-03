// Unreleased campaigns may be measured in separate staging; they can never publish.
export function registrationPolicy({measurementOnly=false,staging=false,releaseAvailable=false,capUsd=4}={}) {
  if (!staging) throw Error('explicit_separate_staging_required');
  if (!Number.isFinite(capUsd)||capUsd<=0||capUsd>10) throw Error('bounded_campaign_cap_required');
  if (!releaseAvailable&&!measurementOnly) throw Error('current_cuet_fit_release_required');
  return {measurement_only:measurementOnly,publication_policy:measurementOnly?'never':'released_staging_only',cap_usd:capUsd};
}
export function executionPolicy(profile,{measurementOnly=false,staging=false,publish=false,releaseAvailable=false}={}) {
  if(profile.measurement_only===true) {
    if(!measurementOnly||!staging||profile.publication_policy!=='never') throw Error('explicit_measurement_staging_required');
    if(publish) throw Error('measurement_campaign_cannot_publish');
    return true;
  }
  if(measurementOnly) throw Error('registered_campaign_mode_cannot_change');
  if(!releaseAvailable) throw Error('current_calibration_required');
  return true;
}
export function assertPublicationPolicy(profile) {
  if(profile.measurement_only===true||profile.publication_policy==='never') throw Error('measurement_campaign_cannot_publish');
}
export function campaignCommittedMicro(ledger,candidateIds) {
  const ids=new Set(candidateIds);
  const meta=ledger.db.prepare("SELECT reservation_id,json_extract(request_json,'$.config.candidate_id') candidate_id FROM provider_requests UNION ALL SELECT reservation_id,json_extract(request_json,'$.config.candidate_id') FROM provider_batches").all();
  const reservations=new Set(meta.filter(r=>ids.has(r.candidate_id)).map(r=>r.reservation_id));
  return ledger.db.prepare('SELECT id,state,reserved,actual FROM requests').all().filter(r=>reservations.has(r.id)).reduce((sum,r)=>sum+(r.state==='settled'?(r.actual||0):Math.max(r.reserved,r.actual||0)),0);
}
export function assertCampaignBudget(committedMicro,maximumNextMicro,capUsd) {
  if(!Number.isSafeInteger(committedMicro)||committedMicro<0||!Number.isSafeInteger(maximumNextMicro)||maximumNextMicro<=0||!Number.isFinite(capUsd)||capUsd<=0)throw Error('campaign_budget_bound_required');
  if(committedMicro+maximumNextMicro>Math.floor(capUsd*1e6))throw Error('campaign_budget_exhausted');
}
export function requestNeedsReservation(ledger,key) {
  if(!key)return true;
  const request=ledger.db.prepare('SELECT state FROM provider_requests WHERE id=?').get(key);
  if(request)return ['credit_refused','flex_unavailable'].includes(request.state);
  if(ledger.db.prepare('SELECT state FROM provider_batches WHERE id=?').get(key))return false;
  return !ledger.getCache(`response:${key}`);
}
export function maximumRequestMicro(provider,body,prices,{batch=false}={}) {
  const model={openai:'gpt-6-luna',gemini:'gemini-3.8-flash',anthropic:'claude-haiku-5-5'}[provider],price=prices.models?.[model],rates=batch?price?.batch:price;
  const output=provider==='openai'?body.max_output_tokens:provider==='anthropic'?body.max_tokens:body.generationConfig?.maxOutputTokens;
  if(!price||!rates||!Number.isSafeInteger(price.max_input_tokens)||!Number.isSafeInteger(output)||!Number.isFinite(rates.input_per_million)||!Number.isFinite(rates.output_per_million))throw Error('campaign_budget_bound_required');
  return Math.ceil(price.max_input_tokens*Math.max(rates.input_per_million,rates.cache_write_per_million||0)+output*rates.output_per_million);
}
