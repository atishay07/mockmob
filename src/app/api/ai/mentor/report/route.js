import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPersistentRateLimit, rateLimitHeaders } from '@/lib/server/rateLimit';
import { handleReportPost, REPORT_LIMITS } from '@/lib/server/aiReplyReport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST { reason, reply, requestId, sessionId? } -> the student reports one AI reply they received.
// Signed in (bearer token or cookie), rate limited per student, reason from a fixed list, reply checked
// against the student's own conversation, one write. Write-only: there is no read route, and the table
// has no browser access. Rules and tests: src/lib/server/aiReplyReport.js, data/tests/ai_reply_report.test.mjs.
export async function POST(request) {
  return handleReportPost(request, {
    authenticate: async (req) => (await auth(req))?.user?.id || null,
    rateLimit: async (req, userId) => {
      for (const window of REPORT_LIMITS) {
        const result = await checkPersistentRateLimit(req, { ...window, keyParts: [userId] });
        if (!result.allowed) return { allowed: false, headers: rateLimitHeaders({ ...result, retryAfterSeconds: result.retryAfterSeconds || 60 }) };
      }
      return { allowed: true };
    },
    db: () => supabaseAdmin(),
  });
}
