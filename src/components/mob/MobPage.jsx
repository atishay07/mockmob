"use client";
// /mob: the Mob on the website (SOCIAL-SPEC sections 7 and 15). One private group of 2 to 5 students, one shared 10-question
// paper a week, one ring that only fills. Design notes (AGENT_RULES evidence IDs):
//   - One primary action per state: start a Mob; sit the paper; or, alone, invite (rule 7).
//   - The name is prefilled from the account and editable (T001, rule 13). Score sharing is off until the student turns
//     it on (rule 14). The cost line is the server's, under the button, before the tap (T006, T008, rules 19 and 23).
//   - No streak to lose, no countdown, no list of who has not sat (T005, rule 22): the ring names sitters, the roster
//     carries no sitting state, and the nudge reply is not repeated as a count (P6). Nothing is shown as done before the
//     server answers (standards 7).
//   - Free and Pro (section 15) are drawn from the plan the server sent: the paper, the ring, your result and the teaser are
//     free; the side-by-side, past weeks, extra papers and a second Mob are Pro. The one free side-by-side is the sample.
//   - The page's volt key carries data-page-primary, so the Start key in the bar or sidebar steps back (rule 7, WB-05).
//   - The effect of the loop is a hypothesis [I] to measure (rules 37 and 38): SOCIAL-SPEC section 13.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Ellipsis, Share2, UserPlus } from 'lucide-react';
import ArenaHead from '@/components/arena/ArenaHead';
import { ToggleRow } from '@/components/ui/controls/ToggleRow';
import { resolveSubject } from '@/../data/subject_registry';
import {
  CLOSED_LINE, CLOSES_LINE, COLOUR_COUNT, MAX_MEMBERS, canAfford, checkName, cleanName, costLine, initialOf,
  inviteExpiryLine, nudgeLine, paperHref, resultHref, seatsLine, togetherLine, trapLine,
} from '@/lib/mob/model.mjs';
import { MobRing } from './MobRing';
import { MobDialog } from './MobDialog';
import { CompareCard, SHARE_LABEL, SideBySide } from './MobCompare';
import { ExtrasCard } from './MobExtras';
import { HistoryCard } from './MobHistory';
import { MobSwitcher, ProNote } from './MobPlan';
import { useMob } from './useMob';
import { pendingJoin } from './JoinMob';
import './mob.css';

const COLOUR_NAMES = ['Teal', 'Sky', 'Violet', 'Rose', 'Amber', 'Green', 'Coral', 'Slate'];
const NAME_RULE = 'Use 2 to 18 letters. Spaces, dots, apostrophes and hyphens are fine.';

