"use client";
// A Mob live room against an in-browser fake of the routes and the fake room channel (liveHub.mjs), with scripted
// friends. Presence is server-only (L-55): the page posts to /room/presence and this fake server broadcasts "presence".
// Params:
//   s=lobby (default: Riya hosts; Kabir joins and readies; once you are ready Riya starts; then the race)
//   s=host (you host; Riya and Kabir join and ready; you press Start)   s=alone (you host; nobody comes)
//   s=hostaway (Riya steps away)   s=cancel (Riya closes the room)   s=busy (the channel fails)   s=off (LIVE_OFF)
//   s=race (the room is running: the live ruler at once)   s=done (you have finished; friends are still playing)
//   s=five (five in the room: compact ruler)   pace=<seconds per answer for the friends> (default 7)
//   hold=1 (the friends never start or move: for still captures)
//   fmt=race (D167: a live timed race, min=5|10, questions served one at a time)
//   s=two (the two-player walk: open this page in two tabs, one with as=riya. Aarav hosts; both tabs are real players
//          on one room, joined through a BroadcastChannel; no scripted friends)
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthContext } from '@/components/AuthProvider';
import { RoleProvider } from '@/lib/roleContext';
import AppLayoutClient from '@/app/(app)/AppLayoutClient';
import MobGame from '@/components/mob/v3/play/MobGame';
import { createFakeHub, createTabHub } from '@/components/mob/v3/live/liveHub.mjs';
import podiumSoFar from '@/../data/tests/fixtures/mob_v3/podium_so_far.json';

const GAME_ID = '7b0c6a52-3f1e-4c55-9a51-2f4b9e0d1c11';
const MOB_ID = '5e2f9a10-8c3d-4b7e-a1f2-6d9c0b3e4a21';
const RIYA = 'K7P2M9QXA1B2';
const AARAV = 'A1B2C3D4E5F6';
const KABIR = 'Z9Y8X7W6V5T4';
const ZOYA = 'M1N2P3Q4R5S6';
const DEV = 'D3V4N5S6H7J8';
const BASE_MEMBERS = [
  { memberId: RIYA, name: 'Riya', colour: 3, fold: 'patang', finish: 'plain', owner: true },
  { memberId: AARAV, name: 'Aarav', colour: 1, fold: 'dart', finish: 'plain', owner: false },
  { memberId: KABIR, name: 'Kabir', colour: 2, fold: 'naav', finish: 'plain', owner: false },
  { memberId: ZOYA, name: 'Zoya', colour: 6, fold: 'cutting', finish: 'plain', owner: false },
];
const QUESTIONS = [
  { q: 0, stem: "Goodwill is three years' purchase of the average profit of the last four years: ₹40,000, ₹50,000, ₹60,000 and ₹70,000. What is the goodwill?", options: ['₹1,50,000', '₹1,65,000', '₹1,80,000', '₹2,10,000'], passage: null },
  { q: 1, stem: 'Which of these is not a method of valuing goodwill?', options: ['Average profit method', 'Super profit method', 'Capitalisation method', 'Sacrificing ratio method'], passage: null },
  { q: 2, stem: 'Super profit is the excess of actual average profit over:', options: ['Normal profit', 'Gross profit', 'Net profit before tax', 'Capital employed'], passage: null },
  { q: 3, stem: 'When a new partner brings goodwill in cash, it is credited to the old partners in their:', options: ['Old ratio', 'New ratio', 'Sacrificing ratio', 'Gaining ratio'], passage: null },
  { q: 4, stem: 'When a partner retires, the gaining ratio is used to share which of these?', options: ['Goodwill of the retiring partner', 'General reserve', 'Revaluation profit', 'Capital balances'], passage: null },
];
const KEY = [1, 3, 0, 2, 0];
const questionAt = (q) => ({ ...QUESTIONS[q % QUESTIONS.length], q });

