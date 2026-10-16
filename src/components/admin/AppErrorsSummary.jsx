import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// Read-only. Server component: no state, no client code. The numbers come from summariseTopErrors().
const number = (value) => new Intl.NumberFormat('en-IN').format(value);
const percent = (value) => `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
const when = (iso) => (iso
  ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
  : 'unknown');

export default function AppErrorsSummary({ summary, days, enabled, notSetUp, failed }) {
  return (
    <main className="min-h-screen bg-[#07070b] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-2">
          <Link href="/admin" className="inline-flex min-h-11 items-center gap-2 text-sm text-zinc-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Admin
          </Link>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">App errors</h1>
          <p className="text-sm text-zinc-400">
            The most frequent errors of the last {days} days, India time, from students who allowed usage data. Text is scrubbed of emails, phone numbers and tokens, and no student, device or network address is kept.
          </p>
        </header>

        {!enabled ? (
          <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
            Reporting is off. Remove APP_ERRORS_ENABLED=off from the server environment to start collecting again.
          </p>
        ) : null}
        {notSetUp ? (
          <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
            Not set up yet. Apply the app_errors migration, then errors appear here.
          </p>
        ) : null}
        {failed ? (
          <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            The errors could not be read just now. Reload to try again.
          </p>
        ) : null}

        {!notSetUp && !failed && summary.empty ? (
          <p className="rounded-lg border border-white/10 px-4 py-6 text-sm text-zinc-400">
            No errors reported in these {days} days. That means none arrived, not that none happened: phones report only for students who allowed usage data.
          </p>
        ) : null}

        {!notSetUp && !failed && !summary.empty ? (
          <section aria-labelledby="errors-top" className="space-y-3">
            <div className="space-y-1">
              <h2 id="errors-top" className="text-lg font-semibold">Top errors</h2>
              <p className="text-sm text-zinc-400">
                {number(summary.windowTotal)} reports of {number(summary.distinct)} different errors in these {days} days.
                {summary.hidden > 0 ? ` Showing the top ${number(summary.errors.length)}, which hold ${number(summary.shown)} of the ${number(summary.windowTotal)} reports.` : ''}
              </p>
            </div>
            <ol className="divide-y divide-white/10">
              {summary.errors.map((error) => (
                <li key={error.hash} className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <p className="min-w-0 break-words font-medium text-white">{error.message}</p>
                    <div className="shrink-0 text-right tabular-nums">
                      <p className="text-xl font-bold text-white">{number(error.total)}</p>
                      <p className="text-xs text-zinc-500">
                        {error.share.denominator > 0 ? `${percent(error.share.numerator / error.share.denominator)} of ${number(error.share.denominator)}` : ''}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400">
                    {error.kind}
                    {error.screen ? `, on ${error.screen}` : ''}
                    {error.platform ? `, ${error.platform}` : ''}
                    {error.appVersion ? `, version ${error.appVersion}` : ''}
                  </p>
                  <p className="text-sm text-zinc-500">
                    First seen {when(error.firstSeen)}. Last seen {when(error.lastSeen)}.
                  </p>
                  {error.stack ? (
                    <details className="text-sm text-zinc-400">
                      <summary className="inline-flex min-h-11 cursor-pointer items-center text-zinc-300 hover:text-white">Stack</summary>
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-zinc-300">{error.stack}</pre>
                    </details>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section aria-labelledby="errors-note" className="space-y-2 border-t border-white/10 pt-6 text-sm text-zinc-400">
          <h2 id="errors-note" className="text-base font-semibold text-zinc-200">How to read this</h2>
          <p>Reports are grouped by what the error says and the first line of where it happened, once per day. The count is how many times phones reported it, not how many students were hit: one student can report the same error many times.</p>
          <p>First seen is the first report of that error in these {days} days. Version and screen come from its latest report. Reports are deleted after 30 days, and at most 2,000 different errors are kept per day.</p>
        </section>
      </div>
    </main>
  );
}
