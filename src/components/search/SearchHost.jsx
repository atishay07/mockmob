"use client";

// Mounts Search for the signed-in shell (lane palette, 18 Nov 2026) and listens for its keys: Shift tapped twice (20 Nov, the
// shown key on Windows, Linux and ChromeOS; it closes Search too), Ctrl+Space on Windows and Linux (19 Nov; the panel's own key
// handler closes it with the same press), Ctrl+K or Cmd+K anywhere, "/" when focus is not in a field. Never on the paper, onboarding or a Mob game, and never over another open dialog or sheet
// (searchKeyAction in src/lib/search/searchModel.mjs). The shell passes its own navigation lists, so a page is found by the
// name the sidebar gives it, and its preview links, so a walk through /preview/arena stays in the fixtures.
import { useCallback, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { searchKeyAction, shiftTapper, shiftTwiceAction } from '@/lib/search/searchModel.mjs';
import { pageItems, previewHref, startItems } from '@/lib/search/searchSources.mjs';
import { closeSearch, openSearch, requestCloseSearch, searchState, useSearchState } from './searchStore';
import { macNow } from './SearchButtons';
import SearchPalette from './SearchPalette';

// Another dialog or sheet on screen (the Start sheet, the account pop-over, the guide, the Pro sheet, a confirm): no key opens
// Search over it, so a stray key never stacks one panel on another.
function otherDialogOpen() {
  try {
    return [...document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]')]
      .some((node) => !node.closest('.srch') && node.getClientRects().length > 0);
  } catch { return false; }
}

function targetOf(event) {
  const node = event.target;
  return { tag: node?.tagName || '', type: node?.type || '', editable: Boolean(node?.isContentEditable) };
}

export default function SearchHost({ path = '', groups = [], learn = true, learn2 = false, userSubjects = [], mentorHref = '/mentor', previewLinks = null }) {
  const state = useSearchState();
  const pathname = usePathname();

  // Shift, twice (20 Nov 2026): the shown key on Windows, Linux and ChromeOS, since a browser can keep a Ctrl or Alt chord for
  // itself (Opera GX keeps Ctrl+Space) and none binds a lone Shift. Every key, pointer press and lost focus goes through the pure
  // tapper (searchModel shiftTapper); its verdict follows Ctrl+K's rules (shiftTwiceAction), and while Search is open it closes
  // it through the panel's own animated close. It works from inside a text field too.
  useEffect(() => {
    const tapper = shiftTapper();
    const feed = (type, event) => tapper.feed({
      type, key: event?.key, code: event?.code, ctrlKey: event?.ctrlKey, altKey: event?.altKey, metaKey: event?.metaKey,
      repeat: event?.repeat, isComposing: event?.isComposing, time: event?.timeStamp || performance.now(),
    });
    const onDown = (event) => { feed('keydown', event); };
    const onUp = (event) => {
      if (feed('keyup', event) !== 'fire') return;
      const verdict = shiftTwiceAction({ path, dialogOpen: otherDialogOpen(), open: searchState().open });
      if (verdict === 'close') { requestCloseSearch(); return; }
      if (verdict !== 'open') return;
      const active = document.activeElement;
      openSearch({ opener: active && active !== document.body ? active : null });
    };
    const onPointer = (event) => { feed('pointerdown', event); };
    const onBlur = () => { tapper.reset(); };
    window.addEventListener('keydown', onDown, true);
    window.addEventListener('keyup', onUp, true);
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [path]);

  useEffect(() => {
    const onKey = (event) => {
      const verdict = searchKeyAction(
        { key: event.key, code: event.code, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey, shiftKey: event.shiftKey, repeat: event.repeat, isComposing: event.isComposing, defaultPrevented: event.defaultPrevented },
        { path, dialogOpen: otherDialogOpen(), open: searchState().open, mac: macNow(), target: targetOf(event) },
      );
      if (verdict !== 'open') return;
      event.preventDefault();
      const active = document.activeElement;
      openSearch({ opener: active && active !== document.body ? active : null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [path]);

  // A route change closes it (the row's own navigation already did; this covers the browser's back key).
  useEffect(() => { if (searchState().open) closeSearch(); }, [pathname]);
  // Back and Forward close it too when only the address's query changes (Practice on another subject, a preview view), where the
  // route above stays the same.
  useEffect(() => {
    const onPop = () => { if (searchState().open) closeSearch(); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // So does the shell setting Search aside (the paper, a focus route, a session reload): the open state never outlives the host,
  // so the panel cannot spring open, and take the focus, when the shell draws the host again.
  useEffect(() => () => closeSearch(), []);

  // The shell draws its lists afresh on every render; the pages are rebuilt only when what they name changes.
  const groupsKey = groups.map((g) => `${g.label}:${(g.items || []).map((t) => `${t.id}=${t.label}`).join(',')}`).join('|');
  const subjectsKey = (userSubjects || []).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pages = useMemo(() => pageItems(groups, { learn }), [groupsKey, learn]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const subjects = useMemo(() => userSubjects || [], [subjectsKey]);
  const actions = useMemo(() => startItems(subjects, { mentorHref }), [subjects, mentorHref]);
  const linkFor = useCallback((href) => previewHref(href, previewLinks), [previewLinks]);
  const opener = useCallback(() => searchState().opener, []);

  if (!state.open) return null;
  return <SearchPalette key={state.at} pages={pages} actions={actions} userSubjects={subjects} learn2={learn2} path={path} linkFor={linkFor} opener={opener} onClosed={closeSearch} />;
}
