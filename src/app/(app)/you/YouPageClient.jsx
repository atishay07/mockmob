"use client";

// You: the fourth place (web IA plan 2.2). Your sheet first, your week and goal, then progress, and
// beside them the calm lists: plan and credits, CUET tools, settings, community and help. Every row is
// read from the navigation (src/lib/navigation.js), so the sidebar and this page never disagree.
// One Mobi at most: the week card's own (he shows only when the week gives him something to say).
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpenText, ChevronRight, CircleHelp, Compass, FilePlus2, Home, LayoutGrid, Library, Mail, Palette, ShieldCheck, Trash2, Trophy, UserRound, Wallet } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { SubjectIcon } from '@/components/ui/Glyph';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/lib/roleContext';
import { useThemeMode } from '@/components/ThemeToggle';
import { useWalletSummary } from '@/components/useWalletSummary';
import { openGuide } from '@/components/shell/shellSignals';
import { START_ON_OPTIONS, SUBJECTS_EDIT_HREF, PLAN_HREF } from '@/lib/navigation';
import { brandFlags } from '@/../data/brand_flags.mjs';
import { subjectArt } from '@/../data/subject_art.mjs';
import GoalControl from '@/components/profile/GoalControl';
import PersonalBests from '@/components/profile/PersonalBests';
import SignOutControl from '@/components/profile/SignOutControl';
import RhythmCard from '@/components/RhythmCard';
import { planSummary, readStartOn, sheetSubjects, youGroups } from '@/components/profile/youModel.mjs';
import '@/components/profile/you.css';

const ICONS = {
  'admission-compass': Compass, combinations: LayoutGrid, 'guide-2027': BookOpenText,
  appearance: Palette, 'start-on': Home, privacy: ShieldCheck, account: UserRound, delete: Trash2,
  leaderboard: Trophy, upload: FilePlus2, 'my-uploads': Library, guide: CircleHelp, contact: Mail, moderation: ShieldCheck,
};
const THEME_NAME = { dark: 'Night', light: 'Daylight', system: 'Match device' };

