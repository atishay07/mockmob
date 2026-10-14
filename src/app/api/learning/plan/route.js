import { learningRecord } from '@/lib/server/learning';
import { learningHttp } from '@/lib/server/learningHttp';

// ?view=step returns the next-step card's fields only (no episode list, supported concepts or
// milestones). Any other value, or none, returns the full record as before.
export async function GET(request) {
  const started = performance.now();
  const response = await learningHttp(request, userId => {
    const url = new URL(request.url);
    return learningRecord(userId, {
      subject: url.searchParams.get('subject'),
      minutes: Number(url.searchParams.get('minutes')),
      view: url.searchParams.get('view') === 'step' ? 'step' : 'full',
    });
  });
  // Server time for this plan, so before and after numbers can be read in the browser.
  try { response.headers.set('Server-Timing', `plan;dur=${Math.round(performance.now() - started)}`); } catch { /* headers locked */ }
  return response;
}
