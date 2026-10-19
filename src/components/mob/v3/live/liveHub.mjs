// The room channel's contract, and an in-memory fake of it for the tests and the dev preview.
//
// A channel adapter is `open({ topic, memberId, handlers }) -> Promise<{ track(st), leave() }>` where handlers are
//   presence(state)         Supabase's presenceState() shape: { key: [ { m, st, v, presence_ref } ] }
//   event(event, payload)   a server broadcast (room.start, progress, room.done, room.cancel, sticker)
//   status(status)          'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'
// The page can only track its own presence and leave. There is no way to broadcast from a client (spec 4.3).
import { presencePayload } from './liveModel.mjs';

/**
 * A fake hub: one topic, any number of page clients, plus "bots" the test or preview drives (members joining,
 * readying, the server's broadcasts, a channel failure). Synchronous delivery after a microtask, like a socket.
 */
export function createFakeHub({ delay = 0 } = {}) {
  const clients = new Set();
  const presence = new Map(); // memberId -> payload
  const sent = []; // every presence payload a client tracked, for the tests
  let refs = 0;
  const later = (fn) => (delay > 0 ? setTimeout(fn, delay) : queueMicrotask(fn));
  const snapshot = () => {
    const out = {};
    for (const [id, p] of presence) out[id] = [{ ...p, presence_ref: `ref${(refs += 1)}` }];
    return out;
  };
  const sync = () => later(() => { const s = snapshot(); for (const c of clients) c.handlers.presence?.(s); });

  const hub = {
    /** Set by a test or the preview to react to this page's presence (a bot host starting once you are ready). */
    onTrack: null,
    sent,
    clients,
    presence,
    /** The adapter the page uses. */
    open: async ({ topic, memberId, handlers }) => {
      const client = { topic, memberId, handlers, left: false };
      clients.add(client);
      later(() => { if (!client.left) { handlers.status?.('SUBSCRIBED'); handlers.presence?.(snapshot()); } });
      return {
        track: async (st) => {
          if (client.left) return 'error';
          const p = presencePayload(memberId, st);
          sent.push(p);
          presence.set(memberId, p);
          sync();
          hub.onTrack?.(p);
          return 'ok';
        },
        leave: async () => {
          if (client.left) return;
          client.left = true;
          clients.delete(client);
          presence.delete(memberId);
          sync();
        },
      };
    },
    /** A bot member joins or changes state ('here' | 'ready'), or leaves (null). */
    bot: (memberId, st) => {
      if (st) presence.set(memberId, presencePayload(memberId, st)); else presence.delete(memberId);
      sync();
    },
    /** A raw presence meta (for the tests: a payload with extra keys must be ignored). */
    rawPresence: (key, meta) => { presence.set(key, meta); sync(); },
    /** A server broadcast to everyone on the topic. */
    send: (event, payload = {}) => later(() => { for (const c of clients) c.handlers.event?.(event, payload); }),
    /** The channel fails for every client. */
    fail: (status = 'CHANNEL_ERROR') => later(() => { for (const c of clients) c.handlers.status?.(status); }),
  };
  return hub;
}
