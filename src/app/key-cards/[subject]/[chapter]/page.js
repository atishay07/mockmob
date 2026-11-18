import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import PublicDeck from '@/components/keycards/public/PublicDeck';
import { DECK_WORDS, freeCount, freeLine } from '@/components/keycards/public/publicDeckCopy.mjs';
import { signupPathFor } from '@/lib/auth-redirect';
import { keepTogether } from '@/lib/keepTogether.mjs';
import { KEY_CARDS_PATH, chapterDescription, chapterTitle, subjectAnchor } from '@/lib/keycardsPublic.mjs';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { publicKeyCards } from '@/lib/server/keycardsPublic';
import '@/components/keycards/public/public-page.css';
import { Marked } from '@/components/doodle/Doodle';
import { PUBLIC_MARKS } from '@/lib/publicMarks.mjs';

// One chapter's free Key cards (src/lib/keycardsPublic.mjs: exactly a Free account's taste of the chapter, whole; the rest only
// as kinds counted). Static: every chapter with a free card is built at deploy (generateStaticParams) and rebuilt at most hourly
// (Next 16.2.4, the previous caching model: node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md;
// cacheComponents is off). A visit never reads the database; a rebuild reads it once (src/lib/server/keycardsPublicLoad.js).
// An address that is not a public chapter is a real 404 (dynamicParams false).
export const revalidate = 3600;
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await publicKeyCards()).params();
}

async function chapterFor(params) {
  const { subject, chapter } = await params;
  return (await publicKeyCards()).find(subject, chapter);
}

export async function generateMetadata({ params }) {
  const deck = await chapterFor(params);
  if (!deck) return {};
  return seoMetadata({ title: chapterTitle(deck), description: chapterDescription(deck), path: deck.path });
}

export default async function KeyCardsChapterPage({ params }) {
  const deck = await chapterFor(params);
  if (!deck) notFound();
  const model = await publicKeyCards();
  const subject = model.subjects.find((s) => s.slug === deck.subject.slug);
  const others = (subject?.chapters || []).filter((c) => c.key !== deck.key);
  const n = deck.open.length;

  return (
    <div className="mm">
      <JsonLd
        id={`key-cards-${deck.subject.slug}-${deck.slug}-breadcrumb-json-ld`}
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Key cards', path: KEY_CARDS_PATH },
          { name: `${deck.subject.name}: ${deck.title}`, path: deck.path },
        ])}
      />
      <NavBar />
      <main id="main-content">
        <article className="kcp-page">
          {/* Phones: the head, then the deck. From 1080 px: the head on the left, the deck beside it, so the card and its key
              are on screen at once on a 768 px tall laptop too. */}
          <div className="mm-wrap kcp-stage">
            <header className="kcp-head">
              <nav className="mm-crumbs" aria-label="Breadcrumb">
                <Link href="/">Home</Link>
                <span aria-hidden="true">/</span>
                <Link href={KEY_CARDS_PATH}>Key cards</Link>
                <span aria-hidden="true">/</span>
                <Link href={subjectAnchor(deck.subject.slug)}>{deck.subject.name}</Link>
              </nav>
              <h1 className="mm-h1 mm-article__title">{deck.title}</h1>
              <p className="mm-article__intro"><Marked text={keepTogether(freeLine(n, deck.total, deck.subject.name))} marks={[PUBLIC_MARKS.keyCardsChapter.head]} /></p>
              <p className="kcp-cue">{DECK_WORDS.cue}</p>
            </header>
            <PublicDeck
              cards={deck.open}
              title={deck.title}
              total={deck.total}
              locked={deck.locked}
              lockedCount={deck.lockedCount}
              signupHref={signupPathFor(deck.appPath)}
              appHref={deck.appPath}
            />
          </div>

          {others.length ? (
            <nav className="mm-wrap kcp-more" aria-labelledby="kcp-more-title">
              <h2 className="mm-h2" id="kcp-more-title">More {deck.subject.name} chapters</h2>
              <ul className="kcp-list">
                {others.map((c) => (
                  <li key={c.key}>
                    <Link href={c.path} className="kcp-list__link">
                      <span className="kcp-list__name">{c.title}</span>
                      <span className="kcp-list__meta">{freeCount(c.open.length, c.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="kcp-more__all"><Link href={KEY_CARDS_PATH} className="mm-link">Key cards for every subject</Link></p>
            </nav>
          ) : <div className="kcp-more" />}
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
