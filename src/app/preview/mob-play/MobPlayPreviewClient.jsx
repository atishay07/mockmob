"use client";
// The Mob v3 game screens against an in-browser fake of the game routes, built from the server's own fixtures.
// Params: view=run|podium|moments|fix; run=ready|play|resume|done|closed; closed=1 (the game has closed);
// podium=table|only|private; check=open (the Wednesday check is open); t=<seconds> (how long the run has been going);
// slow=1 (answers take 1.5 s, to see "Saving your answer"); fail=1 (the game does not load).
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthContext } from '@/components/AuthProvider';
import { RoleProvider } from '@/lib/roleContext';
import AppLayoutClient from '@/app/(app)/AppLayoutClient';
import MobGame from '@/components/mob/v3/play/MobGame';
import gameGet from '@/../data/tests/fixtures/mob_v3/game_get.json';
import runStart from '@/../data/tests/fixtures/mob_v3/run_start.json';
import runResume from '@/../data/tests/fixtures/mob_v3/run_resume.json';
import podiumSoFar from '@/../data/tests/fixtures/mob_v3/podium_so_far.json';
import podiumClosed from '@/../data/tests/fixtures/mob_v3/podium_closed.json';
import reviewFx from '@/../data/tests/fixtures/mob_v3/review.json';
import fixStartFx from '@/../data/tests/fixtures/mob_v3/fix_start.json';
import fixAnswerFx from '@/../data/tests/fixtures/mob_v3/fix_answer.json';
import denGet from '@/../data/tests/fixtures/mob_v3/den_get.json';
import errorsFx from '@/../data/tests/fixtures/mob_v3/errors_v3.json';

const GAME_ID = 'uuid-1';
// The preview's own answer key (the fixtures' bank is illustrative). The page never sees it before close.
const KEY = [1, 2, 0, 1, 2];

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
function shift(value, by) {
  if (typeof value === 'string' && ISO.test(value)) return new Date(Date.parse(value) + by).toISOString();
  if (Array.isArray(value)) return value.map((v) => shift(v, by));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shift(v, by)]));
  return value;
}

function makeServer(params) {
  const anchor = Date.parse(gameGet.game.serverNow);
  const by = Date.now() - anchor;
  const closed = params.get('closed') === '1' || params.get('run') === 'closed';
  const runState = params.get('run') || 'play';
  const slow = params.get('slow') === '1';
  const lead = (Number(params.get('t')) || (runState === 'resume' ? 99 : 0)) * 1000;
  const g0 = shift(gameGet.game, by);
  const game = {
    ...g0,
    closed,
    closesAt: closed ? new Date(Date.now() - 2 * 3600_000).toISOString() : g0.closesAt,
    runs: g0.runs.filter((r) => r.memberId !== 'member-3'),
    you: runState === 'done' || params.get('view') && params.get('view') !== 'run' ? g0.you : { run: runState === 'resume' ? 'playing' : 'none', marks: null, answered: 0 },
  };
  const startedAt = Date.now() - lead;
  const resume = runState === 'resume' ? runResume.run.answers : [];
  const state = { answers: resume.map((a) => ({ ...a })), finished: false };
  const marksOf = () => state.answers.reduce((m, a) => m + (a.correct === true ? 5 : a.correct === false ? -1 : 0), 0);
  const reply = (body, status = 200, wait = 120) => new Promise((resolve) => setTimeout(() => resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })), wait));
  const err = (code) => reply(errorsFx[code]?.body || { error: { code, message: code } }, errorsFx[code]?.status || 409);
  const podiumBody = () => {
    const base = shift(closed ? podiumClosed : podiumSoFar, by);
    const mode = params.get('podium');
    if (mode === 'table') return { ...base, showPodium: false, tie: null, places: base.places.map(({ place, floor, ...p }) => p) };
    if (mode === 'only') return { ...base, headline: { kind: 'together', right: 3, of: 5 }, tie: null, places: base.places.filter((p) => p.you).map((p) => ({ ...p, place: 1 })), moments: base.moments.filter((m) => m.memberId === 'member-3') };
    if (mode === 'private') return { ...base, places: base.places.map((p) => (p.memberId === 'member-1' ? { memberId: p.memberId, name: p.name, fold: p.fold, colour: p.colour, marks: null, you: false } : p)), tie: null };
    return base;
  };
  const reviewBody = () => {
    // The review keeps its own dates (a Wednesday check after today), so the weekday in the copy is true.
    const r = structuredClone(reviewFx);
    if (params.get('check') === 'open') r.trap.fix.check.state = 'open';
    return r;
  };
  return async (url, method, init) => {
    const path = url.pathname;
    if (params.get('fail') === '1') return reply({ error: { code: 'UNAVAILABLE', message: 'Your Mob did not load. Try again shortly.' } }, 503);
    if (path === '/api/mob' && method === 'GET') return reply(denGet);
    if (path === `/api/mob/game/${GAME_ID}` && method === 'GET') return reply({ game: { ...game, serverNow: new Date().toISOString() } });
    if (path === `/api/mob/game/${GAME_ID}/run` && method === 'POST') {
      if (closed) return err('GAME_CLOSED');
      const src = runState === 'resume' ? runResume : runStart;
      return reply({ ...src, run: { ...src.run, startedAt: new Date(startedAt).toISOString(), endsAt: new Date(startedAt + 6 * 60_000).toISOString(), serverNow: new Date().toISOString(), answers: state.answers }, ghosts: shift(src.ghosts, by) }, 200, 400);
    }
    if (path === `/api/mob/game/${GAME_ID}/answer` && method === 'POST') {
      const { q, pick } = JSON.parse(init.body || '{}');
      const prior = state.answers.find((a) => a.q === q);
      if (!prior) state.answers.push({ q, pick, correct: pick < 0 ? null : pick === KEY[q], elapsedMs: Date.now() - startedAt });
      const a = state.answers.find((x) => x.q === q);
      const delta = a.correct === true ? 5 : a.correct === false ? -1 : 0;
      return reply({ correct: a.correct, delta, marks: marksOf(), elapsedMs: a.elapsedMs, answered: state.answers.length, count: 5, finished: state.answers.length >= 5, serverNow: new Date().toISOString() }, 200, slow ? 1500 : 160);
    }
    if (path === `/api/mob/game/${GAME_ID}/finish` && method === 'POST') { state.finished = true; return reply({ run: { finished: true, marks: runState === 'done' ? 9 : marksOf() } }); }
    if (path === `/api/mob/game/${GAME_ID}/podium` && method === 'GET') return reply(podiumBody());
    if (path === `/api/mob/game/${GAME_ID}/review` && method === 'GET') return closed ? reply(reviewBody()) : err('REVIEW_NOT_YET');
    if (path === '/api/mob/fix/start' && method === 'POST') {
      if (!closed) return err('FIX_NOT_YET');
      const { stage } = JSON.parse(init.body || '{}');
      return reply(stage === 'check' ? { ...fixStartFx, question: { ...fixStartFx.question, stem: 'Goodwill question 44', options: fixStartFx.question.options.map((o) => o.replace('31', '44')) } } : fixStartFx);
    }
    if (path === '/api/mob/fix/answer' && method === 'POST') {
      const { pick } = JSON.parse(init.body || '{}');
      return reply({ ...fixAnswerFx, correct: pick === fixAnswerFx.correctIndex });
    }
    if (path === '/api/mob/sticker' && method === 'POST') return reply({ ok: true });
    return reply({ error: { code: 'PREVIEW', message: 'Not in this preview.' } }, 404, 20);
  };
}

