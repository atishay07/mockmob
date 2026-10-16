// /preview/arena?view=mob and ?view=join: the Mob against the app contract fixtures (data/tests/fixtures/mob), the same
// bodies the routes answer with. Development only: writes change this tab's copy and nothing else.
//   Free and Pro (SOCIAL-SPEC section 15): ?mob=ready (free, you sat, your first side-by-side is free) | sample (free, the sample week
//   open: trap and side-by-side) | locked (free, the sample went to another week: teaser and the Pro line) | pro (two Mobs,
//   extra papers, past weeks) | blocked (free, you already sat this week in another Mob)
//   ?mob=ready (default, you sat) | notsat (a nudge waiting, cost line) | alone | none | full | closed | error | loading
//   | complete (4 of 4 sat: the ring settles, Today's Mobi moment) | two (a Mob of two who both sat and show their score:
//   the Together card) | private (a Mob of two, both sat, your score private: the hint to compare)
//   ?view=join&invite=valid (default) | invalid, &auth=out for the signed-out join page
import getV1 from '@/../data/tests/fixtures/mob/get_v1.json';
import getNotSat from '@/../data/tests/fixtures/mob/get_not_sat_v1.json';
import getAlone from '@/../data/tests/fixtures/mob/get_alone_v1.json';
import lookupV1 from '@/../data/tests/fixtures/mob/lookup_v1.json';
import errorsV1 from '@/../data/tests/fixtures/mob/errors_v1.json';
import getProV2 from '@/../data/tests/fixtures/mob/get_pro_v2.json';
import compareV2 from '@/../data/tests/fixtures/mob/compare_v2.json';
import historyV2 from '@/../data/tests/fixtures/mob/history_v2.json';

const clone = (v) => JSON.parse(JSON.stringify(v));

function initial(kind) {
  if (kind === 'none') return { mob: null };
  if (kind === 'pro') return clone(getProV2);
  if (kind === 'sample' || kind === 'locked') {
    const m = clone(getV1);
    if (kind === 'sample') { m.mob.compare.access = 'sample'; m.mob.compare.needsShare = false; } else { m.mob.compare.access = 'locked'; m.mob.trap = null; }
    return m;
  }
  if (kind === 'blocked') { const m = clone(getNotSat); m.mob.week.paper.cost = null; m.mob.week.paper.blocked = 'free_used'; m.mob.nudge.received = null; return m; }
  if (kind === 'alone') return clone(getAlone);
  if (kind === 'notsat') return clone(getNotSat);
  if (kind === 'closed') { const m = clone(getNotSat); m.mob.week.closed = true; m.mob.nudge.received = null; return m; }
  if (kind === 'complete') {
    const m = clone(getV1);
    m.mob.members = m.mob.members.map((x) => ({ ...x, sat: true }));
    m.mob.week.sat = 4; m.mob.nudge = { canSend: false, reason: 'everyone_sat', received: null };
    return m;
  }
  if (kind === 'two' || kind === 'private') {
    const m = clone(getV1);
    const shows = kind === 'two';
    m.mob.members = m.mob.members.slice(0, 2).map((x) => ({ ...x, sat: true, ...(shows ? { score: x.you ? { value: 7, of: 10 } : { value: 6, of: 10 } } : (x.you ? { score: { value: 7, of: 10 } } : {})) }));
    m.mob.you.showScore = shows;
    m.mob.week.size = 2; m.mob.week.sat = 2; m.mob.seatsLeft = 3; m.mob.trap = null;
    m.mob.nudge = { canSend: false, reason: 'everyone_sat', received: null };
    if (shows) m.mob.together = { with: 1, sameRight: 5, of: 10, sharedMiss: 6 };
    return m;
  }
  if (kind === 'full') {
    const m = clone(getV1);
    m.mob.members.push({ memberId: 'Q9W3E7R1T5Y2', name: 'Vihaan', colour: 6, you: false, sat: false });
    m.mob.week.size = 5; m.mob.seatsLeft = 0; m.mob.invite = null;
    return m;
  }
  // ready: free, you sat. The trap is part of the side-by-side, so it waits for Pro or the sample week.
  const m = clone(getV1);
  m.mob.trap = null;
  return m;
}

const err = (code) => ({ body: errorsV1[code].body, status: errorsV1[code].status });

