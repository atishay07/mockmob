"use client";

// The account door of the signed-in top bar (D8, owner LK97, 5 Nov 2026): the avatar and name are a button that opens a small
// pop-over under it, modelled on the app's Account sheet (name and plan, credits, Appearance, the account links, Show me around,
// Write to us, a quiet Sign out). On a phone (owner LK141, 5 Nov 2026) the same door opens the same panel as a sheet under the
// top bar, over a scrim: the dock's You opens the You page, and the person here is the quick account sheet. It used to be the
// other way round, which he called "the opposite of what I think a UI should do".
// A real button (aria-haspopup, aria-expanded); the panel is a dialog with its focus held inside, Escape and a press outside
// close it, and focus returns to the door. The credits door beside it stays a link to the Wallet.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import AppearanceSwitch from '@/components/AppearanceSwitch';
import { SignOutButton } from '@/components/profile/SignOutConfirm';
import { TOUR_LABEL } from '@/lib/helpDoor.mjs';
import { ACCOUNT_POPOVER_COPY as COPY, proUntilWords } from './accountPopoverCopy.mjs';
import './account-popover.css';

const PHONE = '(max-width: 639px)';
const FOCUSABLE = 'a[href], button:not([disabled]), [role="radio"][tabindex="0"]';
const isPhone = () => { try { return window.matchMedia(PHONE).matches; } catch { return false; } };