function subjectsFrom(user) {
  const seen = new Set();
  const out = [];
  for (const raw of user?.subjects || []) {
    const s = resolveSubject(raw);
    if (!s.launch || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push({ id: s.id, name: s.officialName });
  }
  return out;
}

function ColourPicker({ value, onChange, name }) {
  return (
    <fieldset className="mob-colours">
      <legend className="mob-label">Colour</legend>
      <div className="mob-colours__row">
        {Array.from({ length: COLOUR_COUNT }, (_, i) => (
          <label key={i} className="mob-colour" title={COLOUR_NAMES[i]}>
            <input type="radio" name={name} value={i} checked={value === i} onChange={() => onChange(i)} />
            <span className="mob-disc mob-disc--pick" data-colour={i} aria-hidden="true">{value === i ? <Check size={16} strokeWidth={2.5} /> : null}</span>
            <span className="sr-only">{COLOUR_NAMES[i]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function NameField({ value, onChange, error, id }) {
  return (
    <div className="mob-field">
      <label className="mob-label" htmlFor={id}>Your name in the Mob</label>
      <input id={id} className="mob-input" value={value} maxLength={18} autoComplete="given-name" onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined} aria-describedby={`${id}-hint`} />
      <p id={`${id}-hint`} className={error ? 'mob-hint mob-hint--bad' : 'mob-hint'}>{error || 'Only your Mob sees it. 2 to 18 letters.'}</p>
    </div>
  );
}

/** The fields and the one key that start a Mob: subject, name, colour. Used on the empty page and in "Start another Mob". */
function StartForm({ user, mob, invited = false, skip = [], onStarted, name: formName = 'start' }) {
  const subjects = useMemo(() => subjectsFrom(user).filter((s) => !skip.includes(s.id)), [user, skip]);
  const [subject, setSubject] = useState(() => subjects[0]?.id || '');
  const [name, setName] = useState(() => cleanName(user?.name || '').split(' ')[0].slice(0, 18));
  const [colour, setColour] = useState(0);
  const [error, setError] = useState(null);
  const [nameError, setNameError] = useState(null);
  const nameId = useId();
  const start = async () => {
    setError(null);
    const checked = checkName(name);
    if (!checked.ok) { setNameError(NAME_RULE); return; }
    setNameError(null);
    const r = await mob.run('/api/mob', { subject, name: checked.name, colour }, { name: 'create' });
    if (!r.ok) { if (r.code?.startsWith('NAME')) setNameError(r.message); else setError(r.message); return; }
    onStarted?.();
  };
  return (
    <>
      {subjects.length ? (
        <fieldset className="mob-subjects">
          <legend className="mob-label">Subject for the weekly paper</legend>
          <div className="mob-chips">
            {subjects.map((s) => (
              <label key={s.id} className="mob-chip" data-on={subject === s.id || undefined}>
                <input type="radio" name={`mob-subject-${formName}`} value={s.id} checked={subject === s.id} onChange={() => setSubject(s.id)} />
                <span>{s.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="mob-note">{skip.length ? 'Every subject you study already has a Mob.' : <>Add a subject on <Link className="mob-link" href="/profile">Account</Link> first, then start a Mob for it.</>}</p>
      )}
      <NameField id={nameId} value={name} onChange={setName} error={nameError} />
      <ColourPicker value={colour} onChange={setColour} name={`mob-colour-${formName}`} />
      <div className="mob-actions">
        <button type="button" className={invited ? 'mob-key mob-primary' : 'btn-volt md mob-primary'} data-page-primary={invited || formName !== 'start' ? undefined : ''} onClick={start} disabled={!subject || mob.busy === 'create'} aria-busy={mob.busy === 'create' || undefined}>
          {mob.busy === 'create' ? 'Starting your Mob' : 'Start a Mob'}
        </button>
        {formName === 'start' ? <p className="mob-note">Sent a link by a friend? Open the link to join their Mob instead.</p> : null}
      </div>
      <p className="mob-notice" role="status" aria-live="polite">{error || ''}</p>
    </>
  );
}

/** No Mob yet: what it is, then subject, name and colour, then one key. */
function StartMob({ user, mob, invited = false }) {
  return (
    <div className="mob-start">
      <ul className="mob-promises">
        <li>Same 10 questions for everyone, fresh each week.</li>
        <li>You see who sat, never who didn&apos;t.</li>
        <li>Scores stay private unless you choose.</li>
        <li>The weekly paper is free of credits.</li>
      </ul>
      <section className="glass mob-card mob-form" aria-labelledby="mob-start-h">
        <h2 id="mob-start-h" className="mob-h2">Start your Mob</h2>
        <StartForm user={user} mob={mob} invited={invited} />
      </section>
    </div>
  );
}

function StartAnotherDialog({ open, onClose, user, mob, skip }) {
  return (
    <MobDialog open={open} onClose={onClose} title="Start another Mob" labelId="mob-another-h">
      <div className="mob-form mob-form--plain">
        <StartForm user={user} mob={mob} skip={skip} onStarted={onClose} name="another" />
      </div>
    </MobDialog>
  );
}

/** A friend's invite opened before sign-in: the code waits on this device for an hour (T004). */
function PendingInvite({ code }) {
  if (!code) return null;
  return (
    <section className="glass mob-card mob-trap" aria-labelledby="mob-pending-h">
      <h2 id="mob-pending-h" className="mob-h3">You were invited to a Mob.</h2>
      <Link className="btn-volt md mob-primary" data-page-primary="" href={`/join/${code}`}>Open the invite</Link>
    </section>
  );
}

function NoMob({ user, mob }) {
  const [code] = useState(() => (typeof window === 'undefined' ? null : pendingJoin()));
  return <><PendingInvite code={code} /><StartMob user={user} mob={mob} invited={Boolean(code)} /></>;
}

function InviteDialog({ open, onClose, mob, run, busy }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const invite = mob.invite;
  const make = async () => {
    setError(null);
    const r = await run('/api/mob/invite', undefined, { name: 'invite' });
    if (!r.ok) setError(r.message); else await mob.reload();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(invite.url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { setError('Copy did not work here. Select the link and copy it.'); }
  };
  const share = async () => {
    try { await navigator.share({ title: 'Join my Mob on MockMob', text: `Sit one 10-question ${mob.subjectName} paper a week with me.`, url: invite.url }); } catch { /* closed or not allowed: the link is still there */ }
  };
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return (
    <MobDialog open={open} onClose={onClose} title={`Invite a friend (${seatsLine(mob.seatsLeft)})`} labelId="mob-invite-h">
      {invite ? (
        <div className="mob-invite">
          <p className="mob-note">Anyone with this link can join while there are seats. MockMob never asks for your contacts.</p>
          <div className="mob-linkbox">
            <input className="mob-input" readOnly value={invite.url} aria-label="Invite link" onFocus={(e) => e.target.select()} />
          </div>
          <div className="mob-actions mob-actions--row">
            <button type="button" className="btn-volt md" onClick={copy}>{copied ? <><Check size={16} aria-hidden="true" />Copied</> : <><Copy size={16} aria-hidden="true" />Copy link</>}</button>
            {canShare ? <button type="button" className="mob-key" onClick={share}><Share2 size={16} aria-hidden="true" />Share</button> : null}
          </div>
          <p className="mob-hint">{inviteExpiryLine(invite.expiresAt)}. A new link turns this one off.</p>
          <button type="button" className="mob-link" onClick={make} disabled={busy === 'invite'}>Make a new link</button>
        </div>
      ) : (
        <div className="mob-invite">
          <p className="mob-note">Make a link and send it to up to {mob.seatsLeft} {mob.seatsLeft === 1 ? 'friend' : 'friends'}. It works for 7 days.</p>
          <button type="button" className="btn-volt md" onClick={make} disabled={busy === 'invite'} aria-busy={busy === 'invite' || undefined}>{busy === 'invite' ? 'Making the link' : 'Make an invite link'}</button>
        </div>
      )}
      <p className="mob-notice" role="status" aria-live="polite">{error || ''}</p>
    </MobDialog>
  );
}

function MemberDialog({ member, you, onClose, run, busy, onLeft }) {
  const [step, setStep] = useState('menu');
  const [error, setError] = useState(null);
  const open = Boolean(member);
  const close = () => { setStep('menu'); setError(null); onClose(); };
  const act = async (path, body, name) => {
    setError(null);
    const r = await run(path, body, { name });
    if (!r.ok) { setError(r.message); return; }
    if (r.data?.left === true) onLeft?.();
    if (path === '/api/mob/report' && !body.block) setStep('reported'); else close();
  };
  return (
    <MobDialog open={open} onClose={close} title={member ? member.name : ''} labelId="mob-member-h">
      {member && step === 'menu' ? (
        <div className="mob-menu">
          <button type="button" className="mob-menu__item" onClick={() => setStep('report')}>Report</button>
          <button type="button" className="mob-menu__item" onClick={() => setStep('block')}>Leave and block</button>
          {you.role === 'owner' ? <button type="button" className="mob-menu__item" onClick={() => setStep('remove')}>Remove from Mob</button> : null}
        </div>
      ) : null}
      {member && step === 'report' ? (
        <div className="mob-menu">
          <p className="mob-note">What is wrong? Moderators see the reason and the name, nothing else.</p>
          <button type="button" className="mob-menu__item" disabled={Boolean(busy)} onClick={() => act('/api/mob/report', { memberId: member.memberId, reason: 'name' }, 'report')}>Their name is not okay</button>
          <button type="button" className="mob-menu__item" disabled={Boolean(busy)} onClick={() => act('/api/mob/report', { memberId: member.memberId, reason: 'nudge' }, 'report')}>Their nudges bother me</button>
          <button type="button" className="mob-menu__item" disabled={Boolean(busy)} onClick={() => act('/api/mob/report', { memberId: member.memberId, reason: 'safety' }, 'report')}>I do not feel safe</button>
        </div>
      ) : null}
      {member && step === 'reported' ? (
        <div className="mob-menu">
          <p className="mob-note">Reported. A moderator will look at it. You can also leave and block {member.name}.</p>
          <button type="button" className="mob-key mob-key--bad" disabled={Boolean(busy)} onClick={() => act('/api/mob/leave', { block: member.memberId }, 'leave')}>Leave and block</button>
          <button type="button" className="mob-link" onClick={close}>Done</button>
        </div>
      ) : null}
      {member && step === 'block' ? (
        <div className="mob-menu">
          <p className="mob-note">You leave this Mob and never share one with {member.name} again. Your sittings leave with you.</p>
          <button type="button" className="mob-key mob-key--bad" disabled={Boolean(busy)} onClick={() => act('/api/mob/leave', { block: member.memberId }, 'leave')}>{busy === 'leave' ? 'Leaving' : 'Leave and block'}</button>
        </div>
      ) : null}
      {member && step === 'remove' ? (
        <div className="mob-menu">
          <p className="mob-note">{member.name} leaves the Mob, with their sittings. They can join again only with a new link.</p>
          <button type="button" className="mob-key mob-key--bad" disabled={Boolean(busy)} onClick={() => act('/api/mob/remove', { memberId: member.memberId }, 'remove')}>{busy === 'remove' ? 'Removing' : `Remove ${member.name}`}</button>
        </div>
      ) : null}
      <p className="mob-notice" role="status" aria-live="polite">{error || ''}</p>
    </MobDialog>
  );
}

function RenameDialog({ open, onClose, you, run, busy }) {
  const [name, setName] = useState(you.name);
  const [colour, setColour] = useState(you.colour);
  const [error, setError] = useState(null);
  const id = useId();
  const save = async () => {
    const checked = checkName(name);
    if (!checked.ok) { setError(NAME_RULE); return; }
    const r = await run('/api/mob/me', { name: checked.name, colour }, { method: 'PATCH', name: 'rename' });
    if (!r.ok) setError(r.message); else onClose();
  };
  return (
    <MobDialog open={open} onClose={onClose} title="Change name or colour" labelId="mob-rename-h">
      <div className="mob-form mob-form--plain">
        <NameField id={id} value={name} onChange={setName} error={error} />
        <ColourPicker value={colour} onChange={setColour} name="mob-colour-edit" />
        <button type="button" className="btn-volt md" onClick={save} disabled={busy === 'rename'}>{busy === 'rename' ? 'Saving' : 'Save'}</button>
      </div>
    </MobDialog>
  );
}

function LeaveDialog({ open, onClose, run, busy, onLeft, several, subjectName }) {
  const [error, setError] = useState(null);
  const leave = async () => {
    const r = await run('/api/mob/leave', {}, { name: 'leave' });
    if (!r.ok) setError(r.message); else { onClose(); onLeft(); }
  };
  return (
    <MobDialog open={open} onClose={onClose} title={several ? `Leave your ${subjectName} Mob?` : 'Leave your Mob?'} labelId="mob-leave-h">
      <div className="mob-menu">
        <p className="mob-note">Your sittings leave with you. You can start or join another Mob after.</p>
        <button type="button" className="mob-key mob-key--bad" onClick={leave} disabled={busy === 'leave'}>{busy === 'leave' ? 'Leaving' : 'Leave Mob'}</button>
        <button type="button" className="mob-link" onClick={onClose}>Stay</button>
      </div>
      <p className="mob-notice" role="status" aria-live="polite">{error || ''}</p>
    </MobDialog>
  );
}

function TrapCard({ trap, resultId }) {
  if (!trap) return null;
  return (
    <section className="glass mob-card mob-trap mk-rise" aria-labelledby="mob-trap-h">
      <h2 id="mob-trap-h" className="mob-h3">{trapLine(trap)}</h2>
      <p className="mob-note">{trap.trapName ? `Trap: ${trap.trapName}.` : 'A common wrong pick.'} {trap.youGotItRight ? 'You got this one right.' : trap.youPickedIt ? `You picked ${trap.option} too.` : 'You did not pick it.'}</p>
      {resultId ? <Link className="mob-key" href={resultHref(resultId)}>{trap.youGotItRight ? `See why ${trap.option} is wrong` : 'Repair it'}</Link> : null}
    </section>
  );
}

/** What you and the sitters who show their score have in common (model.mjs computeTogether). No rank, no names. */
function TogetherCard({ together }) {
  if (!together) return null;
  return (
    <section className="glass mob-card mk-rise" aria-labelledby="mob-together-h">
      <h2 id="mob-together-h" className="mob-h3">This week together</h2>
      <p className="mob-note">{togetherLine(together)}</p>
    </section>
  );
}

function InMob({ data, mob, user }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [member, setMember] = useState(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [anotherOpen, setAnotherOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [sbs, setSbs] = useState(null);
  const [opening, setOpening] = useState(null);
  const [cmpNotice, setCmpNotice] = useState(null);
  const headingRef = useRef(null);
  const { week, you, members, nudge } = data;
  const alone = week.size === 1;
  const reload = mob.load;
  const run = mob.run;
  const several = (data.mobs || []).length > 1;

  useEffect(() => { if (sbs) headingRef.current?.focus({ preventScroll: false }); }, [sbs]);

  const openCompare = useCallback(async (key, query) => {
    setCmpNotice(null);
    setOpening(key);
    const r = await mob.compare(query);
    setOpening(null);
    if (!r.ok) { setCmpNotice(r.message); await reload(); return null; }
    setSbs({ data: r.data.compare, query, key });
    return r.data.compare;
  }, [mob, reload]);

  const closeCompare = () => {
    const key = sbs?.key;
    setSbs(null);
    setTimeout(() => { document.getElementById(key === 'week' ? 'mob-compare-open' : '')?.focus(); }, 0);
  };

  const share = async () => {
    const r = await run('/api/mob/me', { showScore: true }, { method: 'PATCH', name: 'showScore' });
    if (!r.ok) { setCmpNotice(r.message); return; }
    if (sbs) await openCompare(sbs.key, sbs.query);
  };

  const sendNudge = async () => {
    setNotice(null);
    const r = await run('/api/mob/nudge', undefined, { name: 'nudge' });
    if (!r.ok) { setNotice(r.message); return; }
    setNotice('Sent. Members who have not sat will see it when they next open MockMob.');
    await reload();
  };
  const seenNudge = async () => { await run('/api/mob/nudge/seen', undefined, { name: 'seen' }); await reload(); };
  const toggle = async (key, value) => {
    setNotice(null);
    const r = await run('/api/mob/me', { [key]: value }, { method: 'PATCH', name: key });
    if (!r.ok) setNotice(r.message);
  };
  const nudgeReason = { sent: 'You asked the others this week.', everyone_sat: 'Everyone has sat this week.', closed: 'This week\'s paper has closed.' }[nudge.reason] || null;
  const cost = week.paper.cost;
  const afford = canAfford(cost);
  const freeUsed = week.paper.blocked === 'free_used';
  const primary = (extra = '') => `${alone ? 'mob-key' : 'btn-volt md'} mob-primary${extra}`;
  const pageProps = alone ? {} : { 'data-page-primary': '' };

  if (sbs) {
    return (
      <SideBySide data={sbs.data} mine={you} onBack={closeCompare} onShare={share} busy={Boolean(mob.busy)} headingRef={headingRef} />
    );
  }

  return (
    <>
      <MobSwitcher data={data} busy={Boolean(mob.busy)} onSelect={(id) => mob.select(id)} onStartAnother={() => setAnotherOpen(true)} />

      <section className="glass mob-card mob-ringcard" aria-labelledby="mob-ring-h">
        <h2 id="mob-ring-h" className="sr-only">This week</h2>
        <MobRing size={week.size} sat={week.sat} week={week.start} members={members} />
        <div className="mob-ringcard__text">
          <p className="mob-ringcard__subject">{data.subjectName} paper, 10 questions</p>
          <p className="mob-note">{week.closed ? CLOSED_LINE : CLOSES_LINE}</p>
          {nudge.received ? (
            <p className="mob-nudge">{nudgeLine(nudge.received.fromName)} <button type="button" className="mob-link" onClick={seenNudge}>Got it</button></p>
          ) : null}
          <div className="mob-actions">
            {!week.youSat && !week.closed && !freeUsed ? (
              <>
                {afford
                  ? <Link className={primary()} {...pageProps} href={paperHref(data)}>Sit this week&apos;s paper (10 questions, about 12 min)</Link>
                  : <Link className={primary()} {...pageProps} href="/pricing?reason=credits">Get credits to sit it</Link>}
                <p className="mob-cost">{costLine(cost)}</p>
              </>
            ) : null}
            {!week.youSat && freeUsed ? (
              <>
                <p className="mob-note">You already sat a Mob paper this week, in another Mob. Free includes one a week.</p>
                <Link className="mob-key" href="/pricing">See Pro</Link>
              </>
            ) : null}
            {week.youSat ? (
              <>
                {week.yourResultId ? <Link className={primary()} {...pageProps} href={resultHref(week.yourResultId)}>See your answers</Link> : null}
                {!alone ? (
                  <button type="button" className="mob-key" onClick={sendNudge} disabled={!nudge.canSend || mob.busy === 'nudge'} aria-describedby={nudgeReason ? 'mob-nudge-why' : undefined}>
                    Ask the others to sit it
                  </button>
                ) : null}
                {nudgeReason && !alone ? <p id="mob-nudge-why" className="mob-hint">{nudgeReason}</p> : null}
              </>
            ) : null}
          </div>
        </div>
      </section>

      {week.youSat && !alone ? (
        <CompareCard compare={data.compare} busy={Boolean(mob.busy)} opening={opening === 'week'} openId="mob-compare-open" notice={cmpNotice}
          onOpen={() => openCompare('week', {})} onShare={share} />
      ) : null}
      <TrapCard trap={data.trap} resultId={week.yourResultId} />
      {week.youSat && !alone ? <TogetherCard together={data.together} /> : null}

      <ExtrasCard data={data} run={run} busy={mob.busy} comparing={opening && opening !== 'week' ? opening : null}
        onCompare={(x) => openCompare(x.id, { extra: x.id })} />

      <section className="glass mob-card" aria-labelledby="mob-members-h">
        <header className="mob-head">
          <h2 id="mob-members-h" className="mob-h2">Members</h2>
          <span className="mob-count">{week.size} of {MAX_MEMBERS}</span>
        </header>
        <ol className="mob-members">
          {members.map((m) => (
            <li key={m.memberId} className="mob-member">
              <span className="mob-disc" data-colour={m.colour} aria-hidden="true">{initialOf(m.name)}</span>
              <span className="mob-member__name"><b>{m.name}</b>{m.you ? <span>You</span> : null}</span>
              {/* P6: no "Sat" or blank beside a name, so no row reads as "has not sat". The ring names the sitters. */}
              {m.sat && m.score ? <span className="mob-member__state"><span className="mob-score">{m.score.value} of {m.score.of}</span></span> : null}
              {!m.you ? <button type="button" className="mob-icon" aria-label={`More for ${m.name}`} onClick={() => setMember(m)}><Ellipsis size={18} aria-hidden="true" /></button> : <span className="mob-icon mob-icon--spacer" aria-hidden="true" />}
            </li>
          ))}
        </ol>
        {data.seatsLeft > 0 ? (
          <button type="button" className={alone ? 'btn-volt md mob-invite-row' : 'mob-key mob-invite-row'} data-page-primary={alone ? '' : undefined} onClick={() => setInviteOpen(true)}>
            <UserPlus size={16} aria-hidden="true" />Invite a friend ({seatsLine(data.seatsLeft)})
          </button>
        ) : <p className="mob-note">Your Mob is full: 5 of 5.</p>}
      </section>

      <HistoryCard data={data} load={mob.history} comparing={opening && opening !== 'week' ? opening : null} onCompare={(w) => openCompare(w, { week: w })} />
      <ProNote data={data} />

      <section className="glass mob-card" aria-labelledby="mob-settings-h">
        <h2 id="mob-settings-h" className="mob-h2">Settings</h2>
        <div className="mob-settings">
          {/* A Mob of one has nobody to show a score to or to be nudged by: the two switches arrive with the first friend. */}
          {!alone ? <>
            <ToggleRow checked={you.showScore} onChange={(v) => toggle('showScore', v)} disabled={Boolean(mob.busy)} label={SHARE_LABEL} hint="Off by default. Your Mob sees 7 of 10 beside your name, and members who share see what each other picked. Never a ranking." />
            <ToggleRow checked={you.nudgesMuted} onChange={(v) => toggle('nudgesMuted', v)} disabled={Boolean(mob.busy)} label="Mute nudges" hint="You will not see Sit it with me notes." />
          </> : null}
          <button type="button" className="mob-row-btn" onClick={() => setRenameOpen(true)}>Change name or colour</button>
          <button type="button" className="mob-row-btn mob-row-btn--bad" onClick={() => setLeaveOpen(true)}>Leave Mob</button>
        </div>
        <p className="mob-notice" role="status" aria-live="polite">{notice || ''}</p>
      </section>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} mob={{ ...data, reload }} run={run} busy={mob.busy} />
      <MemberDialog member={member} you={you} onClose={() => setMember(null)} run={run} busy={mob.busy} onLeft={reload} />
      {renameOpen ? <RenameDialog open={renameOpen} onClose={() => setRenameOpen(false)} you={you} run={run} busy={mob.busy} /> : null}
      <LeaveDialog open={leaveOpen} onClose={() => setLeaveOpen(false)} run={run} busy={mob.busy} onLeft={reload} several={several} subjectName={data.subjectName} />
      {anotherOpen ? <StartAnotherDialog open={anotherOpen} onClose={() => setAnotherOpen(false)} user={user} mob={mob} skip={(data.mobs || []).map((m) => m.subject)} /> : null}
    </>
  );
}

function Loading() {
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 250); return () => clearTimeout(t); }, []);
  if (!shown) return <div className="mob-loading" aria-busy="true" aria-label="Loading your Mob" />;
  return (
    <div className="mob-loading" aria-busy="true" aria-label="Loading your Mob">
      <div className="glass mob-card mob-ringcard"><span className="mob-skel mob-skel--ring" /><span className="mob-skel mob-skel--line" /></div>
      <div className="glass mob-card">{[0, 1, 2].map((i) => <span key={i} className="mob-skel mob-skel--row" />)}</div>
    </div>
  );
}

export default function MobPage({ user }) {
  const mob = useMob(user?.id);
  const data = mob.mob;
  // The h1 never changes after focus lands on it (WA-01): "Your Mob" in every state, the state's phrase in the lede.
  const lede = data
    ? (data.week.size === 1 ? 'Invite a friend to start your ring. Same 10 questions for everyone, fresh each week.'
      : data.week.closed ? 'The ring shows who sat this week\'s paper. It never shows who did not.'
        : 'The ring fills as your Mob sits this week\'s paper. It shows who sat, never who has not.')
    : 'Sit one paper a week with up to 4 friends. A small private group, one shared 10-question paper, about 12 minutes.';
  return (
    <div className="student-page student-page--mob">
      <section className="pr ov mob-page" aria-busy={mob.status === 'loading' || undefined}>
        <ArenaHead title="Your Mob" lede={mob.status === 'ready' ? lede : null} />
        {mob.status === 'idle' || mob.status === 'loading' ? (data ? null : <Loading />) : null}
        {mob.status === 'error' && !data ? (
          <section className="glass mob-card" role="alert">
            <h2 className="mob-h3">Your Mob did not load</h2>
            <p className="mob-note">{mob.error}</p>
            <button type="button" className="mob-key" onClick={() => mob.load()}>Try again</button>
          </section>
        ) : null}
        {mob.status === 'error' && data ? (
          <p className="mob-banner" role="alert">{mob.error} <button type="button" className="mob-link" onClick={() => mob.load()}>Try again</button></p>
        ) : null}
        {mob.status === 'disabled' ?<section className="glass mob-card"><p className="mob-note">The Mob is not available yet.</p></section> : null}
        {mob.status === 'ready' && !data ? <NoMob user={user} mob={mob} /> : null}
        {/* keyed by Mob: a different Mob starts clean, so no side-by-side of the one before stays open */}
        {data ? <InMob key={data.id} data={data} mob={mob} user={user} /> : null}
      </section>
    </div>
  );
}
