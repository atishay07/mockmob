// Mob v3 live rooms, Phase B (MOB-BUILD-SPEC-V3 sections 2.4, 3.2, 4 and 6). Pure: the numbers and the payload contract
// that the server, the web and the app share. The database keeps the same numbers in 20261020100400_mob_v3_live.sql
// (a test reads both and keeps them equal).
//   - One private Realtime channel per room: topic mob-room:<game id>. Access is by a ticket the API issues.
//   - Clients send presence only, { m, st, v }. Every other event comes from the server and carries no name, no mark,
//     no pick and no right or wrong (F1, section 6 item 10).
//   - A lobby nobody starts closes after 15 minutes; then the game is simply a 24-hour game.
//   - At most MOB_LIVE_MAX_ROOMS rooms (default 30, so 150 connections at 5 a room) are open across MockMob at once.
export const TOPIC_PREFIX = 'mob-room:';
export const LOBBY_MINUTES = 15;
export const COUNTDOWN_MS = 4000;
export const LIVE_JOIN_GRACE_S = 30;
export const TICKET_MAX_MINUTES = 45;
export const TICKET_TAIL_MINUTES = 5;
export const ROOM_SEATS = 5;
export const DEFAULT_MAX_ROOMS = 30;

export const topicFor = (gameId) => `${TOPIC_PREFIX}${gameId}`;

/** MOB_LIVE_MAX_ROOMS as a whole number of rooms (0 turns new rooms off: every open gets LIVE_BUSY). */
export function maxRooms(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return DEFAULT_MAX_ROOMS;
  const n = Number(String(raw).trim());
  return Number.isInteger(n) && n >= 0 && n <= 500 ? n : DEFAULT_MAX_ROOMS;
}

// The server's events and the only keys each may carry (section 4.4).
export const BROADCASTS = Object.freeze({
  'room.start': Object.freeze(['startsAt']),
  progress: Object.freeze(['m', 'q', 'done']),
  'room.done': Object.freeze([]),
  'room.cancel': Object.freeze([]),
  sticker: Object.freeze(['m', 'k']),
});
export const BROADCAST_KEYS = Object.freeze(['m', 'q', 'done', 'k', 'startsAt']);
const MEMBER_RE = /^[0-9A-Z]{12}$/;

/** True when a server broadcast has exactly its event's keys, with values of the right kind. */
export function broadcastOk(event, payload) {
  const keys = BROADCASTS[event];
  if (!keys || !payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const have = Object.keys(payload).sort();
  if (have.length !== keys.length || !keys.every((k) => have.includes(k))) return false;
  if ('m' in payload && !MEMBER_RE.test(payload.m)) return false;
  if ('q' in payload && !(Number.isInteger(payload.q) && payload.q >= 1 && payload.q <= 20)) return false;
  if ('done' in payload && typeof payload.done !== 'boolean') return false;
  if ('startsAt' in payload && !Number.isFinite(Date.parse(payload.startsAt))) return false;
  if ('k' in payload && typeof payload.k !== 'string') return false;
  return true;
}

export const PRESENCE_STATES = Object.freeze(['here', 'ready']);

/**
 * A presence payload a client may send, and every client applies before showing it: exactly { m, st, v: 1 }, with m one
 * of the room's member ids. Anything else is ignored, so a stray key can never carry a name or a mark.
 */
export function presenceOk(payload, memberIds) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const keys = Object.keys(payload).sort();
  if (keys.join(',') !== 'm,st,v') return false;
  if (payload.v !== 1 || !PRESENCE_STATES.includes(payload.st) || !MEMBER_RE.test(payload.m)) return false;
  const ids = memberIds instanceof Set ? memberIds : new Set(memberIds || []);
  return ids.has(payload.m);
}

/**
 * What a room needs now (the SQL mob_room_tidy does the same): 'cancel' for a lobby nobody started within 15 minutes,
 * 'done' for a running room past its end, else null. g: { room_state, opened_at, room_ends_at } (ISO or ms).
 */
export function roomTidy(g, now) {
  if (!g || !g.room_state) return null;
  const t = (v) => (typeof v === 'number' ? v : Date.parse(v));
  if (g.room_state === 'lobby' && now >= t(g.opened_at) + LOBBY_MINUTES * 60_000) return 'cancel';
  if (g.room_state === 'running' && g.room_ends_at && now >= t(g.room_ends_at)) return 'done';
  return null;
}

/** When a ticket issued at `now` expires: the room's end (or 45 minutes, whichever is sooner) plus 5 minutes. */
export function ticketExpiry(now, roomEndsAt = null) {
  const cap = now + TICKET_MAX_MINUTES * 60_000;
  const end = roomEndsAt ? Math.min(Date.parse(roomEndsAt), cap) : cap;
  return end + TICKET_TAIL_MINUTES * 60_000;
}
