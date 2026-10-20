// /preview/mob-den: the web den against the server's own v3 fixtures (data/tests/fixtures/mob_v3, real response shapes,
// MOB-SERVER-A.md), dressed as the spec's Chai Circle (Aarav you as Dart, Riya Patang, Kabir Naav, Zoya Cutting).
// Development only: writes change this tab's copy and nothing else; no request leaves for a real account route.
//   ?den=quiet (D1) | open (D2, the default) | played (D3) | live (D4 lobby) | running (D4 room started) | one (D5)
//        | ask (D1, your start used, billing on) | loading (D6) | failed (D6) | none (D0) | nosubjects (D0)
//        | moments (K2, K3, K4, K1 in order) | notice (K5 pass notice) | past (quest past the goal)
//   &billing=free | used | mic | pro (P1 with billing on) ; &view=chains | chains-mob | shelf | join
//   &delay=<ms> holds the den's read that long (D6: the skeleton, then the den over it) ; &stickers=1 two friends' stickers
//   window.__denPush('member-2', 'nice_one') adds a friend's sticker now; the den's next live read brings it in.
import denGet from '@/../data/tests/fixtures/mob_v3/den_get.json';
import chainFx from '@/../data/tests/fixtures/mob_v3/chain.json';
import shelfFx from '@/../data/tests/fixtures/mob_v3/shelf.json';
import inviteFx from '@/../data/tests/fixtures/mob_v3/invite.json';
import lookupFx from '@/../data/tests/fixtures/mob_v3/lookup.json';
import startsFree from '@/../data/tests/fixtures/mob_v3/starts_free.json';
import startsUsed from '@/../data/tests/fixtures/mob_v3/starts_used.json';
import startsMic from '@/../data/tests/fixtures/mob_v3/starts_mic.json';
import startsPro from '@/../data/tests/fixtures/mob_v3/starts_pro.json';
import gameOpen from '@/../data/tests/fixtures/mob_v3/game_open_201.json';

const clone = (v) => JSON.parse(JSON.stringify(v));
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
// The fixtures are set on Thursday 22 Oct, 3:00 PM IST; shift every time so "tomorrow" reads true today.
const FIXTURE_NOW = Date.parse('2026-10-22T09:30:00.000Z');
function shift(value, by) {
  if (typeof value === 'string' && ISO.test(value)) return new Date(Date.parse(value) + by).toISOString();
  if (Array.isArray(value)) return value.map((v) => shift(v, by));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shift(v, by)]));
  return value;
}
const dayKey = (ms) => new Date(ms + 330 * 60_000).toISOString().slice(0, 10);

