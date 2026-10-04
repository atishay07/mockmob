"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { evaluateAll } from '@/lib/du/eligibility';
import { PRESETS, STREAM_ORDER, encodeSelection, loadRules } from '@/lib/du/client';
import '@/components/du/du.css';

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
  const [selection, setSelection] = useState({ languages: ['english'], domains: [], gat: false });

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

  const toggle = (kind, id) =>
    setSelection((s) => {
      if (kind === 'gat') return { ...s, gat: !s.gat };
      const key = kind === 'language' ? 'languages' : 'domains';
      return { ...s, [key]: s[key].includes(id) ? s[key].filter((x) => x !== id) : [...s[key], id] };
    });

  const hasDomains = selection.domains.length > 0 || selection.gat;
  const results = useMemo(() => (rules ? evaluateAll(rules.groups, selection) : []), [rules, selection]);
  const eligible = results.filter((r) => r.eligible);
  const byStream = useMemo(() => {
    const counts = {};
    for (const r of eligible) counts[r.group.stream] = (counts[r.group.stream] || 0) + 1;
    return STREAM_ORDER.filter((s) => counts[s]).map((s) => [s, counts[s]]);
  }, [eligible]);
  const max = Math.max(1, ...byStream.map(([, n]) => n));
  const query = encodeSelection(selection);
  const href = `/cuet-cutoff-calculator${query ? `?s=${query}` : ''}`;

  return (
    <div className="du-teaser" ref={hostRef}>
      <div className="du-teaser__pick">
        <div className="du-presets" role="group" aria-label="Quick start">
          <span>Quick start</span>
          {PRESETS.filter((p) => p.id !== 'commerce-maths').map((p) => (
            <button key={p.id} type="button" className="du-preset" title={p.hint} onClick={() => setSelection({ languages: [...p.languages], domains: [...p.domains], gat: p.gat })}>
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
          <div className="du-chips">
            {DOMAINS.map(([id, name]) => (
              <Chip key={id} pressed={selection.domains.includes(id)} onClick={() => toggle('domain', id)}>{name}</Chip>
            ))}
            <Chip pressed={selection.gat} onClick={() => toggle('gat', 'gat')}>General Aptitude Test</Chip>
          </div>
        </fieldset>
        <Link href={href} className="du-live">
          <span className="mm-measure">{rules && hasDomains ? eligible.length : '–'}</span>
          <span>of {rules ? rules.groups.length : 73} programmes unlocked</span>
          <b>See cutoffs<ArrowRight size={14} aria-hidden="true" /></b>
        </Link>
      </div>

      <div className="du-teaser__out" aria-live="polite">
        {failed ? (
          <p className="du-state du-state--error">The DU data could not load. Open the full calculator instead.</p>
        ) : (
          <>
            <p className="du-teaser__big">
              <span className="mm-measure">{rules && hasDomains ? eligible.length : '–'}</span>
              <small>of {rules ? rules.groups.length : 73} DU programmes</small>
            </p>
            <p className="du-teaser__lead">
              {rules && hasDomains
                ? 'unlocked by these subjects under the 2026 rules. Open them for published 2026 college-wise cutoffs.'
                : 'Add your domain subjects to see which Delhi University programmes you can apply to.'}
            </p>
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
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <p className="du-teaser__fine">Free. No signup. Built from DU’s official 2026 documents.</p>
      </div>
    </div>
  );
}
