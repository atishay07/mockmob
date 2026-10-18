import { summariseMobMetrics } from '@/lib/mob/metrics.mjs';

// The Mob block on /admin/funnel (SOCIAL-SPEC section 13). Read-only, server component. Aggregate counts over every Mob,
// groups under 5 shown as "fewer than 5" (P8), and the spec's stop rule stated when it trips. No names, no ids.
const dayLabel = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export default function MobMetricsBlock({ result }) {
  if (!result || result.reason === 'off') return null;
  const summary = result.ok ? summariseMobMetrics(result.raw) : null;
  return (
    <section aria-labelledby="funnel-mob" className="space-y-2">
      <h2 id="funnel-mob" className="text-lg font-semibold">Mob</h2>
      {!result.ok ? (
        <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
          {result.reason === 'missing' ? 'The Mob tables are not set up on this database yet.' : 'The Mob counts could not be read just now. Reload to try again.'}
        </p>
      ) : (
        <>
          <p className="text-sm text-zinc-400">
            {summary.week ? `Week of ${dayLabel(summary.week)}, India time. ` : ''}Counts over every Mob. Groups under 5 are not shown as rates. These are observed counts, not causes.
          </p>
          {summary.stop.tripped ? (
            <div className="rounded-lg border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100" role="status">
              <p className="font-semibold">Stop rule reached: pause invites and tell the owner.</p>
              <ul className="mt-1 list-disc pl-5">{summary.stop.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              <p className="mt-1">Set MOB_INVITES_ENABLED=false and redeploy. Existing Mobs keep working.</p>
            </div>
          ) : null}
          <dl className="divide-y divide-white/10 rounded-lg border border-white/10">
            {summary.rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                <dt className="text-zinc-400">{row.label}<span className="block text-xs text-zinc-500">{row.note}</span></dt>
                <dd className="text-right font-semibold tabular-nums text-white">{row.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
