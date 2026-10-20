// The room's driver (spec 4.2 to 4.5): ticket, then the channel, then the server's events into the reducer. No React
// here, so the tests drive it against the fake hub and a fake API. The page keeps one per room.
//
//   api: { ticket(id), start(id), cancel(id), sticker(mobId, gameId, kind), presence(id, st) } (playApi.js; errors carry
//        the server's { code, message })
//   openChannel: the adapter (liveChannel.js for Supabase, liveHub.mjs's fake). It only listens.
//
// Presence is server-only (L-55, 20 Oct): this page posts { st } to /room/presence when it joins ('here', or 'ready' in a
// running room), when you get ready, every 20 seconds while you are in the room, and 'left' when you go. The server
// broadcasts each as "presence" { m, st }. Members not heard from for 45 seconds drop off this page's room.
import { IDLE_DROP_MS, PRESENCE_EVERY_MS, initialRoom, roomReducer } from './liveModel.mjs';

const REFUSALS = new Set(['LIVE_OFF', 'LIVE_HOURS', 'NOT_LIVE', 'GAME_CLOSED', 'LIVE_BUSY', 'NOT_IN_MOB', 'GAME_NOT_FOUND']);
const IN_ROOM = new Set(['lobby', 'countdown', 'live']);

export function createRoomController({ gameId, mobId, members, api, openChannel, now = () => Date.now(), onChange = () => {}, idleMs = IDLE_DROP_MS, everyMs = PRESENCE_EVERY_MS, timers = globalThis }) {
  let state = initialRoom({});
  let channel = null;
  let offset = 0;
  let idle = null;
  let beat = null;
  let closed = false;
  let connecting = false;
  let posted = null; // the last state this page told the server ('here' | 'ready' | 'left')
  const memberIds = new Set((members || []).map((m) => m.memberId));

  const dispatch = (action) => {
    if (closed) return state;
    const next = roomReducer(state, action);
    if (next !== state) {
      const was = state.phase;
      state = next;
      if (was !== state.phase) onPhase(was, state.phase);
      onChange(state);
    }
    return state;
  };

  function onPhase(from, to) {
    if (to === 'lobby') touch();
    if (to !== 'lobby') clearIdle();
    // In a running room you are ready by definition: say so once the countdown starts.
    if ((to === 'countdown' || to === 'live') && posted === 'here') post('ready');
    // A failed channel before the start, a closed room or a dropped seat: let go of the socket and the seat.
    if (to === 'fallback' || to === 'away' || to === 'cancelled' || to === 'off') { leaveChannel(); stopBeat(); if (posted && posted !== 'left') post('left'); }
  }

  const handlers = {
    event: (event, payload) => dispatch({ type: 'event', event, payload, members: memberIds, at: serverNow() }),
    status: (status) => {
      dispatch({ type: 'status', status });
      if (state.busy) leaveChannel();
    },
  };

  async function post(st) {
    if (!api.presence) return false;
    posted = st;
    try {
      const r = await api.presence(gameId, st);
      if (st === 'left') return true;
      // The reply carries the server's roster: take it as the room's truth now (it also covers a missed broadcast).
      if (Array.isArray(r?.roster)) dispatch({ type: 'roster', roster: r.roster, members: memberIds, at: serverNow() });
      dispatch({ type: 'self-presence', st, at: serverNow() });
      return true;
    } catch {
      return false;
    }
  }

  // Every 20 s while in the room: post again (the server's roster forgets after 45 s) and drop the silent.
  function startBeat() {
    stopBeat();
    const tick = () => {
      beat = null;
      if (closed || !IN_ROOM.has(state.phase) || (state.phase === 'live' && state.done)) return;
      post(state.readyAsked || state.phase !== 'lobby' ? 'ready' : 'here');
      dispatch({ type: 'prune', at: serverNow() });
      beat = timers.setTimeout(tick, everyMs);
      beat?.unref?.();
    };
    beat = timers.setTimeout(tick, everyMs);
    beat?.unref?.(); // Node (the tests) only: a waiting room never keeps the process alive.
  }
  function stopBeat() { if (beat) { timers.clearTimeout(beat); beat = null; } }

  async function leaveChannel() {
    const c = channel;
    channel = null;
    if (c) await c.leave().catch(() => {});
  }
  function clearIdle() { if (idle) { timers.clearTimeout(idle); idle = null; } }
  function touch() {
    clearIdle();
    if (state.phase !== 'lobby' || closed) return;
    idle = timers.setTimeout(() => { idle = null; dispatch({ type: 'idle' }); }, idleMs);
    idle?.unref?.(); // Node (the tests) only: a waiting lobby never keeps the process alive.
  }

  async function connect() {
    if (connecting || closed) return state;
    connecting = true;
    try {
      let t;
      try {
        t = await api.ticket(gameId);
      } catch (e) {
        if (REFUSALS.has(e?.code)) return dispatch({ type: 'refused', code: e.code, message: e.message });
        return dispatch({ type: 'failed', message: e?.offline ? "You're offline. Nothing changed." : null });
      }
      if (closed) return state;
      const serverNowMs = Date.parse(t.serverNow);
      offset = Number.isFinite(serverNowMs) ? serverNowMs - now() : 0;
      dispatch({ type: 'ticket', room: t.room, memberId: t.memberId, serverNowMs: serverNow(), members: memberIds });
      if (!IN_ROOM.has(state.phase) || (state.phase === 'live' && state.done)) return state;
      try {
        channel = await openChannel({ topic: t.topic, memberId: t.memberId, handlers });
      } catch {
        return dispatch({ type: 'status', status: 'CHANNEL_ERROR' });
      }
      if (closed) { leaveChannel(); return state; }
      await post(state.phase === 'lobby' ? 'here' : 'ready');
      startBeat();
      return state;
    } finally {
      connecting = false;
    }
  }

  function serverNow() { return now() + offset; }

  return {
    get state() { return state; },
    get youId() { return state.youId; },
    get isHost() { return Boolean(state.youId) && state.youId === state.hostId; },
    serverNow,
    connect,
    touch,
    dispatch,
    async ready() {
      touch();
      if (!channel || state.phase !== 'lobby') return false;
      const ok = await post('ready');
      if (!ok) return false;
      dispatch({ type: 'ready-asked' });
      return true;
    },
    async start() {
      touch();
      const r = await api.start(gameId);
      const s = Date.parse(r?.serverNow);
      if (Number.isFinite(s)) offset = s - now();
      if (r?.startsAt) dispatch({ type: 'started', startsAt: r.startsAt });
      return r;
    },
    async cancel() {
      await api.cancel(gameId);
      dispatch({ type: 'closed-by-you' });
    },
    async sticker(kind) {
      touch();
      await api.sticker(mobId, gameId, kind);
      dispatch({ type: 'sticker-local', k: kind, at: now() });
    },
    answered(q, done) { dispatch({ type: 'self', q, done }); },
    go() { dispatch({ type: 'go' }); },
    async rejoin() {
      await leaveChannel();
      stopBeat();
      posted = null;
      dispatch({ type: 'rejoin' });
      return connect();
    },
    async close() {
      const was = posted;
      closed = true;
      clearIdle();
      stopBeat();
      await leaveChannel();
      if (was && was !== 'left' && api.presence) { posted = 'left'; await api.presence(gameId, 'left').catch(() => {}); }
    },
  };
}
