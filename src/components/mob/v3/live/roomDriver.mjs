// The room's driver (spec 4.2 to 4.5): ticket, then the channel, then presence and the server's events into the
// reducer. No React here, so the tests drive it against the fake hub and a fake API. The page keeps one per room.
//
//   api: { ticket(id), start(id), cancel(id), sticker(mobId, gameId, kind) } (playApi.js; errors carry the server's
//        { code, message })
//   openChannel: the adapter (liveChannel.js for Supabase, liveHub.mjs's fake)
import { IDLE_DROP_MS, initialRoom, roomReducer } from './liveModel.mjs';

const REFUSALS = new Set(['LIVE_OFF', 'LIVE_HOURS', 'NOT_LIVE', 'GAME_CLOSED', 'LIVE_BUSY', 'NOT_IN_MOB', 'GAME_NOT_FOUND']);

export function createRoomController({ gameId, mobId, members, api, openChannel, now = () => Date.now(), onChange = () => {}, idleMs = IDLE_DROP_MS, timers = globalThis }) {
  let state = initialRoom({});
  let channel = null;
  let offset = 0;
  let idle = null;
  let closed = false;
  let connecting = false;
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
    // A failed channel before the start, a closed room or a dropped seat: let go of the socket.
    if (to === 'fallback' || to === 'away' || to === 'cancelled' || to === 'off') leaveChannel();
  }

  const handlers = {
    presence: (s) => dispatch({ type: 'presence', state: s, members: memberIds }),
    event: (event, payload) => dispatch({ type: 'event', event, payload, members: memberIds }),
    status: (status) => {
      dispatch({ type: 'status', status });
      if (state.busy) leaveChannel();
    },
  };

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
      dispatch({ type: 'ticket', room: t.room, memberId: t.memberId, serverNowMs: serverNow() });
      if (!['lobby', 'countdown', 'live'].includes(state.phase) || (state.phase === 'live' && state.done)) return state;
      try {
        channel = await openChannel({ topic: t.topic, memberId: t.memberId, handlers });
      } catch {
        return dispatch({ type: 'status', status: 'CHANNEL_ERROR' });
      }
      if (closed) { leaveChannel(); return state; }
      await channel.track(state.phase === 'lobby' ? 'here' : 'ready').catch(() => {});
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
      const r = await channel.track('ready').catch(() => 'error');
      if (r === 'error' || r === 'timed out') return false;
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
      dispatch({ type: 'rejoin' });
      return connect();
    },
    async close() {
      closed = true;
      clearIdle();
      await leaveChannel();
    },
  };
}
