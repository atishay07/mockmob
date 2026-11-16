// /preview/arena: class leagues against fixtures, in the shapes /api/class answers (src/lib/classLeague/service.js). Development
// only; nothing is written. Each state is drawn at a fixed instant, so it looks the same whatever day it is opened.
//   &class=  off (default, as production until the owner turns it on) | none (no class, three subjects) | nosubjects | waiting (in a class, before its first Sunday) | figure (Monday
//            23 Nov: Accountancy above the floor, Economics below it) | floor (both below) | notsat (above the floor, you did not
//            sit) | creator (figure, you started it) | big (a long name, 5-digit marks never; 80 members) | off | error | loading
//   &classlookup=  ok (default) | member | other | missing | error | off — the join page (?view=classjoin&auth=out|in)
//   &classjoin=  ok (default) | other | full — what Join answers
// Join and Start a class switch this tab's fixture to the class (waiting); Leave and Close switch it back to none.
const IST = (s) => Date.parse(`${s}+05:30`);
const MONDAY = IST('2026-11-23T09:00:00');
const WEDNESDAY = IST('2026-11-18T12:00:00');
const SUBJECTS = [{ id: 'accountancy', name: 'Accountancy' }, { id: 'economics', name: 'Economics' }, { id: 'business_studies', name: 'Business Studies' }];
const NEXT_FIRST = { week: '2026-11-22', at: IST('2026-11-22T23:05:00') };
const NEXT_SECOND = { week: '2026-11-29', at: IST('2026-11-29T23:05:00') };
const CODE = 'K7P2M9';
const NAME = 'XII-C Commerce, DPS Rohini';
const LONG = 'Class XII Commerce Section C (Morning Batch), Delhi Public School';

const klass = (over = {}) => ({ name: NAME, code: CODE, url: `https://www.mockmob.in/class/${CODE}`, members: 38, creator: false, subjects: SUBJECTS.slice(0, 2), ...over });

function status(kind) {
  if (kind === 'none' || !kind) return { class: null, subjects: SUBJECTS, serverNow: WEDNESDAY, next: NEXT_FIRST };
  if (kind === 'nosubjects') return { class: null, subjects: [], serverNow: WEDNESDAY, next: NEXT_FIRST };
  if (kind === 'waiting') return { class: klass({ members: 1, creator: true }), subjects: SUBJECTS, week: null, serverNow: WEDNESDAY, next: NEXT_FIRST };
  const acc = { subject: 'accountancy', name: 'Accountancy', enough: true, sat: 31, average: 142, you: { scored: 168, max: 250 } };
  const eco = { subject: 'economics', name: 'Economics', enough: false, you: { scored: 121, max: 250 } };
  const figures = {
    figure: [acc, eco],
    creator: [acc, eco],
    floor: [{ ...acc, enough: false, sat: undefined, average: undefined }, { ...eco, you: null }],
    notsat: [{ ...acc, you: null }, eco],
    big: [{ ...acc, sat: 74, average: 96, you: { scored: 231, max: 250 } }, { ...eco, enough: true, sat: 61, average: 12, you: { scored: -4, max: 250 } }],
  }[kind] || [acc, eco];
  const clean = figures.map((f) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)));
  const c = kind === 'big' ? klass({ name: LONG, members: 80 }) : klass({ creator: kind === 'creator' });
  return { class: c, subjects: SUBJECTS, week: { week: '2026-11-22', figures: clean }, serverNow: MONDAY, next: NEXT_SECOND };
}

function lookup(kind) {
  const base = { code: CODE, name: NAME, subjects: ['Accountancy', 'Economics'] };
  if (kind === 'member') return { ...base, you: 'member' };
  if (kind === 'other') return { ...base, you: 'other' };
  return base;
}

/** The class league's preview answers, or null for a path that is not its own. */
export function previewClass(url, method, init, fixture, json) {
  const path = url.pathname;
  if (path !== '/api/class' && !path.startsWith('/api/class/')) return null;
  const tab = (window.__previewClass ||= { kind: null });
  const kind = tab.kind || fixture.get('class') || 'off';
  // The join page (?view=classjoin) shows the feature on: it only exists while the switch is on.
  if (kind === 'off' && fixture.get('view') !== 'classjoin') return json({ error: { code: 'CLASS_OFF', message: 'This page is not available.' } }, 404);
  const err = (code, message, status, detail) => json({ error: { code, message, ...(detail ? { detail } : {}) } }, status);
  if (path === '/api/class' && method === 'GET') {
    if (kind === 'loading') return new Promise(() => {});
    if (kind === 'error') return err('UNAVAILABLE', 'Your class did not load. Try again shortly.', 503);
    return json(status(kind));
  }
  if (path === '/api/class/lookup') {
    const l = fixture.get('classlookup') || 'ok';
    if (l === 'missing') return err('CLASS_NOT_FOUND', 'No class has that code. Check it with whoever shared it.', 404);
    if (l === 'off') return err('CLASS_OFF', 'This page is not available.', 404);
    if (l === 'error') return err('UNAVAILABLE', 'The class did not load. Try again shortly.', 503);
    if (url.searchParams.get('code') !== CODE) return err('CLASS_NOT_FOUND', 'No class has that code. Check it with whoever shared it.', 404);
    const signedIn = fixture.get('auth') !== 'out';
    return json(signedIn ? lookup(l) : lookup('ok'));
  }
  if (path === '/api/class' && method === 'POST') {
    const body = JSON.parse(init.body || '{}');
    tab.kind = 'waiting';
    const s = status('waiting');
    return json({ ...s, class: { ...s.class, name: body.name || NAME } }, 201);
  }
  if (path === '/api/class/join') {
    const j = fixture.get('classjoin') || 'ok';
    const body = JSON.parse(init.body || '{}');
    if (j === 'other') return err('ALREADY_IN_CLASS', 'You are already in a class. Leave it first to join or start another.', 409, { className: 'Batch B' });
    if (j === 'full') return err('CLASS_FULL', 'This class is full: it has 80 members, the most a class can have.', 409);
    if (body.code !== CODE) return err('CLASS_NOT_FOUND', 'No class has that code. Check it with whoever shared it.', 404);
    tab.kind = 'figure';
    return json(status('figure'));
  }
  if (path === '/api/class/leave') { tab.kind = 'none'; return json({ left: true }); }
  if (path === '/api/class/close') { tab.kind = 'none'; return json({ closed: true }); }
  if (path === '/api/class/report') return json({ reported: true });
  if (path === '/api/class/week') {
    if (kind === 'none' || kind === 'nosubjects') return err('NOT_IN_CLASS', 'You are not in a class.', 404);
    const s = status(kind === 'waiting' ? 'figure' : kind);
    const f = s.week.figures.find((x) => x.subject === url.searchParams.get('subject')) || s.week.figures[0];
    return json({ week: url.searchParams.get('week'), className: s.class.name, figure: f });
  }
  return err('UNAVAILABLE', 'Not in this preview.', 404);
}
