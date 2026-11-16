import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { PublicDock } from '@/components/PublicDock';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, seoMetadata, siteConfig } from '@/lib/seo';
import { ACTIONS, dateParts, loadCorrections } from '@/../data/corrections.mjs';
import { CORRECTIONS_LISTED } from '@/../data/corrections_listed.mjs';
import { CORRECTIONS_PATH, HEAD, LEGEND, LOG, REPORT, daySummary } from './correctionsCopy.mjs';
import CorrectionsWayIn from './CorrectionsWayIn';
import './corrections.css';

// The public corrections log (16 Nov 2026): what MockMob found wrong in its questions, when, and what it did. Every entry
// comes from data/corrections.json through data/corrections.mjs, which checks it and drops its private proof. The page is
// static: a visit reads no database. A new entry ships with the next deploy, and an entry dated after today is never drawn.
const LOG_METADATA = seoMetadata({
  title: 'Corrections: what we got wrong in our CUET questions | MockMob',
  description:
    'Every mistake MockMob has found in its CUET questions, with the date, what was wrong and what we did: fixed it, took it out of practice, or held it for a re-check.',
  path: CORRECTIONS_PATH,
});
// Unlisted until the owner has read it (data/corrections_listed.mjs): reachable at its address, not indexed.
export const metadata = CORRECTIONS_LISTED ? LOG_METADATA : { ...LOG_METADATA, robots: { index: false, follow: false } };

/** The answer-sheet bubble that marks each outcome: filled for fixed, crossed for taken out, dashed for held. */
function Bubble({ action }) {
  return (
    <svg className="cx-bubble" data-action={action} viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="8.25" />
      {action === 'fixed' ? <path d="M6 10.4l2.6 2.6L14.2 7.4" /> : null}
      {action === 'pulled' ? <path d="M6.8 6.8l6.4 6.4M13.2 6.8l-6.4 6.4" /> : null}
    </svg>
  );
}

function Entry({ entry }) {
  return (
    <li className="cx-entry" id={entry.id}>
      <p className="cx-entry__top">
        <span className="cx-stamp" data-action={entry.action}><Bubble action={entry.action} />{entry.actionLabel}</span>
        <span className="cx-entry__subject">{entry.subject}</span>
        {entry.countLine ? <span className="cx-entry__count">{entry.countLine}</span> : null}
      </p>
      <p className="cx-entry__wrong">{entry.wrong}</p>
      <p className="cx-entry__did">{entry.did}</p>
      {entry.bySubject.length ? (
        // A no-break space holds each subject to its own number at a line end.
        <p className="cx-entry__split">{entry.bySubject.map((s) => `${s.name.replace(/ /g, '\u00a0')}\u00a0${s.count.toLocaleString('en-IN')}`).join(', ')}</p>
      ) : null}
      <p className="cx-entry__found">{entry.foundLabel}</p>
    </li>
  );
}

function Day({ day }) {
  const { parts, entries } = day;
  const summary = daySummary(entries);
  return (
    <section className="cx-day" aria-labelledby={`cx-${day.date}`}>
      <div className="cx-day__date">
        <div className="cx-day__inner">
          <h3 className="cx-day__when" id={`cx-${day.date}`}>
            <b>{parts.day}</b>{' '}
            <span><em>{parts.month}</em>{' '}<small>{parts.year}</small></span>
          </h3>
          <p className="cx-day__marks" aria-hidden="true">
            {entries.map((e) => <Bubble key={e.id} action={e.action} />)}
          </p>
          <p className="cx-day__sum">{summary}</p>
        </div>
      </div>
      <ol className="cx-list">
        {entries.map((entry) => <Entry key={entry.id} entry={entry} />)}
      </ol>
    </section>
  );
}

export default function CorrectionsPage() {
  const log = loadCorrections();
  return (
    <div className="mm cx-page">
      <JsonLd
        id="corrections-breadcrumb-json-ld"
        data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: HEAD.crumb, path: CORRECTIONS_PATH }])}
      />
      <NavBar />
      <main id="main-content">
        <header className="cx-head">
          <div className="mm-wrap cx-wrap cx-head__grid">
            <div className="cx-head__copy">
              <nav className="mm-crumbs" aria-label="Breadcrumb">
                <Link href="/">Home</Link>
                <span aria-hidden="true">/</span>
                <span>{HEAD.crumb}</span>
              </nav>
              <h1 className="mm-h1 cx-head__title">{HEAD.title}</h1>
              <p className="cx-head__lead">{HEAD.lead}</p>
              <p className="cx-head__rule">{HEAD.rule}</p>
            </div>
            <ul className="cx-legend" aria-label="What each mark means">
              {LEGEND.map((item) => (
                <li key={item.action}>
                  <span className="cx-stamp" data-action={item.action}><Bubble action={item.action} />{ACTIONS[item.action]}</span>
                  <span className="cx-legend__line">{item.line}</span>
                </li>
              ))}
            </ul>
          </div>
        </header>

        <section className="cx-log" aria-labelledby="cx-log-title">
          <div className="mm-wrap cx-wrap">
            <div className="cx-log__head">
              <h2 className="cx-log__title" id="cx-log-title">{LOG.title}</h2>
              {log.first ? <p className="cx-log__span">{LOG.span(dateParts(log.first).label, dateParts(log.latest).label)}</p> : null}
            </div>
            {log.days.length ? (
              <div className="cx-days">
                {log.days.map((day) => <Day key={day.date} day={day} />)}
              </div>
            ) : (
              <p className="cx-log__empty">{LOG.empty}</p>
            )}
          </div>
        </section>

        <section className="cx-report" aria-labelledby="cx-report-title">
          <div className="mm-wrap cx-wrap">
            <h2 className="mm-h2" id="cx-report-title">{REPORT.title}</h2>
            <p className="cx-report__how">{REPORT.how}</p>
            <ol className="cx-steps">
              {REPORT.steps.map((step, i) => (
                <li key={step.title}>
                  <span className="cx-steps__n" aria-hidden="true">{i + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
            <p className="cx-report__result">{REPORT.result}</p>
            <CorrectionsWayIn />
            <p className="cx-report__email">
              {REPORT.email}{' '}
              <a className="mm-link mm-link--inline" href={`mailto:${siteConfig.email}?subject=A%20mistake%20in%20a%20question`}>{REPORT.emailCta}</a>
              {' '}at {siteConfig.email}.
            </p>
          </div>
        </section>
      </main>
      <MarketingFooter />
      <PublicDock />
    </div>
  );
}
