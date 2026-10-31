"use client";
// The chapter's Must-know sheet, printed from a Learn chapter page (owner LK6: the printable sheet carries the MockMob mark all
// over it). It is v1's own PrintSheet (kc-print, PrintMark with the tiled mark and the "Printed for ..." footer, PrintHead):
// this file only fetches the chapter's deck when the student asks to print, draws the sheet into <body> (print only, display none
// on screen, keycards.css) and calls window.print once it is in the page. Who may print is v1's rule: Pro, with Must-know cards.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PrintSheet } from '../../keycards/ChapterDeck';
import { readDeck } from '../../keycards/api';
import { splitDeck } from '../../keycards/kinds';
import { printCards } from './printModel.mjs';
import '../../keycards/keycards.css';

/** usePrintSheet(chapterKey): { start, busy, failed, sheet } - `start()` loads the deck, then prints; render `sheet` once on the page. */
export function usePrintSheet(chapterKey) {
  const [deck, setDeck] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const wantPrint = useRef(false);
  const cards = useMemo(() => (deck ? printCards(splitDeck(deck.cards).open) : []), [deck]);

  const start = useCallback(() => {
    if (busy) return;
    setFailed(false);
    if (deck) { window.print(); return; }
    setBusy(true);
    wantPrint.current = true;
    readDeck(chapterKey)
      .then((d) => setDeck(d))
      .catch(() => { wantPrint.current = false; setFailed(true); setBusy(false); });
  }, [busy, deck, chapterKey]);

  // The sheet draws into <body> a moment after the deck lands (PrintSheet's own portal); print on the frame after that.
  useEffect(() => {
    if (!deck || !wantPrint.current) return undefined;
    wantPrint.current = false;
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => { setBusy(false); if (cards.length) window.print(); else setFailed(true); }); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [deck, cards.length]);

  useEffect(() => { setDeck(null); }, [chapterKey]); // eslint-disable-line react-hooks/set-state-in-effect -- a new chapter prints its own sheet

  const sheet = deck && cards.length ? <PrintSheet deck={deck} cards={cards} /> : null;
  return { start, busy, failed, sheet };
}
