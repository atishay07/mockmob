'use client';

// "How we counted": the short sheet behind the CUET 2026 figure, and the quiet key that opens it (owner, 23 Nov 2026: a
// button like his reference's, showing what "covered" means; kept basic). The words come in as `how` (coverageWords.mjs
// howWeCounted, with the built summary's numbers); nothing is typed here.
// A native <dialog>: Esc, the Close key and a press outside the sheet leave it, the page behind cannot be worked while it is
// open, and focus returns to the key. On a phone it rises from the foot of the screen; wider, it is a panel in the middle.
import { useRef } from 'react';
import Link from 'next/link';
import { Info, X } from 'lucide-react';

export default function CoverageHow({ how }) {
  const keyRef = useRef(null);
  const dialogRef = useRef(null);

  const open = () => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  };
  const close = () => { if (dialogRef.current?.open) dialogRef.current.close(); };
  const onClosed = () => { keyRef.current?.focus({ preventScroll: true }); };

  return (
    <>
      <button type="button" ref={keyRef} className="lp-ch-key" onClick={open}>
        <Info size={17} strokeWidth={2.2} aria-hidden="true" />
        {how.button}
      </button>
      <dialog ref={dialogRef} className="lp-ch" aria-labelledby="lp-ch-title" onClose={onClosed} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
        <div className="lp-ch__sheet">
          <header className="lp-ch__head">
            <h3 className="lp-ch__title" id="lp-ch-title">{how.title}</h3>
            <button type="button" className="lp-ch__close" onClick={close} aria-label={how.close}><X size={22} strokeWidth={2.4} aria-hidden="true" /></button>
          </header>
          <div className="lp-ch__body">
            {how.sections.map((section) => (
              <section key={section.id} className="lp-ch__sec" aria-labelledby={`lp-ch-${section.id}`}>
                <h4 className="lp-ch__h" id={`lp-ch-${section.id}`}>{section.head}</h4>
                <ul className="lp-ch__points">
                  {section.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </section>
            ))}
            <p className="lp-ch__note">{how.note}</p>
            <Link href={how.link.href} prefetch={false} className="mm-btn mm-btn--secondary lp-ch__link">{how.link.text}</Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
