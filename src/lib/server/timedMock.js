import { paperTrace } from '../../../data/paper_trace.js';
import { TIMED_MOCK_MODES } from '../../../data/first_timed_mock.js';

// The facts behind the "first timed mock" line (data/first_timed_mock.js): how many sessions the student has saved, how
// many of them are Full or NTA mocks, and how many of those have a clock record the Lab can read. "Can read" is the
// Lab's own test (data/paper_trace.js paperTrace state 'ready'), the same one Across your mocks counts.
// Read-only, scoped to the signed-in student, and light: counts first, then the full record of only the few mocks
// whose device clock was recorded at all. Any failed read throws, so the page shows nothing rather than a wrong zero.
// Takes the Supabase client (the route passes the admin client), so it runs over a fake in the tests.
const CANDIDATES = 5; // the newest mocks with a device clock to read in full; one readable paper is enough

const fail = (error) => { throw Object.assign(new Error('TIMED_MOCK_UNAVAILABLE'), { cause: error }); };
const ok = ({ data, error, count }) => (error ? fail(error) : { data, count });

/** { sessions, mocks, timedMocks, subject } for a student. `db` is a Supabase client. */
export async function timedMockFacts(userId, db) {
  if (!userId) throw new Error('attempt_owner_required');
  const mine = () => db.from('attempts').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  const [sessions, mocks, newest, withClock] = (await Promise.all([
    mine(),
    mine().in('selection_meta->>mode', TIMED_MOCK_MODES),
    db.from('attempts').select('subject').eq('user_id', userId).order('completed_at', { ascending: false }).limit(1),
    db.from('attempts').select('id,tel:selection_meta->recovery->>telemetry').eq('user_id', userId)
      .in('selection_meta->>mode', TIMED_MOCK_MODES).order('completed_at', { ascending: false }).limit(60),
  ])).map(ok);
  const ids = (withClock.data || []).filter((row) => row?.tel === 'self_reported').map((row) => row.id).slice(0, CANDIDATES);
  // The line only asks whether there is AT LEAST ONE readable paper (data/first_timed_mock.js tests timedMocks > 0), and paperTrace reads
  // from the snapshot only that it is not empty. So the candidates are read newest first, one at a time, with the id of the first
  // question standing for the snapshot, and the walk stops at the first readable one (egress A14): timedMocks is 0 or 1.
  let timedMocks = 0;
  for (const id of ids) {
    const rows = ok(await db.from('attempts').select('id,selection_meta,first:questions_snapshot->0->>id').eq('user_id', userId).eq('id', id)).data || [];
    const readable = rows.some((row) => paperTrace({ selectionMeta: row.selection_meta || {}, questionsSnapshot: row.first ? [{ id: row.first }] : [] }).state === 'ready');
    if (readable) { timedMocks = 1; break; }
  }
  return { sessions: sessions.count ?? 0, mocks: mocks.count ?? 0, timedMocks, subject: newest.data?.[0]?.subject || null };
}
