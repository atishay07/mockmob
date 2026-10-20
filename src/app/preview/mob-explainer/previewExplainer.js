// /preview/mob-explainer: the fetch stub. Every /api/ call on this page answers from the server's own v3 fixtures
// (data/tests/fixtures/mob_v3, through the den preview's denFixture); nothing reaches a real route, nothing is written.
//   GET /api/mob: no Mob (D0) until the setup creates one; then the Mob of one (D5) with the name, Fold and subject picked.
//   POST /api/mob: the create call, recorded in window.__mxWrites; ?fail=create answers 503 (the setup keeps its answers);
//   ?slow=<ms> holds it that long (the busy key).
//   GET /api/mob/join/<code>: the invite lookup (Steady Kites, 3 of 5 seats); POST /api/mob/join opens the den.
import { MOB_NAMES } from '@/lib/mob/names.mjs';
import { denFixture } from '../mob-den/previewDen';
import lookupFx from '@/../data/tests/fixtures/mob_v3/lookup.json';
import inviteFx from '@/../data/tests/fixtures/mob_v3/invite.json';

const SUBJECT_NAMES = { accountancy: 'Accountancy', business_studies: 'Business Studies', economics: 'Economics', english: 'English' };

export function installExplainerPreview() {
  if (typeof window === 'undefined' || window.__mxPreviewFetch) return;
  const real = window.fetch.bind(window);
  window.__mxPreviewFetch = true;
  window.__mxWrites = [];
  let state = null;
  const json = (body, status = 200, delay = 120) => new Promise((resolve) => setTimeout(() => resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })), delay));
  window.fetch = (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
    if (!window.location.pathname.startsWith('/preview/mob-explainer') || !url.pathname.startsWith('/api/')) return real(input, init);
    const params = new URLSearchParams(window.location.search);
    const method = (init.method || 'GET').toUpperCase();
    const body = (() => { try { return init.body ? JSON.parse(init.body) : null; } catch { return null; } })();
    const p = url.pathname;
    if (method !== 'GET') window.__mxWrites.push({ path: p, method, body });
    if (!state) state = params.get('view') === 'den' ? denFixture(new URLSearchParams('den=quiet')) : { mob: null, v3Available: true };
    if (p === '/api/mob' && method === 'GET') return json(state);
    if (p === '/api/mob' && method === 'POST') {
      const slow = Number(params.get('slow')) || 600;
      if (params.get('fail') === 'create') return json({ error: { code: 'UNAVAILABLE', message: 'Your Mob did not load. Try again shortly.' } }, 503, slow);
      const d = denFixture(new URLSearchParams('den=one'));
      const v3 = d.mob.v3;
      if (Number.isInteger(body?.nameKey)) v3.name = { key: body.nameKey, text: MOB_NAMES[body.nameKey] };
      if (body?.fold) v3.members[0].fold = body.fold;
      if (body?.subject) { d.mob.subject = body.subject; d.mob.subjectName = SUBJECT_NAMES[body.subject] || d.mob.subjectName; }
      if (body?.name) { v3.members[0].name = body.name; d.mob.you = { ...d.mob.you, name: body.name, colour: body.colour ?? 0 }; d.mob.members[0] = { ...d.mob.members[0], name: body.name, colour: body.colour ?? 0 }; }
      d.mob.invite = { code: inviteFx.code, url: inviteFx.url, expiresAt: inviteFx.expiresAt, usesLeft: 4 };
      state = d;
      return json(state, 200, slow);
    }
    if (p.startsWith('/api/mob/join/')) return json({ ...lookupFx, code: p.split('/').pop(), size: 3, seatsLeft: 2, name: params.get('mobname') ?? 'Steady Kites', inviter: 'Riya' });
    if (p === '/api/mob/join' && method === 'POST') { state = denFixture(new URLSearchParams('den=quiet')); return json(state); }
    if (p === '/api/mob/invite') return json(inviteFx);
    if (p === '/api/mob/shelf') return json({ seat: params.get('seat') ? { fold: params.get('seat'), finish: 'plain' } : null, folds: [] });
    if (p === '/api/me/chain') return json({ hidden: true });
    if (p === '/api/mob/seen' || p === '/api/mob/sticker') return json({ ok: true });
    return json({ error: { code: 'NOT_FOUND', message: 'Not in the preview.' } }, 404);
  };
}
