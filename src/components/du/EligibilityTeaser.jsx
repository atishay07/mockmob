"use client";
import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown } from 'lucide-react';
import { evaluateAll } from '@/lib/du/eligibility';
import { PRESETS, STREAM_ORDER, encodeSelection, loadRules } from '@/lib/du/client';
import '@/components/du/du.css';
import { predraw } from '@/components/landing/storyPredraw.mjs';

// Landing-page version of the eligibility tool: a handful of the most common subjects,
// a live count, and a hand-off to the full calculator with the selection pre-filled.
// The rules file (62 KB) loads only when the section nears the viewport, so the hero
// stays light on a slow phone.
const LANGS = [
  ['english', 'English'],
  ['hindi', 'Hindi'],
  ['punjabi', 'Punjabi'],
  ['bengali', 'Bengali'],
  ['sanskrit', 'Sanskrit'],
  ['urdu', 'Urdu'],
];
const DOMAINS = [
  ['accountancy', 'Accountancy / Book Keeping'],
  ['business_studies', 'Business Studies'],
  ['economics', 'Economics / Business Economics'],
  ['mathematics', 'Mathematics / Applied Mathematics'],
  ['physics', 'Physics'],
  ['chemistry', 'Chemistry'],
  ['biology', 'Biology / Biotechnology / Biochemistry'],
  ['computer_science', 'Computer Science / Informatics Practices'],
  ['history', 'History'],
  ['political_science', 'Political Science'],
  ['psychology', 'Psychology'],
  ['geography', 'Geography / Geology'],
];

// The four commerce domains are always on show; the other eight and the GAT sit behind one toggle.
const SHOWN_DOMAINS = ['accountancy', 'business_studies', 'economics', 'mathematics'];
const MAX_NAMES = 6;

function Chip({ pressed, onClick, children }) {
  return (
    <button type="button" className="du-chip" aria-pressed={pressed} onClick={onClick}>
      <span className="du-chip__tick" aria-hidden="true">
        <Check size={12} strokeWidth={3} />
      </span>
      <span>{children}</span>
    </button>
  );
}

