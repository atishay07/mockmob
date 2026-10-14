"use client";

import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, Select, Textarea } from '@/components/ui/Input';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { Surface } from '@/components/ui/Card';
import { PageHead } from '@/components/ui/PageHead';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, OfflineState, LoadingState } from '@/components/ui/Skeleton';
import { AppIcon } from '@/components/ui/Glyph';
import './ui-kit.css';

const ROLES = ['ground', 'raised', 'raised-2', 'sunken', 'line', 'line-strong', 'ink', 'ink-2', 'ink-3', 'accent-text', 'bad-text', 'warn-text', 'good-text'];
const TYPE = [
  ['figure-hero', '183'],
  ['moment', 'Ten minutes, then sleep.'],
  ['headline', 'Partnership is costing you marks'],
  ['screen-title', 'Practice'],
  ['title', 'Your last session'],
  ['card-title', 'Accountancy, 10 questions'],
  ['lead', 'You missed 4 of 9 on goodwill. Repair the step, then check it on fresh questions.'],
  ['body', 'Questions come from the checked bank. Held questions stay out of practice until they pass.'],
  ['label-large', 'Start practice'],
  ['caption', '10 questions, about 10 minutes. 10 credits.'],
];

// Preview switches change this tab only; they never write the saved theme or glass choice.
function subscribeRoot(notify) {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-glass'] });
  return () => observer.disconnect();
}

function useRootAttr(name, fallback) {
  const value = useSyncExternalStore(subscribeRoot, () => document.documentElement.dataset[name] || fallback, () => fallback);
  const set = (next) => { document.documentElement.dataset[name] = next; };
  return [value, set];
}

