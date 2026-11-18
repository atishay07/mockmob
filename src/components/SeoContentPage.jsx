import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import '@/components/subject/subject-page.css'; // the paper facts card (.sj-slip), the same card the subject pages draw
import '@/components/brand/mobi-figure.css'; // the colours of the try band's Mobi still
import './seo-guide.css';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { PublicDock } from '@/components/PublicDock';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, courseJsonLd, faqJsonLd } from '@/lib/seo';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { keepTogether } from '@/lib/keepTogether.mjs';
import { Marked } from '@/components/doodle/Doodle';
import { GUIDE_MARKS } from '@/lib/publicMarks.mjs';
import { PAPER, bankLine } from '@/lib/subjectPages.mjs';
import { practiceBankSize } from '@/lib/practiceBank.mjs';
import { publicInventory } from '@/lib/server/inventory';
import { GUIDE_FAQ_HEADING, TRY_AFTER, TRY_HREF, guideSections } from '@/lib/guideSections.mjs';
import { TRY_HEAD } from '@/components/landing/homeCopy.mjs';
import { DESK_NOTE } from '@/components/landing/heroTaps.mjs';
import { SAMPLE } from '@/components/landing/demoSignal.mjs';
import { MobiPoster } from '@/components/landing/MobiPoster';

// Read-mode surface inside a Persuade site. Since lane pub-d (19 Nov 2026) the guide is an article you can scan, with the
// product in it: the paper's facts and the live bank under the one volt key, "On this page" (a chip per section heading,
// each an in-page link), numbered sections with the first paragraph at full ink, link rows, and after the second section one
// band that offers the home page's five sample questions. Every word of the guide is the page's own (src/lib/seoPages.js,
// src/app/cuet-2027/page.js) and every paragraph stays visible text: nothing is folded. `page.eyebrow` is deliberately not
// rendered. Every drawn string goes through keepTogether, so "CUET 2027" or "CUET UG 2026" never parts at a line end
// (night 1105); the JSON-LD keeps plain spaces.

const DAY = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

/**
 * The live bank for the facts card: the questions a student can practise from (summed over the subjects Practice offers, the
 * stored daily count, never a bank read) and the day it was counted. null when unknown: no line is drawn then, never a 0.
 */
export function guideBank(inventory) {
  const questions = practiceBankSize(inventory);
  if (!questions) return null;
  const at = Date.parse(inventory.checkedAt);
  return { questions, countedOn: Number.isFinite(at) ? DAY.format(new Date(at)) : null };
}

export async function SeoContentPage({ page }) {
  const inventory = await publicInventory().catch(() => null);
  return <GuidePage page={page} bank={guideBank(inventory)} />;
}

