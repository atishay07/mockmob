import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import '@/components/coverage/coverage.css';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import { Marked } from '@/components/doodle/Doodle';
import { ncertFont } from '@/components/keycards/ncertFont';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { keepTogether } from '@/lib/keepTogether.mjs';
import { coverageSubject, coverageSummary } from '@/components/coverage/coverageData.server';
import { COVERAGE_PATH, INDEX, SUBJECT as C, ofQuestions, subjectPath } from '@/components/coverage/coverageCopy.mjs';
import { CoverageBar, Palette, QuestionCard, outLine } from '@/components/coverage/CoveragePieces';
import CoverageFilter from '@/components/coverage/CoverageFilter';

// One subject's CUET 2026 paper, question by question, beside the MockMob question or Key card that teaches each one (owner
// LK368, 22 Nov 2026; spec tmp/1122-coverage/UI-SPEC.md). Static: every subject in data/coverage/cuet2026/public/summary.json
// is built at deploy and any other address is a real 404 (dynamicParams false). The only script is the filter island.
export const dynamicParams = false;

export function generateStaticParams() {
  return coverageSummary().subjects.map((s) => ({ subject: s.id }));
}

async function subjectFor(params) {
  const { subject } = await params;
  return coverageSubject(subject);
}

export async function generateMetadata({ params }) {
  const s = await subjectFor(params);
  if (!s) return {};
  return seoMetadata({ title: C.title(s.name), description: C.description(s), path: subjectPath(s.id) });
}

export default async function CoverageSubjectPage({ params }) {
  const s = await subjectFor(params);
  if (!s) notFound();
  const others = coverageSummary().subjects.filter((o) => o.id !== s.id);

  // The chapter filter: the counted chapters (as the table orders them), then any chapter only a not-counted question has.
  const names = s.chapters.map((c) => c.name);
  for (const q of s.questions) if (q.chapter && !names.includes(q.chapter)) names.push(q.chapter);
  const chapterIndex = (q) => String(Math.max(0, names.indexOf(q.chapter)));
  const filterChapters = names.map((name, i) => ({ i, name }));
  const out = outLine(s.counts);
  const totals = s.chapters.reduce((t, c) => ({ asked: t.asked + c.asked, covered: t.covered + c.covered }), { asked: 0, covered: 0 });

  return (
    <div className={`mm cov ${ncertFont.variable}`}>
      <JsonLd
        id={`cuet-2026-coverage-${s.id}-breadcrumb-json-ld`}
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: INDEX.crumb, path: COVERAGE_PATH },
          { name: s.name, path: subjectPath(s.id) },
        ])}
      />
      <NavBar />
      <main id="main-content">
        <article>
          <header className="mm-article__head cov-head">
            <div className="mm-wrap cov-wrap">
              <nav className="mm-crumbs" aria-label="Breadcrumb">
                <Link href="/">Home</Link>
                <span aria-hidden="true">/</span>
                <Link href={COVERAGE_PATH}>{keepTogether(INDEX.crumb)}</Link>
                <span aria-hidden="true">/</span>
                <span>{s.name}</span>
              </nav>
              <h1 className="mm-h1 mm-article__title cov-h1"><Marked text={keepTogether(C.h1(s.name))} marks={[[C.mark, { mark: 'underline', tone: 'brand' }]]} /></h1>
              <p className="mm-article__intro">{keepTogether(C.line(s))}</p>
            </div>
          </header>

          <div className="mm-wrap cov-wrap cov-main">
            <section className="cov-card cov-sum" aria-label="Summary">
              <p className="cov-fig cov-fig--lead">
                <b className="cov-big">{s.counts.pct}<span>%</span></b>
                <span>{C.pctLabel(s.counts.counted)}</span>
                <span className="cov-sum__count">{ofQuestions(s.counts.covered, s.counts.counted)}</span>
              </p>
              <div className="cov-sum__bar">
                <CoverageBar counts={s.counts} />
                {out ? <p className="cov-sum__out">{out}</p> : null}
                <p className="cov-sum__how"><Link href={`${COVERAGE_PATH}#how`}>{INDEX.methodHead}</Link></p>
              </div>
            </section>

            <section className="cov-sec cov-qs" id="questions" aria-labelledby="cov-qs-title">
              <div id="cov-root">
                <div className="cov-qs__head">
                  <h2 className="cov-h2" id="cov-qs-title">{C.paletteHead}</h2>
                  <p className="cov-hint">{C.paletteHint}</p>
                </div>
                <CoverageFilter rootId="cov-root" chapters={filterChapters} total={s.questions.length} />
                <Palette questions={s.questions} chapterIndex={chapterIndex} />
                <div className="cov-cards">
                  {s.questions.map((q, i) => <QuestionCard key={q.n} q={q} open={i === 0} chapterIndex={chapterIndex(q)} />)}
                </div>
              </div>
            </section>

            <section className="cov-sec" aria-labelledby="cov-ch-title">
              <h2 className="cov-h2" id="cov-ch-title">{C.chaptersHead}</h2>
              <div className="cov-tablewrap">
                <table className="cov-table">
                  <thead>
                    <tr>{C.chapterCols.map((h, i) => <th key={h} scope="col" className={i ? 'is-num' : undefined}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {s.chapters.map((c) => (
                      <tr key={c.name}>
                        <th scope="row">{c.name}</th>
                        <td className="is-num">{c.asked}</td>
                        <td className="is-num"><span className={c.covered ? 'cov-table__in' : 'cov-table__none'}>{c.covered}</span></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">All chapters</th>
                      <td className="is-num">{totals.asked}</td>
                      <td className="is-num">{totals.covered}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {others.length ? (
              <nav className="cov-sec" aria-labelledby="cov-others">
                <h2 className="cov-h2" id="cov-others">{C.othersHead}</h2>
                <ul className="cov-others">
                  {others.map((o) => (
                    <li key={o.id}>
                      <Link href={subjectPath(o.id)} className="cov-other">
                        <span className="cov-other__name">{o.name}</span>
                        <b className="cov-other__pct">{o.pct}%</b>
                        <span className="cov-other__count">{ofQuestions(o.covered, o.counted)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </div>

          <aside className="mm-close cov-close">
            <div className="mm-wrap cov-wrap">
              <p className="cov-after">{keepTogether(INDEX.after)}</p>
              <Link href="/signup" className="mm-btn mm-btn--primary">{C.close}</Link>
            </div>
          </aside>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
