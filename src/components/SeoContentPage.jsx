import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { JsonLd } from '@/components/JsonLd';
import { PublicHero, PageToc, PageClose, slugify } from '@/components/PublicPage';
import { breadcrumbJsonLd, courseJsonLd, faqJsonLd } from '@/lib/seo';

// The read-mode page for the CUET guides and subject hubs (web redesign W2.2). Comprehension and
// wayfinding come first: a contents list beside the text on desktop, a measure of about 66
// characters, and the closing panel at the end of the article rather than in the middle of it.
// The closing panel is member-aware (a signed-in student sees Continue practice, not Start free);
// the guest HTML is unchanged for crawlers. `page.eyebrow` is deliberately not rendered.
export function SeoContentPage({ page }) {
  const faqId = 'frequently-asked-questions';
  const toc = [
    ...page.sections.map((section) => ({ id: slugify(section.heading), label: section.heading })),
    { id: faqId, label: 'Frequently asked questions' },
  ];

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
          <PublicHero
            tone="read"
            title={page.h1}
            lead={page.intro}
            crumbs={(
              <nav className="mm-crumbs" aria-label="Breadcrumb">
                <Link href="/">Home</Link>
                <span aria-hidden="true">/</span>
                <span>{page.breadcrumb}</span>
              </nav>
            )}
          />

          <div className="mm-wrap">
            <div className="pp-article">
              <PageToc items={toc} />

              <div className="pp-prose">
                {page.sections.map((section) => {
                  const id = slugify(section.heading);
                  return (
                    <section key={section.heading} id={id} className="pp-prose__section" aria-labelledby={`${id}-heading`}>
                      <h2 id={`${id}-heading`}>{section.heading}</h2>
                      {section.body.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}

                      {section.chips ? (
                        <ul className="pp-tags">
                          {section.chips.map((chip) => (
                            <li key={chip} className="ui-tag">{chip}</li>
                          ))}
                        </ul>
                      ) : null}

                      {section.links ? (
                        <div className="pp-links">
                          {section.links.map((link) => (
                            <Link key={link.href} href={link.href} className="pp-pill">
                              {link.label}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  );
                })}

                <section id={faqId} className="pp-prose__section" aria-labelledby={`${faqId}-heading`}>
                  <h2 id={`${faqId}-heading`}>Frequently asked questions</h2>
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
            </div>
          </div>

          <PageClose secondary={[{ href: '/pricing', label: 'See what Pro includes', hideForPro: true }]} />
        </article>
      </main>

      <MarketingFooter />
      <MobileDock note="Practise this syllabus tonight." />
    </div>
  );
}
