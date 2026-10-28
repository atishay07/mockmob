import { createEmptyCard, fsrs } from 'ts-fsrs';
import { SCHEDULER_VERSION } from './study_engine.js';
const scheduler = fsrs({ request_retention: 0.90 });
export function scheduleReview(stored, rating, at = Date.now()) {
  const card = stored ? { ...stored, due: new Date(stored.due), ...(stored.last_review ? { last_review: new Date(stored.last_review) } : {}) } : createEmptyCard(new Date(at));
  const { card: next, log } = scheduler.next(card, new Date(at), rating);
  return { schedule: JSON.parse(JSON.stringify(next)), log: JSON.parse(JSON.stringify(log)), schedulerVersion: SCHEDULER_VERSION };
}
