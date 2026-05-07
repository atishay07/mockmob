import { supabase } from '@/lib/supabase';
import { SUBJECTS } from '@/../data/subjects';
import { checkRateLimit, rateLimitHeaders } from '@/lib/server/rateLimit';
import {
  failRequestDiagnostics,
  finishRequestDiagnostics,
  startRequestDiagnostics,
} from '@/lib/server/requestDiagnostics';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/stats';
const STATS_RATE_LIMIT = 120;

function jsonWithDiagnostics(context, body, init) {
  const response = Response.json(body, init);
  finishRequestDiagnostics(context, { status: response.status });
  return response;
}

export async function GET(request) {
  const diagnostics = startRequestDiagnostics(request, ROUTE);
  try {
    const rateLimit = checkRateLimit(request, {
      route: ROUTE,
      limit: STATS_RATE_LIMIT,
    });
    if (!rateLimit.allowed) {
      return jsonWithDiagnostics(
        diagnostics,
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      );
    }

    const { count, error } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .or('status.eq.live,and(verification_state.eq.verified,exploration_state.eq.active)');
    
    if (error) throw error;
    const subjectCounts = {};
    await Promise.all(SUBJECTS.map(async (subject) => {
      const { count: subjectCount, error: subjectError } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('subject', subject.id)
        .eq('is_deleted', false)
        .or('status.eq.live,and(verification_state.eq.verified,exploration_state.eq.active)');

      if (subjectError) throw subjectError;
      subjectCounts[subject.id] = subjectCount || 0;
    }));
    
    return jsonWithDiagnostics(diagnostics, {
      bankSize: count || 0,
      subjectCounts,
    });
  } catch (error) {
    failRequestDiagnostics(diagnostics, error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
