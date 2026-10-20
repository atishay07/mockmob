// Mob v3 live rooms on the website (Phase B client): the room's state machine, what may travel on the channel,
// the countdown on the server clock, the live ruler, the words, and the driver against a fake channel and API.
// Spec: MOB-BUILD-SPEC-V3 4.1 to 4.5, 5.3 L1, L2, R1, R5, R6, 5.6 M2, M3, M6, M12, section 6.
// L-55 (20 Oct): presence is server-only. The page never tracks; it posts { st } to /room/presence and reads the
// server's "presence" { m, st } broadcasts and the ticket's roster. LV-20 to LV-24 cover that, the two-player flow and
// a live timed race (D167).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  BEAT_MS, GO_HOLD_MS, LIVE_COPY, LIVE_EVENTS, MAX_PROGRESS_Q, PRESENCE_STALE_MS, countdownAt, eventOk, everyoneDone, initialRoom,
  liveRacers, liveRoomFor, lobbySeats, presenceBody, readRoster, roomReducer, stillPlaying, topicFor,
} from '../../src/components/mob/v3/live/liveModel.mjs';
import { createFakeHub } from '../../src/components/mob/v3/live/liveHub.mjs';
import { createRoomController } from '../../src/components/mob/v3/live/roomDriver.mjs';

const LIVE_DIR = new URL('../../src/components/mob/v3/live/', import.meta.url);
const MEMBERS = [
  { memberId: 'K7P2M9QXA1B2', name: 'Riya', fold: 'patang', colour: 3, you: false },
  { memberId: 'A1B2C3D4E5F6', name: 'Aarav', fold: 'dart', colour: 1, you: true },
  { memberId: 'Z9Y8X7W6V5T4', name: 'Kabir', fold: 'naav', colour: 5, you: false },
  { memberId: 'M1N2P3Q4R5S6', name: 'Zoya', fold: 'cutting', colour: 6, you: false },
];
const [RIYA, YOU, KABIR, ZOYA] = MEMBERS.map((m) => m.memberId);
const IDS = new Set(MEMBERS.map((m) => m.memberId));
const flush = () => new Promise((r) => setTimeout(r, 0));

function lobby(extra = {}) {
  let s = initialRoom({});
  s = roomReducer(s, { type: 'ticket', room: { state: 'lobby', startsAt: null, hostMemberId: RIYA }, memberId: YOU, serverNowMs: 0 });
  return { ...s, ...extra };
}
// The server's presence broadcasts for these members, in order (the page's own state comes from its posts).
const withPresence = (s, entries) => entries.reduce((acc, [m, st]) => roomReducer(acc, { type: 'event', event: 'presence', payload: { m, st }, members: IDS, at: 0 }), s);

// ---------------------------------------------------------------------------------------------------
// What may travel
// ---------------------------------------------------------------------------------------------------
test('LV-1 presence: the page only ever posts { st } to the API (here, ready or left), never anything on the channel', () => {
  assert.deepEqual(presenceBody('here'), { st: 'here' });
  assert.deepEqual(presenceBody('ready'), { st: 'ready' });
  assert.deepEqual(presenceBody('left'), { st: 'left' });
  assert.throws(() => presenceBody('online'));
});

test('LV-2 presence from the server: the roster and the broadcast; extra keys, unknown members and other states are ignored', () => {
  assert.equal(eventOk('presence', { m: RIYA, st: 'ready' }, IDS), true);
  assert.equal(eventOk('presence', { m: RIYA, st: 'left' }, IDS), true);
  assert.equal(eventOk('presence', { m: RIYA, st: 'ready', v: 1 }, IDS), false);
  assert.equal(eventOk('presence', { m: RIYA, st: 'ready', name: 'Riya' }, IDS), false);
  assert.equal(eventOk('presence', { m: RIYA, st: 'online' }, IDS), false);
  assert.equal(eventOk('presence', { m: 'STRANGER0000', st: 'here' }, IDS), false);
  const map = readRoster([
    { memberId: RIYA, st: 'here' }, { memberId: RIYA, st: 'ready' },
    { memberId: KABIR, st: 'here', pick: 2 }, { memberId: 'STRANGER0000', st: 'here' }, { memberId: ZOYA, st: 'left' }, 'x',
  ], IDS);
  assert.deepEqual([...map.entries()], [[RIYA, 'ready']]);
  let s = withPresence(lobby(), [[RIYA, 'here'], [KABIR, 'ready'], [RIYA, 'ready']]);
  assert.deepEqual([...s.presence.entries()], [[RIYA, 'ready'], [KABIR, 'ready']]);
  s = withPresence(s, [[KABIR, 'left']]);
  assert.deepEqual([...s.presence.keys()], [RIYA]);
  const bad = roomReducer(s, { type: 'event', event: 'presence', payload: { m: ZOYA, st: 'here', note: 'hi' }, members: IDS, at: 0 });
  assert.equal(bad, s);
});

