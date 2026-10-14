import React from 'react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { JsonLd } from '@/components/JsonLd';
import { Icon } from '@/components/ui/Icons';
import { Surface } from '@/components/ui/Card';
import { PublicHero, HeroActions, PageClose } from '@/components/PublicPage';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'CUET Practice Features, Analytics & Admission Compass | MockMob',
  description: 'Explore MockMob features for CUET mock tests, weakness radar, saved questions, leaderboards, and admission guidance.',
  path: '/features',
});

// Plain name first, the brand name beside it (owner decision D10). Every feature stays listed.
const FEATURES = [
  { name: 'CUET question practice', icon: 'users', body: 'Explore available CUET-style practice, review explanations, and save questions that deserve another look.' },
  { name: 'Weak chapters', by: 'Radar', icon: 'radar', body: 'Review attempts by subject and chapter, with deeper practice signals available where your history supports them.' },
  { name: 'Leaderboard', icon: 'trend', body: 'Turn practice into pressure. Climb ranks as you solve, submit, and compete in focused mock sprints.' },
  { name: 'Saved questions', icon: 'book', body: 'Bookmark tough questions from Explore and build your personal revision stack for repeat practice.' },
  { name: 'Exam tracks', icon: 'route', body: 'CUET-first pathways with subject, unit, chapter, and difficulty controls shaped around actual student workflows.' },
  { name: 'Study plan', by: 'PrepOS', icon: 'spark', body: 'See a shared next step based on available practice history. Core planning does not depend on a paid model reply.' },
  { name: 'DU Compass', by: 'Admission Compass', icon: 'target', body: 'Check programme eligibility and compare sourced DU historical cutoffs by year, round, and category. Free for everyone.' },
  { name: 'Pro access', icon: 'zap', body: 'Unlock available practice modes, the difficulty selector, and deeper weak-chapter details. Access depends on the current offer.' },
];

const LOOP = [
  ['Practise', 'Timed mocks, focused drills, and question review'],
  ['Review', 'Saved questions and practice history by chapter'],
  ['Plan', 'A next step grounded in available study history'],
];

const COMPASS_ROWS = [
  ['Eligibility', 'Programme-specific subjects', 'Official bulletin'],
  ['Cutoffs', 'Category and round', 'Published history'],
  ['2027', 'Rules pending publication', 'Provisional'],
];

export default function FeaturesPage() {
  return (
    <div className="mm">
      <JsonLd
        id="features-breadcrumb-json-ld"
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Features', path: '/features' },
        ])}
      />
      <NavBar />

      <main id="main-content">
        <PublicHero
          enter
          title="Every feature should make your next step clearer."
          lead="MockMob is not a notes app. It is a CUET practice engine: find the right questions, save the painful ones, see your next move, and come back sharper."
        >
          <HeroActions />
        </PublicHero>

        <section className="pp-section" style={{ paddingTop: 0 }} aria-label="How the pieces fit">
          <div className="mm-wrap">
            <ul className="pp-steps">
              {LOOP.map(([title, body]) => (
                <li key={title} className="pp-step">
                  <h2 className="pp-h3">{title}</h2>
                  <p>{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="pp-section pp-section--sunken" aria-labelledby="features-all">
          <div className="mm-wrap">
            <h2 id="features-all" className="pp-h2" style={{ marginBottom: 'clamp(1.5rem, 4vw, 2.5rem)' }}>Everything in one place.</h2>
            <ul className="pp-features">
              {FEATURES.map((feature) => (
                <li key={feature.name} className="pp-feature">
                  <span className="pp-feature__icon" aria-hidden="true"><Icon name={feature.icon} /></span>
                  <h3>
                    {feature.name}
                    {feature.by ? <span className="pp-feature__by"> ({feature.by})</span> : null}
                  </h3>
                  <p>{feature.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="pp-section" aria-labelledby="features-plan">
          <div className="mm-wrap">
            <div className="pp-split">
              <div className="pp-split__head">
                <h2 id="features-plan" className="pp-h2">The study plan ties the rest together.</h2>
                <p className="pp-body">
                  Weak chapters find the weakness. Saved questions hold the evidence. DU Compass shows the DU path. The study plan (PrepOS) turns all of it into a simple instruction: what to solve next, why it matters, and when to check again.
                </p>
                <ul className="pp-tags" style={{ marginTop: 0 }}>
                  {['Set daily mission', 'Replay weakest trap', 'Replan after mock'].map((step) => (
                    <li key={step} className="ui-tag">{step}</li>
                  ))}
                </ul>
              </div>

              <Surface level="raised" className="pp-demo" aria-labelledby="features-compass">
                <div className="pp-demo__top">
                  <h3 id="features-compass" className="pp-demo__title">DU<span>historical reference</span></h3>
                  <span className="ui-tag">What it covers</span>
                </div>
                <ul className="pp-demo__rows">
                  {COMPASS_ROWS.map(([name, detail, status]) => (
                    <li key={name}>
                      <div>
                        <b>{name}</b>
                        <span>{detail}</span>
                      </div>
                      <em>{status}</em>
                    </li>
                  ))}
                </ul>
                <p className="pp-demo__caption">Use available mocks and weak chapters to understand your practice. The free DU calculator checks programme eligibility and historical cutoffs separately.</p>
              </Surface>
            </div>
          </div>
        </section>

        <PageClose
          title="Try it on your own questions."
          body="Create a free account and start building your question history today."
          memberTitle="Keep building your record."
          memberBody="Every set you sit adds to your weak chapters and your next step."
        />
      </main>

      <MarketingFooter />
      <MobileDock note="Free to start. No card." />
    </div>
  );
}