export function previewMob(url, method, init, fixture, json) {
  const kind = fixture.get('mob') || 'ready';
  if (!window.__previewMob || window.__previewMobKind !== kind) { window.__previewMob = initial(kind); window.__previewMobKind = kind; }
  const state = window.__previewMob;
  const body = (() => { try { return JSON.parse(init.body || '{}'); } catch { return {}; } })();
  const send = (data, status = 200) => json(data, status);
  const fail = (code) => { const e = err(code); return json(e.body, e.status); };
  const path = url.pathname;

  if (path === '/api/mob' && method === 'GET') {
    if (kind === 'loading') return new Promise(() => {});
    if (kind === 'error') return fail('UNAVAILABLE');
    const want = url.searchParams.get('mob');
    if (kind === 'pro' && state.mob && want && want !== state.mob.id && state.mob.mobs.some((x) => x.id === want)) {
      const next = clone(state);
      next.mob.id = want;
      next.mob.mobs = next.mob.mobs.map((x) => ({ ...x, active: x.id === want }));
      const now = next.mob.mobs.find((x) => x.id === want);
      next.mob.subject = now.subject; next.mob.subjectName = now.subjectName;
      window.__previewMob = next;
      return send(next);
    }
    return send(state);
  }
  if (path === '/api/mob/compare' && method === 'GET') {
    if (kind === 'locked') return fail('PRO_REQUIRED');
    const c = clone(compareV2);
    if (kind === 'sample' || kind === 'ready') c.compare.access = 'sample';
    if (url.searchParams.get('extra')) { c.compare.kind = 'extra'; c.compare.chapter = null; c.compare.questions = c.compare.questions.slice(0, 5); }
    else if (url.searchParams.get('week')) c.compare.week = url.searchParams.get('week');
    c.compare.yourResultId = 'practice_u2';
    return send(c);
  }
  if (path === '/api/mob/history' && method === 'GET') return kind === 'pro' ? send(historyV2) : fail('PRO_REQUIRED');
  if (path.startsWith('/api/mob/join/') && method === 'GET') {
    return fixture.get('invite') === 'invalid' ? fail('INVITE_INVALID') : send(lookupV1);
  }
  if (path === '/api/mob/reports' && method === 'GET') {
    return send({ reports: [{ id: 41, reason: 'name', name: 'Bad Name', createdAt: '2026-10-15T14:05:00.000Z', canRemove: true }, { id: 40, reason: 'nudge', name: 'Kabir', createdAt: '2026-10-14T09:30:00.000Z', canRemove: false }] });
  }
  if (method === 'GET') return fail('UNAVAILABLE');

  const m = state.mob;
  if (path === '/api/mob' && method === 'POST') {
    const made = clone(getAlone);
    made.mob.you.name = body.name; made.mob.you.colour = body.colour;
    made.mob.members[0].name = body.name; made.mob.members[0].colour = body.colour;
    made.mob.invite = null;
    window.__previewMob = made;
    return send(made, 201);
  }
  if (!m) return fail('NOT_IN_MOB');
  if (path === '/api/mob/invite') {
    m.invite = { code: '7KQ2M9XR', url: 'https://www.mockmob.in/join/7KQ2M9XR', expiresAt: '2026-10-23T16:10:00.000Z', usesLeft: m.seatsLeft };
    return send(m.invite);
  }
  if (path === '/api/mob/me') {
    for (const key of ['name', 'colour', 'showScore', 'nudgesMuted']) if (body[key] !== undefined) m.you[key] = body[key];
    const me = m.members.find((x) => x.you);
    if (body.showScore === true && m.compare) m.compare.youShare = true;
    if (body.name) me.name = body.name;
    if (body.colour !== undefined) me.colour = body.colour;
    return send(state);
  }
  if (path === '/api/mob/nudge') {
    if (!m.week.youSat) return fail('NOT_SAT_YET');
    if (!m.nudge.canSend) return fail('ALREADY_NUDGED');
    m.nudge = { canSend: false, reason: 'sent', received: null };
    return send({ sent: true, to: m.members.filter((x) => !x.sat).length });
  }
  if (path === '/api/mob/nudge/seen') { m.nudge.received = null; return send({ ok: true }); }
  if (path === '/api/mob/leave') { window.__previewMob = { mob: null }; return send({ left: true }); }
  if (path === '/api/mob/remove') {
    if (m.you.role !== 'owner') return fail('NOT_OWNER');
    m.members = m.members.filter((x) => x.memberId !== body.memberId);
    m.week.size = m.members.length; m.week.sat = m.members.filter((x) => x.sat).length; m.seatsLeft = 5 - m.members.length;
    return send(state);
  }
  if (path === '/api/mob/extra') {
    if (!m.plan.canMakeExtra) return fail('PRO_REQUIRED');
    const id = 'e' + (m.extras.length + 1) + 'c1a7e5d2-3b94-4e08-9f61-0a2d8b7c4e35'.slice(2);
    m.extras = [...m.extras, { id, chapter: body.chapter || null, count: body.count || 10, createdByYou: true, createdAt: '2026-10-14T08:00:00.000Z', closesAt: '2026-10-21T08:00:00.000Z', closed: false, sat: 0, youSat: false, yourResultId: null, compare: null }];
    return send({ ...state, extraId: id }, 201);
  }
  if (path === '/api/mob/report') return send({ reported: true, left: false });
  if (path === '/api/mob/join') { window.__previewMob = clone(getV1); return send(window.__previewMob); }
  if (path === '/api/mob/reports') return send({ result: body.remove ? 'removed' : 'resolved' });
  return fail('UNAVAILABLE');
}
