import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import { freeCount, indexFacts, subjectLine } from '@/components/keycards/public/publicDeckCopy.mjs';
import { signupPathFor } from '@/lib/auth-redirect';
import { KEY_CARDS_PATH } from '@/lib/keycardsPublic.mjs';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { publicKeyCards } from '@/lib/server/keycardsPublic';
import '@/components/keycards/public/public-page.css';

// Every subject's chapters with free Key cards, as links (src/lib/keycardsPublic.mjs). Static, rebuilt at most hourly, like the
// chapter pages; a visit never reads the database. Every number on it is counted from the decks the app serves.
export const revalidate = 3600;

export async function generateMetadata() {
  const { totals } = await publicKeyCards();
  return seoMetadata({
    title: 'CUET Key cards, chapter by chapter, free to read | MockMob',
    description: totals.cards
      ? `${indexFacts(totals)} Short recall cards for CUET: read the front, say the answer, turn the card over. No account needed.`
      : 'Short recall cards for CUET, chapter by chapter.',
    path: KEY_CARDS_PATH,
  });
}

export default async function KeyCardsIndexPage() {
  const model = await publicKeyCards();
  if (!model.subjects.length) notFound();

  return (
    <div className="mm">
      <JsonLd
        id="key-cards-breadcrumb-json-ld"
        data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Key cards', path: KEY_CARDS_PATH }])}
      />
      <NavBar />
      <main id="main-content">
        <article className="kcp-index">
          <header className="mm-article__head">
            <div className="mm-wrap mm-wrap--tight">
              <nav className="mm-crumbs" aria-label="Breadcrumb">
                <Link href="/">Home</Link>
                <span aria-hidden="true">/</span>
                <span>Key cards</span>
              </nav>
              <h1 className="mm-h1 mm-article__title">Key cards, chapter by chapter</h1>
              <p className="mm-article__intro">
                Short recall cards for CUET. Read the front, say the answer in your head, then turn the card over to check it. The
                first Must-know cards of each chapter below are free to read, with no account.
              </p>
              <p className="mm-article__intro kcp-facts">{indexFacts(model.totals)}</p>
              <ul className="kcp-jump" aria-label="Subjects">
                {model.subjects.map((s) => (
                  <li key={s.slug}><a href={`#${s.slug}`} className="mm-chip">{s.name}</a></li>
                ))}
              </ul>
            </div>
          </header>

          <div className="mm-wrap mm-wrap--tight mm-article">
            {model.subjects.map((s) => (
              <section key={s.slug} id={s.slug} className="kcp-subject" aria-labelledby={`kcp-${s.slug}`}>
                <h2 className="mm-h2" id={`kcp-${s.slug}`}>{s.name}</h2>
                <p className="kcp-subject__meta">{subjectLine(s)}</p>
                <ul className="kcp-list">
                  {s.chapters.map((c) => (
                    <li key={c.key}>
                      <Link href={c.path} className="kcp-list__link">
                        <span className="kcp-list__name">{c.title}</span>
                        <span className="kcp-list__meta">{freeCount(c.open.length, c.total)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <aside className="mm-close">
            <div className="mm-wrap mm-wrap--tight">
              <h2 className="mm-h2">Keep the cards you read.</h2>
              <p className="mm-body">
                With a free account you can add each chapter&apos;s free cards to Revise, and your rating sets when each card comes back.
                Pro opens every card in every chapter.
              </p>
              <div className="mm-actions" style={{ marginTop: '1.75rem' }}>
                <Link href={signupPathFor('/cards')} className="mm-btn mm-btn--primary">Sign up free</Link>
              </div>
            </div>
          </aside>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
