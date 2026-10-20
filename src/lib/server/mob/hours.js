// Mob hours (D173 item 1, D174; MOB-V4-BUILD.md item 2): the den's "study time together" block. No 'server-only' and no '@/'
// imports, so node:test drives it (data/tests/mob_hours_1020.test.mjs). The numbers come from one database read
// (public.mob_hours, migration 20261020150000_mob_hours) that already holds only members who SHARE their study time and have at
// least a minute this week; this file only names them and shapes the payload. User ids never leave the server: members are
// addressed by memberId.
//
// The contract (docs/brain/APP-API-CONTRACT.md, "Mob hours"), the optional `hours` object on the den's `v3` block:
//   hours: { week_start, target_minutes, total_minutes, me_sharing, members: [{ member_id, first_name, minutes, goal_days }],
//            top_member_id, studying_now: [{ member_id, first_name, since }] }
// Absent when the database has not shipped it (migration missing, any read failure): the app then hides every hours element.
// A Mob where nobody shares still gets `hours` (target 0, total 0, members []) so the app can offer the switch.
export const HOURS_TARGET_PER_MEMBER = 150; // minutes a week for each member who shares
export const HOURS_CAP_SECONDS = 180; // one answered question counts at most 3 minutes (the database applies it)

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;
const whole = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0);

/**
 * raw: what public.mob_hours returned { week_start, sharing, me_sharing, rows: [{ user_id, minutes, goal_days }],
 *      studying: [{ user_id, since }] }, or null (the caller is not in the Mob).
 * members: Map user id -> { memberId, name } (the Mob's current members); only these can appear.
 * Returns the `hours` object, or null when there is nothing true to say.
 */
export function hoursView(raw, members) {
  if (!raw || typeof raw !== 'object' || !(members instanceof Map)) return null;
  const week = String(raw.week_start || '').slice(0, 10);
  if (!WEEK_RE.test(week)) return null;
  const named = (userId) => members.get(userId) || null;
  const rows = (Array.isArray(raw.rows) ? raw.rows : [])
    .map((r) => ({ m: named(r?.user_id), minutes: whole(r?.minutes), goalDays: Math.min(7, whole(r?.goal_days)) }))
    // Never a member with 0 minutes, never one the Mob no longer has.
    .filter((r) => r.m && r.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
  const list = rows.map((r) => ({ member_id: r.m.memberId, first_name: r.m.name, minutes: r.minutes, goal_days: r.goalDays }));
  // One crown, never a rank below it: nobody is crowned for a week with one sharer or a tie at the top.
  const top = rows.length >= 2 && rows[0].minutes > rows[1].minutes ? rows[0].m.memberId : null;
  const studying = [];
  for (const s of Array.isArray(raw.studying) ? raw.studying : []) {
    const m = named(s?.user_id);
    const at = Date.parse(s?.since);
    if (m && Number.isFinite(at)) studying.push({ member_id: m.memberId, first_name: m.name, since: new Date(at).toISOString() });
  }
  return {
    week_start: week,
    target_minutes: HOURS_TARGET_PER_MEMBER * whole(raw.sharing),
    total_minutes: list.reduce((n, r) => n + r.minutes, 0),
    me_sharing: raw.me_sharing === true,
    members: list,
    top_member_id: top,
    studying_now: studying,
  };
}

/**
 * The den's hours or null. `read` is the service's one-call helper (a thrown MobError and a missing function both mean "not
 * shipped": the answer is null and the den goes on without it).
 */
export async function readHours(read, { userId, mobId, week, nowIso, members }) {
  try {
    return hoursView(await read('mob_hours', { p_user_id: userId, p_mob_id: mobId, p_week: week, p_now: nowIso }), members);
  } catch {
    return null;
  }
}
