import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { JsonLd } from '@/components/JsonLd';
import { Icon } from '@/components/ui/Icons';
import { breadcrumbJsonLd, courseJsonLd, faqJsonLd } from '@/lib/seo';

// Read-mode surface inside a Persuade site: comprehension and wayfinding come
// first, and the conversion rail sits at the end of the article rather than
// interrupting it. `page.eyebrow` is deliberately not rendered.
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
          <header className="mm-article__head">
            <div className="mm-wrap mm-wrap--tight">
              <nav className="mm-crumbs" aria-label="Breadcrumb">
                <Link href="/">Home</Link>
                <span aria-hidden="true">/</span>
                <span>{page.breadcrumb}</span>
              </nav>
              <h1 className="mm-h1 mm-article__title">{page.h1}</h1>
              <p className="mm-article__intro">{page.intro}</p>
            </div>
          </header>

          <div className="mm-wrap mm-wrap--tight mm-article">
            {page.sections.map((section) => (
              <section key={section.heading} className="mm-article__section">
                <h2 className="mm-h2">{section.heading}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}

                {section.chips ? (
                  <ul className="mm-article__chips">
                    {section.chips.map((chip) => (
                      <li key={chip}>{chip}</li>
                    ))}
                  </ul>
                ) : null}

                {section.links ? (
                  <div className="mm-article__links">
                    {section.links.map((link) => (
                      <Link key={link.href} href={link.href} className="mm-chip">
                        {link.label}
                        <Icon
                          name="arrow"
                          style={{ width: '14px', height: '14px' }}
                          aria-hidden="true"
                        />
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
                    <summary>{faq.question}</summary>
                    <div className="mm-faq__body">{faq.answer}</div>
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
                  Start a free mock
                  <Icon name="arrow" className="mm-btn__icon" aria-hidden="true" />
                </Link>
                <Link href="/pricing" className="mm-btn mm-btn--secondary">
                  See what Pro unlocks
                </Link>
              </div>
            </div>
          </aside>
        </article>
      </main>

      <MarketingFooter />
      <MobileDock note="Practise this syllabus tonight." />
    </div>
  );
}