function chaiCircle() {
  const d = clone(denGet);
  const v3 = d.mob.v3;
  d.mob.you = { ...d.mob.you, memberId: 'member-3', name: 'Aarav', colour: 1 };
  v3.members = [
    { memberId: 'member-3', name: 'Aarav', colour: 1, fold: 'dart', finish: 'plain', you: true, owner: true },
    { memberId: 'member-2', name: 'Riya', colour: 3, fold: 'patang', finish: 'plain', you: false, owner: false },
    { memberId: 'member-1', name: 'Kabir', colour: 2, fold: 'naav', finish: 'plain', you: false, owner: false },
    { memberId: 'member-4', name: 'Zoya', colour: 6, fold: 'cutting', finish: 'plain', you: false, owner: false },
  ];
  d.mob.members = v3.members.map((m) => ({ memberId: m.memberId, name: m.name, colour: m.colour, you: m.you, sat: false, owner: m.owner }));
  v3.youOwn = true;
  const riya = { memberId: 'member-2', name: 'Riya' };
  v3.games = [{
    id: 'uuid-1', format: 'sprint', mode: 'async', count: 5, chapter: 'Goodwill', subjectName: 'Accountancy', title: "Riya's sprint", host: riya,
    openedAt: '2026-10-22T08:35:00.000Z', closesAt: '2026-10-23T08:35:00.000Z', closed: false, room: null,
    runs: [{ memberId: 'member-2', name: 'Riya', at: '2026-10-22T08:43:00.000Z' }, { memberId: 'member-1', name: 'Kabir', at: '2026-10-22T09:23:00.000Z' }, { memberId: 'member-4', name: 'Zoya', at: '2026-10-22T12:58:00.000Z' }],
    yourRun: 'none', podiumReady: false,
  }, {
    id: 'uuid-3', format: 'sprint', mode: 'async', count: 5, chapter: null, subjectName: 'Accountancy', title: "Kabir's sprint", host: { memberId: 'member-1', name: 'Kabir' },
    openedAt: '2026-10-22T09:00:00.000Z', closesAt: '2026-10-23T09:00:00.000Z', closed: false, room: null, runs: [], yourRun: 'none', podiumReady: false,
  }];
  v3.quest = { ...v3.quest, answered: 51, target: 60, bySource: [{ label: "Monday's Mob paper", answered: 37 }, { label: "Riya's sprint", answered: 14 }] };
  v3.mobChain = { weeks: 3, best: 3, passes: 0, stitchedThisWeek: false, restarted: false, next: { at: 4, item: 'stamp' } };
  v3.shelf = { items: ['den_stamp'], nextItem: { at: 4, item: 'desk_bell' } };
  v3.chainChip = { hidden: false, days: 13, todayDone: false };
  d.mob.week = { ...d.mob.week, youSat: true, yourResultId: 'fixture-attempt', sat: 3 };
  d.mob.invite = null;
  return d;
}

function richChain(now) {
  const c = clone(chainFx);
  const today = dayKey(now);
  const states = ['practised', 'practised', 'rested', 'practised', 'practised', 'practised'];
  c.days = 13; c.practised = 12; c.rested = 1; c.best = 13;
  c.passes = { held: 2, max: 2, next: { kind: 'days', at: 14 } };
  c.today = { answered: 2, needed: 5, done: false };
  c.week = [...states.map((state, i) => ({ day: dayKey(now - (6 - i) * 86_400_000), state })), { day: today, state: 'today', answered: 2 }];
  const month = today.slice(0, 7);
  const days = Number(today.slice(8));
  c.calendar = Array.from({ length: 31 }, (_, i) => {
    const day = `${month}-${String(i + 1).padStart(2, '0')}`;
    const n = i + 1;
    const state = n === days ? 'today' : n > days ? 'none' : n >= days - 12 ? (n === days - 4 ? 'rested' : 'practised') : 'none';
    return { day, state };
  }).filter((d) => !Number.isNaN(Date.parse(`${d.day}T00:00:00Z`)) && new Date(`${d.day}T00:00:00Z`).getUTCMonth() + 1 === Number(month.slice(5)));
  c.milestones = c.milestones.map((m) => (m.at <= 13 ? { ...m, done: true, left: 0 } : { ...m, done: false, left: m.at - 13 }));
  c.notices = [{ key: `rest:${dayKey(now - 4 * 86_400_000)}`, kind: 'rested', day: dayKey(now - 4 * 86_400_000), days: 13 }];
  return c;
}

