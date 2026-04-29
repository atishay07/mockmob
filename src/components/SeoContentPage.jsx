import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, courseJsonLd, faqJsonLd } from '@/lib/seo';

export function SeoContentPage({ page }) {
  return (
    <div className="view min-h-screen">
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

      <main className="seo-page px-5 pb-20 pt-32">
        <article className="container-narrow">
          <nav className="mb-8 text-sm text-zinc-500" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-volt">Home</Link>
            <span className="mx-2">/</span>
            <span className="text-zinc-300">{page.breadcrumb}</span>
          </nav>

          <header className="mb-12">
            <div className="eyebrow mb-3">{page.eyebrow}</div>
            <h1 className="display-lg mb-5">{page.h1}</h1>
            <p className="text-lg leading-relaxed text-zinc-400">{page.intro}</p>
          </header>

          <div className="seo-copy">
            {page.sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.links ? (
                  <div className="seo-link-row">
                    {section.links.map((link) => (
                      <Link key={link.href} href={link.href}>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </section>
            ))}

            <section>
              <h2>Frequently Asked Questions</h2>
              <div className="seo-faq-list">
                {page.faqs.map((faq) => (
                  <details key={faq.question} className="glass p-5 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="cursor-pointer list-none font-display text-lg font-bold text-white">
                      {faq.question}
                    </summary>
                    <p>{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          </div>
        </article>
      </main>

      <MarketingFooter />
    </div>
  );
}
