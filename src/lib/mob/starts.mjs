// Free and Pro start rules (MOB-BUILD-SPEC-V3 3.3, D133, C-dec 2 items 2 and 3). Pure: the server calls it on every
// start with facts it read itself (billing flag, isPremium, claim and mics under the Mob lock). Nothing from the client.
//   billing off            anyone starts anything (via 'open')
//   Pro                    starts anything (via 'pro')
//   Free, async, unused    one 24-hour Sprint or Round per Mob per IST week (via 'free_weekly'); a rematch counts
//   Free with a mic        a passed mic allows any build-1 format and a race, live included (via 'mic')
//   Full mock together     Pro only, with billing on or off (owner D174, 20 Oct; D167; spec 1.2 "Pro formats"): never the
//                          free start, never a mic, never 'open'. Free sees it, locked (starts.locked), and sits every mock a
//                          Pro friend starts for 50 credits (src/lib/mob/mockPrice.mjs); Pro sits free.
// Joining and playing are never gated here (a Full mock together's sitting is priced in mockPrice.mjs, not refused here).
import { mockStartView } from './mockPrice.mjs';

export const FREE_FORMATS = Object.freeze(['sprint', 'round', 'rematch', 'race']);
export const FORMATS = Object.freeze(['sprint', 'round', 'rematch', 'race', 'mock']);
export const PRO_ONLY_FORMATS = Object.freeze(['mock']);
export const MODES = Object.freeze(['live', 'async']);
export const MICS_PER_WEEK = 2;
export const MAX_OPEN_GAMES = 3;
export const LIVE_HOURS = Object.freeze({ from: 6, to: 23 }); // 6:00 AM to 11:00 PM IST (C-dec 2 item 4)

/** { ok: true, via } or { ok: false, code }. */
export function startRight({ billingOn, pro, mode, format, claimUsed, micsHeld, liveOn, inLiveHours }) {
  if (mode === 'live' && !liveOn) return { ok: false, code: 'LIVE_OFF' };
  if (mode === 'live' && !inLiveHours) return { ok: false, code: 'LIVE_HOURS' };
  // Full mock together: a Pro member starts it, whatever the billing switch says (owner D174).
  if (PRO_ONLY_FORMATS.includes(format) && pro !== true) return { ok: false, code: 'MOCK_PRO_REQUIRED' };
  if (!billingOn) return { ok: true, via: 'open' };
  if (pro) return { ok: true, via: 'pro' };
  if (mode === 'async' && FREE_FORMATS.includes(format) && !claimUsed) return { ok: true, via: 'free_weekly' };
  if (micsHeld > 0) return { ok: true, via: 'mic' };
  if (mode === 'live') return { ok: false, code: claimUsed ? 'START_PRO' : 'START_FORMAT' };
  return { ok: false, code: 'START_USED' };
}

/** The hour (0-23) in IST of `now` (ms). */
export const istHour = (now) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(new Date(now)));
export const inLiveHours = (now) => { const h = istHour(now); return h >= LIVE_HOURS.from && h < LIVE_HOURS.to; };

/**
 * The `starts` block of the den view (3.1). facts: { billingOn, pro, claimUsed, micsHeld, micsGiven, liveOn, hoursOk }.
 * Never names a plan; micsToGive only for Pro (and only the student sees it).
 */
export function startsView(facts) {
  const view = startsViewAll(facts);
  // starts.mock: your price and whether you may start one (owner D174), only while the formats are on.
  if (facts.formatsOn !== false) return { ...view, mock: mockStartView({ pro: facts.pro }) };
  // Races and Full mock together are off (MOB_FORMATS_ENABLED): the picker shows the question games only.
  const only = (list) => list.filter((f) => !NEW_FORMATS.includes(f));
  return { ...view, formats: only(view.formats), locked: only(view.locked) };
}
export const NEW_FORMATS = Object.freeze(['race', 'mock']);

function startsViewAll({ billingOn, pro, claimUsed, micsHeld, micsGiven = 0, liveOn }) {
  const liveModes = liveOn ? ['live', 'async'] : ['async'];
  const locked = [...PRO_ONLY_FORMATS];
  const notPro = FORMATS.filter((f) => !PRO_ONLY_FORMATS.includes(f));
  // Billing off: anyone starts the question games and races; Full mock together still needs Pro (owner D174).
  if (!billingOn) return { billingOn: false, can: true, via: 'open', modes: liveModes, formats: pro ? [...FORMATS] : notPro, locked: pro ? [] : [...PRO_ONLY_FORMATS], freeLeft: null, mics: 0, micsToGive: null };
  if (pro) return { billingOn: true, can: true, via: 'pro', modes: liveModes, formats: [...FORMATS], locked: [], freeLeft: null, mics: 0, micsToGive: Math.max(0, MICS_PER_WEEK - micsGiven) };
  if (!claimUsed) return { billingOn: true, can: true, via: 'free_weekly', modes: micsHeld > 0 ? liveModes : ['async'], formats: ['sprint', 'round', 'race'], locked, freeLeft: 1, mics: micsHeld };
  if (micsHeld > 0) return { billingOn: true, can: true, via: 'mic', modes: liveModes, formats: notPro, locked, freeLeft: 0, mics: micsHeld };
  return { billingOn: true, can: false, reason: 'used', modes: [], formats: [], locked: ['race', ...PRO_ONLY_FORMATS], freeLeft: 0, mics: 0 };
}
