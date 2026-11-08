import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { PublicDock } from '@/components/PublicDock';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, courseJsonLd, faqJsonLd } from '@/lib/seo';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { keepTogether } from '@/lib/keepTogether.mjs';

// Read-mode surface inside a Persuade site: comprehension and wayfinding come
// first, and the conversion rail sits at the end of the article rather than
// interrupting it. `page.eyebrow` is deliberately not rendered. Every drawn string goes through keepTogether, so
// "CUET 2027" or "CUET UG 2026" never parts at a line end (night 1105); the JSON-LD keeps plain spaces.
export function SeoContentPage({ page }) {
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
        <article>
          <header className={`mm-article__head${page.subjectArt ? ' mm-article__head--object' : ''}`}>
            <div className="mm-wrap mm-wrap--tight">
              <nav className="mm-crumbs" aria-label="Breadcrumb">
                <Link href="/">Home</Link>
                <span aria-hidden="true">/</span>
                <span>{keepTogether(page.breadcrumb)}</span>
              </nav>
              <h1 className="mm-h1 mm-article__title">{keepTogether(page.h1)}</h1>
              <p className="mm-article__intro">{keepTogether(page.intro)}</p>
              {/* The page's one action, before the essay, in the phone bar's words (R8 PUB-08: one label for sign-up on the page, "Start free"). */}
              <p className="mm-article__go"><Link href="/signup" className="mm-btn mm-btn--primary">Start free</Link></p>
              {/* A subject guide carries its paper's lamp-lit object, the same one the landing shelf links from. */}
              {page.subjectArt ? <SubjectObject id={page.subjectArt} size={168} lit priority className="mm-article__object" /> : null}
            </div>
          </header>

          <div className="mm-wrap mm-wrap--tight mm-article">
            {page.sections.map((section) => (
              <section key={section.heading} className="mm-article__section">
                <h2 className="mm-h2">{keepTogether(section.heading)}</h2>
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
                  <div className="mm-article__links">
                    {section.links.map((link) => (
                      <Link key={link.href} href={link.href} className="mm-chip" data-commerce={link.href.startsWith('/pricing') ? '' : undefined}>
                        {keepTogether(link.label)}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </section>
            ))}

            <section className="mm-article__section">
              <h2 className="mm-h2">Frequently asked questions</h2>
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
              <h2 className="mm-h2">Reading about it is not practice.</h2>
              <p className="mm-body">
                Create a free account and sit a timed mock on this syllabus tonight. No card, and
                the first drill on the home page needs no signup at all.
              </p>
              <div className="mm-actions" style={{ marginTop: '1.75rem' }}>
                <Link href="/signup" className="mm-btn mm-btn--primary">
                  Start free
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
