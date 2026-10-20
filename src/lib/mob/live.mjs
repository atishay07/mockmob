// Mob v3 live rooms, Phase B (MOB-BUILD-SPEC-V3 sections 2.4, 3.2, 4 and 6). Pure: the numbers and the payload contract
// that the server, the web and the app share. The database keeps the same numbers in 20261020100400_mob_v3_live.sql
// (a test reads both and keeps them equal).
//   - One private Realtime channel per room: topic mob-room:<game id>. Access is by a ticket the API issues.
//   - Clients send NOTHING on the channel (L-55, 20 Oct): presence goes through POST /room/presence and the server
//     broadcasts presence { m, st }. Every event comes from the server and carries no name, no mark, no pick and no right
//     or wrong (F1, section 6 item 10). The room's roster is the members heard from in the last ROSTER_SECONDS.
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
  presence: Object.freeze(['m', 'st']),
});
export const BROADCAST_KEYS = Object.freeze(['m', 'q', 'done', 'k', 'startsAt', 'st']);
// A race's pool or a full mock reaches 60 questions; progress q is how many are answered (a race) or the question number.
export const MAX_Q = 60;
export const ROSTER_SECONDS = 45;
export const PRESENCE_SENT = Object.freeze(['here', 'ready', 'left']);
const MEMBER_RE = /^[0-9A-Z]{12}$/;

// Supabase Realtime adds its own message id to every payload realtime.send delivers (seen on staging, 20 Oct): a random
// uuid with nothing about anyone. Clients accept it and ignore it; the SQL never sends it.
const TRANSPORT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True when a server broadcast has exactly its event's keys, with values of the right kind. With { delivered: true } (a
 * payload as a client receives it), Realtime's own `id` is allowed beside them.
 */
export function broadcastOk(event, payload, { delivered = false } = {}) {
  const keys = BROADCASTS[event];
  if (!keys || !payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (delivered && 'id' in payload) {
    if (!TRANSPORT_ID_RE.test(String(payload.id))) return false;
    const { id: _transportId, ...rest } = payload;
    payload = rest;
  }
  const have = Object.keys(payload).sort();
  if (have.length !== keys.length || !keys.every((k) => have.includes(k))) return false;
  if ('m' in payload && !MEMBER_RE.test(payload.m)) return false;
  if ('q' in payload && !(Number.isInteger(payload.q) && payload.q >= 1 && payload.q <= MAX_Q)) return false;
  if ('st' in payload && !PRESENCE_SENT.includes(payload.st)) return false;
  if ('done' in payload && typeof payload.done !== 'boolean') return false;
  if ('startsAt' in payload && !Number.isFinite(Date.parse(payload.startsAt))) return false;
  if ('k' in payload && typeof payload.k !== 'string') return false;
  return true;
}

export const PRESENCE_STATES = Object.freeze(['here', 'ready']);

/**
 * A presence entry as the room shows it: exactly { m, st, v: 1 }, with m one of the room's member ids. Anything else is
 * ignored, so a stray key can never carry a name or a mark. (Since L-55 no client sends presence on the channel; the
 * clients still apply this to anything that arrives.)
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

/**
 * The roster as the API sends it: [{ memberId, st }] from mob_room_roster rows [{ m, st }], members of the room only, in
 * the order of `memberIds` (the Mob's member list), so every device lists the room the same way.
 */
export function rosterOut(rows, memberIds) {
  const order = [...(memberIds || [])];
  const at = new Map(order.map((m, i) => [m, i]));
  return (Array.isArray(rows) ? rows : []).filter((r) => r && MEMBER_RE.test(r.m) && at.has(r.m) && PRESENCE_STATES.includes(r.st))
    .sort((a, b) => at.get(a.m) - at.get(b.m)).map((r) => ({ memberId: r.m, st: r.st }));
}
