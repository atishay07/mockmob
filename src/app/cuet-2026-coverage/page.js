import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import '@/components/coverage/coverage.css';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import { Marked } from '@/components/doodle/Doodle';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { keepTogether } from '@/lib/keepTogether.mjs';
import { coverageSummary } from '@/components/coverage/coverageData.server';
import { COVERAGE_PATH, INDEX as C, STREAMS, ofQuestions, sittingLine, subjectPath } from '@/components/coverage/coverageCopy.mjs';

// How much of the real CUET 2026 papers MockMob already teaches (owner LK368, 22 Nov 2026; spec tmp/1122-coverage/UI-SPEC.md).
// Static: built from data/coverage/cuet2026/public/summary.json (scripts/coverage/build-public.mjs), so a visit never reads the
// database. Every figure on it is counted there. Only subjects in the summary are drawn; a stream with none is not drawn.

export function generateMetadata() {
  const { total } = coverageSummary();
  return seoMetadata({
    title: C.title,
    description: total.counted
      ? `We checked NTA's real CUET 2026 papers question by question: ${total.covered} of ${total.counted} questions are taught in MockMob. See every question beside the MockMob question or Key card that teaches it.`
      : C.sub,
    path: COVERAGE_PATH,
  });
}

export default function CoverageIndexPage() {
  const summary = coverageSummary();
  const { total, chapters } = summary;
  const repeats = total.same + total.newValues;
  const streams = STREAMS.map((st) => ({ ...st, subjects: summary.subjects.filter((s) => (s.stream || 'other') === st.id) })).filter((st) => st.subjects.length);

  return (
    <div className="mm cov">
      <JsonLd id="cuet-2026-coverage-breadcrumb-json-ld" data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: C.crumb, path: COVERAGE_PATH }])} />
      <NavBar />
      <main id="main-content">
        <article>
          <header className="mm-article__head cov-head">
            <div className="mm-wrap cov-wrap">
              <nav className="mm-crumbs" aria-label="Breadcrumb">
                <Link href="/">Home</Link>
                <span aria-hidden="true">/</span>
                <span>{keepTogether(C.crumb)}</span>
              </nav>
              <h1 className="mm-h1 mm-article__title cov-h1"><Marked text={keepTogether(C.h1)} marks={[[keepTogether(C.mark), { mark: 'underline', tone: 'brand' }]]} /></h1>
              <p className="mm-article__intro">{keepTogether(C.sub)}</p>
            </div>
          </header>

          <div className="mm-wrap cov-wrap cov-main">
            {total.counted ? (
              <section className="cov-card cov-figs" aria-label="The figures">
                <p className="cov-fig cov-fig--lead">
                  <b className="cov-big">{total.pct}<span>%</span></b>
                  <span>{C.pctLabel(total.counted)}</span>
                </p>
                <div className="cov-figs__side">
                  {repeats > 0 ? (
                    <p className="cov-fig">
                      <b className="cov-mid">{total.same}</b>
                      <span>{keepTogether(C.same(total.same))}{total.newValues ? `, ${C.newValues(total.newValues)}` : ''}.</span>
                    </p>
                  ) : null}
                  <p className="cov-fig">
                    <b className="cov-mid">{chapters.withPractice}<span> of {chapters.asked}</span></b>
                    <span>{keepTogether(C.chapters)}</span>
                  </p>
                </div>
              </section>
            ) : null}

            {streams.length ? (
              <section className="cov-sec" aria-labelledby="cov-subjects">
                <h2 className="cov-h2" id="cov-subjects">{C.subjectsHead}</h2>
                {streams.map((st) => (
                  <div key={st.id} className="cov-stream">
                    <h3 className="cov-stream__name">{st.name}</h3>
                    <ul className="cov-tiles">
                      {st.subjects.map((s) => (
                        <li key={s.id}>
                          <Link href={subjectPath(s.id)} className="cov-tile">
                            <span className="cov-tile__top">
                              <span className="cov-tile__name">{s.name}</span>
                              <b className="cov-tile__pct">{s.pct}%</b>
                            </span>
                            <span className="cov-meter" aria-hidden="true"><i style={{ width: `${s.pct}%` }} /></span>
                            <span className="cov-tile__count">{ofQuestions(s.covered, s.counted)}</span>
                            <span className="cov-tile__foot">
                              <span>{sittingLine(s)}</span>
                              <ArrowRight size={18} aria-hidden="true" />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ) : null}

            <section className="cov-sec cov-method" id="how" aria-labelledby="cov-how">
              <h2 className="cov-h2" id="cov-how">{C.methodHead}</h2>
              <ol className="cov-steps">
                {C.method.map((line) => <li key={line}>{keepTogether(line)}</li>)}
              </ol>
              <h3 className="cov-h3">{C.notCountHead}</h3>
              <ul className="cov-points">
                {C.notCount.map((line) => <li key={line}>{keepTogether(line)}</li>)}
                {chapters.minServed ? <li>{C.chapterRule(chapters.minServed)}</li> : null}
              </ul>
              <p className="cov-after">
                {keepTogether(C.after)}
                {summary.snapshotDay ? <> {C.snapshot(summary.snapshotDay)}</> : null}
              </p>
            </section>
          </div>

          <aside className="mm-close cov-close">
            <div className="mm-wrap cov-wrap">
              <h2 className="cov-h2">{keepTogether(C.closeHead)}</h2>
              <Link href="/signup" className="mm-btn mm-btn--primary">{C.close}</Link>
            </div>
          </aside>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
