"use client";

// Contribute questions (You > Community, web only): two tabs, Submit and Your submissions. /my-uploads is
// now /upload?tab=mine. One true line about rewards sits under the title (data/plan_facts.mjs says what
// production does). Submit is one form with the many-at-once import behind a labelled disclosure; Your
// submissions is the list of what the student sent and where each question stands.
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { UploadForm } from '@/components/feed/UploadForm';
import BulkImport from '@/components/profile/BulkImport';
import Submissions from '@/components/profile/Submissions';
import { CONTRIBUTE_COPY, UPLOAD_TABS, uploadTab } from '@/components/profile/youModel.mjs';
import { YOU_HREF } from '@/lib/navigation';
import '@/components/profile/you.css';

export default function UploadPageClient({ initialTab = null }) {
  const fromUrl = uploadTab(useSearchParams().get('tab') || initialTab);
  const [tab, setTab] = useState(fromUrl);
  const [seen, setSeen] = useState(fromUrl);
  const refs = useRef([]);
  // A link to /upload?tab=mine while this page is open follows the address bar.
  if (seen !== fromUrl) { setSeen(fromUrl); setTab(fromUrl); }

  function select(id) {
    setTab(id);
    try {
      const url = new URL(window.location.href);
      if (id === 'mine') url.searchParams.set('tab', 'mine'); else url.searchParams.delete('tab');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    } catch { /* the tab still changes without the address */ }
  }

  const onKeyDown = (event, index) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : event.key === 'Home' ? -index : event.key === 'End' ? UPLOAD_TABS.length - 1 - index : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + UPLOAD_TABS.length) % UPLOAD_TABS.length;
    refs.current[next]?.focus();
    select(UPLOAD_TABS[next].id);
  };

  return (
    <div className="student-page student-page--upload you you--narrow">
      <header className="you__head">
        <div className="you__head-text">
          <h1 className="you__title">{CONTRIBUTE_COPY.title}</h1>
          <p className="you__lede">{CONTRIBUTE_COPY.lead}</p>
        </div>
        <Link className="you-key" href={YOU_HREF}>Back to You</Link>
      </header>
      <p className="you-reward">{CONTRIBUTE_COPY.rewardLine}</p>

      <div>
        <div className="you-tabs" role="tablist" aria-label={CONTRIBUTE_COPY.title}>
          {UPLOAD_TABS.map((item, index) => (
            <button
              key={item.id}
              ref={(node) => { refs.current[index] = node; }}
              type="button"
              role="tab"
              id={`you-tab-${item.id}`}
              className="you-tab"
              aria-selected={tab === item.id}
              aria-controls={tab === item.id ? `you-panel-${item.id}` : undefined}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => select(item.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >{item.label}</button>
          ))}
        </div>

        <div className="you-panel" role="tabpanel" id={`you-panel-${tab}`} aria-labelledby={`you-tab-${tab}`} tabIndex={-1}>
          {tab === 'submit' ? (
            <>
              <UploadForm onShowSubmissions={() => select('mine')} />
              <BulkImport />
            </>
          ) : (
            <>
              <p className="you-reward">{CONTRIBUTE_COPY.mineLead}</p>
              <Submissions onWrite={() => select('submit')} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