/** The whole guide, drawn from the page's data and the bank (or null). Synchronous, so a test can render it. */
export function GuidePage({ page, bank = null }) {
  // The pen on this guide (src/lib/publicMarks.mjs), by the page's slug.
  const marks = GUIDE_MARKS[page.slug];
  const toc = guideSections(page);
  const faqToc = toc[toc.length - 1];
  const bankSentence = bankLine(bank, 'CUET');
  return (
    <div className="mm">
      <JsonLd
        id={`${page.slug}-breadcrumb-json-ld`}
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: page.h1, path: page.path },
        ])}
      />
      <JsonLd id={`${page.slug}-faq-json-ld`} data={faqJsonLd(page.faqs)} />
      <JsonLd
        id={`${page.slug}-course-json-ld`}
        data={courseJsonLd({
          name: page.h1,
          description: page.description,
          path: page.path,
        })}
      />
      <NavBar />

      <main>
        <article className="gd">
          <header className={`mm-article__head${page.subjectArt ? ' mm-article__head--object' : ''} gd-head`}>
            <div className="mm-wrap mm-wrap--tight">
              <nav className="mm-crumbs" aria-label="Breadcrumb">
                <Link href="/">Home</Link>
                <span aria-hidden="true">/</span>
                <span>{keepTogether(page.breadcrumb)}</span>
              </nav>
              <h1 className="mm-h1 mm-article__title">{marks?.head ? <Marked text={keepTogether(page.h1)} marks={[marks.head]} /> : keepTogether(page.h1)}</h1>
              <p className="mm-article__intro">{keepTogether(page.intro)}</p>
              {/* The page's one action, before the essay, in the phone bar's words (R8 PUB-08: one label for sign-up on the page, "Sign up free"). */}
              <p className="mm-article__go"><Link href="/signup" className="mm-btn mm-btn--primary">Sign up free</Link></p>
              {/* A subject guide carries its paper's lamp-lit object, the same one the landing shelf links from. */}
              {page.subjectArt ? <SubjectObject id={page.subjectArt} size={168} lit priority className="mm-article__object" /> : null}
            </div>
          </header>

          <div className="mm-wrap mm-wrap--tight">
            {/* The paper, as the subject pages show it (src/lib/subjectPages.mjs PAPER): the latest cycle's rules, said as
                such, because /cuet-2027 says the 2027 rules are not out yet. The bank line is today's stored count or nothing. */}
            <section className="sj-slip gd-facts" aria-label="The CUET UG paper">
              <p className="sj-slip__head"><span>{keepTogether('CUET UG 2026, every subject paper')}</span></p>
              <dl className="sj-slip__facts">
                <div><dt>Questions</dt><dd className="mm-measure">{PAPER.questions}</dd></div>
                <div><dt>Minutes</dt><dd className="mm-measure">{PAPER.minutes}</dd></div>
                <div><dt>Right answer</dt><dd className="mm-measure">+{PAPER.right}</dd></div>
                <div><dt>Wrong answer</dt><dd className="mm-measure">{String(PAPER.wrong).replace('-', '−')}</dd></div>
              </dl>
              <p className="sj-slip__foot">
                All {PAPER.questions} are compulsory, a blank scores {PAPER.blank}, and the paper is out of {PAPER.questions * PAPER.right}.
                {bankSentence ? <> <span className="sj-slip__bank">{bankSentence}</span></> : null}
              </p>
            </section>

            {/* On this page: one chip per section heading, in order, each an in-page link. No script. Its label is not a
                heading, so the page's heading outline stays the guide's own. */}
            <nav className="gd-toc" aria-labelledby="gd-toc-title">
              <p className="gd-toc__title" id="gd-toc-title">On this page</p>
              <ol className="gd-toc__list">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a className="gd-toc__chip" href={`#${item.id}`} title={item.heading}>
                      {item.number ? <span className="gd-toc__n" aria-hidden="true">{item.number}</span> : null}
                      <span className="gd-toc__label">{keepTogether(item.heading)}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>

          <div className="mm-wrap mm-wrap--tight mm-article gd-body">
            {page.sections.map((section, i) => (
              <GuideSection key={section.heading} section={section} id={toc[i].id} number={toc[i].number} tryAfter={i + 1 === TRY_AFTER} />
            ))}

            <section className="mm-article__section gd-sec gd-sec--faq" id={faqToc.id} aria-labelledby={`${faqToc.id}-title`}>
              <div className="gd-sec__head">
                <h2 className="mm-h2" id={`${faqToc.id}-title`}>{GUIDE_FAQ_HEADING}</h2>
              </div>
              <div className="mm-faqs">
                {page.faqs.map((faq) => (
                  <details key={faq.question} className="mm-faq">
                    <summary>{keepTogether(faq.question)}</summary>
                    <div className="mm-faq__body">{keepTogether(faq.answer)}</div>
                  </details>
                ))}
              </div>
            </section>
          </div>

          <aside className="mm-close">
            <div className="mm-wrap mm-wrap--tight">
              <h2 className="mm-h2">{marks?.close ? <Marked text="Reading about it is not practice." marks={[marks.close]} /> : 'Reading about it is not practice.'}</h2>
              <p className="mm-body">
                Create a free account and sit a timed mock on this syllabus tonight. No card, and
                the 5 sample questions on the home page need no sign-up at all.
              </p>
              <div className="mm-actions" style={{ marginTop: '1.75rem' }}>
                <Link href="/signup" className="mm-btn mm-btn--primary">
                  Sign up free
                </Link>
                <Link href="/pricing" className="mm-btn mm-btn--secondary" data-commerce="">
                  See what Pro adds
                </Link>
              </div>
            </div>
          </aside>
        </article>
      </main>

      <MarketingFooter />
      <PublicDock />
    </div>
  );
}

/** One numbered section: the numeral beside the heading, a hairline above, the paragraphs (first at full ink), then its
 *  chips and its links as rows. `tryAfter` draws the try band after it. */
function GuideSection({ section, id, number, tryAfter }) {
  return (
    <>
      <section className="mm-article__section gd-sec" id={id} aria-labelledby={`${id}-title`}>
        <div className="gd-sec__head">
          <span className="gd-sec__n" aria-hidden="true">{number}</span>
          <h2 className="mm-h2" id={`${id}-title`}>{keepTogether(section.heading)}</h2>
        </div>
        {section.body.map((paragraph) => (
          <p key={paragraph}>{keepTogether(paragraph)}</p>
        ))}

        {section.chips ? (
          <ul className="mm-article__chips">
            {section.chips.map((chip) => (
              <li key={chip}>{keepTogether(chip)}</li>
            ))}
          </ul>
        ) : null}

        {section.links ? (
          <ul className="gd-links">
            {section.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="gd-link" data-commerce={link.href.startsWith('/pricing') ? '' : undefined}>
                  <span>{keepTogether(link.label)}</span>
                  <ChevronRight className="gd-link__chev" size={20} strokeWidth={2} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      {tryAfter ? <TryBand /> : null}
    </>
  );
}

/** The one try band, the same on every guide: the home page's sample Mobi, its words, and an outlined key to the five. */
function TryBand() {
  return (
    <aside className="gd-try" aria-labelledby="gd-try-title">
      <span className="mobi-react gd-try__mobi" aria-hidden="true">
        <MobiPoster id="guide" />
      </span>
      <div className="gd-try__words">
        {/* Not a heading: the guide's outline (its h2s, in order) is unchanged. */}
        <p className="gd-try__title" id="gd-try-title">{TRY_HEAD.h2}</p>
        <p className="gd-try__sub">{DESK_NOTE}</p>
      </div>
      <Link href={TRY_HREF} className="mm-btn mm-btn--secondary gd-try__key">{SAMPLE.label}</Link>
    </aside>
  );
}
