// Concepts fixtures for /preview/arena (LEARN-REVIEW-1017 packet P-LR3): GET /api/me/review for every page except Review (which
// has its own, previewReview.js), so the Review badge and Practice's Concepts panel read the design student, and GET
// /api/study/catalog for that panel. The catalog is the real pilot lesson set with nothing read; the record is the design
// student through the real reviewBody() with its chapters named as the syllabus names them (data/study/preview_review.mjs).
// ?review=student (default) | empty | down. ?study=on shows Concepts in the More sheet and the panel on Practice.
import pilot from '@/../data/study/pilot.json';
import student from '@/../data/tests/fixtures/review/student.json';
import empty from '@/../data/tests/fixtures/review/empty.json';
import recordDown from '@/../data/tests/fixtures/review/record_down.json';
import { conceptsReview } from '@/../data/study/preview_review.mjs';

const fixtures = { student, empty, down: recordDown };

function catalog(fixture) {
  const read = new Set((fixture.get('read') || '').split(',').filter(Boolean));
  const units = pilot.units.map((u) => {
    const cards = pilot.cards.filter((c) => c.unitId === u.id).length;
    const isRead = read.has(u.id);
    return { ...u, blocks: undefined, read: isRead, inProgress: null, cardCount: cards, memory: { cards, started: 0, reviewed: 0, due: 0, unseen: cards, nextDue: null }, status: isRead ? 'lock_in' : 'new' };
  });
  const sorted = units.slice().sort((a, b) => a.order - b.order);
  const next = sorted.find((u) => !u.read && u.subject === 'english') || sorted.find((u) => !u.read);
  return {
    state: 'ready', subjects: pilot.syllabus, units, active: null, recallEnabled: true,
    nextUnit: next ? { id: next.id, title: next.title, subject: next.subject, chapter: next.chapter, reason: next.summary } : null,
    queue: { dueCount: 0, overdueCount: 0, newAllowance: 5, availableCount: 0, newCount: 0, pausedNew: false },
    progress: { lessonsRead: read.size, lessonsAvailable: units.length, recallReviews: 0, cardsStarted: 0 },
  };
}

/** Handles the Concepts endpoints; null for everything else and while Review's own fixtures are showing. */
export function previewConcepts(url, method, fixture, json) {
  if (fixture.get('view') === 'review') return null;
  if (url.pathname === '/api/me/review' && method === 'GET') {
    const kind = fixtures[fixture.get('review')] ? fixture.get('review') : 'student';
    const out = conceptsReview(fixtures, kind);
    return json(out.body, out.http);
  }
  if (url.pathname === '/api/study/catalog' && method === 'GET') return json(catalog(fixture));
  return null;
}
