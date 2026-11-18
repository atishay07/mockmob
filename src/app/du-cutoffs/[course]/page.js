import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { PublicDock } from '@/components/PublicDock';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { keepTogether } from '@/lib/keepTogether.mjs';
import { duCutoffCatalog, findCourse } from '@/lib/du/cutoffData.server';
import {
  CUTOFFS_PATH, calculatorHref, collegeTitle, courseMeta, coursePath, courseSections, eligibilityLines, plural, roundOneRange,
} from '@/lib/du/cutoffPages.mjs';
import { CutoffTable } from '../_parts/CutoffTable';
import { CutoffClose, CutoffSources, DOCK_NOTE, RoundNote, YearNote } from '../_parts/CutoffParts';
import '../du-cutoffs.css';
import Doodle from '@/components/doodle/Doodle';
import { PUBLIC_MARKS } from '@/lib/publicMarks.mjs';

// One DU course's 2026 cutoffs at every college that offers it (68 pages, one per course with a published list).
// Static: the data is the checked 2026 files, so every page is built once and nothing runs per request.
export const dynamicParams = false;

export function generateStaticParams() {
  return duCutoffCatalog().courses.map((course) => ({ course: course.id }));
}

export async function generateMetadata({ params }) {
  const { course: id } = await params;
  const course = findCourse(id);
  if (!course) return {};
  const meta = courseMeta(course);
  return seoMetadata({ title: meta.title, description: meta.description, path: coursePath(course.id) });
}

export default async function DuCourseCutoffPage({ params }) {
  const { course: id } = await params;
  const course = findCourse(id);
  if (!course) notFound();

  const sections = courseSections(course).map((section) => ({
    ...section,
    open: false,
    linkLabel: section.heading ? `Every course at ${collegeTitle(section.heading)}` : null,
  }));
  const range = roundOneRange(course);
  const rules = eligibilityLines(course);
  const others = duCutoffCatalog().courses.filter((c) => c.stream === course.stream && c.id !== course.id);
  const calc = calculatorHref(course.id);
  const where = course.collegeCount === 1 ? 'the one college that offers it' : `each of the ${course.collegeCount} colleges that offer it`;

  return (
    <div className="mm">
      <JsonLd
        id={`du-cutoffs-${course.id}-breadcrumb-json-ld`}
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'DU cutoffs', path: CUTOFFS_PATH },
          { name: course.name, path: coursePath(course.id) },
        ])}
      />
      <NavBar />
      <main id="main-content">
        <article className="dc">
          <header className="mm-article__head">
            <div className="mm-wrap mm-wrap--tight">
              <nav className="mm-crumbs dc-crumbs" aria-label="Breadcrumb">
                <Link href="/">Home</Link>
                <span aria-hidden="true">/</span>
                <Link href={CUTOFFS_PATH}>DU cutoffs</Link>
                <span aria-hidden="true">/</span>
                <span>{course.name}</span>
              </nav>
              <h1 className="mm-h1 mm-article__title dc-title">DU {course.name} cutoffs <Doodle {...PUBLIC_MARKS.duCourse.head[1]}>{PUBLIC_MARKS.duCourse.head[0]}</Doodle></h1>
              <p className="mm-article__intro">
                {keepTogether(`The lowest CUET score that got a ${course.name} seat at ${where}, in each of DU’s three 2026 rounds, for every category.`)}
                {course.pairs ? ' DU lists this course by pair of subjects, so each college has a score for every pair it teaches.' : ''}
              </p>
              {range ? (
                <p className="dc-range">
                  Round 1, unreserved: from <span className="dc-num">{range.low}</span> to <span className="dc-num">{range.high}</span>
                  {course.pairs ? ` across ${plural(range.count, 'subject pair')}.` : ` across ${plural(range.count, 'college')}.`}
                </p>
              ) : null}
              <YearNote />
              <div className="mm-article__go dc-go">
                <Link href={calc} className="mm-btn mm-btn--secondary">Check your subjects for this course</Link>
              </div>
            </div>
          </header>

          <div className="mm-wrap mm-wrap--tight mm-article dc-body">
            <section className="mm-article__section" aria-labelledby="dc-table-title">
              <h2 className="mm-h2" id="dc-table-title">{course.pairs ? 'Cutoffs by college and subject pair' : 'Cutoffs by college'}</h2>
              <CutoffTable sections={sections} subject={course.name} firstColumn="College" />
              <RoundNote />
            </section>

            {rules.options.length ? (
              <section className="mm-article__section" aria-labelledby="dc-rules-title">
                <h2 className="mm-h2" id="dc-rules-title">Who can apply</h2>
                <p>
                  {keepTogether(`DU’s Bulletin for 2026-27 takes any one of these sets of CUET subjects for ${course.name}. List A is DU’s list of languages, List B its list of domain subjects.`)}
                </p>
                <ol className="dc-rules">
                  {rules.options.map((o) => (
                    <li key={o.label}>
                      <b>{o.label}</b>
                      <span>{o.text}</span>
                      {o.secondary ? <small>Considered only if seats remain after Options 1 and 2.</small> : null}
                      {o.extraLanguage ? <small>The Bulletin also requires at least one language from its approved language list.</small> : null}
                    </li>
                  ))}
                </ol>
                {rules.performanceTest ? <p>Merit for this course also uses a separate performance or practical test.</p> : null}
                <p>
                  {keepTogether('The 2027 rules arrive with DU’s next Bulletin.')}{' '}
                  <Link href={calc} className="mm-link">Check your subjects against these rules</Link>
                </p>
              </section>
            ) : null}

            <CutoffSources />

            {others.length ? (
              <nav className="mm-article__section dc-others" aria-labelledby="dc-others-title">
                <h2 className="mm-h2" id="dc-others-title">More {course.stream} courses</h2>
                <ul className="dc-list">
                  {others.map((c) => (
                    <li key={c.id}>
                      <Link href={coursePath(c.id)} className="dc-list__link">
                        <span className="dc-list__name">{c.name}</span>
                        <span className="dc-list__meta">{plural(c.collegeCount, 'college')}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p><Link href={CUTOFFS_PATH} className="mm-link">Every DU course and college</Link></p>
              </nav>
            ) : null}
          </div>

          <CutoffClose calculatorHref={calc} calculatorLabel="Check your subjects" />
        </article>
      </main>
      <MarketingFooter />
      <PublicDock note={DOCK_NOTE} />
    </div>
  );
}