if (typeof window !== 'undefined' && !window.__mobPlayPreviewFetch) {
  window.__mobPlayPreviewFetch = true;
  const real = window.fetch.bind(window);
  let server = null;
  let serverKey = '';
  window.fetch = (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
    if (!window.location.pathname.startsWith('/preview/mob-play') || !url.pathname.startsWith('/api/')) return real(input, init);
    const key = window.location.search;
    if (!server || serverKey !== key) { server = makeServer(new URLSearchParams(key)); serverKey = key; }
    return server(url, (init.method || 'GET').toUpperCase(), init);
  };
}

function Inner() {
  const params = useSearchParams();
  const view = params.get('view') || 'run';
  const auth = useMemo(() => ({
    user: { id: 'preview-user', name: 'Aarav', email: 'preview@example.test', role: 'student', subjects: ['accountancy', 'economics', 'business_studies', 'english'], isPremium: false, creditBalance: 0 },
    status: 'authenticated', needsOnboarding: false, isAuthenticated: true,
    signInWithGoogle: async () => ({}), signInWithEmail: async () => ({}), verifyEmailOtp: async () => ({}), signOut: async () => {}, refreshSession: async () => {},
  }), []);
  const keep = ['closed', 'podium', 'check'];
  const hrefFor = (v) => {
    const q = new URLSearchParams({ view: v });
    for (const k of keep) if (params.get(k)) q.set(k, params.get(k));
    if (v === 'run') q.set('run', 'done');
    return `/preview/mob-play?${q}`;
  };
  return (
    <AuthContext.Provider value={auth}>
      <RoleProvider>
        <AppLayoutClient previewRoute={`/mob/game/${GAME_ID}`} previewLinks={{ mob: '/preview/mob-play' }} mobEnabled>
          <MobGame key={params.toString()} gameId={GAME_ID} view={view} autoStart={params.get('run') === 'play'} hrefFor={hrefFor} denHref="/preview/mob-play?view=run&run=ready" />
        </AppLayoutClient>
      </RoleProvider>
    </AuthContext.Provider>
  );
}

export default function MobPlayPreviewClient() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