test('LV-3 broadcasts: only the six server events with exactly their keys; a pick, name or mark drops the whole event', () => {
  assert.deepEqual([...LIVE_EVENTS].sort(), ['presence', 'progress', 'room.cancel', 'room.done', 'room.start', 'sticker']);
  // A 10-minute race carries counts past 20 (D167); past the ceiling is dropped.
  assert.equal(eventOk('progress', { m: RIYA, q: 47, done: false }, IDS), true);
  assert.equal(eventOk('progress', { m: RIYA, q: MAX_PROGRESS_Q + 1, done: false }, IDS), false);
  assert.equal(eventOk('room.start', { startsAt: '2026-10-22T15:20:04.000Z' }, IDS), true);
  assert.equal(eventOk('progress', { m: RIYA, q: 3, done: false }, IDS), true);
  assert.equal(eventOk('room.done', {}, IDS), true);
  assert.equal(eventOk('room.done', undefined, IDS), true);
  assert.equal(eventOk('sticker', { m: KABIR, k: 'good_luck' }, IDS), true);
  for (const bad of [
    ['progress', { m: RIYA, q: 3, done: false, correct: true }],
    ['progress', { m: RIYA, q: 3, done: false, pick: 1 }],
    ['progress', { m: RIYA, q: 3, done: false, marks: 14 }],
    ['progress', { m: RIYA, q: 3, done: false, name: 'Riya' }],
    ['progress', { m: 'STRANGER0000', q: 3, done: false }],
    ['progress', { m: RIYA, q: '3', done: false }],
    ['room.start', { startsAt: 'soon' }],
    ['room.done', { winner: RIYA }],
    ['sticker', { m: KABIR, k: 'free text here' }],
    ['answer', { q: 1, correctIndex: 2 }],
  ]) assert.equal(eventOk(bad[0], bad[1], IDS), false, JSON.stringify(bad));
  const s = lobby();
  const after = roomReducer({ ...s, phase: 'live' }, { type: 'event', event: 'progress', payload: { m: RIYA, q: 2, done: false, correct: true }, members: IDS });
  assert.equal(after.progress.size, 0);
});

