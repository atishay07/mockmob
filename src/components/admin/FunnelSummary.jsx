import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// Read-only. Server component: no state, no client code. The numbers come from summariseFunnel().
const number = (value) => new Intl.NumberFormat('en-IN').format(value);
const percent = (value) => `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
const dayLabel = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function Rate({ label, part }) {
  if (!part) return null;
  if (!part.denominator) {
    return (
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-500">No data, 0 in that step</span>
      </div>
    );
  }
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className="text-right tabular-nums">
        <span className={part.small ? 'text-zinc-400' : 'font-semibold text-white'}>{percent(part.rate)}</span>
        <span className="ml-2 text-zinc-500">{number(part.numerator)} of {number(part.denominator)}</span>
        {part.small ? <span className="ml-2 text-zinc-500">small sample</span> : null}
        {part.over ? <span className="ml-2 text-amber-300">above 100%, see note</span> : null}
      </span>
    </div>
  );
}

function PlatformShareCell({ part }) {
  if (!part.denominator) return <td className="py-2 text-right text-zinc-500">No data</td>;
  return (
    <td className="py-2 text-right">
      <span className={part.small ? 'text-zinc-400' : 'font-semibold text-white'}>{percent(part.rate)}</span>
      <span className="ml-2 text-zinc-500">{number(part.numerator)} of {number(part.denominator)}</span>
      {part.small ? <span className="ml-2 text-zinc-500">small sample</span> : null}
    </td>
  );
}

export default function FunnelSummary({ summary, enabled, notSetUp, failed }) {
  const landing = summary.stages[0]?.count || 0;
  return (
    <main className="min-h-screen bg-[#07070b] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <Link href="/admin" className="inline-flex min-h-11 items-center gap-2 text-sm text-zinc-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Admin
          </Link>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Landing funnel</h1>
          <p className="text-sm text-zinc-400">
            {dayLabel(summary.from)} to {dayLabel(summary.to)}, {summary.days} days, India time. Anonymous daily totals: no person, device or visit is tracked.
          </p>
        </header>

        {!enabled ? (
          <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
            Counting is off. Set FUNNEL_ENABLED to true in the server environment to start counting.
          </p>
        ) : null}
        {notSetUp ? (
          <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
            The counter table does not exist yet. Apply the funnel_daily migration, then counts appear here.
          </p>
        ) : null}
        {failed ? (
          <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            The counts could not be read just now. Reload to try again.
          </p>
        ) : null}

        {!notSetUp && !failed && summary.empty ? (
          <p className="rounded-lg border border-white/10 px-4 py-6 text-sm text-zinc-400">
            Nothing counted in these {summary.days} days yet. Once the landing page calls the funnel helper, each step appears here with its rate and the numbers behind it.
          </p>
        ) : null}

        {!notSetUp && !failed && !summary.empty ? (
          <>
            <section aria-labelledby="funnel-steps" className="space-y-1">
              <h2 id="funnel-steps" className="text-lg font-semibold">Steps</h2>
              <ol className="divide-y divide-white/10">
                {summary.stages.map((stage) => (
                  <li key={stage.step} className="space-y-2 py-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium text-white">{stage.label}</span>
                      <span className="text-xl font-bold tabular-nums text-white">{number(stage.count)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10" role="presentation">
                      <div
                        className="h-2 rounded-full bg-volt"
                        style={{ width: `${landing > 0 ? Math.min(100, (stage.count / landing) * 100) : 0}%` }}
                      />
                    </div>
                    <Rate label={stage.ofPrevious ? `Of the step before (${stage.ofPrevious.againstLabel.charAt(0).toLowerCase()}${stage.ofPrevious.againstLabel.slice(1)})` : ''} part={stage.ofPrevious} />
                    {stage.ofPrevious && stage.ofPrevious.againstLabel !== stage.ofLanding.againstLabel ? (
                      <Rate label="Of all landing views" part={stage.ofLanding} />
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>

            <section aria-labelledby="funnel-platform" className="space-y-4">
              <div className="space-y-1">
                <h2 id="funnel-platform" className="text-lg font-semibold">By platform</h2>
                <p className="text-sm text-zinc-400">
                  Where visits and finished sign ups come from: {number(summary.totalVisits)} landing views and {number(summary.totalSignups)} finished sign ups in these {summary.days} days.
                </p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-400">
                    <th scope="col" className="py-2 font-normal">Platform</th>
                    <th scope="col" className="py-2 text-right font-normal">Share of visits</th>
                    <th scope="col" className="py-2 text-right font-normal">Share of sign ups</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 tabular-nums">
                  {summary.byPlatform.map((p) => (
                    <tr key={p.platform}>
                      <th scope="row" className="py-2 text-left font-normal text-zinc-300">{p.label}</th>
                      <PlatformShareCell part={p.visitShare} />
                      <PlatformShareCell part={p.signupShare} />
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-6">
                {summary.byPlatform.map((p) => (
                  <div key={p.platform} className="space-y-1">
                    <h3 className="font-medium text-white">{p.label}</h3>
                    {p.empty ? (
                      <p className="text-sm text-zinc-500">Nothing counted for this platform in these {summary.days} days.</p>
                    ) : (
                      <ol className="divide-y divide-white/10">
                        {p.stages.map((stage) => (
                          <li key={stage.step} className="space-y-1 py-3">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="text-zinc-300">{stage.label}</span>
                              <span className="text-lg font-bold tabular-nums text-white">{number(stage.count)}</span>
                            </div>
                            {stage.ofPrevious ? (
                              <Rate label={`Of the step before (${stage.ofPrevious.againstLabel.charAt(0).toLowerCase()}${stage.ofPrevious.againstLabel.slice(1)})`} part={stage.ofPrevious} />
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="funnel-side" className="space-y-2">
              <h2 id="funnel-side" className="text-lg font-semibold">Returning students</h2>
              {summary.side.map((row) => (
                <div key={row.step} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-white">{row.label}</span>
                    <span className="text-xl font-bold tabular-nums text-white">{number(row.count)}</span>
                  </div>
                  <Rate label="Of all landing views" part={row.ofLanding} />
                </div>
              ))}
            </section>

            <section aria-labelledby="funnel-days" className="space-y-2">
              <h2 id="funnel-days" className="text-lg font-semibold">By day</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-400">
                    <th scope="col" className="py-2 font-normal">Day</th>
                    <th scope="col" className="py-2 text-right font-normal">Landing views</th>
                    <th scope="col" className="py-2 text-right font-normal">Finished sign ups</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 tabular-nums">
                  {[...summary.daily].reverse().map((row) => (
                    <tr key={row.day}>
                      <th scope="row" className="py-2 text-left font-normal text-zinc-300">{dayLabel(row.day)}</th>
                      <td className="py-2 text-right text-white">{number(row.landing_view)}</td>
                      <td className="py-2 text-right text-white">{number(row.signup_complete)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        ) : null}

        <section aria-labelledby="funnel-note" className="space-y-2 border-t border-white/10 pt-6 text-sm text-zinc-400">
          <h2 id="funnel-note" className="text-base font-semibold text-zinc-200">How to read this</h2>
          <p>Each step is a separate daily total, so a rate compares two totals. It is not the share of the same people. A step can pass 100% when someone finishes sign up on a later day than they chose it, or arrives by a link straight to a later step.</p>
          <p>A step is counted once per page load. Visits from obvious bots, and browsers that send Do Not Track or Global Privacy Control, are not counted, so true traffic is a little higher.</p>
          <p>The platform is read from the browser or app at the moment of the visit and only the category is kept: desktop, Android browser, iPhone and iPad browser, Android app, or other. A share is the count for that platform over the all-platform count of the same step, so each column adds up to 100%. A finished sign up is counted by the server when the account is first created, on whatever device made it, so it can be a different platform from the landing view that led to it. The Android app does not open the landing page, so it shows sign ups only.</p>
          <p>Rates built on fewer than 30 are marked small sample and should not drive a decision.</p>
        </section>
      </div>
    </main>
  );
}
