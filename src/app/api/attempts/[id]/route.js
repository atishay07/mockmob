import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';
import { readAnswerReviews } from '@/services/recovery/answerReviews';
import { buildRecap } from '@/lib/server/recap';
import { buildMissedBefore, sourceLabel } from '@/components/recovery/repairRun.js';
import { supabaseAdmin } from '@/lib/supabase';
import { getSavedRepairs } from '@/lib/server/repairSaved';
import { resultHistory } from '@/../data/mock_swot';
import { readCohortWithTime } from '@/lib/server/cohortStats';
import { loadRuleSources } from '@/lib/server/ruleBook';
import { atlasForAttempt } from '@/lib/server/trapAtlas';
import { cardsFor } from '@/lib/server/revise';
import { attemptHold, heldAttemptView } from '@/lib/server/answerHold';

export async function GET(request, { params }) {
  try {
    const session = await auth(request);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const attempt = await Database.getAttemptById(id);
    if (!attempt || attempt.userId !== session.user.id) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }
    // A Mob paper still open for the Mob: the marks and when the answers open, nothing else (no reviews, history, Lab or SWOT,
    // each of which would name the paper's right and wrong answers). The same read after the close is the full result.
    const hold = attemptHold(attempt);
    if (hold) return NextResponse.json(heldAttemptView(attempt, hold), { headers: { 'Cache-Control': 'no-store' } });
    const reviews = await readAnswerReviews(attempt);
    // The student's attempts are read once for this request: the history below and the paper's "Mock 3" name share it. The
    // history is read through the lean function (slim 'history': the keys, options and meta the builders read, not the
    // explanations and evidence of every question of every paper); the paper on screen was read whole above. The lean rows
    // feed the pure builders only and never go into the response body.
    const memo = new Map();
    // F17: which of this paper's wrong answers already hold a saved repair (they open at once and never offer a paid
    // repair again), and which paper this is. Each is additive and left out on its own failure.
    const [savedRepairs, paper] = await Promise.all([
      getSavedRepairs(supabaseAdmin(), session.user.id, attempt).catch((e) => { console.warn('[api/attempts/:id] savedRepairs skipped:', e?.message); return undefined; }),
      Database.getAttempts(session.user.id, { memo, slim: 'history' }).then((all) => ({ source: sourceLabel(all, attempt), completedAt: Number(attempt.completedAt) || null })).catch((e) => { console.warn('[api/attempts/:id] paper skipped:', e?.message); return undefined; }),
    ]);
    // Everything read from the history is additive: if the history cannot be read, the result still loads
    // without it. Each part fails on its own (data/mock_swot.js resultHistory):
    //  - recap: tone and the previous comparable attempt;
    //  - missedBefore: real wrong answers to the same question in the student's other attempts;
    //  - mistakeInsights: "From your record" lines under each repair (server-built sentences); {} until the answer
    //    checks are ready, as the SWOT says checks_pending;
    //  - cohort: other students' picks, and from slice 5 their time, changes and strike-outs: the nightly table
    //    question_option_stats while it is at most 48 hours old, else the committed snapshot as before
    //    (src/lib/server/cohortStats.js readCohortWithTime);
    //  - lab: the Mistake Lab ledger, first-pick re-mark and How others answered (data/mistake_lab.js; null until the
    //    answer checks are ready); the SWOT then leaves out what the ledger already shows. Slice 3 adds
    //    lab.acrossMocks, lab.repairOrder, lab.rules and lab.prove.ruleCheck (data/lab_loop.js), each null on its own
    //    failure; the rules and the rule check also need the repairs and playbook rows (src/lib/server/ruleBook.js);
    //    Slice 4 adds lab.traps (the trap tag under the student's wrong option: the trap atlas, then the question format) and
    //    lab.prove.later (which wrong answers come back in Revise, and when); each is left out on its own failure, and a failed
    //    atlas read leaves only the format tags (data/lab_loop.js buildLabSlice4);
    //  - swot: the post-mock SWOT and "Do these next" (left out entirely when SWOT_ENABLED=off).
    const history = await resultHistory({
      attempt,
      answerReviews: reviews.answerReviews,
      answerReviewState: reviews.answerReviewState,
      loadAttempts: () => Database.getAttempts(session.user.id, { memo, slim: 'history' }),
      recapOf: buildRecap,
      missedBeforeOf: buildMissedBefore,
      cohortOf: (input) => readCohortWithTime(input),
      labLoop: true,
      ruleSourcesOf: ({ allAttempts }) => loadRuleSources(session.user.id, allAttempts),
      labSlice4: {
        atlasOf: ({ attempt: paper }) => atlasForAttempt(paper),
        cardsOf: ({ attempt: paper }) => cardsFor(session.user.id, (paper.questionsSnapshot || []).map((q) => q?.id)),
      },
      swotEnabled: process.env.SWOT_ENABLED !== 'off',
      warn: (part, e) => console.warn(`[api/attempts/:id] ${part} skipped:`, e?.message),
    });
    return NextResponse.json({ ...attempt, ...reviews, ...history, ...(savedRepairs ? { savedRepairs } : {}), ...(paper ? { paper } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[api/attempts/:id] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load attempt' }, { status: 500 });
  }
}
