import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { PublicDock } from '@/components/PublicDock';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { keepTogether } from '@/lib/keepTogether.mjs';
import { duCutoffCatalog, findCollege } from '@/lib/du/cutoffData.server';
import { CUTOFFS_PATH, PAIRS_COURSE, calculatorHref, collegeMeta, collegePath, collegeSections, plural } from '@/lib/du/cutoffPages.mjs';
import { CutoffTable } from '../../_parts/CutoffTable';
import { CutoffClose, CutoffSources, DOCK_NOTE, RoundNote, YearNote } from '../../_parts/CutoffParts';
import '../../du-cutoffs.css';

// One college's 2026 DU cutoffs for every course it offers (67 pages, one per college in DU's lists). Static.
export const dynamicParams = false;

export function generateStaticParams() {
  return duCutoffCatalog().colleges.map((college) => ({ college: college.slug }));
}

export async function generateMetadata({ params }) {
  const { college: slug } = await params;
  const college = findCollege(slug);
  if (!college) return {};
  const meta = collegeMeta(college);
  return seoMetadata({ title: meta.title, description: meta.description, path: collegePath(college.slug) });
}

export default async function DuCollegeCutoffPage({ params }) {
  const { college: slug } = await params;
  const college = findCollege(slug);
  if (!college) notFound();

  const sections = collegeSections(college).map((section) => ({
    ...section,
    // A few subject pairs read open; a long list waits behind its heading so the courses above stay in reach.
    open: section.key === PAIRS_COURSE ? section.rows.length <= 6 : false,
    linkLabel: section.key === PAIRS_COURSE ? 'B.A. (Programme) at every college' : null,
  }));
  const pairs = college.rows.filter((r) => r.pair).length;
  const courses = college.courseCount;
  const calc = calculatorHref(null);

  return (
    <div className="mm">
      <JsonLd
        id={`du-cutoffs-${college.slug}-breadcrumb-json-ld`}
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'DU cutoffs', path: CUTOFFS_PATH },
          { name: college.title, path: collegePath(college.slug) },
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
                <Link href={`${CUTOFFS_PATH}#colleges`}>DU cutoffs</Link>
                <span aria-hidden="true">/</span>
                <span>{college.title}</span>
              </nav>
              <h1 className="mm-h1 mm-article__title dc-title">{college.title} cutoffs 2026</h1>
              <p className="mm-article__intro">
                {keepTogether(`The lowest CUET score that got a seat in each of ${college.title}’s ${plural(courses, 'DU course')}, in each of DU’s three 2026 rounds, for every category.`)}
                {pairs ? ` B.A. (Programme) is listed by pair of subjects: ${plural(pairs, 'pair')} here.` : ''}
              </p>
              {college.women ? <p className="dc-range">A college for women: DU marks it (W) in its lists.</p> : null}
              <YearNote />
              <div className="mm-article__go dc-go">
                <Link href={calc} className="mm-btn mm-btn--secondary">Find courses for your subjects</Link>
              </div>
            </div>
          </header>

          <div className="mm-wrap mm-wrap--tight mm-article dc-body">
            <section className="mm-article__section" aria-labelledby="dc-table-title">
              <h2 className="mm-h2" id="dc-table-title">Cutoffs by course</h2>
              <CutoffTable sections={sections} subject={college.title} firstColumn="Course" />
              <RoundNote />
            </section>

            <CutoffSources />

            <nav className="mm-article__section dc-others" aria-labelledby="dc-others-title">
              <h2 className="mm-h2" id="dc-others-title">Other colleges</h2>
              <p>
                {keepTogether('Open a course above to compare every college that offers it, or pick another college from the full list.')}
              </p>
              <p><Link href={`${CUTOFFS_PATH}#colleges`} className="mm-link">All {duCutoffCatalog().colleges.length} colleges</Link></p>
            </nav>
          </div>

          <CutoffClose calculatorHref={calc} calculatorLabel="Check your subjects" />
        </article>
      </main>
      <MarketingFooter />
      <PublicDock note={DOCK_NOTE} />
    </div>
  );
}
