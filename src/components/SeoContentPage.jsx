import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { JsonLd } from '@/components/JsonLd';
import { DemoDrill } from '@/components/landing/DemoDrill';
import { breadcrumbJsonLd, courseJsonLd, faqJsonLd } from '@/lib/seo';
import '@/app/public-polish.css';

// Read-mode surface inside a Persuade site: comprehension and wayfinding come
// first, and the conversion rail sits at the end of the article rather than
// interrupting it. `page.eyebrow` is deliberately not rendered.
//
// `page.sample` puts the live 5-question sample above the article (web IA plan 2.4 and IA8). It is the
// landing's own DemoDrill, imported and not edited: it keeps the answers in this browser and offers
// "Save this and start free" at the end, so a reader can try the product before reading about it.
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

      <main id="main-content">
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
            {page.sample ? (
              <section className="seo-sample" id="try" aria-label="5 sample questions">
                <p className="seo-sample__head">5 sample questions, no sign-up</p>
                <div className="seo-sample__card">
                  <DemoDrill />
                </div>
                <p className="seo-sample__note">Original practice questions. They show how a session feels, not a subject diagnosis or a past paper.</p>
              </section>
            ) : null}

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
                Create a free account and sit a timed mock on this syllabus tonight. No card needed.
              </p>
              <div className="mm-actions" style={{ marginTop: '1.75rem' }}>
                <Link href="/signup" className="mm-btn mm-btn--primary">
                  Start free
                </Link>
                <Link href="/pricing" className="mm-btn mm-btn--secondary">
                  See pricing
                </Link>
              </div>
            </div>
          </aside>
        </article>
      </main>

      <MarketingFooter />
      <MobileDock note="Practise this syllabus tonight." href={page.sample ? '#try' : undefined} />
    </div>
  );
}
