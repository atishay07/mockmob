import { readablePracticeQuestions } from '@/../data/practice_library';
import { attachBankPassages } from '@/../scripts/pipeline/lib/bankSnapshot.mjs';
import { advanceFeedPage, feedWindow } from '@/../data/explore_feed';
import { feedServed } from '@/../data/explore_served';
import { PRACTICE_QUESTION_COLUMNS, PRACTICE_STUB_COLUMNS } from '@/../data/practice_pick';
import { readRowsCached } from '@/../data/question_row_cache';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { isRetiredSubject } from '@/../data/subject_claim';
import { checkPersistentRateLimit, checkRateLimit, rateLimitHeaders } from '@/lib/server/rateLimit';
import { readHeldQuestionIds } from '@/lib/server/heldQuestions';
import {
  failRequestDiagnostics,
  finishRequestDiagnostics,
  startRequestDiagnostics,
} from '@/lib/server/requestDiagnostics';

const ROUTE = '/api/questions/feed';
const FEED_RATE_LIMIT = 180;
// L3 (15 Nov 2026): the feed sends keys and explanations, so it answers signed-in readers only and no answer is ever kept by
// a CDN or a shared cache. The old 5-minute CDN copy for signed-out readers is gone with them.
const NO_STORE = { 'Cache-Control': 'private, no-store' };
// L3: `search` finds a question by its words, so it can look up the key of a question on screen. Counted per reader in the
// database (always the database limiter in production, as the guest Ask Mobi route does; production does not set
// PERSISTENT_LIMITS_ENABLED). The website never searches and the app pages 20 at a time: 20 searched pages in 10 minutes
// and 60 in a day are far above a student looking something up, and hold a walk of the bank by search to at most
// 3,000 rows a day an account (50 a page).
const SEARCH_LIMITS = [
  { route: '/api/questions/feed:search', limit: 20, windowMs: 10 * 60_000 },
  { route: '/api/questions/feed:search:day', limit: 60, windowMs: 86_400_000 },
];
// L3: never every column. The page is read without the signed evidence and provenance records (the shared light list,
// data/practice_pick.js); only the rows that carry one are then read whole, through the stamp cache, because the publication
// gate checks the signature over the whole record. The same rows and fields as the old read of every column.
const VOTE_COLUMNS = ['upvotes', 'downvotes', 'score'];
const FEED_SELECT = [...PRACTICE_QUESTION_COLUMNS, ...PRACTICE_STUB_COLUMNS].join(',');
const FEED_SELECT_NO_VOTES = [...PRACTICE_QUESTION_COLUMNS.filter((column) => !VOTE_COLUMNS.includes(column)), ...PRACTICE_STUB_COLUMNS].join(',');

export const dynamic = 'force-dynamic';

function jsonWithDiagnostics(context, body, init, extra) {
  const response = NextResponse.json(body, { ...init, headers: { ...NO_STORE, ...(init?.headers || {}) } });
  finishRequestDiagnostics(context, { status: response.status, extra });
  return response;
}

/** The ids of these rows that carry an evidence or provenance record (the rows the gate must see whole). */
async function managedIdsOf(db, ids) {
  const managed = new Set();
  if (!ids.length) return managed;
  await Promise.all(['evidence', 'provenance'].map(async (column) => {
    const { data, error } = await db.from('questions').select('id').in('id', ids).not(column, 'is', null);
    if (error) throw error;
    for (const row of data || []) managed.add(row.id);
  }));
  return managed;
}

/**
 * GET /api/questions/feed
 *
 * Simple paginated feed of live questions — direct query, no question_scores dependency. Signed-in readers only (cookie or
 * the app's bearer token); 401 otherwise.
 *
 * Query params:
 *   subject  (required)
 *   chapter  (optional)
 *   difficulty (optional: easy | medium | hard)
 *   search   (optional; limited per reader)
 *   limit    (default 20, max 50)
 *   offset   (default 0)
 *
 * Response: { questions: [...], total: null, nextOffset: number, hasMore: boolean }
 * A question held for this reader (sitting in their Mob's open paper or game, a held Mob paper of theirs, or their running
 * session: src/lib/server/heldQuestions.js) is left out of the page, as Revise leaves it out; nextOffset still counts it.
 */
