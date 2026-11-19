"use client";

// The arena's one Ask Mobi window (N9, ASK-MOBI-1018; the chat box 20 Nov 2026). It answers openAskMobi({ context }) from anywhere
// in the shell and opens the conversation over the current page, already about what the student is looking at. The window and its
// panel load on the first open (fetched once the page is idle), so the shell carries none of that code until a student asks.
//
// The navigation's own "Ask Mobi" door (the sidebar's foot, and the You sheet on a phone) is a plain link to /mentor, Ask Mobi's own
// page (ASK-MOBI-1019 option B, D114). The window is for the chat box at the bottom right (AskMobiLauncher.jsx) and for asks about
// one question or one mock (a repair, a result, Today, Practice), where the page under it matters: it floats over that page and
// never narrows, crops or restacks it (owner, 20 Nov 2026).
//
// The open state, the form and who opened it go to askMobiStore, which the chat box reads to step away while the window is open.
// The only attributes written on the document are data-mobi-open (the rail's door reads as open) and, on a phone, data-mobi-form.
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ASK_MOBI_CLOSE_EVENT, ASK_MOBI_EVENT, normalizeContext, contextFromLegacy } from './askMobi.mjs';
import { setAskMobiState } from './askMobiStore';

const AssistantDrawer = dynamic(() => import('./AssistantDrawer'), { ssr: false });

export default function AskMobiHost({ mentorHref = '/mentor' }) {
  const [request, setRequest] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const launcher = Boolean(request?.launcher);

  // Fetch the panel's code once the page is idle, so the first open is at once instead of waiting on the network.
  useEffect(() => {
    const load = () => { import('./AssistantDrawer').catch(() => {}); };
    const idle = window.requestIdleCallback ? window.requestIdleCallback(load, { timeout: 4000 }) : window.setTimeout(load, 2500);
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(idle) : window.clearTimeout(idle));
  }, []);

  useEffect(() => {
    const onAsk = (event) => {
      event.preventDefault();
      const detail = event.detail || {};
      const context = detail.context ? normalizeContext(detail.context) : contextFromLegacy(detail);
      // A new key per request remounts the panel, so a question asked from a repair never inherits an older answer. Making the
      // window larger or smaller is not a request: the same conversation goes on.
      setRequest({ context, key: Date.now(), launcher: detail.launcher === true });
      setOpen(true);
    };
    const onClose = () => setOpen(false);
    window.addEventListener(ASK_MOBI_EVENT, onAsk);
    window.addEventListener(ASK_MOBI_CLOSE_EVENT, onClose);
    return () => { window.removeEventListener(ASK_MOBI_EVENT, onAsk); window.removeEventListener(ASK_MOBI_CLOSE_EVENT, onClose); };
  }, []);

  // data-mobi-open: the rail's door reads as open. data-mobi-form only for a phone's sheet: on a screen 768 px and wider nothing is
  // written that a page could lay itself out by, so no page ever falls into a narrower form while Ask Mobi is open.
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute('data-mobi-open', open);
    if (open && form === 'sheet') root.setAttribute('data-mobi-form', 'sheet'); else root.removeAttribute('data-mobi-form');
    setAskMobiState({ open, form: open ? form : null, launcher: open && launcher });
    return () => { root.removeAttribute('data-mobi-open'); root.removeAttribute('data-mobi-form'); setAskMobiState({ open: false, form: null, launcher: false }); };
  }, [open, form, launcher]);

  if (!request) return null;
  return (
    <AssistantDrawer
      key={request.key}
      open={open}
      onClose={() => setOpen(false)}
      onForm={setForm}
      context={request.context}
      launcher={launcher}
      pageHref={mentorHref}
    />
  );
}
