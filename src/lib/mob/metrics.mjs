// The Mob block on /admin/funnel (SOCIAL-SPEC section 13). PURE: it turns mob_metrics' aggregate counts into lines an
// admin reads, and applies the spec's stop rule. No user ids or names ever reach it. A group under MIN_REPORTABLE (5) is
// shown as "fewer than 5", never as a rate (P8). Observational counts with selection bias: never a causal claim (rule 38).
export const MIN_REPORTABLE = 5;
// The stop rule: more than 2 reports per 100 members in a week, or a 7-day leave rate over 40%, pauses invites
// (MOB_INVITES_ENABLED=false) and the owner is told.
export const STOP_REPORTS_PER_100 = 2;
export const STOP_LEAVE_RATE = 0.4;

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const pct = (k, of) => Math.round((k / of) * 1000) / 10;

/** A share over a group, or a suppressed group: { k, of, pct } | { of, suppressed: true }. */
export function share(k, of) {
  if (of < MIN_REPORTABLE) return { of, suppressed: true };
  return { k, of, pct: pct(k, of) };
}

/**
 * raw: mob_metrics' answer. Returns { week, rows: [{ label, value, note }], stop: { tripped, reasons } }.
 * Every value is a string an admin can read without a legend.
 */
export function summariseMobMetrics(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const active = n(r.active_mobs);
  const membersActive = n(r.members_in_active);
  const members = n(r.members);
  const few = () => `fewer than ${MIN_REPORTABLE}`;
  const perMob = (sat) => (active < MIN_REPORTABLE ? few() : String(Math.round((sat / active) * 10) / 10));
  const late = share(n(r.late_7d), n(r.sittings_7d));
  const leave = share(n(r.left_within_7d), n(r.joined_cohort));
  const reportsPer100 = members < MIN_REPORTABLE ? null : Math.round((n(r.reports_7d) / members) * 1000) / 10;
  const blocksPer100 = members < MIN_REPORTABLE ? null : Math.round((n(r.blocks_7d) / members) * 1000) / 10;
  const show = (s) => (s.suppressed ? few() : `${s.pct}% (${s.k} of ${s.of})`);
  const rows = [
    { label: 'Active Mobs', value: active < MIN_REPORTABLE ? few() : String(active), note: 'Mobs with 2 or more members' },
    { label: 'Members', value: members < MIN_REPORTABLE ? few() : String(members), note: membersActive >= MIN_REPORTABLE ? `${membersActive} in active Mobs` : 'in any Mob' },
    { label: 'Papers sat per active Mob, this week', value: perMob(n(r.sat_this_week)), note: 'the leading metric; the week runs Monday to Sunday, IST' },
    { label: 'Papers sat per active Mob, last week', value: perMob(n(r.sat_last_week)), note: 'a whole week, for comparison' },
    { label: 'Left within 7 days of joining', value: show(leave), note: 'members who joined 7 to 14 days ago' },
    { label: 'Reports per 100 members, last 7 days', value: reportsPer100 === null ? few() : String(reportsPer100), note: `${n(r.reports_7d) < MIN_REPORTABLE ? few() : n(r.reports_7d)} reports` },
    { label: 'Blocks per 100 members, last 7 days', value: blocksPer100 === null ? few() : String(blocksPer100), note: 'Leave and block' },
    { label: 'Sat between 11 PM and 5 AM, last 7 days', value: show(late), note: 'late-night share of Mob papers' },
    { label: 'Credits spent on weekly and extra Mob papers', value: '0', note: 'They cost no credits, on any plan. A Free member pays 50 to sit a Full mock together, charged as a Full mock' },
  ];
  const reasons = [];
  if (reportsPer100 !== null && reportsPer100 > STOP_REPORTS_PER_100) reasons.push(`Reports are ${reportsPer100} per 100 members this week, over ${STOP_REPORTS_PER_100}.`);
  if (!leave.suppressed && leave.k / leave.of > STOP_LEAVE_RATE) reasons.push(`${leave.pct}% left within 7 days of joining, over ${STOP_LEAVE_RATE * 100}%.`);
  return { week: typeof r.week === 'string' ? r.week.slice(0, 10) : null, rows, stop: { tripped: reasons.length > 0, reasons } };
}
