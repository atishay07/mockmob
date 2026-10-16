// /preview/arena?view=mob and ?view=join: the Mob against the app contract fixtures (data/tests/fixtures/mob), the same
// bodies the routes answer with. Development only: writes change this tab's copy and nothing else.
//   ?mob=ready (default, you sat, trap showing) | notsat (a nudge waiting, cost line) | alone | none | full | closed | error | loading
//   ?view=join&invite=valid (default) | invalid, &auth=out for the signed-out join page
import getV1 from '@/../data/tests/fixtures/mob/get_v1.json';
import getNotSat from '@/../data/tests/fixtures/mob/get_not_sat_v1.json';
import getAlone from '@/../data/tests/fixtures/mob/get_alone_v1.json';
import lookupV1 from '@/../data/tests/fixtures/mob/lookup_v1.json';
import errorsV1 from '@/../data/tests/fixtures/mob/errors_v1.json';

const clone = (v) => JSON.parse(JSON.stringify(v));

function initial(kind) {
  if (kind === 'none') return { mob: null };
  if (kind === 'alone') return clone(getAlone);
  if (kind === 'notsat') return clone(getNotSat);
  if (kind === 'closed') { const m = clone(getNotSat); m.mob.week.closed = true; m.mob.nudge.received = null; return m; }
  if (kind === 'full') {
    const m = clone(getV1);
    m.mob.members.push({ memberId: 'Q9W3E7R1T5Y2', name: 'Vihaan', colour: 6, you: false, sat: false });
    m.mob.week.size = 5; m.mob.seatsLeft = 0; m.mob.invite = null;
    return m;
  }
  return clone(getV1);
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
    return send(state);
  }
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
  if (path === '/api/mob/report') return send({ reported: true, left: false });
  if (path === '/api/mob/join') { window.__previewMob = clone(getV1); return send(window.__previewMob); }
  if (path === '/api/mob/reports') return send({ result: body.remove ? 'removed' : 'resolved' });
  return fail('UNAVAILABLE');
}
