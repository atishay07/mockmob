"use client";
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthContext } from '@/components/AuthProvider';
import { RoleProvider } from '@/lib/roleContext';
import AppLayoutClient from '@/app/(app)/AppLayoutClient';
import { fixtureKeycards } from '@/components/keycards/fixtures';
import StudyWorkspace from '@/components/study/StudyWorkspace';
import { createStudyRun, studyTransition, publicStudyItem, DEFAULT_PREFERENCES, preferences, recallQueue, taughtRecallCards, cardItem, istDay, NEW_CARDS_PER_DAY } from '@/../data/study_engine';
import { scheduleReview } from '@/../data/study_scheduler.mjs';
import { conceptsReview, conceptsAttempt } from '@/../data/study/preview_review.mjs';
import studentRecord from '@/../data/tests/fixtures/review/student.json';
import emptyRecord from '@/../data/tests/fixtures/review/empty.json';
import downRecord from '@/../data/tests/fixtures/review/record_down.json';
import onePaperRecord from '@/../data/tests/fixtures/review/one_paper.json';

const RECORDS = { student: studentRecord, empty: emptyRecord, down: downRecord, one_paper: onePaperRecord };
// ?review=student (default) | one_paper (sparse) | empty | down: the record behind Concepts' lesson to read next, Where you lose marks and the Review badge.
// ?unit=<lesson id>&from=q:m3:42 (or chapter:accountancy:Admission of Partner, or today) opens a lesson as it opens from a moment.
// ?read=a,b marks lessons as read. The same record answers the layout's badge read through a small fetch stub on this page only.
const reviewFor = (kind) => conceptsReview(RECORDS, RECORDS[kind] ? kind : 'student');
if (typeof window !== 'undefined' && !window.__studyPreviewFetch) {
  const real = window.fetch.bind(window);
  window.__studyPreviewFetch = true;
  window.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
    if (window.location.pathname.startsWith('/preview/study') && url.pathname === '/api/me/review') {
      const out = reviewFor(new URLSearchParams(window.location.search).get('review'));
      return Promise.resolve(new Response(JSON.stringify(out.body), { status: out.http, headers: { 'Content-Type': 'application/json' } }));
    }
    // Key cards (src/components/keycards/fixtures.js): the Learn hub's Key cards row reads GET /api/keycards. ?kc=off hides it.
    if (window.location.pathname.startsWith('/preview/study')) {
      const kc = fixtureKeycards(url, String(init?.method || 'GET').toUpperCase(), init?.body ? JSON.parse(init.body) : null, { isPro: false, variant: new URLSearchParams(window.location.search).get('kc') || 'ready', memory: (window.__previewKeycards ||= {}) });
      if (kc) return Promise.resolve(new Response(JSON.stringify(kc.body), { status: kc.status, headers: { 'Content-Type': 'application/json' } }));
    }
    return real(input, init);
  };
}

