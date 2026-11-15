import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { PublicDock } from '@/components/PublicDock';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { keepTogether } from '@/lib/keepTogether.mjs';
import { duCutoffCatalog } from '@/lib/du/cutoffData.server';
import { CUTOFFS_PATH, calculatorHref, collegePath, coursePath, coursesByStream, indexMeta, plural } from '@/lib/du/cutoffPages.mjs';
import { CutoffFinder } from './_parts/CutoffFinder';
import { CutoffClose, CutoffSources, DOCK_NOTE, YearNote } from './_parts/CutoffParts';
import './du-cutoffs.css';

// The DU cutoffs index: every course with a published 2026 list and every college, each one page. Static.
const meta = indexMeta(duCutoffCatalog());
export const metadata = seoMetadata({ title: meta.title, description: meta.description, path: CUTOFFS_PATH });

export default function DuCutoffsIndexPage() {
  const catalog = duCutoffCatalog();
  const streams = coursesByStream(catalog.courses).map((s) => ({
    stream: s.stream,
    courses: s.courses.map((c) => ({
      id: c.id,
      name: c.name,
      href: coursePath(c.id),
      meta: plural(c.collegeCount, 'college'),
    })),
  }));
  const colleges = catalog.colleges.map((c) => ({
    slug: c.slug,
    name: c.name,
    href: collegePath(c.slug),
    meta: plural(c.courseCount, 'course'),
  }));
  const calc = calculatorHref(null);

  return (
    <div className="mm">
      <JsonLd id="du-cutoffs-breadcrumb-json-ld" data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'DU cutoffs', path: CUTOFFS_PATH }])} />
      <NavBar />
      <main id="main-content">
        <article className="dc">
          <header className="mm-article__head">
            <div className="mm-wrap mm-wrap--tight">
              <nav className="mm-crumbs dc-crumbs" aria-label="Breadcrumb">
                <Link href="/">Home</Link>
                <span aria-hidden="true">/</span>
                <span>DU cutoffs</span>
              </nav>
              <h1 className="mm-h1 mm-article__title dc-title">DU cutoffs 2026 for every course and college</h1>
              <p className="mm-article__intro">
                {keepTogether(`The lowest CUET score that got a seat in each of DU’s three 2026 rounds, for ${catalog.courses.length} courses at ${catalog.colleges.length} colleges and every category. Pick a course to compare its colleges, or a college to see all its courses.`)}
              </p>
              <YearNote />
              <div className="mm-article__go dc-go">
                <Link href={calc} className="mm-btn mm-btn--secondary">Find courses for your subjects</Link>
              </div>
            </div>
          </header>

          <div className="mm-wrap mm-wrap--tight mm-article dc-body">
            <CutoffFinder streams={streams} colleges={colleges} />

            {catalog.withoutCutoffs.length ? (
              <section className="mm-article__section" aria-labelledby="dc-none-title">
                <h2 className="mm-h2" id="dc-none-title">Courses with no cutoff list</h2>
                <p>
                  {keepTogether(`DU picks students for ${catalog.withoutCutoffs.length === 1 ? 'one course' : `${catalog.withoutCutoffs.length} courses`} with a performance or practical test as well as CUET, and published no cutoff list for them in 2026:`)}
                </p>
                <ul className="dc-plain">
                  {catalog.withoutCutoffs.map((name) => <li key={name}>{name}</li>)}
                </ul>
              </section>
            ) : null}

            <CutoffSources />
          </div>

          <CutoffClose calculatorHref={calc} calculatorLabel="Check your subjects" />
        </article>
      </main>
      <MarketingFooter />
      <PublicDock note={DOCK_NOTE} />
    </div>
  );
}
