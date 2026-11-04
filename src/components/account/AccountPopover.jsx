"use client";

// The account door of the signed-in top bar (D8, owner LK97, 5 Nov 2026): the avatar and name are a button that opens a small
// pop-over under it, modelled on the app's Account sheet (name and plan, credits, Appearance, the account links, Write to us, a
// quiet Sign out). Desktop and tablet only: on a phone the door still goes to Account and the dock's You sheet stays the menu.
// A real button (aria-haspopup, aria-expanded); the pop-over is a dialog with its focus held inside, Escape and a press outside
// close it, and focus returns to the door. The credits door beside it stays a link to the Wallet.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import AppearanceSwitch from '@/components/AppearanceSwitch';
import { SignOutButton } from '@/components/profile/SignOutConfirm';
import { ACCOUNT_POPOVER_COPY as COPY, proUntilWords } from './accountPopoverCopy.mjs';
import './account-popover.css';

const PHONE = '(max-width: 639px)';
const FOCUSABLE = 'a[href], button:not([disabled]), [role="radio"][tabindex="0"]';

export default function AccountPopover({ user, accountName, credits, links = {}, current = false, children }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const door = useRef(null);
  const panel = useRef(null);
  const panelId = useId();
  const titleId = useId();
  const pro = Boolean(user?.isPremium);
  const profileHref = links.profile || '/profile';

  const close = useCallback((returnFocus) => {
    setOpen(false);
    if (returnFocus) door.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    panel.current?.querySelector(FOCUSABLE)?.focus();
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
    const onPress = (event) => {
      if (panel.current?.contains(event.target) || door.current?.contains(event.target)) return;
      if (insideModal(event.target)) return;
      close(false);
    };
    const onResize = () => { if (window.matchMedia(PHONE).matches) close(false); };
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
    if (window.matchMedia(PHONE).matches) { router.push(profileHref); return; }
    setOpen((was) => !was);
  };
  const leave = () => close(false);
  const until = pro ? proUntilWords(user?.premiumUntil) : null;
  const name = accountName ?? COPY.noName;

  return (
    <>
      <button
        ref={door}
        type="button"
        className="arena-acct__you"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`Account, ${accountName ?? 'your profile'}${pro ? ', Pro' : ''}`}
        aria-current={current ? 'page' : undefined}
        onClick={onDoor}
      >
        {children}
      </button>
      {open ? (
        <div ref={panel} id={panelId} className="acct-pop" role="dialog" aria-labelledby={titleId}>
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
            <Link href={profileHref} onClick={leave}>{COPY.rowAccount}</Link>
            <Link href={`${profileHref}#privacy`} onClick={leave}>{COPY.rowPrivacy}</Link>
            <Link href={links.help || '/help'} onClick={leave}>{COPY.rowHelp}</Link>
            <a href={COPY.contactHref}>
              <span>{COPY.rowContact}</span>
              <small>{COPY.contactAddress}</small>
            </a>
          </nav>

          <SignOutButton className="acct-pop__out">{COPY.signOut}</SignOutButton>
        </div>
      ) : null}
    </>
  );
}
