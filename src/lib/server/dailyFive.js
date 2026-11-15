// The Daily Five's server half (15 Nov 2026, lane F-A): GET /api/daily?day=<n> (src/app/api/daily/route.js) answers with the
// day's five, built ONLY from the public sample's windows. It reads nothing itself: every question comes through the sample
// route's own service (createDemoSample in ./demoSample.js), set by set, exactly as GET /api/sample serves it to any visitor.
// So the Daily Five can never show a question the sample does not already show, in a shape it does not already have: the
// stem, four options, the right one's place, the reason, the chapter and any verified past-paper reference, plus the subject's
// public slug (the sample's answer carries it too). The day's pick is the pure model's (src/lib/dailyFive.mjs).
//
// No 'server-only' and no alias imports, so node:test loads it (data/tests/daily_five_1115.test.mjs).
import { SUBJECT_PAGES } from '../subjectPages.mjs';
import { DEMO_SETS, demoSubject } from '../demoSample.mjs';
import { DAILY_FIVE_SUBJECTS, dailyFiveFor, todayDaily } from '../dailyFive.mjs';

const DAY = /^[1-9]\d{0,5}$/;

/**
 * The visitor's query, checked before anything is read: { ok, day, date } for today's number (IST, by this server's clock), or
 * { ok: false, error, today } where `today` is { day, date } so a page on a wrong clock can ask again for the right day. Only
 * today is served: tomorrow's five stay unseen until 12:00 am IST, and a past day is not replayed here.
 */
export function parseDailyQuery(searchParams, now = Date.now()) {
  const raw = String(searchParams?.get?.('day') ?? '');
  const today = todayDaily(now);
  if (!DAY.test(raw)) return { ok: false, error: 'bad_day', today };
  if (Number(raw) !== today.day) return { ok: false, error: 'not_today', today };
  return { ok: true, day: today.day, date: today.date };
}

/** One question as it leaves: the sample's fields, nothing more. */
const out = ({ subject, q, options, correct, why, chapter, pastPaper }) => ({ subject, q, options: [...options], correct, why, chapter, ...(pastPaper ? { pastPaper: { ...pastPaper } } : {}) });

/**
 * The route's service. `sample` is a createDemoSample service (the sample route's own): a subject's window is read through its
 * sets 0 to DEMO_SETS - 1, so it is the same bounded window (30 a subject), kept by the same memo. `get({ day, date })` answers
 * { day, date, questions } or null when the windows cannot fill a five today.
 */
export function createDailyFive({ sample }) {
  async function windowOf(slug) {
    const subject = demoSubject(slug);
    const page = SUBJECT_PAGES.find((p) => p.slug === slug);
    if (!subject || !page) return { slug, questions: [] };
    const questions = [];
    const seen = new Set();
    for (let set = 0; set < DEMO_SETS; set += 1) {
      const answer = await sample.get({ slug, subjectId: page.id, name: subject.name, set });
      if (!answer) return { slug, questions: [] };
      // A thin window holds fewer sets and wraps (demoSetFrom): a set already read is not counted twice.
      if (seen.has(answer.set)) continue;
      seen.add(answer.set);
      questions.push(...answer.questions);
    }
    return { slug, questions };
  }

  return {
    async get({ day, date }) {
      const windows = await Promise.all(DAILY_FIVE_SUBJECTS.map(windowOf));
      const five = dailyFiveFor(day, windows);
      return five ? { day, date, questions: five.map(out) } : null;
    },
  };
}