function makeWorld(params) {
  const s = params.get('s') || 'lobby';
  const hold = params.get('hold') === '1';
  const two = s === 'two';
  const me = two && params.get('as') === 'riya' ? RIYA : AARAV;
  const race = params.get('fmt') === 'race';
  const minutes = params.get('min') === '10' ? 10 : 5;
  const count = race ? (minutes === 10 ? 60 : 30) : 5;
  const pace = (Number(params.get('pace')) || (race ? 9 : 7)) * 1000;
  const host = two || ['host', 'alone'].includes(s) ? AARAV : RIYA;
  const five = s === 'five';
  const base = five ? [...BASE_MEMBERS, { memberId: DEV, name: 'Dev', colour: 4, fold: 'hop', finish: 'plain', owner: false }] : BASE_MEMBERS;
  const members = (two ? base.filter((m) => m.memberId === AARAV || m.memberId === RIYA) : base).map((m) => ({ ...m, you: m.memberId === me }));
  const ids = new Set(members.map((m) => m.memberId));
  const hub = two ? createTabHub(GAME_ID, { delay: 60 }) : createFakeHub({ delay: 60 });
  const now = Date.now();
  const runMs = race ? minutes * 60_000 : 6 * 60_000;
  const world = {
    hub, members, me, host, race, minutes, count, two,
    room: { state: 'lobby', startsAt: null, endsAt: null },
    openedAt: new Date(now - (host === me ? 3_000 : 4 * 60_000)).toISOString(),
    closesAt: new Date(now + 24 * 3600_000 - 4 * 60_000).toISOString(),
    answers: [], finished: false, timers: [], startedRace: false, progress: new Map(),
  };
  const later = (ms, fn) => world.timers.push(setTimeout(fn, ms));
  const others = members.filter((m) => m.memberId !== me).map((m) => m.memberId);
  const racers = two ? [] : five ? others : others.filter((id) => id !== ZOYA);

  // The fake server follows its own broadcasts, so two tabs keep one room.
  hub.listen((event, p) => {
    if (event === 'room.start' && world.room.state === 'lobby') world.room = { state: 'running', startsAt: p.startsAt, endsAt: new Date(Date.parse(p.startsAt) + runMs).toISOString() };
    if (event === 'room.cancel') world.room = { state: 'cancelled' };
    if (event === 'room.done' && world.room.state === 'running') world.room = { ...world.room, state: 'done' };
    if (event === 'progress' && p && ids.has(p.m)) { world.progress.set(p.m, p); maybeDone(); }
  });

  function startRoom(at) {
    if (world.room.state !== 'lobby') return;
    hub.send('room.start', { startsAt: new Date(at).toISOString() });
    if (!hold) bots(at);
  }
  function bots(go) {
    if (world.startedRace) return;
    world.startedRace = true;
    racers.forEach((id, i) => {
      const step = pace + i * 1600;
      const last = race ? Math.floor(runMs / step) : count;
      for (let q = 1; q <= last; q += 1) {
        const at = go + q * step - Date.now();
        later(Math.max(50, at), () => hub.send('progress', { m: id, q, done: !race && q === count }));
      }
      if (race) later(Math.max(50, go + runMs - Date.now()), () => hub.send('progress', { m: id, q: last, done: true }));
    });
  }
  function maybeDone() {
    if (world.room.state !== 'running') return;
    const inRoom = [...hub.presence.keys()].filter((id) => ids.has(id));
    const everyone = new Set([...inRoom, ...racers, me]);
    if ([...everyone].every((id) => world.progress.get(id)?.done)) hub.send('room.done', {});
  }
  world.maybeDone = maybeDone;
  world.startRoom = startRoom;
  world.ids = ids;

  // The friends.
  if (s === 'off') { world.off = true; return world; }
  if (two) return world;
  if (s === 'race' || s === 'done' || s === 'five') {
    const go = now - 1500;
    world.room = { state: 'running', startsAt: new Date(go).toISOString(), endsAt: new Date(go + runMs).toISOString() };
    for (const id of racers) hub.bot(id, 'ready');
    if (s === 'done') { world.answers = KEY.map((k, q) => ({ q, pick: q === 2 ? 1 : k, correct: q !== 2, elapsedMs: 9000 * (q + 1) })); world.finished = true; }
    if (!hold) bots(go);
    return world;
  }
  if (s === 'alone') return world;
  if (host === RIYA) hub.bot(RIYA, 'here');
  later(900, () => hub.bot(KABIR, 'here'));
  if (s === 'host') later(1600, () => hub.bot(RIYA, 'here'));
  if (!hold) {
    later(2600, () => hub.bot(KABIR, 'ready'));
    later(3200, () => hub.send('sticker', { m: KABIR, k: 'good_luck' }));
    if (s === 'host') later(3800, () => hub.bot(RIYA, 'ready'));
  }
  if (s === 'hostaway') later(2400, () => hub.bot(RIYA, null));
  if (s === 'cancel') later(3600, () => hub.send('room.cancel', {}));
  if (s === 'busy') later(2000, () => hub.fail('CHANNEL_ERROR'));
  if (s === 'lobby' && !hold) world.onReady = () => later(1400, () => startRoom(Date.now() + 4000));
  return world;
}