export async function GET(request) {
  const diagnostics = startRequestDiagnostics(request, ROUTE);
  try {
    const rateLimit = checkRateLimit(request, {
      route: ROUTE,
      limit: FEED_RATE_LIMIT,
    });
    if (!rateLimit.allowed) {
      return jsonWithDiagnostics(
        diagnostics,
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      );
    }

    // L3: who is reading is known before any question is read; nobody else gets a page.
    const session = await auth(request).catch(() => null);
    const userId = session?.user?.id || null;
    if (!userId) {
      return jsonWithDiagnostics(diagnostics, { error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');
    if (!subject) {
      return jsonWithDiagnostics(diagnostics, { error: 'subject is required' }, { status: 400 });
    }
    // A paper CUET dropped in 2025 is never offered, though its rows stay in the database.
    if (isRetiredSubject(subject)) {
      return jsonWithDiagnostics(diagnostics, { error: 'SUBJECT_NOT_SUPPORTED', subject }, { status: 422 });
    }

    const chapter = searchParams.get('chapter') || null;
    const difficulty = searchParams.get('difficulty') || null;
    const search = (searchParams.get('search') || '').trim();
    const { limit, offset } = feedWindow(searchParams.get('limit'), searchParams.get('offset'));

    if (search.length >= 2) {
      for (const window of SEARCH_LIMITS) {
        const limited = await checkPersistentRateLimit(request, {
          ...window, keyParts: [userId], identityOnly: true, fallback: 'memory', persistent: process.env.NODE_ENV === 'production',
        });
        if (!limited.allowed) {
          return jsonWithDiagnostics(
            diagnostics,
            { error: 'Too many searches. Try again in a few minutes.' },
            { status: 429, headers: rateLimitHeaders({ ...limited, retryAfterSeconds: limited.retryAfterSeconds || 60 }) },
          );
        }
      }
    }

    const db = supabaseAdmin();
    // The holds are read beside the page; a failed read fails the request (no key is sent while they are unknown).
    const heldRead = readHeldQuestionIds(db, userId).then((ids) => ({ ids }), (error) => ({ error }));
    const buildQuery = (withVotes) => {
      let next = db
        .from('questions')
        .select(withVotes ? FEED_SELECT : FEED_SELECT_NO_VOTES) // no exact count: the count is discarded below (egress F8)
        .eq('is_deleted', false)
        .or('status.eq.live,and(verification_state.eq.verified,exploration_state.eq.active)')
        .eq('subject', subject);

      if (chapter) next = next.eq('chapter', chapter);
      if (['easy', 'medium', 'hard'].includes(difficulty)) next = next.eq('difficulty', difficulty);
      if (search.length >= 2) {
        const safeSearch = search.replace(/[%,]/g, ' ').slice(0, 80);
        next = next.or(`body.ilike.%${safeSearch}%,question.ilike.%${safeSearch}%,chapter.ilike.%${safeSearch}%,subject.ilike.%${safeSearch}%`);
      }
      if (withVotes) {
        next = next
          .gte('score', 0)
          .order('score', { ascending: false });
      }

      return next
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + limit - 1);
    };

    let { data, count, error } = await buildQuery(true);
    if (error && (error.code === '42703' || /score|upvotes|downvotes|column .* does not exist/i.test(error.message || ''))) {
      ({ data, count, error } = await buildQuery(false));
    }
    if (error) throw error;
    const rawCount = (data || []).length;
    const pageIds = (data || []).map((r) => r.id);
    const managed = await managedIdsOf(db, pageIds);
    if (managed.size) {
      const { data: fullRows, error: fullError } = await readRowsCached(db, [...managed]);
      if (fullError) throw fullError;
      const fullById = new Map((fullRows || []).map((row) => [row.id, row]));
      // A managed row that changed or went away between the two reads is left out rather than judged without its record.
      data = (data || []).map((row) => (managed.has(row.id) ? fullById.get(row.id) : row)).filter(Boolean);
    }
    data = await readablePracticeQuestions(await attachBankPassages(db, data || []), db);
    count = null; // Legacy raw row counts are not eligible-content counts.
    const held = await heldRead;
    if (held.error) throw held.error;
    if (held.ids.size) data = data.filter((r) => !held.ids.has(r.id));
    const questionIds = (data || []).map((r) => r.id);
    // Votes and bookmarks together: neither needs the other.
    const [voteMap, savedSet] = await Promise.all([
      Database.getUserVotes(userId, questionIds),
      questionIds.length > 0
        ? db
          .from('question_bookmarks')
          .select('question_id')
          .eq('user_id', userId)
          .in('question_id', questionIds)
          .then(({ data: savedRows, error: savedError }) => (savedError ? new Set() : new Set((savedRows || []).map((row) => row.question_id))))
        : new Set(),
    ]);

    return jsonWithDiagnostics(diagnostics, {
      questions: (data || []).map((r) => ({
        id: r.id,
        subject: r.subject,
        chapter: r.chapter,
        difficulty: r.difficulty,
        body: r.question ?? r.body,
        // Options, key and explanation in the stable option order every surface serves (data/option_order.js).
        ...feedServed(r),
        passage_text: r.passage_text || null,
        passage_group_id: r.passage_group_id || r.passage_id || null,
        order_index: r.order_index ?? null,
        tags: r.tags || [],
        ai_tier: r.ai_tier,
        ai_score: r.ai_score,
        verification_state: r.evidence?.record?.state || 'legacy',
        verification_methods: Object.keys(r.evidence?.record?.checks || {}),
        source_refs: r.evidence?.record?.sources || [],
        upvotes: r.upvotes || 0,
        downvotes: r.downvotes || 0,
        score: r.score || 0,
        userVote: voteMap.get(r.id) || null,
        saved: savedSet.has(r.id),
      })),
      total: null,
      ...advanceFeedPage(offset, limit, rawCount),
    }, undefined, { subject, count: data?.length || 0 });
  } catch (e) {
    failRequestDiagnostics(diagnostics, e);
    console.error('[api/questions/feed] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load feed' }, { status: 500, headers: NO_STORE });
  }
}
