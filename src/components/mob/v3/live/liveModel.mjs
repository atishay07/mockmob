// Mob v3 live rooms on the website, Phase B (MOB-BUILD-SPEC-V3 4.1 to 4.5, 5.3 L1, L2, R1, R5, R6, 5.6 M2, M3, M6, M12).
// Pure: the room's state machine, what a presence or a broadcast may carry, the countdown on the server clock, the
// live ruler and every sentence. The components only draw, and the channel is an adapter (Supabase or a fake).
//
// Safety (spec 4.2 item 4, 4.4 and 6 items 2, 9 and 10):
//   - Clients send presence only: exactly { m, st, v: 1 }. Nothing else ever leaves this page on the channel.
//   - A broadcast is applied only when it is one of the five server events with exactly its own keys. A payload
//     with a pick, a name, a mark or right or wrong is dropped whole, never "cleaned".
//   - Presence is shown only as Host, Here and Ready, and only inside the room. Nobody absent is named.
//   - "Still playing" names only members present in the room; nothing counts who has not played.
import { clock, joinNames, when } from '../play/playModel.mjs';

export const TOPIC_PREFIX = 'mob-room:';
export const topicFor = (gameId) => `${TOPIC_PREFIX}${gameId}`;

// The server's numbers (spec 4.5, SV-16; the server keeps the same in src/lib/mob/live.mjs on its branch).
export const LOBBY_MINUTES = 15;
export const LIVE_JOIN_GRACE_MS = 30_000;
export const IDLE_DROP_MS = 10 * 60_000;
export const ROOM_SEATS = 5;
export const STICKERS_MAX = 3;
export const STICKER_HOLD_MS = 1800 + 300;

// The countdown (M3): beats every 600 ms, Go lands on startsAt, the stage leaves 600 ms after Go.
export const BEAT_MS = 600;
export const COUNT_FROM = 3;
export const GO_HOLD_MS = 600;

export const LIVE_EVENTS = Object.freeze(['room.start', 'progress', 'room.done', 'room.cancel', 'sticker']);
const EVENT_KEYS = Object.freeze({
  'room.start': ['startsAt'],
  progress: ['done', 'm', 'q'],
  'room.done': [],
  'room.cancel': [],
  sticker: ['k', 'm'],
});
export const LOBBY_STICKERS = Object.freeze(['good_luck', 'lets_go', 'one_sec', 'ready']);
export const STICKER_WORDS = Object.freeze({
  good_luck: 'Good luck', lets_go: "Let's go", one_sec: 'One sec', ready: 'Ready',
  nice_one: 'Nice one', so_close: 'So close', teach_me: 'Teach me', again: 'Again?',
});
export const PRESENCE_STATES = Object.freeze(['here', 'ready']);

const memberSet = (ids) => (ids instanceof Set ? ids : new Set(ids || []));
const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

// ---------------------------------------------------------------------------------------------------
// What may travel on the channel
// ---------------------------------------------------------------------------------------------------

/** The only thing this page sends: { m, st, v: 1 }. */
export function presencePayload(memberId, st) {
  if (!PRESENCE_STATES.includes(st)) throw new Error('presence state');
  return { m: String(memberId), st, v: 1 };
}

/** True for a presence payload with exactly { m, st, v: 1 } and m one of the Mob's members. */
export function presenceOk(payload, memberIds) {
  if (!isObj(payload)) return false;
  const keys = Object.keys(payload).sort().join(',');
  if (keys !== 'm,st,v') return false;
  if (payload.v !== 1 || !PRESENCE_STATES.includes(payload.st) || typeof payload.m !== 'string') return false;
  return memberSet(memberIds).has(payload.m);
}

/**
 * Read Supabase's presenceState() ({ key: [metas] }, each meta our payload plus `presence_ref`) into a Map of
 * memberId -> 'here' | 'ready'. Ready wins over here for the same member (two tabs). Anything else is ignored.
 */
export function readPresence(state, memberIds) {
  const out = new Map();
  if (!isObj(state)) return out;
  for (const [key, metas] of Object.entries(state)) {
    for (const meta of Array.isArray(metas) ? metas : []) {
      if (!isObj(meta)) continue;
      const { presence_ref: _ref, ...payload } = meta;
      if (!presenceOk(payload, memberIds) || payload.m !== key) continue;
      if (out.get(payload.m) !== 'ready') out.set(payload.m, payload.st);
    }
  }
  return out;
}