function makeServer(world) {
  const reply = (body, status = 200, wait = 140) => new Promise((resolve) => setTimeout(() => resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })), wait));
  const fail = (code, message, status = 409) => reply({ error: { code, message } }, status);
  const marks = () => world.answers.reduce((m, a) => m + (a.correct === true ? 5 : a.correct === false ? -1 : 0), 0);
  const { me, race, minutes, count } = world;
  const hostMember = world.members.find((m) => m.memberId === world.host);
  const hostIsMe = world.host === me;
  const meMember = world.members.find((m) => m.memberId === me);
  const game = () => ({
    id: GAME_ID, mobId: MOB_ID, format: race ? 'race' : 'sprint', mode: 'live', count, minutes: race ? minutes : null, secondsPerQuestion: race ? null : 60, subjectName: 'Accountancy', chapter: 'Goodwill',
    title: hostIsMe ? (race ? 'Your race' : 'Your sprint') : `${hostMember.name}'s ${race ? 'race' : 'sprint'}`,
    host: hostIsMe ? { memberId: me, name: meMember.name, you: true } : { memberId: hostMember.memberId, name: hostMember.name, you: false },
    openedAt: world.openedAt, closesAt: world.closesAt, closed: false, serverNow: new Date().toISOString(),
    room: { ...world.room, roster: world.hub.roster() }, runs: [], you: { run: world.answers.length ? 'playing' : 'none', marks: null, answered: world.answers.length }, ghosts: [], podiumReady: world.finished,
  });
  const den = {
    mob: {
      id: MOB_ID, subject: 'accountancy', subjectName: 'Accountancy', you: { memberId: me, name: meMember.name, colour: meMember.colour }, members: [],
      v3: { name: { key: 0, text: 'Chai Circle' }, members: world.members, live: { enabled: true, hoursOk: true }, games: [], starts: { billingOn: false, can: true, modes: ['live', 'async'] } },
    },
  };
  const served = () => (race ? Array.from({ length: Math.min(count, world.answers.length + 1) }, (_, q) => questionAt(q)) : QUESTIONS);
  return async (url, method, init) => {
    const path = url.pathname;
    const base = `/api/mob/game/${GAME_ID}`;
    if (path === '/api/mob' && method === 'GET') return reply(den);
    if (path === base && method === 'GET') return reply({ game: game() });
    if (path === `${base}/room/ticket` && method === 'POST') {
      if (world.off) return fail('LIVE_OFF', 'Live rooms are not on yet. Start it for anytime in 24 hours.');
      return reply({ topic: `mob-room:${GAME_ID}`, memberId: me, expiresAt: new Date(Date.now() + 50 * 60_000).toISOString(), room: { ...world.room, hostMemberId: world.host, roster: world.hub.roster() }, serverNow: new Date().toISOString() });
    }
    if (path === `${base}/room/presence` && method === 'POST') {
      const { st } = JSON.parse(init.body || '{}');
      world.hub.send('presence', { m: me, st });
      if (st === 'ready') world.onReady?.();
      return reply({ ok: true, serverNow: new Date().toISOString() }, 200, 80);
    }
    if (path === `${base}/room/start` && method === 'POST') {
      const at = Date.now() + 4000;
      world.startRoom?.(at);
      return reply({ startsAt: new Date(at).toISOString(), serverNow: new Date().toISOString() });
    }
    if (path === `${base}/room/cancel` && method === 'POST') { world.hub.send('room.cancel', {}); return reply({ ok: true }); }
    if (path === `${base}/run` && method === 'POST') {
      const live = world.room.state === 'running';
      const startedAt = live ? world.room.startsAt : new Date().toISOString();
      const endsAt = new Date(Date.parse(startedAt) + (race ? minutes * 60_000 : 6 * 60_000)).toISOString();
      return reply({ run: { startedAt, endsAt, minutes: race ? minutes : undefined, serverNow: new Date().toISOString(), live, answers: world.answers }, questions: served(), ghosts: [] }, 200, 300);
    }
    if (path === `${base}/answer` && method === 'POST') {
      const { q, pick } = JSON.parse(init.body || '{}');
      if (!world.answers.find((a) => a.q === q)) world.answers.push({ q, pick, correct: pick < 0 ? null : pick === KEY[q % KEY.length], elapsedMs: Date.now() - Date.parse(world.room.startsAt || new Date().toISOString()) });
      const a = world.answers.find((x) => x.q === q);
      const done = world.answers.length >= count;
      if (world.room.state === 'running') world.hub.send('progress', { m: me, q: world.answers.length, done });
      return reply({
        correct: a.correct, delta: a.correct === true ? 5 : a.correct === false ? -1 : 0, marks: marks(), elapsedMs: a.elapsedMs, answered: world.answers.length, count, finished: done,
        ...(race ? { next: done ? null : questionAt(world.answers.length), endsAt: world.room.endsAt } : {}), serverNow: new Date().toISOString(),
      }, 200, 180);
    }
    if (path === `${base}/finish` && method === 'POST') {
      world.finished = true;
      if (world.room.state === 'running') world.hub.send('progress', { m: me, q: world.answers.length, done: true });
      const right = world.answers.filter((x) => x.correct === true).length;
      const wrong = world.answers.filter((x) => x.correct === false).length;
      return reply({ run: { finished: true, marks: marks(), answered: world.answers.length, right, wrong, skipped: world.answers.length - right - wrong } });
    }
    if (path === `${base}/podium` && method === 'GET') return reply(podiumSoFar);
    if (path === '/api/mob/sticker' && method === 'POST') {
      const { kind } = JSON.parse(init.body || '{}');
      world.hub.send('sticker', { m: me, k: kind });
      return reply({ ok: true });
    }
    return reply({ error: { code: 'PREVIEW', message: 'Not in this preview.' } }, 404, 20);
  };
}

