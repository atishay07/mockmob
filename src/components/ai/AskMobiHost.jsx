"use client";

// The arena's one Ask Mobi panel (N9). It answers openAskMobi() from anywhere in the shell and opens the panel over the
// current page, growing from the control that asked. The drawer and its hub load on the first open, so the shell
// carries none of that code until a student asks.
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ASK_MOBI_EVENT } from './askMobi.mjs';

const AssistantDrawer = dynamic(() => import('./AssistantDrawer'), { ssr: false });

export default function AskMobiHost() {
  const [request, setRequest] = useState(null);
  const [open, setOpen] = useState(false);

  // Fetch the panel's code once the page is idle, so the first open grows at once instead of waiting on the network.
  useEffect(() => {
    const load = () => { import('./AssistantDrawer').catch(() => {}); };
    const idle = window.requestIdleCallback ? window.requestIdleCallback(load, { timeout: 4000 }) : window.setTimeout(load, 2500);
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(idle) : window.clearTimeout(idle));
  }, []);

  useEffect(() => {
    const onAsk = (event) => {
      event.preventDefault();
      // A new key per request remounts the hub, so a question asked from a repair never inherits an older transcript view.
      setRequest({ ...event.detail, key: Date.now() });
      setOpen(true);
    };
    window.addEventListener(ASK_MOBI_EVENT, onAsk);
    return () => window.removeEventListener(ASK_MOBI_EVENT, onAsk);
  }, []);

  useEffect(() => {
    document.documentElement.toggleAttribute('data-mobi-open', open);
    return () => document.documentElement.removeAttribute('data-mobi-open');
  }, [open]);

  if (!request) return null;
  return (
    <AssistantDrawer
      key={request.key}
      open={open}
      onClose={() => setOpen(false)}
      initialTab={request.tab}
      questionRef={request.questionRef}
      origin={request.origin}
    />
  );
}