/** True when a server broadcast is one of the five events with exactly its keys and values of the right kind. */
export function eventOk(event, payload, memberIds) {
  const keys = EVENT_KEYS[event];
  if (!keys) return false;
  const p = payload === undefined || payload === null ? {} : payload;
  if (!isObj(p)) return false;
  if (Object.keys(p).sort().join(',') !== keys.join(',')) return false;
  if ('m' in p && !memberSet(memberIds).has(p.m)) return false;
  if ('q' in p && !(Number.isInteger(p.q) && p.q >= 0 && p.q <= 20)) return false;
  if ('done' in p && typeof p.done !== 'boolean') return false;
  if ('startsAt' in p && !(typeof p.startsAt === 'string' && Number.isFinite(Date.parse(p.startsAt)))) return false;
  if ('k' in p && !Object.hasOwn(STICKER_WORDS, p.k)) return false;
  return true;
}

// ---------------------------------------------------------------------------------------------------
// The room's state machine
// ---------------------------------------------------------------------------------------------------
/*
 * phase:
 *   connecting  the ticket is on its way
 *   lobby       L1: presence, ready-up, stickers
 *   countdown   L2 / M3: room.start arrived; Go lands on startsAt
 *   live        R1 to R6 with the live ruler
 *   cancelled   the host closed the room (room.cancel), or you did
 *   away        10 quiet minutes in the lobby dropped the channel
 *   off         the server said no (LIVE_OFF, NOT_LIVE, GAME_CLOSED, LIVE_HOURS): play it anytime
 *   fallback    the channel failed before the start (CHANNEL_ERROR, TIMED_OUT): play it anytime
 *   failed      the ticket did not arrive (offline, a server error): try again
 * busy is true once the channel fails during the countdown or the run: the run goes on without live updates.
 */
export function initialRoom({ youId = null, hostId = null } = {}) {
  return {
    phase: 'connecting', youId, hostId, startsAt: null, presence: new Map(), seen: new Set(), progress: new Map(),
    seq: 0, done: false, busy: false, connected: false, stickers: [], toasts: [], notice: null, cancelledBy: null, stickerSeq: 0,
  };
}

const START_PHASES = new Set(['connecting', 'lobby']);