export function EligibilityTeaser() {
  const hostRef = useRef(null);
  const [rules, setRules] = useState(null);
  const [failed, setFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // Chips revealed by a tick stay where they are until "Show fewer", so unticking never makes one vanish under a finger.
  const [kept, setKept] = useState([]);
  const [selection, setSelection] = useState({ languages: ['english'], domains: [], gat: false });

  // The section is drawn once ahead of the reader while the page is idle, like the held stories (storyPredraw.mjs,
  // LK93): its first style and layout no longer land inside the scroll that reaches it.
  useEffect(() => {
    const section = hostRef.current?.closest('main > *');
    if (section) predraw(section);
  }, []);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return undefined;
    let alive = true;
    const load = () =>
      loadRules()
        .then((data) => alive && setRules(data))
        .catch(() => alive && setFailed(true));
    if (typeof IntersectionObserver === 'undefined') {
      load();
      return () => {
        alive = false;
      };
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: '600px 0px' }
    );
    observer.observe(node);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, []);

  const keep = (ids) => setKept((k) => [...new Set([...k, ...ids])]);
  const toggle = (kind, id) => {
    if (kind === 'gat') keep(['gat']);
    else if (kind === 'domain') keep([id]);
    setSelection((s) => {
      if (kind === 'gat') return { ...s, gat: !s.gat };
      const key = kind === 'language' ? 'languages' : 'domains';
      return { ...s, [key]: s[key].includes(id) ? s[key].filter((x) => x !== id) : [...s[key], id] };
    });
  };

  const hasDomains = selection.domains.length > 0 || selection.gat;
  const results = useMemo(() => (rules ? evaluateAll(rules.groups, selection) : []), [rules, selection]);
  const eligible = results.filter((r) => r.eligible);
  const byStream = useMemo(() => {
    const counts = {};
    for (const r of eligible) counts[r.group.stream] = (counts[r.group.stream] || 0) + 1;
    return STREAM_ORDER.filter((s) => counts[s]).map((s) => [s, counts[s]]);
  }, [eligible]);
  const max = Math.max(1, ...byStream.map(([, n]) => n));
  // Named programmes: the ones with the most colleges first; a group with no colleges in the data is counted
  // but never named, since the line says each comes with its college cutoffs.
  const named = eligible
    .filter((r) => r.group.offerings > 0)
    .sort((a, b) => b.group.offerings - a.group.offerings || a.group.name.localeCompare(b.group.name));
  const names = named.slice(0, MAX_NAMES).map((r) => r.group.name);
  const moreCount = Math.max(0, eligible.length - names.length);
  const query = encodeSelection(selection);
  const href = `/cuet-cutoff-calculator${query ? `?s=${query}` : ''}`;
  // Until there is a count to show, the number is the whole list, never a placeholder dash.
  const total = rules ? rules.groups.length : 73;
  const counted = Boolean(rules && hasDomains);
  // Early ticks (R8 SEC-07): with fewer than three domain subjects and no GAT the count can still read 0 (DU's 2026 rules
  // count one language and three subjects, or two languages and two subjects), so the zero is "so far" and the line names both routes.
  const early = counted && eligible.length === 0 && selection.domains.length < 3 && !selection.gat;

  return (
    <div className="du-teaser" ref={hostRef}>
      <div className="du-teaser__pick">
        <div className="du-presets" role="group" aria-label="Quick start">
          <span>Quick start</span>
          {PRESETS.filter((p) => p.id !== 'commerce-maths').map((p) => (
            <button key={p.id} type="button" className="du-preset" title={p.hint} onClick={() => { keep([...p.domains, ...(p.gat ? ['gat'] : [])]); setSelection({ languages: [...p.languages], domains: [...p.domains], gat: p.gat }); }}>
              {p.label}
            </button>
          ))}
        </div>
        <fieldset className="du-group">
          <legend>Language</legend>
          <div className="du-chips">
            {LANGS.map(([id, name]) => (
              <Chip key={id} pressed={selection.languages.includes(id)} onClick={() => toggle('language', id)}>{name}</Chip>
            ))}
          </div>
        </fieldset>
        <fieldset className="du-group">
          <legend>Domain subjects</legend>
          <div className="du-chips" id="du-teaser-domains">
            {DOMAINS.map(([id, name]) =>
              SHOWN_DOMAINS.includes(id) || showAll || kept.includes(id) || selection.domains.includes(id) ? (
                <Chip key={id} pressed={selection.domains.includes(id)} onClick={() => toggle('domain', id)}>{name}</Chip>
              ) : null
            )}
            {showAll || kept.includes('gat') || selection.gat ? (
              <Chip pressed={selection.gat} onClick={() => toggle('gat', 'gat')}>General Aptitude Test</Chip>
            ) : null}
          </div>
          <button type="button" className="du-teaser__more" aria-expanded={showAll} aria-controls="du-teaser-domains" onClick={() => { if (showAll) setKept([]); setShowAll((v) => !v); }}>
            {showAll ? 'Show fewer' : 'Show all 12 subjects and GAT'}
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </fieldset>
      </div>

      <div className="du-teaser__out" aria-live="polite">
        {failed ? (
          <p className="du-state du-state--error">The DU data could not load. Open the full calculator instead.</p>
        ) : (
          <>
            <p className="du-teaser__big" data-early={early ? 'true' : undefined}>
              <span className="mm-measure">{counted ? eligible.length : total}</span>
              <small>{early ? `of ${total} DU programmes so far` : counted ? `of ${total} DU programmes` : 'DU programmes.'}</small>
            </p>
            <p className="du-teaser__lead">
              {early
                ? 'Keep ticking: most DU programmes count one language and three subjects, or two languages and two subjects.'
                : counted
                ? 'accept these subjects under DU’s 2026 rules, each with its college cutoffs.'
                : hasDomains
                  ? 'Checking them against DU’s 2026 rules.'
                  : selection.languages.length
                    ? 'Tick your domain subjects to see which are open to you.'
                    : 'Tick your subjects to see which are open to you.'}
            </p>
            {counted && names.length ? (
              <p className="du-teaser__names">
                {names.join(', ')}
                {moreCount ? ` and ${moreCount} more` : ''}
              </p>
            ) : null}
            {rules && hasDomains && byStream.length > 0 ? (
              <ul className="du-teaser__streams">
                {byStream.map(([name, n]) => (
                  <li key={name}>
                    <span>{name}</span>
                    <i aria-hidden="true"><b style={{ transform: `scaleX(${n / max})` }} /></i>
                    <em className="mm-measure">{n}</em>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
        <Link href={href} className="mm-btn mm-btn--primary">
          See programmes and past cutoffs
        </Link>
        <p className="du-teaser__fine">Free, no signup. Built from DU’s official 2026 documents.</p>
      </div>
    </div>
  );
}
