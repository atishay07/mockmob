import { canonicalQuestion, contentHash } from '../../../data/content_evidence.js';
import { hashJSON, inventoryFingerprint,isEvidenceManaged } from '../../../data/question_factory_policy.mjs';

export function mechanicalScreen(rows) {
  const seen = new Map();
  return rows.map(row => {
    const q = canonicalQuestion(row), findings = [];
    if (!row.id || !q.body.trim() || q.options.length !== 4 || q.options.some(o => typeof o.text !== 'string' || !o.text.trim())) findings.push('invalid_structure');
    if(!q.subject || !q.chapter || !row.difficulty)findings.push('missing_mapping_or_difficulty');
    if (!/^[ABCD]$/.test(q.key) || new Set(q.options.map(o => o.key)).size !== 4 || !q.options.some(o => o.key === q.key)) findings.push('invalid_key');
    if (new Set(q.options.map(o => o.text?.trim().toLowerCase())).size !== 4) findings.push('duplicate_options');
    if (!q.explanation.trim()) findings.push('missing_explanation');
    if ((row.passage_group_id || row.passage_id || row.is_passage_linked || row.route === 'passage') && !q.passage.trim()) findings.push('broken_passage');
    if (row.verification_state === 'disputed' || ['quarantined', 'invalid', 'rejected', 'pending'].includes(row.status)) findings.push('existing_hold');
    if (isEvidenceManaged(row)) findings.push('evidence_managed_use_full_gate');
    const fp = inventoryFingerprint(row);
    if (seen.has(fp)) findings.push(`duplicate:${seen.get(fp)}`); else seen.set(fp, row.id);
    return { question_id: row.id, content_hash: contentHash(row), review_version: 'subscription-screen-v1', reviewed_at: new Date().toISOString(), scope: 'local_mechanical',
      local_findings: findings, agent_findings: [], verdict: findings.length ? 'suspect' : 'no_issue_found' };
  });
}
export function reviewBundles(rows, receipts, { samplePerChapter = 10, includeAll = false, sources = {} } = {}) {
  const byId = new Map(receipts.map(r => [r.question_id, r]));
  const ordered = rows.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const chapterCount = new Map();
  const samples = [];
  // Round-robin formats so a chapter sample does not consist only of direct recall.
  const groups = new Map();
  for (const q of ordered) {
    const chapter = `${q.subject}:${q.chapter}`, format = q.question_type || q.route || 'unknown';
    if (!groups.has(chapter)) groups.set(chapter, new Map());
    const formats = groups.get(chapter); if (!formats.has(format)) formats.set(format, []); formats.get(format).push(q);
  }
  for (const [chapter, formats] of groups) {
    const lists = [...formats.values()];
    for (let i = 0; (chapterCount.get(chapter) || 0) < samplePerChapter && lists.some(v => v[i]); i++) {
      for (const list of lists) { if (list[i] && (chapterCount.get(chapter) || 0) < samplePerChapter) { samples.push(list[i].id); chapterCount.set(chapter, (chapterCount.get(chapter) || 0) + 1); } }
    }
  }
  const sampled = new Set(samples);
  const selected = ordered.filter(q => !isEvidenceManaged(q) && (includeAll || byId.get(q.id)?.local_findings.length || sampled.has(q.id)))
    .sort((a, b) => Number(Boolean(byId.get(b.id)?.local_findings.length)) - Number(Boolean(byId.get(a.id)?.local_findings.length)) || String(a.id).localeCompare(String(b.id)));
  const bundles = [];
  for (let i = 0; i < selected.length; i += 20) {
    const questions = selected.slice(i, i + 20).map(q => ({ id: q.id, content_hash: contentHash(q), question: canonicalQuestion(q),
      local_findings: byId.get(q.id)?.local_findings || [], sources: (q.source_refs || []).map(ref => ({ ...ref, text: sources[ref.id]?.facts?.[ref.locator]?.text || null })) }));
    bundles.push({ id: hashJSON(questions), version: 'subscription-screen-v1', api_spend_usd: 0, questions });
  }
  return bundles;
}
export function importSubscriptionReview(bundle, response, currentRows, localReceipts) {
  if (response?.bundle_id !== bundle.id || !Array.isArray(response.findings)) throw new Error('review_bundle_mismatch');
  const expected = new Map(bundle.questions.map(q => [q.id, q]));
  const current = new Map(currentRows.map(q => [q.id, q]));
  const local = new Map(localReceipts.map(r => [r.question_id, r]));
  const findings = new Map();
  for (const f of response.findings) {
    if (!expected.has(f.question_id) || findings.has(f.question_id) || !['no_issue_found', 'suspect', 'incomplete'].includes(f.verdict) || typeof f.reason !== 'string' || !f.reason.trim()) throw new Error('invalid_review_findings');
    if (f.content_hash !== expected.get(f.question_id).content_hash) throw new Error('review_hash_mismatch');
    findings.set(f.question_id, f);
  }
  return bundle.questions.map(q => {
    const row = current.get(q.id), base = local.get(q.id), f = findings.get(q.id);
    if (!row || contentHash(row) !== q.content_hash || base?.content_hash !== q.content_hash) throw new Error('review_snapshot_stale');
    return { ...base, scope: 'subscription_academic', reviewed_at: new Date().toISOString(), reviewer: response.reviewer || 'subscription',
      bundle_id: bundle.id, agent_findings: f ? [f.reason] : ['Reviewer omitted this question'],
      verdict: !f || f.verdict==='incomplete' ? 'incomplete' : base.local_findings.length ? 'suspect' : f.verdict };
  });
}
export function subscriptionEnvironment(env) {
  const safe = { ...env };
  for (const key of Object.keys(safe)) if (/API_KEY|API_TOKEN|ACCESS_TOKEN|SECRET|BEARER|OPENAI_BASE|ANTHROPIC_BASE|AZURE_|AWS_|GOOGLE_APPLICATION_CREDENTIALS|SUPABASE|CUET_|MODEL_PROVIDER|CODEX_CONFIG/i.test(key)) delete safe[key];
  return safe;
}
export function assertIncludedSubscription(status) {
  if(status?.account?.type!=='chatgpt')throw new Error('subscription_login_required_no_api_fallback');
  const limits=status.rateLimitsByLimitId?.codex || status.rateLimits;
  const credits=limits?.credits;
  // Subscription login alone cannot prevent purchased-credit consumption. If
  // credits exist, or their state is unknown, use the manual bridge and pause.
  if(!credits || credits.hasCredits!==false || credits.unlimited!==false || Number(credits.balance)!==0)throw new Error('included_usage_credit_isolation_required');
  if(!Number.isFinite(limits.primary?.usedPercent) || [limits.primary,limits.secondary].filter(Boolean).some(w=>w.usedPercent>=100) || limits.rateLimitReachedType || limits.spendControlReached)throw new Error('subscription_limit_pause');
  return {auth:'chatgpt',paid_credits:0,checked_at:new Date().toISOString()};
}
export const SUBSCRIPTION_REVIEW_SCHEMA = { type: 'object', additionalProperties: false, required: ['bundle_id', 'reviewer', 'findings'], properties: {
  bundle_id: { type: 'string' }, reviewer: { type: 'string' }, findings: { type: 'array', items: { type: 'object', additionalProperties: false,
    required: ['question_id', 'content_hash', 'verdict', 'reason'], properties: { question_id: { type: 'string' }, content_hash: { type: 'string' }, verdict: { type: 'string', enum: ['no_issue_found', 'suspect', 'incomplete'] }, reason: { type: 'string' } } } }
} };