export function denFixture(params, now = Date.now()) {
  const kind = params.get('den') || 'open';
  // Whole 10-minute steps, so a reload within a few minutes keeps the same times (a sticker flies once per session).
  const by = Math.round((now - FIXTURE_NOW) / 600_000) * 600_000;
  if (kind === 'none' || kind === 'nosubjects') return { mob: null, v3Available: true };
  const d = chaiCircle();
  const v3 = d.mob.v3;
  if (kind === 'quiet' || kind === 'ask' || kind === 'notice') v3.games = [];
  if (kind === 'played') {
    v3.games[0].yourRun = 'finished'; v3.games[0].podiumReady = true;
    v3.games[0].runs.push({ memberId: 'member-3', name: 'Aarav', at: '2026-10-22T09:14:00.000Z' });
    v3.games = [v3.games[0]];
  }
  if (kind === 'live') { v3.games[0].mode = 'live'; v3.games[0].room = { state: 'lobby', startsAt: null }; v3.games[0].runs = []; }
  if (kind === 'running') { v3.games[0].mode = 'live'; v3.games[0].room = { state: 'running', startsAt: '2026-10-22T09:23:00.000Z' }; }
  if (kind === 'one') {
    v3.members = v3.members.slice(0, 1); d.mob.members = d.mob.members.slice(0, 1); d.mob.week = { ...d.mob.week, size: 1, youSat: false, yourResultId: null, sat: 0 };
    d.mob.seatsLeft = 4; v3.games = []; v3.quest = { ...v3.quest, answered: 0, target: 15, sizedFor: 1, bySource: [] }; v3.mobChain = { ...v3.mobChain, weeks: 0, best: 0 }; v3.shelf = { items: [], nextItem: { at: 2, item: 'den_stamp' } };
    d.mob.invite = params.get('invite') === 'none' ? null : { code: inviteFx.code, url: inviteFx.url, expiresAt: inviteFx.expiresAt, usesLeft: 4 };
  }
  if (kind === 'past') v3.quest = { ...v3.quest, answered: 70, done: true, doneAt: '2026-10-22T09:00:00.000Z' };
  if (kind === 'moments') {
    v3.quest = { ...v3.quest, answered: 70, target: 60, done: true, doneAt: '2026-10-22T09:00:00.000Z', parcel: { kind: 'fold', fold: 'hop' } };
    v3.mobChain = { ...v3.mobChain, weeks: 4, best: 4 };
    v3.moments = [`chain:14`, `reveal:hop`, `stitch:uuid-2:2026-10-19`, `quest_done:uuid-2:2026-10-19`];
    if (params.get('only')) v3.moments = v3.moments.filter((k) => k.startsWith(params.get('only')));
  }
  const billing = params.get('billing') || (kind === 'ask' ? 'used' : null);
  if (billing) v3.starts = clone({ free: startsFree, used: startsUsed, mic: startsMic, pro: startsPro }[billing] || v3.starts);
  if (params.get('live') === 'off') v3.live = { enabled: false, hoursOk: true };
  if (params.get('hours') === 'off') v3.live = { enabled: true, hoursOk: false };
  if (params.get('stickers') === '1') v3.reactions = [{ memberId: 'member-2', kind: 'nice_one', at: '2026-10-22T09:20:00.000Z' }, { memberId: 'member-1', kind: 'again', at: '2026-10-22T09:25:00.000Z' }];
  return shift(d, by);
}

function shelfFixture() {
  const s = clone(shelfFx);
  s.seat = { fold: 'dart', finish: 'plain' };
  s.folds = s.folds.map((f) => (f.key === 'crane' ? { ...f, have: 1 } : f.key === 'stamp' ? { ...f, have: 3 } : f.key === 'sticky' ? { ...f, have: 2 } : f));
  s.folds = s.folds.map((f) => ({ ...f, finishes: { foil: { ...(f.finishes?.foil || {}), have: 13, need: 30 } } }));
  s.mobItems = [{ mobId: 'uuid-2', name: 'Chai Circle', items: [{ item: 'den_stamp', owned: true }, { item: 'desk_bell', owned: false, have: 3, need: 4 }, { item: 'brass_lamp', owned: false, have: 3, need: 8 }, { item: 'foil_seal', owned: false, have: 3, need: 12 }] }];
  return s;
}

const CHAPTERS = { chapters: [{ chapter: 'Goodwill', ready: 40, longest: 20 }, { chapter: 'Partnership Fundamentals', ready: 30, longest: 20 }, { chapter: 'Admission of a Partner', ready: 14, longest: 10 }] };