export default function UiKitClient() {
  const [theme, setTheme] = useRootAttr('theme', 'dark');
  const [glass, setGlass] = useRootAttr('glass', 'full');
  const [minutes, setMinutes] = useState('20');
  const [subjects, setSubjects] = useState(['accountancy']);
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState(false);

  function press() {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 1600);
  }

  const toggleSubject = (id) => setSubjects((cur) => (cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]));

  return (
    <div className="kit">
      <header className="ui-chrome kit__bar">
        <b className="kit__brand">mockmob</b>
        <div className="kit__switches">
          <ChipGroup label="Theme" single>
            <Chip selected={theme === 'dark'} onClick={() => setTheme('dark')}>Night</Chip>
            <Chip selected={theme === 'light'} onClick={() => setTheme('light')}>Light</Chip>
          </ChipGroup>
          <ChipGroup label="Glass" single>
            {['full', 'lite', 'off'].map((g) => <Chip key={g} selected={glass === g} onClick={() => setGlass(g)}>{g === 'full' ? 'Full' : g === 'lite' ? 'Lite' : 'Off'}</Chip>)}
          </ChipGroup>
        </div>
      </header>

      <main className="kit__main">
        <PageHead title="UI kit" lead="Tokens and components from shared/tokens.json, in every state. This page is for development checks and is not part of the product." />

        <section className="kit__section" aria-labelledby="kit-type">
          <h2 id="kit-type" className="type-title">Type</h2>
          <div className="kit__type">
            {TYPE.map(([role, text]) => (
              <div key={role} className="kit__type-row">
                <span className="type-caption kit__muted">{role}</span>
                <span className={`type-${role}`}>{text}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="kit__section" aria-labelledby="kit-colour">
          <h2 id="kit-colour" className="type-title">Colour roles</h2>
          <ul className="kit__swatches">
            {ROLES.map((role) => (
              <li key={role}><span className="kit__swatch" style={{ background: `var(--mm-${role})` }} /> <span className="type-caption">{role}</span></li>
            ))}
            <li><span className="kit__swatch" style={{ background: 'var(--mm-volt)' }} /> <span className="type-caption">volt, the one accent</span></li>
          </ul>
        </section>

        <section className="kit__section" aria-labelledby="kit-buttons">
          <h2 id="kit-buttons" className="type-title">Buttons</h2>
          <p className="type-caption kit__muted">Hover, focus and pressed: use a pointer and the keyboard. Arrows typed after a label are removed.</p>
          <div className="kit__row">
            <Button onClick={press} loading={loading}>Start practice</Button>
            <Button variant="secondary">Review mistakes</Button>
            <Button variant="quiet">Not now</Button>
          </div>
          <div className="kit__row">
            <Button size="sm" icon="play">Resume your test</Button>
            <Button size="lg">Continue practice {'→'}</Button>
            <Button loading>Saving</Button>
          </div>
          <div className="kit__row">
            <Button disabled disabledReason="Add a subject first.">Start practice</Button>
            <Button variant="secondary" disabled>Download PDF</Button>
            <Button variant="quiet" disabled>Skip</Button>
          </div>
          <div className="kit__narrow"><Button block>Start your 10-question check</Button></div>
        </section>

        <section className="kit__section" aria-labelledby="kit-fields">
          <h2 id="kit-fields" className="type-title">Fields</h2>
          <div className="kit__grid">
            <Field label="Name" hint="As you want it on your sheet."><TextInput placeholder="Your first name" /></Field>
            <Field label="Email"><TextInput type="email" defaultValue="student@example.com" /></Field>
            <Field label="Target score" error="Enter a number from 0 to 250."><TextInput inputMode="numeric" defaultValue="300" /></Field>
            <Field label="Promo code" ok="Code applied."><TextInput defaultValue="MOCK10" /></Field>
            <Field label="Subject"><Select placeholder="Choose a subject" defaultValue="" options={[{ value: 'accountancy', label: 'Accountancy' }, { value: 'business_studies', label: 'Business Studies' }, { value: 'economics', label: 'Economics' }]} /></Field>
            <Field label="Board" hint="Locked after your first mock."><TextInput defaultValue="CBSE" disabled /></Field>
            <Field label="What went wrong" optional><Textarea placeholder="Tell us in a sentence or two" /></Field>
          </div>
        </section>

        <section className="kit__section" aria-labelledby="kit-chips">
          <h2 id="kit-chips" className="type-title">Chips</h2>
          <ChipGroup label="How long have you got" single>
            {['10', '20', '30'].map((m) => <Chip key={m} selected={minutes === m} onClick={() => setMinutes(m)}>{m} minutes</Chip>)}
          </ChipGroup>
          <ChipGroup label="Subjects">
            {[['accountancy', 'Accountancy'], ['business_studies', 'Business Studies'], ['economics', 'Economics'], ['english', 'English']].map(([id, label]) => (
              <Chip key={id} selected={subjects.includes(id)} onClick={() => toggleSubject(id)}>{label}</Chip>
            ))}
            <Chip disabled>General Test</Chip>
          </ChipGroup>
          <div className="kit__row">
            <Badge>Held for checks</Badge><Badge variant="volt">Pro</Badge><Badge variant="red">Wrong in 2</Badge>
          </div>
        </section>

        <section className="kit__section" aria-labelledby="kit-surfaces">
          <h2 id="kit-surfaces" className="type-title">Surfaces</h2>
          <div className="kit__grid">
            <Surface level="focal">
              <span className="type-caption kit__muted">Tonight</span>
              <p className="type-card-title">Repair Partnership: goodwill</p>
              <p className="type-small kit__muted">You missed 4 of 9. About 10 minutes.</p>
              <Surface level="raised"><span className="type-small">A card inside a card becomes a well.</span></Surface>
              <div className="kit__row"><Button size="sm">Start repair</Button></div>
            </Surface>
            <Surface level="raised">
              <p className="type-card-title">Last session</p>
              <p className="type-small kit__muted">6 of 15 answered, 4 right. Yesterday, 11:42 PM.</p>
            </Surface>
            <Surface level="sunken"><p className="type-small">A quiet aside sits in a well.</p></Surface>
            <Surface level="plain">
              <p className="type-card-title">Plain group</p>
              <p className="type-small kit__muted">Most content needs no box: spacing and a hairline do the grouping.</p>
              <hr className="ui-divider" />
              <p className="type-small kit__muted">Next group.</p>
            </Surface>
            <Surface level="raised" onClick={() => {}}>
              <p className="type-card-title">Pressable surface</p>
              <p className="type-small kit__muted">The whole card is one control.</p>
            </Surface>
          </div>
        </section>

        <section className="kit__section" aria-labelledby="kit-states">
          <h2 id="kit-states" className="type-title">States</h2>
          <div className="kit__grid">
            <LoadingState label="Loading your sessions" />
            <EmptyState title="No saved questions yet." message="Save a question from any review and it waits here." actionLabel="Start practice" onAction={() => {}} />
            <ErrorState title="Your plan did not load" message="Nothing you did is lost. Try again in a moment." onRetry={() => {}} />
            <OfflineState onRetry={() => {}} />
          </div>
        </section>

        <section className="kit__section" aria-labelledby="kit-glass">
          <h2 id="kit-glass" className="type-title">Glass on chrome</h2>
          <p className="type-small kit__muted">The bar at the top and this sheet are the only glass. Content cards stay solid.</p>
          <div className="kit__row"><Button variant="secondary" onClick={() => setSheet((s) => !s)} aria-expanded={sheet}>{sheet ? 'Close the sheet' : 'Open a sheet'}</Button></div>
          {sheet ? (
            <div className="ui-sheet kit__sheet" role="dialog" aria-label="Quick start">
              <p className="type-card-title">Quick start</p>
              <button type="button" className="kit__sheet-row"><AppIcon name="practice" size={18} /> Quick 10<span className="type-caption kit__muted">10 questions, about 10 minutes. 10 credits.</span></button>
              <button type="button" className="kit__sheet-row"><AppIcon name="practice" size={18} /> Full mock<span className="type-caption kit__muted">50 questions, 60 minutes.</span></button>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
