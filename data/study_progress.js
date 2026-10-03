// UI claims are projections of server records, never counters supplied by a browser.
const timestamp = value => typeof value === 'number' ? value : Date.parse(value);
export const studyDay = time => new Date(time + 330 * 60000).toISOString().slice(0, 10);
const serverScored = attempt => ['server_snapshot_v1', 'server_practice_v1'].includes(attempt.selectionMeta?.scoringVersion);
export function tonightMetadata(input, now = Date.now()) {
  if (!/^[a-zA-Z0-9_-]{12,100}$/.test(input.tonightKey || '') || ![10,20,30].includes(Number(input.tonightMinutes))) return {};
  if (input.mode !== 'quick' || Number(input.count) !== (Number(input.tonightMinutes) === 10 ? 10 : 20)) return {};
  return { tonight: { key: input.tonightKey, minutes: Number(input.tonightMinutes), day: studyDay(now) } };
}
export function tonightCompletion(attempts, now = Date.now()) {
  const day = studyDay(now);
  const completed = attempts.filter(a => serverScored(a) && a.selectionMeta?.tonight?.day === day &&
    /^[a-zA-Z0-9_-]{12,100}$/.test(a.selectionMeta.tonight.key || '') &&
    [10,20,30].includes(a.selectionMeta.tonight.minutes) && Number.isFinite(timestamp(a.completedAt)) && timestamp(a.completedAt) <= now)
    .sort((a,b) => timestamp(b.completedAt)-timestamp(a.completedAt))[0];
  return completed ? { state:'recorded', sessionId:completed.id, minutes:completed.selectionMeta.tonight.minutes,
    completedAt:completed.completedAt, reviewMinutes:completed.selectionMeta.tonight.minutes === 30 ? 10 : 0 } : { state:'ready' };
}
export function studyMilestones(attempts, episodes) {
  const first = attempts.filter(a => serverScored(a) && Number.isFinite(timestamp(a.completedAt)))
    .sort((a,b) => timestamp(a.completedAt)-timestamp(b.completedAt) || String(a.id).localeCompare(String(b.id)))[0];
  const fresh = episodes.find(e => !['blocked_content','invalidated'].includes(e.state) && e.sampleSize >= 1);
  return [
    ...(first ? [{kind:'first_session', title:'Your first server-scored session is recorded.', href:`/result/${encodeURIComponent(first.id)}`, detail:'A step taken. Review its answers when you are ready.'}] : []),
    ...(fresh ? [{kind:'first_fresh_check', title:'A fresh delayed check passed.', href:'/progress', detail:'Evidence for this concept, not a score-gain claim.'}] : []),
  ];
}
