"use client";
// The real room channel: a private Supabase Realtime channel, topic mob-room:<game id> (spec 4.1, 4.2).
// The browser client already holds the student's Supabase session, so after the API issues the ticket the RLS policy
// (mob_room_ok(realtime.topic())) lets this connection in. It only listens: presence is server-only since L-55 (the
// page posts to /room/presence and the server broadcasts "presence"), and a client never broadcasts. Same contract as
// the fake in liveHub.mjs.
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { LIVE_EVENTS } from './liveModel.mjs';

export async function openSupabaseRoom({ topic, handlers }) {
  const supabase = getSupabaseBrowserClient();
  // A private channel needs the session's token on the socket before it subscribes.
  try { await supabase.realtime.setAuth(); } catch { /* the subscribe then fails with CHANNEL_ERROR and the page falls back */ }
  const channel = supabase.channel(topic, { config: { private: true } });
  for (const event of LIVE_EVENTS) channel.on('broadcast', { event }, (message) => handlers.event?.(event, message?.payload));
  channel.subscribe((status) => handlers.status?.(status));
  let left = false;
  return {
    leave: async () => {
      if (left) return;
      left = true;
      try { await supabase.removeChannel(channel); } catch { /* already closed */ }
    },
  };
}