export function roomReducer(state, action) {
  switch (action?.type) {
    case 'ticket': {
      const room = action.room || {};
      const next = { ...state, youId: action.memberId ?? state.youId, hostId: room.hostMemberId ?? state.hostId };
      if (room.state === 'running' && room.startsAt) {
        const sinceGo = (action.serverNowMs ?? 0) - Date.parse(room.startsAt);
        return { ...next, startsAt: room.startsAt, phase: sinceGo >= GO_HOLD_MS ? 'live' : 'countdown', counted: sinceGo < GO_HOLD_MS };
      }
      if (room.state === 'done') return { ...next, phase: 'live', done: true };
      if (room.state === 'cancelled') return { ...next, phase: 'cancelled', cancelledBy: next.hostId };
      return { ...next, phase: 'lobby' };
    }
    case 'refused':
      return { ...state, phase: 'off', notice: action.message || null };
    case 'failed':
      return { ...state, phase: 'failed', notice: action.message || null };
    case 'status': {
      if (action.status === 'SUBSCRIBED') return { ...state, connected: true };
      if (!['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(action.status)) return state;
      if (state.phase === 'away' || state.phase === 'cancelled' || state.phase === 'off') return state;
      if (action.status === 'CLOSED' && !state.connected) return state;
      if (START_PHASES.has(state.phase)) return { ...state, connected: false, phase: 'fallback' };
      return { ...state, connected: false, busy: true };
    }
    case 'presence': {
      const presence = readPresence(action.state, action.members);
      const seen = new Set(state.seen);
      for (const id of presence.keys()) seen.add(id);
      return { ...state, presence, seen };
    }
    case 'event':
      return applyEvent(state, action.event, action.payload, action.members);
    case 'self': {
      // Your own answer, acknowledged by the API (the server's progress broadcast may come later or not at all).
      return withProgress(state, state.youId, action.q, action.done);
    }
    case 'started':
      // The host's own /room/start reply: the same as the broadcast, in case it lags.
      return applyEvent(state, 'room.start', { startsAt: action.startsAt }, null);
    case 'go':
      return state.phase === 'countdown' ? { ...state, phase: 'live' } : state;
    case 'idle':
      return state.phase === 'lobby' ? { ...state, phase: 'away', connected: false } : state;
    case 'rejoin':
      return { ...initialRoom({ youId: state.youId, hostId: state.hostId }) };
    case 'ready-asked':
      return { ...state, readyAsked: true };
    case 'closed-by-you':
      return { ...state, phase: 'cancelled', cancelledBy: state.youId };
    case 'sticker-local': {
      const k = action.k;
      if (!Object.hasOwn(STICKER_WORDS, k) || !state.youId) return state;
      return pushSticker(state, state.youId, k, true, action.at);
    }
    case 'sticker-gone':
      return { ...state, stickers: state.stickers.filter((s) => s.id !== action.id) };
    case 'toast-gone':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    default:
      return state;
  }
}

function withProgress(state, m, q, done) {
  if (!m) return state;
  const prev = state.progress.get(m);
  const qn = Number(q) || 0;
  if (prev && (prev.done || (prev.q >= qn && !done))) return state;
  const progress = new Map(state.progress);
  const seq = state.seq + 1;
  progress.set(m, { q: done ? Math.max(qn, prev?.q ?? 0) : qn, done: Boolean(done), seq });
  let toasts = state.toasts;
  if (done && !prev?.done && m !== state.youId && !state.done) toasts = [...toasts, { id: `done:${m}`, m }].slice(-2);
  return { ...state, progress, seq, toasts };
}

function pushSticker(state, m, k, local, at = 0) {
  const stickerSeq = state.stickerSeq + 1;
  const stickers = [...state.stickers, { id: `s${stickerSeq}`, m, k, local, at }].slice(-STICKERS_MAX);
  return { ...state, stickers, stickerSeq };
}

function applyEvent(state, event, payload, members) {
  // `members` null: an action from this page (the host's own reply), already shaped.
  if (members !== null && !eventOk(event, payload, members)) return state;
  const p = payload || {};
  switch (event) {
    case 'room.start':
      if (!START_PHASES.has(state.phase) && state.phase !== 'away' && state.phase !== 'fallback') return state;
      if (state.phase === 'fallback' || state.phase === 'away') return { ...state, startsAt: p.startsAt };
      return { ...state, phase: 'countdown', startsAt: p.startsAt, counted: true };
    case 'progress':
      return withProgress(state, p.m, p.q, p.done);
    case 'room.done':
      return { ...state, done: true, toasts: [] };
    case 'room.cancel':
      if (!START_PHASES.has(state.phase)) return state;
      return { ...state, phase: 'cancelled', cancelledBy: state.hostId };
    case 'sticker': {
      // Your own sticker shows once: from the API's reply, not again from its echo.
      if (p.m === state.youId && state.stickers.some((s) => s.local && s.m === p.m && s.k === p.k)) return state;
      return pushSticker(state, p.m, p.k, false);
    }
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------------------------------
// The countdown on the server clock (M3)
// ---------------------------------------------------------------------------------------------------

/**
 * Where the countdown is at server time `serverNowMs`. Stages: 'wait' (before 3), 3, 2, 1, 'go', 'over'.
 * `into` is the ms into the current beat. A late arrival lands on the current beat; past Go plus 600 ms it is over.
 */
export function countdownAt(startsAt, serverNowMs) {
  const s = typeof startsAt === 'number' ? startsAt : Date.parse(startsAt);
  if (!Number.isFinite(s)) return { stage: 'over', into: 0 };
  const d = serverNowMs - s; // negative before Go
  const lead = COUNT_FROM * BEAT_MS;
  if (d < -lead) return { stage: 'wait', into: 0, untilGo: -d };
  if (d < 0) {
    const k = Math.floor((d + lead) / BEAT_MS); // 0, 1, 2
    return { stage: COUNT_FROM - k, into: (d + lead) - k * BEAT_MS, untilGo: -d };
  }
  if (d < GO_HOLD_MS) return { stage: 'go', into: d, untilGo: 0 };
  return { stage: 'over', into: d - GO_HOLD_MS, untilGo: 0 };
}

// ---------------------------------------------------------------------------------------------------
// Who is where
// ---------------------------------------------------------------------------------------------------

/** The Mob's members as a Map by memberId: { name, fold, colour, you }. */
export function memberMap(members) {
  const out = new Map();
  for (const m of members || []) if (m?.memberId) out.set(m.memberId, { memberId: m.memberId, name: m.name, fold: m.fold, colour: m.colour ?? 0, you: Boolean(m.you) });
  return out;
}

/**
 * The lobby's stage (L1): you first, then the others present in join order, each with a tag (Host, Ready, Here),
 * then an open seat for each member who is not here (the count only, never a name). At most 5 seats.
 */
export function lobbySeats(state, members) {
  const byId = memberMap(members);
  const here = [];
  const add = (id) => {
    const m = byId.get(id);
    if (!m || here.some((h) => h.memberId === id)) return;
    const st = state.presence.get(id) || (id === state.youId ? 'here' : null);
    if (!st) return;
    here.push({ ...m, name: id === state.youId ? 'You' : m.name, you: id === state.youId, tag: id === state.hostId ? 'host' : st, ready: st === 'ready' });
  };
  if (state.hostId && state.presence.has(state.hostId)) add(state.hostId);
  for (const id of state.presence.keys()) if (id !== state.youId) add(id);
  add(state.youId);
  const seats = Math.min(ROOM_SEATS, Math.max(byId.size, here.length));
  return { here, open: Math.max(0, seats - here.length) };
}

/** Members in the room now: present on the channel, plus you. */
export function inRoom(state) {
  const ids = new Set(state.presence.keys());
  if (state.youId) ids.add(state.youId);
  return ids;
}

/**
 * The live ruler (R1, M6): you and everyone in the room or with progress, each over the number they are on (the
 * question after the last one they answered), at the flag when done. Two on one number stand in depth, the later
 * arrival 10 px up, at 0.86 and 70% brightness, behind (spec 0.3 call 1). Same racer shape as RulerRace draws.
 */
export function liveRacers(state, members, count, you = {}) {
  const byId = memberMap(members);
  const ids = new Set([...inRoom(state), ...state.progress.keys()]);
  const racers = [];
  for (const id of ids) {
    const m = byId.get(id);
    if (!m) continue;
    const mine = id === state.youId;
    const p = state.progress.get(id);
    const answered = mine ? Math.max(Number(you.answered) || 0, p?.q ?? 0) : (p?.q ?? 0);
    const finished = mine ? Boolean(you.finished || p?.done) : Boolean(p?.done);
    racers.push({
      id: mine ? 'you' : `m:${id}`, name: mine ? 'You' : m.name, fold: mine ? (you.fold ?? m.fold) : m.fold, colour: mine ? (you.colour ?? m.colour) : m.colour,
      ghost: false, you: mine, at: Math.min(count, answered + 1), finished, arrived: p?.seq ?? 0,
    });
  }
  const groups = new Map();
  for (const r of racers) {
    const key = r.finished ? 'flag' : r.at;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.arrived - b.arrived || (a.you ? -1 : b.you ? 1 : 0));
    list.forEach((r, i) => {
      r.depth = i;
      r.lift = i * 10;
      r.scale = i === 0 ? 1 : 0.86;
      r.brightness = i === 0 ? 1 : 0.7;
      r.aside = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 30;
    });
  }
  return racers;
}

/** Names of members in the room who are still playing (not you, not done). Never anyone absent. */
export function stillPlaying(state, members) {
  if (state.done) return [];
  const byId = memberMap(members);
  const names = [];
  for (const id of inRoom(state)) {
    if (id === state.youId) continue;
    const m = byId.get(id);
    if (!m || state.progress.get(id)?.done) continue;
    names.push(m.name);
  }
  return names;
}

/** True when every member present has reached the flag (the room is as good as done for you). */
export function everyoneDone(state) {
  if (state.done) return true;
  for (const id of inRoom(state)) if (!state.progress.get(id)?.done) return false;
  return true;
}

/** Should this game open as a live room on the website? Only when the server says live is on. */
export function liveRoomFor(game, serverNowMs, liveEnabled) {
  if (!liveEnabled || !game || game.mode !== 'live' || game.closed || !game.room) return false;
  const run = game.you?.run || 'none';
  if (run === 'finished') return false;
  if (game.room.state === 'lobby') return true;
  if (game.room.state !== 'running' || !game.room.startsAt) return false;
  const go = Date.parse(game.room.startsAt);
  if (run === 'playing') return !game.room.endsAt || serverNowMs < Date.parse(game.room.endsAt);
  return serverNowMs <= go + LIVE_JOIN_GRACE_MS;
}

/** When a lobby nobody starts closes (15 minutes after it opened). */
export const lobbyClosesAt = (openedAt) => new Date(Date.parse(openedAt) + LOBBY_MINUTES * 60_000).toISOString();

// ---------------------------------------------------------------------------------------------------
// Words (the owner's voice: plain, warm, grammatical; no exclamation marks, arrows, emoji or hype)
// ---------------------------------------------------------------------------------------------------
const kindWord = (format) => (format === 'round' ? 'round' : format === 'rematch' ? 'rematch' : 'sprint');

export const LIVE_COPY = Object.freeze({
  roomTitle: (game) => (!game?.host || game.host.you ? 'Your room' : `${game.host.name}'s room`),
  roomSub: (game) => `Live ${kindWord(game?.format)}, ${game?.count ?? 5} questions`,
  liveDot: 'Live',
  opening: 'Opening the room',
  sameStart: (n) => `Same ${n} questions, same start. You see where friends are, never what they picked.`,
  tagHost: 'Host',
  tagHere: 'Here',
  tagReady: 'Ready',
  openSeat: 'Open seat',
  sendSticker: 'Send a sticker',
  stickerLabel: (k) => `Send the sticker ${STICKER_WORDS[k] || ''}`.trim(),
  stickerFrom: (name, k) => `${name}: ${STICKER_WORDS[k] || ''}`,
  imReady: "I'm ready",
  youreReady: 'You are ready',
  waitingFor: (name) => `Waiting for ${name} to start`,
  startForEveryone: 'Start for everyone',
  startLine: 'Start when everyone here is ready.',
  starting: 'Starting',
  playLater: 'Play it later instead',
  closeRoom: 'Close the room',
  closeRoomAsk: 'Close the room?',
  closeRoomLine: (closes, now) => `Everyone can still play the game anytime until ${when(closes, now)}.`,
  keepRoom: 'Keep it open',
  onlyYou: "You're the first one here. Your Mob sees the room in the den.",
  hostAway: (name, roomUntil, closes, now) => `${name} stepped away. The room stays open until ${clock(roomUntil)}, and the game until ${when(closes, now)}.`,
  cancelled: (name, closes, now) => `${name} closed the room. The game stays open until ${when(closes, now)}.`,
  youCancelled: (closes, now) => `You closed the room. The game stays open until ${when(closes, now)}.`,
  busy: 'Live is busy right now. Play now, and your Mob can catch up.',
  busyRun: 'Live updates paused. Your answers still count.',
  away: 'You were away for 10 minutes, so you left the room. You can rejoin while it is open.',
  rejoin: 'Rejoin the room',
  playItNow: 'Play it now',
  backToDen: 'Back to the den',
  inRoom: (n) => (n <= 1 ? 'Live room' : `Live, ${n} of you in the room`),
  countdownLine: (n) => `Question 1 of ${n} is next. +5 if right, -1 if wrong, 0 if you skip.`,
  countdownLabel: (stage) => (stage === 'go' ? 'Go' : stage === 'wait' ? 'Get set' : String(stage)),
  go: 'Go',
  getSet: 'Get set',
  skip: 'Skip',
  friendFinished: (name) => `${name} finished. Take your time.`,
  stillPlaying: (names) => `${joinNames(names)} ${names.length === 1 ? 'is' : 'are'} still playing. The podium opens when the room ends.`,
  rulerCaption: 'Where everyone is. Never what they picked.',
  seatsLabel: (n) => (n === 1 ? '1 open seat' : `${n} open seats`),
  hereLabel: (name, tag) => `${name}, ${tag === 'host' ? 'host' : tag === 'ready' ? 'ready' : 'here'}`,
  loadFailed: "The room didn't open.",
  tryAgain: 'Try again',
});