// Development-only, in-memory mirror of src/lib/server/study.js. No student storage, payment, AI or
// assessment calls. It uses the real engine and scheduler so the journey behaves like production.
export default function StudyPreview({ content }) {
  const params = useSearchParams();
  const reviewKind = params.get('review'), unitParam = params.get('unit'), readParam = params.get('read'), catalogDown = params.get('catalog') === 'down', delay = Math.min(Number(params.get('delay')) || 120, 20000);
  const auth = useMemo(() => ({ user: { id: 'study-preview', name: 'Preview Student', subjects: ['english', 'accountancy', 'business_studies', 'economics'], isPremium: false, creditBalance: 40 }, status: 'authenticated', isAuthenticated: true, needsOnboarding: false, signOut: async () => {}, refreshSession: async () => {} }), []);
  const fixture = useMemo(() => {
    const store = { runs: new Map(), events: new Map(), states: new Map(), read: new Set((readParam || '').split(',').filter(Boolean)), prefs: { ...DEFAULT_PREFERENCES, premium: false, state: 'ready' }, reviews: 0 };
    const states = () => [...store.states.values()];
    const today = () => states().filter(s => s.introduced_day === istDay(Date.now())).length;
    const memory = unit => {
      const cards = content.cards.filter(c => c.unitId === unit.id), now = Date.now();
      const started = cards.map(c => store.states.get(c.id)).filter(Boolean);
      const future = started.map(s => +new Date(s.schedule.due)).filter(t => t > now).sort((a, b) => a - b);
      return { cards: cards.length, started: started.length, reviewed: started.filter(s => s.schedule.reps > 0).length, due: started.filter(s => +new Date(s.schedule.due) <= now).length, unseen: cards.length - started.length, nextDue: future[0] ? new Date(future[0]).toISOString() : null };
    };
    const activeLearn = id => [...store.runs.values()].find(r => r.mode === 'learn' && r.projection.state === 'active' && r.units[0].id === id);
    const unitView = u => { const m = memory(u), l = activeLearn(u.id); return { ...u, blocks: undefined, read: store.read.has(u.id), inProgress: l ? { runId: l.projection.id, step: l.projection.cursor + 1, total: l.items.length } : null, cardCount: m.cards, memory: m, status: l ? 'in_progress' : !store.read.has(u.id) ? 'new' : m.due ? 'due' : m.unseen ? 'lock_in' : 'learned' }; };
    const queueFor = units => recallQueue(taughtRecallCards(content.cards.filter(c => units.some(u => u.id === c.unitId)), states(), store.read), states(), Date.now(), today(), 10, content.cards);
    const view = row => { const p = row.projection; return { ...p, title: row.title, total: row.items.length, item: publicStudyItem(row.items[p.cursor], p.revealed), steps:row.mode==='learn' ? row.items.map(i=>({id:i.id,kind:i.kind,title:i.title})) : undefined, units: row.units.map(u => ({ id: u.id, title: u.title, subject: u.subject, chapter: u.chapter })), focus: row.focus }; };
    const active = () => { const r = [...store.runs.values()].find(r => r.projection.state === 'active'); return r ? { id: r.projection.id, mode: r.mode, title: r.title, step: r.projection.cursor + 1, total: r.items.length, unitId: r.units[0]?.id } : null; };
    const transport = async (method, path, input) => {
      if (!window.location.pathname.startsWith('/preview/study')) throw new Error('PREVIEW_ONLY');
      await new Promise(r => setTimeout(r, delay));
      if (catalogDown && path === '/api/study/catalog') { const e = new Error('unavailable'); e.status = 503; throw e; }
      if (method === 'GET' && path === '/api/study/catalog') {
        const q = queueFor(content.units), sorted = content.units.slice().sort((a, b) => a.order - b.order), readIn = s => sorted.filter(u => u.subject === s && store.read.has(u.id)).length, order = ['english', 'accountancy', 'business_studies', 'economics'].filter(s => sorted.some(u => u.subject === s && !store.read.has(u.id))).sort((a, b) => readIn(a) - readIn(b)), next = order.length ? sorted.find(u => u.subject === order[0] && !store.read.has(u.id)) : null;
        return { state: 'ready', subjects: content.syllabus, units: content.units.map(unitView), active: active(), nextUnit: next ? { id: next.id, title: next.title, subject: next.subject, chapter: next.chapter, reason: next.summary } : null,
          queue: { dueCount: q.dueCount, overdueCount: q.overdueCount, newAllowance: q.newAllowance, availableCount: q.items.length, newCount: q.items.length - Math.min(q.dueCount, q.items.length), pausedNew: q.pausedNew },
          progress: { lessonsRead: store.read.size, lessonsAvailable: content.units.length, recallReviews: store.reviews, cardsStarted: store.states.size }, recallEnabled: true, preferences: store.prefs, newCardsPerDay: NEW_CARDS_PER_DAY };
      }
      if (method === 'GET' && path === '/api/me/review') { const out = reviewFor(reviewKind); if (out.http !== 200) { const e = new Error('unavailable'); e.status = out.http; throw e; } return out.body; }
      if (method === 'GET' && path.startsWith('/api/attempts/')) { const attempt = conceptsAttempt(studentRecord, decodeURIComponent(path.split('/').at(-1))); if (!attempt) { const e = new Error('not found'); e.status = 404; throw e; } return attempt; }
      if (method === 'GET' && path.startsWith('/api/study/units/')) {
        const unit = content.units.find(u => u.id === decodeURIComponent(path.split('/').at(-1)));
        if (!unit) { const e = new Error('UNIT_NOT_FOUND'); e.status = 404; throw e; }
        const q = queueFor([unit]);
        return { ...unit, blocks: unit.blocks.map(b => publicStudyItem(b)), progress: unitView(unit), siblings: content.units.filter(u => u.chapter === unit.chapter && u.id !== unit.id).map(u => ({ id: u.id, title: u.title, status: unitView(u).status })), recall: { available: q.items.length, due: q.dueCount, newAllowance: q.newAllowance, unseen: q.unseenCount, newCardsPerDay: NEW_CARDS_PER_DAY }, active: active() };
      }
      if (method === 'PUT' && path === '/api/study/preferences') { store.prefs = { ...preferences(input, store.prefs, false), premium: false, state: 'ready' }; return store.prefs; }
      if (method === 'POST' && path === '/api/study/runs') {
        const units = input.unitId ? content.units.filter(u => u.id === input.unitId) : content.units;
        for (const r of store.runs.values()) if (r.mode === input.mode && r.projection.state === 'active') {
          if ((r.focus?.unitId || null) === (input.unitId || null)) return view(r);
          r.projection = { ...r.projection, state: 'set_aside', revision: r.projection.revision + 1 };
        }
        let items;
        if (input.mode === 'learn') items = units[0].blocks.map(b => ({ ...b, total: units[0].blocks.length }));
        else {
          const q = queueFor(units);
          if (!q.items.length) { const e = new Error(q.newAllowance === 0 && q.unseenCount ? 'DAILY_NEW_LIMIT_REACHED' : 'NOTHING_DUE'); e.status = 422; throw e; }
          for (const x of q.items) if (!x.stored) store.states.set(x.card.id, { card_id: x.card.id, content_version: x.card.version, schedule: { due: new Date().toISOString(), reps: 0 }, introduced_day: istDay(Date.now()), raw: null });
          items = q.items.map(x => cardItem(x.card, x.stored?.schedule?.reps || 0));
        }
        const id = crypto.randomUUID(), projection = createStudyRun({ id, mode: input.mode, unitIds: units.map(u => u.id), cardIds: input.mode === 'recall' ? items.map(c => c.id) : [] });
        const used = input.mode === 'learn' ? units : units.filter(u => items.some(i => i.unitId === u.id));
        const row = { mode: input.mode, projection, items, units: used, focus: input.unitId ? { unitId: input.unitId, subject: units[0].subject, chapter: units[0].chapter } : null, title: input.mode === 'learn' || input.unitId ? units[0].title : 'Review' };
        store.runs.set(id, row); return view(row);
      }
      const id = path.split('/')[4], row = store.runs.get(id);
      if (!row) { const e = new Error('RUN_NOT_FOUND'); e.status = 404; throw e; }
      if (method === 'GET') return view(row);
      const previous = store.events.get(input.requestKey); if (previous) return previous;
      const item = row.items[row.projection.cursor];
      const result = studyTransition(row.projection, item, input); row.projection = result.projection;
      if (result.rating) {
        const state = store.states.get(item.id); const next = scheduleReview(state.raw, result.rating);
        state.raw = next.schedule; state.schedule = { due: next.schedule.due, reps: next.schedule.reps }; store.reviews++;
        row.projection.lastReview = { cardId: item.id, rating: result.rating, due: next.schedule.due, unitId: item.unitId, lessonRecommended: false };
        row.projection.reviewed = [...(row.projection.reviewed || []), { cardId: item.id, title: item.word || item.title, rating: result.rating, due: next.schedule.due, unitId: item.unitId }];
      }
      if (row.mode === 'learn' && row.projection.state === 'complete') store.read.add(row.units[0].id);
      const response = view(row); store.events.set(input.requestKey, response); return response;
    };
    return { transport };
  }, [content, reviewKind, readParam, catalogDown, delay]);
  return <AuthContext.Provider value={auth}><RoleProvider><div className="arena-fixture-note" role="note"><b>Development study preview</b><span>Illustrative only. Content candidates · no real saves, scores, credits or model calls.</span></div><AppLayoutClient previewRoute="/learn" previewLinks={{ learn: '/preview/study' }}><StudyWorkspace preview={fixture} unitId={unitParam} /></AppLayoutClient></RoleProvider></AuthContext.Provider>;
}
