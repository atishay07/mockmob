"use client";

// The arena's one Ask Mobi panel (N9, ASK-MOBI-1018). It answers openAskMobi({ context }) from anywhere in the shell and
// opens the panel over the current page, already about what the student is looking at. The drawer and its panel load on
// the first open (fetched once the page is idle), so the shell carries none of that code until a student asks.
//
// The navigation's own "Ask Mobi" door (the sidebar's foot, and the You sheet on a phone) is a plain link to /mentor, which is
// now Ask Mobi's own page (ASK-MOBI-1019 option B, D114): two doors and the conversation, in the page. The docked panel stays
// for asks about one question or one mock (a repair, a result, Today, Practice), where the page under it matters; it is no
// longer opened by the navigation door.
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ASK_MOBI_EVENT, normalizeContext, contextFromLegacy } from './askMobi.mjs';

const AssistantDrawer = dynamic(() => import('./AssistantDrawer'), { ssr: false });

export default function AskMobiHost() {
  const [request, setRequest] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);

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
      // A new key per request remounts the panel, so a question asked from a repair never inherits an older answer.
      setRequest({ context, key: Date.now(), returnTo: typeof detail.returnTo === 'string' ? detail.returnTo : null });
      setOpen(true);
    };
    window.addEventListener(ASK_MOBI_EVENT, onAsk);
    return () => window.removeEventListener(ASK_MOBI_EVENT, onAsk);
  }, []);

  // The shell reads these: the docked form makes the main column give up the panel's width, and the nav row shows it open.
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute('data-mobi-open', open);
    if (open && form) root.setAttribute('data-mobi-form', form); else root.removeAttribute('data-mobi-form');
    return () => { root.removeAttribute('data-mobi-open'); root.removeAttribute('data-mobi-form'); };
  }, [open, form]);

  if (!request) return null;
  return (
    <AssistantDrawer
      key={request.key}
      open={open}
      onClose={() => setOpen(false)}
      onForm={setForm}
      context={request.context}
      returnTo={request.returnTo}
    />
  );
}
