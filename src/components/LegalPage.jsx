import React from 'react';
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { PublicHero, PageToc, uniqueSlugs } from '@/components/PublicPage';

// One layout for the policies (web redesign W2.2): privacy, terms and refunds used to repeat the
// same markup and the same inline style block. The wording of each policy stays in its own page;
// this only lays it out. A contents list on desktop, the date under the title, a link to the other
// two policies at the end, and a plain print version.
//
//   sections   [{ heading, body: [paragraph, ...] }]  where a paragraph is text or a React node
//   updated    the date shown ("12 October 2026"); updatedIso is the same date as 2026-10-12

const POLICIES = [
  { id: 'privacy', label: 'Privacy policy', href: '/privacy' },
  { id: 'terms', label: 'Terms of service', href: '/terms' },
  { id: 'refunds', label: 'Refund policy', href: '/refunds' },
];

export function LegalPage({ current, title, updated, updatedIso, sections }) {
  const ids = uniqueSlugs(sections.map((section) => section.heading));
  const items = sections.map((section, index) => ({ id: ids[index], label: section.heading, section }));
  return (
    <div className="mm pp-legal-page">
      <NavBar />
      <main id="main-content">
        <PublicHero
          tone="read"
          title={title}
          meta={updated ? <>Last updated <time dateTime={updatedIso}>{updated}</time></> : null}
        />
        <div className="mm-wrap">
          <div className="pp-legal">
            <PageToc items={items} label="In this policy" />
            <div className="pp-legal__copy">
              {items.map(({ id, section }) => (
                <section key={id} id={id} className="pp-legal__section" aria-labelledby={`${id}-heading`}>
                  <h2 id={`${id}-heading`}>{section.heading}</h2>
                  {section.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                </section>
              ))}
              <nav className="pp-legal__more" aria-label="Policies">
                <p className="pp-small">Questions about a policy? Email <a className="pp-link" href="mailto:support@mockmob.in">support@mockmob.in</a> from your account email. The other policies:</p>
                <div className="pp-links" style={{ marginTop: 0 }}>
                  {POLICIES.filter((policy) => policy.id !== current).map((policy) => (
                    <Link key={policy.id} href={policy.href} className="pp-pill">{policy.label}</Link>
                  ))}
                </div>
              </nav>
            </div>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
