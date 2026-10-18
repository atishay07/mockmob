"use client";

// The Help door's menu (N17). It rises from the door that opened it: from the sidebar's foot on a desktop (its lower
// left corner sits on the door, so it reads as the door opening), from the dock on a phone (the same place as More).
// Three rows, each a full 44 px target; the first takes focus, the arrows move between them, Escape and a click outside
// close it and put focus back on the door. It closes with a short fade so it never just vanishes.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AppIcon } from '@/components/ui/Glyph';
import { HELP_DOOR, HELP_DOOR_ROWS, tourNote } from '@/lib/helpDoor.mjs';
import { useTourStops } from './TourStops';
import './help-door.css';

const ICONS = { tour: 'guide', faq: 'help', write: 'mail' };
const CLOSE_MS = 140;

export default function HelpMenu({ request, onClose, onTour, links = null }) {
  const panel = useRef(null);
  const tourStops = useTourStops();
  const [place, setPlace] = useState(null);
  const [closing, setClosing] = useState(false);
  const anchor = request?.anchor || 'sidebar';
  const opener = request?.el || null;

  const finish = useRef(onClose);
  useEffect(() => { finish.current = onClose; }, [onClose]);
  const closingRef = useRef(false);
  const requestClose = useCallback((refocus = true) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
    window.setTimeout(() => { finish.current(); if (refocus && opener?.isConnected) opener.focus({ preventScroll: true }); }, reduced ? 0 : CLOSE_MS);
  }, [opener]);

  // Where it stands: on the sidebar door's top edge, or 8 px above the phone dock.
  useLayoutEffect(() => {
    const fit = () => {
      if (anchor === 'sidebar' && opener) {
        const rect = opener.getBoundingClientRect();
        setPlace({ left: Math.round(rect.left), bottom: Math.round(window.innerHeight - rect.top + 8) });
      } else {
        const dock = document.querySelector('.arena-dock')?.getBoundingClientRect();
        setPlace({ bottom: Math.round(dock?.height ? window.innerHeight - dock.top + 8 : 16) });
      }
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [anchor, opener]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => panel.current?.querySelector('.help-menu__row')?.focus({ preventScroll: true }));
    const rows = () => [...(panel.current?.querySelectorAll('.help-menu__row') || [])];
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); requestClose(true); return; }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Tab') return;
      const list = rows();
      const at = list.indexOf(document.activeElement);
      if (at < 0) return;
      event.preventDefault();
      const step = event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey) ? -1 : 1;
      list[(at + step + list.length) % list.length]?.focus();
    };
    const onPointer = (event) => {
      if (panel.current?.contains(event.target) || opener?.contains(event.target)) return;
      requestClose(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); };
  }, [opener, requestClose]);

  const choose = (row, event) => {
    if (row.action === 'tour') { finish.current(); onTour?.(); return; }
    finish.current();
  };

  return (
    <>
      {anchor === 'dock' ? <div className="help-menu-scrim" data-closing={closing ? '' : undefined} aria-hidden="true" /> : null}
      <div
        ref={panel}
        className="help-menu"
        role="dialog"
        aria-label={HELP_DOOR.title}
        data-anchor={anchor}
        data-closing={closing ? '' : undefined}
        style={place ? (anchor === 'sidebar' ? { left: place.left, bottom: place.bottom } : { bottom: place.bottom }) : { visibility: 'hidden' }}
      >
        <p className="help-menu__title">{HELP_DOOR.title}</p>
        <ul className="help-menu__list">
          {HELP_DOOR_ROWS.map((row) => {
            const body = (
              <>
                <span className="help-menu__icon" aria-hidden="true">
                  <AppIcon name={ICONS[row.id]} size={19} />
                </span>
                <span className="help-menu__text">
                  <b>{row.label}</b>
                  <span>{row.id === 'tour' ? tourNote(tourStops) : row.note}</span>
                </span>
              </>
            );
            return (
              <li key={row.id}>
                {row.href?.startsWith('/') ? (
                  <Link className="help-menu__row" href={links?.help || row.href} onClick={(event) => choose(row, event)}>{body}</Link>
                ) : row.href ? (
                  <a className="help-menu__row" href={row.href} onClick={(event) => choose(row, event)}>{body}</a>
                ) : (
                  <button type="button" className="help-menu__row" data-row={row.id} onClick={(event) => choose(row, event)}>{body}</button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