function Row({ row, value = null }) {
  const Icon = ICONS[row.id] || ChevronRight;
  const body = (
    <>
      <span className="you-row__icon"><Icon size={20} strokeWidth={1.75} aria-hidden="true" /></span>
      <span className="you-row__text">
        <span className="you-row__label">{row.label}</span>
        {row.note ? <span className="you-row__note">{row.note}</span> : null}
      </span>
      {value ? <span className="you-row__value">{value}</span> : <span className="you-row__go"><ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" /></span>}
    </>
  );
  if (row.action === 'guide') return <button type="button" className="you-row" onClick={() => openGuide({ mode: 'replay' })}>{body}</button>;
  return <Link className="you-row" href={row.href}>{body}</Link>;
}

function Subject({ id, name, art }) {
  const picture = art ? subjectArt(id) : null;
  return (
    <li className="you-subject">
      {picture ? (
        <span className="you-subject__art" aria-hidden="true" style={{ '--foot-x': `${picture.footX * 100}%`, '--foot-w': `${picture.footWidth * 100}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={picture.src} alt="" width={picture.width} height={picture.height} loading="lazy" decoding="async" />
        </span>
      ) : <span className="you-subject__glyph" aria-hidden="true"><SubjectIcon id={id} size={20} /></span>}
      <span>{name}</span>
    </li>
  );
}

function Sheet({ user, art }) {
  const subjects = sheetSubjects(user?.subjects);
  return (
    <div className="you-sheet">
      <div className="you-sheet__who">
        <Avatar name={user?.name || user?.email} size="lg" />
        <div className="you-sheet__who-text">
          <h3 className="you-sheet__name">{user?.name || 'Your sheet'}</h3>
          {user?.email ? <p className="you-sheet__mail">Signed in as {user.email}</p> : null}
          <p className="you-sheet__exam">CUET UG 2027</p>
        </div>
      </div>
      <div className="you-sheet__sub">
        <h3>Subjects</h3>
        {subjects.length ? <p className="you-sheet__count">{subjects.length} of 5 picked</p> : null}
      </div>
      {subjects.length ? (
        <ul className={`you-subjects${art ? ' you-subjects--art' : ''}`}>{subjects.map((s) => <Subject key={s.id} {...s} art={art} />)}</ul>
      ) : <p className="you-sheet__none">No subjects yet. Pick up to 5 and Practice and Today use them.</p>}
      <div><Link className="you-key" href={SUBJECTS_EDIT_HREF}>{subjects.length ? 'Edit subjects' : 'Pick subjects'}</Link></div>
    </div>
  );
}

export default function YouPageClient({ brand = null }) {
  const { user } = useAuth();
  const { isModerator } = useRole();
  const mode = useThemeMode();
  const { wallet } = useWalletSummary(user?.id);
  const [startOn, setStartOn] = useState(null);
  const [weekKey, setWeekKey] = useState(0);
  const flags = brandFlags(brand);
  const groups = useMemo(() => youGroups({ moderator: isModerator }), [isModerator]);
  const plan = planSummary({
    pro: Boolean(user?.isPremium),
    practiceBalance: user?.creditBalance ?? null,
    aiRemaining: wallet?.known ? wallet.total : null,
  });

  // Start on is stored on this device, so it is read after the first paint.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { setStartOn(readStartOn(window.localStorage)); } catch { setStartOn(readStartOn(null)); }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // A link to /you#goal or /you#progress lands on its section even though the page paints first.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return undefined;
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, []);

  const valueFor = (row) => {
    if (row.id === 'appearance') return THEME_NAME[mode] || null;
    if (row.id === 'start-on') return startOn ? START_ON_OPTIONS.find((o) => o.id === startOn)?.label || null : null;
    return null;
  };

  return (
    <div className="student-page student-page--you you">
      <header className="you__head">
        <div className="you__head-text">
          <h1 className="you__title">You</h1>
          <p className="you__lede">Your sheet, your week and your settings.</p>
        </div>
      </header>

      <div className="you__grid">
        <div className="you__col">
          <section className="you-sec" id="sheet" aria-labelledby="you-sheet-h">
            <h2 className="you-sec__h" id="you-sheet-h">Your sheet</h2>
            <Sheet user={user} art={flags.subjectArt} />
          </section>

          <section className="you-sec" id="week" aria-labelledby="you-week-h">
            <h2 className="you-sec__h" id="you-week-h">Your week and goal</h2>
            <RhythmCard key={weekKey} />
            <GoalControl onSaved={() => setWeekKey((n) => n + 1)} />
          </section>

          <section className="you-sec" id="plan" aria-labelledby="you-plan-h">
            <h2 className="you-sec__h" id="you-plan-h">Plan and credits</h2>
            <ul className="you-list">
              <li>
                <Link className="you-row" href={PLAN_HREF}>
                  <span className="you-row__icon"><Wallet size={20} strokeWidth={1.75} aria-hidden="true" /></span>
                  <span className="you-row__text">
                    <span className="you-plan">
                      <span><span className="you-plan__tag" data-plan={plan.plan === 'Pro' ? 'pro' : undefined}>{plan.plan}</span></span>
                      {plan.lines.map((line) => <span key={line} className="you-plan__line">{line}</span>)}
                    </span>
                  </span>
                  <span className="you-row__go"><ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" /></span>
                </Link>
              </li>
            </ul>
          </section>

          <section className="you-sec" id="progress" aria-labelledby="you-progress-h">
            <h2 className="you-sec__h" id="you-progress-h">Milestones and personal bests</h2>
            <p className="you-sec__lead">Your milestones are the steps on your weekly rhythm above. Below are your best marks on each mock type.</p>
            <PersonalBests />
          </section>
        </div>

        <div className="you__col">
          {groups.map((group) => (
            <section className="you-sec" key={group.id} id={group.id === 'settings' ? 'settings' : undefined} aria-labelledby={`you-${group.id}-h`}>
              <h2 className="you-sec__h" id={`you-${group.id}-h`}>{group.label}</h2>
              <ul className="you-list">
                {group.rows.map((row) => (
                  <li key={row.id}>{row.action === 'sign-out' ? <SignOutControl layout="row" /> : <Row row={row} value={valueFor(row)} />}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