let current = null;
function worldFor(search) {
  if (current?.key === search) return current;
  for (const t of current?.world.timers || []) clearTimeout(t);
  current?.world.hub.close?.();
  const params = new URLSearchParams(search);
  const world = makeWorld(params);
  current = { key: search, world, server: makeServer(world) };
  return current;
}

if (typeof window !== 'undefined' && !window.__mobLivePreviewFetch) {
  window.__mobLivePreviewFetch = true;
  const real = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
    if (!window.location.pathname.startsWith('/preview/mob-live') || !url.pathname.startsWith('/api/')) return real(input, init);
    return worldFor(window.location.search).server(url, (init.method || 'GET').toUpperCase(), init);
  };
}

function Inner() {
  const params = useSearchParams();
  const search = `?${params.toString()}`;
  const { world } = worldFor(search === '?' ? '' : search);
  const meName = world.members.find((m) => m.memberId === world.me)?.name || 'Aarav';
  const auth = useMemo(() => ({
    user: { id: 'preview-user', name: meName, email: 'preview@example.test', role: 'student', subjects: ['accountancy', 'economics', 'business_studies', 'english'], isPremium: false, creditBalance: 0 },
    status: 'authenticated', needsOnboarding: false, isAuthenticated: true,
    signInWithGoogle: async () => ({}), signInWithEmail: async () => ({}), verifyEmailOtp: async () => ({}), signOut: async () => {}, refreshSession: async () => {},
  }), [meName]);
  const hrefFor = (v) => (v === 'run' ? `/preview/mob-live${search}` : `/preview/mob-play?view=${v}${world.race ? '&fmt=race' : ''}`);
  return (
    <AuthContext.Provider value={auth}>
      <RoleProvider>
        <AppLayoutClient previewRoute={`/mob/game/${GAME_ID}`} previewLinks={{ mob: '/preview/mob-den' }} mobEnabled>
          <MobGame key={search} gameId={GAME_ID} view="run" hrefFor={hrefFor} denHref="/preview/mob-den" openChannel={world.hub.open} />
        </AppLayoutClient>
      </RoleProvider>
    </AuthContext.Provider>
  );
}

export default function MobLivePreviewClient() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
