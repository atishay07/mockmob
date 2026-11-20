'use client';

// "Try it full screen" on the Practise screen (Revision 2 of the spec, LK319): it opens the live home's own full-screen exam
// view, the runner as it really is on a phone, upright, with the MockMob / NTA style switch, the same answers and the clock
// (ExamScreen.jsx). This page does not draw the exam section, and ExamScreen keeps its view to itself, so on the tap its
// section is fetched and drawn once, out of sight (never on load: no cost to a reader who does not ask), and its own
// "Try it full screen" key is pressed for it. The view is ExamScreen's in every respect: Escape, its close key and the back
// gesture close it. When it closes the hidden section goes away again and the focus comes back to this key.
// Phones only, as on the live home (exam-screen.css shows ExamScreen's key below 761 px).
import '@/app/marketing.css'; // draws the system's secondary key (mm-btn)
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { Maximize2 } from 'lucide-react';

const ExamScreen = dynamic(() => import('../landing/ExamScreen').then((m) => m.ExamScreen), { ssr: false });

export default function FullScreenTry({ label }) {
  const keyRef = useRef(null);
  const [host, setHost] = useState(null);
  useEffect(() => {
    if (!host) return undefined;
    let timer = 0;
    let tries = 0;
    let dialog = null;
    const done = () => {
      window.setTimeout(() => { setHost(null); keyRef.current?.focus({ preventScroll: true }); }, 0);
    };
    // Wait for the section to be drawn, press its key, then wait for its view to close.
    const press = () => {
      const opener = host.querySelector('.xs-full-open');
      if (!opener) { if ((tries += 1) < 120) timer = window.setTimeout(press, 50); else done(); return; }
      opener.click();
      tries = 0;
      const watch = () => {
        dialog = document.querySelector('dialog.xs-full');
        if (!dialog) { if ((tries += 1) < 60) timer = window.setTimeout(watch, 30); else done(); return; }
        dialog.addEventListener('close', done, { once: true });
      };
      watch();
    };
    press();
    return () => { window.clearTimeout(timer); dialog?.removeEventListener('close', done); };
  }, [host]);
  const open = () => {
    if (host) return;
    const node = document.createElement('div');
    node.className = 'hn-exam-host';
    node.setAttribute('aria-hidden', 'true');
    // On <body>, outside the page's React tree; ExamScreen still puts its view on the page root (.mm.lp), as on the live home.
    document.body.appendChild(node);
    setHost(node);
  };
  // The hidden host leaves the page with the view.
  useEffect(() => () => { host?.remove(); }, [host]);
  return (
    <>
      <button ref={keyRef} type="button" className="mm-btn mm-btn--secondary hn-full-key" aria-haspopup="dialog" onClick={open}
        onPointerEnter={() => import('../landing/ExamScreen')}>
        <Maximize2 aria-hidden="true" />{label}
      </button>
      {host ? createPortal(<ExamScreen />, host) : null}
    </>
  );
}
