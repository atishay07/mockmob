import Link from 'next/link';
import { MessageCircleQuestion, RefreshCw, ScanSearch, Users, Wrench } from 'lucide-react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { JsonLd } from '@/components/JsonLd';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { breadcrumbJsonLd, courseJsonLd, faqJsonLd } from '@/lib/seo';
import {
  FIRST_FULL_FREE, PAPER, STREAMS, bankLine, commonFaqs, fmt, freshLine, paperCode, primaryAction, syllabusChapterCount,
} from '@/lib/subjectPages.mjs';
import './subject-page.css';

// A public CUET subject page (/cuet/<slug>). Read-mode, like the other guides (SeoContentPage), but built around the
// paper itself: the paper's facts first, then what CUET asks (the 2026 syllabus with the live bank's counts per unit),
// then how MockMob turns practice into marks, then the questions students ask. One action: the free first mock.
// Every number comes from src/lib/subjectPages.mjs; an unknown count is left out, never shown as 0.
export function SubjectLandingPage({ hub, units, bank, others }) {
  const name = hub.name;
  const code = paperCode(hub);
  const chapterTotal = syllabusChapterCount(units);
  const faqs = [...hub.faqs, ...commonFaqs(hub, bank)];
  const path = `/cuet/${hub.slug}`;
  const action = primaryAction(name);
  const unitMax = bank?.units ? Math.max(1, ...bank.units.values()) : 1;
  const bankSentence = bankLine(bank, name);

  const helps = [
    {
      icon: RefreshCw,
      title: 'A fresh paper every time',
      body: freshLine(bank, name),
    },
    {
      icon: ScanSearch,
      title: 'See exactly where the marks went',
      body: `After every mock, the review shows the time you spent on each question, every answer you changed and the ${name} chapter behind each miss. Chapter review is free after every mock.`,
    },
    {
      icon: Wrench,
      title: 'Fix the mistake, then prove it',
      body: 'Mobi fixes a mistake for good: why your pick looked right, where it breaks and what to remember, written from the official key. Fresh questions on the same idea come back later to check the fix held. One credit a fix.',
    },
    {
      icon: MessageCircleQuestion,
      title: `Ask Mobi about any ${name} doubt`,
      body: 'Stuck on a concept? Ask Mobi. Your doubt is answered and tested on two real CUET questions, for one credit. Everything Mobi reads from your own record is free.',
    },
    {
      icon: Users,
      title: 'Sit a paper with your Mob',
      body: 'A Mob is up to five friends on the same ten questions each week, free of credits. When you have all sat it, compare how each of you picked.',
      href: '/mob',
      link: 'See how a Mob works',
    },
  ];

  const othersByStream = STREAMS.map((stream) => [stream, others.filter((other) => other.stream === stream)]).filter(([, list]) => list.length);

  return (
    <div className="mm">
      <JsonLd
        id={`cuet-${hub.slug}-breadcrumb-json-ld`}
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'CUET subjects', path: '/cuet' },
          { name: `CUET ${name}`, path },
        ])}
      />
      <JsonLd id={`cuet-${hub.slug}-faq-json-ld`} data={faqJsonLd(faqs)} />
      <JsonLd id={`cuet-${hub.slug}-course-json-ld`} data={courseJsonLd({ name: hub.h1, description: hub.description, path })} />
      <NavBar />

      <main>
        <article className="sj">
          <header className="mm-article__head mm-article__head--object sj-head">
            <div className="mm-wrap mm-wrap--tight">
              <nav className="mm-crumbs" aria-label="Breadcrumb">
                <Link href="/">Home</Link>
                <span aria-hidden="true">/</span>
                <Link href="/cuet">CUET subjects</Link>
                <span aria-hidden="true">/</span>
                <span>{name}</span>
              </nav>
              <h1 className="mm-h1 mm-article__title">{hub.h1}</h1>
              <p className="mm-article__intro">{hub.intro}</p>
              <div className="mm-article__go sj-go">
                <Link href="/signup" className="mm-btn mm-btn--primary">{action}</Link>
                <a href="#syllabus" className="sj-go__link">See the syllabus</a>
              </div>
              <SubjectObject id={hub.slug.replace(/-/g, '_')} size={168} lit priority className="mm-article__object" />
            </div>
          </header>

          {/* The paper, as the exam states it. The bank line is today's stored count or nothing. */}
          <div className="mm-wrap mm-wrap--tight">
            <section className="sj-slip" aria-label={`The CUET ${name} paper`}>
              <p className="sj-slip__head">
                <span>CUET UG {name}</span>
                {code ? <span className="sj-slip__code">Paper {code}</span> : null}
              </p>
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
          </div>

          <div className="mm-wrap mm-wrap--tight mm-article sj-body">
            <section className="mm-article__section" id="syllabus" aria-labelledby="syllabus-title">
              <h2 className="mm-h2" id="syllabus-title">What CUET asks in {hub.inName || name}</h2>
              <p>
                {units.length} unit{units.length === 1 ? '' : 's'} and {chapterTotal} chapters, from NTA’s CUET UG 2026 syllabus, the latest published.
                NTA has not released the 2027 list yet.
                {bank?.units ? ' With each unit: how many questions the live bank holds for it.' : ''}
              </p>
              <ol className="sj-units">
                {units.map((unit) => {
                  const count = bank?.units ? bank.units.get(unit.name) ?? 0 : null;
                  return (
                    <li key={unit.name} className="sj-unit">
                      <div className="sj-unit__main">
                        <h3 className="sj-unit__name">{unit.name}</h3>
                        {unit.chapters.length ? (
                          <p className="sj-unit__chapters">{unit.chapters.map((chapter) => chapter.name).join(', ')}</p>
                        ) : null}
                      </div>
                      {count !== null ? (
                        <div className="sj-unit__count">
                          <span className="mm-measure">{count > 0 ? `${fmt(count)} question${count === 1 ? '' : 's'}` : 'None yet'}</span>
                          <span className="sj-unit__bar" aria-hidden="true"><span style={{ '--w': `${Math.round((count / unitMax) * 100)}%` }} /></span>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              {bank?.units && bank.countedOn ? <p className="sj-note">Counted {bank.countedOn} from the live bank. The count is refreshed every day.</p> : null}
            </section>

            <section className="mm-article__section">
              <h2 className="mm-h2">{hub.essay.heading}</h2>
              {hub.essay.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>

            <section className="mm-article__section" aria-labelledby="helps-title">
              <h2 className="mm-h2" id="helps-title">How MockMob turns {name} practice into marks</h2>
              <ul className="sj-helps">
                {helps.map(({ icon: Icon, title, body, href, link }) => (
                  <li key={title} className="sj-help">
                    <span className="sj-help__icon" aria-hidden="true"><Icon size={20} strokeWidth={1.8} /></span>
                    <div>
                      <h3 className="sj-help__title">{title}</h3>
                      <p className="sj-help__body">{body}</p>
                      {href ? <Link href={href} className="sj-help__link">{link}</Link> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mm-article__section" aria-labelledby="faq-title">
              <h2 className="mm-h2" id="faq-title">CUET {name} questions, answered</h2>
              <div className="mm-faqs">
                {faqs.map((faq) => (
                  <details key={faq.question} className="mm-faq">
                    <summary>{faq.question}</summary>
                    <div className="mm-faq__body">{faq.answer}</div>
                  </details>
                ))}
              </div>
            </section>

            <nav className="mm-article__section sj-others" aria-labelledby="others-title">
              <h2 className="mm-h2" id="others-title">The other CUET subjects</h2>
              {othersByStream.map(([stream, list]) => (
                <div key={stream} className="sj-others__group">
                  <h3 className="sj-others__stream">{stream}</h3>
                  <div className="mm-article__links">
                    {list.map((other) => (
                      <Link key={other.slug} href={`/cuet/${other.slug}`} className="mm-chip">CUET {other.name}</Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          <aside className="mm-close">
            <div className="mm-wrap mm-wrap--tight">
              <h2 className="mm-h2">{FIRST_FULL_FREE ? `Your first ${name} mock is free.` : 'Reading about it is not practice.'}</h2>
              <p className="mm-body">
                {FIRST_FULL_FREE
                  ? `${PAPER.questions} questions in ${PAPER.minutes} minutes, marked +${PAPER.right} and ${String(PAPER.wrong).replace('-', '−')} like the real paper, then the review of every miss. Sign up free; no card needed.`
                  : `Create a free account and sit a timed ${name} set tonight. No card needed.`}
              </p>
              <div className="mm-actions" style={{ marginTop: '1.75rem' }}>
                <Link href="/signup" className="mm-btn mm-btn--primary">{action}</Link>
                <Link href="/pricing" className="mm-btn mm-btn--secondary">See what Pro adds</Link>
              </div>
            </div>
          </aside>
        </article>
      </main>

      <MarketingFooter />
      <MobileDock note={FIRST_FULL_FREE ? `Your first ${name} mock is free.` : `Practise ${name} tonight.`} />
    </div>
  );
}