test('LV-4 static scan: no live file tracks presence or broadcasts; the channel only listens', () => {
  for (const f of readdirSync(LIVE_DIR)) {
    const src = readFileSync(new URL(f, LIVE_DIR), 'utf8');
    assert.doesNotMatch(src, /\.send\(\s*\{\s*type:\s*['"]broadcast/, `${f} broadcasts`);
    assert.doesNotMatch(src, /type:\s*['"]broadcast['"]/, `${f} broadcasts`);
    assert.doesNotMatch(src, /\.track\(/, `${f} tracks presence (L-55: presence is server-only)`);
    assert.doesNotMatch(src, /presenceState\(/, `${f} reads client presence`);
  }
  const channel = readFileSync(new URL('liveChannel.js', LIVE_DIR), 'utf8');
  assert.match(channel, /private: true/);
  assert.match(channel, /realtime\.setAuth\(\)/);
  assert.doesNotMatch(channel, /presence:\s*\{/);
  const api = readFileSync(new URL('../../src/components/mob/v3/play/playApi.js', import.meta.url), 'utf8');
  assert.match(api, /room\/presence/);
});

// ---------------------------------------------------------------------------------------------------
// The state machine
// ---------------------------------------------------------------------------------------------------
test('LV-5 ticket: lobby, a running room before or after Go, a cancelled room', () => {
  const base = initialRoom({});
  const go = Date.parse('2026-10-22T15:20:04.000Z');
  assert.equal(roomReducer(base, { type: 'ticket', room: { state: 'lobby', hostMemberId: RIYA }, memberId: YOU }).phase, 'lobby');
  assert.equal(roomReducer(base, { type: 'ticket', room: { state: 'running', startsAt: '2026-10-22T15:20:04.000Z', hostMemberId: RIYA }, memberId: YOU, serverNowMs: go - 1500 }).phase, 'countdown');
  assert.equal(roomReducer(base, { type: 'ticket', room: { state: 'running', startsAt: '2026-10-22T15:20:04.000Z', hostMemberId: RIYA }, memberId: YOU, serverNowMs: go + GO_HOLD_MS + 5 }).phase, 'live');
  assert.equal(roomReducer(base, { type: 'ticket', room: { state: 'cancelled', hostMemberId: RIYA }, memberId: YOU }).phase, 'cancelled');
});

test('LV-6 the lobby: presence, the host first, ready tags, open seats as a count with no names', () => {
  let s = lobby();
  s = withPresence(s, [[KABIR, 'ready'], [RIYA, 'here'], [YOU, 'here']]);
  const seats = lobbySeats(s, MEMBERS);
  assert.deepEqual(seats.here.map((h) => [h.name, h.tag]), [['Riya', 'host'], ['Kabir', 'ready'], ['You', 'here']]);
  assert.equal(seats.open, 1);
  assert.equal(JSON.stringify(seats).includes('Zoya'), false);
  // Only you: the line uses presence only.
  const alone = lobbySeats(lobby(), MEMBERS);
  assert.deepEqual(alone.here.map((h) => h.name), ['You']);
  assert.equal(alone.open, 3);
});

test('LV-7 room.start runs the countdown; Go lands on startsAt; a late arrival lands on the current beat', () => {
  let s = lobby();
  s = roomReducer(s, { type: 'event', event: 'room.start', payload: { startsAt: '2026-10-22T15:20:04.000Z' }, members: IDS });
  assert.equal(s.phase, 'countdown');
  const go = Date.parse(s.startsAt);
  assert.equal(countdownAt(s.startsAt, go - 4000).stage, 'wait');
  assert.equal(countdownAt(s.startsAt, go - 3 * BEAT_MS).stage, 3);
  assert.equal(countdownAt(s.startsAt, go - 2 * BEAT_MS - 1).stage, 3);
  assert.equal(countdownAt(s.startsAt, go - 2 * BEAT_MS).stage, 2);
  assert.equal(countdownAt(s.startsAt, go - 1).stage, 1);
  assert.equal(countdownAt(s.startsAt, go).stage, 'go');
  assert.equal(countdownAt(s.startsAt, go + GO_HOLD_MS).stage, 'over');
  assert.equal(countdownAt(s.startsAt, go - 900).into, 300);
  assert.equal(roomReducer(s, { type: 'go' }).phase, 'live');
  // A second start (the host's reply after the broadcast) changes nothing once counting.
  const again = roomReducer({ ...s, phase: 'live' }, { type: 'event', event: 'room.start', payload: { startsAt: '2026-10-22T15:21:04.000Z' }, members: IDS });
  assert.equal(again.startsAt, s.startsAt);
});

test('LV-8 the live race: progress moves Folds, never backwards; a friend at the flag gets one quiet toast', () => {
  let s = { ...lobby(), phase: 'live' };
  s = withPresence(s, [[RIYA, 'ready'], [KABIR, 'ready'], [YOU, 'ready']]);
  s = roomReducer(s, { type: 'event', event: 'progress', payload: { m: RIYA, q: 2, done: false }, members: IDS });
  s = roomReducer(s, { type: 'self', q: 2, done: false });
  s = roomReducer(s, { type: 'event', event: 'progress', payload: { m: RIYA, q: 1, done: false }, members: IDS });
  let racers = liveRacers(s, MEMBERS, 5, { answered: 2 });
  const at = Object.fromEntries(racers.map((r) => [r.name, r.at]));
  assert.deepEqual(at, { Riya: 3, Kabir: 1, You: 3 });
  // Two on one number: the later arrival stands behind, up, smaller and dimmer.
  const three = racers.filter((r) => r.at === 3).sort((a, b) => a.depth - b.depth);
  assert.deepEqual(three.map((r) => [r.name, r.depth, r.scale, r.brightness, r.lift]), [['Riya', 0, 1, 1, 0], ['You', 1, 0.86, 0.7, 10]]);
  s = roomReducer(s, { type: 'event', event: 'progress', payload: { m: RIYA, q: 5, done: true }, members: IDS });
  s = roomReducer(s, { type: 'event', event: 'progress', payload: { m: RIYA, q: 5, done: true }, members: IDS });
  assert.equal(s.toasts.length, 1);
  assert.equal(LIVE_COPY.friendFinished('Riya'), 'Riya finished. Take your time.');
  racers = liveRacers(s, MEMBERS, 5, { answered: 2 });
  assert.equal(racers.find((r) => r.name === 'Riya').finished, true);
  // Your own finish never toasts.
  s = roomReducer(s, { type: 'self', q: 5, done: true });
  assert.equal(s.toasts.length, 1);
});

test('LV-9 still playing names only members in the room; room.done ends it; nobody absent is named', () => {
  let s = { ...lobby(), phase: 'live' };
  s = withPresence(s, [[RIYA, 'ready'], [KABIR, 'ready'], [YOU, 'ready']]);
  s = roomReducer(s, { type: 'self', q: 5, done: true });
  assert.deepEqual(stillPlaying(s, MEMBERS), ['Riya', 'Kabir']);
  assert.equal(LIVE_COPY.stillPlaying(['Riya', 'Kabir']), 'Riya and Kabir are still playing. The podium opens when the room ends.');
  assert.equal(LIVE_COPY.stillPlaying(['Riya']), 'Riya is still playing. The podium opens when the room ends.');
  assert.equal(everyoneDone(s), false);
  s = roomReducer(s, { type: 'event', event: 'progress', payload: { m: KABIR, q: 5, done: true }, members: IDS });
  assert.deepEqual(stillPlaying(s, MEMBERS), ['Riya']);
  s = roomReducer(s, { type: 'event', event: 'room.done', payload: {}, members: IDS });
  assert.deepEqual(stillPlaying(s, MEMBERS), []);
  assert.equal(everyoneDone(s), true);
  assert.equal(stillPlaying(s, MEMBERS).includes('Zoya'), false);
});

test('LV-10 the channel fails: before the start the room falls back to anytime; during the run it goes on without updates', () => {
  const s = lobby();
  assert.equal(roomReducer(s, { type: 'status', status: 'CHANNEL_ERROR' }).phase, 'fallback');
  assert.equal(roomReducer(s, { type: 'status', status: 'TIMED_OUT' }).phase, 'fallback');
  const live = roomReducer({ ...s, phase: 'live', connected: true }, { type: 'status', status: 'CHANNEL_ERROR' });
  assert.equal(live.phase, 'live');
  assert.equal(live.busy, true);
  // A CLOSED before ever connecting is not a failure (an unmount).
  assert.equal(roomReducer(s, { type: 'status', status: 'CLOSED' }).phase, 'lobby');
});

test('LV-11 room.cancel closes a lobby only; stickers float at most 3 at once; your own echo shows once', () => {
  let s = lobby();
  assert.equal(roomReducer(s, { type: 'event', event: 'room.cancel', payload: {}, members: IDS }).phase, 'cancelled');
  assert.equal(roomReducer({ ...s, phase: 'live' }, { type: 'event', event: 'room.cancel', payload: {}, members: IDS }).phase, 'live');
  for (const k of ['good_luck', 'lets_go', 'one_sec', 'ready']) s = roomReducer(s, { type: 'event', event: 'sticker', payload: { m: RIYA, k }, members: IDS });
  assert.deepEqual(s.stickers.map((x) => x.k), ['lets_go', 'one_sec', 'ready']);
  s = roomReducer(s, { type: 'sticker-local', k: 'good_luck' });
  s = roomReducer(s, { type: 'event', event: 'sticker', payload: { m: YOU, k: 'good_luck' }, members: IDS });
  assert.equal(s.stickers.filter((x) => x.m === YOU).length, 1);
});

test('LV-12 liveRoomFor: only when the server says live is on, and only for a lobby or a run within its window', () => {
  const now = Date.parse('2026-10-22T15:20:10.000Z');
  const g = { mode: 'live', closed: false, room: { state: 'lobby' }, you: { run: 'none' } };
  assert.equal(liveRoomFor(g, now, true), true);
  assert.equal(liveRoomFor(g, now, false), false);
  assert.equal(liveRoomFor({ ...g, mode: 'async' }, now, true), false);
  assert.equal(liveRoomFor({ ...g, you: { run: 'finished' } }, now, true), false);
  const running = { ...g, room: { state: 'running', startsAt: '2026-10-22T15:20:04.000Z', endsAt: '2026-10-22T15:26:04.000Z' } };
  assert.equal(liveRoomFor(running, now, true), true);
  assert.equal(liveRoomFor(running, now + 40_000, true), false);
  assert.equal(liveRoomFor({ ...running, you: { run: 'playing' } }, now + 40_000, true), true);
  assert.equal(liveRoomFor({ ...running, you: { run: 'playing' } }, Date.parse('2026-10-22T15:27:00.000Z'), true), false);
  assert.equal(liveRoomFor({ ...g, room: { state: 'cancelled' } }, now, true), false);
});

// ---------------------------------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------------------------------
test('LV-13 copy: the owner voice (no exclamation marks, arrows, emoji or pressure words)', () => {
  const now = Date.parse('2026-10-22T15:00:00.000Z');
  const closes = '2026-10-23T15:22:00.000Z';
  const lines = [];
  for (const [k, v] of Object.entries(LIVE_COPY)) {
    if (typeof v === 'string') lines.push(v);
    else if (k === 'stillPlaying') lines.push(v(['Riya', 'Kabir']));
    else if (k === 'hostAway') lines.push(v('Riya', '2026-10-22T15:37:00.000Z', closes, now));
    else if (k === 'cancelled') lines.push(v('Riya', closes, now));
    else if (k === 'youCancelled' || k === 'closeRoomLine') lines.push(v(closes, now));
    else if (k === 'roomTitle' || k === 'roomSub') lines.push(v({ host: { name: 'Riya', you: false }, format: 'sprint', count: 5 }));
    else lines.push(String(v(3, 'here')));
  }
  for (const l of lines) {
    assert.doesNotMatch(l, /!/, l);
    assert.doesNotMatch(l, /[←-⇿\u{1F300}-\u{1FAFF}]/u, l);
    assert.doesNotMatch(l, /\b(lost|losing|behind|last place|hurry|waiting on you|streak at risk|online)\b/i, l);
  }
  assert.equal(LIVE_COPY.roomTitle({ host: { name: 'Riya', you: false } }), "Riya's room");
  assert.equal(LIVE_COPY.roomSub({ format: 'sprint', count: 5 }), 'Live sprint, 5 questions');
  assert.equal(LIVE_COPY.inRoom(3), 'Live, 3 of you in the room');
  assert.equal(LIVE_COPY.hostAway('Riya', '2026-10-22T15:37:00.000Z', closes, now), 'Riya stepped away. The room stays open until 9:07 PM, and the game until 8:52 PM tomorrow.');
  assert.equal(LIVE_COPY.cancelled('Riya', closes, now), 'Riya closed the room. The game stays open until 8:52 PM tomorrow.');
  assert.equal(LIVE_COPY.countdownLine(5), 'Question 1 of 5 is next. +5 if right, -1 if wrong, 0 if you skip.');
  assert.equal(topicFor('abc'), 'mob-room:abc');
});

// ---------------------------------------------------------------------------------------------------
// The driver against a fake channel and API
// ---------------------------------------------------------------------------------------------------
function fakeApi({ room = { state: 'lobby', startsAt: null, hostMemberId: RIYA }, memberId = YOU, ticketError = null, serverSkewMs = 0, hub = null } = {}) {
  const calls = [];
  return {
    calls,
    ticket: async (id) => {
      calls.push(['ticket', id]);
      if (ticketError) throw ticketError;
      return { topic: topicFor(id), memberId, expiresAt: new Date(Date.now() + 3600_000).toISOString(), room: { ...room, roster: hub ? hub.roster() : (room.roster || []) }, serverNow: new Date(Date.now() + serverSkewMs).toISOString() };
    },
    start: async (id) => { calls.push(['start', id]); const n = Date.now() + serverSkewMs; return { startsAt: new Date(n + 4000).toISOString(), serverNow: new Date(n).toISOString() }; },
    cancel: async (id) => { calls.push(['cancel', id]); return { ok: true }; },
    sticker: async (mob, game, kind) => { calls.push(['sticker', mob, game, kind]); return { ok: true }; },
    presence: async (id, st) => { calls.push(['presence', id, st]); hub?.send('presence', { m: memberId, st }); return { ok: true, serverNow: new Date().toISOString() }; },
  };
}

test('LV-14 driver: ticket with its roster, join posts here, a friend joins, ready posts ready, the host starts, progress, done, leave posts left', async () => {
  const hub = createFakeHub();
  hub.bot(RIYA, 'here');
  await flush();
  const api = fakeApi({ hub });
  const seen = [];
  const room = createRoomController({ gameId: 'g1', mobId: 'm1', members: MEMBERS, api, openChannel: hub.open, onChange: (s) => seen.push(s.phase) });
  await room.connect();
  await flush(); await flush();
  assert.equal(room.state.phase, 'lobby');
  assert.equal(room.state.connected, true);
  // The roster came with the ticket; your own seat came from your post.
  assert.equal(room.state.presence.get(RIYA), 'here');
  assert.equal(room.state.presence.get(YOU), 'here');
  assert.deepEqual(api.calls.filter((c) => c[0] === 'presence'), [['presence', 'g1', 'here']]);
  hub.bot(KABIR, 'ready');
  await flush();
  assert.deepEqual(lobbySeats(room.state, MEMBERS).here.map((h) => h.tag), ['host', 'ready', 'here']);
  assert.equal(await room.ready(), true);
  await flush();
  assert.equal(room.state.presence.get(YOU), 'ready');
  assert.equal(room.state.readyAsked, true);
  assert.deepEqual(api.calls.filter((c) => c[0] === 'presence').map((c) => c[2]), ['here', 'ready']);
  hub.send('room.start', { startsAt: new Date(Date.now() + 4000).toISOString() });
  await flush();
  assert.equal(room.state.phase, 'countdown');
  room.go();
  assert.equal(room.state.phase, 'live');
  hub.send('progress', { m: RIYA, q: 1, done: false });
  hub.send('progress', { m: KABIR, q: 1, done: false, pick: 2 }); // dropped whole
  room.answered(1, false);
  await flush();
  assert.equal(room.state.progress.get(RIYA).q, 1);
  assert.equal(room.state.progress.has(KABIR), false);
  hub.send('room.done', {});
  await flush();
  assert.equal(room.state.done, true);
  await room.close();
  assert.equal(hub.clients.size, 0);
  assert.deepEqual(api.calls.at(-1), ['presence', 'g1', 'left']);
  assert.equal(hub.presence.has(YOU), false);
});

test('LV-15 driver: the host starts and cancels; stickers go through the API, never the channel', async () => {
  const hub = createFakeHub();
  const api = fakeApi({ room: { state: 'lobby', startsAt: null, hostMemberId: YOU } });
  const room = createRoomController({ gameId: 'g2', mobId: 'm1', members: MEMBERS, api, openChannel: hub.open });
  await room.connect();
  await flush();
  assert.equal(room.isHost, true);
  await room.sticker('good_luck');
  assert.deepEqual(api.calls.at(-1), ['sticker', 'm1', 'g2', 'good_luck']);
  assert.equal(room.state.stickers.length, 1);
  await room.start();
  assert.equal(room.state.phase, 'countdown');
  assert.ok(Date.parse(room.state.startsAt) > Date.now());
  const room2 = createRoomController({ gameId: 'g3', mobId: 'm1', members: MEMBERS, api, openChannel: createFakeHub().open });
  await room2.connect();
  await room2.cancel();
  assert.equal(room2.state.phase, 'cancelled');
  assert.equal(room2.state.cancelledBy, YOU);
  await room.close();
});

test('LV-16 driver: LIVE_OFF and the other refusals become "play it anytime"; a failed channel falls back; the clock follows the server', async () => {
  const off = createRoomController({ gameId: 'g', mobId: 'm', members: MEMBERS, api: fakeApi({ ticketError: Object.assign(new Error('x'), { code: 'LIVE_OFF', message: 'Live rooms are not on yet. Start it for anytime in 24 hours.' }) }), openChannel: createFakeHub().open });
  await off.connect();
  assert.equal(off.state.phase, 'off');
  assert.match(off.state.notice, /not on yet/);
  const net = createRoomController({ gameId: 'g', mobId: 'm', members: MEMBERS, api: fakeApi({ ticketError: Object.assign(new Error('network'), { network: true }) }), openChannel: createFakeHub().open });
  await net.connect();
  assert.equal(net.state.phase, 'failed');
  const hub = createFakeHub();
  const skew = createRoomController({ gameId: 'g', mobId: 'm', members: MEMBERS, api: fakeApi({ serverSkewMs: 90_000 }), openChannel: hub.open });
  await skew.connect();
  await flush();
  assert.ok(Math.abs(skew.serverNow() - (Date.now() + 90_000)) < 1000);
  hub.fail('CHANNEL_ERROR');
  await flush();
  assert.equal(skew.state.phase, 'fallback');
  assert.equal(hub.clients.size, 0);
  await skew.close();
});

test('LV-17 driver: 10 quiet minutes in the lobby drop the seat; rejoin opens it again', async () => {
  const timers = manualTimers();
  const hub = createFakeHub();
  const api = fakeApi({ hub });
  const room = createRoomController({ gameId: 'g', mobId: 'm', members: MEMBERS, api, openChannel: hub.open, timers });
  await room.connect();
  await flush();
  timers.fire(10 * 60_000);
  assert.equal(room.state.phase, 'away');
  await flush();
  assert.equal(hub.clients.size, 0);
  // The dropped seat is told to the server, so friends see it go at once.
  assert.deepEqual(api.calls.filter((c) => c[0] === 'presence').map((c) => c[2]), ['here', 'left']);
  await room.rejoin();
  await flush();
  assert.equal(room.state.phase, 'lobby');
  assert.equal(hub.clients.size, 1);
  await room.close();
});

test('LV-18 a running room on reconnect resumes straight into the run with no countdown', async () => {
  const go = new Date(Date.now() - 60_000).toISOString();
  const room = createRoomController({ gameId: 'g', mobId: 'm', members: MEMBERS, api: fakeApi({ room: { state: 'running', startsAt: go, hostMemberId: RIYA } }), openChannel: createFakeHub().open });
  await room.connect();
  assert.equal(room.state.phase, 'live');
  await room.close();
});

test('LV-19 the run page wires the live room only behind the server flag', () => {
  const game = readFileSync(new URL('../../src/components/mob/v3/play/MobGame.jsx', import.meta.url), 'utf8');
  assert.match(game, /liveRoomFor\(/);
  assert.match(game, /denLive\.current\?\.enabled === true/);
  const run = readFileSync(new URL('../../src/components/mob/v3/play/GameRun.jsx', import.meta.url), 'utf8');
  assert.match(run, /live\?\.onAnswered/);
  const api = readFileSync(new URL('../../src/components/mob/v3/play/playApi.js', import.meta.url), 'utf8');
  for (const r of ['room/ticket', 'room/start', 'room/cancel']) assert.match(api, new RegExp(r));
  // The dev preview and its fake never ship.
  const preview = readFileSync(new URL('../../src/app/preview/mob-live/page.jsx', import.meta.url), 'utf8');
  assert.match(preview, /NODE_ENV === 'production'\) notFound\(\)/);
  void join;
});

// ---------------------------------------------------------------------------------------------------
// L-55: server-only presence, the heartbeat and the stale drop; the two-player flow; a live race (D167)
// ---------------------------------------------------------------------------------------------------
function manualTimers() {
  return {
    pending: new Map(), next: 1,
    setTimeout(fn, ms) { const id = this.next++; this.pending.set(id, { fn, ms }); return id; },
    clearTimeout(id) { this.pending.delete(id); },
    fire(ms) { for (const [id, t] of [...this.pending]) if (t.ms === ms) { this.pending.delete(id); t.fn(); } },
  };
}

test('LV-20 heartbeat: every 20 s the page posts again; a member silent for 45 s leaves the room on this page', async () => {
  const hub = createFakeHub();
  const api = fakeApi({ hub });
  const timers = manualTimers();
  let clock = Date.parse('2026-10-22T15:00:00.000Z');
  const room = createRoomController({ gameId: 'g', mobId: 'm', members: MEMBERS, api, openChannel: hub.open, timers, now: () => clock });
  await room.connect();
  await flush();
  hub.bot(KABIR, 'here');
  await flush();
  assert.equal(room.state.presence.get(KABIR), 'here');
  clock += 20_000; timers.fire(20_000); await flush();
  assert.equal(api.calls.filter((c) => c[0] === 'presence').length, 2);
  assert.equal(room.state.presence.has(KABIR), true);
  clock += PRESENCE_STALE_MS; timers.fire(20_000); await flush();
  // Kabir never posted again: gone. You posted each beat: still here.
  assert.equal(room.state.presence.has(KABIR), false);
  assert.equal(room.state.presence.get(YOU), 'here');
  await room.close();
  assert.equal(timers.pending.size, 0);
});

test('LV-21 two players: Aarav hosts, Riya joins; both ready; Aarav starts; both count down to one Go; progress crosses; the room ends for both', async () => {
  const hub = createFakeHub();
  const room = { state: 'lobby', startsAt: null, hostMemberId: YOU };
  const two = MEMBERS.filter((m) => m.memberId === YOU || m.memberId === RIYA);
  const apiFor = (memberId) => ({
    ...fakeApi({ room, memberId, hub }),
    start: async () => { const at = new Date(Date.now() + 4000).toISOString(); room.state = 'running'; room.startsAt = at; hub.send('room.start', { startsAt: at }); return { startsAt: at, serverNow: new Date().toISOString() }; },
  });
  const aApi = apiFor(YOU);
  const rApi = apiFor(RIYA);
  const aarav = createRoomController({ gameId: 'g2p', mobId: 'm', members: two, api: aApi, openChannel: hub.open });
  await aarav.connect();
  await flush();
  assert.equal(aarav.isHost, true);
  assert.deepEqual(lobbySeats(aarav.state, two).here.map((h) => [h.name, h.tag]), [['You', 'host']]);
  const riya = createRoomController({ gameId: 'g2p', mobId: 'm', members: two, api: rApi, openChannel: hub.open });
  await riya.connect();
  await flush(); await flush();
  // Each sees the other, by the server's word only.
  assert.deepEqual(lobbySeats(aarav.state, two).here.map((h) => h.name).sort(), ['Riya', 'You']);
  assert.deepEqual(lobbySeats(riya.state, two).here.map((h) => [h.name, h.tag]), [['Aarav', 'host'], ['You', 'here']]);
  assert.equal(riya.isHost, false);
  assert.equal(await riya.ready(), true);
  await flush();
  assert.equal(aarav.state.presence.get(RIYA), 'ready');
  await aarav.start();
  await flush();
  assert.equal(aarav.state.phase, 'countdown');
  assert.equal(riya.state.phase, 'countdown');
  assert.equal(aarav.state.startsAt, riya.state.startsAt);
  aarav.go(); riya.go();
  // Answers acknowledged by the API become the server's progress for the other.
  hub.send('progress', { m: YOU, q: 1, done: false });
  hub.send('progress', { m: RIYA, q: 2, done: false });
  aarav.answered(1, false); riya.answered(2, false);
  await flush();
  assert.equal(aarav.state.progress.get(RIYA).q, 2);
  assert.equal(riya.state.progress.get(YOU).q, 1);
  const racers = liveRacers(aarav.state, two, 5, { answered: 1 });
  assert.deepEqual(racers.map((r) => [r.name, r.at]).sort(), [['Riya', 3], ['You', 2]]);
  hub.send('progress', { m: RIYA, q: 5, done: true });
  riya.answered(5, true);
  await flush();
  assert.deepEqual(stillPlaying(riya.state, two), ['Aarav']);
  assert.equal(aarav.state.toasts.length, 1);
  hub.send('progress', { m: YOU, q: 5, done: true });
  aarav.answered(5, true);
  hub.send('room.done', {});
  await flush();
  assert.equal(everyoneDone(aarav.state), true);
  assert.equal(everyoneDone(riya.state), true);
  await riya.close();
  await flush();
  assert.equal(aarav.state.presence.has(RIYA), false);
  await aarav.close();
});

test('LV-22 a live timed race: the lobby promises the clock, the countdown says the minutes, progress past 20 moves Folds', () => {
  assert.equal(LIVE_COPY.roomSub({ format: 'race', minutes: 10, count: 60 }), 'Live race, 10 minutes');
  assert.equal(LIVE_COPY.sameClock(5), 'Same 5 minutes, same start. You see where friends are, never what they picked.');
  let s = withPresence({ ...lobby(), phase: 'live' }, [[RIYA, 'ready'], [YOU, 'ready']]);
  s = roomReducer(s, { type: 'event', event: 'progress', payload: { m: RIYA, q: 23, done: false }, members: IDS, at: 0 });
  assert.equal(s.progress.get(RIYA).q, 23);
  const r = liveRacers(s, MEMBERS, 60, { answered: 21 });
  assert.deepEqual(r.map((x) => [x.name, x.at]).sort(), [['Riya', 24], ['You', 22]]);
});
