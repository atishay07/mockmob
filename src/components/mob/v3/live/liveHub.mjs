// The room channel's contract, and in-memory fakes of it for the tests and the dev preview.
//
// A channel adapter is `open({ topic, memberId, handlers }) -> Promise<{ leave() }>` where handlers are
//   event(event, payload)   a server broadcast (room.start, progress, room.done, room.cancel, sticker, presence)
//   status(status)          'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'
// The page only listens. Presence is server-only (L-55): the page posts to /room/presence and the server broadcasts
// "presence" { m, st }; there is no way to track or broadcast from a client (spec 4.3).

/**
 * A fake hub: one topic, any number of page clients, plus what the test or preview drives as "the server": members
 * joining or readying (their presence posts), the server's broadcasts, a channel failure. Delivery after a microtask
 * (or `delay` ms), like a socket. `presence` is the server's roster: memberId -> 'here' | 'ready'.
 */
export function createFakeHub({ delay = 0 } = {}) {
  const clients = new Set();
  const presence = new Map();
  const listeners = new Set(); // the fake server's own ears (the preview's world)
  const later = (fn) => (delay > 0 ? setTimeout(fn, delay) : queueMicrotask(fn));
  const deliver = (event, payload) => {
    if (event === 'presence' && payload && typeof payload.m === 'string') {
      if (payload.st === 'left') presence.delete(payload.m); else presence.set(payload.m, payload.st);
    }
    for (const l of listeners) l(event, payload);
    later(() => { for (const c of clients) c.handlers.event?.(event, payload); });
  };

  const hub = {
    clients,
    presence,
    /** The adapter the page uses: it subscribes and listens; it cannot send. */
    open: async ({ topic, memberId, handlers }) => {
      const client = { topic, memberId, handlers, left: false };
      clients.add(client);
      later(() => { if (!client.left) handlers.status?.('SUBSCRIBED'); });
      return {
        leave: async () => {
          if (client.left) return;
          client.left = true;
          clients.delete(client);
        },
      };
    },
    /** The roster as the ticket carries it. */
    roster: () => [...presence.entries()].map(([memberId, st]) => ({ memberId, st })),
    /** A member's presence post as the server broadcasts it ('here' | 'ready', or null / 'left' to leave). */
    bot: (memberId, st) => deliver('presence', { m: memberId, st: st || 'left' }),
    /** A server broadcast to everyone on the topic (a raw payload, so the tests can send what must be dropped). */
    send: (event, payload = {}) => deliver(event, payload),
    /** The channel fails for every client. */
    fail: (status = 'CHANNEL_ERROR') => later(() => { for (const c of clients) c.handlers.status?.(status); }),
    /** The fake server listening to its own broadcasts (the preview keeps the room's state in step). */
    listen: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
  return hub;
}

/**
 * The same hub across browser tabs (the dev preview's two-player walk): each tab is one member with its own fake
 * routes, and every broadcast reaches both tabs through a BroadcastChannel named for the game. Room state travels
 * as the server's own events (room.start, progress, presence, room.done), so both tabs see one room.
 */
export function createTabHub(name, { delay = 0 } = {}) {
  const hub = createFakeHub({ delay });
  const BC = typeof globalThis.BroadcastChannel === 'function' ? globalThis.BroadcastChannel : null;
  if (!BC) return hub;
  const bc = new BC(`mm-live-${name}`);
  const localSend = hub.send;
  bc.onmessage = (e) => { const d = e.data || {}; if (typeof d.event === 'string') localSend(d.event, d.payload); };
  hub.send = (event, payload = {}) => { localSend(event, payload); bc.postMessage({ event, payload }); };
  hub.bot = (memberId, st) => hub.send('presence', { m: memberId, st: st || 'left' });
  hub.close = () => bc.close();
  return hub;
}