export default function AccountPopover({ user, accountName, credits, links = {}, current = false, onTour = null, children }) {
  // null: closed; otherwise how it is drawn: 'pop' under the door (640 px and wider) or 'sheet' under the top bar (a phone).
  const [open, setOpen] = useState(null);
  const [top, setTop] = useState(64);
  // On a phone the sheet is drawn at the shell's own level, outside the top bar: the bar's blur makes it the frame of anything fixed
  // inside it, and the scrim has to cover the page and the dock. The shell is found when the door is pressed.
  const [host, setHost] = useState(null);
  const door = useRef(null);
  const panel = useRef(null);
  const panelId = useId();
  const titleId = useId();
  const pro = Boolean(user?.isPremium);
  const profileHref = links.profile || '/profile';

  // While the phone sheet is open the page behind it is inert (the skip link, the top bar, the page, the dock and the rail), so a screen reader's
  // cursor stays in the dialog as Tab does (fix stage, 6 Nov). Released before focus goes back to the door, which sits in the top bar.
  const inerted = useRef([]);
  const release = useCallback(() => {
    for (const el of inerted.current) el.removeAttribute('inert');
    inerted.current = [];
  }, []);

  const close = useCallback((returnFocus) => {
    release();
    setOpen(null);
    if (returnFocus) door.current?.focus();
  }, [release]);

  useEffect(() => {
    if (open !== 'sheet' || !host) return undefined;
    const background = [...host.querySelectorAll(':scope > :is(.arena-skip, .arena-topbar, .app-main, .arena-dock, .arena-sidebar)')].filter((el) => !el.inert);
    for (const el of background) el.setAttribute('inert', '');
    inerted.current = background;
    return release;
  }, [open, host, release]);

  useEffect(() => {
    if (!open) return undefined;
    panel.current?.querySelector(FOCUSABLE)?.focus({ preventScroll: true });
    const insideModal = (target) => Boolean(target?.closest?.('dialog[open]'));
    const onKey = (event) => {
      if (insideModal(event.target)) return; // the sign-out question is its own modal
      if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
      if (event.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const head = items[0];
      const tail = items[items.length - 1];
      const active = document.activeElement;
      if (!panel.current.contains(active)) { event.preventDefault(); head.focus(); }
      else if (event.shiftKey && active === head) { event.preventDefault(); tail.focus(); }
      else if (!event.shiftKey && active === tail) { event.preventDefault(); head.focus(); }
    };
    // A press on the scrim closes on its own click, so a tap never falls through to the page beneath it.
    const onPress = (event) => {
      if (panel.current?.contains(event.target) || door.current?.contains(event.target)) return;
      if (insideModal(event.target) || event.target?.closest?.('.acct-pop-scrim')) return;
      close(false);
    };
    // Crossing the phone line redraws the door's panel the other way: it simply closes.
    const onResize = () => { if ((open === 'sheet') !== isPhone()) close(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPress);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPress);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close]);

  const onDoor = () => {
    if (open) { close(false); return; }
    if (isPhone()) {
      const bar = door.current?.closest('.arena-topbar')?.getBoundingClientRect();
      setTop(Math.round(bar ? bar.bottom + 8 : 64));
      setHost(door.current?.closest('.app-shell') || document.body);
      setOpen('sheet');
      return;
    }
    setOpen('pop');
  };
  const leave = () => close(false);
  const tour = () => { close(false); onTour?.(); };
  const until = pro ? proUntilWords(user?.premiumUntil) : null;
  const name = accountName ?? COPY.noName;
  // Every row that acts looks pressable (owner F5; R8 PRAC-17, TOOLS-19): a trailing chevron, a hairline between rows, a pressed fill.
  const chev = <ChevronRight className="acct-pop__chev" size={16} strokeWidth={2.2} aria-hidden="true" />;

  const body = (
    <div ref={panel} id={panelId} className={`acct-pop${open === 'sheet' ? ' acct-pop--sheet' : ''}`} role="dialog" aria-modal={open === 'sheet' ? 'true' : undefined} aria-labelledby={titleId} style={open === 'sheet' ? { top, '--acct-top': `${top}px` } : undefined}>
      <div className="acct-pop__who">
        <Avatar name={accountName || user?.email} size="sm" />
        <div className="acct-pop__id">
          <b id={titleId}>{name}</b>
          <span>{pro ? (until ? `${COPY.planPro}, ${until}` : COPY.planPro) : COPY.planFree}</span>
        </div>
      </div>

      <Link href={links.wallet || '/wallet'} className="acct-pop__credits" onClick={leave}>
        <span>{COPY.credits}</span>
        <b>{Number(credits).toLocaleString('en-IN')}</b>
      </Link>

      <div className="acct-pop__block">
        <span className="acct-pop__label">{COPY.appearance}</span>
        <AppearanceSwitch className="acct-pop__switch" />
      </div>

      <nav className="acct-pop__rows" aria-label="Account">
        <Link href={profileHref} onClick={leave}><span>{COPY.rowAccount}</span>{chev}</Link>
        <Link href={`${profileHref}#privacy`} onClick={leave}><span>{COPY.rowPrivacy}</span>{chev}</Link>
        <Link href={links.help || '/help'} onClick={leave}><span>{COPY.rowHelp}</span>{chev}</Link>
        {onTour ? <button type="button" onClick={tour}><span>{TOUR_LABEL}</span>{chev}</button> : null}
        <a href={COPY.contactHref}>
          <span className="acct-pop__two"><span>{COPY.rowContact}</span><small>{COPY.contactAddress}</small></span>
          {chev}
        </a>
      </nav>

      <SignOutButton className="acct-pop__out">{COPY.signOut}</SignOutButton>
    </div>
  );
  return (
    <>
      <button
        ref={door}
        type="button"
        className="arena-acct__you"
        aria-haspopup="dialog"
        aria-expanded={Boolean(open)}
        aria-controls={open ? panelId : undefined}
        aria-label={`Account, ${accountName ?? 'your profile'}${pro ? ', Pro' : ''}`}
        aria-current={current ? 'page' : undefined}
        onClick={onDoor}
      >
        {children}
      </button>
      {open === 'pop' ? body : null}
      {open === 'sheet' && host ? createPortal(
        <>
          <div className="acct-pop-scrim" aria-hidden="true" onClick={() => close(true)} />
          {body}
        </>,
        host,
      ) : null}
    </>
  );
}