/** The fetch stub: every /api/ call answers from the fixtures; nothing reaches a real route. */
export function installDenPreview() {
  if (typeof window === 'undefined' || window.__denPreviewFetch) return;
  const real = window.fetch.bind(window);
  window.__denPreviewFetch = true;
  window.__denWrites = [];
  const json = (body, status = 200) => new Promise((resolve) => setTimeout(() => resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })), 120));
  let state = null;
  let chain = null;
  window.__denPush = (memberId, kind) => {
    if (!state) return;
    state = clone(state);
    state.mob.v3.reactions = [...(state.mob.v3.reactions || []), { memberId, kind, at: new Date().toISOString() }];
  };
  window.fetch = (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
    if (!window.location.pathname.startsWith('/preview/mob-den') || !url.pathname.startsWith('/api/')) return real(input, init);
    const params = new URLSearchParams(window.location.search);
    const method = (init.method || 'GET').toUpperCase();
    const body = (() => { try { return init.body ? JSON.parse(init.body) : null; } catch { return null; } })();
    if (!state) state = denFixture(params);
    if (!chain) chain = richChain(Date.now());
    const p = url.pathname;
    if (method !== 'GET') window.__denWrites.push({ path: p, method, body });
    if (p === '/api/mob' && method === 'GET') {
      if (params.get('den') === 'loading') return new Promise(() => {});
      if (params.get('den') === 'failed') return json({ error: { code: 'UNAVAILABLE', message: "Your Mob didn't load." } }, 503);
      const delay = Number(params.get('delay'));
      if (Number.isFinite(delay) && delay > 0 && !window.__denDelayed) {
        window.__denDelayed = true;
        return new Promise((resolve) => setTimeout(() => resolve(json(state)), delay));
      }
      return json(state);
    }
    if (p === '/api/mob' && method === 'POST') { state = denFixture(new URLSearchParams('den=one')); return json(state); }
    if (p === '/api/mob/join' && method === 'POST') { state = denFixture(new URLSearchParams('den=quiet')); return json(state); }
    if (p.startsWith('/api/mob/join/')) {
      const code = p.split('/').pop();
      if (code === '000000') return json({ error: { code: 'INVITE_EXPIRED', message: 'This invite can\'t be used. Ask your friend for a new link.' } }, 410);
      return json({ ...lookupFx, code, size: 3, seatsLeft: 2, name: 'Steady Kites' });
    }
    if (p === '/api/mob/invite') return json(inviteFx);
    if (p === '/api/mob/extra') return json(CHAPTERS);
    if (p === '/api/mob/shelf') return json(shelfFixture());
    if (p === '/api/mob/profile') return json({ fold: body?.fold || 'dart', finish: 'plain' });
    if (p === '/api/mob/sticker' || p === '/api/mob/seen') return json({ ok: true });
    if (p === '/api/mob/mic') return json({ micsToGive: 1 });
    if (p === '/api/mob/game' && method === 'POST') return json(gameOpen, 201);
    if (p === '/api/mob/settings') {
      state = clone(state);
      if (typeof body?.showPodium === 'boolean') state.mob.v3.showPodium = body.showPodium;
      if (Number.isInteger(body?.nameKey)) state.mob.v3.name = { key: body.nameKey, text: ['Chai Circle', 'Quiet Comets', 'Margin Makers', 'Steady Kites', 'Ledger Club', 'Paper Planes'][body.nameKey] || 'Chai Circle' };
      return json(state);
    }
    if (p === '/api/mob/step-out') { state = clone(state); state.mob.v3.quest.youSteppedOut = Boolean(body?.on); return json(state); }
    if (p === '/api/mob/me') { state = clone(state); Object.assign(state.mob.you, body || {}); return json(state); }
    if (p === '/api/me/chain' && method === 'GET') {
      const c = clone(chain);
      if (params.get('den') !== 'notice' && params.get('den') !== 'moments') c.notices = [];
      return json(c);
    }
    if (p === '/api/me/chain' && method === 'PATCH') { chain = { ...chain, hidden: Boolean(body?.hidden) }; return json(chain); }
    if (p === '/api/me/chain/pause') {
      const days = new Set(chain.pause.days);
      for (const d of body?.days || []) { if (method === 'POST') days.add(d); else days.delete(d); }
      chain = { ...chain, pause: { ...chain.pause, days: [...days].sort(), usedThisSeason: days.size } };
      return json(chain);
    }
    return json({ error: { code: 'NOT_FOUND', message: 'Not in the preview.' } }, 404);
  };
}
