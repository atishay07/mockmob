import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { JsonLd } from '@/components/JsonLd';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { absoluteUrl, breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { SUBJECT_HUBS } from '@/lib/subjectHubs';
import { FIRST_FULL_FREE, STREAMS, fmt, paperCode, subjectBank, syllabusUnits } from '@/lib/subjectPages.mjs';
import { publicInventory } from '@/lib/server/inventory';
import { SUBJECT_CLAIM } from '@/../data/subject_claim.js';
import '@/components/subject/subject-page.css';

// The CUET subjects index: every subject page in one list, grouped the way students choose, with each subject's
// NTA paper code and the live bank's count (the stored daily row; left out when unknown). Same caching as the subject pages.
export const revalidate = 3600;

const TITLE = 'CUET UG 2027 Subjects: Syllabus, Mock Tests and Practice | MockMob';
const DESCRIPTION = `${SUBJECT_CLAIM.meta}. Syllabus, paper pattern and fresh full mocks for each subject${FIRST_FULL_FREE ? ', with your first mock in every subject free' : ''}.`;

export const metadata = seoMetadata({ title: TITLE, description: DESCRIPTION, path: '/cuet' });

export default async function CuetSubjectsPage() {
  const inventory = await publicInventory().catch(() => null);
  const rows = SUBJECT_HUBS.map((hub) => {
    const units = syllabusUnits(hub.id);
    return { hub, code: paperCode(hub), bank: subjectBank(inventory, hub.id, units) };
  });
  const countedOn = rows.find((row) => row.bank?.countedOn)?.bank.countedOn;

  return (
    <div className="mm">
      <JsonLd id="cuet-breadcrumb-json-ld" data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'CUET subjects', path: '/cuet' }])} />
      <JsonLd
        id="cuet-subjects-json-ld"
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'CUET UG subjects on MockMob',
          itemListElement: SUBJECT_HUBS.map((hub, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: `CUET ${hub.name}`,
            url: absoluteUrl(`/cuet/${hub.slug}`),
          })),
        }}
      />
      <NavBar />
      <main>
        <article>
          <header className="mm-article__head">
            <div className="mm-wrap mm-wrap--tight">
              <nav className="mm-crumbs" aria-label="Breadcrumb">
                <Link href="/">Home</Link>
                <span aria-hidden="true">/</span>
                <span>CUET subjects</span>
              </nav>
              <h1 className="mm-h1 mm-article__title">Every CUET subject you are likely to sit</h1>
              <p className="mm-article__intro">
                {SUBJECT_CLAIM.withSource}. Pick a subject for its syllabus, how the paper is marked and where its marks are won, then sit a full mock built fresh from the live bank.
              </p>
            </div>
          </header>
          <div className="mm-wrap mm-wrap--tight mm-article">
            {STREAMS.map((stream) => {
              const list = rows.filter((row) => row.hub.stream === stream);
              if (!list.length) return null;
              return (
                <section key={stream} className="mm-article__section" aria-labelledby={`stream-${stream}`}>
                  <h2 className="mm-h2" id={`stream-${stream}`}>{stream}</h2>
                  <ul className="sj-index">
                    {list.map(({ hub, code, bank }) => (
                      <li key={hub.slug} className="sj-index__row">
                        <Link href={`/cuet/${hub.slug}`} className="sj-index__link">
                          <SubjectObject id={hub.slug.replace(/-/g, '_')} size={56} />
                          <span>
                            <span className="sj-index__name">CUET {hub.name}</span>
                            {code ? <span className="sj-index__meta">Paper {code}</span> : null}
                          </span>
                          <span className="sj-index__count">{bank && bank.questions > 0 ? `${fmt(bank.questions)} questions` : ''}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            {countedOn ? <p className="mm-small" style={{ marginTop: '2rem' }}>Question counts from the live bank, counted {countedOn} and refreshed every day.</p> : null}
          </div>
        </article>
      </main>
      <MarketingFooter />
      <MobileDock note={FIRST_FULL_FREE ? 'Your first mock in each subject is free.' : 'Practise tonight.'} />
    </div>
  );
}
